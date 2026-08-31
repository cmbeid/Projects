import { CREW } from '../data/crew.js';
import { REGIONS, isRegionUnlocked } from '../data/regions.js';
import { formatNumber } from './format.js';

export function renderCrew(state, stats) {
  const rows = CREW.map((def) => {
    const hired = state.crew.find((c) => c.id === def.id);
    const region = REGIONS[def.regionAffinity];
    const regionName = region?.name ?? def.regionAffinity;
    const unlocked = isRegionUnlocked(state, def.regionAffinity);

    if (!hired) {
      const canHire = unlocked && state.crew.length < stats.crewSlots;
      const lockedNote = !unlocked ? `<div class="text-xs text-red-300/80 mt-0.5">Unlocks with a boat that reaches ${regionName}</div>` : '';
      const fullNote = unlocked && state.crew.length >= stats.crewSlots ? `<div class="text-xs text-red-300/80 mt-0.5">No free crew slots — upgrade your boat</div>` : '';
      return `
        <div class="py-2 border-b border-white/5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">${def.name}</div>
              <div class="text-xs opacity-70">${def.desc}</div>
            </div>
            <button data-crew-hire="${def.id}" ${canHire ? '' : 'disabled'}
              class="shrink-0 rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
              Hire ${formatNumber(def.hireCost)}
            </button>
          </div>
          ${lockedNote}${fullNote}
        </div>`;
    }

    const levelCost = Math.round(def.hireCost * 0.6 * hired.level);
    const maxed = hired.level >= def.maxLevel;
    return `
      <div class="py-2 border-b border-white/5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="font-medium">${def.name} <span class="opacity-60 text-xs">Lv.${hired.level}/${def.maxLevel}</span></div>
            <div class="text-xs opacity-70">${def.desc}</div>
          </div>
          <button data-crew-level="${def.id}" ${maxed ? 'disabled' : ''}
            class="shrink-0 rounded-lg bg-coin/90 text-deep text-sm font-semibold px-3 py-2 disabled:opacity-30 disabled:bg-transparent disabled:border disabled:border-white/20">
            ${maxed ? 'Max level' : `Level Up ${formatNumber(levelCost)}`}
          </button>
        </div>
        <div class="text-xs opacity-50 mt-0.5">Leveling up fishes faster and earns more coin per catch.</div>
      </div>`;
  }).join('');

  return `<div class="text-xs opacity-70 mb-2">${state.crew.length}/${stats.crewSlots} crew slots (more from Boat upgrades in the Shop)</div>${rows}`;
}
