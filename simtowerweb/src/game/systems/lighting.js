// Port of OT::Lighting (source/Lighting.h / Lighting.cpp).
// Global time-of-day + weather tint approximating the SimTower CLUT shifts.
// Item::render multiplies each sprite color via lighting.compose().

import { K_BASE_SPEED } from "../../core/time.js";

// Anchor colors by Sky sheet state (Lighting.cpp:28-57 colorForState).
const K_STATE_COLORS = [
  { r: 255, g: 255, b: 255, brightness: 1.0 }, // 0 day — white
  { r: 255, g: 196, b: 140, brightness: 0.96 }, // 1 dawn/dusk — warm orange
  { r: 150, g: 168, b: 220, brightness: 0.55 }, // 2 night — dark blue, dimmed
  { r: 180, g: 198, b: 220, brightness: 0.82 }, // 3 cloudy — cool gray-blue
  { r: 170, g: 192, b: 222, brightness: 0.78 }, // 4 rain frame 0
  { r: 170, g: 192, b: 222, brightness: 0.78 }, // 5 rain frame 1
];

function colorForState(state) {
  return K_STATE_COLORS[state] || K_STATE_COLORS[0];
}

export class Lighting {
  constructor(game) {
    this.game = game;
    this.current = { r: 255, g: 255, b: 255, a: 255 };
    this.currentBrightness = 1.0;
    this.rainIntensity = 0.0;
  }

  // Refresh the cached tint. Called once per frame after sky.advance().
  advance(dt) {
    const sky = this.game.sky;
    const hour = this.game.time.hour;
    const raining = sky.rainyDay && hour >= 7.0 && hour < 17.0;
    const target = raining ? 1.0 : 0.0;
    const dta = this.game.time.dta / K_BASE_SPEED; // game-seconds
    const fade = Math.min(1.0, dta * 5.0);
    this.rainIntensity += (target - this.rainIntensity) * fade;
    if (this.rainIntensity < 1e-3) this.rainIntensity = 0.0;
    if (this.rainIntensity > 0.999) this.rainIntensity = 1.0;

    // Base tint = lerp(colorForState(from), colorForState(to), progress).
    const cFrom = colorForState(sky.from);
    const cTo = colorForState(sky.to);
    let p = sky.progress;
    if (p < 0) p = 0;
    if (p > 1) p = 1;

    const r = cFrom.r * (1.0 - p) + cTo.r * p;
    const g = cFrom.g * (1.0 - p) + cTo.g * p;
    const b = cFrom.b * (1.0 - p) + cTo.b * p;
    this.currentBrightness = cFrom.brightness * (1.0 - p) + cTo.brightness * p;

    // Rain dimming + slight blue push, weighted by rainIntensity.
    const rainDim = 0.85 + 0.15 * (1.0 - this.rainIntensity); // 1.0 -> 0.85
    const rainBlueShift = this.rainIntensity; // 0 -> 1

    let rr = r * rainDim;
    let gg = g * rainDim;
    let bb = b * rainDim;
    bb = bb + (220.0 - bb) * 0.1 * rainBlueShift;

    this.current = {
      r: Math.trunc(Math.max(0.0, Math.min(255.0, rr))),
      g: Math.trunc(Math.max(0.0, Math.min(255.0, gg))),
      b: Math.trunc(Math.max(0.0, Math.min(255.0, bb))),
      a: 255,
    };
  }

  // Current global tint in [0,255] per channel.
  tint() {
    return this.current;
  }

  // Perceived brightness in [0,1] (inspector/debug).
  brightness() {
    return this.currentBrightness;
  }

  // Normalized [0,1] night illumination intensity.
  nightFactor() {
    return Math.max(0.0, Math.min(1.0, (0.95 - this.currentBrightness) / 0.40));
  }

  // Compose a sprite color with the current tint; alpha of `base` is preserved.
  // Integer per-channel multiply ((a*b)/255), mirroring Lighting::multiply.
  compose(base) {
    const c = this.current;
    return {
      r: ((base.r * c.r) / 255) | 0,
      g: ((base.g * c.g) / 255) | 0,
      b: ((base.b * c.b) / 255) | 0,
      a: base.a,
    };
  }
}
