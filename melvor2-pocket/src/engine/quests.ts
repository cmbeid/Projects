// Quests: ordered steps of ordered tasks. A task has goals (progress counters fed by game events) and/or item costs.
import { NS, all, get, type Ingredients, type Requirement } from './content';
import type { Game } from './game';
import { missingIngredients, spendIngredients } from './skills/common';
import { guildEvent, type GoalContext } from './guild';

export interface QuestGoal {
  Type: string;
  Data: { Id: string; MaxProgress: number; Component?: { Entity: string }; [k: string]: unknown };
}
export interface QuestTask { Id: string; Goals: QuestGoal[]; Costs: Ingredients | null }
export interface DialogueLine { Npc: string; DialogueText: string }
export interface QuestStep { Id: string; Description: string; CompletedDescription: string; TasksInOrder: QuestTask[]; Dialogue: DialogueLine[] }
export interface Quest {
  Id: string;
  DisplayName: string;
  Description: string;
  Category: string;
  Steps: QuestStep[];
  CompletionDialogue: DialogueLine[] | null;
  Rewards: { Items: { Item: string; Quantity: number }[]; Currency: { Currency: string; Quantity: number }[] } | null;
  Requirements: Requirement[] | null;
}

export interface QuestProgress { step: number; task: number; progress: Record<string, number>; done: boolean }

export const quests = () => all<Quest>('Quest');
export const quest = (id: string) => get<Quest>('Quest', id);

export function questState(game: Game, id: string): QuestProgress | undefined {
  return game.state.quests[id];
}

export function currentTask(game: Game, id: string): QuestTask | null {
  const s = questState(game, id);
  if (!s || s.done) return null;
  return quest(id).Steps[s.step]?.TasksInOrder[s.task] ?? null;
}

export function startQuest(game: Game, id: string): string | null {
  const q = quest(id);
  if (questState(game, id)) return 'Already started';
  if (!game.requirementsMet(q.Requirements)) return 'Complete the previous quest first';
  game.state.quests[id] = { step: 0, task: 0, progress: {}, done: false };
  game.bonusesChanged();
  game.emit();
  return null;
}

const goalsDone = (t: QuestTask, s: QuestProgress) => t.Goals.every((g) => (s.progress[g.Data.Id] ?? 0) >= g.Data.MaxProgress);

/** Hand in the current task's items (if any) and move on when all its goals are met. */
export function advanceQuest(game: Game, id: string): string | null {
  const s = questState(game, id);
  const t = currentTask(game, id);
  if (!s || !t) return null;
  if (!goalsDone(t, s)) return 'Goals not finished yet';
  if (t.Costs) {
    const missing = missingIngredients(game, t.Costs);
    if (missing) return missing;
    spendIngredients(game, t.Costs);
  }
  const q = quest(id);
  s.progress = {};
  s.task++;
  if (s.task >= q.Steps[s.step].TasksInOrder.length) {
    s.task = 0;
    s.step++;
  }
  if (s.step >= q.Steps.length) {
    s.done = true;
    for (const r of q.Rewards?.Items ?? []) game.addItem(r.Item, r.Quantity);
    for (const c of q.Rewards?.Currency ?? []) game.addCurrency(c.Currency, c.Quantity);
    game.notice(`Quest complete: ${q.DisplayName}`);
    game.signal({ type: 'questComplete' });
  }
  game.bonusesChanged();
  game.emit();
  return null;
}

/** Feed an event to every active goal of the given type; `amount` returns how much the event counts for a goal. */
/** Goal data as events see it: any goal's fields (quest or guild). */
export type GoalData = Record<string, unknown> & { Component?: { Entity: string } };

export function questEvent(game: Game, type: string, amount: (data: GoalData) => number, ctx: GoalContext = {}): void {
  guildEvent(game, type, amount, ctx);
  for (const id of Object.keys(game.state.quests)) {
    const s = game.state.quests[id];
    const t = currentTask(game, id);
    if (!t) continue;
    let finished = false;
    for (const g of t.Goals) {
      if (g.Type !== NS + type) continue;
      const n = amount(g.Data);
      if (n <= 0) continue;
      const before = s.progress[g.Data.Id] ?? 0;
      s.progress[g.Data.Id] = Math.min(g.Data.MaxProgress, before + n);
      if (before < g.Data.MaxProgress && s.progress[g.Data.Id] >= g.Data.MaxProgress) finished = true;
    }
    // Tasks with no hand-in complete on their own.
    if (finished && goalsDone(t, s) && !t.Costs) advanceQuest(game, id);
    else if (finished) game.notice(`Quest task ready: ${quest(id).DisplayName}`);
  }
}

/** Matches a goal field against an event value: unset (null) fields match anything. */
export const goalMatches = (data: GoalData, key: string, value: string | undefined) => data[key] == null || data[key] === value;

/** Whether a quest goal is the current active one (for QuestTaskGoalActive display requirements). */
export function goalActive(game: Game, questId: string, step: number, task: number): boolean {
  const s = questState(game, questId);
  return !!s && !s.done && s.step === step && s.task === task;
}

/** Speaker name and text for a dialogue line, with the [Player Name] / [Companion Name] placeholders filled in. */
export function dialogueLine(game: Game, line: DialogueLine): { speaker: string | null; text: string; you: boolean } {
  const fill = (t: string) => t.replace(/\[Player Name\]/g, game.state.names.player).replace(/\[Companion Name\]/g, game.state.names.companion);
  const npc = line.Npc.replace(NS, '');
  const speaker =
    npc === 'System' ? null : npc === 'Player' ? game.state.names.player : npc === 'Companion' ? game.state.names.companion : get<{ DisplayName: string }>('NPC', line.Npc).DisplayName;
  return { speaker, text: fill(line.DialogueText), you: npc === 'Player' };
}
