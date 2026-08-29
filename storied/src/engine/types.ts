import type { VariableTable } from '../content/types';

/**
 * Everything about one playthrough that isn't the content itself. Immutable —
 * every engine function returns a new `PlayState` rather than mutating one, so
 * a reader can keep old states around for a back stack (see `session.ts`) with
 * no risk of a later mutation reaching into the past.
 */
export interface PlayState {
  storyId: string;
  nodeId: string;
  vars: VariableTable;
  /** Node ids entered so far, each at most once, in first-visit order. */
  visited: readonly string[];
  /** `"nodeId:choiceIndex"` for every `once` choice already taken. */
  taken: readonly string[];
}
