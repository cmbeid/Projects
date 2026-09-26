/**
 * Each area's look: sky or cave rock, two parallax ridges, and a layer of
 * scenery that says where you are — trees, a haunted tower, pipes, beams,
 * embers or a lake. All drawn in screen space behind the playfield.
 */
import type { ThemeKey } from '../data/areas';
import type { Camera } from './camera';
import { GROUND_Y } from '../game/world';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  grass: string;
  dirt: string;
  rock: string;
  water: string;
  /** Clouds by day, stars by night; indoors, neither. */
  sky: 'day' | 'night' | 'indoors';
  ridges: 'hills' | 'peaks';
  decor: 'trees' | 'stalactites' | 'tower' | 'pipes' | 'beams' | 'embers' | 'lake' | 'none';
}

export const THEMES: Readonly<Record<ThemeKey, Theme>> = {
  forest: { skyTop: '#6cc3f0', skyBottom: '#e0f5ff', far: '#8fcf87', near: '#4f9e48', grass: '#4fae41', dirt: '#7a5230', rock: '#6d5d48', water: '#3c8fd6', sky: 'day', ridges: 'hills', decor: 'trees' },
  cave: { skyTop: '#1d1a24', skyBottom: '#4a4150', far: '#3a3342', near: '#2c2733', grass: '#7a7280', dirt: '#3e3845', rock: '#5f5868', water: '#2f5f8a', sky: 'indoors', ridges: 'peaks', decor: 'stalactites' },
  haunted: { skyTop: '#1e1433', skyBottom: '#6b4d8f', far: '#3d2e57', near: '#2a2040', grass: '#5b5570', dirt: '#2f2a3d', rock: '#4a4460', water: '#35507a', sky: 'night', ridges: 'hills', decor: 'tower' },
  hideout: { skyTop: '#1c1618', skyBottom: '#5a3034', far: '#3a2a2d', near: '#291e20', grass: '#6a5d60', dirt: '#2e2426', rock: '#4a3e41', water: '#34526e', sky: 'indoors', ridges: 'peaks', decor: 'pipes' },
  wooden: { skyTop: '#3b2616', skyBottom: '#8a5a32', far: '#5e3d22', near: '#472d18', grass: '#a57a4a', dirt: '#5a3b20', rock: '#6e5238', water: '#3a6f9a', sky: 'indoors', ridges: 'hills', decor: 'beams' },
  wetcave: { skyTop: '#101b24', skyBottom: '#34505e', far: '#24363f', near: '#1a2830', grass: '#5d7480', dirt: '#26343b', rock: '#4a5f69', water: '#2d6f9c', sky: 'indoors', ridges: 'peaks', decor: 'stalactites' },
  ruins: { skyTop: '#2b1d1a', skyBottom: '#b0603a', far: '#4c3128', near: '#33221d', grass: '#5a4a44', dirt: '#2c211e', rock: '#4f3f39', water: '#34526e', sky: 'night', ridges: 'hills', decor: 'embers' },
  lake: { skyTop: '#7a93b8', skyBottom: '#dce6f0', far: '#7f9aa8', near: '#5d7d6a', grass: '#5c9a55', dirt: '#6e5436', rock: '#6a6a60', water: '#3778b8', sky: 'day', ridges: 'peaks', decor: 'lake' },
  hq: { skyTop: '#11151c', skyBottom: '#3a4250', far: '#252c36', near: '#1a2028', grass: '#5c6570', dirt: '#20262d', rock: '#434c57', water: '#2d4f6e', sky: 'indoors', ridges: 'peaks', decor: 'pipes' },
  plateau: { skyTop: '#2c3a6e', skyBottom: '#f0a868', far: '#8a6a8a', near: '#5a4a6a', grass: '#6aa25a', dirt: '#6a4a3a', rock: '#6a5a5a', water: '#3a6aa8', sky: 'day', ridges: 'peaks', decor: 'none' },
};

/** A cheap, repeatable pseudo-random value in [0, 1) for scenery placement. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, theme: Theme, camera: Camera, now: number): void {
  const w = camera.width;
  const h = camera.height;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (theme.sky === 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i += 1) {
      const x = ((((i * 137.5 - camera.x * 0.05) % (w + 40)) + w + 40) % (w + 40)) - 20;
      const y = (i * 71.3) % (h * 0.6);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 500 + i);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if (theme.sky === 'day') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i += 1) {
      const span = w + 300;
      const x = ((((i * 420 - camera.x * 0.15 * camera.scale + now * 0.006) % span) + span) % span) - 150;
      cloud(ctx, x, h * (0.12 + 0.08 * (i % 3)), 28 + (i % 2) * 10);
    }
  }

  const ground = camera.toScreen({ x: 0, y: GROUND_Y }).y;
  if (theme.decor === 'tower') haunted(ctx, camera, ground, now);
  if (theme.decor === 'lake') lake(ctx, theme, camera, ground, now);
  ridge(ctx, theme.far, ground, camera, 0.2, 150, 0.004, theme.ridges);
  if (theme.decor === 'pipes') pipes(ctx, camera, ground);
  if (theme.decor === 'beams') beams(ctx, camera, ground, now);
  ridge(ctx, theme.near, ground, camera, 0.45, 90, 0.007, theme.ridges);
  if (theme.decor === 'trees') trees(ctx, camera, ground);
  if (theme.decor === 'stalactites') stalactites(ctx, theme, camera);
  if (theme.decor === 'embers') embers(ctx, camera, ground, now);
}

function ridge(
  ctx: CanvasRenderingContext2D, color: string, base: number, camera: Camera,
  parallax: number, height: number, freq: number, shape: Theme['ridges'],
): void {
  const offset = camera.x * camera.scale * parallax;
  const hh = height * Math.max(camera.scale, 0.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 2);
  for (let x = 0; x <= camera.width + 20; x += 20) {
    const u = ((x + offset) * freq) / Math.max(camera.scale, 0.3);
    const wave = shape === 'hills'
      ? 0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.7 + 1)
      // Peaks: folded sines give sharp tops.
      : 0.35 + 0.55 * Math.abs(Math.sin(u * 0.8)) + 0.12 * Math.sin(u * 3.1);
    ctx.lineTo(x, base - hh * wave);
  }
  ctx.lineTo(camera.width + 20, base + 2);
  ctx.closePath();
  ctx.fill();
}

/** Loop scenery every `period` screen pixels, scrolled by `parallax`. */
function repeat(camera: Camera, parallax: number, period: number, draw: (x: number, i: number) => void): void {
  const offset = camera.x * camera.scale * parallax;
  const first = Math.floor(offset / period) - 1;
  for (let i = first; i * period - offset < camera.width + period; i += 1) draw(i * period - offset, i);
}

function trees(ctx: CanvasRenderingContext2D, camera: Camera, ground: number): void {
  const s = Math.max(camera.scale, 0.45);
  repeat(camera, 0.6, 90 * s, (x, i) => {
    const h = (120 + hash(i) * 90) * s;
    const w = (40 + hash(i + 7) * 24) * s;
    ctx.fillStyle = '#3b2a1c';
    ctx.fillRect(x - 4 * s, ground - h * 0.35, 8 * s, h * 0.35);
    ctx.fillStyle = i % 3 === 0 ? '#2f6e32' : '#3a7f3a';
    for (let k = 0; k < 3; k += 1) {
      const top = ground - h + k * h * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - w / 2 - k * 6 * s, top + h * 0.45);
      ctx.lineTo(x + w / 2 + k * 6 * s, top + h * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function stalactites(ctx: CanvasRenderingContext2D, theme: Theme, camera: Camera): void {
  const s = Math.max(camera.scale, 0.45);
  ctx.fillStyle = theme.far;
  repeat(camera, 0.3, 60 * s, (x, i) => {
    const len = (30 + hash(i) * 70) * s;
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, 0);
    ctx.lineTo(x + 14 * s, 0);
    ctx.lineTo(x + hash(i + 3) * 6 * s, len);
    ctx.closePath();
    ctx.fill();
  });
}

function haunted(ctx: CanvasRenderingContext2D, camera: Camera, ground: number, now: number): void {
  const s = Math.max(camera.scale, 0.45);
  // Pokémon Tower, far off, with a light in the top window.
  const x = camera.width * 0.72 - camera.x * camera.scale * 0.08;
  ctx.fillStyle = '#2a1f3d';
  for (let k = 0; k < 6; k += 1) {
    const tw = (120 - k * 14) * s;
    ctx.fillRect(x - tw / 2, ground - (k + 1) * 55 * s, tw, 56 * s);
  }
  ctx.fillStyle = `rgba(255, 220, 140, ${0.5 + 0.3 * Math.sin(now / 700)})`;
  ctx.fillRect(x - 6 * s, ground - 320 * s, 12 * s, 16 * s);
  // Low fog.
  const fog = ctx.createLinearGradient(0, ground - 80 * s, 0, ground);
  fog.addColorStop(0, 'rgba(200, 190, 230, 0)');
  fog.addColorStop(1, 'rgba(200, 190, 230, 0.25)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, ground - 80 * s, camera.width, 80 * s);
}

function pipes(ctx: CanvasRenderingContext2D, camera: Camera, ground: number): void {
  const s = Math.max(camera.scale, 0.45);
  for (const [y, color] of [[160, '#4a4f58'], [230, '#3c4048']] as const) {
    ctx.fillStyle = color;
    ctx.fillRect(0, ground - y * s, camera.width, 14 * s);
  }
  repeat(camera, 0.35, 260 * s, (x, i) => {
    ctx.fillStyle = '#3c4048';
    ctx.fillRect(x, ground - 240 * s, 12 * s, 240 * s);
    if (i % 2 === 0) {
      // Team Rocket's emblem, painted on the wall.
      ctx.fillStyle = 'rgba(200, 40, 50, 0.55)';
      ctx.font = `900 ${60 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('R', x + 130 * s, ground - 150 * s);
    }
  });
}

function beams(ctx: CanvasRenderingContext2D, camera: Camera, ground: number, now: number): void {
  const s = Math.max(camera.scale, 0.45);
  ctx.fillStyle = '#3a2413';
  ctx.fillRect(0, ground - 300 * s, camera.width, 16 * s);
  repeat(camera, 0.35, 200 * s, (x, i) => {
    ctx.fillStyle = '#3a2413';
    ctx.fillRect(x - 10 * s, ground - 300 * s, 20 * s, 300 * s);
    if (i % 2 === 0) {
      const glow = 0.6 + 0.15 * Math.sin(now / 400 + i);
      ctx.fillStyle = `rgba(255, 190, 90, ${glow})`;
      ctx.beginPath();
      ctx.arc(x + 100 * s, ground - 220 * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function embers(ctx: CanvasRenderingContext2D, camera: Camera, ground: number, now: number): void {
  for (let i = 0; i < 40; i += 1) {
    const rise = ((now * 0.03 + hash(i) * 600) % 600);
    const x = ((hash(i + 1) * camera.width + Math.sin(now / 900 + i) * 20) % camera.width);
    const y = ground - rise;
    ctx.fillStyle = `rgba(255, ${120 + Math.floor(hash(i + 2) * 80)}, 40, ${1 - rise / 600})`;
    ctx.fillRect(x, y, 3, 3);
  }
}

function lake(ctx: CanvasRenderingContext2D, theme: Theme, camera: Camera, ground: number, now: number): void {
  const s = Math.max(camera.scale, 0.45);
  const top = ground - 60 * s;
  ctx.fillStyle = theme.water;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, top, camera.width, 60 * s);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k += 1) {
    ctx.beginPath();
    const y = top + (10 + k * 12) * s;
    for (let x = 0; x <= camera.width; x += 30) ctx.lineTo(x, y + Math.sin(x / 40 + now / 600 + k) * 2);
    ctx.stroke();
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y - r * 0.4, r * 0.9, 0, Math.PI * 2);
  ctx.arc(x + r * 2, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}
