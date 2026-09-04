// Port of OT::Item::Metro (source/Item/Metro.h / Metro.cpp).
// Train cycle: 10-min dwell / 30-min gap (absolute time). Each arrival spawns
// 2-6 visitors bound for random reachable UNDERGROUND commercial venues;
// departure boards returned visitors at $50/head. Open 7:00-23:00.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import {
  Person,
  K_MAN,
  K_WOMAN1,
  K_WOMAN2,
  K_CHILD,
  KCOMMUTING,
  KSHOPPING,
  KRETURNING,
  KIDLE,
} from "../person.js";
import { rand, randd } from "../../core/rand.js";
import { hourToAbsolute } from "../../core/time.js";

// Train cadence in absolute-time units (~10 min dwell / ~30 min gap).
const K_TRAIN_DWELL_ABS = hourToAbsolute(10.0 / 60.0);
const K_TRAIN_GAP_ABS = hourToAbsolute(0.5);

// Dwell window the visitor spends at a commercial venue before heading back.
const K_VISITOR_MIN_DWELL = hourToAbsolute(0.25);
const K_VISITOR_MAX_DWELL = hourToAbsolute(0.75);

// Revenue per boarding passenger on departure.
const K_FARE_PER_BOARDING = 50;

// Underground commercial venue types (Metro.cpp pickDestinationFor).
const VENUE_TYPES = ["fastfood", "restaurant", "cinema", "partyhall"];

export class MetroVisitor extends Person {
  constructor(m) {
    super(m.game);
    this.arrivalTime = 0;
    this.departTime = 0;
    this.returnedToMetro = false;
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_CHILD];
    this.type = types[rand() % 4];
    this.from = "Metro";
    this.goingTo = "Tower";
  }
}

export class Metro extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.open = true;
    this.trainPresent = false;
    this.nextTrainTime = 0;
    this.station = new Sprite();
    this.platform = new Sprite();
    this.spriteNeedsUpdate = false;
    this.visitors = new Set();
  }

  destroy() {
    this.clearAllVisitors();
    super.destroy();
  }

  init() {
    this.open = true;
    this.trainPresent = false;
    this.nextTrainTime = this.game.time.absolute + K_TRAIN_GAP_ABS;

    this.station
      .setTexture("simtower/metro/station")
      .setOrigin(0, 66)
      .setPosition(0, 0);
    this.platform
      .setTexture("simtower/metro/station")
      .setOrigin(0, 30)
      .setPosition(0, 0);
    this.addSprite(this.station);
    this.addSprite(this.platform);
    this.spriteNeedsUpdate = true;

    // Defensive (C++ logs and refuses to clobber an existing station).
    if (this.game.metroStation) {
      // keep the existing station
    } else {
      this.game.metroStation = this;
    }

    this.updateSprite();
  }

  scheduleNextTrain() {
    this.nextTrainTime =
      this.game.time.absolute + (this.trainPresent ? K_TRAIN_DWELL_ABS : K_TRAIN_GAP_ABS);
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("open", this.open);
    xml.PushAttribute("trainPresent", this.trainPresent);
    xml.PushAttribute("nextTrainTime", this.nextTrainTime);

    for (const v of this.visitors) {
      xml.OpenElement("visitor");
      xml.PushAttribute("arrivalTime", v.arrivalTime);
      xml.PushAttribute("departTime", v.departTime);
      xml.PushAttribute("returnedToMetro", v.returnedToMetro);
      xml.PushAttribute("type", v.type);
      xml.PushAttribute("state", v.state);
      xml.PushAttribute("stress", v.stress);
      xml.PushAttribute("eval", v.eval);
      xml.PushAttribute("name", v.name);
      xml.PushAttribute("from", v.from);
      xml.PushAttribute("goingTo", v.goingTo);
      xml.CloseElement();
    }
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.open = el.attrs.open === "true" || el.attrs.open === "1";
    this.trainPresent = el.attrs.trainPresent === "true" || el.attrs.trainPresent === "1";
    this.nextTrainTime =
      el.attrs.nextTrainTime !== undefined
        ? parseFloat(el.attrs.nextTrainTime)
        : this.game.time.absolute + K_TRAIN_GAP_ABS;
    this.clearAllVisitors();

    for (const e of el.children) {
      if (e.name !== "visitor") continue;
      const v = new MetroVisitor(this);
      v.arrivalTime = parseFloat(e.attrs.arrivalTime);
      v.departTime = parseFloat(e.attrs.departTime);
      v.returnedToMetro = e.attrs.returnedToMetro === "true" || e.attrs.returnedToMetro === "1";
      v.type = e.attrs.type !== undefined ? parseInt(e.attrs.type, 10) : K_MAN;
      v.state = e.attrs.state !== undefined ? parseInt(e.attrs.state, 10) : 0;
      v.stress = e.attrs.stress !== undefined ? parseFloat(e.attrs.stress) : 0.0;
      v.eval = e.attrs.eval !== undefined ? parseFloat(e.attrs.eval) : 0.0;
      v.name = e.attrs.name ?? "";
      v.from = e.attrs.from ?? "";
      v.goingTo = e.attrs.goingTo ?? "";
      this.visitors.add(v);
    }

    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let stationIndex = 2;
    let platformIndex = 2;
    if (this.open) {
      stationIndex = 1;
      platformIndex = this.trainPresent ? 0 : 1;
    }

    this.station.setTextureRect({ x: stationIndex * 240, y: 0, w: 240, h: 66 });
    this.platform.setTextureRect({ x: platformIndex * 240, y: 66, w: 240, h: 30 });
    this.station.setPosition(this.position.x * 8, -this.position.y * 36);
    this.platform.setPosition(this.position.x * 8, -this.position.y * 36);
  }

  pickDestinationFor() {
    // Target underground commercial venues specifically.
    const reachable = [];
    for (const typeId of VENUE_TYPES) {
      const bucket = this.game.itemsByType.get(typeId);
      if (!bucket) continue;
      for (const item of bucket) {
        if (item.position.y < 0 && !this.game.findRoute(this, item).empty()) {
          reachable.push(item);
        }
      }
    }
    if (reachable.length === 0) return null;
    return reachable[rand() % reachable.length];
  }

  spawnVisitors(count) {
    if (this.lobbyRoute.empty()) return;

    for (let i = 0; i < count; i++) {
      const dest = this.pickDestinationFor();
      if (!dest) continue;

      const v = new MetroVisitor(this);
      v.arrivalTime = this.game.time.absolute;
      v.departTime = this.game.time.absolute + randd(K_VISITOR_MIN_DWELL, K_VISITOR_MAX_DWELL);
      v.state = KCOMMUTING;
      v.goingTo = dest.prototype.name;
      v.from = "Metro";

      const r = this.game.findRoute(this, dest);
      if (r.empty()) {
        v.destroy();
        continue;
      }
      v.journey.set(r);
      this.visitors.add(v);
    }
  }

  boardReturnedVisitors() {
    // Train departs: any visitor at the platform boards and is removed. Each
    // boarding yields fare revenue.
    let boardings = 0;
    for (const v of [...this.visitors]) {
      if (v.returnedToMetro || v.at === this) {
        boardings++;
        v.destroy();
        this.visitors.delete(v);
      }
    }

    if (boardings > 0) {
      this.game.transferFunds(
        boardings * K_FARE_PER_BOARDING,
        "metro_fare",
        "Metro passenger fares",
      );
    }
  }

  clearAllVisitors() {
    for (const v of this.visitors) v.destroy();
    this.visitors.clear();
  }

  advance(dt) {
    const time = this.game.time;

    // Open
    if (time.checkHour(7)) {
      this.open = true;
      this.spriteNeedsUpdate = true;
    }

    // Close
    if (time.checkHour(23) && this.open) {
      this.open = false;
      // Send any in-station train away (stranded visitors stay; the C++
      // comment claims clearing but the code only re-arms the train).
      if (this.trainPresent) {
        this.trainPresent = false;
        this.nextTrainTime = time.absolute + K_TRAIN_GAP_ABS;
        this.spriteNeedsUpdate = true;
      }
    }

    if (this.open) {
      // Train arrival / departure cycle.
      if (time.absolute >= this.nextTrainTime) {
        if (!this.trainPresent) {
          this.trainPresent = true;
          this.spriteNeedsUpdate = true;
          this.spawnVisitors(Math.trunc(randd(2, 6)));
        } else {
          this.trainPresent = false;
          this.spriteNeedsUpdate = true;
          this.boardReturnedVisitors();
        }
        this.scheduleNextTrain();
      }

      // Drive visitor state transitions.
      for (const v of this.visitors) {
        // Visitor has reached their commercial destination.
        if (v.state === KCOMMUTING && v.at && v.at !== this) {
          v.state = KSHOPPING;
          v.addStress(-5);
        }

        // Time to head back to the metro.
        if (v.state === KSHOPPING && time.absolute >= v.departTime) {
          const from = v.at ? v.at : this.game.mainLobby;
          const r = this.game.findRoute(from, this);
          if (!r.empty()) {
            v.state = KRETURNING;
            v.goingTo = "Metro";
            v.journey.set(r);
          } else {
            // No way back; force-flag so the next departure cleans them up.
            v.returnedToMetro = true;
          }
        }
      }
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  addPerson(p) {
    super.addPerson(p);

    if (p instanceof MetroVisitor && p.state === KRETURNING) {
      p.returnedToMetro = true;
      p.state = KIDLE;
    }
  }

  removePerson(p) {
    super.removePerson(p);
  }

  dailyMaintenanceCost() {
    return 5000;
  }
}
