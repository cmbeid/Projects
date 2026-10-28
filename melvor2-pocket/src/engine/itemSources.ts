// Where an item comes from and what uses it, like the desktop's "Found in" / "Used in" rows. Built once by walking the
// game data for references to each item: product and drop fields count as sources, ingredient and cost fields as uses.
import { NS, contentData } from './content';

export interface ItemPlace {
  /** Skill or page id ("Mining", "Combat", "Shop"...), for its icon. */
  page: string;
  /** What within it, e.g. the enemy or recipe name. */
  detail?: string;
}

const FOUND = /Product|Drop|Reward|Loot|Upgraded|Fish|Catch|Harvest|Yield|Output|Junk|Special/i;
const USED = /Ingredient|Cost|Treat|Bait|Consum|Fuel|Input|Seed|RootItems/i;
// References that are neither, e.g. a bonus that names an item or a task goal.
const SKIP = /LocalContext|Goal|Requirement|Bonuses/i;

/** Which page an object of each type belongs to, when it isn't a skill recipe. */
const TYPE_PAGE: Record<string, string> = {
  Enemy: 'Combat', Dungeon: 'Combat', ShopPurchase: 'Shop', Quest: 'Quests', ItemUpgrade: 'Bank', Item: 'Bank',
  HuntingAnimal: 'Hunting', RanchingAnimal: 'Ranching', RanchingAnimalVariant: 'Ranching', ThievingRecipe: 'Thieving', NPC: 'Thieving',
  HerbloreRecipe: 'Herblore', FarmingRecipe: 'Farming', GrainMillRecipe: 'Farming', CookingRecipe: 'Cooking',
  WoodcuttingRecipe: 'Woodcutting', MiningRecipe: 'Mining', FishingRecipe: 'Fishing', FiremakingRecipe: 'Firemaking',
  SlayerMaster: 'Slayer', MagicSpell: 'Magic', Prayer: 'Prayer',
};

let index: Map<string, { found: ItemPlace[]; used: ItemPlace[] }> | null = null;

function build() {
  const data = contentData() as { Objects: Record<string, { Id?: string; DisplayName?: unknown }[]>; EntityConfig: Record<string, { Recipes?: { Id: string }[] }> };
  // Recipe id -> the skill whose config lists it (artisan recipes are shared by several skills).
  const recipeSkill = new Map<string, string>();
  for (const [entity, cfg] of Object.entries(data.EntityConfig)) for (const r of cfg.Recipes ?? []) recipeSkill.set(r.Id, entity.replace(NS, ''));
  const out = new Map<string, { found: ItemPlace[]; used: ItemPlace[] }>();
  const add = (item: string, kind: 'found' | 'used', place: ItemPlace) => {
    const e = out.get(item) ?? { found: [], used: [] };
    if (!e[kind].some((p) => p.page === place.page && p.detail === place.detail)) e[kind].push(place);
    out.set(item, e);
  };
  for (const [type, list] of Object.entries(data.Objects)) {
    for (const o of list) {
      if (!o.Id) continue;
      const id = NS + o.Id;
      const page = (type !== 'Item' && recipeSkill.get(id)) || TYPE_PAGE[type];
      if (!page) continue;
      const name = o.DisplayName;
      const detail = typeof name === 'string' ? name : (name as { Singular?: string } | undefined)?.Singular;
      const walk = (v: unknown, path: string) => {
        if (typeof v === 'string') {
          // Recipes often share their product's id, so only an item never counts itself.
          if (!(type === 'Item' && v === id) && v.startsWith(NS) && !SKIP.test(path)) {
            if (USED.test(path)) add(v, 'used', { page, detail });
            else if (FOUND.test(path)) add(v, 'found', { page, detail: type === 'Item' ? `Opening ${detail}` : detail });
          }
        } else if (Array.isArray(v)) v.forEach((x) => walk(x, path));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
      };
      walk(o, '');
    }
  }
  return out;
}

export function itemPlaces(item: string): { found: ItemPlace[]; used: ItemPlace[] } {
  index ??= build();
  return index.get(item) ?? { found: [], used: [] };
}
