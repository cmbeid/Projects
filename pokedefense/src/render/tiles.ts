/**
 * Each map's ground, drawn once in code as 16 px pixel-art tiles into an
 * offscreen canvas, then scaled up with nearest-neighbour so it stays crisp.
 * No tilesets are shipped: every theme is a palette and a few little
 * pixel patterns.
 */
import { COLS, type MapDef, pathTiles, ROWS, type Terrain, terrainAt, type Theme, warpTiles } from '../data/maps';
import { makeRng, hashString } from '../game/rng';

export const TILE_PX = 16;

interface Palette {
  ground: string;
  groundDot: string;
  groundDark: string;
  path: string;
  pathEdge: string;
  pathDot: string;
  water: string;
  waterLight: string;
  block: string;
  blockLight: string;
  blockDark: string;
  accent: string;
}

const PALETTES: Record<Theme, Palette> = {
  forest: { ground: '#4f9a3c', groundDot: '#6cb850', groundDark: '#3e7f2f', path: '#d6b878', pathEdge: '#a8894e', pathDot: '#c4a464', water: '#3a78c8', waterLight: '#7ab0ea', block: '#2c6a2e', blockLight: '#4a8c3a', blockDark: '#1c4a20', accent: '#f0d048' },
  cave: { ground: '#7a6a58', groundDot: '#8c7c68', groundDark: '#5e5042', path: '#b09a78', pathEdge: '#806a4e', pathDot: '#a08a68', water: '#3a5a8a', waterLight: '#6a8aba', block: '#4e4238', blockLight: '#6a5c4e', blockDark: '#342c24', accent: '#c8b8f8' },
  ship: { ground: '#c49256', groundDot: '#d4a468', groundDark: '#9e7240', path: '#b83a3a', pathEdge: '#7c2424', pathDot: '#cc5050', water: '#2c6cc0', waterLight: '#72aaec', block: '#6a6a78', blockLight: '#9090a0', blockDark: '#44444e', accent: '#f8f0d0' },
  garden: { ground: '#5cb44a', groundDot: '#7ccc5c', groundDark: '#48963a', path: '#dcd4bc', pathEdge: '#aca488', pathDot: '#c8c0a8', water: '#3a88d0', waterLight: '#8ac0f0', block: '#2e7a36', blockLight: '#4c9c48', blockDark: '#1e5424', accent: '#f878a8' },
  tower: { ground: '#6a6078', groundDot: '#7a7088', groundDark: '#544a62', path: '#4a3a66', pathEdge: '#2e2444', pathDot: '#5a4a78', water: '#3a4a88', waterLight: '#6a7ab8', block: '#9a98a8', blockLight: '#c0c0cc', blockDark: '#6a6878', accent: '#b8a0e8' },
  office: { ground: '#c8cad4', groundDot: '#d8dae2', groundDark: '#a8aab8', path: '#4a6eb4', pathEdge: '#2e4a84', pathDot: '#5a80c4', water: '#3a78c8', waterLight: '#7ab0ea', block: '#4e5668', blockLight: '#6e7688', blockDark: '#343a48', accent: '#f8d040' },
  volcano: { ground: '#7a4a3a', groundDot: '#8e5a46', groundDark: '#5e382c', path: '#b0a090', pathEdge: '#7e6e60', pathDot: '#9e8e7e', water: '#e05818', waterLight: '#f8a838', block: '#4a2e26', blockLight: '#6a443a', blockDark: '#301c18', accent: '#f8d048' },
  gym: { ground: '#d4bc92', groundDot: '#e0caa2', groundDark: '#b89e74', path: '#9a6e44', pathEdge: '#6a4a2a', pathDot: '#aa7e54', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a4632', blockLight: '#7a664e', blockDark: '#3a2c1e', accent: '#58a858' },
  plateau: { ground: '#6a9a4a', groundDot: '#80b05a', groundDark: '#547e3a', path: '#c4ac7c', pathEdge: '#94804e', pathDot: '#b09a6a', water: '#3a78c8', waterLight: '#7ab0ea', block: '#7a7068', blockLight: '#9e948a', blockDark: '#524a44', accent: '#f8e070' },
  deepcave: { ground: '#3c3c5a', groundDot: '#4a4a6a', groundDark: '#2c2c46', path: '#6e6e8e', pathEdge: '#48486a', pathDot: '#7e7e9e', water: '#24487a', waterLight: '#4a78b0', block: '#26263a', blockLight: '#3e3e58', blockDark: '#181826', accent: '#b070f0' },
  bamboo: { ground: '#a47a4a', groundDot: '#b88c58', groundDark: '#7e5a34', path: '#5c3c6c', pathEdge: '#3a2448', pathDot: '#6e4c80', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a9a3a', blockLight: '#8ac85a', blockDark: '#3a6a24', accent: '#f8d048' },
  darkforest: { ground: '#2f6a36', groundDot: '#3e7e44', groundDark: '#22502a', path: '#8c7c56', pathEdge: '#5c4e34', pathDot: '#7c6c48', water: '#2e5a8a', waterLight: '#5a8aba', block: '#1a4222', blockLight: '#2e5e34', blockDark: '#0e2a14', accent: '#e8f070' },
  city: { ground: '#b8bac4', groundDot: '#caccd4', groundDark: '#9a9ca8', path: '#5e606a', pathEdge: '#3e4048', pathDot: '#f0e068', water: '#3a78c8', waterLight: '#7ab0ea', block: '#c8704a', blockLight: '#e89068', blockDark: '#8a4a30', accent: '#f8d048' },
  ash: { ground: '#5c4c44', groundDot: '#6e5c52', groundDark: '#443630', path: '#9c8c7c', pathEdge: '#6c5c4e', pathDot: '#8a7a6a', water: '#e06a28', waterLight: '#f8b048', block: '#3a2a22', blockLight: '#5a443a', blockDark: '#221812', accent: '#f87838' },
  cliffs: { ground: '#7cb452', groundDot: '#94c864', groundDark: '#5e9240', path: '#e2d49c', pathEdge: '#b4a470', pathDot: '#d0c088', water: '#2a6cc0', waterLight: '#78b0ec', block: '#8a7a6a', blockLight: '#aa9a8a', blockDark: '#5e5044', accent: '#f8f0d0' },
  lighthouse: { ground: '#d6cebe', groundDot: '#e4ddd0', groundDark: '#b4ac9c', path: '#b0443a', pathEdge: '#7a2a24', pathDot: '#c45a50', water: '#2a6cc0', waterLight: '#78b0ec', block: '#8c8c9c', blockLight: '#acacbc', blockDark: '#5e5e6c', accent: '#f8e070' },
  icecave: { ground: '#c4dcee', groundDot: '#e2f0fa', groundDark: '#a0bcd4', path: '#88acd0', pathEdge: '#5e84aa', pathDot: '#a8c8e4', water: '#3a6cb0', waterLight: '#8ab8e8', block: '#6a8cb4', blockLight: '#9cc0e0', blockDark: '#445e84', accent: '#ffffff' },
  dragonden: { ground: '#3c4c6c', groundDot: '#4a5c7e', groundDark: '#2c3a56', path: '#6c7c9a', pathEdge: '#48587a', pathDot: '#7c8caa', water: '#2656a6', waterLight: '#5a8ad6', block: '#262e46', blockLight: '#3a4460', blockDark: '#161c2e', accent: '#88a8f8' },
  mountain: { ground: '#8c8c90', groundDot: '#e8ecf0', groundDark: '#6c6c72', path: '#b4ac9e', pathEdge: '#847c70', pathDot: '#a49c8e', water: '#3a6cb0', waterLight: '#8ab8e8', block: '#5a5a62', blockLight: '#e0e4ea', blockDark: '#3a3a40', accent: '#ffffff' },
  woods: { ground: '#3c8a3c', groundDot: '#4ea04a', groundDark: '#2c6e2e', path: '#b8985e', pathEdge: '#8a6e40', pathDot: '#a8884e', water: '#2e70b8', waterLight: '#6aa8e0', block: '#1c5a28', blockLight: '#2e7a38', blockDark: '#103a18', accent: '#f8c8e0' },
  granite: { ground: '#8a7a68', groundDot: '#9c8c7a', groundDark: '#6c5e4e', path: '#aa9a7c', pathEdge: '#7c6c52', pathDot: '#9a8a6c', water: '#2e5e96', waterLight: '#5e8ec6', block: '#5a4a3e', blockLight: '#7a6a5a', blockDark: '#3a2e26', accent: '#c8b8f8' },
  powerplant: { ground: '#a4a6b6', groundDot: '#b8bac8', groundDark: '#848698', path: '#d8bc40', pathEdge: '#a08a24', pathDot: '#e8d060', water: '#3a78c8', waterLight: '#7ab0ea', block: '#484a5a', blockLight: '#686a7c', blockDark: '#2e303c', accent: '#f8e048' },
  ashen: { ground: '#8c8a82', groundDot: '#a09e96', groundDark: '#6e6c66', path: '#c6b690', pathEdge: '#968866', pathDot: '#b4a680', water: '#e05a1a', waterLight: '#f8a838', block: '#4e4a44', blockLight: '#6e6a62', blockDark: '#32302c', accent: '#f8d048' },
  dojo: { ground: '#c89e6c', groundDot: '#d8b07e', groundDark: '#a47e52', path: '#8a5634', pathEdge: '#5e3820', pathDot: '#9c6844', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a3e2c', blockLight: '#7a5a44', blockDark: '#3a2618', accent: '#f8f0d0' },
  rainroute: { ground: '#3a8446', groundDot: '#4a9a56', groundDark: '#2a6a36', path: '#968664', pathEdge: '#6a5c42', pathDot: '#867656', water: '#2e6ab4', waterLight: '#6ea2dc', block: '#1e5a2c', blockLight: '#2e7a3a', blockDark: '#123c1c', accent: '#b8e0ff' },
  space: { ground: '#ced2de', groundDot: '#e0e4ee', groundDark: '#aab0c0', path: '#3a3c6c', pathEdge: '#24264a', pathDot: '#f8f8a8', water: '#3a78c8', waterLight: '#7ab0ea', block: '#6a6c88', blockLight: '#8c8eaa', blockDark: '#4a4c64', accent: '#f878c8' },
  sootopolis: { ground: '#dcd4bc', groundDot: '#ece6d2', groundDark: '#bcb49c', path: '#b8a886', pathEdge: '#8a7c60', pathDot: '#a89878', water: '#2456b4', waterLight: '#5a8ee4', block: '#8a8478', blockLight: '#aaa498', blockDark: '#625e54', accent: '#88d8f8' },
  league: { ground: '#74a45c', groundDot: '#88b86c', groundDark: '#5c8a48', path: '#d2c292', pathEdge: '#a29264', pathDot: '#c2b282', water: '#2e70b8', waterLight: '#6aa8e0', block: '#8c847a', blockLight: '#aca49a', blockDark: '#645e56', accent: '#f8e070' },
  sky: { ground: '#8a9a78', groundDot: '#9cac8a', groundDark: '#6c7c5c', path: '#b0b690', pathEdge: '#808666', pathDot: '#a0a680', water: '#58a8e8', waterLight: '#b8e0ff', block: '#566454', blockLight: '#768474', blockDark: '#3a4638', accent: '#78f878' },
  // Sinnoh
  mine: { ground: '#6a5a4c', groundDot: '#7c6a5a', groundDark: '#4e4238', path: '#8a8a92', pathEdge: '#5e5e66', pathDot: '#3a3a40', water: '#2e4e7a', waterLight: '#5a7eaa', block: '#3e342c', blockLight: '#5a4c40', blockDark: '#281f1a', accent: '#f8c048' },
  eterna: { ground: '#347a3e', groundDot: '#44904c', groundDark: '#26602e', path: '#a48a5c', pathEdge: '#76603c', pathDot: '#947a4e', water: '#2e6aa8', waterLight: '#629ed8', block: '#1a4c24', blockLight: '#2c6a36', blockDark: '#0e3016', accent: '#f8e8a8' },
  veilstone: { ground: '#b0a498', groundDot: '#c2b8ac', groundDark: '#908478', path: '#6c6258', pathEdge: '#4a423a', pathDot: '#7e746a', water: '#3a78c8', waterLight: '#7ab0ea', block: '#7a6a5e', blockLight: '#9a8a7c', blockDark: '#52463e', accent: '#f86848' },
  marsh: { ground: '#6a8a4a', groundDot: '#7e9e5a', groundDark: '#526e38', path: '#8a7454', pathEdge: '#5e4c34', pathDot: '#7a6446', water: '#4a7a6a', waterLight: '#7aaa92', block: '#3e5a2a', blockLight: '#587840', blockDark: '#283c1a', accent: '#d8e878' },
  hearthome: { ground: '#e0c8b8', groundDot: '#ecd8ca', groundDark: '#c4ac9a', path: '#b87888', pathEdge: '#8a5060', pathDot: '#c88a9a', water: '#3a78c8', waterLight: '#7ab0ea', block: '#9a6a5a', blockLight: '#ba8a7a', blockDark: '#6a4638', accent: '#f878a8' },
  canalave: { ground: '#9a7a58', groundDot: '#ac8c68', groundDark: '#7a5e42', path: '#8a8e96', pathEdge: '#5e626a', pathDot: '#9aa0a8', water: '#23578e', waterLight: '#5a8ac0', block: '#5a5e68', blockLight: '#7a7e88', blockDark: '#3c3e46', accent: '#f8e070' },
  snowpoint: { ground: '#e6eef6', groundDot: '#ffffff', groundDark: '#c4d2e2', path: '#a8b8cc', pathEdge: '#7e90a8', pathDot: '#c0cedc', water: '#3a6cb0', waterLight: '#8ab8e8', block: '#4e6a58', blockLight: '#e8f0f6', blockDark: '#34483c', accent: '#88c8f8' },
  sunyshore: { ground: '#d8d0b8', groundDot: '#e8e0ca', groundDark: '#b8b098', path: '#2c3e6c', pathEdge: '#1c2848', pathDot: '#5a78c0', water: '#2a7ac8', waterLight: '#78b8f0', block: '#3c4c7c', blockLight: '#5c6ca0', blockDark: '#263254', accent: '#f8e048' },
  sinnohleague: { ground: '#c8c0d4', groundDot: '#d8d0e2', groundDark: '#a8a0b8', path: '#6a4a8a', pathEdge: '#48306a', pathDot: '#8a6aaa', water: '#3a78c8', waterLight: '#7ab0ea', block: '#8a8298', blockLight: '#aaa2b8', blockDark: '#625a70', accent: '#f8d048' },
  spearpillar: { ground: '#9a9aa8', groundDot: '#acacba', groundDark: '#7a7a88', path: '#c8c4d0', pathEdge: '#9894a2', pathDot: '#dcd8e4', water: '#4a3a8a', waterLight: '#8a6ae0', block: '#5e5e6c', blockLight: '#dcdce6', blockDark: '#3e3e4a', accent: '#b8a0f8' },
  // Unova
  striaton: { ground: '#8ab85a', groundDot: '#a0cc6c', groundDark: '#6e9a46', path: '#d8c8a8', pathEdge: '#a8987a', pathDot: '#c8b898', water: '#3a88d0', waterLight: '#8ac0f0', block: '#8a4a3a', blockLight: '#aa6a58', blockDark: '#5e3024', accent: '#f8f0d0' },
  museum: { ground: '#c8b08a', groundDot: '#d8c29c', groundDark: '#a88e6a', path: '#8a3a3a', pathEdge: '#5e2424', pathDot: '#a04c4c', water: '#3a78c8', waterLight: '#7ab0ea', block: '#6a5a48', blockLight: '#8a7a66', blockDark: '#463a2e', accent: '#f8d048' },
  pinwheel: { ground: '#4a8a3a', groundDot: '#5ea04a', groundDark: '#387030', path: '#b8a070', pathEdge: '#8a744c', pathDot: '#a89060', water: '#2e70b8', waterLight: '#6aa8e0', block: '#265a2a', blockLight: '#3a7a3a', blockDark: '#163c1a', accent: '#f8a8d8' },
  nimbasa: { ground: '#3a3848', groundDot: '#4a4858', groundDark: '#2a2836', path: '#e8c848', pathEdge: '#b09424', pathDot: '#f8e070', water: '#3a78c8', waterLight: '#7ab0ea', block: '#8a3a8a', blockLight: '#b85ab8', blockDark: '#5a225a', accent: '#48e8f8' },
  driftveil: { ground: '#9a8a78', groundDot: '#aa9c8a', groundDark: '#7a6c5c', path: '#6a6e76', pathEdge: '#4a4e56', pathDot: '#7a7e86', water: '#2a5e96', waterLight: '#5e92c6', block: '#8a5a3a', blockLight: '#aa7a58', blockDark: '#5e3a24', accent: '#f8b048' },
  mistralton: { ground: '#b8c4cc', groundDot: '#c8d4dc', groundDark: '#98a4ae', path: '#48546a', pathEdge: '#2e384a', pathDot: '#f8f8f8', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a6a4a', blockLight: '#7a8a6a', blockDark: '#3a4630', accent: '#f86848' },
  twistmountain: { ground: '#8a7a6a', groundDot: '#e4ecf2', groundDark: '#6a5c4e', path: '#aab4be', pathEdge: '#7a848e', pathDot: '#c4ccd4', water: '#3a6cb0', waterLight: '#8ab8e8', block: '#564a40', blockLight: '#d8e2ea', blockDark: '#3a3028', accent: '#ffffff' },
  opelucid: { ground: '#9aa0b0', groundDot: '#acb2c2', groundDark: '#7a8090', path: '#3a4a5a', pathEdge: '#26323e', pathDot: '#58e0c8', water: '#3a78c8', waterLight: '#7ab0ea', block: '#4a5a6a', blockLight: '#6a7a8a', blockDark: '#2e3a46', accent: '#58e0c8' },
  unovaleague: { ground: '#6a6a7a', groundDot: '#7c7c8c', groundDark: '#50505e', path: '#c8b070', pathEdge: '#98804a', pathDot: '#d8c488', water: '#3a78c8', waterLight: '#7ab0ea', block: '#3a3a48', blockLight: '#5a5a6a', blockDark: '#24242e', accent: '#f8d048' },
  chasm: { ground: '#d0dce6', groundDot: '#eef4f8', groundDark: '#a8b8c6', path: '#7e8a9a', pathEdge: '#58626e', pathDot: '#9aa6b4', water: '#2e4a7a', waterLight: '#6a8ab8', block: '#4e5a6a', blockLight: '#dce6ee', blockDark: '#343c48', accent: '#a8e8ff' },
  // Kalos
  santalune: { ground: '#5aa842', groundDot: '#74c056', groundDark: '#468a34', path: '#d8c08a', pathEdge: '#aa925e', pathDot: '#c8b07a', water: '#3a88d0', waterLight: '#8ac0f0', block: '#2e7036', blockLight: '#4c9046', blockDark: '#1c4c24', accent: '#f8e048' },
  glittering: { ground: '#5a5470', groundDot: '#6c6684', groundDark: '#44405a', path: '#8a849e', pathEdge: '#625e76', pathDot: '#a8e0f8', water: '#2e4a86', waterLight: '#5e7ab8', block: '#3a364c', blockLight: '#58e8f8', blockDark: '#24222e', accent: '#58e8f8' },
  mastery: { ground: '#d8c8a0', groundDot: '#e6d8b4', groundDark: '#b8a884', path: '#7a8aa0', pathEdge: '#566478', pathDot: '#8c9cb2', water: '#2a6cc0', waterLight: '#78b0ec', block: '#8a7a64', blockLight: '#aa9a84', blockDark: '#5e5242', accent: '#f878a8' },
  coumarine: { ground: '#7cb452', groundDot: '#94c864', groundDark: '#5e9240', path: '#c8a878', pathEdge: '#98784e', pathDot: '#b89868', water: '#2a7ac8', waterLight: '#78b8f0', block: '#8a6a4a', blockLight: '#aa8a68', blockDark: '#5e4630', accent: '#f8f0d0' },
  lumiose: { ground: '#e0d4c0', groundDot: '#ece2d2', groundDark: '#c2b49e', path: '#9a8a78', pathEdge: '#6e6052', pathDot: '#aa9a88', water: '#3a78c8', waterLight: '#7ab0ea', block: '#5a6a7a', blockLight: '#7a8a9a', blockDark: '#3a4652', accent: '#f8d048' },
  laverre: { ground: '#9ac878', groundDot: '#b0da8c', groundDark: '#7aa85e', path: '#e0b0c8', pathEdge: '#b0809a', pathDot: '#f0c8dc', water: '#5a98e0', waterLight: '#a0ccf8', block: '#7a5a8a', blockLight: '#9a7aaa', blockDark: '#523a5e', accent: '#f8a8d8' },
  anistar: { ground: '#9a8ab0', groundDot: '#ac9cc2', groundDark: '#7a6a90', path: '#d8d0e8', pathEdge: '#a8a0c0', pathDot: '#e8e0f8', water: '#3a58a8', waterLight: '#7a98e0', block: '#4a3a6a', blockLight: '#6a5a8a', blockDark: '#2e2446', accent: '#a8f8f8' },
  frostcavern: { ground: '#b8d4ea', groundDot: '#e0eefa', groundDark: '#94b4d0', path: '#6c8cb0', pathEdge: '#4a6a90', pathDot: '#8aaccc', water: '#2a5a9a', waterLight: '#6a9ada', block: '#4e6e94', blockLight: '#a8d0f0', blockDark: '#324a6a', accent: '#ffffff' },
  kalosleague: { ground: '#d0b890', groundDot: '#e0caa4', groundDark: '#b09a72', path: '#a83a4a', pathEdge: '#7a2432', pathDot: '#c05060', water: '#3a78c8', waterLight: '#7ab0ea', block: '#8a7458', blockLight: '#aa947a', blockDark: '#5e4e3a', accent: '#f8d048' },
  terminus: { ground: '#4a4e40', groundDot: '#5a5e4e', groundDark: '#363a2e', path: '#7a7c66', pathEdge: '#565844', pathDot: '#8a8c74', water: '#2e4e5e', waterLight: '#5a7e8e', block: '#2c3024', blockLight: '#48f048', blockDark: '#1a1c14', accent: '#48f048' },
};

export function palette(theme: Theme): Palette {
  return PALETTES[theme];
}

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

/** Themes floored with planks, with tiles, and with tufty grass; the rest are bare ground. */
const PLANKS: ReadonlySet<Theme> = new Set(['ship', 'bamboo', 'dojo', 'canalave', 'driftveil', 'coumarine']);
const TILED: ReadonlySet<Theme> = new Set([
  'office', 'city', 'lighthouse', 'powerplant', 'space', 'sootopolis', 'sky',
  'veilstone', 'hearthome', 'sunyshore', 'sinnohleague', 'spearpillar', 'museum', 'nimbasa', 'mistralton', 'opelucid',
  'unovaleague', 'mastery', 'lumiose', 'anistar', 'kalosleague',
]);
const GRASSY: ReadonlySet<Theme> = new Set([
  'forest', 'garden', 'plateau', 'woods', 'rainroute', 'cliffs', 'league', 'darkforest',
  'eterna', 'marsh', 'striaton', 'pinwheel', 'santalune', 'laverre',
]);

function ground(ctx: Ctx, p: Palette, theme: Theme, ox: number, oy: number, rng: () => number, kind: Terrain): void {
  px(ctx, ox, oy, 16, 16, p.ground);
  if (kind === 'sand') {
    px(ctx, ox, oy, 16, 16, '#e4d49c');
    for (let i = 0; i < 6; i += 1) px(ctx, ox + Math.floor(rng() * 15), oy + Math.floor(rng() * 15), 1, 1, '#c8b47c');
    px(ctx, ox + 2 + Math.floor(rng() * 8), oy + 5 + Math.floor(rng() * 6), 5, 1, '#f0e4b4');
    return;
  }
  if (kind === 'ice') {
    px(ctx, ox, oy, 16, 16, '#cce6f6');
    px(ctx, ox + 2, oy + 3, 6, 1, '#ffffff');
    px(ctx, ox + 8, oy + 10, 5, 1, '#ffffff');
    px(ctx, ox + 1, oy + 15, 16, 1, '#a8c8e0');
    return;
  }
  const planks = PLANKS.has(theme);
  const tiles = TILED.has(theme);
  if (planks || tiles || theme === 'gym') {
    // Planks, floor tiles or gym mats.
    if (planks) {
      for (let y = 0; y < 16; y += 4) px(ctx, ox, oy + y, 16, 1, p.groundDark);
      px(ctx, ox + ((oy / 16) % 2 ? 5 : 11), oy, 1, 16, p.groundDark);
    } else if (tiles) {
      px(ctx, ox, oy, 16, 1, p.groundDark);
      px(ctx, ox, oy, 1, 16, p.groundDark);
      px(ctx, ox + 1, oy + 1, 6, 1, p.groundDot);
    } else {
      if (((ox + oy) / 16) % 2) px(ctx, ox, oy, 16, 16, p.groundDot);
      px(ctx, ox, oy + 15, 16, 1, p.groundDark);
    }
  } else {
    for (let i = 0; i < 7; i += 1) px(ctx, ox + Math.floor(rng() * 15), oy + Math.floor(rng() * 15), 2, 1, i % 3 ? p.groundDot : p.groundDark);
    if (GRASSY.has(theme)) {
      // Tufts of grass.
      for (let i = 0; i < 2; i += 1) {
        const x = ox + 2 + Math.floor(rng() * 11);
        const y = oy + 3 + Math.floor(rng() * 10);
        px(ctx, x, y, 1, 2, p.groundDark);
        px(ctx, x + 2, y, 1, 2, p.groundDark);
        px(ctx, x + 1, y - 1, 1, 3, p.groundDark);
      }
    }
  }
  if (kind === 'flowers') {
    const colours = ['#f878a8', '#f8f8f8', '#f8d048', '#f89048'];
    for (let i = 0; i < 3; i += 1) {
      const x = ox + 2 + Math.floor(rng() * 11);
      const y = oy + 2 + Math.floor(rng() * 11);
      const c = colours[Math.floor(rng() * colours.length)]!;
      px(ctx, x, y - 1, 1, 1, c);
      px(ctx, x - 1, y, 3, 1, c);
      px(ctx, x, y + 1, 1, 1, c);
      px(ctx, x, y, 1, 1, '#f8e858');
    }
  }
  if (kind === 'ledge') {
    px(ctx, ox, oy + 12, 16, 4, p.groundDark);
    px(ctx, ox, oy + 12, 16, 1, p.groundDot);
    for (let x = 1; x < 16; x += 4) px(ctx, ox + x, oy + 13, 2, 3, p.blockDark);
  }
}

function water(ctx: Ctx, p: Palette, ox: number, oy: number, rng: () => number, lava: boolean): void {
  px(ctx, ox, oy, 16, 16, p.water);
  for (let i = 0; i < 3; i += 1) {
    const x = ox + Math.floor(rng() * 11);
    const y = oy + 2 + Math.floor(rng() * 12);
    px(ctx, x, y, 4, 1, p.waterLight);
    px(ctx, x + 1, y - 1, 2, 1, p.waterLight);
  }
  if (lava) for (let i = 0; i < 3; i += 1) px(ctx, ox + Math.floor(rng() * 14), oy + Math.floor(rng() * 14), 2, 2, '#f8e070');
}

function blocker(ctx: Ctx, p: Palette, theme: Theme, kind: Terrain, ox: number, oy: number, rng: () => number): void {
  if (kind === 'tree') {
    px(ctx, ox + 6, oy + 11, 4, 5, '#6a4a2a');
    px(ctx, ox + 2, oy + 2, 12, 10, p.block);
    px(ctx, ox + 1, oy + 4, 14, 6, p.block);
    px(ctx, ox + 4, oy + 1, 8, 2, p.block);
    px(ctx, ox + 4, oy + 3, 4, 2, p.blockLight);
    px(ctx, ox + 3, oy + 5, 2, 2, p.blockLight);
    px(ctx, ox + 2, oy + 10, 12, 2, p.blockDark);
  } else if (kind === 'rock') {
    px(ctx, ox + 1, oy + 4, 14, 11, p.block);
    px(ctx, ox + 3, oy + 2, 10, 3, p.block);
    px(ctx, ox + 3, oy + 3, 5, 3, p.blockLight);
    px(ctx, ox + 1, oy + 13, 14, 2, p.blockDark);
    px(ctx, ox + 9, oy + 7, 1, 4, p.blockDark);
  } else if (kind === 'grave') {
    px(ctx, ox + 4, oy + 3, 8, 11, p.block);
    px(ctx, ox + 5, oy + 2, 6, 1, p.block);
    px(ctx, ox + 5, oy + 3, 2, 10, p.blockLight);
    px(ctx, ox + 7, oy + 5, 3, 1, p.blockDark);
    px(ctx, ox + 8, oy + 4, 1, 4, p.blockDark);
    px(ctx, ox + 3, oy + 13, 10, 2, p.blockDark);
  } else if (kind === 'wall') {
    px(ctx, ox, oy, 16, 16, p.block);
    px(ctx, ox, oy, 16, 3, p.blockLight);
    px(ctx, ox, oy + 14, 16, 2, p.blockDark);
    if (theme === 'office' && rng() < 0.5) {
      // A potted plant against the wall.
      px(ctx, ox + 6, oy + 9, 4, 5, '#a0603a');
      px(ctx, ox + 4, oy + 4, 8, 6, '#3a8a3a');
    }
  } else if (kind === 'lava') {
    water(ctx, p, ox, oy, rng, true);
  } else if (kind === 'bamboo') {
    // Stalks of bamboo — or, indoors, Sprout Tower's great swaying pillar.
    for (const x of [1, 6, 11]) {
      px(ctx, ox + x, oy, 4, 16, p.block);
      px(ctx, ox + x, oy, 1, 16, p.blockLight);
      px(ctx, ox + x, oy + 5, 4, 1, p.blockDark);
      px(ctx, ox + x, oy + 12, 4, 1, p.blockDark);
    }
  }
}

function pathTile(ctx: Ctx, p: Palette, ox: number, oy: number, rng: () => number, open: { n: boolean; s: boolean; e: boolean; w: boolean }): void {
  px(ctx, ox, oy, 16, 16, p.path);
  for (let i = 0; i < 4; i += 1) px(ctx, ox + 2 + Math.floor(rng() * 12), oy + 2 + Math.floor(rng() * 12), 1, 1, p.pathDot);
  if (!open.n) px(ctx, ox, oy, 16, 2, p.pathEdge);
  if (!open.s) px(ctx, ox, oy + 14, 16, 2, p.pathEdge);
  if (!open.w) px(ctx, ox, oy, 2, 16, p.pathEdge);
  if (!open.e) px(ctx, ox + 14, oy, 2, 16, p.pathEdge);
}

function warpPad(ctx: Ctx, ox: number, oy: number, colour: string): void {
  px(ctx, ox + 2, oy + 2, 12, 12, '#283048');
  px(ctx, ox + 4, oy + 4, 8, 8, colour);
  px(ctx, ox + 6, oy + 6, 4, 4, '#f8f8f8');
}

/** The whole map's ground, 16 px a tile, path included. */
export function renderGround(map: MapDef): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE_PX;
  canvas.height = ROWS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  const p = PALETTES[map.theme];
  const rng = makeRng(hashString(map.id));
  const onPath = pathTiles(map);
  const isPath = (x: number, y: number): boolean => onPath.has(`${x},${y}`) || x < 0 || y < 0 || x >= COLS || y >= ROWS;

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ox = x * TILE_PX;
      const oy = y * TILE_PX;
      const kind = terrainAt(map, x, y);
      if (onPath.has(`${x},${y}`)) {
        const here = (dx: number, dy: number): boolean => onPath.has(`${x + dx},${y + dy}`) || (isPath(x + dx, y + dy) && !(x + dx >= 0 && y + dy >= 0 && x + dx < COLS && y + dy < ROWS));
        const open = { n: here(0, -1), s: here(0, 1), e: here(1, 0), w: here(-1, 0) };
        // Ice stays ice under the path: it is what makes enemies slide.
        pathTile(ctx, kind === 'ice' ? { ...p, path: '#a8d0ec', pathDot: '#ffffff', pathEdge: '#78a4c8' } : p, ox, oy, rng, open);
      } else if (kind === 'water') {
        water(ctx, p, ox, oy, rng, false);
      } else if (kind === 'tree' || kind === 'rock' || kind === 'grave' || kind === 'wall' || kind === 'lava' || kind === 'bamboo') {
        if (kind !== 'wall' && kind !== 'lava') ground(ctx, p, map.theme, ox, oy, rng, 'grass');
        blocker(ctx, p, map.theme, kind, ox, oy, rng);
      } else {
        ground(ctx, p, map.theme, ox, oy, rng, kind);
      }
    }
  }
  const colours = ['#f85888', '#58c8f8', '#f8d030'];
  warpTiles(map).forEach((w, i) => {
    const c = colours[i % colours.length]!;
    for (const pt of [w.from, w.to]) if (pt.x >= 0 && pt.y >= 0) warpPad(ctx, pt.x * TILE_PX, pt.y * TILE_PX, c);
  });
  return canvas;
}
