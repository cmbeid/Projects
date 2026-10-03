/**
 * Runs the bot for a few simulated hours and prints how far it got. For
 * tuning `src/data/progression.ts` by eye; `tests/bot.test.ts` is the gate.
 *
 *   npm run playtest -- 6      # hours, default 6
 */
import { storyIndex } from '../src/game/missions';
import { newGame } from '../src/game/engine';
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { STORY } from '../src/data/missions';

const hours = Number(process.argv[2] ?? 6);
const seed = Number(process.argv[3] ?? 7);
const s = newGame(seed);
const t0 = performance.now();
const { log } = runBot(s, hours * 3600);
for (const line of log) console.log(line);
const d = derive(s);
console.log('---');
console.log(`after ${hours}h (${((performance.now() - t0) / 1000).toFixed(1)}s real)`);
console.log(`depth ${s.depth} / max ${s.maxDepth} / deepest ${s.deepestEver}, level ${s.level}`);
console.log(`story ${storyIndex(s)}/${STORY.length} (next: ${STORY[storyIndex(s)]?.title ?? 'done'})`);
console.log(`coins ${s.coins.toExponential(2)}, tap ${d.tap.toExponential(2)}, auto ${d.autoDps.toExponential(2)}`);
console.log(`machines ${JSON.stringify(s.machines)} upgrades ${JSON.stringify(s.upgrades)}`);
console.log(`gear ${s.gear.map((g) => g.base).join(', ')}`);
console.log(`fixtures ${s.fixtures.join(', ')} descents ${s.counters.descents} echoes ${s.echoesEarned}`);
console.log(`stats ${JSON.stringify(s.stats)} passives ${JSON.stringify(s.passives)}`);
