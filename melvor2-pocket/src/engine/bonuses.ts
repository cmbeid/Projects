// The bonus (modifier) system: collects bonuses from every active source and sums the ones that apply.
// Bonus shape follows the game's data: { Stat: { StatsType, Name }, Value, LocalContext, Condition, Scaling }.
import { NS, all, get, tryGet } from './content';
import type { Game } from './game';
import type { Bonus } from './combat/data';
import { equipmentCap } from './combat/data';
import { unlockedMajorNodes, unlockedMinorNodes, type AstrologyNode } from './skills/astrology';
import { shopPurchases } from './shop';
import { guildBonuses } from './guild';
import { flowerBonuses } from './skills/farming';
import type { TriggeredEffect } from './combat/effects';

interface RawBonus extends Bonus {
  Condition?: unknown;
  Scaling?: unknown;
  FromContext?: unknown;
}

interface BonusBlock { Global?: RawBonus[]; Component?: RawBonus[]; CombatEffect?: TriggeredEffect[] }

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

/**
 * Global bonuses name a stat group instead of a stat, and feed every stat in it (e.g. GlobalPercentActionInterval →
 * each skill's PercentInterval, as ArtisanActionStats lists it). They become bonuses with that stat's name and a
 * wildcard StatsType (or the one owner type), so mod() picks them up wherever that stat is read.
 */
const STAT_GROUPS: Record<string, { StatsType: string; Name: string }> = {
  GlobalPercentActionInterval: { StatsType: '*', Name: 'PercentInterval' },
  GlobalFlatAutoEatThreshold: { StatsType: `${NS}CombatFood`, Name: 'FlatAutoEatThreshold' },
  GlobalFlatAutoEatLimit: { StatsType: `${NS}CombatFood`, Name: 'FlatAutoEatLimit' },
  GlobalFlatAutoEatEfficiency: { StatsType: `${NS}CombatFood`, Name: 'FlatAutoEatEfficiency' },
};

function withStat(b: RawBonus): RawBonus | null {
  if (b.Stat) return b;
  const group = (b as { StatGroup?: string }).StatGroup;
  const stat = group ? STAT_GROUPS[group] : undefined;
  return stat ? { ...b, Stat: stat, LocalContext: null } : null;
}

function blockBonuses(block: BonusBlock | null | undefined, times = 1): RawBonus[] {
  if (!block) return [];
  const list = [...(block.Global ?? []), ...(block.Component ?? [])].map(withStat).filter((b): b is RawBonus => !!b);
  return times === 1 ? list : list.map((b) => ({ ...b, Value: b.Value * times }));
}

/** Every bonus currently active, from shop, astrology, equipment, set bonuses and the toolbelt. */
/** Every active source of bonuses, as { block, times }: shop, astrology, gear, sets, guild, toolbelt, prayers. */
function sourceBlocks(game: Game, includeEquipment: boolean): { block: BonusBlock | null | undefined; times: number }[] {
  const out: { block: BonusBlock | null | undefined; times: number }[] = [];
  for (const p of shopPurchases()) {
    const n = game.state.purchases[NS + p.Id] ?? 0;
    if (n && p.Provides.Bonuses) out.push({ block: p.Provides.Bonuses as BonusBlock, times: n });
  }
  for (const c of all<{ Id: string; PerMinorNodeBonuses?: BonusBlock | null }>('AstrologyConstellation')) {
    const nodes = unlockedMinorNodes(game, NS + c.Id);
    for (const node of [...nodes, ...unlockedMajorNodes(game, NS + c.Id)]) out.push({ block: get<AstrologyNode>('AstrologyNode', node).Bonuses as BonusBlock, times: 1 });
    // Each unlocked minor node also adds the constellation's own bonus (e.g. +2% knowledge for it).
    if (nodes.length) out.push({ block: c.PerMinorNodeBonuses, times: nodes.length });
  }
  const worn = Object.values(game.state.equipment).map((e) => e.item);
  if (includeEquipment) for (const it of worn) out.push({ block: equipmentCap(it)?.Bonuses as BonusBlock | null, times: 1 });
  for (const set of all<SetBonus>('EquipmentSetBonus')) {
    const count = set.Items.filter((i) => worn.includes(i)).length;
    for (const tier of set.Bonuses) if (count >= tier.ItemCount) out.push({ block: tier.Modifiers, times: 1 });
  }
  for (const b of guildBonuses(game)) out.push({ block: b.Rewards.Bonuses as BonusBlock | null, times: 1 });
  for (const t of Object.values(game.state.toolbelt)) if (t.qty > 0) out.push({ block: toolbeltCap(t.item)?.Bonuses, times: 1 });
  const imb = activeImbuement(game);
  if (imb) out.push({ block: imb.Bonuses, times: 1 });
  return out;
}

interface Imbuement { Id: string; Element: string; RuneCosts: { Item: string; Quantity: number }[]; UnlockRequirements: unknown; Bonuses: BonusBlock }

/**
 * The imbuement in effect (MagicSpellsComponent): selected, unlocked, of an element your weapon allows, and affordable
 * (its runes are paid at the start of each of your attack turns).
 */
export function activeImbuement(game: Game): Imbuement | null {
  const id = game.state.combat.imbuement;
  const imb = id ? tryGet<Imbuement>('Imbuement', id) : undefined;
  if (!imb) return null;
  const weapon = game.state.equipment[`${NS}Weapon`]?.item;
  const elements = (weapon ? (tryGet<{ Capabilities: Record<string, unknown> | null }>('Item', weapon)?.Capabilities?.[`${NS}Weapon`] as { Elements?: string[] } | undefined)?.Elements : undefined) ?? [];
  if (!elements.includes(imb.Element) || !game.requirementsMet(imb.UnlockRequirements as never)) return null;
  return imb.RuneCosts.every((r) => game.count(r.Item) >= r.Quantity) ? imb : null;
}

/** Triggered combat effects from every active source (gear, astrology, guild, shop...), conditions resolved. */
export function activeCombatEffects(game: Game): TriggeredEffect[] {
  const out: TriggeredEffect[] = [];
  for (const { block } of sourceBlocks(game, true)) for (const t of block?.CombatEffect ?? []) out.push(t);
  for (const p of game.state.combat.prayers) for (const t of (tryGet<{ Bonuses: BonusBlock }>('Prayer', p)?.Bonuses?.CombatEffect ?? [])) out.push(t);
  return out.filter((t) => !t.Condition || conditionHolds(game, t.Condition as Condition));
}

export function activeBonuses(game: Game, includeEquipment = true): RawBonus[] {
  const out: RawBonus[] = [];
  for (const { block, times } of sourceBlocks(game, includeEquipment)) out.push(...blockBonuses(block, times));
  // Flowers: in bloom they give their bonus in full; while growing, only if a bonus scales it in (Deedree's node).
  const whileGrowing = out.filter((b) => b.Stat.Name === 'PercentBonusesWhileGrowing').reduce((s, b) => s + b.Value, 0);
  for (const f of flowerBonuses(game, whileGrowing)) out.push(...blockBonuses(f.block as BonusBlock, f.times));
  const bait = game.state.fishingBait;
  if (bait && game.count(bait) > 0) out.push(...blockBonuses(fishingBaitCap(bait)?.Bonuses));
  return resolveConditional(game, out);
}

interface Condition { Type: string; Data: { Area?: string | null; Category?: string | null; Slot?: string | null; Style?: string | null; Stance?: string | null } }
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

export function conditionHolds(game: Game, c: Condition): boolean {
  const combat = game.state.combat;
  const fighting = game.state.active?.skill === 'Combat' && !!combat.area;
  switch (c.Type.replace(NS, '')) {
    case 'FightingSlayerTask':
      return fighting && Object.values(combat.slayerTasks ?? {}).some((t) => t.left > 0 && t.enemy === combat.enemy);
    case 'CombatInArea': {
      if (!fighting) return false;
      const a = tryGet<{ Category?: string }>('CombatArea', combat.area!) ?? tryGet<{ Category?: string }>('Dungeon', combat.area!);
      return (!c.Data.Area || c.Data.Area === combat.area) && (!c.Data.Category || c.Data.Category === a?.Category);
    }
    case 'EquipmentSlotEquipped':
      return !!c.Data.Slot && !!game.state.equipment[c.Data.Slot];
    // The player's current stance and its combat style (e.g. Stinger arrows: +15% while using Ranged).
    case 'CharacterUsingCombatStyle':
      return tryGet<{ CombatStyle: string }>('AttackStance', combat.stance)?.CombatStyle === c.Data.Style;
    case 'CharacterUsingStance':
      return combat.stance === c.Data.Stance;
    default:
      return false;
  }
}

/** The state conditional bonuses read, so the cache can tell when to recompute them. */
export function conditionKey(game: Game): string {
  const c = game.state.combat;
  return [game.state.active?.skill, c.stance, c.area, c.enemy, c.imbuement && activeImbuement(game) ? 1 : 0, Object.values(c.slayerTasks ?? {}).filter((t) => t.left > 0).map((t) => t.enemy).join('+'), Object.keys(game.state.equipment).join(','), game.level('Strength')].join('|');
}

function matches(b: RawBonus, statsType: string, ctx: BonusContext): boolean {
  if (b.Stat.StatsType !== NS + statsType && b.Stat.StatsType !== '*') return false;
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
