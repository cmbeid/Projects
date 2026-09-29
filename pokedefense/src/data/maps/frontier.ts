/**
 * The Battle Frontier's own map, the Champions' Gauntlet: every region's
 * Champion ace, one after another, each with its powers intact — Diantha's
 * Gardevoir Mega Evolves, Leon's Charizard Gigantamaxes, Geeta's Kingambit
 * is Terastallized. Built from the Leagues' own final bosses, their HP
 * rescaled from their League's tier to this one.
 */
import { hpScale } from '../../game/waves';
import type { BossDef, MapDef } from './types';

/** The Leagues whose Champions take part, in order: Kanto to Paldea, then the side regions'. */
export const GAUNTLET_LEAGUES = [
  'indigo-plateau', 'johto-league', 'ever-grande', 'sinnoh-league', 'unova-league', 'kalos-league', 'alola-league', 'wyndon-stadium',
  'paldea-league', 'pummelo-stadium', 'temple-of-sinnoh', 'blueberry-league',
] as const;

const TIER = 14;
const WAVES = 36;
/** Waves between one Champion and the next. */
const EVERY = 3;
/** No ace tougher than this, in Caterpie units before scaling. */
const MAX_HP = 38;

export function gauntletMap(maps: readonly MapDef[]): MapDef {
  const leagues = GAUNTLET_LEAGUES.map((id) => maps.find((m) => m.id === id)!);
  const scaled = (league: MapDef, i: number): BossDef => {
    const b = league.boss;
    // As tough, for this tier, as it was for its own League's — but the first come while your defence is still
    // being built, so they start at under half that and ramp up to it.
    const ramp = 0.4 + (0.6 * i) / (GAUNTLET_LEAGUES.length - 1);
    const ratio = ((hpScale(league.tier, WAVES) * (league.hpMul ?? 1)) / hpScale(TIER, WAVES)) * ramp;
    // (Kanto's scale was set before the others': keep its Champion in line with the rest.)
    const hp = Math.min(MAX_HP, Math.round(b.hp * ratio * 10) / 10);
    return { ...b, hp, ...(b.partners ? { partners: b.partners.map((p) => ({ ...p, hp: Math.round(p.hp * ratio * 10) / 10 })) } : {}) };
  };
  const last = leagues[leagues.length - 1]!;
  return {
    id: 'champions-gauntlet', name: 'Champions’ Gauntlet', regionId: 'kanto', area: 'Battle Frontier', leader: 'Every Champion', tier: TIER,
    theme: 'gauntlet', track: 'p_league', bossTrack: 'e_vs_champion', finalTrack: 'championbattle', waves: WAVES, startMoney: 3000,
    twist: 'Every region’s Champion, one after another every third wave: Blue’s Charizard to Kieran’s Terapagos, each with its own powers.',
    grid: [
      'XX.X.X.XX',
      '.........',
      '.........',
      '...XX....',
      '..,......',
      '.X.......',
      '.,.....X.',
      '....X....',
      '.........',
      'X.......,',
      '.........',
      '.........',
      '.........',
      ',........',
      'XX.X..X..',
    ],
    paths: [
      [[2, -1], [2, 3], [0, 3], [0, 8], [4, 8], [4, 10], [1, 10], [1, 12], [7, 12], [7, 13], [4, 13], [4, 15]],
      [[6, -1], [6, 3], [8, 3], [8, 8], [4, 8], [4, 10], [1, 10], [1, 12], [7, 12], [7, 13], [4, 13], [4, 15]],
    ],
    // The Champions' own teams, more or less.
    pool: [
      { dex: 6, weight: 2, from: 1 }, { dex: 149, weight: 2, from: 1 }, { dex: 376, weight: 2, from: 1 }, { dex: 445, weight: 2, from: 4 },
      { dex: 637, weight: 2, from: 7 }, { dex: 282, weight: 2, from: 10 }, { dex: 745, weight: 2, from: 13 }, { dex: 887, weight: 2, from: 16 },
      { dex: 983, weight: 2, from: 19 }, { dex: 130, weight: 2, from: 22 }, { dex: 10239, weight: 2, from: 25 }, { dex: 1019, weight: 2, from: 28 },
    ],
    miniBoss: [],
    extraBosses: leagues.slice(0, -1).map((league, i) => ({ wave: EVERY * (i + 1), trainer: league.leader, boss: scaled(league, i) })),
    boss: scaled(last, leagues.length - 1),
    hpMul: 0.6,
  };
}
