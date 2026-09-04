// Port of OT::Item::Restaurant (source/Item/Restaurant.h / Restaurant.cpp).
// Opens 17:00 (no day-2 guard): customers = hotel guests (or room capacity
// for rooms with no guests yet but a lobby route), arrivals U(17,19) with the
// same 19:00 dispatch cut-off; hotel guests route back to their own room;
// closes 23:00 with income population*pricePerMeal - maintenance.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { PriorityQueue } from "./pqueue.js";
import { Person, K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1, KWANDERING, KSHOPPING, KRETURNING } from "../person.js";
import { rand, randd } from "../../core/rand.js";
import { K_BASE_SPEED, hourToAbsolute } from "../../core/time.js";
import { Hotel, Guest } from "./hotel.js";

// Authentic SimTower restaurant name variants (EXE Pascal strings 0xbaa02-0xbaa3d).
// The texture sheet only has 4 room rows, so the sprite row wraps (variant % 4).
export const RESTAURANT_VARIANTS = [
  "English Pub",
  "French Restaurant",
  "Chinese Restaurant",
  "Sushi Bar",
  "Steak House",
];

export class RestaurantCustomer extends Person {
  constructor(item) {
    super(item.game);
    this.arrivalTime = 0;
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1];
    this.type = types[rand() % 4];
    this.from = "City";
    this.goingTo = item.prototype.name;
  }
}

export class Restaurant extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = 0;
    this.open = false;
    this.pricePerMeal = 400;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.arrivingCustomers = new PriorityQueue((c) => c.arrivalTime);
    this.eatingCustomers = [];
    this.customers = new Set();
    this.customerMetadata = new Map();
  }

  destroy() {
    this.clearCustomers();
    super.destroy();
  }

  // Per-instance cosmetic identity: shallow-clone the shared prototype with
  // the variant name so UI reads of item.prototype.name (dialogs, tooltips)
  // show the authentic tenant name without affecting other instances.
  applyVariantName() {
    // Out-of-range variants (e.g. tampered saves) normalize to 0 — never a
    // stale name or undefined.
    const v =
      Number.isInteger(this.variant) && this.variant >= 0 && this.variant < RESTAURANT_VARIANTS.length
        ? this.variant
        : 0;
    this.prototype = { ...this.prototype, name: RESTAURANT_VARIANTS[v] };
  }

  init() {
    this.variant = rand() % RESTAURANT_VARIANTS.length;
    this.applyVariantName();
    this.open = false;
    this.pricePerMeal = 400;

    this.sprite
      .setTexture("simtower/restaurant")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;

    this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("variant", this.variant);
    xml.PushAttribute("open", this.open);
    xml.PushAttribute("pricePerMeal", this.pricePerMeal);
    xml.PushAttribute("population", this.population);

    for (const customer of this.customers) {
      const m = this.customerMetadata.get(customer);
      const eating = m !== undefined;
      const arriving = !eating && customer.at === null && customer.state === KWANDERING;
      if (!eating && !arriving) continue;

      xml.OpenElement("customer");
      xml.PushAttribute("lobbyArrival", customer.arrivalTime);
      xml.PushAttribute("type", customer.type);
      xml.PushAttribute("state", customer.state);
      xml.PushAttribute("stress", customer.stress);
      xml.PushAttribute("eval", customer.eval);
      xml.PushAttribute("name", customer.name);
      xml.PushAttribute("from", customer.from);
      xml.PushAttribute("goingTo", customer.goingTo);
      if (eating) {
        xml.PushAttribute("phase", "eating");
        xml.PushAttribute("itemArrival", m.arrivalTime);
      } else {
        xml.PushAttribute("phase", "arriving");
      }
      xml.CloseElement();
    }
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.variant = el.attrs.variant !== undefined ? parseInt(el.attrs.variant, 10) : 0;
    if (this.variant < 0 || this.variant >= RESTAURANT_VARIANTS.length) this.variant = 0;
    this.applyVariantName();
    this.open = el.attrs.open === "true" || el.attrs.open === "1";
    this.pricePerMeal =
      el.attrs.pricePerMeal !== undefined ? parseInt(el.attrs.pricePerMeal, 10) : 400;
    this.population = el.attrs.population !== undefined ? parseInt(el.attrs.population, 10) : 0;
    this.clearCustomers();

    for (const e of el.children) {
      if (e.name !== "customer") continue;
      const c = new RestaurantCustomer(this);
      c.arrivalTime = parseFloat(e.attrs.lobbyArrival);
      c.type = e.attrs.type !== undefined ? parseInt(e.attrs.type, 10) : K_MAN;
      c.state = e.attrs.state !== undefined ? parseInt(e.attrs.state, 10) : KWANDERING;
      c.stress = e.attrs.stress !== undefined ? parseFloat(e.attrs.stress) : 0.0;
      c.eval = e.attrs.eval !== undefined ? parseFloat(e.attrs.eval) : 0.0;
      c.name = e.attrs.name ?? "";
      c.from = e.attrs.from ?? "";
      c.goingTo = e.attrs.goingTo ?? "";

      this.customers.add(c);
      const phase = e.attrs.phase ?? "arriving";
      if (phase === "eating") {
        this.addPerson(c);
        this.customerMetadata.get(c).arrivalTime = parseFloat(e.attrs.itemArrival);
      } else {
        this.arrivingCustomers.push(c);
      }
    }

    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let index = 3;
    if (this.open) index = Math.min(Math.ceil(this.people.size / 5.0), 2);
    // ISSUE-035: 5 name variants share the 4-row restaurant sheet; row 4
    // (Steak House) falls back to row 0 art (ISSUE-024 missing-asset pattern).
    this.sprite
      .setTextureRect({ x: index * 192, y: (this.variant % 4) * 24, w: 192, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Open
    if (time.checkHour(17)) {
      this.open = true;
      this.spriteNeedsUpdate = true;

      // Create new customers for today: hotel guests with a route here.
      let today = 0;
      for (const item of this.game.items) {
        if (item instanceof Hotel) {
          if (!this.game.findRoute(item, this).empty()) {
            let roomPop = item.guests.size;
            if (roomPop === 0 && !item.lobbyRoute.empty()) {
              roomPop = item.capacity();
            }
            today += roomPop;
          }
        }
      }

      this.clearCustomers();
      for (let i = 0; i < today; i++) {
        const c = new RestaurantCustomer(this);
        c.arrivalTime =
          (time.year - 1) * 12 +
          (time.quarter - 1) * 3 +
          time.day +
          randd(hourToAbsolute(17), hourToAbsolute(19));
        this.customers.add(c);
        this.arrivingCustomers.push(c);
      }
    }

    // Close
    if (time.checkHour(23) && this.open) {
      this.open = false;
      this.population = this.customerMetadata.size;
      this.game.populationNeedsUpdate = true;
      this.spriteNeedsUpdate = true;

      this.game.transferFunds(
        this.population * this.pricePerMeal - this.dailyMaintenanceCost(),
        "retail_income",
        "Income from Restaurant",
      );
    }

    // Make customers arrive.
    while (!this.arrivingCustomers.empty()) {
      const c = this.arrivingCustomers.top();
      if (time.absolute > c.arrivalTime && !this.lobbyRoute.empty()) {
        this.arrivingCustomers.pop();
        if (time.hour < 19.0) {
          c.journey.set(this.lobbyRoute);
        } else {
          this.customers.delete(c);
          c.destroy();
        }
      } else break;
    }

    // Make customers leave once they're done.
    for (let i = 0; i < this.eatingCustomers.length; ) {
      const p = this.eatingCustomers[i];
      const m = this.customerMetadata.get(p);
      if (time.absolute >= m.arrivalTime + 20 * K_BASE_SPEED || !this.open) {
        let r;
        let guest = p instanceof Guest ? p : null;
        if (guest && guest.hotel) {
          r = this.game.findRoute(this, guest.hotel);
        } else {
          r = this.game.findRoute(this, this.game.mainLobby);
        }

        if (r.empty()) {
          i++;
        } else {
          this.eatingCustomers.splice(i, 1);
          this.removePerson(p);
          p.state = KRETURNING;
          p.from = this.prototype.name;
          if (guest && guest.hotel) {
            p.goingTo = guest.hotel.prototype.name;
          } else {
            p.goingTo = "Exit";
          }
          p.journey.set(r);
        }
      } else break;
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  addPerson(p) {
    super.addPerson(p);
    p.state = KSHOPPING;
    p.eval = 50;
    p.addStress(-10);
    this.customerMetadata.set(p, { arrivalTime: this.game.time.absolute });
    this.eatingCustomers.push(p);
    this.spriteNeedsUpdate = true;
  }

  removePerson(p) {
    super.removePerson(p);
    const i = this.eatingCustomers.indexOf(p);
    if (i >= 0) this.eatingCustomers.splice(i, 1);
    this.customerMetadata.delete(p);
    this.spriteNeedsUpdate = true;
  }

  clearCustomers() {
    for (const c of this.customers) c.destroy();
    this.arrivingCustomers.clear();
    this.eatingCustomers = [];
    this.customers.clear();
    this.customerMetadata.clear();
  }

  dailyMaintenanceCost() {
    return 800;
  }

  getRandomBackgroundSoundPath() {
    if (!this.open) return "";
    return "simtower/restaurant";
  }
}
