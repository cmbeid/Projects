/**
 * The 24 tower lines. Each is one evolution family: it is bought as its
 * first stage and levelled up to {@link MAX_LEVEL}, evolving on the way, and
 * at the top level learns one of two signature moves.
 *
 * Stats are for level 1; `src/game/stats.ts` applies level, evolution, move,
 * held item and buffs.
 */
import type { RegionId } from './regions';
import type { PokeType } from './types';

export const MAX_LEVEL = 6;

export type AttackKind =
  /** A homing shot at one target. */
  | 'bolt'
  /** A shot that bursts on impact, hitting everything within `splash` tiles. */
  | 'splash'
  /** Instant, through the target and everything behind it in a line. */
  | 'beam'
  /** Instant, jumping from the target to `chain` more nearby. */
  | 'chain'
  /** Everything in range at once, centred on the tower. */
  | 'pulse'
  /** Buffs nearby towers; never attacks. */
  | 'aura';

export type Placement = 'land' | 'water' | 'any' | 'path';

/** Everything a tower does besides raw damage. All optional; absent means none. */
export interface Effects {
  splash: number;
  chain: number;
  /** Burn: this fraction of the hit's damage again every second for 3 s. */
  burn: number;
  /** Poison: stacks up to 3 times; fraction of the hit per second for 4 s. */
  poison: number;
  /** Slows the target to (1 − slow) of its speed for 1.5 s. */
  slow: number;
  sleep: number;
  paralyse: number;
  confuse: number;
  flinch: number;
  /** Chance per hit to double damage. */
  crit: number;
  /** Pushes the target back this many tiles. */
  knockback: number;
  /** Ignores this fraction of the target's armour. */
  pierceArmour: number;
  /** Target takes 25% more damage from everything for 3 s. */
  weaken: number;
  /** Chance per hit to knock out a non-boss outright. */
  ohko: number;
  /** ₽ earned per hit. */
  payDay: number;
  /** Extra damage multiplier against flying Pokémon. */
  antiAir: number;
  /** Aura: other towers in range deal this much more damage (0.2 = +20%). */
  auraDamage: number;
  /** Aura: other towers in range attack this much faster. */
  auraRate: number;
  /** ₽ at the end of each wave. */
  income: number;
  /** Lives restored at the end of each wave (Wish). */
  wish: number;
  /** Chance per hit to send the target back 2 tiles. */
  rewind: number;
  /** Double damage against a target with any status. */
  hex: number;
  /** Picks a random status per hit (Tri Attack / Metronome). */
  random: number;
}

export interface TowerBase {
  damage: number;
  /** Tiles, measured centre to centre. */
  range: number;
  /** Attacks per second. */
  rate: number;
}

export interface Move {
  name: string;
  desc: string;
  type?: PokeType;
  attack?: AttackKind;
  damage?: number;
  range?: number;
  rate?: number;
  /** Added to the line's own effects. */
  effects?: Partial<Effects>;
  /** Lets a ground-only line hit flyers. */
  airborne?: boolean;
  cost: number;
}

export interface Stage {
  dex: number;
  /** The level this stage starts at. */
  level: number;
  /** Damage multiplier from this stage on; evolving is otherwise worth ×1.15. */
  power?: number;
}

export interface Branch {
  /** Evolution item shown on the choice button. */
  item: string;
  dex: number;
  type: PokeType;
  attack: AttackKind;
  desc: string;
  damage?: number;
  rate?: number;
  range?: number;
  effects: Partial<Effects>;
}

export type Unlock =
  | { kind: 'start' }
  /** Given by the region's professor on arrival. */
  | { kind: 'region'; region: RegionId }
  | { kind: 'badge'; badge: number }
  | { kind: 'catch' };

export interface TowerLine {
  id: string;
  name: string;
  type: PokeType;
  attack: AttackKind;
  role: string;
  cost: number;
  /** Prices level-ups as if the tower cost this much (Magikarp is cheap to buy, not to grow). */
  upgradeCost?: number;
  base: TowerBase;
  effects: Partial<Effects>;
  stages: readonly Stage[];
  /** Eevee: at `level`, choose one of these instead of a fixed next stage. */
  branches?: { level: number; options: readonly Branch[] };
  moves: readonly [Move, Move];
  placement: Placement;
  /** Can see invisible Pokémon within its range. */
  detect?: boolean;
  /** Only hits Pokémon on the ground. */
  groundOnly?: boolean;
  unlock: Unlock;
}

export const LINES: readonly TowerLine[] = [
  {
    id: 'charmander', name: 'Charmander', type: 'fire', attack: 'splash', role: 'Splash damage that burns',
    cost: 100, base: { damage: 9, range: 2.2, rate: 0.9 }, effects: { splash: 0.8, burn: 0.3 },
    stages: [{ dex: 4, level: 1 }, { dex: 5, level: 3 }, { dex: 6, level: 5 }],
    moves: [
      { name: 'Flamethrower', desc: 'Burns straight through a whole line of enemies.', attack: 'beam', range: 0.6, damage: 1.2, cost: 450 },
      { name: 'Fire Blast', desc: 'A huge explosion: bigger splash, far more damage, slower.', damage: 1.8, rate: 0.75, effects: { splash: 0.9 }, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'start' },
  },
  {
    id: 'squirtle', name: 'Squirtle', type: 'water', attack: 'bolt', role: 'Fast shots that push enemies back',
    cost: 90, base: { damage: 11, range: 2.4, rate: 1.1 }, effects: { knockback: 0.15 },
    stages: [{ dex: 7, level: 1 }, { dex: 8, level: 3 }, { dex: 9, level: 5 }],
    moves: [
      { name: 'Hydro Pump', desc: 'A jet that pierces every enemy in a line.', attack: 'beam', damage: 1.5, effects: { knockback: 0.3 }, cost: 420 },
      { name: 'Rapid Spin', desc: 'Fires twice as fast.', rate: 2, cost: 420 },
    ],
    placement: 'land', unlock: { kind: 'start' },
  },
  {
    id: 'bulbasaur', name: 'Bulbasaur', type: 'grass', attack: 'bolt', role: 'Poisons and slows',
    cost: 90, base: { damage: 7, range: 2.2, rate: 1 }, effects: { poison: 0.35, slow: 0.25 },
    stages: [{ dex: 1, level: 1 }, { dex: 2, level: 3 }, { dex: 3, level: 5 }],
    moves: [
      { name: 'Solar Beam', desc: 'A slow, enormous beam through a whole line.', attack: 'beam', damage: 3, rate: 0.5, range: 0.8, cost: 450 },
      { name: 'Sleep Powder', desc: 'Spores that can put a whole group to sleep.', attack: 'splash', effects: { splash: 1, sleep: 0.25 }, cost: 400 },
    ],
    placement: 'land', unlock: { kind: 'start' },
  },
  {
    id: 'pidgey', name: 'Pidgey', type: 'flying', attack: 'bolt', role: 'Rapid fire, strong against flyers',
    cost: 70, base: { damage: 5, range: 2.6, rate: 2 }, effects: { antiAir: 0.6 },
    stages: [{ dex: 16, level: 1 }, { dex: 17, level: 3 }, { dex: 18, level: 5 }],
    moves: [
      { name: 'Hurricane', desc: 'Winds that hit a group and leave it confused.', attack: 'splash', damage: 1.3, effects: { splash: 0.9, confuse: 0.2 }, cost: 380 },
      { name: 'Aerial Ace', desc: 'Never misses a weak spot: many more critical hits.', range: 0.5, effects: { crit: 0.35 }, cost: 380 },
    ],
    placement: 'land', unlock: { kind: 'start' },
  },
  {
    id: 'pikachu', name: 'Pikachu', type: 'electric', attack: 'chain', role: 'Lightning that jumps between enemies',
    cost: 120, base: { damage: 10, range: 2.3, rate: 0.8 }, effects: { chain: 2, paralyse: 0.1 },
    stages: [{ dex: 25, level: 1 }, { dex: 26, level: 4 }],
    moves: [
      { name: 'Thunder', desc: 'The bolt jumps to two more enemies, harder.', damage: 1.3, effects: { chain: 2 }, cost: 480 },
      { name: 'Thunder Wave', desc: 'Every hit has a big chance to paralyse.', effects: { paralyse: 0.35 }, cost: 420 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 1 },
  },
  {
    id: 'geodude', name: 'Geodude', type: 'ground', attack: 'pulse', role: 'Shakes everything on the ground nearby',
    cost: 110, base: { damage: 10, range: 1.5, rate: 0.6 }, effects: { pierceArmour: 0.3 },
    stages: [{ dex: 74, level: 1 }, { dex: 75, level: 3 }, { dex: 76, level: 5 }],
    moves: [
      { name: 'Earthquake', desc: 'A wider, stronger quake.', damage: 1.5, range: 0.8, cost: 480 },
      { name: 'Rock Slide', desc: 'Rocks that can hit flyers too, and make enemies flinch.', type: 'rock', airborne: true, effects: { flinch: 0.25 }, cost: 450 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 1 },
  },
  {
    id: 'abra', name: 'Abra', type: 'psychic', attack: 'bolt', role: 'Long range; sees invisible Pokémon',
    cost: 130, base: { damage: 16, range: 3.2, rate: 0.55 }, effects: {},
    stages: [{ dex: 63, level: 1 }, { dex: 64, level: 3 }, { dex: 65, level: 5 }],
    moves: [
      { name: 'Psychic', desc: 'Stronger blasts that confuse.', damage: 1.6, effects: { confuse: 0.25 }, cost: 500 },
      { name: 'Future Sight', desc: 'Often sends its target back where it came from.', effects: { rewind: 0.2 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 2 },
  },
  {
    id: 'machop', name: 'Machop', type: 'fighting', attack: 'bolt', role: 'Close-range heavy hitter; breaks armour',
    cost: 100, base: { damage: 20, range: 1.3, rate: 0.8 }, effects: { pierceArmour: 0.5 },
    stages: [{ dex: 66, level: 1 }, { dex: 67, level: 3 }, { dex: 68, level: 5 }],
    moves: [
      { name: 'Dynamic Punch', desc: 'Harder punches that always confuse.', damage: 1.3, effects: { confuse: 0.6 }, cost: 450 },
      { name: 'Cross Chop', desc: 'Lands critical hits almost half the time.', effects: { crit: 0.45 }, cost: 450 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 2 },
  },
  {
    id: 'diglett', name: 'Diglett', type: 'ground', attack: 'pulse', role: 'Burrows under the path itself',
    cost: 80, base: { damage: 8, range: 0.9, rate: 1.2 }, effects: {},
    stages: [{ dex: 50, level: 1 }, { dex: 51, level: 4 }],
    moves: [
      { name: 'Fissure', desc: 'A small chance to knock out any non-boss instantly.', damage: 1.3, effects: { ohko: 0.05 }, cost: 450 },
      { name: 'Dig', desc: 'Pops up under enemies, stopping them in their tracks.', effects: { flinch: 0.35 }, cost: 380 },
    ],
    placement: 'path', groundOnly: true, unlock: { kind: 'badge', badge: 3 },
  },
  {
    id: 'oddish', name: 'Oddish', type: 'poison', attack: 'splash', role: 'Clouds of poison',
    cost: 90, base: { damage: 5, range: 2, rate: 0.8 }, effects: { splash: 0.8, poison: 0.5 },
    stages: [{ dex: 43, level: 1 }, { dex: 44, level: 3 }, { dex: 45, level: 5 }],
    moves: [
      { name: 'Petal Dance', desc: 'A storm of petals: Grass-type, much stronger.', type: 'grass', damage: 1.8, cost: 420 },
      { name: 'Stun Spore', desc: 'Every cloud can paralyse.', effects: { paralyse: 0.3 }, cost: 400 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 3 },
  },
  {
    id: 'growlithe', name: 'Growlithe', type: 'fire', attack: 'bolt', role: 'Quick fire that burns',
    cost: 120, base: { damage: 11, range: 2.3, rate: 1.3 }, effects: { burn: 0.25 },
    stages: [{ dex: 58, level: 1 }, { dex: 59, level: 4 }],
    moves: [
      { name: 'Flare Blitz', desc: 'Nearly twice the damage.', damage: 1.8, cost: 500 },
      { name: 'Extreme Speed', desc: 'Attacks 60% faster.', rate: 1.6, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 4 },
  },
  {
    id: 'poliwag', name: 'Poliwag', type: 'water', attack: 'bolt', role: 'Swims — can be placed on water',
    cost: 90, base: { damage: 9, range: 2.3, rate: 1 }, effects: { confuse: 0.1 },
    stages: [{ dex: 60, level: 1 }, { dex: 61, level: 3 }, { dex: 62, level: 5 }],
    moves: [
      { name: 'Hypnosis', desc: 'Puts enemies to sleep.', effects: { sleep: 0.25 }, cost: 420 },
      { name: 'Submission', desc: 'Fighting-type blows, 60% stronger, that crack armour.', type: 'fighting', damage: 1.6, effects: { pierceArmour: 0.4 }, cost: 450 },
    ],
    placement: 'any', unlock: { kind: 'badge', badge: 4 },
  },

  // Catch-only lines.
  {
    id: 'meowth', name: 'Meowth', type: 'normal', attack: 'bolt', role: 'Pay Day: earns ₽ as it fights',
    cost: 100, base: { damage: 6, range: 2, rate: 1 }, effects: { payDay: 1, income: 15 },
    stages: [{ dex: 52, level: 1 }, { dex: 53, level: 4 }],
    moves: [
      { name: 'Pay Day', desc: 'Doubles everything it earns.', effects: { payDay: 1, income: 45 }, cost: 400 },
      { name: 'Slash', desc: 'Twice the damage and many critical hits.', damage: 2, effects: { crit: 0.3 }, cost: 400 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'clefairy', name: 'Clefairy', type: 'fairy', attack: 'aura', role: 'Makes nearby towers stronger',
    cost: 130, base: { damage: 0, range: 1.6, rate: 0 }, effects: { auraDamage: 0.15, auraRate: 0.08 },
    stages: [{ dex: 35, level: 1 }, { dex: 36, level: 4 }],
    moves: [
      { name: 'Follow Me', desc: 'A much stronger aura over a wider area.', range: 0.6, effects: { auraDamage: 0.2, auraRate: 0.1 }, cost: 500 },
      { name: 'Wish', desc: 'Restores a life after every wave.', effects: { wish: 1 }, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'jigglypuff', name: 'Jigglypuff', type: 'normal', attack: 'pulse', role: 'Sings everything nearby to sleep',
    cost: 110, base: { damage: 3, range: 1.8, rate: 0.35 }, effects: { sleep: 1 },
    stages: [{ dex: 39, level: 1 }, { dex: 40, level: 4 }],
    moves: [
      { name: 'Hyper Voice', desc: 'Its song does real damage.', damage: 4, cost: 450 },
      { name: 'Lullaby', desc: 'A wider song, sung more often.', range: 0.6, rate: 1.4, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'gastly', name: 'Gastly', type: 'ghost', attack: 'bolt', role: 'Ignores armour; sees invisible Pokémon',
    cost: 120, base: { damage: 12, range: 2.4, rate: 0.9 }, effects: { pierceArmour: 1 },
    stages: [{ dex: 92, level: 1 }, { dex: 93, level: 3 }, { dex: 94, level: 5 }],
    moves: [
      { name: 'Shadow Ball', desc: '60% more damage.', damage: 1.6, cost: 480 },
      { name: 'Hex', desc: 'Double damage against anything burned, poisoned, asleep…', effects: { hex: 1, confuse: 0.15 }, cost: 450 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'eevee', name: 'Eevee', type: 'normal', attack: 'bolt', role: 'Choose its evolution with a stone',
    cost: 110, base: { damage: 9, range: 2.3, rate: 1.1 }, effects: {},
    stages: [{ dex: 133, level: 1 }],
    branches: {
      level: 4,
      options: [
        { item: 'water-stone', dex: 134, type: 'water', attack: 'splash', desc: 'Vaporeon: soaking splashes that slow.', damage: 1.2, effects: { splash: 0.9, slow: 0.35 } },
        { item: 'thunder-stone', dex: 135, type: 'electric', attack: 'chain', desc: 'Jolteon: blinding speed, chained lightning.', rate: 1.8, effects: { chain: 1, paralyse: 0.1 } },
        { item: 'fire-stone', dex: 136, type: 'fire', attack: 'bolt', desc: 'Flareon: the hardest hitter, and burns.', damage: 2, effects: { burn: 0.4 } },
      ],
    },
    moves: [
      { name: 'Last Resort', desc: '60% more damage.', damage: 1.6, cost: 450 },
      { name: 'Helping Hand', desc: 'Also boosts nearby towers.', effects: { auraDamage: 0.15 }, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'magikarp', name: 'Magikarp', type: 'water', attack: 'bolt', role: 'Useless… until it evolves',
    cost: 20, upgradeCost: 170, base: { damage: 1, range: 1.5, rate: 0.5 }, effects: {},
    stages: [{ dex: 129, level: 1 }, { dex: 130, level: 3, power: 22 }],
    moves: [
      { name: 'Hyper Beam', desc: 'An enormous beam through a whole line.', attack: 'beam', damage: 2.5, rate: 0.6, cost: 550 },
      { name: 'Dragon Dance', desc: 'Faster and stronger.', type: 'dragon', damage: 1.25, rate: 1.4, cost: 550 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'lapras', name: 'Lapras', type: 'ice', attack: 'bolt', role: 'Freezing shots; can sit on water',
    cost: 160, base: { damage: 14, range: 2.6, rate: 0.8 }, effects: { slow: 0.35 },
    stages: [{ dex: 131, level: 1 }],
    moves: [
      { name: 'Blizzard', desc: 'A freezing storm that hits a whole group.', attack: 'splash', effects: { splash: 1.1, sleep: 0.1 }, cost: 500 },
      { name: 'Surf', desc: 'A wave that washes through a whole line.', attack: 'beam', type: 'water', damage: 1.5, cost: 500 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'scyther', name: 'Scyther', type: 'bug', attack: 'bolt', role: 'Blindingly fast slashes that crit',
    cost: 150, base: { damage: 11, range: 1.6, rate: 1.8 }, effects: { crit: 0.2 },
    stages: [{ dex: 123, level: 1 }, { dex: 212, level: 4 }],
    moves: [
      { name: 'Swords Dance', desc: 'Half as strong again.', damage: 1.5, cost: 500 },
      { name: 'Bullet Punch', desc: 'Steel-type punches that crit half the time.', type: 'steel', effects: { crit: 0.5 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'dratini', name: 'Dratini', type: 'dragon', attack: 'bolt', role: 'Slow to grow; a monster when grown',
    cost: 150, base: { damage: 12, range: 2.5, rate: 0.9 }, effects: {},
    stages: [{ dex: 147, level: 1 }, { dex: 148, level: 3 }, { dex: 149, level: 5 }],
    moves: [
      { name: 'Outrage', desc: 'Nearly twice the damage.', damage: 1.9, cost: 600 },
      { name: 'Hurricane', desc: 'Flying-type storms that hit a group.', type: 'flying', attack: 'splash', damage: 1.3, effects: { splash: 1, confuse: 0.2 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'snorlax', name: 'Snorlax', type: 'normal', attack: 'pulse', role: 'Lies across the path, slowing all who pass',
    cost: 200, base: { damage: 14, range: 0.9, rate: 0.7 }, effects: { slow: 0.6, paralyse: 0.1 },
    stages: [{ dex: 143, level: 1 }],
    moves: [
      { name: 'Giga Impact', desc: 'Two and a half times the damage.', damage: 2.5, cost: 550 },
      { name: 'Yawn', desc: 'Sends passing enemies to sleep.', effects: { sleep: 0.3 }, cost: 500 },
    ],
    placement: 'path', groundOnly: true, unlock: { kind: 'catch' },
  },
  {
    id: 'porygon', name: 'Porygon', type: 'normal', attack: 'bolt', role: 'Marks targets to take more damage; sees invisible',
    cost: 140, base: { damage: 8, range: 2.8, rate: 1 }, effects: { weaken: 1 },
    stages: [{ dex: 137, level: 1 }, { dex: 233, level: 4 }],
    moves: [
      { name: 'Tri Attack', desc: 'Every hit burns, paralyses or freezes.', damage: 1.4, effects: { random: 1 }, cost: 480 },
      { name: 'Lock-On', desc: 'Much longer range and many critical hits.', range: 1, effects: { crit: 0.3 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'mew', name: 'Mew', type: 'psychic', attack: 'splash', role: 'The mythical all-rounder',
    cost: 400, base: { damage: 30, range: 3, rate: 1.2 }, effects: { splash: 0.6 },
    stages: [{ dex: 151, level: 1 }],
    moves: [
      { name: 'Ancient Power', desc: 'Everything a third better.', damage: 1.35, rate: 1.35, range: 0.5, cost: 900 },
      { name: 'Metronome', desc: 'Every hit does something random — and bigger.', damage: 1.5, effects: { random: 1 }, cost: 900 },
    ],
    placement: 'any', detect: true, unlock: { kind: 'catch' },
  },
];

export const LINE_BY_ID: ReadonlyMap<string, TowerLine> = new Map(LINES.map((l) => [l.id, l]));

export function line(id: string): TowerLine {
  const l = LINE_BY_ID.get(id);
  if (!l) throw new Error(`No tower line ${id}`);
  return l;
}

/** Every dex in a line, including Eevee's branches. */
export function lineDexes(l: TowerLine): number[] {
  return [...l.stages.map((s) => s.dex), ...(l.branches?.options.map((b) => b.dex) ?? [])];
}

/** The line a caught Pokémon adds to the roster, if any. */
export function lineForDex(dex: number): TowerLine | undefined {
  return LINES.find((l) => lineDexes(l).includes(dex));
}

/** ₽ to go from `level` to `level + 1`. */
export function levelCost(l: TowerLine, level: number): number {
  return Math.round(((l.upgradeCost ?? l.cost) * 0.75 * 1.4 ** (level - 1)) / 5) * 5;
}
