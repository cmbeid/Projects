import { onReady, setMuted, setVolumes, suspend, unlock } from '../audio/index';
import { Music } from '../audio/music';
import {
  sfxBreak, sfxBuy, sfxCoin, sfxCraft, sfxDescent, sfxGem, sfxHit, sfxLevel, sfxMission, sfxSkill, sfxSmelt, sfxTick,
} from '../audio/sfx';
import { BIOMES, biomeAt } from '../data/biomes';
import { GEAR_BASE } from '../data/gear';
import { MATERIAL } from '../data/materials';
import { CRAFT_BY_ID, REFINE_BY_ID } from '../data/recipes';
import type { ConsumableId } from '../data/types';
import type { SkillId } from '../data/progression';
import { batchesAffordable, clearSlot, craft, furnaceSlots, queueRefine } from '../game/crafting';
import { derive } from '../game/derive';
import { buyMachine, buyUpgrade, sell, sellAllOre, spendAll } from '../game/economy';
import { tick } from '../game/engine';
import { on, type GameEvent } from '../game/events';
import { activeStory, claimContract, claimStory, progress, refreshContracts } from '../game/missions';
import { setDepth, spawnBlock, tap, xpForLevel } from '../game/mining';
import { applyOffline, type OfflineReport } from '../game/offline';
import { buyEcho, descend, echoGain, strikeBargain } from '../game/prestige';
import { biomeText, musicFor, musicKey } from '../game/story';
import { BARGAINS } from '../data/flags';
import { equip, rankPassive, salvage, spendStat, useConsumable, useSkill } from '../game/rpg';
import { fmt, fmtInt, fmtTime } from '../num/format';
import { Scene } from '../render/scene';
import { iconHtml } from '../sprites/atlas';
import { clearLocal, exportSave, importSave, saveLocal } from '../state/persistence';
import type { CoreStat, GameState } from '../state/types';
import { esc, morph } from './dom';
import {
  TABS, renderCraft, renderDescent, renderMine, renderMiner, renderMissions, renderObjective, renderSkills,
  renderUpgrades, tabVisible, type Tab, type UiState,
} from './panels';

type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

const STEP = 0.05;
const SAVE_EVERY = 15_000;

/**
 * Wires the simulation to the page: builds the layout once, runs the loop,
 * routes taps and clicks to game actions, and turns game events into sound,
 * particles and toasts.
 */
export class App {
  private readonly ui: UiState = { tab: 'mine', buyMode: 1, craftFilter: 'gear', wide: false };
  private readonly root: HTMLElement;
  private scene!: Scene;
  private music: Music | null = null;
  private last = performance.now();
  private acc = 0;
  private uiTimer = 0;
  private lastSave = Date.now();
  private toastHost!: HTMLElement;
  /** Set once the save is erased, so the reload's pagehide does not write it straight back. */
  private erased = false;

  constructor(root: HTMLElement, private s: GameState, offline: OfflineReport | null) {
    this.root = root;
    this.build();
    on((e) => this.onEvent(e));
    setVolumes({ music: s.settings.music, sfx: s.settings.sfx });
    setMuted(s.settings.muted);
    onReady((m) => {
      const biome = biomeAt(this.s.depth);
      this.music = new Music(m, musicFor(this.s, biome), musicKey(this.s, biome));
      this.music.start();
      (window as unknown as { __music: Music }).__music = this.music;
    });
    refreshContracts(this.s, Date.now());
    this.renderPanels(true);
    if (offline && offline.seconds >= 60) this.showOffline(offline);
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- Layout ---------------------------------------------------------------------------

  private build(): void {
    this.root.innerHTML = `
      <div class="app">
        <header class="topbar">
          <div class="res coins" data-fly>${iconHtml('icon-coin', 2)}<span id="coins">0</span></div>
          <div class="res level"><span class="lv" id="lv">Lv 1</span><div class="bar xp"><div id="xpbar"></div></div></div>
          <div class="res stamina">${iconHtml('icon-stamina', 2)}<div class="bar st"><div id="stbar"></div></div></div>
          <div class="res echoes" id="echoes" hidden>${iconHtml('icon-echo', 2)}<span id="echo-n">0</span></div>
          <button class="iconbtn" id="fs" data-act="fullscreen" aria-label="Full screen" hidden>${iconHtml('icon-fullscreen', 2)}</button>
          <button class="iconbtn" data-act="settings" aria-label="Settings">${iconHtml('icon-cog', 2)}</button>
        </header>
        <div class="stage">
          <div class="scene">
            <canvas id="scene" aria-label="The rock face. Tap to mine."></canvas>
            <div class="overlay top" id="objective"></div>
            <div class="overlay depth" id="depthchip"></div>
            <div class="overlay bottom skills" id="skills"></div>
          </div>
          <div class="side">
            <nav class="tabs" id="tabs"></nav>
            <main class="panel" id="panel"></main>
          </div>
          <aside class="missions-col" id="missions-col"></aside>
        </div>
        <div class="toasts" id="toasts" aria-live="polite"></div>
        <div class="modal-host" id="modal"></div>
      </div>`;
    this.toastHost = this.root.querySelector('#toasts')!;
    const canvas = this.root.querySelector<HTMLCanvasElement>('#scene')!;
    this.scene = new Scene(canvas);

    // Every pointerdown on the rock is a swing, so two thumbs swing twice.
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlock();
      tap(this.s);
    });
    this.root.addEventListener('click', (e) => {
      unlock();
      const el = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      this.act(el.dataset['act']!);
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat || (e.target as Element).closest('input, textarea')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        unlock();
        tap(this.s);
      } else if (e.key === '1') this.act('skill:power');
      else if (e.key === '2') this.act('skill:dowse');
      else if (e.key === '3') this.act('skill:frenzy');
      else if (e.key === 'f' || e.key === 'F') this.act('fullscreen');
    });
    const onResize = (): void => {
      this.ui.wide = window.matchMedia('(min-width: 1300px)').matches;
      this.scene.resize();
      this.placeFlyTarget();
      this.renderPanels(true);
    };
    window.addEventListener('resize', onResize);
    this.setupFullscreen(onResize);
    onResize();
    document.addEventListener('visibilitychange', () => {
      suspend(document.hidden);
      if (document.hidden) this.save();
      else this.catchUp();
    });
    window.addEventListener('pagehide', () => this.save());
  }

  /**
   * Shows the full-screen button only where it can work: not where the API is
   * missing (iPhone Safari), and not in the installed app, which already is.
   */
  private setupFullscreen(onResize: () => void): void {
    const d = document as FsDocument;
    const supported = !!(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
    const installed = window.matchMedia('(display-mode: standalone)').matches;
    const button = this.root.querySelector<HTMLButtonElement>('#fs')!;
    button.hidden = !supported || installed;
    const sync = (): void => {
      const on = !!fullscreenElement();
      button.innerHTML = iconHtml(on ? 'icon-exitfs' : 'icon-fullscreen', 2);
      button.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
      onResize();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  private toggleFullscreen(): void {
    const d = document as FsDocument;
    if (fullscreenElement()) {
      void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch(() => undefined);
      return;
    }
    const el = document.documentElement as FsElement;
    const request = el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.();
    void request
      ?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait'))
      .catch(() => undefined);
  }

  private placeFlyTarget(): void {
    const canvas = this.root.querySelector('#scene')!.getBoundingClientRect();
    const coins = this.root.querySelector('[data-fly]')!.getBoundingClientRect();
    this.scene.flyTarget = { x: coins.left - canvas.left + 12, y: coins.top - canvas.top + 10 };
  }

  // --- Loop -----------------------------------------------------------------------------

  private loop(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    while (this.acc >= STEP) {
      tick(this.s, STEP);
      this.acc -= STEP;
    }
    this.scene.frame(dt, this.s);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.2;
      this.renderPanels(false);
    }
    if (Date.now() - this.lastSave > SAVE_EVERY) this.save();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Coming back to a hidden tab: settle the gap as offline time rather than a frozen frame. */
  private catchUp(): void {
    const gap = (Date.now() - this.s.savedAt) / 1000;
    if (gap > 5) {
      const report = applyOffline(this.s, gap);
      this.s.savedAt = Date.now();
      if (report.seconds >= 60) this.showOffline(report);
    }
    this.last = performance.now();
  }

  private save(): void {
    if (this.erased) return;
    this.lastSave = Date.now();
    saveLocal(this.s, this.lastSave);
  }

  // --- Rendering -----------------------------------------------------------------------------

  private renderPanels(force: boolean): void {
    const s = this.s;
    const d = derive(s);
    const q = <T extends Element>(sel: string): T => this.root.querySelector<T>(sel)!;
    q('#coins').textContent = fmt(s.coins);
    q('#lv').textContent = `Lv ${s.level}`;
    q<HTMLElement>('#xpbar').style.width = `${Math.min(100, (s.xp / xpForLevel(s.level)) * 100)}%`;
    q<HTMLElement>('#stbar').style.width = `${Math.min(100, (s.stamina / d.staminaMax) * 100)}%`;
    const echoes = q<HTMLElement>('#echoes');
    echoes.hidden = s.echoesEarned <= 0;
    q('#echo-n').textContent = fmtInt(s.echoes);

    if (!tabVisible(s, this.ui.tab) || (this.ui.wide && this.ui.tab === 'missions')) this.ui.tab = 'mine';
    const badges: Partial<Record<Tab, boolean>> = {
      miner: s.statPoints > 0,
      missions: this.missionReady(),
      descent: echoGain(s) > 0 && s.echoes === 0 && s.counters.descents === 0 && s.maxDepth >= 40,
    };
    morph(q('#tabs'), TABS.filter((t) => tabVisible(s, t.id) && !(this.ui.wide && t.id === 'missions'))
      .map((t) => `<button class="tab ${this.ui.tab === t.id ? 'on' : ''}" data-act="tab:${t.id}" data-key="t-${t.id}">${iconHtml(t.icon, 2)}<span>${t.label}</span>${badges[t.id] ? '<i class="badge"></i>' : ''}</button>`)
      .join(''));

    const panel = q('#panel');
    const html = this.panelHtml(this.ui.tab);
    if (force) panel.innerHTML = html;
    else morph(panel, html);

    const col = q('#missions-col');
    if (this.ui.wide) morph(col, renderMissions(s, Date.now()));
    else if (col.childNodes.length) col.innerHTML = '';

    morph(q('#skills'), renderSkills(s));
    morph(q('#objective'), this.ui.wide ? '' : renderObjective(s));
    const biome = biomeAt(s.depth);
    morph(q('#depthchip'), `<button class="chip-btn" data-act="depth:up"${s.depth > 1 ? '' : ' disabled'} aria-label="Up">▲</button>
      <button class="depth-label" data-act="jump" title="Go to another depth"><b>${s.depth}</b><span class="tiny">${esc(biomeText(s, biome).name)} ▾</span></button>
      <button class="chip-btn" data-act="depth:down"${s.depth < s.maxDepth ? '' : ' disabled'} aria-label="Down">▼</button>
      <button class="chip-btn mode ${s.autoAdvance ? 'on' : ''}" data-act="advance" title="${s.autoAdvance ? 'Pushing deeper' : 'Farming this depth'}">${s.autoAdvance ? '⇣' : '⏸'}</button>`);
    document.documentElement.dataset['biome'] = biome.id;
  }

  private panelHtml(tab: Tab): string {
    switch (tab) {
      case 'upgrades': return renderUpgrades(this.s, this.ui);
      case 'miner': return renderMiner(this.s);
      case 'craft': return renderCraft(this.s, this.ui);
      case 'missions': return renderMissions(this.s, Date.now());
      case 'descent': return renderDescent(this.s);
      default: return renderMine(this.s);
    }
  }

  private missionReady(): boolean {
    const m = activeStory(this.s);
    if (m && progress(this.s, m.goal, this.s.story.base).done) return true;
    return this.s.contracts.list.some((c) => !c.claimed && progress(this.s, c.goal, c.base).done);
  }

  // --- Actions ---------------------------------------------------------------------------------

  private act(action: string): void {
    const s = this.s;
    const [verb, a = '', b = ''] = action.split(':');
    let ok = true;
    switch (verb) {
      case 'tab':
        this.ui.tab = a as Tab;
        sfxTick();
        this.renderPanels(true);
        this.root.querySelector('#panel')!.scrollTop = 0;
        return;
      case 'mode':
        this.ui.buyMode = a === 'max' ? 'max' : (Number(a) as 1 | 10);
        break;
      case 'filter':
        this.ui.craftFilter = a as UiState['craftFilter'];
        break;
      case 'depth':
        setDepth(s, a === 'up' ? s.depth - 1 : a === 'down' ? s.depth + 1 : a === 'front' ? s.maxDepth : Number(a));
        break;
      case 'jump':
        this.showJump();
        return;
      case 'advance':
        s.autoAdvance = !s.autoAdvance;
        // Farming means no seam: swap an exposed one back for ordinary rock.
        if (!s.autoAdvance && s.block.seam) spawnBlock(s);
        break;
      case 'up':
        ok = buyUpgrade(s, a, Number(b) || 1);
        break;
      case 'spendall':
        ok = spendAll(s) > 0;
        break;
      case 'machine':
        ok = buyMachine(s, a, Number(b));
        break;
      case 'sellore':
        ok = sellAllOre(s) > 0;
        break;
      case 'sell':
        ok = sell(s, a) > 0;
        break;
      case 'use':
        ok = useConsumable(s, a as ConsumableId);
        break;
      case 'skill':
        ok = useSkill(s, a as SkillId);
        break;
      case 'stat':
        ok = spendStat(s, a as CoreStat, Number(b));
        if (ok) sfxTick();
        break;
      case 'passive':
        ok = rankPassive(s, a);
        if (ok) sfxBuy();
        break;
      case 'equip':
        ok = equip(s, Number(a));
        if (ok) sfxCraft();
        break;
      case 'salvage': {
        const item = s.gear.find((g) => g.uid === Number(a));
        const recipe = item && [...CRAFT_BY_ID.values()].find((r) => r.output.kind === 'gear' && r.output.base === item.base);
        if (item) {
          this.confirm(`Melt down ${GEAR_BASE.get(item.base)?.name}?`, `You get ${fmt(Math.floor((recipe?.coins ?? 0) * 0.3))} coin back.`, 'Melt', () => {
            salvage(s, Number(a), recipe?.coins ?? 0);
            sfxSmelt();
          });
        }
        return;
      }
      case 'refine': {
        const r = REFINE_BY_ID.get(a);
        if (!r) return;
        const n = b === 'max' ? batchesAffordable(s, r) : Number(b);
        const slots = furnaceSlots(s);
        let slot = -1;
        for (let i = 0; i < slots && slot < 0; i++) if (s.furnace[i]!.recipe === a && s.furnace[i]!.queued > 0) slot = i;
        for (let i = 0; i < slots && slot < 0; i++) if (s.furnace[i]!.queued <= 0) slot = i;
        if (slot < 0) {
          this.toast('All furnaces are busy. Clear one first.');
          return;
        }
        ok = queueRefine(s, slot, a, n);
        if (ok) sfxTick();
        break;
      }
      case 'clear':
        clearSlot(s, Number(a));
        break;
      case 'craft':
        ok = craft(s, a);
        break;
      case 'claim': {
        const m = activeStory(s);
        if (m?.choice) {
          this.showChoice();
          return;
        }
        ok = claimStory(s);
        break;
      }
      case 'bargain': {
        const def = BARGAINS.find((x) => x.id === a);
        if (!def) return;
        this.confirm(`Accept ${def.name}?`, `${def.boon} ${def.cost} There is no taking it back.`, 'Accept', () => {
          if (strikeBargain(s, a)) {
            sfxDescent();
            this.syncMusic();
          }
        });
        return;
      }
      case 'contract':
        ok = claimContract(s, a);
        break;
      case 'echo':
        ok = buyEcho(s, a);
        if (ok) sfxBuy();
        break;
      case 'descend':
        this.confirm('Descend?', `The shaft collapses behind you. You keep your miner and gain ${fmtInt(echoGain(s))} Echoes; coin, ore, upgrades and machines are lost.`, 'Descend', () => {
          descend(s);
          this.ui.tab = 'descent';
          this.save();
        });
        return;
      case 'settings':
        this.showSettings();
        return;
      case 'fullscreen':
        this.toggleFullscreen();
        return;
      case 'close':
        this.closeModal();
        return;
      default:
        return;
    }
    if (!ok) sfxTick();
    this.renderPanels(false);
  }

  // --- Events ------------------------------------------------------------------------------------

  private onEvent(e: GameEvent): void {
    this.scene.onEvent(e, this.s);
    switch (e.type) {
      case 'hit':
        if (!e.auto) sfxHit(MATERIAL.get(this.s.block.ore)?.value ?? 1, e.crit);
        break;
      case 'break':
        if (!e.auto || e.seam) sfxBreak(e.seam);
        break;
      case 'gem':
      case 'essence':
        sfxGem();
        break;
      case 'level':
        sfxLevel();
        this.toast(`Level ${e.level}! +3 stat points`);
        break;
      case 'sell':
        sfxCoin();
        break;
      case 'buy':
        sfxBuy();
        break;
      case 'craft':
        sfxCraft();
        break;
      case 'smelt':
        if (Math.random() < 0.5) sfxSmelt();
        break;
      case 'skill':
        sfxSkill(e.id);
        break;
      case 'mission':
        sfxMission();
        this.toast(`Mission complete: ${e.title}`);
        break;
      case 'claim':
        sfxCoin();
        this.syncMusic();
        break;
      case 'scene':
        this.queueScene(e.title, e.paragraphs);
        break;
      case 'depth':
        this.syncMusic();
        break;
      case 'descent':
        sfxDescent();
        refreshContracts(this.s, Date.now());
        break;
      case 'toast':
        this.toast(e.text);
        break;
    }
  }

  private syncMusic(): void {
    const b = biomeAt(this.s.depth);
    this.music?.setBiome(musicFor(this.s, b), musicKey(this.s, b));
  }

  private scenes: { title: string; paragraphs: readonly string[] }[] = [];

  /** Story scenes play one at a time, each paragraph fading in after the last. */
  private queueScene(title: string, paragraphs: readonly string[]): void {
    this.scenes.push({ title, paragraphs });
    if (this.scenes.length === 1) this.playScene();
  }

  private playScene(): void {
    const next = this.scenes[0];
    if (!next) return;
    sfxMission();
    const body = next.paragraphs
      .map((p, i) => `<p class="scene-p" style="animation-delay:${(0.4 + i * 1.6).toFixed(1)}s">${esc(p)}</p>`)
      .join('');
    const m = this.modal(`<div class="story-scene"><h3>${esc(next.title)}</h3>${body}
      <div class="row end"><button class="btn primary scene-p" style="animation-delay:${(0.6 + next.paragraphs.length * 1.6).toFixed(1)}s" id="scene-next">Continue</button></div></div>`);
    m.querySelector('#scene-next')!.addEventListener('click', () => {
      this.scenes.shift();
      this.closeModal();
      this.playScene();
    });
  }

  private showChoice(): void {
    const mission = activeStory(this.s);
    if (!mission?.choice) return;
    const m = this.modal(`<div class="story-scene"><h3>${esc(mission.title)}</h3><p>${esc(mission.text)}</p><p class="muted">${esc(mission.choice.prompt)}</p>
      <div class="choices">${mission.choice.options.map((o, i) => `<button class="btn wide" data-choice="${i}">${esc(o.label)}</button>`).join('')}</div>
      <div class="row end"><button class="btn ghost small" data-act="close">Not yet</button></div></div>`);
    m.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b) =>
      b.addEventListener('click', () => {
        this.closeModal();
        claimStory(this.s, Number(b.dataset['choice']));
        this.save();
        this.renderPanels(true);
      }),
    );
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastHost.appendChild(el);
    while (this.toastHost.childElementCount > 3) this.toastHost.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3200);
  }

  // --- Modals --------------------------------------------------------------------------------------

  private modal(html: string): HTMLElement {
    const host = this.root.querySelector<HTMLElement>('#modal')!;
    host.innerHTML = `<div class="modal-back" data-act="close"></div><div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    host.classList.add('open');
    return host.querySelector('.modal')!;
  }

  private closeModal(): void {
    const host = this.root.querySelector<HTMLElement>('#modal')!;
    host.classList.remove('open');
    host.innerHTML = '';
  }

  private confirm(title: string, text: string, label: string, yes: () => void): void {
    const m = this.modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row end gap"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="yes">${esc(label)}</button></div>`);
    m.querySelector('#yes')!.addEventListener('click', () => {
      this.closeModal();
      yes();
      this.renderPanels(true);
    });
  }

  private showOffline(r: OfflineReport): void {
    const items = Object.entries(r.items)
      .filter(([, n]) => n >= 1)
      .map(([id, n]) => `<span class="stack ok">${iconHtml(`item-${id}`, 1, 'inline')}${fmtInt(n)}</span>`)
      .join('');
    this.modal(`<h3>While you were away</h3>
      <p class="muted">${fmtTime(r.seconds)} underground${r.capped ? ' (the most your machines can manage alone)' : ''}.</p>
      <p>Your machines broke <b>${fmtInt(r.blocks)}</b> blocks.${r.levelsGained ? ` You gained <b>${r.levelsGained}</b> levels.` : ''}${r.coinsAfter > r.coinsBefore ? ` The chute earned ${fmt(r.coinsAfter - r.coinsBefore)} coin.` : ''}</p>
      <div class="stacks">${items || '<span class="muted small">Nothing — buy some machines.</span>'}</div>
      <div class="row end"><button class="btn primary" data-act="close">Back to work</button></div>`);
  }

  /**
   * Jump to any depth already opened: one button per biome reached, a slider
   * across the whole range, and a number to type. Moving is instant.
   */
  private showJump(): void {
    const s = this.s;
    const biomes = BIOMES.filter((b) => b.from <= s.maxDepth);
    const rows = biomes
      .map((b, i) => {
        const end = Math.min(s.maxDepth, (BIOMES[i + 1]?.from ?? Infinity) - 1);
        const here = biomeAt(s.depth).id === b.id;
        return `<div class="item-row${here ? ' here' : ''}"><div class="grow"><b>${esc(biomeText(s, b).name)}</b>
          <div class="muted small">Depths ${b.from}–${end}</div></div>
          <button class="btn small" data-to="${b.from}">Top</button><button class="btn small" data-to="${end}">Bottom</button></div>`;
      })
      .join('');
    const m = this.modal(`<h3>Go to depth</h3>
      <p class="muted small">Anywhere you have already opened, down to depth ${s.maxDepth}.</p>
      <div class="jump-pick"><input type="range" min="1" max="${s.maxDepth}" value="${s.depth}" id="jump-range" aria-label="Depth">
        <input type="number" min="1" max="${s.maxDepth}" value="${s.depth}" id="jump-num" inputmode="numeric" aria-label="Depth number">
        <button class="btn primary" id="jump-go">Go</button></div>
      <div class="row gap wrap jump-quick">
        <button class="btn small" data-step="-10">−10</button><button class="btn small" data-step="-1">−1</button>
        <button class="btn small" data-step="1">+1</button><button class="btn small" data-step="10">+10</button>
        <button class="btn small" data-to="1">Top</button><button class="btn small" data-to="${s.maxDepth}">Deepest</button>
      </div>
      ${rows}
      <div class="row end"><button class="btn ghost" data-act="close">Close</button></div>`);
    const range = m.querySelector<HTMLInputElement>('#jump-range')!;
    const num = m.querySelector<HTMLInputElement>('#jump-num')!;
    const clamp = (v: number): number => Math.max(1, Math.min(s.maxDepth, Math.round(v) || 1));
    const set = (v: number): void => {
      range.value = num.value = String(clamp(v));
    };
    const go = (v: number): void => {
      setDepth(s, clamp(v));
      sfxTick();
      this.closeModal();
      this.renderPanels(true);
    };
    range.addEventListener('input', () => set(Number(range.value)));
    num.addEventListener('input', () => (range.value = String(clamp(Number(num.value)))));
    num.addEventListener('keydown', (e) => e.key === 'Enter' && go(Number(num.value)));
    m.querySelector('#jump-go')!.addEventListener('click', () => go(Number(num.value)));
    m.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
      b.addEventListener('click', () => set(Number(num.value) + Number(b.dataset['step']))),
    );
    m.querySelectorAll<HTMLButtonElement>('[data-to]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset['to']))));
  }

  private showSettings(): void {
    const s = this.s;
    const m = this.modal(`<h3>Settings</h3>
      <label class="slider">Music <input type="range" min="0" max="100" value="${s.settings.music}" id="vol-music"></label>
      <label class="slider">Effects <input type="range" min="0" max="100" value="${s.settings.sfx}" id="vol-sfx"></label>
      <label class="check"><input type="checkbox" id="mute"${s.settings.muted ? ' checked' : ''}> Mute everything</label>
      <h4>Save</h4>
      <p class="muted small">Saved in this browser every few seconds. Copy the code to move it to another device.</p>
      <textarea id="save-code" rows="3" spellcheck="false"></textarea>
      <div class="row gap wrap"><button class="btn small" id="export">Export</button><button class="btn small" id="import">Import</button><button class="btn small danger" id="wipe">Erase save</button></div>
      <p class="muted tiny">Hollowdeep · pixel art and sound made in code · Space taps, 1–3 use skills, F toggles full screen.</p>
      <div class="row end"><button class="btn primary" data-act="close">Done</button></div>`);
    const music = m.querySelector<HTMLInputElement>('#vol-music')!;
    const sfx = m.querySelector<HTMLInputElement>('#vol-sfx')!;
    const apply = (): void => {
      s.settings.music = Number(music.value);
      s.settings.sfx = Number(sfx.value);
      setVolumes({ music: s.settings.music, sfx: s.settings.sfx });
    };
    music.addEventListener('input', apply);
    sfx.addEventListener('input', () => {
      apply();
      sfxTick();
    });
    m.querySelector<HTMLInputElement>('#mute')!.addEventListener('change', (e) => {
      s.settings.muted = (e.target as HTMLInputElement).checked;
      setMuted(s.settings.muted);
    });
    const code = m.querySelector<HTMLTextAreaElement>('#save-code')!;
    m.querySelector('#export')!.addEventListener('click', () => {
      code.value = exportSave(s);
      code.select();
      void navigator.clipboard?.writeText(code.value).then(() => this.toast('Save copied'), () => undefined);
    });
    m.querySelector('#import')!.addEventListener('click', () => {
      const next = importSave(code.value);
      if (!next) {
        this.toast('That code is not a Hollowdeep save');
        return;
      }
      this.erased = true;
      saveLocal(next, Date.now());
      location.reload();
    });
    m.querySelector('#wipe')!.addEventListener('click', () => {
      this.confirm('Erase your save?', 'Everything is lost: miner, gear, Echoes. This cannot be undone.', 'Erase', () => {
        this.erased = true;
        clearLocal();
        location.reload();
      });
    });
  }
}
