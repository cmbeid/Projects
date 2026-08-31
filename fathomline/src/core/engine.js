import { AUTOSAVE_INTERVAL_MS, TICK_MS } from '../config.js';
import { createEventBus } from './events.js';
import { loadState, saveState } from './save.js';
import { resolveOfflineProgress } from './offline.js';

export function createEngine() {
  const events = createEventBus();
  const state = loadState();

  const offlineSummary = resolveOfflineProgress(state, Date.now());
  // Deferred: callers attach their 'offline-summary' listener right after
  // createEngine() returns, which is *after* this constructor body runs —
  // an emit here would fire before anything is listening.
  if (offlineSummary) queueMicrotask(() => events.emit('offline-summary', offlineSummary));

  const systems = [];
  let rafId = null;
  let last = performance.now();
  let acc = 0;
  let msSinceSave = 0;
  let savingDisabled = false; // set by flows that write localStorage directly (import/wipe) right before a reload

  function addSystem(update) {
    systems.push(update);
  }

  function tick(dtSeconds) {
    for (const update of systems) update(state, dtSeconds, events);
  }

  function frame(now) {
    const frameDt = Math.min(now - last, 250); // clamp to avoid spiral-of-death after a tab freeze
    last = now;
    acc += frameDt;
    while (acc >= TICK_MS) {
      tick(TICK_MS / 1000);
      acc -= TICK_MS;
      msSinceSave += TICK_MS;
    }
    if (msSinceSave >= AUTOSAVE_INTERVAL_MS) {
      msSinceSave = 0;
      if (!savingDisabled) {
        saveState(state);
        events.emit('autosaved', undefined);
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
    window.addEventListener('beforeunload', () => {
      if (!savingDisabled) saveState(state);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !savingDisabled) saveState(state);
    });
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function saveNow() {
    if (!savingDisabled) saveState(state);
  }

  // Call before writing to localStorage directly and reloading (import/wipe
  // flows) so the in-memory engine state can't win a race against that
  // write via the beforeunload/autosave handlers above.
  function disableSaving() {
    savingDisabled = true;
  }

  return { state, events, addSystem, start, stop, saveNow, disableSaving };
}
