// Port of OT::Decorations (source/Decorations.h / Decorations.cpp).
// Three decoration families: fire stairs, crane, metro tracks.
// (Clouds and ambient sounds live in Sky, not here.)

import { viewBounds } from "./sky.js";

export class Decorations {
  constructor(game) {
    this.game = game;
    // floor y -> { minX, maxX } tile x-range for the fire stair pair
    this.fireStairs = new Map();
    this.cranePosition = { x: 0, y: 0 };
    this.craneVisible = false;
    this.trackY = 0;
    this.tracksVisible = false;
  }

  reset() {
    this.fireStairs.clear();
    this.craneVisible = false;
    this.tracksVisible = false;
  }

  // Reposition the fire stairs of the tower on this floor (called on every
  // floor add/remove/resize).
  updateFloor(y) {
    // No floor item -> remove any existing stairs.
    if (!this.game.floorItems.has(y)) {
      this.fireStairs.delete(y);
      return;
    }

    // Calculate the extent of the floor (y > 0 only; no stairs on the ground).
    if (y > 0) {
      const f = this.game.floorItems.get(y);
      const minFloorX = f.position.x;
      const maxFloorX = f.position.x + f.size.x; // C++ rect maxX is exclusive
      this.fireStairs.set(y, { minX: minFloorX, maxX: maxFloorX });
    }
  }

  // Update the crane on top of the tower. Call whenever the tower's top floor
  // changes (height change, floor placed/resized, or item placed on the top floor).
  updateCrane() {
    // Find the tower's top floor across both floorItems and itemsByFloor.
    let maxY = 0;
    if (this.game.floorItems) {
      for (const y of this.game.floorItems.keys()) {
        if (y > maxY) maxY = y;
      }
    }
    if (this.game.itemsByFloor) {
      for (const y of this.game.itemsByFloor.keys()) {
        if (y > maxY) maxY = y;
      }
    }

    if (maxY > 0) {
      let minFloorX = Number.MAX_SAFE_INTEGER;
      let maxFloorX = Number.MIN_SAFE_INTEGER;

      const f = this.game.floorItems?.get(maxY);
      if (f) {
        minFloorX = Math.min(minFloorX, f.position.x);
        maxFloorX = Math.max(maxFloorX, f.position.x + f.size.x);
      }

      const items = this.game.itemsByFloor?.get(maxY);
      if (items) {
        for (const i of items) {
          minFloorX = Math.min(minFloorX, i.position.x);
          maxFloorX = Math.max(maxFloorX, i.position.x + i.size.x);
        }
      }

      if (minFloorX < maxFloorX && maxFloorX - minFloorX >= 4) {
        this.cranePosition = {
          x: Math.trunc((minFloorX + maxFloorX) / 2) * 8,
          y: -(maxY + 1) * 36,
        };
        this.craneVisible = true;
      } else {
        this.craneVisible = false;
      }
    } else {
      this.craneVisible = false;
    }
  }

  updateTracks() {
    if (this.game.metroStation) {
      this.trackY = -this.game.metroStation.position.y * 36;
      this.tracksVisible = true;
    } else {
      this.tracksVisible = false;
    }
  }

  render(draw) {
    const game = this.game;
    const { dmin, dmax } = viewBounds(game, draw);

    // Fire stairs (two 24px halves of the 48px "simtower/deco/fireladder").
    for (let y = Math.floor(dmin.y / 36); y <= Math.ceil(dmax.y / 36); y++) {
      const floor = -y; // render space y is down; world floor y is up
      const fs = this.fireStairs.get(floor);
      if (!fs) continue;
      // Left half (texture 0..24), origin (24,36): extends left of minX.
      draw.image(
        "simtower/deco/fireladder",
        { x: 0, y: 0, w: 24, h: 36 },
        fs.minX * 8,
        -floor * 36,
        { origin: { x: 24, y: 36 } },
      );
      game.drawnSprites++;
      // Right half (texture 24..48), origin (0,36): extends right of maxX.
      draw.image(
        "simtower/deco/fireladder",
        { x: 24, y: 0, w: 24, h: 36 },
        fs.maxX * 8,
        -floor * 36,
        { origin: { x: 0, y: 36 } },
      );
      game.drawnSprites++;
    }

    // Crane on top of the tower.
    if (this.craneVisible) {
      draw.image("simtower/deco/crane", null, this.cranePosition.x, this.cranePosition.y, {
        origin: { x: 20, y: 36 },
      });
      game.drawnSprites++;
    }

    // Metro tracks tiling left and right of the station, clipped at the
    // station edge and the screen edge (Decorations.cpp:134-177).
    if (this.tracksVisible) {
      const station = game.metroStation;
      const rectMinX = station.position.x; // C++ rect.minX()
      const rectMaxX = station.position.x + station.size.x; // C++ rect.maxX() exclusive

      let minx = Math.floor(dmin.x / 32);
      let maxx = 0;
      if (minx < Math.floor(rectMinX / 4.0)) {
        // Tracks on the left of the station.
        maxx = Math.ceil(rectMinX / 4.0);
        for (let x = minx; x < maxx; x++) {
          const offl = Math.max(0, Math.trunc(dmin.x - x * 32));
          const offr = Math.max(0, (x + 1) * 4 - rectMinX) * 8;
          const w = 32 - offl - offr;
          if (w <= 0) continue;
          draw.image(
            "simtower/metro/tracks",
            { x: offl, y: 0, w, h: 36 },
            x * 32 + offl,
            this.trackY,
            { origin: { x: 0, y: 36 } },
          );
          game.drawnSprites++;
        }
      }

      minx = Math.floor(rectMaxX / 4.0);
      if (minx < Math.floor(dmax.x / 32)) {
        // Tracks on the right of the station.
        maxx = Math.ceil(dmax.x / 32);
        for (let x = minx; x < maxx; x++) {
          const offl = Math.max(0, rectMaxX - x * 4) * 8;
          const offr = Math.max(0, Math.trunc((x + 1) * 32 - dmax.x));
          const w = 32 - offl - offr;
          if (w <= 0) continue;
          draw.image(
            "simtower/metro/tracks",
            { x: offl, y: 0, w, h: 36 },
            x * 32 + offl,
            this.trackY,
            { origin: { x: 0, y: 36 } },
          );
          game.drawnSprites++;
        }
      }
    }
  }
}
