import { BIOMES, FAUNA_DEF } from './biomes';
import { CLASS } from './crew';
import { ENEMY, ENEMIES } from './enemies';
import { EVENTS } from './events';
import { GEAR, GEAR_DEF } from './gear';
import { CONSUMABLE, MAT } from './materials';
import { MODULES } from './modules';
import { RECIPES } from './recipes';
import { SECTORS } from './sectors';
import { SKILL, SKILLS } from './skills';
import { STORY } from './story';
import type { Bundle, Choice, Outcome } from './types';

/**
 * The content gate. Returns a list of problems; an empty list means every
 * reference resolves, every flag a choice needs can be set somewhere, and no
 * event can leave the player without a choice they can take.
 */
export function validate(): string[] {
  const errs: string[] = [];
  const bundle = (where: string, b: Bundle | undefined): void => {
    for (const k of Object.keys(b ?? {})) if (!MAT.has(k as never)) errs.push(`${where}: unknown material ${k}`);
  };
  const flagsSet = new Set<string>();
  const outcomes: [string, Outcome][] = [];
  const choices: [string, Choice][] = [];
  for (const e of EVENTS) for (const c of e.choices) {
    choices.push([e.id, c]);
    outcomes.push([e.id, c.ok]);
    if (c.fail) outcomes.push([e.id, c.fail]);
  }
  for (const m of STORY) {
    if (m.flag) flagsSet.add(m.flag);
    outcomes.push([m.id, m.reward]);
    for (const c of m.choices ?? []) {
      choices.push([m.id, c]);
      outcomes.push([m.id, c.ok]);
      if (c.fail) outcomes.push([m.id, c.fail]);
    }
  }
  for (const [, o] of outcomes) if (o.flag) flagsSet.add(o.flag);
  for (const r of RECIPES) if (r.flag) flagsSet.has(r.flag) || errs.push(`recipe ${r.id}: flag ${r.flag} is never set`);

  for (const [where, o] of outcomes) {
    bundle(where, o.mats);
    for (const k of Object.keys(o.items ?? {})) if (!CONSUMABLE.has(k as never)) errs.push(`${where}: unknown item ${k}`);
    if (o.combat && o.combat !== '@sector' && !ENEMY.has(o.combat)) errs.push(`${where}: unknown enemy ${o.combat}`);
    if (o.recruit && o.recruit !== 'any' && !CLASS.has(o.recruit)) errs.push(`${where}: unknown class ${o.recruit}`);
  }
  for (const [where, c] of choices) {
    bundle(where, c.req?.mats);
    if (c.req?.flag && !flagsSet.has(c.req.flag)) errs.push(`${where}: choice needs flag ${c.req.flag}, which nothing sets`);
    if (c.check && (c.check.dc < 1 || c.check.dc > 15)) errs.push(`${where}: odd DC ${c.check.dc}`);
    if (c.pay && !c.req) errs.push(`${where}: "${c.label}" pays but has no requirement`);
  }
  // Every event needs a way out that asks for nothing.
  for (const e of EVENTS) {
    if (!e.choices.some((c) => !c.req)) errs.push(`event ${e.id}: every choice has a requirement — the player could be stuck`);
    if (!e.kinds.length) errs.push(`event ${e.id}: appears nowhere`);
  }
  for (const m of STORY) {
    if (m.choices && !m.choices.some((c) => !c.req)) errs.push(`story ${m.id}: every choice has a requirement`);
  }

  // Story shape.
  for (const sec of SECTORS) {
    const ms = STORY.filter((m) => m.sector === sec.index);
    if (ms.length !== 6) errs.push(`sector ${sec.index}: ${ms.length} missions, expected 6`);
    if (ms[ms.length - 1]?.objective.k !== 'gate') errs.push(`sector ${sec.index}: last mission is not the gate`);
    const boss = ms.find((m) => m.objective.k === 'defeat');
    if (!boss || boss.objective.k !== 'defeat' || boss.objective.enemy !== sec.boss) errs.push(`sector ${sec.index}: boss mission does not match ${sec.boss}`);
    for (const e of [...sec.enemies, sec.boss]) if (!ENEMY.has(e)) errs.push(`sector ${sec.index}: unknown enemy ${e}`);
    for (const b of sec.biomes) if (!BIOMES.some((x) => x.id === b)) errs.push(`sector ${sec.index}: unknown biome ${b}`);
    for (const m of ms) if (m.objective.k === 'deliver') bundle(m.id, m.objective.mats);
  }
  let need = 0;
  for (const m of STORY) {
    if (m.objective.k !== 'rescue') continue;
    if (m.objective.colonists <= need) errs.push(`story ${m.id}: rescue target does not grow`);
    need = m.objective.colonists;
  }
  for (const e of ENEMIES) if (e.boss !== e.id.startsWith('boss-')) errs.push(`enemy ${e.id}: boss flag and id disagree`);

  // Items, gear, recipes, modules.
  for (const r of RECIPES) {
    bundle(r.id, r.cost);
    if ('gear' in r.out && !GEAR_DEF.has(r.out.gear)) errs.push(`recipe ${r.id}: unknown gear`);
    if ('item' in r.out && !CONSUMABLE.has(r.out.item)) errs.push(`recipe ${r.id}: unknown item`);
    if (r.fab < 1 || r.fab > 4) errs.push(`recipe ${r.id}: fabricator tier ${r.fab}`);
  }
  for (const slot of ['weapon', 'suit', 'tool', 'module'] as const) {
    for (let t = 1; t <= 6; t++) if (!GEAR.some((g) => g.slot === slot && g.tier === t)) errs.push(`gear: no ${slot} at tier ${t}`);
  }
  for (const m of MODULES) {
    if (m.tiers.length !== 4) errs.push(`module ${m.id}: ${m.tiers.length} tiers`);
    for (const t of m.tiers) bundle(m.id, t.cost);
  }
  for (const s of SKILLS) {
    if (s.req) {
      const r = SKILL.get(s.req);
      if (!r) errs.push(`skill ${s.id}: unknown requirement`);
      else if (r.cls !== s.cls || r.level >= s.level) errs.push(`skill ${s.id}: requirement out of order`);
    }
  }
  for (const b of BIOMES) for (const f of b.fauna) if (!FAUNA_DEF.has(f)) errs.push(`biome ${b.id}: unknown fauna ${f}`);
  return errs;
}
