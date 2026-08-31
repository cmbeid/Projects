import './style.css';
import { createEngine } from './core/engine.js';
import { playBlip } from './core/audio.js';
import { attachCamera, LOGICAL_WIDTH, LOGICAL_HEIGHT } from './render/camera.js';
import { drawScene } from './render/scene.js';
import { updateFx, spawnSplash, spawnFloatText, clearFx } from './render/fx.js';
import { mountHud } from './ui/hud.js';
import { mountCastbar } from './ui/castbar.js';
import { createPanel } from './ui/panels.js';
import { renderShop } from './ui/shop.js';
import { renderCrew } from './ui/crewui.js';
import { renderMap, bindMap } from './ui/mapui.js';
import { renderLog } from './ui/log.js';
import { renderSettings, bindSettings } from './ui/settings.js';
import { formatDuration, formatNumber, formatWeight } from './ui/format.js';
import { effectiveStats } from './systems/stats.js';
import { biteTimeMs, resolveCatch } from './systems/fishing.js';
import { createMinigameState, stepMinigame } from './systems/minigame.js';
import { bankCatch } from './systems/inventory.js';
import { sellAll, catchValue } from './systems/economy.js';
import { purchaseGear, purchaseStatTier } from './systems/upgrades.js';
import { hireCrew, levelUpCrew, crewProductionTick } from './systems/crew.js';
import { currentConditions, upcomingForecast } from './systems/weather.js';
import { REGIONS, STARTING_REGION, isRegionUnlocked } from './data/regions.js';
import { fishById } from './data/fish.js';
import { crewById } from './data/crew.js';
import { BASE_HOOK_WINDOW_MS } from './config.js';

const WEATHER_LABEL = { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', fog: 'Fog', storm: 'Storm' };

const app = document.getElementById('app');
app.innerHTML = `
  <div class="flex flex-col flex-1 min-h-0">
    <div id="hud"></div>
    <div class="relative flex-1 min-h-0">
      <canvas id="scene" class="w-full h-full block"></canvas>
      <div id="offline-toast" class="pointer-events-none absolute inset-x-3 top-3 hidden rounded-xl bg-tide/90 p-3 text-sm shadow-lg"></div>
    </div>
    <div id="castbar"></div>
    <div class="relative z-30 flex gap-1.5 px-3 pb-3">
      <button data-tab="shop" class="flex-1 rounded-xl bg-white/5 py-2 text-sm">Shop</button>
      <button data-tab="crew" class="flex-1 rounded-xl bg-white/5 py-2 text-sm">Crew</button>
      <button data-tab="map" class="flex-1 rounded-xl bg-white/5 py-2 text-sm">Map</button>
      <button data-tab="cooler" class="flex-1 rounded-xl bg-white/5 py-2 text-sm">Cooler</button>
      <button data-tab="log" class="rounded-xl bg-white/5 py-2 px-3 text-sm" aria-label="Fishing log">📋</button>
      <button data-tab="settings" class="rounded-xl bg-white/5 py-2 px-3 text-sm" aria-label="Settings">⚙️</button>
    </div>
  </div>
  <div id="panel-root"></div>
`;

const engine = createEngine();
const { state, events } = engine;

const hud = mountHud(document.getElementById('hud'));
const castbar = mountCastbar(document.getElementById('castbar'));
const canvas = document.getElementById('scene');
const { ctx } = attachCamera(canvas);
const panelRoot = document.getElementById('panel-root');

const panels = {
  shop: createPanel(panelRoot, { title: 'Shop' }),
  crew: createPanel(panelRoot, { title: 'Crew' }),
  map: createPanel(panelRoot, { title: 'Map' }),
  cooler: createPanel(panelRoot, { title: 'Cooler' }),
  log: createPanel(panelRoot, { title: 'Fishing Log' }),
  settings: createPanel(panelRoot, { title: 'Settings' }),
};

const logEntries = [];
const MAX_LOG_ENTRIES = 30;
function pushLog(text) {
  logEntries.push(text);
  if (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
  if (panels.log.isOpen) refreshPanels();
}

document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.tab;
    Object.entries(panels).forEach(([k, p]) => (k === key ? p.toggle() : p.close()));
    refreshPanels();
  });
});

function refreshPanels() {
  const stats = effectiveStats(state);
  if (panels.shop.isOpen) {
    panels.shop.setContent(renderShop(state));
    bindShop();
  }
  if (panels.crew.isOpen) {
    panels.crew.setContent(renderCrew(state, stats));
    bindCrew();
  }
  if (panels.map.isOpen) {
    panels.map.setContent(renderMap(state));
    bindMap(panels.map.body, state, () => {
      panels.map.close();
      refreshPanels();
    });
  }
  if (panels.cooler.isOpen) {
    panels.cooler.setContent(renderCooler());
    bindCooler();
  }
  if (panels.log.isOpen) {
    panels.log.setContent(renderLog(logEntries));
  }
  if (panels.settings.isOpen) {
    panels.settings.setContent(renderSettings(state));
    bindSettings(panels.settings.body, state, refreshPanels, engine.disableSaving);
  }
}

function bindShop() {
  panels.shop.body.querySelectorAll('[data-shop-gear]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (purchaseGear(state, btn.dataset.shopGear)) refreshPanels();
    })
  );
  panels.shop.body.querySelectorAll('[data-shop-stat]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (purchaseStatTier(state, btn.dataset.shopStat)) refreshPanels();
    })
  );
}

function bindCrew() {
  const stats = effectiveStats(state);
  panels.crew.body.querySelectorAll('[data-crew-hire]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (hireCrew(state, stats, btn.dataset.crewHire)) refreshPanels();
    })
  );
  panels.crew.body.querySelectorAll('[data-crew-level]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (levelUpCrew(state, btn.dataset.crewLevel)) refreshPanels();
    })
  );
}

function renderCooler() {
  if (state.cooler.length === 0) return `<div class="opacity-60 text-sm">Cooler is empty. Go catch something.</div>`;
  const rows = state.cooler
    .map(
      (e, i) => `
      <div class="flex items-center justify-between py-2 border-b border-white/5 text-sm">
        <div>${e.speciesId.replace(/_/g, ' ')} · ${formatWeight(e.kg)} · ${e.sizeClass}</div>
        <button data-cooler-sell="${i}" class="rounded-lg bg-coin/90 text-deep px-2 py-1 text-xs font-semibold">Sell ${formatNumber(e.value)}</button>
      </div>`
    )
    .join('');
  return `${rows}<button data-cooler-sell-all class="mt-3 w-full rounded-xl bg-coin text-deep font-semibold py-2">Sell All</button>`;
}

function bindCooler() {
  panels.cooler.body.querySelectorAll('[data-cooler-sell]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.coolerSell);
      state.coin += state.cooler[idx]?.value ?? 0;
      state.cooler.splice(idx, 1);
      refreshPanels();
    })
  );
  panels.cooler.body.querySelector('[data-cooler-sell-all]')?.addEventListener('click', () => {
    sellAll(state);
    refreshPanels();
  });
}

// -- Offline summary toast ---------------------------------------------
events.on('offline-summary', (summary) => {
  if (!summary || summary.coinEarned <= 0) return;
  const toast = document.getElementById('offline-toast');
  toast.textContent = `While you were away (${formatDuration(summary.elapsedMs)}): +${formatNumber(summary.coinEarned)} coin`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 6000);
});

// -- Core cast/bite/hook/reel state machine ------------------------------
const FLOW = { IDLE: 'idle', CASTING: 'casting', WAITING: 'waiting', BITE: 'bite', REELING: 'reeling' };
let flow = FLOW.IDLE;
let flowTimer = 0;
let currentFish = null;
let mg = null;
let bobber = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT * 0.4, cast: false };
let holding = false;

function regionId() {
  return isRegionUnlocked(state, state.currentRegion) ? state.currentRegion : STARTING_REGION;
}

function startCast() {
  if (flow !== FLOW.IDLE) return;
  flow = FLOW.CASTING;
  flowTimer = 0;
  castbar.setCaption('Casting...');
}

function onCastPointerDown() {
  if (flow === FLOW.IDLE) {
    startCast();
  } else if (flow === FLOW.BITE) {
    hookFish();
  } else if (flow === FLOW.REELING) {
    holding = true;
  }
}

function onCastPointerUp() {
  holding = false;
}

function hookFish() {
  playBlip(520, 90, state.settings.muted);
  const stats = effectiveStats(state);
  mg = createMinigameState(currentFish.fish, stats, { assistMode: state.settings.assistMode });
  flow = FLOW.REELING;
  castbar.setLabel('HOLD');
  castbar.setCaption('Hold to reel, release to ease off');
}

function endCast(result) {
  flow = FLOW.IDLE;
  bobber.cast = false;
  castbar.setLabel('CAST');
  castbar.setCaption(result ?? '');
  setTimeout(() => castbar.setCaption(''), 1500);
}

function landFish() {
  const stats = effectiveStats(state);
  const { fish, kg, sizeClass } = currentFish.catchInfo;
  const value = currentFish.value;
  const entry = { speciesId: fish.id, kg, rarity: fish.rarity, sizeClass, value, caughtAt: Date.now(), source: 'player' };
  const outcome = bankCatch(state, stats, entry);
  spawnSplash(LOGICAL_WIDTH - 40, LOGICAL_HEIGHT / 2);
  spawnFloatText(LOGICAL_WIDTH - 40, LOGICAL_HEIGHT / 2 - 20, `+${formatNumber(value)}`, '#f4c542');
  playBlip(880, 140, state.settings.muted);
  endCast(outcome.sold ? `Sold ${fish.name} for ${formatNumber(value)}` : `Landed ${fish.name}!`);
  pushLog(`🎣 You caught a ${formatWeight(kg)} ${fish.name} (${sizeClass}, ${fish.rarity}) — ${formatNumber(value)} coin`);
  refreshPanels();
}

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#castbar button')) onCastPointerDown();
});
document.addEventListener('pointerup', onCastPointerUp);
document.addEventListener('pointercancel', onCastPointerUp);

function updateFlow(dtSeconds, stats) {
  flowTimer += dtSeconds * 1000;

  if (flow === FLOW.CASTING) {
    bobber.cast = true;
    bobber.x = LOGICAL_WIDTH / 2 + Math.sin(flowTimer / 100) * 4;
    bobber.y = LOGICAL_HEIGHT * (0.32 + Math.min(1, flowTimer / 400) * 0.15);
    if (flowTimer > 400) {
      flow = FLOW.WAITING;
      flowTimer = 0;
      const conditions = currentConditions(state.seed, Date.now());
      const catchInfo = resolveCatch(regionId(), stats, conditions, Math.random);
      const value = catchValue({ fish: catchInfo.fish, kg: catchInfo.kg, sizeClass: catchInfo.sizeClass, marketMult: stats.marketPriceMult });
      currentFish = { catchInfo, fish: catchInfo.fish, value };
      castbar.setCaption('Waiting for a bite...');
    }
  } else if (flow === FLOW.WAITING) {
    const biteAt = biteTimeMs(stats);
    if (flowTimer >= biteAt) {
      flow = FLOW.BITE;
      flowTimer = 0;
      castbar.setLabel('TAP!');
      castbar.setCaption('Fish is biting — tap now!');
      playBlip(660, 60, state.settings.muted);
    }
  } else if (flow === FLOW.BITE) {
    if (flowTimer > BASE_HOOK_WINDOW_MS) {
      endCast('It got away...');
    }
  } else if (flow === FLOW.REELING) {
    mg = stepMinigame(mg, dtSeconds, holding);
    if (mg.result === 'landed') landFish();
    else if (mg.result === 'escaped') endCast('The fish escaped.');
    else if (mg.result === 'snapped') endCast('Line snapped!');
  }
}

// -- Engine systems -------------------------------------------------------
engine.addSystem((s, dt, ev) => {
  const stats = effectiveStats(s);
  crewProductionTick(s, stats, dt, ev);
});

engine.addSystem((s, dt) => {
  const stats = effectiveStats(s);
  updateFlow(dt, stats);
  updateFx(dt);
});

engine.addSystem((s) => {
  const conditions = currentConditions(s.seed, Date.now());
  hud.update({
    coin: s.coin,
    pearls: s.pearls,
    regionName: REGIONS[regionId()].name,
    weatherId: conditions.weatherId,
    timeOfDay: conditions.timeOfDay,
  });
  drawScene(ctx, {
    weatherId: conditions.weatherId,
    bobber: flow === FLOW.IDLE ? null : bobber,
    biteFlash: flow === FLOW.BITE,
    minigame: flow === FLOW.REELING ? mg : null,
  });
});

// Refresh open panels on any coin/crew/cooler-affecting event so the UI never goes stale,
// and log the catch so idle production is visible instead of silent.
events.on('crew-catch', ({ crewId, entry, outcome }) => {
  const crewName = crewById(crewId)?.name ?? 'Crew';
  const fishName = fishById(entry.speciesId)?.name ?? entry.speciesId;
  const dest = outcome.sold ? 'sold' : 'banked';
  pushLog(`🧑‍✈️ ${crewName} caught a ${formatWeight(entry.kg)} ${fishName} — ${dest} for ${formatNumber(entry.value)} coin`);
  refreshPanels();
});

// -- Weather forecast popover --------------------------------------------
let forecastOpen = false;
hud.weatherButton.addEventListener('click', () => {
  forecastOpen = !forecastOpen;
  hud.forecastEl.classList.toggle('hidden', !forecastOpen);
  if (forecastOpen) renderForecast();
});
function renderForecast() {
  const upcoming = upcomingForecast(state.seed, Date.now(), 4);
  hud.forecastEl.innerHTML = `
    <div class="font-semibold mb-1.5">Upcoming weather</div>
    ${upcoming
      .map((f) => {
        const minutes = Math.max(1, Math.round(f.startsInMs / 60000));
        return `<div class="flex items-center justify-between py-0.5"><span>${f.timeOfDay === 'night' ? '🌙' : '🌤️'} ${WEATHER_LABEL[f.weatherId] ?? f.weatherId}</span><span class="opacity-60">in ${minutes}m</span></div>`;
      })
      .join('')}
  `;
}
// Forecast content only changes on the scale of minutes, so it's refreshed
// on open/close rather than every tick.
document.addEventListener('click', (e) => {
  if (forecastOpen && !e.target.closest('[data-hud="weather-button"]') && !e.target.closest('[data-hud="forecast"]')) {
    forecastOpen = false;
    hud.forecastEl.classList.add('hidden');
  }
});

clearFx();
engine.start();
