import { JOB, RESOURCE } from '../data/resources';
import type { Bundle, Effect, ResId, TierDef } from '../data/types';
import { fmt } from '../num/format';
import { iconHtml } from '../sprites/atlas';
import type { GameState } from '../state/types';
import { esc } from './dom';

/** Words for what an effect does. */
export function effectText(e: Effect): string {
  const pct = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;
  switch (e.k) {
    case 'plots': return `${e.n >= 0 ? '+' : '−'}${Math.abs(e.n)} land`;
    case 'job': return `${JOB.get(e.job)!.plural} ${pct(e.x)}`;
    case 'all': return `every job ${pct(e.x)}`;
    case 'cap': return `storage ${pct(e.x)}`;
    case 'growth': return `births ${pct(e.x)}`;
    case 'stability': return `${e.n >= 0 ? '+' : '−'}${Math.abs(e.n)} stability`;
    case 'eat': return `people eat ${Math.round(e.x * 100)}% less`;
    case 'cost': return e.x >= 0 ? `buildings ${Math.round(e.x * 100)}% cheaper` : `buildings ${Math.round(-e.x * 100)}% dearer`;
    case 'research': return `research ${Math.round(e.x * 100)}% cheaper`;
    case 'wonderSpeed': return `wonders build ${pct(e.x)} faster`;
    case 'housing': return `homes hold ${pct(e.x)}`;
    case 'slots': return `workplaces hold ${pct(e.x)}`;
    case 'offline': return `+${e.n}h time away`;
    case 'festival': return `festivals last ${pct(e.x)}`;
    case 'feature': return FEATURE_TEXT[e.f] ?? e.f;
    case 'stash': return 'a store to start with';
    case 'startPop': return `start with ${e.n} more people`;
    case 'startTechs': return `start knowing ${e.n} techs`;
    case 'heritageGain': return `Heritage ${pct(e.x)}`;
    case 'eventRate': return `events ${pct(e.x)} more often`;
  }
}

const FEATURE_TEXT: Record<string, string> = {
  jobs: 'jobs',
  research: 'research',
  wonders: 'unlocks wonders',
  chronicle: 'unlocks the Chronicle',
  festival: 'unlocks festivals',
  autoAssign: 'unlocks auto-assign',
  queue: 'unlocks the research queue',
  modernizeAll: 'modernize a whole line',
  heritage: 'Heritage',
};

export function effectsText(effects: readonly Effect[]): string {
  return effects.map(effectText).join(', ');
}

export function resIcon(r: ResId, scale = 2): string {
  return iconHtml(`res-${r}`, scale, 'ricon');
}

/** A price as chips, each red if it cannot be paid yet. */
export function costHtml(s: GameState, cost: Bundle | null | undefined): string {
  if (!cost) return '';
  return Object.entries(cost)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([r, n]) => {
      const short = s.res[r as ResId] < (n ?? 0);
      return `<span class="cost${short ? ' short' : ''}" title="${esc(RESOURCE.get(r as ResId)!.name)}">${resIcon(r as ResId, 1)}${fmt(n ?? 0)}</span>`;
    })
    .join('');
}

/** What a building of this tier is for, in a few words. */
export function tierText(t: TierDef, job: string | null): string {
  const out: string[] = [];
  if (t.housing) out.push(`houses ${t.housing}`);
  if (t.slots && job) out.push(`${t.slots} ${JOB.get(job as never)!.plural.toLowerCase()} at ×${fmt(t.prod)}`);
  if (t.cap) out.push(`+${fmt(t.cap)} storage`);
  if (t.stability) out.push(`+${t.stability} stability`);
  if (t.power) out.push(`+${t.power} power`);
  const fuel = Object.entries(t.fuel);
  if (fuel.length) out.push(`burns ${fuel.map(([r, n]) => `${n}/s ${RESOURCE.get(r as ResId)!.name.toLowerCase()}`).join(', ')}`);
  return out.join(' · ');
}

export function rate(n: number): string {
  if (Math.abs(n) < 0.005) return '0';
  return `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}/s`;
}
