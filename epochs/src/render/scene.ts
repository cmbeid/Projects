import { ERAS } from '../data/eras';
import { TRAIT } from '../data/heritage';
import type { LineId } from '../data/types';
import { WONDERS } from '../data/wonders';
import { drawSprite, frameOf, hasSprite } from '../sprites/atlas';
import { buildingSprite } from '../sprites/defs';
import type { GameState } from '../state/types';

/**
 * The skyline: a side view of the city on its riverbank, drawn in pixels.
 * One plot of land is one building wide; the city scrolls sideways when it
 * outgrows the screen. Behind it, on the far bank, stand the wonders. The
 * sky follows the era and the time of day, citizens dressed for the age walk
 * the road, and chimneys smoke from the Industrial Age on.
 */

const PLOT = 16;
const GAP = 3;
const MARGIN = 10;
/** World pixels below the ground line: road and riverbank. */
const FOOT = 22;
const DAY = 240;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Walker {
  x: number;
  speed: number;
  skin: number;
  lane: number;
}

const SMOKY: Partial<Record<LineId, number>> = { works: 5, power: 5, lumber: 5, quarry: 4, mine: 4, home: 5, farm: 5 };

export class Scene {
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 2;
  private cssW = 0;
  private cssH = 0;
  /** World pixels scrolled from the left. */
  scroll = 0;
  private velocity = 0;
  private drag: { x: number; scroll: number; moved: number } | null = null;
  private time = 0;
  private particles: Particle[] = [];
  private walkers: Walker[] = [];
  private pops = new Map<number, number>();
  private flashes = new Map<number, number>();
  private clouds: { x: number; y: number; speed: number }[] = [];
  /** Called with a plot index when the player taps a building. */
  onPick: ((plot: number) => void) | null = null;
  selected = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 5; i++) this.clouds.push({ x: Math.random() * 600, y: 6 + Math.random() * 30, speed: 2 + Math.random() * 3 });
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, scroll: this.scroll, moved: 0 };
      this.velocity = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = (e.clientX - this.drag.x) / this.scale;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx));
      const next = this.drag.scroll - dx;
      this.velocity = next - this.scroll;
      this.scroll = next;
    });
    const end = (e: PointerEvent): void => {
      if (!this.drag) return;
      if (this.drag.moved < 3) this.pick(e);
      this.drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => (this.drag = null));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.scroll += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / this.scale;
      },
      { passive: false },
    );
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssW = Math.max(1, r.width);
    this.cssH = Math.max(1, r.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    // Big enough pixels to read on a phone, small enough to show the skyline.
    this.scale = Math.max(1, Math.round(Math.min(this.cssH / 120, this.cssW / 150))) * dpr;
    this.ctx.imageSmoothingEnabled = false;
  }

  private get viewW(): number {
    return this.canvas.width / this.scale;
  }

  private get viewH(): number {
    return this.canvas.height / this.scale;
  }

  private worldWidth(s: GameState): number {
    return MARGIN * 2 + s.plots.length * (PLOT + GAP);
  }

  plotX(i: number): number {
    return MARGIN + i * (PLOT + GAP);
  }

  /** Scrolls so a plot is in view. */
  reveal(i: number): void {
    const x = this.plotX(i);
    if (x < this.scroll + 8 || x + PLOT > this.scroll + this.viewW - 8) this.scroll = x - this.viewW / 2 + PLOT / 2;
  }

  private pick(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const wx = ((e.clientX - r.left) * dpr) / this.scale + this.scroll;
    const i = Math.floor((wx - MARGIN + GAP / 2) / (PLOT + GAP));
    this.onPick?.(i);
  }

  // --- Events from the game ------------------------------------------------------------

  built(plot: number): void {
    this.pops.set(plot, 0);
    this.dust(plot, 14, '#c8b090');
  }

  modernized(plot: number): void {
    this.flashes.set(plot, 0);
    this.dust(plot, 10, '#ffffff');
  }

  demolished(plot: number): void {
    this.dust(plot, 22, '#8a7a6a');
  }

  festival(): void {
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: this.scroll + Math.random() * this.viewW,
        y: this.viewH - FOOT - 10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 20,
        vy: -30 - Math.random() * 40,
        life: 0,
        max: 1.5 + Math.random(),
        color: ['#ff5a5a', '#ffd84a', '#5ae0f0', '#b07af0', '#7ae07a'][i % 5]!,
        size: 1,
      });
    }
  }

  private dust(plot: number, n: number, color: string): void {
    const x = this.plotX(plot) + PLOT / 2;
    const y = this.viewH - FOOT;
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + (Math.random() - 0.5) * PLOT, y, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 25, life: 0, max: 0.6 + Math.random() * 0.5, color, size: 1 + Math.round(Math.random()) });
    }
  }

  // --- Drawing ------------------------------------------------------------------------

  private nightness(): number {
    const phase = (this.time % DAY) / DAY;
    // Day most of the time; a dusk, a short night and a dawn.
    const d = Math.cos(phase * Math.PI * 2);
    return Math.max(0, Math.min(1, (-d - 0.2) / 0.6));
  }

  isNight(): boolean {
    return this.nightness() > 0.6;
  }

  frame(s: GameState, dt: number): void {
    this.time += dt;
    const ctx = this.ctx;
    const k = this.scale;
    const W = this.viewW;
    const H = this.viewH;
    const era = ERAS[s.era]!;
    const ground = H - FOOT;

    // Scrolling: glide after a flick, and stay inside the city.
    if (!this.drag) {
      this.scroll += this.velocity;
      this.velocity *= 0.9;
      if (Math.abs(this.velocity) < 0.05) this.velocity = 0;
    }
    const maxScroll = Math.max(0, this.worldWidth(s) - W);
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
    if (this.worldWidth(s) < W) this.scroll = -(W - this.worldWidth(s)) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const night = this.nightness();
    const tint = s.world.traits.map((t) => TRAIT.get(t)?.tint).find(Boolean);

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    sky.addColorStop(0, mix(era.sky[0], '#0a0e2a', night * 0.85));
    sky.addColorStop(1, mix(era.sky[1], '#2a2050', night * 0.75));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (tint) {
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(k, 0, 0, k, 0, 0);
    // Stars, the sun and the moon.
    if (night > 0.05) {
      ctx.globalAlpha = night;
      for (let i = 0; i < 40; i++) {
        const x = (i * 97.3) % W;
        const y = (i * 37.1) % (ground * 0.6);
        ctx.fillStyle = (i + Math.floor(this.time * 2)) % 7 ? '#ffffff' : '#a8c0ff';
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const phase = (this.time % DAY) / DAY;
    const sunX = W * 0.15 + W * 0.7 * phase;
    const sunY = ground * 0.15 + Math.abs(Math.sin(phase * Math.PI * 2)) * ground * 0.12;
    disc(ctx, Math.floor(sunX), Math.floor(sunY), 4, night > 0.5 ? '#e8ecf4' : '#fff0b0');
    if (s.world.traits.includes('twin-suns') && night < 0.5) disc(ctx, Math.floor(sunX) + 12, Math.floor(sunY) + 6, 2, '#ffd0a0');

    // Clouds, drifting.
    if (s.era < 7 || night < 0.5) {
      ctx.globalAlpha = 0.85 - night * 0.6;
      for (const c of this.clouds) {
        c.x += c.speed * dt;
        if (c.x > W + 20) c.x = -20;
        drawSprite(ctx, 'cloud', Math.floor(c.x), Math.floor(c.y), 1);
      }
      ctx.globalAlpha = 1;
    }

    // Far hills, slow parallax.
    this.hills(ctx, W, ground, era.hills[0], 0.2, 26, 0.013);
    this.hills(ctx, W, ground, era.hills[1], 0.4, 16, 0.021);

    ctx.save();
    ctx.translate(-Math.round(this.scroll * 0.75), 0);
    // Wonders on the far bank, spread across a layer that scrolls at three quarters speed.
    const far = Math.max(W, (this.worldWidth(s) - W) * 0.75 + W);
    for (const w of WONDERS) {
      const st = s.wonders[w.id];
      if (!st || (st.done === 0 && st.left <= 0)) continue;
      const total = w.stages.length;
      const progress = st.done >= total ? 1 : (st.done + (st.left > 0 ? 1 - st.left / w.stageTime : 0)) / total;
      this.wonder(ctx, w.id, Math.round(24 + w.at * (far - 48)), ground - 4, progress, st.done >= total);
    }
    ctx.restore();
    // Haze: the far bank sits back behind the city.
    ctx.fillStyle = mix(era.sky[1], '#1a1a3a', night * 0.7);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, W, ground);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.restore();

    // Ground, the riverbank and the road.
    ctx.fillStyle = era.ground[1];
    ctx.fillRect(0, ground, W, FOOT);
    ctx.fillStyle = era.ground[0];
    for (let x = -(Math.floor(this.scroll) % 8); x < W; x += 8) ctx.fillRect(x, ground, 4, 1);
    ctx.fillStyle = era.road;
    ctx.fillRect(0, ground + 3, W, 7);
    ctx.fillStyle = mix(era.road, '#000000', 0.25);
    ctx.fillRect(0, ground + 10, W, 1);
    ctx.fillStyle = s.era >= 7 ? '#2a3a5a' : '#3a6aa0';
    ctx.fillRect(0, ground + 14, W, FOOT - 14);
    ctx.fillStyle = s.era >= 7 ? '#5ae0f0' : '#8ac0ec';
    for (let x = -(Math.floor(this.scroll * 1.2 + this.time * 6) % 12); x < W; x += 12) ctx.fillRect(x, ground + 16 + (Math.floor(x / 12) % 2) * 3, 4, 1);

    ctx.save();
    ctx.translate(-Math.round(this.scroll), 0);
    // Plots and buildings.
    s.plots.forEach((p, i) => {
      const x = this.plotX(i);
      if (x + PLOT < this.scroll || x > this.scroll + W) return;
      if (!p) {
        // Open ground: a patch of bare earth and a surveyor's stake.
        ctx.fillStyle = mix(era.ground[1], '#3a2a1a', 0.45);
        ctx.fillRect(x + 1, ground - 1, PLOT - 2, 2);
        ctx.fillStyle = '#c8a870';
        ctx.fillRect(x + 2, ground - 5, 1, 4);
        ctx.fillStyle = '#e04a3a';
        ctx.fillRect(x + 3, ground - 5, 2, 1);
        return;
      }
      const name = buildingSprite(p.line, p.era);
      if (!hasSprite(name)) return;
      const [, , , h] = frameOf(name);
      let rise = 1;
      const pop = this.pops.get(i);
      if (pop !== undefined) {
        rise = Math.min(1, pop / 0.35);
        this.pops.set(i, pop + dt);
        if (pop > 0.35) this.pops.delete(i);
      }
      const y = ground - Math.round(h * rise);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, 0, PLOT, ground);
      ctx.clip();
      drawSprite(ctx, name, x, y, 1);
      ctx.restore();
      const flash = this.flashes.get(i);
      if (flash !== undefined) {
        ctx.globalAlpha = Math.max(0, 1 - flash / 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, ground - h, PLOT, h);
        ctx.globalAlpha = 1;
        this.flashes.set(i, flash + dt);
        if (flash > 0.5) this.flashes.delete(i);
      }
      if (p.era < s.era && i !== this.selected) {
        // Outdated: a small arrow says it could be rebuilt.
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(x + PLOT - 3, ground - h - 3, 1, 2);
        ctx.fillRect(x + PLOT - 4, ground - h - 2, 3, 1);
      }
      if (i === this.selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, ground - h - 0.5, PLOT + 1, h + 1);
      }
      // Smoke from the age of steam on.
      const smokeFrom = SMOKY[p.line];
      if (smokeFrom !== undefined && p.era >= smokeFrom && Math.random() < dt * 1.5) {
        this.particles.push({ x: x + 12, y: ground - h, vx: 3 + Math.random() * 3, vy: -6 - Math.random() * 4, life: 0, max: 2.5, color: p.era >= 7 ? '#c0f4ff' : '#9a9aa4', size: 2 });
      }
    });

    // Citizens.
    this.walk(s, dt, ground);
    // Particles.
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.size > 1 && p.max > 2 ? -2 : 40) * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
    ctx.restore();

    // Night falls over everything but the lights.
    if (night > 0) {
      ctx.fillStyle = `rgba(10, 12, 40, ${night * 0.45})`;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(-Math.round(this.scroll), 0);
      ctx.globalAlpha = night;
      s.plots.forEach((p, i) => {
        if (!p || p.era < 2 || p.line === 'farm') return;
        const x = this.plotX(i);
        if (x + PLOT < this.scroll || x > this.scroll + W) return;
        const [, , , h] = frameOf(buildingSprite(p.line, p.era));
        ctx.fillStyle = p.era >= 7 ? '#7af0ff' : '#ffd890';
        for (let j = 0; j < Math.min(6, h / 6); j++) ctx.fillRect(x + 3 + ((i * 7 + j * 5) % 10), ground - h + 4 + j * 5, 1, 1);
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private hills(ctx: CanvasRenderingContext2D, W: number, ground: number, color: string, parallax: number, height: number, freq: number): void {
    ctx.fillStyle = color;
    const off = this.scroll * parallax;
    for (let x = 0; x < W; x++) {
      const wx = x + off;
      const h = Math.round(height * (0.55 + 0.3 * Math.sin(wx * freq) + 0.15 * Math.sin(wx * freq * 2.7 + 1)));
      ctx.fillRect(x, ground - h, 1, h);
    }
  }

  private wonder(ctx: CanvasRenderingContext2D, id: string, cx: number, base: number, progress: number, done: boolean): void {
    const name = `wonder-${id}`;
    if (!hasSprite(name)) return;
    const [sx, sy, w, h] = frameOf(name);
    void sx;
    void sy;
    const x = cx - Math.round(w / 2);
    const shown = Math.max(2, Math.round(h * progress));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, base - shown, w, shown);
    ctx.clip();
    drawSprite(ctx, name, x, base - h, 1);
    ctx.restore();
    if (!done) {
      // Scaffolding over the top course.
      for (let i = 0; i < w; i += 8) drawSprite(ctx, 'scaffold', x + i, base - shown - 6, 1);
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x + w - 2, base - shown - 22, 1, 22);
      ctx.fillRect(x + w - 12, base - shown - 22, 11, 1);
      ctx.fillRect(x + w - 11, base - shown - 21, 1, 4 + Math.round(Math.sin(this.time * 2) * 2));
    }
  }

  private walk(s: GameState, dt: number, ground: number): void {
    const want = Math.min(36, Math.ceil(Math.sqrt(Math.max(0, s.pop)) * 1.5));
    const world = this.worldWidth(s);
    while (this.walkers.length < want) {
      this.walkers.push({ x: Math.random() * world, speed: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8), skin: Math.floor(Math.random() * 3), lane: Math.floor(Math.random() * 3) });
    }
    if (this.walkers.length > want) this.walkers.length = want;
    const era = Math.min(7, s.era);
    for (const w of this.walkers) {
      w.x += w.speed * dt;
      if (w.x < -6) w.x = world;
      if (w.x > world) w.x = -6;
      if (w.x < this.scroll - 8 || w.x > this.scroll + this.viewW + 8) continue;
      const frame = Math.floor(this.time * 6 + w.x) % 2;
      const name = `citizen-${era}-${w.skin}-${frame}`;
      const y = ground + 1 + w.lane * 2;
      if (w.speed < 0) {
        this.ctx.save();
        this.ctx.translate(Math.round(w.x) + 5, 0);
        this.ctx.scale(-1, 1);
        drawSprite(this.ctx, name, 0, y - 9 + 2, 1);
        this.ctx.restore();
      } else drawSprite(this.ctx, name, Math.round(w.x), y - 9 + 2, 1);
    }
  }
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let j = -r; j <= r; j++) {
    const half = Math.floor(Math.sqrt(r * r - j * j));
    ctx.fillRect(cx - half, cy + j, half * 2 + 1, 1);
  }
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
