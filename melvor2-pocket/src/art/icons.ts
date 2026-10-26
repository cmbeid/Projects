// Procedurally generated SVG icons. No game artwork is used: the shape comes from keywords in the
// item id, the colour from a material/tier palette, and small variations from a hash of the id.

type Shape =
  | 'log' | 'ore' | 'bar' | 'gem' | 'fish' | 'cookedFish' | 'rune' | 'seed' | 'arrow' | 'bolt'
  | 'sword' | 'axe' | 'pickaxe' | 'bow' | 'staff' | 'helmet' | 'body' | 'legs' | 'boots' | 'gloves'
  | 'shield' | 'ring' | 'amulet' | 'cape' | 'potion' | 'food' | 'bones' | 'leaf' | 'coin' | 'bag';

const MATERIALS: [RegExp, string][] = [
  [/^(Normal|Stick)/, '#a0743f'], [/^Oak/, '#b98a4a'], [/^Willow/, '#8c9c52'], [/^Teak/, '#9a5a32'],
  [/^Maple/, '#c96a2c'], [/^Mahogany/, '#7a2f22'], [/^Yew/, '#5f7a3a'], [/^Magic/, '#5a7be0'],
  [/^Redwood/, '#b03a2e'], [/^HardOak/, '#6e4b2a'], [/^Ashen/, '#8d8d8d'], [/^Blessed/, '#f1d77a'],
  [/^(Copper|Bronze)/, '#c27a45'], [/^Iron/, '#8a8f98'], [/^Steel/, '#b9c0c9'], [/^Silver/, '#d9dde3'],
  [/^Gold/, '#e8b84a'], [/^Mithril/, '#5b78c2'], [/^Adamant/, '#3f9a5c'], [/^Rune(?!Essence)/, '#3fb6c4'],
  [/^Dawnsteel/, '#f0a35e'], [/^Dragon/, '#c2392f'], [/^Topaz/, '#f2a93b'], [/^Sapphire/, '#2f64d8'],
  [/^Ruby/, '#d42a4a'], [/^Emerald/, '#2fbf6a'], [/^Diamond/, '#dff4ff'], [/^Air/, '#d8e8f0'],
  [/^Water/, '#3a8ee6'], [/^Earth/, '#8a6a3a'], [/^Fire/, '#e8552a'], [/^Mind/, '#d9a23a'],
  [/^Chaos/, '#c03ac0'], [/^Death/, '#4a4a4a'], [/^Body/, '#6a9ae0'], [/^Stone/, '#9a9a9a'],
  [/^Clay/, '#c79a6a'], [/^Coal/, '#3a3a3a'], [/^Raw/, '#e08a8a'],
];

const SHAPES: [RegExp, Shape][] = [
  [/Log$|^Stick$/, 'log'], [/Ore$|^(Stone|Clay|Coal|Sulfur)$|Essence$/, 'ore'], [/Bar$/, 'bar'],
  [/^(Topaz|Sapphire|Ruby|Emerald|Diamond|Jadestone|Geode)/, 'gem'], [/^Raw/, 'fish'],
  [/^(Shrimp|Sardine|Herring|Trout|Salmon|Lobster|Swordfish|Crab|Shark|Tuna)$/, 'cookedFish'],
  [/Rune$/, 'rune'], [/Seed$|Seeds$/, 'seed'], [/Arrows?$|Arrowtips$|Javelin/, 'arrow'],
  [/Bolts?$|Crossbow/, 'bolt'], [/(Sword|Dagger|Scimitar|Spear|Mace|Battleaxe|Weapon)$/, 'sword'],
  [/(Axe|AxeHead)$/, 'axe'], [/Pickaxe/, 'pickaxe'], [/Bow$|Longbow|Shortbow/, 'bow'],
  [/(Staff|Wand|Battlestaff|Battlewand)$/, 'staff'], [/(Helmet|Hat|Hood|Coif)/, 'helmet'],
  [/(Platebody|Body|Robes|Torso|Chaps|Top)/, 'body'], [/(Platelegs|Legs|Bottoms)/, 'legs'],
  [/Boots/, 'boots'], [/(Gloves|Gauntlets|Vambraces)/, 'gloves'], [/(Shield|Defender|Mageshield)/, 'shield'],
  [/Ring/, 'ring'], [/Amulet|Necklace/, 'amulet'], [/Cape/, 'cape'], [/Potion|Vial/, 'potion'],
  [/Bones?$|Ash$/, 'bones'], [/(Leaf|Flax|Herb|Seaweed|Feathers?)/, 'leaf'],
  [/(Pie|Pancake|Bread|Cake|Stew|Apple|Berry|Beef|Meat|Chicken)/, 'food'], [/GoldPieces|Coin/, 'coin'],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function hueColor(h: number, s = 45, l = 55): string {
  return `hsl(${h % 360} ${s}% ${l}%)`;
}

export function itemColor(id: string): string {
  const local = id.replace(/^\w+:/, '');
  return MATERIALS.find(([re]) => re.test(local))?.[1] ?? hueColor(hash(local));
}

export function itemShape(id: string): Shape {
  const local = id.replace(/^\w+:/, '');
  return SHAPES.find(([re]) => re.test(local))?.[1] ?? 'bag';
}

const STROKE = 'stroke="#0d0f14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';

function body(shape: Shape, c: string, v: number): string {
  const tilt = (v % 21) - 10;
  switch (shape) {
    case 'log': return `<g transform="rotate(${-20 + tilt} 32 32)"><rect x="10" y="22" width="44" height="20" rx="10" fill="${c}" ${STROKE}/><ellipse cx="50" cy="32" rx="6" ry="10" fill="#e6c48e" ${STROKE}/><circle cx="50" cy="32" r="3" fill="none" stroke="#a0743f" stroke-width="1.5"/></g>`;
    case 'ore': return `<path d="M14 40 L20 20 L36 12 L52 22 L54 42 L38 54 L20 52 Z" fill="#6f6a66" ${STROKE}/><circle cx="28" cy="30" r="5" fill="${c}"/><circle cx="40" cy="38" r="4" fill="${c}"/><circle cx="38" cy="24" r="3" fill="${c}"/>`;
    case 'bar': return `<path d="M10 40 L20 24 L54 24 L46 40 Z" fill="${c}" ${STROKE}/><path d="M10 40 L46 40 L46 46 L10 46 Z" fill="${c}" ${STROKE} opacity=".75"/><path d="M46 40 L54 24 L54 30 L46 46 Z" fill="${c}" ${STROKE} opacity=".6"/>`;
    case 'gem': return `<path d="M32 8 L52 26 L32 56 L12 26 Z" fill="${c}" ${STROKE}/><path d="M12 26 L52 26 M32 8 L24 26 L32 56 L40 26 Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`;
    case 'fish': case 'cookedFish': {
      const f = shape === 'fish' ? c : '#c98a3a';
      return `<path d="M8 32 C18 16 40 16 48 32 C40 48 18 48 8 32 Z" fill="${f}" ${STROKE}/><path d="M48 32 L58 22 L58 42 Z" fill="${f}" ${STROKE}/><circle cx="18" cy="29" r="2.5" fill="#0d0f14"/>`;
    }
    case 'rune': return `<rect x="14" y="14" width="36" height="36" rx="8" fill="#5c5f6a" ${STROKE}/><circle cx="32" cy="32" r="10" fill="${c}" ${STROKE}/>`;
    case 'seed': return `<ellipse cx="26" cy="36" rx="8" ry="11" fill="${c}" ${STROKE}/><ellipse cx="40" cy="30" rx="7" ry="10" fill="${c}" ${STROKE} transform="rotate(25 40 30)"/><path d="M40 20 C44 12 50 12 52 14" fill="none" stroke="#5fa04a" stroke-width="3"/>`;
    case 'arrow': return `<g transform="rotate(${-45 + tilt} 32 32)"><line x1="8" y1="32" x2="50" y2="32" stroke="#a0743f" stroke-width="4"/><path d="M48 24 L60 32 L48 40 Z" fill="${c}" ${STROKE}/><path d="M8 32 L14 24 M8 32 L14 40" stroke="#e8e8e8" stroke-width="3"/></g>`;
    case 'bolt': return `<g transform="rotate(-45 32 32)"><rect x="8" y="29" width="40" height="6" fill="#7a5a3a" ${STROKE}/><path d="M48 24 L58 32 L48 40 Z" fill="${c}" ${STROKE}/></g>`;
    case 'sword': return `<g transform="rotate(45 32 32)"><path d="M28 6 L36 6 L36 42 L32 48 L28 42 Z" fill="${c}" ${STROKE}/><rect x="20" y="42" width="24" height="5" rx="2" fill="#6a4a2a" ${STROKE}/><rect x="29" y="47" width="6" height="11" rx="2" fill="#4a3220" ${STROKE}/></g>`;
    case 'axe': return `<line x1="20" y1="54" x2="42" y2="12" stroke="#7a5a3a" stroke-width="5" stroke-linecap="round"/><path d="M34 12 C46 4 58 12 56 24 C48 22 42 22 38 26 Z" fill="${c}" ${STROKE}/>`;
    case 'pickaxe': return `<line x1="20" y1="54" x2="40" y2="16" stroke="#7a5a3a" stroke-width="5" stroke-linecap="round"/><path d="M14 18 C26 6 46 6 56 16 C44 14 30 14 14 18 Z" fill="${c}" ${STROKE}/>`;
    case 'bow': return `<path d="M20 8 C48 18 48 46 20 56" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><line x1="20" y1="8" x2="20" y2="56" stroke="#e8e8e8" stroke-width="1.5"/>`;
    case 'staff': return `<line x1="18" y1="56" x2="42" y2="16" stroke="#7a5a3a" stroke-width="5" stroke-linecap="round"/><circle cx="44" cy="14" r="8" fill="${c}" ${STROKE}/>`;
    case 'helmet': return `<path d="M12 40 C12 18 52 18 52 40 L52 48 L12 48 Z" fill="${c}" ${STROKE}/><rect x="20" y="36" width="24" height="5" rx="2" fill="#0d0f14"/>`;
    case 'body': return `<path d="M18 12 L26 10 C28 16 36 16 38 10 L46 12 L56 24 L48 30 L46 26 L46 54 L18 54 L18 26 L16 30 L8 24 Z" fill="${c}" ${STROKE}/>`;
    case 'legs': return `<path d="M18 10 L46 10 L48 56 L36 56 L32 28 L28 56 L16 56 Z" fill="${c}" ${STROKE}/>`;
    case 'boots': return `<path d="M14 14 L28 14 L28 40 L44 42 C52 44 54 52 50 54 L14 54 Z" fill="${c}" ${STROKE}/>`;
    case 'gloves': return `<path d="M20 54 L20 26 L24 12 L28 26 L30 10 L34 26 L38 12 L40 28 L46 20 L48 30 L42 44 L42 54 Z" fill="${c}" ${STROKE}/>`;
    case 'shield': return `<path d="M32 8 L52 16 C52 36 44 50 32 58 C20 50 12 36 12 16 Z" fill="${c}" ${STROKE}/><path d="M32 14 L32 52 M18 26 L46 26" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`;
    case 'ring': return `<circle cx="32" cy="36" r="14" fill="none" stroke="#e8b84a" stroke-width="6"/><path d="M26 18 L32 10 L38 18 L32 24 Z" fill="${c}" ${STROKE}/>`;
    case 'amulet': return `<path d="M16 8 C16 30 48 30 48 8" fill="none" stroke="#e8b84a" stroke-width="3"/><circle cx="32" cy="40" r="12" fill="${c}" ${STROKE}/>`;
    case 'cape': return `<path d="M20 8 L44 8 L52 56 L32 50 L12 56 Z" fill="${c}" ${STROKE}/>`;
    case 'potion': return `<path d="M26 8 L38 8 L38 22 C50 28 50 54 32 56 C14 54 14 28 26 22 Z" fill="#cfe0ea" ${STROKE}/><path d="M18 40 C18 52 46 52 46 40 Z" fill="${hueColor(v)}"/>`;
    case 'food': return `<ellipse cx="32" cy="42" rx="22" ry="10" fill="#e8e0d0" ${STROKE}/><ellipse cx="32" cy="36" rx="16" ry="10" fill="${c}" ${STROKE}/>`;
    case 'bones': return `<g transform="rotate(${-30 + tilt} 32 32)"><rect x="14" y="28" width="36" height="8" fill="#ece6d6" ${STROKE}/><circle cx="14" cy="26" r="6" fill="#ece6d6" ${STROKE}/><circle cx="14" cy="38" r="6" fill="#ece6d6" ${STROKE}/><circle cx="50" cy="26" r="6" fill="#ece6d6" ${STROKE}/><circle cx="50" cy="38" r="6" fill="#ece6d6" ${STROKE}/></g>`;
    case 'leaf': return `<path d="M14 50 C14 22 34 10 54 10 C54 32 40 52 14 50 Z" fill="${c}" ${STROKE}/><path d="M14 50 L44 20" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>`;
    case 'coin': return `<circle cx="32" cy="32" r="20" fill="#e8b84a" ${STROKE}/><circle cx="32" cy="32" r="13" fill="none" stroke="#b8862a" stroke-width="3"/>`;
    case 'bag': default: return `<path d="M20 22 L44 22 L52 54 L12 54 Z" fill="${c}" ${STROKE}/><path d="M24 22 C24 12 40 12 40 22" fill="none" stroke="#0d0f14" stroke-width="3"/>`;
  }
}

const cache = new Map<string, string>();

/** Data URL for an item icon. */
export function itemIcon(id: string): string {
  let url = cache.get(id);
  if (!url) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body(itemShape(id), itemColor(id), hash(id))}</svg>`;
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    cache.set(id, url);
  }
  return url;
}

const SKILL_GLYPHS: Record<string, [string, string]> = {
  Woodcutting: ['🪓', '#5f9a3a'], Fishing: ['🎣', '#3a8ee6'], Mining: ['⛏️', '#8a8f98'],
  Firemaking: ['🔥', '#e8552a'], Cooking: ['🍳', '#d98a3a'], Smithing: ['🔨', '#c27a45'],
  Fletching: ['🏹', '#7aa05a'], Crafting: ['🧵', '#b07ad0'], Runecrafting: ['🔮', '#3fb6c4'],
  Herblore: ['🧪', '#5fbf6a'], Thieving: ['🗝️', '#9a7ae0'], Agility: ['🏃', '#5a7be0'],
  Farming: ['🌱', '#6abf3a'], Ranching: ['🐄', '#b98a4a'], Hunting: ['🐾', '#a06a3a'],
  Beastcrafting: ['🦴', '#c9b48a'], Astrology: ['✨', '#6a5ae0'], Attack: ['⚔️', '#c23a3a'],
  Strength: ['💪', '#3a9a5c'], Defence: ['🛡️', '#3a6ac2'], Hitpoints: ['❤️', '#e04a4a'],
  Ranged: ['🎯', '#5f9a3a'], Magic: ['🪄', '#5a5ae0'], Prayer: ['🙏', '#e8d07a'],
  Slayer: ['💀', '#7a4a4a'], Combat: ['⚔️', '#c23a3a'],
};

export function skillGlyph(skill: string): { glyph: string; color: string } {
  const [glyph, color] = SKILL_GLYPHS[skill.replace(/^\w+:/, '')] ?? ['•', hueColor(hash(skill))];
  return { glyph, color };
}
