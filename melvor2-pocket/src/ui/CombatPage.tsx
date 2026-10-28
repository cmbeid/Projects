import { useState } from 'preact/hooks';
import { NS, all, displayName, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import { type Bonus, type Drops, type Dungeon, allPrayers, allSlayerMasters, allSpells, area, enemy as enemyData, isDungeon } from '../engine/combat/data';
import {
  areaEnemies, blockSlayerEnemy, dropChances, effectsView, liveEnemyFighter, togglePause, enemyFighter, enemyMaxHp, extendSlayerTask, fight, newSlayerTask, playerFighter, prayerPoints, slayerBlockCost,
  slayerBlockSlots, slayerExtensionCost, slayerRerollCost, slayerTaskRange, togglePrayer, unblockSlayerEnemy,
} from '../engine/combat/combat';
import { accuracyRating, attackInterval, combatLevel, evasionRating, hitChance, maxHit, minHit } from '../engine/combat/stats';
import { HpBar, Icon, TimerBar, fmt, ticksToDuration, type BarMarker } from './common';
import { assetUrl } from '../art/assets';
import { EquipmentView } from './Equipment';
import { CombatStatsSheet } from './CombatStats';
import { HitSplats } from './HitSplats';

type Sub = 'fight' | 'gear' | 'prayer' | 'slayer';

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
  const since = Math.max(0, (c.pending ?? 0) - (game.state.active?.ticksLeft ?? 0));
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
function LootHistory({ game, onClose }: { game: Game; onClose: () => void }) {
  const l = game.state.combat.loot;
  const items = Object.entries(l?.items ?? {}).sort((a, b) => b[1] - a[1]);
  const mins = l ? Math.max(1, (game.state.tick - l.since) / 3600) : 1;
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2 class="grow">Loot History</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p class="muted small">
          {fmt(l?.kills ?? 0)} kills in {ticksToDuration(l ? game.state.tick - l.since : 0)} ({(l?.kills ?? 0) / mins >= 1 ? fmt(((l?.kills ?? 0) / mins) * 60) : '<60'} an hour)
        </p>
        {Object.entries(l?.currencies ?? {}).map(([cur, q]) => (
          <div class="card-row">
            <span class="grow">{displayName('Currency', cur)}</span>
            <strong>{fmt(q)}</strong>
          </div>
        ))}
        {!items.length && !Object.keys(l?.currencies ?? {}).length && <p class="muted">Nothing yet.</p>}
        {items.map(([it, q]) => (
          <div class="card-row">
            <Icon id={it} size={28} />
            <span class="grow">{itemName(it, q)}</span>
            <strong>{fmt(q)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/** An enemy's (or a dungeon's) drop table with chances, like the desktop's View Enemy Drops. */
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

function PrayerMagicView({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const c = game.state.combat;
  const p = playerFighter(game);
  const spells = allSpells().filter((s) => !game.isDemoLocked(s.UnlockRequirements));
  return (
    <>
      <h3>Prayer · {fmt(prayerPoints(game))} points</h3>
      <p class="muted small">Bury bones from the bank for prayer points. Each active prayer costs points every enemy attack.</p>
      {msg && <p class="muted">{msg}</p>}
      {allPrayers()
        .filter((x) => !game.isDemoLocked(x.UnlockRequirements))
        .map((x) => {
          const id = NS + x.Id;
          const on = c.prayers.includes(id);
          const ok = game.requirementsMet(x.UnlockRequirements);
          return (
            <div class="card-row prayer">
              <div class="grow">
                <div>{x.DisplayName}</div>
                <div class="muted small">
                  {x.Bonuses.Component.map((b) => bonusLabel(b)).join(', ')}
                </div>
              </div>
              <button class={on ? 'on' : ''} disabled={!ok} onClick={() => setMsg(togglePrayer(game, id) ?? '')}>
                {ok ? (on ? 'On' : `${x.Cost.Quantity} pt`) : 'Locked'}
              </button>
            </div>
          );
        })}
      <h3>Spells {p.style.UsesSpells ? '' : '(equip a staff or wand to cast)'}</h3>
      {spells.map((s) => {
        const id = NS + s.Id;
        const ok = game.requirementsMet(s.UnlockRequirements);
        return (
          <div class="card-row">
            <div class="grow">
              <div>
                {s.DisplayName} <span class="muted small">{displayName('SpellBook', s.Book)}</span>
              </div>
              <div class="ingredients">
                {s.RuneCosts.map((r) => (
                  <span class={game.count(r.Item) < r.Quantity ? 'short' : ''}>
                    <Icon id={r.Item} size={16} />
                    {fmt(game.count(r.Item))}/{r.Quantity}
                  </span>
                ))}
              </div>
            </div>
            <button
              class={c.spell === id ? 'on' : ''}
              disabled={!ok}
              onClick={() => {
                c.spell = c.spell === id ? null : id;
                game.emit();
              }}
            >
              {ok ? (c.spell === id ? 'Selected' : 'Select') : 'Locked'}
            </button>
          </div>
        );
      })}
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

export function CombatPage({ game }: { game: Game }) {
  const [sub, setSub] = useState<Sub>('fight');
  const subs: [Sub, string][] = [
    ['fight', 'Fight'],
    ['gear', 'Equipment'],
    ['prayer', 'Prayer & Magic'],
    ['slayer', 'Slayer'],
  ];
  return (
    <div class="page">
      <h2>Combat</h2>
      <FightView game={game} />
      <div class="chips">
        {subs.map(([id, label]) => (
          <button class={sub === id ? 'on' : ''} onClick={() => setSub(id)}>
            {label}
          </button>
        ))}
      </div>
      {sub === 'fight' && <AreaBrowser game={game} />}
      {sub === 'gear' && <EquipmentView game={game} />}
      {sub === 'prayer' && <PrayerMagicView game={game} />}
      {sub === 'slayer' && <SlayerView game={game} />}
    </div>
  );
}
