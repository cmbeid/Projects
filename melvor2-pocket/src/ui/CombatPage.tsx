import { useState } from 'preact/hooks';
import { NS, all, displayName, item, itemName, tryGet } from '../engine/content';
import type { Game } from '../engine/game';
import { type Bonus, type Drops, type Dungeon, allPrayers, allSlayerMasters, allSpells, area, enemy as enemyData, isDungeon } from '../engine/combat/data';
import {
  areaEnemies, blockSlayerEnemy, dropChances, effectsView, liveEnemyFighter, togglePause, enemyFighter, enemyMaxHp, extendSlayerTask, fight, newSlayerTask, playerFighter, prayerPoints, slayerBlockCost,
  slayerBlockSlots, slayerExtensionCost, resetLoot, slayerRerollCost, slayerTaskRange, togglePrayer, unblockSlayerEnemy,
} from '../engine/combat/combat';
import { accuracyRating, attackInterval, combatLevel, evasionRating, hitChance, maxHit, minHit } from '../engine/combat/stats';
import { Art, HpBar, Icon, SkillBadge, TimerBar, fmt, ticksToDuration, type BarMarker } from './common';
import { assetUrl } from '../art/assets';
import { EquipmentView } from './Equipment';
import { pageIconUrl } from '../art/icons';
import { describeRequirement } from '../engine/navigation';
import { CombatStatsSheet } from './CombatStats';
import { HitSplats } from './HitSplats';

type Sub = 'fight' | 'gear' | 'stats' | 'spells' | 'prayers' | 'slayer';

const words = (s: string) => s.replace(NS, '').replace(/([a-z])([A-Z])/g, '$1 $2');

/** "+10 Stab Defence Bonus", "+5% Max Hit". */
function bonusLabel(b: Bonus): string {
  const pct = /^Percent|Chance$|BasedOn/.test(b.Stat.Name);
  const value = pct ? `${Math.round(b.Value * 100)}%` : `${b.Value}`;
  const sign = b.Value > 0 ? '+' : '';
  const what = b.Stat.Name === 'FlatCombatStatValue' && b.LocalContext?.CombatStat ? b.LocalContext.CombatStat : b.Stat.Name.replace(/^(Flat|Percent)/, '');
  return `${sign}${value} ${words(what)}`;
}

interface AreaLike { Id: string; DisplayName: string; Category: string; UnlockRequirements: never[] | null; DisplayRequirements: never[] | null }

/** Effects on a fighter: buffs in green, debuffs in red, with turns, attacks or stacks left. */
function EffectChips({ game, side }: { game: Game; side: 'player' | 'enemy' }) {
  const list = effectsView(game, side);
  if (!list.length) return null;
  return (
    <div class="effect-chips">
      {list.map((e) => (
        <span class={`effect-chip ${e.positive ? 'good' : 'bad'}`}>
          {assetUrl(e.icon) && !/missing_artwork|icon\.svg/.test(e.icon ?? '') && <img src={assetUrl(e.icon)} alt="" />}
          {e.name}
          {e.detail && <small> {e.detail}</small>}
        </span>
      ))}
    </div>
  );
}

function FightView({ game }: { game: Game }) {
  const [sheet, setSheet] = useState<'loot' | 'stats' | null>(null);
  const c = game.state.combat;
  const fighting = game.state.active?.skill === 'Combat';
  if (!fighting || !c.area) return null;
  const e = c.enemy && c.phase === 'fighting' ? liveEnemyFighter(game) : c.enemy ? enemyFighter(c.enemy) : null;
  const p = playerFighter(game, e?.style.Id);
  const pInt = Math.round(attackInterval(p) / (1000 / 60));
  const eInt = e ? Math.round(attackInterval(e) / (1000 / 60)) : 1;
  // The engine only counts the turn timers down when an event fires; ticks since the last one are still to come off.
  // While paused the wait is the pause check, not turn time.
  const since = c.paused ? 0 : Math.max(0, (c.pending ?? 0) - (game.state.active?.ticksLeft ?? 0));
  const pLeft = c.playerLeft - since;
  const eLeft = c.enemyLeft - since;
  const food = game.state.selectedFood;
  const youMarks: BarMarker[] = [];
  if (food) youMarks.push({ at: game.autoEatAt(), kind: 'eat', label: `Auto-eat at ${game.autoEatAt()} HP`, icon: <Icon id={food} size={14} /> });
  if (e && c.phase === 'fighting') youMarks.push({ at: maxHit(e), kind: 'hit', label: `Enemy max hit ${maxHit(e)}: below this, one hit could finish you` });
  return (
    <div class="fight">
      {/* The enemy stands on a stage over the combat scene, large as on the desktop; its stats sit underneath. */}
      <div class="fight-stage">
        <div class="stage-area">⚔️ {area(c.area).DisplayName}</div>
        {e && c.phase === 'fighting' ? (
          <>
            <div class="enemy-art">
              <HitSplats game={game} side="enemy" />
              {assetUrl(enemyData(c.enemy!).Sprite) ? <img class="enemy-sprite" src={assetUrl(enemyData(c.enemy!).Sprite)} alt="" /> : <Icon id={c.enemy!} size={96} />}
            </div>
            <div class="card-row">
              <strong class="grow">{enemyData(c.enemy!).DisplayName}</strong>
              <span class="muted small">Lv {combatLevel(e, e.style)}</span>
            </div>
            <HpBar value={c.enemyHp} max={e.maxHp} color="#e0565b" markers={[{ at: maxHit(p), kind: 'hit', label: `Your max hit ${maxHit(p)}` }]} />
            <div class="muted small">
              {fmt(c.enemyHp)} / {fmt(e.maxHp)} HP · max hit {maxHit(e)} · {e.style.DisplayName}
            </div>
            <TimerBar elapsed={eInt - eLeft} total={eInt} cycle={game.state.tick + eLeft} paused={c.paused} color="#9a7ae0" />
            <EffectChips game={game} side="enemy" />
          </>
        ) : (
          <div class="enemy-art searching muted">Looking for an enemy…</div>
        )}
      </div>
      <div class="fighter you">
        <HitSplats game={game} side="player" />
        <div class="card-row">
          <strong class="grow">You</strong>
          <span class="muted small">{p.stance.DisplayName}</span>
        </div>
        <HpBar value={game.hp()} max={game.maxHp()} color="#5fbf6a" markers={youMarks} />
        <div class="muted small">
          {game.hp()} / {game.maxHp()} HP · {food ? `${itemName(food, 2)} ×${fmt(game.count(food))} · auto-eat at ${game.autoEatAt()} HP` : 'no food'}
        </div>
        {c.phase === 'fighting' && <TimerBar elapsed={pInt - pLeft} total={pInt} cycle={game.state.tick + pLeft} paused={c.paused} color="#e8b84a" />}
        <EffectChips game={game} side="player" />
        {e && (
          <div class="muted small">
            Hit {Math.round(hitChance(accuracyRating(p, area(c.area).Darkness), evasionRating(e, p.stance)) * 100)}% · {minHit(p, maxHit(p))}–{maxHit(p)} dmg ·
            enemy hits you {Math.round(hitChance(accuracyRating(e), evasionRating(p, e.stance)) * 100)}%
          </div>
        )}
      </div>
      <div class="fight-actions">
        {isDungeon(c.area) && (
          <div class="muted small grow">
            Stage {c.dungeonStage + 1} / {(area(c.area) as Dungeon).Enemies.length} · completed {c.dungeonsDone[c.area] ?? 0}×
          </div>
        )}
        {food && (
          <button class="eat" disabled={game.hp() >= game.maxHp() || !game.count(food)} onClick={() => game.eat(food)}>
            <Icon id={food} size={20} /> Eat <small>+{game.foodHealing(food)} HP</small>
          </button>
        )}
        <button class={`pause ${c.paused ? 'on' : ''}`} onClick={() => togglePause(game)}>
          {c.paused ? '▶ Resume' : '❚❚ Pause'}
        </button>
        <button onClick={() => setSheet('loot')}>Loot</button>
        <button onClick={() => setSheet('stats')}>Stats</button>
        <button class="danger run" onClick={() => game.stop('You ran away.')}>
          Run away
        </button>
      </div>
      {sheet === 'loot' && <LootHistory game={game} onClose={() => setSheet(null)} />}
      {sheet === 'stats' && <CombatStatsSheet game={game} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Loot History: what this combat session has dropped, as on the desktop. */
/** The desktop's Loot History: value and kill rate per enemy, the loot collected as an icon grid, and the XP gained. */
function LootHistory({ game, onClose }: { game: Game; onClose: () => void }) {
  const l = game.state.combat.loot;
  const items = Object.entries(l?.items ?? {}).sort((a, b) => b[1] - a[1]);
  const currencies = Object.entries(l?.currencies ?? {});
  const xp = Object.entries(l?.xp ?? {}).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  const ticks = l ? game.state.tick - l.since : 0;
  const hours = Math.max(ticks, 1) / 216000;
  const value = items.reduce((s, [id, q]) => s + (item(id).SellsFor?.Quantity ?? 0) * q, 0) + (l?.currencies[`${NS}GoldPieces`] ?? 0);
  const totalItems = items.reduce((s, [, q]) => s + q, 0);
  const enemies = Object.entries(l?.enemies ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2 class="grow">Loot History</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div class="loot-summary">
          <span>
            Total value <strong class="gold">{fmt(value)} gold</strong>
          </span>
          <span>
            Total items <strong>{fmt(totalItems)}</strong>
          </span>
        </div>
        <dl class="stats">
          {enemies.map(([id, n]) => (
            <>
              <dt>{enemyData(id).DisplayName}</dt>
              <dd>×{fmt(n)}</dd>
            </>
          ))}
          <dt>Time spent fighting</dt>
          <dd>{ticksToDuration(ticks)}</dd>
          <dt>Kills per hour</dt>
          <dd>{ticks >= 600 ? fmt(Math.round(((l?.kills ?? 0) / hours) * 100) / 100) : '–'}</dd>
          <dt>Gold per hour</dt>
          <dd>{ticks >= 600 ? fmt(Math.round(value / hours)) : '–'}</dd>
        </dl>
        <h3>Loot collected</h3>
        {!items.length && !currencies.length && <p class="muted">Nothing yet.</p>}
        <div class="loot-grid">
          {currencies.map(([cur, q]) => (
            <div class="loot-cell" title={displayName('Currency', cur)}>
              <Art path={tryGet<{ Icon?: string }>('Currency', cur)?.Icon} fallbackItem={cur} size={36} />
              <span class="qty">{fmt(q)}</span>
            </div>
          ))}
          {items.map(([it, q]) => (
            <div class="loot-cell" title={itemName(it, q)}>
              <Icon id={it} size={36} />
              <span class="qty">{fmt(q)}</span>
            </div>
          ))}
        </div>
        {xp.length > 0 && (
          <>
            <h3>Experience gained</h3>
            <div class="loot-grid">
              {xp.map(([skill, v]) => (
                <div class="loot-cell" title={skill}>
                  <SkillBadge skill={skill} size={32} />
                  <span class="qty">{fmt(Math.floor(v))}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div class="row">
          <button
            class="danger"
            onClick={() => {
              if (confirm('Start the loot history over?')) resetLoot(game);
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function DropsSheet({ title, drops, onClose }: { title: string; drops: Drops; onClose: () => void }) {
  const list = dropChances(drops).sort((a, b) => b.chance - a.chance);
  const pct = (x: number) => (x >= 0.1 ? `${Math.round(x * 100)}%` : x >= 0.001 ? `${(x * 100).toFixed(2)}%` : `1 in ${fmt(Math.round(1 / x))}`);
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2 class="grow">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {drops.FixedCurrencies.map((c) => (
          <div class="card-row">
            <span class="grow">{displayName('Currency', c.Currency)}</span>
            <span class="muted small">
              {fmt(c.MinQuantity)}–{fmt(c.MaxQuantity)} · always
            </span>
          </div>
        ))}
        {list.map((d) => (
          <div class="card-row">
            <Icon id={d.item} size={28} />
            <span class="grow">
              {itemName(d.item, d.max)} {d.max > 1 ? <span class="muted small">×{d.min === d.max ? d.min : `${d.min}–${d.max}`}</span> : null}
            </span>
            <span class="muted small">{pct(d.chance)}</span>
          </div>
        ))}
        {!list.length && !drops.FixedCurrencies.length && <p class="muted">No drops.</p>}
      </div>
    </div>
  );
}

function AreaBrowser({ game }: { game: Game }) {
  // Hide demo-locked and quest areas, and areas whose enemies are all locked in the demo.
  const areas = [...all<AreaLike>('CombatArea'), ...all<AreaLike>('Dungeon')].filter(
    (a) =>
      !game.isDemoLocked(a.UnlockRequirements) &&
      !game.isDemoLocked(a.DisplayRequirements) &&
      (!a.Category.endsWith('Quests') || (!!a.DisplayRequirements?.length && game.requirementsMet(a.DisplayRequirements))) &&
      areaEnemies(NS + a.Id).some((x) => !game.isDemoLocked(enemyData(x).Requirements)),
  );
  const cats = [...new Set(areas.map((a) => a.Category))];
  const [cat, setCat] = useState(cats[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [drops, setDrops] = useState<string | null>(null);
  const catName = (c: string) => displayName('CombatAreaCategory', c);
  return (
    <>
      <div class="chips">
        {cats.map((c) => (
          <button class={c === cat ? 'on' : ''} onClick={() => setCat(c)}>
            {catName(c)}
          </button>
        ))}
      </div>
      {msg && <p class="muted">{msg}</p>}
      {drops && (
        <DropsSheet
          title={isDungeon(drops) ? `${area(drops).DisplayName} rewards` : `${enemyData(drops).DisplayName} drops`}
          drops={isDungeon(drops) ? (area(drops) as Dungeon).Rewards : enemyData(drops).Drops}
          onClose={() => setDrops(null)}
        />
      )}
      <div class="area-grid">
      {areas
        .filter((a) => a.Category === cat)
        .map((a) => {
          const id = NS + a.Id;
          const unlocked = game.requirementsMet(a.UnlockRequirements);
          const enemies = [...new Set(areaEnemies(id))].filter((x) => !game.isDemoLocked(enemyData(x).Requirements));
          const start = (enemyId: string | null) => {
            fight(game, id, enemyId);
            setMsg(game.state.active?.skill === 'Combat' ? '' : game.log[0]?.text ?? '');
          };
          return (
            <div class="card">
              <button class="card-row plain" onClick={() => setOpen(open === id ? null : id)}>
                <strong class="grow">{a.DisplayName}</strong>
                <span class="muted small">
                  {unlocked ? `${enemies.length} enemies` : 'Locked'}
                  {area(id).Darkness ? ' · dark' : ''}
                </span>
              </button>
              {open === id && unlocked && isDungeon(id) && (
                <div class="row">
                  <button class="wide" onClick={() => start(null)}>
                    Start dungeon
                  </button>
                  <button onClick={() => setDrops(id)}>Rewards</button>
                </div>
              )}
              {open === id &&
                unlocked &&
                !isDungeon(id) &&
                enemies.map((x) => {
                  const ef = enemyFighter(x);
                  return (
                    <div class="card-row">
                      {assetUrl(enemyData(x).Sprite) && <img class="enemy-thumb" src={assetUrl(enemyData(x).Sprite)} alt="" />}
                      <div class="grow">
                        <div>{enemyData(x).DisplayName}</div>
                        <div class="muted small">
                          Lv {combatLevel(ef, ef.style)} · {fmt(enemyMaxHp(x))} HP · {ef.style.DisplayName} · killed {fmt(game.state.combat.kills[x] ?? 0)}
                        </div>
                      </div>
                      <button class="link" onClick={() => setDrops(x)}>
                        Drops
                      </button>
                      <button onClick={() => start(x)}>Fight</button>
                    </div>
                  );
                })}
              {open === id && isDungeon(id) && (
                <div class="muted small">
                  {(area(id) as Dungeon).Enemies.map((s) => `${s.Count}× ${s.Enemies.map((x) => enemyData(x.Enemy).DisplayName).join('/')}`).join(' → ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

interface GridEntry { id: string; name: string; icon?: string; state: 'on' | 'ok' | 'locked' | 'demo' }

/** The desktop's prayer and spell grids: icons, the active ones lit, locked ones dimmed and demo-only ones as "?". */
function IconGrid({ entries, picked, onPick }: { entries: GridEntry[]; picked: string | null; onPick: (id: string) => void }) {
  return (
    <div class="icon-grid">
      {entries.map((e) => (
        <button class={`icon-tile ${e.state} ${picked === e.id ? 'picked' : ''}`} onClick={() => onPick(e.id)} aria-label={e.state === 'demo' ? 'Not in demo' : e.name}>
          {e.state === 'demo' ? <span class="tile-q">?</span> : <Art path={e.icon} fallbackItem={e.id} size={34} />}
          {e.state === 'locked' && <span class="tile-lock">🔒</span>}
        </button>
      ))}
    </div>
  );
}

function PrayerMagicView({ game, show }: { game: Game; show: 'prayers' | 'spells' }) {
  const [msg, setMsg] = useState('');
  const [prayerPick, setPrayerPick] = useState<string | null>(null);
  const [book, setBook] = useState(`${NS}StandardSpells`);
  const [spellPick, setSpellPick] = useState<string | null>(null);
  const c = game.state.combat;
  const p = playerFighter(game);
  const prayers = allPrayers();
  const prayerState = (x: (typeof prayers)[number]): GridEntry['state'] =>
    game.isDemoLocked(x.UnlockRequirements) ? 'demo' : !game.requirementsMet(x.UnlockRequirements) ? 'locked' : c.prayers.includes(NS + x.Id) ? 'on' : 'ok';
  const pr = prayers.find((x) => NS + x.Id === prayerPick && prayerState(x) !== 'demo');
  const books = all<{ Id: string; DisplayName: string; Requirements: never[] | null }>('SpellBook');
  const spells = allSpells().filter((s) => s.Book === book);
  const spellState = (s: (typeof spells)[number]): GridEntry['state'] =>
    game.isDemoLocked(s.UnlockRequirements) ? 'demo' : !game.requirementsMet(s.UnlockRequirements) ? 'locked' : c.spell === NS + s.Id ? 'on' : 'ok';
  const sp = spells.find((s) => NS + s.Id === spellPick && spellState(s) !== 'demo');
  const unmet = (reqs: unknown) => ((reqs ?? []) as never[]).map((r) => describeRequirement(game, r)).filter((r) => !r.done).map((r) => r.text);
  const iconOf = (x: unknown) => (x as { Icon?: string }).Icon;
  return (
    <>
      {show === 'prayers' && (
        <>
      <div class="card-row">
        <h3 class="grow">Prayers</h3>
        <span class="muted small">{fmt(prayerPoints(game))} prayer points</span>
      </div>
      <IconGrid
        entries={prayers.map((x) => ({ id: NS + x.Id, name: x.DisplayName, icon: iconOf(x), state: prayerState(x) }))}
        picked={prayerPick}
        onPick={(id) => setPrayerPick(prayerPick === id ? null : id)}
      />
      {prayerPick && !pr && <p class="muted small">This prayer is not in the demo.</p>}
      {pr && (
        <div class="pick-detail">
          <div class="card-row">
            <Art path={iconOf(pr)} fallbackItem={NS + pr.Id} size={32} />
            <strong class="grow">{pr.DisplayName}</strong>
            <span class="muted small">{pr.Cost.Quantity} pt per enemy attack</span>
          </div>
          <ul class="bonus-list">
            {pr.Bonuses.Component.map((b) => (
              <li>{bonusLabel(b)}</li>
            ))}
          </ul>
          {unmet(pr.UnlockRequirements).map((t) => (
            <div class="need small">Needs {t}</div>
          ))}
          <button class={c.prayers.includes(NS + pr.Id) ? 'on' : ''} disabled={prayerState(pr) === 'locked'} onClick={() => setMsg(togglePrayer(game, NS + pr.Id) ?? '')}>
            {c.prayers.includes(NS + pr.Id) ? 'Turn off' : 'Activate'}
          </button>
        </div>
      )}
      <p class="muted small">Bury bones from the bank for prayer points.</p>
      {msg && <p class="muted">{msg}</p>}
        </>
      )}
      {show === 'spells' && (
        <>
      <h3>Spellbook {p.style.UsesSpells ? '' : <span class="muted small">(equip a staff or wand to cast)</span>}</h3>
      <div class="chips">
        {books.map((b) => {
          const demo = game.isDemoLocked(b.Requirements);
          return (
            <button class={book === NS + b.Id ? 'on' : ''} disabled={demo} onClick={() => setBook(NS + b.Id)}>
              {b.DisplayName}
              {demo ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>
      <IconGrid
        entries={spells.map((s) => ({ id: NS + s.Id, name: s.DisplayName, icon: iconOf(s), state: spellState(s) }))}
        picked={spellPick}
        onPick={(id) => setSpellPick(spellPick === id ? null : id)}
      />
      {spellPick && !sp && spells.some((s) => NS + s.Id === spellPick) && <p class="muted small">This spell is not in the demo.</p>}
      {sp && (
        <div class="pick-detail">
          <div class="card-row">
            <Art path={iconOf(sp)} fallbackItem={NS + sp.Id} size={32} />
            <strong class="grow">{sp.DisplayName}</strong>
            <span class="muted small">
              {displayName('Element', (sp as { Element?: string }).Element ?? '')} · max hit {sp.Stats.Stats.find((x) => x.Stat === `${NS}SpellMaxHit`)?.Value ?? 0}
            </span>
          </div>
          <div class="ingredients">
            {sp.RuneCosts.map((r) => (
              <span class={game.count(r.Item) < r.Quantity ? 'short' : ''}>
                <Icon id={r.Item} size={16} />
                {fmt(game.count(r.Item))}/{r.Quantity}
              </span>
            ))}
          </div>
          {unmet(sp.UnlockRequirements).map((t) => (
            <div class="need small">Needs {t}</div>
          ))}
          <button
            class={c.spell === NS + sp.Id ? 'on' : ''}
            disabled={spellState(sp) === 'locked'}
            onClick={() => {
              c.spell = c.spell === NS + sp.Id ? null : NS + sp.Id;
              game.emit();
            }}
          >
            {c.spell === NS + sp.Id ? 'Selected' : 'Select'}
          </button>
        </div>
      )}
        </>
      )}
    </>
  );
}

function SlayerView({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const t = game.state.combat.slayer;
  return (
    <>
      <p class="muted">
        Slayer level {game.level('Slayer')} · {fmt(game.currency(`${NS}SlayerCoins`))} slayer coins
      </p>
      {t && t.left > 0 && (
        <div class="card">
          <strong>
            Task: {t.left} × {enemyData(t.enemy).DisplayName}
          </strong>
          <div class="muted small">From {displayName('SlayerMaster', t.master)}. Kill them in any area they appear in.</div>
          <div class="row">
            <button disabled={!!t.extended} onClick={() => setMsg(extendSlayerTask(game) ?? '')}>
              {t.extended ? 'Extended' : `Extend (${fmt(slayerExtensionCost(game, t.master))})`}
            </button>
            <button
              disabled={!slayerBlockSlots(game, t.master).some((s) => s.unlocked)}
              onClick={() => setMsg(blockSlayerEnemy(game) ?? '')}
            >
              Block enemy ({fmt(slayerBlockCost(game, t.master))})
            </button>
          </div>
        </div>
      )}
      {msg && <p class="muted">{msg}</p>}
      {allSlayerMasters()
        .filter((m) => !game.isDemoLocked(m.UnlockRequirements))
        .map((m) => {
          const id = NS + m.Id;
          const [min, max] = slayerTaskRange(game, id);
          const active = t && t.left > 0;
          return (
            <div class="card-row">
              <div class="grow">
                <div>{m.DisplayName}</div>
                <div class="muted small">
                  {min}–{max} kills · {m.Areas.map((a) => area(a).DisplayName).join(', ')} · done {game.state.combat.slayerTasksDone[id] ?? 0}
                </div>
                {slayerBlockSlots(game, id).map((s) => (
                  <div class="muted small">
                    Block slot: {!s.unlocked ? 'locked' : s.enemy ? enemyData(s.enemy).DisplayName : 'empty'}
                    {s.enemy && (
                      <button class="link" onClick={() => unblockSlayerEnemy(game, s.id)}>
                        {' '}unblock
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button disabled={!game.requirementsMet(m.UnlockRequirements)} onClick={() => setMsg(newSlayerTask(game, id) ?? '')}>
                {active ? `Reroll (${fmt(slayerRerollCost(game, id))})` : 'New task'}
              </button>
            </div>
          );
        })}
    </>
  );
}

/** The desktop's combat panel tabs: an icon each, with a short label underneath for touch. */
const TABS: { id: Sub; label: string; icon: () => preact.ComponentChildren }[] = [
  { id: 'fight', label: 'Areas', icon: () => <PageIcon page="Combat" /> },
  { id: 'gear', label: 'Equipment', icon: () => <SkillBadge skill="Defence" size={26} /> },
  { id: 'stats', label: 'Stats', icon: () => <span class="tab-emoji">📊</span> },
  { id: 'spells', label: 'Spellbook', icon: () => <SkillBadge skill="Magic" size={26} /> },
  { id: 'prayers', label: 'Prayers', icon: () => <SkillBadge skill="Prayer" size={26} /> },
  { id: 'slayer', label: 'Slayer', icon: () => <SkillBadge skill="Slayer" size={26} /> },
];

function PageIcon({ page }: { page: string }) {
  const url = pageIconUrl(page);
  return url ? <img src={url} width={26} height={26} alt="" /> : <SkillBadge skill={page} size={26} />;
}

export function CombatPage({ game }: { game: Game }) {
  const [sub, setSub] = useState<Sub>('fight');
  return (
    <div class="page">
      <h2>Combat</h2>
      <FightView game={game} />
      <div class="combat-panel">
        <div class="panel-tabs" role="tablist">
          {TABS.map((t) => (
            <button role="tab" aria-selected={sub === t.id} class={sub === t.id ? 'on' : ''} onClick={() => setSub(t.id)}>
              {t.icon()}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div class="panel-body">
          {sub === 'fight' && <AreaBrowser game={game} />}
          {sub === 'gear' && <EquipmentView game={game} />}
          {sub === 'stats' && <CombatStatsSheet game={game} inline />}
          {sub === 'spells' && <PrayerMagicView game={game} show="spells" />}
          {sub === 'prayers' && <PrayerMagicView game={game} show="prayers" />}
          {sub === 'slayer' && <SlayerView game={game} />}
        </div>
      </div>
    </div>
  );
}
