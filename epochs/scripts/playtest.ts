/**
 * Runs the bot for a few simulated hours and prints how far it got. For
 * tuning `src/data/progression.ts` by eye; `tests/bot.test.ts` is the gate.
 *
 *   npm run playtest -- 6      # hours, default 6
 */
import { LINES } from '../src/data/buildings';
import { ERAS } from '../src/data/eras';
import { RES_IDS } from '../src/data/resources';
import { runBot } from '../src/game/bot';
import { derive } from '../src/game/derive';
import { newGame } from '../src/game/engine';
import { fmt } from '../src/num/format';
import { goalMet } from '../src/game/progress';

const hours = Number(process.argv[2] ?? 6);
const seed = Number(process.argv[3] ?? 7);
const every = Number(process.argv[4] ?? 0.5);
const s = newGame(seed);
const t0 = performance.now();
for (let h = 0; h < hours; h += every) {
  const { log } = runBot(s, every * 3600);
  for (const line of log) console.log(`  [${h.toFixed(1)}+] ${line}`);
  const d = derive(s);
  const res = RES_IDS.filter((r) => s.res[r] > 0).map((r) => `${r} ${fmt(s.res[r])}${d.net[r] ? `(${d.net[r] > 0 ? '+' : ''}${fmt(d.net[r])})` : ''}`).join(' ');
  const goals = ERAS[s.era]!.goals.map((g) => (goalMet(s, g, d) ? '✓' : '·')).join('');
  console.log(`${(h + every).toFixed(1)}h ${ERAS[s.era]!.name} [${goals}] pop ${Math.floor(s.pop)}/${d.housing} stab ${d.stability.toFixed(0)} plots ${d.plotsUsed}/${d.plotsTotal} techs ${s.techs.length} power ${fmt(d.power.supply)}/${fmt(d.power.demand)}`);
  console.log(`    ${res}`);
}
const d = derive(s);
console.log('---');
console.log(`after ${hours}h (${((performance.now() - t0) / 1000).toFixed(1)}s real), launches ${s.stats.launches}, heritage ${s.heritage.earned}`);
console.log(`lines ${LINES.map((l) => `${l.id}:${d.units[l.id]}`).join(' ')}`);
console.log(`jobs ${JSON.stringify(s.jobs)}`);
console.log(`wonders ${JSON.stringify(s.wonders)}`);
