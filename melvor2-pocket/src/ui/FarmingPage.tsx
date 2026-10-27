import { useState } from 'preact/hooks';
import { NS, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import {
  automationCost, automationUnlocked, buyPlot, category, categoryIds, compost, compostItems, farmingRecipe, growInterval, harvest, harvestPenalty,
  harvestQuantity, isFlower, isReady, plant, plot, plotIds, plotState, recipesFor, water,
} from '../engine/skills/farming';
import { Bar, Costs, Icon, fmt, ticksToDuration } from './common';
import { describeBlock } from '../engine/describe';
import {
  GRAIN_MILL_INTERVAL_MS, depositToMill, millCapacity, millRecipe, millRecipeIds, millStorageItems, milled, setMill, withdrawFromMill,
} from '../engine/skills/farming';

/** Per-plot automation, as on the desktop (unlocked by the Farmhand purchases): each automated step costs the recipe's automation cost. */
function Automation({ game, pid, recipe, canWater, canCompost, flower }: { game: Game; pid: string; recipe: string; canWater: boolean; canCompost: boolean; flower: boolean }) {
  const p = plotState(game, pid)!;
  const a = (p.auto ??= {});
  const r = farmingRecipe(recipe);
  const cost = automationCost(game, r);
  const toggle = (key: 'harvest' | 'water', on: boolean) => {
    a[key] = on;
    game.emit();
  };
  return (
    <details class="automation">
      <summary>
        Automation{a.harvest || a.replant ? ' · on' : ''} <span class="muted small">({[...cost.Items.map((i) => `${i.Quantity} ${itemName(i.Item, i.Quantity)}`), ...cost.Currencies.map((x) => `${x.Quantity} gold`)].join(', ') || 'free'} per step)</span>
      </summary>
      {!flower && (
        <label class="toggle">
          <input type="checkbox" checked={!!a.harvest} onChange={(e) => toggle('harvest', (e.target as HTMLInputElement).checked)} />
          Harvest when ready
        </label>
      )}
      <label class="toggle">
        <input
          type="checkbox"
          checked={a.replant === recipe}
          onChange={(e) => {
            a.replant = (e.target as HTMLInputElement).checked ? recipe : null;
            game.emit();
          }}
        />
        Replant {r.DisplayName} afterwards
      </label>
      {canWater && (
        <label class="toggle">
          <input type="checkbox" checked={!!a.water} onChange={(e) => toggle('water', (e.target as HTMLInputElement).checked)} />
          Water when replanting
        </label>
      )}
      {canCompost && (
        <label class="toggle">
          <input
            type="checkbox"
            checked={!!a.compost}
            onChange={(e) => {
              a.compost = (e.target as HTMLInputElement).checked ? (compostItems().find((i) => game.count(i) > 0) ?? compostItems()[0]) : null;
              game.emit();
            }}
          />
          Compost when replanting{a.compost ? ` (${itemName(a.compost)})` : ''}
        </label>
      )}
    </details>
  );
}

export function FarmingPage({ game }: { game: Game }) {
  const cats = categoryIds().filter((c) => plotIds().some((p) => plot(p).Category === c));
  const [cat, setCat] = useState(cats[0]);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const act = (r: string | null) => setMsg(r ?? '');
  const plots = plotIds().filter((p) => plot(p).Category === cat && !game.isDemoLocked(plot(p).Requirements));
  const c = category(cat);
  return (
    <>
      <div class="chips">
        {cats.map((id) => (
          <button class={id === cat ? 'on' : ''} onClick={() => setCat(id)}>
            {category(id).DisplayName}
          </button>
        ))}
      </div>
      {msg && <p class="muted">{msg}</p>}
      {(game.state.purchases['MelvorBase:GrainMill'] ?? 0) > 0 && (
        <details class="toolbelt">
          <summary>Grain Mill {game.state.mill.recipe ? `· milling ${millRecipe(game.state.mill.recipe).DisplayName}` : '· idle'}</summary>
          {game.state.mill.recipe && (
            <Bar value={Math.round(GRAIN_MILL_INTERVAL_MS * 0.06) - (game.state.mill.readyAt - game.state.tick)} max={Math.round(GRAIN_MILL_INTERVAL_MS * 0.06)} color="#e8b84a" />
          )}
          <div class="mill-storage">
            <div class="muted small">Storage (up to {fmt(millCapacity(game))} of each)</div>
            {millStorageItems().map((i) => (
              <div class="card-row">
                <Icon id={i} size={24} />
                <span class="grow small">
                  {itemName(i, 2)}: {fmt(milled(game, i))} stored · {fmt(game.count(i))} in bank
                </span>
                <button disabled={!game.count(i) || milled(game, i) >= millCapacity(game)} onClick={() => depositToMill(game, i)}>
                  Deposit
                </button>
                <button disabled={!milled(game, i)} onClick={() => withdrawFromMill(game, i)}>
                  Withdraw
                </button>
              </div>
            ))}
          </div>
          {millRecipeIds()
            .filter((r) => !game.isDemoLocked(millRecipe(r).Requirements))
            .map((r) => {
              const m = millRecipe(r);
              const on = game.state.mill.recipe === r;
              return (
                <div class="card-row">
                  <Icon id={m.Product.Item} size={28} />
                  <div class="grow">
                    <div>
                      {m.DisplayName} ×{m.Product.Quantity} every 5 min
                    </div>
                    <Costs items={m.Ingredients.Items} have={(i) => game.count(i)} />
                  </div>
                  <button class={on ? 'on' : ''} onClick={() => act(setMill(game, on ? null : r))}>
                    {on ? 'Stop' : 'Mill'}
                  </button>
                </div>
              );
            })}
        </details>
      )}
      {!game.requirementsMet(c.Requirements) && <p class="muted">{c.DisplayName} unlock at a higher Farming level.</p>}
      {plots.map((pid) => {
        const pl = plot(pid);
        const p = plotState(game, pid);
        if (!p) {
          const gold = pl.Costs.Currencies.find((x) => x.Currency === `${NS}GoldPieces`)?.Quantity;
          return (
            <div class="card">
              <div class="card-row">
                <strong>{pl.DisplayName}</strong>
                <button onClick={() => act(buyPlot(game, pid))} disabled={!game.requirementsMet(pl.Requirements)}>
                  {game.requirementsMet(pl.Requirements) ? 'Buy plot' : 'Locked'}
                </button>
              </div>
              <Costs items={pl.Costs.Items} gold={gold} have={(i) => game.count(i)} />
            </div>
          );
        }
        if (!p.recipe) {
          return (
            <div class="card">
              <div class="card-row">
                <strong>{pl.DisplayName}</strong>
                <button onClick={() => setChoosing(choosing === pid ? null : pid)}>{choosing === pid ? 'Cancel' : 'Plant'}</button>
              </div>
              {choosing === pid && (
                <div class="pick-list">
                  {recipesFor(cat)
                    .filter((r) => !game.isDemoLocked(farmingRecipe(r).Requirements))
                    .map((rid) => {
                      const r = farmingRecipe(rid);
                      const ok = game.requirementsMet(r.Requirements);
                      return (
                        <button
                          class="pick"
                          disabled={!ok}
                          onClick={() => {
                            act(plant(game, pid, rid));
                            setChoosing(null);
                          }}
                        >
                          <Icon id={r.Product.Item} size={32} />
                          <div>
                            <strong>{r.DisplayName}</strong>
                            <div class="muted small">
                              {ok ? `${ticksToDuration(r.BaseInterval * 0.06)} · ${r.BaseExperience} XP` : 'Level too low'}
                            </div>
                            <Costs items={r.Ingredients.Items} have={(i) => game.count(i)} />
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        }
        const r = farmingRecipe(p.recipe);
        const ready = isReady(game, p);
        const total = Math.round(growInterval(game, r, p.regrowsLeft < r.Regrows) * 0.06);
        const left = Math.max(0, p.readyAt - game.state.tick);
        const flower = isFlower(r);
        const blooming = flower && p.providingUntil != null;
        const flowerBonus = flower ? describeBlock(r.BonusesWhenGrown as never).join(', ') : '';
        return (
          <div class="card">
            <div class="card-row">
              <Icon id={flower ? (r.Ingredients.Items[0]?.Item ?? r.Product.Item) : r.Product.Item} size={36} />
              <div class="grow">
                <strong>{r.DisplayName}</strong>
                <div class="muted small">
                  {flower
                    ? blooming
                      ? `In bloom: ${flowerBonus} · ${ticksToDuration(Math.max(0, p.providingUntil! - game.state.tick))} left`
                      : `${ticksToDuration(left)} until it blooms · then ${flowerBonus} for ${ticksToDuration((r.GrownInterval ?? 0) * 0.06)}`
                    : `${ready ? 'Ready to harvest' : `${ticksToDuration(left)} left`} · ~${fmt(harvestQuantity(r, p, game))} ${itemName(r.Product.Item, 2)}`}
                  {!flower && harvestPenalty(r, p, game) > 0 ? ` (−${harvestPenalty(r, p, game)}% disease/pests)` : ''}
                </div>
              </div>
              {ready && <button onClick={() => harvest(game, pid)}>Harvest</button>}
            </div>
            {!ready && !blooming && <Bar value={total - left} max={total} color="#6abf3a" />}
            {blooming && <Bar value={p.providingUntil! - game.state.tick} max={Math.round((r.GrownInterval ?? 1) * 0.06)} color="#0091ba" />}
            {automationUnlocked(game, r) && <Automation game={game} pid={pid} recipe={p.recipe} canWater={c.CanWater} canCompost={c.CanCompost} flower={flower} />}
            <div class="row small-buttons">
              {c.CanWater && (
                <button disabled={p.watered} onClick={() => water(game, pid)}>
                  {p.watered ? 'Watered' : 'Water'}
                </button>
              )}
              {c.CanCompost &&
                (p.compost ? (
                  <button disabled>{itemName(p.compost)}</button>
                ) : (
                  compostItems()
                    .filter((i) => game.count(i) > 0)
                    .map((i) => <button onClick={() => act(compost(game, pid, i))}>Use {itemName(i)}</button>)
                ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
