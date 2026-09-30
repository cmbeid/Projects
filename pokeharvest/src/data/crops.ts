/** What grows on the farm. Growth counts nights spent watered. */
export interface Crop {
  id: string;
  name: string;
  /** Watered nights from seed to ripe. */
  days: number;
  /** After a harvest, ripe again this many watered nights later; otherwise the plant is used up. */
  regrow?: number;
  seedPrice: number;
  sellPrice: number;
  /** PokeAPI item icon of the ripe berry. */
  icon: string;
  /** Leaf and berry colours for the growing plant. */
  leaf: string;
  fruit: string;
}

export const CROPS: readonly Crop[] = [
  { id: 'cheri', name: 'Cheri Berry', days: 3, seedPrice: 15, sellPrice: 32, icon: 'cheri-berry', leaf: '#4d9a3a', fruit: '#e0402c' },
  { id: 'oran', name: 'Oran Berry', days: 4, seedPrice: 20, sellPrice: 45, icon: 'oran-berry', leaf: '#3f8f4a', fruit: '#3c6fd8' },
  { id: 'pecha', name: 'Pecha Berry', days: 6, seedPrice: 30, sellPrice: 80, icon: 'pecha-berry', leaf: '#5aa044', fruit: '#f28bb5' },
  { id: 'leppa', name: 'Leppa Berry', days: 8, regrow: 3, seedPrice: 50, sellPrice: 110, icon: 'leppa-berry', leaf: '#3b8a3b', fruit: '#e8672c' },
  { id: 'sitrus', name: 'Sitrus Berry', days: 10, seedPrice: 80, sellPrice: 200, icon: 'sitrus-berry', leaf: '#4f9440', fruit: '#f2d23c' },
];

const BY_ID = new Map(CROPS.map((c) => [c.id, c]));

export function crop(id: string): Crop {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`unknown crop ${id}`);
  return c;
}

export function isCrop(id: string): boolean {
  return BY_ID.has(id);
}
