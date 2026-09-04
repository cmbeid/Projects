// Port of OT::Sky (source/Sky.h / Sky.cpp).
// Sky color state machine, rain/weather roll, thunder overlay, ambient sound
// scheduler and the sky-strip / cloud / skyline background rendering.

import { K_BASE_SPEED } from "../../core/time.js";
import { rand, randd } from "../../core/rand.js";

// Render-space view bounds (y DOWN, like the SFML view). Mirrors the camera
// math in Game::advance: view = poi ± (winSize * 0.5 * zoom), centered at
// (poi.x, -poi.y). If the draw list exposes its own view, prefer that.
export function viewBounds(game, draw) {
  if (draw && draw.view && draw.view.min && draw.view.max) {
    return { dmin: draw.view.min, dmax: draw.view.max };
  }
  const width = game.app?.window?.width ?? 1280;
  const height = game.app?.window?.height ?? 768;
  const halfW = width * 0.5 * game.zoom;
  const halfH = height * 0.5 * game.zoom;
  return {
    dmin: { x: game.poi.x - halfW, y: -game.poi.y - halfH },
    dmax: { x: game.poi.x + halfW, y: -game.poi.y + halfH },
  };
}

// Deterministic 32-bit int hash (Sky.cpp:267-273). Must use Math.imul to
// reproduce C++ int overflow semantics.
export function cloudNoise(px, py) {
  let n = (px | 0) + Math.imul(py | 0, 57);
  n = (n << 13) ^ n;
  const nn =
    (Math.imul(n, Math.imul(Math.imul(n, n), 60493) + 19990303) + 1376312589) | 0;
  const masked = nn & 0x7fffffff;
  return 1.0 - masked / 1073741824.0; // range ~[-1, 1]
}

export class Sky {
  constructor(game) {
    this.game = game;
    this.from = 0;
    this.to = 0;
    this.progress = 0;
    this.rainyDay = false;
    this.rainAnimation = 0;
    this.thunderOverlay = 0;
    this.soundCountdown = 0;
    this.santa = { active: false, x: 0, y: -300, speed: 120 };
    this.santaYearVisited = -1;
    this.fireworks = [];
  }

  triggerSantaFlyby() {
    this.santa.active = true;
    this.santa.x = 800;
    this.santa.y = -300;
    this.game.playOnce("simtower/santa");
    this.game.ui?.showMessage?.("🎅 Ho ho ho! Merry Christmas from Santa Claus!");
  }

  spawnFireworks(count = 6) {
    for (let i = 0; i < count; i++) {
      this.fireworks.push({
        x: randd(-200, 400),
        y: randd(-350, -150),
        color: [
          { r: 255, g: 60, b: 60, a: 255 },
          { r: 255, g: 220, b: 50, a: 255 },
          { r: 60, g: 160, b: 255, a: 255 },
          { r: 80, g: 230, b: 80, a: 255 },
          { r: 230, g: 80, b: 230, a: 255 },
        ][rand() % 5],
        radius: 0,
        maxRadius: randd(25, 60),
        particles: Array.from({ length: 16 }, (_, idx) => {
          const angle = (idx / 16) * Math.PI * 2;
          return {
            dx: Math.cos(angle) * randd(20, 45),
            dy: Math.sin(angle) * randd(20, 45),
          };
        }),
        age: 0,
        maxAge: randd(1.5, 3.0),
      });
    }
  }

  advance(dt) {
    const game = this.game;

    // Decide whether we're about to have a rainy day (roll at exactly 05:00).
    if (game.time.checkHour(5)) {
      this.rainyDay = rand() % 3 === 0; // statistically every 3rd day
      this.rainAnimation = 0;
      game.ui.showMessage(
        this.rainyDay
          ? "I've heard we're in for some bad weather..."
          : "Weather's going to be good today!",
      );
    }

    // Decide what sky color to use based on the current time of day.
    const time = game.time.hour;
    const dta = dt > 0 ? dt * (game.time.speed_animated || 1.0) : game.time.dta / K_BASE_SPEED; // game-seconds this frame

    if (time < 5 || time >= 19) {
      // Night
      this.from = this.to = 2;
      this.progress = 0;
    } else if (time >= 5 && time < 6) {
      // Dawn 1
      this.from = 2;
      this.to = 1;
      this.progress = time - 5;
    } else if (time >= 6 && time < 7) {
      // Dawn 2
      this.from = 1;
      this.to = 0;
      this.progress = time - 6;
    } else if (time >= 17 && time < 18) {
      // Dusk 1
      this.from = 0;
      this.to = 1;
      this.progress = time - 17;
    } else if (time >= 18 && time < 19) {
      // Dusk 2
      this.from = 1;
      this.to = 2;
      this.progress = time - 18;
    } else if (!this.rainyDay) {
      // Day
      this.from = this.to = 0;
      this.progress = 0;
    } else if (time >= 7 && time < 8) {
      // Rain onset
      this.from = 0;
      this.to = 3;
      this.progress = time - 7;
    } else if (time >= 16 && time < 17) {
      // Rain clearing
      this.from = 3;
      this.to = 0;
      this.progress = time - 16;
    } else {
      // Rain animation frames (alternate each game-second).
      this.rainAnimation += dta;
      this.from = this.to = 4 + Math.floor((this.rainAnimation % 1) * 2);
      this.progress = 0;
    }

    // Rain loop sound: start 08:00, stop 16:00 (only on rainy days).
    if (this.rainyDay) {
      if (game.time.checkHour(8)) game.app?.sound?.play?.("simtower/rain");
      if (game.time.checkHour(16)) game.app?.sound?.stop?.("simtower/rain");
    }
    game.app?.sound?.setLooping?.("simtower/rain", this.rainyDay && time >= 8 && time < 16);

    // Thunder overlay decay.
    if (this.thunderOverlay > 0) {
      this.thunderOverlay *= Math.exp(-dta * 7);
      if (this.thunderOverlay < 1e-3) this.thunderOverlay = 0;
    }

    // Ambient sound scheduler (Sky.cpp:121-143).
    // Drained in *real* seconds, not game-seconds. dta is dt scaled by game
    // speed, so subtracting it made the gap shrink with the speed setting:
    // ambience fired every ~30s at 1x but every ~8s at 4x, which during rain
    // (when the cue is thunder, and in the community edition a synthesized
    // noise burst) read as one sound repeating on a loop. Gated on the game
    // actually running so a paused tower stays silent.
    this.soundCountdown -= game.time.speed_animated > 0 ? dt : 0;
    if (this.soundCountdown < 0) {
      let duration = 0;
      const sound = (path) => {
        game.app?.sound?.play?.(path);
        return game.app?.sound?.getDuration?.(path) || 0;
      };
      if (this.rainyDay && time >= 8 && time < 16) {
        duration = sound("simtower/thunder");
        this.thunderOverlay = 1;
      } else if (time >= 8 && time < 17) {
        duration = sound("simtower/birds/day");
      } else if (time >= 20 || time < 1.5) {
        duration = sound("simtower/crickets");
      }
      // Gap between ambient chirps/crickets/thunder, in real seconds. The
      // original +0.5/+10 range averaged out to a chirp every ~6 seconds
      // through the whole 8am-5pm window — constant enough that players heard
      // it as background noise that never stopped. Widened so it reads as
      // occasional ambience, and now genuinely speed-independent.
      this.soundCountdown += randd(duration + 20, duration + 60);
    }

    // --- Seasonal Event: Santa Claus Christmas Night Flyby (Quarter 4, Day 2 / Holiday night, once per year)
    if (
      game.time.quarter === 4 &&
      game.time.day === 2 &&
      time >= 21.0 &&
      this.santaYearVisited !== game.time.year
    ) {
      if (!this.santa.active) {
        this.santaYearVisited = game.time.year;
        this.triggerSantaFlyby();
      }
    }

    if (this.santa.active) {
      this.santa.x -= this.santa.speed * dta;
      if (this.santa.x < -800) {
        this.santa.active = false;
        // Holiday gift to tower funds + stress relief for residential condos
        game.transferFunds(25000, "holiday_gift", "Santa Claus Christmas Eve Gift");
        for (const p of game.people || []) {
          p.addStress(-15.0);
        }
      }
    }

    // --- Seasonal Event: New Year Fireworks Celebration
    if (game.time.quarter === 1 && game.time.prev_quarter === 4 && game.time.checkHour(0)) {
      this.spawnFireworks(8);
      game.ui?.showMessage?.("🎆 Happy New Year! Tower celebration fireworks!");
    }

    // Update active fireworks
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      fw.age += dt;
      fw.radius = (fw.age / fw.maxAge) * fw.maxRadius;
      if (fw.age >= fw.maxAge) {
        this.fireworks.splice(i, 1);
      }
    }
  }

  render(draw) {
    const game = this.game;
    const { dmin, dmax } = viewBounds(game, draw);

    // --- Sky strips: 32x360 cells, 6 per row x 10 rows of "simtower/sky".
    const skyLower = Math.max(Math.floor(-dmax.y / 360), -1);
    const skyUpper = Math.min(Math.ceil(-dmin.y / 360), 11);
    for (let y = skyLower; y <= skyUpper; y++) {
      for (let i = 0; i < 2; i++) {
        if ((i === 0 && this.progress === 1) || (i === 1 && this.progress === 0)) continue;

        const state = i === 0 ? this.from : this.to;
        const index = Math.min(y + 1, 9) * 6 + state;
        const alpha = Math.trunc(255 * (i === 0 ? 1.0 : this.progress));
        const tint = { r: 255, g: 255, b: 255, a: alpha };

        for (let x = Math.floor(dmin.x / 32); x < Math.ceil(dmax.x / 32); x++) {
          draw.image(
            "simtower/sky",
            { x: index * 32, y: 0, w: 32, h: 360 },
            x * 32,
            -y * 360,
            { origin: { x: 0, y: 360 }, tint },
          );
          game.drawnSprites++;
        }
      }
    }

    // --- Santa Claus Flyby: authentic SimTower sprite
    if (this.santa.active) {
      const sx = this.santa.x;
      const sy = this.santa.y + Math.sin(this.santa.x * 0.02) * 10;
      draw.image(
        "simtower/deco/santa",
        { x: 0, y: 0, w: 140, h: 48 },
        sx,
        sy,
        { origin: { x: 70, y: 24 } },
      );
      game.drawnSprites++;
    }

    // --- Fireworks particle bursts
    for (const fw of this.fireworks) {
      const alpha = Math.max(0, 1.0 - fw.age / fw.maxAge);
      const c = { ...fw.color, a: Math.floor(alpha * 255) };
      for (const p of fw.particles) {
        const px = fw.x + p.dx * (fw.radius / fw.maxRadius);
        const py = fw.y + p.dy * (fw.radius / fw.maxRadius) + fw.age * 10; // gravity
        draw.rect(px - 1, py - 1, 3, 3, { fill: c });
      }
      game.drawnSprites += fw.particles.length;
    }

    // --- Clouds: 250x100 grid, only rows >= 2 (>= 200px above ground).
    const gridX = 250;
    const gridY = 100;
    const cmin = {
      x: Math.floor(dmin.x / gridX) - 1,
      y: Math.floor(-dmax.y / gridY) - 1,
    };
    const cmax = {
      x: Math.ceil(dmax.x / gridX),
      y: Math.ceil(-dmin.y / gridY),
    };

    for (let gy = Math.max(2, cmin.y); gy <= cmax.y; gy++) {
      for (let gx = cmin.x; gx <= cmax.x; gx++) {
        const offX = cloudNoise(gx, gy);
        const offY = cloudNoise(gx + 100, gy + 100);
        const variant = Math.trunc(cloudNoise(gx + 200, gy + 200) * 10);
        const position = { x: gx * gridX, y: -gy * gridY };
        position.x += offX * 100;
        position.y += offY * 50;

        const key = "simtower/deco/cloud/" + (Math.abs(variant) % 4);
        const size = game.app.bitmaps?.getSize?.(key) || { x: 96, y: 164 };
        const w = size.x;
        const h = Math.trunc(size.y / 4); // 4 weather rows

        for (let i = 0; i < 2; i++) {
          if ((i === 0 && this.progress === 1) || (i === 1 && this.progress === 0)) continue;
          const state = Math.min(3, i === 0 ? this.from : this.to);
          const alpha = Math.trunc(255 * (i === 0 ? 1.0 : this.progress));
          draw.image(
            key,
            { x: 0, y: state * h, w, h },
            position.x,
            position.y,
            { origin: { x: w / 2, y: h / 2 }, tint: { r: 255, g: 255, b: 255, a: alpha } },
          );
          game.drawnSprites++;
        }
      }
    }

    // --- Thunder overlay: white quad over the region y <= 0 (render space).
    if (this.thunderOverlay > 0) {
      const miny = Math.min(dmin.y, 0);
      const maxy = Math.min(dmax.y, 0);
      draw.rect(dmin.x, miny, dmax.x - dmin.x, maxy - miny, {
        fill: { r: 255, g: 255, b: 255, a: Math.trunc(255 * this.thunderOverlay) },
      });
      game.drawnSprites++;
    }

    // --- Skyline, if in view near the ground.
    if (-dmax.y <= 96 && -dmin.y >= 0) {
      const tint = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
      for (let x = Math.floor(dmin.x / 96); x < Math.ceil(dmax.x / 96); x++) {
        draw.image("simtower/deco/skyline", null, x * 96, 0, { origin: { x: 0, y: 55 }, tint });
        game.drawnSprites++;
      }
    }
  }
}
