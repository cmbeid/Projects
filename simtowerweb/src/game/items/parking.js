// Port of OT::Item::Parking (source/Item/Parking.h / Parking.cpp).
// Tower-wide car-slot resource: office workers and hotel guests claim slots
// through the shared claimReachableParking helper (exported below; mirrors the
// static helpers in Office.cpp / Hotel.cpp). Cars render as rectangles until
// proper car art ships (C++ does the same).

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { colorEqual } from "../sprite.js";
import { parkingRampServed } from "./parkingramp.js";

const K_SPACES_PER_TILE = 2;
const K_CAR_W = 5;
const K_CAR_H = 11;

export class Parking extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.used = 0;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
  }

  init() {
    this.used = 0;
    this.sprite
      .setTexture("simtower/parking/space")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;
    // setupGate() is a no-op stub in the C++ (no road item exists).
    this.updateSprite();
  }

  totalSpaces() {
    return this.size.x * K_SPACES_PER_TILE;
  }

  usedSpaces() {
    return this.used;
  }

  hasSpace() {
    return this.used < this.totalSpaces();
  }

  assignSpace() {
    if (!this.hasSpace()) return false;
    this.used++;
    this.spriteNeedsUpdate = true;
    return true;
  }

  freeSpace() {
    if (this.used > 0) {
      this.used--;
      this.spriteNeedsUpdate = true;
    }
  }

  advance(dt) {
    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("used", this.used);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.used = el.attrs.used !== undefined ? parseInt(el.attrs.used, 10) : 0;
    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    this.sprite
      .setTextureRect({ x: 0, y: 0, w: this.size.x * 8, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  isOccupied() {
    return false;
  }

  // Ramp coupling (ISSUE-032): a parking area only serves demand when a
  // ground-connected Parking Ramp touches it on the same floor.
  isRampServed() {
    return parkingRampServed(
      this.game,
      this.position.y,
      this.position.x,
      this.position.x + this.size.x,
    );
  }

  render(draw) {
    super.render(draw);
    if (this.underConstruction || this.used <= 0) return;

    const game = this.game;
    const tint = game.lighting.tint();
    const tinted = !colorEqual(tint, { r: 255, g: 255, b: 255, a: 255 });

    let body = { r: 50, g: 70, b: 130, a: 235 };
    let outline = { r: 20, g: 25, b: 45, a: 235 };
    if (tinted) body = game.lighting.compose(body);
    if (game.statusMode === 3) {
      // kHotel grey-out
      body = {
        r: (body.r * 110) >> 8,
        g: (body.g * 110) >> 8,
        b: (body.b * 110) >> 8,
        a: (body.a * 160) >> 8,
      };
      outline = {
        r: (outline.r * 110) >> 8,
        g: (outline.g * 110) >> 8,
        b: (outline.b * 110) >> 8,
        a: (outline.a * 160) >> 8,
      };
    }

    const baseX = this.position.x * 8;
    const baseY = -(this.position.y * 36);

    for (let i = 0; i < this.used; i++) {
      const tile = Math.floor(i / K_SPACES_PER_TILE);
      const slot = i % K_SPACES_PER_TILE;
      const carX = baseX + tile * 8 + 1 + slot * (K_CAR_W + 1);
      const carY = baseY - K_CAR_H - 4;
      draw.rect(carX, carY, K_CAR_W, K_CAR_H, { fill: body, outline, outlineWidth: 1 });
      game.drawnSprites++;
    }
  }
}

// Find a reachable Parking with a free slot and assign it to the requester.
// Mirrors the static claimReachableParking in Office.cpp / Hotel.cpp: iterate
// itemsByType["parking"], first with space + a route from the origin claims
// one slot. Ramp-connected areas only (ISSUE-032). Returns the claimed
// Parking or null.
export function claimReachableParking(game, origin) {
  const parkings = game.itemsByType.get("parking");
  if (!parkings) return null;
  for (const park of parkings) {
    if (!park.isRampServed()) continue; // "Not connected to Ramp"
    if (!park.hasSpace()) continue;
    if (game.findRoute(origin, park).empty()) continue;
    if (park.assignSpace()) return park;
  }
  return null;
}

export function releaseParking(park) {
  if (!park) return;
  park.freeSpace();
}
