// Port of OutTV / Antenna (doc/yoottower/codemap.md:1643-1676, TODO.md:305).
// Rooftop TV/Radio broadcasting antenna that generates passive contract income.

import { Item } from "./item.js";

export class Antenna extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.beaconBlink = 0;
  }

  init() {
    this.evaluation = 80;
  }

  dailyBroadcastRevenue() {
    return 3000;
  }

  advance(dt) {
    // 04:00 Daily broadcast contract revenue payout
    if (this.game.time.checkHour(4)) {
      this.game.transferFunds(
        this.dailyBroadcastRevenue(),
        "broadcast",
        "Broadcasting antenna contract revenue",
      );
    }
  }

  render(draw) {
    super.render(draw);
    if (this.underConstruction) return;

    const game = this.game;
    const px = this.position.x * 8;
    const py = -this.position.y * 36;
    const w = this.size.x * 8;
    const h = this.size.y * 36;

    const color = game.lighting.compose({ r: 180, g: 185, b: 195, a: 255 });
    const cx = px + w / 2;

    // Metal lattice mast
    draw.rect(cx - 2, py - h, 4, h, { fill: color });
    // Horizontal cross-bars
    for (let y = py - h + 12; y < py; y += 18) {
      draw.rect(cx - 8, y, 16, 2, { fill: color });
    }
    // Diagonal guy-wires / lattice
    draw.rect(cx - 10, py - 6, 20, 2, { fill: color });

    // Red warning beacon light at the summit (flashing at 1 Hz)
    const blink = Math.floor(game.time.absolute * 2000) % 2 === 0;
    const beaconColor = blink
      ? { r: 255, g: 30, b: 30, a: 255 }
      : { r: 120, g: 20, b: 20, a: 180 };

    draw.rect(cx - 3, py - h - 4, 6, 6, {
      fill: beaconColor,
      outline: { r: 255, g: 200, b: 200, a: 200 },
      outlineWidth: 1,
    });
    game.drawnSprites += 5;
  }
}
