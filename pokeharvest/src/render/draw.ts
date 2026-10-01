/**
 * One frame of the farm: ground, soil and crops, the house, everyone on the
 * farm sorted by depth, then the time-of-day tint with lamplight, then
 * floating text.
 */
import { crop } from '../data/crops';
import { item } from '../data/items';
import { FARM, MAP_H, MAP_W, mapSize, tileAt } from '../data/maps';
import { isDone } from '../game/machines';
import { merchantHere } from '../game/market';
import { species } from '../data/species';
import { stageOf } from '../game/farm';
import { plotKey, type World } from '../game/model';
import type { View } from './camera';
import { farmerImage } from './farmer';
import { darkness, skyTint } from './light';
import { drawIcon, drawPokemon } from './sprites';
import { T, barnImage, cartImage, cropImage, houseImage, machineImage, soilImage, tileImage } from './tiles';

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

export interface Splash {
  x: number;
  y: number;
  color: string;
  born: number;
}

export interface Fx {
  floaters: Floater[];
  splashes: Splash[];
  /** A tile to outline: where the farmer is heading to do something. */
  target: { x: number; y: number } | null;
}

const FLOAT_MS = 1100;
const SPLASH_MS = 450;

/** A building's footprint and door column, read from the farm map. */
function footprint(wall: string, doorCh: string): { x: number; y: number; w: number; h: number; door: number } {
  let x0 = MAP_W, y0 = MAP_H, x1 = -1, y1 = -1, door = 0;
  FARM.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== wall && ch !== doorCh) return;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (ch === doorCh) door = x;
  }));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, door: door - x0 };
}

const HOUSE = footprint('H', 'D');
const BARN = footprint('A', 'a');

export function render(ctx: CanvasRenderingContext2D, world: World, view: View, now: number, fx: Fx): void {
  const { tile, ox, oy } = view;
  const scale = tile / T;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#24522a';
  ctx.fillRect(0, 0, view.width, view.height);

  const size = mapSize(world.map);
  const farm = world.map === 'farm';
  const x0 = Math.max(0, Math.floor(ox / tile));
  const y0 = Math.max(0, Math.floor(oy / tile));
  const x1 = Math.min(size.w - 1, Math.floor((ox + view.width) / tile));
  const y1 = Math.min(size.h - 1, Math.floor((oy + view.height) / tile));
  const sx = (x: number): number => Math.round(x * tile - ox);
  const sy = (y: number): number => Math.round(y * tile - oy);

  // Ground.
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const kind = tileAt(world.map, x, y);
      ctx.drawImage(kind === 'merchant' ? cartImage(merchantHere(world), x, y) : tileImage(kind, x, y, now), sx(x), sy(y), tile, tile);
      const plot = farm ? world.plots[plotKey(x, y)] : undefined;
      if (plot) ctx.drawImage(soilImage(plot.watered), sx(x), sy(y), tile, tile);
    }
  }
  // Crops, ripe ones showing their berry.
  for (let y = y0; y <= y1 && farm; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const c = world.plots[plotKey(x, y)]?.crop;
      if (!c) continue;
      const stage = stageOf(c);
      ctx.drawImage(cropImage(c.id, stage), sx(x), sy(y), tile, tile);
      if (stage === 3) {
        const bob = Math.sin(now / 300 + x + y) * scale * 0.6;
        drawIcon(ctx, crop(c.id).icon, sx(x) + tile / 2, sy(y) + tile * 0.38 + bob, tile * 0.8);
      }
    }
  }

  if (farm) {
    ctx.drawImage(houseImage(HOUSE.w, HOUSE.h, HOUSE.door), sx(HOUSE.x), sy(HOUSE.y), HOUSE.w * tile, HOUSE.h * tile);
    ctx.drawImage(barnImage(BARN.w, BARN.h, BARN.door), sx(BARN.x), sy(BARN.y), BARN.w * tile, BARN.h * tile);
  }

  if (fx.target) {
    const pulse = 0.55 + 0.35 * Math.sin(now / 120);
    ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
    ctx.lineWidth = Math.max(2, scale);
    ctx.strokeRect(sx(fx.target.x) + scale, sy(fx.target.y) + scale, tile - scale * 2, tile - scale * 2);
  }

  // Everyone and everything on the farm, back to front.
  const actors: { y: number; draw: () => void }[] = [];
  if (farm) {
    for (const [key, m] of Object.entries(world.machines)) {
      const [mx, my] = key.split(',').map(Number) as [number, number];
      if (mx < x0 - 1 || mx > x1 + 1 || my < y0 - 1 || my > y1 + 1) continue;
      actors.push({
        y: my,
        draw: () => {
          const working = m.output && !isDone(world, key);
          const shake = working ? Math.round(Math.sin(now / 90) * scale * 0.5) : 0;
          ctx.drawImage(machineImage(m.id), sx(mx) + shake, sy(my), tile, tile);
          if (isDone(world, key)) bubble(ctx, item(m.output!).icon!, sx(mx) + tile / 2, sy(my) - tile * 0.15, tile, now);
          else if (working) {
            // A progress bar under it.
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(sx(mx) + scale * 2, sy(my) + tile - scale * 2, tile - scale * 4, scale * 1.5);
            ctx.fillStyle = '#7ed957';
            ctx.fillRect(sx(mx) + scale * 2, sy(my) + tile - scale * 2, (tile - scale * 4) * (m.progress / m.needed), scale * 1.5);
          }
        },
      });
    }
    const waiting = Object.keys(world.barn.output)[0];
    if (waiting) actors.push({ y: BARN.y + BARN.h, draw: () => bubble(ctx, item(waiting).icon!, sx(BARN.x + BARN.door) + tile / 2, sy(BARN.y + BARN.h - 1) - tile * 0.2, tile, now) });
  }
  const p = world.player;
  actors.push({
    y: p.y,
    draw: () => {
      shadow(ctx, sx(p.x) + tile / 2, sy(p.y) + tile * 0.92, tile * 0.32);
      const frame = p.path.length ? Math.floor(now / 140) % 2 : 0;
      ctx.drawImage(farmerImage(p.facing, frame), sx(p.x), sy(p.y) - Math.round(scale * 2), tile, tile);
    },
  });
  world.helpers.forEach((h, i) => {
    if (h.role === 'farm' && !farm) return;
    actors.push({
      y: h.y,
      draw: () => {
        const cx = sx(h.x) + tile / 2;
        const foot = sy(h.y) + tile * 0.95;
        shadow(ctx, cx, foot - scale, tile * 0.36);
        const hop = h.path.length ? Math.abs(Math.sin(now / 110)) * scale * 1.5 : 0;
        const mon = world.mons.find((m) => m.uid === h.uid);
        const fainted = (mon?.hp ?? 1) <= 0;
        drawPokemon(ctx, h.dex, cx, foot - hop, scale * 0.55, { time: now, flip: h.facing === 'right', phase: i * 300, shiny: Boolean(mon?.shiny), alpha: fainted ? 0.5 : 1, frozen: fainted });
      },
    });
  });
  actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

  for (const s of fx.splashes) {
    const t = (now - s.born) / SPLASH_MS;
    if (t > 1) continue;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 1 - t;
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      const r = tile * (0.15 + t * 0.45);
      ctx.fillRect(sx(s.x) + tile / 2 + Math.cos(a) * r - scale, sy(s.y) + tile / 2 + Math.sin(a) * r * 0.6 - scale, scale * 2, scale * 2);
    }
    ctx.globalAlpha = 1;
  }

  lighting(ctx, world, view, sx, sy);

  // Floating text over everything, even at night.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(tile * 0.34)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  for (const f of fx.floaters) {
    const t = (now - f.born) / FLOAT_MS;
    if (t > 1) continue;
    const x = sx(f.x) + tile / 2;
    const y = sy(f.y) - t * tile * 0.8;
    ctx.globalAlpha = Math.min(1, (1 - t) * 2);
    ctx.lineWidth = Math.max(2, scale);
    ctx.strokeStyle = 'rgba(20,20,30,0.85)';
    ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
}

/** Drop floaters and splashes that have finished. */
export function pruneFx(fx: Fx, now: number): void {
  fx.floaters = fx.floaters.filter((f) => now - f.born < FLOAT_MS);
  fx.splashes = fx.splashes.filter((s) => now - s.born < SPLASH_MS);
}

/** A speech bubble with an item in it, bobbing: something's ready to collect. */
function bubble(ctx: CanvasRenderingContext2D, icon: string, x: number, y: number, tile: number, now: number): void {
  const bob = Math.sin(now / 250) * tile * 0.05;
  const r = tile * 0.36;
  ctx.fillStyle = 'rgba(255,248,231,0.95)';
  ctx.strokeStyle = 'rgba(58,42,26,0.8)';
  ctx.lineWidth = Math.max(1, tile / 32);
  ctx.beginPath();
  ctx.arc(x, y - r + bob, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawIcon(ctx, icon, x, y - r + bob, r * 1.6);
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function lighting(ctx: CanvasRenderingContext2D, world: World, view: View, sx: (x: number) => number, sy: (y: number) => number): void {
  const sky = skyTint(world.clock);
  if (sky.a <= 0.001) return;
  ctx.fillStyle = `rgba(${sky.r | 0},${sky.g | 0},${sky.b | 0},${sky.a.toFixed(3)})`;
  ctx.fillRect(0, 0, view.width, view.height);
  const dark = darkness(world.clock);
  if (dark <= 0) return;
  const { tile } = view;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x: number, y: number, r: number, strength: number): void => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,190,90,${(0.35 * strength * dark).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // The farmhouse windows.
  for (const col of [0, HOUSE.w - 1]) {
    if (col === HOUSE.door || world.map !== 'farm') continue;
    glow(sx(HOUSE.x + col) + tile / 2, sy(HOUSE.y + HOUSE.h - 1), tile * 2.2, 1);
  }
  // The farmer's lantern, and the Fire starter's tail flame.
  glow(sx(world.player.x) + tile / 2, sy(world.player.y) + tile / 2, tile * 3, 0.9);
  for (const h of world.helpers) {
    if (species(h.dex).types.includes('fire')) glow(sx(h.x) + tile / 2, sy(h.y) + tile / 2, tile * 1.8, 0.8);
  }
  ctx.restore();
}
