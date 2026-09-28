import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_ICONS } from '../src/data/items';
import { TRACKS, trackFile } from '../src/data/music';
import { REGIONS } from '../src/data/regions';
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

  it('has every item icon, badge and music track', () => {
    for (const icon of ITEM_ICONS) expect(existsSync(`public/items/${icon}.png`), icon).toBe(true);
    for (const b of Object.values(REGIONS).flatMap((r) => r.badges)) expect(existsSync(`public/badges/${b}.png`), `badge ${b}`).toBe(true);
    for (const t of TRACKS) expect(existsSync(`public/music/${trackFile(t)}.json`), t).toBe(true);
  });
});
