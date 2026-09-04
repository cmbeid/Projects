// Port of OT::Item::Hotel (source/Item/Hotel.h / Hotel.cpp).
// Room state machine kClean/kOccupied/kDirty, 17:00 clearAll + capacity()
// guests with the absolute-time schedule (arrival/dinner/sleep/wake/checkout),
// housekeeping on dirty rooms, parking claims on arrival. NOTE: no direct
// room income in this codebase — revenue is indirect via restaurants.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { PriorityQueue } from "./pqueue.js";
import {
  Person,
  K_HOUSEKEEPER,
  K_MAN,
  K_WOMAN1,
  K_WOMAN2,
  K_WOMAN_WITH_CHILD1,
  KHOME,
  KSHOPPING,
  KRETURNING,
  KRESTING,
  KWORKING,
} from "../person.js";
import { claimReachableParking, releaseParking } from "./parking.js";
import { rand, randd } from "../../core/rand.js";
import { hourToAbsolute } from "../../core/time.js";

export const K_SINGLE = 0;
export const K_DOUBLE = 1;
export const K_SUITE = 2;

export const K_CLEAN = 0;
export const K_OCCUPIED = 1;
export const K_DIRTY = 2;

export class Guest extends Person {
  constructor(item) {
    super(item.game);
    this.hotel = item;
    this.arrivalTime = 0;
    this.dinnerLeaveTime = 0;
    this.dinnerReturnTime = 0;
    this.sleepTime = 0;
    this.wakeTime = 0;
    this.checkoutTime = 0;
    this.atHotel = false;
    this.parkingUsed = null;
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1];
    this.type = types[rand() % 4];
    this.from = "City";
    this.goingTo = item.prototype.name;
  }
}

export class Housekeeper extends Person {
  constructor(item) {
    super(item.game, K_HOUSEKEEPER);
    this.cleaningUntil = 0;
    this.cleaning = false;
    this.from = "Hotel Staff";
    this.goingTo = item.prototype.name;
  }
}

export class Hotel extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = K_SINGLE;
    this.subVariant = 0;
    this.roomState = K_CLEAN;
    this.dirtySince = 0;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.guests = new Set();
    this.arrivingGuests = new PriorityQueue((g) => g.arrivalTime);
    this.housekeeper = null;
  }

  destroy() {
    this.clearAll();
    super.destroy();
  }

  capacity() {
    switch (this.variant) {
      case K_SINGLE:
        return 1;
      case K_DOUBLE:
        return 2;
      case K_SUITE:
        return 3;
    }
    return 1;
  }

  applyVariant() {
    let sz = { x: 8, y: 1 };
    let tex = "simtower/double";
    switch (this.variant) {
      case K_SINGLE:
        sz = { x: 4, y: 1 };
        tex = "simtower/single";
        break;
      case K_DOUBLE:
        sz = { x: 6, y: 1 };
        tex = "simtower/double";
        break;
      case K_SUITE:
        sz = { x: 7, y: 1 };
        tex = "simtower/suite";
        break;
    }
    this.size = { x: sz.x, y: sz.y };
    this.sprite
      .setTexture(tex)
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  init() {
    this.variant = this.prototype.variant ?? K_SINGLE;
    this.subVariant = rand() % 2;
    this.roomState = K_CLEAN;
    this.dirtySince = 0;
    this.housekeeper = null;

    this.applyVariant();
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;

    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let frameWidth = 48;
    switch (this.variant) {
      case K_SINGLE:
        frameWidth = 32;
        break;
      case K_DOUBLE:
        frameWidth = 48;
        break;
      case K_SUITE:
        frameWidth = 56;
        break;
    }
    let row = this.roomState === K_DIRTY ? 1 : 0;
    if (this.variant === K_DOUBLE) row += this.subVariant * 2;

    let col = 0;
    if (this.roomState === K_OCCUPIED) {
      let resting = false;
      for (const g of this.guests) {
        if (g.state === KRESTING) {
          resting = true;
          break;
        }
      }
      col = resting ? 2 : 3;
    } else if (this.housekeeper && this.housekeeper.at === this && this.housekeeper.cleaning) {
      col = 1;
    }

    this.sprite
      .setTextureRect({ x: col * frameWidth, y: row * 24, w: frameWidth, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  scheduleGuest(g) {
    const today = Math.floor(this.game.time.absolute);

    // Arrival between 17:00 and 18:00.
    g.arrivalTime = today + randd(hourToAbsolute(17), hourToAbsolute(18));

    // Dinner: leave ~0.5h after arrival, return ~1h later.
    g.dinnerLeaveTime = g.arrivalTime + hourToAbsolute(0.5);
    g.dinnerReturnTime = g.dinnerLeaveTime + hourToAbsolute(1.0);

    // Sleep: between 23:00 and 1:30 next day.
    const nextDay = today + 1.0;
    g.sleepTime = today + randd(hourToAbsolute(23), 1.0 + hourToAbsolute(1.5));

    // Wake between 6:00 and 8:00 next morning.
    g.wakeTime = nextDay + randd(hourToAbsolute(6), hourToAbsolute(8));

    // Checkout between 8:00 and 10:00 next morning.
    g.checkoutTime = nextDay + randd(hourToAbsolute(8), hourToAbsolute(10));

    g.atHotel = false;
  }

  clearAll() {
    for (const g of this.guests) {
      releaseParking(g.parkingUsed);
      g.parkingUsed = null;
      g.destroy();
    }
    this.guests.clear();
    this.arrivingGuests.clear();
    if (this.housekeeper) {
      this.housekeeper.destroy();
      this.housekeeper = null;
    }
    this.roomState = K_CLEAN;
  }

  advance(dt) {
    const time = this.game.time;

    // Open at 17:00 — clean up yesterday's leftovers and spawn new guests.
    if (time.checkHour(17)) {
      this.clearAll();
      this.roomState = K_CLEAN;
      this.spriteNeedsUpdate = true;

      if (!this.lobbyRoute.empty()) {
        const n = this.capacity();
        for (let i = 0; i < n; i++) {
          const g = new Guest(this);
          this.scheduleGuest(g);
          this.guests.add(g);
          this.arrivingGuests.push(g);
        }
      }
    }

    // Dispatch arriving guests whose time has come.
    while (!this.arrivingGuests.empty()) {
      const g = this.arrivingGuests.top();
      if (time.absolute > g.arrivalTime && !this.lobbyRoute.empty()) {
        this.arrivingGuests.pop();
        g.journey.set(this.lobbyRoute);
        // Drive in: claim a reachable parking slot for the car.
        if (!g.parkingUsed) g.parkingUsed = claimReachableParking(this.game, this);
      } else break;
    }

    // Process guest schedules.
    const t = time.absolute;
    for (const g of this.guests) {
      // Return from dinner.
      if (!g.atHotel && t >= g.dinnerReturnTime && t < g.sleepTime) {
        if (g.at === null) {
          super.addPerson(g);
          g.atHotel = true;
          g.state = KHOME;
          g.eval = 50;
          this.roomState = K_OCCUPIED;
          this.spriteNeedsUpdate = true;
        }
      }
      // Leave for dinner.
      else if (g.atHotel && g.state === KHOME && t >= g.dinnerLeaveTime && t < g.dinnerReturnTime) {
        super.removePerson(g);
        g.atHotel = false;
        g.state = KSHOPPING;
        g.from = this.prototype.name;
        g.goingTo = "Restaurant";

        let bestRoute = null;
        let bestScore = 0;
        const restaurants = this.game.itemsByType.get("restaurant");
        if (restaurants) {
          for (const r of restaurants) {
            const candidate = this.game.findRoute(this, r);
            if (!candidate.empty() && (bestRoute === null || candidate.score() < bestScore)) {
              bestRoute = candidate;
              bestScore = candidate.score();
            }
          }
        }
        if (bestRoute !== null) {
          g.journey.set(bestRoute);
        } else {
          // No restaurant reachable - they leave the tower.
          const r = this.game.findRoute(this, this.game.mainLobby);
          if (!r.empty()) {
            g.state = KRETURNING;
            g.goingTo = "Exit";
            g.journey.set(r);
          }
        }
      }
      // Go to sleep.
      else if (g.atHotel && g.state === KHOME && t >= g.sleepTime && t < g.wakeTime) {
        g.state = KRESTING;
        // [PORT NOTE] ISSUE-037: the C++ Hotel.cpp:311-313 omits the
        // spriteNeedsUpdate flag here, leaving the room stuck on the
        // awake/standing column (col 3) all night. Flag the swap to the
        // resting column (col 2 = guest lying in bed) so guests visibly
        // lie down during the 23:00-07:00 sleep window.
        this.spriteNeedsUpdate = true;
      }
      // Wake up.
      else if (g.atHotel && g.state === KRESTING && t >= g.wakeTime && t < g.checkoutTime) {
        g.state = KHOME;
        this.spriteNeedsUpdate = true;
      }
      // Checkout — room becomes dirty.
      else if (g.atHotel && t >= g.checkoutTime) {
        const r = this.game.findRoute(this, this.game.mainLobby);
        if (!r.empty()) {
          super.removePerson(g);
          g.atHotel = false;
          g.state = KRETURNING;
          g.from = this.prototype.name;
          g.goingTo = "Exit";
          g.journey.set(r);
          // Drive home: free the parking slot.
          releaseParking(g.parkingUsed);
          g.parkingUsed = null;
        }
        this.roomState = K_DIRTY;
        this.dirtySince = t;
        this.spriteNeedsUpdate = true;
      }
    }

    // Dispatch a housekeeper when the room is dirty.
    if (this.roomState === K_DIRTY && this.housekeeper === null && !this.lobbyRoute.empty()) {
      const h = new Housekeeper(this);
      this.housekeeper = h;
      h.journey.set(this.lobbyRoute);
    }

    // Housekeeper finished cleaning?
    if (this.housekeeper && this.housekeeper.at === this && this.housekeeper.cleaning) {
      if (time.absolute >= this.housekeeper.cleaningUntil) {
        this.roomState = K_CLEAN;
        this.spriteNeedsUpdate = true;
        const r = this.game.findRoute(this, this.game.mainLobby);
        if (!r.empty()) {
          super.removePerson(this.housekeeper);
          this.housekeeper.state = KRETURNING;
          this.housekeeper.from = this.prototype.name;
          this.housekeeper.goingTo = "Exit";
          this.housekeeper.journey.set(r);
        }
        // Keep the pointer until the journey completes; deleted by clearAll()
        // on the next opening or when the item is destroyed.
      }
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  addPerson(p) {
    super.addPerson(p);

    if (p instanceof Guest) {
      const g = p;
      g.atHotel = true;
      g.state = KHOME;
      g.eval = 50;
      g.addStress(-5);
      this.roomState = K_OCCUPIED;
      this.spriteNeedsUpdate = true;
      return;
    }

    if (p instanceof Housekeeper) {
      const h = p;
      h.state = KWORKING;
      h.cleaning = true;
      h.cleaningUntil = this.game.time.absolute + hourToAbsolute(0.5);
      this.spriteNeedsUpdate = true;
      return;
    }
  }

  removePerson(p) {
    super.removePerson(p);

    if (p instanceof Guest) {
      p.atHotel = false;
    }
    if (p instanceof Housekeeper) {
      p.cleaning = false;
    }

    this.spriteNeedsUpdate = true;
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("variant", this.variant);
    xml.PushAttribute("subVariant", this.subVariant);
    xml.PushAttribute("roomState", this.roomState);
    xml.PushAttribute("dirtySince", this.dirtySince);

    for (const g of this.guests) {
      xml.OpenElement("guest");
      xml.PushAttribute("arrivalTime", g.arrivalTime);
      xml.PushAttribute("dinnerLeaveTime", g.dinnerLeaveTime);
      xml.PushAttribute("dinnerReturnTime", g.dinnerReturnTime);
      xml.PushAttribute("sleepTime", g.sleepTime);
      xml.PushAttribute("wakeTime", g.wakeTime);
      xml.PushAttribute("checkoutTime", g.checkoutTime);
      xml.PushAttribute("atHotel", g.atHotel);
      xml.PushAttribute("type", g.type);
      xml.PushAttribute("state", g.state);
      xml.PushAttribute("stress", g.stress);
      xml.PushAttribute("eval", g.eval);
      xml.PushAttribute("name", g.name);
      xml.PushAttribute("from", g.from);
      xml.PushAttribute("goingTo", g.goingTo);
      xml.CloseElement();
    }

    if (this.housekeeper) {
      const h = this.housekeeper;
      xml.OpenElement("housekeeper");
      xml.PushAttribute("cleaningUntil", h.cleaningUntil);
      xml.PushAttribute("cleaning", h.cleaning);
      xml.PushAttribute("atHotel", h.at === this);
      xml.PushAttribute("state", h.state);
      xml.PushAttribute("stress", h.stress);
      xml.PushAttribute("eval", h.eval);
      xml.PushAttribute("name", h.name);
      xml.PushAttribute("from", h.from);
      xml.PushAttribute("goingTo", h.goingTo);
      xml.CloseElement();
    }
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.variant = el.attrs.variant !== undefined ? parseInt(el.attrs.variant, 10) : (this.prototype.variant ?? 0);
    this.subVariant = el.attrs.subVariant !== undefined ? parseInt(el.attrs.subVariant, 10) : rand() % 2;
    // [PORT NOTE] conscious fix: the C++ reads roomState/dirtySince BEFORE
    // clearAll() and lets clearAll() wipe them (rooms always load clean).
    // Re-apply after clearAll so the persisted state survives, per spec.
    const savedRoomState =
      el.attrs.roomState !== undefined ? parseInt(el.attrs.roomState, 10) : K_CLEAN;
    const savedDirtySince =
      el.attrs.dirtySince !== undefined ? parseFloat(el.attrs.dirtySince) : 0.0;
    this.clearAll();
    this.roomState = savedRoomState;
    this.dirtySince = savedDirtySince;
    this.applyVariant();

    for (const e of el.children) {
      if (e.name !== "guest") continue;
      const g = new Guest(this);
      g.arrivalTime = parseFloat(e.attrs.arrivalTime);
      g.dinnerLeaveTime = parseFloat(e.attrs.dinnerLeaveTime);
      g.dinnerReturnTime = parseFloat(e.attrs.dinnerReturnTime);
      g.sleepTime = parseFloat(e.attrs.sleepTime);
      g.wakeTime = parseFloat(e.attrs.wakeTime);
      g.checkoutTime = parseFloat(e.attrs.checkoutTime);
      g.atHotel = e.attrs.atHotel === "true" || e.attrs.atHotel === "1";
      g.type = e.attrs.type !== undefined ? parseInt(e.attrs.type, 10) : 0;
      g.state = e.attrs.state !== undefined ? parseInt(e.attrs.state, 10) : 0;
      g.stress = e.attrs.stress !== undefined ? parseFloat(e.attrs.stress) : 0.0;
      g.eval = e.attrs.eval !== undefined ? parseFloat(e.attrs.eval) : 0.0;
      g.name = e.attrs.name ?? "";
      g.from = e.attrs.from ?? "";
      g.goingTo = e.attrs.goingTo ?? "";
      this.guests.add(g);
      if (g.atHotel) {
        super.addPerson(g);
        g.atHotel = true;
        // NOTE: parkingUsed is not persisted across save/reload (C++ bug
        // kept; Parking::used IS persisted, so slots leak until freed).
      } else {
        this.arrivingGuests.push(g);
      }
    }

    const he = el.children.find((c) => c.name === "housekeeper");
    if (he) {
      const h = new Housekeeper(this);
      h.cleaningUntil = parseFloat(he.attrs.cleaningUntil);
      h.cleaning = he.attrs.cleaning === "true" || he.attrs.cleaning === "1";
      h.state = he.attrs.state !== undefined ? parseInt(he.attrs.state, 10) : 0;
      h.stress = he.attrs.stress !== undefined ? parseFloat(he.attrs.stress) : 0.0;
      h.eval = he.attrs.eval !== undefined ? parseFloat(he.attrs.eval) : 0.0;
      h.name = he.attrs.name ?? "";
      h.from = he.attrs.from ?? "";
      h.goingTo = he.attrs.goingTo ?? "";
      this.housekeeper = h;
      if (he.attrs.atHotel === "true" || he.attrs.atHotel === "1") {
        super.addPerson(h);
      }
    }

    this.updateSprite();
  }

  dailyMaintenanceCost() {
    return 600;
  }

  getRandomBackgroundSoundPath() {
    return "";
  }
}
