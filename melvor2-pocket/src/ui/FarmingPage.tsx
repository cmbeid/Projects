import { useState } from 'preact/hooks';
import { NS, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import {
  buyPlot, category, categoryIds, compost, compostItems, farmingRecipe, harvest, harvestPenalty, harvestQuantity, isReady,
  plant, plot, plotIds, plotState, recipesFor, water,
} from '../engine/skills/farming';
import { Bar, Costs, Icon, fmt, ticksToDuration } from './common';
import { GRAIN_MILL_INTERVAL_MS, millRecipe, millRecipeIds, setMill } from '../engine/skills/farming';

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
        const total = Math.round((p.regrowsLeft < r.Regrows ? r.RegrowInterval : r.BaseInterval) * 0.06);
        const left = Math.max(0, p.readyAt - game.state.tick);
        return (
          <div class="card">
            <div class="card-row">
              <Icon id={r.Product.Item} size={36} />
              <div class="grow">
                <strong>{r.DisplayName}</strong>
                <div class="muted small">
                  {ready ? 'Ready to harvest' : `${ticksToDuration(left)} left`} · ~{fmt(harvestQuantity(r, p))} {itemName(r.Product.Item, 2)}
                  {harvestPenalty(r, p) > 0 ? ` (−${harvestPenalty(r, p)}% disease/pests)` : ''}
                </div>
              </div>
              {ready && <button onClick={() => harvest(game, pid)}>Harvest</button>}
            </div>
            {!ready && <Bar value={total - left} max={total} color="#6abf3a" />}
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
