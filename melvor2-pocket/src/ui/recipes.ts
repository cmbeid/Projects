// View helpers: how each skill's recipes are grouped, labelled and illustrated.
import {
  NS, configList, displayName, itemName, type ArtisanRecipe, type CookingRecipe, type FiremakingRecipe, type FishingRecipe, type Ingredients,
  type MiningRecipe, type WoodcuttingRecipe,
} from '../engine/content';
import type { Game } from '../engine/game';
import type { SkillRecipe } from '../engine/skills/types';
import { maxHealth, overgrowth, treeHp } from '../engine/skills/woodcutting';
import { breakChance } from '../engine/skills/mining';
import { maxSteps, stepsLeft } from '../engine/skills/artisan';
import { successChance as cookChance } from '../engine/skills/cooking';
import { maxStages, stage as thievingStage, successChance, type ThievingRecipe } from '../engine/skills/thieving';
import { huntState, trapChance, trapsFor, type HuntingAnimal } from '../engine/skills/hunting';

const fmtCount = (n: number) => Math.floor(n).toLocaleString();
import { knowledge, unlockedMinorNodes, type Constellation } from '../engine/skills/astrology';

export interface IngredientView { item: string; need: number; have: number }

export interface RecipeView {
  id: string;
  name: string;
  level: number;
  xp: number;
  /** Item used for the card's icon. */
  icon: string;
  /** The game's own art for this recipe (tree, rock, target...), used when the asset pack has it. */
  art?: string;
  intervalText: string;
  locked: 'demo' | 'level' | null;
  /** Extra per-recipe status, e.g. tree HP. */
  meter?: { value: number; max: number; label: string };
  detail?: string;
  ingredients?: IngredientView[];
  /** Product quantity per item, when more than 1. */
  makes?: number;
  /** A per-recipe switch shown on the card, e.g. Hunting's "Use bait". */
  option?: { label: string; on: boolean; toggle: () => void };
}

function ingredientViews(game: Game, ing: Ingredients): IngredientView[] {
  return ing.Items.map((i) => ({ item: i.Item, need: i.Quantity, have: game.count(i.Item) }));
}

const ARTISAN = new Set(['Smithing', 'Fletching', 'Crafting', 'Runecrafting', 'Beastcrafting']);

export interface RecipeGroup { name: string; recipes: RecipeView[] }

const secs = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s`;

function levelOf(r: SkillRecipe): number {
  return r.Requirements?.find((q) => q.Type === `${NS}Level`)?.Data.Level ?? 1;
}

function base(game: Game, skill: string, r: SkillRecipe): Omit<RecipeView, 'icon' | 'intervalText'> {
  const locked = game.isDemoLocked(r.Requirements) ? 'demo' : game.requirementsMet(r.Requirements) ? null : 'level';
  return { id: NS + r.Id, name: r.DisplayName, level: levelOf(r), xp: r.BaseExperience, locked };
}

function view(game: Game, skill: string, r: SkillRecipe): RecipeView {
  const v = viewWithoutArt(game, skill, r);
  const src = r as { Media?: string; Icon?: string };
  const art = skill === 'Woodcutting' || skill === 'Mining' || skill === 'Thieving' ? src.Media : skill === 'Hunting' || skill === 'Astrology' ? src.Icon : undefined;
  return art && !art.includes('missing_artwork') ? { ...v, art } : v;
}

function viewWithoutArt(game: Game, skill: string, r: SkillRecipe): RecipeView {
  const id = NS + r.Id;
  if (ARTISAN.has(skill)) {
    const a = r as ArtisanRecipe;
    const steps = maxSteps(a);
    const product = a.Products[0];
    return {
      ...base(game, skill, r),
      icon: product?.Item ?? id,
      intervalText: steps > 1 ? `${steps} × ${secs(a.BaseInterval)}` : secs(a.BaseInterval),
      meter: steps > 1 ? { value: steps - stepsLeft(game, id), max: steps, label: 'Steps' } : undefined,
      ingredients: ingredientViews(game, a.Ingredients),
      makes: product && product.Quantity > 1 ? product.Quantity : undefined,
    };
  }
  switch (skill) {
    case 'Thieving': {
      const t = r as ThievingRecipe;
      const stages = maxStages(t, game);
      const loot = t.CommonDropTable[0]?.Item ?? t.RareDropTable[0]?.Item;
      return {
        ...base(game, skill, r),
        icon: loot ?? `${NS}GoldPieces`,
        intervalText: secs(t.BaseInterval),
        detail: `${Math.round(successChance(game, t) * 100)}% success · hits up to ${t.Damage}${stages > 1 ? ` · ${stages} stages` : ''}`,
        meter: stages > 1 ? { value: thievingStage(game, id) - 1, max: stages, label: 'Stage' } : undefined,
      };
    }
    case 'Hunting': {
      const h = r as HuntingAnimal;
      const st = game.state.hunting[id];
      const traps = trapsFor(game, h);
      const phase = st && st.phase !== 'idle' ? ` · ${st.phase}${st.phase === 'tracking' ? ` ${st.step}/${st.requiredSteps}` : ''}` : '';
      return {
        ...base(game, skill, r),
        icon: h.Products[0]?.Item ?? id,
        intervalText: `${secs(h.BaseMinTrapInterval)}–${secs(h.BaseMaxTrapInterval)} trap`,
        detail: `${Math.round(trapChance(game, h) * 100)}% trap${h.EnableTrapless && !traps.length ? ' (trapless)' : traps.length ? '' : ' · needs a trap'}${st?.trapped ? ` · caught ${st.trapped}` : ''}${phase}`,
        meter: st?.phase === 'tracking' ? { value: st.step, max: st.requiredSteps, label: 'Tracking' } : undefined,
        option: h.PreferredBait
          ? {
              label: `Use ${itemName(h.PreferredBait)} (${fmtCount(game.count(h.PreferredBait))})`,
              on: !!st?.bait,
              toggle: () => {
                huntState(game, id).bait = !huntState(game, id).bait;
                game.emit();
              },
            }
          : undefined,
      };
    }
    case 'Astrology': {
      const c = r as Constellation;
      const k = knowledge(game, id);
      const unlocked = unlockedMinorNodes(game, id).length;
      const next = c.MinorNodeUnlockKnowledge[unlocked];
      const prev = c.MinorNodeUnlockKnowledge[unlocked - 1] ?? 0;
      return {
        ...base(game, skill, r),
        icon: `${NS}Stardust`,
        intervalText: secs(c.BaseInterval),
        detail: `${k} knowledge · ${unlocked}/${c.MinorNodes.length} star nodes`,
        meter: next ? { value: k - prev, max: next - prev, label: 'Next node' } : undefined,
      };
    }
    case 'Cooking': {
      const c = r as CookingRecipe;
      const product = c.Products[c.Products.length - 1];
      return {
        ...base(game, skill, r),
        icon: product?.Item ?? id,
        intervalText: secs(c.BaseInterval),
        detail: `${Math.round(cookChance(game, c) * 100)}% success`,
        ingredients: ingredientViews(game, c.Ingredients),
      };
    }
    case 'Woodcutting': {
      const w = r as WoodcuttingRecipe;
      const max = maxHealth(w, game);
      return {
        ...base(game, skill, r),
        icon: w.Product.Item,
        intervalText: `${secs(w.BaseInterval)} / hit`,
        meter: { value: treeHp(game, id), max, label: 'HP' },
        detail: `${max} hits per cut${overgrowth(game, id) > 0 ? ` · Overgrowth ×${overgrowth(game, id)}` : ''}`,
      };
    }
    case 'Mining': {
      const m = r as MiningRecipe;
      const p = breakChance(m, game);
      return {
        ...base(game, skill, r),
        icon: m.Product.Item,
        intervalText: `${secs(m.BaseInterval)} / hit`,
        meter: { value: game.state.rockProgress[id] ?? 0, max: 1, label: 'Prospecting' },
        detail: `${Math.round(p * 100)}% break chance`,
      };
    }
    case 'Fishing': {
      const f = r as FishingRecipe;
      return {
        ...base(game, skill, r),
        icon: f.RandomProducts[0]?.Item ?? f.JunkItem,
        intervalText: `${secs(f.BaseMinInterval)}–${secs(f.BaseMaxInterval)}`,
        detail: `${Math.round(f.FishChance * 100)}% fish chance`,
      };
    }
    case 'Firemaking': {
      const fm = r as FiremakingRecipe;
      return {
        ...base(game, skill, r),
        icon: fm.Ingredients.Items[0]?.Item ?? `${NS}Ash`,
        intervalText: secs(fm.BaseInterval),
        ingredients: ingredientViews(game, fm.Ingredients),
      };
    }
    default:
      return { ...base(game, skill, r), icon: id, intervalText: '' };
  }
}

const GROUP_TYPE: Record<string, string> = {
  Woodcutting: 'WoodcuttingRecipeCategory',
  Mining: 'MiningRecipeCategory',
  Fishing: 'FishingLocation',
  Thieving: 'ThievingLocation',
  Hunting: 'HuntingLocation',
};

/** Recipes grouped like the game's pages. Quest-only recipes stay hidden until quests exist. */
export function recipeGroups(game: Game, skill: string): RecipeGroup[] {
  const h = game.handler(skill);
  const groups = new Map<string, RecipeView[]>();
  for (const id of h.recipes()) {
    const r = h.recipe(id);
    if (r.DisplayRequirements?.length && !game.requirementsMet(r.DisplayRequirements)) continue;
    const key =
      skill === 'Fishing' ? (r as FishingRecipe).Location : skill === 'Hunting' ? (r as HuntingAnimal).Location : r.Category ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(view(game, skill, r));
  }
  const order = configList(skill, skill === 'Hunting' ? 'Locations' : 'Categories');
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, recipes]) => ({
      name: key ? displayName(GROUP_TYPE[skill] ?? 'RecipeCategory', key) : skill,
      recipes: recipes.sort((a, b) => a.level - b.level || Number(!!a.locked) - Number(!!b.locked)),
    }));
}
