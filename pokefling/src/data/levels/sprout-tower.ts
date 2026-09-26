/** Sprout Tower: tall walls with the targets tucked in behind — Pidgeot's Gust comes back for them. */
import { Build, G } from './build';
import type { LevelDef } from './types';

const AREA = 4;

function swayingPillar(): LevelDef {
  const b = new Build();
  b.post(1150, G, 'stone', 260, 40);
  b.target('bellsprout', 1230, G);
  b.target('bellsprout', 1070, G);
  const back = b.frame(1330, G, 'wood');
  b.target('bellsprout', 1330, G);
  b.target('bellsprout', 1330, back);
  b.post(1450, G, 'wood', 200, 30);
  return b.done(AREA, 1, { name: 'Swaying Pillar', width: 1800, par: 4, reward: 'scope-lens',
    launchers: ['pidgeot', 'pikachu', 'pidgeot', 'jolteon', 'pidgeot'] });
}

function monksHall(): LevelDef {
  const b = new Build();
  b.wall(1000, G, 'stone', 7, 40);
  b.target('bellsprout', 1080, G);
  b.target('weepinbell', 1160, G);
  b.wall(1240, G, 'stone', 4, 40);
  b.hover('hoothoot', 1120, 300);
  b.wall(1460, G, 'stone', 7, 40);
  b.target('weepinbell', 1545, G);
  return b.done(AREA, 2, { name: "Monks' Hall", width: 1800, par: 1, reward: 'x-attack',
    launchers: ['pidgeot', 'gengar', 'pidgeot'] });
}

function upperFloor(): LevelDef {
  const b = new Build();
  b.wall(1050, G, 'wood', 6, 40);
  const floors = b.tower(1200, G, ['wood', 'wood'], 140);
  b.target('weepinbell', 1200, floors[0]!);
  b.target('bellsprout', 1200, floors[1]!);
  b.target('bellsprout', 1200, floors[2]!);
  b.wall(1350, G, 'wood', 6, 40);
  b.target('weepinbell', 1440, G);
  b.hover('hoothoot', 1440, 330);
  return b.done(AREA, 3, { name: 'Upper Floor', width: 1800, par: 4, reward: 'x-speed',
    launchers: ['pidgeot', 'jolteon', 'pidgeot', 'staryu', 'gengar'] });
}

function hiddenAlcove(): LevelDef {
  const b = new Build();
  // A tall front wall, a gap, and the alcove behind it.
  b.wall(1100, G, 'stone', 8, 40);
  b.target('bellsprout', 1180, G);
  b.frame(1300, G, 'wood');
  b.target('weepinbell', 1300, G);
  b.wall(1420, G, 'stone', 8, 40);
  b.target('bellsprout', 1500, G);
  b.pickup(1500, G - 70, 'max-revive');
  b.hover('hoothoot', 1300, 290);
  return b.done(AREA, 4, { name: 'Hidden Alcove', width: 1800, par: 2, reward: 'tm-ground',
    launchers: ['pidgeot', 'gengar', 'pidgeot'] });
}

function rafters(): LevelDef {
  const b = new Build();
  // Two beams high on tall posts, with Pokémon perched along them.
  for (const x of [980, 1160, 1240, 1420]) b.post(x, G, 'wood', 220, 24);
  const beam = b.plank(1070, G - 220, 'wood', 204);
  b.plank(1330, G - 220, 'wood', 204);
  b.target('bellsprout', 1030, beam);
  b.target('bellsprout', 1110, beam);
  b.target('weepinbell', 1330, beam);
  b.target('bellsprout', 1070, G);
  b.target('bellsprout', 1330, G);
  b.hover('hoothoot', 1550, 290);
  return b.done(AREA, 5, { name: 'Rafters', width: 1800, par: 2, reward: 'x-attack',
    launchers: ['staryu', 'pidgeot', 'jolteon'] });
}

function eldersChamber(): LevelDef {
  const b = new Build();
  b.wall(1080, G, 'stone', 7, 40);
  const hall = b.frame(1300, G, 'wood', 200, 110);
  b.target('victreebel', 1300, G);
  b.target('weepinbell', 1250, hall);
  b.target('weepinbell', 1350, hall);
  b.wall(1180, G, 'wood', 3, 40);
  b.wall(1520, G, 'stone', 7, 40);
  b.target('bellsprout', 1600, G);
  b.hover('hoothoot', 1300, 260);
  return b.done(AREA, 6, { name: "Elder's Chamber", width: 1900, par: 3, reward: 'max-revive',
    launchers: ['pidgeot', 'snorlax', 'gengar', 'pidgeot', 'jolteon'] });
}

export const SPROUT_TOWER: readonly LevelDef[] = [
  swayingPillar(), monksHall(), upperFloor(), hiddenAlcove(), rafters(), eldersChamber(),
];
