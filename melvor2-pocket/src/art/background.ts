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
