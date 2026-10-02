/**
 * Potions and Revives: one Pokémon at a time, in battle or from the Bag.
 * Berries heal too, but they're food first (see `game/battle.ts`).
 */
import { ITEMS, item } from '../data/items';
import { reputationLevel } from '../data/ranch';
import { species } from '../data/species';
import { hasFlag } from './story';
import { takeItem } from './farm';
import { maxHp } from './mon';
import type { Mon, World } from './model';

export function isMedicine(id: string): boolean {
  return ITEMS.get(id)?.kind === 'medicine';
}

/** Why `id` would do nothing for this Pokémon, or null if it would help. */
export function medicineBlocker(id: string, mon: Mon): string | null {
  const def = ITEMS.get(id);
  if (!def || def.kind !== 'medicine') return "That isn't medicine.";
  const name = species(mon.dex).name;
  if (def.revive) return mon.hp > 0 ? `${name} hasn't fainted.` : null;
  if (mon.hp <= 0) return `${name} has fainted. Only a Revive will help.`;
  return mon.hp >= maxHp(mon) ? `${name}'s HP is already full.` : null;
}

/** Use `id` on `mon`: takes it from the bag. Returns the line to show, or null if it wouldn't help (nothing is used). */
export function useMedicine(world: World, id: string, mon: Mon): string | null {
  if (medicineBlocker(id, mon) || !takeItem(world, id, 1)) return null;
  const def = item(id);
  const max = maxHp(mon);
  const name = species(mon.dex).name;
  if (def.revive) {
    mon.hp = Math.max(1, Math.floor(max * def.revive));
    return `${name} was revived!`;
  }
  const before = mon.hp;
  mon.hp = Math.min(max, mon.hp + def.heals!);
  return `${name} recovered ${mon.hp - before} HP!`;
}

/** Medicine in the bag, weakest first. */
function owned(world: World): string[] {
  return MEDICINE.filter((id) => (world.inventory[id] ?? 0) > 0);
}

/**
 * The medicine to reach for: a Revive for a fainted Pokémon, otherwise the
 * weakest potion that heals all it's missing (or the strongest you have).
 */
export function bestMedicine(world: World, mon: Mon): string | null {
  const have = owned(world).filter((id) => !medicineBlocker(id, mon));
  if (!have.length) return null;
  const missing = maxHp(mon) - mon.hp;
  return have.find((id) => (item(id).heals ?? 0) >= missing) ?? have[have.length - 1]!;
}

/** Every medicine, weakest first. */
export const MEDICINE: readonly string[] = ['potion', 'super-potion', 'hyper-potion', 'max-potion', 'revive'];

/** What the Pokémon Center's counter sells: more as the town comes back to life and your name gets around. */
export function centerStock(world: World): string[] {
  if (!hasFlag(world, 'center-open')) return [];
  const rep = reputationLevel(world.reputation);
  return ['super-potion', 'revive', ...(rep >= 3 ? ['hyper-potion'] : []), ...(rep >= 4 ? ['max-potion'] : [])];
}

/** The reputation level each Center item needs, for the counter's hints. */
export const CENTER_LOCKS: Record<string, number> = { 'hyper-potion': 3, 'max-potion': 4 };
