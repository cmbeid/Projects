import { onReady, setMuted, setVolumes, suspend, unlock } from '../audio/index';
import { Music } from '../audio/music';
import {
  sfxAnswer,
  sfxAssign,
  sfxBorn,
  sfxBuild,
  sfxChronicle,
  sfxClick,
  sfxDemolish,
  sfxEra,
  sfxFestival,
  sfxLaunch,
  sfxModernize,
  sfxResearch,
  sfxWarn,
  sfxWonderDone,
  sfxWonderStage,
} from '../audio/sfx';
import { EVENT } from '../data/chronicle';
import { ERAS } from '../data/eras';
import { JOB_IDS } from '../data/resources';
import { TECH } from '../data/techs';
import type { JobId, LineId } from '../data/types';
import { WONDER } from '../data/wonders';
import { assign, build, demolishPlot, modernize, modernizeAll, modernizePlot } from '../game/city';
import { answer } from '../game/chronicle';
import { buyNode, launch } from '../game/colony';
import { derive } from '../game/derive';
import { tick } from '../game/engine';
import { on, type GameEvent } from '../game/events';
import { advance, holdFestival, research, startStage, toggleQueue } from '../game/progress';
import type { OfflineReport } from '../game/offline';
import { fmt, fmtTime } from '../num/format';
import { Scene } from '../render/scene';
import { iconHtml } from '../sprites/atlas';
import { clearLocal, exportSave, importSave, saveLocal } from '../state/persistence';
import type { GameState } from '../state/types';
import { esc, morph } from './dom';
import {
  TABS,
  renderChronicle,
  renderCity,
  renderEventCard,
  renderEra,
  renderHeritage,
  renderJobs,
  renderResearch,
  renderResources,
  renderSettings,
  renderStats,
  renderWonders,
  tabBadge,
  tabVisible,
  type Tab,
  type UiState,
} from './panels';
import { resIcon } from './text';

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const STEP = 0.1;
const SAVE_EVERY = 10_000;

/**
 * Wires the simulation to the page: builds the layout once, runs the loop,
 * routes clicks to game actions, and turns game events into sound, scene
 * effects and toasts.
 */
export class App {
  private readonly ui: UiState = { tab: 'city', pick: -1, step: 1, pastTechs: false, importOpen: false, confirmReset: false };
  private scene!: Scene;
  private music: Music | null = null;
  private last = performance.now();
  private acc = 0;
  private uiTimer = 0;
  private lastSave = Date.now();
  private toastHost!: HTMLElement;
  private erased = false;
  private bornSound = 0;

  constructor(
    private readonly root: HTMLElement,
    private s: GameState,
    offline: OfflineReport | null,
  ) {
    this.build();
    on((e) => this.onEvent(e));
    setVolumes({ music: s.settings.music, sfx: s.settings.sfx });
    setMuted(s.settings.muted);
    onReady((m) => {
      this.music = new Music(m, ERAS[this.s.era]!.song);
      this.music.start();
      (window as unknown as { __music: Music }).__music = this.music;
    });
    this.render(true);
    if (offline && offline.counted >= 60) this.showOffline(offline);
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- Layout -----------------------------------------------------------------------

  private build(): void {
    this.root.innerHTML = `
      <div class="app">
        <header class="topbar" id="top">
          <div class="era" id="era"></div>
          <div class="resources" id="res"></div>
          <div class="stats" id="stats"></div>
        </header>
        <div class="stage">
          <div class="scene-col">
            <div class="scene">
              <canvas id="scene" aria-label="The city's skyline. Drag to look along it; tap a building to rebuild or pull it down."></canvas>
              <div class="badges" id="badges"></div>
            </div>
            <div id="event"></div>
          </div>
          <div class="side">
            <nav class="tabs" id="tabs"></nav>
            <main class="panel" id="panel"></main>
          </div>
        </div>
        <div class="toasts" id="toasts" aria-live="polite"></div>
        <div class="modal-host" id="modal"></div>
      </div>`;
    this.toastHost = this.root.querySelector('#toasts')!;
    const canvas = this.root.querySelector<HTMLCanvasElement>('#scene')!;
    this.scene = new Scene(canvas);
    this.scene.onPick = (plot) => {
      unlock();
      if (plot < 0 || plot >= this.s.plots.length) return;
      this.ui.pick = this.ui.pick === plot ? -1 : plot;
      this.scene.selected = this.ui.pick;
      if (this.ui.pick >= 0) this.ui.tab = 'city';
      sfxClick();
      this.render(true);
      this.scrollPanelTop();
    };
    (window as unknown as { __scene: Scene }).__scene = this.scene;

    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || el instanceof HTMLInputElement) return;
      unlock();
      this.act(el.dataset['act']!, el.dataset['arg'] ?? '');
    });
    this.root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      const act = el.dataset['act'];
      if (!act) return;
      unlock();
      if (act === 'vol-music' || act === 'vol-sfx') {
        this.s.settings[act === 'vol-music' ? 'music' : 'sfx'] = Number(el.value);
        setVolumes({ music: this.s.settings.music, sfx: this.s.settings.sfx });
      } else if (act === 'mute') {
        this.s.settings.muted = el.checked;
        setMuted(el.checked);
      } else if (act === 'auto') {
        this.s.settings.autoAssign = el.checked;
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      const tabs = TABS.filter((t) => tabVisible(this.s, t.id));
      if (n >= 1 && n <= tabs.length) this.act('tab', tabs[n - 1]!.id);
      else if (e.key === 'f' || e.key === 'F') this.act('fullscreen', '');
      else if (e.key === 'Escape') this.act('unpick', '');
    });
    window.addEventListener('resize', () => this.scene.resize());
    document.addEventListener('visibilitychange', () => {
      suspend(document.hidden);
      if (document.hidden) this.save();
      else this.last = performance.now();
    });
    window.addEventListener('pagehide', () => this.save());
    this.scene.resize();
    this.syncFullscreen();
  }

  private syncFullscreen(): void {
    const d = document as FsDocument;
    const ok = !!(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
    const sync = (): void => {
      this.render(true);
      setTimeout(() => this.scene.resize(), 50);
    };
    if (ok) {
      document.addEventListener('fullscreenchange', sync);
      document.addEventListener('webkitfullscreenchange', sync);
    }
  }

  private fullscreen(): void {
    const d = document as FsDocument;
    if (d.fullscreenElement ?? d.webkitFullscreenElement) {
      void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as FsElement;
    void (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())?.catch(() => undefined);
  }

  // --- Loop -------------------------------------------------------------------------

  private loop(now: number): void {
    const dt = Math.min(1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    // Fixed steps keep the simulation the same at any frame rate; a long stall is capped.
    let steps = 0;
    while (this.acc >= STEP && steps < 50) {
      tick(this.s, STEP);
      this.acc -= STEP;
      steps += 1;
    }
    if (steps >= 50) this.acc = 0;
    this.scene.frame(this.s, dt);
    this.music?.setNight(this.scene.isNight());
    this.uiTimer += dt;
    if (this.uiTimer > 0.25) {
      this.uiTimer = 0;
      this.render(false);
    }
    if (Date.now() - this.lastSave > SAVE_EVERY) this.save();
    requestAnimationFrame((t) => this.loop(t));
  }

  private save(): void {
    if (this.erased) return;
    this.lastSave = Date.now();
    saveLocal(this.s, this.lastSave);
  }

  private render(full: boolean): void {
    const s = this.s;
    const d = derive(s);
    if (!tabVisible(s, this.ui.tab)) this.ui.tab = 'city';
    morph(this.root.querySelector('#era')!, renderEra(s));
    morph(this.root.querySelector('#stats')!, renderStats(s, d));
    const top = this.root.querySelector<HTMLElement>('#top')!;
    this.root.style.setProperty('--top-h', `${top.offsetHeight}px`);
    morph(this.root.querySelector('#res')!, renderResources(s, d));
    morph(this.root.querySelector('#event')!, renderEventCard(s, d));
    morph(
      this.root.querySelector('#badges')!,
      `${s.festival > 0 ? `<span class="badge fest">Festival ${fmtTime(s.festival)}</span>` : ''}${s.modifiers
        .slice(0, 3)
        .map((m) => `<span class="badge${m.x < 0 ? ' bad' : ''}">${esc(m.label)} ${fmtTime(m.left)}</span>`)
        .join('')}`,
    );
    morph(
      this.root.querySelector('#tabs')!,
      TABS.filter((t) => tabVisible(s, t.id))
        .map(
          (t) =>
            `<button class="tab${this.ui.tab === t.id ? ' on' : ''}${t.id === 'settings' ? ' cog' : ''}" data-act="tab" data-arg="${t.id}" aria-label="${t.label}">${t.id === 'settings' ? '<b>⚙</b>' : `${iconHtml(t.icon, 2)}<span>${t.label}</span>`}${tabBadge(s, d, t.id) ? '<i class="dot"></i>' : ''}</button>`,
        )
        .join(''),
    );
    const panel = this.root.querySelector('#panel')!;
    let html = '';
    switch (this.ui.tab) {
      case 'city': html = renderCity(s, d, this.ui); break;
      case 'jobs': html = renderJobs(s, d, this.ui); break;
      case 'research': html = renderResearch(s, d, this.ui); break;
      case 'wonders': html = renderWonders(s, d); break;
      case 'chronicle': html = renderChronicle(s); break;
      case 'heritage': html = renderHeritage(s); break;
      case 'settings': html = renderSettings(s, this.ui); break;
    }
    // A textarea mid-paste must not be morphed away.
    if (full || !panel.querySelector('textarea:focus')) morph(panel, html);
  }

  // --- Actions ----------------------------------------------------------------------

  private act(act: string, arg: string): void {
    const s = this.s;
    switch (act) {
      case 'tab':
        this.ui.tab = arg as Tab;
        this.ui.confirmReset = false;
        sfxClick();
        this.scrollPanelTop();
        break;
      case 'fullscreen':
        this.fullscreen();
        break;
      case 'build':
        if (!build(s, arg as LineId)) sfxWarn();
        break;
      case 'modernize':
        if (!modernize(s, arg as LineId)) sfxWarn();
        break;
      case 'modernize-all':
        if (!modernizeAll(s, arg as LineId)) sfxWarn();
        break;
      case 'modernize-plot':
        if (!modernizePlot(s, Number(arg))) sfxWarn();
        break;
      case 'demolish-plot':
        demolishPlot(s, Number(arg));
        this.ui.pick = -1;
        this.scene.selected = -1;
        break;
      case 'unpick':
        this.ui.pick = -1;
        this.scene.selected = -1;
        break;
      case 'assign':
      case 'unassign': {
        const n = assign(s, arg as JobId, act === 'assign' ? this.ui.step : -this.ui.step);
        if (n !== 0) sfxAssign(n > 0);
        break;
      }
      case 'step':
        this.ui.step = arg === '10' ? 10 : 1;
        break;
      case 'priority': {
        const id = arg as JobId;
        if (!JOB_IDS.includes(id)) break;
        s.settings.priority = s.settings.priority.includes(id) ? s.settings.priority.filter((x) => x !== id) : [...s.settings.priority, id];
        sfxClick();
        break;
      }
      case 'research':
        if (!research(s, arg)) sfxWarn();
        break;
      case 'queue':
        toggleQueue(s, arg);
        sfxClick();
        break;
      case 'past-techs':
        this.ui.pastTechs = !this.ui.pastTechs;
        break;
      case 'stage':
        if (startStage(s, arg)) sfxWonderStage();
        else sfxWarn();
        break;
      case 'advance':
        if (!advance(s)) sfxWarn();
        break;
      case 'festival':
        if (!holdFestival(s)) sfxWarn();
        break;
      case 'answer':
        if (answer(s, Number(arg) === 1 ? 1 : 0)) sfxAnswer();
        else sfxWarn();
        break;
      case 'launch':
        launch(s, Number(arg));
        this.scene.scroll = 0;
        break;
      case 'node':
        if (buyNode(s, arg)) sfxResearch();
        break;
      case 'export':
        void this.copy(exportSave(s));
        break;
      case 'import-open':
        this.ui.importOpen = !this.ui.importOpen;
        break;
      case 'import': {
        const code = this.root.querySelector<HTMLTextAreaElement>('#import-code')?.value ?? '';
        const next = importSave(code);
        if (!next) this.toast('That code did not load. Check it was copied whole.', 'bad');
        else {
          saveLocal(next, Date.now());
          this.erased = true;
          location.reload();
        }
        break;
      }
      case 'reset-ask':
        this.ui.confirmReset = true;
        break;
      case 'reset-cancel':
        this.ui.confirmReset = false;
        break;
      case 'reset':
        this.erased = true;
        clearLocal();
        location.reload();
        return;
      case 'close-modal':
        this.root.querySelector('#modal')!.innerHTML = '';
        break;
    }
    this.render(true);
  }

  /** Back to the top of the panel: the panel itself on wide screens, the page on phones. */
  private scrollPanelTop(): void {
    const panel = this.root.querySelector<HTMLElement>('#panel')!;
    if (panel.scrollHeight > panel.clientHeight + 1 && getComputedStyle(panel).overflowY === 'auto') panel.scrollTo({ top: 0 });
    else {
      const tabs = this.root.querySelector<HTMLElement>('#tabs')!;
      const y = tabs.getBoundingClientRect().top + window.scrollY - (this.root.querySelector<HTMLElement>('#top')!.offsetHeight);
      if (window.scrollY > y) window.scrollTo({ top: y });
    }
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Save code copied.');
    } catch {
      this.modal('Your save code', `<textarea readonly rows="5">${esc(text)}</textarea><p class="hint">Copy this and keep it somewhere safe.</p>`);
    }
  }

  // --- Events -----------------------------------------------------------------------

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'build':
        sfxBuild(e.price);
        this.scene.built(e.plot);
        this.scene.reveal(e.plot);
        break;
      case 'modernize':
        sfxModernize();
        this.scene.modernized(e.plot);
        this.scene.reveal(e.plot);
        break;
      case 'demolish':
        sfxDemolish();
        this.scene.demolished(e.plot);
        break;
      case 'research':
        sfxResearch();
        this.toast(`Learned ${TECH.get(e.id)?.name ?? e.id}`, 'good');
        break;
      case 'wonderStage':
        sfxWonderStage();
        this.toast(`${WONDER.get(e.id)?.name}: stage ${e.stage} done`);
        break;
      case 'wonderDone':
        sfxWonderDone();
        this.toast(`The ${WONDER.get(e.id)?.name} is finished!`, 'good');
        break;
      case 'era': {
        sfxEra();
        const era = ERAS[e.era]!;
        this.music?.setSong(era.song);
        this.ui.pastTechs = false;
        this.modal(
          `The ${era.name}`,
          `<div class="era-card">${iconHtml(`era-${e.era}`, 4)}<p class="big">${esc(era.blurb)}</p>
          <p>New buildings are built in the style of the age, and the old ones can be modernized in place. Land: +4.</p></div>`,
        );
        break;
      }
      case 'festival':
        sfxFestival();
        this.scene.festival();
        break;
      case 'chronicle':
        sfxChronicle();
        break;
      case 'answer': {
        const def = EVENT.get(e.id);
        if (def) this.toast(`The city ${def.choices[e.choice === 1 ? 1 : 0].log}.`);
        break;
      }
      case 'born':
        if (performance.now() - this.bornSound > 900) {
          this.bornSound = performance.now();
          sfxBorn();
        }
        break;
      case 'starving':
        this.toast('People are going hungry and leaving. Put more of them on the farms.', 'bad');
        break;
      case 'shipReady':
        sfxWonderDone();
        this.toast('The Colony Ship is ready. Choose a world in Heritage.', 'good');
        break;
      case 'launch':
        sfxLaunch();
        this.music?.setSong(ERAS[0]!.song);
        this.modal(
          `Landfall on ${e.world}`,
          `<div class="era-card">${iconHtml('era-7', 4)}<p class="big">The ship is gone, and the old city with it. On ${esc(e.world)}, a handful of colonists light a fire.</p>
          <p>They carried <b>${e.heritage}</b> Heritage. Spend it in the Heritage tab.</p></div>`,
        );
        this.ui.tab = 'heritage';
        break;
      case 'toast':
        this.toast(e.text);
        break;
    }
  }

  private toast(text: string, kind: '' | 'good' | 'bad' = ''): void {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.toastHost.appendChild(el);
    while (this.toastHost.children.length > 4) this.toastHost.firstElementChild?.remove();
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3300);
  }

  private modal(title: string, body: string): void {
    this.root.querySelector('#modal')!.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>${body}
      <button class="primary" data-act="close-modal">Carry on</button>
    </div>`;
  }

  private showOffline(r: OfflineReport): void {
    const gains = Object.entries(r.gained)
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([k, n]) => `<li>${resIcon(k as never)} +${fmt(n ?? 0)}</li>`)
      .join('');
    this.modal(
      'While you were away',
      `<p>${fmtTime(r.seconds)} passed${r.counted < r.seconds ? ` (the first ${fmtTime(r.counted)} counted)` : ''}. The city kept working.</p>
      ${r.born > 0 ? `<p>${r.born} people were born.</p>` : ''}
      <ul class="gains">${gains}</ul>`,
    );
  }
}
