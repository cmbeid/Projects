/** Union Cave: rock ledges at every height under a low roof, and Onix at the bottom of it all. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 5;

function caveMouth(): LevelDef {
  const b = new Build();
  b.ceiling(250);
  const ledge = b.ledge(1250, 430, 240);
  b.frame(1250, ledge, 'stone');
  b.target('geodude', 1250, ledge);
  b.target('sandshrew', 1050, G);
  b.ball(1120, G, 'stone', 46);
  b.frame(1450, G, 'wood');
  b.target('sandshrew', 1450, G);
  return b.done(AREA, 1, { name: 'Cave Mouth', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['snorlax', 'jolteon', 'pidgeot'] });
}

function undergroundStream(): LevelDef {
  const b = new Build();
  b.ceiling(230);
  b.water(900, 1020);
  const roof = b.frame(1120, G, 'stone');
  b.target('wooper', 1120, G);
  b.target('wooper', 1120, roof);
  b.water(1200, 1300);
  b.frame(1400, G, 'stone');
  b.target('wooper', 1400, G);
  b.hover('zubat', 1300, 330);
  return b.done(AREA, 2, { name: 'Underground Stream', width: 1800, par: 5, reward: 'scope-lens',
    launchers: ['jolteon', 'staryu', 'snorlax', 'pidgeot', 'jolteon', 'jolteon'] });
}

function lowPassage(): LevelDef {
  const b = new Build();
  b.ceiling(180);
  b.wall(1000, G, 'stone', 3, 40);
  b.target('sandshrew', 1090, G);
  b.bunker(1250, G, 'stone', 120, 80);
  b.target('geodude', 1250, G);
  b.target('sandshrew', 1420, G);
  b.hover('zubat', 1100, 300);
  b.hover('zubat', 1420, 320);
  return b.done(AREA, 3, { name: 'Low Passage', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['gengar', 'jolteon', 'snorlax'] });
}

function stalagmites(): LevelDef {
  const b = new Build();
  b.ceiling(220);
  for (const x of [980, 1140, 1300, 1460]) b.post(x, G, 'stone', 150, 30);
  b.target('geodude', 1060, G);
  b.target('wooper', 1220, G);
  b.target('sandshrew', 1380, G);
  b.plank(1060, G - 150, 'wood', 190);
  b.plank(1380, G - 150, 'wood', 190);
  b.target('geodude', 1380, G - 170);
  b.pickup(1220, G - 190, 'x-speed');
  return b.done(AREA, 4, { name: 'Stalagmites', width: 1800, par: 3, reward: 'tm-ground',
    launchers: ['snorlax', 'jolteon', 'staryu', 'snorlax'] });
}

function lapraPool(): LevelDef {
  const b = new Build();
  b.ceiling(220);
  const high = b.ledge(1050, 400, 180);
  const mid = b.ledge(1300, 470, 200);
  b.frame(1050, high, 'wood');
  b.target('sandshrew', 1050, high);
  b.frame(1300, mid, 'stone');
  b.target('geodude', 1300, mid);
  b.water(1400, 1560);
  b.target('wooper', 1300, G);
  b.target('wooper', 1620, G);
  b.hover('zubat', 1180, 330);
  return b.done(AREA, 5, { name: 'Lapras Pool', width: 1850, par: 3, reward: 'x-speed',
    launchers: ['jolteon', 'pidgeot', 'staryu', 'snorlax'] });
}

function onixsDen(): LevelDef {
  const b = new Build();
  b.ceiling(230);
  const roof = b.frame(1350, G, 'stone', 160, 100);
  b.target('onix', 1350, G);
  b.ball(1310, roof, 'stone', 40);
  b.ball(1390, roof, 'stone', 40);
  b.wall(1180, G, 'stone', 3, 40);
  b.frame(1050, G, 'stone');
  b.target('geodude', 1050, G);
  b.frame(1560, G, 'wood');
  b.target('geodude', 1560, G);
  b.hover('zubat', 1200, 300);
  return b.done(AREA, 6, { name: "Onix's Den", width: 1900, par: 4, reward: 'max-revive',
    launchers: ['snorlax', 'gengar', 'jolteon', 'snorlax', 'staryu', 'pidgeot'] });
}

export const UNION_CAVE: readonly LevelDef[] = [
  caveMouth(), undergroundStream(), lowPassage(), stalagmites(), lapraPool(), onixsDen(),
];
