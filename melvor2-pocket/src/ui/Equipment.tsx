// Equipment, laid out like the desktop: the slots as a paper doll (each slot's GridPosition from the game data, with the
// game's empty-slot silhouettes), stance and toolbelt beside it. Tapping a slot opens a full screen of the bank items that
// fit it, each with its stat changes against what it would replace, as the desktop's equip list shows.
import { useState } from 'preact/hooks';
import { NS, itemName, tryGet } from '../engine/content';
import type { Game } from '../engine/game';
import { DEFAULT_WEAPON, equipmentCap, equipmentSlots, stance as stanceData, type StatBlock } from '../engine/combat/data';
import { canEquip, currentStance, targetSlot, equip, equipped, occupiedSlots, playerFighter, unequip, weaponStances } from '../engine/combat/combat';
import { accuracyRating, attackInterval, combatLevel, maxHit, minHit, powerRating, protectionRating } from '../engine/combat/stats';
import { assetUrl } from '../art/assets';
import { Icon, fmt } from './common';
import { ToolbeltPanel } from './ExtrasPages';
import { currentLoadout, loadoutSlots, loadoutUnlocked, swapLoadout } from '../engine/combat/loadouts';
import { describeRequirement } from '../engine/navigation';
import { describeBlock } from '../engine/describe';

interface SlotData { Id: string; DisplayName: string; FitsType: string; GridPosition: { X: number; Y: number }; UnlockRequirements: never[] | null }
interface CombatStat { DisplayName: string; IsPercent: boolean }

const slotIcon = (s: SlotData) => assetUrl(tryGet<{ Icon?: string }>('EquipmentType', s.FitsType)?.Icon);

/** Every stat an item gives: its stat lines plus power and protection ratings, keyed by a display label. */
function itemStats(itemId: string): Map<string, number> {
  const out = new Map<string, number>();
  const st: StatBlock | undefined = equipmentCap(itemId)?.Stats;
  for (const v of st?.Stats ?? []) out.set(v.Stat, (out.get(v.Stat) ?? 0) + v.Value);
  for (const r of st?.PowerRatings ?? []) out.set(`power:${r.DamageType}`, r.Value);
  for (const r of st?.ProtectionRatings ?? []) out.set(`protection:${r.DamageType}`, r.Value);
  return out;
}

function statLabel(key: string): string {
  const [kind, id] = /^(power|protection):/.test(key) ? key.split(/:(.+)/) : ['', key];
  const damage = tryGet<{ DisplayName: string }>('DamageType', id)?.DisplayName.replace(/ Damage$/, '') ?? id.replace(NS, '');
  if (kind === 'power') return `${damage} Power`;
  if (kind === 'protection') return `${damage} Protection`;
  const name = tryGet<CombatStat>('CombatStat', key)?.DisplayName ?? key.replace(NS, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return name.replace(/ Bonus$/, '');
}

const lowerIsBetter = (key: string) => /AttackInterval$/.test(key);

function formatStat(key: string, v: number): string {
  if (/AttackInterval$/.test(key)) return `${(v / 1000).toFixed(2)}s`;
  return tryGet<CombatStat>('CombatStat', key)?.IsPercent ? `${Math.round(v * 100)}%` : fmt(v);
}

/** Items an equip into this slot would take off: the slot's own item, ones it would occupy, and a two-hander over it. */
function replacedBy(game: Game, slot: string, itemId: string): string[] {
  const out = new Set<string>();
  const here = equipped(game, slot);
  if (here) out.add(here.item);
  for (const s of equipmentCap(itemId)?.OccupiesSlots ?? []) {
    const e = equipped(game, s);
    if (e) out.add(e.item);
  }
  for (const e of Object.values(game.state.equipment)) if (equipmentCap(e.item)?.OccupiesSlots?.includes(slot)) out.add(e.item);
  out.delete(itemId);
  // Bare hands fight with the game's default weapon, so a first weapon is compared against that.
  if (!out.size && equipmentCap(itemId)?.Type === `${NS}Weapon`) out.add(DEFAULT_WEAPON);
  return [...out];
}

/** Stat changes from equipping, biggest first. */
function statDiff(game: Game, slot: string, itemId: string): { key: string; delta: number }[] {
  const next = itemStats(itemId);
  const prev = new Map<string, number>();
  for (const r of replacedBy(game, slot, itemId)) for (const [k, v] of itemStats(r)) prev.set(k, (prev.get(k) ?? 0) + v);
  const keys = new Set([...next.keys(), ...prev.keys()]);
  return [...keys]
    .map((key) => ({ key, delta: (next.get(key) ?? 0) - (prev.get(key) ?? 0) }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** What an equippable item gives, as the desktop's item details show it, and the change against what it would replace. */
export function ItemBonuses({ game, id }: { game: Game; id: string }) {
  const cap = equipmentCap(id);
  if (!cap) return null;
  const stats = [...itemStats(id)].filter(([, v]) => v !== 0);
  const bonuses = describeBlock(cap.Bonuses);
  const slot = targetSlot(game, id);
  const replaced = slot ? replacedBy(game, slot, id) : [];
  const diff = slot ? statDiff(game, slot, id) : [];
  const unmet = cap.Requirements?.map((r) => describeRequirement(game, r)).filter((r) => !r.done) ?? [];
  return (
    <div class="item-bonuses">
      {stats.length > 0 && (
        <div class="diff">
          {stats.map(([k, v]) => (
            <span>
              {v > 0 && !/AttackInterval$/.test(k) ? '+' : ''}
              {formatStat(k, v)} {statLabel(k)}
            </span>
          ))}
        </div>
      )}
      {bonuses.length > 0 && (
        <ul class="bonus-list">
          {bonuses.map((b) => (
            <li>{b}</li>
          ))}
        </ul>
      )}
      {!stats.length && !bonuses.length && <p class="muted small">No stats or bonuses.</p>}
      {unmet.map((r) => (
        <div class="need small">Needs {r.text}</div>
      ))}
      {slot && !replaced.includes(id) && (
        <>
          <div class="muted small">
            Compared with {replaced.filter((r) => r !== DEFAULT_WEAPON).map(itemName).join(' + ') || 'an empty slot'}:
          </div>
          <div class="diff">
            {diff.length ? (
              diff.map((d) => {
                const good = lowerIsBetter(d.key) ? d.delta < 0 : d.delta > 0;
                return (
                  <span class={good ? 'up' : 'down'}>
                    {d.delta > 0 ? '+' : '−'}
                    {formatStat(d.key, Math.abs(d.delta))} {statLabel(d.key)}
                  </span>
                );
              })
            ) : (
              <span class="muted">No stat changes</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function EquipmentView({ game }: { game: Game }) {
  const [slot, setSlot] = useState<string | null>(null);
  const slots = (equipmentSlots() as unknown as SlotData[]).filter((s) => game.requirementsMet(s.UnlockRequirements));
  const rows = Math.max(...slots.map((s) => s.GridPosition.Y)) + 1;
  const occupied = occupiedSlots(game);
  const p = playerFighter(game);
  return (
    <div class="equip-layout">
      <Loadouts game={game} />
      <div class="doll" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {slots.map((s) => {
          const id = NS + s.Id;
          const e = equipped(game, id);
          const blockedBy = occupied.has(id) ? Object.values(game.state.equipment).find((x) => equipmentCap(x.item)?.OccupiesSlots?.includes(id)) : undefined;
          const silhouette = slotIcon(s);
          return (
            <button
              class={`doll-slot ${e ? 'filled' : ''} ${blockedBy ? 'blocked' : ''}`}
              style={{ gridColumn: s.GridPosition.X + 1, gridRow: s.GridPosition.Y + 1 }}
              onClick={() => setSlot(id)}
              aria-label={e ? `${s.DisplayName}: ${itemName(e.item)}` : `${s.DisplayName}: empty`}
            >
              {e ? (
                <Icon id={e.item} size={44} />
              ) : blockedBy ? (
                <span class="doll-ghost"><Icon id={blockedBy.item} size={40} /></span>
              ) : silhouette ? (
                <img class="doll-silhouette" src={silhouette} alt="" />
              ) : (
                <span class="muted small">{s.DisplayName}</span>
              )}
              {e && e.qty > 1 && <span class="qty">{fmt(e.qty)}</span>}
            </button>
          );
        })}
      </div>
      <div class="equip-side">
        <h3>Stance</h3>
        <div class="stance-grid">
          {weaponStances(game).map((s) => (
            <button
              class={currentStance(game) === s ? 'on' : ''}
              onClick={() => {
                game.state.combat.stance = s;
                game.emit();
              }}
            >
              {stanceData(s).DisplayName}
            </button>
          ))}
        </div>
        <h3>Your stats</h3>
        <dl class="stats">
          <dt>Combat level</dt>
          <dd>{combatLevel(p, p.style)}</dd>
          <dt>Style</dt>
          <dd>{p.style.DisplayName}</dd>
          <dt>Hit</dt>
          <dd>
            {minHit(p, maxHit(p))}–{maxHit(p)}
          </dd>
          <dt>Attack interval</dt>
          <dd>{(attackInterval(p) / 1000).toFixed(2)}s</dd>
          <dt>Accuracy rating</dt>
          <dd>{fmt(accuracyRating(p))}</dd>
          <dt>Power / protection</dt>
          <dd>
            {powerRating(p)} / {protectionRating(p)}
          </dd>
        </dl>
      </div>
      <div class="equip-toolbelt">
        <ToolbeltPanel game={game} entity="Combat" />
      </div>
      {slot && <EquipSheet game={game} slot={slot} onClose={() => setSlot(null)} />}
    </div>
  );
}

/** Loadout slots, as on the desktop: tap one to switch your whole set (gear, stance, spell, prayers, food, toolbelt). */
function Loadouts({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const cur = currentLoadout(game);
  return (
    <div class="loadouts">
      <div class="chips">
        {loadoutSlots().map((l) => {
          const id = NS + l.Id;
          const open = loadoutUnlocked(game, id);
          return (
            <button class={cur === id ? 'on' : ''} disabled={!open} onClick={() => setMsg(swapLoadout(game, id) ?? '')}>
              {open ? '' : '🔒 '}
              {l.DisplayName}
            </button>
          );
        })}
      </div>
      {msg && <p class="muted small">{msg}</p>}
    </div>
  );
}

function EquipSheet({ game, slot, onClose }: { game: Game; slot: string; onClose: () => void }) {
  const [sort, setSort] = useState<'bank' | 'az'>('bank');
  const [msg, setMsg] = useState('');
  const s = (equipmentSlots() as unknown as SlotData[]).find((x) => NS + x.Id === slot)!;
  const current = equipped(game, slot);
  const fitting = Object.keys(game.state.bank).filter((i) => equipmentCap(i)?.Type === s.FitsType && game.count(i) > 0);
  if (sort === 'az') fitting.sort((a, b) => itemName(a).localeCompare(itemName(b)));
  return (
    <div class="sheet equip-sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          {slotIcon(s) && <img class="doll-silhouette small" src={slotIcon(s)} alt="" />}
          <h2 class="grow">{s.DisplayName}</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {current ? (
          <div class="equip-row current">
            <Icon id={current.item} size={40} />
            <div class="grow">
              <strong>{itemName(current.item)}</strong>
              <div class="muted small">Equipped{current.qty > 1 ? ` ×${fmt(current.qty)}` : ''}</div>
            </div>
            <button
              onClick={() => {
                unequip(game, slot);
                game.emit();
              }}
            >
              Unequip
            </button>
          </div>
        ) : (
          <p class="muted small">Nothing equipped.</p>
        )}
        <div class="chips">
          <button class={sort === 'bank' ? 'on' : ''} onClick={() => setSort('bank')}>
            Bank order
          </button>
          <button class={sort === 'az' ? 'on' : ''} onClick={() => setSort('az')}>
            A–Z
          </button>
        </div>
        {msg && <p class="muted small">{msg}</p>}
        {!fitting.length && <p class="muted">Nothing in your bank fits this slot.</p>}
        <div class="equip-list">
          {fitting.map((i) => {
            const why = canEquip(game, i);
            const diff = statDiff(game, slot, i);
            // Name the requirement that's missing ("Defence level 10 (now 1)") rather than just "Level too low".
            const unmet = why ? equipmentCap(i)?.Requirements?.map((r) => describeRequirement(game, r)).find((r) => !r.done)?.text : undefined;
            return (
              <div class={`equip-row ${why ? 'cant' : ''}`}>
                <Icon id={i} size={40} />
                <div class="grow">
                  <strong>{itemName(i)}</strong> <span class="muted small">×{fmt(game.count(i))}</span>
                  <div class="diff">
                    {diff.length ? (
                      diff.map((d) => {
                        const good = lowerIsBetter(d.key) ? d.delta < 0 : d.delta > 0;
                        return (
                          <span class={good ? 'up' : 'down'}>
                            {d.delta > 0 ? '+' : '−'}
                            {formatStat(d.key, Math.abs(d.delta))} {statLabel(d.key)}
                          </span>
                        );
                      })
                    ) : (
                      <span class="muted">No stat changes</span>
                    )}
                  </div>
                  {unmet && <div class="need small">Needs {unmet}</div>}
                  {replacedBy(game, slot, i).filter((r) => r !== DEFAULT_WEAPON).length > 0 && (
                    <div class="muted small">
                      Replaces {replacedBy(game, slot, i).filter((r) => r !== DEFAULT_WEAPON).map((r) => itemName(r)).join(' and ')}
                    </div>
                  )}
                </div>
                <button
                  class="go"
                  disabled={!!why}
                  onClick={() => {
                    const r = equip(game, i);
                    if (r) setMsg(r);
                    else onClose();
                  }}
                >
                  {why ? 'Locked' : 'Equip'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
