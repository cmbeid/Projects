import { store } from '../state/store';

type Cue = 'combine' | 'discover' | 'reject' | 'pick';

/**
 * Synthesised sound effects.
 *
 * Generating tones with WebAudio rather than shipping audio files keeps the
 * whole game offline-capable with no assets to precache, and adds nothing to
 * the download.
 */
let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/**
 * Browsers only allow audio to start inside a user gesture, so the context is
 * created and resumed on the player's first interaction.
 */
export function primeAudio(): void {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function play(cue: Cue): void {
  if (!store.get().settings.sound) return;

  const ctx = ensureContext();
  if (!ctx || ctx.state !== 'running') return;

  switch (cue) {
    case 'pick':
      tone(ctx, 520, 0.05, 'sine', 0.05);
      break;
    case 'combine':
      tone(ctx, 440, 0.09, 'triangle', 0.07);
      tone(ctx, 660, 0.09, 'triangle', 0.05, 0.06);
      break;
    case 'discover':
      // A small rising arpeggio, so a first-time find sounds different from
      // an ordinary combine even with the screen not being looked at.
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, step) => {
        tone(ctx, frequency, 0.14, 'triangle', 0.06, step * 0.07);
      });
      break;
    case 'reject':
      tone(ctx, 150, 0.12, 'sawtooth', 0.035);
      break;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gainValue: number,
  delay = 0,
): void {
  const startAt = ctx.currentTime + delay;

  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  // A short attack and exponential decay; a raw square edge clicks audibly.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}
