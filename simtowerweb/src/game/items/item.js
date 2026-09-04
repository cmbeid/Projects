// Port of OT::Item::Item (source/Item/Item.h / Item.cpp).
// Subclasses live in this directory (one file per type) and in ../transport/.

import { K_BASE_SPEED } from "../../core/time.js";
import { Route } from "../route.js";
import { Sprite, colorEqual } from "../sprite.js";
import {
  K_MAN,
  K_SALESMAN,
  K_WOMAN1,
  K_CHILD,
  K_WOMAN2,
  K_HOUSEKEEPER,
  K_WOMAN_WITH_CHILD1,
  K_WOMAN_WITH_CHILD2,
} from "../person.js";

export class Item {
  constructor(game, prototype) {
    this.game = game;
    this.prototype = prototype;
    this.layer = 0;
    this.position = { x: 0, y: 0 };
    this.size = { x: prototype.size.x, y: prototype.size.y };
    this.sprites = new Set();
    this.population = 0;
    this.evaluation = 50;
    this.underConstruction = false;
    this.constructionEndTime = 0;
    this.people = new Set();
    this.lobbyRoute = new Route();
    this.metroRoute = new Route();
  }

  init() {}

  destroy() {
    // ~Item: remove all people first
    while (this.people.size > 0) this.removePerson(this.people.values().next().value);
    this.sprites.clear();
  }

  // --- geometry -----------------------------------------------------------
  setPosition(p) {
    this.position = { x: p.x, y: p.y };
  }
  getPosition() {
    return this.position;
  }
  getPositionPixels() {
    return { x: this.position.x * 8, y: this.position.y * 36 };
  }
  getSizePixels() {
    return { x: this.size.x * 8, y: this.size.y * 36 };
  }
  getRect() {
    return { x: this.position.x, y: this.position.y, w: this.size.x, h: this.size.y };
  }
  rectMaxX() {
    return this.position.x + this.size.x;
  }
  rectMaxY() {
    return this.position.y + this.size.y;
  }

  // mouse region in world pixel space (y up, bottom-left origin of item)
  getMouseRegion() {
    const p = this.getPositionPixels();
    const s = this.getSizePixels();
    return { x: p.x, y: p.y, w: s.x, h: s.y };
  }

  containsPoint(pt) {
    // C++ Math::Rect::containsPoint is half-open: [minX, maxX)
    const r = this.getMouseRegion();
    return pt.x >= r.x && pt.y >= r.y && pt.x < r.x + r.w && pt.y < r.y + r.h;
  }

  // --- sprites ------------------------------------------------------------
  addSprite(s) {
    this.sprites.add(s);
  }
  removeSprite(s) {
    this.sprites.delete(s);
  }

  // --- construction -------------------------------------------------------
  constructionDuration() {
    const id = this.prototype.id;
    const isInstant =
      id === "lobby" ||
      id === "floor" ||
      id === "stairs" ||
      id === "escalator" ||
      id === "parking" ||
      id.startsWith("elevator-");
    if (isInstant) return 0.0;
    return (1.0 + 0.1 * this.size.x) * K_BASE_SPEED;
  }

  // --- sim ----------------------------------------------------------------
  advance(dt) {}
  dailyMaintenanceCost() {
    return 0;
  }
  getEvaluation() {
    return this.evaluation;
  }
  isOccupied() {
    return false;
  }
  canHaulPeople() {
    return false;
  }
  connectsFloor(floor) {
    return false;
  }
  isStairlike() {
    return false;
  }
  isElevator() {
    return false;
  }
  getRandomBackgroundSoundPath() {
    return "";
  }

  addPerson(p) {
    if (!p.at) p.at = this;
    this.people.add(p);
  }
  removePerson(p) {
    p.at = null;
    this.people.delete(p);
  }

  updateRoutes() {
    if (!this.canHaulPeople() && this.position.y !== 0) {
      this.lobbyRoute = this.game.findRoute(this.game.mainLobby, this);
    } else {
      this.lobbyRoute.clear();
    }
  }

  desc() {
    return this.prototype.id + " floor " + this.position.y;
  }

  // Display name for UI surfaces (inspector, journeys). Base items use the
  // prototype name; variant tenants (restaurant/fastfood/retail) override
  // this with their authentic cosmetic name pool pick (ISSUE-035).
  displayName() {
    return this.prototype.name;
  }

  // --- persistence --------------------------------------------------------
  encodeXML(xml) {
    xml.PushAttribute("type", this.prototype.id);
    xml.PushAttribute("x", this.position.x);
    xml.PushAttribute("y", this.position.y);
    xml.PushAttribute("evaluation", this.evaluation);
    if (this.underConstruction) {
      xml.PushAttribute("underConstruction", true);
      xml.PushAttribute("constructionEndTime", this.constructionEndTime);
    }
  }

  decodeXML(el) {
    this.evaluation = el.attrs.evaluation !== undefined ? parseFloat(el.attrs.evaluation) : 50.0;
    this.underConstruction = el.attrs.underConstruction === "true";
    this.constructionEndTime =
      el.attrs.constructionEndTime !== undefined ? parseFloat(el.attrs.constructionEndTime) : 0.0;
  }

  // --- rendering ----------------------------------------------------------
  // Emits draw ops via `draw` (see render/drawlist.js). Mirrors Item::render.
  render(draw) {
    const game = this.game;
    let showConstruction = this.underConstruction;
    let statusTint = null; // null = white/none
    if (game.statusMode === 3) {
      // kHotel: grey out non-hotels
      showConstruction = false;
      const id = this.prototype.id;
      const isHotel = id.startsWith("hotel");
      if (!isHotel) statusTint = { r: 110, g: 110, b: 110, a: 160 };
    }

    if (showConstruction) {
      this.renderConstruction(draw);
      return;
    }

    const tint = game.lighting.tint();
    const tinted = !colorEqual(tint, { r: 255, g: 255, b: 255, a: 255 }) || statusTint !== null;
    for (const s of this.sprites) {
      game.drawnSprites++;
      let color = s.color;
      if (tinted) {
        let composed = game.lighting.compose(s.color);
        if (statusTint) {
          composed = {
            r: (composed.r * statusTint.r) >> 8,
            g: (composed.g * statusTint.g) >> 8,
            b: (composed.b * statusTint.b) >> 8,
            a: (composed.a * statusTint.a) >> 8,
          };
        }
        color = composed;
      }
      draw.sprite(s, color);
    }

    // AnimPeple: occupants as animated person sprites
    // Elevators and stairs have their own specialized rendering (queues/cars and animated stair frames);
    // multi-story venues with pre-rendered crowds (partyhall, cinema), structural floors, or sleeping condos skip standalone person overlays
    const isElevator = this.isElevator && this.isElevator();
    const isStairlike = this.isStairlike && this.isStairlike();
    const isStructural = this.prototype.icon === 0 /*ICON_FLOOR*/ || this.prototype.id === "floor";
    const isEventVenue = this.prototype.id === "partyhall" || this.prototype.id === "cinema";
    const isSleepingCondo =
      (this.prototype.id === "condo" || this.prototype.id === "yoot_condo") && this.lighting === 0 /* NIGHT */;

    const skipPeopleRender =
      isElevator ||
      isStairlike ||
      isStructural ||
      isEventVenue ||
      isSleepingCondo;

    const shouldRenderPeople =
      (this.people.size > 0 || (this.prototype.id === "office" && this.occupied && this.lit)) &&
      !this.underConstruction &&
      !skipPeopleRender;

    if (shouldRenderPeople) {
      this.renderPeople(draw, statusTint, tinted);
    }

    if (
      !this.canHaulPeople() &&
      this.position.y !== 0 &&
      this.prototype.icon !== 0 /*ICON_FLOOR*/ &&
      this.lobbyRoute.empty()
    ) {
      // noroute icon centered on the disconnected room
      const p = this.getPositionPixels();
      const s = this.getSizePixels();
      draw.image(
        "noroute.png",
        null,
        p.x + s.x / 2.0,
        -(p.y + s.y / 2.0),
        { origin: { x: 18, y: 18 }, tint: tinted ? game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) : null },
      );
      game.drawnSprites++;
    }
  }

  renderConstruction(draw) {
    const game = this.game;
    const p = this.getPositionPixels();
    const s = this.getSizePixels();
    const duration = this.constructionDuration();
    let progress = 1.0;
    if (duration > 0.0) {
      const elapsed = game.time.absolute - (this.constructionEndTime - duration);
      progress = elapsed / duration;
      if (progress < 0.0) progress = 0.0;
      if (progress > 1.0) progress = 1.0;
    }
    const H = Math.trunc(24 * (1.0 - progress));
    const N = Math.max(1, Math.trunc(this.size.x / 4));
    const animIndex = Math.trunc(game.time.absolute * 1500.0);

    for (let story = 0; story < this.size.y; story++) {
      const y_offset = story * 36;
      // grid scaffolding
      draw.image(
        "simtower/construction/grid",
        { x: 0, y: 0, w: s.x, h: 36 },
        p.x,
        -(p.y + y_offset + 36),
        { tint: game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) },
      );
      // workers
      for (let i = 0; i < N; i++) {
        const workerX = p.x + ((i + 0.5) * s.x) / N;
        const workerY = -(p.y + y_offset);
        const frame = (animIndex + i * 17 + story * 29) % 6;
        draw.image(
          "simtower/construction/worker",
          { x: frame * 16, y: 0, w: 16, h: 24 },
          workerX,
          workerY,
          { origin: { x: 8, y: 24 }, tint: game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) },
        );
      }
      // solid shutter
      if (H > 0) {
        draw.image(
          "simtower/construction/solid",
          { x: 0, y: 0, w: s.x, h: H },
          p.x,
          -(p.y + y_offset + 24),
          { tint: game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 }) },
        );
      }
    }
    draw.rect(p.x, -(p.y + s.y), s.x, s.y, {
      outline: game.lighting.compose({ r: 90, g: 70, b: 30, a: 255 }),
      outlineWidth: 1,
    });
    game.drawnSprites++;
  }

  renderPeople(draw, statusTint, tinted) {
    const game = this.game;
    const id = this.prototype.id;

    // Suppress occupant overlays for venues with pre-rendered crowds, night sleeping graphics, or fast food/cafes:
    if (id === "cinema" || (id === "partyhall" && this.open) || id === "fastfood") {
      return;
    }
    if ((id === "condo" || id === "yoot_condo") && this.lighting === 0 /* NIGHT */) {
      return;
    }
    if (id.startsWith("hotel")) {
      if (this.roomState !== 1 /* K_OCCUPIED */) return;
      let allResting = true;
      for (const g of this.guests || this.people) {
        if (g.state !== 7 /* KRESTING */) {
          allResting = false;
          break;
        }
      }
      if (allResting && (this.guests?.size > 0 || this.people?.size > 0)) return;
    }

    let peopleArr = [...this.people];
    if (id.startsWith("hotel")) {
      // ISSUE-037: per-guest overlay gating. The room sheet's resting column
      // (col 2) pre-renders sleeping guests lying in bed, so a KRESTING guest
      // must NOT also be drawn as a standing animpeple figure — otherwise
      // mixed-occupancy rooms (staggered sleep/wake slots) show the sleeping
      // guest standing at the window. Only awake occupants get the overlay.
      peopleArr = peopleArr.filter((p) => p.state !== 7 /* KRESTING */);
    }
    if (id === "restaurant") {
      // Fine-dining Restaurant (85ec.bmp):
      // The background state texture (simtower/restaurant) pre-renders seated diners.
      // The animpeple overlay represents active waitstaff (1 server for small crowd, 2 servers for >=10 patrons).
      const maxServers = peopleArr.length >= 10 ? 2 : 1;
      peopleArr = peopleArr.slice(0, maxServers);
    }
    // If an occupied office is active and lit but workers have not yet entered this.people,
    // display a subset of its assigned workers so the office looks populated.
    if (peopleArr.length === 0 && id === "office" && this.occupied && this.lit && this.workers) {
      peopleArr = [...this.workers].slice(0, 3);
    }
    const N = peopleArr.length;
    if (N === 0) return;

    const itemWidthPx = this.size.x * 8;
    const frameW = 16;
    const frameH = 24;
    const stories = Math.max(1, this.size.y);
    const slotsPerStory = Math.max(1, Math.ceil(N / stories));
    const bitmaps = game.app.bitmaps;
    const margin = this.prototype.icon === 1 /* LOBBY */ ? 16 : 4;
    const minX = this.position.x * 8 + margin;
    const maxX = this.position.x * 8 + itemWidthPx - margin - frameW;

    let idx = 0;
    for (const p of peopleArr) {
      let sheet = "simtower/people";
      if (p.type === K_HOUSEKEEPER || id === "housekeeping") sheet = "simtower/animpeple/housekeeper";
      else if (id === "security") sheet = "simtower/animpeple/guard";
      else if (id === "office") sheet = "simtower/animpeple/office";
      else if (id === "condo" || id === "yoot_condo") sheet = "simtower/animpeple/condo";
      else if (id.startsWith("hotel")) sheet = "simtower/animpeple/hotel";
      else if (id === "restaurant") sheet = "simtower/animpeple/restaurant";
      else if (id === "cinema" || id === "partyhall") sheet = "simtower/animpeple/event";

      let generic = sheet === "simtower/people";
      if (bitmaps && bitmaps.getSize) {
        const sz = bitmaps.getSize(sheet);
        if (sz && sz.x > 1024) {
          sheet = "simtower/people";
          generic = true;
        }
      }

      let frameCount = 6;
      if (bitmaps && bitmaps.getSize) {
        const sz = bitmaps.getSize(sheet);
        if (sz) frameCount = Math.max(1, Math.trunc(sz.x / frameW));
      }

      let frame = 0;
      let slotJitter = 0;

      if (generic) {
        // Generic walk sheet: 6-frame continuous walking cycle
        frame = Math.trunc(game.time.absolute * 100.0 + (p.animOffset ?? 0) * frameCount) % frameCount;
      } else if (id === "condo" || id === "yoot_condo") {
        // Condo resident persona mapping matching p.type:
        // animpeple/condo.png: 27 frames (Men: 0,1; Women: 2..21; Kids: 22..24; Pets: 25..27)
        const personPhase = ((p.animOffset ?? (idx * 0.37)) * 17.0 + idx * 3.1 + (this.position.x % 17) * 0.31) % 1000;
        const cycleStep = Math.floor(game.time.absolute * 8.0 + personPhase);

        if (p.type === K_MAN || p.type === K_SALESMAN) {
          // Men: frames 0, 1
          const manFrames = [0, 1];
          const mIdx = Math.abs(Math.floor(cycleStep + idx * 3)) % manFrames.length;
          frame = manFrames[mIdx];
        } else if (p.type === K_CHILD) {
          // Children: frames 22 (playing on floor), 23 (standing), 24 (wagon)
          const kidFrames = [22, 23, 24];
          const kIdx = Math.abs(Math.floor(cycleStep + idx * 5)) % kidFrames.length;
          frame = kidFrames[kIdx];
        } else if (p.type === K_WOMAN_WITH_CHILD1 || p.type === K_WOMAN_WITH_CHILD2) {
          // Parent with child/baby: frames 20 (holding baby), 18-19 (stroller pair), 4 (holding flower)
          const parentPairs = [
            [20, 20],  // holding baby
            [18, 19],  // stroller / walker
            [4, 4],    // flower
          ];
          const pIdx = Math.abs(Math.floor(cycleStep * 5 + idx * 7)) % parentPairs.length;
          const pair = parentPairs[pIdx];
          const subframe = Math.floor(game.time.absolute * 30.0 + personPhase * 2.0) % pair.length;
          frame = pair[subframe];
        } else {
          // Adult women (K_WOMAN1, K_WOMAN2, or general female resident):
          // Rich pool of 9 diverse home activities / outfits (never picking identical frame for two women)
          const womanActivities = [
            [2, 3],    // casual dresses
            [4, 5],    // kimono / garden flower
            [6, 7],    // tea kettle
            [8, 9],    // vacuuming
            [10, 11],  // coat hanger / wardrobe
            [12, 13],  // plant watering
            [14, 15],  // picking up coat
            [16, 17],  // tray / drink
            [21, 21],  // armchair reading
          ];
          const actIndex = Math.abs((cycleStep * 7 + idx * 5 + Math.trunc(this.position.x * 3)) % womanActivities.length);
          const pair = womanActivities[actIndex];
          const subframe = Math.floor(game.time.absolute * 40.0 + personPhase * 2.0) % pair.length;
          frame = pair[subframe];
        }

        // Distribute occupants across the living room, dining area, and bedroom (condo is 16 tiles = 128px)
        const slotOffset = ((idx * 31 + Math.abs(Math.trunc(this.position.x * 7))) % 7 - 3) * 4;
        slotJitter = slotOffset + (((Math.abs(cycleStep * 3 + idx * 7) % 3) - 1) * 2);
      } else {
        // Multi-activity AnimPeple sheet (office, hotel, event, guard, restaurant, housekeeper):
        // Each character holds an activity and position for several seconds (~4-8s),
        // with subtle micro-animation (subframe 0/1) rather than a rapid 60fps costume strobe.
        const personPhase = ((p.animOffset ?? (idx * 0.25)) * 17.0 + idx * 2.37 + (this.position.x % 17) * 0.31) % 1000;
        // ~12 activity changes per game day (1 change every ~5s at 1x speed)
        const cycleStep = Math.floor(game.time.absolute * 12.0 + personPhase);

        const pairCount = Math.floor(frameCount / 2);
        if (pairCount >= 2) {
          // Paired sheet (e.g. office with 15 pairs, hotel with 5 pairs, guard with 5 pairs):
          const pairIndex = Math.abs((cycleStep * 10007 + idx * 997 + Math.trunc(this.position.x * 13)) % pairCount);
          // Micro-animation (typing, gesturing, breathing) toggles gently at ~1-2 Hz
          const subframe = Math.floor(game.time.absolute * 60.0 + personPhase * 3.0) % 2;
          frame = pairIndex * 2 + subframe;
        } else {
          // Odd or single-frame activity sheet (housekeeper, restaurant)
          frame = Math.abs((cycleStep * 10007 + idx * 997) % frameCount);
        }

        // Slight positional wander per activity cycle (e.g. moving between desk, couch, water cooler)
        slotJitter = (((Math.abs(cycleStep * 7 + idx * 13 + Math.trunc(this.position.x)) % 5) - 2) * 3);
      }

      const story = idx % stories;
      const slot = Math.floor(idx / stories);
      let px = this.position.x * 8 + ((slot + 0.5) * itemWidthPx) / slotsPerStory - frameW / 2.0 + slotJitter;
      if (maxX >= minX) {
        px = Math.max(minX, Math.min(maxX, px));
      } else {
        px = this.position.x * 8 + (itemWidthPx - frameW) / 2;
      }
      const py = -(this.position.y + story) * 36;

      let color = { r: 255, g: 255, b: 255, a: 255 };
      if (generic) {
        color = { r: 0, g: 0, b: 0, a: 255 };
        if (p.stress > 80) color = { r: 255, g: 0, b: 0, a: 255 };
        else if (p.stress > 40) color = { r: 255, g: 128, b: 128, a: 255 };
      }
      color = game.lighting.compose(color);
      if (statusTint) {
        color = {
          r: (color.r * statusTint.r) >> 8,
          g: (color.g * statusTint.g) >> 8,
          b: (color.b * statusTint.b) >> 8,
          a: (color.a * statusTint.a) >> 8,
        };
      }
      draw.image(sheet, { x: frame * frameW, y: 0, w: frameW, h: frameH }, px, py, {
        origin: { x: 0, y: frameH },
        tint: color,
      });
      game.drawnSprites++;
      idx++;
    }
  }
}
