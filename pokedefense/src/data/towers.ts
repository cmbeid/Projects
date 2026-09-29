/**
 * The tower lines, Kanto to Hoenn here and the later regions' in `towers/`.
 * Each is one evolution family: it is bought as its
 * first stage and levelled up to {@link MAX_LEVEL}, evolving on the way, and
 * at the top level learns one of two signature moves.
 *
 * Stats are for level 1; `src/game/stats.ts` applies level, evolution, move,
 * held item and buffs.
 */
import type { Weather } from './maps/types';
import type { RegionId } from './regions';
import { ALOLA_LINES } from './towers/alola';
import { GALAR_LINES } from './towers/galar';
import { HISUI_LINES } from './towers/hisui';
import { KALOS_LINES } from './towers/kalos';
import { KITAKAMI_LINES } from './towers/kitakami';
import { LEGEND_LINES } from './towers/legends';
import { ORANGE_LINES } from './towers/orange';
import { PALDEA_LINES } from './towers/paldea';
import { SINNOH_LINES } from './towers/sinnoh';
import { UNOVA_LINES } from './towers/unova';
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
  /** Restores a life every this many knockouts (Meganium's healing). 0 = never. */
  lifeEvery: number;
  /** Speed Boost: attacks this much faster for each wave it has fought through, up to 10. */
  accelerate: number;
  /** Sandstorm: enemies in range that aren't Rock, Ground or Steel lose this fraction of max HP a second. */
  chip: number;
  /** Protean: each hit takes whichever of {@link PROTEAN_TYPES} hits its target hardest. */
  adapt: number;
  /** Judgment (Arceus, Terapagos): each hit takes whichever of all eighteen types hits its target hardest. */
  judgment: number;
  /** Thousand Arrows: its Ground-type hits reach flyers, and Flying types aren't immune to them. */
  smackDown: number;
  /** Extra damage multiplier against bosses (Eternatus's Dynamax Cannon). */
  bossBonus: number;
}

/** The types Greninja's Protean can take. */
export const PROTEAN_TYPES: readonly PokeType[] = ['water', 'dark', 'ice', 'fighting', 'poison'];

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
  /** From this stage it flies, so a ground-only line can hit flyers too (Flygon). */
  airborne?: boolean;
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
  /** Kyogre, Groudon, Rayquaza: placing it sets the weather for the rest of the battle ('clear' ends it). */
  fieldWeather?: Weather | 'clear';
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

  // ------------------------------------------------------------------ Johto
  {
    id: 'chikorita', name: 'Chikorita', type: 'grass', attack: 'bolt', role: 'Soothing leaves: its knockouts restore lives',
    cost: 110, base: { damage: 9, range: 2.3, rate: 1 }, effects: { slow: 0.2, lifeEvery: 30 },
    stages: [{ dex: 152, level: 1 }, { dex: 153, level: 3 }, { dex: 154, level: 5 }],
    moves: [
      { name: 'Petal Blizzard', desc: 'A whirl of petals that hits a whole group.', attack: 'splash', damage: 1.6, effects: { splash: 1 }, cost: 480 },
      { name: 'Aromatherapy', desc: 'Restores lives far more often, and soothes nearby towers.', effects: { lifeEvery: -14, auraDamage: 0.1 }, cost: 450 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'johto' },
  },
  {
    id: 'cyndaquil', name: 'Cyndaquil', type: 'fire', attack: 'splash', role: 'Bursts of flame that burn a crowd',
    cost: 110, base: { damage: 10, range: 2.2, rate: 0.9 }, effects: { splash: 0.9, burn: 0.35 },
    stages: [{ dex: 155, level: 1 }, { dex: 156, level: 3 }],
    // Or its Hisuian form, as Professor Laventon knew it.
    branches: {
      level: 5,
      options: [
        { item: 'charcoal', dex: 157, type: 'fire', attack: 'splash', desc: 'Typhlosion: volcanic bursts, as in Johto.', effects: {} },
        { item: 'spell-tag', dex: 10233, type: 'ghost', attack: 'splash', desc: 'Hisuian Typhlosion: ghostly flames that hex what they burn.', effects: { hex: 0.5 } },
      ],
    },
    moves: [
      { name: 'Eruption', desc: 'A volcanic blast: twice the damage, far wider.', damage: 2, rate: 0.7, effects: { splash: 0.6 }, cost: 500 },
      { name: 'Lava Plume', desc: 'Scorches everything around it at once.', attack: 'pulse', damage: 1.3, effects: { burn: 0.3 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'johto' },
  },
  {
    id: 'totodile', name: 'Totodile', type: 'water', attack: 'bolt', role: 'Hard bites that land critical hits',
    cost: 110, base: { damage: 13, range: 2.2, rate: 1.1 }, effects: { crit: 0.2 },
    stages: [{ dex: 158, level: 1 }, { dex: 159, level: 3 }, { dex: 160, level: 5 }],
    moves: [
      { name: 'Crunch', desc: 'Dark-type bites that leave targets taking more damage.', type: 'dark', damage: 1.6, effects: { weaken: 1 }, cost: 480 },
      { name: 'Aqua Tail', desc: 'A sweeping tail that splashes a group.', attack: 'splash', damage: 1.4, effects: { splash: 0.8 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'johto' },
  },
  {
    id: 'mareep', name: 'Mareep', type: 'electric', attack: 'chain', role: 'Fluffy static that chains between enemies',
    cost: 120, base: { damage: 10, range: 2.4, rate: 0.9 }, effects: { chain: 2, paralyse: 0.1 },
    stages: [{ dex: 179, level: 1 }, { dex: 180, level: 3 }, { dex: 181, level: 5 }],
    moves: [
      { name: 'Zap Cannon', desc: 'A huge, slow blast that nearly always paralyses.', damage: 1.8, rate: 0.7, effects: { paralyse: 0.5 }, cost: 500 },
      { name: 'Power Gem', desc: 'Rock-type light through a whole line.', type: 'rock', attack: 'beam', damage: 1.6, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 9 },
  },
  {
    id: 'togepi', name: 'Togepi', type: 'fairy', attack: 'bolt', role: 'Metronome luck, and a gentle aura',
    cost: 120, base: { damage: 7, range: 2.2, rate: 1 }, effects: { random: 1, auraDamage: 0.08 },
    stages: [{ dex: 175, level: 1 }, { dex: 176, level: 3 }, { dex: 468, level: 5 }],
    moves: [
      { name: 'Serene Grace', desc: 'A far stronger aura for the towers around it.', effects: { auraDamage: 0.15, auraRate: 0.1 }, range: 0.5, cost: 480 },
      { name: 'Air Slash', desc: 'Flying-type blades that often make enemies flinch.', type: 'flying', damage: 1.8, effects: { flinch: 0.3 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 10 },
  },
  {
    id: 'houndour', name: 'Houndour', type: 'dark', attack: 'bolt', role: 'Dark fangs that burn; sniffs out the invisible',
    cost: 120, base: { damage: 12, range: 2.3, rate: 1 }, effects: { burn: 0.25 },
    stages: [{ dex: 228, level: 1 }, { dex: 229, level: 4 }],
    moves: [
      { name: 'Dark Pulse', desc: 'A dark wave through a whole line that can cause flinching.', attack: 'beam', damage: 1.6, effects: { flinch: 0.2 }, cost: 500 },
      { name: 'Inferno', desc: 'Fire-type flames that burn fiercely.', type: 'fire', damage: 1.2, effects: { burn: 0.6 }, cost: 480 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 11 },
  },
  {
    id: 'phanpy', name: 'Phanpy', type: 'ground', attack: 'pulse', role: 'Stomps that knock back everything nearby',
    cost: 120, base: { damage: 12, range: 1.5, rate: 0.6 }, effects: { pierceArmour: 0.3, knockback: 0.2 },
    stages: [{ dex: 231, level: 1 }, { dex: 232, level: 4 }],
    moves: [
      { name: 'Earthquake', desc: 'A wider, stronger quake.', damage: 1.6, range: 0.6, cost: 500 },
      { name: 'Rollout', desc: 'Rolls through a whole line — Rock-type, so it can hit flyers.', type: 'rock', attack: 'beam', airborne: true, damage: 1.8, cost: 500 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 12 },
  },
  {
    id: 'skarmory', name: 'Skarmory', type: 'steel', attack: 'bolt', role: 'Steel wings: shreds flyers and armour',
    cost: 150, base: { damage: 10, range: 2.6, rate: 1.3 }, effects: { antiAir: 0.8, pierceArmour: 0.5 },
    stages: [{ dex: 227, level: 1 }],
    moves: [
      { name: 'Steel Wing', desc: 'Half as strong again, with more critical hits.', damage: 1.5, effects: { crit: 0.2 }, cost: 500 },
      { name: 'Spikes', desc: 'Scatters spikes that slow a whole group.', attack: 'splash', effects: { splash: 0.9, slow: 0.35 }, cost: 480 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 13 },
  },
  {
    id: 'heracross', name: 'Heracross', type: 'bug', attack: 'bolt', role: 'A close-range horn that smashes armour',
    cost: 150, base: { damage: 24, range: 1.5, rate: 0.8 }, effects: { pierceArmour: 0.6, crit: 0.1 },
    stages: [{ dex: 214, level: 1 }],
    moves: [
      { name: 'Megahorn', desc: 'Seventy per cent more damage.', damage: 1.7, cost: 550 },
      { name: 'Close Combat', desc: 'Fighting-type blows that crit often.', type: 'fighting', effects: { crit: 0.3 }, cost: 550 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'catch' },
  },
  {
    id: 'larvitar', name: 'Larvitar', type: 'rock', attack: 'bolt', role: 'Grows into Tyranitar, who stirs up sandstorms',
    cost: 160, base: { damage: 12, range: 2.3, rate: 0.9 }, effects: {},
    stages: [{ dex: 246, level: 1 }, { dex: 247, level: 3 }, { dex: 248, level: 5, power: 1.4 }],
    moves: [
      { name: 'Stone Edge', desc: 'Sharp stones that crit very often.', damage: 1.6, effects: { crit: 0.4 }, cost: 600 },
      { name: 'Sand Stream', desc: 'A sandstorm wears down every enemy near it.', type: 'dark', range: 0.5, effects: { chip: 0.02 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'misdreavus', name: 'Misdreavus', type: 'ghost', attack: 'bolt', role: 'Ignores armour; sees invisible Pokémon',
    cost: 140, base: { damage: 11, range: 2.5, rate: 1 }, effects: { pierceArmour: 1, confuse: 0.15 },
    stages: [{ dex: 200, level: 1 }, { dex: 429, level: 4 }],
    moves: [
      { name: 'Mystical Fire', desc: 'Fire-type magic that leaves targets taking more damage.', type: 'fire', damage: 1.4, effects: { weaken: 1 }, cost: 500 },
      { name: 'Perish Song', desc: 'A haunting song: a small chance to knock out any non-boss.', effects: { ohko: 0.06 }, cost: 550 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'sneasel', name: 'Sneasel', type: 'dark', attack: 'bolt', role: 'Icy claws at blinding speed',
    cost: 140, base: { damage: 9, range: 1.8, rate: 2 }, effects: { crit: 0.25, slow: 0.15 },
    stages: [{ dex: 215, level: 1 }, { dex: 461, level: 4 }],
    moves: [
      { name: 'Ice Shard', desc: 'Ice-type, even faster, and chills harder.', type: 'ice', rate: 1.4, effects: { slow: 0.2 }, cost: 520 },
      { name: 'Night Slash', desc: 'Critical hits most of the time.', effects: { crit: 0.35 }, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'wooper', name: 'Wooper', type: 'water', attack: 'splash', role: 'Muddy splashes that slow; can swim',
    cost: 110, base: { damage: 8, range: 2.1, rate: 0.8 }, effects: { splash: 0.7, slow: 0.3 },
    stages: [{ dex: 194, level: 1 }, { dex: 195, level: 3 }],
    moves: [
      { name: 'Earthquake', desc: 'Shakes everything around it, Ground-type.', type: 'ground', attack: 'pulse', damage: 1.6, cost: 480 },
      { name: 'Muddy Water', desc: 'Bigger, slower-making splashes.', effects: { splash: 0.5, slow: 0.2 }, cost: 450 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'raikou', name: 'Raikou', type: 'electric', attack: 'chain', role: 'The legendary thunder beast',
    cost: 450, base: { damage: 36, range: 2.8, rate: 1.1 }, effects: { chain: 3, paralyse: 0.2 },
    stages: [{ dex: 243, level: 1 }],
    moves: [
      { name: 'Thunder', desc: 'Two more jumps, and harder.', damage: 1.3, effects: { chain: 2 }, cost: 900 },
      { name: 'Extreme Speed', desc: 'Sixty per cent faster.', rate: 1.6, cost: 900 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'entei', name: 'Entei', type: 'fire', attack: 'splash', role: 'The legendary volcano beast',
    cost: 450, base: { damage: 44, range: 2.6, rate: 0.9 }, effects: { splash: 1, burn: 0.4 },
    stages: [{ dex: 244, level: 1 }],
    moves: [
      { name: 'Sacred Fire', desc: 'Flames that burn terribly.', damage: 1.3, effects: { burn: 0.6 }, cost: 900 },
      { name: 'Eruption', desc: 'Eighty per cent more damage, a little slower.', damage: 1.8, rate: 0.75, cost: 900 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'suicune', name: 'Suicune', type: 'water', attack: 'beam', role: 'The legendary aurora beast; can stand on water',
    cost: 450, base: { damage: 38, range: 3, rate: 0.9 }, effects: { slow: 0.35 },
    stages: [{ dex: 245, level: 1 }],
    moves: [
      { name: 'Blizzard', desc: 'Ice-type storms over a whole group that can freeze.', type: 'ice', attack: 'splash', effects: { splash: 1.2, sleep: 0.1 }, cost: 900 },
      { name: 'Aurora Beam', desc: 'Stronger beams that leave targets taking more damage.', damage: 1.3, effects: { weaken: 1 }, cost: 900 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },

  // ------------------------------------------------------------------ Hoenn
  {
    id: 'treecko', name: 'Treecko', type: 'grass', attack: 'bolt', role: 'Quick leaf blades that crit',
    cost: 120, base: { damage: 8, range: 2.2, rate: 1.7 }, effects: { crit: 0.2 },
    stages: [{ dex: 252, level: 1 }, { dex: 253, level: 3 }, { dex: 254, level: 5 }],
    moves: [
      { name: 'Leaf Blade', desc: 'Critical hits most of the time.', effects: { crit: 0.35 }, cost: 520 },
      { name: 'Leaf Storm', desc: 'A storm of leaves over a whole group.', attack: 'splash', damage: 1.7, rate: 0.7, effects: { splash: 1.1 }, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'hoenn' },
  },
  {
    id: 'torchic', name: 'Torchic', type: 'fire', attack: 'bolt', role: 'Speed Boost: gets faster every wave it fights',
    cost: 120, base: { damage: 11, range: 2.2, rate: 1 }, effects: { burn: 0.2, accelerate: 0.05 },
    stages: [{ dex: 255, level: 1 }, { dex: 256, level: 3 }, { dex: 257, level: 5 }],
    moves: [
      { name: 'Blaze Kick', desc: 'Kicks that burn and crit.', damage: 1.5, effects: { burn: 0.3, crit: 0.2 }, cost: 520 },
      { name: 'Sky Uppercut', desc: 'Fighting-type, and its Speed Boost builds twice as fast.', type: 'fighting', damage: 1.3, effects: { accelerate: 0.05 }, cost: 520 },
    ],
    placement: 'land', unlock: { kind: 'region', region: 'hoenn' },
  },
  {
    id: 'mudkip', name: 'Mudkip', type: 'water', attack: 'splash', role: 'Muddy waves; can swim',
    cost: 120, base: { damage: 10, range: 2.2, rate: 0.9 }, effects: { splash: 0.8, slow: 0.2 },
    stages: [{ dex: 258, level: 1 }, { dex: 259, level: 3 }, { dex: 260, level: 5 }],
    moves: [
      { name: 'Earthquake', desc: 'Ground-type quakes around it, much stronger.', type: 'ground', attack: 'pulse', damage: 1.8, cost: 520 },
      { name: 'Hydro Pump', desc: 'A jet through a whole line.', attack: 'beam', damage: 1.7, cost: 520 },
    ],
    placement: 'any', unlock: { kind: 'region', region: 'hoenn' },
  },
  {
    id: 'ralts', name: 'Ralts', type: 'psychic', attack: 'bolt', role: 'Evolves into Gardevoir or Gallade; sees invisible',
    cost: 130, base: { damage: 13, range: 2.8, rate: 0.7 }, effects: {},
    stages: [{ dex: 280, level: 1 }, { dex: 281, level: 3 }],
    branches: {
      level: 5,
      options: [
        { item: 'twisted-spoon', dex: 282, type: 'fairy', attack: 'splash', desc: 'Gardevoir: Moonblasts over a group, and a helping aura.', damage: 1.3, effects: { splash: 0.8, auraDamage: 0.1 } },
        { item: 'black-belt', dex: 475, type: 'fighting', attack: 'bolt', desc: 'Gallade: fast blades that crack armour.', rate: 1.6, range: -0.8, effects: { pierceArmour: 0.6, crit: 0.2 } },
      ],
    },
    moves: [
      { name: 'Psychic', desc: 'Sixty per cent more damage, and confuses.', damage: 1.6, effects: { confuse: 0.2 }, cost: 520 },
      { name: 'Future Sight', desc: 'Often sends its target back where it came from.', effects: { rewind: 0.2 }, cost: 520 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'badge', badge: 17 },
  },
  {
    id: 'aron', name: 'Aron', type: 'steel', attack: 'bolt', role: 'An iron head-butt that smashes armour',
    cost: 130, base: { damage: 22, range: 1.4, rate: 0.7 }, effects: { pierceArmour: 0.6 },
    stages: [{ dex: 304, level: 1 }, { dex: 305, level: 3 }, { dex: 306, level: 5 }],
    moves: [
      { name: 'Head Smash', desc: 'Nearly twice the damage.', type: 'rock', damage: 1.9, cost: 520 },
      { name: 'Iron Tail', desc: 'Swipes that often stop enemies in their tracks.', effects: { flinch: 0.35 }, cost: 500 },
    ],
    placement: 'land', groundOnly: true, unlock: { kind: 'badge', badge: 18 },
  },
  {
    id: 'electrike', name: 'Electrike', type: 'electric', attack: 'chain', role: 'Crackling, very fast chains',
    cost: 130, base: { damage: 8, range: 2.2, rate: 1.4 }, effects: { chain: 1, paralyse: 0.1 },
    stages: [{ dex: 309, level: 1 }, { dex: 310, level: 4 }],
    moves: [
      { name: 'Thunder', desc: 'Two more jumps, and harder.', damage: 1.3, effects: { chain: 2 }, cost: 500 },
      { name: 'Overcharge', desc: 'Even faster, with paralysing sparks.', rate: 1.4, effects: { paralyse: 0.2 }, cost: 500 },
    ],
    placement: 'land', unlock: { kind: 'badge', badge: 19 },
  },
  {
    id: 'trapinch', name: 'Trapinch', type: 'ground', attack: 'pulse', role: 'An ant-lion pit on the path; grows wings as Flygon',
    cost: 100, base: { damage: 10, range: 0.9, rate: 1.1 }, effects: { slow: 0.3 },
    stages: [{ dex: 328, level: 1 }, { dex: 329, level: 3, airborne: true }, { dex: 330, level: 5, airborne: true }],
    moves: [
      { name: 'Earth Power', desc: 'A wider, stronger pit.', damage: 1.6, range: 0.4, cost: 500 },
      { name: 'Dragon Rush', desc: 'Dragon-type charges that stop enemies in their tracks.', type: 'dragon', effects: { flinch: 0.35 }, cost: 500 },
    ],
    placement: 'path', groundOnly: true, unlock: { kind: 'badge', badge: 20 },
  },
  {
    id: 'wailmer', name: 'Wailmer', type: 'water', attack: 'splash', role: 'Enormous water spouts; can swim',
    cost: 140, base: { damage: 11, range: 2.4, rate: 0.7 }, effects: { splash: 1, knockback: 0.2 },
    stages: [{ dex: 320, level: 1 }, { dex: 321, level: 4 }],
    moves: [
      { name: 'Water Spout', desc: 'A huge spout: twice the damage, wider.', damage: 2, rate: 0.75, effects: { splash: 0.5 }, cost: 520 },
      { name: 'Rest', desc: 'Sleepy waves that put enemies to sleep.', effects: { sleep: 0.25 }, cost: 480 },
    ],
    placement: 'any', unlock: { kind: 'badge', badge: 21 },
  },
  {
    id: 'bagon', name: 'Bagon', type: 'dragon', attack: 'bolt', role: 'Dreams of flying; becomes Salamence',
    cost: 160, base: { damage: 13, range: 2.3, rate: 0.9 }, effects: {},
    stages: [{ dex: 371, level: 1 }, { dex: 372, level: 3 }, { dex: 373, level: 5, power: 1.4 }],
    moves: [
      { name: 'Outrage', desc: 'Nearly twice the damage.', damage: 1.9, cost: 620 },
      { name: 'Draco Meteor', desc: 'Meteors over a whole group, slower.', attack: 'splash', damage: 2, rate: 0.6, effects: { splash: 1.2 }, cost: 620 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'beldum', name: 'Beldum', type: 'steel', attack: 'beam', role: 'Iron will: becomes Metagross',
    cost: 160, base: { damage: 14, range: 2.4, rate: 0.7 }, effects: { pierceArmour: 0.4 },
    stages: [{ dex: 374, level: 1 }, { dex: 375, level: 3 }, { dex: 376, level: 5, power: 1.4 }],
    moves: [
      { name: 'Meteor Mash', desc: 'Stronger beams that crit.', damage: 1.5, effects: { crit: 0.25 }, cost: 620 },
      { name: 'Zen Headbutt', desc: 'Psychic-type, and makes enemies flinch.', type: 'psychic', damage: 1.3, effects: { flinch: 0.3 }, cost: 600 },
    ],
    placement: 'land', unlock: { kind: 'catch' },
  },
  {
    id: 'absol', name: 'Absol', type: 'dark', attack: 'beam', role: 'A disaster-sensing blade that crits',
    cost: 150, base: { damage: 16, range: 2, rate: 0.8 }, effects: { crit: 0.3 },
    stages: [{ dex: 359, level: 1 }],
    moves: [
      { name: 'Night Slash', desc: 'Critical hits most of the time.', effects: { crit: 0.3 }, cost: 550 },
      { name: 'Future Sight', desc: 'Psychic-type visions that send enemies back.', type: 'psychic', effects: { rewind: 0.25 }, cost: 550 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'feebas', name: 'Feebas', type: 'water', attack: 'bolt', role: 'The shabbiest fish… until it becomes Milotic',
    cost: 20, upgradeCost: 180, base: { damage: 1, range: 1.6, rate: 0.5 }, effects: {},
    stages: [{ dex: 349, level: 1 }, { dex: 350, level: 3, power: 26 }],
    moves: [
      { name: 'Recover', desc: 'Restores a life after every wave.', effects: { wish: 1 }, cost: 550 },
      { name: 'Hydro Pump', desc: 'A jet through a whole line.', attack: 'beam', damage: 1.8, cost: 600 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'sableye', name: 'Sableye', type: 'ghost', attack: 'bolt', role: 'Gem-eyed thief: its hits pay ₽; sees invisible',
    cost: 130, base: { damage: 10, range: 2.2, rate: 1 }, effects: { payDay: 1, pierceArmour: 1 },
    stages: [{ dex: 302, level: 1 }],
    moves: [
      { name: 'Power Gem', desc: 'Rock-type gems through a whole line.', type: 'rock', attack: 'beam', damage: 1.6, cost: 520 },
      { name: 'Knock Off', desc: 'Dark-type swipes that steal more ₽ and weaken.', type: 'dark', effects: { payDay: 1, weaken: 1 }, cost: 520 },
    ],
    placement: 'land', detect: true, unlock: { kind: 'catch' },
  },
  {
    id: 'latias', name: 'Latias', type: 'dragon', attack: 'splash', role: 'The legendary eon dragon: heals as she fights',
    cost: 450, base: { damage: 36, range: 2.8, rate: 1 }, effects: { splash: 0.8, lifeEvery: 25 },
    stages: [{ dex: 380, level: 1 }],
    moves: [
      { name: 'Mist Ball', desc: 'Psychic mist that leaves targets taking more damage.', type: 'psychic', damage: 1.3, effects: { weaken: 1 }, cost: 900 },
      { name: 'Healing Wish', desc: 'Restores lives far more often.', effects: { lifeEvery: -13 }, cost: 900 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  {
    id: 'latios', name: 'Latios', type: 'dragon', attack: 'beam', role: 'The legendary eon dragon: piercing beams',
    cost: 450, base: { damage: 42, range: 3, rate: 0.9 }, effects: {},
    stages: [{ dex: 381, level: 1 }],
    moves: [
      { name: 'Luster Purge', desc: 'Psychic light that leaves targets taking more damage.', type: 'psychic', damage: 1.3, effects: { weaken: 1 }, cost: 900 },
      { name: 'Draco Meteor', desc: 'Meteors over a whole group.', attack: 'splash', damage: 1.8, effects: { splash: 1.2 }, cost: 900 },
    ],
    placement: 'any', unlock: { kind: 'catch' },
  },
  ...SINNOH_LINES,
  ...UNOVA_LINES,
  ...KALOS_LINES,
  ...ALOLA_LINES,
  ...GALAR_LINES,
  ...PALDEA_LINES,
  ...ORANGE_LINES,
  ...HISUI_LINES,
  ...KITAKAMI_LINES,
  ...LEGEND_LINES,
];

/**
 * Mega Evolution, from Kalos on: a fully grown tower holding a Key Stone can
 * Mega Evolve once a battle, for {@link MEGA_SECONDS}. Keyed by the stage it
 * evolves from; `form` is the mega's PokeAPI form id (its sprite and cry).
 */
export const MEGAS: ReadonlyMap<number, { form: number; type?: PokeType }> = new Map([
  [3, { form: 10033 }], [6, { form: 10034, type: 'dragon' }], [9, { form: 10036 }], [65, { form: 10037 }],
  [94, { form: 10038 }], [130, { form: 10041 }], [181, { form: 10045, type: 'dragon' }], [212, { form: 10046 }],
  [214, { form: 10047 }], [248, { form: 10049 }], [254, { form: 10065, type: 'dragon' }], [257, { form: 10050 }],
  [260, { form: 10064 }], [282, { form: 10051 }], [306, { form: 10053 }], [310, { form: 10055 }], [359, { form: 10057 }],
  [376, { form: 10076 }], [445, { form: 10058 }], [448, { form: 10059 }], [460, { form: 10060 }],
]);
export const MEGA_SECONDS = 40;
/** The held item that lets a tower Mega Evolve. */
export const KEY_STONE = 'key-stone';

/** Alola: a Z-Ring lets a fully grown tower unleash one Z-Move a battle. */
export const Z_RING = 'z-ring';
/** Tiles around the target a Z-Move hits. */
export const Z_RADIUS = 2.5;
export const Z_MOVES: Record<PokeType, string> = {
  normal: 'Breakneck Blitz', fire: 'Inferno Overdrive', water: 'Hydro Vortex', grass: 'Bloom Doom', electric: 'Gigavolt Havoc',
  ice: 'Subzero Slammer', fighting: 'All-Out Pummeling', poison: 'Acid Downpour', ground: 'Tectonic Rage', flying: 'Supersonic Skystrike',
  psychic: 'Shattered Psyche', bug: 'Savage Spin-Out', rock: 'Continental Crush', ghost: 'Never-Ending Nightmare', dragon: 'Devastating Drake',
  dark: 'Black Hole Eclipse', steel: 'Corkscrew Crash', fairy: 'Twinkle Tackle',
};

/** Galar: a Dynamax Band lets a fully grown tower Dynamax once a battle. */
export const DYNAMAX_BAND = 'dynamax-band';
export const DYNAMAX_SECONDS = 30;
/** A Dynamaxed boss's extra HP. */
export const DYNAMAX_HP = 1.5;
/** The weather a Dynamaxed tower's Max Moves set, by its type. */
export const MAX_WEATHER: Partial<Record<PokeType, 'sun' | 'rain' | 'sand' | 'hail'>> = {
  fire: 'sun', water: 'rain', rock: 'sand', ground: 'sand', ice: 'hail',
};

/** Paldea: the Tera Orb lets a fully grown tower Terastallize once a battle. */
export const TERA_ORB = 'tera-orb';

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
