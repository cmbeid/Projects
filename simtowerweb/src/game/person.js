// Port of OT::Person (source/Person.h / Person.cpp) + OT::NameManager
// (source/NameManager.cpp).
//
// People have NO x/y position. A person is always inside an item (`at`);
// movement is a sequence of hops between items driven by Journey (see
// docs/specs/people-pathfinding.md §1/§3): the owning item calls
// journey.set(route), each transport item calls person.journey.next() when its
// ride/transition finishes, and the final hop places the person inside the
// destination item via addPerson().

import { rand } from "../core/rand.js";
import { intAttr, doubleAttr } from "../core/xml.js";

// Type enum (Person.h:15; indices are sprite-sheet rows in simtower/elevator/people).
export const K_MAN = 0;
export const K_SALESMAN = 1;
export const K_WOMAN1 = 2;
export const K_CHILD = 3;
export const K_WOMAN2 = 4;
export const K_HOUSEKEEPER = 5;
export const K_WOMAN_WITH_CHILD1 = 6;
export const K_WOMAN_WITH_CHILD2 = 7;
export const K_SECURITY = 8;

// State enum (Person.h:31). Transitions are driven by the owning item, not by
// Person itself; Person::advance is only stress recovery at home/resting.
export const KWANDERING = 0;
export const KHOME = 1;
export const KCOMMUTING = 2;
export const KWORKING = 3;
export const KLUNCH = 4;
export const KSHOPPING = 5;
export const KRETURNING = 6;
export const KRESTING = 7;
export const KIDLE = 8;
export const K_SEEKING_MEDICAL = 9;
export const KEVACUATING = 10;

// ---------------------------------------------------------------------------
// NameManager (NameManager.cpp): 9 per-type counters, "<Role> #<n>".
// reset() exists in C++ but is never invoked — counters persist across tower
// reloads within one app session (names are cosmetic).
// ---------------------------------------------------------------------------
const nameCounters = [0, 0, 0, 0, 0, 0, 0, 0, 0];

function roleName(t) {
  switch (t) {
    case K_MAN: return "Man";
    case K_SALESMAN: return "Salesman";
    case K_WOMAN1:
    case K_WOMAN2: return "Woman";
    case K_CHILD: return "Child";
    case K_HOUSEKEEPER: return "Housekeeper";
    case K_WOMAN_WITH_CHILD1:
    case K_WOMAN_WITH_CHILD2: return "Parent";
    case K_SECURITY: return "Guard";
    default: return "Person";
  }
}

export const NameManager = {
  makeName(type) {
    const t = type >= 0 && type < nameCounters.length ? type : 0;
    const n = ++nameCounters[t];
    return roleName(t) + " #" + n;
  },
  reset() {
    nameCounters.fill(0);
  },
};

// ---------------------------------------------------------------------------
// Journey (Journey.h / Journey.cpp)
//
// A person's movement queue. A Journey is a list of RouteNodes. Calling set()
// initializes the hop-sequence; subsequent calls to next() advance through the
// path.
// ---------------------------------------------------------------------------
export class Journey {
  constructor(person) {
    this.person = person;
    this.nodes = [];
    this.item = null;
    this.fromFloor = 0;
    this.toFloor = 0;
  }

  // Set the target route and immediately enter the first transport hop.
  set(route) {
    this.nodes = [];
    if (route) {
      for (const node of route.nodes) {
        this.nodes.push({ item: node.item, toFloor: node.toFloor });
      }
    }
    if (this.nodes.length === 0) {
      this.item = null;
      return;
    }
    this.toFloor = this.nodes[0].toFloor;
    this.next();
  }

  // Advance to the next route node. Off-by-one by design: set()'s initial
  // next() pops the START item (the person is already inside it) and enters
  // the first transport; each subsequent next() (called by the transport when
  // its ride completes) pops the transport just ridden and enters the next
  // node. The final destination node is entered but never popped — when the
  // queue empties after a pop, the journey is complete and the person remains
  // where they are.
  next() {
    const person = this.person;

    // Remove the person from where he/she is currently at.
    if (person.at) person.at.removePerson(person);

    // Keep the current floor around.
    this.fromFloor = this.toFloor;

    // Guard against an empty route (no valid path): leave them where they are.
    if (this.nodes.length === 0) {
      this.item = null;
      this.toFloor = this.fromFloor;
      return;
    }

    // Jump to next node.
    this.nodes.shift();

    // Journey complete — keep the person where they are.
    if (this.nodes.length === 0) {
      this.item = null;
      this.toFloor = this.fromFloor;
      return;
    }

    // Add the person to the node's item (Elevator::addPerson joins the queue,
    // Stairlike::addPerson starts the transition, tenants just receive them).
    this.item = this.nodes[0].item;
    this.toFloor = this.nodes[0].toFloor;
    this.item.addPerson(person);
  }
}

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------
export class Person {
  // C++ signature is Person(Game*, Type type = kMan); `type` is optional so
  // the contract constructor `new Person(game)` keeps working.
  constructor(game, type = K_MAN) {
    this.game = game;
    this.journey = new Journey(this);
    this.type = type;
    this.at = null;
    this.state = KWANDERING;
    this.name = NameManager.makeName(type);
    this.from = "";
    this.goingTo = "";
    this.stress = 0.0;
    this.eval = 0.0;
    this.isSick = false;
    this.treatmentTimer = 0;
    this.animOffset = (rand() % 1000) / 1000.0;
    this.isWalking = false;
    this.walkX = 0.0;
    this.targetX = 0.0;
    this.walkFloor = 0;
    this.walkDirection = 1;
    if (game) game.people.add(this);
  }

  startWalk(fromX, toX, floor) {
    this.isWalking = true;
    this.walkX = fromX;
    this.targetX = toX;
    this.walkFloor = floor;
    this.walkDirection = toX >= fromX ? 1 : -1;
  }

  // ~Person: force-remove from the containing item and from game.people.
  destroy() {
    if (this.at) this.at.removePerson(this);
    if (this.game) this.game.people.delete(this);
  }

  // dt is the REAL frame delta (Game::advance passes the same dt as for
  // items; Game.cpp:882). Only stress recovery lives here — all state
  // transitions are driven by owning items.
  advance(dt) {
    if (this.isWalking) {
      const step = 60 * dt * this.walkDirection;
      if (
        (this.walkDirection > 0 && this.walkX + step >= this.targetX) ||
        (this.walkDirection < 0 && this.walkX + step <= this.targetX)
      ) {
        this.walkX = this.targetX;
        this.isWalking = false;
      } else {
        this.walkX += step;
      }
    }
    if (this.state === KHOME || this.state === KRESTING) this.addStress(-dt * 0.5);
  }

  addStress(amount) {
    this.stress += amount;
    if (this.stress < 0) this.stress = 0;
    if (this.stress > 100) this.stress = 100;
  }

  getWidth() {
    return this.type >= K_HOUSEKEEPER ? 16 : 8;
  }

  getStateName() {
    switch (this.state) {
      case KWANDERING: return "Wandering";
      case KHOME: return "Home";
      case KCOMMUTING: return "Commuting";
      case KWORKING: return "Working";
      case KLUNCH: return "Lunch";
      case KSHOPPING: return "Shopping";
      case KRETURNING: return "Returning";
      case KRESTING: return "Resting";
      case KIDLE: return "Idle";
      default: return "Unknown";
    }
  }

  getThoughtStatus() {
    if (this.stress >= 80) return "Furious: excessive commute delays!";
    if (this.stress >= 50) return "Stressed: long wait times";
    switch (this.state) {
      case KWORKING: return "Focused on work";
      case KLUNCH: return "Having lunch";
      case KSHOPPING: return "Visiting shops";
      case KCOMMUTING: return `Heading to ${this.goingTo || "destination"}`;
      case KRETURNING: return "Returning home";
      case KRESTING: return "Resting peacefully";
      case KHOME: return "Relaxing at home";
      case KWANDERING: return "Exploring the tower";
      default: return "Waiting";
    }
  }

  getWorldPosition() {
    if (this.isWalking) {
      return { x: this.walkX, y: this.walkFloor * 36 };
    }
    if (!this.at) return null;
    const at = this.at;

    // Inside Elevator
    if (at.isElevator && at.isElevator()) {
      for (const car of at.cars || []) {
        if (car.passengers && car.passengers.has(this)) {
          return { x: car.spriteX + 16, y: car.altitude * 36 };
        }
      }
      for (const q of at.queues || []) {
        const idx = q.people ? q.people.indexOf(this) : -1;
        if (idx !== -1) {
          const spacing = this.getWidth();
          const qx = at.position.x * 8 + (q.direction === 1 ? -12 - idx * spacing : at.size.x * 8 + 12 + idx * spacing);
          return { x: qx, y: q.floor * 36 };
        }
      }
      return { x: at.position.x * 8 + at.size.x * 4, y: at.position.y * 36 };
    }

    // Inside Stairs / Escalator
    if (at.isStairlike && at.isStairlike()) {
      return { x: at.position.x * 8 + at.size.x * 4, y: at.position.y * 36 };
    }

    // Standard Tenant / Room
    const rx = at.position.x * 8;
    const itemWidthPx = (at.size ? at.size.x : 4) * 8;
    const stories = Math.max(1, at.size ? at.size.y : 1);
    const peopleArr = at.people ? [...at.people] : [];
    const N = Math.max(1, peopleArr.length);
    let idx = peopleArr.indexOf(this);
    if (idx === -1) idx = 0;
    const slotsPerStory = Math.max(1, Math.ceil(N / stories));
    const story = idx % stories;
    const slot = Math.floor(idx / stories);
    const ry = (at.position.y + story) * 36;
    const margin = at.prototype?.icon === 1 /* LOBBY */ ? 16 : 4;
    const frameW = 16;
    const minX = rx + margin;
    const maxX = rx + itemWidthPx - margin - frameW;
    let px = rx + ((slot + 0.5) * itemWidthPx) / slotsPerStory - frameW / 2.0;
    if (maxX >= minX) {
      px = Math.max(minX, Math.min(maxX, px));
    } else {
      px = rx + (itemWidthPx - frameW) / 2;
    }
    return {
      x: px + frameW / 2,
      y: ry,
    };
  }

  // Dead code in C++ (never called by Game; item classes inline the same
  // attributes) — ported 1:1 for completeness.
  encodeXML(xml) {
    xml.PushAttribute("type", this.type);
    xml.PushAttribute("state", this.state);
    xml.PushAttribute("stress", this.stress);
    xml.PushAttribute("eval", this.eval);
    xml.PushAttribute("name", this.name);
    xml.PushAttribute("from", this.from);
    xml.PushAttribute("goingTo", this.goingTo);
  }

  decodeXML(el) {
    this.type = intAttr(el, "type", K_MAN);
    this.state = intAttr(el, "state", KWANDERING);
    this.stress = doubleAttr(el, "stress", 0.0);
    this.eval = doubleAttr(el, "eval", 0.0);
    this.name = el.attrs.name !== undefined ? el.attrs.name : "";
    this.from = el.attrs.from !== undefined ? el.attrs.from : "";
    this.goingTo = el.attrs.goingTo !== undefined ? el.attrs.goingTo : "";
  }
}
