// Autosave scheduler (CORE agent) — pure, DOM-free decision logic for when to
// write a crash-recovery snapshot. The actual persistence lives in
// src/core/storage.js (Storage.saveToSlot, typeof-localStorage guarded); this
// module only decides timing so it can be unit-tested headlessly.
//
// Policy: autosave no more often than every `intervalSeconds` of wall-clock
// time, OR on an in-game day change once `minDayGapSeconds` have elapsed since
// the last write (avoids rapid-fire writes when a tower day rolls over right
// after boot).

export const DEFAULT_AUTOSAVE_INTERVAL_SECONDS = 60; // 1 minute real time
export const DEFAULT_MIN_DAY_GAP_SECONDS = 60; // min real-time gap for day-change saves

export class AutosaveScheduler {
  constructor({
    intervalSeconds = DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
    minDayGapSeconds = DEFAULT_MIN_DAY_GAP_SECONDS,
  } = {}) {
    this.intervalSeconds = intervalSeconds;
    this.minDayGapSeconds = minDayGapSeconds;
    this.lastSaveAt = -Infinity;
    this.lastDay = null;
  }

  // nowSeconds: wall-clock epoch seconds. gameDay: integer in-game day index
  // (Math.floor(game.time.absolute)). Returns true when a snapshot should fire.
  shouldSave(nowSeconds, gameDay) {
    if (this.lastSaveAt === -Infinity) return false; // never autosave before first markSaved
    const elapsed = nowSeconds - this.lastSaveAt;
    if (elapsed >= this.intervalSeconds) return true;
    if (this.lastDay !== null && gameDay !== this.lastDay && elapsed >= this.minDayGapSeconds) {
      return true;
    }
    return false;
  }

  markSaved(nowSeconds, gameDay) {
    this.lastSaveAt = nowSeconds;
    this.lastDay = gameDay;
  }

  reset() {
    this.lastSaveAt = -Infinity;
    this.lastDay = null;
  }
}
