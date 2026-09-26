/**
 * Short-lived eye candy — debris, smoke, score popups, blast rings — spawned
 * from the game's event stream. Purely visual; the simulation never sees it.
 */
import type { GameEvent } from '../game/game';
import type { Material } from '../data/materials';
import { LAUNCHERS } from '../data/roster';

type Kind = 'debris' | 'puff' | 'text' | 'ring' | 'spark';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  angle: number;
  spin: number;
  text?: string;
}

export const MATERIAL_COLORS: Readonly<Record<Material, { fill: string; edge: string }>> = {
  wood: { fill: '#c98b4a', edge: '#7a4d22' },
  ice: { fill: '#b8e6ff', edge: '#5fb4e0' },
  stone: { fill: '#9aa0a8', edge: '#5d636b' },
  tnt: { fill: '#c8372d', edge: '#6e1a14' },
};

const GRAVITY = 0.0009;

export class Effects {
  private particles: Particle[] = [];

  consume(event: GameEvent): void {
    switch (event.type) {
      case 'break': {
        const { fill } = MATERIAL_COLORS[event.material];
        const count = Math.min(14, 4 + Math.round((event.w * event.h) / 500));
        for (let i = 0; i < count; i += 1) {
          this.add('debris', event.x + rand(-event.w / 3, event.w / 3), event.y + rand(-event.h / 3, event.h / 3), {
            vx: rand(-0.25, 0.25), vy: rand(-0.45, -0.05), life: rand(600, 1000), size: rand(5, 11), color: fill,
            spin: rand(-0.02, 0.02),
          });
        }
        break;
      }
      case 'faint':
        for (let i = 0; i < 10; i += 1) {
          this.add('puff', event.x + rand(-14, 14), event.y + rand(-14, 14), {
            vx: rand(-0.06, 0.06), vy: rand(-0.08, 0), life: rand(500, 900), size: rand(14, 24), color: '#ffffff',
          });
        }
        this.add('spark', event.x, event.y, { life: 500, size: 34, color: '#ffe066' });
        break;
      case 'points':
        this.add('text', event.x, event.y, {
          vy: -0.05, life: 1100, size: event.points >= 5000 ? 30 : 20,
          color: event.points >= 5000 ? '#ffe066' : '#ffffff', text: event.points.toLocaleString('en-US'),
        });
        break;
      case 'explode':
        this.add('ring', event.x, event.y, { life: 450, size: event.radius, color: '#ffb347' });
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * Math.PI * 2;
          this.add('puff', event.x, event.y, {
            vx: Math.cos(a) * 0.25, vy: Math.sin(a) * 0.25, life: rand(400, 700), size: rand(18, 30), color: '#ffcf70',
          });
        }
        break;
      case 'impact':
        for (let i = 0; i < Math.min(6, Math.round(event.strength / 3)); i += 1) {
          this.add('puff', event.x, event.y, {
            vx: rand(-0.12, 0.12), vy: rand(-0.12, 0.02), life: rand(250, 450), size: rand(6, 12), color: '#f4ecd8',
          });
        }
        break;
      case 'ability':
        this.add('ring', event.x, event.y, { life: 300, size: 50, color: LAUNCHERS[event.key].color });
        break;
      case 'splash':
        for (let i = 0; i < 12; i += 1) {
          this.add('debris', event.x + rand(-12, 12), event.y, {
            vx: rand(-0.15, 0.15), vy: rand(-0.5, -0.2), life: rand(500, 800), size: rand(4, 8), color: '#9fd3ff',
          });
        }
        break;
      case 'pickup':
        this.add('ring', event.x, event.y, { life: 500, size: 60, color: '#ffe066' });
        for (let i = 0; i < 6; i += 1) {
          this.add('spark', event.x + rand(-25, 25), event.y + rand(-25, 25), { life: rand(400, 700), size: rand(10, 18), color: '#ffe066' });
        }
        break;
      case 'bonus':
        this.add('spark', event.x, event.y, { life: 600, size: 30, color: '#ffe066' });
        break;
      default:
        break;
    }
  }

  update(dtMs: number): void {
    for (const p of this.particles) {
      p.life -= dtMs;
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.angle += p.spin * dtMs;
      if (p.kind === 'debris') p.vy += GRAVITY * dtMs;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  clear(): void {
    this.particles = [];
  }

  /** Draw in world space; the caller has already applied the camera. */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife; // 1 → 0
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.5);
      switch (p.kind) {
        case 'debris':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
          break;
        case 'puff':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.3 - t * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 8 * t + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.7), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spark': {
          ctx.translate(p.x, p.y);
          ctx.rotate((1 - t) * 2);
          ctx.fillStyle = p.color;
          star(ctx, p.size * (0.6 + (1 - t) * 0.6));
          ctx.fill();
          break;
        }
        case 'text':
          ctx.font = `800 ${p.size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 5;
          ctx.strokeStyle = 'rgba(20, 30, 60, 0.85)';
          ctx.strokeText(p.text ?? '', p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', p.x, p.y);
          break;
      }
      ctx.restore();
    }
  }

  private add(kind: Kind, x: number, y: number, o: Partial<Particle> & { life: number; size: number; color: string }): void {
    this.particles.push({
      kind, x, y, vx: 0, vy: 0, angle: rand(0, Math.PI), spin: 0, ...o, maxLife: o.life,
    });
  }
}

/** A five-pointed star path centred on the origin. */
export function star(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}
