import { mulberry32 } from '../core/rng.js';
import { LOGICAL_WIDTH } from './camera.js';

// Procedural fish silhouette: a body spline + fin shapes + palette, keyed by
// the species' own `art.seed` so every species has a stable, distinct look
// with zero image assets.
export function drawFish(ctx, fish, x, y, scale = 1, facing = 1) {
  const rng = mulberry32(fish.art.seed);
  const [bodyColor, finColor] = fish.art.palette;
  const wobble = Math.sin(performance.now() / 400 + fish.art.seed) * 2;

  ctx.save();
  ctx.translate(x, y + wobble);
  ctx.scale(scale * facing, scale);

  const bodyLength = fish.art.bodyShape === 'eel' ? 46 : fish.art.bodyShape === 'round' ? 30 : 34;
  const bodyHeight = fish.art.bodyShape === 'flat' ? 10 : fish.art.bodyShape === 'round' ? 16 : 12;

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLength / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = finColor;
  ctx.beginPath();
  ctx.moveTo(-bodyLength / 2, 0);
  ctx.lineTo(-bodyLength / 2 - 12, -8);
  ctx.lineTo(-bodyLength / 2 - 12, 8);
  ctx.closePath();
  ctx.fill();

  if (fish.art.finShape !== 'none') {
    ctx.beginPath();
    ctx.moveTo(0, -bodyHeight / 2);
    ctx.lineTo(4, -bodyHeight / 2 - 10);
    ctx.lineTo(10, -bodyHeight / 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#0a1f2e';
  ctx.beginPath();
  ctx.arc(bodyLength / 2 - 6, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  void rng; // reserved: per-seed spot/stripe pattern variance (visual polish, Phase 7)
  void LOGICAL_WIDTH;
}
