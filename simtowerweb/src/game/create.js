// Central wiring (avoids circular imports): creates the Game and attaches all
// subsystems. Browser main.js and headless tests both use this.
import { Game } from "./game.js";
import { Factory } from "./items/factory.js";
import { REGISTRATIONS } from "./items/catalog.js";
import { GameMap } from "./pathfinder/gamemap.js";
import { PathFinder } from "./pathfinder/pathfinder.js";
import { Sky } from "./systems/sky.js";
import { Lighting } from "./systems/lighting.js";
import { Decorations } from "./systems/decorations.js";
import { JudgeSystem } from "./systems/judgesystem.js";
import { VipSystem } from "./systems/vipsystem.js";
import { EventSystem } from "./systems/eventsystem.js";

export function createGame(app) {
  const game = new Game(app);
  const itemFactory = new Factory(game);
  const gameMap = new GameMap(game);
  const pathFinder = new PathFinder(gameMap, game);
  const sky = new Sky(game);
  const lighting = new Lighting(game);
  const decorations = new Decorations(game);
  const judgeSystem = new JudgeSystem(game);
  const vipSystem = new VipSystem(game);
  const eventSystem = new EventSystem(game);

  game.wire({ itemFactory, gameMap, pathFinder, sky, lighting, decorations, judgeSystem, vipSystem, eventSystem });
  itemFactory.loadPrototypes(REGISTRATIONS);
  return game;
}
