import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { Game, STEP_MS } from '../src/game/game';
import { trajectory, launchVelocity } from '../src/game/sling';
import { SLING } from '../src/game/world';

const level1 = LEVELS[0] as LevelDef;

describe('Game', () => {
  it('follows the predicted arc until it hits something', () => {
    const game = new Game(level1);
    game.update(2000); // past the grace period, nothing fired yet
    const pull = { x: -90, y: 40 };
    const start = { x: SLING.x + pull.x, y: SLING.y + pull.y };
    const predicted = trajectory(start, launchVelocity(pull), 30, 1);
    expect(game.launch(pull)).toBe(true);
    const body = game.projectiles[0]!.body;
    // 30 steps of 1/60 s is 60 physics steps of 1/120 s.
    for (let i = 0; i < 60; i += 1) game.update(STEP_MS);
    const at = predicted[29]!;
    expect(body.position.x).toBeCloseTo(at.x, 0);
    expect(body.position.y).toBeCloseTo(at.y, 0);
  });

  it('ignores a pull too short to count as a shot', () => {
    const game = new Game(level1);
    expect(game.launch({ x: -5, y: 2 })).toBe(false);
    expect(game.phase).toBe('aiming');
    expect(game.launchersLeft).toBe(level1.launchers.length);
  });

  it('loads the next Pokémon once a missed shot settles, and loses when out', () => {
    const game = new Game(level1);
    for (let shot = 0; shot < level1.launchers.length; shot += 1) {
      // Straight up and back down onto the sling's own side of the field.
      expect(game.launch({ x: 0, y: 100 })).toBe(true);
      for (let t = 0; t < 20_000 && game.phase !== 'aiming' && game.phase !== 'lost'; t += 50) game.update(50);
    }
    expect(game.phase).toBe('lost');
    expect(game.targetsLeft).toBe(level1.targets.length);
  });

  it('wins, with a bonus for every Pokémon left over, when the targets are gone', () => {
    const game = new Game(level1);
    game.update(2000);
    for (const e of game.entities.values()) if (e.kind === 'target') e.hp = 0;
    game.launch({ x: 0, y: 100 });
    for (let t = 0; t < 20_000 && game.phase !== 'won'; t += 50) game.update(50);
    expect(game.phase).toBe('won');
    expect(game.score).toBeGreaterThanOrEqual(10_000 + 2 * 10_000);
  });

  it('blows up Voltorb and damages what is around it', () => {
    const game = new Game({ ...level1, launchers: ['voltorb'] });
    game.update(2000);
    const target = [...game.entities.values()].find((e) => e.kind === 'target')!;
    game.launch({ x: -60, y: 0 });
    // Put it right next to the target and set it off.
    Matter.Body.setPosition(game.projectiles[0]!.body, { x: target.body.position.x - 40, y: target.body.position.y });
    expect(game.useAbility()).toBe(true);
    game.update(STEP_MS * 2);
    expect(game.entities.has(target.body.id)).toBe(false);
  });
});

describe('every level', () => {
  it.each(LEVELS.map((level) => [level.id, level] as const))('level %i stands up on its own', (_id, level) => {
    const game = new Game(level);
    const before = new Map([...game.entities.values()].map((e) => [e.id, { ...e.body.position, angle: e.body.angle }]));
    for (let t = 0; t < 6000; t += 50) game.update(50);

    expect(game.targetsLeft).toBe(level.targets.length);
    expect(game.score).toBe(0);
    for (const e of game.entities.values()) {
      const was = before.get(e.id)!;
      const moved = Math.hypot(e.body.position.x - was.x, e.body.position.y - was.y);
      const label = `${e.kind} ${e.material ?? e.target?.key ?? ''} at ${Math.round(was.x)},${Math.round(was.y)}`;
      expect(moved, label).toBeLessThan(6);
      if (e.kind !== 'target') expect(Math.abs(e.body.angle - was.angle), label).toBeLessThan(0.05);
    }
  });
});
