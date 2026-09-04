// Port of OT::Item::Factory::loadPrototypes (source/Item/Factory.cpp) —
// prototype registrations in exact Factory.cpp order.
//
// ICON MAPPING NOTE: the JS port uses game.js's compact ICON enum
// (FLOOR=0, LOBBY=1, STAIRS=2, OFFICE=3, ELEVATOR=4, SERVICE_ELEVATOR=5,
// METRO=6, RESTAURANT=7, FASTFOOD=8, CONDO=9, HOTEL=10, PARKING=11,
// RECYCLING=12, SECURITY=13, MEDICAL=14, CINEMA=15, PARTYHALL=16) instead of
// the C++ IconNumbers toolbox values. Two deliberate subtleties preserved
// from the C++ (where Game.cpp branches on icons 2/3 for the stairlike
// construction rules): the ESCALATOR carries the ELEVATOR enum value (4) so
// it lands in the stairlike branch, and the real elevators avoid icons 2/4
// so they reach the id-based "elevator" branch. See items.md PORT NOTES.

import { Floor } from "./floor.js";
import { Lobby } from "./lobby.js";
import { Stairs } from "../transport/stairs.js";
import { Escalator } from "../transport/escalator.js";
import { Express, Service, Standard } from "../transport/elevator.js";
import { FastFood } from "./fastfood.js";
import { Restaurant } from "./restaurant.js";
import { Hotel, K_SINGLE, K_DOUBLE, K_SUITE } from "./hotel.js";
import { PartyHall } from "./partyhall.js";
import { Cinema } from "./cinema.js";
import { Metro } from "./metro.js";
import { Office } from "./office.js";
import { Parking } from "./parking.js";
import { ParkingRamp } from "./parkingramp.js";
import { Condo } from "./condo.js";
import { YootCondo } from "./yootcondo.js";
import { Security } from "./security.js";
import { MedicalCenter } from "./medicalcenter.js";
import { Recycling } from "./recycling.js";
import { Cathedral } from "./cathedral.js";
import { Antenna } from "./antenna.js";
import { RooftopPark } from "./rooftoppark.js";
import { Restroom } from "./restroom.js";
import { HousekeepingCenter } from "./housekeepingcenter.js";
import { RetailShop } from "./retail.js";

function proto(id, name, price, size, icon, make, extra = {}) {
  return { id, name, price, size, icon, make, entrance_offset: 0, exit_offset: 0, ...extra };
}

export const REGISTRATIONS = [
  // PRICES: aligned to authentic SimTower (SIMTOWER.EXE Pascal-string catalog,
  // e.g. "Lobby - $5000", "Medical Center - $500000"). This deliberately
  // diverges from the C++ OpenSky re-balanced prices — see items.md PORT NOTES.
  // Elevators carry the original per-shaft price plus a carCost charged when
  // adding cars ($200000/$80000 standard, $400000/$150000 express,
  // $100000/$50000 service).
  proto("lobby", "Lobby", 5000, { x: 4, y: 1 }, 1, (g, p) => new Lobby(g, p)),
  proto("floor", "Floor", 500, { x: 1, y: 1 }, 0, (g, p) => new Floor(g, p)),
  proto("stairs", "Stairs", 5000, { x: 8, y: 2 }, 2, (g, p) => new Stairs(g, p)),
  // icon 4 = ICON.ELEVATOR: escalator shares the C++ trick of carrying the
  // elevator enum value so the stairlike construction branch catches it.
  proto("escalator", "Escalator", 20000, { x: 8, y: 2 }, 4, (g, p) => new Escalator(g, p)),
  // Elevators avoid icons 2/4 (stairlike branch); the id prefix routes them
  // to the elevator construction branch in game.js. The transport agent's
  // real Standard/Express/Service classes distinguish themselves by
  // prototype id (see docs/specs/elevators.md PORT NOTES).
  proto("elevator-standard", "Standard Elevator", 200000, { x: 4, y: 1 }, 5, (g, p) => new Standard(g, p), { carCost: 80000 }),
  proto("elevator-express", "Express Elevator", 400000, { x: 6, y: 1 }, 5, (g, p) => new Express(g, p), { carCost: 150000 }),
  proto("elevator-service", "Service Elevator", 100000, { x: 4, y: 1 }, 5, (g, p) => new Service(g, p), { carCost: 50000 }),
  proto("office", "Office", 40000, { x: 9, y: 1 }, 3, (g, p) => new Office(g, p)),
  proto("fastfood", "Fast Food / Cafe", 100000, { x: 16, y: 1 }, 8, (g, p) => new FastFood(g, p)),
  proto("condo", "Condo", 80000, { x: 16, y: 1 }, 9, (g, p) => new Condo(g, p)),
  proto("yoot_condo", "Yoot Condo", 100000, { x: 16, y: 1 }, 9, (g, p) => new YootCondo(g, p)),
  proto("restaurant", "Restaurant", 200000, { x: 24, y: 1 }, 7, (g, p) => new Restaurant(g, p)),
  proto("hotel_single", "Single Hotel Room", 20000, { x: 4, y: 1 }, 10, (g, p) => new Hotel(g, p), { variant: K_SINGLE }),
  proto("hotel_double", "Double Hotel Room", 50000, { x: 6, y: 1 }, 10, (g, p) => new Hotel(g, p), { variant: K_DOUBLE }),
  proto("hotel_suite", "Hotel Suite", 100000, { x: 7, y: 1 }, 10, (g, p) => new Hotel(g, p), { variant: K_SUITE }),
  // 0x87A8 / Housekeeping.png is a 120px-wide, 15-tile room.
  proto("housekeeping", "Housekeeping", 50000, { x: 15, y: 1 }, 21, (g, p) => new HousekeepingCenter(g, p)),
  proto("parking", "Parking", 3000, { x: 8, y: 1 }, 11, (g, p) => new Parking(g, p)),
  // Parking Ramp (ISSUE-032, EXE "Parking Ramp - $50000"): vertical car
  // connector rooted at the ground floor; see parkingramp.js.
  proto("parkingramp", "Parking Ramp", 50000, { x: 1, y: 1 }, 11, (g, p) => new ParkingRamp(g, p)),
  proto("security", "Security", 100000, { x: 16, y: 1 }, 13, (g, p) => new Security(g, p)),
  // SECOM Center (ISSUE-031): one allowed; automated bomb scan + fire sense.
  // Mechanically a Security subclass (patrol coverage ±15 floors).
  proto("secom", "SECOM Center", 100000, { x: 16, y: 1 }, 13, (g, p) => new Security(g, p)),
  proto("medicalcenter", "Medical Center", 500000, { x: 32, y: 1 }, 14, (g, p) => new MedicalCenter(g, p)),
  proto("recycling", "Recycling Center", 500000, { x: 25, y: 2 }, 12, (g, p) => new Recycling(g, p)),
  proto("partyhall", "Party Hall", 100000, { x: 24, y: 2 }, 16, (g, p) => new PartyHall(g, p)),
  proto("cinema", "Movie Theatre", 500000, { x: 31, y: 2 }, 15, (g, p) => new Cinema(g, p), { entrance_offset: 1 }),
  proto("metro", "Metro Station", 1000000, { x: 30, y: 3 }, 6, (g, p) => new Metro(g, p), { entrance_offset: 2, exit_offset: 2 }),
  proto("cathedral", "Cathedral", 3000000, { x: 48, y: 4 }, 17, (g, p) => new Cathedral(g, p)),
  proto("antenna", "Broadcast Antenna", 150000, { x: 4, y: 3 }, 18, (g, p) => new Antenna(g, p)),
  proto("rooftoppark", "Rooftop Park", 80000, { x: 8, y: 1 }, 19, (g, p) => new RooftopPark(g, p)),
  proto("restroom", "Restroom", 20000, { x: 4, y: 1 }, 20, (g, p) => new Restroom(g, p)),
  // simtower/shops uses 96px (12-tile) storefront frames.
  proto("retail", "Retail Shop", 100000, { x: 12, y: 1 }, 22, (g, p) => new RetailShop(g, p)),
];
