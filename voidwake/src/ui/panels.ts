import { BIOME, FAUNA_DEF } from '../data/biomes';
import { CLASS, ORIGINS, STATS, TRAIT } from '../data/crew';
import { ENEMY } from '../data/enemies';
import { FACTION, FACTIONS } from '../data/factions';
import { GEAR_DEF, RARITIES } from '../data/gear';
import { LORE_BY_ID } from '../data/lore';
import { CONSUMABLE, CONSUMABLES, MAT, MATERIALS } from '../data/materials';
import { MODULES } from '../data/modules';
import { BAL } from '../data/progression';
import { QUEST } from '../data/quests';
import { NODE_KIND, SECTORS } from '../data/sectors';
import { skillsFor } from '../data/skills';
import { STORY } from '../data/story';
import type { GearSlot, ModKey, Mods, SubsysId } from '../data/types';
import { canLand, LAND_ENERGY } from '../game/away/mission';
import { abilityReady, canJumpAway, JUMP_TURNS, SUBSYSTEMS } from '../game/combat';
import { canCraft, canUpgrade, nextTier, visibleRecipes } from '../game/crafting';
import { canLearn, equippedBy, xpToNext } from '../game/crew';
import { conscious, derive, effStat, gearMods, maxHp } from '../game/derive';
import { canDistress, canMine, canPatch } from '../game/engine';
import { canJump, hops, landingsLeft, node } from '../game/galaxy';
import {
  activeQuests,
  buyPrice,
  canHeal,
  ENERGY_VALUE,
  FOOD_VALUE,
  FUEL_VALUE,
  gearValue,
  healPrice,
  hirePrice,
  questsHere,
  repairPrice,
  sellPrice,
} from '../game/station';
import { arkSections, canDeliver, canTakeGate, currentMission, missionNode } from '../game/story';
import { iconHtml } from '../sprites/atlas';
import type { Crew, GameState, GearInst, MapNode } from '../state/types';
import { esc } from './dom';
import { crewFace, portraitUrl } from './portrait';
import { barHtml, bundleHtml, itemIcon, matIcon, n1, pct, signed } from './text';

export type Tab = 'map' | 'ship' | 'crew' | 'cargo' | 'log';

export interface UiState {
  tab: Tab;
  selected: number | null;
  stationTab: 'trade' | 'supplies' | 'crew' | 'jobs' | 'gear';
  crewSel: number | null;
  cargoTab: 'mats' | 'items' | 'gear' | 'fab';
  logTab: 'mission' | 'log' | 'lore' | 'codex';
  draft: { name: string; origin: string; portrait: number[] };
}

const btn = (act: string, label: string, o: { cls?: string; disabled?: boolean; arg?: string | number; title?: string } = {}): string =>
  `<button class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg !== undefined ? ` data-arg="${esc(String(o.arg))}"` : ''}${o.disabled ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${label}</button>`;

const seg = <T extends string>(act: string, current: T, options: [T, string][]): string =>
  `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" data-act="${act}" data-arg="${v}" aria-selected="${v === current}">${l}</button>`).join('')}</div>`;

// ---------------------------------------------------------------- HUD and tabs

export function hudHtml(s: GameState): string {
  const d = derive(s);
  const chip = (icon: string, text: string, low: boolean, title: string): string =>
    `<span class="chip${low ? ' low' : ''}" title="${esc(title)}">${iconHtml(icon, 2)}${text}</span>`;
  const daysFood = d.eat > d.grow ? Math.floor(s.res.food / (d.eat - d.grow)) : Infinity;
  return `<div class="chips">
    ${chip('res-fuel', `${n1(s.res.fuel)}<span class="muted">/${d.maxFuel}</span>`, s.res.fuel < d.fuelPerJump * 2, `Fuel: ${n1(d.fuelPerJump)} per jump`)}
    ${chip('res-food', `${Math.floor(s.res.food)}${Number.isFinite(daysFood) ? `<span class="muted"> ${daysFood}d</span>` : ''}`, s.res.food < d.eat * 2, `Food: ${n1(d.eat)} eaten, ${n1(d.grow)} grown a day`)}
    ${chip('res-energy', `${Math.floor(s.res.energy)}`, s.res.energy < d.upkeep, `Energy: +${d.reactor} reactor, −${d.upkeep} upkeep a day`)}
    ${chip('res-hull', `${Math.ceil(s.res.hull)}<span class="muted">/${d.maxHull}</span>`, s.res.hull < d.maxHull * 0.3, 'Hull')}
    ${chip('res-credits', `${Math.floor(s.res.credits)}`, false, 'Credits')}
    ${chip('icon-colonist', `${s.colonists}`, false, 'Colonists rescued')}
    ${chip('icon-day', `${s.day}`, false, 'Day')}
  </div>
  <button class="icon-btn" data-act="settings" aria-label="Settings">⚙</button>`;
}

export function tabsHtml(s: GameState, ui: UiState): string {
  const pts = s.crew.some((c) => c.skillPts > 0 && skillsFor(c.cls).some((k) => canLearn(c, k.id))) || s.crew.some((c) => c.statPts > 0);
  const tabs: [Tab, string, string][] = [
    ['map', 'Map', 'node-system'],
    ['ship', 'Ship', 'res-hull'],
    ['crew', 'Crew', 'icon-colonist'],
    ['cargo', 'Cargo', 'ent-cache'],
    ['log', 'Log', 'ent-terminal'],
  ];
  return tabs
    .map(([id, label, icon]) => `<button role="tab" data-act="tab" data-arg="${id}" aria-selected="${ui.tab === id}">${iconHtml(icon, 2)}${label}${id === 'crew' && pts ? '<span class="dot"></span>' : ''}</button>`)
    .join('');
}

// ---------------------------------------------------------------- Map tab

function missionCard(s: GameState): string {
  const m = currentMission(s);
  if (!m) return '';
  const target = missionNode(s);
  const dist = target ? hops(s, s.at)[target.id] : null;
  const where = target ? (dist === 0 ? '<span class="gold">You are here.</span>' : `${dist} jump${dist === 1 ? '' : 's'} away · marked in gold`) : m.objective.k === 'rescue' ? `${s.colonists}/${m.objective.colonists} colonists` : '';
  return `<div class="card story"><div class="head">${iconHtml('ent-objective', 2)}<h3>${esc(m.title)}</h3></div>
    <div>${esc(m.brief)}</div><div class="small muted">${where}</div></div>`;
}

function planetsHtml(s: GameState, n: MapNode): string {
  const m = currentMission(s);
  return `<h3>Planets</h3><div class="list">${n.planets
    .map((p, i) => {
      const b = BIOME.get(p.biome)!;
      const objective = p.objective && m?.id === p.objective;
      const left = landingsLeft(p);
      const info = p.scanned
        ? `${p.pods ? `<span class="good">${p.pods} sleeper${p.pods === 1 ? '' : 's'}</span> · ` : ''}${p.ruin ? 'ruins · ' : ''}${b.hazard === 'none' ? 'no hazard' : `hazard: ${b.hazard}`}`
        : '<span class="muted">Not scanned</span>';
      const landing = s.crew.find((c) => conscious(c));
      const why = landing ? canLand(s, i, landing.id) : 'Nobody fit to go';
      return `<div class="item">${iconHtml(`planet-${p.biome}`, 3)}<div class="grow"><div class="name">${esc(p.name)} ${objective ? '<span class="tag gold">objective</span>' : ''}</div>
        <div class="sub">${esc(b.name)} · ${info}</div><div class="sub">${objective ? 'Lands any number of times' : `${left} landing${left === 1 ? '' : 's'} left`}</div></div>
        <div class="stack">${p.scanned ? '' : btn('scan', 'Scan', { cls: 'small', arg: i, disabled: s.res.energy < 1, title: '1 energy' })}
        ${btn('land', `Land`, { cls: 'small primary', arg: i, disabled: !!why, title: why ?? `${LAND_ENERGY} energy` })}</div></div>`;
    })
    .join('')}</div>`;
}

function stationHtml(s: GameState, n: MapNode, ui: UiState): string {
  const st = n.station!;
  const d = derive(s);
  const fac = st.faction === 'none' ? 'Independent' : FACTION.get(st.faction)!.name;
  let body = '';
  if (ui.stationTab === 'trade') {
    body = `<div class="list">${MATERIALS.map((m) => {
      const buy = buyPrice(s, n, m.value);
      const sell = sellPrice(s, n, m.value);
      const stock = st.stock[m.id] ?? 0;
      return `<div class="item">${matIcon(m.id, 2)}<div class="grow"><div class="name">${m.name}</div><div class="sub">Have ${s.mats[m.id]} · stock ${stock}</div></div>
        ${btn('buy-mat', `Buy ${buy}`, { cls: 'small', arg: m.id, disabled: stock <= 0 || s.res.credits < buy })}
        ${btn('sell-mat', `Sell ${sell}`, { cls: 'small', arg: m.id, disabled: s.mats[m.id] <= 0 })}</div>`;
    }).join('')}</div>`;
  } else if (ui.stationTab === 'supplies') {
    const sup = (what: 'fuel' | 'food' | 'energy', value: number, cap: number): string => {
      const p = buyPrice(s, n, value);
      const room = Math.floor(cap - s.res[what] + 1e-9);
      return `<div class="item">${iconHtml(`res-${what}`, 2)}<div class="grow"><div class="name">${what[0]!.toUpperCase() + what.slice(1)}</div><div class="sub">${Math.floor(s.res[what])}/${cap} · ${p} each</div></div>
        ${btn('buy-sup', '+1', { cls: 'small', arg: `${what}:1`, disabled: room < 1 || s.res.credits < p })}
        ${btn('buy-sup', '+5', { cls: 'small', arg: `${what}:5`, disabled: room < 1 || s.res.credits < p })}
        ${what !== 'energy' ? btn('sell-sup', `Sell ${sellPrice(s, n, value)}`, { cls: 'small', arg: what, disabled: s.res[what] < 1 }) : ''}</div>`;
    };
    const missing = Math.ceil(d.maxHull - s.res.hull);
    body = `<div class="list">${sup('fuel', FUEL_VALUE, d.maxFuel)}${sup('food', FOOD_VALUE, d.maxFood)}${sup('energy', ENERGY_VALUE, d.maxEnergy)}
      <div class="item">${iconHtml('res-hull', 2)}<div class="grow"><div class="name">Repairs</div><div class="sub">${missing} hull missing · ${repairPrice(s, n)} each</div></div>${btn('repair', 'Repair', { cls: 'small', disabled: missing <= 0 || s.res.credits < repairPrice(s, n) })}</div>
      <div class="item">${iconHtml('item-medkit', 2)}<div class="grow"><div class="name">Infirmary</div><div class="sub">Heal everyone · ${healPrice(s)} credits</div></div>${btn('heal', 'Heal', { cls: 'small', disabled: !canHeal(s) })}</div>
      ${CONSUMABLES.filter((c) => (st.items[c.id] ?? 0) > 0 || s.items[c.id] > 0)
        .map((c) => {
          const p = buyPrice(s, n, c.value);
          return `<div class="item">${itemIcon(c.id)}<div class="grow"><div class="name">${c.name}</div><div class="sub">${esc(c.desc)} · have ${s.items[c.id]}</div></div>
          ${btn('buy-item', `Buy ${p}`, { cls: 'small', arg: c.id, disabled: (st.items[c.id] ?? 0) <= 0 || s.res.credits < p })}
          ${btn('sell-item', `Sell ${sellPrice(s, n, c.value)}`, { cls: 'small', arg: c.id, disabled: s.items[c.id] <= 0 })}</div>`;
        })
        .join('')}</div>`;
  } else if (ui.stationTab === 'crew') {
    const full = s.crew.length >= d.crewCap;
    body = `<p class="small muted">Berths: ${s.crew.length}/${d.crewCap}${full ? ' — upgrade the Crew Cabins to take on more.' : ''}</p><div class="list">${st.recruits
      .map((c) => `<div class="item">${crewFace(c)}<div class="grow"><div class="name">${esc(c.name)}</div><div class="sub">Level ${c.level} ${CLASS.get(c.cls)!.name} · ${c.traits.map((t) => TRAIT.get(t)!.name).join(', ')}</div>
        <div class="sub">${STATS.map((x) => `${x.name.slice(0, 3)} ${c.stats[x.id]}`).join(' · ')}</div></div>${btn('hire', `Hire ${hirePrice(c)}`, { cls: 'small primary', arg: c.id, disabled: full || s.res.credits < hirePrice(c) })}</div>`)
      .join('') || '<p class="muted">Nobody looking for work.</p>'}</div>`;
  } else if (ui.stationTab === 'jobs') {
    const q = st.quest;
    const here = questsHere(s);
    body = `${here.map((x) => `<div class="card"><div class="name">${esc(QUEST.get(x.tpl)!.title)}</div>${btn('turnin', `Hand in · +${x.reward.credits} credits`, { cls: 'primary block', arg: x.uid })}</div>`).join('')}
      ${q ? `<div class="card"><h3>${esc(QUEST.get(q.tpl)!.title)}</h3><p>${esc(QUEST.get(q.tpl)!.text)}</p>${q.need ? `<p class="small">Wants: ${bundleHtml(q.need, s.mats)}</p>` : ''}${q.target !== n.id ? `<p class="small">Target: ${esc(s.sector.nodes[q.target]!.name)} (${hops(s, s.at)[q.target]} jumps)</p>` : ''}<p class="small">Pays ${q.reward.credits} credits and ${q.reward.xp} XP.</p>${btn('accept-quest', 'Take the job', { cls: 'primary block' })}</div>` : here.length ? '' : '<p class="muted">No work posted. Check back later.</p>'}`;
  } else {
    body = `<div class="list">${st.gear.map((g) => gearRow(s, g, btn('buy-gear', `Buy ${buyPrice(s, n, gearValue(g.base, g.rarity))}`, { cls: 'small primary', arg: g.uid, disabled: s.res.credits < buyPrice(s, n, gearValue(g.base, g.rarity)) }))).join('') || '<p class="muted">Nothing for sale.</p>'}</div>
      <h3 style="margin-top:12px">Sell</h3><div class="list">${s.gear.filter((g) => !equippedBy(s, g.uid)).map((g) => gearRow(s, g, btn('sell-gear', `Sell ${sellPrice(s, n, gearValue(g.base, g.rarity))}`, { cls: 'small', arg: g.uid }))).join('') || '<p class="muted small">Nothing spare to sell — unequip it first.</p>'}</div>`;
  }
  return `<div class="card"><div class="head">${iconHtml('node-station', 3)}<div><h2>${esc(st.name)}</h2><div class="small muted">${fac} · docked · progress saved here</div></div></div>
    ${seg('st-tab', ui.stationTab, [['trade', 'Trade'], ['supplies', 'Supplies'], ['crew', 'Hire'], ['jobs', 'Jobs'], ['gear', 'Gear']])}${body}</div>`;
}

export function mapPanel(s: GameState, ui: UiState): string {
  const here = node(s);
  const d = derive(s);
  const sel = ui.selected !== null && ui.selected !== s.at ? s.sector.nodes[ui.selected]! : null;
  const sec = SECTORS[s.sector.index]!;
  const out: string[] = [];
  if (sel) {
    const linked = here.links.includes(sel.id);
    const known = sel.revealed || sel.visited;
    const kind = known ? NODE_KIND.get(sel.kind)! : { name: 'Unknown', desc: 'Out of sensor range.' };
    out.push(`<div class="card"><div class="head">${known ? iconHtml(`node-${sel.kind}`, 3) : ''}<div><h2>${esc(sel.name)}</h2><div class="small muted">${kind.name} — ${kind.desc}</div></div></div>
      ${linked ? btn('jump', `Jump · ${n1(d.fuelPerJump)} fuel, 1 day`, { cls: 'primary block', arg: sel.id, disabled: !canJump(s, sel.id) }) : `<div class="small muted">${hops(s, s.at)[sel.id]} jumps away — not linked from here.</div>`}
      ${btn('deselect', 'Back to where you are', { cls: 'small block' })}</div>`);
  }
  out.push(missionCard(s));
  const kind = NODE_KIND.get(here.kind)!;
  out.push(`<div class="card"><div class="head">${iconHtml(`node-${here.kind}`, 3)}<div><h2>${esc(here.name)}</h2><div class="small muted">${kind.name} · ${esc(sec.name)}</div></div></div>
    <div class="row">${canDeliver(s) ? btn('deliver', 'Hand over the goods', { cls: 'gold' }) : ''}${canTakeGate(s) ? btn('gate', s.sector.index === 5 ? 'Go home' : 'Jump the gate', { cls: 'gold' }) : ''}
    ${here.kind === 'system' || here.kind === 'asteroids' ? btn('mine', 'Mine the belt', { cls: 'small', disabled: !canMine(s), title: '3 energy, once a visit' }) : ''}
    ${btn('rest', 'Wait a day', { cls: 'small', title: 'Heal and grow food; costs a day' })}
    ${canPatch(s) ? btn('patch', 'Patch hull (1 alloy)', { cls: 'small' }) : ''}
    ${canDistress(s) ? btn('distress', 'Send distress call', { cls: 'small danger' }) : ''}</div>
    <p class="small muted" style="margin:8px 0 0">Tap a linked star on the map to plot a jump.</p></div>`);
  if (here.kind === 'system' && here.planets.length) out.push(`<div class="card">${planetsHtml(s, here)}</div>`);
  if (here.kind === 'station' && here.station) out.push(stationHtml(s, here, ui));
  const m = currentMission(s);
  if (m?.objective.k === 'deliver' && missionNode(s)) out.push(`<div class="card"><h3>Delivery</h3><p class="small">${bundleHtml(m.objective.mats, s.mats)}</p></div>`);
  return out.join('');
}

// ---------------------------------------------------------------- Ship tab

function modsText(m: Mods): string {
  const names: Partial<Record<ModKey, string>> = {
    awayDmg: 'damage', fireRate: 'fire rate', range: 'range', o2: 'air', suitShield: 'shielding', hp: 'health', speed: 'speed', gather: 'gathering', carry: 'carry',
    skillCd: 'skill recharge', wits: 'Wits', charm: 'Charm', grit: 'Grit', reflex: 'Reflex', trade: 'prices',
  };
  const pctKeys = new Set(['awayDmg', 'fireRate', 'speed', 'gather', 'skillCd', 'trade']);
  return (Object.entries(m) as [ModKey, number][])
    .filter(([, v]) => Math.abs(v) > 0.001)
    .map(([k, v]) => (pctKeys.has(k) ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${names[k] ?? k}` : `${v > 0 ? '+' : ''}${n1(v)} ${names[k] ?? k}`))
    .join(', ');
}

export function shipPanel(s: GameState): string {
  const d = derive(s);
  const food = d.grow - d.eat;
  const energy = d.reactor - d.upkeep;
  const quests = activeQuests(s);
  return `<div class="card"><div class="head">${iconHtml('ship-wren', 2)}<div><h2>The Wren</h2><div class="small muted">Survey scout, much modified</div></div></div>
    <div class="grid2 small">
      <div>Hull <b>${Math.ceil(s.res.hull)}/${d.maxHull}</b></div><div>Shields <b>${d.shieldMax}</b> (+${d.regen}/turn)</div>
      <div>Evasion <b>${pct(d.evasion)}</b></div><div>Accuracy <b>+${pct(d.accuracy)}</b></div>
      <div>Fuel per jump <b>${n1(d.fuelPerJump)}</b></div><div>Sensors <b>${d.sensor}</b> jump${d.sensor === 1 ? '' : 's'}</div>
      <div>Food a day <b class="${food < 0 ? 'bad' : 'good'}">${signed(food)}</b></div><div>Energy a day <b class="${energy < 0 ? 'bad' : 'good'}">${signed(energy)}</b></div>
      <div>Weapons <b>${d.weapons.map((w) => `${w.kind} ${n1(w.dmg)}`).join(', ')}</b></div><div>Berths <b>${s.crew.length}/${d.crewCap}</b></div>
    </div></div>
    <div class="card"><h3>Modules</h3><p class="small muted">Upgrades are fitted anywhere, from your own materials, plus credits for parts.</p><div class="list">${MODULES.map((m) => {
      const t = s.modules[m.id];
      const next = nextTier(s, m.id);
      const cur = t ? m.tiers[t - 1]! : null;
      return `<div class="item"><div class="grow"><div class="name">${m.name} <span class="tag">${cur ? cur.name : 'not fitted'}</span></div>
        <div class="sub">${cur ? esc(cur.desc) : esc(m.desc)}${m.upkeep && t ? ` · −${m.upkeep} energy/day` : ''}</div>
        ${next ? `<div class="sub">Next: ${esc(next.desc)} — ${bundleHtml(next.cost, s.mats)}${next.credits ? ` · <span class="${s.res.credits < next.credits ? 'bad' : ''}">${next.credits} credits</span>` : ''}</div>` : '<div class="sub gold">Fully upgraded</div>'}</div>
        ${next ? btn('upgrade', t ? 'Upgrade' : 'Fit', { cls: 'small primary', arg: m.id, disabled: !canUpgrade(s, m.id) }) : ''}</div>`;
    }).join('')}</div></div>
    <div class="card"><h3>Standing</h3>${FACTIONS.map((f) => `<div class="row spread small"><span style="color:${f.color}">${f.name}</span><span>${s.rep[f.id] > 0 ? '+' : ''}${s.rep[f.id]}</span></div>${barHtml((s.rep[f.id] + 100) / 200)}`).join('')}</div>
    <div class="card"><h3>Jobs</h3>${quests.length ? quests.map((q) => `<div class="item"><div class="grow"><div class="name">${esc(QUEST.get(q.tpl)!.title)}</div><div class="sub">${q.need ? `Bring ${bundleHtml(q.need, s.mats)} to ${esc(s.sector.nodes[q.from]!.station?.name ?? '')}` : `Go to ${esc(s.sector.nodes[q.target]!.name)} (${hops(s, s.at)[q.target]} jumps)`} · ${q.reward.credits} credits</div></div></div>`).join('') : '<p class="muted small">No jobs taken. Stations post work.</p>'}</div>`;
}

// ---------------------------------------------------------------- Crew tab

function gearRow(s: GameState, g: GearInst, action = ''): string {
  const def = GEAR_DEF.get(g.base)!;
  const rar = RARITIES[g.rarity]!;
  const who = equippedBy(s, g.uid);
  return `<div class="item">${iconHtml(`gear-${def.slot}`, 2)}<div class="grow"><div class="name" style="color:${rar.color}">${esc(def.name)}</div>
    <div class="sub">${rar.name} ${def.slot} · ${modsText(gearMods(g)) || 'standard issue'}${who ? ` · <span class="gold">${esc(who.name.split(' ')[0]!)}</span>` : ''}</div></div>${action}</div>`;
}

function crewDetail(s: GameState, c: Crew): string {
  const cls = CLASS.get(c.cls)!;
  const slots: GearSlot[] = ['weapon', 'suit', 'tool', 'module'];
  return `<div class="card"><div class="head">${crewFace(c, true)}<div class="grow"><h2>${esc(c.name)}</h2><div class="small">${c.captain ? '<span class="tag gold">Captain</span> ' : ''}Level ${c.level} ${cls.name}</div>
      <div class="small muted">${esc(cls.desc)}</div></div></div>
    <div class="small">Health ${Math.ceil(c.hp)}/${maxHp(c)}</div>${barHtml(c.hp / maxHp(c), 'hp')}
    <div class="small">Morale ${c.morale}</div>${barHtml(c.morale / 100, 'shield')}
    <div class="small">XP ${c.level >= BAL.maxLevel ? 'max' : `${c.xp}/${xpToNext(c)}`}</div>${barHtml(c.level >= BAL.maxLevel ? 1 : c.xp / xpToNext(c), 'xp')}
    <h3 style="margin-top:10px">Stats ${c.statPts ? `<span class="tag gold">${c.statPts} to spend</span>` : ''}</h3>
    <div class="list">${STATS.map((st) => `<div class="item"><div class="grow"><div class="name">${st.name} ${c.stats[st.id]} <span class="muted small">(checks: ${effStat(s, c, st.id)})</span></div><div class="sub">${st.desc}</div></div>${c.statPts ? btn('stat', '+', { cls: 'small primary', arg: `${c.id}:${st.id}` }) : ''}</div>`).join('')}</div>
    <h3 style="margin-top:10px">Traits</h3><div class="row">${c.traits.map((t) => `<span class="tag ${TRAIT.get(t)!.good ? 'good' : 'bad'}" title="${esc(TRAIT.get(t)!.desc)}">${TRAIT.get(t)!.name}: ${esc(TRAIT.get(t)!.desc)}</span>`).join('')}</div>
    <h3 style="margin-top:10px">Abilities</h3><div class="small"><b>${cls.combat.name}</b> (ship): ${esc(cls.combat.desc)}<br><b>${cls.away.name}</b> (landings): ${esc(cls.away.desc)}</div>
    <h3 style="margin-top:10px">Gear</h3><div class="list">${slots.map((slot) => {
      const g = s.gear.find((x) => x.uid === c.gear[slot]);
      return g ? gearRow(s, g, btn('equip-pick', 'Change', { cls: 'small', arg: `${c.id}:${slot}` })) : `<div class="item">${iconHtml(`gear-${slot}`, 2)}<div class="grow muted">No ${slot}</div>${btn('equip-pick', 'Equip', { cls: 'small', arg: `${c.id}:${slot}` })}</div>`;
    }).join('')}</div>
    <h3 style="margin-top:10px">Skills ${c.skillPts ? `<span class="tag gold">${c.skillPts} point${c.skillPts === 1 ? '' : 's'}</span>` : ''}</h3>
    <div class="list">${skillsFor(c.cls).map((k) => {
      const has = c.skills.includes(k.id);
      const can = canLearn(c, k.id);
      return `<div class="item"${has ? ' style="border:1px solid #8a6a20"' : ''}><div class="grow"><div class="name">${esc(k.name)} ${has ? '<span class="tag gold">learned</span>' : `<span class="tag">level ${k.level}</span>`}</div><div class="sub">${esc(k.desc)}</div></div>${!has ? btn('learn', 'Learn', { cls: 'small primary', arg: `${c.id}:${k.id}`, disabled: !can }) : ''}</div>`;
    }).join('')}</div>
    ${c.captain ? '' : `<div style="margin-top:12px">${btn('dismiss', 'Leave them at the next port', { cls: 'small danger', arg: c.id })}</div>`}</div>`;
}

export function crewPanel(s: GameState, ui: UiState): string {
  const sel = s.crew.find((c) => c.id === ui.crewSel) ?? null;
  const list = s.crew
    .map(
      (c) => `<button class="item" style="width:100%;border:1px solid ${c.id === sel?.id ? 'var(--accent)' : 'transparent'};text-align:left;cursor:pointer" data-act="crew-sel" data-arg="${c.id}">${crewFace(c)}
      <div class="grow"><div class="name">${esc(c.name)} ${c.skillPts || c.statPts ? '<span class="tag gold">points</span>' : ''} ${!conscious(c) ? '<span class="tag bad">down</span>' : ''}</div>
      <div class="sub">Lv ${c.level} ${CLASS.get(c.cls)!.name} · morale ${c.morale}</div>${barHtml(c.hp / maxHp(c), 'hp')}</div></button>`,
    )
    .join('');
  return `<div class="card"><h3>Crew · ${s.crew.length}/${derive(s).crewCap}</h3><div class="list">${list}</div></div>${sel ? crewDetail(s, sel) : '<p class="muted small">Tap a crew member for their stats, gear and skills.</p>'}`;
}

export function equipPicker(s: GameState, crewId: number, slot: GearSlot): string {
  const c = s.crew.find((x) => x.id === crewId)!;
  const options = s.gear.filter((g) => GEAR_DEF.get(g.base)!.slot === slot);
  return `<h2>${esc(c.name.split(' ')[0]!)}'s ${slot}</h2><div class="list">${options.map((g) => gearRow(s, g, c.gear[slot] === g.uid ? '<span class="tag gold">worn</span>' : btn('equip', 'Equip', { cls: 'small primary', arg: `${c.id}:${g.uid}` }))).join('') || '<p class="muted">Nothing for this slot. Make some at the fabricator, or buy it at a station.</p>'}</div>
    <div class="row" style="margin-top:12px">${c.gear[slot] !== undefined ? btn('unequip', 'Take off', { cls: 'small', arg: `${c.id}:${slot}` }) : ''}${btn('close-modal', 'Done', { cls: 'primary' })}</div>`;
}

export function explorerPicker(s: GameState, planet: number): string {
  const p = node(s).planets[planet]!;
  const b = BIOME.get(p.biome)!;
  return `<h2>Landing on ${esc(p.name)}</h2><div class="row">${iconHtml(`planet-${p.biome}-big`, 2)}<div class="small"><b>${esc(b.name)}</b><br>${esc(b.desc)}<br>${b.hazard !== 'none' ? `Hazard: <span class="warn">${b.hazard}</span> drains suit shielding.` : 'No hazard.'}<br>Fauna: ${b.fauna.map((f) => FAUNA_DEF.get(f)!.name).join(', ')}</div></div>
    <p class="small muted">Who goes down? Their gear, health and class ability come with them. Watch your air and get back to the lander.</p>
    <div class="list">${s.crew.map((c) => {
      const why = canLand(s, planet, c.id);
      return `<div class="item">${crewFace(c)}<div class="grow"><div class="name">${esc(c.name)}</div><div class="sub">${CLASS.get(c.cls)!.name} · ${CLASS.get(c.cls)!.away.name} · ${Math.ceil(c.hp)}/${maxHp(c)} hp</div></div>${btn('land-go', 'Go', { cls: 'small primary', arg: `${planet}:${c.id}`, disabled: !!why, title: why ?? '' })}</div>`;
    }).join('')}</div><div style="margin-top:12px">${btn('close-modal', 'Cancel', { cls: 'block' })}</div>`;
}

// ---------------------------------------------------------------- Cargo tab

export function cargoPanel(s: GameState, ui: UiState): string {
  const d = derive(s);
  let body = '';
  if (ui.cargoTab === 'mats') {
    body = `<div class="list">${MATERIALS.map((m) => `<div class="item">${matIcon(m.id)}<div class="grow"><div class="name">${m.name} <b>${s.mats[m.id]}</b></div><div class="sub">${esc(m.desc)}</div></div></div>`).join('')}</div>`;
  } else if (ui.cargoTab === 'items') {
    body = `<div class="list">${CONSUMABLES.map((c) => {
      const usable = c.use.includes('ship');
      return `<div class="item">${itemIcon(c.id)}<div class="grow"><div class="name">${c.name} <b>${s.items[c.id]}</b></div><div class="sub">${esc(c.desc)}${usable ? '' : ` · used ${c.use.join(' / ')}`}</div></div>${usable ? btn('use-item', 'Use', { cls: 'small', arg: c.id, disabled: s.items[c.id] <= 0 }) : ''}</div>`;
    }).join('')}</div>`;
  } else if (ui.cargoTab === 'gear') {
    body = `<div class="list">${[...s.gear].sort((a, b) => (GEAR_DEF.get(a.base)!.slot < GEAR_DEF.get(b.base)!.slot ? -1 : 1)).map((g) => gearRow(s, g, equippedBy(s, g.uid) ? '' : btn('scrap', 'Scrap', { cls: 'small', arg: g.uid }))).join('') || '<p class="muted">No gear.</p>'}</div>`;
  } else {
    const recipes = visibleRecipes(s);
    const groups: [string, (r: (typeof recipes)[number]) => boolean][] = [
      ['Refining', (r) => 'mat' in r.out],
      ['Supplies', (r) => 'item' in r.out],
      ['Gear', (r) => 'gear' in r.out],
    ];
    body = `<p class="small muted">Fabricator Mk ${d.fab}. Better recipes need a better fabricator.</p>${groups
      .map(([title, f]) => `<h3>${title}</h3><div class="list" style="margin-bottom:10px">${recipes.filter(f).map((r) => {
        const out = r.out;
        const icon = 'mat' in out ? matIcon(out.mat) : 'item' in out ? itemIcon(out.item) : iconHtml(`gear-${GEAR_DEF.get(out.gear)!.slot}`, 2);
        const desc = 'gear' in out ? modsText(GEAR_DEF.get(out.gear)!.mods) || esc(GEAR_DEF.get(out.gear)!.desc) : 'item' in out ? esc(CONSUMABLE.get(out.item)!.desc) : `+${out.n} ${MAT.get(out.mat)!.name}`;
        const locked = r.fab > d.fab;
        return `<div class="item">${icon}<div class="grow"><div class="name">${esc(r.name)} ${locked ? `<span class="tag">Mk ${r.fab}</span>` : ''}</div><div class="sub">${desc}</div><div class="sub">${bundleHtml(r.cost, s.mats)}</div></div>${btn('craft', 'Make', { cls: 'small primary', arg: r.id, disabled: !canCraft(s, r.id) })}</div>`;
      }).join('')}</div>`)
      .join('')}`;
  }
  return `${seg('cargo-tab', ui.cargoTab, [['mats', 'Materials'], ['items', 'Supplies'], ['gear', 'Gear'], ['fab', 'Fabricator']])}${body}`;
}

// ---------------------------------------------------------------- Log tab

export function logPanel(s: GameState, ui: UiState): string {
  let body = '';
  if (ui.logTab === 'mission') {
    const m = currentMission(s);
    body = `<div class="card"><h3>The Wake</h3><div class="grid2 small"><div>Ark sections <b>${arkSections(s)}/6</b></div><div>Colonists <b>${s.colonists}</b></div><div>Sector <b>${s.sector.index + 1}/6</b></div><div>Day <b>${s.day}</b></div></div></div>
      ${missionCard(s)}
      <div class="card"><h3>Done</h3><div class="list">${STORY.filter((x) => s.story.done.includes(x.id)).reverse().map((x) => `<div class="item"><div class="grow"><div class="name">${esc(x.title)}</div><div class="sub">${esc(x.text)}</div></div></div>`).join('') || '<p class="muted small">Nothing yet.</p>'}</div></div>
      ${m ? '' : '<p class="gold">The Wake has come home.</p>'}`;
  } else if (ui.logTab === 'log') {
    body = `<div class="list">${[...s.log].reverse().slice(0, 80).map((e) => `<div class="item small"><span class="tag">Day ${e.day}</span><div class="grow ${e.kind === 'warn' ? 'warn' : e.kind === 'story' ? 'gold' : ''}">${esc(e.text)}</div></div>`).join('')}</div>`;
  } else if (ui.logTab === 'lore') {
    body = `<p class="small muted">${s.lore.length}/30 logs recovered from terminals on the surface.</p><div class="list">${s.lore.map((id) => LORE_BY_ID.get(id)!).map((l) => `<div class="card"><h3>${esc(l.title)}</h3><div class="small">${esc(l.text)}</div></div>`).join('') || '<p class="muted">Find terminals in ruins when you land.</p>'}</div>`;
  } else {
    body = `<h3>Worlds</h3><div class="list">${s.codex.biomes.map((b) => BIOME.get(b)!).map((b) => `<div class="item">${iconHtml(`planet-${b.id}`, 2)}<div class="grow"><div class="name">${b.name}</div><div class="sub">${esc(b.desc)}</div></div></div>`).join('') || '<p class="muted small">Land somewhere.</p>'}</div>
      <h3 style="margin-top:10px">Fauna</h3><div class="list">${s.codex.fauna.map((f) => FAUNA_DEF.get(f)!).map((f) => `<div class="item">${iconHtml(`fauna-${f.id}-0`, 2)}<div class="grow"><div class="name">${f.name}</div><div class="sub">${esc(f.desc)} · ${f.ranged ? 'spits' : 'bites'}</div></div></div>`).join('') || '<p class="muted small">None met yet.</p>'}</div>
      <h3 style="margin-top:10px">Ships</h3><div class="list">${s.codex.enemies.map((e) => ENEMY.get(e)!).map((e) => `<div class="item">${iconHtml(e.sprite, 1)}<div class="grow"><div class="name">${e.name}</div><div class="sub">${esc(e.desc)}</div></div></div>`).join('') || '<p class="muted small">None fought yet.</p>'}</div>
      <h3 style="margin-top:10px">Factions</h3>${FACTIONS.map((f) => `<div class="card"><h3 style="color:${f.color}">${f.name}</h3><div class="small">${esc(f.desc)}</div></div>`).join('')}`;
  }
  return `${seg('log-tab', ui.logTab, [['mission', 'Mission'], ['log', 'Log'], ['lore', 'Logs found'], ['codex', 'Codex']])}${body}`;
}

// ---------------------------------------------------------------- Combat

export function combatOverlay(s: GameState): string {
  const c = s.combat!;
  const d = derive(s);
  return `<div class="combat-bars top"><div class="row spread"><span>${esc(c.enemy.name)}</span><span>${Math.ceil(Math.max(0, c.enemy.hull))}/${c.enemy.maxHull}</span></div>${barHtml(c.enemy.hull / c.enemy.maxHull, 'hp')}${c.enemy.maxShield ? barHtml(c.enemy.shield / c.enemy.maxShield, 'shield') : ''}</div>
    <div class="combat-bars bottom">${d.shieldMax ? barHtml(c.player.shield / c.player.maxShield, 'shield') : ''}${barHtml(s.res.hull / d.maxHull, 'hp')}<div class="row spread"><span>The Wren</span><span>${Math.ceil(s.res.hull)}/${d.maxHull}</span></div></div>`;
}

function subsRow(f: { subs: Record<SubsysId, { hp: number; max: number }> }, target: SubsysId | null, act: string | null): string {
  return `<div class="subs">${SUBSYSTEMS.map((x) => {
    const sub = f.subs[x.id];
    const pips = Array.from({ length: sub.max }, (_, i) => `<i class="${i < sub.hp ? '' : 'off'}"></i>`).join('');
    const inner = `${iconHtml(`sub-${x.id}`, 2)}<span>${x.name.split(' ')[0]}</span><span class="pips">${pips}</span>`;
    return act
      ? `<button class="sys${sub.hp <= 0 ? ' down' : ''}" data-act="${act}" data-arg="${x.id}" aria-selected="${x.id === target}" title="${esc(x.desc)}">${inner}</button>`
      : `<div class="sys${sub.hp <= 0 ? ' down' : ''}" title="${esc(x.desc)}">${inner}</div>`;
  }).join('')}</div>`;
}

export function combatPanel(s: GameState, busy: boolean): string {
  const c = s.combat!;
  if (c.result) {
    const title = c.result === 'win' ? 'Victory' : c.result === 'fled' ? 'Escaped' : 'The Wren is lost';
    return `<div class="card"><h2>${title}</h2><div class="combat-log">${c.log.map(esc).join('<br>')}</div>${btn('close-combat', 'Continue', { cls: 'primary block' })}</div>`;
  }
  const classes = (['pilot', 'engineer', 'scientist', 'medic', 'soldier'] as const).filter((k) => s.crew.some((m) => m.cls === k));
  const items = (['repairkit', 'shieldcell', 'powercell', 'decoy', 'medkit'] as const).filter((id) => s.items[id] > 0);
  const boss = ENEMY.get(c.enemyId)!.boss;
  return `<div class="small muted">Turn ${c.turn}${c.evadeTurns ? ' · evading' : ''}${c.scanned ? ' · weak point found' : ''}${c.jump ? ` · jump drive ${c.jump}/${JUMP_TURNS}` : ''}</div>
    <div class="combat-log">${c.log.slice(-4).map(esc).join('<br>')}</div>
    <h3>Target their systems</h3>${subsRow(c.enemy, c.target, 'target')}
    <h3>Your systems</h3>${subsRow(c.player, null, null)}
    <div class="grid2">${btn('cact', 'Fire', { cls: 'primary', arg: 'fire', disabled: busy, title: 'Focus fire: +10% accuracy' })}${btn('cact', 'Brace', { arg: 'brace', disabled: busy, title: 'Recharge shields, take 25% less damage' })}
    ${classes.map((k) => btn('cact', CLASS.get(k)!.combat.name, { arg: `ability:${k}`, disabled: busy || !abilityReady(s, k), title: CLASS.get(k)!.combat.desc })).join('')}
    ${btn('cact', `Charge jump (${c.jump}/${JUMP_TURNS})`, { arg: 'jump', disabled: busy || !canJumpAway(s), title: boss ? 'Retreat; you can come back' : 'Escape after three turns' })}</div>
    ${items.length ? `<h3 style="margin-top:10px">Items</h3><div class="row">${items.map((id) => btn('cact', `${itemIcon(id, 1)} ${CONSUMABLE.get(id)!.name} ×${s.items[id]}`, { cls: 'small', arg: `item:${id}`, disabled: busy || (id === 'decoy' && boss) })).join('')}</div>` : ''}
    <p class="small muted">Every action also fires whatever weapons are charged at the system you've targeted.</p>`;
}

// ---------------------------------------------------------------- Creation and ending

export function createPanel(ui: UiState): string {
  const o = ORIGINS.find((x) => x.id === ui.draft.origin) ?? ORIGINS[0]!;
  return `<div class="title"><h1>VOIDWAKE</h1><div class="muted">The colony ark Meridian broke apart in the jump. Twelve thousand sleepers are scattered across six sectors. You have a battered scout, two crew, and a long way to go.</div></div>
    <div class="card"><h3>Captain</h3><div class="row" style="flex-wrap:nowrap"><img class="portrait big" alt="" src="${portraitUrl(ui.draft.portrait, CLASS.get(o.cls)!.color)}"><div class="grow stack">
      <input class="text" data-input="name" maxlength="24" placeholder="Your name" value="${esc(ui.draft.name)}" aria-label="Captain's name">
      ${btn('roll-face', 'New face', { cls: 'small' })}</div></div></div>
    <div class="card"><h3>Origin</h3><div class="origins">${ORIGINS.map((x) => `<button class="origin" data-act="origin" data-arg="${x.id}" aria-selected="${x.id === o.id}"><span class="name">${x.name}</span><span class="desc">${CLASS.get(x.cls)!.name}. ${esc(x.desc)}</span></button>`).join('')}</div>
    <p class="small muted">You start as a ${CLASS.get(o.cls)!.name.toLowerCase()}: ${esc(CLASS.get(o.cls)!.desc)}</p></div>
    ${btn('start', 'Wake up', { cls: 'primary block' })}
    <p class="small muted" style="text-align:center;margin-top:16px">${btn('import', 'Import a save code', { cls: 'small' })}</p>`;
}

const EPILOGUES: Record<string, string> = {
  'end-settle': 'Settle',
  'end-share': 'Share',
  'end-sever': 'Sever',
};

export function endingPanel(s: GameState): string {
  const last = STORY[STORY.length - 1]!;
  const choice = last.choices?.find((c) => c.ok.flag === s.ending);
  return `<div class="title"><h1>HAVEN</h1><div class="gold">${EPILOGUES[s.ending ?? ''] ?? ''}</div></div>
    <div class="card"><p class="epilogue">${esc(choice?.ok.text ?? 'The Wake has come home.')}</p></div>
    <div class="card"><h3>The voyage</h3><div class="grid2 small">
      <div>Days <b>${s.day}</b></div><div>Colonists saved <b>${s.colonists}</b></div>
      <div>Jumps <b>${s.stats.jumps}</b></div><div>Landings <b>${s.stats.landings}</b></div>
      <div>Battles won <b>${s.stats.wins}</b></div><div>Materials gathered <b>${s.stats.gathered}</b></div>
      <div>Logs found <b>${s.lore.length}/30</b></div><div>Times the signal was lost <b>${s.stats.reloads}</b></div>
    </div></div>
    <div class="card"><h3>Crew</h3><div class="list">${s.crew.map((c) => `<div class="item">${crewFace(c)}<div class="grow"><div class="name">${esc(c.name)}</div><div class="sub">Level ${c.level} ${CLASS.get(c.cls)!.name}</div></div></div>`).join('')}</div></div>
    ${btn('new-game', 'Begin a new voyage', { cls: 'primary block' })}`;
}
