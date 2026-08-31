import { describe, expect, it } from 'vitest';
import { createMinigameState, stepMinigame } from '../src/systems/minigame.js';
import { fishById } from '../src/data/fish.js';
import { effectiveStats } from '../src/systems/stats.js';
import { defaultState } from '../src/core/save.js';

const stats = effectiveStats(defaultState());

function runBot(fish, { holdStrategy, maxSeconds = 30 } = {}) {
  let mg = createMinigameState(fish, stats, { rng: Math.random });
  const dt = 1 / 30;
  for (let t = 0; t < maxSeconds; t += dt) {
    const holding = holdStrategy(mg);
    mg = stepMinigame(mg, dt, holding);
    if (mg.result) return mg.result;
  }
  return null; // never resolved within the time budget
}

describe('reel minigame', () => {
  it('is winnable by a simple chase bot (holds when the zone needs to catch up to the marker)', () => {
    const fish = fishById('silverfin_minnow'); // 'steady' AI — easiest profile
    const results = [];
    for (let i = 0; i < 30; i++) {
      const result = runBot(fish, {
        holdStrategy: (mg) => mg.markerPos > mg.zoneCenter,
      });
      results.push(result);
    }
    expect(results).toContain('landed');
  });

  it('holding continuously (ignoring the fish) is not a safe default strategy', () => {
    const fish = fishById('kingfisher_salmon'); // 'thrasher' — high tension gain
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(runBot(fish, { holdStrategy: () => true }));
    }
    expect(results).not.toEqual(Array(10).fill('landed'));
  });

  it('never releasing at all also cannot land it — tension caps out or the marker drifts off', () => {
    const fish = fishById('isoldes_perch'); // legendary, two-phase AI
    const result = runBot(fish, { holdStrategy: () => true }, );
    expect(['snapped', 'escaped', null]).toContain(result);
  });
});
