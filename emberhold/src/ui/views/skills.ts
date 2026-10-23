/**
 * The skills overview and each skill's page: its header, any special
 * panel, and its action list.
 */
import { ITEM, item } from '../../data/items';
import { GUILD_RANKS, RANK_TITLES, guildFor, guildRankMods } from '../../data/meta';
import { ACTIONS_BY_SKILL, SKILL_INFO, SKILL_LIST, THIEVING_NPCS } from '../../data/skills';
import {
  ANIMALS, BUILDINGS, CONSTELLATIONS, FARM_CROPS, HEX_KEY, MAP_RADIUS, OBSTACLES, PILLARS, POIS, STARS, SYNERGIES, hexCost, mapHexes, starCost, type PlotKind,
} from '../../data/special';
import { FAMILIARS } from '../../data/items';
import { WOODS } from '../../data/tiers';
import type { SkillAction, SkillId } from '../../data/types';
import { count, level, levelCap, skillUnlocked } from '../../game/core';
import { mods, rankOf, skillMod, get } from '../../game/modifiers';
import { actionInterval, blocker, successChance } from '../../game/skilling';
import { buildingCost, growTime, penCapacity, plotReady, settlementPop, surveyable } from '../../game/systems';
import { xpFor, levelProgress } from '../../game/xp';
import { SKILL_ICON } from '../../sprites/defs';
import type { GameState } from '../../state/types';
import { adventureSkillCost } from '../../data/meta';
import type { Ui } from '../state';
import { bar, btn, chip, esc, fmt, fmtInt, iconHtml, itemIcon, modList, pct, secs } from '../kit';

export function skillIcon(id: SkillId, scale = 2): string {
  return iconHtml(SKILL_ICON[id] ?? 'ui.star', scale);
}

const KIND_ORDER = [['combat', 'Combat'], ['gathering', 'Gathering'], ['artisan', 'Artisan'], ['support', 'Support']] as const;

export function skillsView(s: GameState): string {
  const total = SKILL_LIST.reduce((a, sk) => a + level(s, sk.id), 0);
  let html = `<div class="summary">Total level <b>${total}</b> · ${SKILL_LIST.length} skills</div>`;
  for (const [kind, label] of KIND_ORDER) {
    html += `<h3 class="section">${label}</h3><div class="skillgrid">`;
    for (const sk of SKILL_LIST.filter((x) => x.kind === kind)) {
      const lvl = level(s, sk.id);
      const locked = !skillUnlocked(s, sk.id);
      const active = s.activity?.kind === 'skill' && s.activity.action.startsWith('') && activeSkill(s) === sk.id;
      html += `<button class="skillcard${locked ? ' locked' : ''}${active ? ' active' : ''}" data-act="skill" data-skill="${sk.id}">
        ${skillIcon(sk.id)}<span class="nm">${esc(sk.name)}${sk.isNew ? '<em class="new">II</em>' : ''}</span>
        <span class="lv">${locked ? '🔒' : `${lvl}<small>/${levelCap(s, sk.id)}</small>`}</span>
        ${bar(levelProgress(s.xp[sk.id], levelCap(s, sk.id)), 'thin')}
      </button>`;
    }
    html += '</div>';
  }
  return html;
}

export function activeSkill(s: GameState): SkillId | null {
  const a = s.activity;
  if (!a) return null;
  if (a.kind === 'skill') return ACTION_SKILL.get(a.action) ?? null;
  if (a.kind === 'agility') return 'agility';
  if (a.kind === 'survey') return 'cartography';
  return null;
}
const ACTION_SKILL = new Map(Object.values(ACTIONS_BY_SKILL).flat().map((a) => [a.id, a.skill]));

function header(s: GameState, id: SkillId): string {
  const info = SKILL_INFO[id];
  const lvl = level(s, id);
  const cap = levelCap(s, id);
  const xp = s.xp[id];
  const next = lvl >= cap ? null : xpFor(lvl + 1);
  const g = guildFor(id);
  const rep = s.guilds[g]?.rep ?? 0;
  const rank = rankOf(rep);
  const nextRep = GUILD_RANKS[rank + 1];
  const pot = s.potions[id];
  let html = `<div class="card skillhead">
    <div class="row">${skillIcon(id, 3)}<div class="grow"><h2>${esc(info.name)} <span class="lvl">${lvl}</span></h2><p class="muted">${esc(info.desc)}</p></div></div>
    ${bar(levelProgress(xp, cap), 'xp', next ? `${fmtInt(xp)} / ${fmtInt(next)} XP` : `${fmtInt(xp)} XP · max`)}
    <div class="row small"><span>${esc(g === 'combat' ? "Warriors' Guild" : `${info.name} Guild`)}: <b>${RANK_TITLES[rank]}</b> (rank ${rank})</span>
    <button class="link" data-act="nav" data-view="guilds" data-guild="${g}">Tasks ›</button></div>
    ${bar(nextRep ? (rep - GUILD_RANKS[rank]!) / (nextRep - GUILD_RANKS[rank]!) : 1, 'thin guild', '')}`;
  if (pot) html += `<div class="row small">${itemIcon(pot.item, 1)} ${esc(item(pot.item).name)} · ${pot.charges} charges</div>`;
  if (s.mode === 'relics') html += `<div class="row small">Relics found: <b>${s.relics[id] ?? 0}/5</b> · level cap ${cap}</div>`;
  html += '</div>';
  return html;
}

export function skillView(s: GameState, ui: Ui): string {
  const id = ui.skill;
  if (!skillUnlocked(s, id)) {
    return `${header(s, id)}<div class="card center"><p>This skill is locked in Adventure mode.</p>${btn(`Unlock for ${fmt(adventureSkillCost(s.unlocked.length))} gold`, 'unlock-skill', { skill: id }, 'primary', s.gp < adventureSkillCost(s.unlocked.length))}</div>`;
  }
  if (SKILL_INFO[id].kind === 'combat') return `${header(s, id)}${combatSkillNote(id)}`;
  let html = header(s, id);
  html += specialPanel(s, ui, id);
  const actions = ACTIONS_BY_SKILL[id] ?? [];
  if (actions.length) html += actionList(s, ui, actions);
  return html;
}

function combatSkillNote(id: SkillId): string {
  const notes: Partial<Record<SkillId, string>> = {
    attack: 'Train by fighting with a melee weapon on the Accurate style.',
    strength: 'Train by fighting with a melee weapon on the Aggressive style.',
    defence: 'Train with any Defensive style (melee, Long range, or defensive casting).',
    hitpoints: 'Every fight trains Hitpoints.',
    ranged: 'Equip a bow and arrows, then fight.',
    magic: 'Equip a staff and pick a spell in the Magic tab.',
    prayer: 'Bury bones from the bank or the Prayer tab.',
    slayer: 'Take a task from the Slayer tab and kill what it asks.',
  };
  return `<div class="card"><p>${esc(notes[id] ?? '')}</p>${btn('Go to Combat', 'nav', { view: 'combat' }, 'primary')}</div>`;
}

function actionList(s: GameState, ui: Ui, actions: SkillAction[]): string {
  const m = mods(s);
  const groups = new Map<string, SkillAction[]>();
  for (const a of actions) {
    const g = a.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(a);
  }
  const lvl = level(s, actions[0]!.skill);
  let html = '';
  let first = true;
  for (const [g, list] of groups) {
    const key = `${actions[0]!.skill}:${g}`;
    // The first group starts open; tapping its header closes it like any other.
    const toggled = ui.openGroups.includes(key);
    const open = !g || (first ? !toggled : toggled) || groups.size <= 2 || list.some((a) => isActive(s, a.id));
    first = false;
    if (g) {
      const avail = list.filter((a) => a.level <= lvl).length;
      html += `<button class="grouphead" data-act="group" data-group="${esc(key)}"><span>${open ? '▾' : '▸'} ${esc(g)}</span><span class="muted">${avail}/${list.length}</span></button>`;
    }
    if (!open) continue;
    html += '<div class="actions">';
    for (const a of list) html += actionCard(s, a, m);
    html += '</div>';
  }
  return html;
}

function isActive(s: GameState, id: string): boolean {
  return s.activity?.kind === 'skill' && s.activity.action === id;
}

function actionCard(s: GameState, a: SkillAction, m: Record<string, number>): string {
  const lvl = level(s, a.skill);
  const locked = lvl < a.level;
  const active = isActive(s, a.id);
  const why = blocker(s, a);
  const iv = actionInterval(s, a);
  if (locked) {
    return `<div class="action locked">${iconHtml(a.icon, 2)}<div class="grow"><b>${esc(a.name)}</b><span class="muted">Level ${a.level}</span></div></div>`;
  }
  const ins = a.inputs.map((q) => chip(q.item, q.qty, count(s, q.item))).join('');
  const outs = a.outputs.map((q) => chip(q.item, q.qty)).join('');
  const extra: string[] = [];
  if (a.success !== undefined) extra.push(`${pct(successChance(s, a))} success`);
  if (a.gp) extra.push(`${a.gp[0]}–${a.gp[1]} gp`);
  const dbl = skillMod(m, 'doubleChance', a.skill);
  if (dbl) extra.push(`${dbl}% double`);
  return `<div class="action${active ? ' active' : ''}${why && !active ? ' blocked' : ''}" data-act="${active ? 'stop' : 'start'}" data-id="${a.id}">
    ${iconHtml(a.icon, 2)}
    <div class="grow">
      <div class="row"><b>${esc(a.name)}</b><span class="muted">${secs(iv)} · ${fmt(a.xp)} xp</span></div>
      <div class="chips">${ins ? `${ins}<span class="arrow">→</span>` : ''}${outs}${a.loot && !a.outputs.length ? '<span class="muted">loot</span>' : ''}</div>
      ${extra.length ? `<div class="muted small">${extra.join(' · ')}</div>` : ''}
      ${why && !active ? `<div class="warn small">${esc(why)}</div>` : ''}
      ${active ? bar(0, 'thin act', '', 'action') : ''}
    </div>
    <span class="go">${active ? '■' : '▶'}</span>
  </div>`;
}

// --- Special panels ----------------------------------------------------------------

function specialPanel(s: GameState, ui: Ui, id: SkillId): string {
  switch (id) {
    case 'farming':
      return farmingPanel(s, ui);
    case 'agility':
      return agilityPanel(s);
    case 'astrology':
      return astrologyPanel(s);
    case 'cartography':
      return cartographyPanel(s);
    case 'construction':
      return constructionPanel(s);
    case 'ranching':
      return ranchingPanel(s);
    case 'firemaking':
      return bonfirePanel(s);
    case 'summoning':
      return summoningPanel(s);
    case 'archaeology':
      return `<div class="card row"><span class="grow">Dig sites are found by surveying the map in Cartography. Donate artefacts to the museum for lasting bonuses.</span>${btn('Museum', 'nav', { view: 'museum' })}</div>`;
    case 'thieving':
      return `<div class="card small muted">A failed pickpocket stuns you for 3 seconds and hurts. Higher level, more success. ${THIEVING_NPCS.length} marks to try.</div>`;
    default:
      return '';
  }
}

function farmingPanel(s: GameState, ui: Ui): string {
  let html = `<div class="card"><div class="row"><h3 class="grow">Plots</h3>${btn('Harvest all', 'harvest-all', {}, 'small')}</div>
    <div class="row small">Compost on planting: ${(['None', 'Compost', 'Rich'] as const).map((n, i) => `<button class="pill${ui.compost === i ? ' on' : ''}" data-act="compost" data-n="${i}">${n} ${i ? `(${count(s, i === 1 ? 'compost' : 'super-compost')})` : ''}</button>`).join('')}</div>`;
  for (const kind of ['allotment', 'herb', 'tree'] as PlotKind[]) {
    html += `<h4>${kind === 'allotment' ? 'Allotments' : kind === 'herb' ? 'Herb patches' : 'Tree patches'}</h4><div class="plots">`;
    s.farm[kind].forEach((p, i) => {
      if (!p.seed) {
        html += `<button class="plot empty" data-act="plot" data-kind="${kind}" data-i="${i}">+<small>Plant</small></button>`;
        return;
      }
      const c = FARM_CROPS.find((x) => x.seed === p.seed)!;
      const ready = plotReady(s, kind, i);
      const left = p.plantedAt + growTime(s, p.seed) - s.time;
      html += `<button class="plot${ready ? ' ready' : ''}" data-act="harvest" data-kind="${kind}" data-i="${i}">${itemIcon(c.product, 2)}<small>${ready ? 'Harvest' : fmtLeft(left)}</small>${p.compost ? '<i class="cp">✦</i>' : ''}</button>`;
    });
    html += '</div>';
  }
  html += `<p class="small muted">Plots grow in real time, even while you do other things or are away. Without compost a crop may wither. Buy more plots in the Shop.</p></div>`;
  return html;
}

function fmtLeft(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.ceil(sec / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function seedPicker(s: GameState, kind: PlotKind, i: number): string {
  const lvl = level(s, 'farming');
  const crops = FARM_CROPS.filter((c) => c.kind === kind);
  return `<h3>Plant a ${kind === 'allotment' ? 'crop' : kind}</h3><div class="list">${crops.map((c) => {
    const have = count(s, c.seed);
    const ok = lvl >= c.level && have >= c.seeds;
    return `<button class="listrow${ok ? '' : ' dim'}" data-act="plant" data-kind="${kind}" data-i="${i}" data-seed="${c.seed}" ${ok ? '' : 'disabled'}>
      ${itemIcon(c.seed)}<span class="grow"><b>${esc(c.name)}</b><small>Lv ${c.level} · ${fmtLeft(c.grow)} · needs ${c.seeds}</small></span><span>${fmtInt(have)}</span></button>`;
  }).join('')}</div>`;
}

function agilityPanel(s: GameState): string {
  const lvl = level(s, 'agility');
  const running = s.activity?.kind === 'agility';
  let html = `<div class="card"><div class="row"><h3 class="grow">Your course</h3>${btn(running ? 'Stop' : 'Run course', running ? 'stop' : 'agility', {}, 'primary', !s.course.some(Boolean))}</div>
    ${running ? bar(0, 'thin act', '', 'action') : ''}<p class="small muted">Laps run: ${fmtInt(s.counters['laps'] ?? 0)}. Each obstacle gives its bonus as long as it stands, whether or not you are running.</p></div>`;
  for (let slot = 0; slot < 10; slot++) {
    const built = s.course[slot];
    const opts = OBSTACLES.filter((o) => o.slot === slot);
    const lv = opts[0]!.level;
    html += `<div class="card obstacle${lv > lvl ? ' dim' : ''}"><div class="row"><b class="grow">Obstacle ${slot + 1}</b><span class="muted small">Agility ${lv}</span></div>`;
    for (const o of opts) {
      const isBuilt = built === o.id;
      const discount = Math.min(0.5, (s.counters[`built:${o.id}`] ?? 0) * 0.1);
      html += `<div class="ob${isBuilt ? ' built' : ''}"><div class="grow"><b>${esc(o.name)}</b> <span class="muted small">${secs(o.interval)} · ${o.xp} xp · ${o.gp} gp</span>${modList(o.mods)}
        <div class="chips"><span class="chip">${iconHtml('ui.gp', 1)}<b>${fmt(o.cost.gp * (1 - discount))}</b></span>${o.cost.items.map((q) => chip(q.item, q.qty, count(s, q.item))).join('')}</div></div>
        ${isBuilt ? '<span class="tag">Built</span>' : btn('Build', 'obstacle', { id: o.id }, 'small', lv > lvl)}</div>`;
    }
    html += '</div>';
  }
  const full = s.course.every(Boolean);
  html += `<div class="card"><h3>Pillar</h3><p class="small muted">${full ? 'Your course is complete. Raise one pillar for a bonus of its own.' : 'Build all ten obstacles to raise a pillar.'}</p>`;
  for (const p of PILLARS) {
    html += `<div class="ob${s.pillar === p.id ? ' built' : ''}"><div class="grow"><b>${esc(p.name)}</b>${modList(p.mods)}<div class="chips"><span class="chip">${iconHtml('ui.gp', 1)}<b>${fmt(p.cost.gp)}</b></span>${p.cost.items.map((q) => chip(q.item, q.qty, count(s, q.item))).join('')}</div></div>
      ${s.pillar === p.id ? '<span class="tag">Built</span>' : btn('Build', 'pillar', { id: p.id }, 'small', !full)}</div>`;
  }
  return html + '</div>';
}

function astrologyPanel(s: GameState): string {
  const lvl = level(s, 'astrology');
  let html = `<div class="card"><h3>Observatory</h3><p class="small muted">Study a constellation (below) for stardust, then spend it here. Each constellation boosts two skills. You have ${chip('stardust', count(s, 'stardust'))} ${chip('golden-stardust', count(s, 'golden-stardust'))}</p>`;
  for (const c of CONSTELLATIONS) {
    if (c.level > lvl) continue;
    const levels = s.stars[c.id] ?? [0, 0, 0, 0];
    html += `<div class="star"><div class="row"><b class="grow">${esc(c.name)}</b><span class="muted small">${esc(SKILL_INFO[c.skills[0]].name)} · ${esc(SKILL_INFO[c.skills[1]].name)}</span></div><div class="stars">`;
    STARS.forEach((st, i) => {
      const lv = levels[i] ?? 0;
      const max = lv >= st.max;
      const cost = starCost(lv, st.golden);
      const label = [`${SKILL_INFO[c.skills[0]].name} XP`, `${SKILL_INFO[c.skills[1]].name} XP`, 'Both faster', 'Both double'][i]!;
      html += `<button class="starbtn${st.golden ? ' gold' : ''}" data-act="star" data-c="${c.id}" data-i="${i}" ${max ? 'disabled' : ''}>
        <span>${'★'.repeat(lv)}${'☆'.repeat(st.max - lv)}</span><small>${esc(label)}</small>
        <small>${max ? 'Max' : `${cost} ${st.golden ? 'gold' : 'dust'}`}</small></button>`;
    });
    html += '</div></div>';
  }
  return html + '</div>';
}

function cartographyPanel(s: GameState): string {
  const done = new Set(s.surveyed);
  const options = new Set(surveyable(s));
  const target = s.activity?.kind === 'survey' ? s.activity.hex : null;
  const size = 26;
  const R = MAP_RADIUS;
  const w = Math.round(size * Math.sqrt(3) * (2 * R + 1)) + 4;
  const h = Math.round(size * 1.5 * (2 * R) + size * 2) + 4;
  let svg = `<svg class="hexmap" viewBox="0 0 ${w} ${h}" width="100%">`;
  for (const [q, r] of mapHexes()) {
    const key = HEX_KEY(q, r);
    const x = w / 2 + size * Math.sqrt(3) * (q + r / 2);
    const y = h / 2 + size * 1.5 * r;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const ang = (Math.PI / 180) * (60 * i - 30);
      return `${(x + (size - 1.5) * Math.cos(ang)).toFixed(1)},${(y + (size - 1.5) * Math.sin(ang)).toFixed(1)}`;
    }).join(' ');
    const poi = POIS.find((p) => p.q === q && p.r === r);
    const cls = done.has(key) ? 'done' : key === target ? 'target' : options.has(key) ? 'open' : 'fog';
    const prog = !done.has(key) ? (s.map[key] ?? 0) / hexCost(q, r).points : 1;
    svg += `<g class="hex ${cls}" data-act="${options.has(key) ? 'survey' : 'noop'}" data-hex="${key}"><polygon points="${pts}"/>`;
    if (done.has(key) && poi) svg += `<text x="${x}" y="${y + 5}" text-anchor="middle">${poi.id.startsWith('site-') ? '⛏' : '★'}</text>`;
    else if (!done.has(key) && prog > 0) svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" class="p">${Math.floor(prog * 100)}%</text>`;
    if (q === 0 && r === 0) svg += `<text x="${x}" y="${y + 5}" text-anchor="middle">⌂</text>`;
    svg += '</g>';
  }
  svg += '</svg>';
  const found = POIS.filter((p) => done.has(HEX_KEY(p.q, p.r)));
  return `<div class="card"><div class="row"><h3 class="grow">The map</h3>${target ? btn('Stop', 'stop', {}, 'small') : btn('Survey nearest', 'survey', {}, 'small primary', !options.size)}</div>
    ${target ? bar(0, 'thin act', '', 'action') : ''}${svg}
    <p class="small muted">Tap a highlighted hex to survey it. Hexes further out need a higher level. ${s.surveyed.length}/${mapHexes().length} surveyed.</p>
    <h4>Landmarks found (${found.length}/${POIS.length})</h4><ul class="pois">${found.map((p) => `<li><b>${esc(p.name)}</b> <span class="muted small">${esc(p.desc)}</span>${p.reward.mods ? modList(p.reward.mods) : ''}</li>`).join('')}</ul></div>`;
}

function constructionPanel(s: GameState): string {
  const lvl = level(s, 'construction');
  const { pop, needed, staffing } = settlementPop(s);
  let html = `<div class="card"><h3>Your settlement</h3><p class="small">Settlers <b>${pop}</b> · jobs <b>${needed}</b> · staffing <b>${pct(staffing)}</b></p>
    <p class="small muted">Make planks, blocks and nails below, then build. Workshops need settlers: build cottages to house them. Production runs while you are away.</p></div>`;
  for (const b of BUILDINGS) {
    const lv = s.settlement[b.id] ?? 0;
    const lockedB = b.level > lvl;
    const cost = buildingCost(b.id, lv);
    const out: string[] = [];
    if (b.housing) out.push(`+${b.housing} settlers per level`);
    if (b.gpPerHour) out.push(`${fmt(b.gpPerHour)} gold/hour per level`);
    for (const p of b.produces ?? []) out.push(`${p.qty} ${item(p.item).name}/hour per level`);
    html += `<div class="card building${lockedB ? ' dim' : ''}"><div class="row">${iconHtml(b.icon, 2)}<div class="grow"><b>${esc(b.name)}</b> <span class="lvl">${lv}/${b.max}</span><div class="small muted">${esc(b.desc)}${b.workers ? ` · ${b.workers} workers/level` : ''}</div></div></div>
      ${out.length ? `<div class="small">${esc(out.join(' · '))}</div>` : ''}${b.mods ? modList(b.mods) : ''}
      ${lockedB ? `<div class="muted small">Construction ${b.level}</div>` : lv >= b.max ? '<span class="tag">Complete</span>' : `<div class="row"><div class="chips grow"><span class="chip">${iconHtml('ui.gp', 1)}<b>${fmt(cost.gp)}</b></span>${cost.items.map((q) => chip(q.item, q.qty, count(s, q.item))).join('')}</div>${btn(lv ? 'Upgrade' : 'Build', 'building', { id: b.id }, 'small')}</div>`}
    </div>`;
  }
  return html;
}

function ranchingPanel(s: GameState): string {
  const cap = penCapacity(s);
  let html = `<div class="card"><h3>Your ranch</h3><p class="small muted">Animals produce on their own, even offline, as long as there is feed in the bank. Each cycle eats one feed per animal.</p></div><div class="pens">`;
  s.ranch.forEach((p, i) => {
    if (!p.animal) {
      html += `<button class="card pen empty" data-act="pen" data-i="${i}">+ Stock pen ${i + 1}</button>`;
      return;
    }
    const a = ANIMALS.find((x) => x.id === p.animal)!;
    const hasFeed = !a.feed || count(s, a.feed) >= p.count;
    html += `<div class="card pen"><div class="row">${iconHtml(`quad.${a.pal}`, 2)}<div class="grow"><b>${esc(a.name)} ×${p.count}</b><span class="small muted"> / ${cap}</span>
      <div class="small">${a.produce.map((q) => chip(q.item, q.qty * p.count)).join('')} every ${secs(a.interval)}</div>
      ${a.feed ? `<div class="small ${hasFeed ? '' : 'warn'}">Feed: ${chip(a.feed, p.count, count(s, a.feed))}</div>` : ''}</div></div>
      ${bar(Math.min(1, p.progress / a.interval), 'thin')}
      <div class="row">${btn(`Buy another (${fmt(a.price)})`, 'buy-animal', { i, animal: a.id }, 'small', p.count >= cap || s.gp < a.price)}${btn('Sell all', 'sell-animals', { i }, 'small ghost')}</div></div>`;
  });
  html += '</div>';
  return html;
}

export function animalPicker(s: GameState, pen: number): string {
  const lvl = level(s, 'ranching');
  return `<h3>Stock pen ${pen + 1}</h3><div class="list">${ANIMALS.map((a) => {
    const ok = lvl >= a.level && s.gp >= a.price;
    return `<button class="listrow${ok ? '' : ' dim'}" data-act="buy-animal" data-i="${pen}" data-animal="${a.id}" ${ok ? '' : 'disabled'}>${iconHtml(`quad.${a.pal}`, 2)}
      <span class="grow"><b>${esc(a.name)}</b><small>Lv ${a.level} · ${a.produce.map((q) => `${q.qty} ${item(q.item).name}`).join(', ')} · ${a.feed ? `eats ${item(a.feed).name}` : 'no feed'}</small></span><span>${fmt(a.price)} gp</span></button>`;
  }).join('')}</div>`;
}

function bonfirePanel(s: GameState): string {
  const lvl = level(s, 'firemaking');
  const fire = s.buffs.find((b) => b.id === 'bonfire' && b.until > s.time);
  return `<div class="card"><h3>Bonfire</h3><p class="small muted">Burn 10 logs at once for +10% Firemaking XP and +2% XP in every skill for a while.</p>
    ${fire ? `<p class="good small">🔥 ${esc(fire.name)}: ${fmtLeft(fire.until - s.time)} left</p>` : ''}
    <div class="chips">${WOODS.filter((w) => w.level <= lvl).map((w) => `<button class="pill" data-act="bonfire" data-wood="${w.id}" ${count(s, `log-${w.id}`) >= 10 ? '' : 'disabled'}>${itemIcon(`log-${w.id}`, 1)} ${esc(w.name.replace(' Logs', '') || 'Logs')}</button>`).join('')}</div></div>`;
}

function summoningPanel(s: GameState): string {
  const eq = s.loadouts[s.loadout]!;
  const fams = [eq.summon1, eq.summon2].filter(Boolean).map((st) => st!.item.replace('tablet-', ''));
  return `<div class="card"><h3>Familiars</h3><p class="small muted">Equip tablets in the two summon slots (from the bank). A skilling familiar uses a charge per action in its skill; a combat familiar attacks with you. Two familiars together can form a synergy:</p>
    <ul class="mods">${SYNERGIES.map((sy) => {
      const on = fams.includes(sy.a) && fams.includes(sy.b);
      const n = (id: string): string => FAMILIARS.find((f) => f.id === id)!.name;
      return `<li class="${on ? 'good' : ''}"><b>${esc(sy.name)}</b>: ${esc(n(sy.a))} + ${esc(n(sy.b))}</li>`;
    }).join('')}</ul></div>`;
}

export function guildRankPreview(id: string, rank: number): string {
  return modList(guildRankMods(id as never, rank));
}

export { get, ITEM };
