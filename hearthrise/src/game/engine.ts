import { STORY } from '../data/missions';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { crewClearsPerSecond, damage, spawnRuin, tap } from './clearing';
import { MAX_SLOTS, derive, seeping } from './derive';
import { emit } from './events';
import { activeStory, progress, startStory } from './missions';
import { rand } from './rng';
import { tickWorkshops } from './workshops';

export const SAVE_VERSION = 2;

export function newGame(seed: number, now = 0): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed | 0,
    time: 0,
    savedAt: now,
    coins: 0,
    ward: 1,
    maxWard: 1,
    furthestEver: 1,
    ruinsHere: 0,
    ruin: { salvage: 'driftwood', hp: 1, maxHp: 1, landmark: false },
    autoAdvance: true,
    inventory: {},
    upgrades: {},
    buildings: [],
    plan: [],
    level: 1,
    xp: 0,
    statPoints: 0,
    stats: { craft: 0, vision: 0, charm: 0, grit: 0 },
    passives: {},
    resolve: BALANCE.baseResolve,
    cooldowns: { rush: 0, survey: 0, festival: 0 },
    buffs: { survey: 0, festival: 0, ink: 0, almanac: 0, overtime: 0, wine: 0, seek: 0, calm: 0, grease: 0, kite: 0 },
    festivalCarry: 0,
    regalia: [],
    equipped: { chain: null, seal: null, coat: null, lantern: null },
    nextUid: 1,
    consumables: { charge: 0, tea: 0, ink: 0, almanac: 0, overtime: 0, wine: 0, greatcharge: 0, seeker: 0, calm: 0, memoir: 0, grease: 0, kite: 0 },
    fixtures: [],
    features: [],
    workshops: Array.from({ length: MAX_SLOTS }, () => ({ recipe: null, progress: -1, queued: 0 })),
    story: { id: STORY[0]!.id, base: 0 },
    flags: [],
    crewBudget: 0,
    counters: {
      clears: 0,
      salvaged: {},
      relics: 0,
      earned: 0,
      refined: 0,
      refinedBy: {},
      crafted: 0,
      craftedBy: {},
      edicts: {},
      statsSpent: 0,
      tides: 0,
      farmed: 0,
      placed: 0,
    },
    petitions: { day: '', list: [] },
    memories: 0,
    memoriesEarned: 0,
    charter: {},
    settings: { music: 55, sfx: 75, muted: false },
  };
  // Burn a roll so seeds that differ only slightly still diverge at once.
  rand(s);
  spawnRuin(s);
  startStory(s);
  return s;
}

/** Share of an Undercroft ruin that the sea fills back in each second. */
export const SEEP_HEAL = 0.05;

/** The Festival swings at this rate. */
const FESTIVAL_RATE = 8;

const lastReady = new WeakMap<GameState, string>();

/**
 * Advances the world by `dt` seconds: resolve, cooldowns and buffs, the
 * Festival's free swings, the crews, the taxes and the workshops. Taps,
 * building and buying are not here — they are actions, applied when the
 * player makes them.
 */
export function tick(s: GameState, dt: number): void {
  if (dt <= 0) return;
  s.time += dt;
  const d = derive(s);

  s.resolve = Math.min(d.resolveMax, s.resolve + d.resolveRegen * dt);
  for (const k of ['rush', 'survey', 'festival'] as const) s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
  for (const k of ['survey', 'festival', 'ink', 'almanac', 'overtime', 'wine', 'seek', 'calm', 'grease', 'kite'] as const) s.buffs[k] = Math.max(0, s.buffs[k] - dt);

  if (s.buffs.festival > 0) {
    s.festivalCarry += FESTIVAL_RATE * dt;
    while (s.festivalCarry >= 1) {
      s.festivalCarry -= 1;
      tap(s);
    }
  } else {
    s.festivalCarry = 0;
  }

  // The crews' clearing budget refills each second; see `damage`.
  const cap = crewClearsPerSecond(s);
  s.crewBudget = Math.min(cap, s.crewBudget + cap * dt);
  if (d.crewDps > 0) damage(s, d.crewDps * dt, { crit: false, auto: true }, d);

  if (d.taxPerSec > 0) {
    const coins = d.taxPerSec * dt;
    s.coins += coins;
    s.counters.earned += coins;
  }

  // In the Undercroft, the sea seeps back into every breach unless the pumps keep it out.
  if (seeping(s) && s.ruin.hp < s.ruin.maxHp) s.ruin.hp = Math.min(s.ruin.maxHp, s.ruin.hp + s.ruin.maxHp * SEEP_HEAL * dt);

  tickWorkshops(s, dt);

  const m = activeStory(s);
  if (m?.goal.kind === 'visit' && s.ward === m.goal.ward) s.story.base = 1;
  if (m && m.id !== lastReady.get(s) && progress(s, m.goal, s.story.base).done) {
    lastReady.set(s, m.id);
    emit({ type: 'mission', title: m.title });
  }
}

export function storyComplete(s: GameState): boolean {
  return s.story.id === null;
}
