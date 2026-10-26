import { describe, expect, it } from 'vitest';
import { decodeQoa, encodeQoa } from '../src/audio/qoa';

describe('QOA codec', () => {
  it('round-trips a tone with small error', () => {
    const n = 24000;
    const tone = new Int16Array(n);
    for (let i = 0; i < n; i++) tone[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 24000) + 3000 * Math.sin((2 * Math.PI * 97 * i) / 24000));
    const bytes = encodeQoa({ channels: 1, sampleRate: 24000, samples: n, data: [tone] });
    // About 3.2 bits per sample.
    expect(bytes.length).toBeLessThan(n * 0.45);
    const back = decodeQoa(bytes);
    expect(back.sampleRate).toBe(24000);
    expect(back.samples).toBe(n);
    let err = 0;
    for (let i = 0; i < n; i++) err += (back.data[0][i] - tone[i]) ** 2;
    const rms = Math.sqrt(err / n);
    expect(rms).toBeLessThan(150); // vs a signal of amplitude ~11,000
  });
});
