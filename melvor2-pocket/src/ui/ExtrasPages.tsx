// Quests, completion log and toolbelt panels.
import { useState } from 'preact/hooks';
import { NS, all, displayName, itemName, type Item } from '../engine/content';
import type { Game } from '../engine/game';
import { advanceQuest, currentTask, quest, questState, quests, startQuest } from '../engine/quests';
import { equipTool, fitsToolbelt, toolbeltItem, toolbeltSlotsFor, unequipTool } from '../engine/items';
import { Bar, Costs, Icon, fmt } from './common';

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

export function QuestsPage({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
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
            {!s && unlocked && (
              <>
                <div class="muted small">{q.Description}</div>
                <button class="wide" onClick={() => setMsg(startQuest(game, id) ?? `Started ${q.DisplayName}.`)}>
                  Start quest
                </button>
              </>
            )}
            {s && t && (
              <>
                <div class="muted small">{quest(id).Steps[s.step].Description}</div>
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
                  <button class="wide" onClick={() => setMsg(advanceQuest(game, id) ?? '')}>
                    Hand in
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      <p class="muted small">Quest-only trees, rocks and enemies appear in their skills while their task is active.</p>
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
