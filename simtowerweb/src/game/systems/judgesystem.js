// Port of OT::JudgeSystem (source/JudgeSystem.h / JudgeSystem.cpp).
// Daily tenant & hotel evaluation engine. Runs once per game day from
// Game::settleDailyAccounting() and ad-hoc from Game::ratingMayIncrease().
// Writes item.evaluation (0..100) and mirrors the score onto every person at
// the item (person.eval).

// Hotel room states (Item/Hotel.h).
export const K_CLEAN = 0;
export const K_OCCUPIED = 1;
export const K_DIRTY = 2;

const HOTEL_IDS = new Set(["hotel_single", "hotel_double", "hotel_suite", "hotel"]);
const TENANT_IDS = new Set([
  "office", "condo", "yoot_condo",
  "hotel_single", "hotel_double", "hotel_suite", "hotel",
  "fastfood", "restaurant", "cinema", "partyhall",
]);

function isHotelId(id) {
  return HOTEL_IDS.has(id);
}

// Hotel capacity by id (Hotel.cpp:45-56); prefers item.capacity() when the
// items agent provides it.
const HOTEL_CAPACITY = { hotel_single: 1, hotel_double: 2, hotel_suite: 3, hotel: 1 };
function hotelCapacity(item) {
  if (typeof item.capacity === "function") return item.capacity();
  return HOTEL_CAPACITY[item.prototype.id] || 1;
}

// Rule-of-thumb capacities for the granular counters (JudgeSystem.cpp:130-144).
function populationCapacityFor(id) {
  if (id === "office") return 3;
  if (id === "condo" || id === "yoot_condo") return 2;
  return 0; // hotels counted via capacity()
}
function visitorCapacityFor(id) {
  if (id === "fastfood") return 6;
  if (id === "restaurant") return 8;
  if (id === "cinema") return 20;
  if (id === "partyhall") return 15;
  return 0;
}

// Noise model approximating the original Kinsoku.h/c placement rules.
// Loud: (level 90, sensitivity 0). Sensitive: condos 10/90, hotels 10/70.
function noiseProfileFor(id) {
  if (id === "office" || id === "fastfood" || id === "restaurant" ||
      id === "cinema" || id === "partyhall" || id === "metro") return { level: 90, sensitivity: 0 };
  if (id === "condo" || id === "yoot_condo") return { level: 10, sensitivity: 90 };
  if (isHotelId(id)) return { level: 10, sensitivity: 70 };
  return { level: 0, sensitivity: 0 };
}

// Isolation radius in tiles (120px/8px = 15 hotels, 240px/8px = 30 condos).
function noiseRadiusTilesFor(id) {
  if (id === "condo" || id === "yoot_condo") return 30;
  if (id.includes("hotel")) return 15;
  return 0;
}

function bucket(game, id) {
  return game.itemsByType.get(id) || new Set();
}

function averageStress(item) {
  if (item.people.size === 0) return 0;
  let sum = 0;
  for (const p of item.people) sum += p.stress;
  return sum / item.people.size;
}

// Base score shared by all tenant types: rewards lobby reachability, penalizes
// occupant stress (JudgeSystem.cpp:149-168).
function baseTenantScore(item) {
  let score = 50;
  if (!item.lobbyRoute.empty()) {
    score += 20;
    // Lower route cost (fewer hops / shorter) is better; bonus capped at +10.
    const s = item.lobbyRoute.score();
    if (s > 0) score += Math.max(0, 10 - s * 0.5);
  } else {
    // Unreachable tenants are deeply unhappy.
    score -= 30;
  }
  score -= averageStress(item) * 0.3;
  return score;
}

function clampScore(v) {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function makeCounts() {
  return {
    offices: 0,
    condos: 0,
    hotels: 0,
    hotelsDirty: 0,
    hotelsOccupied: 0,
    foodOutlets: 0, // fastfood + restaurant (C++ name)
    foodVenues: 0, // alias used elsewhere in the JS port
    securityOffices: 0,
    medicalCenters: 0,
    metros: 0, // C++ name
    metroStations: 0, // alias used elsewhere in the JS port
    population: 0,
    criticalTenants: 0,
    populationCapacity: 0,
    visitorCapacity: 0,
    currentOccupants: 0,
    hotelAvgEval: 0.0,
  };
}

export class JudgeSystem {
  constructor(game) {
    this.game = game;
    this.lastCounts = makeCounts();
    this.parkingCoverage = 1.0;
    // item -> consecutive bad days (reviewUnderperformers)
    this.badDayStreak = new Map();
  }

  counts() {
    return this.lastCounts;
  }

  // ------------------------------------------------------------- scorers

  scoreOffice(game, item) {
    let score = baseTenantScore(item);

    // Lunch amenity: office workers need a reachable FastFood for their 12:00
    // break. Without one they accumulate stress and eventually vacate.
    let lunchReachable = false;
    for (const f of bucket(game, "fastfood")) {
      if (!game.findRoute(item, f).empty()) {
        lunchReachable = true;
        break;
      }
    }
    score += lunchReachable ? 10 : -15;

    // Security coverage keeps crime-related stress down.
    if (bucket(game, "security").size > 0) score += 3;

    // Parking: original requires 1 space per 4 offices.
    if (this.parkingCoverage < 0.5) score -= 10;
    else if (this.parkingCoverage < 1.0) score -= 5;

    return clampScore(score);
  }

  scoreCondo(game, item) {
    let score = baseTenantScore(item);

    if (bucket(game, "security").size > 0) score += 3;

    // Reachable food is a minor plus for residents.
    let foodReachable = false;
    const restaurants = bucket(game, "restaurant");
    if (restaurants.size > 0) {
      for (const r of restaurants) {
        if (!game.findRoute(item, r).empty()) {
          foodReachable = true;
          break;
        }
      }
    }
    score += foodReachable ? 3 : 0;

    // Noise penalty — condos are the most noise-sensitive tenant.
    score -= this.computeNoisePenalty(game, item);

    return clampScore(score);
  }

  scoreHotel(game, item) {
    let score = baseTenantScore(item);

    // Dirty rooms tank the score; occupied rooms are a small plus.
    if (isHotelId(item.prototype.id)) {
      const roomState = item.roomState ?? K_CLEAN;
      if (roomState === K_DIRTY) score -= 30;
      else if (roomState === K_OCCUPIED) score += 5;

      // Guests need a reachable restaurant for dinner.
      let dinnerReachable = false;
      const restaurants = bucket(game, "restaurant");
      if (restaurants.size > 0) {
        for (const r of restaurants) {
          if (!game.findRoute(item, r).empty()) {
            dinnerReachable = true;
            break;
          }
        }
      }
      score += dinnerReachable ? 8 : -8;

      // Parking: 1 space per hotel room.
      if (this.parkingCoverage < 0.5) score -= 12;
      else if (this.parkingCoverage < 1.0) score -= 6;

      // Noise penalty — hotels are sensitive but less so than condos.
      score -= this.computeNoisePenalty(game, item) * 0.7;
    }

    return clampScore(score);
  }

  scoreCommercial(game, item) {
    let score = baseTenantScore(item);

    // Venues are happier when reachable from the lobby (footfall).
    if (!item.lobbyRoute.empty()) score += 5;

    return clampScore(score);
  }

  // Sum the noise load on a sensitive item from loud neighbours on the same
  // floor and the two adjacent floors. Returns a 0..25 penalty.
  computeNoisePenalty(game, item) {
    const id = item.prototype.id;
    const np = noiseProfileFor(id);
    if (np.sensitivity === 0) return 0;
    const radius = noiseRadiusTilesFor(id);
    if (radius <= 0) return 0;

    let noiseLoad = 0;
    for (let floorDelta = -1; floorDelta <= 1; floorDelta++) {
      const floor = item.position.y + floorDelta;
      const itemsOnFloor = game.itemsByFloor.get(floor);
      if (!itemsOnFloor) continue;

      for (const neighbor of itemsOnFloor) {
        if (neighbor === item) continue;
        const np2 = noiseProfileFor(neighbor.prototype.id);
        if (np2.level === 0) continue;

        // Horizontal gap between the two item rectangles (tiles).
        const myMin = item.position.x;
        const myMax = item.position.x + item.size.x;
        const nMin = neighbor.position.x;
        const nMax = neighbor.position.x + neighbor.size.x;
        let dist;
        if (nMin >= myMax) dist = nMin - myMax;
        else if (myMin >= nMax) dist = myMin - nMax;
        else dist = 0; // overlapping
        // Cross-floor noise has to pass through a ceiling: +5 tiles.
        if (floorDelta !== 0) dist += 5;

        if (dist < radius) {
          noiseLoad += np2.level * (1.0 - dist / radius);
        }
      }
    }

    if (noiseLoad <= 0) return 0;
    // Scale so a single adjacent office (~90 load) subtracts ~18 points.
    if (noiseLoad > 125.0) noiseLoad = 125.0;
    return noiseLoad * 0.2;
  }

  // ------------------------------------------------------------- passes

  // Tower-wide parking coverage in [0, 1+]: spaces / ((offices+3)/4 + hotels).
  // Only ramp-connected areas count (ISSUE-032): without a ground-connected
  // Parking Ramp the cars can't reach the spaces at all.
  computeParkingCoverage(game) {
    let totalSpaces = 0;
    for (const p of bucket(game, "parking")) {
      if (typeof p.isRampServed === "function" && !p.isRampServed()) continue;
      totalSpaces += typeof p.totalSpaces === "function" ? p.totalSpaces() : p.size.x * 2;
    }
    const required = Math.trunc((this.lastCounts.offices + 3) / 4) + this.lastCounts.hotels;
    this.parkingCoverage = required === 0 ? 1.0 : totalSpaces / required;
  }

  evaluateAll(game) {
    game = game || this.game;
    this.lastCounts = makeCounts();

    // Pass 1: cheap counting pass so derived metrics (parking coverage) are
    // available before the per-item scorers run.
    for (const item of game.items) {
      const id = item.prototype.id;
      if (id === "office") this.lastCounts.offices++;
      else if (id === "condo" || id === "yoot_condo") this.lastCounts.condos++;
      else if (isHotelId(id)) {
        this.lastCounts.hotels++;
        const roomState = item.roomState ?? K_CLEAN;
        if (roomState === K_DIRTY) this.lastCounts.hotelsDirty++;
        else if (roomState === K_OCCUPIED) this.lastCounts.hotelsOccupied++;
        this.lastCounts.visitorCapacity += hotelCapacity(item);
      } else if (id === "fastfood" || id === "restaurant") this.lastCounts.foodOutlets++;
      else if (id === "security") this.lastCounts.securityOffices++;
      else if (id === "medicalcenter") this.lastCounts.medicalCenters++;
      else if (id === "metro") this.lastCounts.metros++;

      this.lastCounts.populationCapacity += populationCapacityFor(id);
      this.lastCounts.visitorCapacity += visitorCapacityFor(id);
      this.lastCounts.currentOccupants += item.people.size;
    }
    this.lastCounts.foodVenues = this.lastCounts.foodOutlets;
    this.lastCounts.metroStations = this.lastCounts.metros;
    this.lastCounts.population = game.population;

    this.computeParkingCoverage(game);

    // Pass 2: walk every item, dispatching to the appropriate scorer.
    for (const item of game.items) {
      const id = item.prototype.id;
      let score = 50; // neutral default for unhandled types

      if (id === "office") score = this.scoreOffice(game, item);
      else if (id === "condo" || id === "yoot_condo") score = this.scoreCondo(game, item);
      else if (isHotelId(id)) score = this.scoreHotel(game, item);
      else if (id === "fastfood" || id === "restaurant" ||
               id === "cinema" || id === "partyhall") {
        score = this.scoreCommercial(game, item);
      } else if (id === "parking" &&
                 typeof item.isRampServed === "function" && !item.isRampServed()) {
        // "Not connected to Ramp" (ISSUE-032, EXE 0xba3bf): the tenant
        // complaint surfaces as a bottomed-out evaluation.
        score = 0;
      }

      item.evaluation = score;
      if (score < 25.0) this.lastCounts.criticalTenants++;

      // Mirror the item score onto each person currently at the item.
      for (const p of item.people) p.eval = score;
    }

    // Ramp-disconnection complaint (ISSUE-032, EXE 0xba3bf): once per daily
    // evaluation while any parking area lacks a ground-connected ramp.
    let disconnectedParking = 0;
    for (const item of game.items) {
      if (item.prototype.id === "parking" &&
          typeof item.isRampServed === "function" && !item.isRampServed()) {
        disconnectedParking++;
      }
    }
    if (disconnectedParking > 0) {
      game.ui.showMessage(
        disconnectedParking + " parking area" +
        (disconnectedParking === 1 ? "" : "s") + " - Not connected to Ramp",
      );
    }

    // Aggregate hotel review and per-tenant bad-day tracking.
    this.reviewHotels(game);
    this.reviewUnderperformers(game);

    // Daily complaint if any tenant is critically unhappy.
    if (this.lastCounts.criticalTenants > 0) {
      const n = this.lastCounts.criticalTenants;
      game.ui.showMessage(n + " tenant" + (n === 1 ? " is" : "s are") +
        " unhappy - check the Evaluation view (O)");
    }
  }

  // Aggregate review across all hotel items (JudgeAllHotel equivalent).
  reviewHotels(game) {
    this.lastCounts.hotelAvgEval = 0.0;
    if (this.lastCounts.hotels <= 0) return false;

    let sumEval = 0;
    let counted = 0;
    for (const item of game.items) {
      if (!isHotelId(item.prototype.id)) continue;
      sumEval += item.evaluation;
      counted++;
    }
    if (counted === 0) return false;
    this.lastCounts.hotelAvgEval = sumEval / counted;

    const dirtyRatio = this.lastCounts.hotelsDirty / this.lastCounts.hotels;
    const occRatio = this.lastCounts.hotelsOccupied / this.lastCounts.hotels;

    if (this.lastCounts.hotelAvgEval < 35.0) {
      game.ui.showMessage(
        "Hotels struggling (avg eval " + this.lastCounts.hotelAvgEval.toFixed(0) +
          ") - check routes, restaurants & parking",
      );
      return true;
    }
    if (dirtyRatio > 0.5 && this.lastCounts.hotels >= 3) {
      game.ui.showMessage(
        this.lastCounts.hotelsDirty + " of " + this.lastCounts.hotels +
          " hotel rooms need housekeeping",
      );
      return true;
    }
    if (occRatio > 0.8 && this.lastCounts.hotelsOccupied >= 4) {
      game.ui.showMessage("Hotel occupancy high - consider building more rooms");
    }
    return false;
  }

  // Per-tenant bad-day tracking (ExpandoBadHotel equivalent): warn when a
  // tenant has been unhappy for 3 days, then every 5 more days.
  reviewUnderperformers(game) {
    const kBadThreshold = 25.0;
    const kWarnAfterDays = 3;

    const stillBad = new Set();
    for (const item of game.items) {
      if (!TENANT_IDS.has(item.prototype.id)) continue;

      if (item.evaluation < kBadThreshold) {
        stillBad.add(item);
        const streak = (this.badDayStreak.get(item) || 0) + 1;
        this.badDayStreak.set(item, streak);
        if (streak === kWarnAfterDays ||
            (streak > kWarnAfterDays && (streak - kWarnAfterDays) % 5 === 0)) {
          game.ui.showMessage(
            item.prototype.name + " on floor " + item.position.y +
              " has been unhappy for " + streak + " day" + (streak === 1 ? "" : "s"),
          );
        }
      }
    }

    // Clear streaks for items that recovered; prune removed items.
    for (const item of [...this.badDayStreak.keys()]) {
      if (!stillBad.has(item)) this.badDayStreak.delete(item);
    }
  }
}
