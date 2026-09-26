/** Pokémon Tower: tall stacks, gravestones in the way, and ghosts drifting high. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 2;

function graveyard(): LevelDef {
  const b = new Build();
  // Rows of headstones between the sling and the mourners.
  for (const x of [900, 980, 1060]) b.post(x, G, 'stone', 60, 30);
  b.target('cubone', 1150, G);
  for (const x of [1240, 1320]) b.post(x, G, 'stone', 60, 30);
  b.target('cubone', 1420, G);
  b.hover('gastly', 1150, 380);
  b.hover('gastly', 1420, 360);
  return b.done(AREA, 1, { name: 'Lavender Graves', width: 1800, par: 3, reward: 'scope-lens',
    launchers: ['gengar', 'pikachu', 'gengar', 'jolteon', 'pikachu'] });
}

function secondFloor(): LevelDef {
  const b = new Build();
  const floors = b.tower(1250, G, ['stone', 'wood', 'wood', 'wood']);
  b.target('cubone', 1250, floors[0]!);
  b.target('gastly', 1250, floors[1]!);
  b.target('cubone', 1250, floors[2]!);
  b.target('cubone', 1250, floors[3]!);
  b.hover('haunter', 1450, 260);
  b.wall(1050, G, 'stone', 3, 40);
  return b.done(AREA, 2, { name: 'Second Floor', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['gengar', 'jolteon', 'staryu', 'gengar'] });
}

function channelersRow(): LevelDef {
  const b = new Build();
  b.wall(950, G, 'stone', 6, 40);
  b.target('cubone', 1030, G);
  b.wall(1110, G, 'stone', 5, 40);
  b.target('cubone', 1190, G);
  b.wall(1270, G, 'stone', 4, 40);
  b.target('cubone', 1350, G);
  b.hover('gastly', 1190, 300);
  b.pickup(1030, G - 130, 'x-speed');
  return b.done(AREA, 3, { name: "Channelers' Row", width: 1800, par: 2, reward: 'tm-ground',
    launchers: ['gengar', 'gengar', 'snorlax', 'gengar'] });
}

function ghostlyStack(): LevelDef {
  const b = new Build();
  const left = b.tower(1000, G, ['stone', 'wood', 'wood']);
  const right = b.tower(1400, G, ['stone', 'wood', 'wood']);
  // A walkway between the two, with a lookout on its far end.
  const bridge = b.plank(1200, left[3]!, 'wood', 520);
  b.box(1200, bridge, 'stone', 36);
  const lookout = b.frame(1400, bridge, 'wood');
  b.target('cubone', 1000, left[0]!);
  b.target('cubone', 1000, left[2]!);
  b.target('cubone', 1400, right[1]!);
  b.target('cubone', 1400, bridge);
  b.hover('gastly', 1200, 400);
  b.hover('haunter', 1200, 170);
  b.pickup(1400, lookout - 30, 'scope-lens');
  return b.done(AREA, 4, { name: 'Ghostly Stack', width: 1800, par: 3, reward: 'x-speed',
    launchers: ['jolteon', 'gengar', 'staryu', 'snorlax', 'gengar'] });
}

function silphScope(): LevelDef {
  const b = new Build();
  const hill = b.hill(1300, 340, 120);
  const floors = b.tower(1300, hill, ['stone', 'wood', 'wood'], 150);
  b.target('cubone', 1300, floors[0]!);
  b.target('haunter', 1300, floors[1]!);
  b.target('cubone', 1300, floors[2]!);
  b.hover('haunter', 1080, 250);
  b.hover('gastly', 1560, 300);
  b.post(1000, G, 'stone', 120, 30);
  return b.done(AREA, 5, { name: 'Silph Scope', width: 1850, par: 2, reward: 'max-revive',
    launchers: ['staryu', 'gengar', 'jolteon', 'snorlax'] });
}

function marowaksRest(): LevelDef {
  const b = new Build();
  const floors = b.tower(1350, G, ['stone', 'stone'], 180);
  b.target('cubone', 1300, floors[0]!);
  b.target('cubone', 1400, floors[0]!);
  const top = b.bunker(1350, floors[2]!, 'stone', 140, 90);
  b.target('marowak', 1350, floors[2]!);
  b.box(1350, top, 'wood', 30);
  b.wall(1100, G, 'stone', 4, 40);
  b.hover('gastly', 1100, 330);
  b.hover('haunter', 1580, 280);
  return b.done(AREA, 6, { name: "Marowak's Rest", width: 1900, par: 4, reward: 'max-revive',
    launchers: ['gengar', 'snorlax', 'jolteon', 'staryu', 'gengar', 'snorlax', 'pikachu'] });
}

export const POKEMON_TOWER: readonly LevelDef[] = [
  graveyard(), secondFloor(), channelersRow(), ghostlyStack(), silphScope(), marowaksRest(),
];
