/**
 * Combat: the fight, then tabs for where to fight, gear, prayer, magic and
 * slayer.
 */
import { AREAS, AURORAS, MONSTER, PRAYERS, SLAYER_TIERS, SPELLS } from '../../data/combat';
import { ITEM, item } from '../../data/items';
import { SLOTS, type AreaKind, type Monster, type Slot } from '../../data/types';
import { combatLevel, count, level } from '../../game/core';
import { areaBlocker, currentMonster, currentSpell, expectedDps, hitChance, playerStats, styleOf, triangle, LOOT_SLOTS, foodHeal } from '../../game/combat';
import type { GameState } from '../../state/types';
import type { Ui } from '../state';
import { bar, btn, chip, esc, fmt, fmtInt, iconHtml, itemIcon, modList, pct } from '../kit';
import { statLines } from './bank';

const STYLE_ICON: Record<string, string> = { melee: '⚔', ranged: '🏹', magic: '✦' };
const SLOT_LABEL: Record<Slot, string> = {
  weapon: 'Weapon', shield: 'Shield', helmet: 'Head', body: 'Body', legs: 'Legs', boots: 'Feet', gloves: 'Hands', cape: 'Cape', amulet: 'Neck', ring: 'Ring',
  ammo: 'Ammo', summon1: 'Summon', summon2: 'Summon',
};

export function fightPanel(s: GameState): string {
  const c = s.combat;
  const p = playerStats(s);
  const mon = c ? currentMonster(s) : null;
  const food = s.food[s.foodSlot] ?? s.food.find(Boolean) ?? null;
  const raid = s.raid;
  let html = `<div class="card fight">
    <div class="fighter me"><div class="row"><b class="grow">You · cb ${combatLevel(s)}</b><span class="muted small">${STYLE_ICON[p.style]} ${p.damageType}</span></div>
      ${bar(s.hp / p.maxHp, 'hp', `${Math.ceil(s.hp)} / ${p.maxHp}`)}
      ${c ? bar(0, 'thin timer', '', 'ptimer') : ''}
      <div class="small muted">Max hit ${p.maxHit} · DR ${Math.round(p.dr)}% · ${(p.speed / 1000).toFixed(1)}s${raid ? '' : ` · prayer ${Math.floor(s.prayerPoints)}`}</div></div>`;
  if (mon && c) {
    const e = c.enemy;
    const tri = triangle(p.style, mon.style);
    html += `<div class="fighter foe"><div class="row">${iconHtml(mon.icon, 3)}<div class="grow"><b>${esc(mon.name)}</b> <span class="muted small">cb ${mon.combatLevel} · ${STYLE_ICON[mon.style]} ${mon.damageType}</span>
        <div class="small ${tri > 0 ? 'good' : tri < 0 ? 'warn' : 'muted'}">${tri > 0 ? 'Your style is strong against it' : tri < 0 ? 'Your style is weak against it' : 'Even match-up'} · you hit ${pct(hitChance(p.accuracy, mon.evasion[p.style]))}</div></div></div>
      ${e ? bar(e.hp / e.maxHp, 'hp foehp', `${Math.max(0, Math.ceil(e.hp))} / ${e.maxHp}`) : bar(0, 'hp foehp', raid?.choice ? 'Choose a boon' : 'Next one coming…')}
      ${e ? bar(0, 'thin timer foe', '', 'etimer') : ''}
      ${resistLine(mon)}</div>`;
  }
  html += `<div class="acts">
    ${c ? btn(`Eat ${food ? `${esc(item(food.item).name)} (${raid ? raid.food : food.qty})` : raid ? `(${raid.food})` : '(none)'}`, 'eat', {}, '', raid ? raid.food <= 0 : !food) : ''}
    ${c ? btn(raid ? 'Leave the Gauntlet' : 'Run', 'run', {}, 'danger') : ''}
    ${!raid && s.loot.length ? btn(`Take loot (${s.loot.length}/${LOOT_SLOTS})`, 'loot', {}, 'primary') : ''}
  </div>`;
  if (!raid && s.loot.length) html += `<div class="chips loot">${s.loot.map((l) => chip(l.item, l.qty)).join('')}</div>`;
  if (s.slayerTask && !raid) html += `<div class="small">Slayer task: ${esc(MONSTER.get(s.slayerTask.monster)?.name ?? '')} · ${s.slayerTask.left} left</div>`;
  return html + '</div>';
}

function resistLine(m: Monster): string {
  const entries = Object.entries(m.resist).filter(([, v]) => v);
  const weak = entries.filter(([, v]) => v! < 0).sort((a, b) => a[1]! - b[1]!).map(([k, v]) => `${k} ${Math.round(-v! * 100)}%`);
  const strong = entries.filter(([, v]) => v! > 0).sort((a, b) => b[1]! - a[1]!).map(([k, v]) => `${k} ${Math.round(v! * 100)}%`);
  if (!weak.length && !strong.length) return '';
  return `<div class="small">${weak.length ? `<span class="good">Weak: ${esc(weak.join(', '))}</span> ` : ''}${strong.length ? `<span class="warn">Resists: ${esc(strong.join(', '))}</span>` : ''}</div>`;
}

export function combatView(s: GameState, ui: Ui): string {
  let html = fightPanel(s);
  html += `<div class="tabs">${(['areas', 'gear', 'prayer', 'magic', 'slayer'] as const).map((t) => `<button class="tab${ui.combatTab === t ? ' on' : ''}" data-act="combat-tab" data-tab="${t}">${t[0]!.toUpperCase()}${t.slice(1)}</button>`).join('')}</div>`;
  switch (ui.combatTab) {
    case 'areas':
      html += areasTab(s, ui);
      break;
    case 'gear':
      html += gearTab(s);
      break;
    case 'prayer':
      html += prayerTab(s);
      break;
    case 'magic':
      html += magicTab(s);
      break;
    case 'slayer':
      html += slayerTab(s);
      break;
  }
  return html;
}

const AREA_KINDS: [AreaKind, string][] = [['combat', 'Areas'], ['slayer', 'Slayer'], ['dungeon', 'Dungeons'], ['stronghold', 'Strongholds'], ['abyss', 'The Rift']];

function areasTab(s: GameState, ui: Ui): string {
  let html = `<div class="tabs scroll sub">${AREA_KINDS.map(([k, l]) => `<button class="tab${ui.areaKind === k ? ' on' : ''}" data-act="area-kind" data-kind="${k}">${l}</button>`).join('')}</div>`;
  for (const a of AREAS.filter((x) => (ui.areaKind === 'dungeon' ? x.kind === 'dungeon' : x.kind === ui.areaKind))) {
    const why = areaBlocker(s, a.id);
    const open = ui.openArea === a.id;
    const clears = s.counters[`clear:${a.id}`] ?? 0;
    const levels = a.monsters.map((m) => MONSTER.get(m)!.combatLevel);
    html += `<div class="card area${why ? ' dim' : ''}"><button class="row areahead" data-act="area" data-id="${a.id}">${iconHtml(a.icon, 2)}<span class="grow"><b>${esc(a.name)}</b><small class="muted"> cb ${Math.min(...levels)}–${Math.max(...levels)}${a.kind === 'dungeon' || a.kind === 'stronghold' ? ` · cleared ${clears}×` : ''}</small></span><span>${open ? '▾' : '▸'}</span></button>`;
    if (open) {
      html += `<p class="small muted">${esc(a.desc)}</p>`;
      if (a.hazard) html += `<p class="small warn">${esc(a.hazard.desc)}</p>`;
      if (why) html += `<p class="warn small">${esc(why)}</p>`;
      if (a.kind === 'dungeon' || a.kind === 'stronghold') {
        html += `<div class="chips">${a.monsters.map((m) => `<span class="chip">${iconHtml(MONSTER.get(m)!.icon, 1)}<b>${MONSTER.get(m)!.combatLevel}</b></span>`).join('')}</div>`;
        if (a.reward) html += `<div class="small">Reward: ${a.reward.map((r) => chip(r.item, r.qty)).join('')}</div>`;
        html += btn(s.combat?.area === a.id ? 'Fighting…' : 'Enter', 'fight', { area: a.id }, 'primary', !!why || s.combat?.area === a.id);
      } else {
        for (const mid of a.monsters) html += monsterRow(s, MONSTER.get(mid)!, a.id, !!why);
      }
    }
    html += '</div>';
  }
  return html;
}

function monsterRow(s: GameState, m: Monster, area: string, blocked: boolean): string {
  const fighting = s.combat?.area === area && s.combat.target === m.id;
  const dps = expectedDps(s, m);
  const kills = s.counters[`kill:${m.id}`] ?? 0;
  return `<div class="mon${fighting ? ' active' : ''}">${iconHtml(m.icon, 2)}<div class="grow"><b>${esc(m.name)}</b> <span class="muted small">cb ${m.combatLevel} · ${m.hp} hp · ${STYLE_ICON[m.style]} ${m.damageType} up to ${m.maxHit}</span>
    ${resistLine(m)}<div class="small muted">You: ~${fmt(dps)} dmg/s · ${kills} killed${m.slayerLevel ? ` · Slayer ${m.slayerLevel}` : ''}</div></div>
    ${btn(fighting ? '■' : 'Fight', fighting ? 'run' : 'fight', { area, monster: m.id }, fighting ? 'small danger' : 'small primary', blocked && !fighting)}</div>`;
}

function gearTab(s: GameState): string {
  const eq = s.loadouts[s.loadout]!;
  let html = `<div class="card"><div class="row"><h3 class="grow">Equipment</h3>${s.loadouts.length > 1 ? s.loadouts.map((_, i) => `<button class="pill${i === s.loadout ? ' on' : ''}" data-act="loadout" data-n="${i}">Set ${i + 1}</button>`).join('') : ''}</div><div class="gear">`;
  for (const slot of SLOTS) {
    const st = eq[slot];
    html += `<button class="gslot${st ? '' : ' empty'}" data-act="${st ? 'unequip' : 'noop'}" data-slot="${slot}">${st ? itemIcon(st.item, 2) : ''}<small>${st ? (st.qty > 1 ? fmtInt(st.qty) : esc(item(st.item).name)) : SLOT_LABEL[slot]}</small></button>`;
  }
  html += '</div><h4>Food</h4><div class="gear food">';
  s.food.forEach((f, i) => {
    html += `<button class="gslot${f ? '' : ' empty'}${i === s.foodSlot ? ' on' : ''}" data-act="food-slot" data-n="${i}">${f ? itemIcon(f.item, 2) : ''}<small>${f ? `${fmtInt(f.qty)} · ${foodHeal(s, f.item)}hp` : 'Empty'}</small></button>`;
  });
  html += `</div><p class="small muted">Tap an item to take it off. Tap a food slot to eat from it; hold the Bank to equip more. ${s.upgrades['autoeat'] ? `Auto-eat tier ${s.upgrades['autoeat']}.` : 'Buy Auto Eat in the shop to eat on your own.'}</p>
    ${s.food.some(Boolean) ? btn('Return food to bank', 'unequip-food', {}, 'small ghost') : ''}</div>`;
  const p = playerStats(s);
  html += `<div class="card small"><b>${STYLE_ICON[p.style]} ${p.style}</b> · ${p.damageType} damage · accuracy ${fmt(p.accuracy)} · max hit ${p.maxHit} · DR ${Math.round(p.dr)}% · evasion ${fmt(p.evasion.melee)}/${fmt(p.evasion.ranged)}/${fmt(p.evasion.magic)}
    ${Object.entries(p.resist).filter(([, v]) => v).length ? `<div>Resist: ${Object.entries(p.resist).filter(([, v]) => v).map(([k, v]) => `${k} ${Math.round(v! * 100)}%`).join(', ')}</div>` : ''}
    <div class="row">${styleButtons(s)}</div></div>`;
  const equippable = s.bankOrder.filter((id) => ITEM.get(id)?.equip || ITEM.get(id)?.heal);
  html += `<div class="card"><h3>From the bank</h3><div class="list">${equippable.map((id) => {
    const it = item(id);
    return `<button class="listrow" data-act="item" data-id="${id}">${itemIcon(id)}<span class="grow"><b>${esc(it.name)}</b><small>${it.equip ? esc(it.equip.slot) : `food · ${foodHeal(s, id)} hp`}</small></span><span>${fmtInt(count(s, id))}</span></button>`;
  }).join('') || '<p class="muted">Nothing to equip.</p>'}</div></div>`;
  return html;
}

export function styleButtons(s: GameState): string {
  const st = styleOf(s);
  const opts: [string, string, string][] = st === 'melee'
    ? [['accurate', 'Accurate (Attack)', 'meleeStyle'], ['aggressive', 'Aggressive (Strength)', 'meleeStyle'], ['defensive', 'Defensive (Defence)', 'meleeStyle']]
    : st === 'ranged'
      ? [['accurate', 'Accurate', 'rangedStyle'], ['rapid', 'Rapid', 'rangedStyle'], ['longrange', 'Long range (+Defence)', 'rangedStyle']]
      : [['magic', 'Standard (Magic)', 'magicStyle'], ['defensive', 'Defensive (+Defence)', 'magicStyle']];
  const cur = st === 'melee' ? s.meleeStyle : st === 'ranged' ? s.rangedStyle : s.magicStyle;
  return opts.map(([v, l, k]) => `<button class="pill${cur === v ? ' on' : ''}" data-act="style" data-k="${k}" data-v="${v}">${l}</button>`).join('');
}

function prayerTab(s: GameState): string {
  const lvl = level(s, 'prayer');
  const bones = s.bankOrder.filter((id) => ITEM.get(id)?.bury);
  let html = `<div class="card"><div class="row"><h3 class="grow">Prayer</h3><b>${Math.floor(s.prayerPoints)} points</b></div><p class="small muted">Up to two prayers at once. Each attack drains points. Bury bones for points and XP.</p>
    <div class="chips">${bones.map((b) => `<button class="pill" data-act="bury" data-id="${b}" data-n="${count(s, b)}">${itemIcon(b, 1)} Bury ${fmtInt(count(s, b))}</button>`).join('') || '<span class="muted small">No bones in the bank.</span>'}</div></div><div class="list">`;
  for (const p of PRAYERS) {
    const on = s.prayers.includes(p.id);
    html += `<button class="listrow${on ? ' on' : ''}${p.level > lvl ? ' dim' : ''}" data-act="prayer" data-id="${p.id}" ${p.level > lvl ? 'disabled' : ''}>${iconHtml(p.icon, 2)}<span class="grow"><b>${esc(p.name)}</b><small>Lv ${p.level} · ${p.cost} per attack</small>${modList(p.mods)}</span><span>${on ? '●' : '○'}</span></button>`;
  }
  return html + '</div>';
}

function magicTab(s: GameState): string {
  const lvl = level(s, 'magic');
  const cur = currentSpell(s);
  let html = `<div class="card small muted">Equip a staff to cast. The chosen spell sets your damage type: pick the element your target is weak to. Elemental staves pay for their own rune.</div><div class="list">`;
  for (const sp of SPELLS) {
    const ok = sp.level <= lvl;
    html += `<button class="listrow${cur === sp.id ? ' on' : ''}${ok ? '' : ' dim'}" data-act="spell" data-id="${sp.id}" ${ok ? '' : 'disabled'}>${iconHtml(sp.icon, 2)}<span class="grow"><b>${esc(sp.name)}</b><small>Lv ${sp.level} · max ${sp.maxHit} · ${sp.element}</small></span><span class="chips">${sp.runes.map((r) => chip(r.item, r.qty, count(s, r.item))).join('')}</span></button>`;
  }
  html += '</div><h3 class="section">Auroras</h3><div class="list">';
  for (const a of AURORAS) {
    const on = s.aurora === a.id;
    const ok = a.level <= lvl;
    html += `<button class="listrow${on ? ' on' : ''}${ok ? '' : ' dim'}" data-act="aurora" data-id="${a.id}" ${ok ? '' : 'disabled'}><span class="grow"><b>${esc(a.name)}</b><small>Lv ${a.level} · runes per attack</small>${modList(a.mods)}</span><span class="chips">${a.runes.map((r) => chip(r.item, r.qty, count(s, r.item))).join('')}</span></button>`;
  }
  return html + '</div>';
}

function slayerTab(s: GameState): string {
  const t = s.slayerTask;
  const cb = combatLevel(s);
  let html = `<div class="card"><div class="row"><h3 class="grow">Slayer</h3><span>${iconHtml('ui.slayer', 1)} <b>${fmtInt(s.slayerCoins)}</b></span></div>`;
  if (t) {
    const m = MONSTER.get(t.monster)!;
    html += `<div class="row">${iconHtml(m.icon, 3)}<div class="grow"><b>${esc(m.name)}</b><div class="small">${t.left} of ${t.total} left · ${esc(t.tier)}</div>${bar(1 - t.left / t.total, 'thin')}</div></div>
      <p class="small muted">Kills on task pay slayer coins and Slayer XP. Find it in ${esc(AREAS.find((a) => a.kind !== 'dungeon' && a.monsters.includes(m.id))?.name ?? 'the world')}.</p>
      ${btn('Fight it', 'slayer-fight', {}, 'primary')} ${btn('Skip (30 coins)', 'shop-buy', { id: 'slay-reroll' }, 'ghost small', s.slayerCoins < 30)}`;
  } else {
    html += '<p class="small muted">Ask for a task. Harder tiers pay more coins per kill.</p><div class="acts">';
    for (const tier of SLAYER_TIERS) html += btn(`${tier.name}${cb < tier.combat ? ` (cb ${tier.combat})` : ''}`, 'slayer-task', { tier: tier.id }, '', cb < tier.combat);
    html += '</div>';
  }
  html += `<p class="small">${btn('Slayer shop', 'shop-tab', { tab: 'slayer' }, 'small')}</p></div>`;
  return html;
}

export { statLines };
