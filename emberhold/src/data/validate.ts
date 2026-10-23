/**
 * The content gate. Every reference resolves, every recipe's inputs can be
 * got somewhere, and every icon has art.
 */
import { AREAS, MONSTERS, SPELLS } from './combat';
import { ITEM, ITEMS, PALETTE } from './items';
import { GUILDS, PETS, QUESTS, SHOP } from './meta';
import { ACTIONS } from './skills';
import { ANIMALS, BUILDINGS, FARM_CROPS, OBSTACLES, POIS } from './special';
import type { Requirement } from './types';

/** Every way an item can come into the bank. */
export function sources(): Map<string, string[]> {
  const src = new Map<string, string[]>();
  const add = (item: string, from: string): void => {
    if (!src.has(item)) src.set(item, []);
    src.get(item)!.push(from);
  };
  for (const a of ACTIONS) {
    for (const o of a.outputs) add(o.item, a.id);
    for (const l of a.loot?.entries ?? []) add(l.item, a.id);
  }
  for (const m of MONSTERS) {
    for (const l of m.loot.entries) add(l.item, m.id);
    if (m.bones) add(m.bones, m.id);
  }
  for (const a of AREAS) for (const r of a.reward ?? []) add(r.item, a.id);
  for (const it of ITEMS) for (const l of it.opens?.entries ?? []) add(l.item, it.id);
  for (const c of FARM_CROPS) {
    add(c.product, `farm:${c.seed}`);
    if (c.kind !== 'tree') add(c.seed, `farm:${c.seed}`);
  }
  for (const a of ANIMALS) for (const p of a.produce) add(p.item, `ranch:${a.id}`);
  for (const b of BUILDINGS) for (const p of b.produces ?? []) add(p.item, `build:${b.id}`);
  for (const e of SHOP) if ('item' in e.gives) add(e.gives.item, `shop:${e.id}`);
  for (const q of QUESTS) for (const i of q.rewards.items ?? []) add(i.item, `quest:${q.id}`);
  for (const p of POIS) for (const i of p.reward.items ?? []) add(i.item, `poi:${p.id}`);
  return src;
}

export function iconTemplate(icon: string): [string, string] {
  const dot = icon.indexOf('.');
  return [icon.slice(0, dot), icon.slice(dot + 1)];
}

export function validateData(templates?: Set<string>): string[] {
  const errors: string[] = [];
  const has = (id: string, where: string): void => {
    if (!ITEM.has(id)) errors.push(`${where}: unknown item "${id}"`);
  };
  const ids = new Set<string>();
  for (const it of ITEMS) {
    if (ids.has(it.id)) errors.push(`duplicate item id "${it.id}"`);
    ids.add(it.id);
  }
  for (const a of ACTIONS) {
    for (const q of [...a.inputs, ...a.outputs]) has(q.item, a.id);
    for (const l of a.loot?.entries ?? []) has(l.item, a.id);
  }
  for (const m of MONSTERS) {
    for (const l of m.loot.entries) has(l.item, m.id);
    if (m.bones) has(m.bones, m.id);
  }
  const monsterIds = new Set(MONSTERS.map((m) => m.id));
  for (const a of AREAS) {
    for (const m of a.monsters) if (!monsterIds.has(m)) errors.push(`${a.id}: unknown monster "${m}"`);
    if (a.needsWorn) has(a.needsWorn, a.id);
    for (const r of a.reward ?? []) has(r.item, a.id);
    checkReqs(a.req, a.id, errors);
  }
  for (const it of ITEMS) for (const l of it.opens?.entries ?? []) has(l.item, it.id);
  for (const s of SPELLS) for (const r of s.runes) has(r.item, s.id);
  for (const c of FARM_CROPS) {
    has(c.seed, 'farming');
    has(c.product, 'farming');
  }
  for (const o of OBSTACLES) for (const q of o.cost.items) has(q.item, o.id);
  for (const b of BUILDINGS) for (const q of [...b.cost, ...(b.produces ?? [])]) has(q.item, b.id);
  for (const a of ANIMALS) {
    if (a.feed) has(a.feed, a.id);
    for (const p of a.produce) has(p.item, a.id);
  }
  for (const e of SHOP) if ('item' in e.gives) has(e.gives.item, e.id);
  for (const q of QUESTS) {
    for (const st of q.steps) {
      if (st.kind === 'item') has(st.target, q.id);
      if (st.kind === 'kill' && !monsterIds.has(st.target)) errors.push(`${q.id}: unknown monster "${st.target}"`);
      if (st.kind === 'clear' && !AREAS.some((a) => a.id === st.target)) errors.push(`${q.id}: unknown area "${st.target}"`);
    }
    for (const i of q.rewards.items ?? []) has(i.item, q.id);
  }
  for (const p of PETS) if ('area' in p.source && !AREAS.some((a) => a.id === (p.source as { area: string }).area)) errors.push(`${p.id}: unknown area`);
  for (const g of GUILDS) {
    for (const t of g.tasks) {
      if (t.counter.startsWith('kill:') && !monsterIds.has(t.counter.slice(5))) errors.push(`${t.id}: unknown monster`);
    }
  }

  // Reachability: every input and every needed item has at least one source.
  const src = sources();
  const needed = new Set<string>();
  for (const a of ACTIONS) for (const q of a.inputs) needed.add(q.item);
  for (const o of OBSTACLES) for (const q of o.cost.items) needed.add(q.item);
  for (const b of BUILDINGS) for (const q of b.cost) needed.add(q.item);
  for (const a of ANIMALS) if (a.feed) needed.add(a.feed);
  for (const q of QUESTS) for (const st of q.steps) if (st.kind === 'item') needed.add(st.target);
  for (const s of SPELLS) for (const r of s.runes) needed.add(r.item);
  for (const a of AREAS) if (a.needsWorn) needed.add(a.needsWorn);
  for (const n of needed) if (!src.has(n)) errors.push(`nothing produces "${n}", but something needs it`);

  // Art: every icon is template.palette with a known palette (and template, when given).
  const icons = new Set<string>([...ITEMS.map((i) => i.icon), ...MONSTERS.map((m) => m.icon), ...AREAS.map((a) => a.icon), ...ACTIONS.map((a) => a.icon), ...SHOP.map((e) => e.icon)]);
  for (const icon of icons) {
    const [tpl, pal] = iconTemplate(icon);
    if (!tpl || !pal) errors.push(`bad icon "${icon}"`);
    else if (!PALETTE[pal] && tpl !== 'ui') errors.push(`icon "${icon}": no palette "${pal}"`);
    else if (templates && !templates.has(tpl)) errors.push(`icon "${icon}": no template "${tpl}"`);
  }
  return errors;
}

function checkReqs(reqs: Requirement[] | undefined, where: string, errors: string[]): void {
  for (const r of reqs ?? []) {
    if (r.kind === 'quest' && !QUESTS.some((q) => q.id === r.quest)) errors.push(`${where}: unknown quest "${r.quest}"`);
    if (r.kind === 'dungeon' && !AREAS.some((a) => a.id === r.dungeon)) errors.push(`${where}: unknown dungeon "${r.dungeon}"`);
  }
}
