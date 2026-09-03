import { afterEach, describe, expect, it } from 'vitest';

import { createBank } from '../src/audio/bank.js';
import { buildWave } from './fixtures.js';

/**
 * A stand-in for the browser's audio stack.
 *
 * Records what was started and lets a test decide whether decoding succeeds,
 * because the interesting behaviour is all in the failure and timing paths: a
 * sound played before the page has been touched, a sound still decoding, a
 * resource that turns out not to be audio at all.
 */
function fakeAudio(options: { decodes?: boolean } = {}) {
  const started: AudioBuffer[] = [];
  const pending: (() => void)[] = [];
  let resumed = 0;

  class FakeContext {
    destination = {} as AudioDestinationNode;

    resume(): Promise<void> {
      resumed += 1;
      return Promise.resolve();
    }

    createBufferSource(): AudioBufferSourceNode {
      const node = {
        buffer: null as AudioBuffer | null,
        connect: () => undefined,
        start: () => started.push(node.buffer as AudioBuffer),
      };
      return node as unknown as AudioBufferSourceNode;
    }

    decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
      return new Promise((resolve, reject) => {
        pending.push(() => {
          if (options.decodes === false) reject(new Error('not audio'));
          else resolve({ length: bytes.byteLength } as AudioBuffer);
        });
      });
    }
  }

  (globalThis as unknown as { AudioContext?: unknown }).AudioContext = FakeContext;

  return {
    started,
    get resumed() {
      return resumed;
    },
    /** Lets every queued decode settle, then drains the microtask queue. */
    async settle() {
      for (const finish of pending.splice(0)) finish();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

afterEach(() => {
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('the sound bank', () => {
  it('stays silent until a gesture has unlocked it', async () => {
    const audio = fakeAudio();
    const bank = createBank();
    bank.load(new Map([[0x8568, buildWave(100)]]));

    // Browsers refuse to start audio outside a gesture. Playing before one is a
    // no-op rather than an error: the first frame of the page must not throw.
    bank.play(0x8568);
    await audio.settle();
    expect(audio.started).toHaveLength(0);

    bank.unlock();
    bank.play(0x8568);
    await audio.settle();
    expect(audio.started).toHaveLength(1);
  });

  it('plays the first tap of a sound once it has decoded, rather than dropping it', async () => {
    const audio = fakeAudio();
    const bank = createBank();
    bank.load(new Map([[0x85a8, buildWave(100)]]));
    bank.unlock();

    // Nothing is decoded yet, so this cannot play immediately. Dropping it
    // would make the very first placement of each kind silent, which reads as
    // the sound being missing rather than late.
    bank.play(0x85a8);
    expect(audio.started).toHaveLength(0);
    await audio.settle();
    expect(audio.started).toHaveLength(1);

    // Decoded once and kept: a second placement plays without decoding again.
    bank.play(0x85a8);
    expect(audio.started).toHaveLength(2);
  });

  it('decodes a sound once even if it is asked for repeatedly while decoding', async () => {
    const audio = fakeAudio();
    const bank = createBank();
    bank.load(new Map([[0x8668, buildWave(100)]]));
    bank.unlock();

    bank.play(0x8668);
    bank.play(0x8668);
    bank.play(0x8668);
    await audio.settle();
    // Three taps during one decode start one sound, not three at once.
    expect(audio.started).toHaveLength(1);
  });

  it('gives up on bytes the browser cannot decode instead of retrying forever', async () => {
    const audio = fakeAudio({ decodes: false });
    const bank = createBank();
    bank.load(new Map([[0x8768, Uint8Array.from([1, 2, 3, 4])]]));
    bank.unlock();

    bank.play(0x8768);
    await audio.settle();
    expect(audio.started).toHaveLength(0);

    // Forgotten, so a facility placed a hundred times does not queue a hundred
    // doomed decodes.
    bank.play(0x8768);
    await audio.settle();
    expect(audio.started).toHaveLength(0);
  });

  it('honours mute, and ignores a facility with no sound', async () => {
    const audio = fakeAudio();
    const bank = createBank();
    bank.load(new Map([[0x8568, buildWave(100)]]));
    bank.unlock();

    bank.muted = true;
    bank.play(0x8568);
    await audio.settle();
    expect(audio.started).toHaveLength(0);

    bank.muted = false;
    // A facility with no slot at all, and a slot the file has no sound for.
    bank.play(undefined);
    bank.play(0x9999);
    await audio.settle();
    expect(audio.started).toHaveLength(0);
  });

  it('drops what it decoded when a different copy of the game is loaded', async () => {
    const audio = fakeAudio();
    const bank = createBank();
    bank.load(new Map([[0x8568, buildWave(100)]]));
    bank.unlock();
    bank.play(0x8568);
    await audio.settle();
    expect(audio.started).toHaveLength(1);

    // Same IDs, different bytes. Keeping the decoded buffers would play the old
    // copy's audio for the new copy's tower.
    bank.load(new Map([[0x8568, buildWave(500)]]));
    bank.play(0x8568);
    expect(audio.started).toHaveLength(1);
    await audio.settle();
    expect(audio.started).toHaveLength(2);
    expect(audio.started[1]?.length).toBeGreaterThan(audio.started[0]?.length ?? 0);
  });

  it('reports itself unavailable where there is no Web Audio at all', () => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    const bank = createBank();
    expect(bank.available).toBe(false);
    // Every call is still safe: the UI hides the control, but nothing throws.
    expect(() => {
      bank.unlock();
      bank.play(0x8568);
    }).not.toThrow();
  });
});
