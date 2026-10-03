import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/engine';
import { runBot } from '../src/game/bot';
import { deserialize, exportSave, importSave, serialize } from '../src/state/persistence';

describe('saves', () => {
  it('round-trips a game in progress', () => {
    const s = newGame(9);
    runBot(s, 600);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(importSave(exportSave(s))).toEqual(s);
  });

  it('fills fields an older save is missing', () => {
    const s = newGame(9) as unknown as Record<string, unknown>;
    delete s['echoUpgrades'];
    delete (s['settings'] as Record<string, unknown>)['music'];
    const back = deserialize(JSON.stringify(s))!;
    expect(back.echoUpgrades).toEqual({});
    expect(back.settings.music).toBe(55);
  });

  it('rejects things that are not saves', () => {
    expect(deserialize('nonsense')).toBeNull();
    expect(deserialize('{"hello":1}')).toBeNull();
    expect(importSave('%%%')).toBeNull();
  });
});
