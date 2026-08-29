/**
 * The content format, v1. Mirrors `format.md` field for field — that document
 * is the spec; this file is its TypeScript shadow, kept in sync by hand since
 * content itself is untyped JSON fetched at runtime (see `parse.ts`).
 */

export type VarValue = boolean | number | string | string[];

/** The declared starting values for a story's variables; also its type map. */
export type VariableTable = Readonly<Record<string, VarValue>>;

export type BlockStyle =
  | 'plain'
  | 'aside'
  | 'letter'
  | 'terminal'
  | 'whisper'
  | 'shout'
  | 'epigraph';

export const BLOCK_STYLES: readonly BlockStyle[] = [
  'plain',
  'aside',
  'letter',
  'terminal',
  'whisper',
  'shout',
  'epigraph',
];

export interface TextBlock {
  type: 'text';
  text: string;
  style?: BlockStyle;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export type Block = TextBlock | ImageBlock;

/** A leaf test against one variable. Exactly one comparison key is set. */
export type VarCondition =
  | { var: string; eq: VarValue }
  | { var: string; ne: VarValue }
  | { var: string; gt: number }
  | { var: string; gte: number }
  | { var: string; lt: number }
  | { var: string; lte: number }
  | { var: string; has: string };

export type Condition =
  | VarCondition
  | { visited: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type Mutation =
  | { var: string; op: 'set'; value: VarValue }
  | { var: string; op: 'add'; value: number }
  | { var: string; op: 'sub'; value: number }
  | { var: string; op: 'toggle' }
  | { var: string; op: 'push'; value: string }
  | { var: string; op: 'remove'; value: string };

export interface Choice {
  text: string;
  to: string;
  if?: Condition;
  whenLocked?: 'hide' | 'disable';
  lockedText?: string;
  set?: Mutation[];
  once?: boolean;
}

export type EndingKind = 'good' | 'bad' | 'neutral';

export interface Ending {
  kind: EndingKind;
  title: string;
}

export interface StoryNode {
  blocks: Block[];
  onEnter?: Mutation[];
  theme?: PartialTheme;
  choices?: Choice[];
  ending?: Ending;
}

export type FontId = 'serif' | 'sans' | 'mono' | 'display';

export interface ThemePalette {
  bg?: string;
  surface?: string;
  text?: string;
  dim?: string;
  accent?: string;
  choiceBg?: string;
}

export interface ThemeFont {
  body?: FontId;
  display?: FontId;
  scale?: number;
}

export interface ThemeBackground {
  image?: string;
  fit?: 'cover' | 'contain';
  overlay?: number;
}

/** A full theme block, as it appears on a story. */
export interface Theme {
  mode?: 'dark' | 'light';
  palette?: ThemePalette;
  font?: ThemeFont;
  background?: ThemeBackground;
  radius?: number;
}

/** A node's theme override — same shape, every field still optional. */
export type PartialTheme = Theme;

export interface Story {
  formatVersion: 1;
  id: string;
  title: string;
  author?: string;
  start: string;
  allowBack?: boolean;
  variables: VariableTable;
  theme?: Theme;
  nodes: Readonly<Record<string, StoryNode>>;
}

export interface ManifestEntry {
  id: string;
  title: string;
  author?: string;
  blurb: string;
  path: string;
  cover?: string;
  tags?: string[];
  estimatedMinutes?: number;
}

export interface Manifest {
  formatVersion: 1;
  stories: ManifestEntry[];
}
