import { biomeAt } from '../data/biomes';
import { STORY } from '../data/missions';
import { MATERIAL } from '../data/materials';
import { SKILLS } from '../data/progression';
import type { Goal, Mission, Reward } from '../data/types';
import type { Contract, GameState } from '../state/types';
import { derive } from './derive';
import { emit } from './events';
import { hasFeature, unlockFeature } from './features';
import { addXp, blockValue, gain, xpAt, yieldAt } from './mining';
import { hashString } from './rng';

/** Goals measured from where the counter stood when the mission began, rather than absolutely. */
function isDelta(goal: Goal): boolean {
  switch (goal.kind) {
    case 'breaks':
    case 'mine':
    case 'gems':
    case 'earn':
    case 'refine':
    case 'skill':
    case 'stats':
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
    case 'depth': return s.deepestEver;
    case 'level': return s.level;
    case 'breaks': return c.breaks;
    case 'mine': return c.mined[goal.ore] ?? 0;
    case 'gems': return c.gems;
    case 'earn': return c.earned;
    case 'upgrade': return s.upgrades[goal.id] ?? 0;
    case 'own': return s.machines[goal.id] ?? 0;
    case 'refine': return c.refined;
    case 'craft': return goal.recipe ? (c.craftedBy[goal.recipe] ?? 0) : c.crafted;
    case 'skill': return goal.skill ? (c.skills[goal.skill] ?? 0) : Object.values(c.skills).reduce((a, b) => a + b, 0);
    case 'stats': return c.statsSpent;
    case 'fixture': return s.fixtures.includes(goal.id) ? 1 : 0;
    case 'descend': return c.descents;
  }
}

export function goalNeed(goal: Goal): number {
  return goal.kind === 'fixture' ? 1 : goal.n;
}

export function progress(s: GameState, goal: Goal, base: number): { have: number; need: number; done: boolean } {
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
    case 'depth': return `Reach depth ${goal.n}`;
    case 'level': return `Reach level ${goal.n}`;
    case 'breaks': return `Break ${n(goal.n)} blocks`;
    case 'mine': return `Mine ${n(goal.n)} ${MATERIAL.get(goal.ore)?.name ?? goal.ore}`;
    case 'gems': return `Find ${n(goal.n)} gems`;
    case 'earn': return `Earn ${n(Math.round(goal.n))} coin`;
    case 'upgrade': return `Raise ${goal.id === 'sharpen' ? 'Sharpened Pick' : goal.id} to level ${goal.n}`;
    case 'own': return `Own ${goal.n} ${goal.id === 'drone' ? 'drones' : goal.id === 'rig' ? 'drill rigs' : 'excavators'}`;
    case 'refine': return `Smelt ${n(goal.n)} bars`;
    case 'craft': return goal.recipe ? `Craft: ${goal.recipe.replace(/^c-/, '').replace(/-/g, ' ')}` : `Craft ${goal.n} items`;
    case 'skill': return `Use ${goal.skill ? SKILLS.find((k) => k.id === goal.skill)?.name : 'skills'} ${goal.n}×`;
    case 'stats': return `Spend ${goal.n} stat points`;
    case 'fixture': return `Build: ${goal.id}`;
    case 'descend': return `Descend ${goal.n}×`;
  }
}

export function activeStory(s: GameState): Mission | null {
  return STORY[s.story.index] ?? null;
}

function grant(s: GameState, reward: Reward & { echoes?: number }): void {
  if (reward.coins) {
    s.coins += reward.coins;
  }
  if (reward.xp) addXp(s, reward.xp);
  for (const f of reward.unlock ?? []) unlockFeature(s, f);
  for (const it of reward.items ?? []) gain(s, it.id, it.n);
  for (const c of reward.consumables ?? []) s.consumables[c.id] = (s.consumables[c.id] ?? 0) + c.n;
  if (reward.echoes) {
    s.echoes += reward.echoes;
    s.echoesEarned += reward.echoes;
  }
}

export function startStory(s: GameState): void {
  const m = activeStory(s);
  s.story.base = m ? goalBase(s, m.goal) : 0;
}

export function claimStory(s: GameState): boolean {
  const m = activeStory(s);
  if (!m || !progress(s, m.goal, s.story.base).done) return false;
  grant(s, m.reward);
  s.story.index += 1;
  startStory(s);
  emit({ type: 'claim', title: m.title });
  return true;
}

// --- Contracts -------------------------------------------------------------

/** Local calendar day, which is when the contract board turns over. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Three contracts for the day, sized to the deepest depth reached so far.
 * Seeded by the date, so the board is fixed for the day and reloading does
 * not reroll it.
 */
export function makeContracts(s: GameState, day: string): Contract[] {
  let seed = hashString(`${day}:${s.deepestEver}`);
  const next = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const depth = Math.max(1, s.deepestEver - 2);
  const d = derive(s);
  const perBlock = Math.max(1, blockValue(depth, d));
  const biome = biomeAt(depth);
  const kinds: Goal['kind'][] = ['breaks', 'mine', 'gems', 'earn', 'refine', 'craft', 'skill'];
  const out: Contract[] = [];
  while (out.length < 3) {
    const kind = kinds.splice(Math.floor(next() * kinds.length), 1)[0]!;
    let goal: Goal;
    let title: string;
    switch (kind) {
      case 'breaks': goal = { kind, n: 150 + Math.round(next() * 10) * 25 }; title = 'Clear the Face'; break;
      case 'mine': {
        const ore = biome.ores[Math.floor(next() * 2)]!.id;
        goal = { kind, ore, n: Math.ceil((yieldAt(depth) * d.oreMult * 60) / 10) * 10 };
        title = `Order: ${MATERIAL.get(ore)?.name}`;
        break;
      }
      case 'gems': goal = { kind, n: 4 + Math.floor(next() * 4) }; title = 'Glitter Run'; break;
      case 'earn': goal = { kind, n: Math.ceil(perBlock * 250) }; title = 'Turn a Profit'; break;
      case 'refine': goal = { kind, n: 15 + Math.floor(next() * 3) * 5 }; title = 'Furnace Shift'; break;
      case 'craft': goal = { kind, n: 3 }; title = 'Workbench Orders'; break;
      default: goal = { kind: 'skill', n: 8 }; title = 'Practice'; break;
    }
    if ((kind === 'refine' && !hasFeature(s, 'refinery')) || (kind === 'craft' && !hasFeature(s, 'workbench')) ||
      (kind === 'skill' && !hasFeature(s, 'power'))) continue;
    const reward: Contract['reward'] = {
      coins: Math.ceil(perBlock * 300),
      xp: Math.ceil(xpAt(depth) * 60),
    };
    if (hasFeature(s, 'descent')) reward.echoes = 1 + Math.floor(next() * 2);
    out.push({ id: `${day}-${out.length}`, title, goal, reward, base: goalBase(s, goal), claimed: false });
  }
  return out;
}

/** Posts a fresh board when the day has turned. */
export function refreshContracts(s: GameState, now: number): void {
  if (!hasFeature(s, 'contracts')) return;
  const day = dayKey(now);
  if (s.contracts.day === day) return;
  s.contracts = { day, list: makeContracts(s, day) };
}

export function claimContract(s: GameState, id: string): boolean {
  const c = s.contracts.list.find((x) => x.id === id);
  if (!c || c.claimed || !progress(s, c.goal, c.base).done) return false;
  c.claimed = true;
  grant(s, c.reward);
  emit({ type: 'claim', title: c.title });
  return true;
}
