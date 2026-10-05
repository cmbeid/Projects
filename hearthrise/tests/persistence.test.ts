import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { newGame } from '../src/game/engine';
import { deserialize, exportSave, importSave, serialize } from '../src/state/persistence';

describe('saves', () => {
  it('round-trip, and move between devices as a code', () => {
    const s = newGame(9);
    runBot(s, 900);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(importSave(exportSave(s))).toEqual(s);
  });

  it('fill in fields an older save is missing, and refuse junk', () => {
    const s = newGame(9) as unknown as Record<string, unknown>;
    delete s['charter'];
    delete s['plan'];
    const back = deserialize(JSON.stringify(s))!;
    expect(back.charter).toEqual({});
    expect(back.plan).toEqual([]);
    expect(deserialize('{"hello":1}')).toBeNull();
    expect(importSave('not a save')).toBeNull();
  });
});
