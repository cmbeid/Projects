// Page backgrounds from the player's own install, as the desktop shows them: each page has a Day, Sunset and Night scene
// (EntityPage.TimeOfDayBackgrounds), picked by the time of day. The day segments start at 8:00, 16:00 and 20:00.
import { all, tryGet } from '../engine/content';
import { assetUrl } from './assets';

export type BackgroundMode = 'clock' | 'Day' | 'Sunset' | 'Night' | 'off';
const PREF_KEY = 'melvor2-pocket-background';

export function backgroundMode(): BackgroundMode {
  try {
    return (localStorage.getItem(PREF_KEY) as BackgroundMode | null) ?? 'clock';
  } catch {
    return 'clock';
  }
}

export function setBackgroundMode(mode: BackgroundMode): void {
  try {
    localStorage.setItem(PREF_KEY, mode);
  } catch {
    // Private mode etc.: the choice just won't persist.
  }
}

interface Segment { Id: string; StartTime: number }

/** The day segment for a wall-clock time: the last one started, wrapping past midnight to the latest. */
export function segmentAt(date: Date): string {
  const secs = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const segs = all<Segment>('DaySegment').sort((a, b) => a.StartTime - b.StartTime);
  if (!segs.length) return 'Day';
  return (segs.filter((s) => s.StartTime <= secs).pop() ?? segs[segs.length - 1]).Id;
}

interface EntityPage { TimeOfDayBackgrounds: { Segment: string; Texture: string }[] | null; ApplyBackgroundBlur: boolean }
interface AreaBackground { Textures: { Key: string; Value: { Center: string } }[] }

/** Background image URL for a page (an EntityPage id such as "Woodcutting", "Bank" or "Combat"), or none. */
export function pageBackground(page: string, now = new Date()): { url: string; blur: boolean } | undefined {
  const mode = backgroundMode();
  if (mode === 'off') return undefined;
  const segment = `MelvorBase:${mode === 'clock' ? segmentAt(now) : mode}`;
  if (page === 'Combat') {
    // The combat page names an image this build lacks; fights are drawn over the area's centre scene.
    const area = tryGet<AreaBackground>('CombatAreaBackground', 'MelvorBase:Forest');
    const url = assetUrl(area?.Textures.find((t) => t.Key === segment)?.Value.Center);
    return url ? { url, blur: false } : undefined;
  }
  const p = tryGet<EntityPage>('EntityPage', `MelvorBase:${page}`);
  const url = assetUrl(p?.TimeOfDayBackgrounds?.find((b) => b.Segment === segment)?.Texture);
  return url ? { url, blur: p!.ApplyBackgroundBlur } : undefined;
}

// ---- weather: the desktop rolls Clear or Rain (weights 9 : 1) each time a new day begins ---------------------------

const WEATHER_KEY = 'melvor2-pocket-weather';
export function weatherOn(): boolean {
  try {
    return localStorage.getItem(WEATHER_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setWeatherOn(on: boolean): void {
  try {
    localStorage.setItem(WEATHER_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode etc.: the choice just won't persist.
  }
}

interface WeatherType { Id: string; Weight: number }

/** Today's weather: a day starts at the first segment (8:00), and its weather is a fixed roll for that date. */
export function weatherAt(now = new Date()): string {
  const types = all<WeatherType>('WeatherType');
  if (!types.length) return 'Clear';
  const first = Math.min(...all<Segment>('DaySegment').map((s) => s.StartTime));
  const day = new Date(now.getTime() - first * 1000);
  // A small hash of the date, so every device shows the same weather on the same day.
  let h = day.getFullYear() * 372 + day.getMonth() * 31 + day.getDate();
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  let roll = ((h ^ (h >>> 16)) >>> 0) % types.reduce((t, w) => t + w.Weight, 0);
  for (const w of types) {
    if (roll < w.Weight) return w.Id;
    roll -= w.Weight;
  }
  return types[0].Id;
}

export const raining = (now = new Date()) => weatherOn() && backgroundMode() !== 'off' && weatherAt(now) === 'Rain';
