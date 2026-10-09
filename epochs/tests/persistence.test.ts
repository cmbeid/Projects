import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { applyOffline } from '../src/game/offline';
import { newGame } from '../src/game/engine';
import { deserialize, exportSave, importSave, serialize } from '../src/state/persistence';

describe('saves', () => {
  it('round-trips, and through an export code too', () => {
    const s = newGame(2);
    runBot(s, 900);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(importSave(exportSave(s))).toEqual(s);
  });

  it('fills in anything an older save lacks, and refuses junk', () => {
    const s = newGame(2) as unknown as Record<string, unknown>;
    delete s['heritage'];
    delete (s['settings'] as Record<string, unknown>)['priority'];
    const back = deserialize(JSON.stringify(s))!;
    expect(back.heritage.nodes).toEqual([]);
    expect(back.settings.priority).toEqual([]);
    expect(deserialize('{"hello":1}')).toBeNull();
    expect(importSave('not a save')).toBeNull();
  });
});

describe('time away', () => {
  it('keeps the city working, up to the cap, with no events', () => {
    const s = newGame(6);
    runBot(s, 1800);
    s.chronicle.pending = null;
    const food = s.res.food;
    const knowledge = s.res.knowledge;
    const report = applyOffline(s, 20 * 3600)!;
    expect(report.counted).toBe(8 * 3600);
    expect(s.res.knowledge).toBeGreaterThan(knowledge);
    expect(s.res.food).toBeGreaterThanOrEqual(Math.min(food, 1));
    expect(s.chronicle.pending).toBeNull();
    expect(applyOffline(s, 5)).toBeNull();
  });
});
