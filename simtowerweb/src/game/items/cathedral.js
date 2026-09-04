// Port of Cathedral / Church endgame monument (SimTower & Yoot Tower).
// 48x4 rooftop monument triggering the "Tower of the Year" victory ceremony.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";

export class Cathedral extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.sprite = new Sprite();
    this.weddingScheduled = false;
    this.ceremonyTriggered = false;
  }

  init() {
    this.sprite.setTexture("simtower/cathedral/main");
    this.sprite.setOrigin(0, 144);
    this.sprite.setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
  }

  constructionDuration() {
    return 10.0 / 2600.0; // standard construction cycle
  }

  advance(dt) {
    super.advance(dt);
    if (!this.underConstruction && !this.ceremonyTriggered) {
      this.ceremonyTriggered = true;
      this.game.playOnce?.("simtower/bells");
      this.game.rating = 5; // TOWER rating
      this.game.ui?.updateRating?.();
      // Endgame gift (ISSUE-034, EXE 0x79e36).
      this.game.ui?.showMessage?.('Your tower has been given a "Tower of the Year" award!');
      this.game.ui?.showVictoryDialog?.({
        towerRating: "TOWER",
        population: this.game.population,
        funds: this.game.funds,
        day: this.game.time.day,
        year: this.game.time.year,
      });
    }
  }

  dailyMaintenanceCost() {
    return 1000;
  }

  render(draw) {
    super.render(draw);
    // Draw majestic cathedral spires and golden cross
    const sx = this.position.x * 8;
    const sy = -this.position.y * 36;
    // Golden rooftop cross
    draw.rect(sx + 190, sy - 140, 4, 16, { fill: { r: 240, g: 210, b: 60, a: 255 } });
    draw.rect(sx + 184, sy - 134, 16, 4, { fill: { r: 240, g: 210, b: 60, a: 255 } });
    this.game.drawnSprites += 2;
  }
}
