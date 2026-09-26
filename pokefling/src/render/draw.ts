/**
 * Draws a game onto the canvas. Reads the simulation; never changes it.
 */
import type { Entity, Game } from '../game/game';
import { AREAS } from '../data/areas';
import { LAUNCHERS, type LauncherKey } from '../data/roster';
import { launchVelocity, trajectory, type Vec } from '../game/sling';
import { GROUND_Y, SLING, WORLD_BOTTOM } from '../game/world';
import type { Camera } from './camera';
import { Effects, MATERIAL_COLORS } from './effects';
import { drawItemIcon, drawSprite } from './sprites';
import { drawBackdrop, THEMES, type Theme } from './themes';

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
    const theme = THEMES[AREAS[game.level.area]?.theme ?? 'forest'];
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackdrop(ctx, theme, camera, now);

    // From here on, world coordinates — shaken, briefly, by an earthquake.
    const shake = game.quakeTime > 0 ? (game.quakeTime / 1200) * 7 : 0;
    const dx = shake ? Math.sin(now / 17) * shake : 0;
    const dy = shake ? Math.cos(now / 23) * shake : 0;
    const s = camera.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, (-camera.x * camera.scale + dx) * this.dpr, (camera.height - WORLD_BOTTOM * camera.scale + dy) * this.dpr);

    this.drawGround(theme, camera, game, now);
    if (game.level.ceiling !== undefined) this.drawCeiling(theme, camera, game.level.ceiling);
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
      else if (e.kind === 'pickup') this.drawPickup(e, now);
    }

    if (game.phase === 'aiming' && game.loaded) this.drawLoaded(game, game.loaded, aim, now);
    this.drawSlingFront(game, aim, game.phase === 'aiming' && game.loaded !== null);
    this.effects.draw(ctx);
  }

  // --- scenery ----------------------------------------------------------

  private drawGround(theme: Theme, camera: Camera, game: Game, now: number): void {
    const { ctx } = this;
    const left = camera.x - 50;
    const right = camera.x + camera.visibleWidth() + 50;
    ctx.fillStyle = theme.dirt;
    ctx.fillRect(left, GROUND_Y, right - left, WORLD_BOTTOM - GROUND_Y + 400);
    ctx.fillStyle = theme.grass;
    ctx.fillRect(left, GROUND_Y, right - left, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(left, GROUND_Y + 12, right - left, 4);

    for (const [x0, x1] of game.level.water ?? []) {
      ctx.fillStyle = theme.water;
      ctx.fillRect(x0, GROUND_Y + 4, x1 - x0, WORLD_BOTTOM - GROUND_Y + 400);
      // Darker where it gets deep, and a moving surface.
      ctx.fillStyle = 'rgba(0, 20, 60, 0.3)';
      ctx.fillRect(x0, GROUND_Y + 40, x1 - x0, WORLD_BOTTOM - GROUND_Y + 400);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, GROUND_Y + 6 + Math.sin(x / 25 + now / 300) * 3);
      ctx.stroke();
    }
  }

  private drawCeiling(theme: Theme, camera: Camera, y: number): void {
    const { ctx } = this;
    const left = camera.x - 50;
    const right = camera.x + camera.visibleWidth() + 50;
    ctx.fillStyle = theme.rock;
    ctx.fillRect(left, y - 2000, right - left, 2000);
    // Strata, so the roof reads as rock rather than a flat band.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 1; k <= 6; k += 1) ctx.fillRect(left, y - k * 45 - (k % 2) * 12, right - left, 8 + (k % 3) * 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(left, y - 10, right - left, 10);
    // A short fringe of rock teeth, so the roof reads as rock, not a line.
    ctx.fillStyle = theme.rock;
    for (let x = Math.floor(left / 40) * 40; x < right; x += 40) {
      const len = 6 + (Math.abs(x * 7919) % 11);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20, y);
      ctx.lineTo(x + 10, y + len);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawTerrain(e: Entity, theme: Theme): void {
    const { ctx } = this;
    const { x, y } = e.body.position;
    const onGround = y + e.h / 2 >= GROUND_Y - 0.5;
    ctx.fillStyle = theme.rock;
    roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h + (onGround ? 10 : 0), onGround ? 12 : 8);
    ctx.fill();
    ctx.fillStyle = theme.grass;
    roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, Math.min(12, e.h), 6);
    ctx.fill();
  }

  private drawPickup(e: Entity, now: number): void {
    const { x, y } = e.body.position;
    const bob = Math.sin(now / 300) * 4;
    const { ctx } = this;
    const glow = ctx.createRadialGradient(x, y + bob, 4, x, y + bob, 30);
    glow.addColorStop(0, 'rgba(255, 240, 150, 0.8)');
    glow.addColorStop(1, 'rgba(255, 240, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + bob, 30, 0, Math.PI * 2);
    ctx.fill();
    drawItemIcon(ctx, 'poke-ball', x, y + bob, 40);
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

  private drawSlingFront(game: Game, aim: AimState, loaded: boolean): void {
    const { ctx } = this;
    const pouch = this.pouch(aim);
    if (aim.pull) {
      this.band(SLING.x - 12, SLING.y - 2, pouch);
      this.aimPreview(aim.pull, game.launchScale, game.fullArc);
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

  /** The first part of the flight path — or, with Scope Lens, all of it. */
  private aimPreview(pull: Vec, scale: number, full: boolean): void {
    const { ctx } = this;
    const start = { x: SLING.x + pull.x, y: SLING.y + pull.y };
    const v = launchVelocity(pull);
    const dots = trajectory(start, { x: v.x * scale, y: v.y * scale }, full ? 200 : 48, 4)
      .filter((p) => p.y < GROUND_Y);
    dots.forEach((p, i) => {
      ctx.globalAlpha = full ? 0.85 : 0.9 * (1 - i / dots.length);
      ctx.fillStyle = full ? '#ffe066' : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, full ? 4 : 5 - i * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawLoaded(game: Game, key: LauncherKey, aim: AimState, now: number): void {
    const def = LAUNCHERS[key];
    const at = this.pouch(aim);
    drawSprite(this.ctx, def.art, at.x, at.y, def.radius, 0, def.color, def.facing, 'right');
    // Boosts from the bag hover over the Pokémon they apply to.
    const boosts = [game.boost.attack ? 'x-attack' : '', game.boost.speed ? 'x-speed' : ''].filter(Boolean);
    boosts.forEach((icon, i) => {
      const bob = Math.sin(now / 250 + i) * 3;
      const x = at.x + (i - (boosts.length - 1) / 2) * 30;
      drawItemIcon(this.ctx, icon, x, at.y - def.radius - 24 + bob, 28);
    });
  }

  private drawQueue(game: Game, now: number): void {
    game.queue.forEach((key, i) => {
      const def = LAUNCHERS[key];
      const x = SLING.x - 52 - i * 42;
      // Waiting Pokémon hop now and then, like birds on the grass.
      const hop = Math.max(0, Math.sin(now / 260 + i * 1.7)) ** 8 * 14;
      const r = def.radius * 0.85;
      drawSprite(this.ctx, def.art, x, GROUND_Y - r - hop, r, 0, def.color, def.facing, 'right');
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
    if (e.shape === 'ball') {
      this.drawBoulder(e);
      return;
    }
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
    } else if (e.material === 'tnt') {
      // A lightning bolt: this one goes bang.
      const k = Math.min(w, h) / 34;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (const [px, py] of [[2, -12], [-7, 2], [0, 2], [-3, 12], [7, -3], [0, -3]] as const) ctx.lineTo(px * k, py * k);
      ctx.closePath();
      ctx.fill();
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

  private drawBoulder(e: Entity): void {
    const { ctx } = this;
    const { fill, edge } = MATERIAL_COLORS[e.material!];
    const { x, y } = e.body.position;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.body.angle);
    const g = ctx.createRadialGradient(-e.radius * 0.3, -e.radius * 0.3, 2, 0, 0, e.radius);
    g.addColorStop(0, '#c4c8ce');
    g.addColorStop(1, fill);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // A fissure, so it visibly rolls.
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.5, -e.radius * 0.2);
    ctx.lineTo(e.radius * 0.1, e.radius * 0.1);
    ctx.lineTo(e.radius * 0.2, e.radius * 0.6);
    ctx.stroke();
    if (e.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(e.hitFlash / 220) * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
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
    drawSprite(ctx, e.target.art, x, y, e.radius, e.body.angle, '#9b59b6', e.target.facing, 'left');
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
    const { ctx } = this;
    ctx.save();
    // A ghost in Phantom Force is only half there.
    if (e.phasing) ctx.globalAlpha = 0.45;
    if (e.power > 1) {
      ctx.fillStyle = 'rgba(255, 80, 60, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, e.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(ctx, e.launcher.art, x, y, e.radius, e.body.angle, e.launcher.color, e.launcher.facing, 'right');
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
