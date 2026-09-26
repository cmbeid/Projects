/**
 * A bot that plays levels headlessly and reports whether it won, in how many
 * shots, and how that compares with the level's par and Pokémon count.
 *
 * For each shot it tries a coarse grid of pulls — and, for a Pokémon with an
 * ability, a few moments to use it — then refines around the best few, keeps
 * whichever knocks out the most targets (then scores most), and moves on.
 * The simulation is deterministic, so a candidate is scored by replaying the
 * shots chosen so far and then trying it. It never uses items.
 *
 * It aims perfectly, so it is a floor on difficulty, not a measure of it: a
 * level it clears in n shots is given n + 1 or n + 2 Pokémon.
 *
 *   npm run playtest                      # every level, spread over all cores
 *   npm run playtest -- mt-moon           # one area (or one level id)
 */
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { LEVELS, type LevelDef } from '../src/data/levels/index';
import { LAUNCHERS } from '../src/data/roster';
import { Game } from '../src/game/game';
import { starThresholds, starsFor } from '../src/game/scoring';
import { MAX_PULL } from '../src/game/world';

interface Shot {
  angle: number;
  power: number;
  /**
   * Ms after launch to use the ability, 'inside' to use it once Gengar has
   * been drifting through a block for a moment (as a player would), or null
   * for never.
   */
  abilityAt: number | 'inside' | null;
}

interface Result {
  id: string;
  won: boolean;
  shots: number;
  score: number;
  ms: number;
  /** Targets still standing at the end, with their health, for a lost level. */
  left: string[];
}

const DEG = Math.PI / 180;
const ANGLES = [-10, 0, 10, 20, 30, 40, 50, 60, 70].map((d) => d * DEG);
const POWERS = [0.6, 0.75, 0.9, 1];
const ABILITY_TIMES = [null, 350, 700, 1100];
const FRAME = 1000 / 60;
/** How long Gengar has been inside something before the bot taps, like a player reacting. */
const INSIDE_DELAY = 200;

function fire(game: Game, shot: Shot): void {
  // Pulling back and down fires up and forward.
  const pull = { x: -Math.cos(shot.angle) * MAX_PULL * shot.power, y: Math.sin(shot.angle) * MAX_PULL * shot.power };
  game.launch(pull);
  let t = 0;
  let insideFor = 0;
  while (game.phase === 'flying' || game.phase === 'settling') {
    game.update(FRAME);
    t += FRAME;
    if (shot.abilityAt === 'inside') {
      const ghost = game.abilityTarget;
      insideFor = ghost?.inside ? insideFor + FRAME : 0;
      if (insideFor >= INSIDE_DELAY) game.useAbility();
    } else if (shot.abilityAt !== null && t >= shot.abilityAt) game.useAbility();
    if (t > 30_000) break;
  }
}

function replay(level: LevelDef, shots: readonly Shot[]): Game {
  const game = new Game(level);
  for (let t = 0; t < 2000; t += FRAME) game.update(FRAME); // let the grace period pass
  for (const shot of shots) fire(game, shot);
  return game;
}

/** Health left across all targets, as a sum of fractions: 2.5 is two and a half targets' worth. */
function healthLeft(game: Game): number {
  let total = 0;
  for (const e of game.entities.values()) if (e.kind === 'target' && !e.dead) total += Math.max(0, e.hp) / e.maxHp;
  return total;
}

/** Fewest targets left; then least health left, so wearing down a boss counts; then score. */
function better(a: Game, b: Game | undefined): boolean {
  if (!b) return true;
  if (a.targetsLeft !== b.targetsLeft) return a.targetsLeft < b.targetsLeft;
  const ha = healthLeft(a);
  const hb = healthLeft(b);
  if (Math.abs(ha - hb) > 0.02) return ha < hb;
  return a.score > b.score;
}

function play(level: LevelDef): Result {
  const started = Date.now();
  const shots: Shot[] = [];
  let game = replay(level, shots);
  while (game.phase === 'aiming' && game.loaded) {
    const hasAbility = LAUNCHERS[game.loaded].ability !== 'none';
    const tried: { shot: Shot; game: Game }[] = [];
    const attempt = (shot: Shot): void => {
      tried.push({ shot, game: replay(level, [...shots, shot]) });
    };

    for (const angle of ANGLES) {
      for (const power of POWERS) {
        const times = !hasAbility ? [null] : LAUNCHERS[game.loaded].ability === 'phase' ? [...ABILITY_TIMES, 'inside' as const] : ABILITY_TIMES;
        for (const abilityAt of times) attempt({ angle, power, abilityAt });
      }
    }
    tried.sort((x, y) => (better(x.game, y.game) ? -1 : better(y.game, x.game) ? 1 : 0));
    // Refine around the three best.
    for (const { shot } of tried.slice(0, 3)) {
      for (const da of [-4, -2, 2, 4]) {
        for (const dp of [-0.05, 0, 0.05]) {
          const power = Math.min(1, Math.max(0.3, shot.power + dp));
          attempt({ angle: shot.angle + da * DEG, power, abilityAt: shot.abilityAt });
        }
      }
    }
    let best = tried[0]!;
    for (const t of tried) if (better(t.game, best.game)) best = t;
    shots.push(best.shot);
    game = best.game;
  }
  const left = [...game.entities.values()]
    .filter((e) => e.kind === 'target' && !e.dead)
    .map((e) => `${e.target!.key} ${Math.round((100 * Math.max(0, e.hp)) / e.maxHp)}%`);
  return { id: level.id, won: game.phase === 'won', shots: game.shots, score: game.score, ms: Date.now() - started, left };
}

function report(result: Result): string {
  const level = LEVELS.find((l) => l.id === result.id)!;
  const [two, three] = starThresholds(level);
  const n = level.launchers.length;
  return `  ${result.id.padEnd(20)} ${result.won ? 'won ' : 'LOST'} in ${result.shots}/${n}`
    + ` (par ${level.par}, slack ${n - result.shots})`
    + `  score ${String(result.score).padStart(6)} ★${starsFor(level, result.score, result.won)}`
    + `  [2★ ${two}, 3★ ${three}]  ${(result.ms / 1000).toFixed(0)}s`
    + (result.left.length ? `  left: ${result.left.join(', ')}` : '');
}

const WORKER_FLAG = '--playtest-worker';

if (!process.argv.includes(WORKER_FLAG)) {
  const filter = process.argv[2];
  const levels = LEVELS.filter((l) => !filter || l.id === filter || l.id.startsWith(`${filter}-`));
  if (levels.length === 0) {
    console.error(`no levels match ${filter}`);
    process.exit(1);
  }
  const queue = levels.map((l) => l.id);
  const results: Result[] = [];
  const self = fileURLToPath(import.meta.url);
  // One child process per core; each inherits tsx's loader through execArgv.
  await Promise.all(
    Array.from({ length: Math.min(cpus().length, levels.length) }, () => new Promise<void>((resolve, reject) => {
      const child = fork(self, [WORKER_FLAG], { execArgv: process.execArgv });
      const next = (): void => {
        const id = queue.shift();
        if (id) child.send(id);
        else {
          child.kill();
          resolve();
        }
      };
      child.on('message', (result: Result) => {
        results.push(result);
        console.log(report(result));
        next();
      });
      child.on('error', reject);
      next();
    })),
  );
  const lost = results.filter((r) => !r.won);
  console.log(`\n${results.length - lost.length}/${results.length} won`);
  process.exit(lost.length > 0 ? 1 : 0);
} else {
  process.on('message', (id: string) => {
    const level = LEVELS.find((l) => l.id === id)!;
    process.send!(play(level));
  });
}
