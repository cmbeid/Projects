/**
 * A handful of tiny synthesized sounds. No files: each is a couple of
 * oscillators with an envelope.
 */
let ctx: AudioContext | null = null;
let enabled = true;
let lastClick = 0;

export function setSound(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Sfx = 'click' | 'level' | 'good' | 'bad' | 'coin';

export function sfx(kind: Sfx): void {
  if (!enabled) return;
  switch (kind) {
    case 'click': {
      const now = performance.now();
      if (now - lastClick < 60) return;
      lastClick = now;
      tone(660, 0, 0.05, 'square', 0.03);
      return;
    }
    case 'coin':
      tone(988, 0, 0.08, 'square', 0.04);
      tone(1319, 0.07, 0.15, 'square', 0.04);
      return;
    case 'level':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.08));
      return;
    case 'good':
      tone(784, 0, 0.12, 'triangle', 0.06);
      tone(1047, 0.1, 0.2, 'triangle', 0.06);
      return;
    case 'bad':
      tone(220, 0, 0.18, 'sawtooth', 0.04);
      return;
  }
}
