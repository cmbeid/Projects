/**
 * What on the farm needs you right now, for the status chip under the HUD:
 * ripe crops, finished machines, barn produce, an empty Seed Box or trough,
 * and requests due today. Worked out fresh each time; nothing is stored.
 */
import { crop } from '../data/crops';
import { item } from '../data/items';
import { species } from '../data/species';
import { troughCount } from './barn';
import { isRipe } from './farm';
import { isDone } from './machines';
import { farmMons, partyMons, type World } from './model';
import { seedBoxCount } from './seedbox';

export interface StatusEntry {
  id: 'ripe' | 'machines' | 'barn' | 'seedbox' | 'trough' | 'requests';
  icon: string;
  /** A few words for the chip. */
  short: string;
  /** A line for the status sheet. */
  detail: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function farmStatus(world: World): StatusEntry[] {
  const out: StatusEntry[] = [];

  const ripe: Record<string, number> = {};
  for (const plot of Object.values(world.plots)) if (plot.crop && isRipe(plot.crop)) ripe[plot.crop.id] = (ripe[plot.crop.id] ?? 0) + 1;
  const ripeCount = Object.values(ripe).reduce((a, b) => a + b, 0);
  if (ripeCount) {
    const kinds = Object.entries(ripe).map(([id, n]) => `${n} ${crop(id).name}`).join(', ');
    out.push({ id: 'ripe', icon: '🍓', short: `${ripeCount} ripe`, detail: `Ripe and ready to pick: ${kinds}.` });
  }

  const done = Object.keys(world.machines).filter((key) => isDone(world, key)).map((key) => world.machines[key]!);
  if (done.length) {
    const lines = done.map((m) => `${item(m.id).name}: ${m.count > 1 ? `${m.count} ` : ''}${item(m.output!).name}`).join(', ');
    out.push({ id: 'machines', icon: '⚙', short: `${done.length} ready`, detail: `Finished and waiting: ${lines}.` });
  }

  const produce = Object.entries(world.barn.output);
  if (produce.length) {
    const n = produce.reduce((a, [, c]) => a + c, 0);
    out.push({ id: 'barn', icon: '🥛', short: 'Barn', detail: `${plural(n, 'thing')} to collect at the barn: ${produce.map(([id, c]) => `${c} ${item(id).name}`).join(', ')}.` });
  }

  const sowers = [...partyMons(world), ...farmMons(world)].some((m) => species(m.dex).job === 'sow');
  const emptyPlots = Object.values(world.plots).filter((p) => !p.crop).length;
  if (sowers && emptyPlots && !seedBoxCount(world)) {
    out.push({ id: 'seedbox', icon: '🌱', short: 'Seed Box empty', detail: `The Seed Box is empty, and ${plural(emptyPlots, 'plot')} could be sown. Stock it so your Ground-type Pokémon can plant them.` });
  }

  const residents = farmMons(world).length;
  if (residents && !troughCount(world)) {
    out.push({ id: 'trough', icon: '🪣', short: 'Trough empty', detail: `The barn trough is empty: ${plural(residents, 'Pokémon')} will go to bed hungry and work at half pace tomorrow.` });
  }

  const due = world.requests.filter((r) => r.due === world.day);
  if (due.length) {
    out.push({ id: 'requests', icon: '📋', short: `${due.length} due today`, detail: `Due today on the request board: ${due.map((r) => `${r.count} ${item(r.item).name}`).join(', ')}.` });
  }
  return out;
}

/** The chip's text: the first few entries, or '' when all's well. */
export function statusLine(entries: readonly StatusEntry[], max = 3): string {
  return entries.slice(0, max).map((e) => `${e.icon} ${e.short}`).join(' · ') + (entries.length > max ? ' · …' : '');
}
