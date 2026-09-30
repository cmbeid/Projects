/**
 * Item icons for the DOM: berries are PokeAPI's own icons; tools are drawn
 * in code, and seeds are the berry on a paper packet.
 */
import { crop } from '../data/crops';
import { item, itemIconUrl } from '../data/items';
import { h } from './dom';

type Ctx = CanvasRenderingContext2D;

function px(g: Ctx, color: string, x: number, y: number, w = 1, hgt = 1): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, hgt);
}

const TOOL_ART: Record<string, (g: Ctx) => void> = {
  hoe: (g) => {
    for (let i = 0; i < 11; i += 1) px(g, i % 3 ? '#a0673a' : '#8a5530', 3 + i, 13 - i, 2, 2);
    px(g, '#8a8a93', 10, 2, 5, 3);
    px(g, '#c0c0ca', 10, 2, 5, 1);
    px(g, '#5e5e66', 13, 5, 2, 2);
  },
  can: (g) => {
    px(g, '#3a6fd8', 3, 6, 9, 8);
    px(g, '#5b8ff0', 4, 7, 7, 2);
    px(g, '#274f9e', 3, 13, 9, 1);
    px(g, '#3a6fd8', 12, 8, 2, 2);
    px(g, '#3a6fd8', 13, 6, 2, 2);
    px(g, '#8a8a93', 14, 5, 2, 2);
    px(g, '#274f9e', 5, 3, 5, 1);
    px(g, '#274f9e', 5, 3, 1, 3);
    px(g, '#274f9e', 9, 3, 1, 3);
  },
  sickle: (g) => {
    px(g, '#a0673a', 3, 11, 2, 4);
    px(g, '#8a5530', 5, 10, 2, 2);
    px(g, '#8a8a93', 6, 4, 2, 7);
    px(g, '#8a8a93', 7, 2, 5, 2);
    px(g, '#c0c0ca', 11, 3, 3, 2);
    px(g, '#c0c0ca', 13, 5, 2, 3);
  },
};

const toolUrls = new Map<string, string>();

function toolUrl(id: string): string {
  let url = toolUrls.get(id);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    TOOL_ART[id]?.(c.getContext('2d')!);
    url = c.toDataURL();
    toolUrls.set(id, url);
  }
  return url;
}

/** An icon for any item. */
export function itemIcon(id: string, className = 'icon'): HTMLElement {
  const def = item(id);
  if (def.kind === 'tool') return h('img', { className: `${className} pixel`, src: toolUrl(id), alt: def.name, draggable: false });
  const img = h('img', { className: `${className} pixel`, src: itemIconUrl(crop(def.crop!).icon), alt: def.name, draggable: false });
  if (def.kind === 'seed') return h('span', { className: `${className} seed-packet`, title: def.name }, img);
  return img;
}
