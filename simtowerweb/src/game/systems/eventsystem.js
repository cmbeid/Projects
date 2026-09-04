// Port of OT::EventSystem (source/EventSystem.h / EventSystem.cpp).
// Random emergency events: fire and terror (bomb threat). Only one event is
// active at a time; events require a 2-star tower and non-empty world.

import { hourToAbsolute } from "../../core/time.js";
import { rand, randd } from "../../core/rand.js";
import { doubleAttr, boolAttr } from "../../core/xml.js";
import { KEVACUATING } from "../person.js";

export const TYPE = { NONE: 0, FIRE: 1, TERROR: 2, BURGLAR: 3, TREASURE: 4 };

// Scheduling tunables (EventSystem.cpp:26-30 + ISSUE-036 authentic triggers).
const K_MIN_RATING_FOR_EVENT = 1; // 2-star tower minimum
const K_EVENT_GAP_MIN_DAYS = 30.0; // ~4 in-game weeks (fires/burglars only)
const K_EVENT_GAP_MAX_DAYS = 90.0; // ~3 in-game months
const K_FIRST_EVENT_GAP_DAYS = 15.0; // first event comes sooner (discoverable)

// Authentic terrorist threat (ISSUE-036, docs/research/event-triggers.md):
// deterministic once-per-game event — weekend of Q4 in YEAR 5 at 10 AM;
// the bomb detonates at fixed 3 o'clock (15:00) the same day.
const K_TERROR_YEAR = 5;
const K_TERROR_QUARTER = 4;
const K_TERROR_WEEKEND_DAY = 2; // time.day === 2 is the weekend (TDT 3-day week)
const K_TERROR_TRIGGER_HOUR = 10.0;
const K_TERROR_DETONATION_HOUR = 15.0;

// Fire tunables.
const K_FIRE_SPREAD_HOURS = 0.25; // spread every ~15 game-minutes
const K_HELICOPTER_ARRIVE_HRS = 0.5; // ~30 game-min to arrive
const K_HELICOPTER_COST = 10000;
const K_MAX_BURNING_TILES = 12;
const K_FIRE_STRESS_PER_SEC = 8.0; // stress applied per real second
const K_SECURITY_QUENCH_HOURS = 1.0; // security extinguishes after ~1 game-hour
const K_BURNOUT_HOURS = 12.0; // unanswered, uncovered fire dies out eventually
const K_SECOM_SCAN_HOURS = 0.5; // SECOM bomb scan delay (~30 game-min)
const K_SECOM_DISPATCH_HOURS = 1.0; // SECOM defusal completes ~1 game-hour later

// Terror tunables.
const K_BOMB_DAMAGE_COST = 80000;
const K_BOMB_DAMAGE_RADIUS = 4; // tiles
const K_BOMB_STRESS_HIT = 40.0;

// Buried treasure (ISSUE-034, EXE string 0x7a03c): a windfall that can turn up
// while any item is under construction. Rolled once per game-day; the alert
// lingers for half a day before the event resolves.
const K_TREASURE_DAILY_PCT = 8; // % chance per day while construction is active
const K_TREASURE_MIN_THOUSANDS = 20;
const K_TREASURE_MAX_THOUSANDS = 100;
const K_TREASURE_DURATION_HOURS = 12.0;

function randDays(lo, hi) {
  return randd(lo, hi);
}

function tileToPixelX(x) {
  return x * 8.0;
}
function tileToPixelY(floor) {
  return -floor * 36.0;
}
// Encode a tile into a single key for the destroyed set.
function encodeTile(floor, x) {
  return floor * 100000 + x;
}

export class EventSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.type = TYPE.NONE;
    this.nextEventTime = 0;
    // Deterministic terrorist threat bookkeeping (ISSUE-036).
    this.terrorFired = false; // once per game
    this.pendingTerror = false; // trigger hit while another event was active
    // floor -> Set of burning x tiles
    this.burningTiles = new Map();
    this.fireOrigin = { x: 0, y: 0 };
    this.fireSpreadTimer = 0;
    this.fireAnimTime = 0;
    this.helicopterCalled = false;
    this.helicopterArriveTime = 0;
    // Tiles that have burned down (rendered as ruins; persists until reset).
    this.destroyedTiles = new Set();
    this.bombLocation = { x: 0, y: 0 };
    this.bombDetonateTime = 0;
    this.defused = false;
    this.ransom = 0;
    this.securityCovered = false;
    this.defuseRadius = 6;
    this.secomScanTime = 0;
    this.secomDispatchTime = 0;
    // Buried treasure bookkeeping (ISSUE-034).
    this.treasureOrigin = { x: 0, y: 0 };
    this.treasureEndTime = 0;
    this.lastTreasureDay = Math.floor(this.game.time.absolute);
    // Alert icon currently in use ("simtower/alerts/fire" | "terrorist" | "chopper" |
    // "treasure").
    this.alertKey = "simtower/alerts/fire";
    this.alertOrigin = { x: 38, y: 60 };
  }

  // ------------------------------------------------------------ scheduling

  scheduleNextEvent() {
    if (this.game.rating < K_MIN_RATING_FOR_EVENT) {
      this.nextEventTime = 0;
      return;
    }
    // Don't schedule if the tower is basically empty.
    if (this.game.items.size === 0) {
      this.nextEventTime = 0;
      return;
    }
    const gapDays = this.nextEventTime === 0
      ? K_FIRST_EVENT_GAP_DAYS
      : randDays(K_EVENT_GAP_MIN_DAYS, K_EVENT_GAP_MAX_DAYS);
    // absolute is day-based; hourToAbsolute clamps at 24h, so multi-day
    // gaps must be added as whole days (pre-existing clamp bug, ISSUE-036).
    this.nextEventTime = this.game.time.absolute + gapDays;
  }

  // Pick a random occupied tenant tile (structural items excluded).
  pickRandomTenantTile() {
    const candidates = [];
    for (const item of this.game.items) {
      if (item.underConstruction) continue;
      const id = item.prototype.id;
      if (id === "floor" || id === "lobby") continue;
      if (id.includes("elevator")) continue;
      if (id === "stairs" || id === "escalator") continue;
      candidates.push(item);
    }
    if (candidates.length === 0) return { x: 0, y: 0 };

    const picked = candidates[rand() % candidates.length];
    // Pick a tile within the item's footprint.
    const x = picked.position.x + (picked.size.x > 1 ? rand() % picked.size.x : 0);
    const y = picked.position.y;
    return { x, y };
  }

  startFire() {
    this.type = TYPE.FIRE;
    this.fireOrigin = this.pickRandomTenantTile();
    this.burningTiles.clear();
    this._burningInsert(this.fireOrigin.y, this.fireOrigin.x);
    this.fireSpreadTimer = hourToAbsolute(K_FIRE_SPREAD_HOURS);
    this.fireAnimTime = 0;
    this.helicopterCalled = false;
    this.helicopterArriveTime = 0;
    this.brigadeDeclined = false;
    this.securityArriveTime = 0;
    this.burnoutTime = 0;
    this.destroyedTiles.clear();

    this.alertKey = "simtower/alerts/fire";
    this.alertOrigin = { x: 38, y: 60 };

    for (const p of this.game.people) {
      if (p.at?.position?.y === this.fireOrigin.y) {
        p.state = KEVACUATING;
        p.addStress(30);
      }
    }

    // SECOM auto-senses fires (ISSUE-031, EXE dialog 0x78200).
    this.game.ui.showMessage(
      this.hasSecom()
        ? "SECOM has sensed a fire on floor " + this.fireOrigin.y + "! Everyone should take emergency refuge!"
        : "FIRE reported on floor " + this.fireOrigin.y + "!",
    );

    // Authentic response flow (ISSUE-036): the player is asked whether to
    // call the (paid) emergency fire crew. No hook (headless/legacy tests)
    // keeps the click-to-dispatch flow.
    const choice = this.game.ui.chooseFireResponse?.(K_HELICOPTER_COST);
    if (choice === true) {
      this.callFireCrew();
    } else if (choice === false) {
      this.brigadeDeclined = true;
      this._checkSecurityResponse();
      this.game.ui.showMessage("Fire crew declined — the fire keeps spreading!");
    }
  }

  // Dispatch the paid fire crew (the helicopter visual doubles as the crew).
  callFireCrew() {
    this.helicopterCalled = true;
    this.helicopterArriveTime =
      this.game.time.absolute + hourToAbsolute(K_HELICOPTER_ARRIVE_HRS);
    this.game.transferFunds(-K_HELICOPTER_COST, "emergency", "Emergency fire crew");
    this.game.ui.showMessage("Emergency fire crew called! Extinguishing in progress...");
    this.alertKey = "simtower/alerts/chopper";
    this.alertOrigin = { x: 62, y: 67 };
  }

  // Security offices fight fires (ISSUE-36): coverage within 15 floors
  // quenches the blaze after a delay when no crew is coming. With no
  // coverage the fire eventually burns itself out.
  _checkSecurityResponse() {
    for (const sec of this.game.itemsByType.get("security") || []) {
      if (sec.isCoveringFloor(this.fireOrigin.y)) {
        this.game.ui.showMessage("Security is attempting to quench the fire.");
        this.securityArriveTime =
          this.game.time.absolute + hourToAbsolute(K_SECURITY_QUENCH_HOURS);
        return;
      }
    }
    this.burnoutTime = this.game.time.absolute + hourToAbsolute(K_BURNOUT_HOURS);
  }

  startTerror() {
    this.type = TYPE.TERROR;
    this.terrorFired = true;
    this.pendingTerror = false;
    this.bombLocation = this.pickRandomTenantTile();
    // Fixed detonation at 3 o'clock (15:00) today (ISSUE-036).
    this.bombDetonateTime =
      Math.floor(this.game.time.absolute) + hourToAbsolute(K_TERROR_DETONATION_HOUR);
    this.defused = false;
    // Ransom demand, thousands-scale ($10k-$90k — EXE "$#000" placeholder).
    this.ransom = (1 + (rand() % 9)) * 10000;
    // Security coupling (ISSUE-033): coverage widens the defuse click radius
    // and dispatches investigators ("Security forces ... on their way").
    this.securityCovered = this.securityCoversFloor(this.bombLocation.y);
    this.defuseRadius = 6 + (this.securityCovered ? 3 : 0);
    // SECOM auto-scan (ISSUE-031): reveals the bomb and dispatches defusal.
    this.secomScanTime = this.hasSecom()
      ? this.game.time.absolute + hourToAbsolute(K_SECOM_SCAN_HOURS)
      : 0;
    this.secomDispatchTime = 0;

    this.alertKey = "simtower/alerts/terrorist";
    this.alertOrigin = { x: 38, y: 67 };

    this.game.ui.showMessage(
      "BOMB THREAT on floor " + this.bombLocation.y + "! Click the threat to defuse it!",
    );

    // Ransom choice (ISSUE-033, EXE dialog 0x78c00): "Find the Bomb" /
    // "Pay Them". No hook (headless/legacy) keeps the find-by-clicking flow.
    const choice = this.game.ui.chooseTerrorResponse?.({ ransom: this.ransom });
    if (choice === "pay") {
      this.game.transferFunds(-this.ransom, "emergency", "Terrorist ransom paid");
      this.game.ui.showMessage("The ransom was paid. The terrorists stood down.");
      this.endEvent();
      return;
    }
    if (this.securityCovered) {
      this.game.ui.showMessage(
        "Security forces from your Security Offices are on their way to find the bomb. Good luck...",
      );
    }
  }

  hasSecom() {
    return (this.game.itemsByType.get("secom")?.size ?? 0) > 0;
  }

  securityCoversFloor(floor) {
    for (const sec of this.game.itemsByType.get("security") || []) {
      if (sec.isCoveringFloor(floor)) return true;
    }
    return false;
  }

  startBurglar() {
    this.type = TYPE.BURGLAR;
    const targetTile = this.pickRandomTenantTile();
    this.alertKey = "simtower/alerts/terrorist";

    // Check if security guards cover this sector (a SECOM Center substitutes
    // for coverage — ISSUE-031).
    let covered = this.hasSecom();
    const securityItems = this.game.itemsByType.get("security") || [];
    for (const sec of securityItems) {
      if (sec.isCoveringFloor(targetTile.y)) {
        covered = true;
        break;
      }
    }

    if (covered) {
      this.game.transferFunds(10000, "vip", "Security Guard apprehended burglar!");
      this.game.ui.showMessage("Security Guard caught a burglar on floor " + targetTile.y + "! Reward: $10,000");
      this.game.playOnce?.("simtower/cash");
    } else {
      this.game.transferFunds(-50000, "event", "Burglary in unsecured sector");
      this.game.ui.showMessage("Burglary on floor " + targetTile.y + "! No security guard nearby! -$50,000");
      const itemsOnFloor = this.game.itemsByFloor.get(targetTile.y) || [];
      for (const item of itemsOnFloor) {
        item.evaluation = Math.max(0, item.evaluation - 20);
        for (const p of item.people) p.addStress(40);
      }
    }
    this.endEvent();
  }

  // Pick a random tile inside a random item that is under construction.
  pickRandomConstructionTile() {
    const candidates = [];
    for (const item of this.game.items) {
      if (item.underConstruction) candidates.push(item);
    }
    if (candidates.length === 0) return null;
    const picked = candidates[rand() % candidates.length];
    const x = picked.position.x + (picked.size.x > 1 ? rand() % picked.size.x : 0);
    const y = picked.position.y;
    return { x, y };
  }

  // Buried treasure (ISSUE-034): rolled once per game-day while any item is
  // under construction. Deterministic under an injected RNG (headless tests).
  _checkTreasure() {
    const today = Math.floor(this.game.time.absolute);
    if (today === this.lastTreasureDay) return;
    this.lastTreasureDay = today;
    if (!this.pickRandomConstructionTile()) return; // nothing being built
    if (rand() % 100 >= K_TREASURE_DAILY_PCT) return;
    this.startTreasure();
  }

  startTreasure() {
    const origin = this.pickRandomConstructionTile();
    if (!origin) return;
    this.type = TYPE.TREASURE;
    this.treasureOrigin = origin;
    this.treasureEndTime =
      this.game.time.absolute + hourToAbsolute(K_TREASURE_DURATION_HOURS);
    const amount =
      (K_TREASURE_MIN_THOUSANDS + (rand() % (K_TREASURE_MAX_THOUSANDS - K_TREASURE_MIN_THOUSANDS + 1))) * 1000;

    this.alertKey = "simtower/alerts/treasure";
    this.alertOrigin = { x: 38, y: 60 };

    this.game.transferFunds(amount, "treasure", "Buried treasure discovered");
    this.game.ui.showMessage(
      "During construction, workers discovered ancient buried treasure! It sold for $" +
        amount.toLocaleString("en-US") +
        ".",
    );
    this.game.playOnce?.("simtower/cash");
  }

  _burningInsert(floor, x) {
    let set = this.burningTiles.get(floor);
    if (!set) {
      set = new Set();
      this.burningTiles.set(floor, set);
    }
    set.add(x);
  }

  spreadFire() {
    // NOTE: 1:1 with C++ — this checks the map size (floor count), not the
    // tile count, despite the kMaxBurningTiles name.
    if (this.burningTiles.size >= K_MAX_BURNING_TILES) return;

    // Gather all currently-burning tiles, then pick a random one and try to
    // spread to an adjacent tile.
    const burning = [];
    for (const [floor, xs] of this.burningTiles) {
      for (const x of xs) burning.push([floor, x]);
    }
    if (burning.length === 0) return;

    const src = burning[rand() % burning.length];
    // Candidate spread directions: left, right, up, down.
    const dx = [-1, 1, 0, 0];
    const dy = [0, 0, 1, -1];
    const dir = rand() % 4;
    const nx = src[1] + dx[dir];
    const ny = src[0] + dy[dir];

    // Only spread if there's something at that tile (check itemsByFloor).
    const itemsOnFloor = this.game.itemsByFloor.get(ny);
    if (!itemsOnFloor) return;
    let occupied = false;
    for (const i of itemsOnFloor) {
      const r = i.getRect();
      if (nx >= r.x && nx < r.x + r.w) {
        occupied = true;
        break;
      }
    }
    if (!occupied) return;

    this._burningInsert(ny, nx);
  }

  applyFireStress(dt) {
    // Increase stress for every person located at a burning tile's item.
    const stress = K_FIRE_STRESS_PER_SEC * dt;
    for (const [floor, xs] of this.burningTiles) {
      const itemsOnFloor = this.game.itemsByFloor.get(floor);
      if (!itemsOnFloor) continue;
      for (const item of itemsOnFloor) {
        const r = item.getRect();
        // Check if any burning x falls within this item.
        let hit = false;
        for (const x of xs) {
          if (x >= r.x && x < r.x + r.w) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
        item.evaluation = Math.max(0.0, item.evaluation - stress);
        for (const p of item.people) p.addStress(stress);
      }
    }
  }

  endEvent() {
    if (this.type === TYPE.FIRE) {
      // Authentic outcome text (ISSUE-036, EXE dialog 0x78800): emergency
      // fire stairs on the burning floor mean no one was injured.
      const stairs =
        this.fireOrigin.y > 0 && this.game.floorItems.has(this.fireOrigin.y);
      if (stairs) {
        this.game.ui.showMessage(
          "The fire was stopped. Because your building has emergency stairs, no one was injured, but the tower is damaged.",
        );
      } else {
        this.game.ui.showMessage(
          "The fire was stopped. There were injuries and the tower is damaged.",
        );
      }
      // Mark burned tiles as destroyed for visual continuity.
      for (const [floor, xs] of this.burningTiles) {
        for (const x of xs) this.destroyedTiles.add(encodeTile(floor, x));
      }
    }
    this.type = TYPE.NONE;
    this.burningTiles.clear();
    this.helicopterCalled = false;
    this.brigadeDeclined = false;
    this.securityArriveTime = 0;
    this.burnoutTime = 0;
    this.scheduleNextEvent();
    // A terrorist trigger that hit while this event was active fires now.
    if (this.pendingTerror && !this.terrorFired) this.startTerror();
  }

  // ------------------------------------------------------------- advance

  advance(dt) {
    // --- Deterministic terrorist threat (ISSUE-036): Y5/Q4/weekend 10 AM,
    // once per game. If another event is active, it fires when that ends.
    if (!this.terrorFired) {
      const t = this.game.time;
      if (
        t.year === K_TERROR_YEAR &&
        t.quarter === K_TERROR_QUARTER &&
        t.day === K_TERROR_WEEKEND_DAY &&
        t.checkHour(K_TERROR_TRIGGER_HOUR)
      ) {
        if (this.type === TYPE.NONE) this.startTerror();
        else this.pendingTerror = true;
      }
    }

    // --- Random scheduling (fires and burglars only) ---
    if (this.type === TYPE.NONE) {
      // Buried treasure can surface while the crew is busy building (ISSUE-034).
      this._checkTreasure();
      if (this.nextEventTime === 0) {
        this.scheduleNextEvent();
      }
      if (this.nextEventTime > 0 && this.game.time.absolute >= this.nextEventTime) {
        const roll = rand() % 100;
        if (roll < 50) this.startFire();
        else this.startBurglar();
      }
      return;
    }

    // --- Active event progression ---
    this.fireAnimTime += dt;

    if (this.type === TYPE.TREASURE) {
      // The windfall is instantaneous; the alert just lingers a while.
      if (this.game.time.absolute >= this.treasureEndTime) {
        this.endEvent();
        return;
      }
    } else if (this.type === TYPE.FIRE) {
      // Spread.
      this.fireSpreadTimer -= this.game.time.dta;
      if (this.fireSpreadTimer <= 0) {
        this.spreadFire();
        this.fireSpreadTimer = hourToAbsolute(K_FIRE_SPREAD_HOURS);
      }
      // Stress.
      this.applyFireStress(dt);
      // Fire crew (brigade/helicopter) arrival.
      if (this.helicopterCalled && this.game.time.absolute >= this.helicopterArriveTime) {
        this.endEvent();
        return;
      }
      // Security quenching after the crew was declined.
      if (
        this.brigadeDeclined &&
        this.securityArriveTime > 0 &&
        this.game.time.absolute >= this.securityArriveTime
      ) {
        this.endEvent();
        return;
      }
      // Burnout: an unanswered, uncovered fire dies out on its own.
      if (
        this.brigadeDeclined &&
        this.burnoutTime > 0 &&
        this.game.time.absolute >= this.burnoutTime
      ) {
        this.endEvent();
        return;
      }
    } else if (this.type === TYPE.TERROR) {
      // SECOM auto-scan (ISSUE-031): reveal the bomb, dispatch defusal.
      if (
        this.secomScanTime > 0 &&
        this.game.time.absolute >= this.secomScanTime &&
        !this.defused
      ) {
        this.secomScanTime = 0;
        this.alertOrigin = { x: this.bombLocation.x, y: this.bombLocation.y };
        this.game.ui.showMessage(
          "Secom System Now Scanning....\nA bomb has been found on floor " +
            this.bombLocation.y +
            ".\nSecurity is on its way to diffuse the bomb.",
        );
        this.secomDispatchTime =
          this.game.time.absolute + hourToAbsolute(K_SECOM_DISPATCH_HOURS);
      }
      // SECOM defusal completes before the 15:00 deadline -> success.
      if (
        this.secomDispatchTime > 0 &&
        this.game.time.absolute >= this.secomDispatchTime &&
        !this.defused
      ) {
        this.defused = true;
        this.game.ui.showMessage(
          "Because you have enough Security Offices in your tower, Security Forces found the bomb. Good work!",
        );
        this.endEvent();
        return;
      }
      // Detonation at the fixed 15:00 deadline.
      if (this.game.time.absolute >= this.bombDetonateTime && !this.defused) {
        // Detonation.
        this.game.transferFunds(-K_BOMB_DAMAGE_COST, "emergency", "Bomb damage repairs");
        // Stress everyone nearby.
        const itemsOnFloor = this.game.itemsByFloor.get(this.bombLocation.y);
        if (itemsOnFloor) {
          for (const item of itemsOnFloor) {
            const r = item.getRect();
            const dist = Math.min(
              Math.abs(r.x - this.bombLocation.x),
              Math.abs(r.x + r.w - this.bombLocation.x),
            );
            if (dist <= K_BOMB_DAMAGE_RADIUS) {
              item.evaluation = Math.max(0.0, item.evaluation - 30.0);
              for (const p of item.people) p.addStress(K_BOMB_STRESS_HIT);
            }
          }
        }
        this.game.ui.showMessage(
          this.securityCovered || this.secomDispatchTime > 0
            ? "Security was not able to find the bomb in time. The bomb has exploded on floor " +
              this.bombLocation.y +
              "!"
            : "The bomb has exploded on floor " + this.bombLocation.y + "! Extensive damage reported.",
        );
        this.endEvent();
      }
    }
  }

  // ------------------------------------------------------------- click

  // Handle a click at the given tile coordinate. Returns true if consumed.
  handleClick(tile) {
    if (this.type === TYPE.FIRE && !this.helicopterCalled) {
      // Accept a click anywhere within the burning area or near it.
      let near = false;
      outer: for (const [floor, xs] of this.burningTiles) {
        for (const x of xs) {
          if (Math.abs(tile.x - x) <= 6 && Math.abs(tile.y - floor) <= 2) {
            near = true;
            break outer;
          }
        }
      }
      if (near) {
        this.helicopterCalled = true;
        this.helicopterArriveTime =
          this.game.time.absolute + hourToAbsolute(K_HELICOPTER_ARRIVE_HRS);
        this.game.transferFunds(-K_HELICOPTER_COST, "emergency", "Helicopter dispatch");
        this.game.ui.showMessage("Helicopter dispatched! Extinguishing in progress...");
        this.alertKey = "simtower/alerts/chopper";
        this.alertOrigin = { x: 62, y: 67 };
        return true;
      }
    } else if (this.type === TYPE.TERROR && !this.defused) {
      // Defuse if the click is near the bomb (radius widened by security
      // coverage — ISSUE-033).
      if (
        Math.abs(tile.x - this.bombLocation.x) <= this.defuseRadius &&
        Math.abs(tile.y - this.bombLocation.y) <= 2
      ) {
        this.defused = true;
        this.game.ui.showMessage(
          this.securityCovered
            ? "Because you have enough Security Offices in your tower, Security Forces found the bomb. Good work!"
            : "Bomb defused! Crisis averted.",
        );
        this.endEvent();
        return true;
      }
    }
    return false;
  }

  isActive() {
    return this.type !== TYPE.NONE;
  }

  getActiveType() {
    return this.type;
  }

  // ------------------------------------------------------------- render

  render(draw) {
    const game = this.game;
    if (this.type === TYPE.NONE) {
      // Ruins from previous fires would be drawn here, but (as in the C++
      // fork) EventSystem::draw returns early while no event is active, so
      // destroyedTiles are bookkeeping only.
      return;
    }

    if (this.type === TYPE.FIRE) {
      // Fire animation: cycle 4 frames of 96px each from the 384px strip.
      const frame = Math.trunc(this.fireAnimTime * 12.0) % 4;
      const fireRect = { x: frame * 96, y: 0, w: 96, h: 36 };
      const origin = { x: 48, y: 36 };

      // Main blaze at the origin.
      draw.image(
        "simtower/fire/large",
        fireRect,
        tileToPixelX(this.fireOrigin.x),
        tileToPixelY(this.fireOrigin.y),
        { origin },
      );
      game.drawnSprites++;

      // Additional fire markers for spread tiles (excluding the origin).
      for (const [floor, xs] of this.burningTiles) {
        for (const x of xs) {
          if (x === this.fireOrigin.x && floor === this.fireOrigin.y) continue;
          draw.image(
            "simtower/fire/large",
            fireRect,
            tileToPixelX(x),
            tileToPixelY(floor),
            { origin },
          );
          game.drawnSprites++;
        }
      }

      // Helicopter approaching, sweeping in from the upper-left.
      if (this.helicopterCalled) {
        let progress = 1.0;
        const remaining = this.helicopterArriveTime - game.time.absolute;
        const total = hourToAbsolute(K_HELICOPTER_ARRIVE_HRS);
        if (total > 0) progress = 1.0 - remaining / total;
        progress = Math.max(0.0, Math.min(1.0, progress));
        const destX = tileToPixelX(this.fireOrigin.x);
        const destY = tileToPixelY(this.fireOrigin.y);
        draw.image(
          "simtower/fire/chopper",
          null,
          destX - 200.0 * (1.0 - progress),
          destY - 80.0 * (1.0 - progress),
          { origin: { x: 48, y: 36 } },
        );
        game.drawnSprites++;

        if (progress > 0.5) {
          draw.rect(destX - 12, destY - 40, 24, 40, { fill: { r: 100, g: 200, b: 255, a: 180 } });
          game.drawnSprites++;
        }
      }

      // Alert icon floating above the blaze until dispatched.
      if (!this.helicopterCalled) {
        draw.image(
          "simtower/alerts/fire",
          null,
          tileToPixelX(this.fireOrigin.x),
          tileToPixelY(this.fireOrigin.y) - 40.0,
          { origin: { x: 38, y: 60 } },
        );
        game.drawnSprites++;
      }
    } else if (this.type === TYPE.TERROR) {
      // Blinking alert (2 Hz) at the bomb location.
      const blink = Math.trunc(this.fireAnimTime * 4.0) % 2 === 0;
      if (blink) {
        draw.image(
          "simtower/alerts/terrorist",
          null,
          tileToPixelX(this.bombLocation.x),
          tileToPixelY(this.bombLocation.y) - 40.0,
          { origin: { x: 38, y: 67 } },
        );
        game.drawnSprites++;
      }
    } else if (this.type === TYPE.TREASURE) {
      // Blinking treasure alert above the dig site (ISSUE-034).
      const blink = Math.trunc(this.fireAnimTime * 4.0) % 2 === 0;
      if (blink) {
        draw.image(
          "simtower/alerts/treasure",
          null,
          tileToPixelX(this.treasureOrigin.x),
          tileToPixelY(this.treasureOrigin.y) - 40.0,
          { origin: { x: 38, y: 60 } },
        );
        game.drawnSprites++;
      }
    }
  }

  // ------------------------------------------------------------- persistence

  encodeXML(xml) {
    xml.PushAttribute("eventNextTime", this.nextEventTime);
    xml.PushAttribute("eventTerrorFired", this.terrorFired);
    // Active events are not persisted mid-resolution; they end on reload.
  }

  decodeXML(el) {
    this.nextEventTime = doubleAttr(el, "eventNextTime", 0.0);
    this.terrorFired = boolAttr(el, "eventTerrorFired", false);
    // If the save had an active event, it's gone on reload — the tower is
    // safe again. nextEventTime is preserved so the cadence isn't reset.
    this.type = TYPE.NONE;
    this.burningTiles.clear();
  }
}
