import { describe, expect, it } from 'vitest';
import { DAY_END, DAY_START, SECONDS_PER_MINUTE, clockText, dayOfSeason, seasonOf } from '../src/game/time';
import { sleep, tick } from '../src/game/world';
import { world } from './helpers';

describe('time', () => {
  it('runs the clock at the set pace', () => {
    const w = world();
    tick(w, SECONDS_PER_MINUTE * 60);
    expect(w.clock).toBeCloseTo(DAY_START + 60);
  });

  it('names seasons and days', () => {
    expect(seasonOf(1)).toBe('Spring');
    expect(seasonOf(29)).toBe('Summer');
    expect(seasonOf(113)).toBe('Spring');
    expect(dayOfSeason(30)).toBe(2);
    expect(clockText(DAY_START)).toBe('6:00 AM');
    expect(clockText(13 * 60 + 45)).toBe('1:40 PM');
    expect(clockText(24 * 60 + 30)).toBe('12:30 AM');
  });

  it('starts a new day after sleeping, with full energy', () => {
    const w = world();
    w.player.energy = 10;
    const summary = sleep(w);
    expect(summary.passedOut).toBe(false);
    expect(w.day).toBe(2);
    expect(w.clock).toBe(DAY_START);
    expect(w.player.energy).toBe(w.player.maxEnergy);
  });

  it('passes you out at 2 AM, costing gold and energy', () => {
    const w = world();
    w.clock = DAY_END - 0.5;
    tick(w, SECONDS_PER_MINUTE);
    expect(w.day).toBe(2);
    expect(w.player.gold).toBe(450);
    expect(w.player.energy).toBe(50);
    const day = w.events.find((e) => e.kind === 'day');
    expect(day?.kind === 'day' && day.summary.passedOut).toBe(true);
  });
});
