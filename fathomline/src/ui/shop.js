import { GEAR, STATS } from '../data/upgrades.js';
import { gearNextCost, statNextCost } from '../systems/upgrades.js';
import { formatNumber } from './format.js';

export function renderShop(state) {
  const gearRows = Object.keys(GEAR)
    .map((category) => {
      const tier = state.gear[category] ?? 1;
      const current = GEAR[category].find((g) => g.tier === tier);
      const cost = gearNextCost(state, category);
      return `
        <div class="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div class="capitalize font-medium">${category}</div>
            <div class="text-xs opacity-70">${current?.name ?? '—'} (tier ${tier})</div>
          </div>
          <button data-shop-gear="${category}" ${cost === null ? 'disabled' : ''}
            class="rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
            ${cost === null ? 'Max' : formatNumber(cost)}
          </button>
        </div>`;
    })
    .join('');

  const statRows = Object.values(STATS)
    .map((track) => {
      const tier = state.stats[track.id] ?? 0;
      const cost = statNextCost(state, track.id);
      return `
        <div class="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div class="font-medium">${track.name}</div>
            <div class="text-xs opacity-70">Tier ${tier}/${track.maxTier}</div>
          </div>
          <button data-shop-stat="${track.id}" ${cost === null ? 'disabled' : ''}
            class="rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
            ${cost === null ? 'Max' : formatNumber(cost)}
          </button>
        </div>`;
    })
    .join('');

  return `
    <h3 class="text-sm uppercase tracking-wide opacity-60 mb-1">Gear</h3>
    ${gearRows}
    <h3 class="text-sm uppercase tracking-wide opacity-60 mt-4 mb-1">Stats</h3>
    ${statRows}
  `;
}
