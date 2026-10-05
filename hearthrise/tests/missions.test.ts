import { describe, expect, it } from 'vitest';
import { STORY } from '../src/data/missions';
import { newGame } from '../src/game/engine';
import { activeStory, claimStory, makePetitions, progress, storyIndex } from '../src/game/missions';
import { tap } from '../src/game/clearing';

describe('the story', () => {
  it('starts on the beach and unlocks upgrades with the first mission', () => {
    const s = newGame(1);
    expect(activeStory(s)?.id).toBe(STORY[0]!.id);
    while (!progress(s, activeStory(s)!.goal, s.story.base).done) tap(s);
    expect(claimStory(s)).toBe(true);
    expect(s.features).toContain('upgrades');
    expect(storyIndex(s)).toBe(1);
  });

  it('will not claim the choice without picking, and remembers the pick', () => {
    const s = newGame(1);
    s.story = { id: 'summit', base: 0 };
    s.furthestEver = 40;
    expect(claimStory(s)).toBe(false);
    expect(claimStory(s, 1)).toBe(true);
    expect(s.flags).toContain('hushed');
    expect(s.story.id).toBeNull();
  });

  it('posts the same petitions all day', () => {
    const s = newGame(1);
    s.features.push('petitions', 'workshops', 'drafting', 'rush');
    const a = makePetitions(s, '2026-10-5');
    const b = makePetitions(s, '2026-10-5');
    expect(a).toEqual(b);
    expect(a.length).toBe(3);
  });
});
