// OpenSkyScraper edition media loader (RENDER agent).
//
// Composes the openly licensed OpenSkyscraper community art pack (vendored at
// /assets/opensky, GPLv2 — see public/assets/opensky/LICENSE.txt) into the same
// composed-sheet registry keys that simtower-dumper.js builds from
// SIMTOWER.EXE. loadOpenSkyMedia() mirrors loadSimTowerMedia()'s contract:
//   { bitmaps: {key -> canvas}, soundUrls: {}, dispose() }.
//
// Layout contract: every composed sheet below matches the geometry its game
// consumers slice (see items/*.js, transport/*.js, systems/sky.js):
//   office           144x168  cells 72x24 (col0 lit / col1 unlit; rows 0-5 tenants, 6 vacant)
//   condo            640x72   cells 128x24 (rows 0-2 tiers; col0 day,1 lit,2 night,3 empty-day,4 empty-night)
//   single           288x48   cells 32x24 (col0 clean,1 cleaning,2 resting,3 occupied; row1 = dirty)
//   double           432x96   cells 48x24 (rows = subvariant*2 + clean/dirty)
//   suite            720x48   cells 56x24
//   fastfood         512x120  cells 128x24 (col0 empty,1 light,2 busy,3 closed; rows = vendors)
//   restaurant       768x96   cells 192x24 (same column states)
//   partyhall        576x60   cells 192x60 (col0 day,1 warm,2 night)
//   recycling        200x60   security 128x24   medicalcenter 256x24   housekeeping 120x24
//   lobby/normal|sky 312x108  36px rows = rating tiers 0..2
//   lobby/high       312x324  108px rows = rating tiers 0..2
//   stairs           896x60   14 frames of 64 (0 empty, 1-6 up, 7-13 down)
//   escalator        512x72   8 frames of 64; spiral_2 704x72 / spiral_3 704x108, 11 frames of 64
//   elevator/narrow  224x36   7 cells of 32 (0 shaft, 1-6 motor pairs, 3 anim frames)
//   elevator/wide    336x36   7 cells of 48
//   elevator/cars    5 load frames (0 empty..4 full), 28x30 / 44x30 (express)
//   elevator/digits  132x34   12x2 glyphs of 11x17 (0-9,B; row0 lit, row1 dim)
//   people           96x24    6 walk frames of 16x24 (row 0 is the only row consumers draw)
//   sky              2112x360 columns 32x360: index = band(0-10)*6 + state(0-5);
//                             states 0 day, 1 twilight, 2 night, 3-5 rain variants
//   ui/toolbox/items 832x96   row 0, 25 cells of 32 (TOOLBOX_ICON_INDEX order)
//   ui/toolbox/tools 192x21   3 cells of 21 at stride 24 (bulldozer, finger, inspect)
//
// The module is import-safe headlessly (no top-level DOM); the procedural
// painters are pure Surface functions covered by tests/opensky-media.test.js.
// Room/transport composition runs on 1x Surfaces (OpenSkyscraper art is 2x and
// is halved once at load) so composeAll() is pure and testable too.

import { Surface } from "./simtower-dumper.js";

// Document-relative, so the same files resolve under an origin root, an S3
// prefix and a Pages subdirectory alike. Guarded because this module is
// import-safe headlessly (tests/opensky-media.test.js) where there is no
// document; the bare path is only ever used by code that never fetches.
export const OPENSKY_ART_BASE =
  typeof document !== "undefined"
    ? new URL("assets/opensky", document.baseURI).href
    : "assets/opensky";

// Logical name -> vendored file (sanitized by scripts/sync-opensky-art.sh).
export const OPENSKY_SOURCES = Object.freeze({
  // Commercial
  "ff-burgers": "Commercial/mm_fastfood-burgers-night.png",
  "ff-chinese": "Commercial/mm_fastfood-chinese-night.png",
  "ff-coffee": "Commercial/mm_fastfood-coffee_shop-night.png",
  "ff-pizza": "Commercial/mm_fastfood-pizza-night.png",
  "ff-sushi": "Commercial/mm_fastfood-sushi-night.png",
  "rest-french": "Commercial/mm_restaurant-french-night.png",
  "rest-hibachi": "Commercial/mm_restaurant-hibachi-night.png",
  "rest-indian": "Commercial/mm_restaurant-indian-night.png",
  "rest-pub": "Commercial/mm_restaurant-pub-night.png",
  "shop-closed": "Commercial/mm_shop-closed.png",
  // Condo
  ...Object.fromEntries(
    [1, 2, 3].flatMap((t) => [
      [`condo-empty${t}-day`, `Condo/condo-empty${t}-day-0.png`],
      [`condo-empty${t}-night`, `Condo/condo-empty${t}-night-0.png`],
      [`condo-occ${t}`, `Condo/condo-occupied${t}a-day-0.png`],
    ]),
  ),
  // Facility
  "floor-tile": "Facility/floor.png",
  clinic: "Facility/medicalclinic_u.png",
  recycle: "Facility/mm_recycle-empty.png",
  "party-day": "Facility/partyhall-0-day-0.png",
  "party-night": "Facility/partyhall-0-night-0.png",
  security: "Facility/security_u.png",
  "fire-escape": "Facility/fire_escape_r.png",
  // Hotel
  "single-day-1": "Hotel/mm_hotel-single-day-1.png",
  "single-day-2": "Hotel/mm_hotel-single-day-2.png",
  "single-night-1": "Hotel/mm_hotel-single-night-1.png",
  "single-night-2": "Hotel/mm_hotel-single-night-2.png",
  "double-day": "Hotel/mm_hotel-double-day.png",
  "double-day-1": "Hotel/mm_hotel-double-day-1.png",
  "double-day-2": "Hotel/mm_hotel-double-day-2.png",
  "double-night": "Hotel/mm_hotel-double-night.png",
  "double-night-1": "Hotel/mm_hotel-double-night-1.png",
  "double-night-2": "Hotel/mm_hotel-double-night-2.png",
  "suite-day": "Hotel/hotelsuite-day-0.png",
  "suite-day-2": "Hotel/hotel-suite-day-0.png",
  "suite-night-1": "Hotel/mm_hotel-suite-night-1.png",
  "suite-night-2": "Hotel/mm_hotel-suite-night-2.png",
  "housekeeping-day": "Hotel/mm_housekeeping_day_0.png",
  // Lobbies
  "grandlobby-1": "Lobbies/mm_grandlobby-1star.png",
  "grandlobby-2": "Lobbies/mm_grandlobby-2star.png",
  "mezz-3": "Lobbies/mm_lobbyandmezz-3star.png",
  "mezz-4": "Lobbies/mm_lobbyandmezz-4star.png",
  "mezz-5": "Lobbies/mm_lobbyandmezz-5star.png",
  "skylobby-1": "Lobbies/mm_skylobby-1star.png",
  "skylobby-2": "Lobbies/mm_skylobby-2star.png",
  "skylobby-3": "Lobbies/mm_skylobby-3star.png",
  awning: "Lobbies/mm_awning-blue.png",
  // Office
  ...Object.fromEntries(
    [
      "office_t0_0_0", "office_t0_1_0", "office_t0_5_0", "office_t1_2_0",
      "office_t1_7_0", "office_t2_3_0", "office_t2_4_0",
    ].map((n) => [n, `Office/${n}.png`]),
  ),
  // Transport
  "elev-express": "Transport/mm_elevator-express.png",
  "elev-local": "Transport/mm_elevator-local.png",
  "elev-service": "Transport/mm_elevator-service.png",
  "stairs-1": "Transport/mm_stairs_1story.png",
  "stairs-2": "Transport/ot-stairs-2-v2.png",
  "stairs-3": "Transport/ot-stairs-3-v2.png",
  escalator: "Transport/mm_escalator.png",
  parking: "Transport/ot-parking.png",
  ramp: "Transport/opentowerparkingramp2.png",
  // YootCondo (HrD art)
  "hrd-empty": "Condo/hrd_condo-0-day-0.png",
  "hrd-occ": "Condo/hrd_condo-occupied1-day-0.png",
  // UI icons (toolbox; halved 48 -> 32)
  "icon-lobby": "UI/icon-lobby.png",
  "icon-floor": "UI/icon-floor.png",
  "icon-stairs": "UI/stairs.png",
  "icon-escalator": "UI/icon-escalator.png",
  "icon-elevator": "UI/icon-elevator.png",
  "icon-service-elev": "UI/icon-serviceelevator.png",
  "icon-express-elev": "UI/icon-expresselevator.png",
  "icon-office": "UI/icon-office.png",
  "icon-hotel-single": "UI/icon-hotel-single.png",
  "icon-hotel-double": "UI/icon-hotel-double.png",
  "icon-hotel-suite": "UI/icon-hotel-suite.png",
  "icon-fastfood": "UI/icon-fastfood.png",
  "icon-restaurant": "UI/icon-restaurant.png",
  "icon-stores": "UI/stores.png",
  "icon-cinema": "UI/icon_cinema.png",
  "icon-partyhall": "UI/icon-partyhall.png",
  "icon-parking": "UI/icon-parking.png",
  "icon-recycle": "UI/icon-recycle.png",
  "icon-subway": "UI/icon-subway.png",
  "icon-security": "UI/icon-security.png",
  "icon-medical": "UI/icon-medicaloffice.png",
  "icon-housekeeping": "UI/icon-housekeeping.png",
  "icon-condo": "UI/icon-condo.png",
  "icon-bar": "UI/icon-bar.png",
  "icon-garbage": "UI/icon-garbage.png",
});

// ---------------------------------------------------------------------------
// Pure pixel helpers (Surface in, Surface out — headless testable)
// ---------------------------------------------------------------------------

// Nearest-neighbour resample.
export function resample(src, w, h) {
  const out = new Surface(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / w));
      const si = (sy * src.width + sx) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

// OpenSkyscraper art is authored at 2x the SimTower pixel grid.
export function halve(src) {
  return resample(src, Math.max(1, Math.floor(src.width / 2)), Math.max(1, Math.floor(src.height / 2)));
}

// Multiply a rect's RGB by [r,g,b]/255 (alpha untouched). Rect defaults to full.
export function tint(surf, [r, g, b], x = 0, y = 0, w = surf.width, h = surf.height) {
  for (let yy = y; yy < y + h && yy < surf.height; yy++) {
    for (let xx = x; xx < x + w && xx < surf.width; xx++) {
      const i = (yy * surf.width + xx) * 4;
      surf.data[i] = Math.min(255, (surf.data[i] * r) / 255);
      surf.data[i + 1] = Math.min(255, (surf.data[i + 1] * g) / 255);
      surf.data[i + 2] = Math.min(255, (surf.data[i + 2] * b) / 255);
    }
  }
  return surf;
}

export function dimmed(surf, f = 0.55) {
  const out = new Surface(surf.width, surf.height);
  out.copy(surf, 0, 0);
  return tint(out, [255 * f, 255 * f, 255 * f]);
}

export function warmed(surf) {
  const out = new Surface(surf.width, surf.height);
  out.copy(surf, 0, 0);
  return tint(out, [255, 216, 176]);
}

export function mirrored(src) {
  const out = new Surface(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      const di = (y * src.width + (src.width - 1 - x)) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

export function solid(shades) {
  const out = new Surface(1, 1);
  out.data[0] = shades[0];
  out.data[1] = shades[1];
  out.data[2] = shades[2];
  out.data[3] = shades.length > 3 ? shades[3] : 255;
  return out;
}

export function tile(dst, src, dx, dy, cols, rows) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) dst.copy(src, dx + c * src.width, dy + r * src.height);
  }
  return dst;
}

function px(surf, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= surf.width || y >= surf.height) return;
  const i = (y * surf.width + x) * 4;
  surf.data[i] = r;
  surf.data[i + 1] = g;
  surf.data[i + 2] = b;
  surf.data[i + 3] = a;
}

function rect(surf, x, y, w, h, color, a = 255) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) px(surf, xx, yy, color, a);
  }
}

function hline(surf, x0, x1, y, color, a = 255) {
  for (let x = x0; x <= x1; x++) px(surf, x, y, color, a);
}

function vline(surf, x, y0, y1, color, a = 255) {
  for (let y = y0; y <= y1; y++) px(surf, x, y, color, a);
}

function disc(surf, cx, cy, r, color, a = 255) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) px(surf, cx + x, cy + y, color, a);
    }
  }
}

// Deterministic hash noise (stable across runs/tests).
export function hash01(n) {
  let x = Math.imul(n | 0, 2654435761) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Procedural 16x24 walker — the people/worker/crowd building block
// ---------------------------------------------------------------------------

// Draws one 16x24 person with bottom-center anchor (x, yBottom). frame 0..5
// is the walk cycle (leg swing + bob); silhouette forces a single color.
// `helmet` paints a brimmed hard hat instead of hair (construction crew).
export function drawWalker(dst, x, yBottom, {
  shirt = [235, 235, 235],
  pants = [70, 80, 140],
  skin = [255, 220, 180],
  hair = [60, 40, 30],
  helmet = null,
  frame = 0,
  silhouette = null,
} = {}) {
  const C = (c) => silhouette || c;
  const cx = x; // person occupies cx-8+3 .. cx-8+12 (10 px wide)
  const bx = (dx, dy, w = 1, h = 1, col = [0, 0, 0]) => {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        px(dst, cx - 8 + 3 + dx + xx, yBottom - 24 + dy + yy, silhouette || col);
      }
    }
  };
  const swing = [0, 2, 1, 0, -2, -1][frame % 6];
  const bob = frame % 6 === 1 || frame % 6 === 4 ? 1 : 0;
  const yb = yBottom - bob;
  // legs (drawn relative to yb, before body so the torso overlaps the hip)
  const legL = pants;
  const legR = pants;
  bx(1, 15, 2, 9 - Math.max(0, swing), C(legL)); // back leg
  bx(5, 15, 2, 9 - Math.max(0, -swing), C(legR)); // front leg
  bx(1 + Math.max(0, swing), 15, 2, 9, C(legL));
  bx(5 + Math.min(0, -swing), 15, 2, 9, C(legR));
  // torso
  bx(2, 8 + bob, 6, 8, C(shirt));
  // arms
  bx(0, 9 + bob, 2, 6, C(shirt));
  bx(8, 9 + bob, 2, 6, C(shirt));
  bx(0, 15 + bob, 2, 1, C(skin));
  bx(8, 15 + bob, 2, 1, C(skin));
  // head
  bx(3, 2 + bob, 4, 6, C(skin));
  if (helmet) {
    bx(2, 0 + bob, 6, 2, C(helmet)); // dome
    bx(1, 2 + bob, 8, 1, C(helmet)); // brim
  } else {
    bx(3, 0 + bob, 4, 2, C(hair));
    bx(2, 1 + bob, 1, 2, C(hair));
    bx(7, 1 + bob, 1, 2, C(hair));
  }
}

// 6-frame walk sheet of a single colorway, one row.
export function walkerSheet(opts = {}, width = 96, height = 24) {
  const surf = new Surface(width, height);
  for (let f = 0; f < 6; f++) {
    drawWalker(surf, f * 16 + 8, height, { ...opts, frame: f });
  }
  return surf;
}

export function paintPeopleSheet() {
  return walkerSheet({ shirt: [235, 235, 235], pants: [70, 80, 140] });
}

export function paintWorkerSheet() {
  return walkerSheet({ shirt: [240, 150, 40], pants: [60, 60, 70], helmet: [250, 205, 40] });
}

export function paintQueueCrowd() {
  const surf = new Surface(288, 72);
  const dark = { silhouette: [44, 44, 52] };
  for (let row = 0; row < 3; row++) {
    for (let cell = 0; cell < 9; cell++) {
      const seed = row * 31 + cell * 7;
      const n = 2 + Math.floor(hash01(seed) * 3);
      for (let k = 0; k < n; k++) {
        const wx = cell * 32 + 4 + Math.floor(hash01(seed + k * 13) * 16);
        const frame = Math.floor(hash01(seed + k * 29) * 6);
        drawWalker(surf, wx, row * 24 + 24, { ...dark, frame });
      }
    }
  }
  return surf;
}

// ---------------------------------------------------------------------------
// Procedural painters (pure)
// ---------------------------------------------------------------------------

const SKY_STATES = [
  // 0 full day, 1 twilight, 2 night, 3 rain, 4 rain twilight, 5 storm
  { top: [96, 176, 236], low: [190, 228, 248] },
  { top: [84, 90, 168], low: [242, 160, 100] },
  { top: [10, 16, 44], low: [36, 52, 96], stars: true },
  { top: [110, 130, 150], low: [176, 192, 202] },
  { top: [58, 60, 104], low: [140, 110, 100] },
  { top: [70, 82, 90], low: [120, 134, 140] },
];

// 2112x360: 11 altitude bands x 6 states of 32x360 columns.
export function paintSky() {
  const surf = new Surface(32 * 66, 360);
  for (let band = 0; band < 11; band++) {
    for (let state = 0; state < 6; state++) {
      const s = SKY_STATES[state];
      const haze = Math.max(0, 1 - band / 4); // horizon haze near the ground
      const x0 = (band * 6 + state) * 32;
      for (let y = 0; y < 360; y++) {
        const t = y / 359;
        let r = s.top[0] + (s.low[0] - s.top[0]) * t;
        let g = s.top[1] + (s.low[1] - s.top[1]) * t;
        let b = s.top[2] + (s.low[2] - s.top[2]) * t;
        r += (s.low[0] - r) * haze * 0.6;
        g += (s.low[1] - g) * haze * 0.6;
        b += (s.low[2] - b) * haze * 0.6;
        const col = [Math.round(r), Math.round(g), Math.round(b)];
        for (let x = 0; x < 32; x++) px(surf, x0 + x, y, col);
      }
      if (s.stars) {
        for (let n = 0; n < 40; n++) {
          const sx = x0 + Math.floor(hash01(band * 977 + state * 131 + n) * 32);
          const sy = Math.floor(hash01(band * 331 + state * 57 + n * 7) * 260);
          px(surf, sx, sy, [220, 224, 240], 200);
        }
      }
    }
  }
  return surf;
}

const CLOUD_SIZES = [
  [96, 164],
  [192, 76],
  [292, 152],
  [216, 172],
];

export function paintCloud(variant) {
  const [w, h] = CLOUD_SIZES[variant % 4];
  const surf = new Surface(w, h);
  const puffs = 8 + variant * 3;
  for (let n = 0; n < puffs; n++) {
    const r = Math.floor(6 + hash01(variant * 17 + n * 11) * (h / 5));
    const cx = Math.min(w - r - 2, r + 2 + Math.floor(hash01(variant * 71 + n) * Math.max(1, w - 2 * r - 4)));
    const cy = Math.min(h - r - 2, r + 2 + Math.floor(hash01(variant * 41 + n * 3) * Math.max(1, h - 2 * r - 4)));
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = (x * x + y * y) / (r * r);
        if (d <= 1) {
          const a = Math.round(235 * (1 - d * 0.55));
          const i = ((cy + y) * w + (cx + x)) * 4;
          if (cx + x < 0 || cx + x >= w || cy + y < 0 || cy + y >= h) continue;
          if (a > surf.data[i + 3]) {
            surf.data[i] = 255;
            surf.data[i + 1] = 255;
            surf.data[i + 2] = 255;
            surf.data[i + 3] = a;
          }
        }
      }
    }
  }
  return surf;
}

// 3x5 digit font, scaled x3 into the 11x17 glyph cells.
const FONT_3X5 = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  B: ["110", "101", "110", "101", "110"],
};

// 132x34: 12 columns of 11x17; row0 lit amber, row1 dim. Order 0-9 then B.
export function paintDigits() {
  const surf = new Surface(132, 34);
  const glyphs = [...Array(10).keys(), "B"];
  const rows = [
    { y: 0, on: [255, 160, 40], off: [64, 40, 20] },
    { y: 17, on: [130, 96, 60], off: [48, 34, 22] },
  ];
  glyphs.forEach((g, col) => {
    const map = FONT_3X5[g];
    rows.forEach(({ y, on, off }) => {
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          const litc = map[gy][gx] === "1";
          const colr = litc ? on : off;
          // 3x5 font scaled x3 -> 9x15, centered in the 11x17 cell
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              px(surf, col * 11 + 1 + gx * 3 + sx, y + 1 + gy * 3 + sy, colr);
            }
          }
        }
      }
    });
  });
  return surf;
}

// One shaft cell (cellW x 36) + 3 motor animation frames of 2 cells each,
// laid out as 7 cells: [shaft, motor(f0) x2, motor(f1) x2, motor(f2) x2].
export function paintShaftStrip(cellW = 32) {
  const surf = new Surface(cellW * 7, 36);
  const rail = [88, 88, 100];
  const wall = [38, 38, 46];
  const cable = [120, 120, 132];
  // shaft cell 0
  for (let y = 0; y < 36; y++) {
    for (let x = 0; x < cellW; x++) px(surf, x, y, wall);
    hline(surf, 0, cellW - 1, y, rail);
    hline(surf, cellW - 2, cellW - 1, y, rail);
  }
  vline(surf, Math.floor(cellW / 2), 0, 35, cable);
  // motor frames (2 cells wide each)
  const motorW = cellW * 2;
  for (let f = 0; f < 3; f++) {
    const mx = (1 + f * 2) * cellW;
    rect(surf, mx + 2, 4, motorW - 4, 28, [58, 58, 68]);
    rect(surf, mx + 2, 4, motorW - 4, 3, [80, 80, 92]);
    rect(surf, mx + 2, 29, motorW - 4, 3, [30, 30, 36]);
    const cy = 18;
    [Math.floor(motorW * 0.3), Math.floor(motorW * 0.7)].forEach((cx0, k) => {
      disc(surf, mx + cx0, cy, 7, [96, 96, 110]);
      disc(surf, mx + cx0, cy, 3, [40, 40, 48]);
      const a0 = (f * 2 + k) * 1.05;
      for (let t = 0; t < 8; t++) {
        const a = a0 + (t * Math.PI) / 4;
        px(surf, mx + cx0 + Math.round(Math.cos(a) * 5), cy + Math.round(Math.sin(a) * 5), [64, 64, 76]);
      }
    });
  }
  return surf;
}

// 5 load frames from a 1x car cutout; frames 1-4 gain passenger silhouettes.
export function paintCarFrames(art) {
  const carW = art.width + 2;
  const surf = new Surface(carW * 5, 30);
  const pax = [0, 1, 3, 5, 8];
  for (let i = 0; i < 5; i++) {
    surf.copy(art, i * carW + 1, 1);
    let placed = 0;
    for (let row = 0; row < 2 && placed < pax[i]; row++) {
      for (let k = 0; k < 3 && placed < pax[i]; k++) {
        if (row === 1 && pax[i] <= 3) break;
        const wx = i * carW + 5 + k * 8 + (row === 1 ? 4 : 0);
        drawWalker(surf, wx, 29, { silhouette: [36, 36, 44], frame: k % 6 });
        placed++;
      }
    }
  }
  return surf;
}

export function paintConstructionGrid() {
  const surf = new Surface(328, 36);
  const beam = [158, 158, 168];
  const brace = [128, 128, 140];
  hline(surf, 0, 327, 0, beam);
  hline(surf, 0, 327, 35, beam);
  for (let x = 0; x < 328; x += 16) {
    vline(surf, x, 0, 35, beam);
    for (let d = 0; d < 36; d++) {
      px(surf, x + d, d, brace);
      px(surf, x + d, 35 - d, brace);
    }
  }
  return surf;
}

export function paintConstructionSolid() {
  const surf = new Surface(328, 24);
  const ply = [150, 112, 70];
  const seam = [118, 86, 52];
  rect(surf, 0, 0, 328, 24, ply);
  for (let x = 0; x < 328; x += 24) vline(surf, x, 0, 23, seam);
  for (let x = 0; x < 328; x++) px(surf, x, (x / 6) % 24 | 0, seam);
  hline(surf, 0, 327, 0, seam);
  hline(surf, 0, 327, 23, seam);
  return surf;
}

// Red "no route" exclamation badge (1:1 with the dumper's procedural art).
export function paintNoroute() {
  const surf = new Surface(36, 36);
  for (let y = 11; y <= 26; y++) {
    const rowW = y <= 18 ? (y - 10) * 2 - 1 : (27 - y) * 2;
    const startX = 18 - Math.floor(rowW / 2);
    for (let x = 0; x < rowW; x++) px(surf, startX + x, y, [220, 40, 40]);
  }
  return surf;
}

// 2-frame 624x36 water flicker on high-lobby ground floors.
export function paintFountain() {
  const surf = new Surface(624, 36);
  for (let f = 0; f < 2; f++) {
    const ox = f * 312;
    const col = f === 0 ? [51, 102, 153] : [80, 140, 200];
    for (let x = 17; x <= 26; x++) {
      for (let y = 32; y < 36; y++) px(surf, ox + x, y, col);
    }
  }
  return surf;
}

// 96x55 background city silhouette strip, tiled along the horizon.
export function paintSkyline() {
  const surf = new Surface(96, 55);
  const body = [30, 106, 112];
  const dark = [22, 82, 90];
  const lit = [190, 235, 220];
  let x = 0;
  let n = 0;
  while (x < 96) {
    const w = 8 + Math.floor(hash01(n * 13) * 14);
    const h = 18 + Math.floor(hash01(n * 29) * 30);
    for (let yy = 55 - 6 - h; yy < 55 - 6; yy++) {
      for (let xx = x; xx < Math.min(96, x + w); xx++) {
        px(surf, xx, yy, hash01(n * 7 + xx) > 0.85 ? dark : body);
      }
    }
    for (let wy = 55 - 6 - h + 2; wy < 49; wy += 4) {
      for (let wx = x + 2; wx < x + w - 1; wx += 3) {
        if (hash01(n * 101 + wx * 3 + wy) > 0.6) px(surf, wx, wy, lit, 200);
      }
    }
    x += w + 1;
    n++;
  }
  rect(surf, 0, 49, 96, 6, [46, 42, 40]);
  return surf;
}

// 140x48 christmas flyby: sleigh + reindeer silhouettes.
export function paintSanta() {
  const surf = new Surface(140, 48);
  const deer = [122, 82, 48];
  const deerDark = [94, 62, 36];
  const red = [190, 30, 40];
  const redDark = [140, 20, 30];
  // three reindeer
  for (let d = 0; d < 3; d++) {
    const dx = 8 + d * 26;
    for (let yy = 0; yy < 14; yy++) {
      for (let xx = 0; xx < 18; xx++) {
        const body =
          (xx > 3 && xx < 14 && yy > 4 && yy < 10) ||
          (xx >= 12 && xx < 17 && yy >= 3 && yy < 7) || // head
          (yy === 8 && (xx === 1 || xx === 15));
        if (body) px(surf, dx + xx, 16 + yy, d % 2 ? deerDark : deer);
      }
    }
    // antlers + legs
    vline(surf, dx + 13, 10, 14, deerDark);
    vline(surf, dx + 15, 10, 14, deerDark);
    vline(surf, dx + 4, 24, 27, deerDark);
    vline(surf, dx + 12, 24, 27, deerDark);
  }
  // tether
  hline(surf, 60, 70, 22, [80, 60, 40]);
  // sleigh
  for (let yy = 0; yy < 14; yy++) {
    for (let xx = 0; xx < 34; xx++) {
      const curve = yy < 4 && (xx < 6 || xx > 27) ? false : true;
      if (curve) px(surf, 96 + xx, 14 + yy, yy < 9 ? red : redDark);
    }
  }
  hline(surf, 94, 132, 32, [200, 200, 210]); // runner
  // santa
  rect(surf, 104, 6, 8, 9, [200, 30, 40]);
  rect(surf, 106, 2, 5, 5, [255, 220, 180]);
  rect(surf, 105, 0, 7, 3, [240, 240, 240]);
  // sack
  disc(surf, 124, 10, 5, [90, 60, 30]);
  return surf;
}

// 36x36 construction crane marker.
export function paintCrane() {
  const surf = new Surface(36, 36);
  const yellow = [232, 198, 44];
  const dark = [120, 100, 24];
  rect(surf, 6, 22, 16, 10, yellow);
  rect(surf, 6, 22, 16, 3, dark);
  rect(surf, 20, 16, 8, 8, yellow); // cab
  for (let i = 0; i < 26; i++) {
    px(surf, 24 + i, 14 - Math.floor(i / 2), yellow);
    if (i % 4 === 0) px(surf, 24 + i, 15 - Math.floor(i / 2), dark);
  }
  vline(surf, 10, 32, 35, dark); // tracks
  hline(surf, 4, 24, 35, dark);
  return surf;
}

// ---------------------------------------------------------------------------
// Composition from vendored 1x surfaces (pure — testable with synthetic input)
// ---------------------------------------------------------------------------

function need(surfaces, name) {
  const s = surfaces[name];
  if (!s) throw new Error(`OpenSky source missing: ${name}`);
  return s;
}

function stretchCell(src, w, h) {
  return resample(src, w, h);
}

export function composeOffice(s) {
  const sheet = new Surface(144, 168);
  const tenants = [
    "office_t0_1_0", "office_t0_5_0", "office_t1_2_0",
    "office_t1_7_0", "office_t2_3_0", "office_t2_4_0",
  ];
  tenants.forEach((name, row) => {
    const art = stretchCell(need(s, name), 72, 24);
    sheet.copy(art, 0, row * 24);
    const unlit = dimmed(art);
    sheet.copy(unlit, 72, row * 24);
  });
  sheet.copy(stretchCell(need(s, "office_t0_0_0"), 72, 24), 0, 144);
  sheet.copy(dimmed(stretchCell(need(s, "office_t0_0_0"), 72, 24)), 72, 144);
  return sheet;
}

export function composeCondo(s) {
  const sheet = new Surface(640, 72);
  for (let t = 1; t <= 3; t++) {
    const row = (t - 1) * 24;
    const occ = halve(need(s, `condo-occ${t}`));
    sheet.copy(occ, 0, row);
    sheet.copy(warmed(occ), 128, row);
    sheet.copy(dimmed(occ, 0.4), 256, row);
    sheet.copy(halve(need(s, `condo-empty${t}-day`)), 384, row);
    sheet.copy(halve(need(s, `condo-empty${t}-night`)), 512, row);
  }
  return sheet;
}

function hotelColumns(day1, day2, night1, night2) {
  // col0 clean, col1 cleaning, col2 resting, col3 occupied
  return [day1, day2, night1, day2].map((n) => n && halve(n));
}

function composeHotelRow(row, arts, x0, fw) {
  arts.forEach((art, col) => row.copy(art, x0 + col * fw, 0));
}

export function composeSingle(s) {
  const sheet = new Surface(288, 48);
  const arts = hotelColumns(
    need(s, "single-day-1"), need(s, "single-day-2"),
    need(s, "single-night-1"), need(s, "single-night-2"),
  );
  const clean = new Surface(128, 24);
  composeHotelRow(clean, arts, 0, 32);
  sheet.copy(clean, 0, 0);
  sheet.copy(dimmed(clean, 0.8), 0, 24); // dirty row placeholder
  return sheet;
}

export function composeDouble(s) {
  const sheet = new Surface(432, 96);
  const subs = [
    ["double-day-1", "double-day-2", "double-night-1", "double-night-2"],
    ["double-day", "double-day-2", "double-night", "double-night-2"],
  ];
  subs.forEach((names, sub) => {
    const clean = new Surface(192, 24);
    composeHotelRow(clean, names.map((n) => halve(need(s, n))), 0, 48);
    sheet.copy(clean, 0, sub * 48);
    sheet.copy(dimmed(clean, 0.8), 0, sub * 48 + 24);
  });
  return sheet;
}

export function composeSuite(s) {
  const sheet = new Surface(720, 48);
  const arts = [
    need(s, "suite-day"), need(s, "suite-day-2"),
    need(s, "suite-night-1"), need(s, "suite-night-2"),
  ].map((src) => halve(src));
  const clean = new Surface(224, 24);
  composeHotelRow(clean, arts, 0, 56);
  sheet.copy(clean, 0, 0);
  sheet.copy(dimmed(clean, 0.8), 0, 24);
  return sheet;
}

// Crowd states composited over a food court storefront: col0 empty, col1
// light, col2 busy, col3 closed (dim).
function composeFoodCourt(sheet, art, rowY, cellW, seedBase) {
  sheet.copy(art, 0, rowY);
  for (const col of [1, 2]) {
    const cell = new Surface(cellW, 24);
    cell.copy(art, 0, 0);
    const n = col === 1 ? 2 : 5;
    for (let k = 0; k < n; k++) {
      const seed = seedBase + col * 17 + k * 5;
      const wx = 10 + Math.floor(hash01(seed) * (cellW - 20));
      drawWalker(cell, wx, 24, {
        silhouette: [70, 64, 78],
        frame: Math.floor(hash01(seed + 2) * 6),
      });
    }
    sheet.copy(cell, col * cellW, rowY);
  }
  sheet.copy(dimmed(art, 0.45), 3 * cellW, rowY);
}

let foodSeed = 0; // per-row seed for stable crowd layouts

export function composeFastfood(s) {
  foodSeed = 0;
  const sheet = new Surface(512, 120);
  ["ff-burgers", "ff-chinese", "ff-coffee", "ff-pizza", "ff-sushi"].forEach((name, row) => {
    composeFoodCourt(sheet, stretchCell(halve(need(s, name)), 128, 24), row * 24, 128, (foodSeed += 101));
  });
  return sheet;
}

export function composeRestaurant(s) {
  foodSeed = 0;
  const sheet = new Surface(768, 96);
  ["rest-french", "rest-hibachi", "rest-indian", "rest-pub"].forEach((name, row) => {
    composeFoodCourt(sheet, stretchCell(halve(need(s, name)), 192, 24), row * 24, 192, (foodSeed += 211));
  });
  return sheet;
}

export function composePartyhall(s) {
  const sheet = new Surface(576, 60);
  const day = stretchCell(halve(need(s, "party-day")), 192, 60);
  sheet.copy(day, 0, 0);
  sheet.copy(warmed(day), 192, 0);
  sheet.copy(stretchCell(halve(need(s, "party-night")), 192, 60), 384, 0);
  return sheet;
}

export function composeHousekeeping(s) {
  return halve(need(s, "housekeeping-day"));
}

export function composeSecurity(s) {
  return stretchCell(halve(need(s, "security")), 128, 24);
}

export function composeMedical(s) {
  return stretchCell(halve(need(s, "clinic")), 256, 24);
}

export function composeRecycling(s) {
  return stretchCell(halve(need(s, "recycle")), 200, 60);
}

export function composeYootCondo(s) {
  const sheet = new Surface(128, 360);
  const occ = halve(need(s, "hrd-occ"));
  const empty = halve(need(s, "hrd-empty"));
  for (let variant = 0; variant < 3; variant++) {
    const states = [occ, warmed(occ), dimmed(occ, 0.4), empty, dimmed(empty, 0.7)];
    states.forEach((art, state) => sheet.copy(art, 0, (variant * 5 + state) * 24));
  }
  return sheet;
}

// Retail placeholder: row 0 = For Rent shutters, rows 1-11 = muted hue-shifted
// shutter variants until bespoke storefront art exists (audit: shops = gap).
export function composeShops(s) {
  const sheet = new Surface(288, 288);
  const shutter = stretchCell(halve(need(s, "shop-closed")), 96, 24);
  for (let row = 0; row < 12; row++) {
    const cell = new Surface(96, 24);
    cell.copy(shutter, 0, 0);
    if (row > 0) {
      // small deterministic hue nudge per variant (kept muted, no inversion)
      const dr = Math.round(Math.sin(row * 2.1) * 26);
      const dg = Math.round(Math.sin(row * 1.3 + 2) * 18);
      const db = Math.round(Math.sin(row * 2.9 + 4) * 26);
      for (let i = 0; i < cell.data.length; i += 4) {
        if (cell.data[i + 3] > 0) {
          cell.data[i] = Math.max(0, Math.min(255, cell.data[i] + dr));
          cell.data[i + 1] = Math.max(0, Math.min(255, cell.data[i + 1] + dg));
          cell.data[i + 2] = Math.max(0, Math.min(255, cell.data[i + 2] + db));
        }
      }
    }
    tile(sheet, cell, 0, row * 24, 3, 1);
  }
  return sheet;
}

export function composeFloor(s) {
  return stretchCell(resample(need(s, "floor-tile"), 8, 24), 8, 36);
}

// Pick the art's most detailed vertical band (edge-energy) so lobby rows
// show the decorated floors instead of blank wall.
export function bestBand(art, bandH) {
  let bestY = 0;
  let bestScore = -1;
  for (let y0 = 0; y0 + bandH <= art.height; y0 += 8) {
    let score = 0;
    for (let y = y0; y < y0 + bandH; y += 2) {
      for (let x = 1; x < art.width; x += 2) {
        const i = (y * art.width + x) * 4;
        const j = (y * art.width + x - 1) * 4;
        score +=
          Math.abs(art.data[i] - art.data[j]) +
          Math.abs(art.data[i + 1] - art.data[j + 1]);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestY = y0;
    }
  }
  return bestY;
}

function lobbyRow(s, name, cropH2x) {
  const art = need(s, name);
  const w = Math.min(art.width, 624);
  const y0 = bestBand(art, cropH2x);
  const crop = new Surface(w, cropH2x);
  crop.copy(art, 0, 0, 0, y0, w, cropH2x);
  return resample(crop, 312, Math.round(cropH2x / 2));
}

export function composeLobbyNormal(s) {
  const sheet = new Surface(312, 108);
  ["grandlobby-1", "grandlobby-2", "mezz-3"].forEach((name, tier) => {
    sheet.copy(lobbyRow(s, name, 72), 0, tier * 36);
  });
  return sheet;
}

export function composeLobbySky(s) {
  const sheet = new Surface(312, 108);
  ["skylobby-1", "skylobby-2", "skylobby-3"].forEach((name, tier) => {
    sheet.copy(lobbyRow(s, name, 48), 0, tier * 36);
  });
  return sheet;
}

export function composeLobbyHigh(s) {
  const sheet = new Surface(312, 324);
  ["mezz-3", "mezz-4", "mezz-5"].forEach((name, tier) => {
    sheet.copy(lobbyRow(s, name, 216), 0, tier * 108);
  });
  return sheet;
}

// Straight stairs: 14 frames of 64x60 (0 empty, 1-6 up, 7-13 down).
export function composeStairs(s) {
  const art = stretchCell(halve(need(s, "stairs-1")), 64, 44);
  const sheet = new Surface(896, 60);
  for (let f = 0; f < 14; f++) {
    const cx = f * 64;
    sheet.copy(art, cx, 16);
    if (f > 0) {
      const up = f <= 6;
      const t = (up ? f : 13 - f + 7) / 6;
      drawWalker(sheet, cx + 6 + Math.round(48 * t), 16 + 44 - Math.round(30 * t), {
        shirt: [200, 120, 60],
        frame: f % 6,
      });
    }
  }
  return sheet;
}

// Escalator: 8 frames of 64x72.
export function composeEscalator(s) {
  const art = stretchCell(halve(need(s, "escalator")), 64, 42);
  const sheet = new Surface(512, 72);
  for (let f = 0; f < 8; f++) {
    const cx = f * 64;
    sheet.copy(art, cx, 30);
    if (f > 0) {
      const t = f / 7;
      drawWalker(sheet, cx + 6 + Math.round(48 * t), 30 + 42 - Math.round(34 * t), {
        shirt: [90, 140, 200],
        frame: f % 6,
      });
    }
  }
  return sheet;
}

function composeSpiral(s, name, h, frames = 11) {
  const art = stretchCell(halve(need(s, name)), 64, h);
  const sheet = new Surface(64 * frames, h);
  for (let f = 0; f < frames; f++) {
    sheet.copy(art, f * 64, 0);
    if (f > 0) {
      const t = f / (frames - 1);
      drawWalker(sheet, f * 64 + 8 + Math.round(44 * t), h - 6 - Math.round((h - 26) * t), {
        shirt: [160, 90, 160],
        frame: f % 6,
      });
    }
  }
  return sheet;
}

export function composeSpiral2(s) {
  return composeSpiral(s, "stairs-2", 72);
}

export function composeSpiral3(s) {
  return composeSpiral(s, "stairs-3", 108);
}

export function composeElevatorCars(s) {
  const car = (name, cellW) => {
    const art = stretchCell(halve(need(s, name)), cellW - 2, 28);
    return paintCarFrames(art);
  };
  return {
    "simtower/elevator/standard": car("elev-local", 28),
    "simtower/elevator/service": car("elev-service", 28),
    "simtower/elevator/express": car("elev-express", 44),
  };
}

export function composeEntrances(s) {
  // mm_awning-blue is an arched entrance wall tiled in 4 segments of ~27px
  // (at 2x); each 56x36 deco cell covers two segments.
  const sheet = new Surface(112, 36);
  const art = need(s, "awning");
  const segW = Math.floor(art.width / 4);
  for (let cell = 0; cell < 2; cell++) {
    const crop = new Surface(segW * 2, art.height);
    crop.copy(art, 0, 0, cell * segW * 2, 0, crop.width, art.height);
    sheet.copy(resample(crop, 56, 36), cell * 56, 0);
  }
  return sheet;
}

export function composeFireladder(s) {
  const art = need(s, "fire-escape");
  const crop = new Surface(96, 72);
  crop.copy(art, 0, 0, 0, (art.height - 72) / 2, 96, 72);
  return halve(crop);
}

const TOOLBOX_ICONS = [
  "icon-lobby", "icon-floor", "icon-stairs", "icon-escalator",
  "icon-elevator", "icon-service-elev", "icon-express-elev",
  "icon-office", "icon-hotel-single", "icon-hotel-double", "icon-hotel-suite",
  "icon-fastfood", "icon-restaurant", "icon-stores", "icon-cinema",
  "icon-partyhall", "icon-partyhall" /* cathedral */, "icon-parking" /* ramp */,
  "icon-recycle", "icon-subway", "icon-parking", "icon-security",
  "icon-medical", "icon-housekeeping", "icon-condo",
];

export function composeToolboxItems(s) {
  const sheet = new Surface(832, 96);
  TOOLBOX_ICONS.forEach((name, cell) => {
    sheet.copy(stretchCell(halve(need(s, name)), 32, 32), cell * 32, 0);
  });
  return sheet;
}

// 3 cells of 21x21 at stride 24: bulldozer, finger (shaft resize), inspect.
export function composeToolboxTools(s) {
  const sheet = new Surface(192, 21);
  const garbage = halve(need(s, "icon-garbage"));
  const garbageCell = new Surface(21, 21);
  garbageCell.copy(garbage, 0, 0, 4, 4, 21, 21);
  sheet.copy(garbageCell, 0, 0);
  const bar = need(s, "icon-bar");
  for (let k = 0; k < 2; k++) {
    const third = new Surface(16, 48);
    third.copy(bar, 0, 0, k * 16, 0, 16, 48);
    sheet.copy(resample(third, 21, 21), (k + 1) * 24, 0);
  }
  return sheet;
}

// ---------------------------------------------------------------------------
// composeAll: every registry key the OpenSkyScraper edition provides
// ---------------------------------------------------------------------------

export function composeAll(surfaces, { missing = () => {} } = {}) {
  const bitmaps = {};
  const skip = [];
  const add = (key, fn) => {
    try {
      bitmaps[key] = fn();
    } catch (err) {
      skip.push({ key, reason: String(err.message || err) });
      missing(key, err);
    }
  };

  add("simtower/office", () => composeOffice(surfaces));
  add("simtower/condo", () => composeCondo(surfaces));
  add("simtower/single", () => composeSingle(surfaces));
  add("simtower/double", () => composeDouble(surfaces));
  add("simtower/suite", () => composeSuite(surfaces));
  add("simtower/fastfood", () => composeFastfood(surfaces));
  add("simtower/restaurant", () => composeRestaurant(surfaces));
  add("simtower/partyhall", () => composePartyhall(surfaces));
  add("simtower/cathedral/main", () => composePartyhall(surfaces));
  add("simtower/housekeeping", () => composeHousekeeping(surfaces));
  add("simtower/security", () => composeSecurity(surfaces));
  add("simtower/medicalcenter", () => composeMedical(surfaces));
  add("simtower/recycling", () => composeRecycling(surfaces));
  add("simtower/shops", () => composeShops(surfaces));
  add("simtower/yootcondo/empty", () => composeYootCondo(surfaces));
  add("simtower/floor", () => composeFloor(surfaces));
  add("simtower/lobby/normal", () => composeLobbyNormal(surfaces));
  add("simtower/lobby/sky", () => composeLobbySky(surfaces));
  add("simtower/lobby/high", () => composeLobbyHigh(surfaces));
  add("simtower/lobby/fountain", () => paintFountain());
  add("simtower/stairs", () => composeStairs(surfaces));
  add("simtower/stairs/spiral_2", () => composeSpiral2(surfaces));
  add("simtower/stairs/spiral_3", () => composeSpiral3(surfaces));
  add("simtower/escalator", () => composeEscalator(surfaces));
  add("simtower/elevator/narrow", () => paintShaftStrip(32));
  add("simtower/elevator/wide", () => paintShaftStrip(48));
  add("simtower/elevator/digits", () => paintDigits());
  add("simtower/elevator/people", () => paintQueueCrowd());
  add("simtower/people", () => paintPeopleSheet());
  add("simtower/construction/grid", () => paintConstructionGrid());
  add("simtower/construction/solid", () => paintConstructionSolid());
  add("simtower/construction/worker", () => paintWorkerSheet());
  add("simtower/deco/cloud/0", () => paintCloud(0));
  add("simtower/deco/cloud/1", () => paintCloud(1));
  add("simtower/deco/cloud/2", () => paintCloud(2));
  add("simtower/deco/cloud/3", () => paintCloud(3));
  add("simtower/deco/crane", () => paintCrane());
  add("simtower/deco/fireladder", () => composeFireladder(surfaces));
  add("simtower/deco/skyline", () => paintSkyline());
  add("simtower/deco/entrances", () => composeEntrances(surfaces));
  add("simtower/deco/santa", () => paintSanta());
  add("simtower/sky", () => paintSky());
  add("simtower/ui/toolbox/items", () => composeToolboxItems(surfaces));
  add("simtower/ui/toolbox/tools", () => composeToolboxTools(surfaces));
  add("noroute.png", () => paintNoroute());
  add("simtower/parking/space", () => {
    const sheet = new Surface(480, 24);
    tile(sheet, stretchCell(halve(need(surfaces, "parking")), 32, 24), 0, 0, 15, 1);
    return sheet;
  });
  add("simtower/parking/ramp", () => {
    const src = halve(need(surfaces, "ramp"));
    const band = new Surface(Math.min(128, src.width), 24);
    band.copy(src, 0, 0, 0, Math.floor(src.height / 2) - 12, band.width, 24);
    const sheet = new Surface(384, 24);
    tile(sheet, band, 0, 0, 3, 1);
    return sheet;
  });
  try {
    const cars = composeElevatorCars(surfaces);
    Object.assign(bitmaps, cars);
  } catch (err) {
    for (const key of [
      "simtower/elevator/standard", "simtower/elevator/service", "simtower/elevator/express",
    ]) {
      skip.push({ key, reason: String(err.message || err) });
      missing(key, err);
    }
  }

  bitmaps.__missing__ = skip;
  return bitmaps;
}

// ---------------------------------------------------------------------------
// Browser loader
// ---------------------------------------------------------------------------

function imageToSurface(img) {
  const w = Math.max(1, Math.floor(img.naturalWidth / 2));
  const h = Math.max(1, Math.floor(img.naturalHeight / 2));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const surf = new Surface(w, h);
  surf.data.set(data);
  return surf;
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

// Mirrors loadSimTowerMedia()'s contract. Individual source files that fail to
// load only disable the keys that reference them (reported via console.warn).
export async function loadOpenSkyMedia({ baseUrl = OPENSKY_ART_BASE } = {}) {
  if (typeof document === "undefined") {
    throw new Error("loadOpenSkyMedia requires a DOM (no document)");
  }
  const names = Object.keys(OPENSKY_SOURCES);
  const loaded = await Promise.all(
    names.map(async (name) => {
      try {
        const img = await loadImageElement(`${baseUrl}/${OPENSKY_SOURCES[name]}`);
        return [name, imageToSurface(img)];
      } catch {
        return [name, null];
      }
    }),
  );
  const surfaces = Object.fromEntries(loaded.filter(([, v]) => v !== null));
  const absent = loaded.filter(([, v]) => v === null).map(([n]) => n);

  const composed = composeAll(surfaces);
  const missing = composed.__missing__ ?? [];
  delete composed.__missing__;
  if (absent.length || missing.length) {
    console.warn(
      `[OpenSkyScraper] ${absent.length} source file(s) unavailable, ` +
        `${missing.length} sheet(s) skipped:`,
      { absent, missing },
    );
  }

  const canvases = {};
  for (const [key, surf] of Object.entries(composed)) {
    canvases[key] = surf instanceof Surface ? surf.toCanvas() : surf;
  }
  return {
    bitmaps: canvases,
    soundUrls: {}, // the community art pack ships no audio; sim stays silent
    missing: missing.map((m) => m.key),
    dispose() {},
  };
}
