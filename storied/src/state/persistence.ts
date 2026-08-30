/**
 * Per-story saves, versioned and defensively loaded — the same posture as
 * `starseed/src/state/persistence.ts`: a corrupt or outdated save starts a
 * fresh playthrough rather than throwing, and every id is checked against
 * the *current* story rather than trusted, since content can change between
 * when a save was written and when it's read back.
 */
import type { Story, VarValue } from '../content/types';
import { startSession } from '../engine/session';
import type { PlayState } from '../engine/types';

const SAVE_VERSION = 1;

function storageKey(storyId: string): string {
  return `storied:save:${storyId}`;
}

interface SaveFile {
  version: number;
  nodeId: string;
  vars: Record<string, VarValue>;
  visited: string[];
  taken: string[];
}

export function hasSave(storyId: string): boolean {
  try {
    return localStorage.getItem(storageKey(storyId)) !== null;
  } catch {
    // Private browsing / blocked storage throws on access.
    return false;
  }
}

function readRaw(storyId: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey(storyId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isVarValue(value: unknown): value is VarValue {
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function kindOf(value: VarValue): 'boolean' | 'number' | 'string' | 'list' {
  return Array.isArray(value) ? 'list' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string';
}

function uniqueKnownNodes(ids: unknown, story: Story): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id) || !(id in story.nodes)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** `"nodeId:choiceIndex"` — kept only if that node and that choice both still exist. */
function uniqueKnownChoiceKeys(keys: unknown, story: Story): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (typeof key !== 'string' || seen.has(key)) continue;
    const sep = key.lastIndexOf(':');
    if (sep === -1) continue;
    const node = story.nodes[key.slice(0, sep)];
    const index = Number(key.slice(sep + 1));
    if (!node || !Number.isInteger(index) || index < 0 || index >= (node.choices?.length ?? 0)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Loads a playthrough for `story`, falling back to a fresh `startSession`
 * whenever the saved state can't be trusted: no save, a version this build
 * doesn't recognise, a corrupt payload, or a `nodeId` the story no longer
 * has (a content edit removed or renamed it). Never throws — resuming into
 * something that no longer makes sense is a worse failure than starting
 * over silently.
 *
 * A variable is kept only if the save's value is present and the same kind
 * (boolean/number/string/list) as the story's own declared starting value;
 * anything else falls back to that starting value rather than being trusted.
 */
export function loadSession(story: Story): PlayState {
  const parsed = readRaw(story.id);
  if (!parsed || typeof parsed !== 'object') return startSession(story);

  const save = parsed as Partial<SaveFile>;
  if (save.version !== SAVE_VERSION) return startSession(story);
  if (typeof save.nodeId !== 'string' || !(save.nodeId in story.nodes)) return startSession(story);

  const savedVars = save.vars && typeof save.vars === 'object' ? (save.vars as Record<string, unknown>) : {};
  const vars: Record<string, VarValue> = {};
  for (const [name, initial] of Object.entries(story.variables)) {
    const value = savedVars[name];
    vars[name] = isVarValue(value) && kindOf(value) === kindOf(initial) ? value : initial;
  }

  return {
    storyId: story.id,
    nodeId: save.nodeId,
    vars,
    visited: uniqueKnownNodes(save.visited, story),
    taken: uniqueKnownChoiceKeys(save.taken, story),
  };
}

export function saveSession(state: PlayState): void {
  const file: SaveFile = {
    version: SAVE_VERSION,
    nodeId: state.nodeId,
    vars: { ...state.vars },
    visited: [...state.visited],
    taken: [...state.taken],
  };
  try {
    localStorage.setItem(storageKey(state.storyId), JSON.stringify(file));
  } catch {
    // Storage full, disabled, or private browsing. Play continues in memory.
  }
}

export function clearSession(storyId: string): void {
  try {
    localStorage.removeItem(storageKey(storyId));
  } catch {
    /* nothing to clean up if storage was never readable */
  }
}
