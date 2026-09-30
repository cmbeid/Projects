import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_ICONS } from '../src/data/items';
import { SPECIES } from '../src/data/species';

describe('assets', () => {
  it('has a sprite sheet, shiny sheet and cry for every Pokémon', () => {
    for (const dex of SPECIES.keys()) {
      for (const name of [`${dex}`, `${dex}-shiny`]) {
        expect(existsSync(`public/sprites/${name}.png`), name).toBe(true);
        const sheet = JSON.parse(readFileSync(`public/sprites/${name}.json`, 'utf8')) as { delays: number[]; w: number };
        expect(sheet.delays.length).toBeGreaterThan(0);
        expect(sheet.w).toBeGreaterThan(0);
      }
      expect(existsSync(`public/cries/${dex}.wav`), `cry ${dex}`).toBe(true);
    }
  });

  it('has every item icon', () => {
    for (const icon of ITEM_ICONS) expect(existsSync(`public/items/${icon}.png`), icon).toBe(true);
  });
});
