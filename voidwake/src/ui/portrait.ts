import { CLASS } from '../data/crew';
import { portraitPx } from '../sprites/defs';
import type { Crew } from '../state/types';

/**
 * Crew faces are drawn on demand from their part indices and cached as data
 * URLs, so there are thousands of possible faces without baking any.
 */
const cache = new Map<string, string>();

export function portraitUrl(parts: readonly number[], suit: string): string {
  const key = `${parts.join(',')}:${suit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = portraitPx(parts, suit);
  const canvas = document.createElement('canvas');
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function crewFace(c: Crew, big = false): string {
  return `<img class="portrait${big ? ' big' : ''}" alt="" src="${portraitUrl(c.portrait, CLASS.get(c.cls)!.color)}">`;
}
