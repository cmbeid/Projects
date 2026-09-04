/**
 * What SimTower's sound resources are, and whether we can play them.
 *
 * The `0xff0a` resources share their IDs with the facility bitmaps — there is a
 * restaurant sound at `0x8568` and an office one at `0x85a8`, the same slots
 * their art occupies — so the 0x40 table names the sounds as well as the
 * pictures. That is what makes "play the sound for what was just built" a
 * lookup rather than a research project.
 *
 * Nothing here decodes audio. If the bytes are a complete RIFF/WAVE file the
 * browser's own `decodeAudioData` does that far better than we would; this
 * module's job is to say whether they are, and to describe them well enough
 * that a resource which is *not* a WAVE is diagnosed rather than silently
 * dropped into an audio decoder that will reject it without explanation.
 */

/** Four ASCII bytes at an offset, for chunk tags. */
function tag(data: Uint8Array, at: number): string {
  if (at + 4 > data.byteLength) return '';
  return String.fromCharCode(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0, data[at + 3] ?? 0);
}

function u16(data: Uint8Array, at: number): number {
  return (data[at] ?? 0) | ((data[at + 1] ?? 0) << 8);
}

function u32(data: Uint8Array, at: number): number {
  return ((data[at] ?? 0) | ((data[at + 1] ?? 0) << 8) | ((data[at + 2] ?? 0) << 16) | ((data[at + 3] ?? 0) << 24)) >>> 0;
}

export interface SoundFormat {
  /**
   * `riff` means the bytes are a self-contained RIFF/WAVE file and can go
   * straight to the browser. Anything else is described but not claimed.
   */
  kind: 'riff' | 'unknown';
  bytes: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  /** Length of the audio itself, when the header says enough to work it out. */
  seconds?: number;
}

/**
 * Reads a sound resource's header without decoding it.
 *
 * Walks the RIFF chunk list rather than assuming `fmt ` sits at byte 12: it
 * usually does, but a file with a `LIST` or `fact` chunk first is still a
 * perfectly ordinary WAVE and guessing the offset would reject it.
 */
export function sniffSound(data: Uint8Array): SoundFormat {
  const bytes = data.byteLength;
  if (bytes < 12 || tag(data, 0) !== 'RIFF' || tag(data, 8) !== 'WAVE') return { kind: 'unknown', bytes };

  const format: SoundFormat = { kind: 'riff', bytes };
  let dataBytes: number | undefined;

  // Chunks are id(4) + size(4) + payload, and a payload of odd length is
  // followed by a pad byte that is not counted in the size.
  let at = 12;
  while (at + 8 <= bytes) {
    const chunk = tag(data, at);
    const size = u32(data, at + 4);
    const payload = at + 8;
    if (chunk === 'fmt ' && payload + 16 <= bytes) {
      format.channels = u16(data, payload + 2);
      format.sampleRate = u32(data, payload + 4);
      format.bits = u16(data, payload + 14);
    } else if (chunk === 'data') {
      // Trust the smaller of what the header claims and what is actually here:
      // a truncated resource should report the length it can really play.
      dataBytes = Math.min(size, Math.max(0, bytes - payload));
    }
    if (size === 0) break;
    at = payload + size + (size % 2);
  }

  const { channels, sampleRate, bits } = format;
  if (dataBytes !== undefined && channels && sampleRate && bits) {
    const perSecond = sampleRate * channels * (bits / 8);
    if (perSecond > 0) format.seconds = dataBytes / perSecond;
  }
  return format;
}

/** One line describing a sound, for the extractor's listing. */
export function describeSound(format: SoundFormat): string {
  if (format.kind !== 'riff') {
    return `${format.bytes} bytes — not a RIFF/WAVE, so the browser cannot decode it as-is`;
  }
  const parts = [`${format.bytes} bytes`, 'RIFF/WAVE'];
  if (format.sampleRate) parts.push(`${format.sampleRate}Hz`);
  if (format.bits) parts.push(`${format.bits}-bit`);
  if (format.channels) parts.push(format.channels === 1 ? 'mono' : `${format.channels}ch`);
  if (format.seconds !== undefined) parts.push(`${format.seconds.toFixed(2)}s`);
  return parts.join('  ');
}
