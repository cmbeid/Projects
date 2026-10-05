/**
 * Runs the bot for a few simulated hours and prints how far it got. For
 * tuning `src/data/progression.ts` by eye; `tests/bot.test.ts` is the gate.
 *
 *   npm run playtest -- 6      # hours, default 6
 */
import { BUILDING } from '../src/data/buildings';
import { STORY } from '../src/data/missions';
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';
import { storyIndex } from '../src/game/missions';

const hours = Number(process.argv[2] ?? 6);
const seed = Number(process.argv[3] ?? 7);
const s = newGame(seed);
const t0 = performance.now();
const { log } = runBot(s, hours * 3600);
for (const line of log) console.log(line);
const d = derive(s);
console.log('---');
console.log(`after ${hours}h (${((performance.now() - t0) / 1000).toFixed(1)}s real)`);
console.log(`ward ${s.ward} / max ${s.maxWard} / furthest ${s.furthestEver}, level ${s.level}`);
console.log(`story ${storyIndex(s)}/${STORY.length} (next: ${STORY[storyIndex(s)]?.title ?? 'done'})`);
console.log(`coins ${s.coins.toExponential(2)}, tap ${d.tap.toExponential(2)}, crews ${d.crewDps.toExponential(2)}/s, taxes ${d.taxPerSec.toExponential(2)}/s`);
console.log(`pop ${Math.floor(d.city.pop)} jobs ${Math.floor(d.city.jobs)} happiness ${d.city.happiness.toFixed(2)} slots ${d.city.slots}`);
const byType = new Map<string, string>();
for (const b of s.buildings) byType.set(b.type, `${(byType.get(b.type) ?? '')}${b.lvl},`);
console.log(`buildings ${[...byType].map(([t, l]) => `${BUILDING.get(t)?.name} [${l}]`).join(' ')}`);
console.log(`upgrades ${JSON.stringify(s.upgrades)}`);
console.log(`regalia ${s.regalia.map((g) => g.base).join(', ')}`);
console.log(`fixtures ${s.fixtures.join(', ')} tides ${s.counters.tides} memories ${s.memoriesEarned}`);
console.log(`stats ${JSON.stringify(s.stats)} passives ${JSON.stringify(s.passives)}`);
