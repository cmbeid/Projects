/**
 * Plays every map with the bot in `src/game/bot.ts`, using only the towers a
 * player would have by then without catching anything — earlier regions'
 * lines, this region's starters and the badges won so far — picking the
 * eight that suit the map best, as a player would. Reports lives left. A
 * map it cannot clear on Normal is too hard; one it clears untouched on Hard
 * is too easy.
 *
 * `npm run playtest -- johto` plays one region; `-- mt-moon` one map.
 */
import { NO_TRAINER } from '../src/data/items';
import { MAPS } from '../src/data/maps';
import { REGIONS } from '../src/data/regions';
import { species } from '../src/data/species';
import { line } from '../src/data/towers';
import { effectiveness } from '../src/data/types';
import { playOut } from '../src/game/bot';
import { newGame } from '../src/game/game';
import type { DifficultyKey } from '../src/game/waves';
import { freshProgress, type Progress, TEAM_SIZE, unlockedLines } from '../src/state/save';

const only = process.argv[2];

/** A save that has cleared everything before `index` (and, for an endless map, its League). */
function progressBefore(index: number): Progress {
  const p = freshProgress();
  const target = MAPS[index]!;
  for (const [i, m] of MAPS.entries()) {
    if (m.endless) continue;
    const before = target.endless ? m.regionId !== target.regionId ? i < index : true : i < index;
    if (before) p.results[m.id] = { normal: 3, hard: 0, best: 0 };
  }
  return p;
}

/** How hard a line hits one wild Pokémon, as a player would weigh it. */
function hitValue(lineId: string, dex: number): number {
  const l = line(lineId);
  const sp = species(dex);
  if (l.groundOnly && sp.traits.includes('flying')) return 0;
  if (sp.traits.includes('invisible') && !l.detect) return 0.3 * effectiveness(l.type, sp.types);
  return effectiveness(l.type, sp.types);
}

/** Pick a team greedily for coverage: each pick is the line that most improves the best answer to every wild Pokémon. */
function pickTeam(available: string[], pool: { dex: number; weight: number }[]): string[] {
  const team: string[] = [];
  const best = new Map(pool.map((p) => [p.dex, 0]));
  while (team.length < TEAM_SIZE && team.length < available.length) {
    let pick = '';
    let gain = -Infinity;
    for (const id of available) {
      if (team.includes(id)) continue;
      const l = line(id);
      let g = (l.base.damage * Math.max(0.5, l.base.rate)) / 60;
      for (const p of pool) g += p.weight * Math.max(0, hitValue(id, p.dex) - best.get(p.dex)!) / 4;
      if (g > gain) {
        gain = g;
        pick = id;
      }
    }
    team.push(pick);
    for (const p of pool) best.set(p.dex, Math.max(best.get(p.dex)!, hitValue(pick, p.dex)));
  }
  return team;
}

for (const [i, map] of MAPS.entries()) {
  if (only && map.id !== only && map.regionId !== only) continue;
  const available = unlockedLines(progressBefore(i)).map((l) => l.id);
  const bosses = [map.boss, ...(map.extraBosses ?? []).map((e) => e.boss)].map((bs) => ({ dex: bs.dex, weight: 3 }));
  const team = pickTeam(available, [...map.pool.filter((p) => !p.rare), ...bosses]);
  // Like a player, bring something that can see invisible Pokémon if any are coming.
  const hidden = [...map.pool.filter((p) => !p.rare), ...bosses].some((p) => species(p.dex).traits.includes('invisible'));
  if (hidden && !team.some((id) => line(id).detect)) {
    const seer = available.filter((id) => line(id).detect).sort((a, b) => line(b).base.damage - line(a).base.damage)[0];
    if (seer) team[team.length - 1] = seer;
  }
  const row: string[] = [];
  for (const difficulty of ['normal', 'hard'] as DifficultyKey[]) {
    const g = newGame({ map, difficulty, team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1 });
    const { lives, cleared, retries } = playOut(g);
    const tries = retries ? ` after ${retries} retr${retries > 1 ? 'ies' : 'y'}` : '';
    row.push(`${difficulty}: ${g.status === 'won' ? `won, ${String(lives).padStart(2)} lives${tries}` : `${g.status === 'retry' ? 'boss' : g.status} at wave ${cleared + 1}`}`.padEnd(34));
  }
  console.log(`${REGIONS[map.regionId].name.padEnd(6)} ${map.name.padEnd(22)} ${row.join('   ')}`);
}
