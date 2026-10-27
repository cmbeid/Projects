// Equipment loadouts, as on the desktop (LoadoutComponent): each slot remembers your gear, attack stance, spell,
// prayers, selected food and combat toolbelt. Switching stores the current set in its slot, puts everything back in
// the bank, and equips the other slot's set from the bank (anything no longer there is skipped).
import { NS, all, configList, itemName, type Requirement } from '../content';
import type { Game } from '../game';
import { equip, equipped, unequip } from './combat';
import { equipTool, unequipTool } from '../items';

interface LoadoutSlotData { Id: string; DisplayName: string; UnlockRequirements: Requirement[] | null }

export interface SavedLoadout {
  equipment: Record<string, { item: string; qty: number }>;
  toolbelt: Record<string, string>;
  stance: string;
  spell: string | null;
  prayers: string[];
  food: string | null;
}

export const loadoutSlots = () => all<LoadoutSlotData>('LoadoutSlot');
export const loadoutUnlocked = (game: Game, id: string) => game.requirementsMet(loadoutSlots().find((s) => NS + s.Id === id)?.UnlockRequirements ?? null);
export const currentLoadout = (game: Game) => game.state.loadouts?.current ?? NS + (loadoutSlots()[0]?.Id ?? 'Loadout1');

const combatToolbeltSlots = () => configList('Combat', 'ToolbeltSlots');

function capture(game: Game): SavedLoadout {
  const toolbelt: Record<string, string> = {};
  for (const s of combatToolbeltSlots()) if (game.state.toolbelt[s]) toolbelt[s] = game.state.toolbelt[s].item;
  return {
    equipment: Object.fromEntries(Object.entries(game.state.equipment).map(([k, v]) => [k, { ...v }])),
    toolbelt,
    stance: game.state.combat.stance,
    spell: game.state.combat.spell,
    prayers: [...game.state.combat.prayers],
    food: game.state.selectedFood,
  };
}

/** Switch to another loadout slot. Returns why not, or a note about gear that couldn't be equipped. */
export function swapLoadout(game: Game, to: string): string | null {
  const from = currentLoadout(game);
  if (to === from) return null;
  if (!loadoutUnlocked(game, to)) return 'Locked';
  const lo = (game.state.loadouts ??= { current: from, saved: {} });
  lo.saved[from] = capture(game);
  for (const slot of Object.keys(game.state.equipment)) unequip(game, slot);
  for (const s of combatToolbeltSlots()) unequipTool(game, s);
  const target = lo.saved[to];
  const missing: string[] = [];
  if (target) {
    // Weapons first, so a two-hander doesn't knock an off-hand back off.
    const order = Object.entries(target.equipment).sort(([a], [b]) => (a.endsWith('Weapon') ? -1 : b.endsWith('Weapon') ? 1 : 0));
    for (const [slot, e] of order) {
      if (game.count(e.item) <= 0 || equip(game, e.item) || !equipped(game, slot)) missing.push(itemName(e.item));
    }
    for (const [slot, item] of Object.entries(target.toolbelt)) if (game.count(item) <= 0 || equipTool(game, slot, item)) missing.push(itemName(item));
    game.state.combat.stance = target.stance;
    game.state.combat.spell = target.spell;
    game.state.combat.prayers = target.prayers;
    game.state.selectedFood = target.food;
  } else {
    game.state.combat.prayers = [];
  }
  lo.current = to;
  game.bonusesChanged();
  game.emit();
  return missing.length ? `Not in the bank, so not equipped: ${missing.join(', ')}` : null;
}
