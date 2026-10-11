import { describe, expect, it } from 'vitest';
import { runBot } from '../src/game/bot';
import { signalLost } from '../src/game/checkpoint';
import { newGame } from '../src/game/engine';
import { deserialize, exportSave, importSave, serialize } from '../src/state/persistence';
import { started } from './helpers';

describe('saves', () => {
  it('round-trips a campaign mid-flight', () => {
    const s = newGame(5);
    runBot(s, 20);
    const back = deserialize(serialize(s))!;
    expect(back.day).toBe(s.day);
    expect(back.sector.nodes.length).toBe(s.sector.nodes.length);
    expect(back.crew.map((c) => c.name)).toEqual(s.crew.map((c) => c.name));
  });

  it('exports and imports as a code', () => {
    const s = started();
    const code = exportSave(s);
    expect(importSave(code)?.crew[0]!.name).toBe('Tester');
  });

  it('rejects garbage', () => {
    expect(deserialize('nope')).toBeNull();
    expect(deserialize('{"version":1}')).toBeNull();
    expect(importSave('!!!')).toBeNull();
  });

  it('fills in fields an old save is missing', () => {
    const s = started();
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw['codex'];
    delete (raw['items'] as Record<string, unknown>)['decoy'];
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.codex.biomes).toEqual([]);
    expect(back.items.decoy).toBe(0);
  });
});

describe('checkpoints', () => {
  it('signal lost restores the last dock, counts the reload and rerolls the dice', () => {
    const s = started();
    const day = s.day;
    const rng = s.rng;
    s.day = 30;
    s.res.credits = 9999;
    signalLost(s);
    expect(s.day).toBe(day);
    expect(s.res.credits).not.toBe(9999);
    expect(s.stats.reloads).toBe(1);
    expect(s.screen).toBe('lost');
    expect(s.lost?.days).toBe(30 - day);
    expect(s.rng).not.toBe(rng);
    expect(s.checkpoint).toBeTruthy();
  });
});
