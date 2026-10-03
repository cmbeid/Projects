/**
 * Every sprite in the game, as pixel art written out by hand.
 *
 * A sprite is a grid of characters, one per pixel, and a palette that maps
 * each character to a colour ('.' is transparent). Most templates use the
 * digits 1–3 for "the material's dark, mid and light", so one ore chunk, one
 * ingot and one pickaxe become dozens of icons by palette swap — the colours
 * come from `src/data`, not from here.
 *
 * `scripts/bake-sprites.ts` turns this into `atlas.png` + `atlas.json`. Edit
 * here, then run `npm run bake`.
 */
import { BIOMES } from '../data/biomes';
import { GEAR } from '../data/gear';
import { MATERIALS, MATERIAL } from '../data/materials';
import type { Shades } from '../data/types';

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  /** Row-major RGBA colours as '#rrggbb', or null for transparent. */
  px: (string | null)[];
}

type Palette = Record<string, string>;

const OUTLINE = '#0b0a10';

const BASE: Palette = {
  o: OUTLINE,
  w: '#6a4424',
  x: '#8f5f34',
  m: '#3e4250',
  n: '#7a8090',
  M: '#c8ccd8',
  y: '#e8b030',
  Y: '#fff2a0',
  r: '#b02a2a',
  R: '#ff6a5a',
  s: '#e0a878',
  S: '#b07850',
  e: '#1a0c08',
  b: '#5a3418',
  J: '#3a5a8a',
  j: '#28405e',
  P: '#4a3a2a',
  B: '#22160c',
  f: '#ff8a1a',
  F: '#fff0a0',
  p: '#e8dcb8',
  q: '#a89870',
  v: '#8a7aff',
  V: '#e0d8ff',
  k: '#06050a',
  K: '#ffffff',
  g: '#3a8a3a',
  G: '#9ae07a',
  t: '#2a8aa0',
  T: '#9af0ff',
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

// --- Rock --------------------------------------------------------------------

const ROCK_A = [
  '..oooooooooooo..',
  '.obbbbcccbbbbbo.',
  'obbccbbbbbbabbbo',
  'obcbbbbabbbbbbbo',
  'obbbbbaabbbcbbao',
  'obbabbbbbbccbbbo',
  'obbbbbbbbbbbbabo',
  'obcbbbabbbbbbbbo',
  'obbbbbaabbcbbbbo',
  'obbbcbbbbbccbbao',
  'obbbbbbbabbbbbbo',
  'obabbbbbbbbbabbo',
  'obbbbcbbbbbbbbao',
  'oabbbbbbaabbbaao',
  '.oaaabaaaaaaaao.',
  '..oooooooooooo..',
];

const ROCK_B = [
  '...ooooooooooo..',
  '..obbccbbbbbbbo.',
  '.obcbbbbbabbcbbo',
  'obbbbabbbbbbbbbo',
  'obcbbbbbbcbbabbo',
  'obbbbbbbccbbbbbo',
  'obbabbbbbbbbbbao',
  'obbbbbcbbbbabbbo',
  'obcbbbbbbbbbbbbo',
  'obbbbabbbcbbbabo',
  'obbbbbbbbbbbbbbo',
  'oabbcbbbbbabbbao',
  'obbbbbbabbbbbbbo',
  'oaabbbbbbbbbaaao',
  '.oaaaaabaaaaaao.',
  '..ooooooooooooo.',
];

// --- Veins (overlays on the rock face) --------------------------------------------

const VEINS: Record<'speckle' | 'streak' | 'cluster', readonly string[]> = {
  speckle: [
    '................',
    '................',
    '....12......3...',
    '...123.....132..',
    '....2.......2...',
    '..........1.....',
    '.....3....132...',
    '....132....2....',
    '.....2..........',
    '..13.......13...',
    '..22......132...',
    '...........2....',
    '......13........',
    '.....132........',
    '......2.........',
    '................',
  ],
  streak: [
    '................',
    '................',
    '..........1233..',
    '.........1232...',
    '........122.....',
    '.......122......',
    '......1221......',
    '.....1232.......',
    '....1221........',
    '...1232.........',
    '...121......13..',
    '..121......132..',
    '..11......122...',
    '..........21....',
    '................',
    '................',
  ],
  cluster: [
    '................',
    '................',
    '................',
    '.......3........',
    '......232..3....',
    '.....12321232...',
    '.....1222.122...',
    '......121..1....',
    '....3...........',
    '...232.....3....',
    '..12321...232...',
    '...121...12221..',
    '....1.....121...',
    '...........1....',
    '................',
    '................',
  ],
};

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

const SEAM = [
  '................',
  '......gg........',
  '.....gGGg.......',
  '......gg.....g..',
  '.......g....gGg.',
  '.......g.....g..',
  '...g...gg...g...',
  '..gGg...gggg....',
  '...g....g.......',
  '.......gGg......',
  '........g.......',
  '........g...g...',
  '.......g...gGg..',
  '......gg....g...',
  '................',
  '................',
];

// --- Items -------------------------------------------------------------------

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

const PICK = [
  '................',
  '....ooo.........',
  '...o333oo.......',
  '....o2233oo.....',
  '.....oo22233o...',
  '.......oo2223o..',
  '........ow1223o.',
  '.......owxo1122o',
  '......owxo.o112o',
  '.....owxo...o12o',
  '....owxo....o11o',
  '...owxo......o1o',
  '..owxo.......oo.',
  '.owxo...........',
  '.oxo............',
  '..o.............',
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

// --- Consumables and fixtures ---------------------------------------------------------

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

const COOLANT = [
  '................',
  '................',
  'oooooo..........',
  'MnnnnMo.........',
  'nTTTTnno........',
  'ooooonTno.......',
  '.....onTno......',
  '......onTnoooooo',
  '.......onTnnnnnM',
  '........onTTTTTn',
  '.........ooooooo',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const FURNACE = [
  '.....oooooo.....',
  '.....onnnno.....',
  '.....onmmno.....',
  '...oooooooooo...',
  '..onnnnnnnnnno..',
  '..onmmmmmmmmno..',
  '..onmoooooomno..',
  '..onmoffffomno..',
  '..onmofFFfomno..',
  '..onmoffffomno..',
  '..onmoooooomno..',
  '..onmmmmmmmmno..',
  '..onnnnnnnnnno..',
  '..oooooooooooo..',
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

const CENSER = [
  '.......o........',
  '.......o..qp....',
  '.......o.qpq....',
  '......ooo.qp....',
  '.....o...o.q....',
  '....o.....o.....',
  '...ooooooooo....',
  '...oyyyyyyyo....',
  '..oyYyyyyyyyo...',
  '..oyyoyoyoyyo...',
  '..oyyyyyyyyyo...',
  '...oyyyyyyyo....',
  '....ooyyyoo.....',
  '......ooo.......',
  '................',
  '................',
];

const VEIL = [
  '................',
  '..pqpqpqpqpqpq..',
  '..qpqpqpqpqpqp..',
  '..pq.oooooo.qp..',
  '..qpoKKKKKKoqp..',
  '..poKKvvvvKKop..',
  '..qoKvvoovvKoq..',
  '..poKvvoovvKop..',
  '..qpoKvvvvKopq..',
  '..pqpoooooopqp..',
  '..qpqpqpqpqpqp..',
  '..pqp.qpq.pqpq..',
  '..q.p..p..q..p..',
  '................',
  '................',
  '................',
];

const BARGAIN = [
  '................',
  '...oo......oo...',
  '..osso....osso..',
  '..ossso..oSsso..',
  '...osssooSsso...',
  '....ossyySso....',
  '.....osYYso.....',
  '....osSyysSo....',
  '...osSso.oSSo...',
  '..osSso...oSSo..',
  '..oSso.....oso..',
  '...oo.......o...',
  '................',
  '................',
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

// --- Machines and the miner -------------------------------------------------------------

const DRONE = [
  [
    'ooooo..ooooo',
    '....o..o....',
    '...oooooo...',
    '..onnnnnno..',
    '.onMMnnnnno.',
    '.onrnnnnRno.',
    '.onnnnnnnno.',
    '..ommmmmmo..',
    '...o.oo.o...',
    '.....oo.....',
    '.....MM.....',
    '......M.....',
  ],
  [
    '..ooo..ooo..',
    '....o..o....',
    '...oooooo...',
    '..onnnnnno..',
    '.onMMnnnnno.',
    '.onRnnnnrno.',
    '.onnnnnnnno.',
    '..ommmmmmo..',
    '...o.oo.o...',
    '.....oo.....',
    '.....MM.....',
    '......M.....',
  ],
];

const RIG = [
  [
    '......oo........',
    '.....oyyo.......',
    '....oooooo......',
    '....owwwwo......',
    '...oonnnnoo.....',
    '..onnMMnnnno....',
    '..onnnnnnnnoooo.',
    '..onmmmmmmnnnno.',
    '..oonnnnnnoooo..',
    '...o.oMMo.o.....',
    '..o..oMMo..o....',
    '.o...oMMo...o...',
    'o....oMMo....o..',
    'o.....MM.....o..',
    '......M.........',
    '................',
  ],
  [
    '......oo........',
    '.....oYYo.......',
    '....oooooo......',
    '....owwwwo......',
    '...oonnnnoo.....',
    '..onnMMnnnno....',
    '..onnnnnnnnoooo.',
    '..onmmmmmmnnnno.',
    '..oonnnnnnoooo..',
    '...o.oMMo.o.....',
    '..o..oMMo..o....',
    '.o...oMMo...o...',
    'o....oMMo....o..',
    'o.....MM.....o..',
    '.......M........',
    '................',
  ],
];

const EXCAVATOR = [
  [
    '................',
    '.........ooo....',
    '........onnno...',
    '.......onnoono..',
    '..ooooonno..ono.',
    '.oyyyyyoo...onno',
    '.oyTTTyyo..onMMo',
    '.oyTTTyyyo.oMMMo',
    '.oyyyyyyyyooMMo.',
    '.oyyyyyyyyyooo..',
    'ooooooooooooo...',
    'ommnmmnmmnmmo...',
    'omonmonmonmoo...',
    '.ooooooooooo....',
    '................',
    '................',
  ],
  [
    '................',
    '.........ooo....',
    '........onnno...',
    '.......onnoono..',
    '..ooooonno..ono.',
    '.oyyyyyoo...onno',
    '.oyTTTyyo..onMMo',
    '.oyTTTyyyo.oMMMo',
    '.oyyyyyyyyooMMo.',
    '.oyyyyyyyyyooo..',
    'ooooooooooooo...',
    'omnmmnmmnmmno...',
    'oonmonmonmono...',
    '.ooooooooooo....',
    '................',
    '................',
  ],
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

// --- Interface icons -------------------------------------------------------------------

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

const SWIRL = [
  '................',
  '........oo......',
  '......ooffo.....',
  '.....offffo.....',
  '....offFFo......',
  '...offFFo.......',
  '...ofFFo...oo...',
  '...ofFFoooofo...',
  '...ofFFFFFFFfo..',
  '....offFFFFffo..',
  '.....ooffffoo...',
  '.......oooo.....',
  '................',
  '................',
  '................',
  '................',
];

// --- Assembly --------------------------------------------------------------------------

function fixPalette(rows: readonly string[]): readonly string[] {
  // 'O' is used as a deliberate off-grid outline in one or two places.
  return rows.map((r) => r.replace(/O/g, 'o'));
}

/** All sprites, in a stable order. */
export function buildSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];

  for (const b of BIOMES) {
    const pal = { o: b.rock[0], a: b.rock[1], b: b.rock[2], c: b.rock[3] };
    out.push(make(`rock-${b.id}-0`, ROCK_A, pal));
    out.push(make(`rock-${b.id}-1`, ROCK_B, pal));
    out.push(make(`seam-${b.id}`, SEAM, { g: b.glow, G: '#ffffff' }));
  }
  CRACKS.forEach((rows, i) => out.push(make(`crack-${i + 1}`, rows)));

  for (const m of MATERIALS) {
    const pal = shades(m.shades);
    if (m.kind === 'ore') {
      out.push(make(`vein-${m.id}`, VEINS[m.vein ?? 'speckle'], pal));
      out.push(make(`item-${m.id}`, ORE_CHUNK, pal));
    } else if (m.kind === 'gem') {
      out.push(make(`item-${m.id}`, GEM, pal));
    } else if (m.kind === 'bar') {
      out.push(make(`item-${m.id}`, BAR, pal));
    } else {
      out.push(make(`item-${m.id}`, ESSENCE, pal));
    }
  }

  for (const g of GEAR) {
    const tint = MATERIAL.get(g.tint);
    if (!tint) throw new Error(`gear ${g.id}: no tint ${g.tint}`);
    const template = g.slot === 'pick' ? PICK : g.slot === 'lantern' ? LANTERN : g.slot === 'armor' ? ARMOR : CHARM;
    out.push(make(`gear-${g.id}`, template, shades(tint.shades)));
  }
  // A plain wooden-handled iron pick for when nothing is equipped.
  out.push(make('gear-none', PICK, shades(['#4a4a52', '#7a7a86', '#b8b8c4'])));

  out.push(make('use-dynamite', DYNAMITE));
  out.push(make('use-tonic', FLASK, shades(['#8a1a2a', '#e0304a', '#ff9aa8'])));
  out.push(make('use-luckbrew', FLASK, shades(['#1a6a2a', '#3ad04a', '#c8ffb0'])));
  out.push(make('use-sagebrew', FLASK, shades(['#2a2a8a', '#5a6ae0', '#c8d0ff'])));

  out.push(make('fix-filters', FILTER));
  out.push(make('fix-coolant', COOLANT));
  out.push(make('fix-furnace2', FURNACE));
  out.push(make('fix-furnace3', FURNACE, { f: '#5ad0ff', F: '#e0ffff' }));
  out.push(make('fix-chute', CHUTE));
  out.push(make('fix-lens', LENS));
  out.push(make('fix-workshop', DRONE[0]!));
  out.push(make('fix-censer', CENSER));
  out.push(make('fix-veil', VEIL));
  out.push(make('icon-bargain', BARGAIN));

  out.push(make('icon-coin', COIN));
  out.push(make('icon-echo', ECHO));
  out.push(make('icon-xp', STAR));
  out.push(make('icon-stamina', BOLT, { y: '#3ad0ff', Y: '#d8faff' }));
  out.push(make('icon-up', UP));
  out.push(make('icon-anvil', ANVIL));
  out.push(make('icon-scroll', SCROLL));
  out.push(make('icon-cog', fixPalette(COG)));
  out.push(make('icon-fullscreen', FULLSCREEN));
  out.push(make('icon-exitfs', EXIT_FULLSCREEN));
  out.push(make('icon-cart', CART, shades(['#7a3416', '#c8622a', '#f2a65a'])));
  out.push(make('icon-bellows', BELLOWS));
  out.push(make('icon-glove', GLOVE));
  out.push(make('icon-wrench', WRENCH));
  out.push(make('skill-power', fixPalette(FIST)));
  out.push(make('skill-dowse', ROD));
  out.push(make('skill-frenzy', SWIRL));
  out.push(make('icon-miner', MINER.slice(0, 16)));

  DRONE.forEach((rows, i) => out.push(make(`drone-${i}`, rows)));
  RIG.forEach((rows, i) => out.push(make(`rig-${i}`, rows)));
  EXCAVATOR.forEach((rows, i) => out.push(make(`excavator-${i}`, rows)));

  // Idle breathing: the body above the belt drops a pixel.
  out.push(make('miner-0', MINER));
  out.push(make('miner-1', ['................', ...MINER.slice(0, 16), ...MINER.slice(17)]));

  return out;
}
