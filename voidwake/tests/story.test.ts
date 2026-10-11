import { describe, expect, it } from 'vitest';
import { STORY } from '../src/data/story';
import { validate } from '../src/data/validate';
import { choose, openEvent } from '../src/game/events';
import { closeEvent } from '../src/game/engine';
import { checkRescue, currentMission } from '../src/game/story';
import { started } from './helpers';

describe('content', () => {
  it('validates', () => {
    expect(validate()).toEqual([]);
  });
});

describe('the main quest', () => {
  it('a story beat completes its mission and moves on', () => {
    const s = started();
    const m = currentMission(s)!;
    openEvent(s, m.id, 'story');
    choose(s, 0);
    closeEvent(s);
    expect(s.story.idx).toBe(1);
    expect(s.story.done).toContain(m.id);
  });

  it('rescue missions finish themselves when enough colonists are aboard', () => {
    const s = started();
    s.story.idx = STORY.findIndex((m) => m.objective.k === 'rescue');
    s.colonists = 50;
    expect(checkRescue(s).length).toBeGreaterThan(0);
    expect(currentMission(s)!.objective.k).not.toBe('rescue');
  });

  it('the gate mission opens the next sector', () => {
    const s = started();
    s.story.idx = STORY.findIndex((m) => m.objective.k === 'gate');
    openEvent(s, currentMission(s)!.id, 'story');
    choose(s, 0);
    closeEvent(s);
    expect(s.sector.index).toBe(1);
    expect(s.at).toBe(0);
  });

  it('the last gate ends the campaign with the ending chosen', () => {
    const s = started();
    s.story.idx = STORY.length - 1;
    openEvent(s, currentMission(s)!.id, 'story');
    choose(s, 1);
    closeEvent(s);
    expect(s.screen).toBe('ending');
    expect(s.ending).toBe('end-share');
  });
});
