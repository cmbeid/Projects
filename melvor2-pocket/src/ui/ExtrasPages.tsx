// Quests, completion log and toolbelt panels.
import { useState } from 'preact/hooks';
import { NS, all, displayName, itemName, type Item } from '../engine/content';
import type { Game } from '../engine/game';
import { advanceQuest, currentTask, dialogueLine, quest, questState, quests, startQuest, type DialogueLine } from '../engine/quests';
import { equipTool, fitsToolbelt, toolbeltItem, toolbeltSlotsFor, unequipTool } from '../engine/items';
import { Bar, Costs, Icon, fmt } from './common';
import {
  bonusesFor, category, categoryOpen, describeTask, guildSkills, isDone, isSupported, points, pointsForRank, rankIndex, ranksFor, taskProgress,
  tasksFor, totalPoints, type GuildBonus,
} from '../engine/guild';

const goalLabel = (type: string, data: Record<string, unknown>) => {
  const what = (data.Recipe ?? data.Enemy ?? data.Item ?? data.Category) as string | undefined;
  const verb: Record<string, string> = {
    ArtisanCreateRecipe: 'Make',
    CombatKillEnemy: 'Defeat',
    WoodcuttingCutTree: 'Cut',
    FiremakingBurnRecipe: 'Burn',
    ActionGainItem: 'Gather',
    MiningMineRock: 'Mine',
  };
  const name = what ? (what.includes('Debris') || what.includes('Wall') || what.includes('Gate') ? what.replace(NS, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2') : itemNameOrId(what)) : 'anything';
  return `${verb[type.replace(NS, '')] ?? type.replace(NS, '')} ${name}`;
};

function itemNameOrId(id: string): string {
  const n = itemName(id);
  return n === id.replace(NS, '') ? displayName('Enemy', id) : n;
}

/** Full-screen story sheet for a quest step's dialogue. */
function DialogueSheet({ game, title, lines, onClose }: { game: Game; title: string; lines: DialogueLine[]; onClose: () => void }) {
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body dialogue" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {lines.map((l) => {
          const d = dialogueLine(game, l);
          return (
            <div class={`line ${d.speaker ? (d.you ? 'you' : 'npc') : 'narration'}`}>
              {d.speaker && <strong>{d.speaker}</strong>}
              {d.text.split('\n').filter(Boolean).map((p) => <p>{p}</p>)}
            </div>
          );
        })}
        <button class="wide" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}

export function QuestsPage({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const [story, setStory] = useState<{ title: string; lines: DialogueLine[] } | null>(null);
  /** Show a quest step's story (or the quest's ending). */
  const showStep = (id: string) => {
    const q = quest(id);
    const s = questState(game, id);
    if (!s) return;
    if (s.done) setStory(q.CompletionDialogue?.length ? { title: `${q.DisplayName}: complete`, lines: q.CompletionDialogue } : null);
    else if (q.Steps[s.step]?.Dialogue?.length) setStory({ title: q.DisplayName, lines: q.Steps[s.step].Dialogue });
  };
  return (
    <div class="page">
      <h2>Quests</h2>
      {msg && <p class="muted">{msg}</p>}
      {quests().map((q) => {
        const id = NS + q.Id;
        const s = questState(game, id);
        const t = currentTask(game, id);
        const unlocked = game.requirementsMet(q.Requirements);
        return (
          <div class={`card ${s?.done ? 'owned' : ''}`}>
            <div class="card-row">
              <strong class="grow">{q.DisplayName}</strong>
              <span class="muted small">{s?.done ? 'Complete' : s ? `Step ${s.step + 1}/${q.Steps.length}` : unlocked ? 'Available' : 'Locked'}</span>
            </div>
            {s?.done && quest(id).CompletionDialogue?.length && (
              <button class="link" onClick={() => showStep(id)}>
                Read the ending
              </button>
            )}
            {!s && unlocked && (
              <>
                <div class="muted small">{q.Description}</div>
                <button
                  class="wide"
                  onClick={() => {
                    const err = startQuest(game, id);
                    setMsg(err ?? '');
                    if (!err) showStep(id);
                  }}
                >
                  Start quest
                </button>
              </>
            )}
            {s && t && (
              <>
                <div class="muted small">{quest(id).Steps[s.step].Description}</div>
                {quest(id).Steps[s.step].Dialogue?.length > 0 && (
                  <button class="link" onClick={() => showStep(id)}>
                    Read the story
                  </button>
                )}
                {t.Goals.map((g) => (
                  <div>
                    <div class="small">
                      {goalLabel(g.Type, g.Data)} · {fmt(s.progress[g.Data.Id] ?? 0)}/{fmt(g.Data.MaxProgress)}
                    </div>
                    <Bar value={s.progress[g.Data.Id] ?? 0} max={g.Data.MaxProgress} color="#e8b84a" />
                  </div>
                ))}
                {t.Costs && (
                  <>
                    <div class="small">Hand in:</div>
                    <Costs items={t.Costs.Items} have={(i) => game.count(i)} />
                  </>
                )}
                {(t.Costs || !t.Goals.length) && (
                  <button
                    class="wide"
                    onClick={() => {
                      const err = advanceQuest(game, id);
                      setMsg(err ?? '');
                      if (!err) showStep(id);
                    }}
                  >
                    Hand in
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      <p class="muted small">Quest-only trees, rocks and enemies appear in their skills while their task is active.</p>
      {story && <DialogueSheet game={game} title={story.title} lines={story.lines} onClose={() => setStory(null)} />}
    </div>
  );
}

export function CompletionLog({ game }: { game: Game }) {
  const items = all<Item & { IgnoreCompletion?: boolean }>('Item').filter((i) => !i.IgnoreCompletion && !i.Id.startsWith('Demo'));
  const found = items.filter((i) => game.state.found[NS + i.Id] || game.count(NS + i.Id) > 0).length;
  const enemies = all<{ Id: string; Requirements: never[] | null; IgnoreCompletion?: boolean }>('Enemy').filter(
    (e) => !e.IgnoreCompletion && !game.isDemoLocked(e.Requirements),
  );
  const killed = enemies.filter((e) => (game.state.combat.kills[NS + e.Id] ?? 0) > 0).length;
  const questsDone = quests().filter((q) => questState(game, NS + q.Id)?.done).length;
  return (
    <div class="page">
      <h2>Completion log</h2>
      <div class="small">
        Items found: {found} / {items.length}
      </div>
      <Bar value={found} max={items.length} color="#5fbf6a" />
      <div class="small">
        Enemies defeated: {killed} / {enemies.length}
      </div>
      <Bar value={killed} max={enemies.length} color="#e0565b" />
      <div class="small">
        Quests completed: {questsDone} / {quests().length}
      </div>
      <Bar value={questsDone} max={quests().length} color="#e8b84a" />
    </div>
  );
}

/** Toolbelt slots for one skill (or 'Combat'), with equip/unequip. */
export function ToolbeltPanel({ game, entity }: { game: Game; entity: string }) {
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const slots = toolbeltSlotsFor(entity).filter((s) => !game.isDemoLocked(s.UnlockRequirements));
  if (!slots.length) return null;
  return (
    <details class="toolbelt">
      <summary>Toolbelt ({slots.filter((s) => toolbeltItem(game, NS + s.Id)).length}/{slots.length} equipped)</summary>
      <div class="gear-grid">
        {slots.map((s) => {
          const id = NS + s.Id;
          const t = toolbeltItem(game, id);
          return (
            <button class={`gear ${openSlot === id ? 'sel' : ''}`} onClick={() => setOpenSlot(openSlot === id ? null : id)}>
              {t ? <Icon id={t.item} size={30} /> : <span class="muted small">{s.DisplayName.replace(entity, '').trim()}</span>}
            </button>
          );
        })}
      </div>
      {openSlot &&
        (() => {
          const slot = slots.find((s) => NS + s.Id === openSlot)!;
          const t = toolbeltItem(game, openSlot);
          const fits = fitsToolbelt(game, slot);
          return (
            <div class="card">
              <strong>{slot.DisplayName}</strong>
              {t && (
                <div class="card-row">
                  <Icon id={t.item} size={26} />
                  <span class="grow">{itemName(t.item)}</span>
                  <button onClick={() => unequipTool(game, openSlot)}>Remove</button>
                </div>
              )}
              {!fits.length && <div class="muted small">Nothing in your bank fits this slot.</div>}
              {fits.map((i) => (
                <div class="card-row">
                  <Icon id={i} size={26} />
                  <span class="grow">{itemName(i)}</span>
                  <button onClick={() => setMsg(equipTool(game, openSlot, i) ?? '')}>Equip</button>
                </div>
              ))}
              {msg && <div class="muted small">{msg}</div>}
            </div>
          );
        })()}
    </details>
  );
}

/** Mastery Guild for one skill: rank, points toward the next rank, rank bonuses and every task with progress. */
export function GuildPanel({ game, skill, open = false }: { game: Game; skill: string; open?: boolean }) {
  const [showDone, setShowDone] = useState(false);
  const tasks = tasksFor(skill);
  if (!tasks.length) return null;
  const ranks = ranksFor(skill);
  const ri = rankIndex(game, skill);
  const pts = points(game, skill);
  const next = ranks[ri + 1];
  const shown = tasks.filter((t) => categoryOpen(game, t.Category) && (showDone || !isDone(game, t)));
  const done = tasks.filter((t) => isDone(game, t)).length;
  return (
    <details class="toolbelt guild" open={open}>
      <summary>
        🏆 Mastery Guild · {ranks[ri].DisplayName} · {pts}/{totalPoints(skill)} pts
      </summary>
      <Bar value={pts - (ri ? pointsForRank(skill, ranks[ri]) : 0)} max={next ? pointsForRank(skill, next) - (ri ? pointsForRank(skill, ranks[ri]) : 0) : 1} />
      <div class="muted small">
        {next ? `${pointsForRank(skill, next) - pts} more points to ${next.DisplayName}` : 'Highest rank reached'} · {done}/{tasks.length} tasks done
      </div>
      {bonusesFor(skill).map((b) => (
        <div class={`small ${game.requirementsMet(b.Requirements) ? 'req-done' : 'muted'}`}>
          {game.requirementsMet(b.Requirements) ? '✓' : '🔒'} {b.DisplayName}: {guildBonusText(b)}
        </div>
      ))}
      <label class="toggle small">
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone((e.target as HTMLInputElement).checked)} />
        Show finished tasks
      </label>
      {shown.map((t) => {
        const max = Number(t.Goal?.Data.MaxProgress ?? 1);
        const prog = isDone(game, t) ? max : taskProgress(game, t);
        return (
          <div class={`task ${isDone(game, t) ? 'owned' : ''}`}>
            <div class="card-row">
              <span class="grow small">{describeTask(t)}</span>
              <span class="muted small">
                {category(t.Category).DisplayName} · {category(t.Category).BasePoints} pt
              </span>
            </div>
            {t.Goal && <Bar value={prog} max={max} />}
            {!isSupported(t) && <div class="muted small">Can't be progressed in this version.</div>}
          </div>
        );
      })}
    </details>
  );
}

function guildBonusText(b: GuildBonus): string {
  const list = (b.Rewards.Bonuses?.Component ?? []) as { Stat: { Name: string }; Value: number }[];
  return list
    .map((x) => {
      const pct = /Percent|Chance/.test(x.Stat.Name);
      const v = pct ? `${Math.round(x.Value * 100)}%` : `${x.Value}`;
      return `+${v} ${x.Stat.Name.replace(/^(Percent|Flat|Increased)/, '').replace('XPGained', 'XP').replace(/([a-z])([A-Z])/g, '$1 $2')}`;
    })
    .join(', ');
}

/** All guilds at a glance (More tab). */
export function GuildOverview({ game }: { game: Game }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div class="page">
      <h2>Mastery Guilds</h2>
      {guildSkills().map((s) => {
        const ranks = ranksFor(s);
        return (
          <div class="card">
            <button class="card-row plain" onClick={() => setOpen(open === s ? null : s)}>
              <strong class="grow">{s}</strong>
              <span class="muted small">
                {ranks[rankIndex(game, s)].DisplayName} · {points(game, s)}/{totalPoints(s)}
              </span>
            </button>
            <Bar value={points(game, s)} max={totalPoints(s)} />
            {open === s && <GuildPanel game={game} skill={s} open />}
          </div>
        );
      })}
    </div>
  );
}
