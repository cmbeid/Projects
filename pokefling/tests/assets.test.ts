import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { cryDexes, cryUrl, ITEM_ICONS, itemUrl, spriteArts, spriteUrl } from '../src/data/roster';

const HINT = 'run `npm run fetch-assets`';

describe('assets', () => {
  it.each(spriteArts())('sprite %s is there, at the downscaled size', (art) => {
    const png = readFileSync(`public/${spriteUrl(art)}`);
    // Width and height live at bytes 16..23 of the IHDR chunk.
    expect(png.readUInt32BE(16), HINT).toBe(192);
    expect(png.readUInt32BE(20), HINT).toBe(192);
  });

  it.each(cryDexes())('#%i has a playable cry', (dex) => {
    const wav = readFileSync(`public/${cryUrl(dex)}`);
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('latin1')).toBe('WAVE');
    expect(wav.length).toBeGreaterThan(1000);
  });

  it.each([...ITEM_ICONS])('item icon %s is there', (icon) => {
    expect(existsSync(`public/${itemUrl(icon)}`), HINT).toBe(true);
  });
});
