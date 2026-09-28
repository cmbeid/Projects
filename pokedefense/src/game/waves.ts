/**
 * Builds each map's waves from its pool of wild Pokémon. A wave has an HP
 * budget that grows with its number; it is split into up to three groups,
 * each one species, and filled with as many of it as the budget buys. Every
 * map's waves are the same every time (seeded by map and wave), so a map can
 * be learnt.
 *
 * All HP is in Caterpie units until {@link hpScale} turns it into hit points.
 */
import type { BossDef, MapDef } from '../data/maps';
import { species } from '../data/species';
import { hashString, makeRng, pickWeighted } from './rng';

export interface Spawn {
  /** Seconds after the wave starts. */
  at: number;
  dex: number;
  path: number;
  /** HP in Caterpie units. */
  hp: number;
  boss?: BossDef;
  lead?: boolean;
  rare?: boolean;
  shiny?: boolean;
}

export interface Difficulty {
  hp: number;
  money: number;
}
export const DIFFICULTIES = {
  normal: { hp: 1, money: 1 },
  hard: { hp: 1.4, money: 0.9 },
} as const satisfies Record<string, Difficulty>;
export type DifficultyKey = keyof typeof DIFFICULTIES;

/** Hit points in one Caterpie unit, on the first wave of the first map. */
export const BASE_HP = 28;
export const TIER_HP = 1.1;

/** Hit points per HP unit on wave `wave` of a tier-`tier` map. */
export function hpScale(tier: number, wave: number): number {
  const w = wave - 1;
  return BASE_HP * (1 + 0.13 * w + 0.005 * w * w) * TIER_HP ** (tier - 1);
}

/** ₽ multiplier for knockouts: grows more slowly than HP, so waves get harder. */
export function bountyScale(tier: number, wave: number): number {
  return (hpScale(tier, wave) / BASE_HP) ** 0.62;
}

/** ₽ for clearing a wave. */
export function waveBonus(tier: number, wave: number): number {
  return Math.round((20 + 4 * wave) * (1 + 0.1 * (tier - 1)));
}

/** HP units a wave spends on its groups. */
export function waveBudget(wave: number): number {
  return 6 + 2.3 * wave;
}

export function isBossWave(map: MapDef, wave: number): boolean {
  if (map.endless) return wave % 25 === 0;
  return wave === map.waves || (map.extraBosses ?? []).some((b) => b.wave === wave);
}

export function waveCount(map: MapDef): number {
  return map.endless ? Infinity : map.waves;
}

function bossFor(map: MapDef, wave: number): BossDef | null {
  if (map.endless) {
    if (wave % 25) return null;
    const bosses = [map.boss, ...(map.rotation ?? [])];
    return bosses[(wave / 25 - 1) % bosses.length]!;
  }
  if (wave === map.waves) return map.boss;
  return map.extraBosses?.find((b) => b.wave === wave)?.boss ?? null;
}

export function buildWave(map: MapDef, wave: number): Spawn[] {
  const rng = makeRng(hashString(`${map.id}:${wave}`));
  const spawns: Spawn[] = [];
  const eligible = map.pool.filter((p) => !p.rare && p.from <= wave);
  const boss = bossFor(map, wave);
  const groups = Math.min(3, 1 + Math.floor((wave - 1) / 4));
  const budget = waveBudget(wave) * (boss ? 0.5 : 1);
  let t = 0;

  for (let g = 0; g < groups; g += 1) {
    // Later groups lean toward the stronger species the map has unlocked by now.
    const entry = pickWeighted(rng, eligible, (p) => p.weight * (1 + (g * p.from) / Math.max(1, wave)));
    const sp = species(entry.dex);
    const count = Math.max(1, Math.min(24, Math.round(budget / groups / sp.hp)));
    const gap = Math.min(1.4, Math.max(0.35, 0.85 / sp.speed)) * (count > 12 ? 0.7 : 1);
    const path = (wave + g) % map.paths.length;
    for (let i = 0; i < count; i += 1) {
      // On two-path maps a big group splits across both.
      const p = map.paths.length > 1 && count >= 6 ? (path + i) % map.paths.length : path;
      spawns.push({ at: t + i * gap, dex: sp.dex, path: p, hp: sp.hp });
    }
    t += count * gap * 0.65 + 1.5;
  }

  const rares = map.pool.filter((p) => p.rare && p.from <= wave);
  if (rares.length && rng() < 0.3) {
    const entry = pickWeighted(rng, rares, (p) => p.weight);
    spawns.push({ at: t * rng(), dex: entry.dex, path: Math.floor(rng() * map.paths.length), hp: species(entry.dex).hp, rare: true });
  }

  const mini = map.miniBoss.find((m) => m.wave === wave);
  const endlessMini = map.endless && wave % 10 === 5;
  if (mini || endlessMini) {
    const dex = mini?.dex ?? pickWeighted(rng, eligible, (p) => p.weight).dex;
    spawns.push({ at: t + 1, dex, path: 0, hp: mini?.hp ?? species(dex).hp * 5, lead: true, ...(mini?.shiny ? { shiny: true } : {}) });
  }

  if (boss) {
    boss.escort.forEach((dex, i) => {
      spawns.push({ at: t + 1 + i * 1.2, dex, path: i % map.paths.length, hp: species(dex).hp * 1.5 });
    });
    spawns.push({ at: t + 3 + boss.escort.length * 1.2, dex: boss.dex, path: 0, hp: boss.hp, boss });
    // Tate & Liza, the Striaton triplets: bosses side by side, one down each path.
    (boss.partners ?? []).forEach((partner, i) => {
      spawns.push({ at: t + 3.6 + i * 0.6 + boss.escort.length * 1.2, dex: partner.dex, path: (i + 1) % map.paths.length, hp: partner.hp, boss: partner });
    });
  }

  return spawns.sort((a, b) => a.at - b.at);
}

/** The species in a wave, for the preview strip: dex → how many. */
export function wavePreview(map: MapDef, wave: number): { dex: number; count: number; boss: boolean }[] {
  const out = new Map<number, { dex: number; count: number; boss: boolean }>();
  for (const s of buildWave(map, wave)) {
    if (s.rare) continue;
    const row = out.get(s.dex) ?? { dex: s.dex, count: 0, boss: false };
    row.count += 1;
    row.boss ||= Boolean(s.boss || s.lead);
    out.set(s.dex, row);
  }
  return [...out.values()];
}
