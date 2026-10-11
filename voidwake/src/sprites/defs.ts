/**
 * Every sprite in the game, drawn in code. Ships and creatures are grown
 * from mirrored random masks (seeded, so they never change between bakes),
 * tiles are noise in each biome's palette, and the icons are small
 * character-grid drawings. `npm run bake` packs them into the atlas.
 */
import { BIOMES, FAUNA } from '../data/biomes';
import { CLASSES } from '../data/crew';
import { ENEMIES } from '../data/enemies';
import { FACTION } from '../data/factions';
import { MATERIALS } from '../data/materials';
import { Px } from './px';

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  px: (string | null)[];
}

function def(name: string, p: Px): SpriteDef {
  return { name, w: p.w, h: p.h, px: p.px };
}

function lcg(seed: number): () => number {
  let a = seed | 0 || 1;
  return () => {
    a = (Math.imul(a, 1103515245) + 12345) | 0;
    return ((a >>> 8) & 0xffff) / 65536;
  };
}

function hex(n: number): string {
  return `#${Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')}`;
}

/** Lighten (t > 0) or darken (t < 0) a colour. */
export function shade(c: string, t: number): string {
  const n = parseInt(c.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return `#${ch.map((v) => hex(v).slice(1)).join('')}`;
}

const OUTLINE = '#0c0e16';

/** Paints a one-pixel dark outline round everything opaque. */
function outline(p: Px, c = OUTLINE): Px {
  const out = new Px(p.w, p.h);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y)) continue;
      if (p.get(x - 1, y) || p.get(x + 1, y) || p.get(x, y - 1) || p.get(x, y + 1)) out.set(x, y, c);
    }
  }
  return out.stamp(p, 0, 0);
}

// ---------------------------------------------------------------- Procedural ships

interface ShipStyle {
  hull: string;
  trim: string;
  glow: string;
  density: number;
}

/**
 * A ship facing up, grown from a mirrored mask. Rows near the middle are
 * denser; a spine down the centre keeps it in one piece; the nose gets a
 * cockpit and the tail gets engine glow.
 */
function growShip(seed: number, w: number, h: number, st: ShipStyle): Px {
  const r = lcg(seed);
  const half = Math.ceil(w / 2);
  const mask: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    const row: boolean[] = [];
    const t = y / (h - 1);
    // Widest a little behind the middle; narrow nose.
    const width = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * half * (0.55 + 0.45 * t);
    for (let x = 0; x < half; x++) {
      const fromCentre = half - 1 - x;
      const inside = fromCentre < width;
      row.push(fromCentre <= 1 ? y > 0 && t < 0.88 : inside && r() < st.density + (fromCentre < width * 0.5 ? 0.25 : 0));
    }
    mask.push(row);
  }
  // Wings: a solid strut out to the widest row's edge.
  const strut = Math.floor(h * (0.55 + r() * 0.2));
  const reach = Math.max(0, mask[strut]!.indexOf(true) - 1);
  for (let x = reach; x < half; x++) mask[strut]![x] = true;
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < half; x++) {
      if (!mask[y]![x]) continue;
      const t = y / h;
      const c = x < half * 0.35 ? st.trim : t < 0.3 ? shade(st.hull, 0.25) : t > 0.75 ? shade(st.hull, -0.25) : st.hull;
      p.set(x, y, c);
      p.set(w - 1 - x, y, c);
    }
  }
  // Cockpit and engines.
  const cx = Math.floor(w / 2);
  p.set(cx, Math.floor(h * 0.25), '#a0e8ff').set(cx - (w % 2 ? 0 : 1), Math.floor(h * 0.25), '#a0e8ff');
  p.set(cx, Math.floor(h * 0.25) + 1, '#5ab0e0').set(cx - (w % 2 ? 0 : 1), Math.floor(h * 0.25) + 1, '#5ab0e0');
  for (let x = 0; x < w; x++) if (p.get(x, h - 2) && !p.get(x, h - 1) && r() < 0.7) p.set(x, h - 1, st.glow);
  return outline(p);
}

const FACTION_STYLE: Record<string, ShipStyle> = {
  none: { hull: '#7a7e88', trim: '#5a5e68', glow: '#f0a040', density: 0.55 },
  clans: { hull: '#b07838', trim: '#d0a050', glow: '#ff7040', density: 0.6 },
  concord: { hull: '#5a78a8', trim: '#c8d0e0', glow: '#60c0ff', density: 0.5 },
  choir: { hull: '#9a6ad0', trim: '#e0b0ff', glow: '#ff80ff', density: 0.45 },
};

function enemySprites(): SpriteDef[] {
  return ENEMIES.map((e, i) => {
    const st = { ...FACTION_STYLE[e.faction]! };
    if (e.id === 'secbot' || e.id === 'boss-warden') Object.assign(st, { hull: '#a8b0b8', trim: '#f0d040', glow: '#5ad0f0' });
    if (e.id === 'reaver') Object.assign(st, { hull: '#3a3640', trim: '#802030', glow: '#ff3040' });
    if (e.id === 'boss-echo') Object.assign(st, { hull: '#c8d8f0', trim: '#5ad0f0', glow: '#ffffff', density: 0.65 });
    if (e.id === 'wrecker') Object.assign(st, { hull: '#6a5a4a', trim: '#8a7a5a', density: 0.7 });
    const w = e.boss ? 40 + (i % 3) * 2 : 18 + (i % 4) * 2;
    const h = e.boss ? 40 : 18 + (i % 3) * 2;
    return def(e.sprite, growShip(1000 + i * 7919, w, h, st));
  });
}

/** The Wren, drawn by hand: a stubby survey scout with a lander slung underneath. */
function wren(): Px {
  const rows = [
    '..........aa..........',
    '.........abba.........',
    '.........bccb.........',
    '........abccba........',
    '........bbddbb........',
    '.......abbddbba.......',
    '.......bbbbbbbb.......',
    '......abbebbebba......',
    '..aa..bbbbbbbbbb..aa..',
    '.affa.bbbffffbbb.affa.',
    '.afffabbbffffbbbafffa.',
    'abfffbbbbbbbbbbbbfffba',
    'bbbbbbbbbggggbbbbbbbbb',
    'bbbbbbbbgggggggbbbbbbb',
    'abbbbbbbgggggggbbbbbba',
    '.abbb.bbbggggbbb.bbba.',
    '..hh..bbbbbbbbbb..hh..',
    '..ii...bbbbbbbb...ii..',
    '.......hh.hh.hh.......',
    '.......ii.ii.ii.......',
  ];
  return outline(
    Px.from(rows, {
      a: '#5a6478', b: '#c8ccd4', c: '#a0e8ff', d: '#5ab0e0', e: '#f0b040', f: '#8a9098', g: '#7a8494', h: '#5a5e68', i: '#ffb040',
    }),
  );
}

// ---------------------------------------------------------------- Planets

function planet(biome: (typeof BIOMES)[number], r: number, seed: number): Px {
  const rnd = lcg(seed);
  const size = r * 2 + 2;
  const p = new Px(size, size);
  const c = r + 0.5;
  const [floor, floor2, wall, wallLight, liquid, hazard, accent] = biome.pal;
  const bandShift = rnd() * 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      // Bands and blotches, then a terminator shadow from the lower right.
      const band = Math.sin((y + bandShift) * (biome.id === 'desert' || biome.id === 'toxic' ? 0.9 : 0.5) + Math.sin(x * 0.4) * 0.8);
      const blotch = rnd();
      let col = band > 0.4 ? floor : band < -0.5 ? floor2 : wallLight;
      if (biome.liquid !== 'none' && blotch < biome.liquidShare * 1.6) col = liquid;
      if (biome.id === 'ocean' && band < 0.3) col = liquid;
      if (biome.id === 'ice' && (y < size * 0.2 || y > size * 0.8)) col = accent;
      if (biome.id === 'crystal' && blotch > 0.9) col = hazard;
      if (biome.id === 'volcanic' && blotch > 0.88) col = liquid;
      if (biome.id === 'wreck' && blotch > 0.85) col = accent;
      const light = (dx + dy) / r;
      if (light > 0.55) col = shade(col, -0.45);
      else if (light > 0.2) col = shade(col, -0.2);
      else if (light < -0.6) col = shade(col, 0.2);
      p.set(x, y, col);
    }
  }
  void wall;
  return p;
}

// ---------------------------------------------------------------- Tiles

const TILE = 12;

function tiles(): SpriteDef[] {
  const out: SpriteDef[] = [];
  BIOMES.forEach((b, bi) => {
    const [floor, floor2, wall, wallLight, liquid, hazard, accent] = b.pal;
    for (let v = 0; v < 2; v++) {
      const r = lcg(500 + bi * 31 + v);
      const f = new Px(TILE, TILE).rect(0, 0, TILE, TILE, floor);
      for (let i = 0; i < 10; i++) f.set(Math.floor(r() * TILE), Math.floor(r() * TILE), floor2);
      if (v === 1) {
        // A pebble, a tuft, a shard: something per biome.
        const x = 3 + Math.floor(r() * 6);
        const y = 3 + Math.floor(r() * 6);
        f.set(x, y, accent).set(x + 1, y, shade(accent, -0.3)).set(x, y + 1, shade(accent, -0.3));
      }
      out.push(def(`tile-${b.id}-floor${v}`, f));
    }
    const w = new Px(TILE, TILE).rect(0, 0, TILE, TILE, wall);
    const rw = lcg(900 + bi);
    for (let i = 0; i < 14; i++) w.set(Math.floor(rw() * TILE), Math.floor(rw() * TILE), shade(wall, -0.25));
    w.hline(0, 0, TILE, wallLight).hline(0, 1, TILE, shade(wallLight, -0.15));
    out.push(def(`tile-${b.id}-wall`, w));
    const top = new Px(TILE, TILE).rect(0, 0, TILE, TILE, wall);
    for (let i = 0; i < 10; i++) top.set(Math.floor(rw() * TILE), Math.floor(rw() * TILE), shade(wall, 0.12));
    out.push(def(`tile-${b.id}-rock`, top));
    for (let fr = 0; fr < 2; fr++) {
      const l = new Px(TILE, TILE).rect(0, 0, TILE, TILE, liquid);
      for (let x = 0; x < TILE; x++) {
        const y = Math.floor((Math.sin((x + fr * 3) * 0.8) + 1) * 2.5) + 2;
        l.set(x, y, shade(liquid, 0.3));
        l.set((x + 6) % TILE, (y + 5) % TILE, shade(liquid, -0.2));
      }
      out.push(def(`tile-${b.id}-liquid${fr}`, l));
    }
    const h = new Px(TILE, TILE).rect(0, 0, TILE, TILE, floor);
    const rh = lcg(700 + bi);
    for (let i = 0; i < 22; i++) h.set(Math.floor(rh() * TILE), Math.floor(rh() * TILE), hazard);
    for (let i = 0; i < 6; i++) h.set(Math.floor(rh() * TILE), Math.floor(rh() * TILE), shade(hazard, 0.35));
    out.push(def(`tile-${b.id}-hazard`, h));
  });
  return out;
}

// ---------------------------------------------------------------- Creatures

function growCreature(seed: number, color: string, frame: number, ranged: boolean, big: boolean): Px {
  const r = lcg(seed);
  const w = big ? 16 : 12;
  const h = big ? 16 : 12;
  const half = w / 2;
  const p = new Px(w, h);
  const bodyTop = 2;
  const bodyBot = h - 4;
  for (let y = bodyTop; y <= bodyBot; y++) {
    const t = (y - bodyTop) / (bodyBot - bodyTop);
    const width = Math.sin(Math.PI * (0.15 + t * 0.85)) * (half - 1);
    for (let x = 0; x < half; x++) {
      const fc = half - 1 - x;
      if (fc < width && (fc < width - 1 || r() < 0.7)) {
        const c = t < 0.3 ? shade(color, 0.25) : t > 0.8 ? shade(color, -0.3) : color;
        p.set(x, y, c).set(w - 1 - x, y, c);
      }
    }
  }
  // Eyes.
  const ey = bodyTop + 2;
  p.set(half - 2, ey, '#ffffff').set(half + 1, ey, '#ffffff');
  p.set(half - 2, ey + 1, '#200a0a').set(half + 1, ey + 1, '#200a0a');
  // Legs or tendrils, shuffled between frames.
  const legs = ranged ? 2 : 3;
  for (let i = 0; i < legs; i++) {
    const lx = 1 + Math.floor(((i + 0.5) / legs) * (half - 2));
    const off = (i + frame) % 2;
    for (let j = 0; j < 3; j++) {
      p.set(lx - (j === 2 ? off : 0), bodyBot + j - 1, shade(color, -0.4));
      p.set(w - 1 - lx + (j === 2 ? off : 0), bodyBot + j - 1, shade(color, -0.4));
    }
  }
  if (ranged) {
    // A spout on top.
    p.set(half - 1, 1, shade(color, 0.4)).set(half, 1, shade(color, 0.4)).set(half - 1, 0, '#ffffa0').set(half, 0, '#ffffa0');
  }
  return outline(p);
}

function creatures(): SpriteDef[] {
  const out: SpriteDef[] = [];
  FAUNA.forEach((f, i) => {
    for (let fr = 0; fr < 2; fr++) out.push(def(`fauna-${f.id}-${fr}`, growCreature(3000 + i * 131, f.color, fr, f.ranged, false)));
    out.push(def(`fauna-${f.id}-alpha`, growCreature(3000 + i * 131, shade(f.color, -0.15), 0, f.ranged, true)));
  });
  return out;
}

// ---------------------------------------------------------------- The explorer

function explorer(suit: string, frame: number): Px {
  const rows = [
    '....aaaa....',
    '...abbbba...',
    '...bccccb...',
    '...bcddcb...',
    '...abbbba...',
    '..asssssa...',
    '.asstsstsa..',
    '.sssssssss..',
    '.ss.ssss.ss.',
    '....ssss....',
    frame ? '...ss..ss...' : '....ss.ss...',
    frame ? '...kk..kk...' : '....kk.kk...',
  ].map((r) => r.padEnd(12, '.').slice(0, 12));
  return outline(Px.from(rows, { a: '#5a6070', b: '#d8dce4', c: '#5ab0e0', d: '#a0e8ff', s: suit, t: shade(suit, 0.4), k: '#3a3e48' }));
}

// ---------------------------------------------------------------- Entities and icons

const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  'ent-cache': {
    rows: ['..........', '.aaaaaaaa.', '.abbbbbba.', '.accccca..', '.aaaaaaaa.', '.abbddbba.', '.abbddbba.', '.abbbbbba.', '.aaaaaaaa.', '..........'].map((r) => r.padEnd(10, '.')),
    pal: { a: '#5a4a2a', b: '#c89a50', c: '#e8c070', d: '#f0e0a0' },
  },
  'ent-terminal': {
    rows: ['.aaaaaaaa.', '.abbbbbba.', '.abccccba.', '.abcdcdba.', '.abccccba.', '.abbbbbba.', '.aaaaaaaa.', '...aaaa...', '..aaaaaa..', '..........'],
    pal: { a: '#3a4048', b: '#1a2028', c: '#2a8a9a', d: '#8af0ff' },
  },
  'ent-pod': {
    rows: ['...aaaa...', '..abbbba..', '.abccccba.', '.abcddcba.', '.abcddcba.', '.abcddcba.', '.abccccba.', '.abbeebba.', '..abbbba..', '...aaaa...'],
    pal: { a: '#4a5060', b: '#c8d0dc', c: '#80c8f0', d: '#e0f8ff', e: '#f0b040' },
  },
  'ent-objective': {
    rows: ['....aa....', '...abba...', '..abccba..', '.abccccba.', 'abccddccba', 'abccddccba', '.abccccba.', '..abccba..', '...abba...', '....aa....'],
    pal: { a: '#6a5010', b: '#f0b020', c: '#ffe070', d: '#ffffff' },
  },
  'ent-turret': {
    rows: ['....aa....', '....bb....', '...abba...', '..abccba..', '.abccccba.', '.abbbbbba.', '..a....a..', '.a......a.', 'a........a', '..........'],
    pal: { a: '#4a4e58', b: '#c0c4cc', c: '#f04040' },
  },
  'res-fuel': {
    rows: ['..aaaa....', '..abba....', '.aaaaaa...', '.abbbba...', '.abccba...', '.abccba...', '.abccba...', '.abbbba...', '.aaaaaa...', '..........'],
    pal: { a: '#5a3a1a', b: '#e08030', c: '#ffc060' },
  },
  'res-food': {
    rows: ['....a.....', '...ab.....', '..aaaa....', '.abbbba...', 'abbccbba..', 'abccccba..', 'abbccbba..', '.abbbba...', '..aaaa....', '..........'],
    pal: { a: '#2a5a1a', b: '#6ac040', c: '#b0f070' },
  },
  'res-energy': {
    rows: ['.....aa...', '....aba...', '...abba...', '..abbaaa..', '.aaaabba..', '...abba...', '..abba....', '..aba.....', '..aa......', '..........'],
    pal: { a: '#6a5a10', b: '#ffe040' },
  },
  'res-hull': {
    rows: ['.aaaaaaaa.', '.abbbbbba.', '.abccccba.', '.abccccba.', '.abccccba.', '..abccba..', '..abccba..', '...abba...', '....aa....', '..........'],
    pal: { a: '#3a4250', b: '#a8b4c4', c: '#d8e0ec' },
  },
  'res-credits': {
    rows: ['...aaaa...', '..abbbba..', '.abbccbba.', '.abcbbbba.', '.abbccbba.', '.abbbbcba.', '.abbccbba.', '..abbbba..', '...aaaa...', '..........'],
    pal: { a: '#6a5010', b: '#f0c040', c: '#8a6a10' },
  },
  'icon-colonist': {
    rows: ['...aaa....', '..abbba...', '..abbba...', '...aaa....', '..accca...', '.acccccа..'.replace('а', 'a'), '.ac.c.ca..', '...c.c....', '...a.a....', '..........'],
    pal: { a: '#4a5060', b: '#f0d0b0', c: '#80c8f0' },
  },
  'icon-day': {
    rows: ['....a.....', '.a..a..a..', '..abbba...', '..bcccb...', 'aabcccbaa.', '..bcccb...', '..abbba...', '.a..a..a..', '....a.....', '..........'],
    pal: { a: '#c08020', b: '#f0b040', c: '#ffe080' },
  },
  'icon-ark': {
    rows: ['..........', 'aaaaaaaaaa', 'abbbbbbbba', 'abcbcbcbba', 'abbbbbbbba', 'aaaaaaaaaa', '..a....a..', '..........', '..........', '..........'],
    pal: { a: '#3a4250', b: '#c8d0dc', c: '#80c8f0' },
  },
  'icon-xp': {
    rows: ['....a.....', '...aba....', 'aaabbbaaa.', '.abbbbba..', '..abbba...', '.abbabba..', '.aba.aba..', '.a.....a..', '..........', '..........'],
    pal: { a: '#6a5010', b: '#f0d040' },
  },
  'icon-morale': {
    rows: ['..aaaaa...', '.abbbbba..', 'abcbbbcba.', 'abbbbbbba.', 'abcbbbcba.', 'abbcccbba.', '.abbbbba..', '..aaaaa...', '..........', '..........'],
    pal: { a: '#6a5010', b: '#f0d040', c: '#3a2a00' },
  },
};

const MAT_ICON = ['...aaa....', '..abbba...', '.abbcbba..', '.abccbba..', 'abbbbbbba.', 'abcbbbcba.', '.abbbbba..', '..aaaaa...', '..........', '..........'];
const ITEM_ICON: Record<string, string[]> = {
  medkit: ['.aaaaaaaa.', '.abbbbbba.', '.abbccbba.', '.abccccba.', '.abccccba.', '.abbccbba.', '.abbbbbba.', '.aaaaaaaa.', '..........', '..........'],
  ration: ['..........', '.aaaaaaaa.', '.abbbbbba.', '.acccccca.', '.abbbbbba.', '.abbbbbba.', '.aaaaaaaa.', '..........', '..........', '..........'],
  fuelcell: ['...aa.....', '..abba....', '..abba....', '..acca....', '..acca....', '..acca....', '..abba....', '..aaaa....', '..........', '..........'],
  powercell: ['...aa.....', '..aaaa....', '..abba....', '..acca....', '..abba....', '..acca....', '..abba....', '..aaaa....', '..........', '..........'],
  o2can: ['...aa.....', '..abba....', '.abccba...', '.abccba...', '.abccba...', '.abccba...', '.abbbba...', '..aaaa....', '..........', '..........'],
  repairkit: ['..........', '.a....a...', '.ab..ba...', '..abba....', '...cc.....', '..acca....', '.ab..ba...', '.a....a...', '..........', '..........'],
  decoy: ['....a.....', '...aba....', '..abcba...', '.abcccba..', '..abcba...', '...aba....', '..a...a...', '.a.....a..', '..........', '..........'],
  stim: ['.......a..', '......ab..', '.....abc..', '....abca..', '...abca...', '..abca....', '..aaa.....', '.a........', '..........', '..........'],
  scanner: ['..aaaaa...', '.abbbbba..', 'abbcccbba.', 'abcbbbcba.', 'abcbcbcba.', 'abcbbbcba.', 'abbcccbba.', '.abbbbba..', '..aaaaa...', '..........'],
  shieldcell: ['..aaaaa...', '.abbbbba..', 'abccccba..', 'abccccba..', 'abccccba..', '.abccba...', '..abba....', '...aa.....', '..........', '..........'],
};
const ITEM_PAL: Record<string, [string, string, string]> = {
  medkit: ['#6a1a1a', '#f0f0f0', '#e04040'],
  ration: ['#4a3a1a', '#c8a060', '#8a6a3a'],
  fuelcell: ['#5a3a1a', '#e08030', '#ffc060'],
  powercell: ['#3a3a10', '#c0c040', '#ffff80'],
  o2can: ['#1a3a5a', '#4a90d0', '#a0e0ff'],
  repairkit: ['#3a4250', '#a8b4c4', '#f0b040'],
  decoy: ['#3a3a48', '#8a8a9a', '#f04040'],
  stim: ['#3a1a4a', '#c080f0', '#f0d0ff'],
  scanner: ['#1a3a3a', '#40a0a0', '#a0ffff'],
  shieldcell: ['#1a2a5a', '#4a70e0', '#a0c0ff'],
};

const GEAR_ICON: Record<string, string[]> = {
  weapon: ['..........', '..........', 'aaaaaaaaa.', 'abbbbbbbca', 'aaaabaaaa.', '...aba....', '...aba....', '...aaa....', '..........', '..........'],
  suit: ['..aaaaaa..', '.abbbbbba.', 'abbccccbba', 'abbbbbbbba', 'abbbbbbbba', '.abbbbbba.', '.abb..bba.', '.aaa..aaa.', '..........', '..........'],
  tool: ['......aa..', '.....abba.', '....abba..', '...abba...', '..aca.....', '.aca......', 'aca.......', 'aa........', '..........', '..........'],
  module: ['.aaaaaaaa.', '.abbbbbba.', '.abcbbcba.', '.abbbbbba.', '.abcbbcba.', '.abbbbbba.', '.aaaaaaaa.', '..a....a..', '..........', '..........'],
};

const NODE_ICON: Record<string, (p: Px) => void> = {
  entry: (p) => p.disc(6, 6, 5, '#3a4a6a', '#8aa0d0').disc(6, 6, 2, '#c8d8ff'),
  system: (p) => p.disc(6, 6, 4, '#f0c040', '#f08020').set(5, 5, '#fff0a0').set(6, 5, '#fff0a0'),
  station: (p) => p.rect(1, 5, 10, 2, '#a8b0bc').rect(5, 1, 2, 10, '#a8b0bc').disc(6, 6, 2, '#5ad0f0', '#3a4250'),
  derelict: (p) => p.line(1, 9, 9, 2, '#8a7a6a').line(2, 10, 10, 3, '#6a5a4a').rect(4, 4, 4, 3, '#8a7a6a').set(6, 5, '#f04040'),
  asteroids: (p) => p.disc(4, 4, 2, '#8a7a6a', '#4a3e34').disc(8, 7, 3, '#9a8a7a', '#4a3e34').disc(3, 9, 1, '#7a6a5a'),
  nebula: (p) => p.disc(5, 6, 4, '#6a3a8a').disc(7, 5, 3, '#9a5ac0').disc(6, 7, 2, '#d0a0f0'),
  anomaly: (p) => p.disc(6, 6, 5, '#1a0a2a', '#c070f0').disc(6, 6, 2, '#ffffff').set(6, 1, '#f0d0ff').set(6, 11, '#f0d0ff'),
  distress: (p) => p.rect(5, 1, 2, 7, '#f04040').rect(5, 9, 2, 2, '#f04040'),
  patrol: (p) => p.rect(5, 1, 2, 9, '#c8ccd4').rect(2, 5, 8, 2, '#c8ccd4').rect(4, 9, 4, 2, '#f08040'),
  gate: (p) => p.disc(6, 6, 5, '#1a3a4a', '#5ad0f0').disc(6, 6, 3, '#0a1a2a', '#a0f0ff'),
};

const SUB_ICON: Record<string, string[]> = {
  weapons: ['..........', '.aaaaaaa..', '.abbbbbbbc', '.aaaaaaa..', '....aa....', '....aa....', '..........', '..........', '..........', '..........'],
  shields: ['..aaaaa...', '.abbbbba..', 'ab.....ba.', 'ab.....ba.', '.ab...ba..', '..ab.ba...', '...aba....', '....a.....', '..........', '..........'],
  engines: ['...aaaa...', '..abbbba..', '..abbbba..', '..abbbba..', '...cccc...', '...dccd...', '....dd....', '....d.....', '..........', '..........'],
  sensors: ['.a.....a..', '..a...a...', '...aaa....', '..abbba...', '..abcba...', '..abbba...', '...aaa....', '...a.a....', '..........', '..........'],
  life: ['..a...a...', '.aba.aba..', 'abbbabbba.', 'abbbbbbba.', '.abbbbba..', '..abbba...', '...aba....', '....a.....', '..........', '..........'],
};

export function buildSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];
  out.push(def('ship-wren', wren()));
  out.push(...enemySprites());
  for (const [i, b] of BIOMES.entries()) {
    out.push(def(`planet-${b.id}`, outline(planet(b, 7, 40 + i))));
    out.push(def(`planet-${b.id}-big`, planet(b, 22, 80 + i)));
  }
  out.push(...tiles());
  out.push(...creatures());
  for (const c of CLASSES) for (let fr = 0; fr < 2; fr++) out.push(def(`explorer-${c.id}-${fr}`, explorer(c.color, fr)));
  for (const [name, ic] of Object.entries(ICONS)) out.push(def(name, outline(Px.from(ic.rows, ic.pal))));
  for (const m of MATERIALS) {
    const pal = { a: shade(m.color, -0.55), b: m.color, c: shade(m.color, 0.45) };
    out.push(def(`mat-${m.id}`, outline(Px.from(MAT_ICON, pal))));
    if (!m.refined) {
      // On the ground: a bigger outcrop of the same.
      const p = new Px(12, 12);
      p.disc(4, 7, 3, m.color, shade(m.color, -0.5)).disc(8, 6, 3, shade(m.color, 0.15), shade(m.color, -0.5)).disc(6, 4, 2, shade(m.color, 0.45));
      out.push(def(`ent-node-${m.id}`, outline(p)));
    }
  }
  for (const [id, rows] of Object.entries(ITEM_ICON)) {
    const [a, b, c] = ITEM_PAL[id]!;
    out.push(def(`item-${id}`, outline(Px.from(rows, { a, b, c }))));
  }
  for (const [slot, rows] of Object.entries(GEAR_ICON)) out.push(def(`gear-${slot}`, outline(Px.from(rows, { a: '#3a3e48', b: '#c8ccd4', c: '#f0b040' }))));
  for (const [kind, draw] of Object.entries(NODE_ICON)) {
    const p = new Px(12, 12);
    draw(p);
    out.push(def(`node-${kind}`, outline(p)));
  }
  for (const [id, rows] of Object.entries(SUB_ICON)) out.push(def(`sub-${id}`, outline(Px.from(rows, { a: '#3a4250', b: '#c8d0dc', c: '#f08040', d: '#ffd060' }))));
  for (const c of CLASSES) {
    const p = new Px(10, 10).disc(4, 4, 4, c.color, shade(c.color, -0.5));
    out.push(def(`class-${c.id}`, outline(p)));
  }
  // The lander, seen from above.
  const lander = new Px(20, 20);
  lander.disc(10, 10, 7, '#8a929c', '#3a3e48').disc(10, 10, 4, '#c8ccd4', '#5a5e68').disc(10, 9, 2, '#a0e8ff');
  for (const [x, y] of [[2, 2], [17, 2], [2, 17], [17, 17]] as const) lander.line(10, 10, x, y, '#5a5e68').set(x, y, '#f0b040');
  out.push(def('ent-lander', outline(lander)));
  void FACTION;
  return out;
}

// ---------------------------------------------------------------- Portraits (drawn at runtime, not baked)

const SKIN = ['#f0d0b0', '#d8a880', '#b07850', '#8a5a3a', '#5a3a28', '#e8c0a0'];
const HAIR = ['#2a1a10', '#6a3a1a', '#c08030', '#e0d0a0', '#a03020', '#5a5a6a'];
const BG = ['#2a3450', '#3a2a48', '#2a4038', '#4a3428', '#203040', '#40283a'];

/** A 16×16 face from six part indices: skin, hair colour, hair style, eyes, suit, background. */
export function portraitPx(parts: readonly number[], suit: string): Px {
  const [sk = 0, hc = 0, hs = 0, ey = 0, , bg = 0] = parts;
  const p = new Px(16, 16).rect(0, 0, 16, 16, BG[bg % BG.length]!);
  const skin = SKIN[sk % SKIN.length]!;
  const hair = HAIR[hc % HAIR.length]!;
  // Shoulders.
  p.rect(2, 13, 12, 3, suit).rect(5, 12, 6, 1, shade(suit, 0.2));
  // Neck and head.
  p.rect(6, 11, 4, 2, shade(skin, -0.15));
  p.rect(4, 4, 8, 8, skin).rect(5, 3, 6, 1, skin).rect(5, 12, 6, 0, skin);
  p.vline(11, 5, 6, shade(skin, -0.12));
  // Hair styles.
  const style = hs % 6;
  if (style === 0) p.rect(4, 2, 8, 2, hair).rect(4, 4, 1, 3, hair).rect(11, 4, 1, 3, hair);
  if (style === 1) p.rect(3, 2, 10, 3, hair).rect(3, 5, 2, 6, hair).rect(11, 5, 2, 6, hair);
  if (style === 2) p.rect(5, 2, 6, 1, hair).rect(4, 3, 8, 1, hair);
  if (style === 3) p.rect(4, 1, 8, 3, hair).rect(7, 0, 2, 1, hair);
  if (style === 4) p.rect(3, 3, 10, 2, hair).rect(3, 5, 1, 8, hair).rect(12, 5, 1, 8, hair);
  if (style === 5) p.rect(6, 1, 4, 3, hair);
  // Eyes and mouth.
  const eye = ['#202838', '#3a6a9a', '#3a7a3a', '#6a4020', '#5a5a6a', '#8a3a8a'][ey % 6]!;
  p.set(6, 7, eye).set(9, 7, eye).set(6, 6, shade(hair, -0.2)).set(9, 6, shade(hair, -0.2));
  p.rect(7, 10, 2, 1, shade(skin, -0.35));
  return outline(p, '#0c0e16');
}
