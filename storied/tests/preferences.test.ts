// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTextSize, loadTextSize, saveTextSize, TEXT_SIZE_SCALE } from '../src/state/preferences';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--sy-user-scale');
});

describe('loadTextSize', () => {
  it('defaults to normal with nothing saved', () => {
    expect(loadTextSize()).toBe('normal');
  });

  it('round-trips a saved size', () => {
    saveTextSize('large');
    expect(loadTextSize()).toBe('large');
  });

  it('falls back to normal for a corrupt value', () => {
    localStorage.setItem('storied:prefs:textSize', 'huge');
    expect(loadTextSize()).toBe('normal');
  });
});

describe('applyTextSize', () => {
  it('sets --sy-user-scale on the document root to the matching scale', () => {
    applyTextSize('small');
    expect(document.documentElement.style.getPropertyValue('--sy-user-scale')).toBe(
      String(TEXT_SIZE_SCALE.small),
    );

    applyTextSize('large');
    expect(document.documentElement.style.getPropertyValue('--sy-user-scale')).toBe(
      String(TEXT_SIZE_SCALE.large),
    );
  });
});
