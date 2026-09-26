/**
 * Who gets flung, who gets flung at, and what is in the bag.
 *
 * `dex` is the National Pokédex number. `art` names the sprite under
 * `public/sprites/` — the dex number, or `<dex>-shiny` for shiny artwork — and
 * cries live under `public/cries/<dex>.wav`. `scripts/fetch-assets.ts` reads
 * these lists to know what to download.
 */

export type Ability = 'none' | 'dash' | 'explode' | 'slam' | 'split' | 'gust' | 'phase';

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
  readonly art: string;
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

export type LauncherKey = 'pikachu' | 'jolteon' | 'voltorb' | 'snorlax' | 'staryu' | 'pidgeot' | 'gengar';

export const LAUNCHERS: Readonly<Record<LauncherKey, LauncherDef>> = {
  pikachu: {
    key: 'pikachu', name: 'Pikachu', dex: 25, art: '25', radius: 22, density: 0.004, restitution: 0.3,
    ability: 'none', abilityLabel: '', color: '#f7d02c', facing: 'left',
  },
  jolteon: {
    key: 'jolteon', name: 'Jolteon', dex: 135, art: '135', radius: 21, density: 0.004, restitution: 0.25,
    ability: 'dash', abilityLabel: 'Tap: Quick Attack', color: '#f2c94c', facing: 'left',
  },
  voltorb: {
    key: 'voltorb', name: 'Voltorb', dex: 100, art: '100', radius: 22, density: 0.005, restitution: 0.35,
    ability: 'explode', abilityLabel: 'Tap: Self-Destruct', color: '#e74c3c', facing: 'right',
  },
  snorlax: {
    key: 'snorlax', name: 'Snorlax', dex: 143, art: '143', radius: 30, density: 0.009, restitution: 0.1,
    ability: 'slam', abilityLabel: 'Tap: Body Slam', color: '#2f6f8f', facing: 'front',
  },
  staryu: {
    key: 'staryu', name: 'Staryu', dex: 120, art: '120', radius: 19, density: 0.004, restitution: 0.35,
    ability: 'split', abilityLabel: 'Tap: Swift', color: '#c8894a', facing: 'front',
  },
  pidgeot: {
    key: 'pidgeot', name: 'Pidgeot', dex: 18, art: '18', radius: 23, density: 0.004, restitution: 0.25,
    ability: 'gust', abilityLabel: 'Tap: Gust', color: '#d9b36c', facing: 'right',
  },
  gengar: {
    key: 'gengar', name: 'Gengar', dex: 94, art: '94', radius: 24, density: 0.005, restitution: 0.2,
    ability: 'phase', abilityLabel: 'Tap: Phantom Force', color: '#6b4c9a', facing: 'left',
  },
};

/** How big and how tough a target is. Stats come from the class, not the species. */
export type SizeClass = 'tiny' | 'small' | 'medium' | 'large' | 'boss';

export const SIZE_CLASSES: Readonly<Record<SizeClass, { radius: number; hp: number; points: number }>> = {
  tiny: { radius: 16, hp: 12, points: 3000 },
  small: { radius: 19, hp: 18, points: 5000 },
  medium: { radius: 23, hp: 28, points: 5000 },
  large: { radius: 27, hp: 45, points: 7000 },
  boss: { radius: 33, hp: 90, points: 15000 },
};

/** A target's species and stats, before it is given its key. */
export interface TargetStats {
  readonly name: string;
  readonly dex: number;
  readonly art: string;
  readonly size: SizeClass;
  readonly radius: number;
  /** In units of velocity change — see `impactDamage`. */
  readonly hp: number;
  readonly points: number;
  /** Hovers in place instead of resting on something. */
  readonly floats: boolean;
  readonly facing: Facing;
}

export interface TargetDef extends TargetStats {
  readonly key: TargetKey;
}

interface TargetOptions {
  floats?: boolean;
  facing?: Facing;
  shiny?: boolean;
  /** Hard shells and rock bodies: multiplies the class hp. */
  tough?: number;
  /** Overrides the class radius, for the truly enormous. */
  radius?: number;
}

function t(name: string, dex: number, size: SizeClass, o: TargetOptions = {}): TargetStats {
  const cls = SIZE_CLASSES[size];
  return {
    name, dex, art: o.shiny ? `${dex}-shiny` : String(dex), size,
    radius: o.radius ?? cls.radius, hp: cls.hp * (o.tough ?? 1), points: cls.points,
    floats: o.floats ?? false, facing: o.facing ?? 'front',
  };
}

/** Wild Pokémon, grouped by the area they live in. */
const SPECIES = {
  // Viridian Forest
  caterpie: t('Caterpie', 10, 'tiny', { facing: 'left' }),
  weedle: t('Weedle', 13, 'tiny', { facing: 'left' }),
  metapod: t('Metapod', 11, 'small', { facing: 'left', tough: 1.6 }),
  kakuna: t('Kakuna', 14, 'small', { facing: 'left', tough: 1.6 }),
  pidgey: t('Pidgey', 16, 'small', { floats: true, facing: 'left' }),
  beedrill: t('Beedrill', 15, 'boss', { floats: true, facing: 'left' }),
  // Mt. Moon
  zubat: t('Zubat', 41, 'small', { floats: true }),
  geodude: t('Geodude', 74, 'small', { tough: 1.8 }),
  paras: t('Paras', 46, 'small', { facing: 'left' }),
  clefairy: t('Clefairy', 35, 'medium', { facing: 'left' }),
  clefable: t('Clefable', 36, 'boss', { facing: 'left' }),
  // Pokémon Tower
  gastly: t('Gastly', 92, 'small', { floats: true }),
  haunter: t('Haunter', 93, 'medium', { floats: true, facing: 'left' }),
  cubone: t('Cubone', 104, 'small', { facing: 'left' }),
  marowak: t('Marowak', 105, 'boss', { facing: 'left' }),
  // Rocket Hideout
  rattata: t('Rattata', 19, 'tiny', { facing: 'left' }),
  ekans: t('Ekans', 23, 'small', { facing: 'left' }),
  meowth: t('Meowth', 52, 'small'),
  koffing: t('Koffing', 109, 'medium', { floats: true }),
  grimer: t('Grimer', 88, 'medium', { facing: 'left', tough: 1.4 }),
  persian: t('Persian', 53, 'boss', { facing: 'left' }),
  // Sprout Tower
  bellsprout: t('Bellsprout', 69, 'tiny', { facing: 'left' }),
  hoothoot: t('Hoothoot', 163, 'small', { floats: true }),
  weepinbell: t('Weepinbell', 70, 'medium', { facing: 'left' }),
  victreebel: t('Victreebel', 71, 'boss', { facing: 'left' }),
  // Union Cave
  sandshrew: t('Sandshrew', 27, 'small', { facing: 'left', tough: 1.4 }),
  wooper: t('Wooper', 194, 'small', { facing: 'left' }),
  onix: t('Onix', 95, 'boss', { facing: 'left', radius: 40, tough: 1.4 }),
  // Burned Tower
  raticate: t('Raticate', 20, 'medium', { facing: 'left' }),
  weezing: t('Weezing', 110, 'large', { floats: true }),
  magmar: t('Magmar', 126, 'boss', { facing: 'left' }),
  // Lake of Rage
  magikarp: t('Magikarp', 129, 'small', { facing: 'right' }),
  goldeen: t('Goldeen', 118, 'small', { facing: 'right' }),
  psyduck: t('Psyduck', 54, 'medium', { facing: 'left' }),
  'red-gyarados': t('Red Gyarados', 130, 'boss', { facing: 'left', shiny: true, radius: 38 }),
  // Team Rocket HQ
  houndour: t('Houndour', 228, 'small', { facing: 'left' }),
  murkrow: t('Murkrow', 198, 'small', { floats: true, facing: 'left' }),
  golbat: t('Golbat', 42, 'medium', { floats: true }),
  houndoom: t('Houndoom', 229, 'boss', { facing: 'left' }),
  // Indigo Plateau
  xatu: t('Xatu', 178, 'medium', { floats: true, facing: 'left' }),
  crobat: t('Crobat', 169, 'medium', { floats: true }),
  aerodactyl: t('Aerodactyl', 142, 'large', { floats: true, facing: 'left' }),
  machamp: t('Machamp', 68, 'large', { tough: 1.3 }),
  umbreon: t('Umbreon', 197, 'medium', { facing: 'left' }),
  muk: t('Muk', 89, 'large', { tough: 1.3 }),
  dragonite: t('Dragonite', 149, 'boss', { facing: 'left', radius: 38, tough: 1.3 }),
};

export type TargetKey = keyof typeof SPECIES;

export const TARGETS: Readonly<Record<TargetKey, TargetDef>> = Object.fromEntries(
  Object.entries(SPECIES).map(([key, stats]) => [key, { ...stats, key }]),
) as Record<TargetKey, TargetDef>;

// --- items ------------------------------------------------------------

export type ItemKey = 'x-attack' | 'x-speed' | 'scope-lens' | 'max-revive' | 'tm-ground';

export interface ItemDef {
  readonly key: ItemKey;
  readonly name: string;
  /** What it does, in a few words, for the bag and the toast. */
  readonly blurb: string;
}

export const ITEMS: Readonly<Record<ItemKey, ItemDef>> = {
  'x-attack': { key: 'x-attack', name: 'X Attack', blurb: 'Next Pokémon hits twice as hard' },
  'x-speed': { key: 'x-speed', name: 'X Speed', blurb: 'Next launch flies farther' },
  'scope-lens': { key: 'scope-lens', name: 'Scope Lens', blurb: 'Full aiming arc for this level' },
  'max-revive': { key: 'max-revive', name: 'Max Revive', blurb: 'Your last Pokémon gets another go' },
  'tm-ground': { key: 'tm-ground', name: 'TM Earthquake', blurb: 'Shakes everything loose' },
};

export const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];

/** Item icons to fetch: the bag's contents, plus the ball a pickup sits in. */
export const ITEM_ICONS: readonly string[] = [...ITEM_KEYS, 'poke-ball'];

// --- assets -------------------------------------------------------------

/** Every sprite the game draws. */
export function spriteArts(): string[] {
  const all = [...Object.values(LAUNCHERS), ...Object.values(TARGETS)].map((d) => d.art);
  return [...new Set(all)].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}

/** Every cry the game plays, by Pokédex number. */
export function cryDexes(): number[] {
  const all = [...Object.values(LAUNCHERS), ...Object.values(TARGETS)].map((d) => d.dex);
  return [...new Set(all)].sort((a, b) => a - b);
}

export function spriteUrl(art: string): string {
  return `sprites/${art}.png`;
}

export function cryUrl(dex: number): string {
  return `cries/${dex}.wav`;
}

export function itemUrl(icon: string): string {
  return `items/${icon}.png`;
}
