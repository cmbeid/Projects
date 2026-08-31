import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './camera.js';
import { drawFish } from './fishart.js';
import { drawFx } from './fx.js';

const WEATHER_TINT = {
  clear: '#0a1f2e',
  overcast: '#132732',
  rain: '#0d1f2c',
  fog: '#1a2f38',
  storm: '#0a141c',
};

export function drawScene(ctx, view) {
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const skyH = LOGICAL_HEIGHT * 0.28;
  ctx.fillStyle = WEATHER_TINT[view.weatherId] ?? WEATHER_TINT.clear;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, skyH);

  const waterTop = skyH;
  const waterH = LOGICAL_HEIGHT - waterTop;
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const y = waterTop + waterH * t;
    const h = waterH / bands;
    const shade = 30 + t * 40;
    ctx.fillStyle = `rgb(${shade * 0.3}, ${shade + 40}, ${shade + 60})`;
    const wave = Math.sin(performance.now() / 900 + i) * 3;
    ctx.fillRect(0, y + wave, LOGICAL_WIDTH, h + 1);
  }

  if (view.bobber) {
    const { x, y, cast } = view.bobber;
    if (cast) {
      ctx.strokeStyle = 'rgba(223,243,247,0.5)';
      ctx.beginPath();
      ctx.moveTo(LOGICAL_WIDTH / 2, waterTop - 6);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#f4c542';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (view.biteFlash) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (view.minigame) {
    drawMinigame(ctx, view.minigame);
  }

  drawFx(ctx);
}

function drawMinigame(ctx, mg) {
  const trackX = LOGICAL_WIDTH - 40;
  const trackTop = 40;
  const trackH = LOGICAL_HEIGHT - 100;

  ctx.strokeStyle = 'rgba(223,243,247,0.3)';
  ctx.strokeRect(trackX - 12, trackTop, 24, trackH);

  const zoneY = trackTop + trackH * (1 - mg.zoneCenter) - (trackH * mg.zoneSize) / 2;
  ctx.fillStyle = 'rgba(244,197,66,0.35)';
  ctx.fillRect(trackX - 12, zoneY, 24, trackH * mg.zoneSize);

  const markerY = trackTop + trackH * (1 - mg.markerPos);
  drawFish(ctx, mg.fish, trackX, markerY, 0.5, 1);

  const barX = 20;
  ctx.strokeStyle = 'rgba(223,243,247,0.4)';
  ctx.strokeRect(barX, trackTop, 14, trackH);
  ctx.fillStyle = '#dff3f7';
  ctx.fillRect(barX, trackTop + trackH * (1 - mg.progress / 100), 14, trackH * (mg.progress / 100));

  ctx.strokeStyle = 'rgba(223,243,247,0.4)';
  ctx.strokeRect(barX + 20, trackTop, 8, trackH);
  const tensionFrac = mg.tension / mg.tensionMax;
  ctx.fillStyle = tensionFrac > 0.8 ? '#ff6b6b' : '#f4c542';
  ctx.fillRect(barX + 20, trackTop + trackH * (1 - tensionFrac), 8, trackH * tensionFrac);
}
