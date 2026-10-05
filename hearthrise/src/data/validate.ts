import { BUILDING, BUILDINGS } from './buildings';
import { DISTRICTS, GRID_H, GRID_W } from './districts';
import { DISTRICT_TEXT, FLAGS } from './flags';
import { MATERIALS, MATERIAL } from './materials';
import { STORY } from './missions';
import { EDICTS, UPGRADES } from './progression';
import { CRAFT, FIXTURES, REFINE } from './recipes';
import { REGALIA } from './regalia';
import type { Feature, Requirement } from './types';

/**
 * Checks the content graph without running the game: every reference
 * resolves, every material can be had, every building fits and can be paid
 * for when it unlocks, and nothing asks for a material before the player
 * could have it. Returns a list of problems; empty is good.
 */
export function validateData(): string[] {
  const errors: string[] = [];
  const dupes = (ids: string[], what: string): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${what} id ${id}`);
      seen.add(id);
    }
  };
  dupes(MATERIALS.map((m) => m.id), 'material');
  dupes(REGALIA.map((g) => g.id), 'regalia');
  dupes([...REFINE, ...CRAFT].map((r) => r.id), 'recipe');
  dupes(STORY.map((m) => m.id), 'mission');
  dupes(BUILDINGS.map((b) => b.id), 'building');

  // The ward the story has certainly reached by each mission: the highest
  // ward goal at or before it. A mission requirement means "this far in".
  const storyWard = new Map<string, number>();
  let reached = 1;
  for (const m of STORY) {
    if (m.goal.kind === 'ward') reached = Math.max(reached, m.goal.n);
    storyWard.set(m.id, reached);
  }
  const reqWard = (r: Requirement, what: string): number => {
    if ('ward' in r) return r.ward;
    if ('fixture' in r) {
      // A fixture-gated thing unlocks once the fixture can be made.
      const recipe = CRAFT.find((c) => c.output.kind === 'fixture' && c.output.id === r.fixture);
      if (!recipe) {
        errors.push(`${what} requires fixture ${r.fixture}, which has no recipe`);
        return 0;
      }
      return reqWard(recipe.requires, recipe.id);
    }
    const w = storyWard.get(r.mission);
    if (w === undefined) {
      errors.push(`${what} requires unknown mission ${r.mission}`);
      return 0;
    }
    return w;
  };

  // The first ward each material can be had at.
  const firstWard = new Map<string, number>();
  for (const d of DISTRICTS) {
    for (const id of [...d.salvage.map((o) => o.id), ...d.relics, d.heart]) {
      if (!MATERIAL.has(id)) errors.push(`district ${d.id} references unknown material ${id}`);
      if (!firstWard.has(id)) firstWard.set(id, d.from);
    }
  }
  for (const r of REFINE) {
    if (MATERIAL.get(r.output)?.kind !== 'good') errors.push(`refine ${r.id} makes ${r.output}, which is not a good`);
    let need = reqWard(r.requires, `refine ${r.id}`);
    for (const x of r.inputs) {
      const at = firstWard.get(x.id);
      if (at === undefined) errors.push(`refine ${r.id} needs ${x.id}, which is never salvaged`);
      else need = Math.max(need, at);
    }
    if (need > reqWard(r.requires, r.id)) errors.push(`refine ${r.id} unlocks at ward ${reqWard(r.requires, r.id)} but its salvage only appears at ${need}`);
    firstWard.set(r.output, Math.min(firstWard.get(r.output) ?? Infinity, need));
  }
  for (const m of MATERIALS) if (!firstWard.has(m.id)) errors.push(`material ${m.id} can never be had`);

  const available = (id: string, ward: number, what: string): void => {
    const at = firstWard.get(id);
    if (at === undefined) errors.push(`${what} needs ${id}, which cannot be had`);
    else if (at > ward) errors.push(`${what} unlocks at ward ${ward} but ${id} first appears at ${at}`);
  };

  for (const r of CRAFT) {
    const w = reqWard(r.requires, `craft ${r.id}`);
    for (const x of r.inputs) available(x.id, w, `craft ${r.id}`);
    if (r.output.kind === 'regalia' && !REGALIA.some((g) => r.output.kind === 'regalia' && g.id === r.output.base)) {
      errors.push(`craft ${r.id} makes unknown regalia ${r.output.base}`);
    }
    if (r.output.kind === 'fixture' && !FIXTURES.some((f) => r.output.kind === 'fixture' && f.id === r.output.id)) {
      errors.push(`craft ${r.id} makes unknown fixture ${r.output.id}`);
    }
  }
  for (const g of REGALIA) {
    if (!MATERIAL.has(g.tint)) errors.push(`regalia ${g.id} is tinted by unknown ${g.tint}`);
    if (!CRAFT.some((r) => r.output.kind === 'regalia' && r.output.base === g.id)) errors.push(`regalia ${g.id} has no recipe`);
  }
  for (const f of FIXTURES) if (!CRAFT.some((r) => r.output.kind === 'fixture' && r.output.id === f.id)) errors.push(`fixture ${f.id} has no recipe`);

  for (const b of BUILDINGS) {
    const w = reqWard(b.requires, `building ${b.id}`);
    for (const x of b.inputs) available(x.id, w, `building ${b.id}`);
    if (b.w < 1 || b.h < 1 || b.w > GRID_W || b.h > GRID_H) errors.push(`building ${b.id} does not fit a ${GRID_W}×${GRID_H} grid`);
    const output = b.pop ?? b.dps ?? b.tax ?? b.slots ?? b.cheer;
    if (b.tag !== 'green' && !output) errors.push(`building ${b.id} (${b.tag}) does nothing`);
    if (b.tag === 'green' && b.maxLevel !== 1) errors.push(`green space ${b.id} should have one level`);
  }

  // Every feature switched on by some mission, before anything needs it.
  const unlockedAt = new Map<Feature, number>();
  STORY.forEach((m, i) => {
    for (const f of m.reward.unlock ?? []) if (!unlockedAt.has(f)) unlockedAt.set(f, i);
  });
  const allFeatures: Feature[] = ['upgrades', 'build', 'crews', 'founder', 'workshops', 'drafting', 'rush', 'survey', 'festival', 'passives', 'petitions', 'tide'];
  for (const f of allFeatures) if (!unlockedAt.has(f)) errors.push(`feature ${f} is never unlocked`);

  // Mission goals: references resolve, and nothing is asked before it can be done.
  let ward = 1;
  STORY.forEach((m, i) => {
    const g = m.goal;
    const before = (f: Feature): void => {
      const at = unlockedAt.get(f);
      if (at === undefined || at >= i) errors.push(`mission ${m.id} needs ${f}, unlocked ${at === undefined ? 'never' : `by mission ${at}`}`);
    };
    switch (g.kind) {
      case 'salvage': available(g.id, ward, `mission ${m.id}`); break;
      case 'upgrade':
        if (!UPGRADES.some((u) => u.id === g.id)) errors.push(`mission ${m.id} upgrades unknown ${g.id}`);
        before('upgrades');
        break;
      case 'build': {
        const def = BUILDING.get(g.id);
        if (!def) errors.push(`mission ${m.id} builds unknown ${g.id}`);
        else if (reqWard(def.requires, g.id) > ward) errors.push(`mission ${m.id} wants ${g.id}, which needs ward ${reqWard(def.requires, g.id)}`);
        else if ('mission' in def.requires && STORY.findIndex((x) => x.id === (def.requires as { mission: string }).mission) >= i) {
          errors.push(`mission ${m.id} wants ${g.id} before it unlocks`);
        }
        before('build');
        break;
      }
      case 'craft':
        if (g.recipe) {
          const r = CRAFT.find((c) => c.id === g.recipe);
          if (!r) errors.push(`mission ${m.id} crafts unknown ${g.recipe}`);
          else if (reqWard(r.requires, r.id) > ward) errors.push(`mission ${m.id} wants ${r.id}, which needs ward ${reqWard(r.requires, r.id)}`);
        }
        before('drafting');
        break;
      case 'fixture': {
        const r = CRAFT.find((c) => c.output.kind === 'fixture' && c.output.id === g.id);
        if (!r) errors.push(`mission ${m.id} wants fixture ${g.id}, which has no recipe`);
        else if (reqWard(r.requires, r.id) > ward) errors.push(`mission ${m.id} wants ${g.id}, which needs ward ${reqWard(r.requires, r.id)}`);
        before('drafting');
        break;
      }
      case 'refine':
        if (g.good) available(g.good, ward, `mission ${m.id}`);
        before('workshops');
        break;
      case 'edict':
        if (g.edict && !EDICTS.some((k) => k.id === g.edict)) errors.push(`mission ${m.id} uses unknown edict ${g.edict}`);
        before((g.edict ?? 'rush') as Feature);
        break;
      case 'stats': before('founder'); break;
      case 'tide': before('tide'); break;
      case 'memories': before('tide'); break;
      default: break;
    }
    if (g.kind === 'ward') ward = Math.max(ward, g.n);
    if (m.reward.flag && !(FLAGS as readonly string[]).includes(m.reward.flag)) errors.push(`mission ${m.id} sets unlisted flag ${m.reward.flag}`);
    for (const o of m.choice?.options ?? []) if (!(FLAGS as readonly string[]).includes(o.flag)) errors.push(`mission ${m.id} choice sets unlisted flag ${o.flag}`);
    for (const it of m.reward.items ?? []) if (!MATERIAL.has(it.id)) errors.push(`mission ${m.id} rewards unknown ${it.id}`);
  });
  for (const t of DISTRICT_TEXT) if (!DISTRICTS.some((d) => d.id === t.district)) errors.push(`district text for unknown ${t.district}`);

  return errors;
}
