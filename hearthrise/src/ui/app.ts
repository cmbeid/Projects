import { onReady, setMuted, setVolumes, suspend, unlock } from '../audio/index';
import { Music } from '../audio/music';
import {
  sfxBuy, sfxClear, sfxCoin, sfxCraft, sfxDemolish, sfxEdict, sfxHit, sfxLevel, sfxMission, sfxPlace, sfxRefine, sfxRelic,
  sfxTick, sfxTide,
} from '../audio/sfx';
import { BUILDING } from '../data/buildings';
import { DISTRICTS, WARDS_PER_DISTRICT, districtAt, districtIndex } from '../data/districts';
import { MATERIAL } from '../data/materials';
import type { EdictId } from '../data/progression';
import { CRAFT_BY_ID, REFINE_BY_ID } from '../data/recipes';
import { REGALIA_BASE } from '../data/regalia';
import type { ConsumableId } from '../data/types';
import { setWard, spawnRuin, tap, xpForLevel } from '../game/clearing';
import { derive } from '../game/derive';
import {
  buyUpgrade, canAffordPlace, demolish, demolishRefund, headroom, levelCost, maxTypeLevels, move, place, rebuildFromPlan,
  sell, sellAllSalvage, spendAll, upgradeBuilding, upgradeType,
} from '../game/economy';
import { tick } from '../game/engine';
import { on, type GameEvent } from '../game/events';
import { equip, melt, rankPassive, spendStat, useConsumable, useEdict } from '../game/founder';
import { adjacencyMult, buildingAt, canPlace, likeValue, neighboursOf } from '../game/grid';
import { activeStory, claimPetition, claimStory, progress, refreshPetitions } from '../game/missions';
import { applyOffline, type OfflineReport } from '../game/offline';
import { districtText, musicFor, musicKey } from '../game/story';
import { buyCharter, letTideIn, memoryGain } from '../game/tide';
import { batchesAffordable, clearSlot, craft, queueRefine, workshopSlots } from '../game/workshops';
import { fmt, fmtInt, fmtTime } from '../num/format';
import { Scene } from '../render/scene';
import { iconHtml } from '../sprites/atlas';
import { clearLocal, exportSave, importSave, saveLocal } from '../state/persistence';
import type { CoreStat, GameState } from '../state/types';
import { esc, morph } from './dom';
import {
  TABS, renderBuild, renderBuildingSheet, renderCity, renderEdicts, renderFounder, renderMissions, renderObjective, renderTide,
  renderWardChip, renderWorks, tabVisible, type Tab, type UiState,
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
 * routes taps and clicks to game actions — including putting buildings on
 * the map — and turns game events into sound, particles and toasts.
 */
export class App {
  private readonly ui: UiState = {
    tab: 'city', buyMode: 1, craftFilter: 'regalia', wide: false, district: 0, follow: true,
    placing: null, moving: null, hover: null, armed: false, selected: null,
  };
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
    this.ui.district = districtIndex(s.ward);
    this.build();
    on((e) => this.onEvent(e));
    setVolumes({ music: s.settings.music, sfx: s.settings.sfx });
    setMuted(s.settings.muted);
    onReady((m) => {
      const d = districtAt(this.s.ward);
      this.music = new Music(m, musicFor(this.s, d), musicKey(this.s, d));
      this.music.start();
      (window as unknown as { __music: Music }).__music = this.music;
    });
    refreshPetitions(this.s, Date.now());
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
          <div class="res stamina">${iconHtml('icon-resolve', 2)}<div class="bar st"><div id="stbar"></div></div></div>
          <div class="res echoes" id="memories" hidden>${iconHtml('icon-memory', 2)}<span id="mem-n">0</span></div>
          <button class="iconbtn" id="fs" data-act="fullscreen" aria-label="Full screen" hidden>${iconHtml('icon-fullscreen', 2)}</button>
          <button class="iconbtn" data-act="settings" aria-label="Settings">${iconHtml('icon-cog', 2)}</button>
        </header>
        <div class="stage">
          <div class="scene">
            <canvas id="scene" aria-label="The city. Tap the ruin to clear it; tap the map to build."></canvas>
            <div class="overlay top" id="objective"></div>
            <div class="overlay depth" id="wardchip"></div>
            <div class="overlay bottom skills" id="edicts"></div>
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
    // A handle for the browser checks in scripts/verify-ui.ts.
    (window as unknown as { __scene: Scene }).__scene = this.scene;

    const local = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    // Every pointerdown on the work site is a swing, so two thumbs swing twice.
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlock();
      const p = local(e);
      this.pointer(p.x, p.y, e.pointerType === 'mouse');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || (!this.ui.placing && this.ui.moving == null)) return;
      const p = local(e);
      this.ui.hover = this.scene.tileAt(p.x, p.y);
    });
    canvas.addEventListener('pointerleave', () => {
      if (this.ui.armed) return;
      this.ui.hover = null;
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
      } else if (e.key === '1') this.act('edict:rush');
      else if (e.key === '2') this.act('edict:survey');
      else if (e.key === '3') this.act('edict:festival');
      else if (e.key === 'f' || e.key === 'F') this.act('fullscreen');
      else if (e.key === 'Escape') this.act('cancel');
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

  /** A tap or click on the canvas: swing at the ruin, put a building down, or open one. */
  private pointer(x: number, y: number, mouse: boolean): void {
    const s = this.s;
    if (this.scene.inSite(x)) {
      tap(s);
      return;
    }
    const t = this.scene.tileAt(x, y);
    if (!t) return;
    if (this.ui.placing || this.ui.moving != null) {
      const same = this.ui.hover && this.ui.hover.x === t.x && this.ui.hover.y === t.y;
      this.ui.hover = t;
      // A mouse has already shown the ghost under it; a finger needs a look first.
      if (!mouse && !(same && this.ui.armed)) {
        this.ui.armed = true;
        sfxTick();
        return;
      }
      this.ui.armed = false;
      this.commitPlacement(t.x, t.y);
      return;
    }
    const b = buildingAt(s, this.ui.district, t.x, t.y);
    if (b) {
      this.ui.selected = b.uid;
      this.showBuilding(b.uid);
      sfxTick();
      return;
    }
    // Rubble in the row being cleared: a tap there swings too.
    if (this.ui.district === districtIndex(s.ward)) tap(s);
  }

  private commitPlacement(x: number, y: number): void {
    const s = this.s;
    if (this.ui.moving != null) {
      if (move(s, this.ui.moving, this.ui.district, x, y)) {
        this.ui.moving = null;
        this.ui.hover = null;
        this.renderPanels(true);
      } else {
        this.toast('It will not fit there.');
      }
      return;
    }
    const type = this.ui.placing!;
    if (!canPlace(s, type, this.ui.district, x, y)) {
      this.toast('It will not fit there.');
      return;
    }
    if (!place(s, type, this.ui.district, x, y)) {
      this.toast('Not enough coin or goods.');
      return;
    }
    // Keep placing while another can be had; most of the time you want a row of them.
    if (!canAffordPlace(s, type)) {
      this.ui.placing = null;
      this.ui.hover = null;
    }
    this.renderPanels(true);
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
    this.scene.frame(dt, this.s, this.view());
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.2;
      this.renderPanels(false);
    }
    if (Date.now() - this.lastSave > SAVE_EVERY) this.save();
    requestAnimationFrame((t) => this.loop(t));
  }

  private view(): { district: number; placing: string | null; moving: number | null; hover: { x: number; y: number } | null; selected: number | null } {
    return { district: this.ui.district, placing: this.ui.placing, moving: this.ui.moving, hover: this.ui.hover, selected: this.ui.selected };
  }

  /** Coming back to a hidden tab: settle the gap as time away rather than a frozen frame. */
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
    q<HTMLElement>('#stbar').style.width = `${Math.min(100, (s.resolve / d.resolveMax) * 100)}%`;
    q<HTMLElement>('#memories').hidden = s.memoriesEarned <= 0;
    q('#mem-n').textContent = fmtInt(s.memories);

    if (this.ui.follow && !this.ui.placing && this.ui.moving == null) this.ui.district = districtIndex(s.ward);
    if (DISTRICTS[this.ui.district]!.from > s.maxWard) this.ui.district = districtIndex(s.ward);

    if (!tabVisible(s, this.ui.tab) || (this.ui.wide && this.ui.tab === 'missions')) this.ui.tab = 'city';
    const badges: Partial<Record<Tab, boolean>> = {
      founder: s.statPoints > 0,
      missions: this.missionReady(),
      tide: memoryGain(s) > 0 && s.memories === 0 && s.counters.tides === 0 && s.maxWard >= 16,
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

    morph(q('#edicts'), renderEdicts(s));
    morph(q('#objective'), this.ui.wide || this.ui.placing || this.ui.moving != null ? '' : renderObjective(s));
    morph(q('#wardchip'), renderWardChip(s, this.ui));
    document.documentElement.dataset['district'] = DISTRICTS[this.ui.district]!.id;
  }

  private panelHtml(tab: Tab): string {
    switch (tab) {
      case 'build': return renderBuild(this.s, this.ui);
      case 'founder': return renderFounder(this.s);
      case 'works': return renderWorks(this.s, this.ui);
      case 'missions': return renderMissions(this.s, Date.now());
      case 'tide': return renderTide(this.s);
      default: return renderCity(this.s);
    }
  }

  private missionReady(): boolean {
    const m = activeStory(this.s);
    if (m && progress(this.s, m.goal, this.s.story.base).done) return true;
    return this.s.petitions.list.some((c) => !c.claimed && progress(this.s, c.goal, c.base).done);
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
      case 'view':
        this.ui.district = Number(a);
        this.ui.follow = this.ui.district === districtIndex(s.ward);
        this.ui.hover = null;
        sfxTick();
        break;
      case 'ward':
        setWard(s, a === 'back' ? s.ward - 1 : a === 'on' ? s.ward + 1 : a === 'front' ? s.maxWard : Number(a));
        this.ui.follow = true;
        break;
      case 'jump':
        this.showJump();
        return;
      case 'advance':
        s.autoAdvance = !s.autoAdvance;
        // Salvaging means no landmark: swap an exposed one back for ordinary rubble.
        if (!s.autoAdvance && s.ruin.landmark) spawnRuin(s);
        break;
      case 'up':
        ok = buyUpgrade(s, a, Number(b) || 1);
        break;
      case 'spendall':
        ok = spendAll(s) > 0;
        break;
      case 'place':
        this.ui.placing = a;
        this.ui.moving = null;
        this.ui.hover = null;
        this.ui.armed = false;
        // Put it somewhere you can see: the shown district, if it has room.
        sfxTick();
        this.toast(`Tap open ground for the ${BUILDING.get(a)?.name ?? a}.`);
        break;
      case 'uptype':
        ok = upgradeType(s, a, Math.min(Number(b) || 1, Math.max(1, maxTypeLevels(s, a))));
        break;
      case 'cancel':
        this.ui.placing = null;
        this.ui.moving = null;
        this.ui.hover = null;
        this.ui.armed = false;
        this.renderPanels(true);
        return;
      case 'rebuild': {
        const n = rebuildFromPlan(s);
        this.toast(n ? `Put back ${n} building${n > 1 ? 's' : ''}.` : 'Nothing more can go back yet.');
        ok = n > 0;
        break;
      }
      case 'sellall':
        ok = sellAllSalvage(s) > 0;
        break;
      case 'sell':
        ok = sell(s, a) > 0;
        break;
      case 'use':
        ok = useConsumable(s, a as ConsumableId);
        break;
      case 'edict':
        ok = useEdict(s, a as EdictId);
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
      case 'melt': {
        const item = s.regalia.find((g) => g.uid === Number(a));
        const recipe = item && [...CRAFT_BY_ID.values()].find((r) => r.output.kind === 'regalia' && r.output.base === item.base);
        if (item) {
          this.confirm(`Melt down the ${REGALIA_BASE.get(item.base)?.name}?`, `You get ${fmt(Math.floor((recipe?.coins ?? 0) * 0.3))} coin back.`, 'Melt', () => {
            melt(s, Number(a), recipe?.coins ?? 0);
            sfxRefine();
          });
        }
        return;
      }
      case 'refine': {
        const r = REFINE_BY_ID.get(a);
        if (!r) return;
        const n = b === 'max' ? batchesAffordable(s, r) : Number(b);
        const slots = workshopSlots(s);
        let slot = -1;
        for (let i = 0; i < slots && slot < 0; i++) if (s.workshops[i]!.recipe === a && s.workshops[i]!.queued > 0) slot = i;
        for (let i = 0; i < slots && slot < 0; i++) if (s.workshops[i]!.queued <= 0) slot = i;
        if (slot < 0) {
          this.toast('Every workshop is busy. Clear one, or build another.');
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
      case 'petition':
        ok = claimPetition(s, a);
        break;
      case 'charter':
        ok = buyCharter(s, a);
        if (ok) sfxBuy();
        break;
      case 'tide':
        this.confirm('Let the sea in?', `The city goes under and you start again on the beach, with ${fmtInt(memoryGain(s))} Memories. Coin, stores, upgrades, buildings and wards are lost; the layout is kept as a plan.`, 'Let it in', () => {
          letTideIn(s);
          this.ui.placing = null;
          this.ui.moving = null;
          this.ui.selected = null;
          this.ui.follow = true;
          this.ui.tab = 'tide';
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
    this.scene.onEvent(e, this.s, this.view());
    switch (e.type) {
      case 'hit':
        if (!e.auto) sfxHit(MATERIAL.get(this.s.ruin.salvage)?.value ?? 1, e.crit);
        break;
      case 'clear':
        if (!e.auto || e.landmark) sfxClear(e.landmark);
        break;
      case 'relic':
      case 'heart':
        sfxRelic();
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
      case 'place':
        sfxPlace(levelCost(this.s, e.type_));
        break;
      case 'demolish':
        sfxDemolish();
        break;
      case 'craft':
        sfxCraft();
        break;
      case 'refine':
        if (Math.random() < 0.5) sfxRefine();
        break;
      case 'edict':
        sfxEdict(e.id);
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
      case 'ward':
        if (e.districtChanged) this.syncMusic();
        if (e.opened && e.ward === DISTRICTS[districtIndex(e.ward)]!.from) this.toast(`${DISTRICTS[districtIndex(e.ward)]!.name} is open. New buildings to build.`);
        break;
      case 'tide':
        sfxTide();
        refreshPetitions(this.s, Date.now());
        this.syncMusic();
        break;
      case 'toast':
        this.toast(e.text);
        break;
    }
  }

  private syncMusic(): void {
    const d = districtAt(this.s.ward);
    this.music?.setDistrict(musicFor(this.s, d), musicKey(this.s, d));
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
    m.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.closeModal();
        claimStory(this.s, Number(btn.dataset['choice']));
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
    this.ui.selected = null;
  }

  private confirm(title: string, text: string, label: string, yes: () => void): void {
    const m = this.modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row end gap"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="yes">${esc(label)}</button></div>`);
    m.querySelector('#yes')!.addEventListener('click', () => {
      this.closeModal();
      yes();
      this.renderPanels(true);
    });
  }

  /** A building's sheet: what it does, what its neighbours make of it, and what to do with it. */
  private showBuilding(uid: number): void {
    const s = this.s;
    const b = s.buildings.find((x) => x.uid === uid);
    const def = b && BUILDING.get(b.type);
    if (!b || !def) return;
    const neighbours = neighboursOf(s, { district: b.district, x: b.x, y: b.y, w: def.w, h: def.h }, uid).map((n) => {
      const nd = BUILDING.get(n.type)!;
      const v = likeValue(def, nd, b.district);
      return `${nd.name} ${v > 0 ? `+${v}` : v === 0 ? '±0' : v}`;
    });
    const m = this.modal(renderBuildingSheet(s, uid, this.ui, adjacencyMult(s, b), neighbours));
    m.querySelector('#sheet-up')?.addEventListener('click', () => {
      const n = this.ui.buyMode === 'max' ? Math.max(1, Math.min(maxTypeLevels(s, def.id), headroom(b))) : this.ui.buyMode;
      if (upgradeBuilding(s, uid, Math.min(n, headroom(b)))) this.showBuilding(uid);
      else sfxTick();
    });
    m.querySelector('#sheet-move')!.addEventListener('click', () => {
      this.closeModal();
      this.ui.moving = uid;
      this.ui.placing = null;
      this.ui.hover = null;
      this.ui.district = b.district;
      this.ui.follow = false;
      this.toast(`Tap where the ${def.name} should go.`);
      this.renderPanels(true);
    });
    m.querySelector('#sheet-demolish')!.addEventListener('click', () => {
      this.confirm(`Pull down the ${def.name}?`, `You get ${fmt(demolishRefund(s, b))} coin back, half of what its levels would cost now.`, 'Pull down', () => {
        demolish(s, uid);
      });
    });
  }

  private showOffline(r: OfflineReport): void {
    const items = Object.entries(r.items)
      .filter(([, n]) => n >= 1)
      .map(([id, n]) => `<span class="stack ok">${iconHtml(`item-${id}`, 1, 'inline')}${fmtInt(n)}</span>`)
      .join('');
    this.modal(`<h3>While you were away</h3>
      <p class="muted">${fmtTime(r.seconds)} away${r.capped ? ' (as long as the city can manage without you)' : ''}.</p>
      <p>The crews cleared <b>${fmtInt(r.clears)}</b> ruins.${r.levelsGained ? ` You gained <b>${r.levelsGained}</b> levels.` : ''}${r.coinsAfter > r.coinsBefore ? ` The city brought in ${fmt(r.coinsAfter - r.coinsBefore)} coin.` : ''}</p>
      <div class="stacks">${items || '<span class="muted small">Nothing — build some salvage gangs.</span>'}</div>
      <div class="row end"><button class="btn primary" data-act="close">Back to work</button></div>`);
  }

  /** Go to any ward already opened: a row per district, a slider, and a number to type. */
  private showJump(): void {
    const s = this.s;
    const rows = DISTRICTS.map((d, i) => ({ d, i }))
      .filter(({ d }) => d.from <= s.maxWard)
      .map(({ d, i }) => {
        const last = i === DISTRICTS.length - 1 ? s.maxWard : Math.min(s.maxWard, d.from + WARDS_PER_DISTRICT - 1);
        const here = districtIndex(s.ward) === i;
        return `<div class="item-row${here ? ' here' : ''}"><div class="grow"><b>${esc(districtText(s, d).name)}</b>
          <div class="muted small">${d.era} · wards ${d.from}–${last}</div></div>
          <button class="btn small" data-to="${d.from}">First</button><button class="btn small" data-to="${last}">Last</button></div>`;
      })
      .join('');
    const m = this.modal(`<h3>Go to ward</h3>
      <p class="muted small">Anywhere already opened, up to ward ${s.maxWard}. Further in, the salvage is worth more and the ruins are heavier.</p>
      <div class="jump-pick"><input type="range" min="1" max="${s.maxWard}" value="${s.ward}" id="jump-range" aria-label="Ward">
        <input type="number" min="1" max="${s.maxWard}" value="${s.ward}" id="jump-num" inputmode="numeric" aria-label="Ward number">
        <button class="btn primary" id="jump-go">Go</button></div>
      ${rows}
      <div class="row end"><button class="btn ghost" data-act="close">Close</button></div>`);
    const range = m.querySelector<HTMLInputElement>('#jump-range')!;
    const num = m.querySelector<HTMLInputElement>('#jump-num')!;
    const clamp = (v: number): number => Math.max(1, Math.min(s.maxWard, Math.round(v) || 1));
    const go = (v: number): void => {
      setWard(s, clamp(v));
      this.ui.follow = true;
      sfxTick();
      this.closeModal();
      this.renderPanels(true);
    };
    range.addEventListener('input', () => (num.value = String(clamp(Number(range.value)))));
    num.addEventListener('input', () => (range.value = String(clamp(Number(num.value)))));
    num.addEventListener('keydown', (e) => e.key === 'Enter' && go(Number(num.value)));
    m.querySelector('#jump-go')!.addEventListener('click', () => go(Number(num.value)));
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
      <p class="muted tiny">Hearthrise · pixel art and sound made in code · Space swings, 1–3 proclaim edicts, Esc stops placing, F toggles full screen.</p>
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
        this.toast('That code is not a Hearthrise save');
        return;
      }
      this.erased = true;
      saveLocal(next, Date.now());
      location.reload();
    });
    m.querySelector('#wipe')!.addEventListener('click', () => {
      this.confirm('Erase your save?', 'Everything is lost: the city, the Founder, the Memories. This cannot be undone.', 'Erase', () => {
        this.erased = true;
        clearLocal();
        location.reload();
      });
    });
  }
}
