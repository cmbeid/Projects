import { settings as soundSettings, toggleMute } from '../audio/sound';
import { useState } from 'preact/hooks';
import { NS, all, displayName, get, item, itemName, tryGet, type Item } from '../engine/content';
import { Game, OfflineSummary, PASSIVE_SKILLS, SKILLS, type OfflineGroup } from '../engine/game';
import { FarmingPage } from './FarmingPage';
import { RanchingPage } from './RanchingPage';
import { ShopPage } from './ShopPage';
import { CombatPage } from './CombatPage';
import { CompletionLog, GuildOverview, GuildPanel, QuestsPage, ToolbeltPanel } from './ExtrasPages';
import { StatsBar } from './StatsBar';
import { OPT_IN_SKILLS, describeRequirement, isDemoLockedPage, isUnlocked, navRequirements } from '../engine/navigation';
import { open as openItem, openableCap, upgrade, upgradesFrom, equipTool } from '../engine/items';
import { fishingBaitCap, toolbeltCap } from '../engine/bonuses';
import { describeBlock, describeBonus } from '../engine/describe';
import { distractions } from '../engine/skills/thieving';
import { availableMajorPicks, unlockMajorNode, unlockedMajorNodes, unlockedMinorNodes, type AstrologyNode } from '../engine/skills/astrology';
import { bury, equip } from '../engine/combat/combat';
import { buryCap, equipmentCap } from '../engine/combat/data';

const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer', 'Slayer'];
import { LEVEL_CAP, levelProgress } from '../engine/xp';
import { pageIconUrl, skillGlyph } from '../art/icons';
import { Art, Bar, Icon, SkillBadge, duration, fmt } from './common';
import { exportSave, forceRefresh, forgetAssets, forgetContent, importSave, storeAssets, wipe } from '../save';
import { clearAssetPack, hasAssetPack, loadAssetPack } from '../art/assets';
import { SoundSettings } from './SoundSettings';
import { isBundle, unpackBundle } from '../bundle';
import { LevelUpPopups, levelUpPopupsOn, setLevelUpPopups } from './LevelUp';
import { BankPage, bankTabs, moveToTab } from './BankPage';
import { backgroundMode, pageBackground, raining, setBackgroundMode, setWeatherOn, weatherAt, weatherOn, type BackgroundMode } from '../art/background';
import { recipeGroups, type RecipeView } from './recipes';

type Tab = 'skills' | 'bank' | 'combat' | 'shop' | 'more';
/** Which game page's icon each tab uses. */
const TAB_PAGE: Record<Tab, string> = { skills: 'Skills', bank: 'Bank', combat: 'Combat', shop: 'Shop', more: 'CompletionLog' };

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
      <button class="mute" onClick={() => { toggleMute(); game.emit(); }} aria-label={soundSettings.muted ? 'Unmute' : 'Mute'}>
        {soundSettings.muted ? '🔇' : '🔊'}
      </button>
    </header>
  );
}

const skillOrder = () => [...SKILLS.map((h) => h.skill).filter((s) => s !== 'Combat'), ...PASSIVE_SKILLS, ...COMBAT_SKILLS];

/** Wide screens (an unfolded phone, a tablet): the desktop's left-hand menu of pages and skills. */
function Sidebar({ game, tab, skill, onTab, onSkill }: { game: Game; tab: Tab; skill: string | null; onTab: (t: Tab) => void; onSkill: (s: string) => void }) {
  const page = (id: Tab, label: string, unlockKey: string) => {
    const icon = pageIconUrl(TAB_PAGE[id]);
    const locked = id !== 'more' && !isUnlocked(game, unlockKey);
    return (
      <button class={`side-item ${tab === id && (id !== 'skills' || !skill) ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => onTab(id)}>
        {icon ? <img class="side-icon" src={icon} alt="" /> : <span class="side-icon" />}
        <span class="side-name">{label}</span>
        {locked && <span class="side-level">🔒</span>}
      </button>
    );
  };
  const skillRow = (s: string) => {
    const locked = !isUnlocked(game, s);
    const running = game.state.active?.skill === s;
    return (
      <button class={`side-item ${tab === 'skills' && skill === s ? 'on' : ''} ${running ? 'running' : ''} ${locked ? 'locked' : ''}`} onClick={() => !locked && onSkill(s)} disabled={locked}>
        <SkillBadge skill={s} size={24} />
        <span class="side-name">{s}</span>
        <span class="side-level">{locked ? '🔒' : `${game.level(s)} / ${LEVEL_CAP}`}</span>
      </button>
    );
  };
  const order = skillOrder();
  return (
    <nav class="sidebar">
      {page('skills', 'All skills', 'Skills')}
      {page('bank', 'Bank', 'Bank')}
      {page('shop', 'Shop', 'Shop')}
      {page('combat', 'Combat', 'Combat')}
      {page('more', 'Quests & more', 'Quests')}
      <h4>Skills</h4>
      {order.filter((s) => !COMBAT_SKILLS.includes(s)).map(skillRow)}
      <h4>Combat</h4>
      {order.filter((s) => COMBAT_SKILLS.includes(s)).map((s) => (
        <button class={`side-item ${isUnlocked(game, 'Combat') ? '' : 'locked'}`} onClick={() => onTab('combat')}>
          <SkillBadge skill={s} size={24} />
          <span class="side-name">{s}</span>
          <span class="side-level">{game.level(s)} / {LEVEL_CAP}</span>
        </button>
      ))}
    </nav>
  );
}

function SkillList({ game, onOpen }: { game: Game; onOpen: (s: string) => void }) {
  const all = skillOrder();
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
                <Bar value={levelProgress(xp)} />
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
          <Bar value={levelProgress(xp)} />
        </div>
      </div>
      <ToolbeltPanel game={game} entity={skill} />
      <GuildPanel game={game} skill={skill} />
      {skill === 'Farming' && <FarmingPage game={game} />}
      {skill === 'Ranching' && <RanchingPage game={game} />}
      {skill === 'Fishing' && <FishingBait game={game} />}
      {skill === 'Thieving' && <ThievingDistractions game={game} />}
      {skill === 'Astrology' && <MajorNodes game={game} />}
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
                <div class="recipe-grid">
                  {g.recipes.map((r) => (
                    <RecipeCard game={game} skill={skill} r={r} />
                  ))}
                </div>
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

/** Astrology major nodes: one pick for every few minor nodes in a constellation, as on the desktop. */
function MajorNodes({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const cons = all<{ Id: string; DisplayName: string; MajorNodes: string[] }>('AstrologyConstellation').filter(
    (c) => unlockedMinorNodes(game, NS + c.Id).length > 0 || unlockedMajorNodes(game, NS + c.Id).length > 0,
  );
  if (!cons.length) return null;
  return (
    <section class="card">
      <strong>Major nodes</strong>
      {msg && <div class="muted small">{msg}</div>}
      {cons.map((c) => {
        const id = NS + c.Id;
        const picks = availableMajorPicks(game, id);
        const have = unlockedMajorNodes(game, id);
        return (
          <div class="major">
            <div class="muted small">
              {c.DisplayName} · {picks > 0 ? `${picks} to choose` : 'unlock more minor nodes for another pick'}
            </div>
            {c.MajorNodes.map((n) => {
              const node = get<AstrologyNode>('AstrologyNode', n);
              const text = [node.Description?.replace(/\[\/?[a-z]+(=[^\]]*)?\]/g, ''), ...describeBlock(node.Bonuses as never)].filter(Boolean).join(' · ');
              const on = have.includes(n);
              return (
                <div class="card-row">
                  <span class={`grow small ${on ? '' : 'muted'}`}>
                    {on ? '★' : '☆'} {text || node.DisplayName}
                  </span>
                  {!on && picks > 0 && <button onClick={() => setMsg(unlockMajorNode(game, id, n) ?? '')}>Unlock</button>}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

/** Distractions per location: bought in the shop, each makes every target there easier (or safer). */
function ThievingDistractions({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const locs = all<{ Id: string; DisplayName: string }>('ThievingLocation').filter((l) => distractions(game, NS + l.Id).some((d) => !d.locked));
  const active = locs.reduce((n, l) => n + distractions(game, NS + l.Id).filter((d) => d.active).length, 0);
  return (
    <section class="card">
      <button class="card-row plain" onClick={() => setOpen(!open)}>
        <strong class="grow">Distractions</strong>
        <span class="muted small">{active} active {open ? '▾' : '▸'}</span>
      </button>
      {open &&
        locs.map((l) => (
          <div>
            <div class="muted small">{l.DisplayName}</div>
            {distractions(game, NS + l.Id)
              .filter((d) => !d.locked)
              .map((d) => (
                <div class={`small ${d.active ? '' : 'muted'}`}>
                  {d.active ? '✓' : '•'} {d.name}: {d.bonuses.map((x) => describeBonus(x)).join(', ')}
                  {!d.active && ' (buy it in the Shop)'}
                </div>
              ))}
          </div>
        ))}
    </section>
  );
}

/** Fishing bait, as on the desktop: pick one; it's used up one per catch and its bonus applies while you have some. */
function FishingBait({ game }: { game: Game }) {
  const baits = all<{ Id: string; Capabilities: Record<string, unknown> | null }>('Item').filter((i) => i.Capabilities?.[`${NS}FishingBait`]);
  const sel = game.state.fishingBait ?? null;
  const pick = (id: string | null) => {
    game.state.fishingBait = id;
    game.bonusesChanged();
    game.emit();
  };
  return (
    <section class="bait">
      <h3>Bait</h3>
      <div class="chips">
        <button class={!sel ? 'on' : ''} onClick={() => pick(null)}>
          None
        </button>
        {baits.map((b) => {
          const id = NS + b.Id;
          return (
            <button class={sel === id ? 'on' : ''} disabled={!game.count(id) && sel !== id} onClick={() => pick(id)}>
              <Icon id={id} size={18} /> {itemName(id)} ×{fmt(game.count(id))}
            </button>
          );
        })}
      </div>
      {sel && <p class="muted small">{describeBlock(fishingBaitCap(sel)?.Bonuses as never).join(' · ')}{game.count(sel) ? '' : ' · none left, so no bonus'}</p>}
    </section>
  );
}

function RecipeCard({ game, skill, r }: { game: Game; skill: string; r: RecipeView }) {
  const a = game.state.active;
  const running = a?.skill === skill && a.recipe === r.id;
  return (
    <button class={`recipe ${running ? 'running' : ''} ${r.locked ? 'locked' : ''}`} onClick={() => game.toggle(skill, r.id)} disabled={!!r.locked}>
      <div class="recipe-icon">
        <Art path={r.art} fallbackItem={r.icon} size={52} />
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
        {r.option && !r.locked && (
          <label class="card-option" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={r.option.on} onChange={r.option.toggle} />
            {r.option.label}
          </label>
        )}
        {r.meter && !r.locked && <Bar value={r.meter.value} max={r.meter.max} color="#5fbf6a" />}
        {running && <Bar value={1 - a!.ticksLeft / a!.waitTicks} />}
      </div>
      {!r.locked && <span class={`go ${running ? 'stop' : ''}`}>{running ? 'Stop' : 'Start'}</span>}
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
export const itemOrder = () => (itemOrderCache ??= new Map(all<Item>('Item').map((it, i) => [`MelvorBase:${it.Id}`, i])));

export function ItemSheet({ game, id, onClose }: { game: Game; id: string; onClose: () => void }) {
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
        {bankTabs(game).length > 0 && (
          <label class="slider">
            <span>Bank tab</span>
            <select
              value={String(bankTabs(game).findIndex((t) => t.items.includes(id)))}
              onChange={(e) => {
                const v = Number((e.target as HTMLSelectElement).value);
                moveToTab(game, [id], v < 0 ? null : v);
              }}
            >
              <option value="-1">No tab</option>
              {bankTabs(game).map((t, i) => (
                <option value={String(i)}>{t.name}</option>
              ))}
            </select>
          </label>
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

/** The event log: level-ups, unlocks, completions and other notices, newest first, with how long ago. */
function EventLog({ game }: { game: Game }) {
  const list = game.state.eventLog ?? [];
  const now = game.state.tick;
  return (
    <details class="page event-log">
      <summary>
        <h2>Event log</h2>
        <span class="muted small">{list.length} events</span>
      </summary>
      {!list.length && <p class="muted">Level-ups, unlocks and completions will show up here.</p>}
      {list.map((e) => (
        <div class="card-row small">
          <span class="grow">{e.text}</span>
          <span class="muted">{duration(Math.max(0, now - e.tick) * (1000 / 60))} ago</span>
        </div>
      ))}
    </details>
  );
}

const statLabel = (id: string, skill: string) => id.slice(skill.length).replace(/([a-z])([A-Z])/g, '$1 $2');

/** Statistics, grouped like the desktop's: general, combat, then each skill's own counters. */
function StatsPage({ game }: { game: Game }) {
  const s = game.state.stats;
  const v = s.values ?? {};
  const skills = [...SKILLS.map((h) => h.skill).filter((x) => x !== 'Combat'), ...PASSIVE_SKILLS];
  const total = [...skills, ...COMBAT_SKILLS].reduce((t, skill) => t + game.level(skill), 0);
  const c = game.state.combat;
  const kills = Object.values(c.kills).reduce((a, b) => a + b, 0);
  const found = Object.values(s.itemsFound ?? {}).reduce((a, b) => a + b, 0);
  const row = (label: string, value: string) => (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
  return (
    <div class="page">
      <h2>Statistics</h2>
      <dl class="stats">
        {row('Total level', fmt(total))}
        {row('Character age', duration(Date.now() - game.state.createdAt))}
        {row('Online playtime', duration(s.onlineMs))}
        {row('Offline playtime', duration(s.offlineMs))}
        {row('Items found', fmt(found))}
        {row('Items sold', fmt(s.itemsSold))}
        {row('Gold from sales', fmt(s.goldFromSales))}
        {row('Shop purchases', fmt(v.ShopPurchasesMade ?? 0))}
      </dl>
      <h3>Combat</h3>
      <dl class="stats">
        {row('Enemies killed', fmt(kills))}
        {row('Dungeons completed', fmt(v.CombatTotalDungeonsCompleted ?? Object.values(c.dungeonsDone).reduce((a, b) => a + b, 0)))}
        {row('Damage dealt', fmt(c.damageDealt))}
        {row('Damage taken', fmt(c.damageTaken))}
        {row('Damage soaked by Ward', fmt(v.CombatTotalDamageNegatedByWard ?? 0))}
        {row('Deaths', fmt(s.deaths ?? 0))}
        {row('Slayer task kills', fmt(v.SlayerTotalTaskEnemiesKilled ?? 0))}
        {row('Slayer tasks done', fmt(Object.values(c.slayerTasksDone).reduce((a, b) => a + b, 0)))}
      </dl>
      {skills
        .filter((sk) => (s.actions[sk] ?? 0) > 0 || Object.keys(v).some((k) => k.startsWith(sk)))
        .map((sk) => {
          const online = v[`${sk}OnlineTimeSpent`] ?? 0;
          const offline = v[`${sk}OfflineTimeSpent`] ?? 0;
          const gained = Object.values(s.itemGained?.[sk] ?? {}).reduce((a, b) => a + b, 0);
          const own = Object.entries(v).filter(([k]) => k.startsWith(sk) && !k.endsWith('TimeSpent'));
          return (
            <details class="stat-skill">
              <summary>
                {sk} <span class="muted small">{duration(online + offline)}</span>
              </summary>
              <dl class="stats">
                {row('Time training (online)', duration(online))}
                {row('Time training (offline)', duration(offline))}
                {row('Actions', fmt(s.actions[sk] ?? 0))}
                {(s.failures[sk] ?? 0) > 0 && row('Failed actions', fmt(s.failures[sk] ?? 0))}
                {gained > 0 && row('Items gained', fmt(gained))}
                {own.map(([k, n]) => row(statLabel(k, sk), fmt(n)))}
              </dl>
            </details>
          );
        })}
    </div>
  );
}

function SettingsPage({ game, onSave }: { game: Game; onSave: () => void | Promise<unknown> }) {
  const [text, setText] = useState('');
  const [popups, setPopups] = useState(levelUpPopupsOn());
  const [bgMode, setBgMode] = useState(backgroundMode());
  const [weather, setWeather] = useState(weatherOn());
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
        <label class="file-pick small-pick wide-pick">
          <input
            type="file"
            onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (!f) return;
              try {
                if (!(await isBundle(f))) throw new Error("That isn't a melvor2-pocket.bundle. Build it with `npm run bundle` on your PC.");
                setMsg('Unpacking…');
                await unpackBundle(f);
                location.reload();
              } catch (err) {
                setMsg((err as Error).message);
              }
            }}
          />
          Load everything from a bundle
        </label>
        <p class="muted">
          Game images: {hasAssetPack() ? 'using your game-assets.pack' : 'generated art'}. Build the pack on your PC with{' '}
          <code>npm run assets</code> and load it here to use the game's own icons; anything it lacks stays generated.
        </p>
        <div class="row">
          <label class="file-pick small-pick">
            <input
              type="file"
              accept=".pack"
              onChange={async (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (!f) return;
                try {
                  const n = await loadAssetPack(f);
                  await storeAssets(f);
                  setMsg(`Loaded ${n} game images.`);
                  game.emit();
                } catch (err) {
                  setMsg((err as Error).message);
                }
              }}
            />
            Load game images
          </label>
          {hasAssetPack() && (
            <button
              onClick={async () => {
                await forgetAssets();
                clearAssetPack();
                setMsg('Using generated art.');
                game.emit();
              }}
            >
              Use generated art
            </button>
          )}
        </div>
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
        <h3>Names</h3>
        <p class="muted">Used in quest dialogue.</p>
        <label class="slider">
          <span>You</span>
          <input
            class="text"
            value={game.state.names.player}
            maxLength={24}
            onInput={(e) => {
              game.state.names.player = (e.target as HTMLInputElement).value || 'Adventurer';
            }}
          />
        </label>
        <label class="slider">
          <span>Companion</span>
          <input
            class="text"
            value={game.state.names.companion}
            maxLength={24}
            onInput={(e) => {
              game.state.names.companion = (e.target as HTMLInputElement).value || 'Rowan';
            }}
          />
        </label>
      </section>
      <section>
        <h3>Locked in the demo</h3>
        <p class="muted small">These skills are finished in the demo's files but locked in the demo. Turning one on lets you play it.</p>
        {OPT_IN_SKILLS.map((s) => (
          <label class="toggle">
            <input
              type="checkbox"
              checked={!!game.state.optIn?.[s]}
              onChange={(e) => {
                game.state.optIn = { ...game.state.optIn, [s]: (e.target as HTMLInputElement).checked };
                if (!game.state.optIn[s] && game.state.active?.skill === s) game.stop();
                game.emit();
              }}
            />
            Play {s}
          </label>
        ))}
      </section>
      <section>
        <h3>Display</h3>
        <label class="slider">
          <span>Background</span>
          <select value={bgMode} onChange={(e) => { const m = (e.target as HTMLSelectElement).value as BackgroundMode; setBackgroundMode(m); setBgMode(m); }}>
            <option value="clock">Match my clock</option>
            <option value="Day">Always day</option>
            <option value="Sunset">Always sunset</option>
            <option value="Night">Always night</option>
            <option value="off">Off</option>
          </select>
        </label>
        <p class="muted small">Needs the game images. Day from 8:00, sunset from 16:00, night from 20:00, as in the game.</p>
        <label class="toggle">
          <input type="checkbox" checked={weather} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; setWeatherOn(on); setWeather(on); }} />
          Weather (some days it rains, as in the game) · today: {weatherAt()}
        </label>
      </section>
      <section>
        <h3>Notifications</h3>
        <label class="toggle">
          <input type="checkbox" checked={popups} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; setLevelUpPopups(on); setPopups(on); }} />
          Show level-up popups
        </label>
      </section>
      <SoundSettings />
      <section>
        <h3>About</h3>
        <p class="muted">
          A personal, portrait-mode rebuild of the Melvor Idle 2 Demo for the web. Game data comes from your own install; all art here
          is generated. Not affiliated with Games By Malcs.
        </p>
        <p class="muted small">Version built {__BUILD_TIME__}.</p>
        <button
          class="wide"
          onClick={async () => {
            setMsg('Refreshing…');
            // Wait for the save to commit: the reload would otherwise cut it off.
            await onSave();
            await forceRefresh();
          }}
        >
          Force refresh (get the latest version)
        </button>
        <p class="muted small">Your save, game data, images and sound stay in this browser.</p>
      </section>
    </div>
  );
}

/** One line of the summary: icon and name, the gain, and its hourly rate, as on the desktop. */
function SummaryRow({ icon, name, n, sign = '+', hours }: { icon: preact.ComponentChildren; name: string; n: number; sign?: string; hours: number }) {
  return (
    <div class="summary-row">
      {icon}
      <span class="grow">{name}</span>
      <strong class={sign === '+' ? 'gain' : 'loss'}>
        {sign}
        {fmt(n)}
      </strong>
      {hours > 0 && <small class="muted rate">{(n / hours).toLocaleString(undefined, { maximumFractionDigits: 2 })} /hr</small>}
    </div>
  );
}

const PASSIVE_GROUPS = new Set<string>(PASSIVE_SKILLS);

function OfflineGroupCard({ name, g, hours }: { name: string; g: OfflineGroup; hours: number }) {
  const currencyIcon = (id: string) => <Art path={tryGet<{ Icon?: string }>('Currency', id)?.Icon} fallbackItem={id} size={22} />;
  const sections: [string, preact.ComponentChildren[]][] = [
    ['Experience Gained', g.xp ? [<SummaryRow icon={<SkillBadge skill={name} size={22} />} name={`${name} XP`} n={g.xp} hours={hours} />] : []],
    ['Levels Gained', g.levels ? [<SummaryRow icon={<SkillBadge skill={name} size={22} />} name={`${name} levels (${g.levels[0]} → ${g.levels[1]})`} n={g.levels[1] - g.levels[0]} hours={hours} />] : []],
    ['Dungeons Completed', Object.entries(g.dungeons).map(([id, n]) => <SummaryRow icon={<Icon id={id} size={22} />} name={displayName('Dungeon', id)} n={n} hours={hours} />)],
    ['Enemies Slain', Object.entries(g.kills).map(([id, n]) => <SummaryRow icon={<Art path={tryGet<{ Sprite?: string }>('Enemy', id)?.Sprite} fallbackItem={id} size={22} />} name={displayName('Enemy', id)} n={n} hours={hours} />)],
    ['Items Gained', Object.entries(g.gained).map(([id, n]) => <SummaryRow icon={<Icon id={id} size={22} />} name={itemName(id, n)} n={n} hours={hours} />)],
    ['Items Used', Object.entries(g.used).map(([id, n]) => <SummaryRow icon={<Icon id={id} size={22} />} name={itemName(id, n)} n={n} sign="−" hours={hours} />)],
    ['Currency Gained', Object.entries(g.currencyGained).map(([id, n]) => <SummaryRow icon={currencyIcon(id)} name={displayName('Currency', id)} n={n} hours={hours} />)],
    ['Currency Used', Object.entries(g.currencyUsed).map(([id, n]) => <SummaryRow icon={currencyIcon(id)} name={displayName('Currency', id)} n={n} sign="−" hours={hours} />)],
  ];
  const shown = sections.filter(([, rows]) => rows.length);
  return (
    <div class={`summary-card ${PASSIVE_GROUPS.has(name) ? 'passive' : ''}`}>
      <div class="summary-head">
        <SkillBadge skill={name} size={28} /> <strong>{name}</strong>
      </div>
      {shown.map(([title, rows]) => (
        <>
          <h4>{title}</h4>
          {rows}
        </>
      ))}
      {!shown.length && <p class="muted center">Nothing interesting happened.</p>}
    </div>
  );
}

function OfflineModal({ s, onClose }: { s: OfflineSummary; onClose: () => void }) {
  const hours = s.ms / 3_600_000;
  const groups = { ...s.groups };
  if (s.active && !groups[s.active]) groups[s.active] = { xp: 0, levels: null, gained: {}, used: {}, currencyGained: {}, currencyUsed: {}, kills: {}, dungeons: {} };
  // Like the desktop: the skill you left training first, active skills before passive ones.
  const rank = (k: string) => (k === s.active ? 0 : k === 'General' ? 3 : PASSIVE_GROUPS.has(k) ? 2 : 1);
  const names = Object.keys(groups).sort((a, b) => rank(a) - rank(b));
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome back</h2>
        <p class="center">
          <strong>You were away for {duration(s.elapsed)}</strong>
        </p>
        {s.elapsed > s.ms && <p class="muted small center">Only the first {duration(s.ms)} counted (the offline limit).</p>}
        {s.inactiveMs > 0 && (
          <p class="small center warn">
            You were inactive for <strong>{duration(s.inactiveMs)}</strong> while training offline.
          </p>
        )}
        {names.map((n) => (
          <OfflineGroupCard name={n} g={groups[n]} hours={hours} />
        ))}
        {!names.length && <p class="muted">Nothing was running while you were away.</p>}
        <button onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}

export function App({ game, offline, onCloseOffline, onSave }: { game: Game; offline: OfflineSummary | null; onCloseOffline: () => void; onSave: () => void | Promise<unknown> }) {
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
  // The desktop's scene for the page on show; the skills overview and the More tab use the quest village.
  const bgPage = tab === 'skills' ? skill ?? 'Quests' : tab === 'bank' ? 'Bank' : tab === 'shop' ? 'Shop' : tab === 'combat' ? 'Combat' : 'Quests';
  const bg = pageBackground(bgPage);
  return (
    <div class={`app ${game.state.active ? 'has-statsbar' : ''}`}>
      {bg && <div class={`page-bg ${bg.blur ? 'blur' : ''}`} style={{ backgroundImage: `url(${bg.url})` }} />}
      {bg && raining() && <div class="rain" aria-hidden="true" />}
      <TopBar game={game} onOpenSkill={openSkill} onOpenFood={() => setFood(true)} />
      <Sidebar
        game={game}
        tab={tab}
        skill={skill}
        onTab={(t) => {
          setTab(t);
          if (t === 'skills') setSkill(null);
        }}
        onSkill={openSkill}
      />
      <main>
        {tab === 'skills' && (skill ? <SkillPage game={game} skill={skill} onBack={() => setSkill(null)} /> : <SkillList game={game} onOpen={openSkill} />)}
        {tab === 'bank' && (isUnlocked(game, 'Bank') ? <BankPage game={game} /> : <LockedPage game={game} page="Bank" />)}
        {tab === 'combat' && (isUnlocked(game, 'Combat') ? <CombatPage game={game} /> : <LockedPage game={game} page="Combat" />)}
        {tab === 'shop' && (isUnlocked(game, 'Shop') ? <ShopPage game={game} /> : <LockedPage game={game} page="Shop" />)}
        {tab === 'more' && (
          <>
            {isUnlocked(game, 'Quests') ? <QuestsPage game={game} /> : <LockedPage game={game} page="Quests" />}
            <GuildOverview game={game} />
            <CompletionLog game={game} />
            <EventLog game={game} />
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
            {pageIconUrl(TAB_PAGE[id]) ? <img class="tab-icon" src={pageIconUrl(TAB_PAGE[id])} alt="" /> : <span>{glyph}</span>}
            {label}
          </button>
        ))}
      </nav>
      {food && <FoodSheet game={game} onClose={() => setFood(false)} />}
      {offline && <OfflineModal s={offline} onClose={onCloseOffline} />}
      <LevelUpPopups game={game} />
    </div>
  );
}
