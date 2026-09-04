// Port of OT::Item::Elevator::Car (source/Item/Elevator/Car.h / Car.cpp).
// State machine: kIdle -> kMoving -> kOpeningDoors -> kHauling -> kClosingDoors
// -> kMoving ... with trapezoidal motion (q = 1/3) and per-person mount and
// unmount timings. All durations are sim seconds (dta / kBaseSpeed).

import { K_BASE_SPEED } from "../../core/time.js";

// Car.cpp:9-12
export const K_DOOR_PERIOD = 0.1; // seconds for the door to open/close
export const K_WAIT_TIME = 0.15; // wait before closing doors
export const K_MOUNT_PERIOD = 0.05; // per person boarding
export const K_UNMOUNT_PERIOD = 0.05; // per person exiting

export const K_IDLE = 0;
export const K_MOVING = 1;
export const K_OPENING_DOORS = 2;
export const K_HAULING = 3;
export const K_CLOSING_DOORS = 4;

export class Car {
  constructor(elevator) {
    this.elevator = elevator;
    this.game = elevator.game;
    this.altitude = elevator.position.y; // double, in floors
    this.init();
  }

  init() {
    const carKey = this.elevator.carBitmap;
    this.spriteKey =
      carKey.indexOf("express") !== -1
        ? "simtower/elevator/express"
        : carKey.indexOf("service") !== -1
          ? "simtower/elevator/service"
          : "simtower/elevator/standard";
    this.spriteRect = null; // set by updateSprite
    this.spriteX = 0;
    this.spriteY = 0;

    this.arrivingPlayed = false;
    this.departingPlayed = false;

    this.direction = 0; // Elevator.kNone
    this.startAltitude = this.altitude;
    this.destinationFloor = this.altitude;
    this.homeFloor = Math.trunc(this.altitude);
    this.doorWaitTime = K_WAIT_TIME;
    this.journeyTime = 0;
    this.state = K_IDLE;
    this.passengers = new Set();

    this.updateSprite();
  }

  setAltitude(a) {
    if (this.altitude !== a) {
      this.altitude = a;
      this.reposition();
    }
  }

  // Car.cpp:46-51 — 2/4 px were determined experimentally to center the car.
  reposition() {
    this.spriteX = this.elevator.position.x * 8 + 2;
    this.spriteY = -this.altitude * 36;
  }

  carTextureSize() {
    const bitmaps = this.game.app && this.game.app.bitmaps;
    if (bitmaps && bitmaps.getSize) return bitmaps.getSize(this.spriteKey);
    return null;
  }

  updateSprite() {
    // 5 load frames: 0 empty, 1 <=1 pax, 2 <=3, 3 rest, 4 full.
    let index = 3;
    const pc = this.passengers.size;
    if (pc === 0) index = 0;
    else if (pc <= 1) index = 1;
    else if (pc <= 3) index = 2;
    else if (pc === this.elevator.maxCarCapacity) index = 4;

    const tex = this.carTextureSize();
    const w = tex ? Math.floor(tex.x / 5) : this.elevator.size.x * 8; // 32/48 px sheets
    const h = tex ? tex.y : 36;
    this.spriteRect = { x: index * w, y: 0, w, h };
    this.reposition();
  }

  encodeXML(xml) {
    xml.PushAttribute("altitude", this.altitude);
    xml.PushAttribute("homeFloor", this.homeFloor);
    xml.PushAttribute("doorWaitTime", this.doorWaitTime || K_WAIT_TIME);
  }

  decodeXML(el) {
    this.setAltitude(parseFloat(el.attrs.altitude));
    this.startAltitude = this.altitude;
    this.destinationFloor = this.altitude;
    this.homeFloor =
      el.attrs.homeFloor !== undefined ? parseInt(el.attrs.homeFloor, 10) : Math.trunc(this.altitude);
    this.doorWaitTime =
      el.attrs.doorWaitTime !== undefined ? parseFloat(el.attrs.doorWaitTime) : K_WAIT_TIME;
    this.updateSprite();
  }

  setState(s) {
    if (this.state !== s) {
      this.state = s;
      this.journeyTime = 0;
      if (s === K_IDLE) {
        this.direction = 0; // kNone
        this.elevator.respondToCalls();
      }
    }
  }

  advance(dt) {
    const passengersBefore = this.passengers.size;

    // Advance the journey time in sim seconds.
    this.journeyTime += this.game.time.dta / K_BASE_SPEED;

    if (Math.abs(this.destinationFloor - this.altitude) > 0.01) {
      // --- Moving: trapezoidal motion profile (Car.cpp:173-277) ---
      const a = this.elevator.maxCarAcceleration;
      const vmax = this.elevator.maxCarSpeed;
      const s = Math.abs(this.destinationFloor - this.startAltitude);

      const q = 1.0 / 3;
      const v = Math.min(vmax, Math.sqrt(2 * q * a * s));

      const t0 = v / (2 * a);
      const t1 = s / v + 2 * t0;
      const tacc = v / a;
      const tdec = t1 - tacc;

      let phase = 0;
      if (this.journeyTime > tacc) phase = 1;
      if (this.journeyTime > tdec) phase = 2;

      const t = this.journeyTime;
      let d;
      if (phase === 0) d = 0.5 * a * t * t;
      else if (phase === 1) d = v * (t - t0);
      else d = s - 0.5 * a * (t1 - t) * (t1 - t);

      if (this.destinationFloor > this.startAltitude) this.setAltitude(this.startAltitude + d);
      else this.setAltitude(this.startAltitude - d);

      // Safety: stop animating at t1 no matter what.
      if (this.journeyTime > t1) this.setAltitude(this.destinationFloor);

      // Departing sound only for long travels (t1 >= 1 s).
      if (!this.departingPlayed) {
        if (t1 >= 1) this.game.playOnce("simtower/elevator/departing");
        this.departingPlayed = true;
      }

      // Arriving sound within 0.1 floors of the destination.
      if (!this.arrivingPlayed && s - d < 0.1) {
        this.game.playOnce("simtower/elevator/arriving");
        this.arrivingPlayed = true;
      }
    } else {
      // --- At the destination floor: run the door/boarding state machine ---
      this.setAltitude(this.destinationFloor);

      switch (this.state) {
        case K_MOVING: {
          if (this.direction !== 0) this.setState(K_OPENING_DOORS);
          else this.setState(K_IDLE);
          break;
        }

        case K_OPENING_DOORS: {
          if (this.journeyTime >= K_DOOR_PERIOD) this.setState(K_HAULING);
          break;
        }

        case K_HAULING: {
          // One action per frame, in order: unmount, mount, finish.
          let handled = false;

          // The queue we're serving on this floor/direction.
          const q = this.elevator.getQueue(this.destinationFloor, this.direction);

          // Unmount: everyone whose destination is this floor, 0.05 s each.
          if (!handled && this.nextPassengerToUnmount()) {
            let p;
            while (this.journeyTime >= K_UNMOUNT_PERIOD && (p = this.nextPassengerToUnmount())) {
              this.journeyTime -= K_UNMOUNT_PERIOD;
              this.passengers.delete(p);
              p.journey.next();
            }
            handled = true;
          }

          // Mount: pop the queue while there is room, 0.05 s each.
          if (!handled && !this.isFull() && q && q.people.length > 0) {
            q.steppingInside = true;
            while (this.journeyTime >= K_MOUNT_PERIOD && !this.isFull()) {
              const p = q.popPerson();
              if (!p) break;
              this.journeyTime -= K_MOUNT_PERIOD;
              this.passengers.add(p);
            }
            handled = true;
          }

          // Finish: stop after the wait time or when full (a full car with
          // exiting passengers still ends immediately — C++ quirk kept).
          const waitLimit = this.doorWaitTime || K_WAIT_TIME;
          if (!handled && (this.journeyTime >= waitLimit || this.isFull())) {
            if (q) {
              q.steppingInside = false;
              q.called = false;
            }
            q.answered = false;
            if (this.passengers.size > 0) this.setState(K_CLOSING_DOORS);
            else this.setState(K_IDLE);
          }
          break;
        }

        case K_IDLE: {
          // Return home after 5 s away from the home floor.
          if (Math.abs(this.altitude - this.homeFloor) > 0.01) {
            if (this.journeyTime >= 5.0) this.moveTo(this.homeFloor);
          }
          break;
        }

        case K_CLOSING_DOORS: {
          if (this.journeyTime >= K_DOOR_PERIOD) {
            this.elevator.decideCarDestination(this);
          }
          break;
        }
      }
    }

    if (passengersBefore !== this.passengers.size) this.updateSprite();
  }

  isFull() {
    return this.passengers.size >= this.elevator.maxCarCapacity;
  }

  nextPassengerToUnmount() {
    for (const p of this.passengers) {
      if (p.journey.toFloor === this.destinationFloor) return p;
    }
    return null;
  }

  moveTo(floor) {
    if (this.destinationFloor !== floor) {
      this.destinationFloor = floor;
      this.arrivingPlayed = false;
      this.departingPlayed = false;
      this.startAltitude = this.altitude;
      this.setState(K_MOVING);
    } else {
      // Same floor: open doors immediately without kOpeningDoors timing.
      this.setState(K_HAULING);
    }
  }

  removePassenger(p) {
    this.passengers.delete(p);
  }

  // Car.cpp:73-132
  render(draw) {
    const game = this.game;
    let statusTint = null;
    if (game.statusMode === 3) statusTint = { r: 110, g: 110, b: 110, a: 160 };
    const tint = game.lighting.tint();
    const tinted =
      statusTint !== null ||
      tint.r !== 255 || tint.g !== 255 || tint.b !== 255 || tint.a !== 255;

    let color = null;
    if (tinted) {
      color = { r: 255, g: 255, b: 255, a: 255 };
      color = game.lighting.compose(color);
      if (statusTint) {
        color = {
          r: Math.trunc((color.r * statusTint.r) / 255),
          g: Math.trunc((color.g * statusTint.g) / 255),
          b: Math.trunc((color.b * statusTint.b) / 255),
          a: Math.trunc((color.a * statusTint.a) / 255),
        };
      }
    }

    draw.image(this.spriteKey, this.spriteRect, this.spriteX, this.spriteY, {
      origin: { x: 0, y: 30 },
      tint: color,
    });
    game.drawnSprites++;

    // Draw the person stepping out of the car (row y=24 of the queue sheet).
    const p = this.state === K_HAULING ? this.nextPassengerToUnmount() : null;
    if (p) {
      const sr = { x: p.type * 32, y: 24, w: p.getWidth(), h: 24 };
      if (this.direction > 0) sr.x += 16;

      let bodyColor = { r: 0, g: 0, b: 0, a: 255 };
      if (statusTint) {
        bodyColor = {
          r: Math.trunc((bodyColor.r * statusTint.r) / 255),
          g: Math.trunc((bodyColor.g * statusTint.g) / 255),
          b: Math.trunc((bodyColor.b * statusTint.b) / 255),
          a: Math.trunc((bodyColor.a * statusTint.a) / 255),
        };
      }

      const shaftWidthPx = this.elevator.size.x * 8;
      draw.image("simtower/elevator/people", sr, this.elevator.position.x * 8, this.spriteY, {
        origin: { x: this.direction > 0 ? -shaftWidthPx : 16, y: 24 },
        tint: bodyColor,
      });
      game.drawnSprites++;
    }
  }
}
