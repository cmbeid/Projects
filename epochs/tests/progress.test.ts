import { describe, expect, it } from 'vitest';
import { TECHS } from '../src/data/techs';
import { WONDER } from '../src/data/wonders';
import { answer, tickChronicle } from '../src/game/chronicle';
import { derive } from '../src/game/derive';
import { newGame, tick } from '../src/game/engine';
import { hasFeature } from '../src/game/features';
import { advance, holdFestival, research, startStage, techAvailable, toggleQueue, wonderComplete } from '../src/game/progress';

function rich(): ReturnType<typeof newGame> {
  const s = newGame(9);
  for (const k of Object.keys(s.res) as (keyof typeof s.res)[]) s.res[k] = 1e12;
  return s;
}

describe('research', () => {
  it('needs the techs before it', () => {
    const s = rich();
    expect(techAvailable(s, TECHS.find((t) => t.id === 'pottery')!)).toBe(false);
    expect(research(s, 'pottery')).toBe(false);
    expect(research(s, 'agriculture')).toBe(true);
    expect(research(s, 'pottery')).toBe(true);
  });

  it('unlocks systems as it goes', () => {
    const s = rich();
    expect(hasFeature(s, 'chronicle')).toBe(false);
    research(s, 'storytelling');
    expect(hasFeature(s, 'chronicle')).toBe(true);
  });

  it('adds land', () => {
    const s = rich();
    const before = derive(s).plotsTotal;
    research(s, 'toolmaking');
    research(s, 'clearing');
    expect(derive(s).plotsTotal).toBe(before + 3);
    expect(s.plots.length).toBe(before + 3);
  });

  it('works through a queue', () => {
    const s = rich();
    s.features.push('queue');
    toggleQueue(s, 'pottery');
    toggleQueue(s, 'agriculture');
    tick(s, 0.1);
    tick(s, 0.1);
    expect(s.techs).toContain('agriculture');
    expect(s.techs).toContain('pottery');
    expect(s.queue).toEqual([]);
  });
});

describe('wonders and eras', () => {
  it('builds a wonder stage by stage, over time', () => {
    const s = rich();
    s.features.push('wonders');
    s.techs.push('megaliths');
    const w = WONDER.get('standing-stones')!;
    for (let i = 0; i < w.stages.length; i++) {
      s.res.wood = s.res.stone = 1e6;
      expect(startStage(s, w.id)).toBe(true);
      expect(startStage(s, w.id)).toBe(false);
      for (let t = 0; t < w.stageTime + 1; t++) tick(s, 1, { events: false });
    }
    expect(wonderComplete(s, w)).toBe(true);
  });

  it('enters the next era once every goal is met', () => {
    const s = rich();
    s.features.push('wonders');
    for (const t of TECHS.filter((x) => x.era === 0)) research(s, t.id);
    s.wonders['standing-stones'] = { done: 3, left: 0 };
    for (let i = 0; i < 4; i++) s.plots[i] = { line: 'home', era: 0 };
    s.pop = 14;
    expect(advance(s)).toBe(true);
    expect(s.era).toBe(1);
    expect(s.chronicle.log.at(-1)!.text).toContain('Bronze Age');
  });

  it('holds a festival for culture', () => {
    const s = rich();
    s.features.push('festival');
    const before = derive(s).jobs.forager.mult;
    expect(holdFestival(s)).toBe(true);
    expect(derive(s).jobs.forager.mult).toBeCloseTo(before * 1.5);
    expect(holdFestival(s)).toBe(false);
  });
});

describe('the Chronicle', () => {
  it('asks, waits, and answers itself if nobody does', () => {
    const s = rich();
    s.features.push('chronicle');
    s.chronicle.next = 0;
    tickChronicle(s, derive(s), 0.1);
    expect(s.chronicle.pending).not.toBeNull();
    for (let i = 0; i < 100; i++) tickChronicle(s, derive(s), 1);
    expect(s.chronicle.pending).toBeNull();
    expect(s.chronicle.log.at(-1)!.text).toContain('nobody decided');
  });

  it('applies the answer chosen', () => {
    const s = rich();
    s.chronicle.pending = { id: 'comet', left: 50 };
    expect(answer(s, 0)).toBe(true);
    expect(s.modifiers.some((m) => m.label === 'Good omen')).toBe(true);
  });
});
