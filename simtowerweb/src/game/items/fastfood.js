// Port of OT::Item::FastFood (source/Item/FastFood.h / FastFood.cpp).
// Opens 10:00 (not day 2): 6 customers per occupied reachable office,
// arrivals U(12,13) absolute; dispatch cut-off at 19:00 (late arrivals are
// deleted); dwell 20*kBaseSpeed; closes 21:00 with income
// population*pricePerMeal - dailyMaintenanceCost (maintenance double-charged
// — kept 1:1).

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { PriorityQueue } from "./pqueue.js";
import { Person, K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1, KWANDERING, KLUNCH, KRETURNING } from "../person.js";
import { rand, randd } from "../../core/rand.js";
import { K_BASE_SPEED, hourToAbsolute } from "../../core/time.js";
import { Office } from "./office.js";

export class FastFoodCustomer extends Person {
  constructor(item) {
    super(item.game);
    this.arrivalTime = 0; // when the customer arrives at the tower lobby
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1];
    this.type = types[rand() % 4];
    this.from = "City";
    this.goingTo = item.prototype.name;
  }
}

// Authentic cosmetic tenant names (ISSUE-035, SIMTOWER.EXE 0xbac01-0xbac37).
// Mechanics are identical across variants; only the displayed name (and the
// sprite row) differs. The fastfood sheet has exactly 5 rows (512x120).
export const FASTFOOD_VARIANTS = [
  "Japanese Stall",
  "Chinese Cafe",
  "Hamburger Stand",
  "Ice Cream",
  "Coffee Shop",
];

export class FastFood extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = 0;
    this.open = false;
    this.pricePerMeal = 200;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.arrivingCustomers = new PriorityQueue((c) => c.arrivalTime);
    this.eatingCustomers = []; // ordered by arrival
    this.customers = new Set();
    this.customerMetadata = new Map(); // Person -> { arrivalTime }
  }

  destroy() {
    this.clearCustomers();
    super.destroy();
  }

  // ISSUE-035: per-instance cosmetic identity (see restaurant.js).
  applyVariantName() {
    // Out-of-range variants (e.g. tampered saves) normalize to 0 — never a
    // stale name or undefined.
    const v =
      Number.isInteger(this.variant) && this.variant >= 0 && this.variant < FASTFOOD_VARIANTS.length
        ? this.variant
        : 0;
    this.prototype = { ...this.prototype, name: FASTFOOD_VARIANTS[v] };
  }

  init() {
    this.variant = rand() % FASTFOOD_VARIANTS.length;
    this.applyVariantName();
    this.open = false;
    this.pricePerMeal = 200;

    this.sprite
      .setTexture("simtower/fastfood")
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
    if (this.variant < 0 || this.variant >= FASTFOOD_VARIANTS.length) this.variant = 0;
    this.applyVariantName();
    this.open = el.attrs.open === "true" || el.attrs.open === "1";
    this.pricePerMeal =
      el.attrs.pricePerMeal !== undefined ? parseInt(el.attrs.pricePerMeal, 10) : 200;
    this.population = el.attrs.population !== undefined ? parseInt(el.attrs.population, 10) : 0;
    this.clearCustomers();

    for (const e of el.children) {
      if (e.name !== "customer") continue;
      const c = new FastFoodCustomer(this);
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
    this.sprite
      .setTextureRect({ x: index * 128, y: this.variant * 24, w: 128, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Open
    if (time.checkHour(10) && time.day !== 2) {
      this.open = true;
      this.spriteNeedsUpdate = true;

      // Create new customers for today: 6 per occupied reachable office.
      let today = 0;
      if (time.day !== 2) {
        for (const item of this.game.items) {
          if (item instanceof Office) {
            if (item.population > 0 && !this.game.findRoute(item, this).empty()) {
              today += item.population;
            }
          }
        }
      }

      this.clearCustomers();
      for (let i = 0; i < today; i++) {
        const c = new FastFoodCustomer(this);
        c.arrivalTime =
          (time.year - 1) * 12 +
          (time.quarter - 1) * 3 +
          time.day +
          randd(hourToAbsolute(12), hourToAbsolute(13));
        this.customers.add(c);
        this.arrivingCustomers.push(c);
      }
    }

    // Close
    if (time.checkHour(21) && this.open) {
      this.open = false;
      this.population = this.customerMetadata.size;
      this.game.populationNeedsUpdate = true;
      this.spriteNeedsUpdate = true;

      this.game.transferFunds(
        this.population * this.pricePerMeal - this.dailyMaintenanceCost(),
        "retail_income",
        "Income from Fast Food",
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
          // Never dispatched after 19:00 — silently deleted.
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
        // Customers may leave for different destinations besides main lobby,
        // so this is not precomputed.
        const r = this.game.findRoute(this, this.game.mainLobby);
        if (r.empty()) {
          i++;
        } else {
          this.eatingCustomers.splice(i, 1);
          this.removePerson(p);
          p.state = KRETURNING;
          p.from = this.prototype.name;
          p.goingTo = "Exit";
          p.journey.set(r);
        }
      } else break;
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  addPerson(p) {
    super.addPerson(p);
    p.state = KLUNCH;
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
    return 500;
  }

  getRandomBackgroundSoundPath() {
    if (!this.open) return "";
    const paths = ["simtower/fastfood/0", "simtower/fastfood/1", "simtower/fastfood/2"];
    return paths[rand() % 3];
  }
}
