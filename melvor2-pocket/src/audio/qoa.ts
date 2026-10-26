// QOA ("Quite OK Audio") decoder and encoder, following the reference format: 8-byte file header ("qoaf", total
// samples per channel), then frames of up to 256 slices. Each slice packs a 4-bit scale factor and twenty 3-bit
// residuals for one channel, predicted by a 4-tap LMS filter. Godot stores the demo's WAVs this way.
// Used by the app to play music and sounds, and by tools/build-audio.mjs to shrink the music for phones.

export interface QoaAudio { channels: number; sampleRate: number; samples: number; data: Int16Array[] }

const SLICE_LEN = 20;
const SLICES_PER_FRAME = 256;
const FRAME_LEN = SLICE_LEN * SLICES_PER_FRAME;
const LMS_LEN = 4;

const SCALEFACTORS = Array.from({ length: 16 }, (_, s) => Math.round((s + 1) ** 2.75));
const DEQUANT_F = [0.75, -0.75, 2.5, -2.5, 4.5, -4.5, 7, -7];
const roundAway = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));
const DEQUANT = SCALEFACTORS.map((sf) => DEQUANT_F.map((q) => roundAway(sf * q)));
const RECIPROCAL = SCALEFACTORS.map((sf) => Math.floor((65536 + sf - 1) / sf));
const QUANT = [7, 7, 7, 5, 5, 3, 3, 1, 0, 0, 2, 2, 4, 4, 6, 6, 6]; // index: clamped residual + 8

/** Division by the scale factor, rounded away from zero (the reference qoa_div). */
function qoaDiv(v: number, sf: number): number {
  const n = (v * RECIPROCAL[sf] + (1 << 15)) >> 16;
  return n + (Math.sign(v) - Math.sign(n));
}

const clamp16 = (v: number) => (v < -32768 ? -32768 : v > 32767 ? 32767 : v);

class Lms {
  history = new Int32Array(LMS_LEN);
  weights = new Int32Array(LMS_LEN);
  predict(): number {
    let p = 0;
    for (let i = 0; i < LMS_LEN; i++) p += this.weights[i] * this.history[i];
    return p >> 13;
  }
  update(sample: number, residual: number): void {
    const delta = residual >> 4;
    for (let i = 0; i < LMS_LEN; i++) this.weights[i] += this.history[i] < 0 ? -delta : delta;
    for (let i = 0; i < LMS_LEN - 1; i++) this.history[i] = this.history[i + 1];
    this.history[LMS_LEN - 1] = sample;
  }
}

/** Decode a QOA stream into 16-bit samples per channel. */
export function decodeQoa(bytes: Uint8Array): QoaAudio {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0) !== 0x716f6166) throw new Error('Not a QOA stream');
  const samples = v.getUint32(4);
  let p = 8;
  const channels = v.getUint8(p);
  const sampleRate = (v.getUint8(p + 1) << 16) | v.getUint16(p + 2);
  const data = Array.from({ length: channels }, () => new Int16Array(samples));
  const lms = Array.from({ length: channels }, () => new Lms());
  let written = 0;
  while (written < samples && p + 8 <= bytes.length) {
    const fch = v.getUint8(p);
    const fsamples = v.getUint16(p + 4);
    p += 8;
    for (let c = 0; c < fch; c++) {
      for (let i = 0; i < LMS_LEN; i++) lms[c].history[i] = v.getInt16(p + i * 2);
      for (let i = 0; i < LMS_LEN; i++) lms[c].weights[i] = v.getInt16(p + 8 + i * 2);
      p += 16;
    }
    for (let si = 0; si < fsamples; si += SLICE_LEN) {
      for (let c = 0; c < fch; c++) {
        const hi = v.getUint32(p);
        const lo = v.getUint32(p + 4);
        p += 8;
        const sf = hi >>> 28;
        const end = Math.min(si + SLICE_LEN, fsamples);
        for (let s = si, k = 0; s < end; s++, k++) {
          // Residual k sits at bits 57 - 3k of the 64-bit slice.
          const shift = 57 - 3 * k;
          const q = shift >= 32 ? (hi >>> (shift - 32)) & 7 : shift > 29 ? ((hi << (32 - shift)) | (lo >>> shift)) & 7 : (lo >>> shift) & 7;
          const r = DEQUANT[sf][q];
          const sample = clamp16(lms[c].predict() + r);
          lms[c].update(sample, r);
          data[c][written + s] = sample;
        }
      }
    }
    written += fsamples;
  }
  return { channels, sampleRate, samples, data };
}

/** Encode 16-bit samples as QOA (brute-force best scale factor per slice, like the reference encoder). */
export function encodeQoa(audio: QoaAudio): Uint8Array {
  const { channels, sampleRate, samples, data } = audio;
  const frames = Math.ceil(samples / FRAME_LEN);
  const size = 8 + frames * 8 + frames * channels * 16 + Math.ceil(samples / SLICE_LEN) * channels * 8;
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x716f6166);
  v.setUint32(4, samples);
  let p = 8;
  const lms = Array.from({ length: channels }, () => {
    const l = new Lms();
    l.weights.set([0, 0, -(1 << 13), 1 << 14]);
    return l;
  });
  for (let start = 0; start < samples; start += FRAME_LEN) {
    const fsamples = Math.min(FRAME_LEN, samples - start);
    v.setUint8(p, channels);
    v.setUint8(p + 1, (sampleRate >> 16) & 0xff);
    v.setUint16(p + 2, sampleRate & 0xffff);
    v.setUint16(p + 4, fsamples);
    v.setUint16(p + 6, 8 + channels * 16 + Math.ceil(fsamples / SLICE_LEN) * channels * 8);
    p += 8;
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < LMS_LEN; i++) v.setInt16(p + i * 2, lms[c].history[i]);
      for (let i = 0; i < LMS_LEN; i++) v.setInt16(p + 8 + i * 2, lms[c].weights[i]);
      p += 16;
    }
    for (let si = 0; si < fsamples; si += SLICE_LEN) {
      const end = Math.min(si + SLICE_LEN, fsamples);
      for (let c = 0; c < channels; c++) {
        let best = { err: Infinity, sf: 0, qs: [] as number[], lms: lms[c] };
        for (let sf = 0; sf < 16; sf++) {
          const trial = new Lms();
          trial.history.set(lms[c].history);
          trial.weights.set(lms[c].weights);
          const qs: number[] = [];
          let err = 0;
          for (let s = si; s < end; s++) {
            const sample = data[c][start + s];
            const pred = trial.predict();
            const resid = sample - pred;
            const q = QUANT[Math.max(-8, Math.min(8, qoaDiv(resid, sf))) + 8];
            const r = DEQUANT[sf][q];
            const recon = clamp16(pred + r);
            const e = sample - recon;
            err += e * e;
            if (err >= best.err) break;
            trial.update(recon, r);
            qs.push(q);
          }
          if (err < best.err && qs.length === end - si) best = { err, sf, qs, lms: trial };
        }
        lms[c] = best.lms;
        let hi = best.sf << 28;
        let lo = 0;
        best.qs.forEach((q, k) => {
          const shift = 57 - 3 * k;
          if (shift >= 32) hi |= q << (shift - 32);
          else if (shift > 29) {
            hi |= q >>> (32 - shift);
            lo |= (q << shift) >>> 0;
          } else lo |= q << shift;
        });
        v.setUint32(p, hi >>> 0);
        v.setUint32(p + 4, lo >>> 0);
        p += 8;
      }
    }
  }
  return out.subarray(0, p);
}
