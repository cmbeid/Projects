import { orderedRegions, isRegionUnlocked } from '../data/regions.js';
import { GEAR } from '../data/upgrades.js';

export function renderMap(state) {
  const rows = orderedRegions()
    .map((region) => {
      const unlocked = isRegionUnlocked(state, region.id);
      const current = state.currentRegion === region.id;
      const boatNeeded = GEAR.boat.find((g) => g.tier === region.unlock.minBoat);
      const lockNote = !unlocked ? `<div class="text-xs text-red-300/80 mt-0.5">Requires ${boatNeeded?.name ?? `Boat tier ${region.unlock.minBoat}`} from the Shop</div>` : '';
      return `
        <button data-map-region="${region.id}" ${unlocked ? '' : 'disabled'}
          class="w-full text-left py-2 px-1 border-b border-white/5 disabled:opacity-40">
          <div class="flex items-center justify-between">
            <div class="font-medium">${region.name}</div>
            ${current ? '<span class="text-xs text-coin">Here</span>' : ''}
          </div>
          ${lockNote}
        </button>`;
    })
    .join('');
  return rows;
}

export function bindMap(panelBody, state, onSelect) {
  panelBody.querySelectorAll('[data-map-region]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const regionId = btn.dataset.mapRegion;
      if (!isRegionUnlocked(state, regionId)) return;
      state.currentRegion = regionId;
      onSelect?.();
    })
  );
}
