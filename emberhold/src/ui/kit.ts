/**
 * Small HTML builders shared by every view.
 */
import { ITEM } from '../data/items';
import { fmt, fmtInt } from '../num/format';
import { iconHtml } from '../sprites/atlas';
import { esc } from './dom';

export { esc, fmt, fmtInt, iconHtml };

export function bar(frac: number, cls = '', label = '', prog = ''): string {
  const pct = Math.max(0, Math.min(100, frac * 100));
  return `<div class="bar ${cls}"${prog ? ` data-prog="${prog}"` : ''}><div class="fill" style="width:${pct.toFixed(1)}%"></div>${label ? `<span>${label}</span>` : ''}</div>`;
}

export function btn(label: string, act: string, args: Record<string, string | number> = {}, cls = '', disabled = false): string {
  const data = Object.entries(args).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join('');
  return `<button class="btn ${cls}" data-act="${act}"${data}${disabled ? ' disabled' : ''}>${label}</button>`;
}

export function itemIcon(id: string, scale = 2): string {
  const it = ITEM.get(id);
  return iconHtml(it?.icon ?? 'ui.star', scale);
}

/** An item with a quantity, coloured by whether you have enough. */
export function chip(id: string, qty: number, have?: number): string {
  const it = ITEM.get(id);
  const short = have !== undefined && have < qty;
  return `<span class="chip${short ? ' short' : ''}" title="${esc(it?.name ?? id)}">${itemIcon(id, 1)}<b>${fmtInt(qty)}</b>${have !== undefined ? `<i>/${fmtInt(have)}</i>` : ''}</span>`;
}

export function secs(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1).replace(/\.0$/, '')}s` : `${Math.round(s)}s`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function signed(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n);
}

const MOD_LABELS: Record<string, string> = {
  skillXP: 'XP in all skills', combatXP: 'Combat XP', gpGain: 'Gold gained', lootDouble: 'Chance to double loot', meleeAccuracy: 'Melee accuracy',
  rangedAccuracy: 'Ranged accuracy', magicAccuracy: 'Magic accuracy', meleeMaxHit: 'Melee max hit', rangedMaxHit: 'Ranged max hit', magicMaxHit: 'Magic damage',
  damageReduction: 'Damage reduction', maxHP: 'Max HP', hpRegen: 'HP regeneration', lifesteal: 'Lifesteal', foodHeal: 'Food healing', attackInterval: 'Attack interval',
  prayerCost: 'Prayer cost', runePreserve: 'Rune preservation', ammoPreserve: 'Arrow preservation', farmYield: 'Harvest size', farmGrowth: 'Growth speed',
  ranchProduction: 'Ranch production', constructionProduction: 'Settlement production', stardust: 'Stardust', guildXP: 'Guild reputation', slayerCoins: 'Slayer coins',
  slayerDamage: 'Damage on slayer task', gemChance: 'Extra gem chance', protectItem: 'Keep items on death', buryBonus: 'Prayer XP from bones', petChance: 'Pet chance',
  raidCoins: 'Gauntlet coins',
};
const SCOPED: Record<string, string> = {
  skillXP: 'XP', interval: 'faster', doubleChance: 'double chance', preserve: 'save inputs', success: 'success', infiniteRune: 'endless', resist: 'resistance',
  protect: 'protection from', 'damageVs': 'damage vs',
};

/** One modifier in words: "+5% Woodcutting XP". */
export function modText(key: string, v: number): string {
  const [k, scope] = key.split(':');
  if (scope) {
    const name = scope === 'all' ? 'all skills' : scope.startsWith('rune-') ? ITEM.get(scope)?.name ?? scope : scope[0]!.toUpperCase() + scope.slice(1);
    if (k === 'infiniteRune') return `Endless ${name}s`;
    if (k === 'resist') return `${signed(Math.round(v * 100))}% ${name} resistance`;
    if (k === 'protect') return `${signed(v)}% protection from ${name}`;
    if (k === 'interval') return `${name} ${v > 0 ? `${v}% faster` : `${-v}% slower`}`;
    return `${signed(v)}% ${name} ${SCOPED[k!] ?? k}`;
  }
  if (k === 'protectItem') return 'Keep your gear when you die';
  if (k === 'attackInterval') return `Attacks ${v < 0 ? `${-v}% faster` : `${v}% slower`}`;
  if (k === 'prayerCost') return `Prayers cost ${v < 0 ? `${-v}% less` : `${v}% more`}`;
  return `${signed(v)}${k === 'hpRegen' || k === 'damageReduction' ? '' : ''}% ${MOD_LABELS[k!] ?? k}`;
}

export function modList(m: Record<string, number>): string {
  const entries = Object.entries(m).filter(([, v]) => v);
  if (!entries.length) return '';
  return `<ul class="mods">${entries.map(([k, v]) => `<li>${esc(modText(k, v))}</li>`).join('')}</ul>`;
}
