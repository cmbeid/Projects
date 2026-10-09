import type { SpriteDef } from './defs';

/** FNV-1a over every sprite's name and pixels. Changes whenever the art does. */
export function spritesHash(sprites: readonly SpriteDef[]): string {
  let h = 2166136261;
  const mix = (text: string): void => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  };
  for (const s of sprites) {
    mix(`${s.name}:${s.w}x${s.h}:`);
    for (const p of s.px) mix(p ?? '-');
  }
  return (h >>> 0).toString(16);
}
