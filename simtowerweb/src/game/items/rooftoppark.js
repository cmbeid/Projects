// Port of Rooftop Park / Garden (doc/yoottower/codemap.md:1577-1603, TODO.md:305).
// Open-air rooftop garden / leisure deck that provides stress relief aura.

import { Item } from "./item.js";

export class RooftopPark extends Item {
  constructor(game, prototype) {
    super(game, prototype);
  }

  init() {
    this.evaluation = 90;
  }

  dailyMaintenanceCost() {
    return 100;
  }

  advance(dt) {
    // Stress relief aura for people on the same or adjacent floors
    if (this.game.time.checkTick(0.01)) {
      const y = this.position.y;
      for (const p of this.game.people || []) {
        if (p.at && Math.abs(p.at.position.y - y) <= 1) {
          p.addStress(-0.5);
        }
      }
    }
  }

  render(draw) {
    super.render(draw);
    if (this.underConstruction) return;

    const game = this.game;
    const px = this.position.x * 8;
    const py = -this.position.y * 36;
    const w = this.size.x * 8;
    const h = 36;

    // Grass & garden lawn base
    const grassColor = game.lighting.compose({ r: 90, g: 170, b: 70, a: 255 });
    draw.rect(px, py - 6, w, 6, { fill: grassColor });

    // Decorative park benches and small trees
    const woodColor = game.lighting.compose({ r: 140, g: 90, b: 40, a: 255 });
    const leafColor = game.lighting.compose({ r: 50, g: 150, b: 50, a: 255 });

    for (let i = 0; i < 2; i++) {
      const tx = px + 12 + i * 36;
      // Tree trunk
      draw.rect(tx + 4, py - 18, 4, 12, { fill: woodColor });
      // Tree foliage
      draw.rect(tx, py - 28, 12, 10, { fill: leafColor });
      // Bench
      draw.rect(tx + 18, py - 10, 10, 4, { fill: woodColor });
    }
    game.drawnSprites += 5;
  }
}
