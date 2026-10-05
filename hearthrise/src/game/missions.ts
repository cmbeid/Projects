import { BUILDING } from '../data/buildings';
import { districtAt } from '../data/districts';
import { STORY, STORY_BY_ID } from '../data/missions';
import { MATERIAL } from '../data/materials';
import { EDICTS, UPGRADES } from '../data/progression';
import { FIXTURES } from '../data/recipes';
import type { Goal, Mission, Reward } from '../data/types';
import type { GameState, Petition } from '../state/types';
import { addXp, gain, ruinValue, xpAt, yieldAt } from './clearing';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature, unlockFeature } from './features';
import { typeLevels } from './grid';
import { storyIndex } from './requirements';
import { hashString } from './rng';

export { storyIndex };

/** Goals measured from where the counter stood when the mission began, rather than absolutely. */
function isDelta(goal: Goal): boolean {
  switch (goal.kind) {
    case 'clears':
    case 'salvage':
    case 'relics':
    case 'earn':
    case 'refine':
    case 'edict':
    case 'stats':
    case 'farm':
    case 'placed':
      return true;
    case 'craft':
      return goal.recipe === undefined;
    default:
      return false;
  }
}

/** The raw number a goal is judged on. */
export function goalValue(s: GameState, goal: Goal): number {
  const c = s.counters;
  switch (goal.kind) {
    case 'ward': return s.furthestEver;
    case 'level': return s.level;
    case 'clears': return c.clears;
    case 'salvage': return c.salvaged[goal.id] ?? 0;
    case 'relics': return c.relics;
    case 'earn': return c.earned;
    case 'upgrade': return s.upgrades[goal.id] ?? 0;
    case 'build': return typeLevels(s, goal.id);
    case 'placed': return c.placed;
    case 'pop': return Math.floor(derive(s).city.pop);
    case 'happy': return Math.floor(derive(s).city.happiness * 100 + 1e-6);
    case 'refine': return goal.good ? (c.refinedBy[goal.good] ?? 0) : c.refined;
    case 'craft': return goal.recipe ? (c.craftedBy[goal.recipe] ?? 0) : c.crafted;
    case 'edict': return goal.edict ? (c.edicts[goal.edict] ?? 0) : Object.values(c.edicts).reduce((a, b) => a + b, 0);
    case 'stats': return c.statsSpent;
    case 'fixture': return s.fixtures.includes(goal.id) ? 1 : 0;
    case 'tide': return c.tides;
    case 'farm': return c.farmed;
    case 'memories': return s.memoriesEarned;
    // Latched in `tick` when the player stands there; see `progress`.
    case 'visit': return 0;
  }
}

export function goalNeed(goal: Goal): number {
  return goal.kind === 'fixture' || goal.kind === 'visit' ? 1 : goal.n;
}

export function progress(s: GameState, goal: Goal, base: number): { have: number; need: number; done: boolean } {
  if (goal.kind === 'visit') {
    const have = base >= 1 || s.ward === goal.ward ? 1 : 0;
    return { have, need: 1, done: have === 1 };
  }
  const value = goalValue(s, goal);
  const have = isDelta(goal) ? value - base : value;
  const need = goalNeed(goal);
  return { have: Math.min(have, need), need, done: have >= need };
}

export function goalBase(s: GameState, goal: Goal): number {
  return isDelta(goal) ? goalValue(s, goal) : 0;
}

export function describeGoal(goal: Goal): string {
  const n = (x: number): string => x.toLocaleString('en-US');
  switch (goal.kind) {
    case 'ward': return `Open ward ${goal.n}`;
    case 'level': return `Reach level ${goal.n}`;
    case 'clears': return `Clear ${n(goal.n)} ruins`;
    case 'salvage': return `Salvage ${n(goal.n)} ${MATERIAL.get(goal.id)?.name ?? goal.id}`;
    case 'relics': return `Find ${n(goal.n)} relics`;
    case 'earn': return `Earn ${n(Math.round(goal.n))} coin`;
    case 'upgrade': return `Raise ${UPGRADES.find((u) => u.id === goal.id)?.name ?? goal.id} to level ${goal.n}`;
    case 'build': {
      const name = BUILDING.get(goal.id)?.name ?? goal.id;
      return goal.n === 1 ? `Build a ${name}` : `${name}: ${goal.n} levels in all`;
    }
    case 'placed': return `Place ${n(goal.n)} buildings`;
    case 'pop': return `Reach ${n(goal.n)} citizens`;
    case 'happy': return `Raise happiness to ${goal.n}%`;
    case 'refine': return goal.good ? `Make ${n(goal.n)} ${MATERIAL.get(goal.good)?.name ?? goal.good}` : `Make ${n(goal.n)} goods`;
    case 'craft': return goal.recipe ? `Make: ${goal.recipe.replace(/^c-/, '').replace(/-/g, ' ')}` : `Make ${goal.n} things at the Drafting Hall`;
    case 'edict': return `Proclaim ${goal.edict ? EDICTS.find((k) => k.id === goal.edict)?.name : 'edicts'} ${goal.n}×`;
    case 'stats': return `Spend ${goal.n} stat points`;
    case 'fixture': return `Build: ${FIXTURES.find((f) => f.id === goal.id)?.name ?? goal.id}`;
    case 'tide': return goal.n === 1 ? 'Let the Tide come in' : `Let the Tide come in ${goal.n}×`;
    case 'visit': return goal.ward === 1 ? 'Go back to the beach (ward 1)' : `Go to ward ${goal.ward}`;
    case 'farm': return `Clear ${n(goal.n)} ruins with the landmark held back`;
    case 'memories': return `Earn ${n(goal.n)} Memories in all`;
  }
}

export function activeStory(s: GameState): Mission | null {
  return s.story.id ? (STORY_BY_ID.get(s.story.id) ?? null) : null;
}

function grant(s: GameState, reward: Reward & { memories?: number }): void {
  if (reward.coins) s.coins += reward.coins;
  if (reward.xp) addXp(s, reward.xp);
  for (const f of reward.unlock ?? []) unlockFeature(s, f);
  for (const it of reward.items ?? []) gain(s, it.id, it.n);
  for (const c of reward.consumables ?? []) s.consumables[c.id] = (s.consumables[c.id] ?? 0) + c.n;
  if (reward.flag && !s.flags.includes(reward.flag)) s.flags.push(reward.flag);
  if (reward.memories) {
    s.memories += reward.memories;
    s.memoriesEarned += reward.memories;
  }
}

export function startStory(s: GameState): void {
  const m = activeStory(s);
  s.story.base = m ? goalBase(s, m.goal) : 0;
}

/** The scene a mission plays on being claimed, given the flags held then. */
export function sceneFor(s: GameState, m: Mission): readonly string[] | null {
  for (const v of m.sceneIf ?? []) if (s.flags.includes(v.flag)) return v.scene;
  return m.scene ?? null;
}

/**
 * Claims the active mission. One with a choice needs `option`, the index of
 * the option taken; its flag is set and its scene plays.
 */
export function claimStory(s: GameState, option?: number): boolean {
  const m = activeStory(s);
  if (!m || !progress(s, m.goal, s.story.base).done) return false;
  const picked = m.choice ? m.choice.options[option ?? -1] : undefined;
  if (m.choice && !picked) return false;
  grant(s, m.reward);
  if (picked && !s.flags.includes(picked.flag)) s.flags.push(picked.flag);
  const scene = picked ? picked.scene : sceneFor(s, m);
  const next = STORY[storyIndex(s) + 1];
  s.story.id = next ? next.id : null;
  startStory(s);
  emit({ type: 'claim', title: m.title });
  if (scene) emit({ type: 'scene', title: m.title, paragraphs: scene });
  return true;
}

// --- Petitions ---------------------------------------------------------------

/** Local calendar day, which is when the petitions turn over. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Three petitions from the citizens for the day, sized to the furthest ward
 * reached. Seeded by the date, so the board is fixed for the day and
 * reloading does not reroll it.
 */
export function makePetitions(s: GameState, day: string): Petition[] {
  let seed = hashString(`${day}:${s.furthestEver}`);
  const next = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ward = Math.max(1, s.furthestEver - 2);
  const d = derive(s);
  const perRuin = Math.max(1, ruinValue(ward, d));
  const district = districtAt(ward);
  const kinds: Goal['kind'][] = ['clears', 'salvage', 'relics', 'earn', 'refine', 'craft', 'edict', 'placed'];
  const out: Petition[] = [];
  while (out.length < 3 && kinds.length) {
    const kind = kinds.splice(Math.floor(next() * kinds.length), 1)[0]!;
    let goal: Goal;
    let title: string;
    switch (kind) {
      case 'clears': goal = { kind, n: 150 + Math.round(next() * 10) * 25 }; title = 'Clear the Way'; break;
      case 'salvage': {
        const id = district.salvage[Math.floor(next() * 2)]!.id;
        goal = { kind, id, n: Math.ceil((yieldAt(ward) * d.salvageMult * 60) / 10) * 10 };
        title = `Wanted: ${MATERIAL.get(id)?.name}`;
        break;
      }
      case 'relics': goal = { kind, n: 4 + Math.floor(next() * 4) }; title = 'The Museum Asks'; break;
      case 'earn': goal = { kind, n: Math.ceil(perRuin * 250) }; title = 'Balance the Books'; break;
      case 'refine': goal = { kind, n: 15 + Math.floor(next() * 3) * 5 }; title = 'Workshop Orders'; break;
      case 'craft': goal = { kind, n: 3 }; title = 'Drafting Orders'; break;
      case 'placed': goal = { kind, n: 2 }; title = 'Room to Grow'; break;
      default: goal = { kind: 'edict', n: 8 }; title = 'Speeches'; break;
    }
    if ((kind === 'refine' && !hasFeature(s, 'workshops')) || (kind === 'craft' && !hasFeature(s, 'drafting')) ||
      (kind === 'edict' && !hasFeature(s, 'rush'))) continue;
    const reward: Petition['reward'] = {
      coins: Math.ceil(perRuin * 300),
      xp: Math.ceil(xpAt(ward) * 60),
    };
    if (hasFeature(s, 'tide')) reward.memories = 1 + Math.floor(next() * 2);
    out.push({ id: `${day}-${out.length}`, title, goal, reward, base: goalBase(s, goal), claimed: false });
  }
  return out;
}

/** Posts a fresh set when the day has turned. */
export function refreshPetitions(s: GameState, now: number): void {
  if (!hasFeature(s, 'petitions')) return;
  const day = dayKey(now);
  if (s.petitions.day === day) return;
  s.petitions = { day, list: makePetitions(s, day) };
}

export function claimPetition(s: GameState, id: string): boolean {
  const c = s.petitions.list.find((x) => x.id === id);
  if (!c || c.claimed || !progress(s, c.goal, c.base).done) return false;
  c.claimed = true;
  grant(s, c.reward);
  emit({ type: 'claim', title: c.title });
  return true;
}
