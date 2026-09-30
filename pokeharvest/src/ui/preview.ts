/** A small animated Pokémon on its own canvas, for menus. Stops when it leaves the page. */
import { drawPokemon, loadSheet, sheetSize } from '../render/sprites';
import { h } from './dom';

export function loadSprite(dex: number, scale: number, className: string): HTMLCanvasElement {
  const c = h('canvas', { className: `${className} pixel` });
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  let started = false;
  const frame = (now: number): void => {
    if (started && !c.isConnected) return;
    started = true;
    const size = sheetSize(dex);
    if (size) {
      const w = Math.ceil(size.w * scale * dpr);
      const hh = Math.ceil(size.h * scale * dpr);
      if (c.width !== w || c.height !== hh) {
        c.width = w;
        c.height = hh;
        c.style.width = `${w / dpr}px`;
        c.style.height = `${hh / dpr}px`;
      }
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, w, hh);
      drawPokemon(g, dex, w / 2, hh, scale * dpr, { time: now });
    }
    requestAnimationFrame(frame);
  };
  void loadSheet(dex).then(() => requestAnimationFrame(frame));
  return c;
}
