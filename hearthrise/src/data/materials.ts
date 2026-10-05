import type { Material } from './types';

/**
 * Every material: salvage pulled from the ruins, relics found alongside it,
 * goods made in the workshops, and the heart-relic each district's landmarks
 * give up. Values jump roughly fifteenfold from one district to the next,
 * which is what pays for the heavier ruins further in.
 */
export const MATERIALS: readonly Material[] = [
  // --- The Landing ------------------------------------------------------------
  { id: 'driftwood', name: 'Driftwood', kind: 'salvage', value: 1, shades: ['#5a4630', '#9a7c58', '#d8c09a'], pile: 'timber' },
  { id: 'fieldstone', name: 'Fieldstone', kind: 'salvage', value: 2, shades: ['#4a4a4e', '#80807e', '#bcbab2'], pile: 'stone' },
  { id: 'clay', name: 'Clay', kind: 'salvage', value: 3, shades: ['#6a3420', '#b0603a', '#e8a070'], pile: 'stone' },
  { id: 'scrap', name: 'Scrap Iron', kind: 'salvage', value: 6, shades: ['#3a2a28', '#7a5244', '#c08a6a'], pile: 'metal' },
  { id: 'old-coin', name: 'Old Coin', kind: 'relic', value: 40, shades: ['#6a4a10', '#c89a2a', '#ffe08a'] },
  { id: 'brass-key', name: 'Brass Key', kind: 'relic', value: 70, shades: ['#5a4010', '#b08a30', '#f0d080'] },
  { id: 'hearthstone', name: 'Hearthstone', kind: 'heart', value: 150, shades: ['#7a2a10', '#e06a2a', '#ffd08a'] },

  // --- Old Harbour ------------------------------------------------------------
  { id: 'timber', name: 'Tarred Timber', kind: 'salvage', value: 30, shades: ['#2a1a10', '#5a3a22', '#8a6040'], pile: 'timber' },
  { id: 'cobble', name: 'Cobbles', kind: 'salvage', value: 45, shades: ['#3a3e44', '#6a727a', '#a8b0b8'], pile: 'stone' },
  { id: 'wire', name: 'Copper Wire', kind: 'salvage', value: 80, shades: ['#7a3416', '#c8622a', '#f2a65a'], pile: 'metal' },
  { id: 'sailcloth', name: 'Sailcloth', kind: 'salvage', value: 140, shades: ['#8a8070', '#d0c8b0', '#fffaea'], pile: 'cloth' },
  { id: 'pearl', name: 'Pearl', kind: 'relic', value: 600, shades: ['#8a8a9a', '#dcdce8', '#ffffff'] },
  { id: 'ships-bell', name: "Ship's Bell", kind: 'relic', value: 1000, shades: ['#6a4a14', '#c8962a', '#fff0a0'] },
  { id: 'harbour-lamp', name: 'Harbour Lamp', kind: 'heart', value: 2400, shades: ['#0a4a6a', '#2aa8e0', '#c8f4ff'] },

  // --- Market Ward ------------------------------------------------------------
  { id: 'slate', name: 'Slate', kind: 'salvage', value: 400, shades: ['#1e2430', '#3e4a5a', '#7a8aa0'], pile: 'stone' },
  { id: 'tin', name: 'Tinware', kind: 'salvage', value: 650, shades: ['#5d6a72', '#9aa9b2', '#dfe7ea'], pile: 'metal' },
  { id: 'silk', name: 'Silk', kind: 'salvage', value: 1100, shades: ['#6a1a3a', '#c83a6a', '#ffa8c8'], pile: 'cloth' },
  { id: 'porcelain', name: 'Porcelain', kind: 'salvage', value: 2000, shades: ['#3a5a8a', '#a8c0e8', '#ffffff'], pile: 'stone' },
  { id: 'guild-seal', name: 'Guild Seal', kind: 'relic', value: 9000, shades: ['#5a0a10', '#b81a2a', '#ff7a7a'] },
  { id: 'gilt-mirror', name: 'Gilt Mirror', kind: 'relic', value: 15000, shades: ['#7a5206', '#e8b42a', '#fff4a8'] },
  { id: 'guild-bell', name: 'Guild Bell', kind: 'heart', value: 36000, shades: ['#6a3a06', '#e09a1a', '#fff0b0'] },

  // --- Foundry Quarter --------------------------------------------------------
  { id: 'coal', name: 'Coal', kind: 'salvage', value: 6000, shades: ['#15151a', '#2c2c35', '#55556a'], pile: 'stone' },
  { id: 'pig-iron', name: 'Pig Iron', kind: 'salvage', value: 10000, shades: ['#2a2a30', '#5a5a66', '#9a9aa8'], pile: 'metal' },
  { id: 'cullet', name: 'Cullet', kind: 'salvage', value: 17000, shades: ['#1a5a4a', '#3ab08a', '#b8ffe0'], pile: 'stone' },
  { id: 'brass', name: 'Brass', kind: 'salvage', value: 30000, shades: ['#6a4a06', '#c89a1a', '#ffe07a'], pile: 'metal' },
  { id: 'pocket-watch', name: 'Pocket Watch', kind: 'relic', value: 140000, shades: ['#5a5a6a', '#b8b8c8', '#ffffff'] },
  { id: 'ledger', name: 'Old Ledger', kind: 'relic', value: 230000, shades: ['#3a1a0a', '#7a3a1a', '#d8904a'] },
  { id: 'foundry-heart', name: 'Foundry Heart', kind: 'heart', value: 540000, shades: ['#6a1000', '#f0400a', '#ffd88a'] },

  // --- The Drowned Spire ------------------------------------------------------
  { id: 'marble', name: 'White Marble', kind: 'salvage', value: 90000, shades: ['#7a7a86', '#d0d0dc', '#ffffff'], pile: 'stone' },
  { id: 'sea-glass', name: 'Sea Glass', kind: 'salvage', value: 150000, shades: ['#1a4a5a', '#4aa0b0', '#c8f8ff'], pile: 'stone' },
  { id: 'filigree', name: 'Silver Filigree', kind: 'salvage', value: 260000, shades: ['#6c7487', '#b8c2d6', '#f4f8ff'], pile: 'metal' },
  { id: 'starstone', name: 'Starstone', kind: 'salvage', value: 480000, shades: ['#2a2a5a', '#8a8ae0', '#ffffff'], pile: 'stone' },
  { id: 'moonpearl', name: 'Moonpearl', kind: 'relic', value: 2.2e6, shades: ['#5a6a8a', '#b4c4e6', '#f4f8ff'] },
  { id: 'choir-shard', name: 'Choir Shard', kind: 'relic', value: 3.6e6, shades: ['#3a2a6a', '#9a7ae0', '#f0e0ff'] },
  { id: 'spire-key', name: 'Spire Key', kind: 'heart', value: 8e6, shades: ['#2a2a4a', '#c8c8f0', '#ffffff'] },

  // --- Goods ------------------------------------------------------------------
  { id: 'planks', name: 'Planks', kind: 'good', value: 22, shades: ['#6a4a24', '#b08048', '#f0c888'] },
  { id: 'bricks', name: 'Bricks', kind: 'good', value: 34, shades: ['#6a2414', '#b84a2a', '#f08a5a'] },
  { id: 'ironwork', name: 'Ironwork', kind: 'good', value: 55, shades: ['#3a3a44', '#7a7a8a', '#c8c8d8'] },
  { id: 'canvas', name: 'Canvas', kind: 'good', value: 330, shades: ['#7a7060', '#c8bea0', '#fffae0'] },
  { id: 'copperwork', name: 'Copperwork', kind: 'good', value: 900, shades: ['#7a3416', '#d0702e', '#ffbe7a'] },
  { id: 'roof-tiles', name: 'Roof Tiles', kind: 'good', value: 4400, shades: ['#2a3040', '#5a6a8a', '#a8b8d8'] },
  { id: 'silkwork', name: 'Silkwork', kind: 'good', value: 12000, shades: ['#6a1a4a', '#d04a8a', '#ffc8e8'] },
  { id: 'panes', name: 'Glass Panes', kind: 'good', value: 66000, shades: ['#2a6a7a', '#7ad0e0', '#e8ffff'] },
  { id: 'steel', name: 'Steel Girders', kind: 'good', value: 190000, shades: ['#3a4a5a', '#8aa6ba', '#e4f4ff'] },
  { id: 'marble-block', name: 'Dressed Marble', kind: 'good', value: 2.9e6, shades: ['#8a8a96', '#e0e0ea', '#ffffff'] },
  { id: 'lumen', name: 'Lumen Glass', kind: 'good', value: 1.6e6, shades: ['#3a3a7a', '#9a9af0', '#f8f8ff'] },
];

export const MATERIAL: ReadonlyMap<string, Material> = new Map(MATERIALS.map((m) => [m.id, m]));
