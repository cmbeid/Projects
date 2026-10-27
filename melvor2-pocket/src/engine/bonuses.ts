// The bonus (modifier) system: collects bonuses from every active source and sums the ones that apply.
// Bonus shape follows the game's data: { Stat: { StatsType, Name }, Value, LocalContext, Condition, Scaling }.
import { NS, all, get, tryGet } from './content';
import type { Game } from './game';
import type { Bonus } from './combat/data';
import { equipmentCap } from './combat/data';
import { unlockedMinorNodes, type AstrologyNode } from './skills/astrology';
import { shopPurchases } from './shop';
import { guildBonuses } from './guild';
import { flowerBonuses } from './skills/farming';

interface RawBonus extends Bonus {
  Condition?: unknown;
  Scaling?: unknown;
  FromContext?: unknown;
}

interface BonusBlock { Global?: RawBonus[]; Component?: RawBonus[] }

interface SetBonus { Id: string; Items: string[]; Bonuses: { ItemCount: number; Modifiers: BonusBlock }[] }

export interface ToolbeltCap { FitsInSlot: string; Requirements: unknown; Bonuses: BonusBlock | null; CanEquipQuantity: boolean }

/** Context an action looks bonuses up in: its skill entity plus any recipe/category/item it's working on. */
export interface BonusContext {
  entity?: string;
  [key: string]: string | undefined;
}

const PLACEHOLDER = 'Placeholder:Placeholder';

export const fishingBaitCap = (itemId: string) =>
  (tryGet<{ Capabilities: Record<string, unknown> | null }>('Item', itemId)?.Capabilities ?? {})[`${NS}FishingBait`] as { Bonuses: BonusBlock | null } | undefined;

export const toolbeltCap = (itemId: string) =>
  (tryGet<{ Capabilities: Record<string, unknown> | null }>('Item', itemId)?.Capabilities ?? {})[`${NS}Toolbelt`] as ToolbeltCap | undefined;

function blockBonuses(block: BonusBlock | null | undefined, times = 1): RawBonus[] {
  if (!block) return [];
  const list = [...(block.Global ?? []), ...(block.Component ?? [])];
  return times === 1 ? list : list.map((b) => ({ ...b, Value: b.Value * times }));
}

/** Every bonus currently active, from shop, astrology, equipment, set bonuses and the toolbelt. */
export function activeBonuses(game: Game, includeEquipment = true): RawBonus[] {
  const out: RawBonus[] = [];
  for (const p of shopPurchases()) {
    const n = game.state.purchases[NS + p.Id] ?? 0;
    if (n && p.Provides.Bonuses) out.push(...blockBonuses(p.Provides.Bonuses as BonusBlock, n));
  }
  for (const c of all<{ Id: string; PerMinorNodeBonuses?: BonusBlock | null }>('AstrologyConstellation')) {
    const nodes = unlockedMinorNodes(game, NS + c.Id);
    for (const node of nodes) out.push(...blockBonuses(get<AstrologyNode>('AstrologyNode', node).Bonuses as BonusBlock));
    // Each unlocked minor node also adds the constellation's own bonus (e.g. +2% knowledge for it).
    if (nodes.length) out.push(...blockBonuses(c.PerMinorNodeBonuses, nodes.length));
  }
  const worn = Object.values(game.state.equipment).map((e) => e.item);
  if (includeEquipment) for (const it of worn) out.push(...blockBonuses(equipmentCap(it)?.Bonuses as BonusBlock | null));
  for (const set of all<SetBonus>('EquipmentSetBonus')) {
    const count = set.Items.filter((i) => worn.includes(i)).length;
    for (const tier of set.Bonuses) if (count >= tier.ItemCount) out.push(...blockBonuses(tier.Modifiers));
  }
  for (const b of guildBonuses(game)) out.push(...blockBonuses(b.Rewards.Bonuses as BonusBlock | null));
  for (const t of Object.values(game.state.toolbelt)) if (t.qty > 0) out.push(...blockBonuses(toolbeltCap(t.item)?.Bonuses));
  // Flowers: in bloom they give their bonus in full; while growing, only if a bonus scales it in (Deedree's node).
  const whileGrowing = out.filter((b) => b.Stat.Name === 'PercentBonusesWhileGrowing').reduce((s, b) => s + b.Value, 0);
  for (const f of flowerBonuses(game, whileGrowing)) out.push(...blockBonuses(f.block as BonusBlock, f.times));
  const bait = game.state.fishingBait;
  if (bait && game.count(bait) > 0) out.push(...blockBonuses(fishingBaitCap(bait)?.Bonuses));
  return resolveConditional(game, out);
}

interface Condition { Type: string; Data: { Area?: string | null; Category?: string | null; Slot?: string | null } }
interface Scaling { Type: string; Data: { Experience?: { Entity: string } } }

/**
 * Bonuses with a condition apply only while it holds (fighting your slayer task, fighting in an area or category, a slot
 * equipped); ones with Level scaling are multiplied by that skill's level. Unknown kinds stay off.
 */
export function resolveConditional<T extends Bonus>(game: Game, list: T[]): T[] {
  const out: T[] = [];
  for (const b of list as (T & RawBonus)[]) {
    const cond = b.Condition as Condition | null | undefined;
    if (cond && !conditionHolds(game, cond)) continue;
    const scaling = b.Scaling as Scaling | null | undefined;
    if (scaling) {
      if (scaling.Type !== `${NS}Level` || !scaling.Data.Experience) continue;
      out.push({ ...b, Value: b.Value * game.level(scaling.Data.Experience.Entity.replace(NS, '')) });
    } else out.push(b);
  }
  return out;
}

function conditionHolds(game: Game, c: Condition): boolean {
  const combat = game.state.combat;
  const fighting = game.state.active?.skill === 'Combat' && !!combat.area;
  switch (c.Type.replace(NS, '')) {
    case 'FightingSlayerTask':
      return fighting && !!combat.slayer && combat.slayer.left > 0 && combat.enemy === combat.slayer.enemy;
    case 'CombatInArea': {
      if (!fighting) return false;
      const a = tryGet<{ Category?: string }>('CombatArea', combat.area!) ?? tryGet<{ Category?: string }>('Dungeon', combat.area!);
      return (!c.Data.Area || c.Data.Area === combat.area) && (!c.Data.Category || c.Data.Category === a?.Category);
    }
    case 'EquipmentSlotEquipped':
      return !!c.Data.Slot && !!game.state.equipment[c.Data.Slot];
    default:
      return false;
  }
}

/** The state conditional bonuses read, so the cache can tell when to recompute them. */
export function conditionKey(game: Game): string {
  const c = game.state.combat;
  return [game.state.active?.skill, c.area, c.enemy, c.slayer?.enemy, c.slayer?.left ? 1 : 0, Object.keys(game.state.equipment).join(','), game.level('Strength')].join('|');
}

function matches(b: RawBonus, statsType: string, ctx: BonusContext): boolean {
  if (b.Stat.StatsType !== NS + statsType) return false;
  const lc = (b.LocalContext ?? {}) as Record<string, unknown>;
  const comp = lc.Component as { Entity?: string } | undefined;
  if (comp?.Entity && ctx.entity && comp.Entity !== NS + ctx.entity) return false;
  for (const [k, v] of Object.entries(lc)) {
    if (k === 'Component' || v == null || v === PLACEHOLDER) continue;
    const want = ctx[k.charAt(0).toLowerCase() + k.slice(1)];
    if (want !== v) return false;
  }
  return true;
}

/** Sum of a named bonus for an action context, e.g. mod(game, 'WoodcuttingAction', 'DoublingChance', { entity: 'Woodcutting' }). */
export function mod(game: Game, statsType: string, name: string, ctx: BonusContext = {}): number {
  let total = 0;
  for (const b of game.bonuses()) if (b.Stat.Name === name && matches(b, statsType, ctx)) total += b.Value;
  return total;
}

/** Action interval with the usual Flat/Percent interval bonuses: floor((base + flat) × (1 + pct)). */
export function modInterval(game: Game, statsType: string, base: number, ctx: BonusContext): number {
  const flat = mod(game, statsType, 'FlatInterval', ctx);
  const pct = mod(game, statsType, 'PercentInterval', ctx);
  return Math.max(250, Math.floor((base + flat) * (1 + pct)));
}

export const BASE_BANK_SLOTS = 100;
