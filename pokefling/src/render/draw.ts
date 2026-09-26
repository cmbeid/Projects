/**
 * Draws a game onto the canvas. Reads the simulation; never changes it.
 */
import type { Entity, Game } from '../game/game';
import { LAUNCHERS, type LauncherKey } from '../data/roster';
import { launchVelocity, trajectory, type Vec } from '../game/sling';
import { GROUND_Y, SLING, WORLD_BOTTOM } from '../game/world';
import type { Camera } from './camera';
import { Effects, MATERIAL_COLORS } from './effects';
import { drawSprite } from './sprites';

interface Theme {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  grass: string;
  dirt: string;
  rock: string;
  stars: boolean;
}

/** One per world: Viridian Forest, Mt. Moon, the Rocket Hideout. */
const THEMES: readonly Theme[] = [
  { skyTop: '#5ab8f5', skyBottom: '#d8f1ff', far: '#9fd49a', near: '#6fbf62', grass: '#58b94a', dirt: '#8a5a2f', rock: '#7d6a55', stars: false },
  { skyTop: '#2a2350', skyBottom: '#8a6fb3', far: '#5b5478', near: '#433d5e', grass: '#6b7a8f', dirt: '#4a4458', rock: '#5c566c', stars: true },
  { skyTop: '#1a0f1f', skyBottom: '#a8434a', far: '#3b2a3d', near: '#261a28', grass: '#5a4a52', dirt: '#2e2530', rock: '#433843', stars: true },
];

export interface AimState {
  /** Pouch offset from the sling while dragging, else null. */
  pull: Vec | null;
}

export class Renderer {
  readonly effects = new Effects();
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  draw(game: Game, camera: Camera, aim: AimState, now: number): void {
    const { ctx } = this;
    const theme = THEMES[game.level.world] ?? THEMES[0]!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackdrop(theme, camera, now);

    // From here on, world coordinates.
    const s = camera.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, -camera.x * s, (camera.height - WORLD_BOTTOM * camera.scale) * this.dpr);

    this.drawGround(theme, camera);
    this.drawTrail(game.lastTrail, 0.45);
    this.drawTrail(game.trail, 0.9);
    this.drawQueue(game, now);
    this.drawSlingBack(aim);

    for (const e of game.entities.values()) {
      if (e.kind === 'terrain') this.drawTerrain(e, theme);
    }
    for (const e of game.entities.values()) {
      if (e.kind === 'block') this.drawBlock(e);
      else if (e.kind === 'target') this.drawTarget(e, now);
      else if (e.kind === 'projectile') this.drawProjectile(e);
    }

    if (game.phase === 'aiming' && game.loaded) this.drawLoaded(game.loaded, aim);
    this.drawSlingFront(aim, game.phase === 'aiming' && game.loaded !== null);
    this.effects.draw(ctx);
  }

  // --- scenery ----------------------------------------------------------

  private drawBackdrop(theme: Theme, camera: Camera, now: number): void {
    const { ctx } = this;
    const w = camera.width;
    const h = camera.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    if (theme.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 60; i += 1) {
        const x = ((i * 137.5 + camera.x * 0.05) % (w + 40) + w + 40) % (w + 40) - 20;
        const y = (i * 71.3) % (h * 0.6);
        const twinkle = 0.6 + 0.4 * Math.sin(now / 500 + i);
        ctx.globalAlpha = twinkle;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    } else {
      // A couple of slow clouds.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i += 1) {
        const span = w + 300;
        const x = (((i * 420 - camera.x * 0.15 * camera.scale + now * 0.006) % span) + span) % span - 150;
        const y = h * (0.12 + 0.08 * (i % 3));
        cloud(ctx, x, y, 28 + (i % 2) * 10);
      }
    }

    // Two parallax ridges, in screen space, anchored to the ground line.
    const groundScreen = camera.toScreen({ x: 0, y: GROUND_Y }).y;
    this.ridge(theme.far, groundScreen, camera, 0.2, 150, 0.004);
    this.ridge(theme.near, groundScreen, camera, 0.45, 90, 0.007);
  }

  private ridge(color: string, base: number, camera: Camera, parallax: number, height: number, freq: number): void {
    const { ctx } = this;
    const offset = camera.x * camera.scale * parallax;
    const hh = height * Math.max(camera.scale, 0.5);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, base + 2);
    for (let x = 0; x <= camera.width + 20; x += 20) {
      const u = (x + offset) * freq / Math.max(camera.scale, 0.3);
      ctx.lineTo(x, base - hh * (0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.7 + 1)));
    }
    ctx.lineTo(camera.width + 20, base + 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawGround(theme: Theme, camera: Camera): void {
    const { ctx } = this;
    const left = camera.x - 50;
    const right = camera.x + camera.visibleWidth() + 50;
    ctx.fillStyle = theme.dirt;
    ctx.fillRect(left, GROUND_Y, right - left, WORLD_BOTTOM - GROUND_Y + 400);
    ctx.fillStyle = theme.grass;
    ctx.fillRect(left, GROUND_Y, right - left, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(left, GROUND_Y + 12, right - left, 4);
  }

  private drawTerrain(e: Entity, theme: Theme): void {
    const { ctx } = this;
    const { x, y } = e.body.position;
    ctx.fillStyle = theme.rock;
    roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h + 10, 14);
    ctx.fill();
    ctx.fillStyle = theme.grass;
    roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, 12, 6);
    ctx.fill();
  }

  // --- the sling --------------------------------------------------------

  private pouch(aim: AimState): Vec {
    return aim.pull ? { x: SLING.x + aim.pull.x, y: SLING.y + aim.pull.y } : { x: SLING.x, y: SLING.y };
  }

  private drawSlingBack(aim: AimState): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6b3f1d';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(SLING.x + 4, GROUND_Y);
    ctx.lineTo(SLING.x + 4, SLING.y + 45);
    ctx.lineTo(SLING.x + 18, SLING.y - 6);
    ctx.stroke();
    if (aim.pull) this.band(SLING.x + 18, SLING.y - 4, this.pouch(aim));
  }

  private drawSlingFront(aim: AimState, loaded: boolean): void {
    const { ctx } = this;
    const pouch = this.pouch(aim);
    if (aim.pull) {
      this.band(SLING.x - 12, SLING.y - 2, pouch);
      this.aimPreview(aim.pull);
    } else if (loaded) {
      // Resting bands, slack between the arms.
      ctx.strokeStyle = '#4a1f14';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(SLING.x - 12, SLING.y - 2);
      ctx.quadraticCurveTo(SLING.x, SLING.y + 18, SLING.x + 18, SLING.y - 4);
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8a5429';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(SLING.x - 2, SLING.y + 45);
    ctx.lineTo(SLING.x - 12, SLING.y);
    ctx.stroke();
  }

  private band(fromX: number, fromY: number, to: Vec): void {
    const { ctx } = this;
    ctx.strokeStyle = '#4a1f14';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  private aimPreview(pull: Vec): void {
    const { ctx } = this;
    const start = { x: SLING.x + pull.x, y: SLING.y + pull.y };
    const dots = trajectory(start, launchVelocity(pull), 48, 4);
    dots.forEach((p, i) => {
      ctx.globalAlpha = 0.9 * (1 - i / dots.length);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 - i * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawLoaded(key: LauncherKey, aim: AimState): void {
    const def = LAUNCHERS[key];
    const at = this.pouch(aim);
    drawSprite(this.ctx, def.dex, at.x, at.y, def.radius, 0, def.color, def.facing, 'right');
  }

  private drawQueue(game: Game, now: number): void {
    game.queue.forEach((key, i) => {
      const def = LAUNCHERS[key];
      const x = SLING.x - 52 - i * 42;
      // Waiting Pokémon hop now and then, like birds on the grass.
      const hop = Math.max(0, Math.sin(now / 260 + i * 1.7)) ** 8 * 14;
      const r = def.radius * 0.85;
      drawSprite(this.ctx, def.dex, x, GROUND_Y - r - hop, r, 0, def.color, def.facing, 'right');
    });
  }

  private drawTrail(points: readonly Vec[], alpha: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, i % 3 === 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // --- bodies -----------------------------------------------------------

  private drawBlock(e: Entity): void {
    const { ctx } = this;
    if (!e.material) return;
    const { fill, edge } = MATERIAL_COLORS[e.material];
    const { x, y } = e.body.position;
    const w = e.w;
    const h = e.h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.body.angle);
    ctx.fillStyle = fill;
    ctx.globalAlpha = e.material === 'ice' ? 0.88 : 1;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    if (e.material === 'wood') {
      // Grain along the long axis.
      ctx.beginPath();
      if (w >= h) for (let gy = -h / 2 + 6; gy < h / 2 - 2; gy += 6) { ctx.moveTo(-w / 2 + 3, gy); ctx.lineTo(w / 2 - 3, gy); }
      else for (let gx = -w / 2 + 6; gx < w / 2 - 2; gx += 6) { ctx.moveTo(gx, -h / 2 + 3); ctx.lineTo(gx, h / 2 - 3); }
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.material === 'ice') {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 4, h / 2 - 6);
      ctx.lineTo(-w / 2 + Math.min(w, h) * 0.6, -h / 2 + 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 5; i += 1) {
        const sx = (((e.id * 37 + i * 53) % 100) / 100 - 0.5) * (w - 6);
        const sy = (((e.id * 17 + i * 29) % 100) / 100 - 0.5) * (h - 6);
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    const health = e.hp / e.maxHp;
    if (health < 0.7) this.cracks(e, w, h, health < 0.35 ? 2 : 1);

    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    if (e.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(e.hitFlash / 220) * 0.6})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  private cracks(e: Entity, w: number, h: number, severity: number): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c < severity * 2; c += 1) {
      const seed = e.id * 13 + c * 7;
      let px = (((seed * 31) % 100) / 100 - 0.5) * w * 0.8;
      let py = (((seed * 17) % 100) / 100 - 0.5) * h * 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k += 1) {
        px += (((seed + k * 11) % 7) - 3) * Math.min(w, h) * 0.08;
        py += (((seed + k * 5) % 7) - 3) * Math.min(w, h) * 0.08;
        ctx.lineTo(Math.max(-w / 2, Math.min(w / 2, px)), Math.max(-h / 2, Math.min(h / 2, py)));
      }
      ctx.stroke();
    }
  }

  private drawTarget(e: Entity, now: number): void {
    if (!e.target) return;
    const { x, y } = e.body.position;
    const ctx = this.ctx;
    ctx.save();
    if (e.hitFlash > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.cos(now / 30);
    drawSprite(ctx, e.target.dex, x, y, e.radius, e.body.angle, '#9b59b6', e.target.facing, 'left');
    ctx.restore();

    // A health pip once it has been hurt, so near-misses feel like progress.
    const health = e.hp / e.maxHp;
    if (health < 0.999) {
      const w = e.radius * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x - w / 2, y - e.radius * 1.5, w, 5);
      ctx.fillStyle = health > 0.5 ? '#6ad36a' : health > 0.25 ? '#f5c542' : '#e5533d';
      ctx.fillRect(x - w / 2, y - e.radius * 1.5, w * Math.max(0, health), 5);
    }
  }

  private drawProjectile(e: Entity): void {
    if (!e.launcher) return;
    const { x, y } = e.body.position;
    drawSprite(this.ctx, e.launcher.dex, x, y, e.radius, e.body.angle, e.launcher.color, e.launcher.facing, 'right');
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y - r * 0.4, r * 0.9, 0, Math.PI * 2);
  ctx.arc(x + r * 2, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}
