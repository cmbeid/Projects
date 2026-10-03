import { biomeAt } from '../data/biomes';
import { MATERIAL } from '../data/materials';
import { BALANCE } from '../data/progression';
import type { Biome } from '../data/types';
import { derive } from '../game/derive';
import type { GameEvent } from '../game/events';
import { fmt } from '../num/format';
import { drawSprite, drawSpriteRotated, frameOf } from '../sprites/atlas';
import type { GameState } from '../state/types';

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
  glow?: boolean;
}

interface Floater {
  /** Floaters of a kind are capped so a Frenzy does not bury the rock in numbers. */
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

interface Eyes {
  x: number;
  y: number;
  t: number;
  life: number;
}

/** How dark each biome is outside the lamp's circle, 0–1. */
const DARKNESS: Record<string, number> = { topsoil: 0.5, fungal: 0.62, crystal: 0.5, magma: 0.4, hollow: 0.9 };

const FONT = '"Silkscreen", "Pixelify Sans", ui-monospace, monospace';

/**
 * The mine, drawn on a canvas: strata, the rock face, the miner and the
 * machines, particles, lamp light. Purely a view — it reads the state and
 * listens to game events, and never changes either.
 */
export class Scene {
  /** Height kept clear for the objective and depth chips. */
  static readonly TOP_RESERVE = 50;
  /** Height kept clear for the skill buttons along the bottom. */
  static readonly BOTTOM_RESERVE = 68;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fog = document.createElement('canvas');
  private readonly strata = document.createElement('canvas');
  private strataBiome = '';
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** Pixel scale of the rock face. Everything else is sized from it. */
  private S = 8;
  private bx = 0;
  private by = 0;
  private time = 0;
  private shake = 0;
  private swing = 1;
  private flash = 0;
  private scroll = 0;
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private flyers: Flyer[] = [];
  private eyes: Eyes[] = [];
  private banner: { title: string; sub: string; t: number } | null = null;
  private rockVariant = 0;
  /** Where ore flies to when mined: the inventory chip in the top bar, in canvas pixels. */
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
    this.fog.width = this.canvas.width;
    this.fog.height = this.canvas.height;
    // The HTML overlays own a strip at the top (objective, depth) and at the
    // bottom (skill buttons). The rock, its HP bar and its label must fit
    // between them, or on a short phone the skills sit on top of the label.
    const top = Scene.TOP_RESERVE;
    const free = Math.max(80, this.h - top - Scene.BOTTOM_RESERVE);
    // The face is 16 pixels; the bar and label under it take about S + 34 more.
    this.S = Math.max(2, Math.floor(Math.min((this.w * 0.4) / 16, (free - 34) / 17)));
    const stack = 17 * this.S + 34;
    this.bx = Math.round(this.w * 0.56);
    this.by = Math.round(top + Math.max(0, (free - stack) / 2) + 8 * this.S);
    this.strataBiome = '';
  }

  private blockRect(): { x: number; y: number; size: number } {
    const size = 16 * this.S;
    return { x: this.bx - size / 2, y: this.by - size / 2, size };
  }

  onEvent(e: GameEvent, s: GameState): void {
    const { x, y, size } = this.blockRect();
    const cx = x + size / 2;
    const cy = y + size / 2;
    const biome = biomeAt(s.depth);
    switch (e.type) {
      case 'hit': {
        if (e.auto) break;
        this.swing = 0;
        this.shake = Math.min(1, this.shake + (e.crit ? 0.8 : 0.35));
        const n = e.crit ? 10 : 4;
        for (let i = 0; i < n; i++) this.chip(cx - size * 0.35, cy + (Math.random() - 0.5) * size * 0.5, biome.rock[2 + (i % 2)]!, -1);
        this.addFloater({
          kind: 'hit',
          text: e.crit ? `${fmt(e.damage)}!` : fmt(e.damage),
          x: cx + (Math.random() - 0.5) * size * 0.6,
          y: y - 4,
          life: 1,
          color: e.crit ? '#ffd84a' : '#f4ecdc',
          size: e.crit ? 18 : 13,
        });
        break;
      }
      case 'break': {
        const ore = MATERIAL.get(e.ore);
        this.flash = e.seam ? 1 : 0.5;
        for (let i = 0; i < (e.seam ? 40 : 18); i++) {
          this.chip(cx + (Math.random() - 0.5) * size, cy + (Math.random() - 0.5) * size, i % 3 === 0 && ore ? ore.shades[1] : biome.rock[1 + (i % 3)]!, 0);
        }
        if (!e.auto || Math.random() < 0.5) {
          this.flyers.push({ sprite: `item-${e.ore}`, x: cx, y: cy, tx: this.flyTarget.x, ty: this.flyTarget.y, t: 0 });
        }
        this.addFloater({
          kind: 'loot',
          text: `+${fmt(e.qty)} ${ore?.name ?? e.ore}${e.shatter ? ' ×2' : ''}`,
          x: cx,
          y: y + size + 22,
          life: 1.3,
          color: ore?.shades[2] ?? '#fff',
          size: 12,
        });
        this.rockVariant = (this.rockVariant + 1) % 2;
        break;
      }
      case 'gem':
      case 'essence': {
        const mat = MATERIAL.get(e.id);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.push({
            x: cx, y: cy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.8, max: 0.8,
            size: 2, color: mat?.shades[2] ?? '#fff', gravity: 0, glow: true,
          });
        }
        this.flyers.push({ sprite: `item-${e.id}`, x: cx, y: cy - 10, tx: this.flyTarget.x, ty: this.flyTarget.y, t: -0.3 });
        this.addFloater({ kind: 'event', text: `${mat?.name ?? e.id}!`, x: cx, y: y - 24, life: 1.6, color: mat?.shades[2] ?? '#fff', size: 15 });
        break;
      }
      case 'depth': {
        this.scroll = 1;
        const b = biomeAt(e.depth);
        this.banner = e.biomeChanged
          ? { title: b.name, sub: `Depth ${e.depth}`, t: 0 }
          : { title: `Depth ${e.depth}`, sub: '', t: 0.6 };
        break;
      }
      case 'level':
        this.addFloater({ kind: 'event', text: `Level ${e.level}`, x: this.bx - size * 0.9, y: y - 10, life: 2, color: '#9ae07a', size: 16 });
        for (let i = 0; i < 24; i++) {
          this.particles.push({
            x: this.bx - size * 0.95 + (Math.random() - 0.5) * 40, y: this.by + size * 0.4, vx: (Math.random() - 0.5) * 30,
            vy: -60 - Math.random() * 80, life: 1.2, max: 1.2, size: 2, color: '#c8ffb0', gravity: 0, glow: true,
          });
        }
        break;
      case 'skill':
        this.shake = 1;
        this.flash = Math.max(this.flash, e.id === 'dynamite' ? 1 : 0.4);
        if (e.id === 'dynamite') {
          for (let i = 0; i < 50; i++) this.chip(cx, cy, i % 2 ? '#ffb040' : '#ff6020', 0, 260);
        }
        break;
      case 'descent':
        this.banner = { title: 'The shaft collapses', sub: `+${e.echoes} Echoes`, t: 0 };
        this.flash = 1;
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

  private chip(x: number, y: number, color: string, dir: number, speed = 140): void {
    const a = dir < 0 ? Math.PI + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    this.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.7 + Math.random() * 0.4, max: 1.1,
      size: Math.max(2, Math.round(this.S / 3)), color, gravity: 420,
    });
  }

  private ambient(biome: Biome, dt: number): void {
    const rate = biome.id === 'hollow' ? 3 : 7;
    if (Math.random() < rate * dt) {
      const base = { x: Math.random() * this.w, life: 6, max: 6, size: 2, gravity: 0, glow: true } as const;
      switch (biome.id) {
        case 'fungal':
          this.particles.push({ ...base, y: this.h + 4, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 10, color: '#c8a0ff' });
          break;
        case 'crystal':
          this.particles.push({ ...base, y: Math.random() * this.h, vx: 0, vy: 0, life: 1, max: 1, color: '#d8fbff' });
          break;
        case 'magma':
          this.particles.push({ ...base, y: this.h + 4, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40, color: '#ff8a3a', life: 4, max: 4 });
          break;
        default:
          this.particles.push({ ...base, y: Math.random() * this.h, vx: 4 + Math.random() * 4, vy: (Math.random() - 0.5) * 3, color: biome.id === 'hollow' ? '#6a6aa0' : '#d8c8a0', glow: false });
      }
    }
    // Something in the dark, watching. Only in The Hollow, and only now and then.
    if (biome.id === 'hollow' && Math.random() < 0.08 * dt && this.eyes.length < 2) {
      const side = Math.random() < 0.5 ? 0.08 : 0.92;
      this.eyes.push({ x: this.w * side + (Math.random() - 0.5) * 20, y: this.h * (0.2 + Math.random() * 0.5), t: 0, life: 3 + Math.random() * 3 });
    }
  }

  private buildStrata(biome: Biome): void {
    const tile = 16 * Math.max(2, Math.floor(this.S / 2));
    const scale = tile / 16;
    this.strata.width = Math.ceil(this.w / tile + 1) * tile;
    this.strata.height = Math.ceil(this.h / tile + 2) * tile;
    const c = this.strata.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = biome.sky[1];
    c.fillRect(0, 0, this.strata.width, this.strata.height);
    for (let y = 0; y < this.strata.height; y += tile) {
      for (let x = 0; x < this.strata.width; x += tile) {
        drawSprite(c, `rock-${biome.id}-${(x / tile + y / tile) % 2}`, x, y, scale);
      }
    }
    // Knock it back so the rock face in front reads clearly.
    const g = c.createLinearGradient(0, 0, 0, this.strata.height);
    g.addColorStop(0, `${biome.sky[0]}d0`);
    g.addColorStop(1, `${biome.sky[1]}e0`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.strata.width, this.strata.height);
    this.strataBiome = biome.id;
  }

  frame(dt: number, s: GameState): void {
    const { ctx } = this;
    this.time += dt;
    const biome = biomeAt(s.depth);
    if (this.strataBiome !== biome.id) this.buildStrata(biome);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Strata, scrolling up when the shaft goes deeper.
    this.scroll = Math.max(0, this.scroll - dt * 1.6);
    const tile = this.strata.height / Math.ceil(this.h / (16 * Math.max(2, Math.floor(this.S / 2))) + 2);
    const offset = ((s.depth * tile * 0.5 + (1 - this.scroll ** 2) * tile) % tile) - tile;
    ctx.drawImage(this.strata, 0, offset, this.strata.width, this.strata.height);

    // Shake decays quickly; it is a nudge, not an earthquake.
    this.shake = Math.max(0, this.shake - dt * 4);
    const sx = (Math.random() - 0.5) * this.shake * this.S * 0.8;
    const sy = (Math.random() - 0.5) * this.shake * this.S * 0.8;

    const { x, y, size } = this.blockRect();
    const S = this.S;
    const groundY = y + size;

    // The floor the miner stands on.
    ctx.fillStyle = biome.rock[0];
    ctx.fillRect(0, groundY, this.w, this.h - groundY);
    ctx.fillStyle = biome.rock[1];
    ctx.fillRect(0, groundY, this.w, Math.max(2, S / 2));

    // Drill rigs and excavators behind and beside the face.
    const ms = Math.max(2, Math.floor(S * 0.45));
    const frameIx = Math.floor(this.time * 8) % 2;
    const rigs = Math.min(2, s.machines['rig'] ?? 0);
    for (let i = 0; i < rigs; i++) {
      drawSprite(ctx, `rig-${(frameIx + i) % 2}`, x + size + 4 + i * 10 * ms, groundY - 16 * ms + 2, ms);
    }
    if ((s.machines['excavator'] ?? 0) > 0) {
      drawSprite(ctx, `excavator-${frameIx}`, x + size + 2 + (rigs > 0 ? 4 * ms : 0), groundY - 14 * ms, ms);
    }

    // The rock face.
    const blk = s.block;
    drawSprite(ctx, `rock-${biome.id}-${this.rockVariant}`, x + sx, y + sy, S);
    drawSprite(ctx, `vein-${blk.ore}`, x + sx, y + sy, S);
    if (blk.seam) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 3);
      drawSprite(ctx, `seam-${biome.id}`, x + sx, y + sy, S);
      ctx.globalAlpha = 1;
    }
    const frac = blk.hp / blk.maxHp;
    const crack = frac < 0.25 ? 3 : frac < 0.5 ? 2 : frac < 0.8 ? 1 : 0;
    if (crack) drawSprite(ctx, `crack-${crack}`, x + sx, y + sy, S);

    // The miner, breathing, and the pick swinging.
    const mS = Math.max(2, Math.floor(S * 0.6));
    const mx = x - 16 * mS - S * 0.5;
    const my = groundY - 23 * mS;
    const breathe = Math.floor(this.time * 1.5) % 2;
    drawSprite(ctx, `miner-${breathe}`, mx, my, mS);
    this.swing = Math.min(1, this.swing + dt * 7);
    const sw = this.swing;
    // Wind up, strike, then settle back to rest with the head lowered.
    const angle =
      sw < 0.15 ? 0.15 - (sw / 0.15) * 1.35 : sw < 0.35 ? -1.2 + ((sw - 0.15) / 0.2) * 1.9 : 0.7 - ((sw - 0.35) / 0.65) * 0.55;
    const equipped = s.gear.find((g) => g.uid === s.equipped.pick);
    drawSpriteRotated(ctx, `gear-${equipped ? equipped.base : 'none'}`, mx + 13 * mS, my + (13 + breathe) * mS, mS, angle, 3, 13);

    // Drones circle the face.
    const drones = Math.min(6, s.machines['drone'] ?? 0);
    const dS = Math.max(2, Math.floor(S * 0.35));
    for (let i = 0; i < drones; i++) {
      const a = this.time * 0.9 + (i / Math.max(1, drones)) * Math.PI * 2;
      const dx = this.bx + Math.cos(a) * size * 0.62 - 6 * dS;
      const dy = y - 6 * dS + Math.sin(a) * size * 0.18 - size * 0.05;
      drawSprite(ctx, `drone-${(Math.floor(this.time * 14) + i) % 2}`, dx, dy, dS);
      if (Math.random() < dt * 3) {
        this.particles.push({ x: dx + 6 * dS, y: dy + 12 * dS, vx: (Math.random() - 0.5) * 60, vy: 40, life: 0.3, max: 0.3, size: 2, color: '#ffe080', gravity: 200, glow: true });
      }
    }

    // HP bar and the pips counting toward the seam.
    const barY = groundY + Math.max(8, S);
    const barW = size;
    ctx.fillStyle = '#000000a0';
    ctx.fillRect(x - 2, barY - 2, barW + 4, 10);
    ctx.fillStyle = blk.seam ? biome.glow : '#d8483a';
    ctx.fillRect(x, barY, Math.max(0, barW * frac), 6);
    if (s.autoAdvance) {
      const pip = barW / BALANCE.blocksPerDepth;
      for (let i = 0; i < BALANCE.blocksPerDepth; i++) {
        ctx.fillStyle = blk.seam || i < s.blocksHere ? biome.glow : '#ffffff30';
        ctx.fillRect(x + i * pip + 1, barY + 11, pip - 2, 3);
      }
    }
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e8e0d0';
    const label = blk.seam ? 'SEAM — break through' : (MATERIAL.get(blk.ore)?.name ?? '');
    ctx.fillText(label, this.bx, barY + 18);

    // Particles.
    this.ambient(biome, dt);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0 || p.y > this.h + 20 || p.y < -20) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = Math.min(1, p.life / Math.min(0.4, p.max));
      ctx.globalAlpha = biome.id === 'crystal' && p.glow && p.gravity === 0 && p.vx === 0 ? Math.sin((p.life / p.max) * Math.PI) : a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      alive.push(p);
    }
    this.particles = alive.length > 400 ? alive.slice(-400) : alive;
    ctx.globalAlpha = 1;

    // Lamp light: darkness everywhere except a flickering circle round the miner.
    this.drawFog(s, biome, mx + 10 * mS, my + 4 * mS);

    // Eyes in the dark are drawn over the fog. That is the point of them.
    this.eyes = this.eyes.filter((e) => (e.t += dt) < e.life);
    for (const e of this.eyes) {
      const open = Math.min(1, e.t * 2, (e.life - e.t) * 2);
      const blink = Math.sin(e.t * 1.7) > 0.97 ? 0 : 1;
      const eh = Math.max(1, Math.round(3 * open * blink));
      ctx.fillStyle = '#d8d0ff';
      ctx.globalAlpha = 0.85 * open;
      ctx.fillRect(Math.round(e.x - 7), Math.round(e.y), 4, eh);
      ctx.fillRect(Math.round(e.x + 3), Math.round(e.y), 4, eh);
      ctx.globalAlpha = 1;
    }

    // Ore flying up to the inventory.
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
      f.y -= dt * 34;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `${f.size}px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // White-out on a break, briefly.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,248,230,${this.flash * 0.25})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash = Math.max(0, this.flash - dt * 3);
    }

    this.drawBanner(dt);
    this.drawHazard(s);
  }

  private drawFog(s: GameState, biome: Biome, lx: number, ly: number): void {
    const darkness = DARKNESS[biome.id] ?? 0.5;
    const d = derive(s);
    const f = this.fog.getContext('2d')!;
    f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, this.w, this.h);
    f.fillStyle = `rgba(0,0,0,${darkness})`;
    f.fillRect(0, 0, this.w, this.h);
    f.globalCompositeOperation = 'destination-out';
    const flicker = 1 + Math.sin(this.time * 9.3) * 0.015 + Math.sin(this.time * 3.1) * 0.02;
    const reach = Math.max(this.w, this.h) * (0.32 + 0.07 * Math.min(6, d.light)) * flicker;
    const g = f.createRadialGradient(lx, ly, reach * 0.1, lx, ly, reach);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g;
    f.fillRect(0, 0, this.w, this.h);
    this.ctx.drawImage(this.fog, 0, 0, this.w, this.h);
    // A warm (or cold) tint inside the light.
    this.ctx.globalCompositeOperation = 'soft-light';
    const t = this.ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
    t.addColorStop(0, `${biome.glow}50`);
    t.addColorStop(1, `${biome.glow}00`);
    this.ctx.fillStyle = t;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.globalCompositeOperation = 'source-over';
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
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00000090';
    ctx.fillRect(0, this.h * 0.12 - 22, this.w, b.sub ? 50 : 34);
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = '#f4ecdc';
    ctx.fillText(b.title, this.w / 2, this.h * 0.12 - 4);
    if (b.sub) {
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = '#c8bca8';
      ctx.fillText(b.sub, this.w / 2, this.h * 0.12 + 16);
    }
    ctx.globalAlpha = 1;
  }

  private drawHazard(s: GameState): void {
    if (!derive(s).hazard.warning) return;
    const ctx = this.ctx;
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const pulse = 0.7 + 0.3 * Math.sin(this.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff9a6a';
    ctx.fillText(`⚠ ${biomeAt(s.depth).hazard}`, 8, this.h - 6);
    ctx.globalAlpha = 1;
  }
}
