import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { Build, G } from '../src/data/levels/build';
import type { LevelDef } from '../src/data/levels/types';
import type { LauncherKey } from '../src/data/roster';
import { Game, PHASE_DRIFT_SPEED, STEP_MS, X_SPEED_BOOST } from '../src/game/game';
import { SLING } from '../src/game/world';

function level(setup: (b: Build) => void, launchers: LauncherKey[] = ['pikachu', 'pikachu']): LevelDef {
  const b = new Build();
  setup(b);
  return b.done(0, 1, { name: 'Test', width: 1800, launchers, par: 1, reward: 'x-attack' });
}

/** Let the grace period pass, so impacts do damage. */
function settle(game: Game): void {
  for (let t = 0; t < 2000; t += 50) game.update(50);
}

function run(game: Game, ms: number): void {
  for (let t = 0; t < ms; t += STEP_MS) game.update(STEP_MS);
}

const blocks = (game: Game) => [...game.entities.values()].filter((e) => e.kind === 'block');

describe('explosive crates', () => {
  it('go off when broken and set off their neighbours', () => {
    const game = new Game(level((b) => {
      b.tnt(1000, G);
      b.tnt(1040, G);
      b.tnt(1080, G);
      b.box(1300, G, 'stone');
      b.target('rattata', 1500, G);
    }));
    settle(game);
    const first = blocks(game).find((e) => e.body.position.x === 1000)!;
    first.hp = 0;
    run(game, 100);
    const kinds = blocks(game).map((e) => e.material);
    expect(kinds).toEqual(['stone']);
    expect(game.events.filter((e) => e.type === 'explode').length).toBe(3);
  });
});

describe('boulders', () => {
  it('are round and roll when pushed', () => {
    const game = new Game(level((b) => {
      b.ball(1000, G);
      b.target('rattata', 1500, G);
    }));
    settle(game);
    const boulder = blocks(game)[0]!;
    expect(boulder.shape).toBe('ball');
    Matter.Sleeping.set(boulder.body, false);
    Matter.Body.setVelocity(boulder.body, { x: 5, y: 0 });
    run(game, 500);
    expect(boulder.body.position.x).toBeGreaterThan(1030);
    expect(Math.abs(boulder.body.angle)).toBeGreaterThan(0.5);
  });
});

describe('cave ceilings', () => {
  it('stop a shot fired straight up', () => {
    const game = new Game(level((b) => {
      b.ceiling(250);
      b.target('rattata', 1500, G);
    }));
    settle(game);
    game.launch({ x: 0, y: 100 });
    let highest = Infinity;
    for (let t = 0; t < 2000; t += STEP_MS) {
      game.update(STEP_MS);
      highest = Math.min(highest, game.projectiles[0]!.body.position.y);
    }
    expect(highest).toBeGreaterThan(250);
  });
});

describe('water', () => {
  it('swallows a block that falls in, and scores it', () => {
    const game = new Game(level((b) => {
      b.water(900, 1100);
      b.box(1150, G, 'wood');
      b.target('magikarp', 1500, G);
    }));
    settle(game);
    const crate = blocks(game)[0]!;
    Matter.Sleeping.set(crate.body, false);
    Matter.Body.setVelocity(crate.body, { x: -6, y: -2 });
    run(game, 1500);
    expect(blocks(game)).toHaveLength(0);
    expect(game.events.some((e) => e.type === 'splash')).toBe(true);
    expect(game.score).toBeGreaterThan(0);
  });

  it('leaves no ground under the span, and ground either side of it', () => {
    const game = new Game(level((b) => {
      b.water(900, 1100);
      b.target('magikarp', 1500, G);
    }));
    const ground = [...game.entities.values()].filter((e) => e.kind === 'ground');
    expect(ground).toHaveLength(2);
    for (const g of ground) {
      const left = g.body.position.x - g.w / 2;
      const right = g.body.position.x + g.w / 2;
      expect(right <= 900 || left >= 1100).toBe(true);
    }
  });
});

describe('hidden items', () => {
  it('are collected by anything that touches them', () => {
    const game = new Game(level((b) => {
      b.pickup(1000, G - 20, 'scope-lens');
      b.box(1000, G - 60, 'wood');
      b.target('rattata', 1500, G);
    }));
    run(game, 1000);
    expect(game.collected).toBe('scope-lens');
    expect(game.events.some((e) => e.type === 'pickup' && e.item === 'scope-lens')).toBe(true);
  });
});

describe('Pidgeot', () => {
  it('turns round on Gust', () => {
    const game = new Game(level((b) => b.target('rattata', 1500, G), ['pidgeot']));
    settle(game);
    game.launch({ x: -100, y: 30 });
    run(game, 300);
    const bird = game.projectiles[0]!.body;
    expect(Matter.Body.getVelocity(bird).x).toBeGreaterThan(0);
    expect(game.useAbility()).toBe(true);
    run(game, 50);
    expect(Matter.Body.getVelocity(bird).x).toBeLessThan(-5);
  });
});

describe('Gengar', () => {
  const wall = () => new Game(level((b) => {
    b.wall(700, G, 'stone', 12);
    b.target('rattata', 1500, G);
  }, ['gengar']));

  it('drifts slowly through a block, not falling, long enough to tap', () => {
    const game = wall();
    settle(game);
    game.launch({ x: -100, y: 0 });
    const ghost = game.projectiles[0]!;
    let insideMs = 0;
    let entered: number | null = null;
    let maxSpeedInside = 0;
    let drop = 0;
    for (let t = 0; t < 3000 && ghost.body.position.x < 760; t += STEP_MS) {
      game.update(STEP_MS);
      if (!ghost.inside) continue;
      insideMs += STEP_MS;
      entered ??= ghost.body.position.y;
      drop = Math.max(drop, ghost.body.position.y - entered);
      if (insideMs > 150) maxSpeedInside = Math.max(maxSpeedInside, Matter.Body.getSpeed(ghost.body));
    }
    // It comes out the other side...
    expect(ghost.body.position.x).toBeGreaterThan(760);
    // ...having spent a good part of a second inside, at a crawl, barely sinking.
    expect(insideMs).toBeGreaterThan(500);
    expect(maxSpeedInside).toBeLessThanOrEqual(PHASE_DRIFT_SPEED + 0.01);
    expect(drop).toBeLessThan(15);
    // Out the far side, it flies on as fast as it went in, rather than dropping.
    const speedOut = Matter.Body.getSpeed(ghost.body);
    expect(speedOut).toBeGreaterThan(15);
    // The wall itself was never touched.
    expect(blocks(game).every((e) => Math.abs(e.body.position.x - 700) < 1)).toBe(true);
  });

  it('bursts out of Phantom Force where it is, hurting the block around it', () => {
    const game = wall();
    settle(game);
    game.launch({ x: -100, y: 0 });
    const ghost = game.projectiles[0]!;
    for (let t = 0; t < 3000 && !ghost.inside; t += STEP_MS) game.update(STEP_MS);
    run(game, 150);
    expect(ghost.inside).toBe(true);
    expect(game.abilityTarget).toBe(ghost);
    expect(game.useAbility()).toBe(true);
    run(game, 50);
    expect(ghost.phasing).toBe(false);
    expect(ghost.inside).toBe(false);
    expect(blocks(game).some((e) => e.hp < e.maxHp)).toBe(true);
  });
});

describe('items', () => {
  const plain = () => level((b) => {
    b.frame(1100, G, 'wood');
    b.target('rattata', 1100, G);
  }, ['pikachu', 'jolteon', 'pikachu']);

  it('work once per level, and only while aiming', () => {
    const game = new Game(plain());
    expect(game.useItem('x-attack')).toBe(true);
    expect(game.useItem('x-attack')).toBe(false);
    game.launch({ x: -100, y: 30 });
    expect(game.useItem('x-speed')).toBe(false);
  });

  it('X Speed launches faster, and the aiming arc knows', () => {
    const game = new Game(plain());
    settle(game);
    game.useItem('x-speed');
    expect(game.launchScale).toBe(X_SPEED_BOOST);
    game.launch({ x: -100, y: 0 });
    const v = Matter.Body.getVelocity(game.projectiles[0]!.body);
    expect(v.x).toBeCloseTo(22 * X_SPEED_BOOST, 0);
    expect(game.launchScale).toBe(1);
  });

  it('X Attack doubles the damage the next shot deals', () => {
    const game = new Game(plain());
    game.useItem('x-attack');
    game.launch({ x: -100, y: 0 });
    expect(game.projectiles[0]!.power).toBe(2);
  });

  it('Max Revive needs a Pokémon to have been sent out, then brings it back', () => {
    const game = new Game(plain());
    expect(game.canUseItem('max-revive')).toBe(false);
    settle(game);
    game.launch({ x: 0, y: 100 });
    for (let t = 0; t < 20_000 && game.phase !== 'aiming'; t += 50) game.update(50);
    expect(game.loaded).toBe('jolteon');
    expect(game.useItem('max-revive')).toBe(true);
    expect(game.queue).toEqual(['pikachu', 'pikachu']);
  });

  it('TM Earthquake shakes everything loose', () => {
    const game = new Game(plain());
    settle(game);
    expect(game.useItem('tm-ground')).toBe(true);
    run(game, 100);
    expect(blocks(game).some((e) => Matter.Body.getSpeed(e.body) > 0.5)).toBe(true);
    expect(game.quakeTime).toBeGreaterThan(0);
  });

  it('Scope Lens lights up the whole arc', () => {
    const game = new Game(plain());
    game.useItem('scope-lens');
    expect(game.fullArc).toBe(true);
  });

  it('Launch position does not move with items', () => {
    const game = new Game(plain());
    game.useItem('x-speed');
    game.launch({ x: -50, y: 10 });
    expect(game.projectiles[0]!.body.position.x).toBeCloseTo(SLING.x - 50, 0);
  });
});
