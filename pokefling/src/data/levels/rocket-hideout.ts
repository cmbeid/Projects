/** Rocket Hideout: Team Rocket stores its explosives right next to its Pokémon. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 3;

function warehouse(): LevelDef {
  const b = new Build();
  b.frame(1000, G, 'wood');
  b.target('rattata', 1000, G);
  b.tnt(1100, G);
  const mid = b.frame(1200, G, 'stone');
  b.target('meowth', 1200, G);
  b.tnt(1200, mid);
  b.tnt(1300, G);
  b.frame(1600, G, 'stone');
  b.target('ekans', 1600, G);
  return b.done(AREA, 1, { name: 'Game Corner Stairs', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['voltorb', 'pikachu', 'jolteon'] });
}

function spinningFloors(): LevelDef {
  const b = new Build();
  const a = b.tower(1050, G, ['stone', 'stone']);
  b.target('rattata', 1050, a[0]!);
  b.target('meowth', 1050, a[1]!);
  b.tnt(1050, a[2]!);
  const c = b.tower(1350, G, ['stone', 'stone']);
  b.target('ekans', 1350, c[0]!);
  b.target('rattata', 1350, c[1]!);
  b.tnt(1350, c[2]!);
  b.hover('koffing', 1200, 330);
  return b.done(AREA, 2, { name: 'Spinning Floors', width: 1800, par: 2, reward: 'tm-ground',
    launchers: ['jolteon', 'voltorb', 'staryu'] });
}

function elevatorShaft(): LevelDef {
  const b = new Build();
  const floors = b.tower(1250, G, ['stone', 'stone', 'wood', 'wood'], 180);
  // Crates stored on the ground floor, either side of the Grimer.
  b.tnt(1200, G);
  b.tnt(1300, G);
  b.target('grimer', 1250, floors[0]!);
  b.target('meowth', 1250, floors[1]!);
  b.target('ekans', 1250, floors[2]!);
  b.target('rattata', 1250, floors[3]!);
  b.pickup(1250, floors[4]! - 40, 'x-attack');
  b.wall(1000, G, 'stone', 3, 40);
  b.bunker(1620, G, 'stone', 110, 80);
  b.target('ekans', 1620, G);
  return b.done(AREA, 3, { name: 'Elevator Shaft', width: 1800, par: 2, reward: 'scope-lens',
    launchers: ['voltorb', 'snorlax', 'jolteon'] });
}

function storageRoom(): LevelDef {
  const b = new Build();
  b.pyramid(1050, G, 'tnt', 3, 34);
  b.wall(1180, G, 'stone', 4, 40);
  b.target('grimer', 1260, G);
  b.frame(1400, G, 'stone');
  b.target('grimer', 1400, G);
  b.hover('koffing', 1330, 330);
  b.hover('koffing', 1560, 300);
  return b.done(AREA, 4, { name: 'Storage Room', width: 1850, par: 3, reward: 'x-speed',
    launchers: ['voltorb', 'gengar', 'staryu', 'voltorb'] });
}

function liftKey(): LevelDef {
  const b = new Build();
  const r1 = b.bunker(1050, G, 'stone');
  b.target('meowth', 1050, G);
  b.tnt(1050, r1);
  b.tnt(1165, G);
  b.tnt(1165, G - 34);
  const r2 = b.bunker(1300, G, 'stone');
  b.target('ekans', 1300, G);
  b.tnt(1300, r2);
  b.hover('koffing', 1180, 330);
  b.pickup(1480, G - 20, 'max-revive');
  b.wall(1440, G, 'stone', 3, 40);
  b.hover('koffing', 1650, 240);
  b.frame(1650, G, 'stone');
  b.target('meowth', 1650, G);
  return b.done(AREA, 5, { name: 'Lift Key', width: 1800, par: 4, reward: 'x-attack',
    launchers: ['voltorb', 'snorlax', 'gengar', 'jolteon', 'voltorb'] });
}

function giovannisOffice(): LevelDef {
  const b = new Build();
  const roof = b.bunker(1350, G, 'stone', 150, 90);
  b.target('persian', 1350, G);
  b.tnt(1320, roof);
  b.tnt(1380, roof);
  for (const x of [1210, 1490]) b.tnt(x, G);
  const guard1 = b.frame(1060, G, 'stone');
  b.target('meowth', 1060, G);
  b.target('ekans', 1060, guard1);
  b.frame(1640, G, 'stone');
  b.target('grimer', 1640, G);
  b.hover('koffing', 1200, 300);
  b.hover('koffing', 1500, 290);
  return b.done(AREA, 6, { name: "Giovanni's Office", width: 2000, par: 3, reward: 'max-revive',
    launchers: ['voltorb', 'jolteon', 'gengar', 'snorlax', 'voltorb'] });
}

export const ROCKET_HIDEOUT: readonly LevelDef[] = [
  warehouse(), spinningFloors(), elevatorShaft(), storageRoom(), liftKey(), giovannisOffice(),
];
