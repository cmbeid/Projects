/**
 * Who gets flung, and who gets flung at.
 *
 * `dex` is the National Pokédex number, which is also the file name under
 * `public/sprites/` and `public/cries/` — `scripts/fetch-assets.ts` reads this
 * list to know what to download.
 */

export type Ability = 'none' | 'dash' | 'explode' | 'slam' | 'split';

/**
 * Which way the official artwork looks. It varies from Pokémon to Pokémon, so
 * the renderer needs it to turn launchers toward the targets and targets
 * toward the sling. `front` art is never mirrored.
 */
export type Facing = 'left' | 'right' | 'front';

export interface LauncherDef {
  readonly key: LauncherKey;
  readonly name: string;
  readonly dex: number;
  /** Collision radius, in world pixels. */
  readonly radius: number;
  readonly density: number;
  readonly restitution: number;
  readonly ability: Ability;
  /** Shown while in flight, when the ability is still available. */
  readonly abilityLabel: string;
  /** Used for the placeholder when the sprite has not loaded, and for trails. */
  readonly color: string;
  readonly facing: Facing;
}

export type LauncherKey = 'pikachu' | 'jolteon' | 'voltorb' | 'snorlax' | 'staryu';

export const LAUNCHERS: Readonly<Record<LauncherKey, LauncherDef>> = {
  pikachu: {
    key: 'pikachu', name: 'Pikachu', dex: 25, radius: 22, density: 0.004, restitution: 0.3,
    ability: 'none', abilityLabel: '', color: '#f7d02c', facing: 'left',
  },
  jolteon: {
    key: 'jolteon', name: 'Jolteon', dex: 135, radius: 21, density: 0.004, restitution: 0.25,
    ability: 'dash', abilityLabel: 'Tap: Quick Attack', color: '#f2c94c', facing: 'left',
  },
  voltorb: {
    key: 'voltorb', name: 'Voltorb', dex: 100, radius: 22, density: 0.005, restitution: 0.35,
    ability: 'explode', abilityLabel: 'Tap: Self-Destruct', color: '#e74c3c', facing: 'right',
  },
  snorlax: {
    key: 'snorlax', name: 'Snorlax', dex: 143, radius: 30, density: 0.009, restitution: 0.1,
    ability: 'slam', abilityLabel: 'Tap: Body Slam', color: '#2f6f8f', facing: 'front',
  },
  staryu: {
    key: 'staryu', name: 'Staryu', dex: 120, radius: 19, density: 0.004, restitution: 0.35,
    ability: 'split', abilityLabel: 'Tap: Swift', color: '#c8894a', facing: 'front',
  },
};

export interface TargetDef {
  readonly key: TargetKey;
  readonly name: string;
  readonly dex: number;
  readonly radius: number;
  /** In units of velocity change — see `impactDamage`. */
  readonly hp: number;
  readonly points: number;
  /** Hovers in place instead of resting on something. */
  readonly floats: boolean;
  readonly facing: Facing;
}

export type TargetKey = 'meowth' | 'ekans' | 'koffing' | 'grimer';

export const TARGETS: Readonly<Record<TargetKey, TargetDef>> = {
  meowth: { key: 'meowth', name: 'Meowth', dex: 52, radius: 20, hp: 20, points: 5000, floats: false, facing: 'front' },
  ekans: { key: 'ekans', name: 'Ekans', dex: 23, radius: 20, hp: 28, points: 5000, floats: false, facing: 'left' },
  koffing: { key: 'koffing', name: 'Koffing', dex: 109, radius: 22, hp: 16, points: 7000, floats: true, facing: 'front' },
  grimer: { key: 'grimer', name: 'Grimer', dex: 88, radius: 28, hp: 60, points: 10000, floats: false, facing: 'left' },
};

/** Every sprite the game draws, by Pokédex number. */
export function spriteDexes(): number[] {
  const all = [...Object.values(LAUNCHERS), ...Object.values(TARGETS)].map((d) => d.dex);
  return [...new Set(all)].sort((a, b) => a - b);
}

export function spriteUrl(dex: number): string {
  return `sprites/${dex}.png`;
}

export function cryUrl(dex: number): string {
  return `cries/${dex}.wav`;
}
