import { CREW, crewById } from '../data/crew.js';
import { catchValue } from './economy.js';
import { resolveCatch } from './fishing.js';
import { bankCatch } from './inventory.js';
import { currentConditions } from './weather.js';

export function hireCrew(state, stats, crewId) {
  const def = crewById(crewId);
  if (!def) return false;
  if (state.crew.some((c) => c.id === crewId)) return false;
  if (state.crew.length >= stats.crewSlots) return false;
  if (state.coin < def.hireCost) return false;
  state.coin -= def.hireCost;
  state.crew.push({ id: crewId, level: 1, region: def.regionAffinity, lastCollectedAt: Date.now(), timerMs: 0 });
  return true;
}

export function levelUpCrew(state, crewId) {
  const hired = state.crew.find((c) => c.id === crewId);
  const def = crewById(crewId);
  if (!hired || !def) return false;
  if (hired.level >= def.maxLevel) return false;
  const cost = Math.round(def.hireCost * 0.6 * hired.level);
  if (state.coin < cost) return false;
  state.coin -= cost;
  hired.level += 1;
  return true;
}

export function assignedCrew(state) {
  return state.crew
    .map((hired) => ({ hired, def: crewById(hired.id) }))
    .filter((c) => c.def);
}

export function effectiveIntervalMs(def, level, crewSpeedMult = 1) {
  return def.baseIntervalMs * def.levelIntervalMult(level) / crewSpeedMult;
}

// Live (online) idle production: unlike the offline resolver, this runs a
// real per-tick timer and an actual catch roll per crew member — cheap
// enough while the tab is open, and it's what keeps foreground and offline
// yield statistically consistent (offline math is calibrated to match this).
export function crewProductionTick(state, stats, dtSeconds, events) {
  const seed = state.seed ^ 0x51ed;
  const conditions = currentConditions(seed, Date.now());
  for (const { hired, def } of assignedCrew(state)) {
    hired.timerMs = (hired.timerMs ?? 0) + dtSeconds * 1000;
    const intervalMs = effectiveIntervalMs(def, hired.level, stats.crewSpeedMult) / (def.rarityBias.bite ?? 1);
    if (hired.timerMs < intervalMs) continue;
    hired.timerMs = 0;

    const { fish, kg, sizeClass } = resolveCatch(
      hired.region,
      { ...stats, rarityBiasMult: (stats.rarityBiasMult ?? 1) * (def.rarityBias.rarity ?? 1) },
      conditions,
      Math.random
    );
    const value = catchValue({ fish, kg, sizeClass, marketMult: stats.marketPriceMult }) * def.levelYieldMult(hired.level) * stats.crewYieldMult;
    const entry = { speciesId: fish.id, kg, rarity: fish.rarity, sizeClass, value, caughtAt: Date.now(), source: 'crew' };
    const outcome = bankCatch(state, stats, entry);
    events?.emit('crew-catch', { crewId: hired.id, entry, outcome });
  }
}
