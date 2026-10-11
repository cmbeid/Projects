import { BIOME, FAUNA_DEF } from '../data/biomes';
import { tileAt } from '../game/away/gen';
import { drawSprite, frameOf } from '../sprites/atlas';
import type { AwayState } from '../state/types';

/**
 * The landing, top-down. The camera follows the explorer; tiles are 12-pixel
 * sprites drawn at whatever integer scale shows about a dozen across.
 */
export interface Camera {
  x: number;
  y: number;
}

const T = 12;

export function awayScale(w: number, h: number): number {
  return Math.max(2, Math.round(Math.min(w, h * 0.7) / (T * 12)));
}

function arrow(ctx: CanvasRenderingContext2D, w: number, h: number, sx: number, sy: number, color: string, k: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const margin = k * 10;
  // Keep clear of the meters at the top.
  const top = Math.min(h * 0.25, margin * 6);
  if (sx > margin && sx < w - margin && sy > top && sy < h - margin) return;
  const sc = Math.min((w / 2 - margin) / Math.abs(dx || 1), ((dy < 0 ? h / 2 - top : h / 2 - margin * 1.6)) / Math.abs(dy || 1));
  const ax = cx + dx * sc;
  const ay = cy + dy * sc;
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#05070e';
  ctx.lineWidth = k * 0.6;
  ctx.beginPath();
  ctx.moveTo(k * 5, 0);
  ctx.lineTo(-k * 3, -k * 3.5);
  ctx.lineTo(-k * 3, k * 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawAway(ctx: CanvasRenderingContext2D, w: number, h: number, a: AwayState, cam: Camera, t: number): void {
  const b = BIOME.get(a.biome)!;
  const k = awayScale(w, h);
  const ts = T * k;
  // Ease the camera toward the explorer.
  cam.x += (a.x - cam.x) * 0.15;
  cam.y += (a.y - cam.y) * 0.15;
  const ox = Math.round(w / 2 - cam.x * ts);
  const oy = Math.round(h / 2 - cam.y * ts);
  ctx.fillStyle = b.sky;
  ctx.fillRect(0, 0, w, h);
  const x0 = Math.max(0, Math.floor(-ox / ts));
  const y0 = Math.max(0, Math.floor(-oy / ts));
  const x1 = Math.min(a.w - 1, Math.ceil((w - ox) / ts));
  const y1 = Math.min(a.h - 1, Math.ceil((h - oy) / ts));
  const lf = Math.floor(t * 2) % 2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = a.tiles[y * a.w + x]!;
      let name: string;
      if (ch === '#') name = tileAt(a, x, y + 1) === '#' ? `tile-${b.id}-rock` : `tile-${b.id}-wall`;
      else if (ch === '~') name = `tile-${b.id}-liquid${(lf + x) % 2}`;
      else if (ch === ',') name = `tile-${b.id}-hazard`;
      else name = `tile-${b.id}-floor${(x * 7 + y * 13) % 11 === 0 ? 1 : 0}`;
      drawSprite(ctx, name, ox + x * ts, oy + y * ts, k);
    }
  }
  const at = (x: number, y: number): [number, number] => [ox + x * ts, oy + y * ts];
  const centred = (name: string, x: number, y: number, flip = false): void => {
    const [, , fw, fh] = frameOf(name);
    const [sx, sy] = at(x, y);
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(sx), 0);
      ctx.scale(-1, 1);
      drawSprite(ctx, name, -(fw * k) / 2, sy - (fh * k) / 2, k);
      ctx.restore();
    } else drawSprite(ctx, name, sx - (fw * k) / 2, sy - (fh * k) / 2, k);
  };
  centred('ent-lander', a.lander.x, a.lander.y);
  for (const e of a.ents) {
    if (e.k === 'node') centred(`ent-node-${e.mat}`, e.x, e.y);
    else if (e.k === 'cache') centred('ent-cache', e.x, e.y);
    else if (e.k === 'terminal') centred('ent-terminal', e.x, e.y);
    else if (e.k === 'pod') centred('ent-pod', e.x, e.y + Math.sin(t * 3) * 0.05);
    else if (e.k === 'objective') centred('ent-objective', e.x, e.y + Math.sin(t * 4) * 0.08);
    else if (e.k === 'turret') centred('ent-turret', e.x, e.y);
    else if (e.k === 'fauna') {
      const name = e.alpha ? `fauna-${e.fauna}-alpha` : `fauna-${e.fauna}-${Math.floor(t * 5 + e.id) % 2}`;
      if (e.hurt) ctx.globalAlpha = 0.5;
      centred(name, e.x, e.y, a.x < e.x);
      ctx.globalAlpha = 1;
      if ((e.hp ?? 0) < (e.maxHp ?? 0)) {
        const [sx, sy] = at(e.x, e.y);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - ts * 0.4, sy - ts * 0.7, ts * 0.8, k);
        ctx.fillStyle = FAUNA_DEF.get(e.fauna!)!.color;
        ctx.fillRect(sx - ts * 0.4, sy - ts * 0.7, ts * 0.8 * Math.max(0, (e.hp ?? 0) / (e.maxHp ?? 1)), k);
      }
    }
  }
  // The explorer.
  const moving = Math.floor(t * 8) % 2;
  centred(`explorer-${a.stats.cls}-${moving}`, a.x, a.y, a.fx < -0.1);
  // Shots.
  for (const sh of a.shots) {
    const [sx, sy] = at(sh.x, sh.y);
    ctx.fillStyle = sh.from === 'player' ? '#a0f0ff' : '#ffd040';
    ctx.fillRect(Math.round(sx - k), Math.round(sy - k), k * 2, k * 2);
  }
  // Hazard tint when the suit is taking it.
  const here = tileAt(a, a.x, a.y);
  if (here === ',' || (here === '~' && b.liquid !== 'water')) {
    ctx.fillStyle = a.shield > 0 ? 'rgba(90,160,240,0.12)' : 'rgba(255,60,60,0.18)';
    ctx.fillRect(0, 0, w, h);
  }
  if (a.o2 < a.o2Max * 0.2) {
    ctx.fillStyle = `rgba(255,60,60,${(0.08 + 0.08 * Math.sin(t * 6)).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  // Pop-up text.
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(k * 5)}px Silkscreen, monospace`;
  for (const p of a.pops) {
    const [sx, sy] = at(p.x, p.y - p.t * 0.8);
    ctx.globalAlpha = Math.max(0, 1 - p.t);
    ctx.fillStyle = '#000';
    ctx.fillText(p.text, sx + k * 0.5, sy + k * 0.5);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, sx, sy);
  }
  ctx.globalAlpha = 1;
  // Beacons off-screen: the lander, sleepers, the objective, and anything surveyed.
  const [lx, ly] = at(a.lander.x, a.lander.y);
  arrow(ctx, w, h, lx, ly, '#5ad0f0', k);
  for (const e of a.ents) {
    const color = e.k === 'pod' ? '#a0f0a0' : e.k === 'objective' ? '#f0d040' : e.marked ? '#c090f0' : null;
    if (!color) continue;
    const [sx, sy] = at(e.x, e.y);
    arrow(ctx, w, h, sx, sy, color, k * 0.8);
  }
}
