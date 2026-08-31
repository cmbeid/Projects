import { MINIGAME } from '../config.js';

// Vertical depth track, 0 (surface) .. 1 (deep). The fish marker moves per
// its AI profile; the player controls a catch-zone that rises while holding
// and falls while released. Progress fills while the marker is inside the
// zone, drains while outside; tension rises while holding/struggling and
// bleeds off while released.
export function createMinigameState(fish, stats, { assistMode = false, rng = Math.random } = {}) {
  const zoneSize = MINIGAME.baseZoneSize * (stats.zoneSizeMult ?? 1) * (assistMode ? 1 + MINIGAME.assistZoneBonus : 1);
  return {
    fish,
    ai: fish.ai,
    aiPhase: fish.ai,
    phaseSwitched: false,
    markerPos: 0.5,
    markerVelocity: 0,
    zoneCenter: 0.5,
    zoneSize,
    progress: 50, // neutral midpoint: fill to 100 lands it, drain to 0 loses it
    tension: 0,
    tensionMax: MINIGAME.baseTensionMax * (stats.tensionMaxMult ?? 1),
    holding: false,
    assistMode,
    rng,
    struggleTimer: rng() * 2 + 1,
    result: null, // null | 'landed' | 'escaped' | 'snapped'
  };
}

function stepMarker(s, dt) {
  const rng = s.rng;
  const profile = s.aiPhase;
  switch (profile) {
    case 'steady':
      s.markerVelocity += (rng() - 0.5) * 0.3 * dt;
      break;
    case 'darter':
      if (rng() < 0.06) s.markerVelocity = (rng() - 0.5) * 2.4;
      break;
    case 'diver':
      s.markerVelocity += -0.4 * dt + (rng() - 0.5) * 0.1;
      break;
    case 'thrasher':
      s.markerVelocity += (rng() - 0.5) * 0.9 * dt;
      break;
    case 'sulker':
      s.struggleTimer -= dt;
      if (s.struggleTimer <= 0) {
        s.markerVelocity = (rng() - 0.5) * 3;
        s.struggleTimer = rng() * 2.5 + 1.5;
      } else {
        s.markerVelocity *= 0.9;
      }
      break;
  }
  s.markerVelocity = Math.max(-1.5, Math.min(1.5, s.markerVelocity * 0.92));
  s.markerPos = Math.max(0, Math.min(1, s.markerPos + s.markerVelocity * dt));
  if (s.markerPos <= 0 || s.markerPos >= 1) s.markerVelocity *= -0.6;
}

function isAggressive(profile) {
  return profile === 'thrasher' || profile === 'darter';
}

export function stepMinigame(s, dt, holding) {
  if (s.result) return s;
  s.holding = holding;

  if (s.fish.aiPhase2 && !s.phaseSwitched && s.progress >= 60) {
    s.aiPhase = s.fish.aiPhase2;
    s.phaseSwitched = true;
  }

  stepMarker(s, dt);

  s.zoneCenter = holding
    ? Math.min(1, s.zoneCenter + 0.6 * dt)
    : Math.max(0, s.zoneCenter - 0.6 * dt);

  const half = s.zoneSize / 2;
  const inside = Math.abs(s.markerPos - s.zoneCenter) <= half;
  s.progress += (inside ? MINIGAME.baseFillRate : -MINIGAME.baseDrainRate) * dt;
  s.progress = Math.max(0, Math.min(100, s.progress));

  const tensionBleed = MINIGAME.baseTensionBleed * (s.assistMode ? 1 - MINIGAME.assistTensionCut : 1);
  const tensionGain =
    (holding ? MINIGAME.baseTensionHoldGain : 0) +
    (isAggressive(s.aiPhase) ? MINIGAME.baseTensionStruggleGain : 0) * (s.assistMode ? 1 - MINIGAME.assistTensionCut : 1);
  s.tension += holding ? tensionGain * dt : -tensionBleed * dt;
  s.tension = Math.max(0, Math.min(s.tensionMax, s.tension));

  if (s.progress >= 100) s.result = 'landed';
  else if (s.progress <= 0) s.result = 'escaped';
  else if (s.tension >= s.tensionMax) s.result = 'snapped';

  return s;
}
