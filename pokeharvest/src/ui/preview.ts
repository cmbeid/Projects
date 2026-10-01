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

/**
 * One still frame of a Pokémon, drawn once: for grids of many, where an
 * animated canvas each would be wasteful. A silhouette for ones only seen.
 */
export function stillSprite(dex: number, scale: number, className: string, silhouette = false): HTMLCanvasElement {
  const c = h('canvas', { className: `${className} pixel` });
  void loadSheet(dex).then(() => {
    const size = sheetSize(dex);
    if (!size) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.ceil(size.w * scale * dpr);
    c.height = Math.ceil(size.h * scale * dpr);
    c.style.width = `${c.width / dpr}px`;
    c.style.height = `${c.height / dpr}px`;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    drawPokemon(g, dex, c.width / 2, c.height, scale * dpr, { time: 0, frozen: true });
    if (silhouette) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = '#3a2a1a';
      g.fillRect(0, 0, c.width, c.height);
    }
  });
  return c;
}
