import { INDEX } from '../data/index';
import { combine } from '../game/engine';
import { clearSave, createInitialState, loadState, saveState } from './persistence';
import type { CombineResult, GameState, Token } from './types';

type Listener = () => void;

const SAVE_DEBOUNCE_MS = 250;

/**
 * The single source of truth for the running game.
 *
 * Deliberately tiny: components subscribe, read state directly, and re-render
 * themselves. With a few hundred DOM nodes at most there is nothing here worth
 * a framework, and the alternative — each component tracking its own copy —
 * is what causes the board and the inventory to disagree.
 */
class Store {
  private state: GameState;
  private discoveredSet: Set<string>;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial: GameState) {
    this.state = initial;
    this.discoveredSet = new Set(initial.discovered);
  }

  get(): Readonly<GameState> {
    return this.state;
  }

  /** Discovered ids as a set, for O(1) membership checks in hot paths. */
  get discovered(): ReadonlySet<string> {
    return this.discoveredSet;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Board ---------------------------------------------------------------

  addToken(elementId: string, fx: number, fy: number): Token {
    const token: Token = {
      uid: this.state.nextUid,
      elementId,
      fx: clamp01(fx),
      fy: clamp01(fy),
    };
    this.state.nextUid += 1;
    this.state.tokens.push(token);
    this.changed();
    return token;
  }

  moveToken(uid: number, fx: number, fy: number): void {
    const token = this.state.tokens.find((candidate) => candidate.uid === uid);
    if (!token) return;
    token.fx = clamp01(fx);
    token.fy = clamp01(fy);
    this.changed();
  }

  removeToken(uid: number): void {
    this.state.tokens = this.state.tokens.filter((token) => token.uid !== uid);
    this.changed();
  }

  clearBoard(): void {
    if (this.state.tokens.length === 0) return;
    this.state.tokens = [];
    this.changed();
  }

  // --- Play ----------------------------------------------------------------

  /**
   * Resolves dropping one token onto another.
   *
   * On success both source tokens are consumed and the results appear where
   * they met. Discoveries are recorded here so the caller cannot forget to.
   */
  combineTokens(sourceUid: number, targetUid: number): CombineResult {
    const source = this.state.tokens.find((token) => token.uid === sourceUid);
    const target = this.state.tokens.find((token) => token.uid === targetUid);
    if (!source || !target || source.uid === target.uid) return { kind: 'none' };

    const result = combine(INDEX, this.discoveredSet, source.elementId, target.elementId);
    if (result.kind === 'none') return result;

    const fx = (source.fx + target.fx) / 2;
    const fy = (source.fy + target.fy) / 2;

    this.state.tokens = this.state.tokens.filter(
      (token) => token.uid !== sourceUid && token.uid !== targetUid,
    );

    // Spread multiple results apart a little so they do not land on top of
    // each other and read as a single token.
    result.outputs.forEach((elementId, position) => {
      const offset = (position - (result.outputs.length - 1) / 2) * 0.09;
      this.state.tokens.push({
        uid: this.state.nextUid++,
        elementId,
        fx: clamp01(fx + offset),
        fy: clamp01(fy),
      });
    });

    for (const id of result.discoveries) {
      if (this.discoveredSet.has(id)) continue;
      this.discoveredSet.add(id);
      this.state.discovered.push(id);
    }

    this.changed();
    return result;
  }

  recordHintUsed(): void {
    this.state.hintsUsed += 1;
    this.changed();
  }

  // --- Settings ------------------------------------------------------------

  setSound(enabled: boolean): void {
    this.state.settings.sound = enabled;
    this.changed();
  }

  resetProgress(): void {
    this.state = createInitialState();
    this.discoveredSet = new Set(this.state.discovered);
    clearSave();
    this.changed();
  }

  // --- Internals -----------------------------------------------------------

  private changed(): void {
    for (const listener of this.listeners) listener();
    this.scheduleSave();
  }

  /**
   * Saving is debounced because dragging fires a move on every pointer frame,
   * and serialising the whole board sixty times a second is pure waste.
   */
  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      saveState(this.state);
    }, SAVE_DEBOUNCE_MS);
  }

  /** Flushes any pending save immediately, for page-hide. */
  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    saveState(this.state);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const knownIds = new Set(INDEX.all.map((element) => element.id));

export const store = new Store(loadState(knownIds));
