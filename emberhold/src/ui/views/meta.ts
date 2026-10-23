/**
 * Guilds, shop, quests, the Gauntlet, pets, completion, museum, stats and
 * settings.
 */
import { AREAS, MONSTERS } from '../../data/combat';
import { DIG_SITES, ITEMS, item } from '../../data/items';
import { GUILDS, GUILD_RANKS, MODES, PETS, QUESTS, RANK_TITLES, SHOP, adventureSkillCost, guildRankMods } from '../../data/meta';
import { SKILL_INFO, SKILL_LIST } from '../../data/skills';
import { MUSEUM_REWARDS } from '../../data/special';
import type { CombatStyle, GameMode } from '../../data/types';
import { RAID_BOON, RAID_BOONS } from '../../game/combat';
import { count, level, skillUnlocked } from '../../game/core';
import { museumComplete, rankOf } from '../../game/modifiers';
import { allMet, describe } from '../../game/requirements';
import { questReady, questStep, shopPrice, taskProgress } from '../../game/systems';
import { sources } from '../../data/validate';
import type { GameState } from '../../state/types';
import type { Ui } from '../state';
import { bar, btn, chip, esc, fmt, fmtInt, iconHtml, itemIcon, modList } from '../kit';
import { fightPanel } from './combat';
import { skillIcon } from './skills';

// --- Guilds --------------------------------------------------------------------

export function guildsView(s: GameState, ui: Ui): string {
  let html = '<div class="card small muted">Guilds replace item mastery. Finish a guild\'s tasks (and keep training) to earn reputation; every rank grants lasting bonuses for that skill.</div>';
  for (const g of GUILDS) {
    const st = s.guilds[g.id];
    const rep = st?.rep ?? 0;
    const rank = rankOf(rep);
    const next = GUILD_RANKS[rank + 1];
    const done = st?.claimed.length ?? 0;
    const open = ui.openGuild === g.id;
    const icon = g.id === 'combat' ? iconHtml('ui.guild', 2) : skillIcon(g.id, 2);
    html += `<div class="card guild"><button class="row areahead" data-act="guild" data-id="${g.id}">${icon}<span class="grow"><b>${esc(g.name)}</b><small class="muted"> ${RANK_TITLES[rank]} · ${done}/${g.tasks.length} tasks</small>${bar(next ? (rep - GUILD_RANKS[rank]!) / (next - GUILD_RANKS[rank]!) : 1, 'thin guild')}</span><span>${open ? '▾' : '▸'}</span></button>`;
    if (open) {
      html += `<div class="small">Reputation ${fmtInt(rep)}${next ? ` / ${fmtInt(next)} for rank ${rank + 1}` : ' · top rank'}</div>`;
      if (rank) html += `<h4>Your bonuses</h4>${modList(guildRankMods(g.id, rank))}`;
      if (rank < 10) html += `<h4>Next rank</h4>${modList(diffMods(guildRankMods(g.id, rank + 1), guildRankMods(g.id, rank)))}`;
      html += '<h4>Tasks</h4><ul class="tasks">';
      for (const t of g.tasks) {
        const claimed = st?.claimed.includes(t.id);
        const prog = Math.min(t.qty, taskProgress(s, t.counter));
        html += `<li class="${claimed ? 'done' : ''}"><span class="grow">${claimed ? '✔ ' : ''}${esc(t.label)}</span><span class="muted small">${claimed ? `+${t.rep}` : `${fmtInt(prog)}/${fmtInt(t.qty)} · ${t.rep} rep`}</span>${claimed ? '' : bar(prog / t.qty, 'thin')}</li>`;
      }
      html += '</ul>';
    }
    html += '</div>';
  }
  return html;
}

function diffMods(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(a)) if ((a[k] ?? 0) !== (b[k] ?? 0)) out[k] = (a[k] ?? 0) - (b[k] ?? 0);
  return out;
}

// --- More ----------------------------------------------------------------------

export function moreView(s: GameState): string {
  const tiles: [string, string, string, string][] = [
    ['shop', 'ui.shop', 'Shop', 'Upgrades, supplies, capes'],
    ['quests', 'ui.quest', 'Quests', `${s.quests.length}/${QUESTS.length} done`],
    ['raid', 'ui.raidicon', 'The Gauntlet', `Best wave ${s.raidBest}`],
    ['pets', 'ui.pet', 'Pets', `${s.pets.length}/${PETS.length} found`],
    ['completion', 'ui.star', 'Completion log', `${completion(s).total.toFixed(1)}%`],
    ['museum', 'ui.museum', 'Museum', `${s.donated.length} artefacts`],
    ['stats', 'ui.stats', 'Statistics', ''],
    ['log', 'ui.log', 'Messages', ''],
    ['settings', 'ui.settings', 'Settings & saves', MODES[s.mode].name],
  ];
  return `<div class="tiles">${tiles.map(([v, icon, name, sub]) => `<button class="tile" data-act="nav" data-view="${v}">${iconHtml(icon, 3)}<b>${esc(name)}</b><small>${esc(sub)}</small></button>`).join('')}</div>`;
}

// --- Shop ----------------------------------------------------------------------

const SHOP_TABS: [string, string][] = [['general', 'General'], ['skilling', 'Skilling'], ['gear', 'Gear'], ['slayer', 'Slayer'], ['raid', 'Gauntlet'], ['capes', 'Capes']];

export function shopView(s: GameState, ui: Ui): string {
  let html = `<div class="summary">${iconHtml('ui.gp', 1)} ${fmt(Math.floor(s.gp))} · ${iconHtml('ui.slayer', 1)} ${fmtInt(s.slayerCoins)} · ${iconHtml('ui.raid', 1)} ${fmtInt(s.raidCoins)}</div>
    <div class="tabs scroll">${SHOP_TABS.map(([t, l]) => `<button class="tab${ui.shopTab === t ? ' on' : ''}" data-act="shop-tab" data-tab="${t}">${l}</button>`).join('')}${s.mode === 'adventure' ? `<button class="tab${ui.shopTab === 'skills' ? ' on' : ''}" data-act="shop-tab" data-tab="skills">Skills</button>` : ''}</div>`;
  if (ui.shopTab === 'skills') {
    const cost = adventureSkillCost(s.unlocked.length);
    html += `<div class="card small muted">Adventure mode: each skill you unlock makes the next one dearer. Next: ${fmt(cost)} gold.</div><div class="list">`;
    for (const sk of SKILL_LIST.filter((x) => x.kind !== 'combat')) {
      const has = skillUnlocked(s, sk.id);
      html += `<div class="listrow">${skillIcon(sk.id)}<span class="grow"><b>${esc(sk.name)}</b></span>${has ? '<span class="tag">Unlocked</span>' : btn(`${fmt(cost)} gp`, 'unlock-skill', { skill: sk.id }, 'small', s.gp < cost)}</div>`;
    }
    return html + '</div>';
  }
  html += '<div class="list">';
  for (const e of SHOP.filter((x) => x.tab === ui.shopTab)) {
    const p = shopPrice(s, e.id);
    const owned = 'upgrade' in e.gives ? s.upgrades[e.gives.upgrade] ?? 0 : 0;
    const max = 'upgrade' in e.gives ? e.gives.max : undefined;
    const soldOut = max !== undefined && owned >= max;
    const reqOk = allMet(s, e.req);
    const price = [p.gp ? `${fmt(p.gp)} gp` : '', p.slayerCoins ? `${fmt(p.slayerCoins)} SC` : '', p.raidCoins ? `${fmt(p.raidCoins)} GC` : ''].filter(Boolean).join(' ');
    const afford = s.gp >= p.gp && s.slayerCoins >= p.slayerCoins && s.raidCoins >= p.raidCoins;
    const it = 'item' in e.gives ? item(e.gives.item) : null;
    html += `<div class="listrow${reqOk ? '' : ' dim'}">${iconHtml(e.icon, 2)}<span class="grow"><b>${esc(e.name)}</b><small>${esc(e.desc || it?.desc || '')}${max !== undefined && max > 1 ? ` · ${owned}/${max}` : ''}${!reqOk && e.req ? ` · needs ${esc(describe(e.req.find((r) => !allMet(s, [r]))!))}` : ''}</small>${it?.equip?.mods ? modList(it.equip.mods) : ''}</span>
      ${soldOut ? '<span class="tag">Owned</span>' : btn(price || 'Free', 'shop-buy', { id: e.id }, 'small', !afford || !reqOk)}</div>`;
  }
  return html + '</div>';
}

// --- Quests --------------------------------------------------------------------

export function questsView(s: GameState): string {
  let html = '';
  for (const q of QUESTS) {
    const done = s.quests.includes(q.id);
    const avail = allMet(s, q.req);
    const ready = questReady(s, q.id);
    html += `<div class="card quest${done ? ' done' : ''}${avail ? '' : ' dim'}"><div class="row"><b class="grow">${done ? '✔ ' : ''}${esc(q.name)}</b><span class="muted small">${esc(q.giver)}</span></div>
      <p class="small">${esc(q.story)}</p>`;
    if (!done) {
      html += '<ul class="tasks">';
      for (const st of q.steps) {
        const have = questStep(s, st);
        html += `<li><span class="grow">${esc(stepLabel(st))}</span><span class="small ${have >= st.qty ? 'good' : 'muted'}">${fmtInt(Math.min(have, st.qty))}/${fmtInt(st.qty)}</span></li>`;
      }
      html += '</ul>';
    }
    const r = q.rewards;
    html += `<div class="small">Rewards: ${[r.gp ? `${fmt(r.gp)} gold` : '', r.unlocks ? esc(r.unlocks) : '', ...(Object.entries(r.xp ?? {}).map(([k, v]) => `${fmt(v ?? 0)} ${SKILL_INFO[k as keyof typeof SKILL_INFO].name} XP`))].filter(Boolean).join(' · ')}</div>
      ${r.items?.length ? `<div class="chips">${r.items.map((i) => chip(i.item, i.qty)).join('')}</div>` : ''}${r.mods ? modList(r.mods) : ''}
      ${done ? '' : btn('Complete', 'quest', { id: q.id }, 'primary', !ready)}</div>`;
  }
  return html;
}

function stepLabel(st: { kind: string; target: string; qty: number }): string {
  switch (st.kind) {
    case 'level':
      return `Reach ${SKILL_INFO[st.target as keyof typeof SKILL_INFO].name} ${st.qty}`;
    case 'item':
      return `Hand in ${st.qty} ${item(st.target).name}`;
    case 'kill':
      return `Defeat ${st.qty} ${MONSTERS.find((m) => m.id === st.target)?.name ?? st.target}`;
    case 'clear':
      return `Clear ${AREAS.find((a) => a.id === st.target)?.name ?? st.target}`;
    default: {
      const labels: Record<string, string> = {
        'wc-normal': 'Chop logs', 'fish-shrimp': 'Catch shrimp', 'cook-shrimp': 'Cook shrimp', 'harvest:any': 'Harvest crops', 'produce:any': 'Collect animal produce',
        hexesSurveyed: 'Survey hexes', 'building:cottage': 'Cottage level',
      };
      return labels[st.target] ?? st.target;
    }
  }
}

// --- The Gauntlet ----------------------------------------------------------------

export function raidView(s: GameState): string {
  const r = s.raid;
  if (!r) {
    return `<div class="card"><h3>The Gauntlet</h3><p>Fight wave after wave with your own levels but none of your gear: the Gauntlet hands you a kit for your style, better every three waves. After every wave pick one of three boons. When you fall, it pays coins for every wave cleared.</p>
      <p class="small">Best: <b>${s.raidBest}</b> waves · ${iconHtml('ui.raid', 1)} ${fmtInt(s.raidCoins)} coins</p>
      <div class="acts">${(['melee', 'ranged', 'magic'] as CombatStyle[]).map((st) => btn(`Enter (${st})`, 'raid-start', { style: st }, 'primary')).join('')}</div>
      <p class="small">${btn('Gauntlet shop', 'shop-tab', { tab: 'raid' }, 'small')}</p></div>
      <div class="card"><h3>Boons</h3>${RAID_BOONS.map((b) => `<div class="small"><b>${esc(b.name)}</b>${modList(b.mods)}</div>`).join('')}</div>`;
  }
  let html = `<div class="card row"><b class="grow">Wave ${r.wave}</b><span class="muted">${r.killed % 5}/5 · food ${r.food}</span></div>`;
  if (r.choice) {
    html += `<div class="card"><h3>Choose a boon</h3><div class="list">${r.choice.map((b) => `<button class="listrow" data-act="raid-boon" data-id="${b}"><span class="grow"><b>${esc(RAID_BOON.get(b)!.name)}</b>${modList(RAID_BOON.get(b)!.mods)}</span></button>`).join('')}</div></div>`;
  }
  html += fightPanel(s);
  if (r.boons.length) html += `<div class="card small"><b>Boons:</b> ${r.boons.map((b) => esc(RAID_BOON.get(b)!.name)).join(', ')}</div>`;
  return html;
}

// --- Pets, completion, museum ----------------------------------------------------------

export function petsView(s: GameState): string {
  return `<div class="card small muted">Pets are found by chance while training a skill or clearing a dungeon. Each one gives a small bonus.</div><div class="petgrid">${PETS.map((p) => {
    const has = s.pets.includes(p.id);
    return `<div class="card pet${has ? '' : ' dim'}">${has ? iconHtml(p.icon, 3) : '<span class="unknown">?</span>'}<b>${has ? esc(p.name) : '???'}</b><small>${esc(p.desc)}</small>${has ? modList(p.mods) : ''}</div>`;
  }).join('')}</div>`;
}

export function completion(s: GameState): { items: [number, number]; monsters: [number, number]; pets: [number, number]; levels: [number, number]; total: number } {
  const src = sources();
  const obtainable = ITEMS.filter((i) => src.has(i.id));
  const items: [number, number] = [obtainable.filter((i) => s.found[i.id]).length, obtainable.length];
  const monsters: [number, number] = [MONSTERS.filter((m) => (s.counters[`kill:${m.id}`] ?? 0) > 0).length, MONSTERS.length];
  const pets: [number, number] = [s.pets.length, PETS.length];
  const levels: [number, number] = [SKILL_LIST.reduce((a, sk) => a + Math.min(99, level(s, sk.id)), 0), SKILL_LIST.length * 99];
  const total = ((items[0] / items[1] + monsters[0] / monsters[1] + pets[0] / pets[1] + levels[0] / levels[1]) / 4) * 100;
  return { items, monsters, pets, levels, total };
}

let srcCache: Set<string> | null = null;

export function completionView(s: GameState): string {
  const c = completion(s);
  srcCache ??= new Set(sources().keys());
  const row = (label: string, [a, b]: [number, number]): string => `<div class="row"><span class="grow">${label}</span><b>${fmtInt(a)}/${fmtInt(b)}</b></div>${bar(a / b, 'thin')}`;
  let html = `<div class="card"><h3>${c.total.toFixed(1)}% complete</h3>${row('Items found', c.items)}${row('Monsters defeated', c.monsters)}${row('Pets', c.pets)}${row('Skill levels', c.levels)}</div><div class="card"><h3>Items</h3><div class="bankgrid small">`;
  for (const it of ITEMS) {
    if (!srcCache.has(it.id)) continue;
    html += s.found[it.id] ? `<span class="slot" title="${esc(it.name)}">${iconHtml(it.icon, 2)}</span>` : '<span class="slot dim">?</span>';
  }
  html += '</div></div><div class="card"><h3>Monsters</h3><div class="bankgrid small">';
  for (const m of MONSTERS) {
    const k = s.counters[`kill:${m.id}`] ?? 0;
    html += k ? `<span class="slot" title="${esc(m.name)}">${iconHtml(m.icon, 2)}<span class="q">${fmtInt(k)}</span></span>` : '<span class="slot dim">?</span>';
  }
  return html + '</div></div>';
}

export function museumView(s: GameState): string {
  let html = '<div class="card small muted">Donate one of every artefact from a dig site to complete its display. Each complete display gives a lasting bonus.</div>';
  for (const site of DIG_SITES) {
    const done = museumComplete(s, site.id);
    html += `<div class="card${done ? ' done' : ''}"><div class="row"><b class="grow">${esc(site.name)}</b><span class="muted small">Archaeology ${site.level}</span></div><div class="row">`;
    site.artefacts.forEach((name, j) => {
      const id = `art-${site.id}-${j}`;
      const given = s.donated.includes(id);
      const have = count(s, id);
      html += `<button class="slot${given ? '' : ' dim'}" data-act="${!given && have ? 'donate' : 'noop'}" data-id="${id}" title="${esc(name)}">${itemIcon(id, 2)}<span class="q">${given ? '✔' : have ? 'Give' : ''}</span></button>`;
    });
    html += `</div>${modList(MUSEUM_REWARDS[site.id]!)}</div>`;
  }
  return html;
}

// --- Stats, log, settings ----------------------------------------------------------

export function statsView(s: GameState): string {
  const c = s.counters;
  const rows: [string, string][] = [
    ['Time played', `${Math.floor((s.time - s.createdAt) / 3_600_000)}h ${Math.floor(((s.time - s.createdAt) % 3_600_000) / 60_000)}m`],
    ['Actions done', fmtInt(c['actions'] ?? 0)], ['Monsters defeated', fmtInt(c['kills'] ?? 0)], ['Deaths', fmtInt(c['deaths'] ?? 0)],
    ['Slayer tasks', fmtInt(c['slayerTasks'] ?? 0)], ['Food eaten', fmtInt(c['eaten'] ?? 0)], ['Bones buried', fmtInt(c['buried'] ?? 0)],
    ['Gold from selling', fmt(c['soldGp'] ?? 0)], ['Gold stolen', fmt(c['stolenGp'] ?? 0)], ['Laps run', fmtInt(c['laps'] ?? 0)],
    ['Hexes surveyed', fmtInt(c['hexesSurveyed'] ?? 0)], ['Gauntlet runs', fmtInt(c['raids'] ?? 0)], ['Crops harvested', fmtInt(c['harvest:any'] ?? 0)],
  ];
  return `<div class="card"><h3>Statistics</h3>${rows.map(([k, v]) => `<div class="row"><span class="grow">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="card"><h3>Dungeons</h3>${AREAS.filter((a) => a.kind === 'dungeon' || a.kind === 'stronghold').map((a) => `<div class="row"><span class="grow">${esc(a.name)}</span><b>${fmtInt(c[`clear:${a.id}`] ?? 0)}</b></div>`).join('')}</div>`;
}

export function logView(s: GameState): string {
  return `<div class="card"><ul class="log">${[...s.log].reverse().map((n) => `<li class="${n.kind}">${esc(n.text)}</li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul></div>`;
}

export function settingsView(s: GameState): string {
  return `<div class="card"><h3>Save</h3><p class="small muted">The game saves itself every few seconds on this device. Copy the code to move your save to another device.</p>
    <div class="acts">${btn('Export save', 'export', {}, 'primary')}${btn('Import save', 'import')}</div></div>
    <div class="card"><h3>Options</h3>
      <label class="row"><span class="grow">Sound</span><input type="checkbox" data-input="sound" ${s.settings.sound ? 'checked' : ''}/></label>
      <label class="row"><span class="grow">Show the offline report</span><input type="checkbox" data-input="offlineReport" ${s.settings.offlineReport ? 'checked' : ''}/></label>
      <label class="row"><span class="grow">Character name</span><input type="text" maxlength="20" value="${esc(s.name)}" data-input="name"/></label></div>
    <div class="card"><h3>Game mode: ${esc(MODES[s.mode].name)}</h3><p class="small muted">${esc(MODES[s.mode].desc)}</p>
      <h4>Start over</h4><div class="list">${(Object.keys(MODES) as GameMode[]).map((m) => `<button class="listrow" data-act="new-game" data-mode="${m}"><span class="grow"><b>New ${esc(MODES[m].name)} game</b><small>${esc(MODES[m].desc)}</small></span></button>`).join('')}</div>
      <p class="small warn">Starting over replaces this save. Export it first if you want to keep it.</p></div>
    <div class="card small muted">Emberhold · an idle RPG in the spirit of Melvor Idle. All art, names and numbers are original.</div>`;
}

export { describe };
