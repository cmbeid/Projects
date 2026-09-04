// Port of OT::Time (source/Time.h / Time.cpp).
// Absolute time is a double: integer part = day count, fraction = time of day.
// Hour mapping is the SimTower TDT 2600-frame non-linear day (noon = 30.8% of day).

export const K_BASE_SPEED = 1 / 60 / 3.2; // = 1/192 game-days per real second
const K_SPEED_RAMP_TAU = 0.25;

export function absoluteToHour(a) {
  // C++ special case: 1.0 means exactly 24:00 (end of day), not 0:00 of the next
  if (a === 1.0) return 24.0;
  const stage = ((a * 2600) % 2600 + 2600) % 2600;
  let hour;
  if (stage < 100) hour = 0 + ((stage - 0) / 100) * 1; // 00:00-01:00
  else if (stage < 300) hour = 1 + ((stage - 100) / 200) * 6; // 01:00-07:00
  else if (stage < 700) hour = 7 + ((stage - 300) / 400) * 5; // 07:00-12:00
  else if (stage < 1500) hour = 12 + ((stage - 700) / 800) * 1; // 12:00-13:00
  else hour = 13 + ((stage - 1500) / 1100) * 11; // 13:00-24:00
  return hour;
}

export function hourToAbsolute(h) {
  let stage;
  if (h < 1) stage = (h / 1) * 100 + 0;
  else if (h < 7) stage = ((h - 1) / 6) * 200 + 100;
  else if (h < 12) stage = ((h - 7) / 5) * 400 + 300;
  else if (h < 13) stage = ((h - 12) / 1) * 800 + 700;
  else if (h < 24) stage = ((h - 13) / 11) * 1100 + 1500;
  else stage = 2600;
  return stage / 2600;
}

export class Time {
  constructor() {
    this.absolute = 0;
    this.dta = 0;
    this.hour = 0;
    this.day = 0;
    this.quarter = 1;
    this.year = 1;
    this.prev_absolute = 0;
    this.prev_hour = 0;
    this.prev_day = 0;
    this.prev_quarter = 1;
    this.prev_year = 1;
    this.speed = 1;
    this.speed_animated = 1;
  }

  set(a) {
    if (this.absolute !== a) {
      this.prev_absolute = this.absolute;
      this.prev_hour = this.hour;
      this.prev_day = this.day;
      this.prev_quarter = this.quarter;
      this.prev_year = this.year;
      this.absolute = a;
      this.dta = this.absolute - this.prev_absolute;
      this.hour = absoluteToHour(this.absolute);
      this.day = Math.floor(a) % 3;
      this.quarter = (Math.floor(a / 3) % 4) + 1;
      this.year = Math.floor(a / 3 / 4) + 1;
    } else {
      this.dta = 0;
    }
  }

  advance(dt) {
    if (this.speed_animated !== this.speed) {
      if (this.speed < 1) {
        this.speed_animated = this.speed; // pause is instant
      } else {
        const alpha = 1.0 - Math.exp(-dt / K_SPEED_RAMP_TAU);
        this.speed_animated += (this.speed - this.speed_animated) * alpha;
        if (Math.abs(this.speed_animated - this.speed) < 1e-2) this.speed_animated = this.speed;
      }
    }
    this.set(this.absolute + dt * K_BASE_SPEED * this.speed_animated);
  }

  // passed an absolute-time point this frame
  check(a) {
    return this.prev_absolute < a && this.absolute >= a;
  }

  // crossed a k/p boundary (e.g. checkTick(0.002) = random-event tick)
  checkTick(p) {
    return Math.floor(this.prev_absolute / p) !== Math.floor(this.absolute / p);
  }

  // passed wall-clock hour h this frame (hour space — robust vs nonlinear mapping)
  checkHour(h) {
    return this.prev_hour < h && this.hour >= h;
  }

  getHour() {
    return absoluteToHour(this.absolute);
  }
}
