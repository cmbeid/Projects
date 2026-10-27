// Item interactions outside skills: opening containers, upgrading items, and the skill toolbelts.
import { NS, all, configList, get, tryGet, type Ingredients, type Requirement } from './content';
import type { Game } from './game';
import { toolbeltCap } from './bonuses';
import { missingIngredients, spendIngredients } from './skills/common';

interface OpenableCap {
  AlwaysDrops: { Item: string; Quantity: number }[];
  DropTable: { Item: string; MinQuantity: number; MaxQuantity: number; Weight: number }[];
}

export interface ItemUpgrade {
  Id: string;
  UpgradedItem: string;
  Costs: Ingredients;
  QuantityPerUpgrade: number;
  RootItems: string[];
  Requirements: Requirement[] | null;
}

export interface ToolbeltSlot { Id: string; DisplayName: string; FitsType: string; UnlockRequirements: Requirement[] | null }

const caps = (id: string) => tryGet<{ Capabilities: Record<string, unknown> | null }>('Item', id)?.Capabilities ?? {};
export const openableCap = (id: string) => caps(id)[`${NS}Openable`] as OpenableCap | undefined;

/** Open up to `qty` containers (bird nests, geodes...): fixed drops plus one weighted roll each. */
/** Open up to qty of an item; returns what came out, by item id. */
export function open(game: Game, id: string, qty: number): Record<string, number> {
  const cap = openableCap(id);
  const n = Math.min(qty, game.count(id));
  if (!cap || n <= 0) return {};
  const got: Record<string, number> = {};
  game.removeItem(id, n);
  game.collecting = got;
  try {
    for (let i = 0; i < n; i++) {
      for (const d of cap.AlwaysDrops) game.addItem(d.Item, d.Quantity);
      if (cap.DropTable.length) {
        const d = game.rng.weighted(cap.DropTable);
        game.addItem(d.Item, game.rng.intInclusive(d.MinQuantity, d.MaxQuantity));
      }
    }
  } finally {
    game.collecting = null;
  }
  game.state.rng = game.rng.state;
  game.emit();
  return got;
}

export const itemUpgrades = () => all<ItemUpgrade>('ItemUpgrade');

/** Upgrades that use this item as an ingredient. */
export function upgradesFrom(id: string): ItemUpgrade[] {
  return itemUpgrades().filter((u) => u.RootItems.includes(id) || u.Costs.Items.some((c) => c.Item === id));
}

export function upgrade(game: Game, u: ItemUpgrade): string | null {
  if (game.isDemoLocked(u.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(u.Requirements)) return 'Locked';
  const missing = missingIngredients(game, u.Costs);
  if (missing) return missing;
  spendIngredients(game, u.Costs);
  game.addItem(u.UpgradedItem, u.QuantityPerUpgrade);
  game.emit();
  return null;
}

// ---- toolbelt ---------------------------------------------------------------------------------

export const toolbeltSlotsFor = (entity: string) => configList(entity, 'ToolbeltSlots').map((id) => get<ToolbeltSlot>('ToolbeltSlot', id));

export function toolbeltItem(game: Game, slot: string) {
  return game.state.toolbelt[slot];
}

/** Bank items that fit a toolbelt slot. */
export function fitsToolbelt(game: Game, slot: ToolbeltSlot): string[] {
  return Object.keys(game.state.bank).filter((i) => toolbeltCap(i)?.FitsInSlot === slot.FitsType);
}

export function equipTool(game: Game, slotId: string, itemId: string): string | null {
  const slot = get<ToolbeltSlot>('ToolbeltSlot', slotId);
  const cap = toolbeltCap(itemId);
  if (!cap || cap.FitsInSlot !== slot.FitsType) return "Doesn't fit this slot";
  if (!game.requirementsMet(slot.UnlockRequirements)) return 'Slot locked';
  if (!game.requirementsMet(cap.Requirements as Requirement[] | null)) return 'Level too low';
  unequipTool(game, slotId);
  const qty = cap.CanEquipQuantity ? game.count(itemId) : 1;
  if (!game.removeItem(itemId, qty)) return 'You have none';
  game.state.toolbelt[slotId] = { item: itemId, qty };
  game.bonusesChanged();
  game.emit();
  return null;
}

export function unequipTool(game: Game, slotId: string): void {
  const t = game.state.toolbelt[slotId];
  if (!t) return;
  delete game.state.toolbelt[slotId];
  game.addItem(t.item, t.qty);
  game.bonusesChanged();
  game.emit();
}
