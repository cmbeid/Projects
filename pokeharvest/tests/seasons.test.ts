import { describe, expect, it } from 'vitest';
import { CROPS, crop } from '../src/data/crops';
import { DEX_REWARDS } from '../src/data/dex';
import { ENCOUNTERS, slotsFor } from '../src/data/encounters';
import { seedId } from '../src/data/items';
import { TRACKS } from '../src/data/music';
import { SPECIES } from '../src/data/species';
import { repairGreenhouse, greenhouseBlocker } from '../src/game/barn';
import { claimDexReward, claimable } from '../src/game/dex';
import { intentAt, useAt } from '../src/game/farm';
import { unitPrice } from '../src/game/market';
import { plotKey } from '../src/game/model';
import { DAYS_PER_SEASON, seasonOf } from '../src/game/time';
import { rainOnFarm, rollWeather } from '../src/game/weather';
import { select, sleep } from '../src/game/world';
import { existsSync } from 'node:fs';
import { world } from './helpers';

const OUT = { x: 5, y: 14 };
const GLASS = { x: 16, y: 19 };

function plant(w: ReturnType<typeof world>, at: { x: number; y: number }, id: string): boolean {
  w.inventory[seedId(id)] = (w.inventory[seedId(id)] ?? 0) + 1;
  select(w, 'hoe');
  useAt(w, at.x, at.y);
  select(w, seedId(id));
  return useAt(w, at.x, at.y);
}

describe('seasons', () => {
  it('gives every season something to grow outdoors', () => {
    for (const season of ['Spring', 'Summer', 'Autumn', 'Winter'] as const) {
      expect(CROPS.some((c) => c.seasons.includes(season)), season).toBe(true);
    }
  });

  it('only plants a crop outdoors in its season', () => {
    const w = world();
    expect(plant(w, OUT, 'rawst')).toBe(false);
    expect(intentAt(w, OUT.x, OUT.y)).toEqual({ kind: 'deny', text: "Rawst Berry won't grow in Spring" });
    expect(plant(w, OUT, 'cheri')).toBe(true);
  });

  it('withers outdoor crops when their season ends, but not ones that carry on', () => {
    const w = world();
    plant(w, OUT, 'cheri');
    plant(w, { x: 6, y: 14 }, 'oran');
    w.day = DAYS_PER_SEASON;
    const summary = sleep(w);
    expect(seasonOf(w.day)).toBe('Summer');
    expect(summary.newSeason).toBe(true);
    expect(summary.withered).toBe(1);
    expect(w.plots[plotKey(OUT.x, OUT.y)]!.crop).toBeNull();
    expect(w.plots[plotKey(6, 14)]!.crop?.id).toBe('oran');
  });

  it('pays more for a berry out of season', () => {
    const w = world();
    expect(unitPrice(w, 'aspear')).toBe(crop('aspear').sellPrice * 1.25);
    expect(unitPrice(w, 'cheri')).toBe(crop('cheri').sellPrice);
  });
});

describe('the greenhouse', () => {
  it('needs repairing before its beds can be dug', () => {
    const w = world();
    select(w, 'hoe');
    expect(useAt(w, GLASS.x, GLASS.y)).toBe(false);
    expect(greenhouseBlocker(w)).toMatch(/reputation/);
    Object.assign(w, { reputation: 30 });
    w.player.gold = 9999;
    w.inventory['metal-coat'] = 5;
    w.inventory['hard-stone'] = 10;
    expect(repairGreenhouse(w)).toBe(true);
    expect(w.greenhouse).toBe(true);
  });

  it('grows anything, any time, and keeps it through the change of season', () => {
    const w = world();
    w.greenhouse = true;
    expect(plant(w, GLASS, 'aspear')).toBe(true);
    w.day = DAYS_PER_SEASON;
    sleep(w);
    expect(w.plots[plotKey(GLASS.x, GLASS.y)]!.crop?.id).toBe('aspear');
  });
});

describe('weather', () => {
  it('rains, storms and snows in the right seasons', () => {
    const w = world();
    const seen = { Spring: new Set<string>(), Winter: new Set<string>() };
    for (let i = 0; i < 300; i += 1) {
      seen.Spring.add(rollWeather(w, 'Spring'));
      seen.Winter.add(rollWeather(w, 'Winter'));
    }
    expect([...seen.Spring].sort()).toEqual(['rain', 'storm', 'sun']);
    expect([...seen.Winter].sort()).toEqual(['snow', 'sun']);
  });

  it('waters outdoor crops when it rains, but not the greenhouse', () => {
    const w = world();
    w.greenhouse = true;
    plant(w, OUT, 'cheri');
    plant(w, GLASS, 'cheri');
    w.weather = 'rain';
    expect(rainOnFarm(w)).toBe(1);
    expect(w.plots[plotKey(OUT.x, OUT.y)]!.watered).toBe(true);
    expect(w.plots[plotKey(GLASS.x, GLASS.y)]!.watered).toBe(false);
  });

  it('uses the forecast as the next day\'s weather', () => {
    const w = world();
    w.tomorrow = 'storm';
    sleep(w);
    expect(w.weather).toBe('storm');
  });
});

describe('Pokédex and new Pokémon', () => {
  it('finds every season a little different on Route 1', () => {
    const zone = ENCOUNTERS.route1![0]!;
    expect(slotsFor(zone, 'Winter', false).some((s) => s.dex === 220)).toBe(true);
    expect(slotsFor(zone, 'Spring', false).some((s) => s.dex === 220)).toBe(false);
    for (const z of ENCOUNTERS.route1!) for (const season of ['Spring', 'Summer', 'Autumn', 'Winter'] as const) {
      for (const s of [...slotsFor(z, season, false), ...slotsFor(z, season, true)]) expect(SPECIES.has(s.dex)).toBe(true);
    }
  });

  it('pays out each milestone once', () => {
    const w = world();
    w.caught = [...SPECIES.keys()].slice(0, 6);
    expect(claimable(w)).toEqual([5]);
    expect(claimDexReward(w, 5)).toBe(true);
    expect(w.inventory['great-ball']).toBe(DEX_REWARDS[0]!.items!['great-ball']);
    expect(claimDexReward(w, 5)).toBe(false);
    expect(claimDexReward(w, 10)).toBe(false);
  });

  it('has every music track', () => {
    for (const t of TRACKS) expect(existsSync(`public/music/${t}.json`), t).toBe(true);
  });
});
