/**
 * A simple greedy player, for balancing: it keeps spending ₽ on whichever
 * helps most — a new tower where it covers the most path, or a level on the
 * tower that has been doing the most — and calls each wave as soon as the
 * last is clear. It never catches anything or uses items, so what it can
 * clear, a person with the same roster certainly can.
 */
import { type BossDef, COLS, mapBosses, ROWS } from '../data/maps';
import { species } from '../data/species';
import { line, MAX_LEVEL } from '../data/towers';
import { effectiveness, type PokeType } from '../data/types';
import {
  canPlace, chooseMove, type Game, hasNextWave, type Tower, levelUp, moveCost, needsBranch, placeCost, placeTower, retryWave, startWave, step,
  upgradeCost,
} from './game';

/** Path tiles within `range` of (x, y). */
function coverage(g: Game, x: number, y: number, range: number): number {
  let n = 0;
  for (const key of g.pathSet) {
    const [px, py] = key.split(',').map(Number) as [number, number];
    if (Math.hypot(px - x, py - y) <= range) n += 1;
  }
  return n;
}

/** How well a line suits this map's wild Pokémon and its bosses, 0–2ish. Bosses count twice over. */
function suitability(g: Game, lineId: string): number {
  const l = line(lineId);
  const bosses = mapBosses(g.map).map((b) => ({ dex: b.dex, weight: 2 }));
  let total = 0;
  let weight = 0;
  for (const p of [...g.map.pool, ...bosses]) {
    const sp = species(p.dex);
    let eff = effectiveness(l.type, sp.types);
    if (l.groundOnly && sp.traits.includes('flying')) eff = 0;
    if (sp.traits.includes('invisible') && !l.detect) eff *= 0.5;
    total += eff * p.weight;
    weight += p.weight;
  }
  return total / weight;
}

/** The bosses of the next few waves' gym leader or Elite Four member, if one is coming. */
function comingBosses(g: Game): BossDef[] {
  if (g.map.endless) return [];
  for (let w = g.wave + 1; w <= Math.min(g.map.waves, g.wave + 4); w += 1) {
    const boss = w === g.map.waves ? g.map.boss : g.map.extraBosses?.find((b) => b.wave === w)?.boss;
    if (boss) return [boss, ...(boss.partners ?? [])];
  }
  return [];
}

/** Whether a tower hits this boss at least neutrally. */
function hitsBoss(t: Tower, boss: BossDef): boolean {
  const sp = species(boss.dex);
  if (t.stats.groundOnly && sp.traits.includes('flying')) return false;
  return effectiveness(t.stats.type, sp.types) >= 1;
}

/**
 * Like a player seeing a gym leader coming: if nothing on the field can hit
 * the next boss properly, the line that hits it hardest (and can see it, if
 * it hides).
 */
function answerTo(g: Game, team: string[]): { id: string } | null {
  for (const boss of comingBosses(g)) {
    const sp = species(boss.dex);
    const hides = sp.traits.includes('invisible') || boss.abilities.some((a) => a.kind === 'vanish');
    const flies = sp.traits.includes('flying');
    const hits = (type: PokeType, groundOnly: boolean): number => (groundOnly && flies ? 0 : effectiveness(type, sp.types));
    if (g.towers.filter((t) => hits(t.stats.type, t.stats.groundOnly) >= 1).length >= 2 && (!hides || g.towers.some((t) => t.stats.detect))) continue;
    const best = team
      .map((id) => ({ id, score: hits(line(id).type, Boolean(line(id).groundOnly)) + (hides && line(id).detect ? 1 : 0) }))
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score)[0];
    if (best) return best;
  }
  return null;
}

export function botTurn(g: Game): void {
  // Keep a detector if anything invisible is coming.
  const bosses = mapBosses(g.map);
  const invisible = [...g.map.pool, ...bosses].some((p) => species(p.dex).traits.includes('invisible'));
  const team = [...g.team];
  for (let guard = 0; guard < 20; guard += 1) {
    // A boss coming that only a few low-level towers can hurt: grow those.
    const weak = comingBosses(g).filter((b) => g.towers.filter((t) => hitsBoss(t, b)).reduce((n, t) => n + t.level, 0) < 10);
    const worth = (t: Tower): number => (t.damageDone / (t.invested || 1)) * (weak.some((b) => hitsBoss(t, b)) ? 3 : 1);
    const best = [...g.towers]
      .filter((t) => t.level < MAX_LEVEL && t.stats.attack !== 'aura')
      .sort((a, b) => worth(b) - worth(a))[0];
    const upgrade = best ? upgradeCost(g, best).cost : Infinity;

    const lines = team
      .map((id) => ({ id, score: suitability(g, id) + (invisible && line(id).detect && !g.towers.some((t) => t.stats.detect) ? 3 : 0) }))
      .sort((a, b) => b.score - a.score);
    const answer = answerTo(g, team);
    const pick = answer ?? lines[g.towers.length % Math.min(3, lines.length)] ?? lines[0];
    let spot: { x: number; y: number; score: number } | null = null;
    if (pick && g.towers.length < 40) {
      const l = line(pick.id);
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          if (canPlace(g, pick.id, x, y)) continue;
          const score = coverage(g, x, y, l.base.range);
          if (!spot || score > spot.score) spot = { x, y, score };
        }
      }
    }
    const place = pick && spot ? placeCost(g, pick.id) : Infinity;

    const maxed = g.towers.find((t) => t.level >= MAX_LEVEL && t.move === null);
    if (maxed && g.money >= moveCost(g, maxed, 0)) {
      chooseMove(g, maxed.id, g.towers.indexOf(maxed) % 2);
      continue;
    }
    // Build out first; then grow what works.
    const preferPlace = g.towers.length < 4 + g.wave * 0.35 || answer !== null;
    if (preferPlace && spot && pick) {
      if (g.money < place) break;
      placeTower(g, pick.id, spot.x, spot.y);
    } else if (best && g.money >= upgrade) {
      levelUp(g, best.id, needsBranch(best) ? { branch: best.id % 3 } : {});
    } else if (spot && pick && g.money >= place) {
      placeTower(g, pick.id, spot.x, spot.y);
    } else break;
  }
}

/**
 * Play a whole battle. A failed gym-leader wave is retried up to `retries`
 * times, as a player would. Returns lives left (0 = lost), waves cleared
 * and how many retries it took.
 */
export function playOut(g: Game, maxSeconds = 3600, retries = 2): { lives: number; cleared: number; retries: number } {
  let nextThink = 0;
  for (;;) {
    while (g.status === 'playing' && g.t < maxSeconds) {
      if (g.t >= nextThink) {
        botTurn(g);
        nextThink = g.t + 0.5;
        if (g.openWaves.size === 0 && hasNextWave(g)) startWave(g);
      }
      step(g);
      g.events.length = 0;
      if (g.map.endless && g.cleared >= 40) break;
    }
    if (g.status !== 'retry' || g.retries >= retries) break;
    retryWave(g);
    nextThink = g.t;
  }
  return { lives: g.lives, cleared: g.cleared, retries: g.retries };
}
