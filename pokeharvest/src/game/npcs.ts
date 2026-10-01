/**
 * People on the map: trainers who pace about and challenge you on sight,
 * and townsfolk who wander and chat. They're rebuilt each time you arrive
 * somewhere, so only who you've beaten (and when) is saved.
 */
import { TOWNSFOLK, TRAINERS, trainer } from '../data/people';
import { tileAt, walkable } from '../data/maps';
import { tileOf, type Dir, type Npc, type World } from './model';
import { pathBeside, pathTo, type Point } from './path';
import { nextRandom } from './rng';
import { DELTA, walk } from './walk';

const SPEED = 3;
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** Weeks since the farm began; trainers can be battled again each new week. */
export function weekOf(day: number): number {
  return Math.floor((day - 1) / 7);
}

/** Whether a trainer will battle you now: never beaten, or not yet this week. */
export function canChallenge(world: World, id: string): boolean {
  const record = world.trainers[id];
  return !record || record.week < weekOf(world.day);
}

export function spawnNpcs(world: World): void {
  const make = (id: string, kind: Npc['kind'], x: number, y: number, facing: Dir): Npc =>
    ({ id, kind, x, y, facing, path: [], home: { x, y }, timer: 1 + nextRandom(world.rng) * 3 });
  world.npcs = [
    ...TRAINERS.filter((t) => t.map === world.map).map((t) => make(t.id, 'trainer', t.x, t.y, t.facing)),
    ...TOWNSFOLK.filter((f) => f.map === world.map).map((f) => make(f.id, 'folk', f.x, f.y, 'down')),
  ];
  world.approach = null;
}

export function npcAt(world: World, x: number, y: number): Npc | undefined {
  return world.npcs.find((n) => {
    const t = tileOf(n);
    return t.x === x && t.y === y;
  });
}

const ok = (world: World) => (p: Point): boolean => walkable(tileAt(world.map, p.x, p.y));

export function updateNpcs(world: World, dt: number): void {
  for (const n of world.npcs) {
    if (world.approach === n.id) {
      if (walk(n, SPEED * 1.5, dt)) {
        world.approach = null;
        const at = tileOf(world.player);
        const me = tileOf(n);
        n.facing = at.x > me.x ? 'right' : at.x < me.x ? 'left' : at.y > me.y ? 'down' : 'up';
        world.events.push({ kind: 'challenge', npc: n.id });
      }
      continue;
    }
    n.timer -= dt;
    if (n.timer <= 0 && !n.path.length) {
      n.timer = 2 + nextRandom(world.rng) * 3;
      if (n.kind === 'trainer') {
        const t = trainer(n.id);
        if (t.patrol && nextRandom(world.rng) < 0.5) {
          const at = tileOf(n);
          const to = at.x === t.patrol.x && at.y === t.patrol.y ? n.home : t.patrol;
          n.path = pathTo(at, to, ok(world)) ?? [];
        } else {
          // Look about, mostly the way it usually faces.
          n.facing = nextRandom(world.rng) < 0.6 ? t.facing : DIRS[Math.floor(nextRandom(world.rng) * 4)]!;
        }
      } else {
        const spot = { x: n.home.x - 2 + Math.floor(nextRandom(world.rng) * 5), y: n.home.y - 2 + Math.floor(nextRandom(world.rng) * 5) };
        if (ok(world)(spot)) n.path = pathTo(tileOf(n), spot, ok(world)) ?? [];
      }
    }
    walk(n, SPEED, dt);
  }
}

/** The tiles a trainer can see: straight ahead, until something blocks the view. */
export function sightLine(world: World, n: Npc): Point[] {
  const out: Point[] = [];
  const d = DELTA[n.facing];
  const from = tileOf(n);
  for (let i = 1; i <= trainer(n.id).sight; i += 1) {
    const p = { x: from.x + d.x * i, y: from.y + d.y * i };
    if (!ok(world)(p)) break;
    out.push(p);
  }
  return out;
}

/** After each step: does a trainer who's up for a battle see you? Then they walk over. */
export function checkSight(world: World): boolean {
  if (world.approach || world.battle) return false;
  const me = tileOf(world.player);
  for (const n of world.npcs) {
    if (n.kind !== 'trainer' || n.path.length || !canChallenge(world, n.id)) continue;
    if (!sightLine(world, n).some((p) => p.x === me.x && p.y === me.y)) continue;
    world.approach = n.id;
    n.path = pathBeside(tileOf(n), me, ok(world)) ?? [];
    world.player.path = [];
    world.player.pending = null;
    world.events.push({ kind: 'spotted', npc: n.id });
    return true;
  }
  return false;
}
