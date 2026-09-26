/**
 * Plays every map with the bot in `src/game/bot.ts`, using only the towers a
 * player would have by then without catching anything, and reports lives
 * left. A map it cannot clear on Normal is too hard; one it clears untouched
 * on Hard is too easy. `npm run playtest -- mt-moon` plays one map.
 */
import { NO_TRAINER } from '../src/data/items';
import { MAPS } from '../src/data/maps';
import { LINES } from '../src/data/towers';
import { playOut } from '../src/game/bot';
import { newGame } from '../src/game/game';
import type { DifficultyKey } from '../src/game/waves';

const only = process.argv[2];
for (const [i, map] of MAPS.entries()) {
  if (only && map.id !== only) continue;
  const badges = map.endless ? 8 : i;
  const team = LINES.filter((l) => l.unlock.kind === 'start' || (l.unlock.kind === 'badge' && l.unlock.badge <= badges)).map((l) => l.id);
  const row: string[] = [];
  for (const difficulty of ['normal', 'hard'] as DifficultyKey[]) {
    const g = newGame({ map, difficulty, team, items: {}, balls: {}, held: {}, trainer: NO_TRAINER, seed: 1 });
    const started = Date.now();
    const { lives, cleared } = playOut(g);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    row.push(`${difficulty}: ${g.status === 'won' ? `won, ${lives} lives` : `${g.status} at wave ${cleared + 1}`} (${g.towers.length} towers, ${secs}s)`);
  }
  console.log(`${map.name.padEnd(18)} ${row.join('   ')}`);
}
