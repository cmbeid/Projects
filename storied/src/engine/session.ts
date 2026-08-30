/**
 * The playthrough state machine: `startSession` begins one, `available`
 * reports what can be chosen from the current node, `choose` advances it.
 * Pure and DOM-free, on purpose — see PLAN.md §3: it's what makes the whole
 * of the interesting behaviour testable with no browser, and it's the only
 * thing the UI (phase 3+) calls into.
 */
import type { Choice, Story, StoryNode } from '../content/types';
import { evaluateCondition } from './conditions';
import { applyMutations } from './mutate';
import type { PlayState } from './types';

export function currentNode(story: Story, state: PlayState): StoryNode {
  const node = story.nodes[state.nodeId];
  if (!node) throw new Error(`current node "${state.nodeId}" does not exist in this story`);
  return node;
}

export function isEnding(story: Story, state: PlayState): boolean {
  return currentNode(story, state).ending !== undefined;
}

/**
 * Applies a destination node's `onEnter` mutations and records the visit.
 * The one place both `startSession` and `choose` funnel through, so a node
 * is entered identically whether it's where a playthrough begins or where a
 * choice leads.
 */
function enterNode(story: Story, state: PlayState, nodeId: string): PlayState {
  const node = story.nodes[nodeId];
  if (!node) throw new Error(`cannot enter node "${nodeId}" — it does not exist in this story`);
  const vars = node.onEnter ? applyMutations(node.onEnter, state.vars) : state.vars;
  const visited = state.visited.includes(nodeId) ? state.visited : [...state.visited, nodeId];
  return { ...state, nodeId, vars, visited };
}

export function startSession(story: Story): PlayState {
  const initial: PlayState = {
    storyId: story.id,
    nodeId: story.start,
    vars: story.variables,
    visited: [],
    taken: [],
  };
  return enterNode(story, initial, story.start);
}

export interface ResolvedChoice {
  index: number;
  text: string;
  to: string;
  /** False if `if` fails, or a `once` choice has already been taken. */
  locked: boolean;
  lockedText?: string;
}

function takenKey(nodeId: string, index: number): string {
  return `${nodeId}:${index}`;
}

function isLocked(choice: Choice, nodeId: string, index: number, state: PlayState): boolean {
  const passesIf = choice.if ? evaluateCondition(choice.if, state) : true;
  const usedUp = choice.once === true && state.taken.includes(takenKey(nodeId, index));
  return !passesIf || usedUp;
}

/**
 * The choices visible at the current node — a `whenLocked: "hide"` choice
 * (the default) that's locked is omitted entirely rather than returned
 * locked, so the UI never has to re-derive that rule.
 */
export function available(story: Story, state: PlayState): ResolvedChoice[] {
  const node = currentNode(story, state);
  const out: ResolvedChoice[] = [];
  (node.choices ?? []).forEach((choice, index) => {
    const locked = isLocked(choice, state.nodeId, index, state);
    if (locked && (choice.whenLocked ?? 'hide') === 'hide') return;
    out.push({
      index,
      text: choice.text,
      to: choice.to,
      locked,
      ...(choice.lockedText !== undefined ? { lockedText: choice.lockedText } : {}),
    });
  });
  return out;
}

/**
 * Applies choice `index` from the current node and returns the resulting
 * state. Order follows format.md §7 exactly: the choice's own `set` runs
 * first, then the destination node is entered and its `onEnter` runs.
 * Throws on a locked or out-of-range choice — the UI is expected to consult
 * `available()` before ever calling this, so reaching here with a bad index
 * means a UI bug, not a player action to fail gracefully.
 */
export function choose(story: Story, state: PlayState, index: number): PlayState {
  const node = currentNode(story, state);
  const choice = (node.choices ?? [])[index];
  if (!choice) throw new Error(`node "${state.nodeId}" has no choice at index ${index}`);
  if (isLocked(choice, state.nodeId, index, state)) {
    throw new Error(`choice ${index} at node "${state.nodeId}" is locked`);
  }

  const vars = choice.set ? applyMutations(choice.set, state.vars) : state.vars;
  const taken = choice.once === true ? [...state.taken, takenKey(state.nodeId, index)] : state.taken;
  return enterNode(story, { ...state, vars, taken }, choice.to);
}

/**
 * Whether the reader should offer a back button at all. The back stack
 * itself — snapshots of prior `PlayState`s — lives in the UI (phase 3+),
 * not here: inverting a `set` mutation isn't possible in general, so
 * "go back" means "restore an earlier state the caller already kept",
 * never an engine-computed undo.
 */
export function allowsBack(story: Story): boolean {
  return story.allowBack !== false;
}
