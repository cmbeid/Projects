/** Burned Tower: the floor has collapsed into pits between charred ledges. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 6;

function charredEntrance(): LevelDef {
  const b = new Build();
  const front = b.hill(1000, 200, 140);
  b.frame(1000, front, 'wood');
  b.target('rattata', 1000, front);
  // The pit between the two ledges.
  b.target('raticate', 1180, G);
  b.target('rattata', 1240, G);
  const back = b.hill(1400, 200, 140);
  b.frame(1400, back, 'wood');
  b.target('raticate', 1400, back);
  return b.done(AREA, 1, { name: 'Charred Entrance', width: 1800, par: 2, reward: 'tm-ground',
    launchers: ['snorlax', 'jolteon', 'pidgeot'] });
}

function collapsedFloor(): LevelDef {
  const b = new Build();
  const plateau = b.hill(1300, 420, 110);
  const floors = b.tower(1200, plateau, ['wood', 'wood']);
  b.target('raticate', 1200, floors[0]!);
  b.target('rattata', 1200, floors[1]!);
  b.bunker(1400, plateau, 'stone', 120, 80);
  b.target('raticate', 1400, plateau);
  b.hover('koffing', 1000, 330);
  return b.done(AREA, 2, { name: 'Collapsed Floor', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['jolteon', 'voltorb', 'staryu'] });
}

function basement(): LevelDef {
  const b = new Build();
  b.hill(1030, 160, 200);
  b.target('raticate', 1180, G);
  b.tnt(1250, G);
  b.target('rattata', 1310, G);
  b.hill(1460, 160, 200);
  b.hover('koffing', 1250, 300);
  b.hover('weezing', 1460, 260);
  b.pickup(1250, G - 120, 'scope-lens');
  return b.done(AREA, 3, { name: 'Basement', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['snorlax', 'voltorb', 'jolteon'] });
}

function scorchedBeams(): LevelDef {
  const b = new Build();
  const low = b.ledge(1050, 470, 160);
  const high = b.ledge(1300, 380, 160);
  const top = b.ledge(1550, 300, 140);
  b.frame(1050, low, 'wood');
  b.target('rattata', 1050, low);
  b.frame(1300, high, 'wood');
  b.target('raticate', 1300, high);
  b.target('rattata', 1550, top);
  b.box(1500, top, 'wood', 30);
  b.box(1600, top, 'wood', 30);
  b.target('raticate', 1300, G);
  return b.done(AREA, 4, { name: 'Scorched Beams', width: 1800, par: 3, reward: 'max-revive',
    launchers: ['pidgeot', 'jolteon', 'staryu', 'gengar'] });
}

function legendaryHollow(): LevelDef {
  const b = new Build();
  const hill = b.hill(1450, 280, 120);
  b.bunker(1450, hill, 'stone', 130, 80);
  b.target('raticate', 1450, hill);
  b.target('rattata', 1200, G);
  b.tnt(1260, G);
  b.hover('weezing', 1100, 330);
  b.hover('weezing', 1250, 260);
  b.hover('koffing', 1650, 300);
  return b.done(AREA, 5, { name: 'Legendary Hollow', width: 1900, par: 2, reward: 'x-attack',
    launchers: ['voltorb', 'jolteon', 'staryu'] });
}

function magmarsBlaze(): LevelDef {
  const b = new Build();
  const plateau = b.hill(1400, 360, 150);
  const roof = b.bunker(1400, plateau, 'stone', 150, 90);
  b.target('magmar', 1400, plateau);
  b.tnt(1400, roof);
  b.tnt(1250, plateau);
  b.tnt(1550, plateau);
  b.target('raticate', 1100, G);
  b.frame(1100, G, 'stone');
  b.hover('koffing', 1150, 300);
  b.hover('weezing', 1650, 250);
  return b.done(AREA, 6, { name: "Magmar's Blaze", width: 2000, par: 3, reward: 'max-revive',
    launchers: ['voltorb', 'snorlax', 'jolteon', 'staryu', 'voltorb'] });
}

export const BURNED_TOWER: readonly LevelDef[] = [
  charredEntrance(), collapsedFloor(), basement(), scorchedBeams(), legendaryHollow(), magmarsBlaze(),
];
