import { describe, expect, it } from 'vitest';
import { MEDIUM_BREAKPOINT, WIDE_BREAKPOINT, modeForWidth } from '../src/ui/layout';

describe('modeForWidth', () => {
  it('puts a Pixel Fold cover screen (412px) in compact', () => {
    expect(modeForWidth(412)).toBe('compact');
  });

  it('puts a Pixel Fold inner screen (~840px) in medium', () => {
    expect(modeForWidth(840)).toBe('medium');
  });

  it('puts a tablet landscape width (1280px) in wide', () => {
    expect(modeForWidth(1280)).toBe('wide');
  });

  it('switches exactly at the medium breakpoint', () => {
    expect(modeForWidth(MEDIUM_BREAKPOINT - 1)).toBe('compact');
    expect(modeForWidth(MEDIUM_BREAKPOINT)).toBe('medium');
  });

  it('switches exactly at the wide breakpoint', () => {
    expect(modeForWidth(WIDE_BREAKPOINT - 1)).toBe('medium');
    expect(modeForWidth(WIDE_BREAKPOINT)).toBe('wide');
  });
});
