/**
 * The farm screen: the canvas, the HUD along the top, the hotbar along the
 * bottom, and the loop that runs the sim at a fixed step and draws it.
 */
import { cry, loadCries, sfx } from '../audio/index';
import { item } from '../data/items';
import { species } from '../data/species';
import { CAN_SIZE, tileOf, type Dir, type GameEvent, type World } from '../game/model';
import { clockText, dayOfSeason, seasonOf, weekdayOf } from '../game/time';
import { actFacing, hotbar, select, sleep, step, tapTile, tick } from '../game/world';
import { follow, tileAtPoint, type View } from '../render/camera';
import { pruneFx, render, type Fx } from '../render/draw';
import { loadSheets } from '../render/sprites';
import { saveWorld } from '../state/save';
import { openSettings, show } from './app';
import { h } from './dom';
import { itemIcon } from './icons';
import { openBag, openBin, openHelp, openMart, openSleep, openSummary } from './menus';
import { closeSheet, sheetOpen } from './sheet';

const STEP = 1 / 60;
const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

const EVENT_COLOURS: Record<string, string> = {
  harvest: '#b6f28a', refill: '#8cc4f2', hint: '#ffe08a', helper: '#ffffff',
};

export function farmScreen(world: World, isNew: boolean, quit: () => void, restart: () => void): void {
  const dexes = world.helpers.map((hp) => hp.dex);
  void loadSheets(dexes);
  loadCries(dexes);

  const canvas = h('canvas.field', { 'aria-label': 'The farm' });
  const ctx = canvas.getContext('2d')!;
  const dayEl = h('div.hud-day');
  const clockEl = h('div.hud-clock');
  const goldEl = h('div.hud-gold');
  const energyFill = h('div.energy-fill');
  const energyEl = h('div.energy', { title: 'Energy' }, energyFill);
  const menuBtn = h('button.icon-btn.menu', { 'aria-label': 'Menu' }, '☰');
  const bagBtn = h('button.icon-btn.bag', { 'aria-label': 'Bag' }, '🎒');
  const hud = h('header.hud', {},
    h('div.hud-box.hud-when', {}, dayEl, clockEl),
    h('div.hud-box.hud-money', {}, goldEl, energyEl),
    h('div.hud-buttons', {}, bagBtn, menuBtn));
  const bar = h('nav.hotbar', { 'aria-label': 'Tools and seeds' });
  const layer = h('div.layer');
  const root = h('main.farm', {}, canvas, hud, bar, layer);
  show(root);

  const fx: Fx = { floaters: [], splashes: [], target: null };
  let view: View = follow(1, 1, 0, 0);
  let camX = world.player.x;
  let camY = world.player.y;
  let lastHour = Math.floor(world.clock / 60);
  let running = true;

  const save = (): void => saveWorld(world);
  const changed = (): void => updateHud(true);

  // --- HUD ---------------------------------------------------------------------------
  let barKey = '';
  function updateHud(force = false): void {
    dayEl.textContent = `${seasonOf(world.day)} ${dayOfSeason(world.day)} · ${weekdayOf(world.day)}`;
    clockEl.textContent = `☀ ${clockText(world.clock)}`;
    goldEl.textContent = `${world.player.gold.toLocaleString('en')}g`;
    const e = world.player.energy / world.player.maxEnergy;
    energyFill.style.width = `${Math.round(e * 100)}%`;
    energyEl.classList.toggle('low', e < 0.25);
    const slots = hotbar(world);
    const key = `${slots.join()}|${world.selected}|${slots.map((id) => world.inventory[id] ?? '').join()}|${world.player.water}`;
    if (!force && key === barKey) return;
    barKey = key;
    bar.replaceChildren(...slots.map((id, i) => {
      const def = item(id);
      const count = def.kind === 'tool' ? (id === 'can' ? `${world.player.water}/${CAN_SIZE}` : '') : String(world.inventory[id] ?? 0);
      return h('button', {
        className: id === world.selected ? 'slot on' : 'slot',
        title: `${def.name} (${i + 1})`,
        'aria-label': def.name,
        'aria-pressed': String(id === world.selected),
        onclick: () => { select(world, id); sfx.click(); updateHud(); },
      }, itemIcon(id, 'slot-icon'), count ? h('span.count', { className: id === 'can' && world.player.water === 0 ? 'count empty' : 'count' }, count) : null);
    }));
  }

  // --- sizing -------------------------------------------------------------------------
  const resize = (): void => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const hgt = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // --- input --------------------------------------------------------------------------
  canvas.addEventListener('pointerdown', (e) => {
    if (sheetOpen()) return;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const t = tileAtPoint(view, (e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleX);
    tapTile(world, t.x, t.y);
    fx.target = world.player.pending;
  });
  const held = new Set<Dir>();
  const onKey = (e: KeyboardEvent): void => {
    if (!root.isConnected) return;
    const dir = KEYS[e.code];
    if (e.type === 'keyup') {
      if (dir) held.delete(dir);
      return;
    }
    if (e.code === 'Escape') {
      if (sheetOpen()) closeSheet();
      return;
    }
    if (sheetOpen()) return;
    if (dir) {
      held.add(dir);
      e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
      actFacing(world);
      e.preventDefault();
    } else if (/^Digit[1-8]$/.test(e.code)) {
      const id = hotbar(world)[Number(e.code.slice(5)) - 1];
      if (id) select(world, id);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => held.clear());

  // --- menus --------------------------------------------------------------------------
  const goToBed = (): void => {
    sleep(world);
    handleEvents();
  };
  menuBtn.addEventListener('click', () => openSettings(layer, {
    help: () => openHelp(layer),
    quit: () => { save(); stop(); quit(); },
    restart: () => { stop(); restart(); },
  }));
  bagBtn.addEventListener('click', () => openBag(layer, world, changed));

  function handleEvents(): void {
    const now = performance.now();
    const events = world.events.splice(0);
    for (const ev of events) onEvent(ev, now);
  }

  function onEvent(ev: GameEvent, now: number): void {
    switch (ev.kind) {
      case 'till': fx.splashes.push({ x: ev.x, y: ev.y, color: '#8d5d38', born: now }); sfx.ground(); break;
      case 'water': fx.splashes.push({ x: ev.x, y: ev.y, color: '#8cc4f2', born: now }); sfx.water(); break;
      case 'plant': sfx.grass(); break;
      case 'clear': fx.splashes.push({ x: ev.x, y: ev.y, color: '#6cbf4b', born: now }); sfx.grass(); break;
      case 'refill': sfx.water(); break;
      case 'harvest': fx.splashes.push({ x: ev.x, y: ev.y, color: '#f7d44a', born: now }); sfx.pickup(); break;
      case 'helper': {
        fx.splashes.push({ x: ev.x, y: ev.y, color: species(ev.dex).job === 'water' ? '#8cc4f2' : '#9be07a', born: now });
        if (Math.random() < 0.3) cry(ev.dex, { volume: 0.35 });
        else (species(ev.dex).job === 'water' ? sfx.water : sfx.grass)();
        break;
      }
      case 'hint': sfx.deny(); break;
      case 'coins': sfx.coin(); break;
      case 'open':
        held.clear();
        if (ev.ui === 'sleep') openSleep(layer, world, goToBed);
        else if (ev.ui === 'bin') openBin(layer, world, changed);
        else openMart(layer, world, changed);
        break;
      case 'day':
        held.clear();
        save();
        lastHour = Math.floor(world.clock / 60);
        camX = world.player.x;
        camY = world.player.y;
        if (ev.summary.earned > 0) sfx.coin();
        openSummary(layer, ev.summary, world.day, () => updateHud(true));
        break;
    }
    if ('text' in ev && ev.text && 'x' in ev) fx.floaters.push({ x: ev.x, y: ev.y, text: ev.text, color: EVENT_COLOURS[ev.kind] ?? '#fff', born: now });
    changed();
  }

  // --- loop ---------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    if (!running || !root.isConnected) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!sheetOpen() && !document.hidden) {
      for (const dir of held) {
        step(world, dir);
        break;
      }
      acc += dt;
      while (acc >= STEP) {
        tick(world, STEP);
        acc -= STEP;
      }
      handleEvents();
      if (!world.player.pending) fx.target = null;
      const hour = Math.floor(world.clock / 60);
      if (hour !== lastHour) {
        lastHour = hour;
        save();
      }
    } else {
      acc = 0;
    }
    // Ease the camera after the farmer.
    const k = 1 - Math.exp(-dt * 10);
    camX += (world.player.x - camX) * k;
    camY += (world.player.y - camY) * k;
    view = follow(canvas.width, canvas.height, camX, camY);
    pruneFx(fx, now);
    render(ctx, world, view, now, fx);
    updateHud();
    requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  }

  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) save(); });

  // For scripts/verify-ui.ts: where tiles are on screen, and the world to poke at.
  (window as unknown as { __farm?: unknown }).__farm = {
    world,
    tileCentre: (x: number, y: number) => {
      const r = canvas.getBoundingClientRect();
      const k = r.width / canvas.width;
      return { x: r.left + ((x + 0.5) * view.tile - view.ox) * k, y: r.top + ((y + 0.5) * view.tile - view.oy) * k };
    },
  };

  updateHud(true);
  requestAnimationFrame(frame);
  if (isNew) {
    const sp = species(world.helpers[0]!.dex);
    save();
    openHelp(layer, () => {
      const at = tileOf(world.helpers[0]!);
      fx.floaters.push({ x: at.x, y: at.y, text: `${sp.name} is here to help!`, color: '#fff', born: performance.now() });
      cry(sp.dex, { volume: 0.5 });
    });
  }
}
