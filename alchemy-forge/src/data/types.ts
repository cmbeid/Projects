/** A single discoverable element. */
export interface Element {
  /** Stable, lowercase, hyphen-free identifier. Used in save files. */
  id: string;
  /** Display name. */
  name: string;
  /** Unicode emoji used as the default icon. */
  emoji: string;
  /**
   * Optional inline SVG markup. When present it replaces the emoji, which is
   * the upgrade path from emoji art to custom icons without a data migration.
   */
  icon?: string;
  /** Grouping used for encyclopedia filtering and flavour. */
  category: Category;
  /** One-line flavour text shown in the detail modal. */
  blurb: string;
  /**
   * Adult joke content. Hidden entirely unless the player opts into spicy
   * mode, so the default game stays safe to hand to anyone.
   */
  spicy?: true;
}

export type Category =
  | 'base'
  | 'primordial'
  | 'nature'
  | 'life'
  | 'civilization'
  | 'technology'
  | 'culture'
  | 'cosmos'
  | 'mythology'
  | 'kitchen'
  | 'ocean'
  | 'body'
  | 'modern'
  | 'arcana'
  | 'apocalypse'
  | 'spicy';

/**
 * One combination. Order-agnostic: `a` and `b` are interchangeable, and every
 * lookup normalises through `pairKey`.
 *
 * A pair may appear more than once to yield multiple outputs.
 */
export interface Recipe {
  a: string;
  b: string;
  out: string;
}

/** A themed bundle of elements plus the recipes that unlock them. */
export interface Pack {
  id: string;
  title: string;
  elements: Element[];
  recipes: Recipe[];
}

/** The four elements the player always starts with. */
export const BASE_ELEMENT_IDS = ['air', 'earth', 'fire', 'water'] as const;
