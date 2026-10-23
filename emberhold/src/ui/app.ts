/**
 * The shell: header with the current activity, a drawer of skills, a
 * bottom nav, modals and toasts. Views are HTML strings morphed into place
 * a few times a second; progress bars are moved every frame.
 */
import { homeArea } from '../data/combat';
import { item } from '../data/items';
import { MODES } from '../data/meta';
import { SKILL_INFO, SKILL_LIST } from '../data/skills';
import type { GameMode, SkillId, Slot } from '../data/types';
import { combatLevel, invalidate, level, newGame, notice, skillUnlocked } from '../game/core';
import {
  bury, chooseBoon, collectLoot, currentMonster, eat, equip, equipFood, newSlayerTask, playerStats, startCombat, startRaid, stopCombat, togglePrayer, unequip, unequipFood,
} from '../game/combat';
import { activityProgress, advance } from '../game/engine';
import { applyOffline, type OfflineReport } from '../game/offline';
import { startAction, stopActivity } from '../game/skilling';
import {
  buildObstacle, buildPillar, buy, buyAnimal, completeQuest, donate, drinkPotion, harvest, harvestAll, lightBonfire, openChest, plant, raiseStar, sell, sellAnimals,
  startAgility, startSurvey, unlockSkill, upgradeBuilding,
} from '../game/systems';
import { clearLocal, exportSave, importSave, saveLocal } from '../state/persistence';
import type { GameState, MeleeStyle, MagicStyle, RangedStyle } from '../state/types';
import { sfx, setSound } from '../audio/sfx';
import { morph } from './dom';
import { bar, btn, chip, esc, fmt, fmtInt, iconHtml } from './kit';
import { newUi, type Ui, type View } from './state';
import { bankView, itemSheet } from './views/bank';
import { combatView } from './views/combat';
import {
  completionView, guildsView, logView, moreView, museumView, petsView, questsView, raidView, settingsView, shopView, statsView,
} from './views/meta';
import { activeSkill, animalPicker, seedPicker, skillIcon, skillView, skillsView } from './views/skills';
import type { PlotKind } from '../data/special';

const TITLES: Record<View, string> = {
  skills: 'Skills', skill: '', bank: 'Bank', combat: 'Combat', guilds: 'Guilds', more: 'More', shop: 'Shop', quests: 'Quests', raid: 'The Gauntlet',
  pets: 'Pets', completion: 'Completion', museum: 'Museum', stats: 'Statistics', settings: 'Settings', log: 'Messages',
};

export class App {
  private ui: Ui = newUi();
  private modal: string | null = null;
  private modalFn: (() => string) | null = null;
  private last = performance.now();
  private lastRender = 0;
  private lastSave = Date.now();
  private seenLog = 0;
  private toasts: { text: string; kind: string; until: number }[] = [];
  private els: { header: HTMLElement; main: HTMLElement; nav: HTMLElement; drawer: HTMLElement; modal: HTMLElement; toasts: HTMLElement };

  constructor(private root: HTMLElement, private s: GameState, offline: OfflineReport | null, fresh: boolean) {
    root.innerHTML = `<header id="hdr"></header><main id="main"></main><nav id="nav"></nav><aside id="drawer"></aside><div id="modal"></div><div id="toasts"></div>`;
    this.els = {
      header: root.querySelector('#hdr')!, main: root.querySelector('#main')!, nav: root.querySelector('#nav')!, drawer: root.querySelector('#drawer')!,
      modal: root.querySelector('#modal')!, toasts: root.querySelector('#toasts')!,
    };
    this.seenLog = s.log.length;
    setSound(s.settings.sound);
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('change', (e) => this.onInput(e));
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => saveLocal(this.s));
    if (fresh) this.openModal(() => this.welcome());
    else if (offline && s.settings.offlineReport) this.openModal(() => offlineHtml(offline));
    if (s.dead) this.openModal(() => this.deadHtml());
    this.render(true);
    requestAnimationFrame((t) => this.frame(t));
  }

  get state(): GameState {
    return this.s;
  }

  // --- Loop ----------------------------------------------------------------------

  private frame(t: number): void {
    const dt = Math.min(1000, t - this.last);
    this.last = t;
    if (!document.hidden) {
      advance(this.s, dt);
      if (t - this.lastRender > 250) this.render();
      this.bars();
      if (Date.now() - this.lastSave > 10_000) {
        saveLocal(this.s);
        this.lastSave = Date.now();
      }
    }
    requestAnimationFrame((n) => this.frame(n));
  }

  /** Coming back to the tab: anything over a minute is replayed as offline time with a report. */
  private onVisibility(): void {
    if (document.hidden) {
      saveLocal(this.s);
      return;
    }
    const away = (Date.now() - this.s.savedAt) / 1000;
    this.last = performance.now();
    if (away > 60) {
      const r = applyOffline(this.s, away);
      saveLocal(this.s);
      if (r && this.s.settings.offlineReport) this.openModal(() => offlineHtml(r));
      this.render(true);
    }
  }

  private render(force = false): void {
    this.lastRender = performance.now();
    this.flushNotices();
    morph(this.els.header, this.headerHtml());
    morph(this.els.nav, this.navHtml());
    morph(this.els.drawer, this.drawerHtml());
    this.els.drawer.classList.toggle('open', this.ui.drawer);
    // Don't morph while the player is typing in a field on the page.
    const typing = document.activeElement instanceof HTMLInputElement && this.els.main.contains(document.activeElement) && document.activeElement.type !== 'checkbox';
    if (!typing || force) morph(this.els.main, this.viewHtml());
    if (this.modalFn) this.modal = this.modalFn();
    morph(this.els.modal, this.modal ? `<div class="backdrop" data-act="close"></div><div class="sheet"><button class="x" data-act="close" aria-label="Close">×</button>${this.modal}</div>` : '');
    this.els.modal.classList.toggle('open', !!this.modal);
    const now = performance.now();
    this.toasts = this.toasts.filter((t) => t.until > now);
    morph(this.els.toasts, this.toasts.map((t) => `<div class="toast ${t.kind}">${esc(t.text)}</div>`).join(''));
    if (this.s.dead && !this.modal) this.openModal(() => this.deadHtml());
  }

  /** Progress bars every frame: the activity, swing timers. */
  private bars(): void {
    const p = activityProgress(this.s);
    const frac = p?.frac ?? 0;
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-prog="action"] .fill')) el.style.width = `${(frac * 100).toFixed(1)}%`;
    const c = this.s.combat;
    if (c) {
      const ps = playerStats(this.s);
      const pf = c.enemy ? 1 - c.playerTimer / ps.speed : 0;
      const mon = currentMonster(this.s);
      const ef = c.enemy && mon ? 1 - c.enemy.timer / mon.speed : 0;
      for (const el of this.root.querySelectorAll<HTMLElement>('[data-prog="ptimer"] .fill')) el.style.width = `${Math.max(0, Math.min(100, pf * 100)).toFixed(1)}%`;
      for (const el of this.root.querySelectorAll<HTMLElement>('[data-prog="etimer"] .fill')) el.style.width = `${Math.max(0, Math.min(100, ef * 100)).toFixed(1)}%`;
    }
  }

  private flushNotices(): void {
    const log = this.s.log;
    if (this.seenLog > log.length) this.seenLog = 0;
    const fresh = log.slice(this.seenLog);
    this.seenLog = log.length;
    for (const n of fresh.slice(-4)) {
      this.toasts.push({ text: n.text, kind: n.kind, until: performance.now() + 3500 });
      if (n.kind === 'level') sfx('level');
      else if (n.kind === 'good') sfx('good');
      else if (n.kind === 'bad') sfx('bad');
    }
    if (this.toasts.length > 4) this.toasts.splice(0, this.toasts.length - 4);
  }

  // --- Chrome --------------------------------------------------------------------

  private headerHtml(): string {
    const s = this.s;
    const p = activityProgress(s);
    const title = this.ui.view === 'skill' ? SKILL_INFO[this.ui.skill].name : TITLES[this.ui.view];
    let act = '';
    if (s.activity?.kind === 'combat' && s.combat) {
      const mon = currentMonster(s);
      const ps = playerStats(s);
      act = `<button class="activity" data-act="nav" data-view="${s.raid ? 'raid' : 'combat'}">${mon ? iconHtml(mon.icon, 1) : ''}<span class="grow">${esc(s.raid ? `Gauntlet wave ${s.raid.wave}` : mon?.name ?? 'Combat')}</span>
        ${bar(s.hp / ps.maxHp, 'mini hp', '')}${s.combat.enemy ? bar(s.combat.enemy.hp / s.combat.enemy.maxHp, 'mini foehp', '') : ''}</button><button class="stopbtn" data-act="run" aria-label="Stop">■</button>`;
    } else if (p) {
      const sk = p.skill as SkillId | null;
      act = `<button class="activity" data-act="${sk ? 'skill' : 'noop'}" data-skill="${sk ?? ''}">${sk ? skillIcon(sk, 1) : ''}<span class="grow">${esc(p.label)}</span>${bar(0, 'mini act', '', 'action')}</button><button class="stopbtn" data-act="stop" aria-label="Stop">■</button>`;
    } else {
      act = '<span class="activity idle">Idle: pick something to do</span>';
    }
    return `<div class="top"><button class="menu" data-act="drawer" aria-label="Skills">☰</button><h1>${esc(title)}</h1><span class="gp">${iconHtml('ui.gp', 1)}${fmt(Math.floor(s.gp))}</span></div><div class="actbar">${act}</div>`;
  }

  private navHtml(): string {
    const v = this.ui.view;
    const items: [View, string, string][] = [['skills', 'ui.skills', 'Skills'], ['bank', 'ui.bank', 'Bank'], ['combat', 'ui.combat', 'Combat'], ['guilds', 'ui.guild', 'Guilds'], ['more', 'ui.settings', 'More']];
    const on = (x: View): boolean => x === v || (x === 'skills' && v === 'skill') || (x === 'more' && ['shop', 'quests', 'raid', 'pets', 'completion', 'museum', 'stats', 'settings', 'log'].includes(v));
    return items.map(([id, icon, label]) => `<button class="${on(id) ? 'on' : ''}" data-act="nav" data-view="${id}">${iconHtml(icon, 1)}<span>${label}</span></button>`).join('');
  }

  private drawerHtml(): string {
    const s = this.s;
    const cur = activeSkill(s);
    let html = `<div class="dhead"><b>${esc(s.name)}</b><span class="muted small">${esc(MODES[s.mode].name)} · cb ${combatLevel(s)}</span></div>`;
    for (const [kind, label] of [['combat', 'Combat'], ['gathering', 'Gathering'], ['artisan', 'Artisan'], ['support', 'Support']] as const) {
      html += `<div class="dsec">${label}</div>`;
      for (const sk of SKILL_LIST.filter((x) => x.kind === kind)) {
        const locked = !skillUnlocked(s, sk.id);
        html += `<button class="drow${cur === sk.id ? ' on' : ''}${locked ? ' dim' : ''}" data-act="skill" data-skill="${sk.id}">${skillIcon(sk.id, 1)}<span class="grow">${esc(sk.name)}</span><b>${locked ? '🔒' : this.level(sk.id)}</b></button>`;
      }
    }
    return html;
  }

  private level(id: SkillId): number {
    return level(this.s, id);
  }

  private viewHtml(): string {
    const s = this.s;
    switch (this.ui.view) {
      case 'skills':
        return skillsView(s);
      case 'skill':
        return skillView(s, this.ui);
      case 'bank':
        return bankView(s, this.ui);
      case 'combat':
        return combatView(s, this.ui);
      case 'guilds':
        return guildsView(s, this.ui);
      case 'more':
        return moreView(s);
      case 'shop':
        return shopView(s, this.ui);
      case 'quests':
        return questsView(s);
      case 'raid':
        return raidView(s);
      case 'pets':
        return petsView(s);
      case 'completion':
        return completionView(s);
      case 'museum':
        return museumView(s);
      case 'stats':
        return statsView(s);
      case 'settings':
        return settingsView(s);
      case 'log':
        return logView(s);
    }
  }

  // --- Modals --------------------------------------------------------------------

  private openModal(fn: () => string): void {
    this.modalFn = fn;
    this.modal = fn();
  }

  private closeModal(): void {
    this.modal = null;
    this.modalFn = null;
  }

  private welcome(): string {
    return `<h2>Welcome to Emberhold</h2><p>An idle RPG: pick a skill, and it keeps training while you do other things or close the game. Thirty skills, mastery guilds, dungeons, slayer, a settlement and a ranch.</p>
      <p class="small muted">Choose how you want to play. You can start over from Settings any time.</p><div class="list">
      ${(Object.keys(MODES) as GameMode[]).map((m) => `<button class="listrow" data-act="${m === 'standard' ? 'close' : 'new-game'}" data-mode="${m}" data-confirm="0"><span class="grow"><b>${esc(MODES[m].name)}</b><small>${esc(MODES[m].desc)}</small></span></button>`).join('')}</div>`;
  }

  private deadHtml(): string {
    return `<h2>You have died</h2><p>In Hardcore there is no coming back. Your save stays as a memorial until you start again.</p>
      <div class="list">${(Object.keys(MODES) as GameMode[]).map((m) => `<button class="listrow" data-act="new-game" data-mode="${m}" data-confirm="0"><span class="grow"><b>New ${esc(MODES[m].name)} game</b></span></button>`).join('')}</div>`;
  }

  private adventurePick(mode: GameMode): string {
    return `<h2>Adventure: your first skill</h2><p class="small muted">Combat is always open. Pick one other skill to start with.</p><div class="skillgrid">
      ${SKILL_LIST.filter((x) => x.kind !== 'combat').map((sk) => `<button class="skillcard" data-act="new-game" data-mode="${mode}" data-first="${sk.id}" data-confirm="0">${skillIcon(sk.id)}<span class="nm">${esc(sk.name)}</span></button>`).join('')}</div>`;
  }

  // --- Events --------------------------------------------------------------------

  private toast(text: string | null, kind = 'bad'): void {
    if (!text) return;
    this.toasts.push({ text, kind, until: performance.now() + 3000 });
    if (kind === 'bad') sfx('bad');
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const key = el.dataset['input'];
    if (!key) return;
    const s = this.s;
    switch (key) {
      case 'bankSearch':
        this.ui.bankSearch = el.value;
        morph(this.els.main, this.viewHtml());
        return;
      case 'bankSort':
        this.ui.bankSort = el.value as Ui['bankSort'];
        break;
      case 'sound':
        s.settings.sound = (el as HTMLInputElement).checked;
        setSound(s.settings.sound);
        break;
      case 'offlineReport':
        s.settings.offlineReport = (el as HTMLInputElement).checked;
        break;
      case 'name':
        s.name = el.value.slice(0, 20) || 'Adventurer';
        break;
      case 'importCode':
        return;
    }
    this.render(true);
  }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const d = el.dataset;
    const act = d['act']!;
    const s = this.s;
    sfx('click');
    const t = (msg: string | null, ok?: string): void => {
      if (msg) this.toast(msg);
      else if (ok) this.toast(ok, 'good');
    };
    switch (act) {
      case 'noop':
        return;
      case 'close':
        this.closeModal();
        break;
      case 'drawer':
        this.ui.drawer = !this.ui.drawer;
        break;
      case 'nav':
        this.ui.view = d['view'] as View;
        this.ui.drawer = false;
        if (d['guild']) this.ui.openGuild = d['guild'];
        this.closeModal();
        this.els.main.scrollTop = 0;
        window.scrollTo(0, 0);
        break;
      case 'skill': {
        const sk = d['skill'] as SkillId;
        if (!sk) return;
        this.ui.drawer = false;
        if (SKILL_INFO[sk].kind === 'combat' && sk !== 'prayer' && sk !== 'slayer') {
          this.ui.view = 'combat';
        } else if (sk === 'prayer') {
          this.ui.view = 'combat';
          this.ui.combatTab = 'prayer';
        } else if (sk === 'slayer') {
          this.ui.view = 'combat';
          this.ui.combatTab = 'slayer';
        } else {
          this.ui.view = 'skill';
          this.ui.skill = sk;
        }
        window.scrollTo(0, 0);
        break;
      }
      case 'start':
        t(startAction(s, d['id']!));
        break;
      case 'stop':
        stopActivity(s);
        break;
      case 'group': {
        const g = d['group']!;
        this.ui.openGroups = this.ui.openGroups.includes(g) ? this.ui.openGroups.filter((x) => x !== g) : [...this.ui.openGroups, g];
        break;
      }
      // Bank and items.
      case 'bank-cat':
        this.ui.bankCat = d['cat']!;
        break;
      case 'item':
        this.openModal(() => itemSheet(this.s, d['id']!, this.ui));
        break;
      case 'sell': {
        const id = d['id']!;
        const n = Number(d['n']);
        const gp = sell(s, id, n);
        if (gp) this.toast(`Sold for ${fmt(gp)} gold.`, 'good');
        sfx('coin');
        if (!(s.bank[id] ?? 0)) this.closeModal();
        break;
      }
      case 'equip':
        t(equip(s, d['id']!, (d['slot'] as Slot | undefined) ?? undefined), `Equipped ${item(d['id']!).name}.`);
        if (!s.bank[d['id']!]) this.closeModal();
        break;
      case 'equip-food':
        t(equipFood(s, d['id']!), 'Food equipped.');
        this.closeModal();
        break;
      case 'unequip':
        if (!unequip(s, d['slot'] as Slot)) this.toast('Bank full.');
        break;
      case 'unequip-food':
        s.food.forEach((_, i) => unequipFood(s, i));
        break;
      case 'food-slot':
        s.foodSlot = Number(d['n']);
        if (s.combat && s.food[s.foodSlot]) eat(s);
        break;
      case 'bury':
        t(bury(s, d['id']!, Number(d['n'])));
        if (!s.bank[d['id']!]) this.closeModal();
        break;
      case 'open': {
        const got = openChest(s, d['id']!, Number(d['n']));
        if (got.length) this.openModal(() => `<h3>You found</h3><div class="chips">${got.map((g) => chip(g.item, g.qty)).join('')}</div>`);
        break;
      }
      case 'drink':
        t(drinkPotion(s, d['id']!), 'Potion active.');
        this.closeModal();
        break;
      case 'donate':
        t(donate(s, d['id']!), 'Donated to the museum.');
        if (this.modalFn && !s.bank[d['id']!]) this.closeModal();
        break;
      case 'lock': {
        const id = d['id']!;
        s.locked = s.locked.includes(id) ? s.locked.filter((x) => x !== id) : [...s.locked, id];
        break;
      }
      // Combat.
      case 'combat-tab':
        this.ui.combatTab = d['tab'] as Ui['combatTab'];
        break;
      case 'area-kind':
        this.ui.areaKind = d['kind'] as Ui['areaKind'];
        break;
      case 'area':
        this.ui.openArea = this.ui.openArea === d['id'] ? null : d['id']!;
        break;
      case 'fight':
        t(startCombat(s, d['area']!, d['monster'] ?? null));
        break;
      case 'run':
        stopCombat(s);
        stopActivity(s);
        break;
      case 'eat':
        if (!eat(s)) this.toast('No food equipped.');
        break;
      case 'loot': {
        const n = collectLoot(s);
        if (s.loot.length) this.toast('Bank full: some loot left behind.');
        else if (n) sfx('coin');
        break;
      }
      case 'loadout':
        s.loadout = Number(d['n']);
        invalidate(s);
        break;
      case 'style': {
        const k = d['k'] as 'meleeStyle' | 'rangedStyle' | 'magicStyle';
        if (k === 'meleeStyle') s.meleeStyle = d['v'] as MeleeStyle;
        else if (k === 'rangedStyle') s.rangedStyle = d['v'] as RangedStyle;
        else s.magicStyle = d['v'] as MagicStyle;
        break;
      }
      case 'prayer':
        t(togglePrayer(s, d['id']!));
        invalidate(s);
        break;
      case 'spell':
        s.spell = d['id']!;
        break;
      case 'aurora':
        s.aurora = s.aurora === d['id'] ? null : d['id']!;
        break;
      case 'slayer-task':
        t(newSlayerTask(s, d['tier']!));
        break;
      case 'slayer-fight': {
        const task = s.slayerTask;
        if (!task) break;
        const area = homeArea(task.monster);
        if (area) t(startCombat(s, area.id, task.monster));
        break;
      }
      // Skill panels.
      case 'compost':
        this.ui.compost = Number(d['n']) as 0 | 1 | 2;
        break;
      case 'plot':
        this.openModal(() => seedPicker(this.s, d['kind'] as PlotKind, Number(d['i'])));
        break;
      case 'plant':
        t(plant(s, d['kind'] as PlotKind, Number(d['i']), d['seed']!, this.ui.compost));
        this.closeModal();
        break;
      case 'harvest':
        t(harvest(s, d['kind'] as PlotKind, Number(d['i'])));
        break;
      case 'harvest-all':
        if (!harvestAll(s)) this.toast('Nothing ready yet.', 'info');
        break;
      case 'obstacle':
        t(buildObstacle(s, d['id']!), 'Obstacle built.');
        break;
      case 'pillar':
        t(buildPillar(s, d['id']!), 'Pillar raised.');
        break;
      case 'agility':
        t(startAgility(s));
        break;
      case 'survey':
        t(startSurvey(s, d['hex']));
        break;
      case 'star':
        t(raiseStar(s, d['c']!, Number(d['i'])));
        break;
      case 'building':
        t(upgradeBuilding(s, d['id']!));
        break;
      case 'pen':
        this.openModal(() => animalPicker(this.s, Number(d['i'])));
        break;
      case 'buy-animal':
        t(buyAnimal(s, Number(d['i']), d['animal']!));
        this.closeModal();
        break;
      case 'sell-animals':
        if (confirm('Sell every animal in this pen for 40% of what they cost?')) sellAnimals(s, Number(d['i']));
        break;
      case 'bonfire':
        t(lightBonfire(s, d['wood']!), 'The bonfire roars.');
        break;
      case 'unlock-skill':
        t(unlockSkill(s, d['skill'] as SkillId));
        break;
      // Meta.
      case 'guild':
        this.ui.openGuild = this.ui.openGuild === d['id'] ? null : d['id']!;
        break;
      case 'shop-tab':
        this.ui.view = 'shop';
        this.ui.shopTab = d['tab']!;
        break;
      case 'shop-buy':
        t(buy(s, d['id']!), 'Bought.');
        sfx('coin');
        break;
      case 'quest':
        t(completeQuest(s, d['id']!));
        break;
      case 'raid-start':
        if (s.combat && !confirm('Leave your current fight for the Gauntlet?')) break;
        startRaid(s, d['style'] as 'melee' | 'ranged' | 'magic');
        break;
      case 'raid-boon':
        chooseBoon(s, d['id']!);
        break;
      case 'export': {
        const code = exportSave(s);
        navigator.clipboard?.writeText(code).catch(() => undefined);
        this.openModal(() => `<h3>Your save</h3><p class="small muted">Copied to the clipboard if your browser allows it. Keep it somewhere safe.</p><textarea readonly class="code">${esc(code)}</textarea>`);
        break;
      }
      case 'import':
        this.openModal(() => `<h3>Import a save</h3><p class="small warn">This replaces your current game.</p><textarea class="code" id="importCode" data-input="importCode" placeholder="Paste a save code"></textarea>${btn('Load it', 'do-import', {}, 'primary')}`);
        break;
      case 'do-import': {
        const code = (this.root.querySelector('#importCode') as HTMLTextAreaElement | null)?.value ?? '';
        const loaded = importSave(code);
        if (!loaded) {
          this.toast('That code is not a save.');
          break;
        }
        this.replace(loaded);
        this.toast('Save loaded.', 'good');
        break;
      }
      case 'new-game': {
        const mode = d['mode'] as GameMode;
        if (d['confirm'] !== '0' && !confirm(`Start a new ${MODES[mode].name} game? This replaces your current save.`)) break;
        if (mode === 'adventure' && !d['first']) {
          this.openModal(() => this.adventurePick(mode));
          break;
        }
        clearLocal();
        const g = newGame((Math.random() * 2 ** 31) | 0, Date.now(), mode, (d['first'] as SkillId) ?? 'woodcutting');
        this.replace(g);
        notice(g, `A new ${MODES[mode].name} game begins.`, 'good');
        break;
      }
      default:
        break;
    }
    this.render(true);
  }

  private replace(g: GameState): void {
    this.s = g;
    this.seenLog = g.log.length;
    this.ui = newUi();
    this.closeModal();
    saveLocal(g);
    (window as unknown as { __emberhold: unknown }).__emberhold = g;
  }
}

function offlineHtml(r: OfflineReport): string {
  const h = Math.floor(r.seconds / 3600);
  const m = Math.floor((r.seconds % 3600) / 60);
  const items = Object.entries(r.items).sort((a, b) => b[1] - a[1]);
  const gained = items.filter(([, n]) => n > 0);
  const spent = items.filter(([, n]) => n < 0);
  return `<h2>While you were away</h2><p class="muted">${h ? `${h}h ` : ''}${m}m${r.capped ? ' (capped at 24 hours)' : ''}</p>
    ${Object.keys(r.xp).length ? `<h4>Experience</h4><ul class="xp">${Object.entries(r.xp).map(([k, v]) => `<li>${skillIcon(k as SkillId, 1)} ${esc(SKILL_INFO[k as SkillId].name)} <b>+${fmtInt(v ?? 0)}</b></li>`).join('')}</ul>` : ''}
    ${r.gp ? `<p>${iconHtml('ui.gp', 1)} ${r.gp > 0 ? '+' : ''}${fmt(r.gp)} gold</p>` : ''}
    ${r.kills ? `<p>${fmtInt(r.kills)} monsters defeated</p>` : ''}
    ${gained.length ? `<h4>Gained</h4><div class="chips">${gained.slice(0, 30).map(([id, n]) => chip(id, n)).join('')}</div>` : ''}
    ${spent.length ? `<h4>Used</h4><div class="chips">${spent.slice(0, 20).map(([id, n]) => chip(id, -n)).join('')}</div>` : ''}
    ${r.died ? '<p class="warn">You died while you were away.</p>' : ''}
    ${!Object.keys(r.xp).length && !gained.length ? '<p class="muted">Nothing was going on. Start an action before you leave and it carries on without you.</p>' : ''}
    ${btn('Carry on', 'close', {}, 'primary')}`;
}
