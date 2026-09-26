/** Team Rocket HQ, under Mahogany Town: bunkers, crates, and guard dogs. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 8;

function secretEntrance(): LevelDef {
  const b = new Build();
  const roof = b.bunker(1150, G, 'stone');
  b.target('houndour', 1150, G);
  b.tnt(1150, roof);
  b.tnt(1260, G);
  const roof2 = b.bunker(1400, G, 'stone');
  b.target('raticate', 1400, G);
  b.target('houndour', 1400, roof2);
  b.hover('murkrow', 1270, 330);
  b.bunker(1660, G, 'stone', 110, 80);
  b.target('houndour', 1660, G);
  return b.done(AREA, 1, { name: 'Secret Entrance', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['voltorb', 'snorlax', 'jolteon'] });
}

function trapFloor(): LevelDef {
  const b = new Build();
  b.pyramid(1000, G, 'tnt', 2, 34);
  const floors = b.tower(1200, G, ['stone', 'stone', 'wood']);
  b.target('houndour', 1200, floors[0]!);
  b.target('raticate', 1200, floors[1]!);
  b.target('houndour', 1200, floors[2]!);
  b.tnt(1200, floors[3]!);
  b.hover('murkrow', 1400, 300);
  b.hover('golbat', 1550, 350);
  return b.done(AREA, 2, { name: 'Trap Floor', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['jolteon', 'voltorb', 'staryu'] });
}

function generatorRoom(): LevelDef {
  const b = new Build();
  for (const x of [1050, 1300, 1550]) {
    const roof = b.bunker(x, G, 'stone', 120, 80);
    b.target(x === 1300 ? 'raticate' : 'houndour', x, G);
    b.tnt(x, roof);
  }
  b.hover('golbat', 1180, 320);
  b.hover('golbat', 1430, 300);
  b.pickup(1300, 250, 'scope-lens');
  return b.done(AREA, 3, { name: 'Generator Room', width: 1850, par: 3, reward: 'tm-ground',
    launchers: ['voltorb', 'gengar', 'snorlax', 'voltorb'] });
}

function passwordDoor(): LevelDef {
  const b = new Build();
  b.wall(1000, G, 'stone', 8, 40);
  b.wall(1040, G, 'stone', 8, 40);
  b.target('houndour', 1130, G);
  b.frame(1230, G, 'stone');
  b.target('raticate', 1230, G);
  b.wall(1330, G, 'stone', 6, 40);
  b.target('houndour', 1420, G);
  b.hover('murkrow', 1230, 300);
  return b.done(AREA, 4, { name: 'Password Door', width: 1800, par: 2, reward: 'max-revive',
    launchers: ['gengar', 'pidgeot', 'gengar'] });
}

function executiveWing(): LevelDef {
  const b = new Build();
  const floors = b.tower(1300, G, ['stone', 'stone', 'stone', 'wood'], 160);
  b.target('raticate', 1300, floors[0]!);
  b.tnt(1262, floors[1]!);
  b.target('houndour', 1330, floors[1]!);
  b.target('raticate', 1300, floors[2]!);
  b.target('houndour', 1300, floors[3]!);
  b.tnt(1300, floors[4]!);
  b.wall(1080, G, 'stone', 4, 40);
  b.hover('murkrow', 1080, 330);
  b.hover('golbat', 1520, 280);
  return b.done(AREA, 5, { name: 'Executive Wing', width: 1850, par: 2, reward: 'x-speed',
    launchers: ['snorlax', 'voltorb', 'jolteon'] });
}

function houndoomsKennel(): LevelDef {
  const b = new Build();
  const inner = b.bunker(1400, G, 'stone', 150, 90);
  b.target('houndoom', 1400, G);
  b.tnt(1360, inner);
  b.tnt(1440, inner);
  const guard1 = b.bunker(1120, G, 'stone', 110, 80);
  b.target('houndour', 1120, G);
  b.box(1120, guard1, 'stone', 40);
  const guard2 = b.bunker(1680, G, 'stone', 110, 80);
  b.target('houndour', 1680, G);
  b.box(1680, guard2, 'stone', 40);
  b.hover('murkrow', 1260, 320);
  b.hover('golbat', 1540, 300);
  b.hover('murkrow', 1400, 220);
  return b.done(AREA, 6, { name: "Houndoom's Kennel", width: 2000, par: 3, reward: 'max-revive',
    launchers: ['voltorb', 'snorlax', 'gengar', 'jolteon', 'voltorb'] });
}

export const TEAM_ROCKET_HQ: readonly LevelDef[] = [
  secretEntrance(), trapFloor(), generatorRoom(), passwordDoor(), executiveWing(), houndoomsKennel(),
];
