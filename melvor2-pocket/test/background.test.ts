import { describe, expect, it } from 'vitest';
import { segmentAt } from '../src/art/background';

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

describe('time-of-day backgrounds', () => {
  it('use the game\'s day segments: day from 8:00, sunset from 16:00, night from 20:00', () => {
    expect(segmentAt(at(7, 59))).toBe('Night');
    expect(segmentAt(at(8))).toBe('Day');
    expect(segmentAt(at(15, 59))).toBe('Day');
    expect(segmentAt(at(16))).toBe('Sunset');
    expect(segmentAt(at(20))).toBe('Night');
    expect(segmentAt(at(0, 30))).toBe('Night');
  });
});
