import { BIOMES } from './biomes';
import { BARGAINS, BIOME_TEXT, FLAGS } from './flags';
import { GEAR } from './gear';
import { MATERIALS, MATERIAL } from './materials';
import { STORY } from './missions';
import { MACHINES, UPGRADES } from './progression';
import { CRAFT, REFINE } from './recipes';
import type { Feature, Requirement } from './types';

/**
 * Checks the content graph without running the game: every reference
 * resolves, every material can be obtained, and nothing asks for a material
 * before the player could have it. Returns a list of problems; empty is good.
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
  dupes(GEAR.map((g) => g.id), 'gear');
  dupes([...REFINE, ...CRAFT].map((r) => r.id), 'recipe');
  dupes(STORY.map((m) => m.id), 'mission');

  // The first depth each material can be had at.
  const firstDepth = new Map<string, number>();
  for (const b of BIOMES) {
    for (const id of [...b.ores.map((o) => o.id), ...b.gems, b.essence]) {
      if (!MATERIAL.has(id)) errors.push(`biome ${b.id} references unknown material ${id}`);
      if (!firstDepth.has(id)) firstDepth.set(id, b.from);
    }
  }
  const reqDepth = (r: Requirement): number => ('depth' in r ? r.depth : 0);
  for (const r of REFINE) {
    if (!MATERIAL.has(r.output)) errors.push(`refine ${r.id} makes unknown ${r.output}`);
    let need = reqDepth(r.requires);
    for (const x of r.inputs) {
      const at = firstDepth.get(x.id);
      if (at === undefined) errors.push(`refine ${r.id} needs ${x.id}, which is never mined`);
      else need = Math.max(need, at);
    }
    if (need > reqDepth(r.requires)) errors.push(`refine ${r.id} unlocks at ${reqDepth(r.requires)} but its ore only appears at ${need}`);
    firstDepth.set(r.output, Math.min(firstDepth.get(r.output) ?? Infinity, need));
  }
  for (const m of MATERIALS) if (!firstDepth.has(m.id)) errors.push(`material ${m.id} can never be obtained`);

  for (const r of CRAFT) {
    for (const x of r.inputs) {
      const at = firstDepth.get(x.id);
      if (at === undefined) errors.push(`craft ${r.id} needs ${x.id}, which cannot be obtained`);
      else if (at > reqDepth(r.requires)) errors.push(`craft ${r.id} unlocks at ${reqDepth(r.requires)} but ${x.id} first appears at ${at}`);
    }
    if (r.output.kind === 'gear' && !GEAR.some((g) => r.output.kind === 'gear' && g.id === r.output.base)) {
      errors.push(`craft ${r.id} makes unknown gear ${r.output.base}`);
    }
  }
  for (const g of GEAR) {
    if (!MATERIAL.has(g.tint)) errors.push(`gear ${g.id} tinted by unknown ${g.tint}`);
    if (!CRAFT.some((r) => r.output.kind === 'gear' && r.output.base === g.id)) errors.push(`gear ${g.id} has no recipe`);
  }

  // Features: every one some mission unlocks, before anything needs it.
  const unlockedAt = new Map<Feature, number>();
  STORY.forEach((m, i) => {
    for (const f of m.reward.unlock ?? []) if (!unlockedAt.has(f)) unlockedAt.set(f, i);
  });
  for (const u of UPGRADES) if (u.requires && !unlockedAt.has(u.requires)) errors.push(`upgrade ${u.id} needs ${u.requires}, never unlocked`);
  for (const m of MACHINES) if (!unlockedAt.has(m.requires)) errors.push(`machine ${m.id} needs ${m.requires}, never unlocked`);

  STORY.forEach((m, i) => {
    const g = m.goal;
    const before = (f: Feature): void => {
      const at = unlockedAt.get(f);
      if (at === undefined || at >= i) errors.push(`mission ${m.id} needs ${f}, not unlocked before it`);
    };
    switch (g.kind) {
      case 'mine':
        if (!firstDepth.has(g.ore)) errors.push(`mission ${m.id} wants unknown ore ${g.ore}`);
        break;
      case 'upgrade':
        if (!UPGRADES.some((u) => u.id === g.id)) errors.push(`mission ${m.id} wants unknown upgrade ${g.id}`);
        before('upgrades');
        break;
      case 'own': {
        const mach = MACHINES.find((x) => x.id === g.id);
        if (!mach) errors.push(`mission ${m.id} wants unknown machine ${g.id}`);
        else before(mach.requires);
        break;
      }
      case 'craft':
        before('workbench');
        if (g.recipe && !CRAFT.some((r) => r.id === g.recipe)) errors.push(`mission ${m.id} wants unknown recipe ${g.recipe}`);
        break;
      case 'fixture':
        before('workbench');
        if (!CRAFT.some((r) => r.output.kind === 'fixture' && r.output.id === g.id)) errors.push(`mission ${m.id} wants unbuildable fixture ${g.id}`);
        break;
      case 'refine':
        before('refinery');
        break;
      case 'skill':
        if (g.skill) before(g.skill as Feature);
        break;
      case 'stats':
        before('miner');
        break;
      case 'descend':
      case 'echoes':
        before('descent');
        break;
      case 'bargain':
        before('bargains');
        if (g.n > BARGAINS.length) errors.push(`mission ${m.id} wants ${g.n} bargains, only ${BARGAINS.length} exist`);
        break;
      case 'visit':
        if (g.depth < 1) errors.push(`mission ${m.id} visits depth ${g.depth}`);
        break;
      default:
        break;
    }
  });
  // Story flags: every one set must be a known flag, and every known flag set somewhere.
  const known = new Set<string>(FLAGS);
  const set = new Set<string>();
  for (const m of STORY) {
    const flags = [m.reward.flag, ...(m.choice?.options.map((o) => o.flag) ?? []), ...(m.sceneIf?.map((v) => v.flag) ?? [])];
    for (const f of flags) {
      if (!f) continue;
      if (!known.has(f)) errors.push(`mission ${m.id} uses unknown flag ${f}`);
      if (f === m.reward.flag || m.choice?.options.some((o) => o.flag === f)) set.add(f);
    }
  }
  for (const f of FLAGS) if (!set.has(f)) errors.push(`flag ${f} is never set by any mission`);
  for (const t of BIOME_TEXT) if (!BIOMES.some((b) => b.id === t.biome)) errors.push(`biome text for unknown biome ${t.biome}`);
  return errors;
}
