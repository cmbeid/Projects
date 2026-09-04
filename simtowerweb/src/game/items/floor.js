// Port of OT::Item::Floor (source/Item/Floor.h / Floor.cpp).
// Exactly one Floor item per story (game.floorItems); `interval` is the
// multiset of x-endpoints of non-transport items on the floor (load-bearing
// for the Game.cpp construction checks — kept alongside the live-span render).

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { colorEqual } from "../sprite.js";

export class Floor extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.interval = []; // sorted multiset<int> of x extents
    this.layer = 0; // init() sets -1 (C++ sets it in init)
  }

  init() {
    this.layer = -1;
    this.interval = [];
    this.intervalInsert(this.position.x);
    this.intervalInsert(this.rectMaxX());
    this.updateSprite();
  }

  intervalInsert(x) {
    // insert keeping sorted (multiset semantics)
    let i = 0;
    while (i < this.interval.length && this.interval[i] < x) i++;
    this.interval.splice(i, 0, x);
  }

  intervalErase(x) {
    const i = this.interval.indexOf(x);
    if (i >= 0) this.interval.splice(i, 1);
  }

  updateSprite() {
    // C++ Floor::updateSprite() is empty — background/ceiling sprites are
    // configured conceptually in init and recomputed live in render().
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("width", this.size.x);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.size.x = el.attrs.width !== undefined ? parseInt(el.attrs.width, 10) : this.size.x;
    this.updateSprite();
  }

  canHaulPeople() {
    return false;
  }

  // Floor.cpp render: collect occupied spans (non-transport items clipped to
  // this floor), merge them, then draw the full floor tile under empty spans
  // and the ceiling tile (8x12) under occupied spans. The 8px-wide source
  // strip is tiled per tile instead of SFML-scale (visually identical for
  // integer multiples). Composed with the global lighting tint.
  render(draw) {
    const game = this.game;
    const tint = game.lighting.tint();
    const tinted = !colorEqual(tint, { r: 255, g: 255, b: 255, a: 255 });
    const tintColor = tinted ? game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) : null;

    const floorLeft = this.position.x;
    const floorRight = this.position.x + this.size.x;

    // Collect + sort occupied spans.
    const occupied = [];
    const itemsOnFloor = game.itemsByFloor.get(this.position.y);
    if (itemsOnFloor) {
      for (const item of itemsOnFloor) {
        if (item === this) continue;
        if (item.canHaulPeople()) continue;
        const left = Math.max(floorLeft, item.position.x);
        const right = Math.min(floorRight, item.position.x + item.size.x);
        if (left < right) occupied.push({ left, right });
      }
    }
    occupied.sort((a, b) => (a.left === b.left ? a.right - b.right : a.left - b.left));

    // Merge overlapping spans.
    const merged = [];
    for (const span of occupied) {
      const last = merged[merged.length - 1];
      if (!last || span.left > last.right) merged.push({ ...span });
      else if (span.right > last.right) last.right = span.right;
    }

    const yPx = -(this.position.y * 36);
    const drawTiles = (left, right, srcrect) => {
      for (let x = left; x < right; x++) {
        draw.image("simtower/floor", srcrect, x * 8, yPx, {
          origin: { x: 0, y: 36 },
          tint: tintColor,
        });
        game.drawnSprites++;
      }
    };
    const FULL = { x: 0, y: 0, w: 8, h: 36 };
    const CEIL = { x: 0, y: 0, w: 8, h: 12 };

    let cursor = floorLeft;
    for (const span of merged) {
      if (cursor < span.left) drawTiles(cursor, span.left, FULL);
      drawTiles(span.left, span.right, CEIL);
      cursor = span.right;
    }
    if (cursor < floorRight) drawTiles(cursor, floorRight, FULL);
  }
}
