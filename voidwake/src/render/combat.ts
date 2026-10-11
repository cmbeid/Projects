import { ENEMY } from '../data/enemies';
import { SECTORS } from '../data/sectors';
import { drawSprite, drawSpriteRotated, frameOf } from '../sprites/atlas';
import type { CombatState, GameState } from '../state/types';
import { drawStarfield } from './starfield';

/**
 * The fight, seen from behind the Wren: our ship at the bottom, theirs at
 * the top, shots crossing between. `anim` replays the last turn's volleys.
 */
export interface CombatAnim {
  start: number;
  fx: CombatState['fx'];
}

const SHOT_TIME = 0.32;

export function animDone(anim: CombatAnim | null, t: number): boolean {
  return !anim || t - anim.start > anim.fx.length * SHOT_TIME * 0.7 + 0.4;
}

export function drawCombat(ctx: CanvasRenderingContext2D, w: number, h: number, s: GameState, anim: CombatAnim | null, t: number): void {
  const c = s.combat;
  if (!c) return;
  drawStarfield(ctx, w, h, t, SECTORS[s.sector.index]!.color, 0.05);
  const def = ENEMY.get(c.enemyId)!;
  const base = Math.max(2, Math.round(Math.min(w / 70, h / 90)));
  const ek = def.boss ? Math.max(2, Math.round(base * 0.9)) : base + 1;
  const [, , ew, eh] = frameOf(def.sprite);
  const [, , pw, ph] = frameOf('ship-wren');
  const ex = w / 2 + Math.sin(t * 0.7) * base * 4;
  const ey = h * 0.27 + Math.cos(t * 0.9) * base * 2;
  const px = w / 2 + Math.sin(t * 0.8 + 1) * base * 3;
  const py = h * 0.74 + Math.cos(t * 1.1) * base * 2;
  const evading = c.evadeTurns > 0 ? Math.sin(t * 6) * base * 6 : 0;

  // Shields as soft bubbles.
  const bubble = (x: number, y: number, r: number, frac: number, color: string): void => {
    if (frac <= 0) return;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25 + 0.5 * frac;
    ctx.lineWidth = Math.max(1, base * 0.7);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  if (c.result !== 'win') {
    drawSpriteRotated(ctx, def.sprite, ex, ey, ek, Math.PI, ew / 2, eh / 2);
    bubble(ex, ey, (Math.max(ew, eh) * ek) / 2 + base * 3, c.enemy.maxShield ? c.enemy.shield / c.enemy.maxShield : 0, '#c0a0ff');
  } else {
    // Debris.
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4 + t;
      const r = (t * 30 + i * 9) % (w * 0.3);
      ctx.fillStyle = i % 2 ? '#f0a040' : '#8a8e98';
      ctx.fillRect(ex + Math.cos(a) * r, ey + Math.sin(a) * r, base, base);
    }
  }
  if (c.result !== 'lose') {
    drawSprite(ctx, 'ship-wren', px - (pw * base) / 2 + evading, py - (ph * base) / 2, base);
    bubble(px + evading, py, (Math.max(pw, ph) * base) / 2 + base * 3, c.player.maxShield ? c.player.shield / c.player.maxShield : 0, '#5ad0f0');
  }

  if (!anim) return;
  anim.fx.forEach((f, i) => {
    const t0 = anim.start + i * SHOT_TIME * 0.7;
    const k = (t - t0) / SHOT_TIME;
    if (k < 0 || k > 1.6) return;
    const [fx, fy, tx0, ty0] = f.from === 'player' ? [px, py - ph * base * 0.4, ex, ey] : [ex, ey + eh * ek * 0.4, px, py];
    // A miss sails wide.
    const tx = f.hit ? tx0 : tx0 + (i % 2 ? 1 : -1) * w * 0.25;
    const ty = f.hit ? ty0 : ty0 + (f.from === 'player' ? -1 : 1) * h * 0.1;
    if (k <= 1) {
      const x = fx + (tx - fx) * k;
      const y = fy + (ty - fy) * k;
      const color = f.kind === 'laser' ? (f.from === 'player' ? '#5af0ff' : '#ff5a5a') : f.kind === 'ion' ? '#c080ff' : '#ffc040';
      ctx.strokeStyle = color;
      ctx.lineWidth = base * (f.kind === 'missile' ? 1.5 : 1);
      ctx.beginPath();
      const len = f.kind === 'laser' ? 0.18 : 0.06;
      ctx.moveTo(x, y);
      ctx.lineTo(x - (tx - fx) * len, y - (ty - fy) * len);
      ctx.stroke();
      if (f.kind === 'missile') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - base, y - base, base * 2, base * 2);
      }
    } else if (f.hit) {
      const r = base * (4 + (k - 1) * 14);
      ctx.globalAlpha = Math.max(0, 1 - (k - 1) / 0.6);
      ctx.fillStyle = f.kind === 'ion' ? '#c080ff' : '#ffb040';
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}
