// Lightweight particle/float-text system for splashes and value pop-ups.
let particles = [];
let floatTexts = [];

export function spawnSplash(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 90,
      vy: -Math.random() * 120,
      life: 0.5 + Math.random() * 0.3,
      age: 0,
    });
  }
}

export function spawnFloatText(x, y, text, color = '#f4c542') {
  floatTexts.push({ x, y, text, color, life: 1.1, age: 0 });
}

export function updateFx(dt) {
  for (const p of particles) {
    p.age += dt;
    p.vy += 220 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.age < p.life);

  for (const t of floatTexts) {
    t.age += dt;
    t.y -= 24 * dt;
  }
  floatTexts = floatTexts.filter((t) => t.age < t.life);
}

export function drawFx(ctx) {
  for (const p of particles) {
    const alpha = 1 - p.age / p.life;
    ctx.fillStyle = `rgba(223, 243, 247, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of floatTexts) {
    const alpha = 1 - t.age / t.life;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}

export function clearFx() {
  particles = [];
  floatTexts = [];
}
