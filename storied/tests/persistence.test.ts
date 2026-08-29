// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, hasSave, loadSession, saveSession } from '../src/state/persistence';
import { choose, startSession } from '../src/engine/session';
import type { Story } from '../src/content/types';

const STORY: Story = {
  formatVersion: 1,
  id: 'demo',
  title: 'Demo',
  start: 'a',
  variables: { flag: false, count: 0, name: 'x', bag: [] },
  nodes: {
    a: {
      blocks: [{ type: 'text', text: 'hi' }],
      choices: [{ text: 'go', to: 'b', set: [{ var: 'count', op: 'add', value: 1 }] }],
    },
    b: {
      blocks: [{ type: 'text', text: 'mid' }],
      choices: [{ text: 'once', to: 'c', once: true }],
    },
    c: {
      blocks: [{ type: 'text', text: 'bye' }],
      ending: { kind: 'neutral', title: 'End' },
    },
  },
};

beforeEach(() => {
  localStorage.clear();
});

describe('hasSave', () => {
  it('is false before anything is saved', () => {
    expect(hasSave(STORY.id)).toBe(false);
  });

  it('is true once a session has been saved', () => {
    saveSession(startSession(STORY));
    expect(hasSave(STORY.id)).toBe(true);
  });
});

describe('loadSession — no or unusable save', () => {
  it('starts fresh when nothing has been saved', () => {
    const state = loadSession(STORY);
    expect(state.nodeId).toBe('a');
  });

  it('starts fresh on corrupt JSON', () => {
    localStorage.setItem('storied:save:demo', '{not json');
    expect(() => loadSession(STORY)).not.toThrow();
    expect(loadSession(STORY).nodeId).toBe('a');
  });

  it('starts fresh on an unrecognised save version', () => {
    localStorage.setItem(
      'storied:save:demo',
      JSON.stringify({ version: 99, nodeId: 'b', vars: {}, visited: [], taken: [] }),
    );
    expect(loadSession(STORY).nodeId).toBe('a');
  });
});

describe('loadSession — round trip', () => {
  it('restores exactly the state that was saved', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 0); // -> b, count: 1
    saveSession(state);

    const restored = loadSession(STORY);
    expect(restored.nodeId).toBe('b');
    expect(restored.vars).toEqual({ flag: false, count: 1, name: 'x', bag: [] });
    expect(restored.visited).toEqual(['a', 'b']);
  });

  it('restores a once choice as already taken', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 0); // -> b
    state = choose(STORY, state, 0); // once -> c
    saveSession(state);

    const restored = loadSession(STORY);
    expect(restored.taken).toEqual(['b:0']);
  });
});

describe('loadSession — a content edit invalidates the save without crashing', () => {
  it('starts fresh when the saved nodeId no longer exists', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 0); // -> b
    saveSession(state);

    const editedStory: Story = {
      ...STORY,
      nodes: { a: STORY.nodes['a']!, c: STORY.nodes['c']! }, // 'b' removed
    };
    expect(() => loadSession(editedStory)).not.toThrow();
    expect(loadSession(editedStory).nodeId).toBe('a');
  });

  it('falls back to the initial value for a variable whose type changed', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 0);
    saveSession(state); // count saved as 1 (a number)

    const editedStory: Story = { ...STORY, variables: { ...STORY.variables, count: 'not a number anymore' } };
    const restored = loadSession(editedStory);
    expect(restored.vars['count']).toBe('not a number anymore');
  });

  it('drops a visited entry for a node that no longer exists', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 0);
    saveSession(state); // visited: ['a', 'b']

    const editedStory: Story = { ...STORY, nodes: { ...STORY.nodes, ghost: STORY.nodes['c']! } };
    // 'b' still exists here, so the save itself is still valid to resume;
    // this checks that a stray, unknown visited id would be dropped rather
    // than crashing anything that later reads it.
    const withGhostVisited = { ...loadSession(editedStory), visited: ['a', 'b', 'ghost-that-never-existed'] };
    saveSession(withGhostVisited);
    expect(loadSession(editedStory).visited).toEqual(['a', 'b']);
  });
});

describe('clearSession', () => {
  it('removes a save so the next load starts fresh', () => {
    saveSession(startSession(STORY));
    expect(hasSave(STORY.id)).toBe(true);
    clearSession(STORY.id);
    expect(hasSave(STORY.id)).toBe(false);
  });
});
