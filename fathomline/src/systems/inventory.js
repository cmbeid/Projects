import { addToCooler, sellAll } from './economy.js';

// Auto-sell (Phase 2 passive) sells a catch the instant it lands instead of
// banking it in the cooler; otherwise catches queue in the cooler until the
// player sells or it fills up.
export function bankCatch(state, stats, entry) {
  if (state.passives.includes('auto_sell')) {
    state.coin += entry.value;
    return { sold: true, banked: false };
  }
  const banked = addToCooler(state, stats.coolerCapacity, entry);
  return { sold: false, banked };
}

export function sellCooler(state) {
  return sellAll(state);
}
