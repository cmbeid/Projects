import { biomeAt } from '../data/biomes';
import { GEAR_BASE, STAT_LABEL, formatStat } from '../data/gear';
import { MATERIAL, MATERIALS } from '../data/materials';
import { STORY } from '../data/missions';
import { BALANCE, ECHOES, MACHINES, PASSIVES, SKILLS, UPGRADES } from '../data/progression';
import { CONSUMABLES, CRAFT, FIXTURES, REFINE } from '../data/recipes';
import type { CraftRecipe, MaterialKind, Reward, Slot, Stack, StatKey } from '../data/types';
import { batchesAffordable, canCraft, furnaceSlots, meetsRequirement, refineSeconds } from '../game/crafting';
import { derive } from '../game/derive';
import { machineCost, maxAffordable, maxUpgradeLevels, upgradeCost } from '../game/economy';
import { hasFeature } from '../game/features';
import { activeStory, describeGoal, progress, storyIndex } from '../game/missions';
import { CHUTE_RESERVE, machineBreaksPerSecond, xpForLevel } from '../game/mining';
import { biomeText } from '../game/story';
import { BARGAINS } from '../data/flags';
import { echoCost, echoGain, startingDepth } from '../game/prestige';
import { canRankPassive, passivePointsFree, skillReady } from '../game/rpg';
import { fmt, fmtInt, fmtTime } from '../num/format';
import { iconHtml } from '../sprites/atlas';
import type { CoreStat, GameState, GearItem } from '../state/types';
import { esc } from './dom';

export type Tab = 'mine' | 'upgrades' | 'miner' | 'craft' | 'missions' | 'descent';

export interface UiState {
  tab: Tab;
  buyMode: 1 | 10 | 'max';
  craftFilter: 'gear' | 'supplies' | 'fixtures';
  wide: boolean;
}

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'mine', label: 'Mine', icon: 'gear-none' },
  { id: 'upgrades', label: 'Upgrades', icon: 'icon-up' },
  { id: 'miner', label: 'Miner', icon: 'icon-miner' },
  { id: 'craft', label: 'Craft', icon: 'icon-anvil' },
  { id: 'missions', label: 'Missions', icon: 'icon-scroll' },
  { id: 'descent', label: 'Descent', icon: 'icon-echo' },
];

export function tabVisible(s: GameState, tab: Tab): boolean {
  switch (tab) {
    case 'upgrades': return hasFeature(s, 'upgrades');
    case 'miner': return hasFeature(s, 'miner');
    case 'craft': return hasFeature(s, 'refinery');
    case 'descent': return hasFeature(s, 'descent');
    default: return true;
  }
}

const UPGRADE_ICON: Record<string, string> = {
  sharpen: 'gear-iron-pick',
  cart: 'icon-cart',
  haggle: 'icon-coin',
  bellows: 'icon-bellows',
  grip: 'icon-glove',
  tuning: 'icon-wrench',
};

const coin = (n: number): string => `${iconHtml('icon-coin', 1, 'inline')}${fmt(n)}`;

function btn(act: string, label: string, enabled: boolean, cls = ''): string {
  return `<button class="btn ${cls}" data-act="${act}"${enabled ? '' : ' disabled'}>${label}</button>`;
}

function bar(frac: number, cls = ''): string {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return `<div class="bar ${cls}"><div style="width:${pct.toFixed(1)}%"></div></div>`;
}

function stackHtml(s: GameState, x: Stack): string {
  const have = s.inventory[x.id] ?? 0;
  const name = MATERIAL.get(x.id)?.name ?? x.id;
  return `<span class="stack ${have >= x.n ? 'ok' : 'short'}" title="${esc(name)}">${iconHtml(`item-${x.id}`, 1, 'inline')}${fmtInt(have)}/${fmtInt(x.n)}</span>`;
}

function rewardHtml(r: Reward & { echoes?: number }): string {
  const parts: string[] = [];
  if (r.coins) parts.push(coin(r.coins));
  if (r.xp) parts.push(`${iconHtml('icon-xp', 1, 'inline')}${fmt(r.xp)} XP`);
  if (r.echoes) parts.push(`${iconHtml('icon-echo', 1, 'inline')}${r.echoes}`);
  for (const c of r.consumables ?? []) parts.push(`${iconHtml(`use-${c.id}`, 1, 'inline')}${c.n}× ${CONSUMABLES.find((x) => x.id === c.id)?.name}`);
  for (const f of r.unlock ?? []) parts.push(`<span class="unlock">Unlocks: ${esc(featureName(f))}</span>`);
  return parts.join(' ');
}

function featureName(f: string): string {
  const names: Record<string, string> = {
    upgrades: 'Upgrades', drones: 'Mining drones', miner: 'Miner stats', refinery: 'Furnace', workbench: 'Workbench',
    power: 'Power Strike', dowse: 'Dowse', frenzy: 'Frenzy', rig: 'Drill rigs', excavator: 'Excavators',
    passives: 'Passive skills', contracts: 'Daily contracts', descent: 'The Descent',
  };
  return names[f] ?? f;
}

// --- Mine ------------------------------------------------------------------------------

const KIND_LABEL: Record<MaterialKind, string> = { ore: 'Ore', gem: 'Gems', bar: 'Bars', essence: 'Hearts' };

export function renderMine(s: GameState): string {
  const biome = biomeAt(s.depth);
  const d = derive(s);
  const out: string[] = [];
  out.push(`<section class="card biome" data-key="biome">
    <div class="row between"><button class="title-btn" data-act="jump" title="Go to another depth"><h3>${esc(biomeText(s, biome).name)} ▾</h3></button><span class="muted">Depth ${s.depth} of ${s.maxDepth}</span></div>
    <p class="muted small">${esc(biomeText(s, biome).blurb)}</p>
    ${d.hazard.warning ? `<p class="warn small">⚠ ${esc(d.hazard.warning)}</p>` : ''}
    <div class="row wrap gap">
      ${btn('depth:up', '▲ Up', s.depth > 1, 'small')}
      ${btn('depth:down', '▼ Down', s.depth < s.maxDepth, 'small')}
      ${btn('depth:front', '⇥ Deepest', s.depth < s.maxDepth, 'small')}
      ${btn('advance', s.autoAdvance ? '⇣ Pushing deeper' : '⏸ Farming here', true, `small toggle ${s.autoAdvance ? 'on' : ''}`)}
    </div>
    <p class="muted small">${s.autoAdvance ? 'Every ten blocks the seam is exposed. Break it to go deeper.' : 'The seam stays buried: you keep mining this depth.'}</p>
  </section>`);

  const buffs: string[] = [];
  if (s.buffs.dowse > 0) buffs.push(`Dowsing ${fmtTime(s.buffs.dowse)}`);
  if (s.buffs.frenzy > 0) buffs.push(`Frenzy ${fmtTime(s.buffs.frenzy)}`);
  if (s.buffs.luck > 0) buffs.push(`Lucky Brew ${fmtTime(s.buffs.luck)}`);
  if (s.buffs.sage > 0) buffs.push(`Sage Brew ${fmtTime(s.buffs.sage)}`);
  if (s.buffs.overdrive > 0) buffs.push(`Overdrive ${fmtTime(s.buffs.overdrive)}`);
  if (s.buffs.gild > 0) buffs.push(`Gilded ${fmtTime(s.buffs.gild)}`);
  if (s.buffs.seek > 0) buffs.push(`Veinseeker ${fmtTime(s.buffs.seek)}`);
  if (s.buffs.still > 0) buffs.push(`Stillwater ${fmtTime(s.buffs.still)}`);
  if (buffs.length) out.push(`<section class="card" data-key="buffs"><div class="row wrap gap">${buffs.map((b) => `<span class="chip glow">${b}</span>`).join('')}</div></section>`);

  const cons = CONSUMABLES.filter((c) => (s.consumables[c.id] ?? 0) > 0);
  if (cons.length) {
    out.push(`<section class="card" data-key="cons"><h4>Supplies</h4>${cons
      .map((c) => `<div class="item-row">${iconHtml(`use-${c.id}`, 2)}<div class="grow"><b>${c.name}</b> ×${s.consumables[c.id]}<div class="muted small">${c.text}</div></div>${btn(`use:${c.id}`, 'Use', true, 'small')}</div>`)
      .join('')}</section>`);
  }

  const ores = MATERIALS.filter((m) => m.kind === 'ore' && (s.inventory[m.id] ?? 0) >= 1);
  const oreValue = ores.reduce((a, m) => a + Math.floor(s.inventory[m.id] ?? 0) * m.value, 0) * d.sellMult;
  out.push(`<section class="card" data-key="inv">
    <div class="row between"><h4>Cart</h4>${btn('sellore', `Sell all ore · ${coin(oreValue)}`, oreValue > 0, 'small primary')}</div>
    ${s.fixtures.includes('chute') ? `<p class="muted small">The Ore Chute sells ore past ${CHUTE_RESERVE} of each kind as you mine it.</p>` : ''}`);
  let any = false;
  for (const kind of ['ore', 'gem', 'bar', 'essence'] as MaterialKind[]) {
    const items = MATERIALS.filter((m) => m.kind === kind && (s.inventory[m.id] ?? 0) >= 1);
    if (!items.length) continue;
    any = true;
    out.push(`<div class="inv-group"><div class="muted small label">${KIND_LABEL[kind]}</div><div class="inv-grid">`);
    for (const m of items) {
      const n = Math.floor(s.inventory[m.id] ?? 0);
      out.push(`<button class="inv" data-act="sell:${m.id}" data-key="inv-${m.id}" title="Sell all ${esc(m.name)} for ${fmt(n * m.value * d.sellMult)}">
        ${iconHtml(`item-${m.id}`, 2)}<span class="n">${fmtInt(n)}</span><span class="nm">${esc(m.name)}</span><span class="v">${coin(n * m.value * d.sellMult)}</span></button>`);
    }
    out.push('</div></div>');
  }
  if (!any) out.push('<p class="muted small">Empty. Tap the rock face above.</p>');
  out.push('<p class="muted small">Tap an item to sell all of it.</p></section>');
  return out.join('');
}

// --- Upgrades ---------------------------------------------------------------------------

function machineCount(s: GameState, id: string, mode: UiState['buyMode']): number {
  if (mode === 'max') return Math.max(1, maxAffordable(s, id));
  return mode;
}

export function renderUpgrades(s: GameState, ui: UiState): string {
  const seg = `<div class="seg">${([1, 10, 'max'] as const).map((m) => `<button class="${ui.buyMode === m ? 'on' : ''}" data-act="mode:${m}">${m === 'max' ? 'Max' : `×${m}`}</button>`).join('')}</div>`;
  const out: string[] = [`<section class="card" data-key="buybar"><div class="row between wrap gap">
    <span class="muted small">Buy</span>${seg}${btn('spendall', 'Spend all', s.coins > 0, 'small primary')}</div>
    <p class="muted tiny">Spend all buys the cheapest next level of everything, again and again, until the coin runs out.</p></section>`];
  out.push('<section class="card" data-key="ups"><h4>Upgrades</h4>');
  for (const u of UPGRADES) {
    if (u.requires && !hasFeature(s, u.requires)) continue;
    const lvl = s.upgrades[u.id] ?? 0;
    const n = ui.buyMode === 'max' ? Math.max(1, maxUpgradeLevels(s, u.id)) : ui.buyMode;
    const cost = upgradeCost(u.id, lvl, n);
    out.push(`<div class="item-row" data-key="u-${u.id}">${iconHtml(UPGRADE_ICON[u.id] ?? 'icon-up', 2)}
      <div class="grow"><b>${u.name}</b> <span class="muted">Lv ${lvl}</span><div class="muted small">${u.text}</div></div>
      ${btn(`up:${u.id}:${n}`, `${n > 1 ? `+${n} · ` : ''}${coin(cost)}`, s.coins >= cost, 'buy')}</div>`);
  }
  out.push('</section>');

  if (hasFeature(s, 'drones')) {
    const d = derive(s);
    out.push(`<section class="card" data-key="machines"><h4>Machines</h4>
      <p class="muted small">Machines hit whatever is in front of you, all the time — and while you are away. Total ${fmt(d.autoDps)} damage/s; they can clear at most ${machineBreaksPerSecond(s)} blocks a second, so they earn most at the deepest depth they can keep up with. Each biome down refits them (×${BALANCE.machineBiomeBoost} per biome), and they borrow half of your swing.</p>`);
    for (const m of MACHINES) {
      if (!hasFeature(s, m.requires)) continue;
      const owned = s.machines[m.id] ?? 0;
      const n = machineCount(s, m.id, ui.buyMode);
      const cost = machineCost(m.id, owned, n);
      out.push(`<div class="item-row" data-key="m-${m.id}">${iconHtml(`${m.id}-0`, m.id === 'drone' ? 3 : 2)}
        <div class="grow"><b>${m.name}</b> <span class="muted">×${owned}</span><div class="muted small">${m.text} ${fmt(m.dps)} dmg/s each, before bonuses.</div></div>
        ${btn(`machine:${m.id}:${n}`, `+${n} · ${coin(cost)}`, s.coins >= cost, 'buy')}</div>`);
    }
    out.push('</section>');
  }
  return out.join('');
}

// --- Miner -------------------------------------------------------------------------------

const STAT_TEXT: Record<CoreStat, [string, string]> = {
  str: ['Strength', '+10% tap damage each.'],
  dex: ['Dexterity', '+0.5% crit chance, +1% crit damage each.'],
  lck: ['Luck', 'Rarer ore and more gems.'],
  end: ['Endurance', '+5 stamina, faster recovery.'],
};

function gearLines(item: GearItem): string {
  const base = GEAR_BASE.get(item.base)!;
  const lines = (Object.entries(base.stats) as [StatKey, number][]).map(([k, v]) => `${STAT_LABEL[k]} ${formatStat(k, v)}`);
  const aff = item.affixes.map((a) => `<span class="affix">${STAT_LABEL[a.stat]} ${formatStat(a.stat, a.value)}</span>`);
  return `<span class="muted small">${lines.join(' · ')}</span>${aff.length ? `<div class="small">${aff.join(' · ')}</div>` : ''}`;
}

function rarity(item: GearItem): string {
  return item.affixes.length === 2 ? 'rare' : item.affixes.length === 1 ? 'fine' : 'common';
}

export function renderMiner(s: GameState): string {
  const d = derive(s);
  const out: string[] = [];
  out.push(`<section class="card" data-key="lvl"><div class="row between"><h3>Level ${s.level}</h3><span class="muted small">${fmt(s.xp)} / ${fmt(xpForLevel(s.level))} XP</span></div>
    ${bar(s.xp / xpForLevel(s.level), 'xp')}
    <div class="row between"><h4>Stats</h4><span class="${s.statPoints > 0 ? 'glow-text' : 'muted'}">${s.statPoints} points to spend</span></div>`);
  for (const k of ['str', 'dex', 'lck', 'end'] as CoreStat[]) {
    out.push(`<div class="item-row" data-key="st-${k}"><div class="stat-v">${s.stats[k]}</div><div class="grow"><b>${STAT_TEXT[k][0]}</b><div class="muted small">${STAT_TEXT[k][1]}</div></div>
      ${btn(`stat:${k}:1`, '+1', s.statPoints > 0, 'small')}${btn(`stat:${k}:5`, '+5', s.statPoints >= 5, 'small')}</div>`);
  }
  out.push(`<div class="derived small">
    <span>Tap <b>${fmt(d.tap)}</b></span><span>Crit <b>${d.critChance.toFixed(1)}%</b> ×${d.critMult.toFixed(2)}</span>
    <span>Luck <b>${fmt(d.luck)}</b></span><span>Stamina <b>${Math.floor(s.stamina)}/${d.staminaMax}</b></span>
    <span>Machines <b>${fmt(d.autoDps)}/s</b></span><span>Ore ×<b>${d.oreMult.toFixed(2)}</b></span>
    <span>Sell ×<b>${d.sellMult.toFixed(2)}</b></span><span>XP ×<b>${d.xpMult.toFixed(2)}</b></span>
  </div></section>`);

  // Equipment.
  out.push('<section class="card" data-key="gear"><h4>Equipment</h4><div class="slots">');
  for (const slot of ['pick', 'lantern', 'armor', 'charm'] as Slot[]) {
    const item = s.gear.find((g) => g.uid === s.equipped[slot]);
    out.push(`<div class="slot ${item ? rarity(item) : 'empty'}" data-key="slot-${slot}">${item ? iconHtml(`gear-${item.base}`, 2) : `<span class="slot-empty">${slot}</span>`}
      <div class="small">${item ? esc(GEAR_BASE.get(item.base)!.name) : '—'}</div></div>`);
  }
  out.push('</div>');
  const spare = s.gear.filter((g) => !Object.values(s.equipped).includes(g.uid));
  if (spare.length) {
    out.push('<h4>Pack</h4>');
    for (const g of spare.sort((a, b) => GEAR_BASE.get(b.base)!.tier - GEAR_BASE.get(a.base)!.tier)) {
      const base = GEAR_BASE.get(g.base)!;
      out.push(`<div class="item-row ${rarity(g)}" data-key="g-${g.uid}">${iconHtml(`gear-${g.base}`, 2)}<div class="grow"><b>${esc(base.name)}</b> <span class="muted small">${base.slot}</span><div>${gearLines(g)}</div></div>
        ${btn(`equip:${g.uid}`, 'Wear', true, 'small')}${btn(`salvage:${g.uid}`, 'Melt', true, 'small ghost')}</div>`);
    }
  } else if (!s.gear.length) {
    out.push('<p class="muted small">Nothing yet. Gear is made at the workbench.</p>');
  }
  for (const slot of ['pick', 'lantern', 'armor', 'charm'] as Slot[]) {
    const item = s.gear.find((g) => g.uid === s.equipped[slot]);
    if (!item) continue;
    out.push(`<div class="item-row worn ${rarity(item)}" data-key="w-${slot}">${iconHtml(`gear-${item.base}`, 2)}<div class="grow"><b>${esc(GEAR_BASE.get(item.base)!.name)}</b> <span class="chip">worn</span><div>${gearLines(item)}</div></div></div>`);
  }
  out.push('</section>');

  if (hasFeature(s, 'passives')) {
    const free = passivePointsFree(s);
    out.push(`<section class="card" data-key="passives"><div class="row between"><h4>Passive skills</h4><span class="${free > 0 ? 'glow-text' : 'muted'}">${free} points</span></div>
      <p class="muted small">A point every 3 levels. Each node needs the one above it.</p><div class="branches">`);
    for (const branch of ['brawn', 'machinist', 'prospector'] as const) {
      out.push(`<div class="branch"><div class="label small">${branch}</div>`);
      for (const p of PASSIVES.filter((x) => x.branch === branch)) {
        const rank = s.passives[p.id] ?? 0;
        out.push(`<button class="node ${rank > 0 ? 'has' : ''}" data-act="passive:${p.id}" data-key="p-${p.id}"${canRankPassive(s, p.id) ? '' : ' disabled'}>
          <b>${p.name}</b><span class="small">${rank}/${p.max}</span><span class="muted tiny">${p.text}</span></button>`);
      }
      out.push('</div>');
    }
    out.push('</div></section>');
  }

  if (hasFeature(s, 'bargains')) {
    out.push(`<section class="card bargains" data-key="bargains"><div class="row between"><h4>Bargains</h4>${iconHtml('icon-bargain', 2)}</div>
      <p class="muted small">It offers. You choose. Nothing taken can be given back.</p>`);
    for (const b of BARGAINS) {
      const taken = s.bargains.includes(b.id);
      out.push(`<div class="item-row ${taken ? 'taken' : ''}" data-key="b-${b.id}"><div class="grow"><b>${esc(b.name)}</b>
        <div class="small good">${esc(b.boon)}</div><div class="small warn">${esc(b.cost)}</div></div>
        ${taken ? '<span class="chip glow">Struck</span>' : btn(`bargain:${b.id}`, 'Accept', true, 'small')}</div>`);
    }
    out.push('</section>');
  }
  return out.join('');
}

// --- Craft --------------------------------------------------------------------------------

function recipeOutput(r: CraftRecipe): { icon: string; name: string; detail: string } {
  const o = r.output;
  if (o.kind === 'gear') {
    const base = GEAR_BASE.get(o.base)!;
    const lines = (Object.entries(base.stats) as [StatKey, number][]).map(([k, v]) => `${STAT_LABEL[k]} ${formatStat(k, v)}`);
    return { icon: `gear-${o.base}`, name: base.name, detail: `${base.slot} · tier ${base.tier} · ${lines.join(' · ')}` };
  }
  if (o.kind === 'consumable') {
    const c = CONSUMABLES.find((x) => x.id === o.id)!;
    return { icon: `use-${o.id}`, name: `${c.name}${o.n > 1 ? ` ×${o.n}` : ''}`, detail: c.text };
  }
  const f = FIXTURES.find((x) => x.id === o.id)!;
  return { icon: `fix-${o.id}`, name: f.name, detail: f.text };
}

export function renderCraft(s: GameState, ui: UiState): string {
  const out: string[] = [];
  const slots = furnaceSlots(s);
  out.push(`<section class="card" data-key="furnace"><h4>Furnace</h4><p class="muted small">Ore into bars. Furnaces keep working while you are away.</p><div class="furnaces">`);
  for (let i = 0; i < slots; i++) {
    const f = s.furnace[i]!;
    const r = f.recipe ? REFINE.find((x) => x.id === f.recipe) : undefined;
    if (!r || f.queued <= 0) {
      out.push(`<div class="furnace idle" data-key="f-${i}">${iconHtml('fix-furnace2', 2)}<div class="grow muted small">Cold. Queue a bar below.</div></div>`);
      continue;
    }
    const per = refineSeconds(s, r);
    const waiting = f.progress < 0 && batchesAffordable(s, r) < 1;
    out.push(`<div class="furnace" data-key="f-${i}">${iconHtml(`item-${r.output}`, 2)}<div class="grow"><b>${MATERIAL.get(r.output)?.name}</b> <span class="muted small">${f.queued} queued</span>
      ${waiting ? '<div class="warn small">Waiting for ore</div>' : bar(Math.max(0, f.progress) / per, 'fire')}</div>${btn(`clear:${i}`, '✕', true, 'small ghost')}</div>`);
  }
  out.push('</div>');
  for (const r of REFINE) {
    if (!meetsRequirement(s, r.requires)) continue;
    const can = batchesAffordable(s, r);
    out.push(`<div class="item-row" data-key="r-${r.id}">${iconHtml(`item-${r.output}`, 2)}<div class="grow"><b>${MATERIAL.get(r.output)?.name}</b> <span class="muted small">${fmtTime(refineSeconds(s, r))} each</span>
      <div class="stacks">${r.inputs.map((x) => stackHtml(s, x)).join('')}</div></div>
      ${btn(`refine:${r.id}:1`, '+1', can >= 1, 'small')}${btn(`refine:${r.id}:10`, '+10', can >= 10, 'small')}${btn(`refine:${r.id}:max`, `Max${can > 0 ? ` ${fmtInt(can)}` : ''}`, can >= 1, 'small')}</div>`);
  }
  out.push('</section>');

  if (hasFeature(s, 'workbench')) {
    const known = CRAFT.filter((r) => meetsRequirement(s, r.requires));
    const kindOf = (r: CraftRecipe): UiState['craftFilter'] => (r.output.kind === 'gear' ? 'gear' : r.output.kind === 'consumable' ? 'supplies' : 'fixtures');
    out.push(`<section class="card" data-key="bench"><div class="row between"><h4>Workbench</h4>
      <div class="seg">${(['gear', 'supplies', 'fixtures'] as const).map((f) => `<button class="${ui.craftFilter === f ? 'on' : ''}" data-act="filter:${f}">${f}</button>`).join('')}</div></div>`);
    const list = known.filter((r) => kindOf(r) === ui.craftFilter && !(r.output.kind === 'fixture' && s.fixtures.includes(r.output.id)));
    for (const r of list) {
      const o = recipeOutput(r);
      const ok = canCraft(s, r);
      out.push(`<div class="recipe ${ok ? 'ready' : ''}" data-key="c-${r.id}">${iconHtml(o.icon, 2)}<div class="grow"><b>${esc(o.name)}</b>
        <div class="muted small">${esc(o.detail)}</div><div class="stacks">${r.inputs.map((x) => stackHtml(s, x)).join('')}<span class="stack ${s.coins >= r.coins ? 'ok' : 'short'}">${coin(r.coins)}</span></div></div>
        ${btn(`craft:${r.id}`, 'Craft', ok, 'primary')}</div>`);
    }
    if (!list.length) out.push('<p class="muted small">Nothing here yet.</p>');
    const hidden = CRAFT.length - known.length;
    if (hidden > 0) out.push(`<p class="muted small">${hidden} more recipes lie deeper down.</p>`);
    if (ui.craftFilter === 'fixtures' && s.fixtures.length) {
      out.push(`<div class="row wrap gap">${s.fixtures.map((f) => `<span class="chip">${iconHtml(`fix-${f}`, 1, 'inline')}${FIXTURES.find((x) => x.id === f)?.name}</span>`).join('')}</div>`);
    }
    out.push('</section>');
  } else {
    out.push('<section class="card muted small" data-key="bench">The workbench is still under the rubble. Keep smelting.</section>');
  }
  return out.join('');
}

// --- Missions ------------------------------------------------------------------------------

export function renderMissions(s: GameState, now: number): string {
  const out: string[] = [];
  const m = activeStory(s);
  if (m) {
    const p = progress(s, m.goal, s.story.base);
    out.push(`<section class="card story ${p.done ? 'done' : ''}" data-key="story">
      <div class="row between"><span class="muted small">Story ${storyIndex(s) + 1} / ${STORY.length}</span>${p.done ? '<span class="chip glow">Complete</span>' : ''}</div>
      <h3>${esc(m.title)}</h3><p class="quote">“${esc(m.text)}”</p>
      <div class="row between small"><span>${esc(describeGoal(m.goal))}</span><span>${fmtInt(p.have)} / ${fmtInt(p.need)}</span></div>${bar(p.have / p.need)}
      <div class="reward small">${rewardHtml(m.reward)}</div>
      ${btn('claim', p.done ? 'Claim' : 'In progress', p.done, 'primary wide')}</section>`);
  } else {
    out.push('<section class="card story" data-key="story"><h3>The end of the shaft</h3><p class="quote">“It knows my name now. I think I will keep digging.”</p></section>');
  }

  if (hasFeature(s, 'contracts')) {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    out.push(`<section class="card" data-key="contracts"><div class="row between"><h4>Contracts</h4><span class="muted small">New board in ${fmtTime((tomorrow.getTime() - now) / 1000)}</span></div>`);
    for (const c of s.contracts.list) {
      const p = progress(s, c.goal, c.base);
      out.push(`<div class="contract ${c.claimed ? 'claimed' : p.done ? 'done' : ''}" data-key="k-${c.id}"><div class="row between"><b>${esc(c.title)}</b><span class="small">${fmtInt(p.have)} / ${fmtInt(p.need)}</span></div>
        <div class="small">${esc(describeGoal(c.goal))}</div>${bar(p.have / p.need)}<div class="row between"><span class="reward small">${rewardHtml(c.reward)}</span>
        ${c.claimed ? '<span class="muted small">Done</span>' : btn(`contract:${c.id}`, 'Claim', p.done, 'small primary')}</div></div>`);
    }
    out.push('</section>');
  }
  const done = STORY.slice(0, storyIndex(s)).slice(-4).reverse();
  if (done.length) {
    out.push(`<section class="card muted small" data-key="log"><h4>Journal</h4>${done.map((x) => `<p>✓ <b>${esc(x.title)}</b> — ${esc(x.text)}</p>`).join('')}</section>`);
  }
  return out.join('');
}

// --- Descent -------------------------------------------------------------------------------

export function renderDescent(s: GameState): string {
  const gain = echoGain(s);
  const out: string[] = [];
  out.push(`<section class="card descent" data-key="desc"><h3>The Descent</h3>
    ${s.flags.includes('dreamt') ? '<p class="quote small">It turns over in its sleep, and dreams you again.</p>' : ''}
    <p class="small">Collapse the shaft and start again from the top. You lose coin, ore, bars, upgrades and machines. You keep your level, stats, skills, gear, fixtures and recipes — and the Echoes.</p>
    <div class="row between"><span>Deepest this run: <b>${s.maxDepth}</b></span><span>Ever: <b>${s.deepestEver}</b></span></div>
    <div class="echo-gain">${iconHtml('icon-echo', 3)}<div><div class="big">+${fmtInt(gain)}</div><div class="muted small">${gain > 0 ? 'Echoes if you Descend now' : 'Reach past depth 20 to earn Echoes'}</div></div></div>
    <p class="muted small">You will start again at depth ${Math.min(startingDepth(s), s.deepestEver)}.</p>
    ${btn('descend', 'Descend', gain > 0, 'danger wide')}</section>`);
  out.push(`<section class="card" data-key="echoes"><div class="row between"><h4>Echoes</h4><span>${iconHtml('icon-echo', 1, 'inline')}<b>${fmtInt(s.echoes)}</b></span></div>`);
  for (const e of ECHOES) {
    const rank = s.echoUpgrades[e.id] ?? 0;
    const maxed = rank >= e.max;
    const cost = echoCost(e.id, rank);
    out.push(`<div class="item-row" data-key="e-${e.id}"><div class="grow"><b>${e.name}</b> <span class="muted">${rank}/${e.max}</span><div class="muted small">${e.text}</div></div>
      ${maxed ? '<span class="chip">Max</span>' : btn(`echo:${e.id}`, `${iconHtml('icon-echo', 1, 'inline')}${fmtInt(cost)}`, s.echoes >= cost, 'buy')}</div>`);
  }
  out.push('</section>');
  return out.join('');
}

// --- The scene overlay ------------------------------------------------------------------------

export function renderSkills(s: GameState): string {
  const out: string[] = [];
  for (const k of SKILLS) {
    if (!hasFeature(s, k.id)) continue;
    const cd = s.cooldowns[k.id];
    const pct = cd > 0 ? (cd / k.cooldown) * 100 : 0;
    const active = (k.id === 'dowse' && s.buffs.dowse > 0) || (k.id === 'frenzy' && s.buffs.frenzy > 0);
    out.push(`<button class="skill ${active ? 'active' : ''}" data-act="skill:${k.id}" data-key="sk-${k.id}" title="${esc(`${k.name}: ${k.text} (${k.stamina} stamina)`)}"${skillReady(s, k.id) ? '' : ' disabled'}>
      ${iconHtml(`skill-${k.id}`, 2)}<span class="cd" style="height:${pct.toFixed(0)}%"></span><span class="cost">${k.stamina}</span></button>`);
  }
  // Blasts sit on the bar, beside the skills, where they are needed in a hurry.
  for (const id of ['dynamite', 'charge'] as const) {
    if ((s.consumables[id] ?? 0) <= 0) continue;
    out.push(`<button class="skill" data-act="use:${id}" data-key="sk-${id}" title="${id === 'charge' ? 'Deep Charge' : 'Dynamite'}">${iconHtml(`use-${id}`, 2)}<span class="cost">×${s.consumables[id]}</span></button>`);
  }
  return out.join('');
}

export function renderObjective(s: GameState): string {
  const m = activeStory(s);
  if (!m) return '';
  const p = progress(s, m.goal, s.story.base);
  return `<button class="objective ${p.done ? 'done' : ''}" data-act="tab:missions">
    <span class="small">${p.done ? '✓ ' : ''}${esc(m.title)}</span><span class="tiny">${esc(describeGoal(m.goal))} · ${fmtInt(p.have)}/${fmtInt(p.need)}</span></button>`;
}
