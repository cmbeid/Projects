/** Lake of Rage: islands in deep water. Knock things in and they are gone for good. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 7;

function lakeshore(): LevelDef {
  const b = new Build();
  b.water(880, 1060);
  const roof = b.frame(1160, G, 'wood');
  b.target('magikarp', 1160, G);
  b.target('goldeen', 1160, roof);
  b.water(1260, 1420);
  b.frame(1520, G, 'wood');
  b.target('magikarp', 1520, G);
  return b.done(AREA, 1, { name: 'Lakeshore', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['jolteon', 'pikachu', 'staryu'] });
}

function fishingPier(): LevelDef {
  const b = new Build();
  // Piers standing on each shore, with a walkway across the water.
  b.post(1010, G, 'wood', 90, 24);
  b.post(1350, G, 'wood', 90, 24);
  b.water(1030, 1330);
  const deck = b.plank(1180, G - 90, 'wood', 364);
  b.target('goldeen', 1100, deck);
  b.target('psyduck', 1180, deck);
  b.target('goldeen', 1260, deck);
  b.target('magikarp', 1450, G);
  b.bunker(1640, G, 'wood', 110, 80);
  b.target('psyduck', 1640, G);
  return b.done(AREA, 2, { name: 'Fishing Pier', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['staryu', 'jolteon', 'pidgeot'] });
}

function steppingStones(): LevelDef {
  const b = new Build();
  b.water(900, 1700);
  const rocks = [[1000, 70], [1200, 110], [1400, 70], [1600, 130]] as const;
  for (const [x, h] of rocks) {
    const top = b.hill(x, 110, h);
    b.target(x === 1200 ? 'psyduck' : 'magikarp', x, top);
  }
  b.box(1560, G - 130, 'ice', 30);
  b.box(1640, G - 130, 'ice', 30);
  b.pickup(1300, G - 200, 'tm-ground');
  return b.done(AREA, 3, { name: 'Stepping Stones', width: 1850, par: 2, reward: 'scope-lens',
    launchers: ['staryu', 'jolteon', 'staryu'] });
}

function psyduckPoint(): LevelDef {
  const b = new Build();
  const floors = b.tower(1150, G, ['wood', 'ice', 'wood'], 140);
  b.target('psyduck', 1150, floors[0]!);
  b.target('goldeen', 1150, floors[1]!);
  b.target('psyduck', 1150, floors[2]!);
  b.water(1230, 1480);
  b.bunker(1580, G, 'stone', 120, 80);
  b.target('psyduck', 1580, G);
  return b.done(AREA, 4, { name: 'Psyduck Point', width: 1850, par: 2, reward: 'x-attack',
    launchers: ['snorlax', 'jolteon', 'pidgeot'] });
}

function whirlpool(): LevelDef {
  const b = new Build();
  b.water(950, 1150);
  const island = b.hill(1250, 200, 40);
  b.frame(1250, island, 'stone');
  b.target('psyduck', 1250, island);
  b.water(1350, 1550);
  b.frame(1650, G, 'stone');
  b.target('goldeen', 1650, G);
  b.target('magikarp', 1050, G - 180);
  b.ledge(1050, G - 180, 90, 24);
  b.pickup(1450, G - 120, 'x-attack');
  b.target('magikarp', 1450, G - 40);
  b.ledge(1450, G - 40, 80, 24);
  return b.done(AREA, 5, { name: 'Whirlpool', width: 1900, par: 3, reward: 'tm-ground',
    launchers: ['pidgeot', 'staryu', 'jolteon', 'snorlax'] });
}

function redGyarados(): LevelDef {
  const b = new Build();
  b.water(900, 1180);
  const roof = b.bunker(1330, G, 'stone', 150, 100);
  b.target('red-gyarados', 1330, G);
  b.box(1330, roof, 'stone', 40);
  b.water(1470, 1650);
  b.frame(1740, G, 'wood');
  b.target('magikarp', 1740, G);
  b.target('psyduck', 1040, G - 150);
  b.ledge(1040, G - 150, 100, 24);
  b.target('goldeen', 1560, G - 200);
  b.ledge(1560, G - 200, 100, 24);
  return b.done(AREA, 6, { name: 'Red Gyarados', width: 2000, par: 3, reward: 'max-revive',
    launchers: ['snorlax', 'voltorb', 'jolteon', 'pidgeot', 'snorlax'] });
}

export const LAKE_OF_RAGE: readonly LevelDef[] = [
  lakeshore(), fishingPier(), steppingStones(), psyduckPoint(), whirlpool(), redGyarados(),
];
