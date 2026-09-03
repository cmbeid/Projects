/**
 * Plays the game's own sounds.
 *
 * Three things make this less trouble than it looks. The sounds are complete
 * RIFF/WAVE files, so `decodeAudioData` does the decoding and we never write a
 * codec. They are keyed by resource ID, and the 0x40 slot table already says
 * which ID belongs to which facility. And they are small enough to decode on
 * first use and keep.
 *
 * The one real constraint is the browser's: an `AudioContext` created before
 * the player has touched the page starts suspended, and on iOS stays that way.
 * So the context is built on the first gesture rather than at load, and every
 * call before that is a silent no-op instead of an error — a tower that makes
 * no noise until you tap it is right, and one that throws on the first frame
 * is not.
 *
 * Four event sources share this — placing, bulldozing, lifts arriving, stars
 * being earned — and the clips run to five seconds. Left alone that stacks:
 * a double tap plays a four-second sound twice a beat apart, and a tower of
 * lifts becomes a rattle. Hence the guard and the exclusive channel below.
 */

/**
 * How close together two starts of the same sound have to be before the second
 * is treated as the same event.
 *
 * A tap that registers twice, or a lift arrival detected on consecutive frames,
 * is one thing happening — not two. Long enough to swallow those, short enough
 * that deliberately placing two rooms in quick succession still sounds twice.
 */
const RETRIGGER_MS = 80;

/** Everything sits under this, so a five-second room ambience does not shout. */
const VOLUME = 0.55;

type ContextConstructor = new () => AudioContext;

function contextConstructor(): ContextConstructor | undefined {
  const scope = globalThis as unknown as {
    AudioContext?: ContextConstructor;
    webkitAudioContext?: ContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

export interface Bank {
  /** Whether this environment can play audio at all. */
  readonly available: boolean;
  muted: boolean;
  /**
   * Hands the bank a new set of sounds, keyed by resource ID. Anything decoded
   * from a previous set is dropped: a different copy of the game is a different
   * set of bytes at the same IDs.
   */
  load(sounds: Map<number, Uint8Array>): void;
  /**
   * Starts the sound at `id`, if there is one and audio has been unlocked.
   *
   * Returns immediately. A sound that is still decoding plays when it is
   * ready — dropping it would make the very first tap of each kind silent,
   * which reads as a bug rather than as a delay.
   */
  play(id: number | undefined): void;
  /**
   * Like `play`, but on a channel of its own that holds one sound at a time.
   *
   * For the lift: its machine-room clip runs five seconds and a busy tower
   * arrives somewhere every second or so, which layered would be a drone rather
   * than a sound. Starting one stops the last.
   */
  playExclusive(id: number | undefined): void;
  /** Called from a real user gesture; without this nothing ever sounds. */
  unlock(): void;
}

export function createBank(): Bank {
  const Constructor = contextConstructor();
  let context: AudioContext | undefined;
  let gain: GainNode | undefined;
  let sounds = new Map<number, Uint8Array>();
  const decoded = new Map<number, AudioBuffer>();
  const decoding = new Set<number>();
  /** When each sound last started, for the re-trigger guard. */
  const startedAt = new Map<number, number>();
  let exclusive: AudioBufferSourceNode | undefined;

  const bank: Bank = {
    available: Constructor !== undefined,
    muted: false,

    load(next) {
      sounds = next;
      decoded.clear();
      decoding.clear();
      startedAt.clear();
    },

    unlock() {
      if (!Constructor) return;
      if (!context) {
        context = new Constructor();
        gain = context.createGain();
        gain.gain.value = VOLUME;
        gain.connect(context.destination);
      }
      // Created before a gesture, or suspended by the tab going to the
      // background. Resuming a running context is harmless.
      void context.resume?.();
    },

    play(id) {
      start(id, false);
    },

    playExclusive(id) {
      start(id, true);
    },
  };

  function start(id: number | undefined, alone: boolean): void {
    if (id === undefined || bank.muted || !context || !gain) return;

    const buffer = decoded.get(id);
    if (buffer) {
      // The same sound twice within a blink is one event that reached us twice.
      const now = context.currentTime * 1_000;
      if (now - (startedAt.get(id) ?? -Infinity) < RETRIGGER_MS) return;
      startedAt.set(id, now);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      if (alone) {
        // `stop` on a node that already finished throws in some engines, and a
        // sound ending on its own is the common case rather than an error.
        try {
          exclusive?.stop();
        } catch {
          /* already finished */
        }
        exclusive = source;
        source.addEventListener?.('ended', () => {
          if (exclusive === source) exclusive = undefined;
        });
      }
      source.start();
      return;
    }

    const bytes = sounds.get(id);
    if (!bytes || decoding.has(id)) return;
    decoding.add(id);
    // `decodeAudioData` may detach the buffer it is given, so it gets a copy
    // and the resource stays intact for a later reload.
    const copy = bytes.slice().buffer as ArrayBuffer;
    void context
      .decodeAudioData(copy)
      .then((result) => {
        decoding.delete(id);
        decoded.set(id, result);
        // Play it now: this is the first tap of this kind, and staying silent
        // for it would read as the sound being missing rather than late.
        start(id, alone);
      })
      .catch(() => {
        // Not audio the browser understands. Forget it rather than retrying
        // on every placement, and let the extractor's --sounds listing be
        // where that gets diagnosed.
        decoding.delete(id);
        sounds.delete(id);
      });
  }

  return bank;
}
