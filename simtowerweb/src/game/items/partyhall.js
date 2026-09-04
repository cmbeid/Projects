// Port of OT::Item::PartyHall (source/Item/PartyHall.h / PartyHall.cpp).
// Two parties/day mirroring the cinema schedule: open 13/19 spawning 25
// visitors, close 17/23 with income attendees*200 - 1500.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import {
  Person,
  K_MAN,
  K_WOMAN1,
  K_WOMAN2,
  K_CHILD,
  K_WOMAN_WITH_CHILD1,
  KSHOPPING,
  KRETURNING,
} from "../person.js";
import { rand } from "../../core/rand.js";

const K_VISITOR_FEE = 200;
const K_EVENT_COST = 1500;
const K_VISITORS_PER_EVENT = 25;

export class PartyVisitor extends Person {
  constructor(hall) {
    super(hall.game);
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_CHILD, K_WOMAN_WITH_CHILD1];
    this.type = types[rand() % 5];
    this.from = "City";
    this.goingTo = hall.prototype.name;
  }
}

export class PartyHall extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.open = false;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.visitors = new Set();
  }

  destroy() {
    this.clearVisitors();
    super.destroy();
  }

  init() {
    this.open = false;

    this.sprite
      .setTexture("simtower/partyhall")
      .setOrigin(0, 60)
      .setPosition(0, 0);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;

    this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("open", this.open);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.open = el.attrs.open === "true" || el.attrs.open === "1";
    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let index = 0;
    if (this.open) {
      index = this.people.size > 0 ? 2 : 1;
    }
    this.sprite
      .setTextureRect({ x: index * 192, y: 0, w: 192, h: 60 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Two parties per day: afternoon 13:00-17:00 and evening 19:00-23:00.
    if (time.checkHour(13) || time.checkHour(19)) {
      this.open = true;
      this.spriteNeedsUpdate = true;

      // Spawn visitors for this session.
      this.clearVisitors();
      if (!this.lobbyRoute.empty()) {
        for (let i = 0; i < K_VISITORS_PER_EVENT; i++) {
          const v = new PartyVisitor(this);
          this.visitors.add(v);
          v.journey.set(this.lobbyRoute);
        }
      }
    }

    // Close
    if ((time.checkHour(17) || time.checkHour(23)) && this.open) {
      this.open = false;
      this.spriteNeedsUpdate = true;

      // Attendance-based income: visitors who actually made it into the hall.
      const attendees = this.people.size;
      const net = attendees * K_VISITOR_FEE - K_EVENT_COST;
      this.game.transferFunds(net, "entertainment_income", "Income from Party Hall");

      // Send visitors home.
      const r = this.game.findRoute(this, this.game.mainLobby);
      for (const v of this.visitors) {
        if (!r.empty()) {
          v.state = KRETURNING;
          v.from = this.prototype.name;
          v.goingTo = "Exit";
          if (v.at === this) {
            this.removePerson(v);
          }
          v.journey.set(r);
        }
      }
      // Visitors will be cleared on the next opening or on destruction.
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  getRandomBackgroundSoundPath() {
    if (!this.open) return "";
    return "simtower/partyhall";
  }

  addPerson(p) {
    super.addPerson(p);
    p.state = KSHOPPING;
    p.eval = 60;
    p.addStress(-15);
    this.spriteNeedsUpdate = true;
  }

  removePerson(p) {
    super.removePerson(p);
    this.spriteNeedsUpdate = true;
  }

  clearVisitors() {
    for (const v of this.visitors) v.destroy();
    this.visitors.clear();
  }

  dailyMaintenanceCost() {
    return 1000;
  }
}
