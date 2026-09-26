import type { TrackId } from '../music';
import type { Material } from '../materials';
import type { ItemKey, LauncherKey, TargetKey } from '../roster';

export interface BlockDef {
  readonly x: number;
  readonly y: number;
  /** For a `ball`, the diameter; `h` equals `w`. */
  readonly w: number;
  readonly h: number;
  readonly material: Material;
  readonly shape?: 'box' | 'ball';
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

/** A Poké Ball with an item inside: anything that touches it collects it. */
export interface PickupDef {
  readonly x: number;
  readonly y: number;
  readonly item: ItemKey;
}

export interface LevelDef {
  /** Stable across releases: progress is saved against it. `<area key>-<n>`. */
  readonly id: string;
  /** Index into AREAS. */
  readonly area: number;
  /** 1–6 within the area; 6 is the boss. */
  readonly index: number;
  readonly name: string;
  /** Right edge of the playfield. */
  readonly width: number;
  readonly launchers: readonly LauncherKey[];
  /** Shots a good player needs. Sets the star thresholds. */
  readonly par: number;
  readonly blocks: readonly BlockDef[];
  readonly terrain: readonly TerrainDef[];
  readonly targets: readonly TargetPlacement[];
  /** The underside of a cave roof across the whole level, if there is one. */
  readonly ceiling?: number;
  /** Stretches of water in place of ground, as [left, right]. Anything that falls in is lost. */
  readonly water?: readonly (readonly [number, number])[];
  readonly pickup?: PickupDef;
  /** Given the first time the level is cleared. */
  readonly reward: ItemKey;
  /** Overrides the area's music. */
  readonly music?: TrackId;
}
