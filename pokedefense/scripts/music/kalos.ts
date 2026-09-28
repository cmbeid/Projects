/**
 * Original tunes for Kalos. Pokémon X and Y's music is streamed audio, with
 * no note data to arrange, so these are new pieces written for this game in
 * the spirit of each place — a café waltz for Lumiose, an icy lilt for
 * Snowbelle — not the games' songs.
 *
 * Each piece gives its melody by hand and its chords bar by bar; the
 * harmony, bass and drums are built from the chords in a chosen style. See
 * `./score.ts` for the melody notation.
 */
import type { Score } from './score';

type HarmonyStyle = 'arp' | 'pad' | 'waltz' | 'pulse';
type BassStyle = 'root' | 'long' | 'drive' | 'walk' | 'waltz';

interface Piece {
  id: string;
  bpm: number;
  /** Beats to the bar: 4, or 3 for a waltz. */
  meter: 3 | 4;
  chords: string;
  lead: string;
  harmony: HarmonyStyle;
  bass: BassStyle;
  /** One bar of drums, repeated. */
  drums?: string;
  duty?: [number, number];
}

const NAMES = ['c', 'c+', 'd', 'e-', 'e', 'f', 'f+', 'g', 'a-', 'a', 'b-', 'b'];
const QUALITY: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 10], dim: [0, 3, 6] };

/** "F#m" → its root's pitch class and the chord's intervals. */
function chord(symbol: string): { root: number; tones: number[] } {
  const m = /^([A-G])([#b]?)(m|7|dim)?$/.exec(symbol);
  if (!m) throw new Error(`can't read chord ${symbol}`);
  const root = (NAMES.indexOf(m[1]!.toLowerCase()) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, tones: QUALITY[m[3] ?? '']! };
}

const note = (pitch: number, length: string): string => `o${Math.floor(pitch / 12) - 1} ${NAMES[pitch % 12]}${length}`;
/** The pitch of a pitch class at or above `floor`. */
const above = (pc: number, floor: number): number => floor + ((pc - floor) % 12 + 12) % 12;

function harmonyBar(style: HarmonyStyle, meter: 3 | 4, c: { root: number; tones: number[] }): string {
  const voice = c.tones.map((t) => above((c.root + t) % 12, 57));
  const [a, b, d] = [voice[0]!, voice[1]!, voice[2]!];
  switch (style) {
    case 'arp': {
      const cycle = [a, b, d, b];
      return Array.from({ length: meter * 2 }, (_, k) => note(cycle[k % 4]!, '8')).join(' ');
    }
    case 'pad': return meter === 4 ? `${note(b, '2')} ${note(d, '2')}` : note(b, '2.');
    case 'waltz': return `r4 ${note(b, '4')} ${note(d, '4')}`;
    case 'pulse': return Array.from({ length: meter * 2 }, (_, k) => note(k % 2 ? d : b, '8')).join(' ');
  }
}

function bassBar(style: BassStyle, meter: 3 | 4, c: { root: number; tones: number[] }): string {
  const root = above(c.root, 36);
  const fifth = root + 7;
  const third = root + c.tones[1]!;
  switch (style) {
    case 'root': return meter === 4 ? [root, root, fifth, root].map((p) => note(p, '4')).join(' ') : [root, fifth, fifth].map((p) => note(p, '4')).join(' ');
    case 'long': return note(root, meter === 4 ? '1' : '2.');
    case 'drive': return Array.from({ length: meter * 2 }, (_, k) => note(k % 2 ? root + 12 : root, '8')).join(' ');
    case 'walk': return [root, third, fifth, third].slice(0, meter).map((p) => note(p, '4')).join(' ');
    case 'waltz': return [root, fifth, fifth].map((p) => note(p, '4')).join(' ');
  }
}

function toScore(p: Piece): Score {
  const bars = p.chords.split(/[\s|]+/).filter(Boolean).map(chord);
  const quiet = p.harmony === 'arp' || p.harmony === 'pulse' ? 'v7 ~2' : 'v6';
  return {
    id: p.id,
    bpm: p.bpm,
    lead: `v11 [ ${p.lead}`,
    harmony: `${quiet} [ ${bars.map((c) => harmonyBar(p.harmony, p.meter, c)).join(' | ')}`,
    bass: `[ ${bars.map((c) => bassBar(p.bass, p.meter, c)).join(' | ')}`,
    ...(p.drums ? { drums: `[ (${p.drums})${bars.length}` } : {}),
    ...(p.duty ? { duty: p.duty } : {}),
  };
}

const PIECES: Piece[] = [
  {
    // Home: a gentle morning in a small town.
    id: 'k_vaniville', bpm: 92, meter: 4, harmony: 'arp', bass: 'root', drums: 'k4 h4 s4 h4',
    chords: 'F C Dm Bb | F C Bb C | Dm Am Bb F | Gm C F F',
    lead: `o5 c4 <a8 g8 f4 a4 | g4. a8 g4 e4 | f4 e8 f8 a4 d4 | f2 d4 r4 |
           >c4 <a8 >c8 f4 e8 d8 | c4. <b-8 g4 e4 | f4 g4 b-4 a4 | g2. r4 |
           a4 b-8 a8 f4 d4 | e4. f8 e4 c4 | d4 f4 b-4 a4 | a2 f4 r4 |
           g4 a8 b-8 >d4 c4 | <b-4 a4 g4 e4 | f4 a4 g4 e4 | f2. r4`,
  },
  {
    // A bright walk through the woods.
    id: 'k_santalune', bpm: 120, meter: 4, harmony: 'pulse', bass: 'walk', drums: 'k8 h8 h8 k8 s8 h8 h8 h8',
    chords: 'D D G A | Bm G A D | G A F#m Bm | G A D D',
    lead: `o5 d8 f+8 a8 f+8 d4 <a4 | b8 >d8 c+8 d8 <a2 | >d8 e8 d8 <b8 g4 b4 | a4. b8 >c+4 e4 |
           f+4 d8 <b8 >d4 f+4 | g4 f+8 e8 d4 <b4 | >c+8 d8 e8 f+8 e4 c+4 | d2. r4 |
           <b8 >d8 g8 d8 <b4 g4 | a8 >c+8 e8 c+8 <a4 e4 | f+4 a4 >c+4 <a4 | b2 f+4 d4 |
           g8 a8 b8 >d8 g4 f+8 e8 | e4 c+4 <a4 >c+4 | d4 f+4 a4 f+4 | d2. r4`,
  },
  {
    // Caves: Glittering Cave, Terminus Cave. Slow and echoing.
    id: 'k_cave', bpm: 84, meter: 4, harmony: 'pad', bass: 'long', drums: 'k4 r4 r4 h4',
    chords: 'Am Am F E | Am Am Dm E',
    lead: `o4 r4 e8 a8 >c4 <b4 | a2 r4 e4 | f4 a4 >c4 d4 | <b2. g+4 |
           a4 >c8 e8 a4 g+4 | a2 r4 e4 | f4 e4 d4 f4 | e2. r4`,
  },
  {
    // Shalour City and the Tower of Mastery: brisk and determined.
    id: 'k_shalour', bpm: 138, meter: 4, harmony: 'pulse', bass: 'drive', drums: 'k8 h8 s8 h8 k8 k8 s8 h8',
    chords: 'G D Em C | G D C D',
    lead: `o5 d8 d8 <b8 >d8 g4 d4 | f+8 f+8 e8 f+8 a4 f+4 | g8 f+8 e8 d8 e4 <b4 | >c8 d8 e8 g8 e4 c4 |
           d8 <b8 g8 b8 >d4 g4 | a8 g8 f+8 e8 d4 f+4 | e8 f+8 g8 a8 g4 e4 | f+4 d4 a4 r4`,
  },
  {
    // Route 12 and Coumarine: an easy seaside stroll.
    id: 'k_coumarine', bpm: 104, meter: 4, harmony: 'arp', bass: 'walk', drums: 'k4 h8 h8 s4 h8 k8',
    chords: 'C Am F G | C Am Dm G',
    lead: `o5 e4 g8 e8 c4 e4 | a4. g8 e2 | f4 a8 f8 c4 f4 | g4. f8 d2 |
           e4 g8 e8 >c4 <b4 | a4 e8 c8 e4 a4 | d4 f8 a8 >c4 <a4 | g2. r4`,
  },
  {
    // Lumiose City: an accordion waltz at a pavement café.
    id: 'k_lumiose', bpm: 150, meter: 3, harmony: 'waltz', bass: 'waltz', drums: 'k4 h4 h4', duty: [1, 2],
    chords: 'Am Am E E | E7 E Am Am | Dm Dm Am Am | E E Am Am',
    lead: `o4 e4 a8 g+8 a8 b8 | >c4 <b4 a4 | g+4 b8 a8 g+8 f+8 | e2. |
           d4 f8 e8 d8 e8 | b4 g+4 e4 | a4 >c8 <b8 a8 g+8 | a2. |
           f4 a8 g8 f8 e8 | d4 f4 a4 | e4 a8 g+8 a8 >c8 | e2 <a4 |
           b4 >d8 c8 <b8 a8 | g+4 e4 f+8 g+8 | a4 >c4 e4 | <a2 r4`,
  },
  {
    // Laverre City: a fairy-tale music box.
    id: 'k_laverre', bpm: 100, meter: 4, harmony: 'arp', bass: 'long', drums: 'h8 h8 h8 h8 h8 h8 t8 h8', duty: [1, 0],
    chords: 'G Em C D | G Bm C D',
    lead: `o5 b8 a8 g8 a8 b4 >d4 | <e4. d8 <b2 | >c8 d8 e8 g8 e4 c4 | d4. e8 d4 <a4 |
           b8 >d8 g8 d8 b4 a4 | f+4. d8 <b2 | >c4 e4 g4 e4 | d2. r4`,
  },
  {
    // Anistar City and its sundial: mysterious.
    id: 'k_anistar', bpm: 90, meter: 4, harmony: 'arp', bass: 'long', drums: 'k4 r8 h8 r4 h4',
    chords: 'Dm Bb Gm A | Dm Bb Gm A',
    lead: `o4 d8 f8 a8 >d8 c4 <a4 | b-4. a8 f2 | g8 b-8 >d8 g8 f4 d4 | e2 c+4 <a4 |
           d8 f8 a8 >d8 f4 e4 | d4. c8 <b-2 | g4 b-4 >d4 c4 | c+2. r4`,
  },
  {
    // Snowbelle City and Frost Cavern: cold and still.
    id: 'k_snowbelle', bpm: 80, meter: 4, harmony: 'arp', bass: 'long', drums: 'h4 r4 h4 r4', duty: [1, 1],
    chords: 'Em C G D | Em C B B',
    lead: `o5 e4 g4 b4 a8 g8 | e2 g4 e4 | d4 g4 b4 >d4 | <a2 f+4 d4 |
           e4 g4 b4 >e4 | d8 c8 <b8 a8 g4 e4 | f+4 b4 d+4 f+4 | b2. r4`,
  },
  {
    // Victory Road and the League: a march.
    id: 'k_league', bpm: 126, meter: 4, harmony: 'pulse', bass: 'drive', drums: 'k8 k8 s8 h8 k8 k8 s8 s8',
    chords: 'Cm Ab Bb Cm | Cm Ab Bb G',
    lead: `o4 g8 g8 >c8 d8 e-4 c4 | e-8 f8 e-8 c8 <a-4 >c4 | d8 e-8 f8 d8 <b-4 >d4 | c2. r4 |
           g8 g8 f8 e-8 g4 >c4 | <a-4. g8 f4 e-4 | d8 e-8 f8 g8 f4 d4 | <b2 >d4 <b4`,
  },
  {
    // Inside a Gym.
    id: 'k_gym', bpm: 128, meter: 4, harmony: 'pulse', bass: 'root', drums: 'k8 h8 s8 h8 k8 k8 s8 h8',
    chords: 'Am F G Am | Am F G E',
    lead: `o5 a8 r8 a8 g8 a4 e4 | f8 r8 f8 e8 f4 c4 | g8 r8 g8 f8 g4 d4 | e8 a8 b8 >c8 <b4 a4 |
           a8 r8 a8 g8 a4 e4 | f8 r8 f8 e8 f4 c4 | g8 r8 g8 f8 g4 d4 | g+2 b4 e4`,
  },
  {
    // Battling a Gym Leader or the Elite Four.
    id: 'k_gymbattle', bpm: 168, meter: 4, harmony: 'arp', bass: 'drive', drums: 'k8 h8 s8 h8 k8 k8 s8 h8',
    chords: 'Em Em C D | Em Em C B | Am Am Em Em | C D B B',
    lead: `o5 e8 e8 e8 b8 a8 g8 f+8 g8 | e4 b4 >e4 d4 | c8 c8 c8 <g8 e8 g8 >c8 d8 | d4. c8 <a4 f+4 |
           e8 e8 e8 b8 a8 g8 f+8 g8 | e4 g4 b4 >e4 | d8 c8 <b8 a8 g4 e4 | f+2 d+4 f+4 |
           a8 a8 >c8 <a8 e4 a4 | g8 f8 e8 d8 c4 e4 | b8 b8 g8 e8 b4 >e4 | d4 <b4 g4 e4 |
           c8 e8 g8 >c8 <b4 g4 | a8 f+8 d8 f+8 a4 >d4 | <b8 a8 g8 f+8 d+4 f+4 | b2. r4`,
  },
  {
    // The Champion.
    id: 'k_champion', bpm: 176, meter: 4, harmony: 'arp', bass: 'drive', drums: 'k8 s8 k8 s8 k8 k8 s8 s8',
    chords: 'Dm Dm Bb C | Dm Dm Bb A | Gm Gm Dm Dm | Bb C A A',
    lead: `o5 d8 d8 a8 d8 >c8 d8 <a8 f8 | d4 f4 a4 >d4 | c8 <b-8 a8 f8 d4 f4 | g8 a8 b-8 >c8 <g4 e4 |
           d8 d8 a8 d8 >c8 d8 <a8 f8 | d4 a4 f4 d4 | f8 g8 a8 b-8 >d4 c4 | <c+2. e4 |
           g8 g8 b-8 g8 >d8 c8 <b-8 a8 | g4 b-4 >d4 g4 | f8 e8 d8 <a8 f4 a4 | d2 f4 a4 |
           b-8 a8 g8 f8 g4 b-4 | >c8 <b-8 a8 g8 e4 g4 | a8 g8 f8 e8 c+4 e4 | a2. r4`,
  },
  {
    // A legendary Pokémon: Zygarde, Xerneas, Yveltal.
    id: 'k_legend', bpm: 150, meter: 4, harmony: 'pulse', bass: 'drive', drums: 'k4 k8 s8 k4 s4',
    chords: 'Fm Db Eb C | Fm Db Eb C',
    lead: `o4 f4 a-4 >c4 d-4 | c2 <a-4 f4 | g4 b-4 >e-4 <b-4 | >c2 e4 g4 |
           a-4 g8 f8 e-4 c4 | d-4 f4 a-4 f4 | e-4 g4 b-4 >e-4 | <c2 <g4 e4`,
  },
  {
    // After a win.
    id: 'k_victory', bpm: 120, meter: 4, harmony: 'arp', bass: 'root', drums: 'k4 h4 s4 h4',
    chords: 'C F G C',
    lead: 'o5 c8 e8 g8 >c8 <g4 e4 | f8 a8 >c8 f8 e4 c4 | <d8 g8 b8 >d8 <b4 g4 | c2. r4',
  },
];

export const KALOS_SCORES: ReadonlyMap<string, Score> = new Map(PIECES.map((p) => [p.id, toScore(p)]));
