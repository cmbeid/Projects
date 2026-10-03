import { STORY } from '../data/missions';
import { BALANCE } from '../data/progression';
import type { GameState } from '../state/types';
import { tickFurnace } from './crafting';
import { derive } from './derive';
import { emit } from './events';
import { damage, spawnBlock, tap } from './mining';
import { activeStory, progress, startStory } from './missions';
import { rand } from './rng';

export const SAVE_VERSION = 1;

export function newGame(seed: number, now = 0): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed | 0,
    time: 0,
    savedAt: now,
    coins: 0,
    depth: 1,
    maxDepth: 1,
    deepestEver: 1,
    blocksHere: 0,
    block: { ore: 'coal', hp: 1, maxHp: 1, seam: false },
    autoAdvance: true,
    inventory: {},
    upgrades: {},
    machines: {},
    level: 1,
    xp: 0,
    statPoints: 0,
    stats: { str: 0, dex: 0, lck: 0, end: 0 },
    passives: {},
    stamina: BALANCE.baseStamina,
    cooldowns: { power: 0, dowse: 0, frenzy: 0 },
    buffs: { dowse: 0, frenzy: 0, luck: 0, sage: 0 },
    frenzyCarry: 0,
    gear: [],
    equipped: { pick: null, lantern: null, armor: null, charm: null },
    nextUid: 1,
    consumables: { dynamite: 0, tonic: 0, luckbrew: 0, sagebrew: 0 },
    fixtures: [],
    features: [],
    furnace: [0, 1, 2].map(() => ({ recipe: null, progress: -1, queued: 0 })),
    story: { index: 0, base: 0 },
    counters: {
      breaks: 0,
      mined: {},
      gems: 0,
      earned: 0,
      refined: 0,
      crafted: 0,
      craftedBy: {},
      skills: {},
      statsSpent: 0,
      descents: 0,
    },
    contracts: { day: '', list: [] },
    echoes: 0,
    echoesEarned: 0,
    echoUpgrades: {},
    settings: { music: 55, sfx: 75, muted: false },
  };
  // Burn a roll so seeds that differ only slightly still diverge at once.
  rand(s);
  spawnBlock(s);
  startStory(s);
  return s;
}

/** Frenzy swings at this rate. */
const FRENZY_RATE = 12;

let lastReadyMission = -1;

/**
 * Advances the world by `dt` seconds: stamina, cooldowns and buffs, Frenzy's
 * free swings, the machines, and the furnaces. Taps and purchases are not
 * here — they are actions, applied when the player makes them.
 */
export function tick(s: GameState, dt: number): void {
  if (dt <= 0) return;
  s.time += dt;
  const d = derive(s);

  s.stamina = Math.min(d.staminaMax, s.stamina + d.staminaRegen * dt);
  for (const k of ['power', 'dowse', 'frenzy'] as const) s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
  for (const k of ['dowse', 'frenzy', 'luck', 'sage'] as const) s.buffs[k] = Math.max(0, s.buffs[k] - dt);

  if (s.buffs.frenzy > 0) {
    s.frenzyCarry += FRENZY_RATE * dt;
    while (s.frenzyCarry >= 1) {
      s.frenzyCarry -= 1;
      tap(s);
    }
  } else {
    s.frenzyCarry = 0;
  }

  if (d.autoDps > 0) {
    // Machines crit too, with Overclock; spread as an average rather than rolled.
    const critBoost = 1 + (d.machineCrit / 100) * (d.critMult - 1);
    damage(s, d.autoDps * critBoost * dt, { crit: false, auto: true }, d);
  }

  tickFurnace(s, dt);

  const m = activeStory(s);
  if (m && s.story.index !== lastReadyMission && progress(s, m.goal, s.story.base).done) {
    lastReadyMission = s.story.index;
    emit({ type: 'mission', title: m.title });
  }
}

export function storyComplete(s: GameState): boolean {
  return s.story.index >= STORY.length;
}
