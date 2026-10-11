import { CONSUMABLE } from '../data/materials';
import { MAT } from '../data/materials';
import type { Bundle, ConsumableId, MatId } from '../data/types';
import { iconHtml } from '../sprites/atlas';
import { esc } from './dom';

export function n1(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

export function signed(v: number): string {
  const r = Math.round(v * 10) / 10;
  return r > 0 ? `+${r}` : `${r}`;
}

export function matIcon(m: MatId, scale = 2): string {
  return iconHtml(`mat-${m}`, scale);
}

export function itemIcon(id: ConsumableId, scale = 2): string {
  return iconHtml(`item-${id}`, scale);
}

/** "3 ore, 2 alloy" with icons, marking what you're short of. */
export function bundleHtml(b: Bundle, have?: Record<MatId, number>): string {
  const parts = (Object.entries(b) as [MatId, number][]).map(([m, n]) => {
    const short = have && have[m] < n;
    return `<span class="${short ? 'bad' : ''}">${matIcon(m, 1)}${n} ${esc(MAT.get(m)!.name)}</span>`;
  });
  return parts.join(' · ') || '<span class="muted">free</span>';
}

export function itemName(id: ConsumableId): string {
  return CONSUMABLE.get(id)!.name;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function barHtml(frac: number, kind = ''): string {
  return `<div class="bar ${kind}"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%"></i></div>`;
}

/** Colour a change line from an event: gains green, losses red. */
export function changeClass(line: string): string {
  return /^[−-]/.test(line) ? 'neg' : /^\+/.test(line) ? 'pos' : '';
}
