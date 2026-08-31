import { formatNumber } from './format.js';

const WEATHER_ICON = { clear: '☀️', overcast: '☁️', rain: '🌧️', fog: '🌫️', storm: '⛈️' };

export function mountHud(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between gap-3 px-3 py-2 bg-tide/70 text-sm">
      <div class="flex items-center gap-1"><span class="text-coin">●</span><span data-hud="coin">0</span></div>
      <div class="flex items-center gap-1"><span class="text-pearl">◆</span><span data-hud="pearls">0</span></div>
      <div data-hud="region" class="flex-1 text-center truncate">Marrow Cove</div>
      <div class="flex items-center gap-1">
        <span data-hud="weather-icon">☀️</span>
        <span data-hud="time-of-day" class="text-xs opacity-70">day</span>
      </div>
    </div>`;
  return {
    update(state) {
      container.querySelector('[data-hud="coin"]').textContent = formatNumber(state.coin);
      container.querySelector('[data-hud="pearls"]').textContent = formatNumber(state.pearls);
      container.querySelector('[data-hud="region"]').textContent = state.regionName;
      container.querySelector('[data-hud="weather-icon"]').textContent = WEATHER_ICON[state.weatherId] ?? '☀️';
      container.querySelector('[data-hud="time-of-day"]').textContent = state.timeOfDay;
    },
  };
}
