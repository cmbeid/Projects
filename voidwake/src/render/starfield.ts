/**
 * Three layers of stars that drift at different speeds, and a faint nebula
 * glow tinted by the sector. Generated once; drawn every frame.
 */
interface Star {
  x: number;
  y: number;
  z: number;
  tw: number;
}

const STARS: Star[] = [];
let seed = 12345;
const rnd = (): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  return ((seed >>> 8) & 0xffff) / 65536;
};
for (let i = 0; i < 220; i++) STARS.push({ x: rnd(), y: rnd(), z: 0.2 + rnd() * 0.8, tw: rnd() * 6.28 });

export function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, tint: string, speed = 0.01, dirY = 1): void {
  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, Math.max(w, h) * 0.8);
  g.addColorStop(0, `${tint}33`);
  g.addColorStop(1, '#05070e00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const px = Math.max(1, Math.round(Math.min(w, h) / 300));
  for (const s of STARS) {
    const y = (((s.y + t * speed * s.z * dirY) % 1) + 1) % 1;
    const a = 0.35 + 0.65 * s.z * (0.75 + 0.25 * Math.sin(t * 2 + s.tw));
    ctx.fillStyle = `rgba(220,230,255,${a.toFixed(2)})`;
    const size = s.z > 0.85 ? px * 2 : px;
    ctx.fillRect(Math.floor(s.x * w), Math.floor(y * h), size, size);
  }
}
