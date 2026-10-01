/** The Pokédex: every kind of Pokémon, what you've seen and befriended, and rewards for milestones. */
import { sfx } from '../audio/index';
import { DEX_REWARDS } from '../data/dex';
import { habitat } from '../data/encounters';
import { item } from '../data/items';
import { PRODUCTS, RANCH_STOCK } from '../data/ranch';
import { JOB_TEXT, SPECIES, species } from '../data/species';
import { TYPE_COLOURS } from '../data/types';
import { claimDexReward, claimable } from '../game/dex';
import type { World } from '../game/model';
import { h } from './dom';
import { stillSprite } from './preview';
import { openSheet } from './sheet';

/** How you'd come by a Pokémon: the route, the ranch, by evolving, or as a starter. */
function whereToFind(dex: number): string {
  const found = habitat(dex);
  if (found.length) return found.join('; ');
  const ranch = RANCH_STOCK.find((r) => r.dex === dex);
  if (ranch) return `Sold at the barn's ranch counter for ${ranch.price}g.`;
  const from = [...SPECIES.values()].find((s) => s.evolves?.to === dex);
  if (from) return `Evolves from ${from.name} at level ${from.evolves!.level}.`;
  if ([1, 4, 7].includes(dex)) return 'A starter: one comes to every new farm.';
  return 'Rare. Keep looking!';
}

export function openDex(host: HTMLElement, world: World, changed: () => void): void {
  let selected: number | null = null;
  openSheet(host, 'Pokédex', (body, refresh) => {
    body.append(h('p.note', {}, `Seen ${world.seen.length} · befriended ${world.caught.length} of ${SPECIES.size}. Tap one for where to find it.`));

    // Rewards.
    const ready = claimable(world);
    body.append(h('h3', {}, 'Rewards'));
    for (const r of DEX_REWARDS) {
      const done = world.dexClaimed.includes(r.caught);
      const what = [r.gold ? `${r.gold.toLocaleString('en')}g` : '', ...Object.entries(r.items ?? {}).map(([id, n]) => `${n} ${item(id).name}`)].filter(Boolean).join(', ');
      body.append(h('div.row', {},
        h('span.dex-goal', {}, String(r.caught)),
        h('div.row-text', {}, h('div.row-name', {}, `Befriend ${r.caught} kinds`), h('div.row-detail', {}, what)),
        h('div.row-actions', {}, done ? h('span.claimed', {}, 'Claimed') : h('button', {
          className: 'btn primary',
          disabled: !ready.includes(r.caught),
          onclick: () => {
            if (claimDexReward(world, r.caught)) sfx.caught();
            changed();
            refresh();
          },
        }, 'Claim'))));
    }

    // The one tapped.
    if (selected !== null) {
      const sp = species(selected);
      const caught = world.caught.includes(selected);
      const seen = world.seen.includes(selected);
      const product = PRODUCTS[selected];
      const detail = h('div.dex-detail', {},
        stillSprite(selected, 2, 'dex-big', !caught),
        h('div', {},
          h('b', {}, seen ? `#${String(selected).padStart(3, '0')} ${sp.name}` : `#${String(selected).padStart(3, '0')} ???`),
          seen ? h('div.types', {}, ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]}` }, t))) : null,
          caught ? h('div.row-detail', {}, `${JOB_TEXT[sp.job]}${product ? ` Makes ${item(product).name} in the barn.` : ''}`) : null,
          h('div.row-detail', {}, whereToFind(selected))));
      body.append(detail);
      requestAnimationFrame(() => detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }

    // Everyone, by number.
    const grid = h('div.dex-grid');
    for (const dex of [...SPECIES.keys()].sort((a, b) => a - b)) {
      const caught = world.caught.includes(dex);
      const seen = world.seen.includes(dex);
      grid.append(h('button', {
        className: `dex-cell${caught ? ' caught' : seen ? ' seen' : ''}${selected === dex ? ' on' : ''}`,
        'aria-label': seen ? species(dex).name : `Unknown #${dex}`,
        onclick: () => { selected = dex; refresh(); },
      }, seen ? stillSprite(dex, 1, 'dex-img', !caught) : h('span.dex-unknown', {}, '?'), h('span.dex-num', {}, String(dex).padStart(3, '0'))));
    }
    body.append(h('h3', {}, 'All Pokémon'), grid);
  });
}
