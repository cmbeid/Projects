import { describe, expect, it } from 'vitest';
import { learnset, MOVES } from '../src/data/moves';
import { SPECIES, jobFor, species } from '../src/data/species';
import { gainXp, makeMon, maxHp, statsOf, toggleParty, xpForLevel } from '../src/game/mon';
import { world } from './helpers';

describe('Pokémon', () => {
  it('has sound data: evolutions exist and learn only real moves', () => {
    for (const sp of SPECIES.values()) {
      if (sp.evolves) expect(SPECIES.has(sp.evolves.to), `${sp.name} evolves`).toBe(true);
      for (const [, id] of learnset(sp.dex)) expect(MOVES.has(id), `${sp.name}: ${id}`).toBe(true);
      expect(makeMon(sp.dex, 5, { seed: 1 }).moves.length).toBeGreaterThan(0);
    }
  });

  it('works out stats that grow with level', () => {
    const low = statsOf({ dex: 7, level: 5 });
    const high = statsOf({ dex: 7, level: 30 });
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.def).toBeGreaterThan(low.def);
  });

  it('levels up, learns and evolves', () => {
    const mon = makeMon(4, 15, { seed: 3 });
    const lines = gainXp(mon, xpForLevel(16) - mon.xp);
    expect(mon.level).toBe(16);
    expect(mon.dex).toBe(5);
    expect(lines.some((l) => l.includes('evolved into Charmeleon'))).toBe(true);
    expect(mon.moves.length).toBeLessThanOrEqual(4);
    expect(mon.hp).toBeLessThanOrEqual(maxHp(mon));
  });

  it('gives jobs by type', () => {
    expect(species(7).job).toBe('water');
    expect(species(1).job).toBe('tend');
    expect(species(4).job).toBe('guard');
    expect(species(19).job).toBe('harvest');
    expect(species(16).job).toBe('guard');
    expect(jobFor(['electric'])).toBe('none');
  });

  it('keeps at least one Pokémon in the party', () => {
    const w = world(7);
    expect(toggleParty(w, w.party[0]!)).toBe(false);
  });
});
