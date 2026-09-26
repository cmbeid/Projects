/**
 * The ten areas, in the order a player travels through them: four in Kanto,
 * five in Johto, and the Indigo Plateau to finish. Each has six levels, the
 * last of them a boss.
 */
import type { TrackId } from './music';
import type { LauncherKey, TargetKey } from './roster';

export type ThemeKey =
  | 'forest' | 'cave' | 'haunted' | 'hideout' | 'wooden' | 'wetcave' | 'ruins' | 'lake' | 'hq' | 'plateau';

export interface AreaDef {
  readonly key: string;
  readonly name: string;
  readonly region: 'Kanto' | 'Johto' | 'Pokémon League';
  readonly music: TrackId;
  /** Music for the boss level, when it differs. */
  readonly bossMusic?: TrackId;
  readonly theme: ThemeKey;
  readonly boss: TargetKey;
  /** The launcher this area introduces, if any: shown on its first level. */
  readonly introduces?: LauncherKey;
  readonly blurb: string;
}

export const AREAS: readonly AreaDef[] = [
  { key: 'viridian-forest', name: 'Viridian Forest', region: 'Kanto', music: 'route2', theme: 'forest', boss: 'beedrill',
    introduces: 'jolteon', blurb: 'Bug Pokémon in the treetops.' },
  { key: 'mt-moon', name: 'Mt. Moon', region: 'Kanto', music: 'mtmoon', theme: 'cave', boss: 'clefable',
    introduces: 'snorlax', blurb: 'Low ceilings, loose boulders.' },
  { key: 'pokemon-tower', name: 'Pokémon Tower', region: 'Kanto', music: 'lavendertown', theme: 'haunted', boss: 'marowak',
    introduces: 'gengar', blurb: 'Tall towers and drifting ghosts.' },
  { key: 'rocket-hideout', name: 'Rocket Hideout', region: 'Kanto', music: 'rockethideout', theme: 'hideout', boss: 'persian',
    introduces: 'voltorb', blurb: 'Crates that go bang.' },
  { key: 'sprout-tower', name: 'Sprout Tower', region: 'Johto', music: 'sprouttower', theme: 'wooden', boss: 'victreebel',
    introduces: 'pidgeot', blurb: 'Targets hiding behind walls.' },
  { key: 'union-cave', name: 'Union Cave', region: 'Johto', music: 'unioncave', theme: 'wetcave', boss: 'onix',
    blurb: 'Tight tunnels and something huge.' },
  { key: 'burned-tower', name: 'Burned Tower', region: 'Johto', music: 'burnedtower', theme: 'ruins', boss: 'magmar',
    blurb: 'Charred ledges and deep pits.' },
  { key: 'lake-of-rage', name: 'Lake of Rage', region: 'Johto', music: 'surf', theme: 'lake', boss: 'red-gyarados',
    blurb: 'Anything that falls in is gone.' },
  { key: 'team-rocket-hq', name: 'Team Rocket HQ', region: 'Johto', music: 'rocketbattle', theme: 'hq', boss: 'houndoom',
    blurb: 'Bunkers, crates and guard dogs.' },
  { key: 'indigo-plateau', name: 'Indigo Plateau', region: 'Pokémon League', music: 'victoryroad',
    bossMusic: 'championbattle', theme: 'plateau', boss: 'dragonite', blurb: 'The Elite Four, and one last dragon.' },
];
