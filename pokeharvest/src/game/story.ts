/**
 * The story's progress: which chapter you're on, how far along each goal
 * is, and what finishing a chapter does. Dialogue is announced through
 * `story` events, which the UI plays.
 */
import { CHAPTERS, type Chapter, type Objective } from '../data/story';
import { ITEMS, item } from '../data/items';
import type { MapId } from '../data/maps';
import { TRAINERS } from '../data/people';
import { reputationLevel } from '../data/ranch';
import { giveItem, takeItem } from './farm';
import type { World } from './model';

export function hasFlag(world: World, flag: string): boolean {
  return world.story.flags.includes(flag);
}

function setFlag(world: World, flag: string): void {
  if (!hasFlag(world, flag)) world.story.flags.push(flag);
}

export function currentChapter(world: World): Chapter | null {
  return CHAPTERS[world.story.chapter] ?? null;
}

const MAP_NAMES: Partial<Record<MapId, string>> = { town: 'Cobblevale Town', route2: 'Whisperwood', route3: 'Granite Pass' };

/** How far along a goal is, and how to describe it. */
export function progress(world: World, o: Objective): { have: number; need: number; text: string } {
  const delivered = world.story.delivered;
  switch (o.kind) {
    case 'ship': return { have: world.stats.shippedBerries, need: o.count, text: 'Ship berries' };
    case 'befriend': return { have: world.caught.length, need: o.count, text: 'Befriend kinds of Pokémon' };
    case 'visit': return { have: hasFlag(world, `visited:${o.map}`) ? 1 : 0, need: 1, text: `Visit ${MAP_NAMES[o.map] ?? o.map}` };
    case 'deliver': return { have: delivered[o.item] ?? 0, need: o.count, text: `Bring ${item(o.item).name} to the Mayor` };
    case 'deliverKind': return { have: delivered[`kind:${o.itemKind}`] ?? 0, need: o.count, text: o.itemKind === 'crop' ? 'Bring berries to the Mayor' : 'Bring juice, jam, cheese or cloth to the festival' };
    case 'trainers': return { have: TRAINERS.filter((t) => t.map === o.map && world.trainers[t.id]).length, need: o.count, text: `Beat trainers in ${MAP_NAMES[o.map] ?? o.map}` };
    case 'apricorns': return { have: world.stats.apricorns, need: o.count, text: 'Pick Apricorns' };
    case 'place': return { have: Object.values(world.machines).some((m) => m.id === o.machine) ? 1 : 0, need: 1, text: `Build a ${item(o.machine).name} on the farm` };
    case 'smelt': return { have: world.stats.smelted[o.bar] ?? 0, need: 1, text: `Smelt a ${item(o.bar).name}` };
    case 'toolTier': return { have: Math.max(world.tools.hoe, world.tools.can), need: o.tier, text: 'Upgrade a tool to Steel' };
    case 'reputation': return { have: reputationLevel(world.reputation), need: o.level, text: 'Reach reputation level' };
    case 'beatKai': return { have: world.trainers.kai ? 1 : 0, need: 1, text: 'Beat Kai at the festival' };
  }
}

export function chapterDone(world: World, chapter: Chapter): boolean {
  return chapter.objectives.every((o) => {
    const p = progress(world, o);
    return p.have >= p.need;
  });
}

/** The goal to show in the tracker: the first one not yet met. */
export function nextGoal(world: World): { have: number; need: number; text: string } | null {
  const chapter = currentChapter(world);
  if (!chapter) return null;
  for (const o of chapter.objectives) {
    const p = progress(world, o);
    if (p.have < p.need) return p;
  }
  return null;
}

function play(world: World, beat: string): void {
  if (world.story.seen.includes(beat)) return;
  world.story.seen.push(beat);
  world.events.push({ kind: 'story', beat });
}

/** Whether a chapter's opening waits for you to arrive somewhere. */
function opensOnVisit(chapter: Chapter): MapId | null {
  const visit = chapter.objectives.find((o) => o.kind === 'visit');
  return visit?.kind === 'visit' ? visit.map : null;
}

/** Finish the current chapter if its goals are met: its reward, its flag, and on to the next. */
export function checkStory(world: World, quiet = false): boolean {
  let advanced = false;
  for (let chapter = currentChapter(world); chapter && chapterDone(world, chapter); chapter = currentChapter(world)) {
    setFlag(world, chapter.flag);
    if (chapter.gold) world.player.gold += chapter.gold;
    for (const [id, n] of Object.entries(chapter.items ?? {})) giveItem(world, id, n);
    world.story.chapter += 1;
    world.story.delivered = {};
    advanced = true;
    if (quiet) continue;
    play(world, chapter.end);
    world.events.push({ kind: 'chapter', chapter: world.story.chapter });
    const next = currentChapter(world);
    if (next && !opensOnVisit(next)) play(world, next.start);
  }
  return advanced;
}

/** Arriving somewhere for the first time. */
export function visit(world: World, map: MapId): void {
  setFlag(world, `visited:${map}`);
  const chapter = currentChapter(world);
  if (chapter && opensOnVisit(chapter) === map) play(world, chapter.start);
  checkStory(world);
}

/** Hand the Mayor what the current chapter asks for, as far as your bag allows. Returns what was given. */
export function deliverToMayor(world: World): Record<string, number> {
  const given: Record<string, number> = {};
  const chapter = currentChapter(world);
  if (!chapter) return given;
  const d = world.story.delivered;
  for (const o of chapter.objectives) {
    if (o.kind === 'deliver') {
      const n = Math.min(o.count - (d[o.item] ?? 0), world.inventory[o.item] ?? 0);
      if (n > 0 && takeItem(world, o.item, n)) {
        d[o.item] = (d[o.item] ?? 0) + n;
        given[o.item] = (given[o.item] ?? 0) + n;
      }
    } else if (o.kind === 'deliverKind') {
      const key = `kind:${o.itemKind}`;
      // Give whatever of that kind you have most of first.
      const ids = Object.keys(world.inventory).filter((id) => ITEMS.get(id)?.kind === o.itemKind).sort((a, b) => world.inventory[b]! - world.inventory[a]!);
      for (const id of ids) {
        const n = Math.min(o.count - (d[key] ?? 0), world.inventory[id] ?? 0);
        if (n <= 0) break;
        takeItem(world, id, n);
        d[key] = (d[key] ?? 0) + n;
        given[id] = (given[id] ?? 0) + n;
      }
    }
  }
  checkStory(world);
  return given;
}

/** Whether the Mayor is waiting on something you could hand over now. */
export function canDeliverToMayor(world: World): boolean {
  const chapter = currentChapter(world);
  if (!chapter) return false;
  return chapter.objectives.some((o) => {
    if (o.kind === 'deliver') return (world.story.delivered[o.item] ?? 0) < o.count && (world.inventory[o.item] ?? 0) > 0;
    if (o.kind === 'deliverKind') return (world.story.delivered[`kind:${o.itemKind}`] ?? 0) < o.count && Object.keys(world.inventory).some((id) => ITEMS.get(id)?.kind === o.itemKind);
    return false;
  });
}

/** The festival battle is on once the goods are in. */
export function kaiReady(world: World): boolean {
  const chapter = currentChapter(world);
  if (!chapter) return hasFlag(world, 'story-done');
  if (!chapter.objectives.some((o) => o.kind === 'beatKai')) return false;
  return chapter.objectives.filter((o) => o.kind !== 'beatKai').every((o) => {
    const p = progress(world, o);
    return p.have >= p.need;
  });
}

/** A new farm: the story begins. */
export function beginStory(world: World): void {
  play(world, CHAPTERS[0]!.start);
}

/**
 * A farm from before the story existed: catch it up, silently, to the
 * furthest chapter whose goals it already meets. A farm already past the
 * first chapter gets a Workbench too, since its machines are already up.
 */
export function catchUpStory(world: World): void {
  const legacyShipped = world.stats.shippedBerries || Math.min(10, world.stats.harvested);
  world.stats.shippedBerries = legacyShipped;
  checkStory(world, true);
  for (const beat of CHAPTERS.slice(0, world.story.chapter).flatMap((c) => [c.start, c.end])) {
    if (!world.story.seen.includes(beat)) world.story.seen.push(beat);
  }
}
