/** The weather: rolled a day ahead, so the morning report can forecast it. Rain waters every outdoor crop. */
import type { Weather } from '../data/encounters';
import { tileAt } from '../data/maps';
import { parseKey, type World } from './model';
import { nextRandom } from './rng';
import type { Season } from './time';

const CHANCES: Record<Season, readonly [Weather, number][]> = {
  Spring: [['rain', 0.3], ['storm', 0.05]],
  Summer: [['rain', 0.15], ['storm', 0.12]],
  Autumn: [['rain', 0.25], ['storm', 0.06]],
  Winter: [['snow', 0.45]],
};

export function rollWeather(world: World, season: Season): Weather {
  let r = nextRandom(world.rng);
  for (const [weather, chance] of CHANCES[season]) {
    if (r < chance) return weather;
    r -= chance;
  }
  return 'sun';
}

export function isWet(weather: Weather): boolean {
  return weather === 'rain' || weather === 'storm';
}

/** Rain or a storm waters every crop out in the open; the greenhouse stays dry. */
export function rainOnFarm(world: World): number {
  if (!isWet(world.weather)) return 0;
  let n = 0;
  for (const [key, plot] of Object.entries(world.plots)) {
    const p = parseKey(key);
    if (tileAt('farm', p.x, p.y) !== 'grass' || plot.watered) continue;
    plot.watered = true;
    n += 1;
  }
  return n;
}

export const WEATHER_NAMES: Record<Weather, string> = { sun: 'Sunny', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow' };
export const WEATHER_ICONS: Record<Weather, string> = { sun: '☀', rain: '☂', storm: '⛈', snow: '❄' };
