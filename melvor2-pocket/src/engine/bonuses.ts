// The bonus (modifier) system: collects bonuses from every active source and sums the ones that apply.
// Bonus shape follows the game's data: { Stat: { StatsType, Name }, Value, LocalContext, Condition, Scaling }.
import { NS, all, get, tryGet } from './content';
import type { Game } from './game';
import type { Bonus } from './combat/data';
import { equipmentCap } from './combat/data';
import { unlockedMinorNodes, type AstrologyNode } from './skills/astrology';
import { shopPurchases } from './shop';
import { guildBonuses } from './guild';

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
  for (const c of all<{ Id: string }>('AstrologyConstellation')) {
    for (const node of unlockedMinorNodes(game, NS + c.Id)) out.push(...blockBonuses(get<AstrologyNode>('AstrologyNode', node).Bonuses as BonusBlock));
  }
  const worn = Object.values(game.state.equipment).map((e) => e.item);
  if (includeEquipment) for (const it of worn) out.push(...blockBonuses(equipmentCap(it)?.Bonuses as BonusBlock | null));
  for (const set of all<SetBonus>('EquipmentSetBonus')) {
    const count = set.Items.filter((i) => worn.includes(i)).length;
    for (const tier of set.Bonuses) if (count >= tier.ItemCount) out.push(...blockBonuses(tier.Modifiers));
  }
  for (const b of guildBonuses(game)) out.push(...blockBonuses(b.Rewards.Bonuses as BonusBlock | null));
  for (const t of Object.values(game.state.toolbelt)) if (t.qty > 0) out.push(...blockBonuses(toolbeltCap(t.item)?.Bonuses));
  // Bonuses with conditions or scaling need runtime state the rebuild doesn't track yet, so they're left out.
  return out.filter((b) => b.Condition == null && b.Scaling == null);
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
