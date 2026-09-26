/** Indigo Plateau: Victory Road, then the Elite Four's rooms, then Lance and his Dragonite. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 9;

function victoryRoad(): LevelDef {
  const b = new Build();
  b.ceiling(210);
  const ledge = b.ledge(1150, 450, 220);
  b.ball(1080, ledge, 'stone', 44);
  b.frame(1180, ledge, 'stone', 100, 80);
  b.target('machamp', 1180, ledge);
  b.bunker(1450, G, 'stone', 120, 80);
  b.target('machamp', 1450, G);
  b.ball(1300, G, 'stone', 50);
  b.hover('crobat', 1300, 330);
  return b.done(AREA, 1, { name: 'Victory Road', width: 1800, par: 3, reward: 'x-attack',
    launchers: ['snorlax', 'gengar', 'jolteon', 'snorlax'] });
}

function willsRoom(): LevelDef {
  const b = new Build();
  const floors = b.tower(1200, G, ['ice', 'ice', 'stone'], 140);
  b.target('umbreon', 1200, floors[0]!);
  b.target('xatu', 1200, floors[1]!);
  b.box(1200, floors[3]!, 'ice', 40);
  b.hover('xatu', 1000, 300);
  b.hover('xatu', 1420, 260);
  b.frame(1560, G, 'ice');
  b.target('umbreon', 1560, G);
  b.pickup(1200, floors[2]! - 40, 'x-speed');
  return b.done(AREA, 2, { name: "Will's Room", width: 1850, par: 2, reward: 'scope-lens',
    launchers: ['staryu', 'jolteon', 'pidgeot'] });
}

function kogasRoom(): LevelDef {
  const b = new Build();
  b.tnt(1000, G);
  b.tnt(1034, G);
  b.tnt(1017, G - 34);
  const roof = b.bunker(1220, G, 'stone', 120, 80);
  b.target('muk', 1220, G);
  b.tnt(1220, roof);
  b.hover('crobat', 1100, 300);
  b.hover('crobat', 1380, 330);
  const back = b.frame(1520, G, 'stone');
  b.target('muk', 1520, G);
  b.tnt(1520, back);
  return b.done(AREA, 3, { name: "Koga's Room", width: 1850, par: 3, reward: 'tm-ground',
    launchers: ['voltorb', 'pidgeot', 'jolteon', 'staryu'] });
}

function brunosRoom(): LevelDef {
  const b = new Build();
  const a = b.bunker(1100, G, 'stone', 130, 90);
  b.target('machamp', 1100, G);
  b.ball(1100, a, 'stone', 44);
  const c = b.bunker(1400, G, 'stone', 130, 90);
  b.target('machamp', 1400, G);
  b.ball(1400, c, 'stone', 44);
  b.wall(1250, G, 'stone', 5, 40);
  b.target('umbreon', 1250, G - 200);
  b.pickup(1600, G - 20, 'max-revive');
  b.wall(1550, G, 'stone', 3, 40);
  return b.done(AREA, 4, { name: "Bruno's Room", width: 1850, par: 2, reward: 'x-attack',
    launchers: ['snorlax', 'gengar', 'snorlax'] });
}

function karensRoom(): LevelDef {
  const b = new Build();
  b.water(950, 1100);
  const island = b.hill(1250, 300, 80);
  const floors = b.tower(1250, island, ['stone', 'wood'], 140);
  b.target('umbreon', 1250, floors[0]!);
  b.target('umbreon', 1250, floors[1]!);
  b.water(1400, 1550);
  b.frame(1650, G, 'stone');
  b.target('muk', 1650, G);
  b.hover('crobat', 1025, 340);
  b.hover('crobat', 1475, 300);
  return b.done(AREA, 5, { name: "Karen's Room", width: 1900, par: 4, reward: 'x-speed',
    launchers: ['pidgeot', 'snorlax', 'jolteon', 'staryu', 'gengar'] });
}

function lancesRoom(): LevelDef {
  const b = new Build();
  const plateau = b.hill(1450, 440, 100);
  const keep = b.bunker(1450, plateau, 'stone', 160, 100);
  b.target('dragonite', 1450, plateau);
  b.tnt(1400, keep);
  b.tnt(1500, keep);
  b.frame(1295, plateau, 'stone', 100, 70);
  b.target('umbreon', 1295, plateau);
  b.frame(1605, plateau, 'stone', 100, 70);
  b.target('umbreon', 1605, plateau);
  b.bunker(1060, G, 'stone', 120, 80);
  b.target('machamp', 1060, G);
  b.hover('aerodactyl', 1200, 260);
  b.hover('aerodactyl', 1720, 300);
  b.hover('crobat', 1450, 220);
  return b.done(AREA, 6, { name: "Lance's Room", width: 2100, par: 4, reward: 'max-revive', music: 'championbattle',
    launchers: ['voltorb', 'snorlax', 'gengar', 'jolteon', 'staryu', 'pidgeot'] });
}

export const INDIGO_PLATEAU: readonly LevelDef[] = [
  victoryRoad(), willsRoom(), kogasRoom(), brunosRoom(), karensRoom(), lancesRoom(),
];
