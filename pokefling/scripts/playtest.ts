/**
 * A greedy bot that plays every level headlessly and reports whether it won,
 * in how many shots, and how its score compares with the star thresholds.
 *
 * For each shot it tries a grid of pulls (and, for Pokémon with an ability,
 * a few moments to use it), keeps whichever knocks out the most targets, and
 * moves on. The simulation is deterministic, so a candidate is scored by
 * replaying the shots chosen so far and then trying it.
 *
 *   npm run playtest          # every level
 *   npm run playtest -- 7     # just level 7
 */
import { LEVELS, type LevelDef } from '../src/data/levels';
import { Game } from '../src/game/game';
import { starThresholds, starsFor } from '../src/game/scoring';
import { MAX_PULL } from '../src/game/world';

interface Shot {
  angle: number;
  power: number;
  /** Ms after launch to use the ability, or null for never. */
  abilityAt: number | null;
}

const ANGLES = [-10, 0, 10, 20, 30, 40, 50, 60, 70].map((d) => (d * Math.PI) / 180);
const POWERS = [0.55, 0.7, 0.8, 0.9, 1];
const ABILITY_TIMES = [null, 500, 900, 1300];
const FRAME = 1000 / 60;

function fire(game: Game, shot: Shot): void {
  // Pulling back and down fires up and forward.
  const pull = { x: -Math.cos(shot.angle) * MAX_PULL * shot.power, y: Math.sin(shot.angle) * MAX_PULL * shot.power };
  game.launch(pull);
  let t = 0;
  while (game.phase === 'flying' || game.phase === 'settling') {
    game.update(FRAME);
    t += FRAME;
    if (shot.abilityAt !== null && t >= shot.abilityAt) game.useAbility();
    if (t > 30_000) break;
  }
}

function replay(level: LevelDef, shots: readonly Shot[]): Game {
  const game = new Game(level);
  for (let t = 0; t < 2000; t += FRAME) game.update(FRAME); // let the grace period pass
  for (const shot of shots) fire(game, shot);
  return game;
}

function play(level: LevelDef): { game: Game; shots: Shot[] } {
  const shots: Shot[] = [];
  let game = replay(level, shots);
  while (game.phase === 'aiming') {
    const key = game.loaded;
    let best: { shot: Shot; game: Game } | null = null;
    for (const angle of ANGLES) {
      for (const power of POWERS) {
        for (const abilityAt of key === 'pikachu' ? [null] : ABILITY_TIMES) {
          const shot = { angle, power, abilityAt };
          const tried = replay(level, [...shots, shot]);
          const better = !best
            || tried.targetsLeft < best.game.targetsLeft
            || (tried.targetsLeft === best.game.targetsLeft && tried.score > best.game.score);
          if (better) best = { shot, game: tried };
        }
      }
    }
    if (!best) break;
    shots.push(best.shot);
    game = best.game;
  }
  return { game, shots };
}

const only = process.argv[2] ? Number(process.argv[2]) : null;
let losses = 0;
for (const level of LEVELS) {
  if (only !== null && level.id !== only) continue;
  const started = Date.now();
  const { game } = play(level);
  const won = game.phase === 'won';
  if (!won) losses += 1;
  const [two, three] = starThresholds(level);
  console.log(
    `  ${String(level.id).padStart(2)} ${level.name.padEnd(18)} ${won ? 'won ' : 'LOST'}`
    + ` in ${game.shots}/${level.launchers.length} (par ${level.par})`
    + `  score ${String(game.score).padStart(6)}  ★${starsFor(level, game.score, won)}`
    + `  [2★ ${two}, 3★ ${three}]  ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}
if (losses > 0) process.exit(1);
