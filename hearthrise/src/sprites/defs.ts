/**
 * Every sprite in the game, as pixel art written out by hand — or, for the
 * few big buildings, drawn by a few lines of code.
 *
 * A sprite is a grid of characters, one per pixel, and a palette that maps
 * each character to a colour ('.' is transparent). Most templates use the
 * digits 1–3 for "the material's dark, mid and light", and buildings use
 * A C D for the roof and I H L for the walls, so one template becomes many
 * sprites by palette swap — the colours come from `src/data`, not from here.
 *
 * `scripts/bake-sprites.ts` turns this into `atlas.png` + `atlas.json`. Edit
 * here, then run `npm run bake`.
 */
import { BUILDINGS } from '../data/buildings';
import { DISTRICTS } from '../data/districts';
import { MATERIALS, MATERIAL } from '../data/materials';
import { REGALIA } from '../data/regalia';
import type { Shades } from '../data/types';

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  /** Row-major RGBA colours as '#rrggbb', or null for transparent. */
  px: (string | null)[];
}

type Palette = Record<string, string>;

const OUTLINE = '#1a1210';

const BASE: Palette = {
  o: OUTLINE,
  w: '#6a4424',
  x: '#8f5f34',
  m: '#3e4250',
  n: '#8a8a90',
  M: '#c8c8cc',
  y: '#ffe08a',
  Y: '#fff6c8',
  r: '#b02a2a',
  R: '#ff6a5a',
  s: '#e8b088',
  S: '#b07850',
  e: '#2a2030',
  b: '#5a3418',
  J: '#3a6a5a',
  j: '#28483e',
  P: '#4a3a2a',
  B: '#22160c',
  f: '#ff8a1a',
  F: '#fff0a0',
  p: '#e8dcb8',
  q: '#a89870',
  v: '#8a7aff',
  V: '#e0d8ff',
  k: '#0e0a0a',
  K: '#ffffff',
  g: '#3a8a3a',
  G: '#9ae07a',
  t: '#2a7aa8',
  T: '#9ae0ff',
};

function make(name: string, rows: readonly string[], palette: Palette = {}): SpriteDef {
  const h = rows.length;
  const w = rows[0]!.length;
  const pal = { ...BASE, ...palette };
  const px: (string | null)[] = [];
  for (const row of rows) {
    if (row.length !== w) throw new Error(`${name}: row "${row}" is ${row.length} wide, expected ${w}`);
    for (const ch of row) {
      if (ch === '.') px.push(null);
      else {
        const c = pal[ch];
        if (!c) throw new Error(`${name}: no colour for '${ch}'`);
        px.push(c);
      }
    }
  }
  return { name, w, h, px };
}

const shades = (s: Shades): Palette => ({ '1': s[0], '2': s[1], '3': s[2] });

/** Mixes a colour toward black (negative) or white (positive). */
function tone(hex: string, by: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(by < 0 ? c * (1 + by) : c + (255 - c) * by));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function buildingPalette(roof: string, wall: string): Palette {
  return { A: tone(roof, -0.35), C: roof, D: tone(roof, 0.3), I: tone(wall, -0.3), H: wall, L: tone(wall, 0.25) };
}

// --- Shared with Hollowdeep: generic items and icons ---------------------------------------

const CRACKS = [
  [
    '................',
    '................',
    '................',
    '........k.......',
    '.......k........',
    '.......k........',
    '......kk........',
    '.......k........',
    '........k.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '.........k......',
    '........k.......',
    '........k.......',
    '.......k........',
    '.......k...k....',
    '......kkkkk.....',
    '.....k.k........',
    '....k...k.......',
    '...k.....k......',
    '..........k.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '..k......k......',
    '...k....k.......',
    '....k...k.......',
    '.....k.k......k.',
    '......kk...k.k..',
    '..kk..kkkkkk....',
    '....kkk.k.......',
    '....k...k....k..',
    '...k.....k..k...',
    '..k.......kk....',
    '.k.......k..k...',
    '........k....k..',
    '.......k......k.',
    '................',
    '................',
  ],
];

const ORE_CHUNK = [
  '................',
  '................',
  '................',
  '......oooo......',
  '....oo2332oo....',
  '...o22322221o...',
  '..o2221122321o..',
  '..o2322212221o..',
  '..o1222233221o..',
  '..o2212222211o..',
  '...o12221111o...',
  '....oo1111oo....',
  '......oooo......',
  '................',
  '................',
  '................',
];

const GEM = [
  '................',
  '................',
  '.......oo.......',
  '......o33o......',
  '.....o3332o.....',
  '....o332222o....',
  '...o33222221o...',
  '...o32222211o...',
  '...o22222111o...',
  '....o222211o....',
  '.....o2211o.....',
  '......o21o......',
  '.......oo.......',
  '................',
  '................',
  '................',
];

const BAR = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....oooooooo....',
  '...o33333332o...',
  '...o32222221o...',
  '..o3222222221o..',
  '..o3222222221o..',
  '.o322222222221o.',
  '.o111111111111o.',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
];

const ESSENCE = [
  '................',
  '................',
  '......oooo......',
  '....oo3333oo....',
  '...o33222222o...',
  '..o3322112222o..',
  '..o3221331222o..',
  '..o2213333122o..',
  '..o2221331221o..',
  '..o2222112211o..',
  '...o22222211o...',
  '....oo1111oo....',
  '......oooo......',
  '................',
  '................',
  '................',
];

const LANTERN = [
  '......oooo......',
  '.....o....o.....',
  '....oooooooo....',
  '....o333332o....',
  '...o12222221o...',
  '...o2yyyyyy2o...',
  '...o2yyffyy2o...',
  '...o2yfFFfy2o...',
  '...o2yfFFfy2o...',
  '...o2yyffyy2o...',
  '...o2yyyyyy2o...',
  '...o12222221o...',
  '....o111111o....',
  '.....oooooo.....',
  '................',
  '................',
];

const ARMOR = [
  '................',
  '..ooo......ooo..',
  '.o332o....o332o.',
  '.o3222oooo2222o.',
  '.o222223322221o.',
  '..o2222332221o..',
  '...o22222221o...',
  '...o21222212o...',
  '...o22222221o...',
  '...o21222212o...',
  '...o22222221o...',
  '...o11111111o...',
  '....oooooooo....',
  '................',
  '................',
  '................',
];

const CHARM = [
  '................',
  '....oooooooo....',
  '...oy......yo...',
  '..oy........yo..',
  '..oy........yo..',
  '...oy......yo...',
  '....oy....yo....',
  '.....oyooyo.....',
  '......o33o......',
  '.....o3322o.....',
  '.....o3221o.....',
  '.....o2211o.....',
  '......o21o......',
  '.......oo.......',
  '................',
  '................',
];

const DYNAMITE = [
  '................',
  '...........F....',
  '..........fYf...',
  '...........F....',
  '..........o.....',
  '.........o......',
  '....oooooooo....',
  '...orrRrrRrro...',
  '...orrRrrRrro...',
  '...oppppppppo...',
  '...orrRrrRrro...',
  '...orrRrrRrro...',
  '...orrRrrRrro...',
  '....oooooooo....',
  '................',
  '................',
];

const FLASK = [
  '................',
  '......oooo......',
  '......owwo......',
  '......oMMo......',
  '......oMMo......',
  '.....oMMMMo.....',
  '....oM2222Mo....',
  '...oM233222Mo...',
  '...o22322222o...',
  '...o22222222o...',
  '...o12222221o...',
  '....o111111o....',
  '.....oooooo.....',
  '................',
  '................',
  '................',
];

const FILTER = [
  '................',
  '.....oooooo.....',
  '...ooMnnnnMoo...',
  '..oMnmnmnmnnMo..',
  '..onmnmnmnmnno..',
  '.oMnmnmnmnmnnMo.',
  '.onmnmnmnmnmnno.',
  '.onnmnmnmnmnmno.',
  '.onmnmnmnmnmnno.',
  '.oMnnmnmnmnmnMo.',
  '..onnmnmnmnmno..',
  '..oMnnmnmnmnMo..',
  '...ooMnnnnMoo...',
  '.....oooooo.....',
  '................',
  '................',
];

const CHUTE = [
  '................',
  '..oooooooooooo..',
  '..oMnnnnnnnnMo..',
  '...onnnnnnnno...',
  '....onnnnnno....',
  '.....onnnno.....',
  '......onno......',
  '......onno......',
  '......onno......',
  '...oooooooooo...',
  '...oyyyyyyyyo...',
  '..oyYyyyyyyyyo..',
  '..oyyyyyyyyyyo..',
  '...oooooooooo...',
  '................',
  '................',
];

const LENS = [
  '................',
  '................',
  '.....oooooo.....',
  '...ooyyyyyyoo...',
  '..oyyVVVVVVyyo..',
  '.oyVVvvvvvvVVyo.',
  '.oyVvvoooovvVyo.',
  '.oyVvvoKKovvVyo.',
  '.oyVvvoKKovvVyo.',
  '.oyVvvoooovvVyo.',
  '.oyVVvvvvvvVVyo.',
  '..oyyVVVVVVyyo..',
  '...ooyyyyyyoo...',
  '.....oooooo.....',
  '................',
  '................',
];

const COIN = [
  '................',
  '................',
  '.....oooooo.....',
  '...ooyyyyyyoo...',
  '..oyYYyyyyyyyo..',
  '..oYyyoooooyyo..',
  '.oyYyoyyyyyoyyo.',
  '.oyYyoyYYyyoyyo.',
  '.oyyyoyYyyyoyyo.',
  '.oyyyoyyyyyoyyo.',
  '..oyyyoooooyyo..',
  '..oyyyyyyyyyyo..',
  '...ooyyyyyyoo...',
  '.....oooooo.....',
  '................',
  '................',
];

const ECHO = [
  '................',
  '.....oooooo.....',
  '...oovvvvvvoo...',
  '..ovvVVVVVVvvo..',
  '.ovVVvvvvvvVvo..',
  '.ovVvvoooovVvvo.',
  '.ovVvoVVVVovVvo.',
  '.ovVvoVvvVovVvo.',
  '.ovVvoVvoVovVvo.',
  '.ovVvoVvvvovVvo.',
  '.ovVvvoooovvVvo.',
  '..ovVVvvvvVVvo..',
  '..oovvVVVVvvoo..',
  '....oovvvvoo....',
  '......oooo......',
  '................',
];

const STAR = [
  '................',
  '.......oo.......',
  '......oYYo......',
  '......oYyo......',
  '.....oYYyyo.....',
  'oooooYYyyyyooooo',
  'oYYYYYYyyyyyyyyo',
  '.oyyYYyyyyyyyyo.',
  '..oyyyyyyyyyyo..',
  '...oyyyyyyyyo...',
  '...oyyyoyyyyo...',
  '..oyyyo.oyyyyo..',
  '..oyyo...ooyyo..',
  '.oyyo......oyyo.',
  '.ooo........ooo.',
  '................',
];

const BOLT = [
  '................',
  '.........oooo...',
  '........oYYyo...',
  '.......oYYyo....',
  '......oYYyo.....',
  '.....oYYyo......',
  '....oYYyyoooo...',
  '...oYYyyyyyyo...',
  '...ooooYYyyo....',
  '......oYyyo.....',
  '.....oYyyo......',
  '....oYyyo.......',
  '....oyyo........',
  '...oyyo.........',
  '...ooo..........',
  '................',
];

const UP = [
  '................',
  '.......oo.......',
  '......oGGo......',
  '.....oGGGGo.....',
  '....oGGGGGGo....',
  '...oGGGGGGGGo...',
  '..ooooGGGGoooo..',
  '.....oGGGGo.....',
  '.....oGggGo.....',
  '.....oGggGo.....',
  '.....oGggGo.....',
  '.....oGggGo.....',
  '.....oooooo.....',
  '................',
  '................',
  '................',
];

const ANVIL = [
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '.onMMMMMMMMMMno.',
  'onnnnnnnnnnnnoo.',
  '.oonnnnnnnnoo...',
  '...onnnnnnno....',
  '....onnnnno.....',
  '....ommmmmo.....',
  '...ommmmmmmo....',
  '..ommmmmmmmmo...',
  '..ooooooooooo...',
  '................',
  '................',
  '................',
];

const SCROLL = [
  '................',
  '..oooooooooooo..',
  '.oqppppppppppqo.',
  '.oqoooooooooqo..',
  '..oppppppppppo..',
  '..opqqqqqqqqpo..',
  '..oppppppppppo..',
  '..opqqqqqqqppo..',
  '..oppppppppppo..',
  '..opqqqqqqqqpo..',
  '..oppppppppppo..',
  '..opqqqqqppppo..',
  '.oqoooooooooqo..',
  '.oqppppppppppqo.',
  '..oooooooooooo..',
  '................',
];

const FULLSCREEN = [
  '................',
  '.oooooo..oooooo.',
  '.oMMMMo..oMMMMo.',
  '.oMnooo..oooMno.',
  '.oMo........oMo.',
  '.oMo........oMo.',
  '.ooo........ooo.',
  '................',
  '................',
  '.ooo........ooo.',
  '.oMo........oMo.',
  '.oMo........oMo.',
  '.oMnooo..oooMno.',
  '.oMMMMo..oMMMMo.',
  '.oooooo..oooooo.',
  '................',
];

const EXIT_FULLSCREEN = [
  '................',
  '....ooo..ooo....',
  '....oMo..oMo....',
  '....oMo..oMo....',
  '.ooooMo..oMoooo.',
  '.oMMMno..onMMMo.',
  '.oooooo..oooooo.',
  '................',
  '................',
  '.oooooo..oooooo.',
  '.oMMMno..onMMMo.',
  '.ooooMo..oMoooo.',
  '....oMo..oMo....',
  '....oMo..oMo....',
  '....ooo..ooo....',
  '................',
];

const COG = [
  '................',
  '.......oo.......',
  '...oo.onno.oo...',
  '..onnoonnoonno..',
  '..onnnnnnnnnno..',
  '...onnnoonnno...',
  '.oonnnoMMonnnoo.',
  'onnnnoM..MonnnnO',
  'onnnnoM..Monnnno',
  '.oonnnoMMonnnoo.',
  '...onnnoonnno...',
  '..onnnnnnnnnno..',
  '..onnoonnoonno..',
  '...oo.onno.oo...',
  '.......oo.......',
  '................',
];

const CART = [
  '................',
  '................',
  '................',
  '.......o.o......',
  '......o3o2o.....',
  '.....o23o32o....',
  '.oooooooooooooo.',
  '.onMnnnnnnnnMno.',
  '..onnnnnnnnnno..',
  '..onmmmmmmmmno..',
  '...onnnnnnnno...',
  '...oooooooooo...',
  '....omo..omo....',
  '....ooo..ooo....',
  '................',
  '................',
];

const BELLOWS = [
  '................',
  '................',
  '.oooo...........',
  'owwwwoo.........',
  'owxxxwwoo.......',
  'owxxxxxwwooooo..',
  'owxxxxxxxwMMMMoo',
  'oppqpqpqpqoMMoff',
  'owxxxxxxxwMMMMoo',
  'owxxxxxwwooooo..',
  'owxxxwwoo.......',
  'owwwwoo.........',
  '.oooo...........',
  '................',
  '................',
  '................',
];

const GLOVE = [
  '................',
  '.....o.o.o......',
  '....owowowo.....',
  '....owowowoo....',
  '....owowowowo...',
  '....owowowowo...',
  '..o.owwwwwwwo...',
  '.owoowwwwwwwo...',
  '.owwowwwwwwwo...',
  '..owwwwwwwwwo...',
  '...owwwwwwwo....',
  '....owwwwwo.....',
  '....oyyyyyo.....',
  '....oyyyyyo.....',
  '....ooooooo.....',
  '................',
];

const WRENCH = [
  '................',
  '..........ooo...',
  '.........onnno..',
  '..........onMo..',
  '.....o....onMo..',
  '....onooonnno...',
  '.....onMnnno....',
  '......onnno.....',
  '.....onnno......',
  '....onnno.......',
  '...onnno........',
  '..onnno.........',
  '.oMnno..........',
  '.onno...........',
  '..oo............',
  '................',
];

const FIST = [
  '................',
  '.........F......',
  '..F.....FYF..F..',
  '...F.....F..F...',
  '................',
  '.....oooooo.....',
  '....osssssso....',
  '...osSsSsSsso...',
  '...ossssssssO...',
  '...oSsSsSsSso...',
  '...osssssssso...',
  '....osssssso....',
  '....oJJJJJJo....',
  '....ojjjjjjo....',
  '....oooooooo....',
  '................',
];

const ROD = [
  '................',
  '...........oo...',
  '..........oTTo..',
  '.........oTKTo..',
  '..........oTo...',
  '.........owo.T..',
  '........owo...T.',
  '.......owo......',
  '......owo....T..',
  '.....owo........',
  '....owo.........',
  '...owo..........',
  '..owo...........',
  '.owo............',
  '.oo.............',
  '................',
];

const MINER = [
  '................',
  '.....oooooo.....',
  '....oyyyyyyo....',
  '...oyYYyyyyyoo..',
  '...oyyyyyyyyFYo.',
  '..oooooooooooo..',
  '....osssssso....',
  '....osssesso....',
  '....osssssSo....',
  '.....obbbbbo....',
  '....oJJJJJJo....',
  '...oJJjJJJJJo...',
  '...oJJjJJJJsso..',
  '...oJJjJJJJsso..',
  '...oJJjJJJJJo...',
  '...oJJjJJJJJo...',
  '...oBBBBBBBBo...',
  '....oPPPoPPPo...',
  '....oPPPoPPPo...',
  '....oPPPoPPPo...',
  '....oPPo.oPPo...',
  '...obbbo.obbbo..',
  '...ooooo.ooooo..',
  '................',
];

// --- Buildings ---------------------------------------------------------------------
//
// Letters: A C D are the roof (dark, mid, light), I H L the walls (dark, mid,
// light), from the building's `art` colours. Everything else is the base
// palette: e window dark, y window lit, b door, g G greenery, t T water.

const TENT = [
  '................',
  '................',
  '................',
  '................',
  '.......oo.......',
  '......oDCo......',
  '.....oDCCAo.....',
  '....oDCCCCAo....',
  '...oDCCCbCCAo...',
  '..oDCCCbebCCAo..',
  '.oDCCCCbeebCCAo.',
  'oDCCCCCbeebCCCAo',
  'oooooooooooooooo',
  '.x............x.',
  '................',
  '................',
];

const YARD = [
  '................',
  '................',
  '................',
  '................',
  '............o...',
  '...........oxo..',
  '..........oxo...',
  '...ooo...oxo....',
  '..oMnno.oxo.....',
  '.onnnMnoxo..oo..',
  'onMnnnnnno.oCCo.',
  'onnnMnnnnnoCCCCo',
  'oooooooooooAAAAo',
  '..........ob..bo',
  '...........oo.oo',
  '................',
];

const STALL = [
  '................',
  '................',
  '................',
  '................',
  'oooooooooooooooo',
  'oDDLLDDLLDDLLDDo',
  'oCCHHCCHHCCHHCCo',
  'oAAIIAAIIAAIIAAo',
  '.oxooooooooooxo.',
  '.ox..........xo.',
  '.ox..........xo.',
  '.oooooooooooooo.',
  '.oHHHHHHHHHHHHo.',
  '.oIIIIIIIIIIIIo.',
  '.oooooooooooooo.',
  '................',
];

const GARDEN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.x...x...x...x..',
  'oxooox.oox.ooxo.',
  'xCDCxGCDxCGDCxC.',
  'CDCGDCCGDCDCGDC.',
  'gCgDgCgCgDgCgCg.',
  'bgbgbgbgbgbgbgbg',
  'gbgbgbgbgbgbgbgb',
  'bgbgbgbgbgbgbgbg',
  'gbgbgbgbgbgbgbgb',
  'oooooooooooooooo',
  '................',
];

const WORKS = [
  '................',
  '..oo............',
  '..oIo...........',
  '..oIo...........',
  '..oIooooooooo...',
  '.ooIDDDDDDDDDo..',
  'oDDDDCCCCCCCCCo.',
  'oCCCCCCCCCCCCCAo',
  'oooooooooooooooo',
  'oHHHHHHHHHHHHHHo',
  'oHyyHHbbbbHHyyHo',
  'oHyyHHbffbHHyyHo',
  'oHHHHHbffbHHHHHo',
  'oIIIIIbbbbIIIIIo',
  'oooooooooooooooo',
  '................',
];

const WELL = [
  '................',
  '................',
  '.....oooooo.....',
  '....oDDCCCAo....',
  '...oDCCCCCCAo...',
  '...oooooooooo...',
  '....ox....xo....',
  '....ox.oo.xo....',
  '....ox.oo.xo....',
  '...ooooooooooo..',
  '..oLLHLLHLLHLLo.',
  '..oHHtTTTTtHHIo.',
  '..oHHHHHHHHHHIo.',
  '..oIIIIIIIIIIIo.',
  '..ooooooooooooo.',
  '................',
];

const COTTAGE = [
  '................',
  '................',
  '................',
  '..........ooo...',
  '......oo..oIo...',
  '.....oDCo.oIo...',
  '....oDCCCooIo...',
  '...oDCCCCCCAo...',
  '..oDCCCCCCCCAo..',
  '.oDCCCCCCCCCCAo.',
  'oooooooooooooooo',
  '.oLHHHHHHHHHHHo.',
  '.oHyyHHbbHHyyIo.',
  '.oHyyHHbbHHyyIo.',
  '.oIIIIIbbIIIIIo.',
  '.oooooooooooooo.',
];

const CRANE = [
  'oooooooooooooo..',
  'oCDCDCDCDCDCDCo.',
  'oooooooxoooooo..',
  '..o...oxo.....o.',
  '..o...oxo.....o.',
  '..o...oxo....oo.',
  '.....oCCCo...oMo',
  '.....oCyCo...oo.',
  '.....oCCCo......',
  '......oxo.......',
  '......oxo.......',
  '.....oxxxo......',
  '....oxoxoxo.....',
  '...oxo.x.oxo....',
  '..oAAAAAAAAAo...',
  '..ooooooooooo...',
];

const HALL = [
  '................',
  '................',
  '................',
  '.......oo.......',
  '......oDDo......',
  '....ooDCCAoo....',
  '..ooDDCCCCAAoo..',
  'ooDDCCCCCCCCAAoo',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oHeeHHeeHHeeHHHo',
  'oHeeHHeeHHeeHHIo',
  'oHHHHHHbbHHHHHIo',
  'oIIIIIIbbIIIIIIo',
  'oooooooooooooooo',
  '................',
];

const TOWER = [
  '......oooo......',
  '.....oDCCAo.....',
  '....oDCCCCAo....',
  '....oooooooo....',
  '.....oyyyyo.....',
  '.....oyYYyo.....',
  '....oooooooo....',
  '.....oLHHIo.....',
  '.....oLHeIo.....',
  '.....oLHHIo.....',
  '.....oLHHIo.....',
  '....oLHHeHIo....',
  '....oLHHHHIo....',
  '...oLHHbbHHIo...',
  '...oIIIbbIIIo...',
  '...oooooooooo...',
];

const CHAPEL = [
  '.......oo.......',
  '.......yo.......',
  '......oyyo......',
  '......oCAo......',
  '.....oDCCAo.....',
  '....oDCCCCAo....',
  '...oDCCCCCCAo...',
  '..oDCCCCCCCCAo..',
  '.oooooooooooooo.',
  '.oLHHHHHHHHHHIo.',
  '.oLHHyyHHyyHHIo.',
  '.oLHHyyHHyyHHIo.',
  '.oLHHHHbbHHHHIo.',
  '.oIIIIIbbIIIIIo.',
  '.oooooooooooooo.',
  '................',
];

const DREDGER = [
  '................',
  '................',
  '...........oo...',
  '..........oxxo..',
  '.....oo..oxo.o..',
  '....oIIo.oxo.o..',
  '....oIIooxo..oo.',
  '..ooooooxo..oMMo',
  '.oCCCCCCCo...oo.',
  '.oCyCCyCCo......',
  'oooooooooooooo..',
  'oHHHHHHHHHHHHHo.',
  'oIIIIIIIIIIIIo..',
  'tooooooooooooTtt',
  'TtTtTtTtTtTtTtTt',
  'tTtTtTtTtTtTtTtT',
];

const TALL = [
  '.....oooooo.....',
  '....oDCCCCAo....',
  '...oDCCCCCCAo...',
  '..oooooooooooo..',
  '..oLHHHHHHHHIo..',
  '..oLyyHyyHyyIo..',
  '..oLHHHHHHHHIo..',
  '..oLeeHyyHeeIo..',
  '..oLHHHHHHHHIo..',
  '..oLyyHeeHyyIo..',
  '..oLHHHHHHHHIo..',
  '..oLyyHHHHyyIo..',
  '..oLHHHbbHHHIo..',
  '..oIIIIbbIIIIo..',
  '..oooooooooooo..',
  '................',
];

const FOUNTAIN = [
  '................',
  '................',
  '.......TT.......',
  '......T..T......',
  '.....T.oo.T.....',
  '.....T.CC.T.....',
  '......oCCo......',
  '.......nn.......',
  '..oooooooooooo..',
  '.oMnnnnnnnnnnMo.',
  'onTtTtCDCtTtTtno',
  'onTtTtTCtTtTtTno',
  'onTtTtTtTtTtTtno',
  '.oMnnnnnnnnnnMo.',
  '..oooooooooooo..',
  '................',
];

const DOME = [
  '................',
  '.......oo.......',
  '.....ooCDoo.....',
  '....oCCCCDDo....',
  '...oCCCCCCCDo...',
  '...oACCCCCCCo...',
  '..oooooooooooo..',
  '.oLLLLLLLLLLLLo.',
  '.oLoHoHoHoHoIIo.',
  '.oLoHoHoHoHoIIo.',
  '.oLoHoHoHoHoIIo.',
  '.oLHHHHbbHHHHIo.',
  '.oIIIIIbbIIIIIo.',
  'oooooooooooooooo',
  'oMMMMMMMMMMMMMMo',
  'oooooooooooooooo',
];

const BLOCK = [
  '.oooooooooooooo.',
  '.oAAAAAAAAAAAAo.',
  '.oooooooooooooo.',
  '.oLHHHHHHHHHHIo.',
  '.oLyyHeeHyyHHIo.',
  '.oLHHHHHHHHHHIo.',
  '.oLeeHyyHeeHHIo.',
  '.oLHHHHHHHHHHIo.',
  '.oLyyHyyHeeHHIo.',
  '.oLHHHHHHHHHHIo.',
  '.oLeeHeeHyyHHIo.',
  '.oLHHHHHHHHHHIo.',
  '.oLHHHHbbHHHHIo.',
  '.oIIIIIbbIIIIIo.',
  '.oooooooooooooo.',
  '................',
];

const SHOVEL = [
  '................',
  '..........oo....',
  '.........oxxo...',
  '........oxo.o...',
  '.......oxo..oo..',
  '......oxo..oCCo.',
  '.....oxo..oCCCo.',
  '....oxo....oooo.',
  '..ooooooo.......',
  '.oCCCCCCCooo....',
  '.oCyyCCCCoIo....',
  'ooooooooooooooo.',
  'oIoIoIoIoIoIoIo.',
  'oooooooooooooooo',
  'oMoMoMoMoMoMoMoo',
  '.ooooooooooooo..',
];

// Two tiles wide.
const LONGHALL = [
  '................................',
  '................................',
  '..............oooo..............',
  '.............oDCCAo.............',
  '..........oooDCCCCAooo..........',
  '.......oooDDDCCCCCCAAAooo.......',
  '....oooDDDCCCCCCCCCCCCAAAooo....',
  '.oooDDDCCCCCCCCCCCCCCCCCCAAAooo.',
  'oooooooooooooooooooooooooooooooo',
  'oLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLo',
  'oHoHoyyHoHoyyHoHbbHoHoyyHoHoyyIo',
  'oHoHoyyHoHoyyHoHbbHoHoyyHoHoyyIo',
  'oHoHoHHHoHoHHHoHbbHoHoHHHoHoHHIo',
  'oIIIIIIIIIIIIIIIbbIIIIIIIIIIIIIo',
  'oooooooooooooooooooooooooooooooo',
  'oMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMo',
];

const PARK = [
  '................................',
  '................................',
  '....ooo...........ooo...........',
  '...oGGGo.........oGGGo......oo..',
  '..oGGgGGo.......oGgGGGo....oGGo.',
  '..oGgggGo.......oGggGGo...oGggGo',
  '...oggggo........oggggo...oGgggo',
  '....oxxo..........oxxo.....oggo.',
  '.....xx............xx.......xx..',
  'gGgGgxxgGgGgGgGgGgGxxgGgGgGgxxgG',
  'GgGgGgGgGgtTtTtTtTtGgGgGgGgGgGgG',
  'gGgGgGgtTtTtTtTtTtTtTgGgGgGgGgGg',
  'GgGgGgGtTtTtTtTtTtTtTtGgGgGgGgGg',
  'gGgGgGgGgtTtTtTtTtTtgGgGgGgGgGgG',
  'GgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGg',
  'oooooooooooooooooooooooooooooooo',
];

// The two-by-two buildings are drawn by code rather than typed out: a small
// raster with rectangles and discs, in the same letters as the rest.

class Raster {
  readonly px: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.px = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }
  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y]![x] = ch;
  }
  rect(x: number, y: number, w: number, h: number, ch: string, edge?: string): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const border = edge && (i === 0 || j === 0 || i === w - 1 || j === h - 1);
        this.set(x + i, y + j, border ? edge : ch);
      }
    }
  }
  disc(cx: number, cy: number, r: number, ch: string, edge?: string): void {
    for (let j = -r - 1; j <= r + 1; j++) {
      for (let i = -r - 1; i <= r + 1; i++) {
        const d = Math.hypot(i, j);
        if (d <= r - 0.5) this.set(cx + i, cy + j, ch);
        else if (edge && d <= r + 0.5) this.set(cx + i, cy + j, edge);
      }
    }
  }
  rows(): string[] {
    return this.px.map((r) => r.join(''));
  }
}

function tree(r: Raster, x: number, y: number): void {
  r.rect(x - 1, y + 2, 2, 4, 'x');
  r.disc(x, y, 3, 'g', 'o');
  r.set(x - 1, y - 1, 'G');
  r.set(x, y - 2, 'G');
  r.set(x + 1, y, 'G');
}

function plazaRows(): string[] {
  const r = new Raster(32, 32);
  r.rect(0, 0, 32, 32, 'n', 'o');
  for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) if ((x + y) % 4 === 0) r.set(x, y, 'M');
  r.disc(16, 16, 6, 'n', 'o');
  r.disc(16, 16, 5, 't', 'M');
  r.disc(16, 16, 2, 'T');
  r.set(16, 13, 'T');
  r.set(15, 12, 'T');
  r.set(17, 12, 'T');
  for (const [x, y] of [[6, 6], [25, 6], [6, 24], [25, 24]] as const) tree(r, x, y);
  return r.rows();
}

function foundryRows(): string[] {
  const r = new Raster(32, 32);
  // Two chimneys.
  r.rect(4, 0, 4, 14, 'I', 'o');
  r.rect(23, 3, 4, 11, 'I', 'o');
  r.rect(4, 2, 4, 1, 'D');
  r.rect(23, 5, 4, 1, 'D');
  // The long roof and the sheds.
  r.rect(1, 12, 30, 5, 'C', 'o');
  for (let x = 2; x < 30; x += 4) r.rect(x, 13, 2, 3, 'A');
  r.rect(1, 16, 30, 15, 'H', 'o');
  r.rect(2, 29, 28, 1, 'I');
  // Furnace mouths, glowing.
  for (const x of [5, 13, 21]) {
    r.rect(x, 20, 6, 8, 'o');
    r.rect(x + 1, 22, 4, 6, 'f');
    r.rect(x + 2, 24, 2, 4, 'F');
  }
  r.rect(3, 18, 26, 1, 'L');
  return r.rows();
}

function arcologyRows(): string[] {
  const r = new Raster(32, 32);
  const tiers = [
    { x: 1, y: 22, w: 30, h: 9 },
    { x: 4, y: 14, w: 24, h: 9 },
    { x: 8, y: 6, w: 16, h: 9 },
    { x: 12, y: 1, w: 8, h: 6 },
  ];
  for (const t of tiers) {
    r.rect(t.x, t.y, t.w, t.h, 'H', 'o');
    r.rect(t.x + 1, t.y + 1, t.w - 2, 1, 'g');
    r.rect(t.x + 1, t.y + 2, t.w - 2, 1, 'G');
    for (let x = t.x + 2; x < t.x + t.w - 2; x += 3) r.rect(x, t.y + 4, 2, 2, (x + t.y) % 2 ? 'y' : 'e');
    r.rect(t.x + 1, t.y + t.h - 2, t.w - 2, 1, 'I');
  }
  r.rect(15, 0, 2, 1, 'D');
  r.rect(14, 27, 4, 4, 'b', 'o');
  return r.rows();
}

// --- Ruins and ground ---------------------------------------------------------------

// Rubble: a, b, c are the district's dark, mid and light; o its outline.
const RUIN_A = [
  '................',
  '..oooo..........',
  '.obbcbo.........',
  '.obcbbo...ooo...',
  '.obbbbo..obcbo..',
  '.oabbbo..obbbo..',
  '.oabcbooooabbo..',
  '.obbbbbcbbabbo..',
  'oobbabbbbbbbbbo.',
  'obcbbbbaabbbcbbo',
  'obbbbcbbbbbabbbo',
  'oabbbbbbcbbbbbbo',
  'obbabbbbbbbcbbao',
  'oaabbbbaabbbbaao',
  '.oaaaaaaaaaaaao.',
  '..oooooooooooo..',
];

const RUIN_B = [
  '................',
  '.......ooooooo..',
  '......obbcbbbbo.',
  '......obboobbbo.',
  '..oo..obo..obbo.',
  '.obbo.obo..obco.',
  '.obcboobo..obbo.',
  '.obbbbbbo..obbo.',
  'oobbbbbbbooobbo.',
  'obcbbabbbbcbbbbo',
  'obbbbbbbbabbbbbo',
  'obbabbcbbbbbbabo',
  'obbbbbbbbbbbcbbo',
  'oaabbbbaabbbbaao',
  '.oaaaaaaaaaaaao.',
  '..oooooooooooo..',
];

// A landmark: the broken tower of whoever ruled this ward, with a glint inside.
const LANDMARK = [
  '.....oooooo.....',
  '....obcbbcbo....',
  '....obgbbbbo....',
  '....obbbbgbo....',
  '...oobbbbbbo....',
  '...obbbooobbo...',
  '...obbo.GGobo...',
  '...obbo.gGobo...',
  '..oobbo.ggobboo.',
  '.obbbbooooobbbbo',
  '.obcbbbbbbbbbcbo',
  'obbbbabbbbabbbbo',
  'obbabbbbcbbbbbao',
  'oaabbbbaabbbbaao',
  '.oaaaaaaaaaaaao.',
  '..oooooooooooo..',
];

/** Scattered rubble on a tile not yet cleared. Drawn over the ground. */
const RUBBLE = [
  '................',
  '..oo........o...',
  '.obco......obo..',
  '.obbo.....oobbo.',
  '..oo.....obbbbo.',
  '.........oabbo..',
  '....ooo...ooo...',
  '...obcbo........',
  '..obbbbbo...oo..',
  '..oabbbbo..obco.',
  '...oaaao...oabo.',
  '....ooo.....oo..',
  '.oo.......oo....',
  'obbo.....obco...',
  'oabo.....oabo...',
  '.oo.......oo....',
];

// Salvage showing in the rubble: 1 2 3 are the salvage's own shades.
const BITS: Record<'timber' | 'stone' | 'metal' | 'cloth', readonly string[]> = {
  timber: [
    '................',
    '................',
    '................',
    '..........o.....',
    '.........o2o....',
    '........o23o....',
    '.......o23o.....',
    '..ooooo23o......',
    '.o32222221o.....',
    '..ooooooo.......',
    '................',
    '.........oooooo.',
    '........o322221o',
    '.........oooooo.',
    '................',
    '................',
  ],
  stone: [
    '................',
    '................',
    '................',
    '..........oo....',
    '.........o32o...',
    '.........o21o...',
    '..........oo....',
    '................',
    '...oo...........',
    '..o32o......oo..',
    '..o21o.....o3o..',
    '...oo.....o221o.',
    '...........oo...',
    '................',
    '................',
    '................',
  ],
  metal: [
    '................',
    '................',
    '....o...........',
    '...o3o..........',
    '...o2o.......o..',
    '...o2o......o3o.',
    '...o2o.....o3o..',
    '...o2o....o3o...',
    '...o1o...o2o....',
    '...o1o..o2o.....',
    '....o..o1o......',
    '........o.......',
    '................',
    '................',
    '................',
    '................',
  ],
  cloth: [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....o333332o....',
    '...o33222222o...',
    '...o3o22222o2o..',
    '...o2oo222o.o...',
    '....o..o2o......',
    '........o.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

// --- Items -------------------------------------------------------------------------

const LOG = [
  '................',
  '................',
  '................',
  '................',
  '...ooooooooo....',
  '..o333333333o...',
  '.o32222222223oo.',
  '.o22222222222o1o',
  '.o21111111112o2o',
  '.o11111111111o1o',
  '..o111111111oo..',
  '...ooooooooo....',
  '................',
  '................',
  '................',
  '................',
];

const COIL = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '...oo333333oo...',
  '..o33ooooooo3o..',
  '..o3o222222o2o..',
  '..o2o2oooo2o2o..',
  '..o2o2o..o2o2o..',
  '..o2o2oooo2o1o..',
  '..o1o111111o1o..',
  '..o11ooooooo1o..',
  '...oo111111oo...',
  '.....oooooo.....',
  '................',
  '................',
];

const BOLT_OF_CLOTH = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....o333333o....',
  '...o33222223o...',
  '...o32222222o...',
  '...o22o22o22o...',
  '...o22222222o...',
  '...o12222221o...',
  '...o11111111o...',
  '....oooooooo1o..',
  '...........o1o..',
  '............oo..',
  '................',
  '................',
];

const CRATE = [
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '..o3333333333o..',
  '..o3oooooooo2o..',
  '..o3o222222o2o..',
  '..o3o2o22o2o2o..',
  '..o3o22oo22o2o..',
  '..o3o22oo22o2o..',
  '..o3o2o22o2o2o..',
  '..o3o222222o2o..',
  '..o2oooooooo1o..',
  '..o2111111111o..',
  '..oooooooooooo..',
  '................',
];

// --- Regalia -----------------------------------------------------------------------

const SEAL = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....o333333o....',
  '...o33222223o...',
  '...o32223222o...',
  '...o22233322o...',
  '...o23333332o...',
  '...o22233322o...',
  '...o12223221o...',
  '....o111111o....',
  '.....oooooo.....',
  '.....or..ro.....',
  '.....orr.rro....',
  '......oo..oo....',
];

// --- Supplies, fixtures and icons ------------------------------------------------------

const BOOK = [
  '................',
  '................',
  '..ooooooooooo...',
  '..o3333333332o..',
  '..o3oooooooo2o..',
  '..o3o222222o2o..',
  '..o3o2yyyy2o2o..',
  '..o3o222222o2o..',
  '..o3o2yy222o2o..',
  '..o3o222222o2o..',
  '..o2oooooooo1o..',
  '..o1pppppppp1o..',
  '..oooooooooooo..',
  '................',
  '................',
  '................',
];

const CUP = [
  '................',
  '................',
  '.......n........',
  '......n.n.......',
  '.......n........',
  '...oooooooooo...',
  '...o33333332oooo',
  '...o32222221o..o',
  '...o32222221o..o',
  '...o22222221oooo',
  '....o222221o....',
  '....o111111o....',
  '..oooooooooooo..',
  '..o1111111111o..',
  '...oooooooooo...',
  '................',
];

const WALL = [
  '................',
  '................',
  '................',
  '................',
  '..o..o..o..o..o.',
  '.ooooooooooooooo',
  'o3332o3332o3332o',
  'o2221o2221o2221o',
  'oooooooooooooooo',
  'o32o3332o3332o3o',
  'o21o2221o2221o2o',
  'oooooooooooooooo',
  'tTtTtTtTtTtTtTtT',
  'TtTtTtTtTtTtTtTt',
  '................',
  '................',
];

const BEACON = [
  '......oooo......',
  '.....oFYYFo.....',
  '....ofYYYYfo....',
  '.....oFYYFo.....',
  '......oooo......',
  '.....o3332o.....',
  '......o32o......',
  '......o21o......',
  '......o21o......',
  '......o21o......',
  '......o21o......',
  '.....o2221o.....',
  '....o222211o....',
  '....oooooooo....',
  '................',
  '................',
];

const HAMMER = [
  '................',
  '...oooooo.......',
  '..o33332oo......',
  '..o322221o......',
  '..o3222211o.....',
  '...oo2211o......',
  '.....oo1oxo.....',
  '.......oxxo.....',
  '........oxo.....',
  '.........oxo....',
  '..........oxo...',
  '...........oxo..',
  '............oxo.',
  '.............oxo',
  '..............oo',
  '................',
];

const WAVE = [
  '................',
  '................',
  '................',
  '.........ooo....',
  '.......ooTTTo...',
  '......oTTttTo...',
  '.....oTtto.o....',
  '....oTtto.......',
  '...oTttto.....o.',
  '..oTtttttoo..oTo',
  '.oTtttttttTooTto',
  'oTttttttttttTtto',
  'otttttttttttttto',
  '.oooooooooooooo.',
  '................',
  '................',
];

const FLAG = [
  '................',
  '.o..............',
  '.oo.............',
  '.oRo........o...',
  '.oyRo......oo...',
  '.oRRRo....oRo...',
  '.o...oo..oyRo...',
  '.o.....ooRRRo...',
  '.o.......o..oo..',
  '.o...........oo.',
  '.o..............',
  '.o..............',
  '.o..............',
  '.o..............',
  'ooo.............',
  '................',
];

const PERSON = [
  '................',
  '................',
  '......oooo......',
  '.....osssso.....',
  '.....osesso.....',
  '.....osssso.....',
  '......oooo......',
  '.....oJJJJo.....',
  '....oJJJJJJo....',
  '....osJJJJso....',
  '.....oJJJJo.....',
  '.....oPPPPo.....',
  '.....oPooPo.....',
  '.....obo.obo....',
  '.....oo..oo.....',
  '................',
];

const SMILE = [
  '................',
  '................',
  '.....oooooo.....',
  '....oyyyyyyo....',
  '...oyyyyyyyyo...',
  '..oyyoyyyyoyyo..',
  '..oyyoyyyyoyyo..',
  '..oyyyyyyyyyyo..',
  '..oyoyyyyyyoyo..',
  '..oyyoyyyyoyyo..',
  '...oyyooooyyo...',
  '....oyyyyyyo....',
  '.....oooooo.....',
  '................',
  '................',
  '................',
];

/** A citizen out walking: 8 by 10, two frames. */
const WALKER = [
  [
    '..ooo...',
    '.ossso..',
    '.ossso..',
    '..ooo...',
    '.oJJJo..',
    'oJJJJJo.',
    '.oJJJo..',
    '.oPoPo..',
    '.oPoPo..',
    '.oo.oo..',
  ],
  [
    '..ooo...',
    '.ossso..',
    '.ossso..',
    '..ooo...',
    '.oJJJo..',
    'oJJJJJo.',
    '.oJJJo..',
    '.oPPo...',
    'oPo.Po..',
    'oo..oo..',
  ],
];


// --- Buildings added in the expansion ------------------------------------------------

const WINDMILL = [
  '..o.....o.......',
  '...o...o........',
  '....oDo.........',
  '.....oCo........',
  '....oCo.o.......',
  '...o.o...o......',
  '..o..oCCo.o.....',
  '....oCCCCo......',
  '...oLHHHHIo.....',
  '...oLHyyHIo.....',
  '...oLHHHHIo.....',
  '..oLHHHHHHIoooo.',
  '..oLHHHHHHIoCDo.',
  '..oLHHbbHHIoHHo.',
  '..oIIIbbIIIoIIo.',
  '..oooooooooooo..',
];

const BATHHOUSE = [
  '................',
  '....T.....T.....',
  '...T..T..T..T...',
  '....T.....T.....',
  '..oooooooooooo..',
  '.oDDDDDDDDDDDDo.',
  'oCCCCCCCCCCCCCCo',
  'oooooooooooooooo',
  'oLHHHHHHHHHHHHIo',
  'oLHoHoHHHHoHoHIo',
  'oLHoHoHbbHoHoHIo',
  'oLHHHHHbbHHHHHIo',
  'oooooooooooooooo',
  'otTtTtTtTtTtTtTo',
  'oooooooooooooooo',
  '................',
];

const CLOCK = [
  '.......oo.......',
  '......oDCo......',
  '.....oDCCAo.....',
  '....oooooooo....',
  '....oLppppIo....',
  '....opppkppo....',
  '....oppkkppo....',
  '....opppppko....',
  '....oLppppIo....',
  '....oooooooo....',
  '....oLHHHHIo....',
  '....oLHeeHIo....',
  '....oLHHHHIo....',
  '...oLHHbbHHIo...',
  '...oIIIbbIIIo...',
  '...oooooooooo...',
];

const PUMP = [
  '................',
  '...........oo...',
  '..........oxxo..',
  '.........oxo....',
  '....oooooxo.....',
  '...oCCCCCo......',
  '...oCDDDCo......',
  '...oCCCCCo.oo...',
  '..oooooooooTTo..',
  '..oLHHHHHHIoTo..',
  '..oLHMMMMHIo.T..',
  '..oLHMeeMHIo.T..',
  '..oLHMMMMHIo....',
  '..oIIIIIIIIo.t..',
  '..oooooooooo.T..',
  '.............t..',
];

const LAMP = [
  '................',
  '.....oooo.......',
  '....oDDDDo......',
  '....oCyyCo......',
  '....oCyyCo......',
  '.....oooo.......',
  '......ox........',
  '......ox........',
  '.g..G.ox..g..G..',
  'gGg.gGox.gGg.gGg',
  '.g..g.ox..g..g..',
  '......ox........',
  'gG...oxxo...gG..',
  'GgG..oxxo..GgGg.',
  'gGgGgGgGgGgGgGgG',
  'oooooooooooooooo',
];

const FERRY = [
  '................',
  '......o.........',
  '......oC........',
  '......oCC.......',
  '......oCCC......',
  '......oCCCC.....',
  '......o.........',
  '..oooooooooooo..',
  '..oLHHHHHHHHIo..',
  '.oLHyHHyHHyHHIo.',
  'ooooooooooooooo.',
  'oIIIIIIIIIIIIIIo',
  '.oIIIIIIIIIIIIo.',
  'tTtooooooooooTtT',
  'TtTtTtTtTtTtTtTt',
  'tTtTtTtTtTtTtTtT',
];

const KITE = [
  '.......oo.......',
  '......oRRo......',
  '.....oRRyRo.....',
  '....oRRyyyRo....',
  '.....oRyyRo.....',
  '......oRRo......',
  '.......oo.......',
  '.......o........',
  '........o.......',
  '.......o........',
  '......o.........',
  '.......o........',
  '........o.......',
  '.......o........',
  '......oo........',
  '................',
];

function terraceRows(): string[] {
  const r = new Raster(32, 32);
  const steps = [
    { x: 0, y: 24, w: 32, h: 8 },
    { x: 4, y: 16, w: 26, h: 8 },
    { x: 8, y: 8, w: 20, h: 8 },
    { x: 12, y: 1, w: 14, h: 7 },
  ];
  for (const t of steps) {
    r.rect(t.x, t.y, t.w, t.h, 'H', 'o');
    r.rect(t.x + 1, t.y + 1, t.w - 2, 2, 'C');
    r.rect(t.x + 1, t.y + 3, t.w - 2, 1, 'D');
    for (let x = t.x + 2; x < t.x + t.w - 2; x += 4) r.rect(x, t.y + 4, 2, 2, (x + t.y) % 3 ? 'y' : 'e');
    r.rect(t.x + 1, t.y + t.h - 2, t.w - 2, 1, 'I');
    for (let x = t.x + 1; x < t.x + t.w - 1; x += 3) r.set(x, t.y + 1, 'G');
  }
  r.rect(15, 28, 3, 3, 'b', 'o');
  return r.rows();
}

function dockRows(): string[] {
  const r = new Raster(32, 16);
  // The gasbag and the gondola, moored to a mast.
  r.disc(13, 4, 4, 'C', 'o');
  r.rect(6, 1, 15, 7, 'C', 'o');
  r.rect(7, 2, 13, 1, 'D');
  r.rect(7, 6, 13, 1, 'A');
  r.rect(10, 8, 7, 3, 'H', 'o');
  r.set(12, 9, 'y');
  r.set(14, 9, 'y');
  r.rect(26, 0, 2, 13, 'x', 'o');
  r.rect(21, 2, 6, 1, 'o');
  // The landing stage.
  r.rect(0, 12, 32, 4, 'I', 'o');
  r.rect(1, 13, 30, 1, 'L');
  return r.rows();
}

function assemblyRows(): string[] {
  const r = new Raster(32, 16);
  r.rect(3, 4, 26, 2, 'C', 'o');
  r.rect(8, 1, 16, 4, 'D', 'o');
  r.rect(14, 0, 4, 2, 'C', 'o');
  r.rect(1, 6, 30, 10, 'H', 'o');
  for (let x = 3; x < 29; x += 4) r.rect(x, 7, 2, 7, 'L');
  r.rect(14, 10, 4, 6, 'b', 'o');
  r.rect(1, 14, 30, 2, 'I', 'o');
  return r.rows();
}

// --- Assembly --------------------------------------------------------------------------

function fixPalette(rows: readonly string[]): readonly string[] {
  // 'O' is used as a deliberate off-grid outline in one or two places.
  return rows.map((r) => r.replace(/O/g, 'o'));
}

const SHAPES: Record<string, () => readonly string[]> = {
  tent: () => TENT,
  yard: () => YARD,
  stall: () => STALL,
  garden: () => GARDEN,
  works: () => WORKS,
  well: () => WELL,
  cottage: () => COTTAGE,
  crane: () => CRANE,
  hall: () => HALL,
  tower: () => TOWER,
  chapel: () => CHAPEL,
  dredger: () => DREDGER,
  tall: () => TALL,
  longhall: () => LONGHALL,
  fountain: () => FOUNTAIN,
  dome: () => DOME,
  plaza: plazaRows,
  block: () => BLOCK,
  shovel: () => SHOVEL,
  park: () => PARK,
  foundry: foundryRows,
  arcology: arcologyRows,
  windmill: () => WINDMILL,
  bathhouse: () => BATHHOUSE,
  clock: () => CLOCK,
  pump: () => PUMP,
  lamp: () => LAMP,
  ferry: () => FERRY,
  terrace: terraceRows,
  dock: dockRows,
  assembly: assemblyRows,
};

const ITEM_BY_PILE = { timber: LOG, stone: ORE_CHUNK, metal: COIL, cloth: BOLT_OF_CLOTH } as const;
const GOOD_SHAPE: Record<string, readonly string[]> = { planks: LOG, canvas: BOLT_OF_CLOTH, silkwork: BOLT_OF_CLOTH, panes: GEM, lumen: GEM, 'roof-tiles': CRATE };

const HAMMER_PAL: Palette = shades(['#3e4250', '#7a8090', '#c8ccd8']);

/** The Founder: Hollowdeep's miner in a felt hat and a green coat. */
const FOUNDER_PAL: Palette = { y: '#5a3a24', Y: '#7a5a3a', F: '#5a3a24', J: '#4a6a3a', j: '#344a28', B: '#8a6a2a' };

/** All sprites, in a stable order. */
export function buildSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];

  for (const d of DISTRICTS) {
    const pal = { o: d.ruin[0], a: d.ruin[1], b: d.ruin[2], c: d.ruin[3], g: d.glow, G: '#ffffff' };
    out.push(make(`ruin-${d.id}-0`, RUIN_A, pal));
    out.push(make(`ruin-${d.id}-1`, RUIN_B, pal));
    out.push(make(`landmark-${d.id}`, LANDMARK, pal));
    out.push(make(`rubble-${d.id}`, RUBBLE, pal));
  }
  CRACKS.forEach((rows, i) => out.push(make(`crack-${i + 1}`, rows)));

  for (const m of MATERIALS) {
    const pal = shades(m.shades);
    if (m.kind === 'salvage') {
      out.push(make(`bits-${m.id}`, BITS[m.pile ?? 'stone'], pal));
      out.push(make(`item-${m.id}`, ITEM_BY_PILE[m.pile ?? 'stone'], pal));
    } else if (m.kind === 'relic') {
      out.push(make(`item-${m.id}`, GEM, pal));
    } else if (m.kind === 'good') {
      out.push(make(`item-${m.id}`, GOOD_SHAPE[m.id] ?? BAR, pal));
    } else {
      out.push(make(`item-${m.id}`, ESSENCE, pal));
    }
  }

  for (const g of REGALIA) {
    const tint = MATERIAL.get(g.tint);
    if (!tint) throw new Error(`regalia ${g.id}: no tint ${g.tint}`);
    const template = g.slot === 'chain' ? CHARM : g.slot === 'lantern' ? LANTERN : g.slot === 'coat' ? ARMOR : SEAL;
    out.push(make(`regalia-${g.id}`, template, shades(tint.shades)));
  }

  for (const b of BUILDINGS) {
    const shape = SHAPES[b.art.shape];
    if (!shape) throw new Error(`building ${b.id}: no shape ${b.art.shape}`);
    const rows = shape();
    if (rows[0]!.length !== b.w * 16 || rows.length !== b.h * 16) throw new Error(`building ${b.id}: ${b.art.shape} is not ${b.w}×${b.h} tiles`);
    out.push(make(`bld-${b.id}`, rows, buildingPalette(b.art.roof, b.art.wall)));
  }

  out.push(make('use-charge', DYNAMITE));
  out.push(make('use-greatcharge', DYNAMITE, { r: '#4a1a8a', R: '#a87aff' }));
  out.push(make('use-tea', CUP, shades(['#6a3a1a', '#b07040', '#f0c090'])));
  out.push(make('use-ink', FLASK, shades(['#1a2a6a', '#3a5ad0', '#b0c8ff'])));
  out.push(make('use-almanac', BOOK, shades(['#2a4a2a', '#4a8a4a', '#a8e0a0'])));
  out.push(make('use-overtime', SCROLL));
  out.push(make('use-wine', FLASK, shades(['#4a0a1a', '#a01a3a', '#ff7a9a'])));
  out.push(make('use-seeker', LENS));
  out.push(make('use-calm', FLASK, shades(['#4a5a6a', '#a8c0d0', '#f0f8ff'])));
  out.push(make('use-memoir', BOOK, shades(['#2a1a4a', '#6a4aa8', '#d0c0ff'])));
  out.push(make('use-grease', FLASK, shades(['#1a3a2a', '#3a8a6a', '#a8f0d0'])));
  out.push(make('use-kite', KITE));

  out.push(make('fix-auction', CHUTE));
  out.push(make('fix-seawall', WALL, shades(['#5a2a1a', '#a8503a', '#e09070'])));
  out.push(make('fix-surveyor', ROD));
  out.push(make('fix-charter', SCROLL));
  out.push(make('fix-archive', BOOK, shades(['#4a2a0a', '#8a5a2a', '#e0b070'])));
  out.push(make('fix-scrubbers', FILTER));
  out.push(make('fix-beacons', BEACON, shades(['#3a3a5a', '#7a7a9a', '#c8c8e0'])));
  out.push(make('fix-caissons', COIL, shades(['#1a3a34', '#4a8a7a', '#c0f0e0'])));
  out.push(make('fix-windbreaks', FLAG, { R: '#8ab8ff', y: '#ffffff' }));
  out.push(make('fix-treaty', SCROLL));

  out.push(make('icon-coin', COIN));
  out.push(make('icon-memory', ECHO, { v: '#3a9ad0', V: '#c8f0ff' }));
  out.push(make('icon-xp', STAR));
  out.push(make('icon-resolve', BOLT, { y: '#ff9a4a', Y: '#ffe0b0' }));
  out.push(make('icon-up', UP));
  out.push(make('icon-anvil', ANVIL));
  out.push(make('icon-scroll', SCROLL));
  out.push(make('icon-cog', fixPalette(COG)));
  out.push(make('icon-fullscreen', FULLSCREEN));
  out.push(make('icon-exitfs', EXIT_FULLSCREEN));
  out.push(make('icon-barrow', CART, shades(['#5a3a1a', '#9a6a3a', '#d8a870'])));
  out.push(make('icon-kiln', BELLOWS));
  out.push(make('icon-glove', GLOVE));
  out.push(make('icon-wrench', WRENCH));
  out.push(make('icon-ledger', BOOK, shades(['#3a2a1a', '#7a5a3a', '#d0b080'])));
  out.push(make('icon-hammer', HAMMER, HAMMER_PAL));
  out.push(make('icon-wave', WAVE));
  out.push(make('icon-person', PERSON));
  out.push(make('icon-smile', SMILE));
  out.push(make('icon-build', COTTAGE, buildingPalette('#b84a2a', '#e8d8b0')));
  out.push(make('icon-founder', MINER.slice(0, 16), FOUNDER_PAL));
  out.push(make('regalia-none', CHARM, shades(['#4a4a52', '#7a7a86', '#b8b8c4'])));

  out.push(make('edict-rush', fixPalette(FIST)));
  out.push(make('edict-survey', ROD));
  out.push(make('edict-festival', FLAG));

  out.push(make('tool-hammer', HAMMER, HAMMER_PAL));
  // Idle breathing: the body above the belt drops a pixel.
  out.push(make('founder-0', MINER, FOUNDER_PAL));
  out.push(make('founder-1', ['................', ...MINER.slice(0, 16), ...MINER.slice(17)], FOUNDER_PAL));

  // Citizens, in three sets of clothes.
  const clothes: Palette[] = [
    { J: '#a8503a', P: '#3a3a4a' },
    { J: '#3a6aa8', P: '#5a4a3a' },
    { J: '#d8b040', P: '#2a3a2a', s: '#a87050' },
  ];
  clothes.forEach((pal, c) => WALKER.forEach((rows, i) => out.push(make(`walker-${c}-${i}`, rows, pal))));

  return out;
}
