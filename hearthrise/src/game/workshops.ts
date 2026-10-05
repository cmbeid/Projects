import { REGALIA_BASE } from '../data/regalia';
import { CRAFT_BY_ID, REFINE_BY_ID } from '../data/recipes';
import type { CraftRecipe, RefineRecipe } from '../data/types';
import type { GameState } from '../state/types';
import { derive } from './derive';
import { hasInputs, take } from './economy';
import { emit } from './events';
import { hasFeature } from './features';
import { equip, regaliaScore, rollRegalia } from './founder';
import { meetsRequirement } from './requirements';

export function workshopSlots(s: GameState): number {
  return derive(s).city.slots;
}

export function refineSeconds(s: GameState, r: RefineRecipe): number {
  return r.seconds / derive(s).refineSpeed;
}

export function queueRefine(s: GameState, slot: number, recipeId: string, batches: number): boolean {
  const r = REFINE_BY_ID.get(recipeId);
  const f = s.workshops[slot];
  if (!r || !f || !hasFeature(s, 'workshops') || slot >= workshopSlots(s) || !meetsRequirement(s, r.requires)) return false;
  if (batches < 1) return false;
  if (f.recipe !== recipeId) {
    clearSlot(s, slot);
    f.recipe = recipeId;
  }
  f.queued += Math.floor(batches);
  return true;
}

export function clearSlot(s: GameState, slot: number): void {
  const f = s.workshops[slot];
  if (!f) return;
  const r = f.recipe ? REFINE_BY_ID.get(f.recipe) : undefined;
  // A batch already on the bench has had its salvage taken; give it back.
  if (r && f.progress >= 0) for (const x of r.inputs) s.inventory[x.id] = (s.inventory[x.id] ?? 0) + x.n;
  f.recipe = null;
  f.progress = -1;
  f.queued = 0;
}

/** How many batches the stores could feed right now. */
export function batchesAffordable(s: GameState, r: RefineRecipe): number {
  return Math.min(...r.inputs.map((x) => Math.floor((s.inventory[x.id] ?? 0) / x.n)));
}

/**
 * Advances every workshop. A slot takes its salvage when a batch starts, and
 * sits idle (queue intact) whenever the salvage runs out. Slots past the
 * city's count (a workshop pulled down) keep their queue but do not run.
 */
export function tickWorkshops(s: GameState, dt: number): void {
  const speed = derive(s).refineSpeed;
  const slots = workshopSlots(s);
  for (let i = 0; i < slots; i++) {
    const f = s.workshops[i];
    if (!f) continue;
    const r = f.recipe ? REFINE_BY_ID.get(f.recipe) : undefined;
    if (!r) continue;
    let time = dt;
    const per = r.seconds / speed;
    for (let guard = 0; guard < 10_000 && time > 0 && f.queued > 0; guard++) {
      if (f.progress < 0) {
        if (!hasInputs(s, r.inputs)) break;
        take(s, r.inputs);
        f.progress = 0;
      }
      const need = per - f.progress;
      if (time < need) {
        f.progress += time;
        time = 0;
      } else {
        time -= need;
        f.progress = -1;
        f.queued -= 1;
        s.inventory[r.output] = (s.inventory[r.output] ?? 0) + 1;
        s.counters.refined += 1;
        s.counters.refinedBy[r.output] = (s.counters.refinedBy[r.output] ?? 0) + 1;
        emit({ type: 'refine', good: r.output });
      }
    }
  }
}

export function canCraft(s: GameState, r: CraftRecipe): boolean {
  if (!hasFeature(s, 'drafting') || !meetsRequirement(s, r.requires)) return false;
  if (r.output.kind === 'fixture' && s.fixtures.includes(r.output.id)) return false;
  return s.coins >= r.coins && hasInputs(s, r.inputs);
}

export function craft(s: GameState, recipeId: string): boolean {
  const r = CRAFT_BY_ID.get(recipeId);
  if (!r || !canCraft(s, r)) return false;
  s.coins -= r.coins;
  take(s, r.inputs);
  s.counters.crafted += 1;
  s.counters.craftedBy[r.id] = (s.counters.craftedBy[r.id] ?? 0) + 1;
  const out = r.output;
  let name = '';
  if (out.kind === 'regalia') {
    const item = rollRegalia(s, out.base);
    s.regalia.push(item);
    const base = REGALIA_BASE.get(out.base)!;
    name = base.name;
    // Wear it straight away when it beats what is on, which it usually does.
    const current = s.regalia.find((g) => g.uid === s.equipped[base.slot]);
    if (!current || regaliaScore(item) > regaliaScore(current)) equip(s, item.uid);
  } else if (out.kind === 'consumable') {
    s.consumables[out.id] = (s.consumables[out.id] ?? 0) + out.n;
    name = out.id;
  } else {
    s.fixtures.push(out.id);
    name = out.id;
  }
  emit({ type: 'craft', name });
  return true;
}
