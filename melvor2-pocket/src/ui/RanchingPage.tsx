import { useState } from 'preact/hooks';
import { NS, itemName } from '../engine/content';
import type { Game } from '../engine/game';
import {
  animalsIn, buyAnimal, buyLand, build, enclosure, enclosureIds, happiness, land, landIds, maintenance, pet, ranchAnimal, repair, repairCost, variant,
} from '../engine/skills/ranching';
import { Bar, Costs, Icon, fmt, ticksToDuration } from './common';

const goldOf = (c: { Currencies: { Currency: string; Quantity: number }[] }) =>
  c.Currencies.find((x) => x.Currency === `${NS}GoldPieces`)?.Quantity;

export function RanchingPage({ game }: { game: Game }) {
  const [msg, setMsg] = useState('');
  const [building, setBuilding] = useState<string | null>(null);
  const act = (r: string | null) => setMsg(r ?? '');
  const owned = game.state.ranching.land;
  const nextLand = landIds().find((l) => !owned.some((o) => o.land === l) && !game.isDemoLocked(land(l).Requirements));
  const now = game.state.tick;
  return (
    <>
      {msg && <p class="muted">{msg}</p>}
      {owned.map((slot) => {
        const e = slot.enclosure ? enclosure(slot.enclosure) : null;
        if (!e) {
          return (
            <div class="card">
              <div class="card-row">
                <strong>{land(slot.land).DisplayName}</strong>
                <button onClick={() => setBuilding(building === slot.land ? null : slot.land)}>
                  {building === slot.land ? 'Cancel' : 'Build enclosure'}
                </button>
              </div>
              {building === slot.land && (
                <div class="pick-list">
                  {enclosureIds()
                    .map(enclosure)
                    .filter((x) => !game.isDemoLocked(x.Requirements) && !enclosureIds().some((o) => enclosure(o).UpgradesTo === `${NS}${x.Id}`))
                    .map((x) => (
                      <button
                        class="pick"
                        disabled={!game.requirementsMet(x.Requirements)}
                        onClick={() => {
                          act(build(game, slot.land, NS + x.Id));
                          setBuilding(null);
                        }}
                      >
                        <div>
                          <strong>{x.DisplayName}</strong>
                          <div class="muted small">
                            {game.requirementsMet(x.Requirements) ? `Holds ${x.AnimalLimit}` : 'Locked (level or shop upgrade)'}
                          </div>
                          <Costs items={x.Costs.Items} gold={goldOf(x.Costs)} have={(i) => game.count(i)} />
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        }
        const animals = animalsIn(game, slot.enclosure!);
        const upgrade = e.UpgradesTo ? enclosure(e.UpgradesTo) : null;
        return (
          <div class="card">
            <div class="card-row">
              <strong>{e.DisplayName}</strong>
              <span class="muted small">
                {animals.length}/{e.AnimalLimit}
              </span>
            </div>
            <div class="card-row">
              <span class={`small grow ${maintenance(game, slot.enclosure!) < 0.75 ? 'warn' : 'muted'}`}>
                Maintenance {Math.round(maintenance(game, slot.enclosure!) * 100)}%
              </span>
              {maintenance(game, slot.enclosure!) < 1 && (
                <button onClick={() => setMsg(repair(game, slot.enclosure!) ?? '')}>
                  Repair ({[...repairCost(game, slot.enclosure!).Items.map((i) => `${i.Quantity} ${itemName(i.Item, i.Quantity)}`), ...repairCost(game, slot.enclosure!).Currencies.map((c) => `${c.Quantity} gold`)].join(', ')})
                </button>
              )}
            </div>
            {animals.map((a) => {
              const r = ranchAnimal(a.animal);
              const wantsPet = r.RequiresPets && now >= a.petDueAt;
              return (
                <div class="animal">
                  <Icon id={r.Products[0]?.Item ?? a.animal} size={28} />
                  <div class="grow">
                    <div>
                      {r.DisplayName.Singular} · {variant(a.variant).DisplayName}
                    </div>
                    <div class="muted small">
                      Happiness {Math.round(happiness(game, a) * 100)}% · next produce in {ticksToDuration(a.nextProductAt - now)} · lives{' '}
                      {ticksToDuration(a.diesAt - now)}
                    </div>
                    <Bar value={happiness(game, a)} max={1} color="#e8b84a" />
                  </div>
                  {wantsPet && <button onClick={() => pet(game, a.id)}>Pet</button>}
                </div>
              );
            })}
            {animals.length < e.AnimalLimit &&
              e.Animals.map((aid) => {
                const r = ranchAnimal(aid);
                if (game.isDemoLocked(r.Requirements)) return null;
                return (
                  <div class="card-row">
                    <div class="grow">
                      <div>Buy a {r.DisplayName.Singular}</div>
                      <div class="muted small">Eats {r.Eats.map((x) => `${x.Quantity} ${itemName(x.Item, x.Quantity)}`).join(', ')} per hour</div>
                      <Costs items={r.PurchaseCosts.Items} gold={goldOf(r.PurchaseCosts)} have={(i) => game.count(i)} />
                    </div>
                    <button onClick={() => act(buyAnimal(game, slot.enclosure!, aid))} disabled={!game.requirementsMet(r.Requirements)}>
                      Buy
                    </button>
                  </div>
                );
              })}
            {upgrade && !game.isDemoLocked(upgrade.Requirements) && (
              <div class="card-row">
                <div class="grow">
                  <div>Upgrade to {upgrade.DisplayName} (holds {upgrade.AnimalLimit})</div>
                  <Costs items={upgrade.Costs.Items} gold={goldOf(upgrade.Costs)} have={(i) => game.count(i)} />
                </div>
                <button onClick={() => act(build(game, slot.land, e.UpgradesTo!))} disabled={!game.requirementsMet(upgrade.Requirements)}>
                  Upgrade
                </button>
              </div>
            )}
          </div>
        );
      })}
      {nextLand && (
        <div class="card">
          <div class="card-row">
            <strong>{land(nextLand).DisplayName}</strong>
            <button onClick={() => act(buyLand(game, nextLand))} disabled={!game.requirementsMet(land(nextLand).Requirements)}>
              Buy land
            </button>
          </div>
          <Costs items={land(nextLand).Costs.Items} gold={goldOf(land(nextLand).Costs)} have={(i) => game.count(i)} />
        </div>
      )}
      <p class="muted small">Gold on hand: {fmt(game.state.gold)}. Animals produce every hour while they're fed and happy, even offline.</p>
    </>
  );
}
