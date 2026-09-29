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
import { mapBosses, type MapDef, type MapRules, MAPS } from '../src/data/maps';
import { previousRegion, REGION_IDS, type RegionId, REGIONS } from '../src/data/regions';
import { species } from '../src/data/species';
import { line, type TowerLine } from '../src/data/towers';
import { effectiveness, TYPES } from '../src/data/types';
import { playOut } from '../src/game/bot';
import { enemySpecies, lineAllowed, newGame } from '../src/game/game';
import type { PokeType } from '../src/data/types';
import type { DifficultyKey } from '../src/game/waves';
import { CUP_HP, CUP_MIN_LINES, cupLines, cupMaps, gauntletMap, RUN_LIVES } from '../src/state/frontier';
import { freshProgress, type Progress, regionUnlocked, TEAM_SIZE, unlockedLines } from '../src/state/save';

const only = process.argv[2];

/** The regions a player must be Champion of to reach this one: the mainline before it, or a side region's own chain. */
function regionsBefore(id: RegionId): RegionId[] {
  const prev = previousRegion(id);
  return prev ? [...regionsBefore(prev), prev] : [];
}

/**
 * A save that has cleared the regions leading to this map's, and this
 * region's maps before it (for an endless map, all of them). Side regions
 * aren't assumed for the mainline: a player can skip them.
 */
function progressBefore(index: number): Progress {
  const p = freshProgress();
  const target = MAPS[index]!;
  const earlier = new Set(regionsBefore(target.regionId));
  for (const [i, m] of MAPS.entries()) {
    if (m.endless) continue;
    const before = earlier.has(m.regionId) || (m.regionId === target.regionId && (target.endless || i < index));
    if (before) p.results[m.id] = { normal: 3, hard: 0, best: 0 };
  }
  return p;
}

/** A wild Pokémon or boss, in its Tera type if it has one. */
type Foe = { dex: number; weight: number; tera?: PokeType | undefined };

/** How hard a line hits one wild Pokémon, as a player would weigh it. */
function hitValue(lineId: string, p: Foe): number {
  const l = line(lineId);
  const sp = enemySpecies(p.dex, p.tera ?? null);
  if (l.groundOnly && sp.traits.includes('flying')) return 0;
  if (sp.traits.includes('invisible') && !l.detect) return 0.3 * effectiveness(l.type, sp.types);
  return effectiveness(l.type, sp.types);
}

/** Pick a team greedily for coverage: each pick is the line that most improves the best answer to every wild Pokémon. */
function pickTeam(available: string[], pool: Foe[]): string[] {
  const team: string[] = [];
  const best = new Map(pool.map((p) => [p, 0]));
  while (team.length < TEAM_SIZE && team.length < available.length) {
    let pick = '';
    let gain = -Infinity;
    for (const id of available) {
      if (team.includes(id)) continue;
      const l = line(id);
      let g = (l.base.damage * Math.max(0.5, l.base.rate)) / 60;
      for (const p of pool) g += p.weight * Math.max(0, hitValue(id, p) - best.get(p)!) / 4;
      if (g > gain) {
        gain = g;
        pick = id;
      }
    }
    team.push(pick);
    for (const p of pool) best.set(p, Math.max(best.get(p)!, hitValue(pick, p)));
  }
  return team;
}

for (const [i, map] of MAPS.entries()) {
  if (only === 'frontier' || (only && map.id !== only && map.regionId !== only)) continue;
  // Within the map's challenge rules (the Orange Crew's); and a side region's starters only if it's on the way here.
  const chain = new Set([...regionsBefore(map.regionId), map.regionId]);
  const progress = progressBefore(i);
  const givers = (l: TowerLine): RegionId[] => REGION_IDS.filter((r) => (l.unlock.kind === 'region' && l.unlock.region === r) || REGIONS[r].starters.includes(l.id));
  const skipped = (l: TowerLine): boolean => l.unlock.kind === 'region'
    && !givers(l).some((r) => chain.has(r) || (!REGIONS[r].after && regionUnlocked(progress, r)));
  const available = unlockedLines(progress).filter((l) => !skipped(l)).map((l) => l.id).filter((id) => lineAllowed(map.rules ?? {}, id));
  const bosses = mapBosses(map).map((bs) => ({ dex: bs.dex, tera: bs.tera, weight: 3 }));
  const team = pickTeam(available, [...map.pool.filter((p) => !p.rare), ...bosses]);
  // Like a player, bring something that can see invisible Pokémon if any are coming.
  const hidden = [...map.pool.filter((p) => !p.rare), ...bosses].some((p) => species(p.dex).traits.includes('invisible'))
    || mapBosses(map).some((b) => b.abilities.some((a) => a.kind === 'vanish'));
  if (hidden && !team.some((id) => line(id).detect)) {
    const seer = available.filter((id) => line(id).detect).sort((a, b) => line(b).base.damage - line(a).base.damage)[0];
    if (seer) team[team.length - 1] = seer;
  }
  if (process.env['TEAM']) console.log(team.join(' '));
  const row: string[] = [];
  for (const difficulty of ['normal', 'hard'] as DifficultyKey[]) {
    const g = newGame({ map, difficulty, team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1 });
    const { lives, cleared, retries } = playOut(g);
    const tries = retries ? ` after ${retries} retr${retries > 1 ? 'ies' : 'y'}` : '';
    row.push(`${difficulty}: ${g.status === 'won' ? `won, ${String(lives).padStart(2)} lives${tries}` : `${g.status === 'retry' ? 'boss' : g.status} at wave ${cleared + 1}`}`.padEnd(34));
  }
  console.log(`${REGIONS[map.regionId].name.padEnd(6)} ${map.name.padEnd(22)} ${row.join('   ')}`);
}

/**
 * `-- frontier`: the Champions' Gauntlet, and every Mono-type Cup, with the
 * roster of someone who is Champion everywhere (and has caught nothing).
 */
if (only === 'frontier') {
  const everything = freshProgress();
  for (const m of MAPS) if (!m.endless) everything.results[m.id] = { normal: 3, hard: 0, best: 0 };
  const owned = unlockedLines(everything);
  const play = (map: MapDef, team: string[], rules: MapRules, label: string): boolean => {
    const g = newGame({ map, difficulty: 'normal', team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1, rules });
    const { lives, cleared } = playOut(g, 3600, 0);
    console.log(`${label.padEnd(34)} ${g.status === 'won' ? `won, ${String(lives).padStart(2)} lives` : `${g.status} at wave ${cleared + 1}`}`);
    return g.status === 'won';
  };
  const g = gauntletMap();
  const bosses = mapBosses(g).map((bs) => ({ dex: bs.dex, tera: bs.tera, weight: 3 }));
  const gTeam = pickTeam(owned.map((l) => l.id), [...g.pool, ...bosses]);
  if (process.env['TEAM']) console.log(gTeam.join(' '));
  play(g, gTeam, {}, 'Champions’ Gauntlet');
  for (const type of TYPES) {
    const lines = cupLines(owned, type).map((l) => l.id);
    if (lines.length < CUP_MIN_LINES) {
      console.log(`${`${type} cup`.padEnd(34)} only ${lines.length} line(s)`);
      continue;
    }
    let lives = RUN_LIVES;
    let left = 0;
    let result = 'won';
    for (const [n, map] of cupMaps(type).entries()) {
      const team = pickTeam(lines, [...map.pool.filter((p) => !p.rare), ...mapBosses(map).map((bs) => ({ dex: bs.dex, tera: bs.tera, weight: 3 }))]);
      const game = newGame({ map, difficulty: 'normal', team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1, rules: { types: [type], lives, hpMul: CUP_HP } });
      left = game.lives;
      const out = playOut(game, 3600, 0);
      if (game.status !== 'won') {
        result = `lost battle ${n + 1} (${map.name}, wave ${out.cleared + 1})`;
        break;
      }
      left = out.lives;
    }
    console.log(`${`${type} cup (${lines.length} lines)`.padEnd(34)} ${result}${result === 'won' ? `, ${left} lives in the last` : ''}`);
  }
}
