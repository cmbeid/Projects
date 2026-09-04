// Port of OT::Item::YootCondo (source/Item/YootCondo.h / YootCondo.cpp).
// YootTower-art condo: same sale/vacate/occupant logic as Condo except
// - isAttractive() = route only (never vacates once reachable),
// - the C++ actualReturnTime()/actualDepartureTime() accessors are SWAPPED
//   (occupants live an inverted day) — replicated deliberately,
// - maintenance 0,
// - 41-frame resident strip render from the Condo.t2p plugin art.

import { Condo, CondoOccupant, DAYTIME, LIT } from "./condo.js";
import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { colorEqual } from "../sprite.js";
import { rand } from "../../core/rand.js";

export class YootCondoOccupant extends CondoOccupant {
  constructor(item, type, departureTime, returnTime) {
    super(item, type, departureTime, returnTime);
    this.posX = 10 + rand() % 100;
    // C++ overwrites the Person animOffset with an int rand()%40.
    this.animOffset = rand() % 40;
  }

  // [PORT NOTE] C++ bug replicated: the two accessors are swapped.
  actualReturnTime() {
    return this.departureTime + this.departureJitter;
  }

  actualDepartureTime() {
    return this.returnTime + this.returnJitter;
  }
}

export class YootCondo extends Condo {
  constructor(game, prototype) {
    super(game, prototype);
    this.baseSprite = new Sprite();
    this.residentSprite = new Sprite();
  }

  get OccupantClass() {
    return YootCondoOccupant;
  }

  init() {
    // YootCondo::init does NOT call the shared Condo sprite setup; it uses
    // the plugin textures instead.
    this.variant = rand() % 3;
    this.occupied = false;
    this.updateLighting(this.game.time.getHour());
    this.rent = 5000;
    this.rentDeposit = this.rent;

    this.baseSprite
      .setTexture("simtower/yootcondo/empty")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);

    this.residentSprite.setTexture("simtower/yootcondo/resident").setOrigin(8, 24);

    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let stateIndex = 0;
    if (this.occupied) {
      if (this.lighting === DAYTIME) stateIndex = this.people.size > 0 ? 2 : 0;
      else if (this.lighting === LIT) stateIndex = 3;
      else stateIndex = 4;
    } else {
      if (this.lighting === DAYTIME) stateIndex = 0;
      else stateIndex = 1; // LIT + NIGHT
    }
    const frameIndex = this.variant * 5 + stateIndex;
    this.baseSprite
      .setTextureRect({ x: 0, y: frameIndex * 24, w: 128, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  // YootCondo::addPerson does not set kHome; it just flags the sprite.
  addPerson(p) {
    Item.prototype.addPerson.call(this, p);
    this.spriteNeedsUpdate = true;
  }

  removePerson(p) {
    Item.prototype.removePerson.call(this, p);
    this.spriteNeedsUpdate = true;
  }

  moveOccupants() {
    const time = this.game.time;

    // Occupants leave
    while (!this.departureQueue.empty()) {
      const c = this.departureQueue.top();
      if (time.hour > c.actualDepartureTime()) {
        this.departureQueue.pop();
        if (this.lobbyRoute && !this.lobbyRoute.empty()) {
          c.from = this.prototype.name;
          c.goingTo = "City";
          this.removePerson(c);
          c.journey.set(this.lobbyRoute);
          this.spriteNeedsUpdate = true;
        }
      } else break;
    }

    // Occupants return.
    while (!this.returnQueue.empty()) {
      const c = this.returnQueue.top();
      if (time.hour > c.actualReturnTime() && this.lobbyRoute && !this.lobbyRoute.empty()) {
        this.returnQueue.pop();
        const r = this.game.findRoute(this, this.game.mainLobby);
        if (!r.empty()) {
          c.from = "City";
          c.goingTo = this.prototype.name;
          c.journey.set(r);
        }
      } else break;
    }
  }

  isAttractive() {
    // Yoot condos never vacate once reachable (no evaluation gate).
    return !this.lobbyRoute.empty();
  }

  dailyMaintenanceCost() {
    return 0;
  }

  render(draw) {
    const game = this.game;
    const tint = game.lighting.tint();
    const tinted = !colorEqual(tint, { r: 255, g: 255, b: 255, a: 255 });

    // Base sprite (plugin empty-condo strip), greys under hotel status mode.
    let color = tinted
      ? game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 })
      : null;
    if (game.statusMode === 3) {
      const composed = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
      color = {
        r: (composed.r * 110) >> 8,
        g: (composed.g * 110) >> 8,
        b: (composed.b * 110) >> 8,
        a: (composed.a * 160) >> 8,
      };
    }
    draw.sprite(this.baseSprite, color);
    game.drawnSprites++;

    // Occupants: 41 frames of 16x24, one per occupant currently home.
    if (this.occupied) {
      for (const occupant of this.occupants) {
        if (occupant.at === this) {
          const frameIdx =
            (Math.trunc(game.time.absolute * 400.0) + occupant.animOffset) % 41;
          const x = this.position.x * 8 + occupant.posX;
          const y = -this.position.y * 36;
          let rcolor = tinted
            ? game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 })
            : null;
          if (game.statusMode === 3) {
            const composed = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
            rcolor = {
              r: (composed.r * 110) >> 8,
              g: (composed.g * 110) >> 8,
              b: (composed.b * 110) >> 8,
              a: (composed.a * 160) >> 8,
            };
          }
          draw.image(
            "simtower/yootcondo/resident",
            { x: 0, y: frameIdx * 24, w: 16, h: 24 },
            x,
            y,
            { origin: { x: 8, y: 24 }, tint: rcolor },
          );
          game.drawnSprites++;
        }
      }
    }

    // Item::render tail (sprites set is empty for YootCondo; this draws the
    // generic AnimPeple occupants + noroute marker).
    super.render(draw);
  }
}
