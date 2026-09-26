/** Mt. Moon: a low cave roof rules out lobbing, and boulders wait to roll. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 1;

function moonlitTunnel(): LevelDef {
  const b = new Build();
  b.ceiling(230);
  const roof = b.frame(1100, G, 'stone');
  b.target('geodude', 1100, G);
  const shelf = b.plank(1100, roof, 'wood', 160);
  b.ball(1060, shelf, 'stone', 40);
  b.target('paras', 1130, shelf);
  b.frame(1320, G, 'wood');
  b.target('paras', 1320, G);
  return b.done(AREA, 1, { name: 'Moonlit Tunnel', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['snorlax', 'pikachu', 'jolteon', 'pikachu'] });
}

function zubatRoost(): LevelDef {
  const b = new Build();
  b.ceiling(200);
  b.hover('zubat', 1000, 290);
  b.hover('zubat', 1250, 320);
  b.hover('zubat', 1500, 280);
  const top = b.frame(1250, G, 'wood', 140);
  b.target('clefairy', 1250, G);
  b.ball(1250, top, 'stone', 44);
  b.post(1100, G, 'stone', 70);
  return b.done(AREA, 2, { name: 'Zubat Roost', width: 1800, par: 3, reward: 'scope-lens',
    launchers: ['staryu', 'jolteon', 'pikachu', 'staryu', 'pikachu'] });
}

function fossilDig(): LevelDef {
  const b = new Build();
  b.ceiling(250);
  b.ball(980, G, 'stone', 48);
  b.target('paras', 1050, G);
  const roof = b.bunker(1250, G, 'stone');
  b.target('geodude', 1250, G);
  b.target('paras', 1250, roof);
  b.target('geodude', 1470, G);
  b.pickup(1560, G - 20, 'tm-ground');
  return b.done(AREA, 3, { name: 'Fossil Dig', width: 1800, par: 3, reward: 'max-revive',
    launchers: ['snorlax', 'jolteon', 'pikachu', 'snorlax', 'pikachu'] });
}

function rollingStones(): LevelDef {
  const b = new Build();
  b.ceiling(220);
  const floors = b.tower(1150, G, ['stone', 'wood'], 160);
  b.target('clefairy', 1150, floors[0]!);
  b.target('paras', 1150, floors[1]!);
  b.ball(1100, floors[2]!, 'stone', 40);
  b.ball(1200, floors[2]!, 'stone', 40);
  const low = b.frame(1400, G, 'wood');
  b.target('geodude', 1400, G);
  b.ball(1400, low, 'stone', 44);
  return b.done(AREA, 4, { name: 'Rolling Stones', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['jolteon', 'snorlax', 'staryu', 'pikachu'] });
}

function clefairyCircle(): LevelDef {
  const b = new Build();
  b.ceiling(240);
  b.frame(1000, G, 'stone');
  b.target('geodude', 1000, G);
  const mid = b.frame(1150, G, 'wood', 140);
  b.target('clefairy', 1150, G);
  b.target('clefairy', 1150, mid);
  b.frame(1300, G, 'stone');
  b.target('geodude', 1300, G);
  b.hover('zubat', 1150, 320);
  b.hover('zubat', 1450, 330);
  return b.done(AREA, 5, { name: 'Clefairy Circle', width: 1800, par: 2, reward: 'x-speed',
    launchers: ['staryu', 'snorlax', 'jolteon', 'staryu'] });
}

function moonStoneChamber(): LevelDef {
  const b = new Build();
  b.ceiling(210);
  const hill = b.hill(1350, 300, 70);
  const roof = b.bunker(1350, hill, 'wood', 150, 90);
  b.target('clefable', 1350, hill);
  b.ball(1350, roof, 'stone', 36);
  b.frame(1080, G, 'stone');
  b.target('geodude', 1080, G);
  b.target('geodude', 1560, G);
  b.hover('zubat', 1200, 290);
  return b.done(AREA, 6, { name: 'Moon Stone Chamber', width: 1900, par: 4, reward: 'max-revive',
    launchers: ['snorlax', 'jolteon', 'staryu', 'snorlax', 'pikachu', 'jolteon', 'snorlax'] });
}

export const MT_MOON: readonly LevelDef[] = [
  moonlitTunnel(), zubatRoost(), fossilDig(), rollingStones(), clefairyCircle(), moonStoneChamber(),
];
