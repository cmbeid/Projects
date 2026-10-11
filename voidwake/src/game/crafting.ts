import { AFFIXES, GEAR, GEAR_DEF, RARITIES } from '../data/gear';
import { CONSUMABLE } from '../data/materials';
import { MODULE } from '../data/modules';
import { RECIPE, RECIPES } from '../data/recipes';
import type { Bundle, MatId, ModuleId, RecipeDef } from '../data/types';
import type { GameState, GearInst } from '../state/types';
import { derive } from './derive';
import { addLog } from './log';
import { pick, pickWeighted, type Rng } from './rng';

export function hasMats(s: GameState, b: Bundle): boolean {
  return (Object.entries(b) as [MatId, number][]).every(([k, n]) => s.mats[k] >= n);
}

export function payMats(s: GameState, b: Bundle): void {
  for (const [k, n] of Object.entries(b) as [MatId, number][]) s.mats[k] = Math.max(0, s.mats[k] - n);
}

export function gainMats(s: GameState, b: Bundle): void {
  for (const [k, n] of Object.entries(b) as [MatId, number][]) s.mats[k] = Math.max(0, s.mats[k] + n);
}

// ---------------------------------------------------------------- Gear

export function rollRarity(r: Rng, sector: number, floor = 0): number {
  const w = [Math.max(10, 60 - sector * 8), 28 + sector * 2, 9 + sector * 3, 2 + sector * 2];
  for (let i = 0; i < floor; i++) w[i] = 0;
  return pickWeighted(r, [0, 1, 2, 3], (i) => w[i]!);
}

export function makeGear(s: GameState, r: Rng, base: string, rarity: number): GearInst {
  const def = GEAR_DEF.get(base)!;
  const pool = AFFIXES.filter((a) => a.slots.includes(def.slot));
  const affixes: GearInst['affixes'] = [];
  const n = RARITIES[rarity]!.affixes;
  for (let i = 0; i < n && pool.length; i++) {
    const a = pick(r, pool.filter((p) => !affixes.some((x) => x.id === p.id)));
    if (!a) break;
    const v = (a.min + (a.max - a.min) * r()) * def.tier;
    affixes.push({ id: a.id, v: Math.round(v * 100) / 100 });
  }
  const g: GearInst = { uid: s.nextId++, base, rarity, affixes };
  return g;
}

/** A random drop suited to the sector: mostly its own tier, sometimes the one before or after. */
export function randomGear(s: GameState, r: Rng, sector: number, floor = 0): GearInst {
  const tier = Math.max(1, Math.min(6, sector + 1 + (r() < 0.2 ? -1 : r() < 0.15 ? 1 : 0)));
  const options = GEAR.filter((g) => g.tier === tier);
  const base = pick(r, options.length ? options : GEAR);
  return makeGear(s, r, base.id, rollRarity(r, sector, floor));
}

// ---------------------------------------------------------------- Recipes

export function recipeVisible(s: GameState, r: RecipeDef): boolean {
  return !r.flag || s.story.flags.includes(r.flag);
}

export function canCraft(s: GameState, id: string): boolean {
  const r = RECIPE.get(id);
  if (!r || !recipeVisible(s, r)) return false;
  return derive(s).fab >= r.fab && hasMats(s, r.cost);
}

export function craft(s: GameState, r: Rng, id: string): string | null {
  if (!canCraft(s, id)) return null;
  const rec = RECIPE.get(id)!;
  payMats(s, rec.cost);
  s.stats.crafted++;
  const out = rec.out;
  if ('mat' in out) {
    s.mats[out.mat] += out.n;
    return `${rec.name}: +${out.n}`;
  }
  if ('item' in out) {
    s.items[out.item] += out.n;
    return `+${out.n} ${CONSUMABLE.get(out.item)!.name}`;
  }
  const g = makeGear(s, r, out.gear, rollRarity(r, s.sector.index));
  s.gear.push(g);
  addLog(s, `Fabricated ${RARITIES[g.rarity]!.name.toLowerCase()} ${GEAR_DEF.get(g.base)!.name}.`, 'ship');
  return `${RARITIES[g.rarity]!.name} ${GEAR_DEF.get(g.base)!.name}`;
}

export function visibleRecipes(s: GameState): RecipeDef[] {
  return RECIPES.filter((r) => recipeVisible(s, r));
}

/** Scrap a piece of gear for some of what it cost. */
export function scrapGear(s: GameState, uid: number): Bundle | null {
  const i = s.gear.findIndex((g) => g.uid === uid);
  if (i < 0) return null;
  if (s.crew.some((c) => Object.values(c.gear).includes(uid))) return null;
  const g = s.gear[i]!;
  const tier = GEAR_DEF.get(g.base)?.tier ?? 1;
  const back: Bundle = { alloy: Math.max(1, Math.floor(tier / 2) + g.rarity), crystal: tier };
  if (tier >= 3) back.circuits = Math.floor(tier / 3) + (g.rarity >= 2 ? 1 : 0);
  gainMats(s, back);
  s.gear.splice(i, 1);
  return back;
}

// ---------------------------------------------------------------- Ship modules

export function nextTier(s: GameState, id: ModuleId): { cost: Bundle; credits: number; name: string; desc: string } | null {
  const def = MODULE.get(id)!;
  const t = s.modules[id];
  return def.tiers[t] ?? null;
}

export function canUpgrade(s: GameState, id: ModuleId): boolean {
  const n = nextTier(s, id);
  return !!n && hasMats(s, n.cost) && s.res.credits >= n.credits;
}

export function upgrade(s: GameState, id: ModuleId): boolean {
  if (!canUpgrade(s, id)) return false;
  const n = nextTier(s, id)!;
  payMats(s, n.cost);
  s.res.credits -= n.credits;
  s.modules[id]++;
  const d = derive(s);
  // A bigger hold or hull fills the new space with nothing; a bigger hull starts patched.
  if (id === 'plating') s.res.hull = Math.min(d.maxHull, s.res.hull + 10);
  addLog(s, `Installed ${MODULE.get(id)!.name} ${n.name}.`, 'ship');
  return true;
}
