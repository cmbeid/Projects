import { CLASS } from '../data/crew';
import { STORY_BY_ID } from '../data/story';
import { checkOdds, choiceAffordable, choiceShown, eventView, statName } from '../game/events';
import { iconHtml } from '../sprites/atlas';
import type { GameState } from '../state/types';
import { esc } from './dom';
import { changeClass } from './text';

const btn = (act: string, label: string, o: { cls?: string; disabled?: boolean; arg?: string | number } = {}): string =>
  `<button class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg !== undefined ? ` data-arg="${o.arg}"` : ''}${o.disabled ? ' disabled' : ''}>${label}</button>`;

function changes(lines: string[]): string {
  return lines.length ? `<ul class="changes">${lines.map((l) => `<li class="${changeClass(l)}">${esc(l)}</li>`).join('')}</ul>` : '';
}

export function eventModal(s: GameState): string {
  const ev = s.event!;
  const v = eventView(s)!;
  const story = ev.source === 'story';
  const head = `<div class="row" style="margin-bottom:8px">${iconHtml(story ? 'ent-objective' : 'node-anomaly', 3)}<h2 style="margin:0">${esc(v.title)}</h2></div>`;
  if (ev.result !== null) {
    return `${head}<p class="text">${esc(ev.result)}</p>${changes(ev.changes)}${btn('close-event', ev.then?.combat ? 'Battle stations!' : 'Continue', { cls: 'primary block' })}`;
  }
  const choices = v.choices
    .map((c, i) => {
      if (!choiceShown(s, c)) return '';
      const afford = choiceAffordable(s, c);
      let odds = '';
      if (c.check) {
        const o = checkOdds(s, c.check);
        odds = `${statName(c.check.stat)} check · ${o.crew ? esc(o.crew.name.split(' ')[0]!) : 'nobody'} · ${Math.round(o.chance * 100)}%${c.check.cls ? ` (${CLASS.get(c.check.cls)!.name}s get a bonus)` : ''}`;
      }
      const cost = c.req?.res || c.req?.mats || c.req?.items ? (afford ? '' : 'You can\'t afford this') : '';
      const tagged = c.req?.origin || c.req?.flag || c.req?.rep ? '★ ' : '';
      return `<button class="btn choice" data-act="choose" data-arg="${i}"${afford ? '' : ' disabled'}>${tagged}${esc(c.label)}${odds || cost ? `<span class="odds">${[odds, cost].filter(Boolean).join(' · ')}</span>` : ''}</button>`;
    })
    .join('');
  const text = story ? STORY_BY_ID.get(ev.id)!.text : v.text;
  return `${head}<p class="text">${esc(text)}</p><div class="choices">${choices}</div>`;
}

export function reportModal(s: GameState): string {
  const r = s.report!;
  return `<h2>${esc(r.title)}</h2>${changes(r.lines)}${btn('close-report', 'Continue', { cls: 'primary block' })}`;
}

export function lostModal(s: GameState): string {
  const days = s.lost?.days ?? 0;
  return `<h2 class="bad">Signal lost</h2><p class="text">The Wren went dark. Its log recovers from the last time it docked${days ? `, ${days} day${days === 1 ? '' : 's'} back` : ''}. What happened after never happened.\n\nThe Wake sends what supplies it can spare, and the crew are patched up.</p>${btn('lost-ack', 'Try again', { cls: 'primary block' })}`;
}

export function settingsModal(s: GameState, saveOk: boolean): string {
  return `<h2>Settings</h2>
    <div class="stack"><label class="small">Sound effects<input class="slider" type="range" min="0" max="100" value="${s.settings.sfx}" data-input="sfx"></label>
    <label class="small">Music<input class="slider" type="range" min="0" max="100" value="${s.settings.music}" data-input="music"></label>
    <div class="row">${btn('mute', s.settings.muted ? 'Unmute' : 'Mute all')}${document.fullscreenEnabled ? btn('fullscreen', 'Full screen') : ''}</div>
    <p class="small muted">${saveOk ? 'Progress saves on this device after everything you do. Docking at a station saves a checkpoint you return to if the Wren is lost.' : '<span class="warn">This browser is not letting the game save. Progress will be lost when you close it.</span>'}</p>
    <div class="row">${btn('export', 'Copy save code')}${btn('import', 'Import save code')}</div>
    <textarea class="code" readonly data-input="export" placeholder="Your save code appears here."></textarea>
    <div class="row spread">${btn('reset', 'Start over', { cls: 'danger small' })}${btn('close-modal', 'Done', { cls: 'primary' })}</div></div>`;
}

export function importModal(): string {
  return `<h2>Import a save</h2><p class="small muted">Paste a code copied from Settings on another device. It replaces the current voyage.</p>
    <textarea class="code" data-input="import" placeholder="Paste the code here"></textarea>
    <div class="row spread" style="margin-top:10px">${btn('close-modal', 'Cancel')}${btn('import-go', 'Load it', { cls: 'primary' })}</div>`;
}

export function confirmResetModal(): string {
  return `<h2>Start over?</h2><p class="text">This deletes the current voyage from this device. It can't be undone.</p><div class="row spread">${btn('close-modal', 'Keep playing')}${btn('reset-go', 'Delete and start over', { cls: 'danger' })}</div>`;
}
