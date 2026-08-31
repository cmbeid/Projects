// Minimal procedural WebAudio blips behind a mute toggle. Full SFX pass is
// Phase 7; this stub exists now so systems can start emitting sound events
// without a later refactor.
let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function playBlip(freq = 440, durationMs = 80, muted = false) {
  if (muted) return;
  try {
    const audioCtx = getCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch {
    // WebAudio unavailable (some mobile contexts before first user gesture) — skip silently.
  }
}
