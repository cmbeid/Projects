import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/data/events';
import { STORY } from '../src/data/story';
import { checkOdds, choose, eventView, openEvent } from '../src/game/events';
import { started } from './helpers';

function rich(seed: number) {
  const s = started(seed);
  s.res = { fuel: 10, food: 25, energy: 30, hull: 40, credits: 500 };
  for (const k of Object.keys(s.mats) as (keyof typeof s.mats)[]) s.mats[k] = 30;
  for (const k of Object.keys(s.items) as (keyof typeof s.items)[]) s.items[k] = 3;
  s.rep = { concord: 60, clans: 60, choir: 60 };
  return s;
}

describe('events', () => {
  it('every choice of every event resolves', () => {
    for (const e of EVENTS) {
      e.choices.forEach((_, i) => {
        const s = rich(i + 1);
        openEvent(s, e.id, 'event');
        const shown = eventView(s)!;
        expect(shown.title).toBe(e.title);
        const ok = choose(s, i);
        // Hidden choices (a flag or class the crew lacks) are allowed to refuse.
        if (ok) {
          expect(s.event!.result).toBeTruthy();
          expect(Number.isFinite(s.res.hull)).toBe(true);
        }
      });
    }
  });

  it('every story beat resolves', () => {
    for (const m of STORY) {
      const s = rich(3);
      openEvent(s, m.id, 'story');
      expect(choose(s, 0) || choose(s, 1) || choose(s, 2)).toBe(true);
    }
  });

  it('paying for a choice takes the price', () => {
    const s = rich(1);
    openEvent(s, 'di-stranded', 'event');
    const fuel = s.res.fuel;
    choose(s, 0);
    expect(s.res.fuel).toBe(fuel - 2);
  });

  it('odds stay between 5% and 95% and favour the right class', () => {
    const s = started();
    const easy = checkOdds(s, { stat: 'grit', dc: 1 });
    const hard = checkOdds(s, { stat: 'grit', dc: 15 });
    expect(easy.chance).toBe(0.95);
    expect(hard.chance).toBe(0.05);
    const plain = checkOdds(s, { stat: 'reflex', dc: 7 });
    const pilot = checkOdds(s, { stat: 'reflex', dc: 7, cls: 'pilot' });
    expect(pilot.chance).toBeGreaterThan(plain.chance);
  });
});
