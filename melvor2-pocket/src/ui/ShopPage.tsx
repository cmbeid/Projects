import { useState } from 'preact/hooks';
import { NS, displayName, get, itemName } from '../engine/content';
import { describeBlock } from '../engine/describe';
import { describeRequirement } from '../engine/navigation';
import type { Game } from '../engine/game';
import { buy, buyBlockReason, purchased, shopPurchases, shopVisible } from '../engine/shop';
import { Costs, Icon, fmt } from './common';

interface Subcategory { Id: string; DisplayName: string; Category: string }

type Purchase = ReturnType<typeof shopPurchases>[number];

/** What a purchase gives (items, currency, bonuses), its buy limit, and every requirement with whether you meet it. */
function ShopDetails({ game, p, owned }: { game: Game; p: Purchase; owned: number }) {
  const prov = p.Provides as { Items: { Item: string; Quantity: number }[]; Currencies?: { Currency: string; Quantity: number }[]; Bonuses?: Parameters<typeof describeBlock>[0] };
  const gives = [
    ...prov.Items.map((i) => `+${fmt(i.Quantity)} ${itemName(i.Item, i.Quantity)}`),
    ...(prov.Currencies ?? []).map((c) => `+${fmt(c.Quantity)} ${displayName('Currency', c.Currency)}`),
    ...describeBlock(prov.Bonuses),
  ];
  const reqs = [...(p.Requirements ?? [])].map((r) => describeRequirement(game, r));
  return (
    <div class="shop-details">
      {gives.length > 0 && (
        <>
          <div class="muted small">Provides</div>
          <ul class="bonus-list">
            {gives.map((g) => (
              <li>{g}</li>
            ))}
          </ul>
        </>
      )}
      {reqs.length > 0 && (
        <>
          <div class="muted small">Requirements</div>
          <ul class="req-list">
            {reqs.map((r) => (
              <li class={r.done ? 'done' : 'unmet'}>
                {r.done ? '✓' : '✗'} {r.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {(p as { ShowBuyLimit?: boolean }).ShowBuyLimit && p.DefaultBuyLimit > 0 && (
        <div class="muted small">
          Buy limit: {owned} / {p.DefaultBuyLimit}
        </div>
      )}
    </div>
  );
}

export function ShopPage({ game }: { game: Game }) {
  const visible = shopPurchases().filter((p) => shopVisible(game, p));
  const cats = [...new Set(visible.map((p) => get<Subcategory>('ShopSubcategory', p.Subcategory).Category))];
  const [cat, setCat] = useState(cats[0]);
  const [msg, setMsg] = useState('');
  const subs = [...new Set(visible.map((p) => p.Subcategory))].filter((s) => get<Subcategory>('ShopSubcategory', s).Category === cat);
  return (
    <div class="page">
      <h2>Shop</h2>
      <div class="chips">
        {cats.map((c) => (
          <button class={c === cat ? 'on' : ''} onClick={() => setCat(c)}>
            {displayName('ShopCategory', c)}
          </button>
        ))}
      </div>
      {msg && <p class="muted">{msg}</p>}
      {subs.map((s) => (
        <section>
          <h3>{displayName('ShopSubcategory', s)}</h3>
          {visible
            .filter((p) => p.Subcategory === s)
            .map((p) => {
              const reason = buyBlockReason(game, p);
              const owned = purchased(game, NS + p.Id);
              const gold = p.Costs?.Currencies.find((c) => c.Currency === `${NS}GoldPieces`)?.Quantity;
              return (
                <div class={`card ${reason === 'Owned' ? 'owned' : ''}`}>
                  <div class="card-row">
                    <Icon id={p.Provides.Items[0]?.Item ?? NS + p.Id} size={36} />
                    <div class="grow">
                      <strong>{p.DisplayName}</strong>
                      {p.Description && <div class="muted small">{p.Description.replace(/\[[^\]]+\]/g, '')}</div>}
                    </div>
                    <button disabled={!!reason} onClick={() => setMsg(buy(game, p) ?? `Bought ${p.DisplayName}.`)}>
                      {reason === 'Owned' ? 'Owned' : reason === 'Locked' ? 'Locked' : owned && p.DefaultBuyLimit !== 1 ? `Buy (${owned})` : 'Buy'}
                    </button>
                  </div>
                  <ShopDetails game={game} p={p} owned={owned} />
                  {reason !== 'Owned' && p.Costs && <Costs items={p.Costs.Items} gold={gold} have={(i) => game.count(i)} />}
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}
