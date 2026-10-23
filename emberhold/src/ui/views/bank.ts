/**
 * The bank: one grid of everything you own, with search, sort and a
 * category filter, and an item sheet for doing things with an item.
 */
import { ITEM, item } from '../../data/items';
import { SKILL_INFO } from '../../data/skills';
import type { Item, ItemCategory } from '../../data/types';
import { bankSlots, count } from '../../game/core';
import { equipBlocker, foodHeal } from '../../game/combat';
import type { GameState } from '../../state/types';
import type { Ui } from '../state';
import { btn, esc, fmt, fmtInt, iconHtml, itemIcon, modList } from '../kit';

const CATS: [string, string, ItemCategory[]][] = [
  ['all', 'All', []],
  ['gear', 'Gear', ['weapon', 'armour', 'ammo', 'jewelry', 'cape', 'tablet']],
  ['food', 'Food', ['food', 'fish']],
  ['raw', 'Materials', ['ore', 'bar', 'log', 'gem', 'essence', 'hide', 'material', 'bone']],
  ['farm', 'Farming', ['seed', 'herb']],
  ['magic', 'Runes & potions', ['rune', 'potion']],
  ['other', 'Other', ['artefact', 'chest', 'misc', 'animal', 'currency']],
];

export function bankView(s: GameState, ui: Ui): string {
  const cat = CATS.find((c) => c[0] === ui.bankCat) ?? CATS[0]!;
  const q = ui.bankSearch.trim().toLowerCase();
  let ids = [...s.bankOrder];
  if (cat[2].length) ids = ids.filter((id) => cat[2].includes(item(id).category));
  if (q) ids = ids.filter((id) => item(id).name.toLowerCase().includes(q));
  if (ui.bankSort === 'name') ids.sort((a, b) => item(a).name.localeCompare(item(b).name));
  else if (ui.bankSort === 'value') ids.sort((a, b) => item(b).sell * count(s, b) - item(a).sell * count(s, a));
  else if (ui.bankSort === 'qty') ids.sort((a, b) => count(s, b) - count(s, a));
  const value = s.bankOrder.reduce((a, id) => a + item(id).sell * count(s, id), 0);
  let html = `<div class="bankbar">
    <input type="search" placeholder="Search the bank" value="${esc(ui.bankSearch)}" data-input="bankSearch" />
    <select data-input="bankSort">${(['order', 'name', 'value', 'qty'] as const).map((o) => `<option value="${o}"${ui.bankSort === o ? ' selected' : ''}>${o === 'order' ? 'Oldest first' : o === 'name' ? 'Name' : o === 'value' ? 'Value' : 'Quantity'}</option>`).join('')}</select>
  </div>
  <div class="tabs scroll">${CATS.map((c) => `<button class="tab${c[0] === cat[0] ? ' on' : ''}" data-act="bank-cat" data-cat="${c[0]}">${c[1]}</button>`).join('')}</div>
  <div class="summary small">${s.bankOrder.length}/${bankSlots(s)} slots · worth ${fmt(value)} gold</div>
  <div class="bankgrid">`;
  for (const id of ids) {
    const it = item(id);
    html += `<button class="slot${s.locked.includes(id) ? ' lockd' : ''}" data-act="item" data-id="${id}" title="${esc(it.name)}">${iconHtml(it.icon, 2)}<span class="q">${fmtInt(count(s, id))}</span></button>`;
  }
  if (!ids.length) html += `<p class="muted center">${q ? 'Nothing matches.' : 'Nothing here yet.'}</p>`;
  html += '</div>';
  return html;
}

export function statLines(it: Item): string {
  const e = it.equip;
  if (!e) return '';
  const lines: string[] = [];
  if (e.style) lines.push(`${e.style[0]!.toUpperCase()}${e.style.slice(1)}${e.damageType ? ` · ${e.damageType} damage` : ''}${e.speed ? ` · ${(e.speed / 1000).toFixed(1)}s` : ''}${e.twoHanded ? ' · two-handed' : ''}`);
  const st: string[] = [];
  if (e.accuracy) st.push(`Accuracy +${e.accuracy}`);
  if (e.power) st.push(`${e.style === 'magic' ? 'Magic damage' : 'Strength'} +${e.power}${e.style === 'magic' ? '%' : ''}`);
  if (e.defMelee || e.defRanged || e.defMagic) st.push(`Defence ${e.defMelee ?? 0}/${e.defRanged ?? 0}/${e.defMagic ?? 0}`);
  if (e.dr) st.push(`Damage reduction ${e.dr}%`);
  if (st.length) lines.push(st.join(' · '));
  if (e.resist) lines.push(Object.entries(e.resist).map(([k, v]) => `${Math.round((v ?? 0) * 100)}% ${k} resistance`).join(' · '));
  if (e.req) lines.push(`Requires ${Object.entries(e.req).map(([k, v]) => `${SKILL_INFO[k as keyof typeof SKILL_INFO]?.name ?? k} ${v}`).join(', ')}`);
  return `<div class="stats">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>${e.mods ? modList(e.mods) : ''}`;
}

export function itemSheet(s: GameState, id: string, ui: Ui): string {
  const it = ITEM.get(id);
  if (!it) return '';
  const have = count(s, id);
  const acts: string[] = [];
  if (it.equip) {
    const why = equipBlocker(s, id);
    acts.push(btn(it.familiar ? 'Equip (summon 1)' : 'Equip', 'equip', { id }, 'primary', !!why || !have));
    if (it.familiar) acts.push(btn('Equip (summon 2)', 'equip', { id, slot: 'summon2' }, '', !!why || !have));
    if (why) acts.push(`<span class="warn small">${esc(why)}</span>`);
  }
  if (it.heal) acts.push(btn('Equip as food', 'equip-food', { id }, it.equip ? '' : 'primary', !have));
  if (it.bury) acts.push(btn('Bury one', 'bury', { id, n: 1 }), btn('Bury all', 'bury', { id, n: have }));
  if (it.opens) acts.push(btn('Open one', 'open', { id, n: 1 }, 'primary'), btn('Open all', 'open', { id, n: have }));
  if (it.potion) acts.push(btn('Drink', 'drink', { id }, 'primary'));
  if (it.category === 'artefact') acts.push(btn(s.donated.includes(id) ? 'On display' : 'Donate to museum', 'donate', { id }, '', s.donated.includes(id)));
  const sellOpts = [1, 10, 100].filter((n) => n < have);
  return `<div class="sheet-item"><div class="row">${itemIcon(id, 3)}<div class="grow"><h3>${esc(it.name)}</h3><div class="muted small">${esc(it.category)} · you have ${fmtInt(have)}</div></div></div>
    ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
    ${it.heal ? `<p>Heals <b>${foodHeal(s, id)}</b> HP.</p>` : ''}
    ${it.bury ? `<p>Bury for <b>${it.bury}</b> Prayer XP and points.</p>` : ''}
    ${it.potion ? `<p>${it.potion.charges} charges for ${esc(it.potion.skill === 'combat' ? 'combat' : SKILL_INFO[it.potion.skill].name)}.</p>${modList(it.potion.mods)}` : ''}
    ${it.familiar ? `<p>Familiar for ${esc(it.familiar.skill === 'combat' ? 'combat' : SKILL_INFO[it.familiar.skill].name)}${it.familiar.maxHit ? `, hits up to ${it.familiar.maxHit}` : ''}.</p>${modList(it.familiar.mods)}` : ''}
    ${statLines(it)}
    <div class="acts">${acts.join('')}</div>
    <div class="sell"><span>Sell for ${fmt(it.sell)} each</span><div class="acts">${sellOpts.map((n) => btn(`×${n}`, 'sell', { id, n }, 'small')).join('')}${btn(`All (${fmt(it.sell * have)})`, 'sell', { id, n: have }, 'small', !have)}${btn(`All but 1`, 'sell', { id, n: Math.max(0, have - 1) }, 'small', have < 2)}</div></div>
    <div class="acts">${btn(s.locked.includes(id) ? 'Unlock slot' : 'Lock slot', 'lock', { id }, 'small ghost')}</div>
    <p class="small muted">${ui.view === 'bank' ? 'A locked slot keeps its place in the bank even at zero.' : ''}</p></div>`;
}
