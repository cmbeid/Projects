import { setMood, startMusic } from '../audio/music';
import { setMuted, setVolumes, suspend, unlock } from '../audio/index';
import { sfx } from '../audio/sfx';
import { BIOME } from '../data/biomes';
import { ORIGINS } from '../data/crew';
import { SECTORS } from '../data/sectors';
import type { ConsumableId, GearSlot, MatId, ModuleId, StatId, SubsysId } from '../data/types';
import { createAway, useAwayItem } from '../game/away/mission';
import { carried, DT, liftOff, nearestInteractable, nearLander, skillName, stepAway } from '../game/away/sim';
import { combatTurn, type CombatAction } from '../game/combat';
import { craft, scrapGear, upgrade } from '../game/crafting';
import { equip, learn, spendStat, unequip } from '../game/crew';
import {
  ackLost,
  closeAway,
  closeCombat,
  closeEvent,
  closeReport,
  createCaptain,
  distress,
  jump,
  mineBelt,
  newGame,
  patchHull,
  rest,
  scanPlanet,
  useItem,
} from '../game/engine';
import { choose } from '../game/events';
import { node } from '../game/galaxy';
import { stateRng } from '../game/rng';
import {
  acceptQuest,
  buyGear,
  buyItem,
  buyMat,
  buySupply,
  completeQuest,
  dismiss,
  healAll,
  hire,
  repairAll,
  sellGear,
  sellItem,
  sellMat,
  sellSupply,
} from '../game/station';
import { deliver, takeGate } from '../game/story';
import { animDone, drawCombat, type CombatAnim } from '../render/combat';
import { drawAway, type Camera } from '../render/away';
import { fit, pixelCtx } from '../render/canvas';
import { drawMap, hitNode, mapLayout } from '../render/starmap';
import { drawStarfield } from '../render/starfield';
import { clearLocal, exportSave, importSave, saveLocal } from '../state/persistence';
import type { GameState } from '../state/types';
import { esc, morph } from './dom';
import { confirmResetModal, eventModal, importModal, lostModal, reportModal, settingsModal } from './modals';
import {
  cargoPanel,
  combatOverlay,
  combatPanel,
  createPanel,
  crewPanel,
  endingPanel,
  equipPicker,
  explorerPicker,
  hudHtml,
  logPanel,
  mapPanel,
  shipPanel,
  tabsHtml,
  type Tab,
  type UiState,
} from './panels';
import { barHtml } from './text';
import { AwayControls } from './touch';

type Modal = null | { k: 'settings' } | { k: 'import' } | { k: 'reset' } | { k: 'explorer'; planet: number } | { k: 'equip'; crew: number; slot: GearSlot };

const AUTOSAVE_MS = 4000;

function rollFace(): number[] {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 6));
}

export class App {
  private ui: UiState = {
    tab: 'map',
    selected: null,
    stationTab: 'trade',
    crewSel: null,
    cargoTab: 'mats',
    logTab: 'mission',
    draft: { name: '', origin: 'salvager', portrait: rollFace() },
  };
  private modal: Modal = null;
  private dirty = true;
  private lastPanel = 0;
  private lastSave = 0;
  private saveOk = true;
  private prevScreen = '';
  private anim: CombatAnim | null = null;
  private cam: Camera = { x: 0, y: 0 };
  private controls = new AwayControls();
  private acc = 0;
  private lastT = 0;
  private toast: { text: string; until: number } | null = null;
  private appEl!: HTMLElement;
  private hud!: HTMLElement;
  private stage!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private overlay!: HTMLElement;
  private main!: HTMLElement;
  private tabs!: HTMLElement;
  private modalLayer!: HTMLElement;
  private modalBox!: HTMLElement;
  private down: { x: number; y: number } | null = null;

  constructor(
    private root: HTMLElement,
    private s: GameState,
  ) {
    this.build();
    this.applySettings();
    this.controls.onKey = (k) => {
      if (k === 'liftoff') this.act('liftoff', '');
      else this.act('away-item', k);
    };
    requestAnimationFrame((t) => this.frame(t));
    document.addEventListener('visibilitychange', () => {
      suspend(document.hidden);
      if (document.hidden) this.save(true);
    });
    window.addEventListener('resize', () => (this.dirty = true));
  }

  // ---------------------------------------------------------------- DOM

  private build(): void {
    this.root.innerHTML = `<div class="app">
      <header class="hud"></header>
      <section class="stage"><canvas></canvas><div class="overlay"></div></section>
      <main class="main"></main>
      <nav class="tabs" role="tablist"></nav>
    </div><div class="modal-layer"><div class="modal" role="dialog" aria-modal="true"></div></div>`;
    const q = <T extends HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;
    this.appEl = q('.app');
    this.hud = q('.hud');
    this.stage = q('.stage');
    this.canvas = q('canvas');
    this.overlay = q('.overlay');
    this.main = q('.main');
    this.tabs = q('.tabs');
    this.modalLayer = q('.modal-layer');
    this.modalBox = q('.modal');
    this.root.addEventListener('click', (e) => {
      unlock();
      startMusic();
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!t || (t as HTMLButtonElement).disabled) return;
      this.act(t.dataset['act']!, t.dataset['arg'] ?? '');
    });
    this.root.addEventListener('pointerdown', () => {
      unlock();
      startMusic();
    });
    this.root.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const k = t.dataset['input'];
      if (k === 'name') this.ui.draft.name = t.value;
      if (k === 'sfx' || k === 'music') {
        this.s.settings[k] = Number(t.value);
        this.applySettings();
        this.save(true);
      }
    });
    this.canvas.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (!this.down || this.s.screen !== 'map') return;
      const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
      this.down = null;
      if (moved > 12) return;
      const r = this.canvas.getBoundingClientRect();
      const { w, h, dpr } = fit(this.canvas);
      const id = hitNode(this.s, mapLayout(w, h), (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      if (id === null) return;
      if (id === this.ui.selected && node(this.s).links.includes(id)) this.act('jump', String(id));
      else {
        this.ui.selected = id === this.s.at ? null : id;
        sfx.click();
        this.dirty = true;
        this.main.scrollTop = 0;
      }
    });
  }

  private applySettings(): void {
    setVolumes({ sfx: this.s.settings.sfx, music: this.s.settings.music });
    setMuted(this.s.settings.muted);
  }

  private save(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastSave < 500) return;
    this.lastSave = now;
    this.saveOk = saveLocal(this.s, now);
  }

  private flash(text: string): void {
    this.toast = { text, until: performance.now() + 1800 };
  }

  // ---------------------------------------------------------------- Actions

  private act(a: string, arg: string): void {
    const s = this.s;
    const levels = s.crew.reduce((x, c) => x + c.level, 0);
    const [p, q] = arg.split(':');
    let ok = true;
    switch (a) {
      // Navigation and the map
      case 'tab':
        this.ui.tab = arg as Tab;
        this.main.scrollTop = 0;
        break;
      case 'deselect':
        this.ui.selected = null;
        break;
      case 'jump':
        ok = jump(s, Number(arg));
        if (ok) {
          sfx.jump();
          this.ui.selected = null;
          this.main.scrollTop = 0;
        }
        break;
      case 'rest':
        ok = rest(s);
        break;
      case 'distress':
        ok = distress(s);
        break;
      case 'mine': {
        const lines = mineBelt(s);
        ok = !!lines;
        if (lines) {
          s.report = { title: 'Mining run', lines };
          sfx.gather();
        }
        break;
      }
      case 'patch':
        ok = patchHull(s);
        break;
      case 'scan':
        ok = scanPlanet(s, Number(arg));
        break;
      case 'land':
        this.modal = { k: 'explorer', planet: Number(arg) };
        break;
      case 'land-go':
        ok = createAway(s, Number(p), Number(q));
        if (ok) {
          this.modal = null;
          this.controls.reset();
          this.cam = { x: s.away!.x, y: s.away!.y };
          this.acc = 0;
          this.buildAwayOverlay();
        }
        break;
      case 'deliver':
        ok = deliver(s);
        break;
      case 'gate':
        ok = takeGate(s);
        break;
      // Station
      case 'st-tab':
        this.ui.stationTab = arg as UiState['stationTab'];
        break;
      case 'buy-mat':
        ok = buyMat(s, node(s), arg as MatId);
        if (ok) sfx.buy();
        break;
      case 'sell-mat':
        ok = sellMat(s, node(s), arg as MatId);
        if (ok) sfx.buy();
        break;
      case 'buy-sup':
        ok = buySupply(s, node(s), p as 'fuel' | 'food' | 'energy', Number(q));
        if (ok) sfx.buy();
        break;
      case 'sell-sup':
        ok = sellSupply(s, node(s), arg as 'fuel' | 'food');
        break;
      case 'buy-item':
        ok = buyItem(s, node(s), arg as ConsumableId);
        if (ok) sfx.buy();
        break;
      case 'sell-item':
        ok = sellItem(s, node(s), arg as ConsumableId);
        break;
      case 'buy-gear':
        ok = buyGear(s, node(s), Number(arg));
        if (ok) sfx.buy();
        break;
      case 'sell-gear':
        ok = sellGear(s, node(s), Number(arg));
        break;
      case 'repair':
        ok = repairAll(s, node(s)) > 0;
        if (ok) sfx.upgrade();
        break;
      case 'heal':
        ok = healAll(s);
        if (ok) sfx.good();
        break;
      case 'hire':
        ok = hire(s, node(s), Number(arg));
        if (ok) sfx.good();
        break;
      case 'accept-quest':
        ok = acceptQuest(s, node(s));
        break;
      case 'turnin': {
        const qu = s.quests.find((x) => x.uid === Number(arg));
        if (qu) {
          s.report = { title: 'Job done', lines: completeQuest(s, qu) };
          sfx.good();
        }
        break;
      }
      // Events and screens
      case 'choose':
        ok = choose(s, Number(arg));
        if (ok) (s.event?.changes.some((l) => /^[−-]/.test(l)) ? sfx.bad : sfx.good)();
        break;
      case 'close-event':
        ok = closeEvent(s);
        break;
      case 'close-report':
        closeReport(s);
        break;
      case 'lost-ack':
        ackLost(s);
        break;
      case 'close-combat':
        ok = closeCombat(s);
        this.anim = null;
        break;
      case 'target':
        if (s.combat) s.combat.target = arg as SubsysId;
        break;
      case 'cact': {
        if (!animDone(this.anim, performance.now() / 1000)) return;
        const action: CombatAction =
          p === 'ability' ? { k: 'ability', cls: q as never } : p === 'item' ? { k: 'item', id: q as ConsumableId } : { k: p as 'fire' | 'brace' | 'jump' };
        ok = combatTurn(s, action);
        if (ok) this.playCombat();
        break;
      }
      case 'liftoff':
        if (s.away && liftOff(s.away)) sfx.liftoff();
        break;
      case 'away-item':
        ok = useAwayItem(s, arg as 'o2can' | 'medkit');
        if (ok) sfx.pickup();
        break;
      // Crew
      case 'crew-sel':
        this.ui.crewSel = this.ui.crewSel === Number(arg) ? null : Number(arg);
        break;
      case 'stat': {
        const c = s.crew.find((x) => x.id === Number(p));
        ok = !!c && spendStat(c, q as StatId);
        break;
      }
      case 'learn': {
        const c = s.crew.find((x) => x.id === Number(p));
        ok = !!c && learn(c, q!);
        if (ok) sfx.level();
        break;
      }
      case 'equip-pick':
        this.modal = { k: 'equip', crew: Number(p), slot: q as GearSlot };
        break;
      case 'equip': {
        const c = s.crew.find((x) => x.id === Number(p));
        ok = !!c && equip(s, c, Number(q));
        if (ok) this.modal = null;
        break;
      }
      case 'unequip': {
        const c = s.crew.find((x) => x.id === Number(p));
        if (c) unequip(c, q as GearSlot);
        break;
      }
      case 'dismiss':
        ok = dismiss(s, Number(arg));
        this.ui.crewSel = null;
        break;
      // Ship and cargo
      case 'upgrade':
        ok = upgrade(s, arg as ModuleId);
        if (ok) sfx.upgrade();
        break;
      case 'cargo-tab':
        this.ui.cargoTab = arg as UiState['cargoTab'];
        break;
      case 'craft': {
        const out = craft(s, stateRng(s), arg);
        ok = !!out;
        if (out) {
          sfx.craft();
          this.flashMain(out);
        }
        break;
      }
      case 'scrap': {
        const back = scrapGear(s, Number(arg));
        ok = !!back;
        if (back) sfx.craft();
        break;
      }
      case 'use-item':
        ok = useItem(s, arg as ConsumableId);
        if (ok) sfx.pickup();
        break;
      case 'log-tab':
        this.ui.logTab = arg as UiState['logTab'];
        break;
      // Settings and saves
      case 'settings':
        this.modal = { k: 'settings' };
        break;
      case 'close-modal':
        this.modal = null;
        break;
      case 'mute':
        s.settings.muted = !s.settings.muted;
        this.applySettings();
        break;
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        break;
      case 'export': {
        const ta = this.modalBox.querySelector('[data-input="export"]') as HTMLTextAreaElement | null;
        const code = exportSave(s);
        if (ta) {
          ta.value = code;
          ta.select();
        }
        void navigator.clipboard?.writeText(code).catch(() => undefined);
        return;
      }
      case 'import':
        this.modal = { k: 'import' };
        break;
      case 'import-go': {
        const ta = this.modalBox.querySelector('[data-input="import"]') as HTMLTextAreaElement | null;
        const loaded = ta ? importSave(ta.value) : null;
        if (!loaded) {
          sfx.deny();
          if (ta) ta.value = 'That code didn\'t work. Check you copied all of it.';
          return;
        }
        this.replace(loaded);
        return;
      }
      case 'reset':
        this.modal = { k: 'reset' };
        break;
      case 'reset-go':
      case 'new-game':
        clearLocal();
        this.replace(newGame((Math.random() * 2 ** 31) | 0, Date.now()));
        return;
      // Creation
      case 'origin':
        this.ui.draft.origin = arg;
        break;
      case 'roll-face':
        this.ui.draft.portrait = rollFace();
        break;
      case 'start': {
        const o = ORIGINS.find((x) => x.id === this.ui.draft.origin) ?? ORIGINS[0]!;
        ok = createCaptain(s, this.ui.draft.name || 'Captain', o.id, this.ui.draft.portrait);
        if (ok) sfx.story();
        break;
      }
      default:
        return;
    }
    if (!ok) sfx.deny();
    else if (!['jump', 'cact', 'buy-mat', 'sell-mat', 'buy-sup', 'buy-item', 'buy-gear', 'craft', 'upgrade', 'choose', 'learn', 'repair', 'heal', 'hire', 'liftoff', 'away-item'].includes(a)) sfx.click();
    if (s.crew.reduce((x, c) => x + c.level, 0) > levels) sfx.level();
    this.dirty = true;
    this.save(true);
  }

  private flashMain(text: string): void {
    this.flash(text);
  }

  private replace(next: GameState): void {
    for (const k of Object.keys(this.s)) delete (this.s as unknown as Record<string, unknown>)[k];
    Object.assign(this.s, next);
    this.modal = null;
    this.ui.tab = 'map';
    this.ui.selected = null;
    this.ui.crewSel = null;
    this.anim = null;
    this.applySettings();
    this.save(true);
    this.dirty = true;
  }

  private playCombat(): void {
    const c = this.s.combat!;
    const now = performance.now() / 1000;
    this.anim = { start: now, fx: [...c.fx] };
    c.fx.forEach((f, i) => {
      window.setTimeout(() => {
        if (f.kind === 'laser') sfx.laser(f.from === 'enemy');
        else if (f.kind === 'missile') sfx.missile();
        else sfx.ion();
      }, i * 224);
      if (f.hit) window.setTimeout(() => sfx.hit(), i * 224 + 300);
    });
    if (c.result === 'win') window.setTimeout(() => sfx.boom(), c.fx.length * 224 + 300);
    if (c.result === 'lose') window.setTimeout(() => sfx.boom(), c.fx.length * 224 + 300);
  }

  // ---------------------------------------------------------------- Away overlay

  private buildAwayOverlay(): void {
    this.overlay.innerHTML = `<div class="away-hud"><div class="meters" data-k="meters"></div><div class="haul" data-k="haul"></div></div>
      <div class="stick-zone"><div class="stick"><i></i></div></div>
      <div class="away-items" data-k="items"></div>
      <div class="away-controls"><div class="round" data-k="skill"><div class="cd"></div><span></span></div><div class="round big" data-k="act"><span>ACT</span></div></div>
      <button class="btn primary liftoff" data-act="liftoff" data-k="liftoff" style="display:none">Lift off</button>
      <div class="toast" data-k="toast" style="display:none"></div>
      <div class="keys-hint">WASD move · Space act · E skill · Q air · R medkit · Enter lift off</div>`;
    const q = (k: string): HTMLElement => this.overlay.querySelector(`[data-k="${k}"]`) as HTMLElement;
    this.controls.bind(this.overlay.querySelector('.stick-zone') as HTMLElement, this.overlay.querySelector('.stick') as HTMLElement, q('act'), q('skill'));
  }

  private updateAwayOverlay(now: number): void {
    const a = this.s.away;
    if (!a) return;
    const q = (k: string): HTMLElement | null => this.overlay.querySelector(`[data-k="${k}"]`);
    const meters = q('meters');
    if (!meters) return;
    morph(
      meters,
      `<div class="row"><span style="width:44px">Air</span>${barHtml(a.o2 / a.o2Max, 'o2')}<span>${Math.ceil(a.o2)}s</span></div>
       <div class="row"><span style="width:44px">Suit</span>${barHtml(a.shield / a.shieldMax, 'shield')}</div>
       <div class="row"><span style="width:44px">Health</span>${barHtml(a.hp / a.hpMax, 'hp')}</div>
       <div class="row"><span style="width:44px">Pack</span>${barHtml(carried(a) / a.carryMax)}<span>${carried(a)}/${a.carryMax}</span></div>`,
    );
    morph(
      q('haul')!,
      `<span class="small">${esc(a.planet)}</span>${Object.entries(a.haul)
        .filter(([, v]) => v)
        .map(([m, v]) => `<span>${v} ${esc(m)}</span>`)
        .join('')}${a.colonists ? `<span class="good">${a.colonists} sleeper${a.colonists === 1 ? '' : 's'}</span>` : ''}${a.gotObjective ? '<span class="gold">objective ✓</span>' : ''}`,
    );
    morph(
      q('items')!,
      `<button class="round" data-act="away-item" data-arg="o2can"${this.s.items.o2can ? '' : ' disabled'}><span>AIR ${this.s.items.o2can}</span></button><button class="round" data-act="away-item" data-arg="medkit"${this.s.items.medkit ? '' : ' disabled'}><span>MED ${this.s.items.medkit}</span></button>`,
    );
    const skill = q('skill')!;
    (skill.querySelector('span') as HTMLElement).textContent = skillName(a).toUpperCase();
    (skill.querySelector('.cd') as HTMLElement).style.transform = `scaleY(${a.skillMax ? a.skillCd / a.skillMax : 0})`;
    const near = nearestInteractable(a);
    (q('act')!.querySelector('span') as HTMLElement).textContent = near ? (near.k === 'node' ? 'GATHER' : near.k === 'pod' ? 'RESCUE' : near.k === 'objective' ? 'TAKE' : 'OPEN') : 'SHOOT';
    q('liftoff')!.style.display = nearLander(a) ? 'inline-flex' : 'none';
    const toast = q('toast')!;
    let msg = this.toast && this.toast.until > now ? this.toast.text : '';
    if (!msg && a.o2 < a.o2Max * 0.25) msg = 'Air running low — head back to the lander!';
    if (!msg && a.t < 4) msg = `${BIOME.get(a.biome)!.name}. Gather what you can, then get back to the lander.`;
    toast.style.display = msg ? 'block' : 'none';
    toast.textContent = msg;
  }

  private awayEvents(): void {
    const a = this.s.away!;
    for (const e of a.events) {
      if (e === 'gather') sfx.gather();
      else if (e === 'shoot') sfx.shoot();
      else if (e === 'hurt') sfx.hurt();
      else if (e === 'kill') sfx.kill();
      else if (e === 'cache' || e === 'terminal' || e === 'pod') sfx.pickup();
      else if (e === 'objective') sfx.story();
      else if (e.startsWith('skill')) sfx.skill();
      else if (e === 'down') sfx.bad();
      else if (e === 'full') this.flash('Pack full — head back to the lander.');
    }
    a.events.length = 0;
  }

  // ---------------------------------------------------------------- Frame

  private frame(tMs: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const t = tMs / 1000;
    const dt = Math.min(0.1, t - (this.lastT || t));
    this.lastT = t;
    const s = this.s;
    if (s.screen !== this.prevScreen) this.screenChanged();

    if (s.screen === 'away' && s.away) {
      if (!this.overlay.querySelector('.stick-zone')) this.buildAwayOverlay();
      const blocked = !!s.report || !!this.modal;
      if (!blocked && s.away.status === 'play') {
        this.acc += dt;
        const input = this.controls.read();
        while (this.acc >= DT) {
          stepAway(s.away, input);
          this.acc -= DT;
        }
        this.awayEvents();
      }
      if (s.away.status !== 'play') {
        this.awayEvents();
        closeAway(s);
        this.overlay.innerHTML = '';
        this.controls.reset();
        sfx[s.report?.title.startsWith('Lost') ? 'bad' : 'good']();
        this.dirty = true;
        this.save(true);
      } else {
        this.updateAwayOverlay(tMs);
        if (tMs - this.lastSave > AUTOSAVE_MS) this.save(true);
      }
    }

    this.draw(t);
    if (this.dirty || tMs - this.lastPanel > 500) {
      this.renderDom();
      this.lastPanel = tMs;
      this.dirty = false;
    }
  }

  private screenChanged(): void {
    const s = this.s;
    const prev = this.prevScreen;
    this.prevScreen = s.screen;
    if (s.screen !== 'away') this.overlay.innerHTML = '';
    if (s.screen === 'event' && prev && prev !== 'event') (s.event?.source === 'story' ? sfx.story : sfx.event)();
    if (s.screen === 'lost') sfx.warn();
    if (s.screen === 'combat') this.ui.tab = 'map';
    const sec = SECTORS[s.sector.index]!;
    setMood({
      root: sec.music.root,
      mode: s.screen === 'ending' ? 'ionian' : sec.music.mode,
      bpm: sec.music.bpm,
      combat: s.screen === 'combat',
      muffle: s.screen === 'away' ? 1 : 0,
      tension: s.screen === 'away' && s.away ? (BIOME.get(s.away.biome)!.hazard === 'none' ? 0.2 : 0.7) : 0,
    });
    this.dirty = true;
  }

  private draw(t: number): void {
    const s = this.s;
    if (getComputedStyle(this.stage).display === 'none') return;
    const { w, h } = fit(this.canvas);
    const ctx = pixelCtx(this.canvas);
    if (s.screen === 'away' && s.away) drawAway(ctx, w, h, s.away, this.cam, t);
    else if (s.screen === 'combat' && s.combat) drawCombat(ctx, w, h, s, this.anim ? { ...this.anim, start: this.anim.start } : null, performance.now() / 1000);
    else if (s.sector.nodes.length) drawMap(ctx, w, h, s, this.ui.selected, t);
    else drawStarfield(ctx, w, h, t, '#3a4a8a');
  }

  private renderDom(): void {
    const s = this.s;
    this.appEl.dataset['screen'] = s.screen;
    this.appEl.dataset['tab'] = this.ui.tab;
    if (s.screen === 'create') {
      morph(this.main, createPanel(this.ui));
    } else if (s.screen === 'ending') {
      morph(this.main, endingPanel(s));
    } else if (s.screen !== 'away') {
      morph(this.hud, hudHtml(s));
      morph(this.tabs, tabsHtml(s, this.ui));
      if (s.screen === 'combat' && s.combat) {
        morph(this.main, combatPanel(s, !animDone(this.anim, performance.now() / 1000)));
        morph(this.overlay, combatOverlay(s));
      } else {
        const panel = this.ui.tab === 'ship' ? shipPanel(s) : this.ui.tab === 'crew' ? crewPanel(s, this.ui) : this.ui.tab === 'cargo' ? cargoPanel(s, this.ui) : this.ui.tab === 'log' ? logPanel(s, this.ui) : mapPanel(s, this.ui);
        morph(this.main, panel);
        if (this.toast && this.toast.until > performance.now()) {
          if (!this.overlay.querySelector('.toast')) this.overlay.innerHTML = '<div class="toast"></div>';
          (this.overlay.querySelector('.toast') as HTMLElement).textContent = this.toast.text;
        } else if (s.screen !== 'combat') this.overlay.innerHTML = '';
      }
    }
    // Modals: a report sits over everything, then an event, then signal lost, then our own.
    let html = '';
    if (s.report) html = reportModal(s);
    else if (s.screen === 'event' && s.event) html = eventModal(s);
    else if (s.screen === 'lost') html = lostModal(s);
    else if (this.modal?.k === 'settings') html = settingsModal(s, this.saveOk);
    else if (this.modal?.k === 'import') html = importModal();
    else if (this.modal?.k === 'reset') html = confirmResetModal();
    else if (this.modal?.k === 'explorer' && s.screen === 'map') html = explorerPicker(s, this.modal.planet);
    else if (this.modal?.k === 'equip') html = equipPicker(s, this.modal.crew, this.modal.slot);
    if (html) {
      if (!this.modalLayer.classList.contains('open')) this.modalBox.innerHTML = '';
      this.modalLayer.classList.add('open');
      morph(this.modalBox, html);
    } else {
      this.modalLayer.classList.remove('open');
      if (this.modal && this.modal.k === 'explorer' && s.screen !== 'map') this.modal = null;
    }
  }
}
