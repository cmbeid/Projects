import { BUILDING, BUILDINGS, TAG_LABEL } from '../data/buildings';
import { DISTRICTS, GRID_H, GRID_W, districtAt, wardOfRow } from '../data/districts';
import { MATERIAL, MATERIALS } from '../data/materials';
import { STORY } from '../data/missions';
import { BALANCE, CHARTER, EDICTS, PASSIVES, UPGRADES } from '../data/progression';
import { CONSUMABLES, CRAFT, FIXTURES, REFINE } from '../data/recipes';
import { REGALIA_BASE, STAT_LABEL, formatStat } from '../data/regalia';
import type { BuildingDef, CraftRecipe, MaterialKind, Reward, Slot, Stack, StatKey, Tag } from '../data/types';
import { AUCTION_RESERVE, crewClearsPerSecond, xpForLevel } from '../game/clearing';
import { MAX_HAPPINESS, derive } from '../game/derive';
import {
  buildingAllowed, canAffordPlace, headroom, levelCost, maxTypeLevels, maxUpgradeLevels, planPending, upgradeAllowed, upgradeCost,
} from '../game/economy';
import { hasFeature } from '../game/features';
import { canRankPassive, edictReady, passivePointsFree } from '../game/founder';
import { freeSpots, openDistricts, typeCount, typeLevels } from '../game/grid';
import { activeStory, describeGoal, progress, storyIndex } from '../game/missions';
import { meetsRequirement } from '../game/requirements';
import { districtText } from '../game/story';
import { charterCost, memoryGain, startingWard } from '../game/tide';
import { batchesAffordable, canCraft, refineSeconds, workshopSlots } from '../game/workshops';
import { fmt, fmtInt, fmtTime } from '../num/format';
import { iconHtml } from '../sprites/atlas';
import type { CoreStat, GameState, RegaliaItem } from '../state/types';
import { esc } from './dom';

export type Tab = 'city' | 'build' | 'founder' | 'works' | 'missions' | 'tide';

export interface UiState {
  tab: Tab;
  buyMode: 1 | 10 | 'max';
  craftFilter: 'regalia' | 'supplies' | 'fixtures';
  wide: boolean;
  /** The district shown on the map. */
  district: number;
  /** Follow the work site from district to district, unless the player has picked one. */
  follow: boolean;
  placing: string | null;
  moving: number | null;
  hover: { x: number; y: number } | null;
  /** Touch placement: the first tap shows the ghost, a second on the same tile builds. */
  armed: boolean;
  selected: number | null;
}

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'city', label: 'City', icon: 'icon-person' },
  { id: 'build', label: 'Build', icon: 'icon-build' },
  { id: 'founder', label: 'Founder', icon: 'icon-founder' },
  { id: 'works', label: 'Works', icon: 'icon-anvil' },
  { id: 'missions', label: 'Story', icon: 'icon-scroll' },
  { id: 'tide', label: 'Tide', icon: 'icon-wave' },
];

export function tabVisible(s: GameState, tab: Tab): boolean {
  switch (tab) {
    case 'build': return hasFeature(s, 'build') || hasFeature(s, 'upgrades');
    case 'founder': return hasFeature(s, 'founder');
    case 'works': return hasFeature(s, 'workshops');
    case 'tide': return hasFeature(s, 'tide');
    default: return true;
  }
}

const UPGRADE_ICON: Record<string, string> = {
  tools: 'icon-hammer',
  barrows: 'icon-barrow',
  ledgers: 'icon-ledger',
  kilns: 'icon-kiln',
  hands: 'icon-glove',
  foremen: 'icon-wrench',
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

function rewardHtml(r: Reward & { memories?: number }): string {
  const parts: string[] = [];
  if (r.coins) parts.push(coin(r.coins));
  if (r.xp) parts.push(`${iconHtml('icon-xp', 1, 'inline')}${fmt(r.xp)} XP`);
  if (r.memories) parts.push(`${iconHtml('icon-memory', 1, 'inline')}${r.memories}`);
  for (const c of r.consumables ?? []) parts.push(`${iconHtml(`use-${c.id}`, 1, 'inline')}${c.n}× ${CONSUMABLES.find((x) => x.id === c.id)?.name}`);
  for (const f of r.unlock ?? []) parts.push(`<span class="unlock">Unlocks: ${esc(featureName(f))}</span>`);
  return parts.join(' ');
}

function featureName(f: string): string {
  const names: Record<string, string> = {
    upgrades: 'Upgrades', build: 'Building', crews: 'Salvage gangs', founder: 'Founder stats', workshops: 'Workshops',
    drafting: 'Drafting Hall', rush: 'Work Rush', survey: 'Survey', festival: 'Festival', passives: 'Passive skills',
    petitions: 'Petitions', tide: 'The Tide',
  };
  return names[f] ?? f;
}

/** What one building does, in a line. */
export function outputText(def: BuildingDef): string {
  switch (def.tag) {
    case 'home': return `Houses ${fmt(def.pop ?? 0)} a level.`;
    case 'crew': return `Clears ${fmt(def.dps ?? 0)} a second a level; needs ${def.jobs} hands.`;
    case 'trade': return `${fmt(def.tax ?? 0)} coin a second a level; needs ${def.jobs} hands.`;
    case 'industry': return `+${def.slots} workshop slot${(def.slots ?? 1) > 1 ? 's' : ''}; each level past the first, +10% speed.`;
    case 'civic': return `+${Math.round((def.cheer ?? 0) * 100)}% happiness a level.`;
    case 'green': return 'Neighbours like it. One level.';
  }
}

export function likesText(def: BuildingDef): string {
  const parts = (Object.entries(def.likes) as [Tag, number][]).filter(([, v]) => v !== 0).map(([t, v]) => `${v > 0 ? '+' : ''}${v} ${TAG_LABEL[t].toLowerCase()}`);
  return parts.length ? `Next door: ${parts.join(', ')}` : 'Does not mind its neighbours.';
}

// --- City ---------------------------------------------------------------------------

const KIND_LABEL: Record<MaterialKind, string> = { salvage: 'Salvage', relic: 'Relics', good: 'Goods', heart: 'Hearts' };

export function renderCity(s: GameState): string {
  const district = districtAt(s.ward);
  const d = derive(s);
  const c = d.city;
  const out: string[] = [];
  const text = districtText(s, district);
  out.push(`<section class="card district" data-key="district">
    <div class="row between"><button class="title-btn" data-act="jump" title="Go to another ward"><h3>${esc(text.name)} ▾</h3></button><span class="muted">Ward ${s.ward} of ${s.maxWard}</span></div>
    <p class="muted small">${esc(text.blurb)}</p>
    ${d.hazard.warning ? `<p class="warn small">⚠ ${esc(d.hazard.warning)}</p>` : ''}
    <div class="row wrap gap">
      ${btn('ward:back', '◀ Back', s.ward > 1, 'small')}
      ${btn('ward:on', 'On ▶', s.ward < s.maxWard, 'small')}
      ${btn('ward:front', '⇥ Furthest', s.ward < s.maxWard, 'small')}
      ${btn('advance', s.autoAdvance ? '⇢ Pushing on' : '⏸ Salvaging here', true, `small toggle ${s.autoAdvance ? 'on' : ''}`)}
    </div>
    <p class="muted small">${s.autoAdvance ? `Every ${BALANCE.ruinsPerWard} ruins a landmark stands exposed. Bring it down to open the next ward and its row of land.` : 'The landmark stays standing: you keep salvaging this ward.'}</p>
  </section>`);

  if (hasFeature(s, 'build')) {
    out.push(`<section class="card" data-key="census"><h4>The city</h4><div class="derived small">
      <span>${iconHtml('icon-person', 1, 'inline')}Citizens <b>${fmtInt(c.pop)}</b></span>
      <span>Jobs <b>${fmtInt(c.jobs)}</b> · ${Math.round(c.employ * 100)}% filled</span>
      <span>${iconHtml('icon-smile', 1, 'inline')}Happiness <b>${Math.round(c.happiness * 100)}%</b></span>
      <span>${iconHtml('icon-coin', 1, 'inline')}Taxes <b>${fmt(d.taxPerSec)}/s</b></span>
      <span>Crews <b>${fmt(d.crewDps)}/s</b></span>
      <span>Buildings <b>${s.buildings.length}</b></span>
    </div>
    ${c.employ < 0.999 ? '<p class="warn small">Not enough people for every job: workplaces run short-handed. Build homes.</p>' : ''}
    <p class="muted small">Workplaces run at their share of hands filled, times happiness. Homes beside gardens and civic buildings make a happier city, up to ${MAX_HAPPINESS * 100}%.</p></section>`);
  }

  const buffs: string[] = [];
  const named: [keyof GameState['buffs'], string][] = [
    ['survey', 'Survey'], ['festival', 'Festival'], ['ink', 'Surveyor’s Ink'], ['almanac', 'Almanac'], ['overtime', 'Overtime'],
    ['wine', 'Festival Wine'], ['seek', 'Dowsing Glass'], ['calm', 'Still Air'], ['grease', 'Pump Grease'], ['kite', 'Kite Line'],
  ];
  for (const [k, name] of named) if (s.buffs[k] > 0) buffs.push(`${name} ${fmtTime(s.buffs[k])}`);
  if (buffs.length) out.push(`<section class="card" data-key="buffs"><div class="row wrap gap">${buffs.map((b) => `<span class="chip glow">${b}</span>`).join('')}</div></section>`);

  const cons = CONSUMABLES.filter((x) => (s.consumables[x.id] ?? 0) > 0);
  if (cons.length) {
    out.push(`<section class="card" data-key="cons"><h4>Supplies</h4>${cons
      .map((x) => `<div class="item-row">${iconHtml(`use-${x.id}`, 2)}<div class="grow"><b>${x.name}</b> ×${s.consumables[x.id]}<div class="muted small">${x.text}</div></div>${btn(`use:${x.id}`, 'Use', true, 'small')}</div>`)
      .join('')}</section>`);
  }

  const salvage = MATERIALS.filter((m) => m.kind === 'salvage' && (s.inventory[m.id] ?? 0) >= 1);
  const value = salvage.reduce((a, m) => a + Math.floor(s.inventory[m.id] ?? 0) * m.value, 0) * d.sellMult;
  out.push(`<section class="card" data-key="inv">
    <div class="row between"><h4>Stores</h4>${btn('sellall', `Sell all salvage · ${coin(value)}`, value > 0, 'small primary')}</div>
    ${s.fixtures.includes('auction') ? `<p class="muted small">The Auction House sells salvage past ${AUCTION_RESERVE} of each kind as it comes in.</p>` : ''}`);
  let any = false;
  for (const kind of ['salvage', 'good', 'relic', 'heart'] as MaterialKind[]) {
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
  if (!any) out.push('<p class="muted small">Empty. Tap the ruin to clear it.</p>');
  out.push('<p class="muted small">Tap an item to sell all of it.</p></section>');
  return out.join('');
}

// --- Build --------------------------------------------------------------------------

function count(ui: UiState, max: () => number): number {
  return ui.buyMode === 'max' ? Math.max(1, max()) : ui.buyMode;
}

export function renderBuild(s: GameState, ui: UiState): string {
  const out: string[] = [];
  const d = derive(s);
  const seg = `<div class="seg">${([1, 10, 'max'] as const).map((m) => `<button class="${ui.buyMode === m ? 'on' : ''}" data-act="mode:${m}">${m === 'max' ? 'Max' : `×${m}`}</button>`).join('')}</div>`;
  out.push(`<section class="card" data-key="buybar"><div class="row between wrap gap">
    <span class="muted small">Buy</span>${seg}${btn('spendall', 'Spend all', s.coins > 0, 'small primary')}</div>
    <p class="muted tiny">Spend all buys the cheapest next level of every upgrade and every building standing, again and again, until the coin runs out. It never places anything new.</p></section>`);

  if (ui.placing || ui.moving != null) {
    const type = ui.placing ?? s.buildings.find((b) => b.uid === ui.moving)?.type ?? '';
    const def = BUILDING.get(type);
    out.push(`<section class="card placing" data-key="placing"><div class="row between"><b>${ui.moving != null ? 'Moving' : 'Placing'}: ${esc(def?.name ?? '')}</b>${btn('cancel', 'Done', true, 'small')}</div>
      <p class="small">Tap open ground on the map. ${def && def.w * def.h > 1 ? `It takes ${def.w}×${def.h} tiles, from the one you tap. ` : ''}On a phone, tap once to see what the neighbours make of it and again to build.</p>
      <p class="muted small">${def ? esc(likesText(def)) : ''}</p></section>`);
  }

  if (hasFeature(s, 'build')) {
    const open = openDistricts(s);
    const tabs = open
      .map((i) => `<button class="${ui.district === i ? 'on' : ''}" data-act="view:${i}">${esc(districtText(s, DISTRICTS[i]!).name.replace(/^The /, ''))}</button>`)
      .join('');
    const tiles = (() => {
      let n = 0;
      for (let y = 0; y < GRID_H; y++) if (wardOfRow(ui.district, y) <= s.maxWard) n += GRID_W;
      return n;
    })();
    const used = s.buildings.filter((b) => b.district === ui.district).reduce((a, b) => a + (BUILDING.get(b.type)!.w * BUILDING.get(b.type)!.h), 0);
    const pending = planPending(s);
    out.push(`<section class="card" data-key="map"><div class="row between wrap gap"><h4>Map</h4>${open.length > 1 ? `<div class="seg">${tabs}</div>` : ''}</div>
      <p class="muted small">${tiles} tiles of land here, ${used} built on. Each ward opened adds a row. Tap a building on the map to level it up, move it or pull it down.</p>
      ${pending > 0 ? `<div class="row between"><span class="small">The plan from before the Tide: ${pending} to put back.</span>${btn('rebuild', 'Rebuild', true, 'small primary')}</div>` : ''}</section>`);

    const known = BUILDINGS.filter((b) => buildingAllowed(s, b));
    for (const tag of ['home', 'crew', 'trade', 'green', 'civic', 'industry'] as Tag[]) {
      const list = known.filter((b) => b.tag === tag);
      if (!list.length) continue;
      out.push(`<section class="card" data-key="b-${tag}"><h4>${TAG_LABEL[tag]}${tag === 'home' || tag === 'industry' ? '' : tag === 'green' ? ' spaces' : tag === 'civic' ? ' buildings' : tag === 'crew' ? 's' : ''}</h4>`);
      for (const def of list) {
        const levels = typeLevels(s, def.id);
        const n = typeCount(s, def.id);
        const cost = levelCost(s, def.id);
        const room = s.buildings.some((b) => b.type === def.id && headroom(b) > 0);
        const up = count(ui, () => maxTypeLevels(s, def.id));
        const upCost = levelCost(s, def.id, up);
        const roomLeft = s.buildings.filter((b) => b.type === def.id).reduce((a, b) => a + headroom(b), 0);
        const spots = open.reduce((a, i) => a + freeSpots(s, def.id, i).length, 0);
        const canPlace = canAffordPlace(s, def.id) && spots > 0;
        out.push(`<div class="item-row building ${ui.placing === def.id ? 'on' : ''}" data-key="bd-${def.id}">${iconHtml(`bld-${def.id}`, def.w > 1 || def.h > 1 ? 1 : 2)}
          <div class="grow"><b>${esc(def.name)}</b> <span class="muted small">${n ? `×${n} · ${levels} lv` : ''}${def.w * def.h > 1 ? ` · ${def.w}×${def.h}` : ''}</span>
          <div class="muted small">${esc(outputText(def))}</div><div class="tiny muted">${esc(likesText(def))}</div>
          <div class="stacks">${def.inputs.map((x) => stackHtml(s, x)).join('')}<span class="stack ${s.coins >= cost ? 'ok' : 'short'}">${coin(cost)}</span></div></div>
          <div class="col">${btn(`place:${def.id}`, spots ? 'Place' : 'No room', canPlace, 'small primary')}
          ${room ? btn(`uptype:${def.id}:${up}`, `+${up} · ${coin(upCost)}`, s.coins >= upCost && up <= roomLeft, 'small') : ''}</div></div>`);
      }
      out.push('</section>');
    }
    const hidden = BUILDINGS.length - known.length;
    if (hidden > 0) out.push(`<p class="muted small center">${hidden} more kinds of building wait further in.</p>`);
  }

  if (hasFeature(s, 'upgrades')) {
    out.push('<section class="card" data-key="ups"><h4>Upgrades</h4>');
    for (const u of UPGRADES) {
      if (!upgradeAllowed(s, u.id)) continue;
      const lvl = s.upgrades[u.id] ?? 0;
      const n = count(ui, () => maxUpgradeLevels(s, u.id));
      const cost = upgradeCost(u.id, lvl, n);
      out.push(`<div class="item-row" data-key="u-${u.id}">${iconHtml(UPGRADE_ICON[u.id] ?? 'icon-up', 2)}
        <div class="grow"><b>${u.name}</b> <span class="muted">Lv ${lvl}</span><div class="muted small">${u.text}</div></div>
        ${btn(`up:${u.id}:${n}`, `${n > 1 ? `+${n} · ` : ''}${coin(cost)}`, s.coins >= cost, 'buy')}</div>`);
    }
    if (hasFeature(s, 'crews')) out.push(`<p class="muted small">Crews hit the ruin in front of you, all the time and while you are away — ${fmt(d.crewDps)} a second now. They can carry away at most ${crewClearsPerSecond(s)} ruins a second.</p>`);
    out.push('</section>');
  }
  return out.join('');
}

/** The sheet that opens when a building on the map is tapped. */
export function renderBuildingSheet(s: GameState, uid: number, ui: UiState, mult: number, neighbours: string[]): string {
  const b = s.buildings.find((x) => x.uid === uid);
  const def = b && BUILDING.get(b.type);
  if (!b || !def) return '<p class="muted">Gone.</p>';
  const n = count(ui, () => Math.min(maxTypeLevels(s, def.id), headroom(b)));
  const cost = levelCost(s, def.id, n);
  const room = headroom(b);
  const d = derive(s);
  let now = '';
  const eff = mult * b.lvl;
  switch (def.tag) {
    case 'home': now = `Houses ${fmt((def.pop ?? 0) * eff)}.`; break;
    case 'crew': now = `Clears ${fmt((def.dps ?? 0) * eff * d.city.employ * d.city.happiness)} a second, before your bonuses.`; break;
    case 'trade': now = `Pays ${fmt((def.tax ?? 0) * eff * d.city.employ * d.city.happiness * d.taxMult)} coin a second.`; break;
    case 'civic': now = `Adds ${Math.round((def.cheer ?? 0) * eff * 100)}% happiness.`; break;
    case 'industry': now = `Adds ${def.slots} workshop slot${(def.slots ?? 1) > 1 ? 's' : ''}.`; break;
    case 'green': now = 'Its neighbours are the better for it.'; break;
  }
  return `<div class="row gap">${iconHtml(`bld-${def.id}`, def.w > 1 ? 2 : 3)}<div class="grow"><h3>${esc(def.name)}</h3>
      <span class="muted small">${TAG_LABEL[def.tag]} · level ${b.lvl}${def.maxLevel ? ` of ${def.maxLevel}` : ''}</span></div></div>
    <p class="small">${esc(def.text)}</p>
    <p class="small">${now}</p>
    <p class="small">Neighbours: <b class="${mult >= 1 ? 'good' : 'warn'}">×${mult.toFixed(2)}</b>${neighbours.length ? ` — ${neighbours.map(esc).join(', ')}` : ' — nobody next door yet.'}</p>
    <p class="muted tiny">${esc(likesText(def))}</p>
    <div class="row gap wrap end">
      ${room > 0 ? `<button class="btn primary" id="sheet-up"${s.coins >= cost ? '' : ' disabled'}>+${n} level${n > 1 ? 's' : ''} · ${coin(cost)}</button>` : ''}
      <button class="btn" id="sheet-move">Move</button>
      <button class="btn danger" id="sheet-demolish">Pull down</button>
      <button class="btn ghost" data-act="close">Close</button>
    </div>`;
}

// --- Founder --------------------------------------------------------------------------

const STAT_TEXT: Record<CoreStat, [string, string]> = {
  craft: ['Craft', '+10% tap power each.'],
  vision: ['Vision', '+0.5% crit chance and +1% crit power each.'],
  charm: ['Charm', '+3% taxes and +1 luck each.'],
  grit: ['Grit', '+5 resolve and faster recovery each.'],
};

function regaliaLines(item: RegaliaItem): string {
  const base = REGALIA_BASE.get(item.base)!;
  const lines = (Object.entries(base.stats) as [StatKey, number][]).map(([k, v]) => `${STAT_LABEL[k]} ${formatStat(k, v)}`);
  const aff = item.affixes.map((a) => `<span class="affix">${STAT_LABEL[a.stat]} ${formatStat(a.stat, a.value)}</span>`);
  return `<span class="muted small">${lines.join(' · ')}</span>${aff.length ? `<div class="small">${aff.join(' · ')}</div>` : ''}`;
}

function rarity(item: RegaliaItem): string {
  return item.affixes.length === 2 ? 'rare' : item.affixes.length === 1 ? 'fine' : 'common';
}

const SLOTS: Slot[] = ['chain', 'seal', 'coat', 'lantern'];

export function renderFounder(s: GameState): string {
  const d = derive(s);
  const out: string[] = [];
  out.push(`<section class="card" data-key="lvl"><div class="row between"><h3>Level ${s.level}</h3><span class="muted small">${fmt(s.xp)} / ${fmt(xpForLevel(s.level))} XP</span></div>
    ${bar(s.xp / xpForLevel(s.level), 'xp')}
    <div class="row between"><h4>Stats</h4><span class="${s.statPoints > 0 ? 'glow-text' : 'muted'}">${s.statPoints} points to spend</span></div>`);
  for (const k of ['craft', 'vision', 'charm', 'grit'] as CoreStat[]) {
    out.push(`<div class="item-row" data-key="st-${k}"><div class="stat-v">${s.stats[k]}</div><div class="grow"><b>${STAT_TEXT[k][0]}</b><div class="muted small">${STAT_TEXT[k][1]}</div></div>
      ${btn(`stat:${k}:1`, '+1', s.statPoints > 0, 'small')}${btn(`stat:${k}:5`, '+5', s.statPoints >= 5, 'small')}</div>`);
  }
  out.push(`<div class="derived small">
    <span>Tap <b>${fmt(d.tap)}</b></span><span>Crit <b>${d.critChance.toFixed(1)}%</b> ×${d.critMult.toFixed(2)}</span>
    <span>Luck <b>${fmt(d.luck)}</b></span><span>Resolve <b>${Math.floor(s.resolve)}/${d.resolveMax}</b></span>
    <span>Salvage ×<b>${d.salvageMult.toFixed(2)}</b></span><span>Sales ×<b>${d.sellMult.toFixed(2)}</b></span>
    <span>Taxes ×<b>${d.taxMult.toFixed(2)}</b></span><span>XP ×<b>${d.xpMult.toFixed(2)}</b></span>
  </div></section>`);

  out.push('<section class="card" data-key="regalia"><h4>Regalia</h4><div class="slots">');
  for (const slot of SLOTS) {
    const item = s.regalia.find((g) => g.uid === s.equipped[slot]);
    out.push(`<div class="slot ${item ? rarity(item) : 'empty'}" data-key="slot-${slot}">${item ? iconHtml(`regalia-${item.base}`, 2) : `<span class="slot-empty">${slot}</span>`}
      <div class="small">${item ? esc(REGALIA_BASE.get(item.base)!.name) : '—'}</div></div>`);
  }
  out.push('</div>');
  const spare = s.regalia.filter((g) => !Object.values(s.equipped).includes(g.uid));
  if (spare.length) {
    out.push('<h4>Chest</h4>');
    for (const g of spare.sort((a, b) => REGALIA_BASE.get(b.base)!.tier - REGALIA_BASE.get(a.base)!.tier)) {
      const base = REGALIA_BASE.get(g.base)!;
      out.push(`<div class="item-row ${rarity(g)}" data-key="g-${g.uid}">${iconHtml(`regalia-${g.base}`, 2)}<div class="grow"><b>${esc(base.name)}</b> <span class="muted small">${base.slot}</span><div>${regaliaLines(g)}</div></div>
        ${btn(`equip:${g.uid}`, 'Wear', true, 'small')}${btn(`melt:${g.uid}`, 'Melt', true, 'small ghost')}</div>`);
    }
  } else if (!s.regalia.length) {
    out.push('<p class="muted small">Nothing yet. Regalia is made at the Drafting Hall.</p>');
  }
  for (const slot of SLOTS) {
    const item = s.regalia.find((g) => g.uid === s.equipped[slot]);
    if (!item) continue;
    out.push(`<div class="item-row worn ${rarity(item)}" data-key="w-${slot}">${iconHtml(`regalia-${item.base}`, 2)}<div class="grow"><b>${esc(REGALIA_BASE.get(item.base)!.name)}</b> <span class="chip">worn</span><div>${regaliaLines(item)}</div></div></div>`);
  }
  out.push('</section>');

  if (hasFeature(s, 'passives')) {
    const free = passivePointsFree(s);
    out.push(`<section class="card" data-key="passives"><div class="row between"><h4>Passive skills</h4><span class="${free > 0 ? 'glow-text' : 'muted'}">${free} points</span></div>
      <p class="muted small">A point every 3 levels. Each node needs the one above it.</p><div class="branches">`);
    for (const branch of ['builder', 'planner', 'steward'] as const) {
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
  return out.join('');
}

// --- Workshops and the Drafting Hall --------------------------------------------------------

function recipeOutput(r: CraftRecipe): { icon: string; name: string; detail: string } {
  const o = r.output;
  if (o.kind === 'regalia') {
    const base = REGALIA_BASE.get(o.base)!;
    const lines = (Object.entries(base.stats) as [StatKey, number][]).map(([k, v]) => `${STAT_LABEL[k]} ${formatStat(k, v)}`);
    return { icon: `regalia-${o.base}`, name: base.name, detail: `${base.slot} · tier ${base.tier} · ${lines.join(' · ')}` };
  }
  if (o.kind === 'consumable') {
    const c = CONSUMABLES.find((x) => x.id === o.id)!;
    return { icon: `use-${o.id}`, name: `${c.name}${o.n > 1 ? ` ×${o.n}` : ''}`, detail: c.text };
  }
  const f = FIXTURES.find((x) => x.id === o.id)!;
  return { icon: `fix-${o.id}`, name: f.name, detail: f.text };
}

export function renderWorks(s: GameState, ui: UiState): string {
  const out: string[] = [];
  const slots = workshopSlots(s);
  out.push(`<section class="card" data-key="shops"><h4>Workshops</h4><p class="muted small">Salvage into goods. ${slots} slot${slots > 1 ? 's' : ''}: one of your own, and one more for each workshop, boatyard or foundry in the city. They keep working while you are away.</p><div class="furnaces">`);
  for (let i = 0; i < slots; i++) {
    const f = s.workshops[i]!;
    const r = f.recipe ? REFINE.find((x) => x.id === f.recipe) : undefined;
    if (!r || f.queued <= 0) {
      out.push(`<div class="furnace idle" data-key="f-${i}">${iconHtml('icon-anvil', 2)}<div class="grow muted small">Idle. Queue something below.</div></div>`);
      continue;
    }
    const per = refineSeconds(s, r);
    const waiting = f.progress < 0 && batchesAffordable(s, r) < 1;
    out.push(`<div class="furnace" data-key="f-${i}">${iconHtml(`item-${r.output}`, 2)}<div class="grow"><b>${MATERIAL.get(r.output)?.name}</b> <span class="muted small">${f.queued} queued</span>
      ${waiting ? '<div class="warn small">Waiting for salvage</div>' : bar(Math.max(0, f.progress) / per, 'fire')}</div>${btn(`clear:${i}`, '✕', true, 'small ghost')}</div>`);
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

  if (hasFeature(s, 'drafting')) {
    const known = CRAFT.filter((r) => meetsRequirement(s, r.requires));
    const kindOf = (r: CraftRecipe): UiState['craftFilter'] => (r.output.kind === 'regalia' ? 'regalia' : r.output.kind === 'consumable' ? 'supplies' : 'fixtures');
    out.push(`<section class="card" data-key="hall"><div class="row between"><h4>Drafting Hall</h4>
      <div class="seg">${(['regalia', 'supplies', 'fixtures'] as const).map((f) => `<button class="${ui.craftFilter === f ? 'on' : ''}" data-act="filter:${f}">${f}</button>`).join('')}</div></div>`);
    const list = known.filter((r) => kindOf(r) === ui.craftFilter && !(r.output.kind === 'fixture' && s.fixtures.includes(r.output.id)));
    for (const r of list) {
      const o = recipeOutput(r);
      const ok = canCraft(s, r);
      out.push(`<div class="recipe ${ok ? 'ready' : ''}" data-key="c-${r.id}">${iconHtml(o.icon, 2)}<div class="grow"><b>${esc(o.name)}</b>
        <div class="muted small">${esc(o.detail)}</div><div class="stacks">${r.inputs.map((x) => stackHtml(s, x)).join('')}<span class="stack ${s.coins >= r.coins ? 'ok' : 'short'}">${coin(r.coins)}</span></div></div>
        ${btn(`craft:${r.id}`, 'Make', ok, 'primary')}</div>`);
    }
    if (!list.length) out.push('<p class="muted small">Nothing here yet.</p>');
    const hidden = CRAFT.length - known.length;
    if (hidden > 0) out.push(`<p class="muted small">${hidden} more designs are still under the rubble.</p>`);
    if (ui.craftFilter === 'fixtures' && s.fixtures.length) {
      out.push(`<div class="row wrap gap">${s.fixtures.map((f) => `<span class="chip">${iconHtml(`fix-${f}`, 1, 'inline')}${FIXTURES.find((x) => x.id === f)?.name}</span>`).join('')}</div>`);
    }
    out.push('</section>');
  } else {
    out.push('<section class="card muted small" data-key="hall">The Drafting Hall is still under the rubble. Keep making planks.</section>');
  }
  return out.join('');
}

// --- Missions -------------------------------------------------------------------------------

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
    out.push('<section class="card story" data-key="story"><h3>Hearthrise</h3><p class="quote">“A city, and a fire under it, and the sea being kind. I think we will stay.”</p></section>');
  }

  if (hasFeature(s, 'petitions')) {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    out.push(`<section class="card" data-key="petitions"><div class="row between"><h4>Petitions</h4><span class="muted small">New ones in ${fmtTime((tomorrow.getTime() - now) / 1000)}</span></div>`);
    for (const c of s.petitions.list) {
      const p = progress(s, c.goal, c.base);
      out.push(`<div class="contract ${c.claimed ? 'claimed' : p.done ? 'done' : ''}" data-key="k-${c.id}"><div class="row between"><b>${esc(c.title)}</b><span class="small">${fmtInt(p.have)} / ${fmtInt(p.need)}</span></div>
        <div class="small">${esc(describeGoal(c.goal))}</div>${bar(p.have / p.need)}<div class="row between"><span class="reward small">${rewardHtml(c.reward)}</span>
        ${c.claimed ? '<span class="muted small">Done</span>' : btn(`petition:${c.id}`, 'Grant', p.done, 'small primary')}</div></div>`);
    }
    out.push('</section>');
  }
  const done = STORY.slice(0, storyIndex(s)).slice(-4).reverse();
  if (done.length) {
    out.push(`<section class="card muted small" data-key="log"><h4>Journal</h4>${done.map((x) => `<p>✓ <b>${esc(x.title)}</b> — ${esc(x.text)}</p>`).join('')}</section>`);
  }
  return out.join('');
}

// --- The Tide -------------------------------------------------------------------------------

export function renderTide(s: GameState): string {
  const gain = memoryGain(s);
  const out: string[] = [];
  out.push(`<section class="card tide" data-key="tide"><h3>The Tide</h3>
    <p class="small">Let the sea take the city back, and start again from the beach. You lose coin, stores, upgrades, every building and every ward. You keep your level, stats, skills, regalia, fixtures and designs, the story — and the Memories. The layout is kept as a plan, so you can put the city back where it stood.</p>
    <div class="row between"><span>Furthest this time: <b>${s.maxWard}</b></span><span>Ever: <b>${s.furthestEver}</b></span></div>
    <div class="echo-gain">${iconHtml('icon-memory', 3)}<div><div class="big">+${fmtInt(gain)}</div><div class="muted small">${gain > 0 ? 'Memories if the sea comes in now' : 'Open more than eight wards to earn Memories'}</div></div></div>
    <p class="muted small">You will start again at ward ${startingWard(s)}.</p>
    ${btn('tide', 'Let the sea in', gain > 0, 'danger wide')}</section>`);
  out.push(`<section class="card" data-key="charter"><div class="row between"><h4>The Charter</h4><span>${iconHtml('icon-memory', 1, 'inline')}<b>${fmtInt(s.memories)}</b></span></div>
    <p class="muted small">What the city remembers from one founding to the next.</p>`);
  for (const e of CHARTER) {
    const rank = s.charter[e.id] ?? 0;
    const maxed = rank >= e.max;
    const cost = charterCost(e.id, rank);
    out.push(`<div class="item-row" data-key="e-${e.id}"><div class="grow"><b>${e.name}</b> <span class="muted">${rank}/${e.max}</span><div class="muted small">${e.text}</div></div>
      ${maxed ? '<span class="chip">Max</span>' : btn(`charter:${e.id}`, `${iconHtml('icon-memory', 1, 'inline')}${fmtInt(cost)}`, s.memories >= cost, 'buy')}</div>`);
  }
  out.push('</section>');
  return out.join('');
}

// --- The scene overlays ------------------------------------------------------------------------

export function renderEdicts(s: GameState): string {
  const out: string[] = [];
  for (const k of EDICTS) {
    if (!hasFeature(s, k.id)) continue;
    const cd = s.cooldowns[k.id];
    const pct = cd > 0 ? (cd / k.cooldown) * 100 : 0;
    const active = (k.id === 'survey' && s.buffs.survey > 0) || (k.id === 'festival' && s.buffs.festival > 0);
    out.push(`<button class="skill ${active ? 'active' : ''}" data-act="edict:${k.id}" data-key="sk-${k.id}" title="${esc(`${k.name}: ${k.text} (${k.resolve} resolve)`)}"${edictReady(s, k.id) ? '' : ' disabled'}>
      ${iconHtml(`edict-${k.id}`, 2)}<span class="cd" style="height:${pct.toFixed(0)}%"></span><span class="cost">${k.resolve}</span></button>`);
  }
  // Charges sit on the bar, beside the edicts, where they are wanted in a hurry.
  for (const id of ['charge', 'greatcharge'] as const) {
    if ((s.consumables[id] ?? 0) <= 0) continue;
    out.push(`<button class="skill" data-act="use:${id}" data-key="sk-${id}" title="${id === 'greatcharge' ? 'Great Charge' : 'Blasting Charge'}">${iconHtml(`use-${id}`, 2)}<span class="cost">×${s.consumables[id]}</span></button>`);
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

/** Shown on the map's district chip: which district, and the ward being worked. */
export function renderWardChip(s: GameState, ui: UiState): string {
  const shown = DISTRICTS[ui.district]!;
  const open = openDistricts(s);
  const prev = open.filter((i) => i < ui.district).pop();
  const next = open.find((i) => i > ui.district);
  return `<button class="chip-btn" data-act="view:${prev ?? ui.district}"${prev === undefined ? ' disabled' : ''} aria-label="Previous district">◀</button>
    <button class="depth-label" data-act="jump" title="Go to another ward"><b>${s.ward}</b><span class="tiny">${esc(districtText(s, shown).name)} ▾</span></button>
    <button class="chip-btn" data-act="view:${next ?? ui.district}"${next === undefined ? ' disabled' : ''} aria-label="Next district">▶</button>
    <button class="chip-btn mode ${s.autoAdvance ? 'on' : ''}" data-act="advance" title="${s.autoAdvance ? 'Pushing on' : 'Salvaging here'}">${s.autoAdvance ? '⇢' : '⏸'}</button>`;
}
