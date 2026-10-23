/**
 * A simple player for balance checks: it rotates through skills, keeps
 * itself fed and geared, fights what it can beat, and spends gold on
 * upgrades. `tests/bot.test.ts` holds it to milestones; `npm run playtest`
 * prints how it got on.
 */
import { AREAS, MONSTER } from '../data/combat';
import { ITEM } from '../data/items';
import { ACTIONS_BY_SKILL } from '../data/skills';
import { OBSTACLES } from '../data/special';
import { SLOTS, type Item, type SkillId } from '../data/types';
import type { GameState } from '../state/types';
import { combatLevel, count, level } from './core';
import { equip, equipBlocker, equipFood, expectedDps, startCombat, stopCombat, collectLoot, bury, newSlayerTask, playerStats } from './combat';
import { advance } from './engine';
import { blocker, startAction, stopActivity } from './skilling';
import { buildObstacle, buy, harvestAll, plant, sell, completeQuest, questReady, startAgility, startSurvey } from './systems';
import { QUESTS } from '../data/meta';
import { FARM_CROPS } from '../data/special';

const ROTATION: (SkillId | 'combat')[] = [
  'woodcutting', 'fishing', 'cooking', 'mining', 'smithing', 'combat', 'thieving', 'firemaking', 'mining', 'smithing', 'combat', 'agility', 'hunting',
  'cartography', 'astrology', 'runecrafting', 'combat', 'thieving', 'construction', 'archaeology', 'combat',
];

/** Mining feeds smithing: dig whichever ore the best bar you can smelt is shortest of. */
function miningTarget(s: GameState): string | null {
  const smith = level(s, 'smithing');
  const mine = level(s, 'mining');
  const bars = (ACTIONS_BY_SKILL['smithing'] ?? []).filter((a) => a.group === 'Smelting' && a.level <= smith && a.inputs.every((q) => (MINE_LEVEL.get(q.item) ?? 99) <= mine));
  const bar = bars.sort((a, b) => b.level - a.level)[0];
  if (!bar) return null;
  const short = [...bar.inputs].sort((a, b) => count(s, a.item) / a.qty - count(s, b.item) / b.qty)[0]!;
  return `mine-${short.item.slice(4)}`;
}
const MINE_LEVEL = new Map((ACTIONS_BY_SKILL['mining'] ?? []).map((a) => [a.outputs[0]!.item, a.level]));

function bestAction(s: GameState, skill: SkillId): string | null {
  if (skill === 'mining' && level(s, 'smithing') < level(s, 'mining') + 5) {
    const t = miningTarget(s);
    if (t) return t;
  }
  if (skill === 'smithing') {
    // Smelt first if there are no bars, then forge with what there is.
    const forge = [...(ACTIONS_BY_SKILL['smithing'] ?? [])].filter((a) => a.group !== 'Smelting' && !blocker(s, a)).sort((a, b) => b.level - a.level)[0];
    const smelt = [...(ACTIONS_BY_SKILL['smithing'] ?? [])].filter((a) => a.group === 'Smelting' && !blocker(s, a)).sort((a, b) => b.level - a.level)[0];
    return (s.counters['turn'] ?? 0) % 2 === 0 ? smelt?.id ?? forge?.id ?? null : forge?.id ?? smelt?.id ?? null;
  }
  const list = [...(ACTIONS_BY_SKILL[skill] ?? [])].filter((a) => !blocker(s, a)).sort((a, b) => b.level - a.level || b.xp - a.xp);
  return list[0]?.id ?? null;
}

function gearScore(it: Item): number {
  const e = it.equip!;
  return (e.accuracy ?? 0) + (e.power ?? 0) * 1.2 + (e.defMelee ?? 0) + (e.defRanged ?? 0) * 0.5 + (e.dr ?? 0) * 6;
}

/** Wears the best melee gear in the bank for each slot. */
function gearUp(s: GameState): void {
  for (const slot of SLOTS) {
    if (slot === 'ammo' || slot === 'summon1' || slot === 'summon2') continue;
    const cur = s.loadouts[s.loadout]![slot];
    const curScore = cur ? gearScore(ITEM.get(cur.item)!) : -1;
    let best: Item | null = null;
    for (const id of s.bankOrder) {
      const it = ITEM.get(id)!;
      if (it.equip?.slot !== slot || it.familiar) continue;
      if (slot === 'weapon' && it.equip.style !== 'melee') continue;
      if (equipBlocker(s, id)) continue;
      if (!best || gearScore(it) > gearScore(best)) best = it;
    }
    if (best && gearScore(best) > curScore) equip(s, best.id);
  }
}

function feed(s: GameState): void {
  const foods = s.bankOrder.filter((id) => ITEM.get(id)?.heal).sort((a, b) => (ITEM.get(b)!.heal ?? 0) - (ITEM.get(a)!.heal ?? 0));
  for (const f of foods.slice(0, 2)) equipFood(s, f);
}

function foodCount(s: GameState): number {
  return s.food.reduce((a, f) => a + (f?.qty ?? 0), 0);
}

function pickFight(s: GameState): [string, string] | null {
  const p = playerStats(s);
  let best: [string, string, number] | null = null;
  for (const a of AREAS) {
    if (a.kind !== 'combat') continue;
    for (const mid of a.monsters) {
      const m = MONSTER.get(mid)!;
      // Auto-eat only eats below its threshold, so one big hit from above it must not kill.
      const threshold = [0, 0.2, 0.3, 0.4][s.upgrades['autoeat'] ?? 0]!;
      if (m.maxHit * (1 - p.dr / 100) > p.maxHp * threshold * 0.85) continue;
      const dps = expectedDps(s, m);
      const xpRate = (dps / m.hp) * m.hp;
      // Prefer the strongest thing we can still kill quickly.
      if (m.hp / dps > 25) continue;
      const score = xpRate * (1 + m.combatLevel / 20);
      if (!best || score > best[2]) best = [a.id, mid, score];
    }
  }
  return best ? [best[0], best[1]] : null;
}

function spend(s: GameState): void {
  // Save up for Auto Eat before anything else: without it the bot can't fight safely.
  if (!s.upgrades['autoeat']) {
    buy(s, 'autoeat');
    if (!s.upgrades['autoeat']) return;
  }
  for (const up of ['autoeat', 'axe', 'pickaxe', 'rod', 'bank', 'autoloot']) {
    const reserve = up === 'autoeat' || up === 'bank' ? 0 : 3000;
    for (let i = 0; i < 3; i++) {
      const before = s.gp;
      if (before < reserve || buy(s, up)) break;
    }
  }
  for (const ob of OBSTACLES) {
    if (s.course[ob.slot] || ob.level > level(s, 'agility')) continue;
    if (s.gp > ob.cost.gp * 1.5) buildObstacle(s, ob.id);
  }
}

function farm(s: GameState): void {
  harvestAll(s);
  for (const kind of ['allotment', 'herb', 'tree'] as const) {
    s.farm[kind].forEach((p, i) => {
      if (p.seed) return;
      const crop = FARM_CROPS.filter((c) => c.kind === kind && c.level <= level(s, 'farming') && count(s, c.seed) >= c.seeds).sort((a, b) => b.level - a.level)[0];
      if (crop) plant(s, kind, i, crop.seed, count(s, 'compost') ? 1 : 0);
    });
  }
}

function sellJunk(s: GameState): void {
  for (const id of [...s.bankOrder]) {
    const it = ITEM.get(id)!;
    if (it.category === 'weapon' || it.category === 'armour') {
      const e = it.equip!;
      const worn = Object.values(s.loadouts[s.loadout]!).some((st) => st?.item === id);
      const req = Object.values(e.req ?? {})[0] ?? 0;
      if (!worn && req + 15 < combatLevel(s)) sell(s, id, count(s, id));
    }
    if (id === 'burnt-food' || id === 'ash') sell(s, id, count(s, id));
    if (['log', 'ore', 'fish', 'gem'].includes(it.category) && count(s, id) > 400) sell(s, id, count(s, id) - 300);
  }
  if (s.bankOrder.length > 55) {
    // Sell the cheapest stacks to make room.
    const cheap = [...s.bankOrder].sort((a, b) => ITEM.get(a)!.sell * count(s, a) - ITEM.get(b)!.sell * count(s, b));
    for (const id of cheap.slice(0, 5)) if (!ITEM.get(id)!.heal && !ITEM.get(id)!.bury) sell(s, id, count(s, id));
  }
}

export interface BotResult {
  log: string[];
}

export function runBot(s: GameState, seconds: number, slice = 600): BotResult {
  const log: string[] = [];
  let t = 0;
  let turn = 0;
  while (t < seconds && !s.dead) {
    const phase = ROTATION[turn % ROTATION.length]!;
    turn++;
    s.counters['turn'] = turn;
    farm(s);
    sellJunk(s);
    spend(s);
    for (const q of QUESTS) if (questReady(s, q.id)) completeQuest(s, q.id);
    for (const b of ['bones', 'big-bones']) if (count(s, b)) bury(s, b, count(s, b));
    stopCombat(s);
    stopActivity(s);
    if (phase === 'combat') {
      gearUp(s);
      feed(s);
      if (!s.slayerTask) newSlayerTask(s, combatLevel(s) >= 30 ? 'normal' : 'easy');
      const fights = (s.counters['botFights'] = (s.counters['botFights'] ?? 0) + 1);
      s.meleeStyle = (['accurate', 'aggressive', 'defensive'] as const)[fights % 3]!;
      const fight = foodCount(s) >= 10 && (s.upgrades['autoeat'] ?? 0) > 0 ? pickFight(s) : null;
      if (fight) startCombat(s, fight[0], fight[1]);
      else {
        const id = bestAction(s, 'fishing');
        if (id) startAction(s, id);
      }
    } else if (phase === 'agility' && s.course.some(Boolean)) {
      startAgility(s);
    } else if (phase === 'cartography') {
      if (startSurvey(s)) startAction(s, bestAction(s, 'woodcutting')!);
    } else {
      const id = bestAction(s, phase);
      if (id) startAction(s, id);
      else {
        const fallback = bestAction(s, 'woodcutting');
        if (fallback) startAction(s, fallback);
      }
    }
    const step = Math.min(slice, seconds - t);
    advance(s, step * 1000);
    collectLoot(s);
    t += step;
    if (turn % 12 === 0) log.push(`${Math.round(t / 60)}m: cb ${combatLevel(s)}, gp ${Math.floor(s.gp)}, kills ${s.counters['kills'] ?? 0}`);
  }
  return { log };
}
