/**
 * Prints the bot's progress through the campaign, for tuning
 * `src/data/progression.ts`.
 *
 *   npm run playtest -- 200        # days
 *   npm run playtest -- 200 7      # days, seed
 */
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';
import { arkSections } from '../src/game/story';
import { STORY } from '../src/data/story';

const days = Number(process.argv[2] ?? 200);
const seed = Number(process.argv[3] ?? 7);
const s = newGame(seed);
const t0 = Date.now();
const report = runBot(s, days);
for (const line of report.log) console.log(line);
const d = derive(s);
console.log('---');
console.log(`Day ${s.day}, sector ${s.sector.index + 1}, mission ${s.story.idx}/${STORY.length}: ${STORY[s.story.idx]?.title ?? 'done'}`);
console.log(`Ark sections ${arkSections(s)}, colonists ${s.colonists}, reloads ${s.stats.reloads}, stuck ${report.stuck}`);
console.log(`Res ${JSON.stringify(s.res)} maxHull ${d.maxHull}`);
console.log(`Mats ${JSON.stringify(s.mats)}`);
console.log(`Modules ${JSON.stringify(s.modules)}`);
console.log(`Crew ${s.crew.map((c) => `${c.name} ${c.cls} L${c.level} ${c.hp}hp`).join('; ')}`);
console.log(`Stats ${JSON.stringify({ ...s.stats, seen: s.stats.seen.length })}`);
console.log(`Ending ${s.ending}, actions ${report.actions}, ${Date.now() - t0}ms`);
