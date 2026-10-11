import { SECTORS } from '../data/sectors';
import { STORY, STORY_BY_ID } from '../data/story';
import type { StoryDef } from '../data/types';
import type { GameState, MapNode } from '../state/types';
import { writeCheckpoint } from './checkpoint';
import { hasMats, payMats } from './crafting';
import { applyOutcome, openEvent } from './events';
import { generateSector, node, reveal } from './galaxy';
import { addLog } from './log';
import { hashString } from './rng';

export function currentMission(s: GameState): StoryDef | null {
  return STORY[s.story.idx] ?? null;
}

export function missionNode(s: GameState, m: StoryDef | null = currentMission(s)): MapNode | null {
  if (!m) return null;
  return s.sector.nodes.find((n) => n.story === m.id) ?? null;
}

/** Called when a story event's choice is made: the mission is done. */
export function completeMission(s: GameState, id: string): string[] {
  const m = currentMission(s);
  if (!m || m.id !== id) return [];
  const lines = applyOutcome(s, m.reward, null);
  if (m.flag && !s.story.flags.includes(m.flag)) s.story.flags.push(m.flag);
  s.story.done.push(m.id);
  s.story.idx++;
  addLog(s, `Mission complete: ${m.title}.`, 'story');
  if (m.objective.k === 'gate' && s.story.idx < STORY.length) {
    enterSector(s, m.sector + 1);
    lines.push(`Entered ${SECTORS[m.sector + 1]!.name}`);
  }
  if (s.story.idx >= STORY.length) {
    const end = ['end-settle', 'end-share', 'end-sever'].find((f) => s.story.flags.includes(f));
    s.ending = end ?? 'end-share';
  }
  lines.push(...checkRescue(s));
  return lines;
}

export function enterSector(s: GameState, index: number): void {
  s.sector = generateSector(s, index, hashString(`${s.seed}:sector:${index}`));
  s.at = 0;
  const entry = node(s);
  entry.visited = true;
  entry.cleared = true;
  reveal(s);
  writeCheckpoint(s);
  addLog(s, `Arrived in ${SECTORS[index]!.name}.`, 'story');
}

/** Rescue missions finish themselves the moment enough colonists are aboard. */
export function checkRescue(s: GameState): string[] {
  const m = currentMission(s);
  if (!m || m.objective.k !== 'rescue' || s.colonists < m.objective.colonists) return [];
  const lines = [`Mission complete: ${m.title}`, ...applyOutcome(s, m.reward, null)];
  s.story.done.push(m.id);
  s.story.idx++;
  addLog(s, `Mission complete: ${m.title}. ${m.text}`, 'story');
  return lines;
}

export function atMissionNode(s: GameState): boolean {
  const n = missionNode(s);
  return !!n && n.id === s.at;
}

export function canDeliver(s: GameState): boolean {
  const m = currentMission(s);
  return !!m && m.objective.k === 'deliver' && atMissionNode(s) && hasMats(s, m.objective.mats);
}

export function deliver(s: GameState): boolean {
  if (!canDeliver(s)) return false;
  const m = currentMission(s)!;
  if (m.objective.k === 'deliver') payMats(s, m.objective.mats);
  openEvent(s, m.id, 'story');
  return true;
}

export function canTakeGate(s: GameState): boolean {
  const m = currentMission(s);
  return !!m && m.objective.k === 'gate' && atMissionNode(s);
}

export function takeGate(s: GameState): boolean {
  if (!canTakeGate(s) || s.screen !== 'map') return false;
  openEvent(s, currentMission(s)!.id, 'story');
  return true;
}

export function storyById(id: string): StoryDef | undefined {
  return STORY_BY_ID.get(id);
}

/** Ark sections recovered: one per boss beaten. */
export function arkSections(s: GameState): number {
  return s.story.flags.filter((f) => /^ark-\d$/.test(f)).length;
}
