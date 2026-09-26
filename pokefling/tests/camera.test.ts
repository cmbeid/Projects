import { describe, expect, it } from 'vitest';
import { Build, G } from '../src/data/levels/build';
import { Game, STEP_MS } from '../src/game/game';
import { landingX, launchVelocity } from '../src/game/sling';
import { GROUND_Y, SLING } from '../src/game/world';
import { Camera } from '../src/render/camera';

function settled(width: number, height: number, levelWidth = 1800): Camera {
  const camera = new Camera();
  camera.resize(width, height);
  camera.reset(levelWidth);
  camera.aim();
  for (let t = 0; t < 5000; t += 16) camera.update(16);
  return camera;
}

describe('landingX', () => {
  it('predicts where a shot comes down in the real simulation', () => {
    const b = new Build();
    b.target('rattata', 1700, G);
    const game = new Game(b.done(0, 1, { name: 'Empty', width: 2400, launchers: ['pikachu'], par: 1, reward: 'x-attack' }));
    const pull = { x: -90, y: 45 };
    const predicted = landingX({ x: SLING.x + pull.x, y: SLING.y + pull.y }, launchVelocity(pull), GROUND_Y);
    game.launch(pull);
    const body = game.projectiles[0]!.body;
    for (let t = 0; t < 10_000 && body.position.y + 22 < GROUND_Y - 1; t += STEP_MS) game.update(STEP_MS);
    // The body touches down when its underside, not its centre, reaches the ground.
    expect(Math.abs(body.position.x - predicted)).toBeLessThan(60);
  });
});

describe('camera while aiming', () => {
  it('pans a portrait screen towards where the shot will land', () => {
    const camera = settled(390, 844);
    const before = camera.x;
    camera.aimAt({ from: 900, to: 1300 });
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    expect(camera.x).toBeGreaterThan(before + 200);
    // Both the arc's tip and the landing point are on screen.
    for (const x of [900, 1300]) {
      const at = camera.toScreen({ x, y: GROUND_Y }).x;
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(camera.width);
    }
  });

  it('zooms out no further than 60% of the usual scale, however far the shot goes', () => {
    const camera = settled(390, 844);
    const usual = camera.scale;
    camera.aimAt({ from: 300, to: 2000 });
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    expect(camera.scale).toBeGreaterThanOrEqual(usual * 0.6 - 1e-6);
    camera.aimAt(null);
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    // Letting go of the sling returns to the usual zoom.
    expect(camera.scale).toBeCloseTo(usual, 2);
  });

  it('leaves a screen that already shows the whole level where it is', () => {
    const camera = settled(844, 390);
    const before = camera.x;
    camera.aimAt({ from: 900, to: 1300 });
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    expect(camera.x).toBeCloseTo(before, 0);
  });

  it('never pans left of the usual aiming view for a short shot', () => {
    const camera = settled(390, 844);
    const before = camera.x;
    camera.aimAt({ from: SLING.x + 20, to: SLING.x + 50 });
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    expect(camera.x).toBeCloseTo(before, 0);
  });

  it('after launch, waits for the shot to fly into view instead of swinging back', () => {
    const camera = settled(390, 844);
    camera.aimAt({ from: 900, to: 1300 });
    for (let t = 0; t < 3000; t += 16) camera.update(16);
    const ahead = camera.x;
    const shot: { x: number; y: number } = { x: SLING.x, y: SLING.y };
    camera.startFollow(shot);
    for (let t = 0; t < 500; t += 16) camera.update(16);
    expect(camera.x).toBeCloseTo(ahead, 0);
    // Once the shot has caught up, the camera follows it as usual.
    shot.x = 1400;
    for (let t = 0; t < 2000; t += 16) camera.update(16);
    expect(camera.x).toBeGreaterThan(ahead);
  });
});
