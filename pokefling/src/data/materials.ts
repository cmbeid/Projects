export type Material = 'wood' | 'ice' | 'stone';

export interface MaterialDef {
  /** In units of velocity change — see `impactDamage`. */
  readonly hp: number;
  readonly density: number;
  readonly friction: number;
  readonly points: number;
}

export const MATERIALS: Readonly<Record<Material, MaterialDef>> = {
  wood: { hp: 70, density: 0.002, friction: 0.8, points: 500 },
  ice: { hp: 35, density: 0.0016, friction: 0.4, points: 300 },
  stone: { hp: 130, density: 0.004, friction: 0.9, points: 800 },
};
