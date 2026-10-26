import { useState } from 'preact/hooks';
import { all, item, itemName, type Item } from '../engine/content';
import { Game, OfflineSummary, PASSIVE_SKILLS, SKILLS } from '../engine/game';
import { FarmingPage } from './FarmingPage';
import { RanchingPage } from './RanchingPage';
import { ShopPage } from './ShopPage';
import { CombatPage } from './CombatPage';
import { CompletionLog, QuestsPage, ToolbeltPanel } from './ExtrasPages';
import { StatsBar } from './StatsBar';
import { describeRequirement, isDemoLockedPage, isUnlocked, navRequirements } from '../engine/navigation';
import { open as openItem, openableCap, upgrade, upgradesFrom, equipTool } from '../engine/items';
import { toolbeltCap } from '../engine/bonuses';
import { bury, equip } from '../engine/combat/combat';
import { buryCap, equipmentCap } from '../engine/combat/data';

const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer', 'Slayer'];
import { LEVEL_CAP, levelProgress } from '../engine/xp';
import { skillGlyph } from '../art/icons';
import { Bar, Icon, SkillBadge, duration, fmt } from './common';
import { exportSave, forgetContent, importSave, wipe } from '../save';
import { recipeGroups, type RecipeView } from './recipes';

type Tab = 'skills' | 'bank' | 'combat' | 'shop' | 'more';

function TopBar({ game, onOpenSkill, onOpenFood }: { game: Game; onOpenSkill: (s: string) => void; onOpenFood: () => void }) {
  const a = game.state.active;
  const name = a ? game.handler(a.skill).recipe(a.recipe).DisplayName : null;
  return (
    <header class="top">
      <div class="gold">
        <Icon id="MelvorBase:GoldPieces" size={20} /> {fmt(game.state.gold)}
      </div>
      <button class="hp" onClick={onOpenFood} aria-label="Health and food">
        ❤️ {game.hp()}
        <Bar value={game.hp()} max={game.maxHp()} color="#e0565b" />
      </button>
      {a ? (
        <button class="active" onClick={() => onOpenSkill(a.skill)}>
          <SkillBadge skill={a.skill} size={22} />
          <span class="active-name">{name}</span>
          <Bar value={1 - a.ticksLeft / a.waitTicks} color={skillGlyph(a.skill).color} />
        </button>
      ) : (
        <span class="idle">Idle</span>
      )}
    </header>
  );
}

function SkillList({ game, onOpen }: { game: Game; onOpen: (s: string) => void }) {
  const all = [...SKILLS.map((h) => h.skill).filter((s) => s !== 'Combat'), ...PASSIVE_SKILLS, ...COMBAT_SKILLS];
  return (
    <div class="page">
      <h2>Skills</h2>
      <div class="skill-grid">
        {all.map((skill) => {
          const xp = game.xp(skill);
          const running = game.state.active?.skill === skill;
          const demoLocked = isDemoLockedPage(game, skill);
          const locked = !isUnlocked(game, skill);
          if (locked) {
            const reqs = navRequirements(skill).map((r) => describeRequirement(game, r));
            return (
              <div class="skill-tile disabled locked-tile">
                <SkillBadge skill={skill} />
                <div class="skill-meta">
                  <strong>🔒 {skill}</strong>
                  {demoLocked ? (
                    <span>Locked in the demo</span>
                  ) : (
                    reqs.map((r) => <span class={r.done ? 'req-done' : ''}>{r.done ? '✓' : '•'} {r.text}</span>)
                  )}
                </div>
              </div>
            );
          }
          return (
            <button class={`skill-tile ${running ? 'running' : ''}`} onClick={() => onOpen(skill)}>
              <SkillBadge skill={skill} />
              <div class="skill-meta">
                <strong>{skill}</strong>
                <span>
                  Lv {game.level(skill)} / {LEVEL_CAP}
                  {PASSIVE_SKILLS.includes(skill) ? ' · background' : ''}
                  {COMBAT_SKILLS.includes(skill) ? ' · combat' : ''}
                </span>
                <Bar value={levelProgress(xp)} color={skillGlyph(skill).color} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkillPage({ game, skill, onBack }: { game: Game; skill: string; onBack: () => void }) {
  const [showLocked, setShowLocked] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const xp = game.xp(skill);
  const a = game.state.active;
  return (
    <div class="page">
      <div class="skill-head">
        <button class="back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <SkillBadge skill={skill} size={44} />
        <div class="skill-meta">
          <strong>{skill}</strong>
          <span>
            Level {game.level(skill)} / {LEVEL_CAP} · {fmt(xp)} XP
          </span>
          <Bar value={levelProgress(xp)} color={skillGlyph(skill).color} />
        </div>
      </div>
      <ToolbeltPanel game={game} entity={skill} />
      {skill === 'Farming' && <FarmingPage game={game} />}
      {skill === 'Ranching' && <RanchingPage game={game} />}
      {!PASSIVE_SKILLS.includes(skill) && (() => {
        const groups = recipeGroups(game, skill)
          .map((g) => ({ ...g, recipes: g.recipes.filter((r) => showLocked || r.locked !== 'demo') }))
          .filter((g) => g.recipes.length);
        if (!groups.length) return <p class="muted">Everything in {skill} is locked in the demo.</p>;
        // Many categories (e.g. Smithing's metal tiers) show one at a time behind a row of chips.
        const useChips = groups.length > 2;
        const activeGroup = groups.find((g) => g.recipes.some((r) => a?.skill === skill && a.recipe === r.id))?.name;
        const current = groups.find((g) => g.name === category) ?? groups.find((g) => g.name === activeGroup) ?? groups[0];
        const shown = useChips ? [current] : groups;
        return (
          <>
            {useChips && (
              <div class="chips">
                {groups.map((g) => (
                  <button class={g === current ? 'on' : ''} onClick={() => setCategory(g.name)}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            {shown.map((g) => (
              <section>
                {!useChips && <h3>{g.name}</h3>}
                {g.recipes.map((r) => (
                  <RecipeCard game={game} skill={skill} r={r} />
                ))}
              </section>
            ))}
          </>
        );
      })()}
      {!PASSIVE_SKILLS.includes(skill) && <label class="toggle">
        <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked((e.target as HTMLInputElement).checked)} />
        Show content locked in the demo
      </label>}
      <Log game={game} />
    </div>
  );
}

function RecipeCard({ game, skill, r }: { game: Game; skill: string; r: RecipeView }) {
  const a = game.state.active;
  const running = a?.skill === skill && a.recipe === r.id;
  return (
    <button class={`recipe ${running ? 'running' : ''} ${r.locked ? 'locked' : ''}`} onClick={() => game.toggle(skill, r.id)} disabled={!!r.locked}>
      <div class="recipe-icon">
        <Icon id={r.icon} size={44} />
        {r.makes && <span class="qty">×{r.makes}</span>}
      </div>
      <div class="recipe-body">
        <div class="recipe-title">
          <strong>{r.name}</strong>
          <span class="lvl">{r.locked === 'demo' ? 'Not in demo' : `Lv ${r.level}`}</span>
        </div>
        <div class="recipe-info">
          {r.xp} XP · {r.intervalText}
          {r.detail ? ` · ${r.detail}` : ''}
        </div>
        {r.ingredients && r.ingredients.length > 0 && !r.locked && (
          <div class="ingredients">
            {r.ingredients.map((i) => (
              <span class={i.have < i.need ? 'short' : ''}>
                <Icon id={i.item} size={18} />
                {fmt(i.have)}/{i.need}
              </span>
            ))}
          </div>
        )}
        {r.meter && !r.locked && <Bar value={r.meter.value} max={r.meter.max} color="#5fbf6a" />}
        {running && <Bar value={1 - a!.ticksLeft / a!.waitTicks} color={skillGlyph(skill).color} />}
      </div>
    </button>
  );
}

function Log({ game }: { game: Game }) {
  if (!game.log.length) return null;
  return (
    <section class="log">
      <h3>Recent</h3>
      {game.log.slice(0, 8).map((e) => (
        <div class={`log-${e.kind}`}>{e.text}</div>
      ))}
    </section>
  );
}

let itemOrderCache: Map<string, number> | null = null;
const itemOrder = () => (itemOrderCache ??= new Map(all<Item>('Item').map((it, i) => [`MelvorBase:${it.Id}`, i])));

function BankPage({ game }: { game: Game }) {
  const [selected, setSelected] = useState<string | null>(null);
  const entries = Object.entries(game.state.bank).sort((a, b) => (itemOrder().get(a[0]) ?? 0) - (itemOrder().get(b[0]) ?? 0));
  const value = entries.reduce((s, [id, q]) => s + (item(id).SellsFor?.Quantity ?? 0) * q, 0);
  const sel = selected && game.count(selected) ? selected : null;
  return (
    <div class="page">
      <h2>Bank</h2>
      <p class="muted">
        {entries.length} / {game.bankSlots()} slots · worth {fmt(value)} gold
      </p>
      {!entries.length && <p class="muted">Your bank is empty. Train a skill to gather items.</p>}
      <div class="bank-grid">
        {entries.map(([id, q]) => (
          <button class={`bank-slot ${sel === id ? 'sel' : ''}`} onClick={() => setSelected(id)}>
            <Icon id={id} size={36} />
            <span class="qty">{q >= 1e6 ? `${(q / 1e6).toFixed(1)}M` : q >= 1e4 ? `${Math.floor(q / 1e3)}K` : q}</span>
          </button>
        ))}
      </div>
      {sel && <ItemSheet game={game} id={sel} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ItemSheet({ game, id, onClose }: { game: Game; id: string; onClose: () => void }) {
  const it = item(id);
  const have = game.count(id);
  const price = it.SellsFor?.Quantity ?? 0;
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <Icon id={id} size={56} />
          <div>
            <strong>{it.DisplayName.Singular}</strong>
            <div class="muted">
              You have {fmt(have)} · sells for {fmt(price)} gold each
            </div>
          </div>
        </div>
        {it.Description && <p class="muted">{it.Description}</p>}
        {(openableCap(id) || toolbeltCap(id) || upgradesFrom(id).length > 0) && (
          <div class="row">
            {openableCap(id) && <button onClick={() => openItem(game, id, 1)}>Open 1</button>}
            {openableCap(id) && <button onClick={() => openItem(game, id, have)}>Open all</button>}
            {toolbeltCap(id) && (
              <button
                onClick={() => {
                  const cap = toolbeltCap(id)!;
                  const slot = all<{ Id: string; FitsType: string }>('ToolbeltSlot').find((s) => s.FitsType === cap.FitsInSlot);
                  if (slot) equipTool(game, 'MelvorBase:' + slot.Id, id);
                }}
              >
                Equip to toolbelt
              </button>
            )}
            {upgradesFrom(id).map((u) => (
              <button onClick={() => upgrade(game, u)}>Upgrade to {itemName(u.UpgradedItem)}</button>
            ))}
          </div>
        )}
        {(buryCap(id) || equipmentCap(id)) && (
          <div class="row">
            {buryCap(id) && <button onClick={() => bury(game, id, 1)}>Bury 1</button>}
            {buryCap(id) && <button onClick={() => bury(game, id, have)}>Bury all (+{fmt(buryCap(id)!.CurrencyGain.Quantity * have)} prayer)</button>}
            {equipmentCap(id) && <button onClick={() => equip(game, id)}>Equip</button>}
          </div>
        )}
        {game.foodHealing(id) > 0 && (
          <div class="row">
            <button onClick={() => game.eat(id)}>Eat (+{game.foodHealing(id)} HP)</button>
            <button
              onClick={() => {
                game.state.selectedFood = game.state.selectedFood === id ? null : id;
                game.emit();
              }}
            >
              {game.state.selectedFood === id ? 'Stop auto-eating' : 'Auto-eat this'}
            </button>
          </div>
        )}
        {price > 0 && (
          <div class="row">
            <button onClick={() => game.sell(id, 1)}>Sell 1</button>
            <button onClick={() => game.sell(id, Math.max(1, Math.floor(have / 2)))}>Sell half</button>
            <button class="danger" onClick={() => game.sell(id, have - 1)} disabled={have < 2}>
              All but 1
            </button>
            <button class="danger" onClick={() => game.sell(id, have)}>
              Sell all ({fmt(price * have)})
            </button>
          </div>
        )}
        <button class="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/** Shown in place of a page the demo hasn't unlocked yet, with what's needed and progress. */
function LockedPage({ game, page }: { game: Game; page: string }) {
  const reqs = navRequirements(page).map((r) => describeRequirement(game, r));
  return (
    <div class="page">
      <h2>🔒 {page}</h2>
      <p class="muted">Unlock this by:</p>
      {reqs.map((r) => (
        <div class={`card-row req ${r.done ? 'req-done' : ''}`}>
          <span>{r.done ? '✓' : '•'}</span>
          <span class="grow">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

function FoodSheet({ game, onClose }: { game: Game; onClose: () => void }) {
  const foods = Object.keys(game.state.bank).filter((id) => game.foodHealing(id) > 0);
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <h2>Health</h2>
        <p class="muted">
          {game.hp()} / {game.maxHp()} HP. Your selected food is eaten automatically at 25% HP. HP doesn't regenerate on its own.
        </p>
        <Bar value={game.hp()} max={game.maxHp()} color="#e0565b" />
        {!foods.length && <p class="muted">You have no food. Cook some fish first.</p>}
        {foods.map((id) => (
          <div class="card-row">
            <Icon id={id} size={32} />
            <div class="grow">
              {itemName(id)} ×{fmt(game.count(id))}
              <div class="muted small">Heals {game.foodHealing(id)}</div>
            </div>
            <button onClick={() => game.eat(id)}>Eat</button>
            <button
              class={game.state.selectedFood === id ? 'on' : ''}
              onClick={() => {
                game.state.selectedFood = game.state.selectedFood === id ? null : id;
                game.emit();
              }}
            >
              {game.state.selectedFood === id ? 'Auto ✓' : 'Auto'}
            </button>
          </div>
        ))}
        <button class="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function StatsPage({ game }: { game: Game }) {
  const s = game.state.stats;
  const total = [...SKILLS.map((h) => h.skill).filter((s) => s !== 'Combat'), ...PASSIVE_SKILLS, ...COMBAT_SKILLS].reduce((t, skill) => t + game.level(skill), 0);
  return (
    <div class="page">
      <h2>Statistics</h2>
      <dl class="stats">
        <dt>Total level</dt>
        <dd>{total}</dd>
        <dt>Online playtime</dt>
        <dd>{duration(s.onlineMs)}</dd>
        <dt>Offline playtime</dt>
        <dd>{duration(s.offlineMs)}</dd>
        <dt>Items sold</dt>
        <dd>{fmt(s.itemsSold)}</dd>
        <dt>Gold from sales</dt>
        <dd>{fmt(s.goldFromSales)}</dd>
        {SKILLS.map(({ skill }) => (
          <>
            <dt>{skill} actions</dt>
            <dd>{fmt(s.actions[skill] ?? 0)}</dd>
          </>
        ))}
      </dl>
    </div>
  );
}

function SettingsPage({ game, onSave }: { game: Game; onSave: () => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div class="page">
      <h2>Settings</h2>
      <section>
        <h3>Save</h3>
        <p class="muted">The game saves every 10 seconds and whenever you leave the app.</p>
        <div class="row">
          <button
            onClick={() => {
              onSave();
              setMsg('Saved.');
            }}
          >
            Save now
          </button>
          <button
            onClick={async () => {
              const s = exportSave(game.state);
              setText(s);
              try {
                await navigator.clipboard.writeText(s);
                setMsg('Save copied to clipboard.');
              } catch {
                setMsg('Copy the text below.');
              }
            }}
          >
            Export
          </button>
        </div>
        <textarea rows={4} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Paste a save here to import it" />
        <div class="row">
          <button
            onClick={() => {
              try {
                const st = importSave(text);
                if (!confirm('Replace your current progress with this save?')) return;
                game.state = st;
                game.rng.state = st.rng;
                game.state.lastUpdate = Date.now();
                onSave();
                game.emit();
                setMsg('Save imported.');
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            Import
          </button>
          <button
            class="danger"
            onClick={async () => {
              if (!confirm('Delete all progress? This cannot be undone.')) return;
              await wipe();
              location.reload();
            }}
          >
            Reset progress
          </button>
        </div>
        {msg && <p class="muted">{msg}</p>}
      </section>
      <section>
        <h3>Game data</h3>
        <p class="muted">The game's content comes from your own install's content.json, stored in this browser.</p>
        <button
          class="wide"
          onClick={async () => {
            if (!confirm('Load a different content.json? Your progress is kept.')) return;
            await forgetContent();
            location.reload();
          }}
        >
          Load different game data
        </button>
      </section>
      <section>
        <h3>About</h3>
        <p class="muted">
          A personal, portrait-mode rebuild of the Melvor Idle 2 Demo for the web. Game data comes from your own install; all art here
          is generated. Not affiliated with Games By Malcs.
        </p>
      </section>
    </div>
  );
}

function OfflineModal({ s, onClose }: { s: OfflineSummary; onClose: () => void }) {
  const items = Object.entries(s.items);
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome back</h2>
        <p class="muted">You were away for {duration(s.ms)}.</p>
        {Object.entries(s.xp).map(([skill, xp]) => (
          <div class="row-item">
            <SkillBadge skill={skill} size={24} /> +{fmt(xp)} {skill} XP
          </div>
        ))}
        {s.gold !== 0 && <div class="row-item">+{fmt(s.gold)} gold</div>}
        {items.map(([id, q]) => (
          <div class="row-item">
            <Icon id={id} size={24} /> {q > 0 ? '+' : ''}
            {fmt(q)} {itemName(id, Math.abs(q))}
          </div>
        ))}
        {!items.length && !Object.keys(s.xp).length && <p class="muted">Nothing was running while you were away.</p>}
        <button onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}

export function App({ game, offline, onCloseOffline, onSave }: { game: Game; offline: OfflineSummary | null; onCloseOffline: () => void; onSave: () => void }) {
  const [tab, setTab] = useState<Tab>('skills');
  const [skill, setSkill] = useState<string | null>(null);
  const openSkill = (s: string) => {
    if (s === 'Combat' || COMBAT_SKILLS.includes(s)) {
      setTab('combat');
      return;
    }
    setTab('skills');
    setSkill(s);
  };
  const [food, setFood] = useState(false);
  const tabs: [Tab, string, string][] = [
    ['skills', '🪓', 'Skills'],
    ['bank', '🏦', 'Bank'],
    ['combat', '⚔️', 'Combat'],
    ['shop', '🛒', 'Shop'],
    ['more', '📊', 'More'],
  ];
  return (
    <div class={`app ${game.state.active ? 'has-statsbar' : ''}`}>
      <TopBar game={game} onOpenSkill={openSkill} onOpenFood={() => setFood(true)} />
      <main>
        {tab === 'skills' && (skill ? <SkillPage game={game} skill={skill} onBack={() => setSkill(null)} /> : <SkillList game={game} onOpen={openSkill} />)}
        {tab === 'bank' && (isUnlocked(game, 'Bank') ? <BankPage game={game} /> : <LockedPage game={game} page="Bank" />)}
        {tab === 'combat' && (isUnlocked(game, 'Combat') ? <CombatPage game={game} /> : <LockedPage game={game} page="Combat" />)}
        {tab === 'shop' && (isUnlocked(game, 'Shop') ? <ShopPage game={game} /> : <LockedPage game={game} page="Shop" />)}
        {tab === 'more' && (
          <>
            {isUnlocked(game, 'Quests') ? <QuestsPage game={game} /> : <LockedPage game={game} page="Quests" />}
            <CompletionLog game={game} />
            <StatsPage game={game} />
            <SettingsPage game={game} onSave={onSave} />
          </>
        )}
      </main>
      <StatsBar game={game} />
      <nav class="tabs">
        {tabs.map(([id, glyph, label]) => (
          <button
            class={tab === id ? 'on' : ''}
            onClick={() => {
              setTab(id);
              if (id === 'skills') setSkill(null);
            }}
          >
            <span>{glyph}</span>
            {label}
          </button>
        ))}
      </nav>
      {food && <FoodSheet game={game} onClose={() => setFood(false)} />}
      {offline && <OfflineModal s={offline} onClose={onCloseOffline} />}
    </div>
  );
}
