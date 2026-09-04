// Port of OT::Item::Elevator (source/Item/Elevator/Elevator.h / Elevator.cpp)
// plus the Standard / Express / Service variants (Standard.h / Express.h /
// Service.h).
//
// The shaft spans floors [position.y, position.y + size.y); cars move with a
// trapezoid profile; queues collect waiting people per (floor, direction).
// Maintenance: 100 + 250/car + 20/floor per day. Extending the shaft via the
// motor gearboxes is free in this port (see docs/specs/elevators.md §10).

import { Item } from "../items/item.js";
import { Sprite } from "../sprite.js";
import { Car } from "./car.js";
import { Queue } from "./queue.js";

// Elevator.h:56-60
export const K_UP = 1;
export const K_NONE = 0;
export const K_DOWN = -1;

export class Elevator extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.layer = 1;

    this.shaftBitmap = "";
    this.carBitmap = "";
    this.maxCarAcceleration = 7.5;
    this.maxCarSpeed = 10.0;
    this.maxCarCapacity = 21;

    this.animation = 0;
    this.frame = 0;

    this.shaft = new Sprite();
    this.topMotor = new Sprite();
    this.bottomMotor = new Sprite();

    this.cars = [];
    this.queues = [];
    this.unservicedFloors = new Set();
    this.unservicedFloorsWeekend = new Set();
    this.showShaft = true;
  }

  init() {
    this.layer = 1;
    this.maxCarAcceleration = 7.5;
    this.maxCarSpeed = 10.0;
    this.maxCarCapacity = 21;

    super.init();

    this.animation = 0;
    this.frame = 0;

    this.shaft.setTexture(this.shaftTextureKey());
    this.shaft.setTextureRect({ x: 0, y: 0, w: this.size.x * 8, h: 36 });
    this.shaft.setOrigin(0, 36);
    this.shaft.setPosition(this.position.x * 8, -this.position.y * 36);

    this.topMotor.setTexture(this.shaft.texture);
    this.topMotor.setOrigin(0, 36);
    this.bottomMotor.setTexture(this.shaft.texture);
    this.bottomMotor.setOrigin(0, 36);

    this.addSprite(this.topMotor);
    this.addSprite(this.bottomMotor);

    this.updateSprite();

    this.addCar(this.position.y);
  }

  // Edition shaft texture (elevator_narrow / elevator_wide) when the bitmap
  // registry provides it, else the base shaft sheet.
  shaftTextureKey() {
    const bitmaps = this.game.app && this.game.app.bitmaps;
    const edition = this.shaftBitmap.indexOf("wide") !== -1 ? "edition/elevator_wide" : "edition/elevator_narrow";
    if (bitmaps && bitmaps.has && bitmaps.has(edition)) return edition;
    return this.shaftBitmap;
  }

  updateSprite() {
    const w = this.size.x * 8;

    // Frames 2*frame+1 (top) and 2*frame+2 (bottom) of the 7-frame shaft
    // sheet animate the motor gearboxes.
    this.topMotor.setTextureRect({ x: (2 * this.frame + 1) * w, y: 0, w, h: 36 });
    this.bottomMotor.setTextureRect({ x: (2 * this.frame + 2) * w, y: 0, w, h: 36 });
    this.topMotor.setPosition(this.position.x * 8, -(this.position.y + this.size.y) * 36);
    this.bottomMotor.setPosition(this.position.x * 8, -(this.position.y - 1) * 36);
  }

  render(draw) {
    const game = this.game;
    super.render(draw); // motors (+ people anims, C++ quirk) via sprite set

    const statusTintOn = game.statusMode === 3;
    const tint = game.lighting.tint();
    const tinted =
      statusTintOn ||
      tint.r !== 255 || tint.g !== 255 || tint.b !== 255 || tint.a !== 255;

    let shaftColor = null;
    if (tinted) {
      shaftColor = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
      if (statusTintOn) {
        shaftColor = {
          r: Math.trunc((shaftColor.r * 110) / 255),
          g: Math.trunc((shaftColor.g * 110) / 255),
          b: Math.trunc((shaftColor.b * 110) / 255),
          a: Math.trunc((shaftColor.a * 160) / 255),
        };
      }
    }

    const minY = this.position.y;
    const maxY = this.size.y + minY - 1;

    // Shaft hidden ("Show: No"): only two 1 px dark rails remain so tenants
    // show through; digits and cars render on top.
    if (!this.showShaft) {
      let railCol = { r: 20, g: 20, b: 20, a: 255 };
      if (tinted) railCol = game.lighting.compose(railCol);
      const railX0 = this.position.x * 8;
      const railX1 = (this.position.x + this.size.x) * 8 - 1;
      const railY0 = -(this.position.y + this.size.y) * 36; // top (render)
      const railY1 = -this.position.y * 36; // bottom (render)
      draw.rect(railX0, railY0, 1, railY1 - railY0, { fill: railCol });
      draw.rect(railX1, railY0, 1, railY1 - railY0, { fill: railCol });
      game.drawnSprites += 2;
    }

    for (let y = minY; y <= maxY; y++) {
      if (this.showShaft) {
        draw.image(this.shaft.texture, this.shaft.textureRect, this.position.x * 8, -y * 36, {
          origin: { x: 0, y: 36 },
          tint: shaftColor,
        });
        game.drawnSprites++;
      }

      if (!this.connectsFloor(y)) continue;

      // Floor digits; home floors tinted pink-red (Elevator.cpp:130-137).
      let isHome = false;
      for (const c of this.cars) {
        if (c.homeFloor === y) {
          isHome = true;
          break;
        }
      }
      let digitColor = isHome
        ? { r: 255, g: 100, b: 100, a: 255 }
        : { r: 255, g: 255, b: 255, a: 255 };
      if (tinted) {
        digitColor = game.lighting.compose(digitColor);
        if (statusTintOn) {
          digitColor = {
            r: Math.trunc((digitColor.r * 110) / 255),
            g: Math.trunc((digitColor.g * 110) / 255),
            b: Math.trunc((digitColor.b * 110) / 255),
            a: Math.trunc((digitColor.a * 160) / 255),
          };
        }
      }

      const label = String(y);
      let x = this.size.x * 4 - (label.length - 1) * 6;
      for (let i = 0; i < label.length; i++) {
        const ch = label[i];
        const p = ch >= "0" && ch <= "9" ? ch.charCodeAt(0) - 48 : 10;
        draw.image("simtower/elevator/digits", { x: p * 11, y: 0, w: 11, h: 17 }, this.position.x * 8 + x, -y * 36 - 10, {
          origin: { x: 5, y: 8 },
          tint: digitColor,
        });
        game.drawnSprites++;
        x += 12;
      }
    }

    for (const c of this.cars) c.render(draw);
    for (const q of this.queues) q.render(draw);
  }

  advance(dt) {
    let carsMoving = false;
    for (const c of this.cars) {
      c.advance(dt);
      if (c.state === 1 /* Car.kMoving */) carsMoving = true;
    }

    // Advance the queues so people get stressed.
    for (const q of [...this.queues]) q.advance(dt);

    // Animate the elevator motors while any car is moving (raw dt, 1:1 with
    // Elevator.cpp:192).
    if (carsMoving) {
      this.animation = (this.animation + dt) % 1;
      const newFrame = Math.floor(this.animation * 3);
      if (this.frame !== newFrame) {
        this.frame = newFrame;
        this.updateSprite();
      }
    } else {
      this.animation = 0;
      if (this.frame !== 0) {
        this.frame = 0;
        this.updateSprite();
      }
    }
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("height", this.size.y);
    xml.PushAttribute("showShaft", this.showShaft);
    for (const floor of [...this.unservicedFloors].sort((a, b) => a - b)) {
      xml.OpenElement("unserviced");
      xml.PushAttribute("floor", floor);
      xml.CloseElement();
    }
    for (const floor of [...this.unservicedFloorsWeekend].sort((a, b) => a - b)) {
      xml.OpenElement("unservicedWeekend");
      xml.PushAttribute("floor", floor);
      xml.CloseElement();
    }
    for (const c of this.cars) {
      xml.OpenElement("car");
      c.encodeXML(xml);
      xml.CloseElement();
    }
  }

  decodeXML(el) {
    this.clearCars();
    super.decodeXML(el);
    this.size.y = parseInt(el.attrs.height, 10) || 1;
    this.showShaft = el.attrs.showShaft !== undefined ? el.attrs.showShaft === "true" : true;
    this.unservicedFloors.clear();
    this.unservicedFloorsWeekend.clear();
    for (const e of el.children || []) {
      if (e.name === "unserviced") {
        this.unservicedFloors.add(parseInt(e.attrs.floor, 10));
      } else if (e.name === "unservicedWeekend") {
        this.unservicedFloorsWeekend.add(parseInt(e.attrs.floor, 10));
      }
    }
    for (const e of el.children || []) {
      if (e.name === "car") {
        const car = new Car(this);
        car.decodeXML(e);
        this.cars.push(car);
      }
    }
    this.updateSprite();
  }

  // The shaft plus one motor height above and below (Elevator.cpp:258-263).
  getMouseRegion() {
    const p = this.getPositionPixels();
    const s = this.getSizePixels();
    return { x: p.x, y: p.y - s.y, w: s.x, h: s.y * 3 };
  }

  spriteWorldBounds(sprite) {
    const r = sprite.textureRect;
    if (!r) return null;
    const x = sprite.position.x - sprite.origin.x;
    const topRender = sprite.position.y - sprite.origin.y;
    return { x, y: -(topRender + r.h), w: r.w, h: r.h };
  }

  // Only the motor gearboxes are clickable; shaft interior clicks pass
  // through to tenants (Elevator.cpp:265-279).
  containsPoint(pt) {
    const rectContains = (r) =>
      pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
    const topRect = this.spriteWorldBounds(this.topMotor);
    if (topRect && rectContains(topRect)) return true;
    const botRect = this.spriteWorldBounds(this.bottomMotor);
    if (botRect && rectContains(botRect)) return true;
    return false;
  }

  // Elevator.cpp:281-342 — drag-resize via the motors. Clamps height to
  // 1..31 floors, clamps cars into range, prunes unserviced floors and
  // cleans queues. Returns true when anything changed.
  repositionMotor(motor, y) {
    let height;
    let newy;
    if (motor === -1) {
      newy = y + 1;
      height = this.size.y + this.position.y - newy;
    } else {
      newy = this.position.y;
      height = y - this.position.y;
    }
    if (height < 1) height = 1;
    if (height > 30 + 1) height = 30 + 1;
    if (motor === -1) {
      newy = this.size.y + this.position.y - height;
    }
    if (newy !== this.position.y || height !== this.size.y) {
      this.setPosition({ x: this.position.x, y: newy });
      this.size.y = height;
      for (const car of this.cars) {
        if (car.altitude < newy) car.altitude = newy;
        else if (car.altitude >= newy + height) car.altitude = newy + height - 1;

        if (car.destinationFloor < newy) car.destinationFloor = newy;
        else if (car.destinationFloor >= newy + height) car.destinationFloor = newy + height - 1;

        if (car.state === 0 /* Car.kIdle */) car.startAltitude = car.altitude;

        car.reposition();
      }

      const maxY = newy + height;
      for (const floor of [...this.unservicedFloors]) {
        if (floor < newy || floor >= maxY) this.unservicedFloors.delete(floor);
      }
      for (const floor of [...this.unservicedFloorsWeekend]) {
        if (floor < newy || floor >= maxY) this.unservicedFloorsWeekend.delete(floor);
      }
      this.updateSprite();
      this.cleanQueues();
      return true;
    }
    return false;
  }

  clearCars() {
    this.cars.length = 0;
  }

  addCar(floor) {
    let defaultFloor = floor !== undefined ? floor : this.position.y;
    let clampedFloor = Math.max(this.position.y, Math.min(this.position.y + this.size.y - 1, defaultFloor));
    if (clampedFloor === 1 || clampedFloor === 2) {
      clampedFloor = this.position.y <= 0 ? 0 : Math.min(this.position.y + this.size.y - 1, 3);
    }
    const car = new Car(this);
    car.setAltitude(clampedFloor);
    car.startAltitude = clampedFloor;
    car.destinationFloor = clampedFloor;
    car.homeFloor = clampedFloor;
    this.cars.push(car);
    return car;
  }

  removeCar(carIndex) {
    if (this.cars.length <= 1) return false;
    const index = carIndex !== undefined ? carIndex : this.cars.length - 1;
    if (index < 0 || index >= this.cars.length) return false;
    const car = this.cars[index];
    for (const p of car.passengers) {
      p.journey.next();
    }
    car.passengers.clear();
    this.cars.splice(index, 1);
    this.cleanQueues();
    return true;
  }

  setCarHomeFloor(carIndex, homeFloor) {
    if (carIndex >= 0 && carIndex < this.cars.length) {
      let clamped = Math.max(this.position.y, Math.min(this.position.y + this.size.y - 1, homeFloor));
      if (clamped === 1 || clamped === 2) {
        clamped = this.position.y <= 0 ? 0 : Math.min(this.position.y + this.size.y - 1, 3);
      }
      this.cars[carIndex].homeFloor = clamped;
    }
  }

  dailyMaintenanceCost() {
    return 100 + this.cars.length * 250 + this.size.y * 20;
  }

  connectsFloor(floor, isWeekend) {
    if (floor < this.position.y || floor >= this.position.y + this.size.y) return false;
    // Intermediate airspace of multi-story lobbies is not accessible
    if (this.game) {
      const lobbies = this.game.itemsByType?.get("lobby");
      if (lobbies) {
        for (const lobby of lobbies) {
          if (lobby.size.y > 1 && floor > lobby.position.y && floor < lobby.position.y + lobby.size.y) {
            return false;
          }
        }
      }
    }
    const weekend = isWeekend !== undefined ? isWeekend : (this.game?.time?.day === 2);
    if (weekend && this.unservicedFloorsWeekend.size > 0) {
      return !this.unservicedFloorsWeekend.has(floor);
    }
    return !this.unservicedFloors.has(floor);
  }

  canHaulPeople() {
    return true;
  }

  isElevator() {
    return true;
  }

  addPerson(p) {
    super.addPerson(p);
    const dir = p.journey.toFloor > p.journey.fromFloor ? K_UP : K_DOWN;
    this.getQueue(p.journey.fromFloor, dir).addPerson(p);
  }

  removePerson(p) {
    for (const q of this.queues) q.removePerson(p);
    for (const c of this.cars) c.removePassenger(p);
    super.removePerson(p);
  }

  // Returns the queue for (floor, dir), creating it on demand.
  getQueue(floor, dir) {
    for (const q of this.queues) {
      if (q.floor === floor && q.direction === dir) return q;
    }
    const q = new Queue(this);
    q.floor = floor;
    q.direction = dir;
    q.width = 400;
    this.queues.push(q);
    return q;
  }

  // Removes all queues on floors the elevator no longer connects to. Deleted
  // queues force-advance everyone still waiting (~Queue).
  cleanQueues() {
    const remaining = [];
    for (const q of this.queues) {
      if (this.connectsFloor(q.floor)) remaining.push(q);
      else q.cleanup();
    }
    this.queues = remaining;
  }

  // First person in an empty, uncalled queue calls the elevator.
  called(queue) {
    this.respondToCalls();
  }

  // Dispatch idle cars to the most urgent calls.
  respondToCalls() {
    let q;
    while ((q = this.getMostUrgentQueue())) {
      const car = this.getIdleCar(q.floor);
      if (!car) break;

      q.answered = true;
      car.direction = q.direction;
      car.moveTo(q.floor);
    }
  }

  // Called && !answered && longest-waiting queue.
  getMostUrgentQueue() {
    let queue = null;
    for (const iq of this.queues) {
      if (iq.called && !iq.answered && (!queue || queue.getWaitDuration() < iq.getWaitDuration())) {
        queue = iq;
      }
    }
    return queue;
  }

  // Idle car closest to the given floor, or null.
  getIdleCar(floor) {
    let car = null;
    for (const c of this.cars) {
      if (c.state === 0 /* Car.kIdle */ && (!car || Math.abs(car.altitude - floor) > Math.abs(c.altitude - floor))) {
        car = c;
      }
    }
    return car;
  }

  // Elevator.cpp:476-529 — choose the next stop after the doors close.
  decideCarDestination(car) {
    const INT_MAX = 2147483647;

    // Passenger destination closest to the floor just served.
    let nextFloor = INT_MAX;
    for (const p of car.passengers) {
      const f = p.journey.toFloor;
      if (nextFloor === INT_MAX || Math.abs(car.destinationFloor - nextFloor) > Math.abs(car.destinationFloor - f)) {
        nextFloor = f;
      }
    }

    // Nearest unanswered called queue ahead of the car in its direction.
    let nextQueue = null;
    let queueDistance = 0;
    for (const q of this.queues) {
      if (q.direction !== car.direction) continue;
      if (!q.called || q.answered) continue;

      let distance = q.floor - car.altitude;
      distance *= car.direction;
      if (distance < 0.5) continue;

      if (!nextQueue || queueDistance > distance) {
        queueDistance = distance;
        nextQueue = q;
      }
    }

    // Serve whichever of the two is closer (ties -> queue).
    if (nextQueue && !car.isFull()) {
      const floorDistance = Math.abs(nextFloor - car.altitude);
      if (queueDistance <= floorDistance) {
        nextQueue.answered = true;
        car.moveTo(nextQueue.floor);
        return;
      }
    }
    // Phantom-queue quirk kept: creates the queue just to mark it answered.
    this.getQueue(nextFloor, car.direction).answered = true;
    car.moveTo(nextFloor);
  }

  // ~Elevator clears cars; queues are released without forced journey.next
  // (people were already detached by Item::destroy -> removePerson).
  destroy() {
    this.clearCars();
    super.destroy();
    this.queues.length = 0;
  }
}

// --- Variants (Standard.h / Express.h / Service.h) --------------------------

export class Standard extends Elevator {
  init() {
    this.shaftBitmap = "simtower/elevator/narrow";
    this.carBitmap = "simtower/elevator/standard";
    super.init();
  }
}

export class Express extends Elevator {
  init() {
    this.shaftBitmap = "simtower/elevator/wide";
    this.carBitmap = "simtower/elevator/express";
    super.init();
    this.maxCarAcceleration = 20;
    this.maxCarSpeed = 30;
  }

  // Express.h:27-32 — all basements, and above ground only multiples of 15.
  // Note the short-circuit: basements bypass the unservicedFloors check, so
  // basement stops cannot be disabled (spec §10.8).
  connectsFloor(floor) {
    if (floor < 0) return true;
    else if (floor % 15 !== 0) return false;
    return super.connectsFloor(floor);
  }
}

export class Service extends Elevator {
  init() {
    this.shaftBitmap = "simtower/elevator/narrow";
    this.carBitmap = "simtower/elevator/service";
    super.init();
  }

  // C++ Service does not restrict riders (any person type may ride; spec §5).
}

// Prototype registrations (Factory.cpp order slot — the catalog imports these
// classes; see items/catalog.js).
export function makeElevatorPrototypes() {
  return [
    {
      id: "elevator-express",
      name: "Express Elevator",
      price: 1000000,
      size: { x: 6, y: 1 },
      icon: 5,
      entrance_offset: 0,
      exit_offset: 0,
      make: (g, p) => new Express(g, p),
    },
    {
      id: "elevator-service",
      name: "Service Elevator",
      price: 80000,
      size: { x: 4, y: 1 },
      icon: 5,
      entrance_offset: 0,
      exit_offset: 0,
      make: (g, p) => new Service(g, p),
    },
    {
      id: "elevator-standard",
      name: "Standard Elevator",
      price: 100000,
      size: { x: 4, y: 1 },
      icon: 5,
      entrance_offset: 0,
      exit_offset: 0,
      make: (g, p) => new Standard(g, p),
    },
  ];
}
