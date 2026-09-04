// Dialogs (UI agent) — ports of InspectorDialog.cpp, ElevatorDialog.cpp,
// MapWindow.cpp, FinanceWindow.cpp and LevelUpDialog.cpp as plain DOM.
// Import-safe headless: no DOM access at module scope.

import { ICON } from "../game/game.js";
import { K_BASE_SPEED } from "../core/time.js";
import { LevelUp } from "../game/systems/levelup.js";
import {
  describeItem, formatCommaMoney, incomeForType, towerBounds,
  FINANCE_DISPLAY_ORDER, FINANCE_DISPLAY_NAMES,
} from "./format.js";
import { makeDraggable, bringToFront } from "./draggable.js";
import { loadSettings, saveSettings, normalizeSettings, DEFAULT_SETTINGS } from "../core/settings.js";
import { BUILD_INFO } from "../core/version.js";

// --------------------------------------------------------------------------
// InspectorDialog (220x260 @ (120,40) in C++)
// --------------------------------------------------------------------------

export class InspectorDialog {
  constructor(game, container, { onOpenElevator } = {}) {
    this.game = game;
    this.onOpenElevator = onOpenElevator;
    this.item = null;
    this.person = null;
    this._lastText = "";
    this._lastBar = -1;
    this._sinceRefresh = 0;

    this.el = document.createElement("div");
    this.el.id = "inspector";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span class="insp-title">Inspector</span>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>' +
      '<div class="oswin-body">' +
      '<div class="insp-evalbar"><div></div></div>' +
      '<div class="insp-content"></div>' +
      '<div class="insp-buttons">' +
      '<button type="button" class="osbtn insp-follow" style="display:none">Follow</button>' +
      '<button type="button" class="osbtn insp-demolish">Demolish</button>' +
      '<button type="button" class="osbtn insp-floors" style="display:none">Floors...</button>' +
      '<button type="button" class="osbtn" data-close>Close</button>' +
      "</div></div>";

    this.titleEl = this.el.querySelector(".insp-title");
    this.evalBar = this.el.querySelector(".insp-evalbar > div");
    this.contentEl = this.el.querySelector(".insp-content");
    this.followBtn = this.el.querySelector(".insp-follow");
    this.demolishBtn = this.el.querySelector(".insp-demolish");
    this.floorsBtn = this.el.querySelector(".insp-floors");

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.close();
    });
    this.followBtn.addEventListener("click", () => {
      if (this.person) {
        this.game.cameraFollowTarget = (this.game.cameraFollowTarget === this.person ? null : this.person);
        this.followBtn.classList.toggle("checked", this.game.cameraFollowTarget === this.person);
      }
    });
    this.demolishBtn.addEventListener("click", () => this._demolish());
    this.floorsBtn.addEventListener("click", () => {
      if (this.item?.isElevator()) this.onOpenElevator?.(this.item);
    });
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.close(),
    });
  }

  get visible() {
    return this.el.style.display !== "none" && (this.item != null || this.person != null);
  }

  showForItem(item) {
    if (!item) {
      this.close();
      return;
    }
    this.item = item;
    this.person = null;
    this.el.style.display = "";
    this._lastText = "";
    this.followBtn.style.display = "none";
    this.demolishBtn.style.display = "";
    this.refresh(true);
  }

  showForPerson(person) {
    if (!person) {
      this.close();
      return;
    }
    this.person = person;
    this.item = null;
    this.el.style.display = "";
    this._lastText = "";
    this.followBtn.style.display = "";
    this.followBtn.classList.toggle("checked", this.game.cameraFollowTarget === person);
    this.demolishBtn.style.display = "none";
    this.floorsBtn.style.display = "none";
    this.refresh(true);
  }

  close() {
    if (this.game.cameraFollowTarget === this.person) {
      this.game.cameraFollowTarget = null;
    }
    this.item = null;
    this.person = null;
    this.el.style.display = "none";
    // Clear the debug route overlay (InspectorDialog::close).
    this.game.visualizeRoute.clear();
  }

  // game.ui.refreshInspector — called every frame; throttle to 4 Hz.
  refresh(force = false) {
    if (!this.visible) return;
    this._sinceRefresh += 1;
    if (!force && this._sinceRefresh < 15) return;
    this._sinceRefresh = 0;

    if (this.person) {
      const p = this.person;
      this.titleEl.textContent = p.name;
      const atName = p.at ? (p.at.prototype?.name || "Transit") : "Tower Entrance";
      const floorStr = p.at ? ("F" + p.at.position.y) : "F0";
      const text =
        "Role: " + p.name + "\n" +
        "State: " + (p.getStateName ? p.getStateName() : "Active") + "\n" +
        "Location: " + atName + " (" + floorStr + ")\n" +
        "Stress: " + Math.round(p.stress) + "%\n" +
        "Status: " + (p.getThoughtStatus ? p.getThoughtStatus() : "Normal");
      if (text !== this._lastText) {
        this._lastText = text;
        this.contentEl.textContent = text;
      }
      const evalScore = Math.max(0, Math.min(100, Math.round(100 - p.stress)));
      if (evalScore !== this._lastBar) {
        this._lastBar = evalScore;
        this.evalBar.style.width = evalScore + "%";
        this.evalBar.style.background = evalScore >= 70 ? "#63c8ff" : evalScore >= 40 ? "#ffd66f" : "#ff6f6f";
      }
      this.followBtn.classList.toggle("checked", this.game.cameraFollowTarget === p);
      return;
    }

    const item = this.item;
    if (!item) return;
    this.titleEl.textContent = item.prototype.name;
    const text = describeItem(item, this.game.time.absolute);
    if (text !== this._lastText) {
      this._lastText = text;
      this.contentEl.textContent = text;
    }
    const pct = Math.max(0, Math.min(100, Math.trunc(item.evaluation)));
    if (pct !== this._lastBar) {
      this._lastBar = pct;
      this.evalBar.style.width = pct + "%";
      this.evalBar.style.background = pct >= 70 ? "#63c8ff" : pct >= 40 ? "#ffd66f" : "#ff6f6f";
    }
    this.floorsBtn.style.display = item.isElevator() ? "" : "none";
  }

  // Bulldozer-equivalent demolition with the same guards as
  // Game::handleEvent's bulldozer branch (never lobby/floor/metro).
  _demolish() {
    const g = this.game;
    const item = this.item;
    if (!item) return;
    const icon = item.prototype.icon;
    if (icon === ICON.LOBBY || icon === ICON.FLOOR || icon === ICON.METRO) {
      g.playOnce("simtower/construction/impossible");
      g.ui.showMessage("Cannot bulldoze " + item.prototype.name);
      return;
    }
    const canHaulPeople = item.canHaulPeople();
    g.removeItem(item);
    if (canHaulPeople) g.updateRoutes();
    g.playOnce("simtower/bulldozer");
    this.close();
  }
}

// --------------------------------------------------------------------------
// ElevatorDialog (180x280 @ (130,40))
// --------------------------------------------------------------------------

export class ElevatorDialog {
  constructor(game, container) {
    this.game = game;
    this.elevator = null;
    this.floorBtns = new Map();
    this.mode = "all"; // "all" | "wd" | "we"

    this.el = document.createElement("div");
    this.el.id = "elevatordlg";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span>Elevator Controls</span>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>' +
      '<div class="oswin-body">' +
      '<div class="elev-header"></div>' +
      '<div class="elev-mode-tabs">' +
      '<button type="button" class="osbtn elev-tab active" data-mode="all">All Days</button>' +
      '<button type="button" class="osbtn elev-tab" data-mode="wd">WD Only</button>' +
      '<button type="button" class="osbtn elev-tab" data-mode="we">WE Only</button>' +
      '</div>' +
      '<div class="elev-quick-btns">' +
      '<button type="button" class="osbtn elev-quick" data-act="all-on">All ON</button>' +
      '<button type="button" class="osbtn elev-quick" data-act="all-off">All OFF</button>' +
      '<button type="button" class="osbtn elev-quick" data-act="invert">Invert</button>' +
      '</div>' +
      '<div class="elev-floors"></div>' +
      '<div class="elev-cars-section">' +
      '<div class="elev-cars-header"><span>Cars</span>' +
      '<div class="elev-car-actions">' +
      '<button type="button" class="osbtn elev-add-car">+ Car</button>' +
      '<button type="button" class="osbtn elev-rem-car">- Car</button>' +
      '</div></div>' +
      '<div class="elev-cars-list"></div>' +
      '</div>' +
      '<div class="elev-buttons">' +
      '<button type="button" class="osbtn elev-show">Show: Yes</button>' +
      '<button type="button" class="osbtn" data-close>Close</button>' +
      "</div></div>";

    this.headerEl = this.el.querySelector(".elev-header");
    this.floorsEl = this.el.querySelector(".elev-floors");
    this.carsListEl = this.el.querySelector(".elev-cars-list");
    this.addCarBtn = this.el.querySelector(".elev-add-car");
    this.remCarBtn = this.el.querySelector(".elev-rem-car");
    this.showBtn = this.el.querySelector(".elev-show");

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.close();
      const tab = e.target.closest("[data-mode]");
      if (tab) {
        this.mode = tab.dataset.mode;
        for (const b of this.el.querySelectorAll(".elev-tab")) {
          b.classList.toggle("active", b === tab);
        }
        this._rebuildFloorButtons();
      }
      const act = e.target.closest("[data-act]");
      if (act && this.elevator) {
        const action = act.dataset.act;
        this._batchToggle(action);
      }
    });

    this.addCarBtn.addEventListener("click", () => {
      const elv = this.elevator;
      if (!elv) return;
      // Authentic SimTower per-car prices: $80k standard, $150k express, $50k service.
      const carCost = elv.prototype?.carCost ?? 80000;
      const fmt = "$" + carCost.toLocaleString("en-US");
      if (this.game.funds < carCost) {
        this.game.ui?.showMessage("Insufficient funds for new elevator car (" + fmt + " required)");
        return;
      }
      this.game.transferFunds(-carCost, "construction", "Added Elevator Car");
      elv.addCar();
      this.game.updateRoutes();
      this.game.playOnce("simtower/construction/normal");
      this.refresh(true);
    });

    this.remCarBtn.addEventListener("click", () => {
      const elv = this.elevator;
      if (!elv || elv.cars.length <= 1) return;
      elv.removeCar();
      this.game.transferFunds(Math.trunc((elv.prototype?.carCost ?? 80000) / 2), "refund", "Sold Elevator Car");
      this.game.updateRoutes();
      this.game.playOnce("simtower/money/earned");
      this.refresh(true);
    });

    this.showBtn.addEventListener("click", () => {
      const e = this.elevator;
      if (!e) return;
      e.showShaft = !e.showShaft;
      this._updateShowToggle();
    });
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.close(),
    });
  }

  get visible() {
    return this.el.style.display !== "none" && this.elevator != null;
  }

  showForItem(e) {
    if (!e) {
      this.close();
      return;
    }
    this.elevator = e;
    this.el.style.display = "";
    this._rebuildFloorButtons();
    this.refresh(true);
  }

  close() {
    this.elevator = null;
    this.el.style.display = "none";
  }

  _batchToggle(action) {
    const e = this.elevator;
    if (!e) return;
    const minY = e.position.y;
    const maxY = e.position.y + e.size.y;
    for (let floor = minY; floor < maxY; floor++) {
      const isServed = this._isFloorServedInCurrentMode(floor);
      if (action === "all-on" && !isServed) {
        this.game.toggleElevatorService(e, floor, this.mode);
      } else if (action === "all-off" && isServed) {
        this.game.toggleElevatorService(e, floor, this.mode);
      } else if (action === "invert") {
        this.game.toggleElevatorService(e, floor, this.mode);
      }
    }
    this._rebuildFloorButtons();
  }

  _isFloorServedInCurrentMode(floor) {
    const e = this.elevator;
    if (!e) return false;
    if (this.mode === "we") {
      return e.unservicedFloorsWeekend.size > 0
        ? !e.unservicedFloorsWeekend.has(floor)
        : !e.unservicedFloors.has(floor);
    }
    return !e.unservicedFloors.has(floor);
  }

  _updateShowToggle() {
    const e = this.elevator;
    this.showBtn.textContent = !e || e.showShaft ? "Show: Yes" : "Show: No";
  }

  _rebuildFloorButtons() {
    const g = this.game;
    const e = this.elevator;
    this.floorsEl.replaceChildren();
    this.floorBtns.clear();
    if (!e) return;
    const minY = e.position.y;
    const maxY = e.position.y + e.size.y;
    for (let floor = minY; floor < maxY; floor++) {
      if (floor === 1 || floor === 2) continue; // Inaccessible 3-story lobby floors
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "osbtn elev-floor";
      btn.addEventListener("click", () => {
        if (!this.elevator) return;
        g.toggleElevatorService(this.elevator, floor, this.mode);
        this._setBtnLabel(btn, floor);
      });
      this._setBtnLabel(btn, floor);
      this.floorsEl.appendChild(btn);
      this.floorBtns.set(floor, btn);
    }
    this._rebuildCarsList();
  }

  _setBtnLabel(btn, floor) {
    const served = this._isFloorServedInCurrentMode(floor);
    btn.innerHTML = "F" + floor +
      ' <span class="' + (served ? "on" : "off") + '">' +
      (served ? "[ON]" : "[OFF]") + "</span>";
  }

  _rebuildCarsList() {
    const e = this.elevator;
    this.carsListEl.replaceChildren();
    if (!e) return;
    this.addCarBtn.disabled = e.cars.length >= 8 || this.game.funds < (e.prototype?.carCost ?? 80000);
    this.remCarBtn.disabled = e.cars.length <= 1;

    const minY = e.position.y;
    const maxY = e.position.y + e.size.y;

    e.cars.forEach((car, idx) => {
      const row = document.createElement("div");
      row.className = "elev-car-row";

      const info = document.createElement("span");
      info.className = "elev-car-info";
      info.textContent = "Car " + (idx + 1) + " (F" + Math.round(car.altitude) + ")";
      row.appendChild(info);

      const homeLabel = document.createElement("label");
      homeLabel.className = "elev-home-label";
      homeLabel.textContent = "Home:";
      row.appendChild(homeLabel);

      const select = document.createElement("select");
      select.className = "osselect elev-home-select";
      for (let f = minY; f < maxY; f++) {
        if (f === 1 || f === 2) continue; // Inaccessible 3-story lobby floors
        const opt = document.createElement("option");
        opt.value = String(f);
        opt.textContent = "F" + f;
        if (f === car.homeFloor) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        car.homeFloor = parseInt(select.value, 10);
      });
      row.appendChild(select);

      this.carsListEl.appendChild(row);
    });
  }

  // game.ui.refreshElevatorDialog — every frame; cheap label sync.
  refresh(force = false) {
    if (!this.visible) return;
    const e = this.elevator;
    this.headerEl.textContent = e.prototype.name + "\n" +
      "Floors " + e.position.y + "-" + (e.position.y + e.size.y - 1) +
      " | Cars: " + (e.cars ? e.cars.length : 0) +
      "\nCapacity: " + e.maxCarCapacity + " pax/car";
    this._updateShowToggle();
    for (const [floor, btn] of this.floorBtns) this._setBtnLabel(btn, floor);
    if (force) this._rebuildCarsList();
  }
}

// --------------------------------------------------------------------------
// MapWindow (200x288 canvas, right-anchored; visible by default, toggle M)
// --------------------------------------------------------------------------

const MAP_W = 200;
const MAP_H = 288;
const MAP_SKY_H = 264;

// MapWindow::colorForItem (opaque minimap palette).
function mapColorForItem(game, item) {
  const id = item.prototype.id;
  if (item.isElevator()) return "rgb(40,44,52)";
  if (id === "stairs" || id === "escalator") return "rgb(70,70,80)";

  if (game.statusMode !== 0) {
    const tenant = id === "office" || id === "condo" || id === "yoot_condo" ||
      id === "hotel_single" || id === "hotel_double" || id === "hotel_suite" ||
      id === "hotel" || id === "fastfood" || id === "restaurant" ||
      id === "cinema" || id === "partyhall";
    if (!tenant || item.underConstruction) return "rgb(60,65,75)";
  }
  if (game.statusMode === 1) {
    const e = item.evaluation;
    if (e >= 70) return "rgb(60,130,230)";
    if (e >= 40) return "rgb(230,180,40)";
    return "rgb(210,60,60)";
  }
  if (game.statusMode === 3) {
    if (typeof item.roomState === "number") {
      if (item.roomState === 2) return "rgb(210,60,60)";
      if (item.roomState === 1) return "rgb(230,180,40)";
      return "rgb(80,200,90)";
    }
    return "rgb(60,65,75)";
  }
  if (game.statusMode === 2) {
    if (id === "condo" || id === "yoot_condo" || id === "office") {
      if (!item.isOccupied()) return "rgb(230,180,40)";
    }
    return "rgb(60,65,75)";
  }
  if (id === "lobby" || id === "floor") return "rgb(155,155,165)";
  return "rgb(175,175,185)";
}

export class MapWindow {
  constructor(game, container, { bitmaps } = {}) {
    this.game = game;
    this.bitmaps = bitmaps;
    this.desiredVisible = true; // visible by default (MapWindow.cpp:26)
    this.scale = 0;
    this.towerMinX = this.towerMaxX = 0;
    this.towerMinY = this.towerMaxY = 0;
    this._lastAbs = -1e9;
    this._lastStatus = -1;
    this.isDragging = false;
    // ISSUE-040: on phones the always-open minimap eats a big chunk of the
    // only screen space available (user feedback: "way too large"). Start
    // it collapsed to a small pill there; desktop/tablet keep it fully
    // open by default like MapWindow.cpp always did.
    this.minimized =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(max-width: 480px)").matches
        : false;

    this.el = document.createElement("div");
    this.el.id = "mapwindow";
    this.el.className = "oswin";
    this.el.innerHTML =
      '<div class="oswin-title"><button type="button" class="osbtn map-min-btn" title="Collapse / expand the minimap">\u25be</button>' +
      '<span class="map-title">Map (Normal)</span>' +
      '<button type="button" class="osbtn map-mode-btn" title="Cycle Status View (O)">View</button>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>';
    this.titleEl = this.el.querySelector(".map-title");
    this.modeBtn = this.el.querySelector(".map-mode-btn");
    this.minBtn = this.el.querySelector(".map-min-btn");
    this.canvas = document.createElement("canvas");
    this.canvas.width = MAP_W;
    this.canvas.height = MAP_H;
    this.el.appendChild(this.canvas);
    this.el.classList.toggle("minimized", this.minimized);

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.setVisible(false);
    });

    this.minBtn.addEventListener("click", () => this.toggleMinimized());
    // Collapsed, the pill is small enough that tapping anywhere on the
    // title bar (not just the tiny ▾/▸ button) should expand it back out.
    this.el.querySelector(".oswin-title").addEventListener("click", (e) => {
      if (this.minimized && !e.target.closest(".map-min-btn")) this.toggleMinimized();
    });

    this.modeBtn.addEventListener("click", () => {
      this.game.cycleStatusMode();
      this.renderMap(true);
    });

    const handlePointerCoord = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.handleClick(e.clientX - r.left, e.clientY - r.top);
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
      handlePointerCoord(e);
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.isDragging) {
        handlePointerCoord(e);
      }
    });

    const stopDrag = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { this.canvas.releasePointerCapture(e.pointerId); } catch {}
      }
    };
    this.canvas.addEventListener("pointerup", stopDrag);
    this.canvas.addEventListener("pointercancel", stopDrag);

    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"));
  }

  get visible() {
    return this.desiredVisible;
  }

  setVisible(v) {
    this.desiredVisible = v;
    this.el.style.display = v ? "" : "none";
    if (v) this.renderMap(true);
  }

  toggle() {
    this.setVisible(!this.desiredVisible);
  }

  // ISSUE-040: collapse to a small pill on phones instead of hiding
  // outright — a tap brings the full card straight back, no need to dig
  // back into the menu the way fully closing (setVisible(false)) would.
  toggleMinimized() {
    this.minimized = !this.minimized;
    this.el.classList.toggle("minimized", this.minimized);
    this.minBtn.textContent = this.minimized ? "▸" : "▾";
    if (!this.minimized) this.renderMap(true);
  }

  // Called from the UI frame loop; throttled to ~1 s of game time like
  // MapWindow's render cadence, plus forced on status-mode change.
  advance() {
    const g = this.game;
    if (!this.desiredVisible) return;
    if (g.statusMode !== this._lastStatus) {
      this._lastStatus = g.statusMode;
      this._updateTitle();
      this.renderMap(true);
      return;
    }
    if (g.time.absolute - this._lastAbs >= K_BASE_SPEED) {
      this.renderMap(true);
    }
  }

  _updateTitle() {
    const names = ["Map (Normal)", "Map (Eval)", "Map (For Sale)", "Map (Hotel)"];
    const name = names[this.game.statusMode] || "Map";
    this.titleEl.textContent = name;
  }

  renderMap(force = false) {
    if (!force && this.game.time.absolute - this._lastAbs < K_BASE_SPEED) return;
    this._lastAbs = this.game.time.absolute;
    const g = this.game;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    // tower bounds (computeTowerBounds) — shared with the zoom "fit" control
    const { minX, minY, maxX, maxY } = towerBounds(g.items);
    this.towerMinX = minX; this.towerMinY = minY;
    this.towerMaxX = maxX; this.towerMaxY = maxY;

    const w = Math.max(1, maxX - minX);
    const hAbove = Math.max(1, maxY);
    const hBelow = Math.max(0, -minY);
    const sx = (MAP_W - 8) / w;
    const syAbove = (MAP_SKY_H - 4) / hAbove;
    const syBelow = (MAP_H - MAP_SKY_H - 2) / Math.max(1, hBelow);
    const sy = hBelow > 0 ? Math.min(syAbove, syBelow) : syAbove;
    this.scale = Math.min(sx, sy);

    // sky with parallax + ground strip
    ctx.fillStyle = "rgb(135,210,235)";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    const skyImg = this.bitmaps?.image?.("simtower/ui/map/sky");
    if (skyImg) {
      const skyFrame = Math.max(0, Math.min(3, g.sky.from | 0));
      let off = Math.floor((g.time.absolute * 200) % 200);
      if (off < 0) off += 200;
      const firstW = 200 - off;
      ctx.drawImage(skyImg, skyFrame * 200 + off, 0, firstW, MAP_SKY_H, 0, 0, firstW, MAP_SKY_H);
      if (off > 0) {
        ctx.drawImage(skyImg, skyFrame * 200, 0, off, MAP_SKY_H, firstW, 0, off, MAP_SKY_H);
      }
    }
    const groundImg = this.bitmaps?.image?.("simtower/ui/map/ground");
    if (groundImg) {
      ctx.drawImage(groundImg, 0, 0, MAP_W, 24, 0, MAP_SKY_H, MAP_W, MAP_H - MAP_SKY_H);
    } else {
      ctx.fillStyle = "rgb(90,140,90)";
      ctx.fillRect(0, MAP_SKY_H, MAP_W, MAP_H - MAP_SKY_H);
    }

    const margin = 4;
    const groundY = MAP_SKY_H;
    const drawItem = (item) => {
      const px = margin + (item.position.x - minX) * this.scale;
      const py = groundY - (item.position.y + item.size.y) * this.scale;
      const pw = Math.max(1, item.size.x * this.scale);
      const ph = Math.max(1, item.size.y * this.scale);
      ctx.fillStyle = mapColorForItem(g, item);
      ctx.fillRect(px, py, pw, ph);
    };
    for (const item of g.items) if (item.prototype.id === "floor") drawItem(item);
    for (const item of g.items) if (item.prototype.id !== "floor") drawItem(item);

    // viewport rectangle (web extra — inverts the same projection)
    const win = g.app.window || { width: 1280, height: 768 };
    const halfW = win.width * 0.5 * g.zoom;
    const halfH = win.height * 0.5 * g.zoom;
    const vx0 = g.poi.x - halfW, vx1 = g.poi.x + halfW;
    const vy0 = g.poi.y + halfH, vy1 = g.poi.y - halfH; // world y up
    const mx = (tx) => margin + (tx - minX) * this.scale;
    const my = (ty) => groundY - ty * this.scale;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx(vx0 / 8), my(vy0 / 36), ((vx1 - vx0) / 8) * this.scale, ((vy0 - vy1) / 36) * this.scale);
  }

  // Click-to-jump (MapWindow::handleClick).
  handleClick(canvasX, canvasY) {
    if (this.scale <= 0) return;
    const margin = 4;
    const tileX = (canvasX - margin) / this.scale + this.towerMinX;
    const tileY = (MAP_SKY_H - canvasY) / this.scale - 1; // approximate (C++ parity)
    this.game.centerViewportOnTile(tileX, tileY);
    this.renderMap(true);
  }
}

// --------------------------------------------------------------------------
// FinanceWindow (250x380 @ (2,280); hidden by default, toggle F)
// --------------------------------------------------------------------------

export class FinanceWindow {
  constructor(game, container) {
    this.game = game;
    this.desiredVisible = false;

    this.el = document.createElement("div");
    this.el.id = "finwindow";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span class="fin-title">Finance & Pricing</span>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>' +
      '<div class="oswin-body" style="display: flex; flex-direction: column; gap: 8px;">' +
        '<div class="fin-pricing-controls" style="padding: 6px; background: rgba(0,0,0,0.06); border-radius: 4px; font-size: 11px;">' +
          '<div style="font-weight: bold; margin-bottom: 4px;">Price Policy:</div>' +
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
            '<span>Office Rent:</span>' +
            '<input type="range" id="fin-slider-office" min="5000" max="25000" step="1000" style="width: 80px;" />' +
            '<span id="fin-val-office" style="min-width: 45px; text-align: right;">$10k</span>' +
          '</div>' +
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
            '<span>Hotel Rate:</span>' +
            '<input type="range" id="fin-slider-hotel" min="100" max="1000" step="50" style="width: 80px;" />' +
            '<span id="fin-val-hotel" style="min-width: 45px; text-align: right;">$200</span>' +
          '</div>' +
          '<div style="display: flex; justify-content: space-between; align-items: center;">' +
            '<span>Cinema Tkt:</span>' +
            '<input type="range" id="fin-slider-cinema" min="20" max="100" step="5" style="width: 80px;" />' +
            '<span id="fin-val-cinema" style="min-width: 45px; text-align: right;">$40</span>' +
          '</div>' +
        '</div>' +
        '<div class="fin-content"></div>' +
      '</div>';
    this.titleEl = this.el.querySelector(".fin-title");
    this.contentEl = this.el.querySelector(".fin-content");

    this.sliderOffice = this.el.querySelector("#fin-slider-office");
    this.valOffice = this.el.querySelector("#fin-val-office");
    this.sliderHotel = this.el.querySelector("#fin-slider-hotel");
    this.valHotel = this.el.querySelector("#fin-val-hotel");
    this.sliderCinema = this.el.querySelector("#fin-slider-cinema");
    this.valCinema = this.el.querySelector("#fin-val-cinema");

    this.sliderOffice?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.game.setPricing("officeRent", val);
      if (this.valOffice) this.valOffice.textContent = `$${Math.round(val / 1000)}k`;
      this.refresh();
    });

    this.sliderHotel?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.game.setPricing("hotelSingleRate", val);
      if (this.valHotel) this.valHotel.textContent = `$${val}`;
      this.refresh();
    });

    this.sliderCinema?.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      this.game.setPricing("cinemaTicket", val);
      if (this.valCinema) this.valCinema.textContent = `$${val}`;
      this.refresh();
    });

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.setVisible(false);
    });
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.setVisible(false),
    });
  }

  get visible() {
    return this.desiredVisible;
  }

  setVisible(v) {
    this.desiredVisible = v;
    this.el.style.display = v ? "" : "none";
    if (v) this.refresh();
  }

  toggle() {
    this.setVisible(!this.desiredVisible);
  }

  // game.ui.refreshFinance / FinanceWindow::refresh.
  refresh() {
    if (!this.desiredVisible) return;
    const g = this.game;
    const money = g.money;

    if (this.sliderOffice && g.pricing) {
      this.sliderOffice.value = g.pricing.officeRent || 10000;
      if (this.valOffice) this.valOffice.textContent = `$${Math.round((g.pricing.officeRent || 10000) / 1000)}k`;
    }
    if (this.sliderHotel && g.pricing) {
      this.sliderHotel.value = g.pricing.hotelSingleRate || 200;
      if (this.valHotel) this.valHotel.textContent = `$${g.pricing.hotelSingleRate || 200}`;
    }
    if (this.sliderCinema && g.pricing) {
      this.sliderCinema.value = g.pricing.cinemaTicket || 40;
      if (this.valCinema) this.valCinema.textContent = `$${g.pricing.cinemaTicket || 40}`;
    }

    // per-type count + population (skip infrastructure)
    const count = new Map();
    const pop = new Map();
    for (const item of g.items) {
      const id = item.prototype.id;
      if (!FINANCE_DISPLAY_NAMES[id]) continue;
      count.set(id, (count.get(id) || 0) + 1);
      pop.set(id, (pop.get(id) || 0) + item.population);
    }

    const qc = money.quarterTotalsByCategory;
    const totalIncome = money.quarterIncome;
    const totalMaintenance = -(qc.get("maintenance") || 0);
    const constructionCosts = -(qc.get("construction") || 0);

    let breakdownSum = 0;
    const incomeByType = new Map();
    for (const id of count.keys()) {
      const inc = incomeForType(id, pop.get(id) || 0, pop, qc);
      incomeByType.set(id, inc);
      breakdownSum += inc;
    }
    const otherIncome = totalIncome - breakdownSum;
    const netRevenues = totalIncome - totalMaintenance;

    this.titleEl.textContent = "Year " + g.time.year + ", Quarter " + g.time.quarter;

    // Rendered as reflowing label/value rows rather than the column-aligned
    // monospace block this used to be: that alignment depends on a fixed column
    // width and collapses completely inside a ~375px phone bottom sheet.
    const frag = document.createDocumentFragment();

    const section = (label) => {
      const el = document.createElement("div");
      el.className = "fin-section";
      el.textContent = label;
      frag.appendChild(el);
    };
    const row = (label, value, extraClass) => {
      const el = document.createElement("div");
      el.className = "fin-row" + (extraClass ? " " + extraClass : "");
      const l = document.createElement("span");
      l.className = "fin-label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "fin-value";
      v.textContent = value;
      if (value.startsWith("-")) v.classList.add("neg");
      el.appendChild(l);
      el.appendChild(v);
      frag.appendChild(el);
    };
    const note = (text) => {
      const el = document.createElement("div");
      el.className = "fin-sub";
      el.textContent = text;
      frag.appendChild(el);
    };

    section("Summary");
    row("Total Income", formatCommaMoney(totalIncome));
    row("Total Maintenance", formatCommaMoney(totalMaintenance));
    row("Net Revenues", formatCommaMoney(netRevenues));
    row("Other Income", formatCommaMoney(otherIncome));
    row("Construction Costs", formatCommaMoney(constructionCosts));
    row("Last Quarter", formatCommaMoney(money.lastQuarterBalance));
    row("Total Balance", formatCommaMoney(money.balance), "fin-total");
    row("Funds", formatCommaMoney(g.funds), "fin-total");

    section("Tenants");
    let any = false;
    for (const id of FINANCE_DISPLAY_ORDER) {
      if (!count.get(id)) continue;
      row(FINANCE_DISPLAY_NAMES[id], formatCommaMoney(incomeByType.get(id) || 0));
      note("pop " + (pop.get(id) || 0) + " \u00b7 " + count.get(id) + " units");
      any = true;
    }
    if (!any) note("(none)");

    const catDay = (label, totals, income, expenses) => {
      section(label);
      note("income " + formatCommaMoney(income) + " \u00b7 expenses " + formatCommaMoney(expenses));
      if (totals.size === 0) {
        note("(none)");
        return;
      }
      for (const cat of [...totals.keys()].sort()) {
        row(cat, formatCommaMoney(totals.get(cat)));
      }
    };
    catDay("Today", money.todayTotalsByCategory, money.todayIncome, money.todayExpenses);
    catDay("Yesterday", money.yesterdayTotalsByCategory, money.yesterdayIncome, money.yesterdayExpenses);

    section("Recent days");
    if (money.recentDays.length === 0) {
      note("(none)");
    } else {
      for (let i = money.recentDays.length - 1; i >= 0; i--) {
        const d = money.recentDays[i];
        row("day -" + (money.recentDays.length - 1 - i), formatCommaMoney(d.income - d.expenses));
        note("+" + formatCommaMoney(d.income) + " / -" + formatCommaMoney(d.expenses));
      }
    }

    this.contentEl.replaceChildren(frag);
  }
}

// --------------------------------------------------------------------------
// LevelUpDialog (modal 260x150 centered; does not pause the sim)
// --------------------------------------------------------------------------

export class LevelUpDialog {
  constructor(game, container) {
    this.game = game;

    this.backdrop = document.createElement("div");
    this.backdrop.style.cssText =
      "position:absolute;inset:0;z-index:49;display:none;background:rgba(0,0,0,0.35);";
    this.el = document.createElement("div");
    this.el.id = "levelup";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span>Promotion!</span></div>' +
      '<div class="lu-heading"></div>' +
      '<div class="lu-unlocks"></div>' +
      '<div class="lu-buttons"><button type="button" class="osbtn lu-ok">OK</button></div>';
    this.headingEl = this.el.querySelector(".lu-heading");
    this.unlocksEl = this.el.querySelector(".lu-unlocks");
    this.el.querySelector(".lu-ok").addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", () => this.close());
    container.appendChild(this.backdrop);
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"));
  }

  get visible() {
    return this.el.style.display !== "none";
  }

  // game.ui.showLevelUp(rating) — rating is the new 0-based rating.
  show(rating) {
    const g = this.game;
    const stars = rating + 1;
    this.headingEl.textContent = "Congratulations - your tower reached " + stars + " stars!";
    const list = [];
    for (const p of g.itemFactory.prototypes) {
      if (!p) continue;
      if (LevelUp.minRatingToBuild(p.id) === rating) list.push(p.name);
    }
    this.unlocksEl.textContent = list.length === 0
      ? "New facilities are now available."
      : "New facilities unlocked:\n" + list.join(", ");
    this.el.style.display = "";
    this.backdrop.style.display = "";
  }

  close() {
    this.el.style.display = "none";
    this.backdrop.style.display = "none";
  }
}

export class VictoryDialog {
  constructor(game, container) {
    this.game = game;
    this.el = document.createElement("div");
    this.el.id = "victory-dialog";
    this.el.className = "oswin osmodal";
    this.el.style.display = "none";
    this.el.style.width = "400px";

    this.backdrop = document.createElement("div");
    this.backdrop.className = "osmodal-backdrop";
    this.backdrop.style.display = "none";

    this.el.innerHTML = `
      <div class="oswin-titlebar">
        <span class="oswin-title">★ TOWER OF THE YEAR ★</span>
      </div>
      <div class="oswin-body" style="padding: 16px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #ffd700;">
          🏆 CONGRATULATIONS! 🏆
        </div>
        <p style="margin: 0 0 12px 0; font-size: 13px;">
          You have built the Cathedral and completed the ultimate skyscraper!
        </p>
        <div id="victory-stats" style="margin: 12px 0; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-size: 12px; line-height: 1.6;">
        </div>
        <button id="victory-continue-btn" class="osbtn" style="margin-top: 12px; padding: 6px 16px; font-weight: bold;">
          Continue in Sandbox Mode
        </button>
      </div>
    `;

    this.statsEl = this.el.querySelector("#victory-stats");
    this.continueBtn = this.el.querySelector("#victory-continue-btn");
    this.continueBtn?.addEventListener("click", () => this.close());

    container.appendChild(this.backdrop);
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"));
  }

  get visible() {
    return this.el.style.display !== "none";
  }

  show(stats = {}) {
    if (this.statsEl) {
      this.statsEl.innerHTML = `
        <div><strong>Tower Rating:</strong> ${stats.towerRating || "TOWER"}</div>
        <div><strong>Population:</strong> ${(stats.population || 0).toLocaleString()}</div>
        <div><strong>Treasury:</strong> $${(stats.funds || 0).toLocaleString()}</div>
        <div><strong>Date:</strong> Year ${stats.year || 1}, Day ${stats.day || 0}</div>
      `;
    }
    this.el.style.display = "";
    this.backdrop.style.display = "";
  }

  close() {
    this.el.style.display = "none";
    this.backdrop.style.display = "none";
  }
}

export class VipReviewDialog {
  constructor(game, container) {
    this.game = game;
    this.el = document.createElement("div");
    this.el.id = "vip-review-dialog";
    this.el.className = "oswin osmodal";
    this.el.style.display = "none";
    this.el.style.width = "420px";

    this.backdrop = document.createElement("div");
    this.backdrop.className = "osmodal-backdrop";
    this.backdrop.style.display = "none";

    this.el.innerHTML = `
      <div class="oswin-titlebar">
        <span class="oswin-title">VIP Inspection Report</span>
      </div>
      <div class="oswin-body" style="padding: 16px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 18px; font-weight: bold;" id="vip-verdict-title">VIP VERDICT</div>
          <div style="font-size: 12px; color: #666;" id="vip-inspector-name">VIP Hotel & Tower Inspector</div>
        </div>
        <div id="vip-breakdown-list" style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.06); border-radius: 4px; font-size: 12px; line-height: 1.6;">
        </div>
        <div style="text-align: center; font-weight: bold; font-size: 14px; margin-top: 8px;" id="vip-reward-banner">
        </div>
        <div style="text-align: center; margin-top: 14px;">
          <button id="vip-close-btn" class="osbtn" style="padding: 6px 20px; font-weight: bold;">OK</button>
        </div>
      </div>
    `;

    this.titleEl = this.el.querySelector("#vip-verdict-title");
    this.listEl = this.el.querySelector("#vip-breakdown-list");
    this.rewardEl = this.el.querySelector("#vip-reward-banner");
    this.closeBtn = this.el.querySelector("#vip-close-btn");
    this.closeBtn?.addEventListener("click", () => this.close());

    container.appendChild(this.backdrop);
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"));
  }

  show(review = {}) {
    if (this.titleEl) {
      this.titleEl.textContent = review.verdict || "VIP Inspection Complete";
      this.titleEl.style.color = review.score >= 75 ? "#2e7d32" : (review.score >= 55 ? "#1976d2" : "#c62828");
    }
    if (this.listEl) {
      this.listEl.innerHTML = `
        <div><strong>Overall Score:</strong> ${Math.round(review.score || 0)} / 100</div>
        <div><strong>Cleanliness:</strong> ${review.breakdown?.cleanliness || "Good"}</div>
        <div><strong>Facility Coverage:</strong> ${review.breakdown?.facilities || "Standard"}</div>
        <div><strong>Elevator Transit:</strong> ${review.breakdown?.elevators || "Acceptable"}</div>
      `;
    }
    if (this.rewardEl) {
      this.rewardEl.textContent = review.reward > 0
        ? `Grant Awarded: +$${review.reward.toLocaleString()}`
        : "No grant awarded. Improve tower amenities and elevators.";
      this.rewardEl.style.color = review.reward > 0 ? "#2e7d32" : "#c62828";
    }
    this.el.style.display = "";
    this.backdrop.style.display = "";
  }

  get visible() {
    return this.el.style.display !== "none";
  }

  close() {
    this.el.style.display = "none";
    this.backdrop.style.display = "none";
  }
}

export class FindDialog {
  constructor(game, container, { onSelectPerson, onSelectItem } = {}) {
    this.game = game;
    this.onSelectPerson = onSelectPerson;
    this.onSelectItem = onSelectItem;
    this.currentTab = "people";
    this.desiredVisible = false;

    this.el = document.createElement("div");
    this.el.id = "find-dialog";
    this.el.className = "oswin osmodal";
    this.el.style.display = "none";
    this.el.style.width = "460px";
    this.el.style.maxHeight = "500px";

    this.backdrop = document.createElement("div");
    this.backdrop.className = "osmodal-backdrop";
    this.backdrop.style.display = "none";

    this.el.innerHTML = `
      <div class="oswin-titlebar" style="display: flex; justify-content: space-between; align-items: center;">
        <span class="oswin-title">Find & Search</span>
        <button id="find-close-x" style="background: none; border: none; font-weight: bold; cursor: pointer; color: inherit;">×</button>
      </div>
      <div class="oswin-body" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div class="find-tabs">
          <button class="osbtn find-tab active" data-tab="people">People</button>
          <button class="osbtn find-tab" data-tab="tenants">Tenants</button>
          <button class="osbtn find-tab" data-tab="stressed">Stressed</button>
          <button class="osbtn find-tab" data-tab="dirty">Dirty Rooms</button>
        </div>
        <input type="text" id="find-search-input" placeholder="Search by name, role, floor..." />
        <div id="find-results-list"></div>
      </div>
    `;

    this.tabs = this.el.querySelectorAll(".find-tab");
    this.searchInput = this.el.querySelector("#find-search-input");
    this.resultsList = this.el.querySelector("#find-results-list");
    this.closeX = this.el.querySelector("#find-close-x");

    this.closeX?.addEventListener("click", () => this.close());
    this.backdrop?.addEventListener("click", () => this.close());

    this.tabs.forEach((t) => {
      t.addEventListener("click", (e) => {
        this.tabs.forEach((b) => b.classList.remove("active"));
        t.classList.add("active");
        this.currentTab = t.getAttribute("data-tab");
        this.refresh();
      });
    });

    this.searchInput?.addEventListener("input", () => this.refresh());

    container.appendChild(this.backdrop);
    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.close(),
    });
  }

  get visible() {
    return this.desiredVisible;
  }

  show(tab = "people") {
    this.desiredVisible = true;
    this.currentTab = tab;
    this.tabs.forEach((b) => {
      if (b.getAttribute("data-tab") === tab) b.classList.add("active");
      else b.classList.remove("active");
    });
    this.el.style.display = "";
    this.backdrop.style.display = "";
    if (this.searchInput) {
      this.searchInput.value = "";
      this.searchInput.focus();
    }
    this.refresh();
  }

  close() {
    this.desiredVisible = false;
    this.el.style.display = "none";
    this.backdrop.style.display = "none";
  }

  toggle(tab = "people") {
    if (this.desiredVisible) this.close();
    else this.show(tab);
  }

  refresh() {
    if (!this.resultsList) return;
    const query = (this.searchInput?.value || "").toLowerCase().trim();
    const g = this.game;
    this.resultsList.innerHTML = "";

    const rows = [];

    if (this.currentTab === "people") {
      for (const p of g.people || []) {
        const name = p.name || "Person";
        const state = p.getStateName ? p.getStateName() : "Wandering";
        const role = p.role || "Occupant";
        const floor = p.at ? `Floor ${p.at.position.y}` : "Outside";
        if (query && !name.toLowerCase().includes(query) && !state.toLowerCase().includes(query) && !floor.toLowerCase().includes(query)) continue;
        rows.push({
          title: `${name} (${state})`,
          subtitle: `${floor} | Stress: ${Math.round(p.stress)}%`,
          onClick: () => {
            const pos = p.getWorldPosition();
            if (pos) g.centerViewportOnTile(pos.x / 8, pos.y / 36);
            this.onSelectPerson?.(p);
            this.close();
          },
        });
      }
    } else if (this.currentTab === "tenants") {
      for (const item of g.items || []) {
        const id = item.prototype?.id || "";
        const name = item.prototype?.name || id;
        const floor = `Floor ${item.position.y}`;
        const occ = item.isOccupied ? (item.isOccupied() ? "Occupied" : "Vacant") : "Active";
        if (query && !name.toLowerCase().includes(query) && !floor.toLowerCase().includes(query) && !occ.toLowerCase().includes(query)) continue;
        rows.push({
          title: `${name} — ${occ}`,
          subtitle: `${floor} | Eval: ${Math.round(item.evaluation || 50)}`,
          onClick: () => {
            g.centerViewportOnTile(item.position.x, item.position.y);
            this.onSelectItem?.(item);
            this.close();
          },
        });
      }
    } else if (this.currentTab === "stressed") {
      for (const p of g.people || []) {
        if (p.stress < 40) continue;
        const name = p.name || "Person";
        const thought = p.getThoughtStatus ? p.getThoughtStatus() : "Unhappy";
        const floor = p.at ? `Floor ${p.at.position.y}` : "Outside";
        if (query && !name.toLowerCase().includes(query) && !thought.toLowerCase().includes(query)) continue;
        rows.push({
          title: `⚠️ ${name} (Stress: ${Math.round(p.stress)}%)`,
          subtitle: `${floor} | ${thought}`,
          onClick: () => {
            const pos = p.getWorldPosition();
            if (pos) g.centerViewportOnTile(pos.x / 8, pos.y / 36);
            this.onSelectPerson?.(p);
            this.close();
          },
        });
      }
    } else if (this.currentTab === "dirty") {
      for (const item of g.items || []) {
        if (!item.prototype?.id?.startsWith("hotel")) continue;
        if (item.roomState !== 2) continue; // dirty
        const name = item.prototype.name;
        const floor = `Floor ${item.position.y}`;
        if (query && !name.toLowerCase().includes(query) && !floor.toLowerCase().includes(query)) continue;
        rows.push({
          title: `🧹 ${name} (Needs Housekeeping)`,
          subtitle: `${floor} | Awaiting Maid Service`,
          onClick: () => {
            g.centerViewportOnTile(item.position.x, item.position.y);
            this.onSelectItem?.(item);
            this.close();
          },
        });
      }
    }

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "find-empty";
      empty.textContent = "No matching results found.";
      this.resultsList.replaceChildren(empty);
      return;
    }

    const shown = rows.slice(0, MAX_FIND_ROWS);
    for (const r of shown) {
      const el = document.createElement("div");
      el.className = "find-result-item";
      const title = document.createElement("div");
      title.className = "find-result-title";
      title.textContent = r.title;
      const sub = document.createElement("div");
      sub.className = "find-result-sub";
      sub.textContent = r.subtitle;
      el.appendChild(title);
      el.appendChild(sub);
      el.addEventListener("click", r.onClick);
      this.resultsList.appendChild(el);
    }
    if (rows.length > shown.length) {
      const more = document.createElement("div");
      more.className = "find-empty";
      more.textContent = `+${rows.length - shown.length} more — refine your search`;
      this.resultsList.appendChild(more);
    }
  }
}

// --------------------------------------------------------------------------
// SaveDialog — in-game Save / Save As / Export surface (ISSUE-030). A draggable
// window exposing a filename field, Save + Save As buttons, PNG screenshot and
// JSON/CSV report exports, and a last-saved note. Delegates to game.ui hooks
// (saveAs / exportScreenshot / exportReport) wired by main.js.
// --------------------------------------------------------------------------

// refresh() rebuilds the list on every keystroke; a large tower has thousands
// of people, so cap what is materialised and tell the player to narrow instead.
const MAX_FIND_ROWS = 100;

const DEFAULT_SAVE_FILENAME = "tower.tower";

// Ensure a user-entered filename keeps the .tower extension.
function normalizeSaveFilename(name) {
  let n = (name || "").trim();
  if (!n) n = DEFAULT_SAVE_FILENAME;
  if (!/\.tower$/i.test(n)) n += ".tower";
  return n;
}

export class SaveDialog {
  constructor(game, container) {
    this.game = game;
    this.desiredVisible = false;

    this.el = document.createElement("div");
    this.el.id = "savedialog";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span>Save Tower</span>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>' +
      '<div class="oswin-body" style="display:flex;flex-direction:column;gap:8px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<label for="save-filename" style="font-size:11px;color:#8fd2ff;">Filename</label>' +
          '<input type="text" id="save-filename" class="save-filename" spellcheck="false" style="flex:1;min-width:0;background:#11141a;color:#e5eef6;border:1px solid #3c4456;padding:2px 5px;font-size:11px;" />' +
        '</div>' +
        '<div class="save-note" style="font-size:10px;color:#aac3d7;min-height:14px;"></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
          '<button type="button" class="osbtn save-btn">Save</button>' +
          '<button type="button" class="osbtn saveas-btn">Save As</button>' +
          '<button type="button" class="osbtn shot-btn">Export Screenshot</button>' +
          '<button type="button" class="osbtn report-btn">Export Report</button>' +
          '<button type="button" class="osbtn" data-close>Close</button>' +
        '</div>' +
      '</div>';

    this.filenameInput = this.el.querySelector(".save-filename");
    this.noteEl = this.el.querySelector(".save-note");
    this.saveBtn = this.el.querySelector(".save-btn");
    this.saveAsBtn = this.el.querySelector(".saveas-btn");
    this.shotBtn = this.el.querySelector(".shot-btn");
    this.reportBtn = this.el.querySelector(".report-btn");

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.close();
    });
    this.saveBtn.addEventListener("click", () => this._save(false));
    this.saveAsBtn.addEventListener("click", () => this._save(true));
    this.shotBtn.addEventListener("click", () => this._exportScreenshot());
    this.reportBtn.addEventListener("click", () => this._exportReport());
    this.filenameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._save(true);
      }
    });

    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.close(),
    });
  }

  get visible() {
    return this.desiredVisible;
  }

  show() {
    this.desiredVisible = true;
    this.filenameInput.value = this.game.saveFilename || DEFAULT_SAVE_FILENAME;
    this.el.style.display = "";
    this._updateNote();
    this.filenameInput.focus();
    this.filenameInput.select();
  }

  close() {
    this.desiredVisible = false;
    this.el.style.display = "none";
  }

  toggle() {
    if (this.desiredVisible) this.close();
    else this.show();
  }

  _updateNote() {
    const g = this.game;
    if (g.lastSavedAt) {
      const d = new Date(g.lastSavedAt);
      this.noteEl.textContent = "Last saved: " + d.toLocaleString();
    } else {
      this.noteEl.textContent = "Not saved yet";
    }
    if (g.isDirty) {
      this.noteEl.textContent += "  \u2022 unsaved changes";
    }
  }

  _save(asNew) {
    const g = this.game;
    const filename = asNew
      ? normalizeSaveFilename(this.filenameInput.value)
      : (g.saveFilename || DEFAULT_SAVE_FILENAME);
    if (asNew) this.filenameInput.value = filename;
    g.ui.saveAs?.(filename);
    g.saveFilename = filename;
    this._updateNote();
  }

  _exportScreenshot() {
    this.game.ui.exportScreenshot?.();
  }

  _exportReport() {
    this.game.ui.exportReport?.();
  }
}

// --------------------------------------------------------------------------
// OptionsDialog (ISSUE-2) — audio (master volume, mute, music/SFX) + zoom
// (default zoom level, zoom step). Draggable, Esc-closable. Persists through
// the pure Settings module (localStorage-guarded).
// --------------------------------------------------------------------------

const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4];
const ZOOM_STEPS = [1.5, 2, 3, 4];

export class OptionsDialog {
  constructor(game, container, { sound } = {}) {
    this.game = game;
    this.sound = sound;
    this.desiredVisible = false;
    this.settings = { ...DEFAULT_SETTINGS };

    this.el = document.createElement("div");
    this.el.id = "optionsdialog";
    this.el.className = "oswin";
    this.el.style.display = "none";
    this.el.innerHTML =
      '<div class="oswin-title"><span>Options</span>' +
      '<span class="oswin-x" data-close>\u00d7</span></div>' +
      '<div class="oswin-body" style="display:flex;flex-direction:column;gap:10px;padding:8px;">' +
        '<div class="opt-section" style="font-size:11px;">' +
          '<div style="font-weight:bold;margin-bottom:4px;">Audio</div>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
            '<span>Volume</span>' +
            '<input type="range" class="opt-volume" min="0" max="100" step="1" style="flex:1;" />' +
            '<span class="opt-volume-val" style="min-width:34px;text-align:right;">80%</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" class="opt-mute" /> Mute sound</label>' +
          '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" class="opt-music" /> Ambient music</label>' +
          '<label style="display:flex;align-items:center;gap:4px;"><input type="checkbox" class="opt-sfx" /> Sound effects</label>' +
        '</div>' +
        '<div class="opt-section" style="font-size:11px;">' +
          '<div style="font-weight:bold;margin-bottom:4px;">Zoom</div>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
            '<span>Default zoom</span>' +
            '<select class="opt-default-zoom" style="flex:1;"></select>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span>Zoom step</span>' +
            '<select class="opt-zoom-step" style="flex:1;"></select>' +
          '</div>' +
        '</div>' +
        '<div class="opt-section" style="font-size:10px;color:#888;border-top:1px solid #444;padding-top:6px;margin-top:2px;">' +
          `<div>OpenSkyWeb v${BUILD_INFO.version} (${BUILD_INFO.branch})</div>` +
          `<div style="font-family:monospace;word-break:break-all;color:#aaa;">commit: ${BUILD_INFO.commit}</div>` +
          `<div>built: ${BUILD_INFO.builtAt}</div>` +
        '</div>' +
        '<div style="display:flex;gap:4px;">' +
          '<button type="button" class="osbtn opt-reset">Reset to defaults</button>' +
          '<button type="button" class="osbtn" data-close>Close</button>' +
        '</div>' +
      '</div>';

    this.volumeEl = this.el.querySelector(".opt-volume");
    this.volumeValEl = this.el.querySelector(".opt-volume-val");
    this.muteEl = this.el.querySelector(".opt-mute");
    this.musicEl = this.el.querySelector(".opt-music");
    this.sfxEl = this.el.querySelector(".opt-sfx");
    this.defaultZoomEl = this.el.querySelector(".opt-default-zoom");
    this.zoomStepEl = this.el.querySelector(".opt-zoom-step");

    for (const z of ZOOM_PRESETS) {
      const o = document.createElement("option");
      o.value = String(z);
      o.textContent = z + "x";
      this.defaultZoomEl.appendChild(o);
    }
    for (const z of ZOOM_STEPS) {
      const o = document.createElement("option");
      o.value = String(z);
      o.textContent = z + "x";
      this.zoomStepEl.appendChild(o);
    }

    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) this.close();
      if (e.target.closest(".opt-reset")) this._reset();
    });

    this.volumeEl.addEventListener("input", () => {
      this.settings.masterVolume = parseInt(this.volumeEl.value, 10) / 100;
      this._applyAudio();
      this._save();
    });
    this.muteEl.addEventListener("change", () => {
      this.settings.muted = this.muteEl.checked;
      this._applyAudio();
      this._save();
    });
    this.musicEl.addEventListener("change", () => {
      this.settings.musicEnabled = this.musicEl.checked;
      this._applyAudio();
      this._save();
    });
    this.sfxEl.addEventListener("change", () => {
      this.settings.sfxEnabled = this.sfxEl.checked;
      this._applyAudio();
      this._save();
    });
    this.defaultZoomEl.addEventListener("change", () => {
      this.settings.defaultZoom = parseFloat(this.defaultZoomEl.value);
      this.game.zoom = this.settings.defaultZoom;
      this._save();
    });
    this.zoomStepEl.addEventListener("change", () => {
      this.settings.zoomStep = parseFloat(this.zoomStepEl.value);
      this.game.zoomStep = this.settings.zoomStep;
      this._save();
    });

    container.appendChild(this.el);
    makeDraggable(this.el, this.el.querySelector(".oswin-title"), {
      onDismiss: () => this.close(),
    });
  }

  get visible() {
    return this.desiredVisible;
  }

  show() {
    this.desiredVisible = true;
    this.settings = loadSettings();
    this._sync();
    this.el.style.display = "";
    bringToFront(this.el);
  }

  close() {
    this.desiredVisible = false;
    this.el.style.display = "none";
    this._save();
  }

  toggle() {
    if (this.desiredVisible) this.close();
    else this.show();
  }

  _sync() {
    this.volumeEl.value = Math.round(this.settings.masterVolume * 100);
    this.volumeValEl.textContent = Math.round(this.settings.masterVolume * 100) + "%";
    this.muteEl.checked = this.settings.muted;
    this.musicEl.checked = this.settings.musicEnabled;
    this.sfxEl.checked = this.settings.sfxEnabled;
    this.defaultZoomEl.value = String(this.settings.defaultZoom);
    this.zoomStepEl.value = String(this.settings.zoomStep);
    this._applyAudio();
    this.game.zoom = this.settings.defaultZoom;
    this.game.zoomStep = this.settings.zoomStep;
  }

  _applyAudio() {
    const s = this.sound;
    if (!s) return;
    s.setMasterVolume?.(this.settings.masterVolume);
    s.setMuted?.(this.settings.muted);
    s.setMusicEnabled?.(this.settings.musicEnabled);
    s.setSfxEnabled?.(this.settings.sfxEnabled);
  }

  _save() {
    saveSettings(this.settings);
  }

  _reset() {
    this.settings = normalizeSettings(DEFAULT_SETTINGS);
    this._sync();
    this._save();
  }
}
