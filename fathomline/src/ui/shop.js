import { GEAR, STATS } from '../data/upgrades.js';
import { gearNextCost, statNextCost, nextGearTier } from '../systems/upgrades.js';
import { formatNumber } from './format.js';

export function renderShop(state) {
  const gearRows = Object.keys(GEAR)
    .map((category) => {
      const tier = state.gear[category] ?? 1;
      const current = GEAR[category].find((g) => g.tier === tier);
      const next = nextGearTier(category, tier);
      const cost = gearNextCost(state, category);
      return `
        <div class="py-2 border-b border-white/5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="capitalize font-medium">${category} <span class="opacity-60 text-xs">tier ${tier}/${GEAR[category].length}</span></div>
              <div class="text-xs opacity-70">${current?.name ?? '—'} — ${current?.desc ?? ''}</div>
            </div>
            <button data-shop-gear="${category}" ${cost === null ? 'disabled' : ''}
              class="shrink-0 rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
              ${cost === null ? 'Max' : formatNumber(cost)}
            </button>
          </div>
          ${next ? `<div class="text-xs text-coin/80 mt-0.5">Next: ${next.name} — ${next.desc}</div>` : ''}
        </div>`;
    })
    .join('');

  const statRows = Object.values(STATS)
    .map((track) => {
      const tier = state.stats[track.id] ?? 0;
      const cost = statNextCost(state, track.id);
      return `
        <div class="py-2 border-b border-white/5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">${track.name} <span class="opacity-60 text-xs">Tier ${tier}/${track.maxTier}</span></div>
              <div class="text-xs opacity-70">${track.desc}</div>
            </div>
            <button data-shop-stat="${track.id}" ${cost === null ? 'disabled' : ''}
              class="shrink-0 rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
              ${cost === null ? 'Max' : formatNumber(cost)}
            </button>
          </div>
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
