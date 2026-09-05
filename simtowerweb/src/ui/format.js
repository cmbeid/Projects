// Pure UI logic (UI agent) — formatters, message queue, toolbox grouping and
// finance attribution. NO DOM access so tests/ui.test.js can import it
// headless. The DOM-facing modules (toolbox/timewindow/dialogs) consume these.

import { LevelUp } from "../game/systems/levelup.js";
import { hourToAbsolute } from "../core/time.js";

// --------------------------------------------------------------------------
// Money formats (TimeWindow.cpp formatMoney/formatCompactMoney/
// formatSignedCompactMoney; the web port uses comma thousands everywhere).
// --------------------------------------------------------------------------

export function formatCommaMoney(amount) {
  const neg = amount < 0;
  let fmt = "$" + String(Math.abs(Math.trunc(amount)));
  for (let i = fmt.length - 3; i > 1; i -= 3) {
    fmt = fmt.slice(0, i) + "," + fmt.slice(i);
  }
  return neg ? "-" + fmt : fmt;
}

export function formatCompactMoney(amount) {
  const a = Math.abs(Math.trunc(amount));
  if (a >= 1000000) return "$" + Math.trunc(a / 1000000) + "M";
  if (a >= 1000) return "$" + Math.trunc(a / 1000) + "k";
  return "$" + a;
}

export function formatSignedCompactMoney(amount) {
  return (amount < 0 ? "-" : "+") + formatCompactMoney(amount);
}

// --------------------------------------------------------------------------
// Clock / date (TimeWindow.cpp updateTime + the analog watch source values).
// --------------------------------------------------------------------------

// hour: 0..24 float from Time.getHour() (nonlinear mapping already applied).
// Minutes are rounded (half up) so 11:59:59.4 renders as 12:00.
export function formatClock(hour) {
  let h = Math.floor(hour);
  let m = Math.floor((hour - h) * 60 + 0.5);
  if (m > 59) {
    m = 0;
    h += 1;
  }
  if (h > 24) h = 24;
  const hh = h < 10 ? "0" + h : String(h);
  const mm = m < 10 ? "0" + m : String(m);
  return hh + ":" + mm;
}

// t: {day, quarter, year} — day = floor(abs)%3; day 2 is the weekend day.
export function formatDate(t) {
  const weekend = t.day === 2;
  const dayLabel = weekend ? "Hol" : "D" + t.day;
  return { text: dayLabel + " Q" + t.quarter + " Y" + t.year, weekend };
}

// Formats the Resume button label with autosave metadata (ISSUE-001 / issue #1).
// E.g. "Resume — D3 Y1 · ★2 · $4,000,000" or "Resume" when meta is absent/empty.
export function formatAutosaveResumeLabel(meta) {
  if (!meta || typeof meta !== "object") return "Resume";
  const parts = [];

  // Date: day / year
  let datePart = "";
  if (meta.day !== undefined && meta.year !== undefined) {
    const d = typeof meta.day === "string" && (meta.day.startsWith("D") || meta.day === "Hol")
      ? meta.day
      : "D" + meta.day;
    datePart = `${d} Y${meta.year}`;
  } else if (meta.day !== undefined) {
    datePart = typeof meta.day === "string" && (meta.day.startsWith("D") || meta.day === "Hol")
      ? meta.day
      : "D" + meta.day;
  } else if (meta.year !== undefined) {
    datePart = `Y${meta.year}`;
  } else if (typeof meta.date === "string" && meta.date.trim() && !meta.date.includes("T")) {
    datePart = meta.date.trim();
  }

  if (datePart) parts.push(datePart);

  // Rating: ★{stars} (e.g. towerRating 1 -> ★2; rating 0 -> ★1; stars "★2" -> ★2)
  if (typeof meta.stars === "string" && meta.stars.length > 0) {
    parts.push(meta.stars.startsWith("★") ? meta.stars : "★" + meta.stars);
  } else if (typeof meta.towerRating === "number") {
    parts.push(`★${meta.towerRating + 1}`);
  } else if (typeof meta.rating === "number") {
    parts.push(`★${meta.rating + 1}`);
  }

  // Funds: $4,000,000
  if (typeof meta.funds === "number") {
    parts.push(formatCommaMoney(meta.funds));
  }

  if (parts.length === 0) return "Resume";
  return `Resume — ${parts.join(" · ")}`;
}

export function speedLabel(mode) {
  switch (mode) {
    case 0: return "Paused";
    case 1: return "Speed 1x";
    case 2: return "Speed 2x";
    case 3: return "Speed 4x";
    default: return "";
  }
}

// Port of TimeWindow::updateTooltip text build. gameLike: {selectedTool,
// toolPrototype, speedMode} (read-only view of Game).
// The tool half of the tooltip on its own. The phone toolbox drawer shows this
// in its header without the speed suffix, since the speed buttons sit directly
// beside it there.
export function toolLabel(gameLike) {
  if (gameLike.toolPrototype) {
    return "Construct " + gameLike.toolPrototype.name + " " +
      formatCommaMoney(gameLike.toolPrototype.price);
  }
  if (gameLike.selectedTool === "bulldozer") return "Bulldoze";
  if (gameLike.selectedTool === "finger") return "Resize elevator shaft";
  if (gameLike.selectedTool === "inspector") return "Inspect";
  return "";
}

export function toolTooltip(gameLike) {
  let s = toolLabel(gameLike);
  if (s) s += "  |  ";
  return s + speedLabel(gameLike.speedMode);
}

// --------------------------------------------------------------------------
// Message queue — TimeWindow::showMessage sets a 3 s timer in C++; the web
// port queues up to K_MAX_PENDING messages so rapid events don't overwrite
// each other instantly. Fade duration ~4 s per UI spec.
// --------------------------------------------------------------------------

export const MESSAGE_DURATION = 4.0;
export const K_MAX_PENDING = 3;
// Messages fade after 4 s and the queue drops anything past K_MAX_PENDING, so
// a burst (a promotion plus its unlocks, a fire plus its casualties) is gone
// before it can be read. Keep a scrollback the player can open on demand.
export const K_MAX_HISTORY = 100;

export class MessageQueue {
  constructor(duration = MESSAGE_DURATION) {
    this.duration = duration;
    this.current = "";
    this.timer = 0;
    this.pending = [];
    // Newest last. Entries are { text, stamp } — stamp is whatever the caller
    // passes (this module stays DOM- and game-free), or "" when omitted.
    this.history = [];
  }

  show(msg, stamp = "") {
    this.history.push({ text: msg, stamp });
    if (this.history.length > K_MAX_HISTORY) this.history.shift();
    if (this.timer > 0 && this.current) {
      this.pending.push(msg);
      if (this.pending.length > K_MAX_PENDING) this.pending.shift();
    } else {
      this.current = msg;
      this.timer = this.duration;
    }
    return this.current;
  }

  advance(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        if (this.pending.length > 0) {
          this.current = this.pending.shift();
          this.timer = this.duration;
        } else {
          this.current = "";
        }
      }
    }
    return this.current;
  }

  clear() {
    this.current = "";
    this.timer = 0;
    this.pending.length = 0;
  }

  // The scrollback outlives the visible message; clearing it is a separate,
  // explicit act (the log dialog's Clear button).
  clearHistory() {
    this.history.length = 0;
  }
}

// Tower extents in tiles: {minX, minY, maxX, maxY}. The minimap's projection
// and the zoom "fit tower" control need the same sweep, so it lives here (this
// module is deliberately DOM-free) instead of being duplicated in each.
// minY/maxY keep MapWindow's floor for an empty or squat tower.
export function towerBounds(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.position.x);
    minY = Math.min(minY, item.position.y);
    maxX = Math.max(maxX, item.position.x + item.size.x);
    maxY = Math.max(maxY, item.position.y + item.size.y);
  }
  if (minX > maxX) {
    minX = minY = maxX = maxY = 0;
  }
  minY = Math.min(minY, -1);
  maxY = Math.max(maxY, 6);
  return { minX, minY, maxX, maxY };
}

// --------------------------------------------------------------------------
// Toolbox palette — grid groups (per the UI spec's DefaultToolPalette-style
// categories) + star gating via LevelUp.minRatingToBuild.
// --------------------------------------------------------------------------

export const CATEGORY_GROUPS = [
  { label: "Facility", ids: ["lobby", "floor", "parking", "parkingramp", "security", "medicalcenter", "recycling", "metro", "cathedral"] },
  { label: "Commercial", ids: ["fastfood", "restaurant", "retail", "cinema", "partyhall"] },
  { label: "Hotel", ids: ["hotel_single", "hotel_double", "hotel_suite", "housekeeping"] },
  { label: "Office", ids: ["office"] },
  { label: "Transport", ids: ["stairs", "escalator", "elevator-standard", "elevator-express", "elevator-service"] },
  { label: "Condo", ids: ["condo"] },
];

// The first 25 cells of items.png are the original SimTower toolbox, in
// IconNumber order. Cell 25 is the Yoot-only SECOM graphic and is therefore
// deliberately excluded from the default SimTower palette.
export const TOOLBOX_ICON_INDEX = {
  lobby: 0, floor: 1, stairs: 2, escalator: 3,
  "elevator-standard": 4, "elevator-service": 5, "elevator-express": 6,
  office: 7, hotel_single: 8, hotel_double: 9, hotel_suite: 10,
  fastfood: 11, restaurant: 12, retail: 13, cinema: 14, partyhall: 15,
  cathedral: 16, parkingramp: 17, recycling: 18, metro: 19, parking: 20,
  security: 21, medicalcenter: 22, housekeeping: 23, condo: 24,
};

export const SIMTOWER_TOOLBOX_IDS = CATEGORY_GROUPS.flatMap((group) => group.ids);

export function toolboxIconIndex(id) {
  return TOOLBOX_ICON_INDEX[id] ?? 0;
}

// Flat list of palette entries (registration order within each group).
// Entry: {group, proto, locked, minRating, stars} — stars = display unlock
// ("2★" for minRating 1).
export function toolboxEntries(prototypesById, rating) {
  const entries = [];
  for (const g of CATEGORY_GROUPS) {
    for (const id of g.ids) {
      const proto = prototypesById[id];
      if (!proto) continue;
      const minRating = LevelUp.minRatingToBuild(id);
      entries.push({
        group: g.label,
        proto,
        locked: minRating > rating,
        minRating,
        stars: minRating > 0 ? minRating + 1 + "★" : "",
      });
    }
  }
  return entries;
}

// --------------------------------------------------------------------------
// Toolbox categories & parent/child relationships (matching OpenSky C++ CATEGORIES)
// --------------------------------------------------------------------------

export const TOOLBOX_CATEGORIES = {
  stairs: ["escalator"],
  lobby: ["floor"],
  "elevator-standard": ["elevator-express", "elevator-service"],
  hotel_single: ["hotel_double", "hotel_suite"],
};

export function isChildTool(toolId) {
  for (const [parentId, children] of Object.entries(TOOLBOX_CATEGORIES)) {
    if (children.includes(toolId)) return parentId;
  }
  return null;
}

export function isCategoryParent(toolId) {
  return Object.prototype.hasOwnProperty.call(TOOLBOX_CATEGORIES, toolId);
}

// Prototypes displayed on the main 3-column grid at a given star rating.
// Category children are omitted (accessed via press-and-hold overlay).
export function getVisibleGridPrototypes(prototypes, rating) {
  const visible = [];
  for (const proto of prototypes) {
    if (!SIMTOWER_TOOLBOX_IDS.includes(proto.id)) continue;
    if (LevelUp.minRatingToBuild(proto.id) > rating) continue;
    if (isChildTool(proto.id)) continue;
    visible.push(proto);
  }
  return visible;
}

// Unlocked alternative tools for the press-and-hold overlay on a parent slot.
// Returns list of prototypes for the parent and all unlocked children,
// excluding whichever prototype is currently displayed on the slot.
export function getOverlayAlternatives(parentId, displayedProtoId, prototypesById, rating) {
  const children = TOOLBOX_CATEGORIES[parentId] || [];
  const candidates = [parentId, ...children];
  const alternatives = [];
  for (const id of candidates) {
    if (id === displayedProtoId) continue;
    if (LevelUp.minRatingToBuild(id) > rating) continue;
    const proto = prototypesById[id];
    if (proto) alternatives.push(proto);
  }
  return alternatives;
}

// --------------------------------------------------------------------------
// Finance attribution — port of FinanceWindow::incomeForType.
// --------------------------------------------------------------------------

export const FINANCE_CATEGORY_TYPES = {
  rent_income: ["office"],
  deposit_income: ["office"],
  deposit_refund: ["office"],
  condo_sale: ["condo", "yoot_condo"],
  condo_buyback: ["condo", "yoot_condo"],
  retail_income: ["fastfood", "restaurant"],
  entertainment_income: ["cinema", "partyhall"],
  metro_fare: ["metro"],
};

// kDisplayNames from FinanceWindow.cpp, in C++ std::map (sorted-key) order.
export const FINANCE_DISPLAY_ORDER = [
  "cinema", "condo", "fastfood", "hotel_double", "hotel_single", "hotel_suite",
  "medicalcenter", "metro", "office", "partyhall", "parking", "recycling",
  "restaurant", "security", "yoot_condo",
];

export const FINANCE_DISPLAY_NAMES = {
  office: "Office", condo: "Condo", yoot_condo: "Yoot Condo",
  fastfood: "Fast Food", restaurant: "Restaurant", cinema: "Movie Theatre",
  partyhall: "Party Hall", hotel_single: "Single Hotel",
  hotel_double: "Double Hotel", hotel_suite: "Hotel Suite",
  metro: "Metro Station", parking: "Parking", security: "Security",
  recycling: "Recycling", medicalcenter: "Medical Center",
};

// quarterTotals: Map<category,int>; pop: Map<protoId,int> populations.
export function incomeForType(protoId, population, pop, quarterTotals) {
  let total = 0;
  for (const [cat, types] of Object.entries(FINANCE_CATEGORY_TYPES)) {
    if (!types.includes(protoId)) continue;
    const catTotal = quarterTotals.get(cat);
    if (catTotal === undefined) continue;
    if (types.length === 1) {
      total += catTotal;
    } else {
      let totalPop = 0;
      for (const t of types) totalPop += pop.get(t) || 0;
      if (totalPop > 0) total += Math.trunc((catTotal * population) / totalPop);
      else total += Math.trunc(catTotal / types.length);
    }
  }
  return total;
}

// --------------------------------------------------------------------------
// Inspector describe — port of InspectorDialog::describeItem as a pure
// string builder (nowAbs = game.time.absolute).
// --------------------------------------------------------------------------

const PERSON_TYPE_NAMES = ["Man", "Salesman", "Woman", "Child", "Woman", "Housekeeper", "Woman w/ child", "Woman w/ child", "Security"];
const PERSON_STATE_NAMES = ["wandering", "home", "commuting", "working", "at lunch", "shopping", "returning", "resting", "idle"];
const ROOM_STATES = ["clean", "occupied", "dirty"];

export function describeItem(item, nowAbs) {
  const lines = [];
  lines.push(item.prototype.name);
  lines.push("Floor " + item.position.y + ", x=" + item.position.x +
    "  Size " + item.size.x + "\u00d7" + item.size.y);

  if (item.underConstruction) {
    let remainAbs = item.constructionEndTime - nowAbs;
    if (remainAbs < 0) remainAbs = 0;
    const remainMinutes = constructionMinutesLeft(item, nowAbs);
    lines.push("");
    lines.push("[under construction]");
    lines.push("Ready in ~" + remainMinutes + " min");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Maintenance: " + item.dailyMaintenanceCost() + "/day");
  lines.push("Evaluation:  " + Math.trunc(item.evaluation) + "/100");
  if (item.population) lines.push("Population: " + item.population);
  lines.push("Occupants:   " + item.people.size);
  if (item.lobbyRoute && !item.lobbyRoute.empty()) {
    lines.push("Route score: " + item.lobbyRoute.score() + " (reachable)");
  } else {
    lines.push("Route score: (unreachable)");
  }

  if (typeof item.roomState === "number") {
    lines.push("Room state:  " + (ROOM_STATES[item.roomState] || "?"));
    let cap = 0;
    try { cap = item.capacity(); } catch { cap = 0; }
    lines.push("Capacity:    " + cap);
  }

  if (item.isElevator()) {
    let waiting = 0;
    for (const q of item.queues || []) waiting += q.people.length;
    lines.push("");
    lines.push("Elevator");
    lines.push("Cars:        " + (item.cars ? item.cars.length : 0));
    lines.push("Queues:      " + (item.queues ? item.queues.length : 0));
    lines.push("Serviced fl: " + item.size.y);
    lines.push("Unserviced:  " + (item.unservicedFloors ? item.unservicedFloors.size : 0));
    lines.push("Waiting:     " + waiting);
  }

  if (item.people.size > 0) {
    lines.push("");
    lines.push("Occupants");
    let shown = 0;
    for (const p of item.people) {
      if (shown >= 8) break;
      const nm = p.name || PERSON_TYPE_NAMES[p.type] || "?";
      const st = PERSON_STATE_NAMES[p.state] || "?";
      lines.push("- " + nm + " [" + st + "]  stress " + Math.trunc(p.stress) + "  eval " + Math.trunc(p.eval));
      shown++;
    }
    if (item.people.size > 8) lines.push("...+" + (item.people.size - 8) + " more");
  }

  return lines.join("\n");
}

// Remaining construction time in minutes (for the inspector header). Rounded
// — the value is display-only ("~N min").
export function constructionMinutesLeft(item, nowAbs) {
  let remain = item.constructionEndTime - nowAbs;
  if (remain < 0) remain = 0;
  return Math.round((remain / hourToAbsolute(1.0)) * 60.0);
}
