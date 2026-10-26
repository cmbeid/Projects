// Ranching is passive: animals live in enclosures, eat, and produce on a timer.
import { NS, configList, get, type Ingredients, type ItemQuantity, type Requirement } from '../content';
import type { Game } from '../game';
import type { RanchAnimal } from '../state';
import { missingIngredients, spendIngredients } from './common';
import { mod } from '../bonuses';
import { goalMatches, questEvent } from '../quests';

const SKILL = 'Ranching';
const TICKS_PER_MS = 60 / 1000;
/** Animals want petting again this long after being petted. */
export const PET_INTERVAL_MS = 4 * 60 * 60 * 1000;
const PET_XP = 10;

export interface RanchingLand { Id: string; DisplayName: string; Costs: Ingredients; Requirements: Requirement[] | null }
export interface RanchingEnclosure {
  Id: string; DisplayName: string; Animals: string[]; AnimalLimit: number;
  Requirements: Requirement[] | null; Costs: Ingredients; UpgradesTo: string | null;
}
export interface RanchingAnimal {
  Id: string;
  DisplayName: { Singular: string; Plural: string };
  BaseExperience: number;
  PurchaseCosts: Ingredients;
  BaseVariantInterval: number;
  LifespanInterval: number;
  ProductInterval: number;
  BaseVariant: string;
  Variants: { Variant: string; Weight: number }[];
  Products: ItemQuantity[];
  Eats: ItemQuantity[];
  Treats: (ItemQuantity & { Satisfaction: number })[];
  RequiresPets: boolean;
  PackSatisfactionBonuses: { AnimalCount: number; Satisfaction: number }[];
  Requirements: Requirement[] | null;
}
interface Variant { Id: string; DisplayName: string; SelfBonuses: { Stat: { Name: string; StatsType: string }; Value: number }[] | null }

export const land = (id: string) => get<RanchingLand>('RanchingLand', id);
export const enclosure = (id: string) => get<RanchingEnclosure>('RanchingEnclosure', id);
export const ranchAnimal = (id: string) => get<RanchingAnimal>('RanchingAnimal', id);
export const variant = (id: string) => get<Variant>('RanchingAnimalVariant', id);
export const landIds = () => configList(SKILL, 'Land');
export const enclosureIds = () => configList(SKILL, 'Enclosures');
export const animalIds = () => configList(SKILL, 'Animals');

const ticks = (ms: number) => Math.round(ms * TICKS_PER_MS);
const isChild = (a: RanchAnimal) => a.variant === ranchAnimal(a.animal).BaseVariant;

/** Variant penalties/bonuses (children get -50% XP and -50% products). */
function variantBonus(a: RanchAnimal, stat: string): number {
  return (variant(a.variant).SelfBonuses ?? []).filter((b) => b.Stat.Name === stat).reduce((s, b) => s + b.Value, 0);
}

export function animalsIn(game: Game, enc: string): RanchAnimal[] {
  return game.state.ranching.animals.filter((a) => a.enclosure === enc);
}

/** Satisfaction and happiness follow ActiveRanchingAnimal: fed +0.5, safe +0.4, petted +0.04, pack bonuses. */
export function happiness(game: Game, a: RanchAnimal): number {
  const r = ranchAnimal(a.animal);
  const safety = 1; // enclosure maintenance is not modelled; enclosures count as fully maintained
  let satisfaction = (a.hunger >= 0.5 ? 0.5 : 0) + (safety >= 0.5 ? 0.4 : 0);
  if (r.RequiresPets && game.state.tick < a.petDueAt) satisfaction += 0.04;
  const pack = animalsIn(game, a.enclosure).filter((x) => x.animal === a.animal).length;
  for (const b of r.PackSatisfactionBonuses) if (pack >= b.AnimalCount) satisfaction += b.Satisfaction;
  return Math.max(0, a.hunger * 0.3 + (safety >= 0.75 ? 1 : safety) * 0.3 + satisfaction * 0.4);
}

export function buyLand(game: Game, id: string): string | null {
  const l = land(id);
  if (game.state.ranching.land.some((x) => x.land === id)) return 'Owned';
  if (game.isDemoLocked(l.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(l.Requirements)) return 'Level too low';
  const missing = missingIngredients(game, l.Costs);
  if (missing) return missing;
  spendIngredients(game, l.Costs);
  game.state.ranching.land.push({ land: id, enclosure: null });
  game.emit();
  return null;
}

export function build(game: Game, landId: string, encId: string): string | null {
  const slot = game.state.ranching.land.find((x) => x.land === landId);
  const e = enclosure(encId);
  if (!slot) return 'Buy the land first';
  const upgradingFrom = slot.enclosure;
  if (upgradingFrom && enclosure(upgradingFrom).UpgradesTo !== encId) return 'Land already has an enclosure';
  if (game.isDemoLocked(e.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(e.Requirements)) return 'Locked';
  const missing = missingIngredients(game, e.Costs);
  if (missing) return missing;
  spendIngredients(game, e.Costs);
  slot.enclosure = encId;
  for (const a of game.state.ranching.animals) if (a.enclosure === upgradingFrom) a.enclosure = encId;
  game.emit();
  return null;
}

export function buyAnimal(game: Game, encId: string, animalId: string): string | null {
  const e = enclosure(encId);
  const r = ranchAnimal(animalId);
  if (!e.Animals.includes(animalId)) return 'Wrong enclosure';
  if (animalsIn(game, encId).length >= e.AnimalLimit) return 'Enclosure is full';
  if (game.isDemoLocked(r.Requirements)) return 'Not in demo';
  if (!game.requirementsMet(r.Requirements)) return 'Locked';
  const missing = missingIngredients(game, r.PurchaseCosts);
  if (missing) return missing;
  spendIngredients(game, r.PurchaseCosts);
  const now = game.state.tick;
  game.state.ranching.animals.push({
    id: game.state.ranching.nextId++,
    animal: animalId,
    enclosure: encId,
    variant: r.BaseVariant,
    bornAt: now,
    grownAt: now + ticks(r.BaseVariantInterval),
    diesAt: now + ticks(r.LifespanInterval),
    nextProductAt: now + ticks(r.ProductInterval),
    hunger: 1,
    petDueAt: now,
  });
  game.emit();
  return null;
}

export function pet(game: Game, id: number): void {
  const a = game.state.ranching.animals.find((x) => x.id === id);
  if (!a || game.state.tick < a.petDueAt) return;
  a.petDueAt = game.state.tick + ticks(PET_INTERVAL_MS);
  game.addXp(SKILL, PET_XP);
  questEvent(game, 'RanchingPetAnimal', (d) => (goalMatches(d, 'Animal', a.animal) && goalMatches(d, 'Variant', a.variant) ? 1 : 0));
  game.emit();
}

/** Earliest pending animal event (grow up, produce, die). */
export function nextRanchingEvent(game: Game): number | null {
  let next: number | null = null;
  for (const a of game.state.ranching.animals) {
    for (const t of [isChild(a) ? a.grownAt : Infinity, a.nextProductAt, a.diesAt]) {
      if (t !== Infinity && (next == null || t < next)) next = t;
    }
  }
  return next;
}

export function processRanching(game: Game): void {
  game.itemSource = SKILL;
  try {
    processAnimals(game);
  } finally {
    game.itemSource = null;
  }
}

function processAnimals(game: Game): void {
  const now = game.state.tick;
  const st = game.state.ranching;
  for (const a of [...st.animals]) {
    const r = ranchAnimal(a.animal);
    if (isChild(a) && now >= a.grownAt) {
      a.variant = game.rng.weighted(r.Variants).Variant;
      game.notice(`Your ${r.DisplayName.Singular} grew up: ${variant(a.variant).DisplayName}`);
    }
    while (now >= a.nextProductAt && a.nextProductAt < a.diesAt) {
      // Eat first: a fed animal is at full hunger, an unfed one loses 0.1.
      const ctx = { entity: SKILL, animal: a.animal };
      const fed = r.Eats.every((e) => game.count(e.Item) >= e.Quantity);
      if (fed && !game.rng.chance(mod(game, 'RanchingAction', 'FoodPreservationChance', ctx))) for (const e of r.Eats) game.removeItem(e.Item, e.Quantity);
      a.hunger = fed ? 1 : Math.max(0, a.hunger - 0.1);
      const doubled = game.rng.chance(mod(game, 'RanchingAction', 'DoublingChance', ctx)) ? 2 : 1;
      const mult = doubled * happiness(game, a) * (1 + variantBonus(a, 'PercentProductQuantity') + mod(game, 'RanchingAction', 'PercentProductQuantity', ctx));
      for (const p of r.Products) {
        const key = NS + 'carry:' + p.Item;
        const total = (st.carry[key] ?? 0) + p.Quantity * mult;
        const whole = Math.floor(total);
        st.carry[key] = total - whole;
        if (whole > 0) game.addItem(p.Item, whole);
      }
      game.addXp(SKILL, r.BaseExperience * (1 + variantBonus(a, 'PercentXPGained')));
      a.nextProductAt += ticks(r.ProductInterval);
      const alive = (game.state.stats.ranchHoursAlive ??= {});
      alive[a.animal] = (alive[a.animal] ?? 0) + r.ProductInterval / 3_600_000;
    }
    if (now >= a.diesAt) {
      st.animals = st.animals.filter((x) => x !== a);
      game.notice(`Your ${r.DisplayName.Singular} died of old age.`);
    }
  }
}
