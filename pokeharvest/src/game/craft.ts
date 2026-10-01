/** Crafting machines, cooking, eating, and Rare Candy. */
import { RECIPES } from '../data/crafting';
import { item } from '../data/items';
import { giveItem, takeItem } from './farm';
import { gainXp, xpForLevel } from './mon';
import { hasPerk, monByUid, type World } from './model';
import { addSkillXp, levelOf } from './skills';

export function craftBlocker(world: World, id: string): string | null {
  const recipe = RECIPES.find((r) => r.id === id);
  if (!recipe) return 'No such recipe.';
  if (levelOf(world, 'crafting') < recipe.level) return `Needs Crafting level ${recipe.level}.`;
  if (recipe.kitchen && world.map !== 'farm') return 'Cook at home, in the farmhouse kitchen.';
  for (const [input, n] of Object.entries(recipe.inputs)) {
    if ((world.inventory[input] ?? 0) < n) return `Needs ${n} ${item(input).name}.`;
  }
  return null;
}

export function craft(world: World, id: string): boolean {
  if (craftBlocker(world, id)) return false;
  const recipe = RECIPES.find((r) => r.id === id)!;
  for (const [input, n] of Object.entries(recipe.inputs)) takeItem(world, input, n);
  giveItem(world, id, 1);
  addSkillXp(world, 'crafting', 5 + recipe.level * 2);
  return true;
}

/** Eat a dish: energy back (double with Master Chef), and its buff for the rest of the day. */
export function eat(world: World, id: string): boolean {
  const def = item(id);
  if (def.kind !== 'food' || !takeItem(world, id, 1)) return false;
  const p = world.player;
  p.energy = Math.min(p.maxEnergy, p.energy + (def.energy ?? 0) * (hasPerk(world, 'master-chef') ? 2 : 1));
  if (def.buff && !world.buffs.includes(def.buff)) world.buffs.push(def.buff);
  return true;
}

/** A Rare Candy: straight to the next level. Returns what happened, as lines to show. */
export function giveCandy(world: World, uid: number): string[] {
  const mon = monByUid(world, uid);
  if (!mon || mon.level >= 100 || !takeItem(world, 'rare-candy', 1)) return [];
  return gainXp(mon, xpForLevel(mon.level + 1) - mon.xp);
}
