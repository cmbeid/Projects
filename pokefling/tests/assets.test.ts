import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { cryUrl, spriteDexes, spriteUrl } from '../src/data/roster';

describe('assets', () => {
  it.each(spriteDexes())('#%i has a sprite and a playable cry', (dex) => {
    expect(existsSync(`public/${spriteUrl(dex)}`), 'run `npm run fetch-assets`').toBe(true);
    const wav = readFileSync(`public/${cryUrl(dex)}`);
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('latin1')).toBe('WAVE');
    expect(wav.length).toBeGreaterThan(1000);
  });
});
