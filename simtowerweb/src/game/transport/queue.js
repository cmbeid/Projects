// Port of OT::Item::Elevator::Queue (source/Item/Elevator/Queue.h / Queue.cpp).
// One queue per (shaft, floor, direction). People wait in FIFO order, gain
// stress (full 0->1 in 30 sim-seconds) and give up at stress >= 1.0 by
// skipping the elevator leg (journey.next()). Destruction force-advances
// everyone still waiting.

import { K_BASE_SPEED } from "../../core/time.js";

// Queue.cpp:13 — seconds (at 1x) to stress a person from zero to the 1.0
// give-up threshold.
const K_SECONDS_UNTIL_STRESSED = 30;

export class Queue {
  constructor(elevator) {
    this.elevator = elevator;
    this.game = elevator.game;
    this.floor = 0;
    this.direction = 0; // Elevator.kUp / kDown
    this.width = 400;

    this.called = false;
    this.callTime = 0;
    this.answered = false;
    this.steppingInside = false;

    this.people = []; // FIFO list (std::list<Person*>)
  }

  // Queue destructor: everyone still waiting is forced ahead ("teleport"
  // past the elevator leg — C++ ~Queue, Queue.cpp:25-32).
  cleanup() {
    for (const p of [...this.people]) {
      p.journey.next();
    }
    this.people.length = 0;
  }

  getWaitDuration() {
    return this.game.time.absolute - this.callTime;
  }

  addPerson(p) {
    this.people.push(p);
    if (!this.called) this.callElevator();
  }

  removePerson(p) {
    const i = this.people.indexOf(p);
    if (i >= 0) this.people.splice(i, 1);
  }

  popPerson() {
    return this.people.length > 0 ? this.people.shift() : null;
  }

  callElevator() {
    if (!this.called) {
      this.called = true;
      this.callTime = this.game.time.absolute;
      this.elevator.called(this);
    }
  }

  advance(dt) {
    const dta = this.game.time.dta;
    if (this.people.length > 0 && !this.called) this.callElevator();

    for (const p of [...this.people]) {
      p.addStress((1.0 / K_SECONDS_UNTIL_STRESSED / K_BASE_SPEED) * dta);
      if (p.stress >= 1.0) p.journey.next();
    }
  }

  // Queue.cpp:90-166 — the waiting-line strip beside the shaft.
  render(draw) {
    const game = this.game;
    let x = 16; // start the queue 16 px away from the elevator

    let statusTint = null;
    if (game.statusMode === 3) statusTint = { r: 110, g: 110, b: 110, a: 160 };
    const tint = game.lighting.tint();
    const tinted =
      statusTint !== null ||
      tint.r !== 255 || tint.g !== 255 || tint.b !== 255 || tint.a !== 255;

    for (const p of this.people) {
      // The frontmost person switches to the "stepping in" frames while the
      // car is boarding.
      const stepping = this.steppingInside && this.people[0] === p;
      if (stepping) x -= 16;

      // Texture subrect: sheet is 9 types x 2 facings x 3 rows of 24 px.
      const sr = {
        x: p.type * 32 + (this.direction < 0 ? 16 : 0),
        y: stepping ? 48 : 0,
        w: p.getWidth(),
        h: 24,
      };

      // Up-queues form to the left of the shaft, down-queues to the right.
      const posY = -(this.floor * 36);
      const posX =
        (this.direction > 0 ? -x : this.elevator.size.x * 8 + x) +
        this.elevator.getPositionPixels().x;

      // Stress colors (0-1 scale thresholds — kept inconsistent with the
      // 0-100 scale used inside tenant items, 1:1 with the C++).
      let color = { r: 0, g: 0, b: 0, a: 255 };
      if (p.stress > 0.8) color = { r: 255, g: 0, b: 0, a: 255 };
      else if (p.stress > 0.4) color = { r: 255, g: 128, b: 128, a: 255 };
      if (tinted) {
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

      draw.image("simtower/elevator/people", sr, posX, posY, { origin: { x: 0, y: 24 }, tint: color });
      game.drawnSprites++;

      x += stepping ? 16 : p.getWidth();
      if (x >= this.width) break; // 400 px render cap
    }
  }
}
