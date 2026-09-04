// Port of OT::Item::Office (source/Item/Office.h / Office.cpp).
// 6 workers (2 salesmen, 2 men, 2 women), rent/deposit economy, Monday-05:00
// rent & vacate, lunch dispatch to best-score fastfood, salesman trips,
// stress flee > 80, parking claims.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { PriorityQueue } from "./pqueue.js";
import {
  Person,
  K_SALESMAN,
  K_MAN,
  K_WOMAN1,
  K_WOMAN2,
  KWORKING,
  KRETURNING,
  KLUNCH,
  KWANDERING,
} from "../person.js";
import { claimReachableParking, releaseParking } from "./parking.js";
import { rand, randd } from "../../core/rand.js";
import { K_BASE_SPEED, hourToAbsolute } from "../../core/time.js";

const K_STRESS_FLEE_THRESHOLD = 80.0;

export class Worker extends Person {
  constructor(item, type) {
    super(item.game, type);
    this.arrivalTime = 0;
    this.departureTime = 0;
    this.leaveForSalesTime = -1; // absolute
    this.returnFromSalesTime = -1; // absolute
    this.lunchTime = 0;
    this.lunchReturnTime = -1;
    this.parkingUsed = null;
  }
}

export class Office extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.rent = game?.pricing?.officeRent ?? 10000;
    this.rentDeposit = this.rent;
    this.occupied = false;
    this.variant = 0;
    this.lit = false;
    this.sprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.workers = new Set();
    this.arrivalQueue = new PriorityQueue((w) => w.arrivalTime);
    this.departureQueue = new PriorityQueue((w) => w.departureTime);
    this.lunchQueue = new PriorityQueue((w) => w.lunchTime);
    this.lunchReturnQueue = new PriorityQueue((w) => w.lunchReturnTime);
    this.salesLeaveQueue = new PriorityQueue((w) => w.leaveForSalesTime);
    this.salesReturnQueue = new PriorityQueue((w) => w.returnFromSalesTime);
  }

  init() {
    this.variant = 0;
    this.occupied = false;
    this.lit = false;
    this.rent = this.game?.pricing?.officeRent ?? 10000;
    this.rentDeposit = this.rent;

    this.sprite
      .setTexture("simtower/office")
      .setOrigin(0, 24)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.spriteNeedsUpdate = false;

    // Create the workers.
    const types = [K_SALESMAN, K_SALESMAN, K_MAN, K_MAN, K_WOMAN1, K_WOMAN2];
    for (let i = 0; i < 6; i++) {
      this.workers.add(new Worker(this, types[i]));
    }
    this.rescheduleWorkers();

    this.updateSprite();
  }

  destroy() {
    // ~Office: get rid of the workers (frees their parking).
    for (const w of this.workers) {
      if (w.parkingUsed) {
        releaseParking(w.parkingUsed);
        w.parkingUsed = null;
      }
      w.destroy();
    }
    this.workers.clear();
    super.destroy();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("rent", this.rent);
    xml.PushAttribute("rentDeposit", this.rentDeposit);
    xml.PushAttribute("variant", this.variant);
    xml.PushAttribute("occupied", this.occupied);
    xml.PushAttribute("lit", this.lit);
    xml.PushAttribute("population", this.population);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.rent = el.attrs.rent !== undefined ? parseInt(el.attrs.rent, 10) : 0;
    this.rentDeposit =
      el.attrs.rentDeposit !== undefined ? parseInt(el.attrs.rentDeposit, 10) : 0;
    this.variant = el.attrs.variant !== undefined ? parseInt(el.attrs.variant, 10) : 0;
    this.occupied = el.attrs.occupied === "true" || el.attrs.occupied === "1";
    this.lit = el.attrs.lit === "true" || el.attrs.lit === "1";
    this.population =
      el.attrs.population !== undefined
        ? parseInt(el.attrs.population, 10)
        : this.occupied
          ? this.workers.size
          : 0;
    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    const indexX = this.lit ? 0 : 1;
    const indexY = this.occupied ? this.variant : 6;
    this.sprite
      .setTextureRect({ x: indexX * 72, y: indexY * 24, w: 72, h: 24 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Occupy the office if it is attractive enough.
    if (
      !this.occupied &&
      time.day !== 2 &&
      time.hour >= 7 &&
      time.hour < 17 &&
      this.isAttractive()
    ) {
      // 10% chance every 1/500th of a day -> occupied after ~1/250 day.
      if (time.checkTick(0.002) && rand() % 10 === 0) {
        this.occupied = true;
        this.variant = rand() % 6;
        this.lit = true;
        this.spriteNeedsUpdate = true;
        this.rentDeposit = this.rent;
        this.population = this.workers.size;
        this.game.populationNeedsUpdate = true;
        this.game.transferFunds(
          this.rentDeposit,
          "deposit_income",
          "Occupied Office's rent deposit",
        );
      }
    }

    // Monday 5:00 — rent is paid and unattractive offices vacate.
    if (this.occupied && time.checkHour(5) && time.day === 0) {
      if (!this.isAttractive()) {
        this.occupied = false;
        this.spriteNeedsUpdate = true;
        this.population = 0;
        this.game.populationNeedsUpdate = true;
        this.game.transferFunds(
          -this.rentDeposit,
          "deposit_refund",
          "Vacated Office's rent deposit paid back",
        );
      } else {
        this.game.transferFunds(this.rent, "rent_income", "Income from Office rent");
      }
    }

    // Reset worker schedules at 5:00 if the office is occupied.
    if (this.occupied && time.checkHour(5) && time.day !== 2) {
      this.rescheduleWorkers();
    }

    if (this.occupied) {
      // Make workers arrive.
      while (!this.arrivalQueue.empty()) {
        const c = this.arrivalQueue.top();
        if (time.hour > c.arrivalTime && !this.lobbyRoute.empty()) {
          this.arrivalQueue.pop();
          c.state = KWORKING;
          c.journey.set(this.lobbyRoute);
          // Drive in: claim a reachable parking slot for the car.
          if (!c.parkingUsed) c.parkingUsed = claimReachableParking(this.game, this);
        } else break;
      }

      // Make workers leave.
      while (!this.departureQueue.empty()) {
        const c = this.departureQueue.top();
        if (time.hour > c.departureTime) {
          this.departureQueue.pop();
          const r = this.game.findRoute(this, this.game.mainLobby);
          if (!r.empty()) {
            c.state = KRETURNING;
            c.journey.set(r);
            // Drive home: free the parking slot.
            releaseParking(c.parkingUsed);
            c.parkingUsed = null;
          }
        } else break;
      }

      // Lunch dispatch (non-salesmen).
      while (!this.lunchQueue.empty()) {
        const w = this.lunchQueue.top();
        if (time.hour > w.lunchTime) {
          this.lunchQueue.pop();
          let route = null;
          if (w.at === this && this.findLunchRoute()) {
            route = this._lunchRoute;
            w.state = KLUNCH;
            w.journey.set(route);
            w.lunchReturnTime = this.game.time.absolute + 10 * K_BASE_SPEED;
            this.lunchReturnQueue.push(w);
          } else {
            // Missed lunch = meaningful stress hit.
            w.addStress(15.0);
          }
        } else break;
      }

      // Lunch return.
      while (!this.lunchReturnQueue.empty()) {
        const w = this.lunchReturnQueue.top();
        if (this.game.time.check(w.lunchReturnTime)) {
          this.lunchReturnQueue.pop();
          if (w.at && w.at !== this) {
            const r = this.game.findRoute(w.at, this);
            if (r.empty()) {
              w.addStress(0.1);
            } else {
              w.state = KWORKING;
              w.journey.set(r);
            }
          }
        } else break;
      }

      // Make salesmen leave.
      while (!this.salesLeaveQueue.empty()) {
        const w = this.salesLeaveQueue.top();
        if (this.game.time.check(w.leaveForSalesTime) && !this.lobbyRoute.empty()) {
          this.salesLeaveQueue.pop();
          const r = this.game.findRoute(this, this.game.mainLobby);
          if (!r.empty()) {
            w.state = KWANDERING;
            w.journey.set(r);
            // Driving off for the sales trip - free the slot; re-claimed on
            // return.
            releaseParking(w.parkingUsed);
            w.parkingUsed = null;
          }
        } else break;
      }

      // Make salesmen return.
      while (!this.salesReturnQueue.empty()) {
        const w = this.salesReturnQueue.top();
        if (this.game.time.check(w.returnFromSalesTime) && !this.lobbyRoute.empty()) {
          this.salesReturnQueue.pop();
          w.state = KWORKING;
          w.journey.set(this.lobbyRoute);
          // Drive back in - try to claim a fresh slot.
          if (!w.parkingUsed) w.parkingUsed = claimReachableParking(this.game, this);
        } else break;
      }

      // Stress-flee: workers above the threshold head home for the day.
      // (Route computed every frame, as in the C++.)
      const homeRoute = this.game.findRoute(this, this.game.mainLobby);
      for (const w of this.workers) {
        if (
          w.at === this &&
          w.state === KWORKING &&
          w.stress > K_STRESS_FLEE_THRESHOLD &&
          !homeRoute.empty()
        ) {
          w.state = KRETURNING;
          w.goingTo = "Home (stressed)";
          w.journey.set(homeRoute);
          w.addStress(-10.0); // recovering on the way home
          releaseParking(w.parkingUsed);
          w.parkingUsed = null;
          this.game.ui.showMessage("Worker leaves a stressful office");
        }
      }
    }

    // Turn on the office lights.
    const shouldBeLit =
      (this.game.time.day !== 2 && this.game.time.hour >= 7 && this.game.time.hour < 17) ||
      this.people.size > 0;
    if (this.lit !== shouldBeLit) {
      this.lit = shouldBeLit;
      this.spriteNeedsUpdate = true;
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  // Returns whether the item will be vacated at the next month.
  isAttractive() {
    if (this.lobbyRoute.empty()) return false;
    const priceDelta = (this.rent - 10000) / 1000;
    const requiredEval = Math.max(10.0, 30.0 + priceDelta * 2.0);
    return this.evaluation >= requiredEval;
  }

  addPerson(p) {
    super.addPerson(p);

    p.state = KWORKING;
    // Reduce the person's stress a bit, just for the time being.
    p.stress *= 0.5;

    // If this was a salesman, set a sales leave and return time for him.
    if (p instanceof Worker && p.type === K_SALESMAN) {
      const w = p;
      if (w.leaveForSalesTime < 0) {
        w.leaveForSalesTime = this.game.time.absolute + randd(0.01, 0.02);
        this.salesLeaveQueue.push(w);
      }
      if (w.returnFromSalesTime < 0) {
        w.returnFromSalesTime =
          Math.floor(this.game.time.absolute) + randd(hourToAbsolute(13), hourToAbsolute(15));
        this.salesReturnQueue.push(w);
      }
    }
  }

  // Best-score route to any reachable fastfood; cached on this._lunchRoute.
  findLunchRoute() {
    let bestScore = 0;
    let route = null;
    const foodItems = this.game.itemsByType.get("fastfood");
    if (foodItems) {
      for (const f of foodItems) {
        const candidate = this.game.findRoute(this, f);
        if (!candidate.empty() && (route === null || candidate.score() < bestScore)) {
          route = candidate;
          bestScore = candidate.score();
        }
      }
    }
    this._lunchRoute = route;
    return route !== null;
  }

  prepareLunchQa(lunchHour) {
    this.occupied = true;
    this.lit = true;
    this.spriteNeedsUpdate = true;
    this.arrivalQueue.clear();
    this.departureQueue.clear();
    this.lunchQueue.clear();
    this.lunchReturnQueue.clear();
    this.salesLeaveQueue.clear();
    this.salesReturnQueue.clear();
    for (const w of this.workers) {
      w.stress = 0;
      w.leaveForSalesTime = -1;
      w.returnFromSalesTime = -1;
      w.lunchReturnTime = -1;
      if (!w.at) super.addPerson(w);
      if (w.type !== K_SALESMAN) {
        w.lunchTime = lunchHour;
        this.lunchQueue.push(w);
      }
    }
    this.population = this.workers.size;
    this.game.populationNeedsUpdate = true;
    this.updateSprite();
  }

  getRandomBackgroundSoundPath() {
    if (!this.lit || !this.occupied) return "";
    return "simtower/office";
  }

  dailyMaintenanceCost() {
    return 250;
  }

  isOccupied() {
    return this.occupied;
  }

  // Shuffles the schedule of all office workers for the current day.
  rescheduleWorkers() {
    this.arrivalQueue.clear();
    this.departureQueue.clear();
    this.lunchQueue.clear();
    this.lunchReturnQueue.clear();
    this.salesLeaveQueue.clear();
    this.salesReturnQueue.clear();

    for (const w of this.workers) {
      w.arrivalTime = randd(7, 8);
      w.departureTime = randd(17, 19);
      w.lunchTime = randd(12, 12.2);
      w.lunchReturnTime = -1;
      w.stress = 0;
      w.leaveForSalesTime = -1;
      w.returnFromSalesTime = -1;

      this.arrivalQueue.push(w);
      this.departureQueue.push(w);
      if (w.type !== K_SALESMAN) this.lunchQueue.push(w);
    }
  }
}
