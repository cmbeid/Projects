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
 */

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
  /** Called from a real user gesture; without this nothing ever sounds. */
  unlock(): void;
}

export function createBank(): Bank {
  const Constructor = contextConstructor();
  let context: AudioContext | undefined;
  let sounds = new Map<number, Uint8Array>();
  const decoded = new Map<number, AudioBuffer>();
  const decoding = new Set<number>();

  const bank: Bank = {
    available: Constructor !== undefined,
    muted: false,

    load(next) {
      sounds = next;
      decoded.clear();
      decoding.clear();
    },

    unlock() {
      if (!Constructor) return;
      context ??= new Constructor();
      // Created before a gesture, or suspended by the tab going to the
      // background. Resuming a running context is harmless.
      void context.resume?.();
    },

    play(id) {
      if (id === undefined || bank.muted || !context) return;

      const buffer = decoded.get(id);
      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
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
          bank.play(id);
        })
        .catch(() => {
          // Not audio the browser understands. Forget it rather than retrying
          // on every placement, and let the extractor's --sounds listing be
          // where that gets diagnosed.
          decoding.delete(id);
          sounds.delete(id);
        });
    },
  };

  return bank;
}
