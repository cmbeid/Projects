/**
 * Runs the bot for a few simulated hours and prints how far it got. For
 * tuning by eye; `tests/bot.test.ts` is the gate.
 *
 *   npm run playtest -- 8      # hours, default 8
 */
import { GUILDS } from '../src/data/meta';
import { SKILL_LIST } from '../src/data/skills';
import { runBot } from '../src/game/bot';
import { combatLevel, level, newGame } from '../src/game/core';
import { rankOf } from '../src/game/modifiers';

const hours = Number(process.argv[2] ?? 8);
const seed = Number(process.argv[3] ?? 7);
const s = newGame(seed, 0);
const t0 = performance.now();
const { log } = runBot(s, hours * 3600);
for (const line of log) console.log(line);
console.log('---');
console.log(`after ${hours}h (${((performance.now() - t0) / 1000).toFixed(1)}s real)`);
console.log(`combat level ${combatLevel(s)}, gp ${Math.floor(s.gp)}, kills ${s.counters['kills'] ?? 0}, deaths ${s.counters['deaths'] ?? 0}`);
console.log(SKILL_LIST.map((k) => `${k.name} ${level(s, k.id)}`).join(', '));
console.log(`total level ${SKILL_LIST.reduce((a, k) => a + level(s, k.id), 0)}`);
console.log(`guilds: ${GUILDS.filter((g) => s.guilds[g.id]).map((g) => `${g.name} r${rankOf(s.guilds[g.id]!.rep)}`).join(', ')}`);
console.log(`quests: ${s.quests.join(', ')}; pets ${s.pets.join(', ')}`);
console.log(`gear: ${Object.values(s.loadouts[0]!).map((st) => st?.item).join(', ')}; upgrades ${JSON.stringify(s.upgrades)}`);
console.log(`bank ${s.bankOrder.length} stacks; course ${s.course.filter(Boolean).length}`);
