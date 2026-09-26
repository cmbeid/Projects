/**
 * The levels, built with a few structural helpers rather than written out as
 * raw coordinates: a frame is two posts and a plank, and each helper returns
 * the y its top ends at, so floors stack by passing that back in.
 *
 * `tests/levels.test.ts` checks that every level is well-formed and that each
 * one stands up on its own before the first shot.
 */
import type { Material } from './materials';
import type { LauncherKey, TargetKey } from './roster';
import { TARGETS } from './roster';
import { GROUND_Y } from '../game/world';

export interface BlockDef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly material: Material;
}

/** Immovable ground-coloured rock. Not scored, never breaks. */
export interface TerrainDef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TargetPlacement {
  readonly kind: TargetKey;
  readonly x: number;
  readonly y: number;
}

export interface LevelDef {
  readonly id: number;
  readonly world: number;
  readonly name: string;
  /** Right edge of the playfield. */
  readonly width: number;
  readonly launchers: readonly LauncherKey[];
  /** Shots a good player needs. Sets the star thresholds. */
  readonly par: number;
  readonly blocks: readonly BlockDef[];
  readonly terrain: readonly TerrainDef[];
  readonly targets: readonly TargetPlacement[];
}

export const WORLDS = ['Viridian Forest', 'Mt. Moon', 'Rocket Hideout'] as const;

const T = 20; // post and plank thickness

class Build {
  readonly blocks: BlockDef[] = [];
  readonly terrain: TerrainDef[] = [];
  readonly targets: TargetPlacement[] = [];

  /** An upright post standing on `base`. */
  post(cx: number, base: number, material: Material, h = 90, w = T): number {
    this.blocks.push({ x: cx, y: base - h / 2, w, h, material });
    return base - h;
  }

  /** A plank lying on `base`. */
  plank(cx: number, base: number, material: Material, w = 120, h = T): number {
    this.blocks.push({ x: cx, y: base - h / 2, w, h, material });
    return base - h;
  }

  /** A square block sitting on `base`. */
  box(cx: number, base: number, material: Material, size = 40): number {
    return this.plank(cx, base, material, size, size);
  }

  /** Two posts and a plank across them. Room inside for one target. */
  frame(cx: number, base: number, material: Material, w = 120, h = 90): number {
    const inset = w / 2 - T / 2;
    this.post(cx - inset, base, material, h);
    this.post(cx + inset, base, material, h);
    return this.plank(cx, base - h, material, w);
  }

  /** Frames stacked `floors` high. Returns the base of each floor, then the top. */
  tower(cx: number, base: number, materials: readonly Material[], w = 120, h = 90): number[] {
    const floors = [base];
    let y = base;
    for (const material of materials) {
      y = this.frame(cx, y, material, w, h);
      floors.push(y);
    }
    return floors;
  }

  hill(cx: number, w: number, h: number): number {
    this.terrain.push({ x: cx, y: GROUND_Y - h / 2, w, h });
    return GROUND_Y - h;
  }

  /** A target resting on `base`. */
  target(kind: TargetKey, cx: number, base: number): void {
    this.targets.push({ kind, x: cx, y: base - TARGETS[kind].radius });
  }

  /** A target hovering with its centre at `y`. */
  hover(kind: TargetKey, cx: number, y: number): void {
    this.targets.push({ kind, x: cx, y });
  }

  done(meta: Omit<LevelDef, 'blocks' | 'terrain' | 'targets'>): LevelDef {
    return { ...meta, blocks: this.blocks, terrain: this.terrain, targets: this.targets };
  }
}

const G = GROUND_Y;

function level1(): LevelDef {
  const b = new Build();
  const top = b.frame(1100, G, 'wood');
  b.target('meowth', 1100, G);
  b.target('meowth', 1100, top);
  return b.done({ id: 1, world: 0, name: 'First Fling', width: 1700, par: 1,
    launchers: ['pikachu', 'pikachu', 'pikachu'] });
}

function level2(): LevelDef {
  const b = new Build();
  const [, mid, top] = b.tower(1050, G, ['wood', 'wood']) as [number, number, number];
  b.target('meowth', 1050, G);
  b.target('meowth', 1050, mid);
  b.box(1050, top, 'wood');
  const roof = b.frame(1300, G, 'wood');
  b.target('ekans', 1300, G);
  b.box(1280, roof, 'wood');
  b.box(1320, roof, 'wood');
  return b.done({ id: 2, world: 0, name: 'Viridian Twins', width: 1800, par: 2,
    launchers: ['pikachu', 'jolteon', 'pikachu'] });
}

function level3(): LevelDef {
  const b = new Build();
  const floors = b.tower(1200, G, ['ice', 'ice', 'ice']);
  for (const base of floors.slice(0, 3)) b.target('meowth', 1200, base);
  b.box(1200, floors[3] ?? G, 'ice');
  b.post(1020, G, 'wood', 60);
  return b.done({ id: 3, world: 0, name: 'Frozen Lookout', width: 1800, par: 2,
    launchers: ['staryu', 'pikachu', 'staryu'] });
}

function level4(): LevelDef {
  const b = new Build();
  const left = b.frame(1040, G, 'wood');
  b.frame(1180, G, 'wood');
  b.target('meowth', 1040, G);
  b.target('meowth', 1180, G);
  const peak = b.frame(1110, left, 'wood', 180);
  b.target('meowth', 1110, left);
  b.target('ekans', 1110, peak);
  b.box(995, left, 'ice', 30);
  b.box(1225, left, 'ice', 30);
  return b.done({ id: 4, world: 0, name: 'Forest Fort', width: 1800, par: 2,
    launchers: ['pikachu', 'jolteon', 'staryu', 'pikachu'] });
}

function level5(): LevelDef {
  const b = new Build();
  const mid = b.frame(1150, G, 'stone', 140);
  b.target('meowth', 1150, G);
  const top = b.frame(1150, mid, 'wood');
  b.target('meowth', 1150, mid);
  b.box(1130, top, 'ice', 30);
  b.box(1170, top, 'ice', 30);
  b.box(960, G, 'stone', 50);
  return b.done({ id: 5, world: 1, name: 'Moonstone Hut', width: 1800, par: 2,
    launchers: ['snorlax', 'pikachu', 'pikachu'] });
}

function level6(): LevelDef {
  const b = new Build();
  b.post(950, G, 'wood', 80);
  b.target('meowth', 1000, G);
  const cliff = b.hill(1300, 320, 130);
  const [, mid, top] = b.tower(1300, cliff, ['stone', 'wood']) as [number, number, number];
  b.target('ekans', 1300, cliff);
  b.target('meowth', 1300, mid);
  b.box(1300, top, 'stone', 40);
  return b.done({ id: 6, world: 1, name: 'Cliffside', width: 1900, par: 2,
    launchers: ['voltorb', 'snorlax', 'pikachu'] });
}

function level7(): LevelDef {
  const b = new Build();
  const leftFloors = b.tower(1000, G, ['stone', 'stone']);
  const rightFloors = b.tower(1400, G, ['stone', 'stone']);
  b.target('meowth', 1000, G);
  b.target('meowth', 1400, G);
  b.target('ekans', 1000, leftFloors[1] ?? G);
  b.target('ekans', 1400, rightFloors[1] ?? G);
  // A bridge from roof to roof, with the boss in the middle of it.
  const deck = b.plank(1200, leftFloors[2] ?? G, 'wood', 520);
  b.target('grimer', 1200, deck);
  return b.done({ id: 7, world: 1, name: 'Crater Castle', width: 2000, par: 3,
    launchers: ['jolteon', 'voltorb', 'staryu', 'snorlax'] });
}

function level8(): LevelDef {
  const b = new Build();
  const materials: Material[] = ['wood', 'ice', 'wood', 'stone'];
  const kinds: TargetKey[] = ['meowth', 'ekans', 'meowth', 'ekans'];
  materials.forEach((material, i) => {
    const cx = 950 + i * 150;
    const top = b.frame(cx, G, material);
    b.target(kinds[i] ?? 'meowth', cx, G);
    if (i % 2 === 1) b.box(cx, top, 'ice', 30);
  });
  return b.done({ id: 8, world: 1, name: 'Zubat Row', width: 1900, par: 3,
    launchers: ['staryu', 'staryu', 'jolteon', 'voltorb'] });
}

function level9(): LevelDef {
  const b = new Build();
  const top = b.frame(1200, G, 'stone');
  b.target('ekans', 1200, G);
  b.box(1200, top, 'wood');
  b.hover('koffing', 1000, 380);
  b.hover('koffing', 1400, 320);
  return b.done({ id: 9, world: 2, name: 'Smoke Screen', width: 1900, par: 2,
    launchers: ['pikachu', 'jolteon', 'staryu'] });
}

function level10(): LevelDef {
  const b = new Build();
  b.post(1170, G, 'ice', 110, 30);
  b.post(1430, G, 'ice', 110, 30);
  const roof = b.frame(1300, G, 'stone', 160, 90);
  b.target('grimer', 1300, G);
  const cap = b.plank(1300, roof, 'stone', 100);
  b.target('meowth', 1300, cap);
  return b.done({ id: 10, world: 2, name: 'Sludge Bunker', width: 1900, par: 2,
    launchers: ['snorlax', 'voltorb', 'voltorb', 'pikachu'] });
}

function level11(): LevelDef {
  const b = new Build();
  const floors = b.tower(1300, G, ['stone', 'wood', 'ice', 'wood']);
  const kinds: TargetKey[] = ['ekans', 'meowth', 'meowth', 'meowth'];
  kinds.forEach((kind, i) => b.target(kind, 1300, floors[i] ?? G));
  b.hover('koffing', 1300, (floors[4] ?? G) - 90);
  b.frame(1080, G, 'wood');
  b.target('meowth', 1080, G);
  return b.done({ id: 11, world: 2, name: 'Rocket Tower', width: 1900, par: 3,
    launchers: ['jolteon', 'snorlax', 'voltorb', 'staryu', 'pikachu'] });
}

function level12(): LevelDef {
  const b = new Build();
  const front = b.tower(1000, G, ['wood', 'ice']);
  b.target('meowth', 1000, G);
  b.target('ekans', 1000, front[1] ?? G);
  const hilltop = b.hill(1450, 360, 100);
  const keep = b.tower(1450, hilltop, ['stone', 'stone'], 160);
  b.target('grimer', 1450, hilltop);
  b.target('ekans', 1450, keep[1] ?? G);
  b.box(1420, keep[2] ?? G, 'stone', 40);
  b.box(1480, keep[2] ?? G, 'wood', 40);
  b.hover('koffing', 1220, 300);
  b.hover('koffing', 1650, 260);
  return b.done({ id: 12, world: 2, name: "Boss's Gauntlet", width: 2100, par: 4,
    launchers: ['jolteon', 'voltorb', 'staryu', 'snorlax', 'voltorb', 'pikachu'] });
}

export const LEVELS: readonly LevelDef[] = [
  level1(), level2(), level3(), level4(),
  level5(), level6(), level7(), level8(),
  level9(), level10(), level11(), level12(),
];
