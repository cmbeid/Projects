import { pick, randInt, type Rng } from './rng';

const START = ['Ka', 'Ve', 'Or', 'Thal', 'Mir', 'Sel', 'Dra', 'Ny', 'Ost', 'Quo', 'Ar', 'Bel', 'Cyr', 'Eld', 'Gal', 'Hes', 'Ix', 'Lum', 'Pra', 'Rho', 'Tey', 'Ul', 'Vor', 'Zan'];
const MID = ['ra', 'lo', 'ven', 'thi', 'ma', 'dor', 'si', 'qua', 'rel', 'na', 'xo', 'pe', 'ri', 'ta'];
const END = ['n', 'th', 's', 'x', 'ra', 'ia', 'on', 'us', 'is', 'ae', 'or', 'um', 'ek'];
const GREEK = ['Prime', 'II', 'III', 'IV', 'V', 'b', 'c', 'd', 'Minor', 'Major'];
const STATION = ['Rest', 'Hold', 'Spire', 'Wheel', 'Dock', 'Haven', 'Market', 'Anchorage', 'Ring', 'Lantern', 'Bastion', 'Crossing'];

export function starName(r: Rng): string {
  const n = pick(r, START) + (r() < 0.6 ? pick(r, MID) : '') + pick(r, END);
  return r() < 0.3 ? `${n}-${randInt(r, 2, 99)}` : n;
}

export function planetName(r: Rng, star: string, i: number): string {
  return r() < 0.35 ? `${pick(r, START)}${pick(r, END)}` : `${star.split('-')[0]} ${GREEK[i] ?? pick(r, GREEK)}`;
}

export function stationName(r: Rng): string {
  return `${pick(r, START)}${pick(r, END)} ${pick(r, STATION)}`;
}
