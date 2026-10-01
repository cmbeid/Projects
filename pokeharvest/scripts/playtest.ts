/**
 * Plays a year on the farm with the bot from src/game/bot.ts and prints how
 * each season went: a quick check on balance after changing prices or crops.
 * `npm run playtest -- --days 56 --seed 3` to change the length or the seed.
 */
import { botDay } from '../src/game/bot';
import { DAYS_PER_SEASON, seasonOf } from '../src/game/time';
import { createWorld } from '../src/game/world';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const days = arg('days', DAYS_PER_SEASON * 4);
const w = createWorld(arg('seed', 1), 7);
let gold = w.player.gold;
let harvested = 0;
const weather: Record<string, number> = {};
for (let day = 1; day <= days; day += 1) {
  weather[w.weather] = (weather[w.weather] ?? 0) + 1;
  botDay(w);
  if (day % DAYS_PER_SEASON === 0 || day === days) {
    console.log(`${seasonOf(day).padEnd(7)} day ${String(day).padStart(3)}: gold ${String(w.player.gold).padStart(7)} (${w.player.gold - gold >= 0 ? '+' : ''}${w.player.gold - gold}), harvested ${w.stats.harvested - harvested}, farming level xp ${w.skills.farming}`);
    gold = w.player.gold;
    harvested = w.stats.harvested;
  }
}
console.log('weather:', weather);
