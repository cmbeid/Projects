// Port of OT::LevelUp (source/LevelUp.h/cpp). Constants verified 1:1 against
// LevelUp.cpp (kAdvancement table, kItemLocks, meetsRequirements).
// Exports: LevelUp.advancementRequirements / meetsRequirements / minRatingToBuild.

export class Requirements {
  constructor(population, needsSecurity, needsMedical, needsMetro, needsVip, summary) {
    this.population = population;
    this.needsSecurity = needsSecurity;
    this.needsMedical = needsMedical;
    this.needsMetro = needsMetro;
    this.needsVip = needsVip;
    this.summary = summary;
  }
}

const kAdvancement = [
  new Requirements(0, false, false, false, false, "Starting tower"),
  new Requirements(300, false, false, false, false, "Reach 300 population"),
  new Requirements(1000, true, false, false, false, "1000 population + Security Office"),
  new Requirements(5000, true, true, false, true, "5000 population + VIP Approval + Hotel Suites + Medical & Recycling"),
  new Requirements(10000, true, true, true, false, "10,000 population + Metro Station"),
  new Requirements(15000, true, true, true, false, "15,000 population + Cathedral (TOWER rating)"),
];

export const LevelUp = {
  advancementRequirements(currentRating) {
    const next = currentRating + 1;
    if (next >= 1 && next < kAdvancement.length) return kAdvancement[next];
    return null;
  },
  meetsRequirements(req, population, counts, vipReviews) {
    return (
      population >= req.population &&
      (!req.needsSecurity || counts.securityOffices > 0) &&
      (!req.needsMedical || counts.medicalCenters > 0) &&
      (!req.needsMetro || counts.metroStations > 0) &&
      (!req.needsVip || vipReviews > 0)
    );
  },
  // Star-promotion gift message (ISSUE-034, EXE strings 0x79636-0x79c36):
  // each promotion grants a reward announced with the authentic wording.
  // The EXE stores 33-char prefixes ("Your tower has been given a Two ");
  // the "-Star Award!" tails are the reconstructed completion (PORT NOTE in
  // docs/issues/ISSUE-034). newStars is the 1-based star count just reached.
  starRewardMessage(newStars) {
    const names = { 2: "Two", 3: "Three", 4: "Four", 5: "Five" };
    const name = names[newStars];
    return name ? "Your tower has been given a " + name + "-Star Award!" : null;
  },
  minRatingToBuild(id) {
    // Default SimTower toolbox mapping:
    // 1 Star (minRating 0): lobby, floor, stairs, standard elevator, office, fast food, condo
    // 2 Stars (minRating 1): service elevator, single hotel room, security, housekeeping
    // 3 Stars (minRating 2): escalator, express elevator, restaurant, retail shop, cinema, party hall,
    //                       twin hotel room, hotel suite, medical center, recycling center, parking
    // 4 Stars (minRating 3): metro station
    // 5 Stars (minRating 4): cathedral
    const table = {
      // 2 Stars (1):
      "elevator-service": 1,
      hotel_single: 1,
      security: 1,
      housekeeping: 1,
      // Yoot-only registrations remain loadable for existing saves but are not
      // exposed by the default SimTower toolbox.
      secom: 1,
      rooftoppark: 1,
      restroom: 1,

      // 3 Stars (2):
      escalator: 2,
      "elevator-express": 2,
      restaurant: 2,
      retail: 2,
      cinema: 2,
      partyhall: 2,
      hotel_double: 2,
      hotel_suite: 2,
      medicalcenter: 2,
      recycling: 2,
      parking: 2,
      parkingramp: 2,
      antenna: 2,

      // 4 Stars (3):
      metro: 3,

      // 5 Stars (4):
      cathedral: 4,
    };
    return table[id] || 0;
  },
};
