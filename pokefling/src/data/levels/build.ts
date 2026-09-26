/**
 * Structural helpers for writing levels: a frame is two posts and a plank, a
 * tower is frames stacked, and each helper returns the y its top ends at, so
 * floors stack by passing that back in. Everything sits on `base`, a y
 * coordinate (`G`, the ground, or the top of whatever is below).
 */
import { GROUND_Y } from '../../game/world';
import { AREAS } from '../areas';
import type { Material } from '../materials';
import { TARGETS, type ItemKey, type LauncherKey, type TargetKey } from '../roster';
import type { BlockDef, LevelDef, PickupDef, TargetPlacement, TerrainDef } from './types';
import type { TrackId } from '../music';

export const G = GROUND_Y;
/** Post and plank thickness. */
export const T = 20;

export interface LevelMeta {
  name: string;
  width: number;
  launchers: readonly LauncherKey[];
  par: number;
  reward: ItemKey;
  music?: TrackId;
}

export class Build {
  readonly blocks: BlockDef[] = [];
  readonly terrain: TerrainDef[] = [];
  readonly targets: TargetPlacement[] = [];
  private ceilingY: number | undefined;
  private readonly waterSpans: [number, number][] = [];
  private pickupDef: PickupDef | undefined;

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

  /** An explosive crate. */
  tnt(cx: number, base: number, size = 34): number {
    return this.box(cx, base, 'tnt', size);
  }

  /** A round boulder resting on `base`. It will roll if nudged. */
  ball(cx: number, base: number, material: Material = 'stone', size = 44): number {
    this.blocks.push({ x: cx, y: base - size / 2, w: size, h: size, material, shape: 'ball' });
    return base - size;
  }

  /** Two posts and a plank across them. Room inside for one target. */
  frame(cx: number, base: number, material: Material, w = 120, h = 90): number {
    const inset = w / 2 - T / 2;
    this.post(cx - inset, base, material, h);
    this.post(cx + inset, base, material, h);
    return this.plank(cx, base - h, material, w);
  }

  /** Frames stacked, one per material. Returns the base of each floor, then the top. */
  tower(cx: number, base: number, materials: readonly Material[], w = 120, h = 90): number[] {
    const floors = [base];
    let y = base;
    for (const material of materials) {
      y = this.frame(cx, y, material, w, h);
      floors.push(y);
    }
    return floors;
  }

  /** A solid wall: a stack of `count` square blocks. */
  wall(cx: number, base: number, material: Material, count: number, size = 40): number {
    let y = base;
    for (let i = 0; i < count; i += 1) y = this.box(cx, y, material, size);
    return y;
  }

  /**
   * A shelter: a frame with its sides walled in, so it can only be broken
   * open, not shot into. Returns the top of the roof.
   */
  bunker(cx: number, base: number, material: Material, w = 140, h = 90): number {
    const inset = w / 2 - T / 2;
    this.post(cx - inset, base, material, h, T);
    this.post(cx + inset, base, material, h, T);
    this.post(cx - inset - T, base, material, h, T);
    this.post(cx + inset + T, base, material, h, T);
    const roof = this.plank(cx, base - h, material, w + 2 * T);
    return this.plank(cx, roof, material, w + 2 * T);
  }

  /** Rows of square blocks, each row one shorter: `rows` at the bottom. */
  pyramid(cx: number, base: number, material: Material, rows: number, size = 40): number {
    let y = base;
    for (let r = rows; r >= 1; r -= 1) {
      for (let i = 0; i < r; i += 1) this.box(cx + (i - (r - 1) / 2) * size, y, material, size);
      y -= size;
    }
    return y;
  }

  hill(cx: number, w: number, h: number, base = G): number {
    this.terrain.push({ x: cx, y: base - h / 2, w, h });
    return base - h;
  }

  /** A ledge of rock floating at `top`, `h` thick. */
  ledge(cx: number, top: number, w: number, h = 30): number {
    this.terrain.push({ x: cx, y: top + h / 2, w, h });
    return top;
  }

  /** A cave roof whose underside is at `y`. */
  ceiling(y: number): void {
    this.ceilingY = y;
  }

  water(x0: number, x1: number): void {
    this.waterSpans.push([x0, x1]);
  }

  pickup(x: number, y: number, item: ItemKey): void {
    this.pickupDef = { x, y, item };
  }

  /** A target resting on `base`. */
  target(kind: TargetKey, cx: number, base: number): void {
    this.targets.push({ kind, x: cx, y: base - TARGETS[kind].radius });
  }

  /** A target hovering with its centre at `y`. */
  hover(kind: TargetKey, cx: number, y: number): void {
    this.targets.push({ kind, x: cx, y });
  }

  done(area: number, index: number, meta: LevelMeta): LevelDef {
    const areaDef = AREAS[area];
    if (!areaDef) throw new Error(`no area ${area}`);
    return {
      id: `${areaDef.key}-${index}`,
      area,
      index,
      ...meta,
      blocks: this.blocks,
      terrain: this.terrain,
      targets: this.targets,
      ...(this.ceilingY !== undefined ? { ceiling: this.ceilingY } : {}),
      ...(this.waterSpans.length ? { water: this.waterSpans } : {}),
      ...(this.pickupDef ? { pickup: this.pickupDef } : {}),
    };
  }
}
