import { itemIconUrl } from '../data/items';
/** Small still portraits of Pokémon for the DOM (shop, team, Pokédex, results). */
import { drawPokemon, loadSheet, sheetSize } from './sprites';

/**
 * A canvas `size` CSS px square with the Pokémon's first frame, fitted and
 * centred. Drawn when its sheet arrives if it is not loaded yet.
 */
export function thumb(dex: number, size: number, opts: { shiny?: boolean; animate?: boolean } = {}): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'pix';
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d')!;
  const paint = (time: number): void => {
    const s = sheetSize(dex, opts.shiny);
    if (!s) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const fit = Math.min(canvas.width / s.w, canvas.height / s.h, (canvas.width / 44) * 1.1);
    const scale = fit >= 1 ? Math.floor(fit * 2) / 2 || fit : fit;
    drawPokemon(ctx, dex, canvas.width / 2, canvas.height / 2 + (s.h * scale) / 2, scale, { time, shiny: opts.shiny ?? false, frozen: !opts.animate });
  };
  void loadSheet(dex, Boolean(opts.shiny)).then(() => {
    paint(0);
    if (opts.animate) {
      const tick = (t: number): void => {
        if (!canvas.isConnected) return;
        paint(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  return canvas;
}

export function icon(key: string, size = 32, className = 'pix'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = itemIconUrl(key);
  img.alt = '';
  img.className = className;
  img.width = size;
  img.height = size;
  img.draggable = false;
  return img;
}

export function badgeImg(n: number, className = 'pix'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = `badges/${n}.png`;
  img.alt = `Badge ${n}`;
  img.className = className;
  img.draggable = false;
  return img;
}
