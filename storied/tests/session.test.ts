import { describe, expect, it } from 'vitest';
import { available, allowsBack, choose, currentNode, isEnding, startSession } from '../src/engine/session';
import type { Story } from '../src/content/types';

const STORY: Story = {
  formatVersion: 1,
  id: 'demo',
  title: 'Demo',
  start: 'start',
  variables: { trust: 0, hasKey: false, log: [] },
  nodes: {
    start: {
      blocks: [{ type: 'text', text: 'hi' }],
      choices: [
        { text: 'hidden-locked', to: 'end', if: { var: 'hasKey', eq: true } },
        {
          text: 'disabled-locked',
          to: 'end',
          if: { var: 'hasKey', eq: true },
          whenLocked: 'disable',
          lockedText: 'You need a key.',
        },
        { text: 'always', to: 'middle', set: [{ var: 'trust', op: 'set', value: 10 }] },
        { text: 'once-only', to: 'middle', once: true },
      ],
    },
    middle: {
      blocks: [{ type: 'text', text: 'mid' }],
      onEnter: [{ var: 'trust', op: 'add', value: 1 }],
      choices: [
        { text: 'back to start', to: 'start' },
        { text: 'to the end', to: 'end' },
      ],
    },
    end: {
      blocks: [{ type: 'text', text: 'bye' }],
      ending: { kind: 'neutral', title: 'Done' },
    },
  },
};

describe('startSession', () => {
  it('begins at the story start node with its initial variables', () => {
    const state = startSession(STORY);
    expect(state.nodeId).toBe('start');
    expect(state.vars).toEqual({ trust: 0, hasKey: false, log: [] });
    expect(state.visited).toEqual(['start']);
    expect(state.taken).toEqual([]);
  });

  it("runs the start node's own onEnter mutations, if it has any", () => {
    const story: Story = {
      ...STORY,
      nodes: { ...STORY.nodes, start: { ...STORY.nodes['start']!, onEnter: [{ var: 'trust', op: 'add', value: 5 }] } },
    };
    expect(startSession(story).vars['trust']).toBe(5);
  });
});

describe('available — choice gating', () => {
  it('omits a whenLocked:"hide" choice entirely when its condition fails', () => {
    const state = startSession(STORY);
    const choices = available(STORY, state);
    expect(choices.some((c) => c.text === 'hidden-locked')).toBe(false);
  });

  it('shows a whenLocked:"disable" choice, locked, with its lockedText', () => {
    const state = startSession(STORY);
    const choices = available(STORY, state);
    const disabled = choices.find((c) => c.text === 'disabled-locked');
    expect(disabled?.locked).toBe(true);
    expect(disabled?.lockedText).toBe('You need a key.');
  });

  it('shows an unconditional choice as unlocked', () => {
    const state = startSession(STORY);
    const choices = available(STORY, state);
    expect(choices.find((c) => c.text === 'always')?.locked).toBe(false);
  });
});

describe('choose — ordering and once', () => {
  it("applies the choice's own set before the destination node's onEnter", () => {
    const state = startSession(STORY);
    const after = choose(STORY, state, 2); // 'always': set trust=10, then middle's onEnter adds 1
    expect(after.nodeId).toBe('middle');
    expect(after.vars['trust']).toBe(11);
  });

  it('records visited nodes once each, even across a loop', () => {
    let state = startSession(STORY);
    state = choose(STORY, state, 2); // -> middle
    state = choose(STORY, state, 0); // -> back to start
    expect(state.visited).toEqual(['start', 'middle']);
  });

  it('a once choice disappears from available() after it is taken', () => {
    let state = startSession(STORY);
    expect(available(STORY, state).some((c) => c.text === 'once-only')).toBe(true);

    state = choose(STORY, state, 3); // once-only -> middle
    state = choose(STORY, state, 0); // back to start

    const choices = available(STORY, state);
    expect(choices.some((c) => c.text === 'once-only')).toBe(false);
    expect(state.taken).toEqual(['start:3']);
  });

  it('throws when asked to take a locked choice', () => {
    const state = startSession(STORY);
    expect(() => choose(STORY, state, 1)).toThrow(/locked/);
  });

  it('throws on an out-of-range choice index', () => {
    const state = startSession(STORY);
    expect(() => choose(STORY, state, 99)).toThrow();
  });

  it('never mutates the state it was given', () => {
    const state = startSession(STORY);
    const before = JSON.stringify(state);
    choose(STORY, state, 2);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('ending detection', () => {
  it('is false on a node with choices and true on a node with an ending', () => {
    const state = startSession(STORY);
    expect(isEnding(STORY, state)).toBe(false);

    const atEnd = choose(STORY, choose(STORY, state, 2), 1); // start -> middle -> end
    expect(isEnding(STORY, atEnd)).toBe(true);
    expect(currentNode(STORY, atEnd).ending?.kind).toBe('neutral');
  });
});

describe('allowsBack', () => {
  it('defaults to true', () => {
    expect(allowsBack(STORY)).toBe(true);
  });

  it('is false when a story opts out', () => {
    expect(allowsBack({ ...STORY, allowBack: false })).toBe(false);
  });
});
