// Port of OT::Item::Condo (source/Item/Condo.h / Condo.cpp).
// Sold (not rented) to residents: sale credits 2x price, Monday-05:00 buyback
// of -price if unattractive. Occupants: 1-4 adults + kids, jittered schedules
// regenerated at 03:00.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { PriorityQueue } from "./pqueue.js";
import {
  Person,
  K_MAN,
  K_WOMAN1,
  K_WOMAN2,
  K_CHILD,
  K_WOMAN_WITH_CHILD1,
  K_WOMAN_WITH_CHILD2,
  KHOME,
  KCOMMUTING,
  KRETURNING,
} from "../person.js";
import { rand, randi, randd } from "../../core/rand.js";

export const NIGHT = 0;
export const LIT = 1;
export const DAYTIME = 2;

// A Person living in a Condo item.
export class CondoOccupant extends Person {
  constructor(item, type, departureTime, returnTime) {
    super(item.game, type);
    this.departureTime = departureTime;
    this.returnTime = returnTime;
    this.departureJitter = 0.0;
    this.returnJitter = 0.0;
  }

  actualReturnTime() {
    return this.returnTime + this.returnJitter;
  }

  actualDepartureTime() {
    return this.departureTime + this.departureJitter;
  }
}

export class Condo extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.rent = 5000;
    this.rentDeposit = 5000;
    this.variant = 0;
    this.lighting = DAYTIME;
    this.occupied = false;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.occupants = new Set();
    this.departureQueue = new PriorityQueue((c) => c.actualDepartureTime());
    this.returnQueue = new PriorityQueue((c) => c.actualReturnTime());
  }

  init() {
    this.variant = rand() % 3;
    this.occupied = false;
    this.spriteNeedsUpdate = false;
    this.updateLighting(this.game.time.getHour());
    this.rent = 5000;
    this.rentDeposit = this.rent;

    this.sprite
      .setTexture("simtower/condo")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.updateSprite();
  }

  destroy() {
    // C++ ~Condo leaks the occupants; destroy them here so they don't linger
    // in game.people pointing at a removed item (conscious JS fix).
    this.removeOccupants();
    super.destroy();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("rent", this.rent);
    xml.PushAttribute("rentDeposit", this.rentDeposit);
    xml.PushAttribute("variant", this.variant);
    xml.PushAttribute("lighting", this.lighting);
    xml.PushAttribute("occupied", this.occupied);
    xml.PushAttribute("population", this.population);
  }

  decodeXML(el) {
    super.decodeXML(el);
    const hasPopulation = el.attrs.population !== undefined;
    this.rent = el.attrs.rent !== undefined ? parseInt(el.attrs.rent, 10) : 0;
    this.rentDeposit =
      el.attrs.rentDeposit !== undefined ? parseInt(el.attrs.rentDeposit, 10) : 0;
    this.variant = el.attrs.variant !== undefined ? parseInt(el.attrs.variant, 10) : 0;
    this.lighting =
      el.attrs.lighting !== undefined ? parseInt(el.attrs.lighting, 10) : DAYTIME;
    this.occupied = el.attrs.occupied === "true" || el.attrs.occupied === "1";
    if (this.occupied) {
      this.createOccupants();
      if (hasPopulation) this.population = parseInt(el.attrs.population, 10);
    } else {
      this.population = 0;
    }
    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let index = 0;
    if (this.occupied) {
      if (this.lighting === NIGHT) {
        index = 2; // occupied sleeping at night
      } else if (this.lighting === LIT) {
        index = 1; // warm evening lit interior with dining light
      } else {
        index = 0; // daytime occupied furnished room
      }
    } else {
      if (this.lighting === NIGHT || this.lighting === LIT) index = 4; // vacant night "For Sale"
      else index = 3; // vacant daytime "For Sale"
    }
    this.sprite
      .setTextureRect({ x: index * 128, y: this.variant * 24, w: 128, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Occupy the condo if it is attractive enough.
    if (
      !this.occupied &&
      time.day !== 2 &&
      time.hour >= 7 &&
      time.hour < 17 &&
      this.isAttractive()
    ) {
      if (time.checkTick(0.002) && rand() % 10 === 0) {
        this.occupied = true;
        this.variant = rand() % 3;
        this.spriteNeedsUpdate = true;
        this.rentDeposit = this.prototype.price * 2;
        this.game.transferFunds(
          this.rentDeposit,
          "condo_sale",
          "Income from " + this.prototype.name + " sale",
        );
        this.createOccupants();
      }
    }

    // Monday 5:00 — vacate unattractive condos (buyback at half the sale).
    if (this.occupied && time.checkHour(5) && time.day === 0) {
      if (!this.isAttractive()) {
        this.occupied = false;
        this.removeOccupants();
        this.spriteNeedsUpdate = true;
        this.population = 0;
        this.game.populationNeedsUpdate = true;
        this.game.transferFunds(
          -this.prototype.price,
          "condo_buyback",
          "Repurchased vacated " + this.prototype.name,
        );
      }
    }

    if (this.occupied && time.checkHour(3)) {
      this.generateJitters();
    }

    if (this.occupied) {
      this.moveOccupants();
    }

    if (this.updateLighting(time.getHour())) {
      this.spriteNeedsUpdate = true;
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  generateJitters() {
    this.returnQueue.clear();
    this.departureQueue.clear();

    const time = this.game.time;
    // On weekdays (day !== 2), schedule departure to work/school and evening return
    if (time.day !== 2) {
      for (const person of this.occupants) {
        // It's life. You're more likely to be late than early.
        person.departureJitter = randd(-0.1, 0.3);
        person.returnJitter = randd(-0.1, 0.3);
        this.returnQueue.push(person);
        this.departureQueue.push(person);
      }
    }
  }

  moveOccupants() {
    const time = this.game.time;

    // Occupants leave the building on weekdays
    while (!this.departureQueue.empty()) {
      const c = this.departureQueue.top();
      if (time.hour > c.actualDepartureTime()) {
        this.departureQueue.pop();
        if (this.lobbyRoute && !this.lobbyRoute.empty()) {
          const departRoute = this.game.findRoute(this, this.game.mainLobby);
          if (!departRoute.empty()) {
            c.state = KCOMMUTING;
            c.from = this.prototype.name;
            c.goingTo = "City";
            c.journey.set(departRoute);
          } else {
            this.removePerson(c);
          }
          this.spriteNeedsUpdate = true;
        }
      } else break;
    }

    // Occupants return from their busy days
    while (!this.returnQueue.empty()) {
      const c = this.returnQueue.top();
      if (time.hour > c.actualReturnTime() && this.lobbyRoute && !this.lobbyRoute.empty()) {
        this.returnQueue.pop();
        const returnRoute = this.game.findRoute(this.game.mainLobby, this);
        if (!returnRoute.empty()) {
          c.state = KRETURNING;
          c.from = "City";
          c.goingTo = this.prototype.name;
          c.journey.set(returnRoute);
        } else {
          this.addPerson(c);
        }
      } else break;
    }
  }

  updateLighting(time) {
    let newLighting = this.lighting;
    if (time < 7.0 || time > 22.0) newLighting = NIGHT;
    else if (time < 19.0) newLighting = DAYTIME;
    else newLighting = LIT;

    const retval = newLighting !== this.lighting;
    this.lighting = newLighting;
    return retval;
  }

  addPerson(p) {
    super.addPerson(p);
    p.state = KHOME;
    this.spriteNeedsUpdate = true;
  }

  removePerson(p) {
    super.removePerson(p);
    this.spriteNeedsUpdate = true;
  }

  createOccupants() {
    // Each Condo must have at least one adult.
    const numAdults = randi(1, 4);
    const adults = [K_MAN, K_WOMAN1, K_WOMAN2];
    for (let i = 0; i < numAdults; i++) {
      let gender;
      if (i === 0) {
        gender = Math.max(randi(0, 3) - 1, 0); // 50% man, 25% each woman
      } else if (i === 1) {
        // Diverse spouse/partner: if 1st was man -> woman, if 1st was woman -> man
        const first = this.occupants.values().next().value?.type;
        gender = first === K_MAN ? (randi(0, 1) === 0 ? 1 : 2) : 0;
      } else {
        gender = randi(0, 2);
      }
      const leavingTime = randd(7.5, 9.5);
      const returnTime = randd(17.5, 19.5);
      const occ = new this.OccupantClass(this, adults[gender], leavingTime, returnTime);
      occ.animOffset = (i * 0.37 + randd(0, 0.25)) % 1.0;
      this.occupants.add(occ);
      this.addPerson(occ);
    }

    // Kids never more than double the adults, total occupancy <= 6 kids.
    const numKids = randi(0, Math.min(numAdults * 2, 6));
    const kids = [K_CHILD, K_WOMAN_WITH_CHILD1, K_WOMAN_WITH_CHILD2];
    for (let i = 0; i < numKids; i++) {
      const type = randi(0, 2);
      // All schools begin and end at the same time; some kids have after
      // school care though.
      const leavingTime = 7.5;
      const returnTime = randi(0, 1) === 0 ? 15.5 : 17.5;
      const occ = new this.OccupantClass(this, kids[type], leavingTime, returnTime);
      occ.animOffset = ((i + numAdults) * 0.37 + randd(0, 0.25)) % 1.0;
      this.occupants.add(occ);
      this.addPerson(occ);
    }

    this.population = this.occupants.size;
    this.game.populationNeedsUpdate = true;
    this.generateJitters();
  }

  // Subclass hook: YootCondo swaps in its own occupant class.
  get OccupantClass() {
    return CondoOccupant;
  }

  removeOccupants() {
    for (const occupant of this.occupants) {
      occupant.destroy(); // removes from `at` and from game.people
    }
    // C++ Condo leaves a dangling set here; clearing is a conscious JS fix
    // (YootCondo::removeOccupants clears in the C++ too).
    this.occupants.clear();
  }

  // Returns whether the item will be vacated at the next month.
  isAttractive() {
    return !this.lobbyRoute.empty() && this.evaluation >= 30.0;
  }

  dailyMaintenanceCost() {
    return 150;
  }

  isOccupied() {
    return this.occupied;
  }
}
