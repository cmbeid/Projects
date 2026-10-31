// The shop: one-off upgrades and unlocks bought with gold and items.
import { NS, all, tryGet, type Ingredients, type ItemQuantity, type Requirement } from './content';
import type { Game } from './game';
import { missingIngredients, spendIngredients } from './skills/common';

export interface ModifierEntry { Stat: { StatsType: string; Name: string }; Value: number; LocalContext?: Record<string, unknown> | null }

export interface ShopPurchase {
  Id: string;
  DisplayName: string;
  Description: string | null;
  Subcategory: string;
  DefaultBuyLimit: number;
  Requirements: Requirement[] | null;
  DisplayRequirements: Requirement[] | null;
  Costs: Ingredients | null;
  AllowBulkPurchase?: boolean;
  Provides: {
    Items: ItemQuantity[];
    Currencies: { Currency: string; Quantity: number }[];
    Bonuses: { Global: ModifierEntry[]; Component: ModifierEntry[] } | null;
  };
}

export const shopPurchases = () => all<ShopPurchase>('ShopPurchase');

export function purchased(game: Game, id: string): number {
  return game.state.purchases[id] ?? 0;
}

/** Legacy tool upgrades the game refunds on load (ShopComponent.ProcessToolRefunds); tools are toolbelt items now. */
const LEGACY_TOOLS = /^(Copper|Iron|Steel|Mithril|Adamant|Rune|Dawnsteel|Dragon)(Axe|Pickaxe|FishingRod)$/;

/** Hidden when the demo hides it (e.g. alpha-only purchases) or it's a refunded legacy tool. */
export function shopVisible(game: Game, p: ShopPurchase): boolean {
  // The demo has no bonfires, so the bonfire unlock would do nothing.
  if (p.Id === 'UnlockBonfire' && !all('FiremakingBonfire').length) return false;
  if (LEGACY_TOOLS.test(p.Id) || game.isDemoLocked(p.DisplayRequirements) || game.isDemoLocked(p.Requirements)) return false;
  // Purchases (and their category) stay hidden until their display requirements are met, e.g. a finished quest.
  const sub = tryGet<{ Category: string }>('ShopSubcategory', p.Subcategory);
  const cat = sub && tryGet<{ DisplayRequirements: Requirement[] | null }>('ShopCategory', sub.Category);
  return game.requirementsMet(p.DisplayRequirements) && game.requirementsMet(cat?.DisplayRequirements);
}

export function buyBlockReason(game: Game, p: ShopPurchase): string | null {
  const id = NS + p.Id;
  if (p.DefaultBuyLimit > 0 && purchased(game, id) >= p.DefaultBuyLimit) return 'Owned';
  if (!game.requirementsMet(p.Requirements)) return 'Locked';
  return p.Costs ? missingIngredients(game, p.Costs) : null;
}

/** How many of a purchase you could buy right now (up to its buy limit and what you can afford). */
export function maxBuyable(game: Game, p: ShopPurchase): number {
  let n = p.DefaultBuyLimit > 0 ? p.DefaultBuyLimit - purchased(game, NS + p.Id) : Infinity;
  for (const c of p.Costs?.Items ?? []) if (c.Quantity > 0) n = Math.min(n, Math.floor(game.count(c.Item) / c.Quantity));
  for (const c of p.Costs?.Currencies ?? []) if (c.Quantity > 0) n = Math.min(n, Math.floor(game.currency(c.Currency) / c.Quantity));
  return Number.isFinite(n) ? Math.max(0, n) : 1e6;
}

/** Buy a purchase, `qty` times for bulk purchases (AllowBulkPurchase), stopping when one can't be bought. */
export function buy(game: Game, p: ShopPurchase, qty = 1): string | null {
  const reason = buyBlockReason(game, p);
  if (reason) return reason;
  const times = p.AllowBulkPurchase ? Math.max(1, Math.floor(qty)) : 1;
  const id = NS + p.Id;
  for (let i = 0; i < times && !buyBlockReason(game, p); i++) {
    if (p.Costs) spendIngredients(game, p.Costs);
    game.state.purchases[id] = purchased(game, id) + 1;
    game.stat('ShopPurchasesMade');
    for (const it of p.Provides.Items) game.addItem(it.Item, it.Quantity);
    for (const c of p.Provides.Currencies) game.addCurrency(c.Currency, c.Quantity);
  }
  game.bonusesChanged();
  game.emit();
  return null;
}
