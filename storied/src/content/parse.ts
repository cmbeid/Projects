/**
 * `unknown` -> `Story` / `Manifest`, with a JSON path on every failure.
 *
 * Content is untyped JSON fetched at runtime, so this is what stands in for
 * the compiler: every field is narrowed explicitly and nothing is ever cast
 * with `as`. A malformed story must fail here with a precise, addressable
 * error rather than reach the UI as a thrown stack or a blank screen.
 */
import type {
  Block,
  BlockStyle,
  Choice,
  Condition,
  Ending,
  EndingKind,
  FontId,
  Manifest,
  ManifestEntry,
  Mutation,
  Story,
  StoryNode,
  Theme,
  ThemeBackground,
  ThemeFont,
  ThemePalette,
  VarValue,
  VariableTable,
} from './types';
import { BLOCK_STYLES } from './types';

export class ContentParseError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new ContentParseError(path, message);
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, `expected an object, got ${describe(value)}`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') return fail(path, `expected a string, got ${describe(value)}`);
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, `expected a number, got ${describe(value)}`);
  }
  return value;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, `expected a boolean, got ${describe(value)}`);
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return fail(path, `expected an array, got ${describe(value)}`);
  return value;
}

function reqField(obj: Record<string, unknown>, key: string, path: string): unknown {
  if (obj[key] === undefined) return fail(path, `missing required field "${key}"`);
  return obj[key];
}

function optField(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

function asVarValue(value: unknown, path: string): VarValue {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => asString(item, `${path}[${i}]`));
  }
  return fail(path, `expected a boolean, number, string, or string array, got ${describe(value)}`);
}

function parseVariables(value: unknown, path: string): VariableTable {
  const obj = asRecord(value, path);
  const out: Record<string, VarValue> = {};
  for (const [key, v] of Object.entries(obj)) {
    out[key] = asVarValue(v, `${path}.${key}`);
  }
  return out;
}

function asBlockStyle(value: unknown, path: string): BlockStyle {
  const s = asString(value, path);
  switch (s) {
    case 'plain':
    case 'aside':
    case 'letter':
    case 'terminal':
    case 'whisper':
    case 'shout':
    case 'epigraph':
      return s;
    default:
      return fail(path, `unknown style "${s}" — expected one of ${BLOCK_STYLES.join(', ')}`);
  }
}

function parseBlock(value: unknown, path: string): Block {
  const obj = asRecord(value, path);
  const type = asString(reqField(obj, 'type', `${path}.type`), `${path}.type`);

  if (type === 'text') {
    const text = asString(reqField(obj, 'text', `${path}.text`), `${path}.text`);
    const styleRaw = optField(obj, 'style');
    return {
      type: 'text',
      text,
      ...(styleRaw !== undefined ? { style: asBlockStyle(styleRaw, `${path}.style`) } : {}),
    };
  }

  if (type === 'image') {
    const src = asString(reqField(obj, 'src', `${path}.src`), `${path}.src`);
    const alt = asString(reqField(obj, 'alt', `${path}.alt`), `${path}.alt`);
    if (alt.trim().length === 0) fail(`${path}.alt`, `must not be empty`);
    const captionRaw = optField(obj, 'caption');
    return {
      type: 'image',
      src,
      alt,
      ...(captionRaw !== undefined ? { caption: asString(captionRaw, `${path}.caption`) } : {}),
    };
  }

  return fail(`${path}.type`, `unknown block type "${type}" — expected "text" or "image"`);
}

const COMPARISON_KEYS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'has'] as const;
const CONDITION_SHAPES = ['all', 'any', 'not', 'visited', 'var'] as const;

function parseCondition(value: unknown, path: string): Condition {
  const obj = asRecord(value, path);
  const shapeKeys = CONDITION_SHAPES.filter((k) => k in obj);
  if (shapeKeys.length !== 1) {
    return fail(
      path,
      `expected exactly one of "var", "visited", "all", "any", "not", found ${
        shapeKeys.length === 0 ? 'none' : shapeKeys.join(', ')
      }`,
    );
  }
  const shape = shapeKeys[0]!;

  if (shape === 'all') {
    const arr = asArray(obj['all'], `${path}.all`);
    return { all: arr.map((c, i) => parseCondition(c, `${path}.all[${i}]`)) };
  }
  if (shape === 'any') {
    const arr = asArray(obj['any'], `${path}.any`);
    return { any: arr.map((c, i) => parseCondition(c, `${path}.any[${i}]`)) };
  }
  if (shape === 'not') {
    return { not: parseCondition(obj['not'], `${path}.not`) };
  }
  if (shape === 'visited') {
    return { visited: asString(obj['visited'], `${path}.visited`) };
  }

  const varName = asString(obj['var'], `${path}.var`);
  const presentOps = COMPARISON_KEYS.filter((k) => k in obj);
  if (presentOps.length !== 1) {
    return fail(
      path,
      `expected exactly one comparison key (${COMPARISON_KEYS.join(', ')}), found ${presentOps.length}`,
    );
  }
  const op = presentOps[0]!;
  if (op === 'eq') return { var: varName, eq: asVarValue(obj['eq'], `${path}.eq`) };
  if (op === 'ne') return { var: varName, ne: asVarValue(obj['ne'], `${path}.ne`) };
  if (op === 'gt') return { var: varName, gt: asNumber(obj['gt'], `${path}.gt`) };
  if (op === 'gte') return { var: varName, gte: asNumber(obj['gte'], `${path}.gte`) };
  if (op === 'lt') return { var: varName, lt: asNumber(obj['lt'], `${path}.lt`) };
  if (op === 'lte') return { var: varName, lte: asNumber(obj['lte'], `${path}.lte`) };
  return { var: varName, has: asString(obj['has'], `${path}.has`) };
}

const MUTATION_OPS = ['set', 'add', 'sub', 'toggle', 'push', 'remove'] as const;

function parseMutation(value: unknown, path: string): Mutation {
  const obj = asRecord(value, path);
  const varName = asString(reqField(obj, 'var', `${path}.var`), `${path}.var`);
  const op = asString(reqField(obj, 'op', `${path}.op`), `${path}.op`);
  const valuePath = `${path}.value`;

  if (op === 'set') return { var: varName, op: 'set', value: asVarValue(reqField(obj, 'value', valuePath), valuePath) };
  if (op === 'add') return { var: varName, op: 'add', value: asNumber(reqField(obj, 'value', valuePath), valuePath) };
  if (op === 'sub') return { var: varName, op: 'sub', value: asNumber(reqField(obj, 'value', valuePath), valuePath) };
  if (op === 'toggle') return { var: varName, op: 'toggle' };
  if (op === 'push') return { var: varName, op: 'push', value: asString(reqField(obj, 'value', valuePath), valuePath) };
  if (op === 'remove') {
    return { var: varName, op: 'remove', value: asString(reqField(obj, 'value', valuePath), valuePath) };
  }
  return fail(`${path}.op`, `unknown op "${op}" — expected one of ${MUTATION_OPS.join(', ')}`);
}

const ENDING_KINDS = ['good', 'bad', 'neutral'] as const;

function asEndingKind(value: string, path: string): EndingKind {
  if (value === 'good' || value === 'bad' || value === 'neutral') return value;
  return fail(path, `expected one of ${ENDING_KINDS.join(', ')}, got "${value}"`);
}

function parseEnding(value: unknown, path: string): Ending {
  const obj = asRecord(value, path);
  const kind = asEndingKind(asString(reqField(obj, 'kind', `${path}.kind`), `${path}.kind`), `${path}.kind`);
  const title = asString(reqField(obj, 'title', `${path}.title`), `${path}.title`);
  return { kind, title };
}

function asFontId(value: unknown, path: string): FontId {
  const s = asString(value, path);
  if (s === 'serif' || s === 'sans' || s === 'mono' || s === 'display') return s;
  return fail(path, `expected one of serif, sans, mono, display, got "${s}"`);
}

const PALETTE_KEYS = ['bg', 'surface', 'text', 'dim', 'accent', 'choiceBg'] as const;

function parseThemePalette(value: unknown, path: string): ThemePalette {
  const obj = asRecord(value, path);
  const palette: ThemePalette = {};
  for (const key of PALETTE_KEYS) {
    const raw = optField(obj, key);
    if (raw !== undefined) palette[key] = asString(raw, `${path}.${key}`);
  }
  return palette;
}

function parseThemeFont(value: unknown, path: string): ThemeFont {
  const obj = asRecord(value, path);
  const bodyRaw = optField(obj, 'body');
  const displayRaw = optField(obj, 'display');
  const scaleRaw = optField(obj, 'scale');
  return {
    ...(bodyRaw !== undefined ? { body: asFontId(bodyRaw, `${path}.body`) } : {}),
    ...(displayRaw !== undefined ? { display: asFontId(displayRaw, `${path}.display`) } : {}),
    ...(scaleRaw !== undefined ? { scale: asNumber(scaleRaw, `${path}.scale`) } : {}),
  };
}

function parseThemeBackground(value: unknown, path: string): ThemeBackground {
  const obj = asRecord(value, path);
  const imageRaw = optField(obj, 'image');
  const fitRaw = optField(obj, 'fit');
  const overlayRaw = optField(obj, 'overlay');

  let fit: 'cover' | 'contain' | undefined;
  if (fitRaw !== undefined) {
    const s = asString(fitRaw, `${path}.fit`);
    if (s !== 'cover' && s !== 'contain') fail(`${path}.fit`, `expected "cover" or "contain", got "${s}"`);
    fit = s;
  }

  return {
    ...(imageRaw !== undefined ? { image: asString(imageRaw, `${path}.image`) } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(overlayRaw !== undefined ? { overlay: asNumber(overlayRaw, `${path}.overlay`) } : {}),
  };
}

function parseTheme(value: unknown, path: string): Theme {
  const obj = asRecord(value, path);
  const modeRaw = optField(obj, 'mode');
  const paletteRaw = optField(obj, 'palette');
  const fontRaw = optField(obj, 'font');
  const backgroundRaw = optField(obj, 'background');
  const radiusRaw = optField(obj, 'radius');

  let mode: 'dark' | 'light' | undefined;
  if (modeRaw !== undefined) {
    const s = asString(modeRaw, `${path}.mode`);
    if (s !== 'dark' && s !== 'light') fail(`${path}.mode`, `expected "dark" or "light", got "${s}"`);
    mode = s;
  }

  return {
    ...(mode !== undefined ? { mode } : {}),
    ...(paletteRaw !== undefined ? { palette: parseThemePalette(paletteRaw, `${path}.palette`) } : {}),
    ...(fontRaw !== undefined ? { font: parseThemeFont(fontRaw, `${path}.font`) } : {}),
    ...(backgroundRaw !== undefined
      ? { background: parseThemeBackground(backgroundRaw, `${path}.background`) }
      : {}),
    ...(radiusRaw !== undefined ? { radius: asNumber(radiusRaw, `${path}.radius`) } : {}),
  };
}

function parseChoice(value: unknown, path: string): Choice {
  const obj = asRecord(value, path);
  const text = asString(reqField(obj, 'text', `${path}.text`), `${path}.text`);
  const to = asString(reqField(obj, 'to', `${path}.to`), `${path}.to`);
  const ifRaw = optField(obj, 'if');
  const whenLockedRaw = optField(obj, 'whenLocked');
  const lockedTextRaw = optField(obj, 'lockedText');
  const setRaw = optField(obj, 'set');
  const onceRaw = optField(obj, 'once');

  let whenLocked: 'hide' | 'disable' | undefined;
  if (whenLockedRaw !== undefined) {
    const s = asString(whenLockedRaw, `${path}.whenLocked`);
    if (s !== 'hide' && s !== 'disable') fail(`${path}.whenLocked`, `expected "hide" or "disable", got "${s}"`);
    whenLocked = s;
  }

  return {
    text,
    to,
    ...(ifRaw !== undefined ? { if: parseCondition(ifRaw, `${path}.if`) } : {}),
    ...(whenLocked !== undefined ? { whenLocked } : {}),
    ...(lockedTextRaw !== undefined ? { lockedText: asString(lockedTextRaw, `${path}.lockedText`) } : {}),
    ...(setRaw !== undefined
      ? { set: asArray(setRaw, `${path}.set`).map((m, i) => parseMutation(m, `${path}.set[${i}]`)) }
      : {}),
    ...(onceRaw !== undefined ? { once: asBoolean(onceRaw, `${path}.once`) } : {}),
  };
}

function parseNode(value: unknown, path: string): StoryNode {
  const obj = asRecord(value, path);
  const blocksRaw = asArray(reqField(obj, 'blocks', `${path}.blocks`), `${path}.blocks`);
  if (blocksRaw.length === 0) fail(`${path}.blocks`, `must contain at least one block`);
  const blocks = blocksRaw.map((b, i) => parseBlock(b, `${path}.blocks[${i}]`));

  const onEnterRaw = optField(obj, 'onEnter');
  const themeRaw = optField(obj, 'theme');
  const choicesRaw = optField(obj, 'choices');
  const endingRaw = optField(obj, 'ending');

  const choices =
    choicesRaw !== undefined
      ? asArray(choicesRaw, `${path}.choices`).map((c, i) => parseChoice(c, `${path}.choices[${i}]`))
      : undefined;
  const isEnding = choices === undefined || choices.length === 0;

  if (isEnding && endingRaw === undefined) fail(path, `has no choices, so it must declare "ending"`);
  if (!isEnding && endingRaw !== undefined) fail(path, `has choices, so it must not declare "ending"`);

  return {
    blocks,
    ...(onEnterRaw !== undefined
      ? { onEnter: asArray(onEnterRaw, `${path}.onEnter`).map((m, i) => parseMutation(m, `${path}.onEnter[${i}]`)) }
      : {}),
    ...(themeRaw !== undefined ? { theme: parseTheme(themeRaw, `${path}.theme`) } : {}),
    ...(choices !== undefined && choices.length > 0 ? { choices } : {}),
    ...(endingRaw !== undefined ? { ending: parseEnding(endingRaw, `${path}.ending`) } : {}),
  };
}

function expectFormatVersion(obj: Record<string, unknown>, path: string): 1 {
  const raw = reqField(obj, 'formatVersion', `${path}.formatVersion`);
  if (raw !== 1) fail(`${path}.formatVersion`, `expected 1, got ${describe(raw)}`);
  return 1;
}

export function parseStory(data: unknown, path = '$'): Story {
  const obj = asRecord(data, path);
  const formatVersion = expectFormatVersion(obj, path);
  const id = asString(reqField(obj, 'id', `${path}.id`), `${path}.id`);
  const title = asString(reqField(obj, 'title', `${path}.title`), `${path}.title`);
  const authorRaw = optField(obj, 'author');
  const blurbRaw = optField(obj, 'blurb');
  const coverRaw = optField(obj, 'cover');
  const tagsRaw = optField(obj, 'tags');
  const estimatedMinutesRaw = optField(obj, 'estimatedMinutes');
  const start = asString(reqField(obj, 'start', `${path}.start`), `${path}.start`);
  const allowBackRaw = optField(obj, 'allowBack');
  const variables = parseVariables(reqField(obj, 'variables', `${path}.variables`), `${path}.variables`);
  const themeRaw = optField(obj, 'theme');
  const nodesRaw = asRecord(reqField(obj, 'nodes', `${path}.nodes`), `${path}.nodes`);

  const nodes: Record<string, StoryNode> = {};
  for (const [nodeId, nodeValue] of Object.entries(nodesRaw)) {
    nodes[nodeId] = parseNode(nodeValue, `${path}.nodes.${nodeId}`);
  }

  return {
    formatVersion,
    id,
    title,
    ...(authorRaw !== undefined ? { author: asString(authorRaw, `${path}.author`) } : {}),
    ...(blurbRaw !== undefined ? { blurb: asString(blurbRaw, `${path}.blurb`) } : {}),
    ...(coverRaw !== undefined ? { cover: asString(coverRaw, `${path}.cover`) } : {}),
    ...(tagsRaw !== undefined
      ? { tags: asArray(tagsRaw, `${path}.tags`).map((t, i) => asString(t, `${path}.tags[${i}]`)) }
      : {}),
    ...(estimatedMinutesRaw !== undefined
      ? { estimatedMinutes: asNumber(estimatedMinutesRaw, `${path}.estimatedMinutes`) }
      : {}),
    start,
    ...(allowBackRaw !== undefined ? { allowBack: asBoolean(allowBackRaw, `${path}.allowBack`) } : {}),
    variables,
    ...(themeRaw !== undefined ? { theme: parseTheme(themeRaw, `${path}.theme`) } : {}),
    nodes,
  };
}

function parseManifestEntry(value: unknown, path: string): ManifestEntry {
  const obj = asRecord(value, path);
  const id = asString(reqField(obj, 'id', `${path}.id`), `${path}.id`);
  const title = asString(reqField(obj, 'title', `${path}.title`), `${path}.title`);
  const authorRaw = optField(obj, 'author');
  const blurb = asString(reqField(obj, 'blurb', `${path}.blurb`), `${path}.blurb`);
  const entryPath = asString(reqField(obj, 'path', `${path}.path`), `${path}.path`);
  const coverRaw = optField(obj, 'cover');
  const tagsRaw = optField(obj, 'tags');
  const estimatedMinutesRaw = optField(obj, 'estimatedMinutes');

  return {
    id,
    title,
    ...(authorRaw !== undefined ? { author: asString(authorRaw, `${path}.author`) } : {}),
    blurb,
    path: entryPath,
    ...(coverRaw !== undefined ? { cover: asString(coverRaw, `${path}.cover`) } : {}),
    ...(tagsRaw !== undefined
      ? { tags: asArray(tagsRaw, `${path}.tags`).map((t, i) => asString(t, `${path}.tags[${i}]`)) }
      : {}),
    ...(estimatedMinutesRaw !== undefined
      ? { estimatedMinutes: asNumber(estimatedMinutesRaw, `${path}.estimatedMinutes`) }
      : {}),
  };
}

export function parseManifest(data: unknown, path = '$'): Manifest {
  const obj = asRecord(data, path);
  const formatVersion = expectFormatVersion(obj, path);
  const storiesRaw = asArray(reqField(obj, 'stories', `${path}.stories`), `${path}.stories`);
  const stories = storiesRaw.map((s, i) => parseManifestEntry(s, `${path}.stories[${i}]`));
  return { formatVersion, stories };
}
