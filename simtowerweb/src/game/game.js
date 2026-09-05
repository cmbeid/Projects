// Port of OT::Game (source/Game.h / Game.cpp) — simulation core only.
// Rendering and DOM UI live elsewhere; they read game state and receive UI hooks
// through `game.ui` (no-op by default so the sim runs headless).
//
// Coordinate system: tiles are 8px wide x 36px tall. World y grows UP (floor y=0
// is ground). Rendering negates y. Items are positioned by their bottom-left tile.

import { Time, K_BASE_SPEED, hourToAbsolute } from "../core/time.js";
import { Money } from "../core/money.js";
import { Rand, setGlobalRand } from "../core/rand.js";
import { Route } from "./route.js";
import { XMLPrinter, parseXML, intAttr, doubleAttr, boolAttr, childrenNamed, firstChildNamed } from "../core/xml.js";
import { injectSaveHash, verifySaveHash } from "../core/savehash.js";
import { LevelUp } from "./systems/levelup.js";
import { findRampAt } from "./items/parkingramp.js";


// icon enum (order matters — matches C++ Icon enum used by prototypes)
export const ICON = {
  FLOOR: 0,
  LOBBY: 1,
  STAIRS: 2,
  OFFICE: 3,
  ELEVATOR: 4,
  SERVICE_ELEVATOR: 5,
  METRO: 6,
  RESTAURANT: 7,
  FASTFOOD: 8,
  CONDO: 9,
  HOTEL: 10,
  PARKING: 11,
  RECYCLING: 12,
  SECURITY: 13,
  MEDICAL: 14,
  CINEMA: 15,
  PARTYHALL: 16,
  CATHEDRAL: 17,
};

export const STATUS_MODE = { NORMAL: 0, EVAL: 1, PRIC: 2, HOTEL: 3 };

function noopUI() {
  const fns = [
    "showMessage", "updateFunds", "updateMoneyStats", "updateRating", "updatePopulation",
    "updateTime", "updateTooltip", "updateTool", "updateSpeed", "reloadToolbox",
    "refreshInspector", "refreshElevatorDialog", "showLevelUp", "showInspectorForItem",
    "showInspectorForPerson", "showElevatorDialogForItem", "renderMap", "refreshFinance", "closeDialogs",
  ];
  const ui = {};
  for (const f of fns) ui[f] = () => {};
  return ui;
}

export class Game {
  constructor(app) {
    this.app = app; // {bitmaps?, sound?, window:{width,height}} — stub-friendly
    this.rand = new Rand(1);
    setGlobalRand(this.rand);

    this.items = new Set();
    this.people = new Set();
    this.itemsByFloor = new Map(); // int -> Set<Item>
    this.itemsByType = new Map(); // string -> Set<Item>
    this.floorItems = new Map(); // int -> Floor
    this.mainLobby = null;
    this.metroStation = null;

    this.funds = 4000000;
    this.money = new Money();
    this.money.setBalance(this.funds);
    this.rating = 0;
    this.population = 0;
    this.populationNeedsUpdate = false;

    this.time = new Time();
    this.time.set(7 / 78.0); // = exactly 05:00
    this.lastAccountingDay = Math.floor(this.time.absolute);
    this.lastAccountingQuarter = this.time.quarter;

    this.itemBelowCursor = null;
    this.toolPrototype = null;
    this.selectedTool = "inspector";
    this.speedMode = 1;
    this.lastSpeedMode = 1; // shared pause-toggle memory (see togglePause)
    this.statusMode = STATUS_MODE.NORMAL;

    this.zoom = 0.5;
    this.zoomStep = 2;
    this.poi = { x: 0, y: 200 };
    this.cameraFollowTarget = null;

    this.draggingElevator = null;
    this.draggingElevatorStart = 0;
    this.draggingElevatorLower = false;
    this.draggingMotor = 0;

    // ISSUE-039 drag-to-place batching: while an item-tool button is held,
    // queued cells are preview-only; construction happens on release.
    this.batchDrag = null; // { x0, y0, cells:[{x,y,valid,reason}], affordableTotal, firstBlockReason }
    // ISSUE-040: a touch press that would commit something irreversible is
    // held here until pointerup, so a second finger can turn it into a pinch
    // instead. { kind: "construct" | "bulldoze" }. Mouse presses never set it.
    this.pendingPress = null;
    // ISSUE-040 touch placement. A fingertip covers the cell it points at, so
    // touch does not build on contact: the first tap parks a ghost, dragging
    // moves it, and a tap on the ghost commits it. ghostArmed is that parked
    // state; ghostGrab keeps the ghost under the point it was grabbed by
    // instead of snapping its centre to the finger. Set from the pointer type
    // of the press in progress, so a hybrid laptop switches per gesture.
    this.touchInput = false;
    this.ghostArmed = false;
    this.ghostGrab = null;
    this._batchCommitting = false;
    // ISSUE-040: touch has no Shift key to hold during a batch drag, so a
    // long-press at the drag's start (input.js) arms grid mode for that one
    // drag instead — see updateBatchDrag()'s useX/useY.
    this.gridDragArmed = false;

    this.toolPosition = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 }; // world px under cursor (y up)
    this.keys = { ctrl: false, shift: false };
    // ISSUE-040: touch has no Ctrl/Shift to hold while placing a Lobby, so a
    // long-press on its toolbox slot (toolbox.js) arms a default height
    // instead — see updateToolPosition()/clickConstruct()'s lobby height.
    this.lobbyHeight = 1;

    this.visualizeRoute = new Route();

    this.ui = noopUI();
    this.drawnSprites = 0;
    this.saveFilename = "";
    this.isDirty = false;
    this.lastSavedAt = null;
    this.saveCheatDetected = false;

    // sounds state (dedup bookkeeping; actual playback via app.sound)
    this.soundPlayTimes = new Map();

    // Landlord rent & price controls (elasticity & financial policy)
    this.pricing = {
      officeRent: 10000,
      condoPrice: 200000,
      hotelSingleRate: 200,
      hotelDoubleRate: 350,
      hotelSuiteRate: 600,
      cinemaTicket: 40,
    };
  }

  setPricing(type, value) {
    if (this.pricing[type] !== undefined) {
      this.pricing[type] = value;
      if (type === "officeRent") {
        for (const item of this.itemsByType.get("office") || []) item.rent = value;
      }
      this._markDirty();
    }
  }

  // Unsaved-change tracking (surfaced as an asterisk in the TimeWindow and a
  // confirm-before-close in main.js). Cleared by markSaved() / load / seed.
  _markDirty() {
    this.isDirty = true;
  }

  // Called after a successful .tower save (Save / Save As / quick-save).
  markSaved() {
    this.isDirty = false;
    this.lastSavedAt = Date.now();
  }

  // Called once after construction with the subsystem instances.
  wire({ itemFactory, gameMap, pathFinder, sky, lighting, decorations, judgeSystem, vipSystem, eventSystem }) {
    this.itemFactory = itemFactory;
    this.gameMap = gameMap;
    this.pathFinder = pathFinder;
    this.sky = sky;
    this.lighting = lighting;
    this.decorations = decorations;
    this.judgeSystem = judgeSystem;
    this.vipSystem = vipSystem;
    this.eventSystem = eventSystem;
  }

  // ---------------------------------------------------------------- advance
  advance(dt) {
    this.drawnSprites = 0;
    this.time.advance(dt);

    const currentAccountingDay = Math.floor(this.time.absolute);
    if (currentAccountingDay !== this.lastAccountingDay) {
      this.settleDailyAccounting();
      this.lastAccountingDay = currentAccountingDay;
    }
    if (this.time.quarter !== this.lastAccountingQuarter) {
      this.money.finalizeQuarter();
      this.lastAccountingQuarter = this.time.quarter;
    }
    this.ui.updateTime();
    this.sky.advance(dt);
    this.lighting.advance(dt);
    this.vipSystem.advance(dt);
    this.eventSystem.advance(dt);

    // Items (insertion order; construction-gated)
    for (const item of this.items) {
      if (item.underConstruction) {
        if (this.time.absolute >= item.constructionEndTime) {
          item.underConstruction = false;
          this.playOnce("simtower/construction/normal");
        } else {
          continue;
        }
      }
      item.advance(dt);
    }

    for (const p of this.people) p.advance(dt);

    if (this.populationNeedsUpdate) {
      this.populationNeedsUpdate = false;
      let p = 0;
      for (const item of this.items) p += item.population;
      this.setPopulation(p);
    }

    this.ui.refreshInspector();
    this.ui.refreshElevatorDialog();

    // hourly sounds
    if (this.time.checkHour(5)) this.playOnce("simtower/cock", { loop: false });
    if (this.time.checkHour(6)) this.playOnce("simtower/birds/morning", { loop: true });
    if (this.time.checkHour(9)) this.playOnce("simtower/bells");
    if (this.time.checkHour(18)) this.playOnce("simtower/birds/evening");
    if (this.app?.sound) this.app.sound.setLooping("simtower/birds/morning", this.time.hour < 8);

    if (this.cameraFollowTarget) {
      const pos = this.cameraFollowTarget.getWorldPosition ? this.cameraFollowTarget.getWorldPosition() : null;
      if (pos && this.people.has(this.cameraFollowTarget)) {
        this.poi.x = pos.x;
        this.poi.y = pos.y + 18;
      } else {
        this.cameraFollowTarget = null;
      }
    }

    // constrain POI
    const halfW = ((this.app?.window?.width || 800) * 0.5) * this.zoom;
    const halfH = ((this.app?.window?.height || 600) * 0.5) * this.zoom;
    this.poi.y = Math.max(Math.min(this.poi.y, 360 * 12 - halfH), -360 + halfH);

    // current tool position
    this.updateToolPosition();

    // pitch scaling of playing sounds with game speed
    if (this.app?.sound) this.app.sound.setAllPitch(1 + (this.time.speed_animated - 1) * 0.2);
  }

  updateToolPosition() {
    const mp = this.mouseWorld;
    const previousPrototype = this.toolPrototype;
    if (this.selectedTool.startsWith("item-")) {
      const proto = this.itemFactory.prototypesById[this.selectedTool.slice(5)];
      this.toolPrototype = proto || null;
      if (proto) {
        let height = proto.size.y;
        let yHeightOffset = height;
        if (proto.icon === ICON.LOBBY) {
          // Ctrl/Shift (if held) always win — for touch, fall back to the
          // height armed via the toolbox's long-press picker (default 1).
          height = this.keys.ctrl ? (this.keys.shift ? 3 : 2) : (this.lobbyHeight || 1);
          yHeightOffset = 1;
          this.toolPosition = {
            x: Math.round(mp.x / 8 - proto.size.x / 2.0),
            y: Math.round(mp.y / 36 - yHeightOffset / 2.0),
          };
        } else if (proto.icon === ICON.STAIRS) {
          const mouseX = Math.round(mp.x / 8 - proto.size.x / 2.0);
          const mouseY = Math.floor(mp.y / 36);
          let lobby = null;
          const allLobbies = this.itemsByType.get("lobby") || [];
          for (const l of allLobbies) {
            const lobbyLeft = l.position.x;
            const lobbyRight = l.position.x + l.size.x;
            if (mouseX + proto.size.x > lobbyLeft && mouseX < lobbyRight) {
              if (mouseY >= l.position.y && mouseY < l.position.y + l.size.y) {
                lobby = l;
                break;
              }
            }
          }

          if (lobby && lobby.size.y > 1) {
            height = lobby.size.y + 1;
            this.toolPosition = { x: mouseX, y: lobby.position.y };
          } else {
            height = 2;
            this.toolPosition = { x: mouseX, y: mouseY };
          }
        } else {
          this.toolPosition = {
            x: Math.round(mp.x / 8 - proto.size.x / 2.0),
            y: Math.round(mp.y / 36 - yHeightOffset / 2.0),
          };
        }
        // Dragging an armed ghost moves it by the same delta as the finger,
        // rather than re-centring it on the fingertip: grab the box by its
        // corner and it stays held by that corner.
        if (this.ghostGrab) {
          this.toolPosition.x += this.ghostGrab.dx;
          this.toolPosition.y += this.ghostGrab.dy;
        }
        this._toolHeightOverride = height; // lobby or spiral stair height for preview
      }
    } else {
      this.toolPrototype = null;
      this.toolPosition = { x: Math.floor(mp.x / 8), y: Math.floor(mp.y / 36) };
    }
    if (previousPrototype !== this.toolPrototype) this.ui.updateTooltip();
  }

  // ------------------------------------------------------------- item mgmt
  addItem(item) {
    this.items.add(item);
    this._markDirty();
    this._byType(item.prototype.id).add(item);
    if (item.canHaulPeople()) {
      this._byType("canHaulPeople").add(item);
      if (item.isElevator()) this._byType("elevator").add(item);
      else this._byType("stairlike").add(item);
    }

    if (item.prototype.icon === ICON.FLOOR) {
      const f = item;
      const existing = this.floorItems.get(item.position.y);
      if (existing) {
        if (existing.size.x >= f.size.x) {
          f.position = { ...existing.position };
          f.size = { ...existing.size };
        } else {
          existing.intervalErase(existing.position.x);
          existing.intervalErase(existing.rectMaxX());
          existing.intervalInsert(f.position.x);
          existing.intervalInsert(f.rectMaxX());
        }
        f.interval = existing.interval;
        this.removeItem(existing);
      }
      this.floorItems.set(item.position.y, f);
      this.decorations.updateFloor(item.position.y);
    } else {
      for (let i = 0; i < item.size.y; i++) {
        const y = item.position.y + i;
        if (!this.itemsByFloor.has(y)) this.itemsByFloor.set(y, new Set());
        this.itemsByFloor.get(y).add(item);

        if (!this.floorItems.has(y) && !item.canHaulPeople()) {
          // auto-create floor (save-load ordering safety)
          const minX = item.position.x;
          const f = this.itemFactory.make(this.itemFactory.prototypesById["floor"], { x: minX, y });
          f.size.x = item.size.x;
          f.intervalInsert(f.rectMaxX());
          f.updateSprite();
          this.addItem(f);
        }
        if (!item.canHaulPeople()) {
          const fi = this.floorItems.get(y);
          if (fi) {
            fi.intervalInsert(item.position.x);
            fi.intervalInsert(item.rectMaxX());
          }
        }
      }
    }

    this.gameMap.addNode(
      { x: item.position.x + Math.floor(item.size.x / 2), y: item.position.y + item.prototype.entrance_offset },
      item,
    );
    this.decorations.updateCrane();
    if (item === this.metroStation) this.decorations.updateTracks();
  }

  removeItem(item) {
    this.items.delete(item);
    this._markDirty();
    const set = this.itemsByType.get(item.prototype.id);
    if (set) set.delete(item);
    if (item.canHaulPeople()) {
      this.itemsByType.get("canHaulPeople")?.delete(item);
      if (item.isElevator()) this.itemsByType.get("elevator")?.delete(item);
      else this.itemsByType.get("stairlike")?.delete(item);
    }

    if (item.prototype.icon === ICON.FLOOR) {
      this.floorItems.delete(item.position.y);
      this.decorations.updateFloor(item.position.y);
    } else {
      for (let i = 0; i < item.size.y; i++) {
        const y = item.position.y + i;
        this.itemsByFloor.get(y)?.delete(item);
        if (!item.canHaulPeople()) {
          const fi = this.floorItems.get(y);
          if (fi) {
            fi.intervalErase(item.position.x);
            fi.intervalErase(item.rectMaxX());
          }
        }
      }
    }

    if (item === this.itemBelowCursor) this.itemBelowCursor = null;
    if (item === this.mainLobby) this.mainLobby = null;
    if (item === this.metroStation) this.metroStation = null;

    this.gameMap.removeNode(
      { x: item.position.x + Math.floor(item.size.x / 2), y: item.position.y + item.prototype.entrance_offset },
      item,
    );
    this.decorations.updateCrane();
    if (item.prototype.icon === ICON.METRO) this.decorations.updateTracks();
    item.destroy?.();
  }

  // Port of Game::extendFloor. { free: true } mints/restores slabs without
  // billing or sound (ISSUE-041 self-heal); routes still refresh once via
  // the caller.
  extendFloor(floor, minX, maxX, { free = false } = {}) {
    this._markDirty();
    const f = this.floorItems.get(floor);
    if (f) {
      const currentMinX = f.position.x;
      const currentMaxX = f.position.x + f.size.x;
      f.intervalErase(currentMinX);
      f.intervalErase(f.rectMaxX());
      this.gameMap.removeNode(
        { x: f.position.x + Math.floor(f.size.x / 2), y: f.position.y + f.prototype.entrance_offset },
        f,
      );
      let diffLeft = 0;
      if (minX < f.position.x) {
        diffLeft = f.position.x - minX;
        f.size.x += diffLeft;
        f.setPosition({ x: minX, y: floor });
      }
      let diffRight = maxX - (f.position.x + f.size.x);
      if (diffRight < 0) diffRight = 0;
      f.size.x += diffRight;

      f.updateSprite();
      f.intervalInsert(f.position.x);
      f.intervalInsert(f.rectMaxX());
      this.gameMap.addNode(
        { x: f.position.x + Math.floor(f.size.x / 2), y: f.position.y + f.prototype.entrance_offset },
        f,
      );
      if (diffLeft + diffRight > 0) {
        this.decorations.updateFloor(f.position.y);
        this.decorations.updateCrane();
        if (!free) {
          this.transferFunds(-f.prototype.price * (diffLeft + diffRight), "construction", "Floor extension");
          this.playOnce("simtower/construction/flexible");
        }
      }
    } else {
      const f = this.itemFactory.make(this.itemFactory.prototypesById["floor"], { x: minX, y: floor });
      f.size.x = Math.max(1, maxX - minX);
      f.intervalInsert(f.rectMaxX());
      f.updateSprite();
      this.addItem(f);
      if (!free) {
        this.transferFunds(-f.prototype.price * f.size.x, "construction", "Floor");
        this.playOnce("simtower/construction/normal");
      }
    }
    if (!free) this.updateRoutes();
  }

  _byType(id) {
    let s = this.itemsByType.get(id);
    if (!s) this.itemsByType.set(id, (s = new Set()));
    return s;
  }

  // ------------------------------------------------------------- economy
  transferFunds(f, category = "misc", message = "") {
    this.money.record(f, category);
    this.setFunds(this.money.balance);
    this._markDirty();
    this.playOnce("simtower/cash");
    if (message) this.ui.showMessage(message + ": $" + f);
    this.ui.updateMoneyStats();
  }

  setFunds(f) {
    if (this.funds !== f) {
      this.funds = f;
      this.money.setBalance(f);
      this.ui.updateFunds();
      this.ui.updateMoneyStats();
    }
  }

  settleDailyAccounting() {
    this.money.finalizeDay();
    const maintenanceCost = this.calculateDailyMaintenanceCost();
    if (maintenanceCost > 0) {
      this.transferFunds(-maintenanceCost, "maintenance", "Daily maintenance");
    }
    this.judgeSystem.evaluateAll(this);
    this.ui.updateMoneyStats();
  }

  calculateDailyMaintenanceCost() {
    let total = 0;
    for (const item of this.items) {
      if (item.underConstruction) continue;
      total += item.dailyMaintenanceCost();
    }
    return total;
  }

  // ------------------------------------------------------------- rating
  setRating(r) {
    if (this.rating !== r) {
      const improved = r > this.rating;
      this.rating = r;
      this._markDirty();
      if (improved) this.playOnce("simtower/rating/increased");
      this.ui.updateRating();
    }
  }

  setPopulation(p) {
    if (this.population !== p) {
      this.population = p;
      this.ratingMayIncrease();
      this.ui.updatePopulation();
    }
  }

  ratingMayIncrease() {
    this.judgeSystem.evaluateAll(this);
    const counts = this.judgeSystem.counts();
    for (;;) {
      const req = LevelUp.advancementRequirements(this.rating);
      if (!req) break;
      if (!LevelUp.meetsRequirements(req, this.population, counts, this.vipSystem.positiveReviews())) {
        if (this.population >= req.population - 50 && this.population < req.population) {
          this.ui.showMessage("Next: " + req.summary);
        }
        break;
      }
      this.setRating(this.rating + 1);
      this.ui.showLevelUp(this.rating);
      this.ui.showMessage("Promoted to " + (this.rating + 1) + " stars!");
      // Star-promotion gift (ISSUE-034, EXE 0x79636+).
      const gift = LevelUp.starRewardMessage(this.rating + 1);
      if (gift) this.ui.showMessage(gift);
      this.ui.reloadToolbox();
    }
  }

  // ------------------------------------------------------------- tools
  // Pause-toggle memory, shared by every speed control (the toolbox row, the
  // toolbox header's phone pause button and the HUD row) so pausing from one
  // and resuming from another cannot land on a different speed.
  togglePause() {
    if (this.speedMode === 0) {
      this.setSpeedMode(this.lastSpeedMode > 0 ? this.lastSpeedMode : 1);
    } else {
      this.lastSpeedMode = this.speedMode;
      this.setSpeedMode(0);
    }
  }

  setSpeedMode(sm) {
    if (sm < 0 || sm > 3) throw new Error("invalid speed mode " + sm);
    if (this.speedMode !== sm) {
      this.speedMode = sm;
      const speed = [0, 1, 4, 12][sm];
      this.time.speed = speed;
      this.ui.updateSpeed();
    }
  }

  cycleStatusMode() {
    this.statusMode = (this.statusMode + 1) % 4;
    const names = ["Normal view", "Evaluation view", "Pricing view", "Hotel view"];
    this.ui.showMessage(names[this.statusMode]);
  }

  selectTool(tool) {
    if (!tool) return;
    if (this.selectedTool !== tool) {
      // A tool change mid-drag invalidates the queued batch (ISSUE-039).
      this.cancelBatchDrag();
      // A ghost belongs to the tool that parked it.
      this.clearGhost();
      this.selectedTool = tool;
      // toolPrototype is derived in updateToolPosition(), which is otherwise
      // only driven by pointer and key events. On touch there is no pointer
      // move after tapping a palette slot, so without this both the tool
      // readout and the placement ghost keep describing the *previous* tool
      // until the player happens to touch the canvas.
      this.updateToolPosition();
      this.ui.updateTool();
      this.ui.updateTooltip();
    }
  }

  centerViewportOnTile(tileX, tileY) {
    this.poi.x = tileX * 8.0;
    this.poi.y = tileY * 36.0;
  }

  toggleElevatorService(e, floor, mode = "all") {
    if (!e) return;
    if (mode === "we") {
      if (!e.unservicedFloorsWeekend.delete(floor)) {
        e.unservicedFloorsWeekend.add(floor);
      }
    } else if (mode === "wd") {
      if (!e.unservicedFloors.delete(floor)) {
        e.unservicedFloors.add(floor);
      }
    } else {
      if (e.unservicedFloors.has(floor)) {
        e.unservicedFloors.delete(floor);
        e.unservicedFloorsWeekend.delete(floor);
      } else {
        e.unservicedFloors.add(floor);
        e.unservicedFloorsWeekend.add(floor);
      }
    }

    if (e.connectsFloor(floor)) {
      this.gameMap.addNode({ x: e.position.x + e.size.x / 2, y: floor }, e);
    } else {
      this.gameMap.removeNode({ x: e.position.x + e.size.x / 2, y: floor }, e);
    }
    e.cleanQueues();
    this._markDirty();
    this.updateRoutes();
  }

  // A shaft that reaches no floor the lobby can walk to is a total, silent
  // failure: no tenant ever moves in and nothing on screen says why. The
  // easiest way to build one is the bottom motor - `repositionMotor` puts the
  // lowest served floor at `y + 1` (the motor sits *below* it, as in the
  // original), so dropping it on the lobby row yields a shaft starting at
  // floor 1 that never stops at the lobby.
  //
  // Reachability, not geometry, is the test: a sky-lobby shaft fed by an
  // express is legitimately detached from the ground floor. But it has to be
  // asked about a floor the elevator actually *serves* - findRoute() anchors
  // an elevator destination at `position.y`, the very bottom of the shaft,
  // and an unserviced bottom floor (a basement the player switched off, or
  // one below the built slabs) has no MapNode at all. That reported every
  // such elevator as unreachable while it was carrying tenants perfectly
  // well, with advice to extend a motor that was already below the lobby.
  elevatorReachableFromLobby(e) {
    const lobby = this.mainLobby;
    if (!lobby) return true;
    const ex = e.position.x + Math.floor(e.size.x / 2);

    // Fast path: a node on the lobby's own floor is reachable by definition -
    // that floor is one contiguous walkable slab.
    if (this.gameMap.findNode({ x: ex, y: lobby.position.y }, e)) return true;

    const startNode = this.gameMap.findNode(
      { x: lobby.position.x + Math.floor(lobby.size.x / 2), y: lobby.position.y + lobby.prototype.exit_offset },
      lobby,
    );
    if (!startNode) return false;

    for (let y = e.position.y; y < e.position.y + e.size.y; y++) {
      const destNode = this.gameMap.findNode({ x: ex, y }, e);
      if (!destNode) continue;
      if (!this.pathFinder.findRoute(startNode, destNode, lobby, e).empty()) return true;
    }
    return false;
  }

  warnIfElevatorUnreachable(e) {
    if (!e || !e.isElevator() || !this.mainLobby) return false;
    if (this.elevatorReachableFromLobby(e)) return false;

    // Two different mistakes deserve two different instructions.
    const lobbyFloor = this.mainLobby.position.y;
    const spansLobby =
      lobbyFloor >= e.position.y && lobbyFloor < e.position.y + e.size.y;
    this.ui.showMessage(
      spansLobby
        ? "This elevator does not stop at floor " + lobbyFloor +
          " - switch that floor back on in its Floors... panel."
        : "This elevator cannot be reached from the lobby - extend it down to floor " +
          lobbyFloor + ".",
    );
    return true;
  }

  // ------------------------------------------------------------- routes
  updateRoutes() {
    this.visualizeRoute.clear();
    for (const item of this.items) item.updateRoutes();
  }

  findRoute(start, destination, serviceRoute = false) {
    if (!start || !destination) return new Route();
    const startPoint = {
      x: start.position.x + Math.floor(start.size.x / 2),
      y: start.position.y + start.prototype.exit_offset,
    };
    const endPoint = {
      x: destination.position.x + Math.floor(destination.size.x / 2),
      y: destination.position.y + destination.prototype.entrance_offset,
    };
    if (start.prototype.icon === ICON.METRO && endPoint.y === startPoint.y - 1) startPoint.y = endPoint.y;
    else if (destination.prototype.icon === ICON.METRO && startPoint.y === endPoint.y - 1) endPoint.y = startPoint.y;

    const startNode = this.gameMap.findNode(startPoint, start);
    const destNode = this.gameMap.findNode(endPoint, destination);
    return this.pathFinder.findRoute(startNode, destNode, start, destination, serviceRoute);
  }

  // ------------------------------------------------------------- sounds
  playOnce(path) {
    const last = this.soundPlayTimes.get(path);
    if (last !== undefined && last > this.time.absolute - 0.25 * K_BASE_SPEED) return;
    this.soundPlayTimes.set(path, this.time.absolute);
    this.app?.sound?.play?.(path);
  }

  // ------------------------------------------------------- pointer input
  // Port of Game::handleEvent's MouseButtonPressed/Move/Release branches.
  // The UI layer calls these with normalized input; worldPos is in world px (y up).
  // Is worldPos inside the footprint the ghost occupies at `at`? Padded by
  // half a tile so the box can still be grabbed when the finger lands just
  // outside it, which on a phone is most of the time.
  pointerOverGhost(at, worldPos) {
    const proto = this.toolPrototype;
    if (!at || !proto) return false;
    const height = this._toolHeightOverride || proto.size.y;
    const padX = 4;
    const padY = 18;
    const left = at.x * 8 - padX;
    const right = (at.x + proto.size.x) * 8 + padX;
    const bottom = at.y * 36 - padY;
    const top = (at.y + height) * 36 + padY;
    return worldPos.x >= left && worldPos.x <= right && worldPos.y >= bottom && worldPos.y <= top;
  }

  clearGhost() {
    this.ghostArmed = false;
    this.ghostGrab = null;
  }

  handlePointerDown({ worldPos, overUI, deferCommit = false }) {
    // Captured before updateToolPosition moves the ghost to the new pointer.
    const parkedGhost = this.ghostArmed ? { ...this.toolPosition } : null;
    this.mouseWorld = worldPos;
    this.updateToolPosition();
    if (overUI) return false;

    // Emergency events take priority over all other click actions.
    if (this.eventSystem.isActive() && this.eventSystem.handleClick(this.toolPosition)) return true;

    if (this.selectedTool.startsWith("item-") && this.toolPrototype) {
      // ISSUE-039: batch-capable tools start a preview-only drag and build on
      // pointerup; special-cased tools keep the classic instant click.
      // Touch: park a ghost, drag it, tap it to build. Nothing is committed
      // on contact, which also means the first finger of a pinch cannot build.
      // Batch drag stays a mouse gesture — on touch the same press-and-drag is
      // what moves the ghost, and the two cannot both own it.
      if (deferCommit) {
        if (parkedGhost && this.pointerOverGhost(parkedGhost, worldPos)) {
          // Grabbed the parked ghost: keep it where it is, and remember the
          // offset so dragging moves it rather than teleporting it.
          this.ghostGrab = {
            dx: parkedGhost.x - this.toolPosition.x,
            dy: parkedGhost.y - this.toolPosition.y,
          };
          this.toolPosition = parkedGhost;
          // Released without dragging, this is the confirming tap.
          this.pendingPress = { kind: "ghostCommit" };
        } else {
          // First tap, or a tap somewhere else: (re)park the ghost here and
          // let it be dragged straight away. Never builds.
          this.ghostGrab = null;
          this.ghostArmed = true;
          this.pendingPress = null;
        }
        return true;
      }
      if (!this.startBatchDrag()) this.clickConstruct();
      return true;
    }

    if (this.selectedTool === "bulldozer") {
      // Nothing under the cursor is not a bulldoze at all — report that now so
      // the gesture layer can treat the press as a pan rather than a tool.
      if (!this.itemBelowCursor) return false;
      // Demolition is instant and there is no undo anywhere, which makes it
      // the worst thing to fire off the first finger of a pinch.
      if (deferCommit) this.pendingPress = { kind: "bulldoze" };
      else this.bulldozeUnderCursor();
      return true;
    }

    if (this.itemBelowCursor) {
      if (this.selectedTool === "finger") {
        if (this.itemBelowCursor.prototype.id.startsWith("elevator")) {
          const e = this.itemBelowCursor;
          this.draggingMotor = 0;
          if (this.toolPosition.y < this.itemBelowCursor.position.y) this.draggingMotor = -1;
          if (this.toolPosition.y >= this.itemBelowCursor.position.y + this.itemBelowCursor.size.y) this.draggingMotor = 1;

          if (this.draggingMotor !== 0) {
            this.draggingElevator = e;
            this.draggingElevatorStart = this.toolPosition.y;
            if (this.draggingElevatorStart < this.draggingElevator.position.y) {
              this.draggingElevatorLower = true;
              this.draggingElevatorStart++;
            } else {
              this.draggingElevatorLower = false;
              this.draggingElevatorStart--;
            }
          } else {
            // toggle service floor in place
            this.toggleElevatorService(e, this.toolPosition.y);
          }
          return true;
        }
      }
    }

    if (this.selectedTool === "inspector") {
      const person = this.findPersonAt(this.mouseWorld.x, this.mouseWorld.y);
      if (person) {
        this.visualizeRoute.clear();
        this.ui.showInspectorForPerson(person);
        return true;
      }
      if (this.itemBelowCursor) {
        this.itemBelowCursor.updateRoutes();
        this.visualizeRoute.copyFrom(this.itemBelowCursor.lobbyRoute);
        this.ui.showInspectorForItem(this.itemBelowCursor);
        return true;
      }
    }

    return false;
  }

  findPersonAt(worldX, worldY) {
    for (const p of this.people) {
      const pos = p.getWorldPosition ? p.getWorldPosition() : null;
      if (!pos) continue;
      if (
        worldX >= pos.x - 8 &&
        worldX <= pos.x + 12 &&
        worldY >= pos.y &&
        worldY <= pos.y + 36
      ) {
        return p;
      }
    }
    return null;
  }

  handlePointerMove({ worldPos }) {
    this.mouseWorld = worldPos;
    this.updateToolPosition();
    if (this.batchDrag) this.updateBatchDrag();

    if (this.draggingElevator && this.draggingElevator.repositionMotor(this.draggingMotor, this.toolPosition.y)) {
      const e = this.draggingElevator;
      if (this.draggingElevatorLower) {
        if (this.draggingElevatorStart > e.position.y) {
          for (let i = e.position.y; i < this.draggingElevatorStart; i++) {
            this.extendFloor(i, e.position.x, e.rectMaxX());
          }
        }
      } else {
        // C++ Game.cpp:714-717 — rect.maxY() is EXCLUSIVE (pos.y + size.y);
        // the old `maxY = ... - 1` double-subtracted and skipped the newly
        // outermost crossed level, leaving permanent slab gaps in shafts.
        const exclMaxY = e.position.y + e.size.y;
        if (this.draggingElevatorStart < exclMaxY - 1) {
          for (let i = exclMaxY - 1; i > this.draggingElevatorStart; i--) {
            this.extendFloor(i, e.position.x, e.rectMaxX());
          }
        }
      }
      this.gameMap.handleElevatorResize(e, this.draggingElevatorLower, this.draggingElevatorStart);
      this.updateRoutes();
    }
  }

  // Port of Game.cpp:644-657 — demolish only the topmost item under the
  // cursor (itemBelowCursor is the last-drawn, i.e. closest-to-viewer item),
  // never the floor/lobby/metro behind it. No drag-select, no refund.
  bulldozeUnderCursor() {
    const item = this.itemBelowCursor;
    if (!item) return false;
    const icon = item.prototype.icon;
    if (icon === ICON.LOBBY || icon === ICON.FLOOR || icon === ICON.METRO) {
      this.playOnce("simtower/construction/impossible");
      this.ui.showMessage("Cannot bulldoze " + item.prototype.name);
      return true;
    }
    const canHaulPeople = item.canHaulPeople();
    this.removeItem(item);
    if (canHaulPeople) this.updateRoutes();
    this.playOnce("simtower/bulldozer");
    return true;
  }

  // Drops a deferred touch press without acting on it — a second finger
  // landed, or the gesture was cancelled.
  cancelPendingPress() {
    this.pendingPress = null;
  }

  handlePointerUp() {
    const pending = this.pendingPress;
    this.pendingPress = null;
    if (pending) {
      // Builds where the finger ended, not where it started. A "tool" gesture
      // keeps feeding pointermove into updateToolPosition, so this is exactly
      // the cell the placement ghost has been drawing under the finger — which
      // on touch, where the finger hides the target, is the more predictable
      // of the two.
      if (pending.kind === "ghostCommit") {
        this.clickConstruct();
        // Disarmed after building so a second tap in the same place cannot
        // re-fire on the cell that is now occupied.
        this.clearGhost();
        return;
      }
      if (pending.kind === "bulldoze") this.bulldozeUnderCursor();
      this.ghostGrab = null;
      return;
    }
    if (this.batchDrag) {
      this.finishBatchDrag();
      return;
    }
    if (this.draggingElevator) {
      this.updateRoutes();
      this.warnIfElevatorUnreachable(this.draggingElevator);
    }
    this.draggingElevator = null;
  }

  // ------------------------------------------- ISSUE-039 drag-to-place batching
  // Plain room items can be laid out by click-and-drag: nothing builds or is
  // charged while dragging (the renderer ghosts each queued cell in white or
  // red), and construction happens once on release. Structural pieces with
  // special-cased validate-and-mutate paths stay on the classic single click.

  _isBatchDraggable(proto) {
    if (!proto) return false;
    if (proto.id.startsWith("elevator") || proto.id === "parkingramp") return false;
    return (
      proto.icon !== ICON.LOBBY &&
      proto.icon !== ICON.FLOOR &&
      proto.icon !== ICON.METRO &&
      proto.icon !== ICON.STAIRS
    );
  }

  startBatchDrag() {
    if (!this._isBatchDraggable(this.toolPrototype)) return false;
    this.batchDrag = {
      x0: this.toolPosition.x,
      y0: this.toolPosition.y,
      cells: [],
      affordableTotal: true,
      firstBlockReason: "",
    };
    this.updateBatchDrag();
    return true;
  }

  updateBatchDrag() {
    const d = this.batchDrag;
    if (!d) return;
    const proto = this.toolPrototype;
    if (!proto || !this._isBatchDraggable(proto)) {
      this.cancelBatchDrag();
      return;
    }
    const dxRaw = this.toolPosition.x - d.x0;
    const dyRaw = this.toolPosition.y - d.y0;
    // A plain drag snaps to the dominant axis; Shift spans both axes at once
    // (rows × columns grid), preserving drag direction. Touch has no Shift
    // key to hold mid-drag, so a long-press before moving arms the same
    // grid mode instead (input.js sets gridDragArmed; see its onPointerDown).
    const horizontal = Math.abs(dxRaw) >= Math.abs(dyRaw);
    const gridMode = this.keys.shift || this.gridDragArmed;
    const useX = gridMode || horizontal;
    const useY = gridMode || !horizontal;
    const cols = useX ? Math.max(1, Math.round(Math.abs(dxRaw) / proto.size.x)) : 1;
    const rows = useY ? Math.max(1, Math.round(Math.abs(dyRaw) / proto.size.y)) : 1;
    const stepX = proto.size.x * (dxRaw < 0 ? -1 : 1);
    const stepY = proto.size.y * (dyRaw < 0 ? -1 : 1);

    const cells = [];
    for (let j = 0; j < rows; j++) {
      for (let k = 0; k < cols; k++) {
        const x = d.x0 + k * stepX;
        const y = d.y0 + j * stepY;
        const check = this.evaluatePlacement(proto, x, y, proto.size.y);
        cells.push({ x, y, valid: check.valid, reason: check.reason });
      }
    }
    d.cells = cells;
    d.affordableTotal = this.money.balance >= cells.length * proto.price;
    d.firstBlockReason = cells.find((c) => !c.valid)?.reason || "";
  }

  finishBatchDrag() {
    const d = this.batchDrag;
    this.batchDrag = null;
    this.gridDragArmed = false;
    if (!d) return;
    const proto = this.toolPrototype;
    if (!proto || d.cells.length === 0) return;

    let built = 0;
    let firstReason = "";
    this._batchCommitting = true;
    try {
      for (const c of d.cells) {
        if (!c.valid) {
          firstReason = firstReason || c.reason;
          continue;
        }
        // Stop when the balance can no longer cover another copy.
        if (this.money.balance < proto.price) break;
        const itemsBefore = this.items.size;
        this.toolPosition = { x: c.x, y: c.y };
        this.clickConstruct();
        if (this.items.size > itemsBefore) built++;
      }
    } finally {
      this._batchCommitting = false;
    }
    if (built > 0) {
      this.updateRoutes();
    } else {
      this.playOnce("simtower/construction/impossible");
      const reason = firstReason || d.firstBlockReason || "no space available";
      this.ui.showMessage("Cannot place item there. " + reason + ".");
    }
  }

  cancelBatchDrag() {
    this.batchDrag = null;
    this.gridDragArmed = false;
  }

  // Side-effect-free mirror of clickConstruct's validation for one cell —
  // gates common to every item plus the generic-room branch (batching only
  // ever queues that class of item). Must agree with what a real construction
  // at the same coordinates would do; clickConstruct remains authoritative.
  evaluatePlacement(proto, x, y, height) {
    const boundary = { x, y, w: proto.size.x, h: height };
    const maxBX = (r) => r.x + r.w;
    const maxBY = (r) => r.y + r.h;
    const intersects = (a, b) =>
      !(maxBX(a) <= b.x || a.x >= maxBX(b) || maxBY(a) <= b.y || a.y >= maxBY(b));
    const block = (reason) => ({ valid: false, reason });

    const minRating = LevelUp.minRatingToBuild(proto.id);
    if (minRating > this.rating) {
      return block(proto.name + " unlocks at " + (minRating + 1) + " stars");
    }
    if (y < -9 && proto.icon !== ICON.METRO) return block("Cannot build below floor B9");
    if (this.metroStation && y < this.metroStation.position.y) {
      return block("Cannot build below Metro Station");
    }
    if (y > 0 && proto.icon === ICON.METRO) {
      return block(proto.name + " unavailable above ground");
    }
    if (y > 0 && proto.id === "cinema") {
      return block(proto.name + " unavailable above ground");
    }

    if (proto.icon === ICON.METRO && this.metroStation) return block("Only one Metro Station allowed");
    if (proto.id === "secom" && (this.itemsByType.get("secom")?.size ?? 0) > 0) {
      return block("Only one SECOM allowed");
    }
    if (y === 0) return block("Only lobbies may be built on the ground floor");

    for (let yy = 0; yy < height; yy++) {
      for (const i of this.itemsByFloor.get(y + yy) || []) {
        if (i.canHaulPeople()) continue;
        if (intersects(boundary, i.getRect())) return block(i.prototype.name + " is in the way");
      }
    }

    // Support-floor width (same lookup preference as clickConstruct). No
    // adjacent slab at all blocks too — clickConstruct's MAX/MIN sentinels
    // fail the width test for any x, and mid-air offices must stay red.
    let support = null;
    if (y > 0 && this.floorItems.has(y - 1)) support = this.floorItems.get(y - 1);
    else if (this.floorItems.has(y + height)) support = this.floorItems.get(y + height);
    if (!support) return block("Floor " + (y > 0 ? "below" : "above") + " is not wide enough");
    if (!(x >= support.position.x && x + proto.size.x <= support.position.x + support.size.x)) {
      let lobbyWidens = false;
      if (y > 0) {
        for (const below of this.itemsByFloor.get(y - 1) || []) {
          if (
            below.prototype.icon === ICON.LOBBY &&
            below.size.y > 1 &&
            x + proto.size.x > below.position.x &&
            x < below.position.x + below.size.x
          ) {
            lobbyWidens = true;
            break;
          }
        }
      }
      if (!lobbyWidens) {
        return block("Floor " + (y > 0 ? "below" : "above") + " is not wide enough");
      }
    }
    return { valid: true, reason: "" };
  }

  // The construction click: validates placement and builds. Port of the
  // "Construction logic for item tools" block in Game::handleEvent.
  clickConstruct() {
    const proto = this.toolPrototype;
    const { x, y } = this.toolPosition;

    let height = proto.size.y;
    let yHeightOffset = height;
    let targetFloor = y + 1;
    if (proto.icon === ICON.LOBBY) {
      // Ctrl/Shift (if held) always win — for touch, fall back to the
      // height armed via the toolbox's long-press picker (default 1).
      height = this.keys.ctrl ? (this.keys.shift ? 3 : 2) : (this.lobbyHeight || 1);
      yHeightOffset = 1;
    }

    const boundary = { x, y, w: proto.size.x, h: height };
    // C++ Math::Rect convention: maxX/maxY are EXCLUSIVE; intersectsRect is
    // half-open (touching edges do not overlap). Keep both helpers exclusive
    // or same-floor items never register as intersecting.
    const maxBX = (r) => r.x + r.w;
    const maxBY = (r) => r.y + r.h;
    const intersects = (a, b) =>
      !(maxBX(a) <= b.x || a.x >= maxBX(b) || maxBY(a) <= b.y || a.y >= maxBY(b));

    let handled = false;
    if (proto.id.startsWith("elevator")) {
      const elevators = this.itemsByType.get(proto.id) || new Set();
      for (const e of elevators) {
        const r = e.getRect();
        if (
          boundary.x === r.x &&
          maxBX(boundary) === maxBX(r) &&
          boundary.y >= r.y &&
          maxBY(boundary) <= maxBY(r)
        ) {
          e.addCar(this.toolPosition.y);
          this.transferFunds(-80000, "construction", "Elevator car");
          handled = true;
          break;
        }
      }
    }
    if (handled) return;

    let constructionBlocked = false;
    let blockReason = "";
    let minFloorX = Number.MAX_SAFE_INTEGER;
    let maxFloorX = Number.MIN_SAFE_INTEGER;

    // Star-rating gate
    const minRating = LevelUp.minRatingToBuild(proto.id);
    if (minRating > this.rating) {
      constructionBlocked = true;
      blockReason = proto.name + " unlocks at " + (minRating + 1) + " stars";
    }

    if (y < -9 && proto.icon !== ICON.METRO) {
      constructionBlocked = true;
      blockReason = "Cannot build below floor B9";
    }
    if (this.metroStation && y < this.metroStation.position.y) {
      constructionBlocked = true;
      blockReason = "Cannot build below Metro Station";
    }
    if (y > 0 && proto.icon === ICON.METRO) {
      constructionBlocked = true;
      blockReason = proto.name + " unavailable above ground";
    }
    if (y > 0 && proto.id === "cinema") {
      constructionBlocked = true;
      blockReason = proto.name + " unavailable above ground";
    }

    if (proto.icon === ICON.LOBBY) {
      if (y % 15 !== 0) {
        constructionBlocked = true;
        blockReason = "Lobbies can only be built on every 15th floor";
      } else if (y !== 0) {
        const below = this.floorItems.get(y - 1);
        if (below) {
          minFloorX = below.position.x;
          maxFloorX = below.position.x + below.size.x;
        }
        const itemsOnFloor = this.itemsByFloor.get(y) || new Set();
        for (const i of itemsOnFloor) {
          if (constructionBlocked) break;
          if (i.canHaulPeople() || i.prototype.icon === ICON.LOBBY) continue;
          minFloorX = Math.max(minFloorX, i.position.x + i.size.x);
          maxFloorX = Math.min(maxFloorX, i.position.x);
        }
      } else {
        minFloorX = Number.MIN_SAFE_INTEGER;
        maxFloorX = Number.MAX_SAFE_INTEGER;
      }
    } else if (proto.icon === ICON.STAIRS || proto.icon === ICON.ELEVATOR) {
      const stairlike = this.itemsByType.get("stairlike") || new Set();
      for (const i of stairlike) {
        if (constructionBlocked) break;
        const xOffset = x - i.position.x;
        if (
          (i.position.y === y && xOffset > -4 && xOffset < 4) ||
          (i.position.y === y - 1 && xOffset > 0 && xOffset < 8) ||
          (i.position.y === y + 1 && xOffset > -8 && xOffset < 0)
        ) {
          constructionBlocked = true;
          blockReason = "Other " + i.prototype.name + " is in the way";
        }
      }

      const elevators = this.itemsByType.get("elevator") || new Set();
      for (const i of elevators) {
        if (constructionBlocked) break;
        const r = i.getRect();
        const inflated = { x: r.x, y: r.y - 1, w: r.w, h: r.h + 2 };
        if (intersects(boundary, inflated)) {
          constructionBlocked = true;
          blockReason = i.prototype.name + " is in the way";
        }
      }

      // Check if placed on a lobby to determine spiral stair destination floor
      let lobbyHeight = 0;
      const allLobbies = this.itemsByType.get("lobby") || new Set();
      for (const l of allLobbies) {
        const lobbyLeft = l.position.x;
        const lobbyRight = l.position.x + l.size.x;
        if (x + proto.size.x > lobbyLeft && x < lobbyRight) {
          if (y >= l.position.y && y < l.position.y + l.size.y) {
            lobbyHeight = l.size.y;
            break;
          }
        }
      }

      // Check if starting floor is inside intermediate airspace of a multi-story lobby
      for (const l of allLobbies) {
        if (l.size.y > 1 && y > l.position.y && y < l.position.y + l.size.y) {
          const lLeft = l.position.x;
          const lRight = l.position.x + l.size.x;
          if (x + proto.size.x > lLeft && x < lRight) {
            constructionBlocked = true;
            blockReason = "Cannot place stairs in open lobby airspace";
            break;
          }
        }
      }

      targetFloor = (proto.icon === ICON.STAIRS && lobbyHeight > 1) ? y + lobbyHeight : y + 1;
      if (proto.icon === ICON.STAIRS) {
        height = lobbyHeight > 1 ? lobbyHeight + 1 : 2;
      }

      // Check floor width above at target destination floor
      const above = this.floorItems.get(targetFloor);
      if (above) {
        minFloorX = above.position.x;
        maxFloorX = above.position.x + above.size.x;
      }
      if (x < minFloorX || x + proto.size.x > maxFloorX) {
        if (!constructionBlocked) blockReason = "Upper floor is not wide enough";
        constructionBlocked = true;
      }

      minFloorX = Number.MAX_SAFE_INTEGER;
      maxFloorX = Number.MIN_SAFE_INTEGER;
      const on = this.floorItems.get(y);
      if (on) {
        minFloorX = on.position.x;
        maxFloorX = on.position.x + on.size.x;
      }
    } else if (proto.id.startsWith("elevator")) {
      const tb = { x: boundary.x, y: boundary.y - 1, w: boundary.w, h: boundary.h + 2 };
      const stairlike = this.itemsByType.get("stairlike") || new Set();
      for (const i of stairlike) {
        if (constructionBlocked) break;
        if (intersects(tb, i.getRect())) {
          constructionBlocked = true;
          blockReason = i.prototype.name + " is in the way";
        }
      }
      const elevators = this.itemsByType.get("elevator") || new Set();
      for (const i of elevators) {
        if (constructionBlocked) break;
        const r = i.getRect();
        const inflated = { x: r.x, y: r.y - 1, w: r.w, h: r.h + 2 };
        if (intersects(tb, inflated)) {
          constructionBlocked = true;
          blockReason = "Other " + i.prototype.name + " is in the way";
        }
      }

      let i = null;
      if (y > 0 && this.floorItems.has(y - 1)) i = this.floorItems.get(y - 1);
      else if (y < 0 && this.floorItems.has(y + 1)) i = this.floorItems.get(y + 1);
      else if (this.floorItems.has(0)) i = this.floorItems.get(0);
      if (i) {
        minFloorX = i.position.x;
        maxFloorX = i.position.x + i.size.x;
      }
    } else if (proto.id === "parkingramp") {
      // Parking Ramp (ISSUE-032): a self-supporting vertical connector.
      // Base segment only at the ground floor; every other segment must sit
      // directly on top of an existing one. Authentic EXE block messages.
      if (y < 0) {
        constructionBlocked = true;
        blockReason = "Parking Ramps must be placed on this level";
      } else {
        const hasRamps = (this.itemsByType.get("parkingramp")?.size ?? 0) > 0;
        const supported = y === 0 || findRampAt(this, x, y - 1);
        if (!supported) {
          constructionBlocked = true;
          blockReason = hasRamps
            ? "Parking Ramps must be connected vertically"
            : "Parking Ramps must connect to the 1st floor";
        }
      }

      // Collision with anything already occupying the tile (haulers excepted,
      // matching the stairlike rules).
      if (!constructionBlocked) {
        for (const i of this.itemsByFloor.get(y) || []) {
          if (i.canHaulPeople()) continue;
          if (intersects(boundary, i.getRect())) {
            constructionBlocked = true;
            blockReason = i.prototype.name + " is in the way";
            break;
          }
        }
      }

      // Self-supporting: no floor-width requirements either side.
      minFloorX = Number.MIN_SAFE_INTEGER;
      maxFloorX = Number.MAX_SAFE_INTEGER;
    } else {
      if (proto.icon === ICON.METRO && this.metroStation) {
        constructionBlocked = true;
        blockReason = "Only one Metro Station allowed";
      }
      if (proto.id === "secom" && (this.itemsByType.get("secom")?.size ?? 0) > 0) {
        constructionBlocked = true;
        blockReason = "Only one SECOM allowed";
      }
      if (y === 0) {
        constructionBlocked = true;
        blockReason = "Only lobbies may be built on the ground floor";
      }

      const itemsNearby = new Set();
      for (let yy = 0; !constructionBlocked && yy < height; yy++) {
        for (const i of this.itemsByFloor.get(y + yy) || []) itemsNearby.add(i);
      }
      for (const i of itemsNearby) {
        if (constructionBlocked) break;
        if (i.canHaulPeople()) continue;
        if (intersects(boundary, i.getRect())) {
          constructionBlocked = true;
          blockReason = i.prototype.name + " is in the way";
        }
      }

      let i = null;
      if (y > 0 && this.floorItems.has(y - 1)) i = this.floorItems.get(y - 1);
      else if (this.floorItems.has(y + height)) i = this.floorItems.get(y + height);
      if (i) {
        minFloorX = i.position.x;
        maxFloorX = i.position.x + i.size.x;

        // multi-story lobby auto-widen hack (Phase 2.5)
        if (y > 0 && proto.icon !== ICON.LOBBY) {
          for (const below of this.itemsByFloor.get(y - 1) || []) {
            if (below.prototype.icon === ICON.LOBBY && below.size.y > 1) {
              const lobbyRight = below.position.x + below.size.x;
              const toolRight = x + proto.size.x;
              let diffLeft = 0;
              let diffRight = 0;
              const oldMinX = below.position.x;
              const oldMaxX = below.position.x + below.size.x;
              if (x < below.position.x) {
                diffLeft = below.position.x - x;
                below.size.x += diffLeft;
                below.setPosition({ x, y: below.position.y });
              }
              if (toolRight > lobbyRight) {
                diffRight = toolRight - lobbyRight;
                below.size.x += diffRight;
              }
              if (diffLeft + diffRight > 0) {
                const newMinX = below.position.x;
                const newMaxX = below.position.x + below.size.x;
                for (let f = below.position.y; f < below.position.y + below.size.y; f++) {
                  this.extendFloor(f, newMinX, newMaxX);
                  const fi = this.floorItems.get(f);
                  if (fi) {
                    fi.intervalErase(oldMinX);
                    fi.intervalErase(oldMaxX);
                    fi.intervalInsert(newMinX);
                    fi.intervalInsert(newMaxX);
                  }
                }
                maxFloorX = below.position.x + below.size.x;
                minFloorX = below.position.x;
                this.transferFunds(
                  -Math.trunc((below.prototype.price * 4) / (diffLeft + diffRight)),
                  "construction",
                  "Lobby extension",
                );
                this.playOnce("simtower/construction/flexible");
              }
              break;
            }
          }
        }
      }
    }

    if (x < minFloorX || x + proto.size.x > maxFloorX) {
      if (!constructionBlocked) blockReason = "Floor " + (y > 0 ? "below" : "above") + " is not wide enough";
      constructionBlocked = true;
    }

    if (!constructionBlocked) {
      // construct floors
      if (proto.icon === ICON.STAIRS) {
        this.extendFloor(y, x, x + proto.size.x);
        this.extendFloor(targetFloor, x, x + proto.size.x);
      } else if (proto.id !== "parkingramp") {
        // The ramp is a self-supporting shaft (ISSUE-032); it must not mint
        // 1-tile floor slivers on every level it passes through.
        for (let i = 0; i < height; i++) this.extendFloor(y + i, x, x + proto.size.x);
      }

      if (proto.icon === ICON.LOBBY) {
        // extend existing lobby or build new
        let existingLobby = false;
        const itemsOnFloor = this.itemsByFloor.get(y) || new Set();
        for (const i of itemsOnFloor) {
          if (existingLobby) break;
          if (i.prototype.icon === ICON.LOBBY) {
            this.gameMap.removeNode(
              { x: i.position.x + Math.floor(i.size.x / 2), y: i.position.y + i.prototype.entrance_offset },
              i,
            );
            const l = i;
            const oldHeight = l.size.y;
            let diff = 0;
            const oldMinX = l.position.x;
            const oldMaxX = l.position.x + l.size.x;
            if (x < l.position.x) {
              diff = l.position.x - x;
              l.size.x += diff;
              l.setPosition({ x, y: l.position.y });
            } else {
              const currentRight = l.position.x + l.size.x;
              const targetRight = x + proto.size.x;
              if (targetRight > currentRight) {
                diff = targetRight - currentRight;
                l.size.x += diff;
              }
            }
            // Height upgrade: ctrl (→2) / ctrl+shift (→3) extension also raises lobby size.y
            // so spiral-stair logic in Stairs.configureForLobby finds the right lobby height.
            if (l.size.y < height) {
              for (let f = oldHeight; f < height; f++) {
                const fy = l.position.y + f;
                if (!this.itemsByFloor.has(fy)) this.itemsByFloor.set(fy, new Set());
                this.itemsByFloor.get(fy).add(l);
              }
              l.size.y = height;
              if (diff === 0) diff = height - oldHeight; // charge for pure-height upgrade
            }
            l.updateSprite();
            this.gameMap.addNode(
              { x: i.position.x + Math.floor(i.size.x / 2), y: i.position.y + i.prototype.entrance_offset },
              i,
            );
            if (diff > 0) {
              const newMinX = l.position.x;
              const newMaxX = l.position.x + l.size.x;
              for (let f = l.position.y; f < l.position.y + l.size.y; f++) {
                this.extendFloor(f, newMinX, newMaxX);
                const fi = this.floorItems.get(f);
                if (fi) {
                  fi.intervalErase(oldMinX);
                  fi.intervalErase(oldMaxX);
                  fi.intervalInsert(newMinX);
                  fi.intervalInsert(newMaxX);
                }
              }
              this.transferFunds(
                -Math.trunc((proto.price * 4) / diff),
                "construction",
                "Lobby extension",
              );
              this.playOnce("simtower/construction/flexible");
            }
            existingLobby = true;
          }
        }
        if (!existingLobby) {
          const savedH = proto.size.y;
          proto.size.y = height; // SizeGuard equivalent
          const item = this.itemFactory.make(proto, { x, y });
          proto.size.y = savedH;
          this.addItem(item);
          this.transferFunds(-proto.price, "construction", proto.name);
          this.playOnce("simtower/construction/normal");
        }
        this.updateRoutes();
      } else if (proto.icon !== ICON.FLOOR) {
        const item = this.itemFactory.make(proto, { x, y });
        this.addItem(item);
        this.transferFunds(-proto.price, "construction", proto.name);
        if (item.canHaulPeople()) {
          if (item.isElevator()) this.selectTool("finger");
        }
        this.updateRoutes();
        this.playOnce("simtower/construction/normal");
      }
    } else {
      this.playOnce("simtower/construction/impossible");
      // During ISSUE-039 batch commits the drag summary reports the block.
      if (!this._batchCommitting) this.ui.showMessage("Cannot place item there. " + blockReason + ".");
    }
  }

  // ------------------------------------------------------------- seeding
  clearWorld() {
    this.ui.closeDialogs();
    for (const item of [...this.items]) item.destroy?.();
    this.items.clear();
    this.itemsByFloor.clear();
    this.itemsByType.clear();
    this.floorItems.clear();
    this.mainLobby = null;
    this.metroStation = null;
    this.itemBelowCursor = null;
    this.population = 0;
    this.populationNeedsUpdate = false;
    this.visualizeRoute.clear();
    this.gameMap.clear();
    this.decorations.reset();
    this.draggingElevator = null;
    this.draggingMotor = 0;
    this.draggingElevatorStart = 0;
    this.draggingElevatorLower = false;
    this.batchDrag = null;
    this.pendingPress = null;
    this.ghostArmed = false;
    this.ghostGrab = null;
    this.toolPrototype = null;
    this.soundPlayTimes.clear();
    this.vipSystem.reset();
    this.eventSystem.reset();
  }

  seedNewTower() {
    this.clearWorld();
    this.rand = new Rand(1);
    setGlobalRand(this.rand);
    this.funds = 4000000;
    this.money.clear(this.funds);
    this.rating = 0;
    this.population = 0;
    this.populationNeedsUpdate = false;
    this.time.set(7 / 78.0);
    this.lastAccountingDay = Math.floor(this.time.absolute);
    this.lastAccountingQuarter = this.time.quarter;
    this.setSpeedMode(1);
    this.selectTool("inspector");
    this.poi.x = 0;
    this.poi.y = 200;
    this.updateRoutes();
    this.isDirty = false;
    this.lastSavedAt = null;
  }

  seedOfficeLunchQa() {
    this.clearWorld();
    this.time.set(hourToAbsolute(11.95));
    this.setSpeedMode(3);
    const lobby = this.itemFactory.make("lobby", { x: -16, y: 0 });
    lobby.size.x = 32;
    lobby.size.y = 3;
    this.addItem(lobby);
    this.addItem(this.itemFactory.make("stairs", { x: -4, y: 0 }));
    this.addItem(this.itemFactory.make("floor", { x: -16, y: 3 }));
    const office = this.itemFactory.make("office", { x: -12, y: 3 });
    this.addItem(office);
    const fastFood = this.itemFactory.make("fastfood", { x: 0, y: 3 });
    fastFood.open = true;
    fastFood.updateSprite();
    this.addItem(fastFood);
    this.updateRoutes();
    office.prepareLunchQa?.(12.0);
  }

  // ------------------------------------------------------------- save/load
  // ISSUE-041 self-heal: restore slab coverage for items whose level has no
  // sufficiently wide Floor — repairs towers saved while the elevator motor-
  // drag off-by-one (fixed alongside) minted incomplete slabs.
  // - Non-hauler rooms: their footprint must sit on slab (construction rules
  //   guarantee it going forward; drift here is pure data corruption).
  // - Haulers (stairs/elevator): mint a stub under the transport column only
  //   where the level has NO floor at all — mirrors what the corrected C++
  //   parity minting would have produced — without widening existing slabs.
  // Runs free of charge, sound-free, and re-routes once afterwards.
  repairFloorCoverage() {
    const needs = new Map(); // level -> { min, max }
    const addNeed = (y, x0, x1) => {
      const n = needs.get(y);
      if (!n) needs.set(y, { min: x0, max: x1 });
      else {
        n.min = Math.min(n.min, x0);
        n.max = Math.max(n.max, x1);
      }
    };
    for (const item of this.items) {
      if (item.prototype.icon === ICON.FLOOR) continue;
      const h = Math.max(1, item.size.y ?? 1);
      for (let yy = item.position.y; yy < item.position.y + h; yy++) {
        if (item.canHaulPeople?.()) {
          if (!this.floorItems.has(yy)) addNeed(yy, item.position.x, item.rectMaxX());
        } else {
          addNeed(yy, item.position.x, item.rectMaxX());
        }
      }
    }
    let repaired = false;
    for (const [y, n] of needs) {
      const f = this.floorItems.get(y);
      if (!f || f.position.x > n.min || f.position.x + f.size.x < n.max) {
        this.extendFloor(y, n.min, n.max, { free: true });
        repaired = true;
      }
    }
    return repaired;
  }

  encodeXML() {
    const xml = new XMLPrinter();
    xml.OpenElement("tower");
    xml.PushAttribute("funds", this.funds);
    xml.PushAttribute("rating", this.rating);
    xml.PushAttribute("time", this.time.absolute);
    xml.PushAttribute("speed", this.speedMode);
    xml.PushAttribute("rainy", this.sky.rainyDay);
    xml.PushAttribute("tool", this.selectedTool);
    xml.PushAttribute("x", Math.trunc(this.poi.x));
    xml.PushAttribute("y", Math.trunc(this.poi.y));

    this.vipSystem.encodeXML(xml);
    this.eventSystem.encodeXML(xml);

    xml.OpenElement("pricing");
    xml.PushAttribute("officeRent", this.pricing.officeRent);
    xml.PushAttribute("condoPrice", this.pricing.condoPrice);
    xml.PushAttribute("hotelSingleRate", this.pricing.hotelSingleRate);
    xml.PushAttribute("hotelDoubleRate", this.pricing.hotelDoubleRate);
    xml.PushAttribute("hotelSuiteRate", this.pricing.hotelSuiteRate);
    xml.PushAttribute("cinemaTicket", this.pricing.cinemaTicket);
    xml.CloseElement();

    xml.OpenElement("money");
    xml.PushAttribute("todayIncome", this.money.todayIncome);
    xml.PushAttribute("todayExpenses", this.money.todayExpenses);
    xml.PushAttribute("yesterdayIncome", this.money.yesterdayIncome);
    xml.PushAttribute("yesterdayExpenses", this.money.yesterdayExpenses);
    xml.PushAttribute("lastQuarterBalance", this.money.lastQuarterBalance);
    xml.PushAttribute("quarterIncome", this.money.quarterIncome);
    xml.PushAttribute("quarterExpenses", this.money.quarterExpenses);
    for (const [cat, total] of this.money.todayTotalsByCategory) {
      xml.OpenElement("today");
      xml.PushAttribute("category", cat);
      xml.PushAttribute("total", total);
      xml.CloseElement();
    }
    for (const [cat, total] of this.money.yesterdayTotalsByCategory) {
      xml.OpenElement("yesterday");
      xml.PushAttribute("category", cat);
      xml.PushAttribute("total", total);
      xml.CloseElement();
    }
    for (const day of this.money.recentDays) {
      xml.OpenElement("recentDay");
      xml.PushAttribute("income", day.income);
      xml.PushAttribute("expenses", day.expenses);
      for (const [cat, total] of day.totalsByCategory) {
        xml.OpenElement("category");
        xml.PushAttribute("name", cat);
        xml.PushAttribute("total", total);
        xml.CloseElement();
      }
      xml.CloseElement();
    }
    for (const [cat, total] of this.money.quarterTotalsByCategory) {
      xml.OpenElement("quarter");
      xml.PushAttribute("category", cat);
      xml.PushAttribute("total", total);
      xml.CloseElement();
    }
    xml.CloseElement();

    for (const item of this.items) {
      xml.OpenElement("item");
      item.encodeXML(xml);
      xml.CloseElement();
    }

    xml.CloseElement();
    return injectSaveHash(xml.toString());
  }

  decodeXML(textOrDoc) {
    if (typeof textOrDoc === "string") {
      const check = verifySaveHash(textOrDoc);
      if (!check.valid) {
        this.saveCheatDetected = true;
        throw new Error("Save file integrity check failed (tampered save)");
      }
      this.saveCheatDetected = false;
    }
    const root = typeof textOrDoc === "string" ? parseXML(textOrDoc) : textOrDoc;
    this.clearWorld();

    this.setFunds(intAttr(root, "funds"));
    this.money.clear(this.funds);
    const moneyElement = firstChildNamed(root, "money");
    if (moneyElement) {
      this.money.todayIncome = intAttr(moneyElement, "todayIncome");
      this.money.todayExpenses = intAttr(moneyElement, "todayExpenses");
      this.money.yesterdayIncome = intAttr(moneyElement, "yesterdayIncome");
      this.money.yesterdayExpenses = intAttr(moneyElement, "yesterdayExpenses");
      this.money.lastQuarterBalance = intAttr(moneyElement, "lastQuarterBalance", this.money.balance);
      this.money.quarterStartBalance = this.money.lastQuarterBalance;
      this.money.quarterIncome = intAttr(moneyElement, "quarterIncome", 0);
      this.money.quarterExpenses = intAttr(moneyElement, "quarterExpenses", 0);
      for (const e of childrenNamed(moneyElement, "today")) {
        if (e.attrs.category) this.money.todayTotalsByCategory.set(e.attrs.category, intAttr(e, "total"));
      }
      for (const e of childrenNamed(moneyElement, "yesterday")) {
        if (e.attrs.category) this.money.yesterdayTotalsByCategory.set(e.attrs.category, intAttr(e, "total"));
      }
      for (const e of childrenNamed(moneyElement, "quarter")) {
        if (e.attrs.category) this.money.quarterTotalsByCategory.set(e.attrs.category, intAttr(e, "total"));
      }
      for (const e of childrenNamed(moneyElement, "recentDay")) {
        const day = { income: intAttr(e, "income"), expenses: intAttr(e, "expenses"), totalsByCategory: new Map() };
        for (const c of childrenNamed(e, "category")) {
          if (c.attrs.name) day.totalsByCategory.set(c.attrs.name, intAttr(c, "total"));
        }
        this.money.recentDays.push(day);
      }
    }
    this.setRating(intAttr(root, "rating"));
    this.time.set(doubleAttr(root, "time"));
    this.lastAccountingDay = Math.floor(this.time.absolute);
    this.lastAccountingQuarter = this.time.quarter;
    this.setSpeedMode(intAttr(root, "speed"));
    this.sky.rainyDay = boolAttr(root, "rainy");
    this.selectTool(root.attrs.tool);
    this.poi.x = intAttr(root, "x");
    this.poi.y = intAttr(root, "y");

    this.vipSystem.decodeXML(root);
    this.eventSystem.decodeXML(root);

    const pricingElement = firstChildNamed(root, "pricing");
    if (pricingElement) {
      this.pricing.officeRent = intAttr(pricingElement, "officeRent", this.pricing.officeRent);
      this.pricing.condoPrice = intAttr(pricingElement, "condoPrice", this.pricing.condoPrice);
      this.pricing.hotelSingleRate = intAttr(pricingElement, "hotelSingleRate", this.pricing.hotelSingleRate);
      this.pricing.hotelDoubleRate = intAttr(pricingElement, "hotelDoubleRate", this.pricing.hotelDoubleRate);
      this.pricing.hotelSuiteRate = intAttr(pricingElement, "hotelSuiteRate", this.pricing.hotelSuiteRate);
      this.pricing.cinemaTicket = intAttr(pricingElement, "cinemaTicket", this.pricing.cinemaTicket);
    }

    for (const e of childrenNamed(root, "item")) {
      const item = this.itemFactory.makeFromXML(e);
      this.addItem(item);
    }
    // ISSUE-041: heals slabs corrupted by the elevator-drag off-by-one in
    // older saves (missing/narrow floors made rebuilds preview red).
    this.repairFloorCoverage();
    this.populationNeedsUpdate = true;
    this.updateRoutes();
    this.isDirty = false;
    this.lastSavedAt = null;
    this.saveCheatDetected = false;
  }
}
