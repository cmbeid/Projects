/** Viridian Forest: wooden forts in the trees, bugs, and Pidgey overhead. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 0;

function forestPath(): LevelDef {
  const b = new Build();
  const left = b.frame(1000, G, 'wood');
  const right = b.frame(1160, G, 'wood');
  b.target('caterpie', 1000, G);
  b.target('weedle', 1160, G);
  b.target('caterpie', 1000, left);
  b.box(1160, right, 'wood', 30);
  b.target('weedle', 1300, G);
  return b.done(AREA, 1, { name: 'Forest Path', width: 1700, par: 3, reward: 'x-attack',
    launchers: ['pikachu', 'pikachu', 'jolteon', 'pikachu', 'pikachu'] });
}

function cocoonHollow(): LevelDef {
  const b = new Build();
  const floors = b.tower(1150, G, ['wood', 'wood', 'ice']);
  b.target('metapod', 1150, floors[0]!);
  b.target('kakuna', 1150, floors[1]!);
  b.target('caterpie', 1150, floors[2]!);
  b.box(1150, floors[3]!, 'ice', 30);
  b.pyramid(960, G, 'ice', 3, 30);
  b.target('weedle', 1330, G);
  const far = b.frame(1560, G, 'wood');
  b.target('caterpie', 1560, G);
  b.box(1560, far, 'ice', 30);
  return b.done(AREA, 2, { name: 'Cocoon Hollow', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['jolteon', 'pikachu', 'pikachu', 'jolteon'] });
}

function pidgeysPerch(): LevelDef {
  const b = new Build();
  const a = b.tower(1000, G, ['wood', 'wood']);
  const c = b.tower(1340, G, ['wood', 'wood']);
  b.target('weedle', 1000, a[0]!);
  b.target('kakuna', 1000, a[1]!);
  b.target('caterpie', 1340, c[0]!);
  b.target('metapod', 1340, c[1]!);
  b.hover('pidgey', 1170, 330);
  b.hover('pidgey', 1520, 280);
  b.pickup(1170, 190, 'x-speed');
  return b.done(AREA, 3, { name: "Pidgey's Perch", width: 1800, par: 4, reward: 'scope-lens',
    launchers: ['pikachu', 'jolteon', 'pikachu', 'jolteon', 'pikachu', 'pikachu'] });
}

function tangledRoots(): LevelDef {
  const b = new Build();
  const top = b.pyramid(1000, G, 'wood', 4, 36);
  b.target('metapod', 1000, top);
  const hill = b.hill(1300, 260, 90);
  const roof = b.frame(1260, hill, 'wood');
  b.target('kakuna', 1260, hill);
  b.target('caterpie', 1260, roof);
  b.frame(1390, hill, 'ice', 80, 70);
  b.target('weedle', 1390, hill);
  return b.done(AREA, 4, { name: 'Tangled Roots', width: 1800, par: 2, reward: 'max-revive',
    launchers: ['staryu', 'jolteon', 'pikachu', 'staryu'] });
}

function canopy(): LevelDef {
  const b = new Build();
  b.wall(1080, G, 'ice', 5, 36);
  const floors = b.tower(1350, G, ['wood', 'wood', 'wood', 'ice'], 140);
  b.target('metapod', 1350, floors[0]!);
  b.target('caterpie', 1350, floors[1]!);
  b.target('kakuna', 1350, floors[2]!);
  b.target('weedle', 1350, floors[3]!);
  b.pickup(1350, floors[4]! - 30, 'tm-ground');
  b.hover('pidgey', 1200, 250);
  return b.done(AREA, 5, { name: 'Canopy', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['jolteon', 'staryu', 'pikachu', 'jolteon'] });
}

function beedrillsNest(): LevelDef {
  const b = new Build();
  const left = b.tower(1050, G, ['wood', 'wood', 'wood']);
  const right = b.tower(1450, G, ['wood', 'wood', 'wood']);
  // A beam between the treetops, with the swarm's queen hanging beneath it.
  const beam = b.plank(1250, left[3]!, 'wood', 520);
  b.box(1250, beam, 'wood', 30);
  b.hover('beedrill', 1250, 380);
  b.target('weedle', 1050, left[0]!);
  b.target('kakuna', 1050, left[1]!);
  b.target('weedle', 1450, right[0]!);
  b.target('kakuna', 1450, right[1]!);
  b.target('caterpie', 1450, right[2]!);
  return b.done(AREA, 6, { name: "Beedrill's Nest", width: 1900, par: 5, reward: 'max-revive',
    launchers: ['jolteon', 'staryu', 'pikachu', 'jolteon', 'staryu', 'pikachu', 'jolteon', 'staryu'] });
}

export const VIRIDIAN_FOREST: readonly LevelDef[] = [
  forestPath(), cocoonHollow(), pidgeysPerch(), tangledRoots(), canopy(), beedrillsNest(),
];
