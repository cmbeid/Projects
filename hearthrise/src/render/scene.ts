import { BUILDING } from '../data/buildings';
import { DISTRICTS, GRID_H, GRID_W, districtAt, districtIndex, wardOfRow } from '../data/districts';
import { MATERIAL } from '../data/materials';
import { BALANCE } from '../data/progression';
import type { District } from '../data/types';
import { derive, seeping } from '../game/derive';
import type { GameEvent } from '../game/events';
import { buildingAt, canPlace, flooded, gustOpen, previewPlacement, tidal, tideHigh } from '../game/grid';
import { districtText, hasFlag } from '../game/story';
import { fmt } from '../num/format';
import { drawSprite, drawSpriteRotated, frameOf } from '../sprites/atlas';
import type { GameState } from '../state/types';

/** What the UI is doing with the grid, for the scene to draw. */
export interface View {
  district: number;
  /** A building type being placed, or a building (by uid) being moved. */
  placing: string | null;
  moving: number | null;
  /** The tile under the pointer, in grid coordinates, while placing. */
  hover: { x: number; y: number } | null;
  selected: number | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

interface Floater {
  /** Floaters of a kind are capped so a Festival does not bury the scene in numbers. */
  kind: 'hit' | 'loot' | 'event';
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
  size: number;
}

interface Flyer {
  sprite: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
}

interface Walker {
  x: number;
  y: number;
  tx: number;
  ty: number;
  look: number;
  wait: number;
}

const FONT = '"Silkscreen", "Pixelify Sans", ui-monospace, monospace';

/** A day in the city, in seconds. */
const DAY = 480;

/**
 * The city, drawn on a canvas: sky and sea and the Spire on the horizon,
 * one district's grid with its buildings and citizens, and beside it the
 * work site where the Founder is taking the next ruin apart. Purely a view —
 * it reads the state and listens to game events, and never changes either.
 */
export class Scene {
  /** Height kept clear for the objective and the district chip. */
  static readonly TOP_RESERVE = 48;
  /** Height kept clear for the edict buttons along the bottom. */
  static readonly BOTTOM_RESERVE = 64;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** Grid placement and tile size in CSS pixels. */
  private gx = 0;
  private gy = 0;
  private tile = 24;
  /** The work site: centre of the ruin, and its pixel scale. */
  private bx = 0;
  private by = 0;
  private S = 4;
  private siteX = 0;
  private horizon = 0;
  private time = 0;
  private shake = 0;
  private swing = 1;
  private flash = 0;
  private tideWipe = 0;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private flyers: Flyer[] = [];
  private walkers: Walker[] = [];
  private walkersFor = -1;
  private banner: { title: string; sub: string; t: number } | null = null;
  private ruinVariant = 0;
  /** Where salvage flies to: the coin chip in the top bar, in canvas pixels. */
  flyTarget = { x: 24, y: 8 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    const top = Scene.TOP_RESERVE;
    const free = Math.max(120, this.h - top - Scene.BOTTOM_RESERVE);
    // The grid takes the left three fifths, the work site the rest.
    const gridArea = Math.round(this.w * 0.6);
    this.tile = Math.max(14, Math.floor(Math.min((gridArea - 12) / GRID_W, (free - 6) / GRID_H)));
    this.gx = Math.round((gridArea - this.tile * GRID_W) / 2) + 4;
    this.gy = Math.round(top + (free - this.tile * GRID_H) / 2);
    this.siteX = gridArea;
    const siteW = this.w - gridArea;
    // The ruin is 16 pixels; the bar and label under it take about S + 30 more.
    this.S = Math.max(2, Math.floor(Math.min((siteW * 0.5) / 16, (free - 40) / 20)));
    this.bx = Math.round(gridArea + siteW * 0.6);
    this.by = Math.round(top + Math.max(0, (free - (16 * this.S + 36)) / 2) + 8 * this.S + 6);
    this.horizon = Math.round(top + free * 0.12);
    this.walkersFor = -1;
  }

  /** The grid tile under a point, or null. */
  tileAt(px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.gx) / this.tile);
    const y = Math.floor((py - this.gy) / this.tile);
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
    return { x, y };
  }

  /** The middle of a tile in canvas pixels; for the browser checks. */
  tileCenter(x: number, y: number): { x: number; y: number } {
    return { x: this.gx + (x + 0.5) * this.tile, y: this.gy + (y + 0.5) * this.tile };
  }

  /** Whether a point is on the work site (where a tap swings the hammer). */
  inSite(px: number): boolean {
    return px >= this.siteX;
  }

  private ruinRect(): { x: number; y: number; size: number } {
    const size = 16 * this.S;
    return { x: this.bx - size / 2, y: this.by - size / 2, size };
  }

  onEvent(e: GameEvent, s: GameState, view: View): void {
    const { x, y, size } = this.ruinRect();
    const cx = x + size / 2;
    const cy = y + size / 2;
    const district = districtAt(s.ward);
    switch (e.type) {
      case 'hit': {
        if (e.auto) break;
        this.swing = 0;
        this.shake = Math.min(1, this.shake + (e.crit ? 0.8 : 0.35));
        const n = e.crit ? 10 : 4;
        for (let i = 0; i < n; i++) this.chip(cx - size * 0.35, cy + (Math.random() - 0.5) * size * 0.5, district.ruin[2 + (i % 2)]!, -1);
        this.addFloater({
          kind: 'hit',
          text: e.crit ? `${fmt(e.damage)}!` : fmt(e.damage),
          x: cx + (Math.random() - 0.5) * size * 0.6,
          y: y - 4,
          life: 1,
          color: e.crit ? '#ffd84a' : '#fff8ea',
          size: e.crit ? 17 : 12,
        });
        break;
      }
      case 'clear': {
        const mat = MATERIAL.get(e.salvage);
        this.flash = e.landmark ? 1 : Math.max(this.flash, 0.3);
        for (let i = 0; i < (e.landmark ? 40 : 16); i++) {
          this.chip(cx + (Math.random() - 0.5) * size, cy + (Math.random() - 0.5) * size, i % 3 === 0 && mat ? mat.shades[1] : district.ruin[1 + (i % 3)]!, 0);
        }
        if (!e.auto || Math.random() < 0.4) {
          this.flyers.push({ sprite: `item-${e.salvage}`, x: cx, y: cy, tx: this.flyTarget.x, ty: this.flyTarget.y, t: 0 });
        }
        this.addFloater({ kind: 'loot', text: `+${fmt(e.qty)} ${mat?.name ?? e.salvage}`, x: cx, y: y + size + 30, life: 1.3, color: mat?.shades[2] ?? '#fff', size: 11 });
        this.ruinVariant = (this.ruinVariant + 1) % 2;
        break;
      }
      case 'relic':
      case 'heart': {
        const mat = MATERIAL.get(e.id);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.8, max: 0.8, size: 2, color: mat?.shades[2] ?? '#fff', gravity: 0 });
        }
        this.flyers.push({ sprite: `item-${e.id}`, x: cx, y: cy - 10, tx: this.flyTarget.x, ty: this.flyTarget.y, t: -0.3 });
        this.addFloater({ kind: 'event', text: `${mat?.name ?? e.id}!`, x: cx, y: y - 22, life: 1.6, color: mat?.shades[2] ?? '#fff', size: 13 });
        break;
      }
      case 'ward': {
        const d = districtAt(e.ward);
        this.banner = e.districtChanged
          ? { title: districtText(s, d).name, sub: `${d.era} · ward ${e.ward}`, t: 0 }
          : { title: e.opened ? `Ward ${e.ward} opened` : `Ward ${e.ward}`, sub: e.opened ? 'New ground to build on' : '', t: 0.6 };
        break;
      }
      case 'level':
        this.addFloater({ kind: 'event', text: `Level ${e.level}`, x: this.bx - size * 0.8, y: y - 8, life: 2, color: '#9ae07a', size: 14 });
        break;
      case 'place':
      case 'demolish': {
        const b = s.buildings.find((q) => q.uid === e.uid);
        if (e.type === 'place' && (!b || b.district !== view.district)) break;
        const def = b && BUILDING.get(b.type);
        const px = b && def ? this.gx + (b.x + def.w / 2) * this.tile : this.gx + (GRID_W * this.tile) / 2;
        const py = b && def ? this.gy + (b.y + def.h) * this.tile : this.gy + GRID_H * this.tile;
        for (let i = 0; i < 18; i++) this.chip(px + (Math.random() - 0.5) * this.tile, py - 2, i % 2 ? '#d8c8a8' : '#a89878', -2, 70);
        break;
      }
      case 'edict':
        this.shake = 1;
        this.flash = Math.max(this.flash, e.id === 'charge' ? 1 : 0.35);
        if (e.id === 'charge') for (let i = 0; i < 50; i++) this.chip(cx, cy, i % 2 ? '#ffb040' : '#ff6020', 0, 260);
        if (e.id === 'festival') {
          for (let i = 0; i < 60; i++) {
            const colors = ['#ff5a5a', '#ffd84a', '#5ab0ff', '#9ae07a', '#ff9ae0'];
            this.particles.push({ x: Math.random() * this.w, y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 40, vy: 30 + Math.random() * 40, life: 4, max: 4, size: 3, color: colors[i % colors.length]!, gravity: 10 });
          }
        }
        break;
      case 'tide':
        this.banner = { title: 'The sea comes in', sub: `+${fmt(e.memories)} Memories`, t: 0 };
        this.tideWipe = 1;
        this.walkersFor = -1;
        break;
      default:
        break;
    }
  }

  private addFloater(f: Floater): void {
    const cap = f.kind === 'hit' ? 4 : f.kind === 'loot' ? 1 : 2;
    const same = this.floaters.filter((x) => x.kind === f.kind);
    for (const old of same.slice(0, Math.max(0, same.length - cap + 1))) old.life = 0;
    this.floaters.push(f);
  }

  /** A flying chip of something. `dir` −1 flies back toward the Founder, −2 puffs up like dust. */
  private chip(x: number, y: number, color: string, dir: number, speed = 140): void {
    const a = dir === -1 ? Math.PI + (Math.random() - 0.5) * 1.6 : dir === -2 ? -Math.PI / 2 + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    this.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (dir === -2 ? 10 : 60), life: 0.7 + Math.random() * 0.4, max: 1.1,
      size: Math.max(2, Math.round(this.S / 3)), color, gravity: dir === -2 ? 60 : 420,
    });
  }

  /** 0 at noon, 1 at midnight. */
  night(s: GameState): number {
    return (1 - Math.cos(((s.time % DAY) / DAY) * Math.PI * 2)) / 2;
  }

  frame(dt: number, s: GameState, view: View): void {
    const { ctx } = this;
    this.time += dt;
    const district = DISTRICTS[view.district]!;
    const work = districtAt(s.ward);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    this.drawBackdrop(s, district);

    this.shake = Math.max(0, this.shake - dt * 4);
    this.drawGrid(s, district, view, dt);
    this.drawSite(s, work, dt);
    this.drawWeather(s, work);

    // Particles.
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0 || p.y > this.h + 20) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.min(1, p.life / Math.min(0.4, p.max));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      alive.push(p);
    }
    this.particles = alive.length > 400 ? alive.slice(-400) : alive;
    ctx.globalAlpha = 1;

    // Salvage flying up to the purse.
    this.flyers = this.flyers.filter((f) => (f.t += dt * 1.6) < 1);
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const t = f.t;
      const ease = t * t * (3 - 2 * t);
      const fx = f.x + (f.tx - f.x) * ease;
      const fy = f.y + (f.ty - f.y) * ease - Math.sin(t * Math.PI) * 60;
      ctx.globalAlpha = 1 - Math.max(0, t - 0.8) * 5;
      const [, , fw] = frameOf(f.sprite);
      drawSprite(ctx, f.sprite, fx - fw, fy - fw, 2);
      ctx.globalAlpha = 1;
    }

    // Floating numbers.
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      f.y -= dt * 30;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `${f.size}px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // Evening comes down over everything, and the windows stay lit.
    const night = this.night(s);
    if (night > 0.55) {
      ctx.fillStyle = `rgba(16,20,48,${((night - 0.55) * 0.75).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,230,${this.flash * 0.22})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash = Math.max(0, this.flash - dt * 3);
    }
    if (this.tideWipe > 0) {
      // The sea rises over the whole screen and drains away again.
      const t = 1 - this.tideWipe;
      const level = this.h * (1 - Math.sin(Math.min(1, t * 1.4) * Math.PI));
      ctx.fillStyle = '#2a6a98e0';
      ctx.fillRect(0, level, this.w, this.h - level);
      ctx.fillStyle = '#c8f0ffc0';
      ctx.fillRect(0, level, this.w, 3);
      this.tideWipe = Math.max(0, this.tideWipe - dt * 0.4);
    }

    this.drawBanner(dt);
    this.drawHazard(s, work);
  }

  private drawBackdrop(s: GameState, district: District): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.horizon);
    g.addColorStop(0, district.sky[1]);
    g.addColorStop(1, district.sky[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.horizon);

    // The Spire, out in the bay, always. Lit at night once you have heard it.
    const sx = Math.round(this.w * 0.83);
    const sw = Math.max(4, Math.round(this.w * 0.018));
    ctx.fillStyle = '#e8e8f2';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(sx - sw / 2, 0, sw, this.horizon);
    ctx.fillRect(sx - sw, this.horizon - 6, sw * 2, 6);
    ctx.globalAlpha = 1;
    const night = this.night(s);
    if (hasFlag(s, 'heard') && night > 0.5) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (hasFlag(s, 'rang') ? 1.4 : 0.6));
      const lg = ctx.createRadialGradient(sx, this.horizon * 0.4, 0, sx, this.horizon * 0.4, 30);
      const a = Math.round((night - 0.5) * 2 * 160 * pulse).toString(16).padStart(2, '0');
      lg.addColorStop(0, `#c8d0ff${a}`);
      lg.addColorStop(1, '#c8d0ff00');
      ctx.fillStyle = lg;
      ctx.fillRect(sx - 30, this.horizon * 0.4 - 30, 60, 60);
    }

    // The sea, with the light lying on it in broken lines.
    ctx.fillStyle = hasFlag(s, 'rang') ? '#3a7a9a' : '#2a5a7a';
    ctx.fillRect(0, this.horizon, this.w, this.h - this.horizon);
    ctx.fillStyle = '#ffffff22';
    for (let i = 0; i < 18; i++) {
      const y = this.horizon + 4 + ((i * 37) % Math.max(1, this.h - this.horizon));
      const x = ((i * 113 + this.time * (6 + (i % 3) * 4)) % (this.w + 60)) - 30;
      ctx.fillRect(Math.round(x), Math.round(y), 10 + (i % 4) * 6, 1);
    }
  }

  private drawGrid(s: GameState, district: District, view: View, dt: number): void {
    const ctx = this.ctx;
    const T = this.tile;
    const di = view.district;
    const scale = T / 16;
    const frontier = s.maxWard + 1;
    const clearing = s.autoAdvance && s.ward === s.maxWard ? Math.floor((s.ruinsHere / BALANCE.ruinsPerWard) * GRID_W) : 0;
    const shore = this.tile / 4;

    // A sandy shore under the whole grid, so it reads as land in the sea.
    ctx.fillStyle = '#c8b48a';
    ctx.fillRect(this.gx - shore, this.gy - shore, GRID_W * T + shore * 2, GRID_H * T + shore * 2);
    for (let y = 0; y < GRID_H; y++) {
      const ward = wardOfRow(di, y);
      for (let x = 0; x < GRID_W; x++) {
        const px = this.gx + x * T;
        const py = this.gy + y * T;
        const open = ward <= s.maxWard;
        const beingCleared = ward === frontier && x < clearing;
        ctx.fillStyle = open || beingCleared ? district.ground[(x + y) % 2]! : district.ruin[1];
        ctx.fillRect(px, py, T, T);
        if (!open && !beingCleared) drawSprite(ctx, `rubble-${district.id}`, px, py, scale);
        if (beingCleared) {
          ctx.fillStyle = '#00000030';
          for (let k = 0; k < T; k += 4) ctx.fillRect(px + k, py, 1, T);
        }
      }
      // The row being cleared now is outlined in the district's light.
      if (ward === frontier && districtIndex(s.ward) === di) {
        ctx.strokeStyle = `${district.glow}${Math.round(120 + 100 * Math.sin(this.time * 3)).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.gx + 1, this.gy + y * T + 1, GRID_W * T - 2, T - 2);
      }
    }

    // The Harbour's low rows at high tide.
    if (district.hazard === 'tide') {
      const walled = s.fixtures.includes('seawall');
      if (tideHigh(s) && !walled && s.buffs.calm <= 0) {
        const swell = Math.sin(this.time * 1.2) * 3;
        ctx.fillStyle = '#3a8ac090';
        ctx.fillRect(this.gx, this.gy + (GRID_H - 2) * T - swell, GRID_W * T, 2 * T + swell);
        ctx.fillStyle = '#c8f0ff90';
        ctx.fillRect(this.gx, this.gy + (GRID_H - 2) * T - swell, GRID_W * T, 2);
      } else if (walled) {
        ctx.fillStyle = '#8a4a3a';
        ctx.fillRect(this.gx - shore, this.gy + GRID_H * T, GRID_W * T + shore * 2, shore);
      }
    }

    // Buildings, back rows first.
    const here = s.buildings.filter((b) => b.district === di).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const b of here) {
      if (b.uid === view.moving) continue;
      const def = BUILDING.get(b.type);
      if (!def) continue;
      const px = this.gx + b.x * T;
      const py = this.gy + b.y * T;
      drawSprite(ctx, `bld-${b.type}`, px, py, scale);
      if (flooded(s, b)) {
        ctx.fillStyle = '#3a8ac070';
        ctx.fillRect(px, py + T * def.h * 0.5, T * def.w, T * def.h * 0.5);
      }
      if (b.lvl > 1) {
        const label = String(b.lvl);
        ctx.font = `${Math.max(8, Math.round(T * 0.3))}px ${FONT}`;
        const tw = ctx.measureText(label).width + 4;
        const lx = px + T * def.w - tw - 1;
        const ly = py + 1;
        ctx.fillStyle = '#000000b0';
        ctx.fillRect(lx, ly, tw, Math.round(T * 0.34) + 2);
        ctx.fillStyle = '#ffe08a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, lx + 2, ly + 1);
      }
      if (b.uid === view.selected) {
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, T * def.w - 2, T * def.h - 2);
      }
    }

    this.drawWalkers(s, di, dt);

    // The Spire's fog: thick over ground not yet won, a haze over the rest until it is lit.
    if (district.hazard === 'silence') {
      const d = derive(s);
      const thin = d.light >= BALANCE.fogLight && s.fixtures.includes('beacons');
      for (let y = 0; y < GRID_H; y++) {
        const open = wardOfRow(di, y) <= s.maxWard;
        const a = open ? (thin ? 0 : 0.25) : 0.6;
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(230,232,245,${(a + 0.05 * Math.sin(this.time * 0.8 + y)).toFixed(3)})`;
        ctx.fillRect(this.gx, this.gy + y * T, GRID_W * T, T);
      }
    }

    // A district not yet reached.
    if (district.from > s.maxWard) {
      ctx.fillStyle = '#000000a0';
      ctx.fillRect(this.gx, this.gy, GRID_W * T, GRID_H * T);
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4ecdc';
      ctx.fillText(`Opens at ward ${district.from}`, this.gx + (GRID_W * T) / 2, this.gy + (GRID_H * T) / 2);
    }

    this.drawGhost(s, view);
  }

  /** The building being placed or moved, under the pointer, with what its neighbours would make of it. */
  private drawGhost(s: GameState, view: View): void {
    const type = view.placing ?? (view.moving != null ? s.buildings.find((b) => b.uid === view.moving)?.type : undefined);
    if (!type || !view.hover) return;
    const def = BUILDING.get(type);
    if (!def) return;
    const ctx = this.ctx;
    const T = this.tile;
    const { x, y } = view.hover;
    const ok = canPlace(s, type, view.district, x, y, view.moving ?? undefined);
    const px = this.gx + x * T;
    const py = this.gy + y * T;
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(this.time * 6);
    drawSprite(ctx, `bld-${type}`, px, py, T / 16);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#9ae07a' : '#ff6a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, T * def.w - 2, T * def.h - 2);
    if (!ok) return;
    const p = previewPlacement(s, type, view.district, x, y, view.moving ?? undefined);
    ctx.font = `${Math.max(9, Math.round(T * 0.38))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = def.tag === 'green' ? `${p.neighbours.filter((n) => n.delta > 0).length} helped` : `×${p.self.toFixed(1)}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(label, px + (T * def.w) / 2, py - 2);
    ctx.fillStyle = p.self >= 1 ? '#c8ff9a' : '#ffb09a';
    ctx.fillText(label, px + (T * def.w) / 2, py - 2);
    // What the neighbours would each gain or lose.
    for (const n of p.neighbours) {
      if (!n.delta) continue;
      const b = s.buildings.find((q) => q.uid === n.uid);
      const nd = b && BUILDING.get(b.type);
      if (!b || !nd) continue;
      const nx = this.gx + (b.x + nd.w / 2) * T;
      const ny = this.gy + (b.y + nd.h / 2) * T;
      const t = n.delta > 0 ? `+${n.delta}` : String(n.delta);
      ctx.strokeText(t, nx, ny);
      ctx.fillStyle = n.delta > 0 ? '#c8ff9a' : '#ff8a7a';
      ctx.fillText(t, nx, ny);
    }
  }

  /** Citizens wandering the open ground of the district on screen. Purely for company. */
  private drawWalkers(s: GameState, di: number, dt: number): void {
    const open: { x: number; y: number }[] = [];
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (wardOfRow(di, y) <= s.maxWard) open.push({ x, y });
    if (!open.length) return;
    const homes = s.buildings.filter((b) => b.district === di && BUILDING.get(b.type)?.tag === 'home').length;
    const want = Math.min(12, homes * 2);
    if (this.walkersFor !== di) {
      this.walkers = [];
      this.walkersFor = di;
    }
    const pick = (): { x: number; y: number } => {
      const t = open[Math.floor(Math.random() * open.length)]!;
      return { x: t.x + 0.2 + Math.random() * 0.6, y: t.y + 0.5 + Math.random() * 0.4 };
    };
    while (this.walkers.length < want) {
      const a = pick();
      const b = pick();
      this.walkers.push({ x: a.x, y: a.y, tx: b.x, ty: b.y, look: Math.floor(Math.random() * 3), wait: Math.random() * 3 });
    }
    if (this.walkers.length > want) this.walkers.length = want;
    const ctx = this.ctx;
    const scale = Math.max(1, Math.round(this.tile / 22));
    for (const w of this.walkers) {
      if (w.wait > 0) w.wait -= dt;
      else {
        const dx = w.tx - w.x;
        const dy = w.ty - w.y;
        const dist = Math.hypot(dx, dy);
        const step = 0.7 * dt;
        if (dist <= step) {
          const n = pick();
          w.tx = n.x;
          w.ty = n.y;
          w.wait = 1 + Math.random() * 4;
        } else {
          w.x += (dx / dist) * step;
          w.y += (dy / dist) * step;
        }
      }
      const moving = w.wait <= 0;
      const frame = moving ? Math.floor(this.time * 6 + w.look) % 2 : 0;
      drawSprite(ctx, `walker-${w.look}-${frame}`, this.gx + w.x * this.tile - 4 * scale, this.gy + w.y * this.tile - 10 * scale, scale);
    }
  }

  private drawSite(s: GameState, district: District, dt: number): void {
    const ctx = this.ctx;
    const { x, y, size } = this.ruinRect();
    const S = this.S;
    const groundY = y + size;
    const sx = (Math.random() - 0.5) * this.shake * S * 0.8;
    const sy = (Math.random() - 0.5) * this.shake * S * 0.8;

    // The work site's own patch of shore.
    ctx.fillStyle = district.ground[0];
    ctx.fillRect(this.siteX + 4, groundY - 2, this.w - this.siteX - 4, Math.max(6, S));
    ctx.fillStyle = '#c8b48a';
    ctx.fillRect(this.siteX + 4, groundY - 2 + Math.max(6, S), this.w - this.siteX - 4, Math.max(3, S / 2));

    const ruin = s.ruin;
    drawSprite(ctx, ruin.landmark ? `landmark-${district.id}` : `ruin-${district.id}-${this.ruinVariant}`, x + sx, y + sy, S);
    if (!ruin.landmark) drawSprite(ctx, `bits-${ruin.salvage}`, x + sx, y + sy, S);
    else {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.fillStyle = district.glow;
      ctx.fillRect(x + 8 * S + sx, y + 6 * S + sy, 2 * S, 3 * S);
      ctx.globalAlpha = 1;
    }
    const frac = ruin.hp / ruin.maxHp;
    const crack = frac < 0.25 ? 3 : frac < 0.5 ? 2 : frac < 0.8 ? 1 : 0;
    if (crack) drawSprite(ctx, `crack-${crack}`, x + sx, y + sy, S);

    // The crews, chipping away beside it.
    const crewLevels = s.buildings.filter((b) => BUILDING.get(b.type)?.tag === 'crew').length;
    const workers = Math.min(3, crewLevels);
    const wS = Math.max(1, Math.floor(S * 0.45));
    for (let i = 0; i < workers; i++) {
      const bob = Math.floor(this.time * 5 + i * 1.7) % 2;
      drawSprite(ctx, `walker-${i % 3}-${bob}`, x + size - 2 * wS + i * 7 * wS, groundY - 10 * wS - bob * wS, wS);
    }

    // The Founder, breathing, and the hammer swinging.
    const mS = Math.max(1, Math.floor(S * 0.55));
    const mx = x - 16 * mS + S;
    const my = groundY - 23 * mS;
    const breathe = Math.floor(this.time * 1.5) % 2;
    drawSprite(ctx, `founder-${breathe}`, mx, my, mS);
    this.swing = Math.min(1, this.swing + dt * 7);
    const sw = this.swing;
    // Wind up, strike, then settle back to rest with the head lowered.
    const angle = sw < 0.15 ? 0.15 - (sw / 0.15) * 1.35 : sw < 0.35 ? -1.2 + ((sw - 0.15) / 0.2) * 1.9 : 0.7 - ((sw - 0.35) / 0.65) * 0.55;
    drawSpriteRotated(ctx, 'tool-hammer', mx + 13 * mS, my + (13 + breathe) * mS, mS, angle + 0.6, 14, 14);

    // HP bar, and pips counting toward the landmark.
    const barY = groundY + Math.max(10, S * 1.6);
    const barW = size;
    ctx.fillStyle = '#000000a0';
    ctx.fillRect(x - 2, barY - 2, barW + 4, 10);
    ctx.fillStyle = ruin.landmark ? district.glow : '#d8483a';
    ctx.fillRect(x, barY, Math.max(0, barW * frac), 6);
    if (s.autoAdvance) {
      const pip = barW / BALANCE.ruinsPerWard;
      for (let i = 0; i < BALANCE.ruinsPerWard; i++) {
        ctx.fillStyle = ruin.landmark || i < s.ruinsHere ? district.glow : '#ffffff40';
        ctx.fillRect(x + i * pip, barY + 10, Math.max(1, pip - 1), 3);
      }
    }
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const label = ruin.landmark ? 'LANDMARK' : (MATERIAL.get(ruin.salvage)?.name ?? '');
    ctx.strokeText(label, this.bx, barY + 16);
    ctx.fillStyle = '#f4ecdc';
    ctx.fillText(label, this.bx, barY + 16);
  }

  /** The Cloudline's gusts across everything, and the Undercroft's sea seeping into the ruin. */
  private drawWeather(s: GameState, work: District): void {
    const ctx = this.ctx;
    if (work.hazard === 'gale' && gustOpen(s) && !s.fixtures.includes('windbreaks') && s.buffs.calm <= 0) {
      ctx.fillStyle = '#ffffffa0';
      for (let i = 0; i < 26; i++) {
        const y = (i * 53 + Math.sin(i) * 20) % this.h;
        const x = ((i * 97 + this.time * (420 + (i % 5) * 60)) % (this.w + 120)) - 60;
        ctx.fillRect(Math.round(x), Math.round(y), 24 + (i % 4) * 10, 1);
      }
    }
    if (seeping(s)) {
      const { x, y, size } = this.ruinRect();
      ctx.fillStyle = '#6ad8ff';
      for (let i = 0; i < 6; i++) {
        const t = (this.time * 0.9 + i / 6) % 1;
        ctx.globalAlpha = 1 - t;
        ctx.fillRect(Math.round(x + ((i * 37) % size)), Math.round(y + t * size), 2, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawBanner(dt: number): void {
    const b = this.banner;
    if (!b) return;
    b.t += dt;
    if (b.t > 3) {
      this.banner = null;
      return;
    }
    const a = Math.min(1, b.t * 2, (3 - b.t) * 1.5);
    const ctx = this.ctx;
    const y = Scene.TOP_RESERVE + 24;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00000090';
    ctx.fillRect(0, y - 20, this.w, b.sub ? 48 : 32);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#fff4e0';
    ctx.fillText(b.title, this.w / 2, y - 3);
    if (b.sub) {
      ctx.font = `11px ${FONT}`;
      ctx.fillStyle = '#e0d4c0';
      ctx.fillText(b.sub, this.w / 2, y + 16);
    }
    ctx.globalAlpha = 1;
  }

  private drawHazard(s: GameState, work: District): void {
    const d = derive(s);
    if (!d.hazard.warning) return;
    const ctx = this.ctx;
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(this.time * 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const label = `⚠ ${work.hazard}`;
    ctx.strokeText(label, this.w - 8, this.h - Scene.BOTTOM_RESERVE + 2);
    ctx.fillStyle = '#ffb08a';
    ctx.fillText(label, this.w - 8, this.h - Scene.BOTTOM_RESERVE + 2);
    ctx.globalAlpha = 1;
  }

  /** Whether a building stands where a tap landed; for the UI's hit test. */
  buildingUnder(s: GameState, district: number, px: number, py: number): number | null {
    const t = this.tileAt(px, py);
    if (!t) return null;
    return buildingAt(s, district, t.x, t.y)?.uid ?? null;
  }
}

/** Re-exported so the UI does not reach into the grid for one check. */
export { tidal };
