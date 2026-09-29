/**
 * The Battle Frontier: challenges played on the regions' own maps, under
 * rules of their own, for BP and records. Opens once you're Champion
 * anywhere.
 *
 * - Battle Tower: streaks of seven battles on maps drawn at random, lives
 *   carried from one to the next, Hard from the fourth, and a Tower Tycoon —
 *   some region's Champion ace — at the end of every seven.
 * - Battle Factory: the same, with a rental team of four chosen from eight
 *   random lines, already grown a little; after each win you may swap one
 *   for a Pokémon from the map you beat.
 * - Mono-type Cup: three set maps with a team of one type, each started
 *   afresh; win all three for that type's trophy.
 * - Champions' Gauntlet: every Champion's ace on one map, once you're
 *   Champion of every mainline region.
 *
 * Everything here is pure: the screens in `ui/frontier.ts` call it with the
 * player's progress and save what comes back.
 */
import { FRONTIER_MAPS, type BossDef, MAPS, type MapDef, type MapRules, mapDef } from '../data/maps';
import { GAUNTLET_LEAGUES } from '../data/maps/frontier';
import { REGION_IDS, REGIONS, type RegionId } from '../data/regions';
import { species } from '../data/species';
import { LINES, line, lineForDex, type TowerLine } from '../data/towers';
import { effectiveness, type PokeType, TYPES } from '../data/types';
import { hashString, makeRng, type Rng } from '../game/rng';
import { type DifficultyKey, hpScale } from '../game/waves';
import { cleared, type FacilityId, type FrontierRun, type Progress, regionUnlocked } from './save';

/** Battles in a Battle Tower or Factory round. */
export const ROUND = 7;
/** Battles in a Mono-type Cup. */
export const CUP_BATTLES = 3;
/** Lives a run starts with; they carry from battle to battle. */
export const RUN_LIVES = 20;
export const FACTORY_RENTALS = 8;
export const FACTORY_TEAM = 4;
/** Rentals come already grown to this level. */
export const FACTORY_LEVEL = 3;
/** Fewest lines of a type the Mono-type Cup needs you to own. */
export const CUP_MIN_LINES = 2;
/** A one-type team is a handicap: the Cups' wild Pokémon are a little frailer. */
export const CUP_HP = 0.5;
export const CUP_LINES_NOTE = `A team of one type, from the lines you own: you need at least ${CUP_MIN_LINES}. The number is how many you have.`;
export const GAUNTLET_ID = 'champions-gauntlet';

export function isChampion(p: Progress, region: RegionId): boolean {
  const league = MAPS.find((m) => m.id === REGIONS[region].league);
  return Boolean(league && cleared(p, league));
}

export function frontierOpen(p: Progress): boolean {
  return REGION_IDS.some((id) => isChampion(p, id));
}

/** The Gauntlet: Champion of all nine mainline regions. */
export function gauntletOpen(p: Progress): boolean {
  return REGION_IDS.filter((id) => !REGIONS[id].after).every((id) => isChampion(p, id));
}

export function gauntletMap(): MapDef {
  return FRONTIER_MAPS.find((m) => m.id === GAUNTLET_ID)!;
}

/**
 * Maps the Tower and Factory draw from: gym maps in regions you've opened,
 * without challenge rules of their own (and not the long Leagues).
 */
export function drawPool(p: Progress): MapDef[] {
  return MAPS.filter((m) => !m.endless && !m.rules && !m.extraBosses && regionUnlocked(p, m.regionId) && m.id !== REGIONS[m.regionId].league);
}

/**
 * The Mono-type Cup's three maps for a type: the gym maps where it fares best
 * against the wild Pokémon — hitting hard, and above all not resisted — and
 * never one with anything that's immune to it. Easiest first.
 */
export function cupMaps(type: PokeType): MapDef[] {
  const eff = (dex: number): number => effectiveness(type, species(dex).types);
  const resisted = (m: MapDef): number => {
    const pool = m.pool.filter((e) => !e.rare);
    return pool.reduce((sum, e) => sum + (eff(e.dex) < 1 ? e.weight : 0), 0) / pool.reduce((sum, e) => sum + e.weight, 0);
  };
  const score = (m: MapDef): number => {
    const pool = m.pool.filter((e) => !e.rare);
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    const hits = pool.reduce((sum, e) => sum + e.weight * Math.min(2, eff(e.dex)), 0) / total;
    return hits - 4 * resisted(m) + Math.min(2, eff(m.boss.dex)) * 0.5;
  };
  // Ground towers mostly can't reach anything airborne; and not every type has a line that sees the invisible.
  const reachable = (dex: number): boolean => eff(dex) > 0 && !species(dex).traits.includes('invisible')
    && !(type === 'ground' && species(dex).traits.includes('flying'));
  const fair = (m: MapDef): boolean => m.pool.every((e) => e.rare || reachable(e.dex)) && reachable(m.boss.dex)
    && !m.boss.abilities.some((a) => a.kind === 'vanish') && resisted(m) <= 0.15;
  // (Not Kanto's: its bosses were set on a scale of their own, before the other regions'.)
  return MAPS.filter((m) => m.regionId !== 'kanto' && !m.endless && !m.rules && !m.extraBosses && m.tier >= 3 && m.tier <= 9 && fair(m))
    .map((m) => ({ m, s: score(m) }))
    .sort((a, b) => b.s - a.s || a.m.id.localeCompare(b.m.id))
    .slice(0, CUP_BATTLES)
    .map((x) => x.m)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
}

/** Lines you own of a type: what a Mono-type Cup team can be made of. */
export function cupLines(owned: readonly TowerLine[], type: PokeType): TowerLine[] {
  return owned.filter((l) => l.type === type);
}

/** The Factory's eight rentals for a run: any lines at all, bar the legends. */
export function rentals(seed: number): TowerLine[] {
  const rng = makeRng(hashString(`factory:${seed}`));
  const pool = LINES.filter((l) => l.cost < 250 && l.attack !== 'aura');
  const picked: TowerLine[] = [];
  while (picked.length < FACTORY_RENTALS) {
    const l = pool[Math.floor(rng() * pool.length)]!;
    if (!picked.includes(l)) picked.push(l);
  }
  return picked;
}

/** Some region's Champion ace, as the Tycoon at the end of a Tower round: as tough, for this map, as it was at its League. */
function tycoon(rng: Rng, map: MapDef): BossDef {
  const league = mapDef(GAUNTLET_LEAGUES[Math.floor(rng() * GAUNTLET_LEAGUES.length)]!);
  const ratio = (hpScale(league.tier, map.waves) * (league.hpMul ?? 1)) / (hpScale(map.tier, map.waves) * (map.hpMul ?? 1));
  const hp = Math.min(map.boss.hp * 1.6, Math.round(league.boss.hp * ratio * 0.7 * 10) / 10);
  const { partners: _partners, ...ace } = league.boss;
  return { ...ace, hp, escort: map.boss.escort };
}

/** What the next battle of a run is: where, how hard, under what rules. */
export interface FrontierBattle {
  facility: FacilityId;
  map: MapDef;
  difficulty: DifficultyKey;
  rules: MapRules;
  /** The Factory's rentals, instead of your own roster. */
  roster?: TowerLine[];
  size?: number;
}

export function nextBattle(p: Progress, run: FrontierRun): FrontierBattle {
  const rng = makeRng(hashString(`${run.facility}:${run.seed}:${run.streak}`));
  if (run.facility === 'mono') {
    const type = run.type!;
    const map = cupMaps(type)[run.streak]!;
    return {
      facility: 'mono', map, difficulty: 'normal',
      rules: { types: [type], lives: RUN_LIVES, hpMul: CUP_HP, label: `${typeName(type)} Cup: battle ${run.streak + 1} of ${CUP_BATTLES}, ${typeName(type)} types only` },
    };
  }
  const pool = drawPool(p);
  const map = pool[Math.floor(rng() * pool.length)]!;
  const round = Math.floor(run.streak / ROUND);
  const inRound = run.streak % ROUND;
  const name = run.facility === 'tower' ? 'Battle Tower' : 'Battle Factory';
  const rules: MapRules = {
    lives: run.lives,
    hpMul: 1 + 0.1 * round,
    label: `${name}: battle ${inRound + 1} of ${ROUND}${round ? `, round ${round + 1}` : ''}${inRound === ROUND - 1 ? ' — the Tycoon' : ''}`,
    ...(inRound === ROUND - 1 ? { boss: tycoon(rng, map) } : {}),
    ...(run.facility === 'factory' ? { startLevel: FACTORY_LEVEL } : {}),
  };
  const difficulty: DifficultyKey = inRound >= 3 ? 'hard' : 'normal';
  if (run.facility === 'factory') {
    const roster = run.team.length ? run.team.map((id) => line(id)) : rentals(run.seed);
    return { facility: 'factory', map, difficulty, rules, roster, size: FACTORY_TEAM };
  }
  return { facility: 'tower', map, difficulty, rules };
}

export function startRun(p: Progress, facility: FrontierRun['facility'], seed: number, type: PokeType | null = null): Progress {
  const run: FrontierRun = { facility, streak: 0, lives: RUN_LIVES, seed, team: [], type };
  return { ...p, frontier: { ...p.frontier, run } };
}

/** BP for a win: more the longer the streak, with bonuses at the end of a round. */
export function winBp(facility: FacilityId, streak: number): number {
  if (facility === 'mono') return streak === CUP_BATTLES ? 300 : 60;
  const base = 40 + 10 * Math.min(streak, 21);
  const bonus = streak === 7 ? 200 : streak === 21 ? 500 : streak === 49 ? 1000 : streak % ROUND === 0 ? 150 : 0;
  return base + bonus;
}

export interface FrontierResult {
  progress: Progress;
  bp: number;
  /** The run is over (lost, or a cup won). */
  over: boolean;
  /** A Mono-type Cup trophy just won. */
  trophy: PokeType | null;
}

/** A Frontier battle is over: carry the run on, or end it and keep the record. */
export function endBattle(p: Progress, facility: FacilityId, result: { won: boolean; lives: number; cleared: number; team?: string[] }): FrontierResult {
  const f = p.frontier;
  if (facility === 'gauntlet') {
    const bp = result.won ? (f.gauntletWon ? 300 : 1000) : result.cleared * 8;
    return {
      progress: { ...p, bp: p.bp + bp, frontier: { ...f, gauntletBest: Math.max(f.gauntletBest, result.cleared), gauntletWon: f.gauntletWon || result.won } },
      bp, over: true, trophy: null,
    };
  }
  const run = f.run;
  if (!run || run.facility !== facility) return { progress: p, bp: 0, over: true, trophy: null };
  const bestKey = facility === 'tower' ? 'towerBest' : facility === 'factory' ? 'factoryBest' : null;
  if (!result.won) {
    const bp = run.streak * 10;
    return {
      progress: { ...p, bp: p.bp + bp, frontier: { ...f, ...(bestKey ? { [bestKey]: Math.max(f[bestKey], run.streak) } : {}), run: null } },
      bp, over: true, trophy: null,
    };
  }
  const streak = run.streak + 1;
  const bp = winBp(facility, streak);
  if (facility === 'mono' && streak >= CUP_BATTLES) {
    const trophies = [...new Set([...f.monoTrophies, run.type!])];
    return { progress: { ...p, bp: p.bp + bp, frontier: { ...f, monoTrophies: trophies, run: null } }, bp, over: true, trophy: run.type };
  }
  const next: FrontierRun = { ...run, streak, lives: Math.max(1, result.lives), team: result.team ?? run.team };
  return {
    progress: { ...p, bp: p.bp + bp, frontier: { ...f, ...(bestKey ? { [bestKey]: Math.max(f[bestKey], streak) } : {}), run: next } },
    bp, over: false, trophy: null,
  };
}

/** After a Factory win: lines from the beaten map's wild Pokémon to swap one rental for. */
export function swapOffers(map: MapDef, team: readonly string[]): TowerLine[] {
  const offers: TowerLine[] = [];
  for (const e of map.pool) {
    const l = lineForDex(e.dex);
    if (l && l.cost < 250 && !team.includes(l.id) && !offers.includes(l)) offers.push(l);
  }
  return offers.slice(0, 3);
}

export function typeName(type: PokeType): string {
  return type[0]!.toUpperCase() + type.slice(1);
}

export const CUP_TYPES: readonly PokeType[] = TYPES;
