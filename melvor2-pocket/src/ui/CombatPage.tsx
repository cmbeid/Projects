import { useState } from 'preact/hooks';
import { NS, all, displayName, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import { type Bonus, type Dungeon, allPrayers, allSlayerMasters, allSpells, area, enemy as enemyData, isDungeon } from '../engine/combat/data';
import {
  areaEnemies, blockSlayerEnemy, enemyFighter, enemyMaxHp, extendSlayerTask, fight, newSlayerTask, playerFighter, prayerPoints, slayerBlockCost,
  slayerBlockSlots, slayerExtensionCost, slayerRerollCost, slayerTaskRange, togglePrayer, unblockSlayerEnemy,
} from '../engine/combat/combat';
import { accuracyRating, attackInterval, combatLevel, evasionRating, hitChance, maxHit, minHit } from '../engine/combat/stats';
import { Bar, HpBar, Icon, fmt, type BarMarker } from './common';
import { assetUrl } from '../art/assets';
import { EquipmentView } from './Equipment';

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

function FightView({ game }: { game: Game }) {
  const c = game.state.combat;
  const fighting = game.state.active?.skill === 'Combat';
  if (!fighting || !c.area) return null;
  const e = c.enemy ? enemyFighter(c.enemy) : null;
  const p = playerFighter(game, e?.style.Id);
  const pInt = Math.round(attackInterval(p) / (1000 / 60));
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
            <Bar value={Math.round(attackInterval(e) / (1000 / 60)) - c.enemyLeft} max={Math.round(attackInterval(e) / (1000 / 60))} color="#9a7ae0" />
          </>
        ) : (
          <div class="enemy-art searching muted">Looking for an enemy…</div>
        )}
      </div>
      <div class="fighter you">
        <div class="card-row">
          <strong class="grow">You</strong>
          <span class="muted small">{p.stance.DisplayName}</span>
        </div>
        <HpBar value={game.hp()} max={game.maxHp()} color="#5fbf6a" markers={youMarks} />
        <div class="muted small">
          {game.hp()} / {game.maxHp()} HP · {food ? `${itemName(food, 2)} ×${fmt(game.count(food))} · auto-eat at ${game.autoEatAt()} HP` : 'no food'}
        </div>
        {c.phase === 'fighting' && <Bar value={pInt - c.playerLeft} max={pInt} color="#e8b84a" />}
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
        <button class="danger run" onClick={() => game.stop('You ran away.')}>
          Run away
        </button>
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
                <button class="wide" onClick={() => start(null)}>
                  Start dungeon
                </button>
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
