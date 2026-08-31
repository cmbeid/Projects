import { CREW } from '../data/crew.js';
import { REGIONS } from '../data/regions.js';
import { formatNumber } from './format.js';

export function renderCrew(state, stats) {
  const rows = CREW.map((def) => {
    const hired = state.crew.find((c) => c.id === def.id);
    const regionName = REGIONS[def.regionAffinity]?.name ?? def.regionAffinity;
    if (!hired) {
      const canHire = state.crew.length < stats.crewSlots;
      return `
        <div class="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <div class="font-medium">${def.name}</div>
            <div class="text-xs opacity-70">Fishes ${regionName}</div>
          </div>
          <button data-crew-hire="${def.id}" ${canHire ? '' : 'disabled'}
            class="rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
            Hire ${formatNumber(def.hireCost)}
          </button>
        </div>`;
    }
    const levelCost = Math.round(def.hireCost * 0.6 * hired.level);
    const maxed = hired.level >= def.maxLevel;
    return `
      <div class="flex items-center justify-between py-2 border-b border-white/5">
        <div>
          <div class="font-medium">${def.name} <span class="opacity-60 text-xs">Lv.${hired.level}</span></div>
          <div class="text-xs opacity-70">Fishes ${regionName} idly</div>
        </div>
        <button data-crew-level="${def.id}" ${maxed ? 'disabled' : ''}
          class="rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
          ${maxed ? 'Max' : formatNumber(levelCost)}
        </button>
      </div>`;
  }).join('');

  return `<div class="text-xs opacity-70 mb-2">${state.crew.length}/${stats.crewSlots} crew slots</div>${rows}`;
}
