/**
 * The farm screen: the canvas, the HUD along the top, the hotbar along the
 * bottom, and the loop that runs the sim at a fixed step and draws it.
 */
import { cry, loadCries, sfx } from '../audio/index';
import { playMusic, preloadMusic } from '../audio/music';
import { isNight } from '../data/encounters';
import { BATTLE, FARM_NIGHT, FARM_TRACKS, ROUTE_DAY, ROUTE_NIGHT, VICTORY, type TrackId } from '../data/music';
import { WEATHER_ICONS, WEATHER_NAMES } from '../game/weather';
import { openDex } from './dex';
import { createDpad } from './dpad';
import { dialogueOpen, say, setDialogueHost } from './dialogue';
import { beatLines, houseLine, openCenter, openHall, openJournal, openShop } from './town';
import { getSettings, setDpad } from './app';
import { CAVE, FOREST, SPOTTED, TOWN } from '../data/music';
import { CHAPTERS } from '../data/story';
import { TOWNSFOLK, trainer } from '../data/people';
import { startTrainerBattle } from '../game/battle';
import { canChallenge } from '../game/npcs';
import { nextGoal } from '../game/story';
import { item } from '../data/items';
import { MAPS, mapSize } from '../data/maps';
import { species } from '../data/species';
import { canCapacity } from '../game/farm';
import { syncHelpers } from '../game/helpers';
import { tileOf, type Dir, type GameEvent, type World } from '../game/model';
import { clockText, dayOfSeason, seasonOf, weekdayOf } from '../game/time';
import { startBattle } from '../game/battle';
import { actFacing, hotbar, select, sleep, step, tapTile, tick, warpTo } from '../game/world';
import { follow, tileAtPoint, type View } from '../render/camera';
import { pruneFx, render, type Fx } from '../render/draw';
import { loadSheets } from '../render/sprites';
import { saveWorld } from '../state/save';
import { openSettings, show } from './app';
import { h } from './dom';
import { itemIcon } from './icons';
import { battleScreen } from './battle';
import { openBarn, openBoard, openMachine, openMerchant, openSeedBox } from './ranch';
import { openBag, openBin, openHelp, openMart, openPerk, openSleep, openSmith, openSummary } from './menus';
import { closeSheet, sheetOpen } from './sheet';

const STEP = 1 / 60;
const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

const EVENT_COLOURS: Record<string, string> = {
  harvest: '#b6f28a', refill: '#8cc4f2', hint: '#ffe08a', helper: '#ffffff', pet: '#ff7aa8', collect: '#b6f28a',
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
  const tracker = h('button.tracker', { 'aria-label': 'Current goal' });
  const dpad = createDpad(() => { if (!sheetOpen() && !battleOpen && !dialogueOpen()) actFacing(world); });
  dpad.apply(getSettings().dpad);
  const root = h('main.farm', {}, canvas, hud, tracker, dpad.el, bar, layer);
  setDialogueHost(layer);
  tracker.addEventListener('click', () => openJournal(layer, world));
  show(root);

  const fx: Fx = { floaters: [], splashes: [], target: null };
  let view: View = follow(1, 1, 0, 0, 1, 1);
  let camX = world.player.x;
  let camY = world.player.y;
  let lastHour = Math.floor(world.clock / 60);
  let running = true;

  const save = (): void => saveWorld(world);
  const changed = (): void => updateHud(true);

  // --- HUD ---------------------------------------------------------------------------
  let barKey = '';
  function updateHud(force = false): void {
    const where = world.map === 'farm' ? weekdayOf(world.day) : MAPS[world.map].name;
    dayEl.textContent = `${seasonOf(world.day)} ${dayOfSeason(world.day)} · ${where}`;
    const goal = nextGoal(world);
    tracker.hidden = !goal;
    if (goal) tracker.textContent = `Ch.${world.story.chapter + 1} · ${goal.text} ${Math.min(goal.have, goal.need)}/${goal.need}`;
    clockEl.textContent = `${WEATHER_ICONS[world.weather]} ${clockText(world.clock)}`;
    clockEl.title = WEATHER_NAMES[world.weather];
    goldEl.textContent = `${world.player.gold.toLocaleString('en')}g`;
    const e = world.player.energy / world.player.maxEnergy;
    energyFill.style.width = `${Math.round(e * 100)}%`;
    energyEl.classList.toggle('low', e < 0.25);
    const slots = hotbar(world);
    const cap = canCapacity(world);
    const key = `${slots.join()}|${world.selected}|${slots.map((id) => world.inventory[id] ?? '').join()}|${world.player.water}/${cap}`;
    if (!force && key === barKey) return;
    barKey = key;
    bar.replaceChildren(...slots.map((id, i) => {
      const def = item(id);
      const count = def.kind === 'tool' ? (id === 'can' ? `${world.player.water}/${cap}` : '') : String(world.inventory[id] ?? 0);
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
    if (sheetOpen() || battleOpen || dialogueOpen()) return;
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
    if (sheetOpen() || battleOpen || dialogueOpen()) return;
    if (e.code === 'KeyB') {
      openBag(layer, world, changed);
      return;
    }
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
    dex: () => openDex(layer, world, changed),
    journal: () => openJournal(layer, world),
    dpad: (s) => dpad.apply(s),
    moveDpad: () => dpad.editPosition((x, y) => dpad.apply(setDpad({ x, y }))),
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
        if (ev.ui === 'sleep') openSleep(layer, world, goToBed, changed);
        else if (ev.ui === 'bin') openBin(layer, world, changed);
        else if (ev.ui === 'smith') openSmith(layer, world, changed);
        else if (ev.ui === 'barn') openBarn(layer, world, () => { syncHelpers(world); changed(); });
        else if (ev.ui === 'board') openBoard(layer, world, changed);
        else if (ev.ui === 'merchant') openMerchant(layer, world, changed);
        else if (ev.ui === 'seedbox') openSeedBox(layer, world, changed);
        else openMart(layer, world, changed);
        break;
      case 'machine':
        held.clear();
        openMachine(layer, world, ev.x, ev.y, changed);
        break;
      case 'place': fx.splashes.push({ x: ev.x, y: ev.y, color: '#c8905a', born: now }); sfx.place(); break;
      case 'collect': fx.splashes.push({ x: ev.x, y: ev.y, color: '#f7d44a', born: now }); sfx.pickup(); break;
      case 'pet': {
        const uid = world.helpers.find((hp) => Math.round(hp.x) === ev.x && Math.round(hp.y) === ev.y)?.uid;
        const mon = world.mons.find((m) => m.uid === uid);
        if (mon) cry(mon.dex, { volume: 0.4 });
        break;
      }
      case 'skill': {
        const at = tileOf(world.player);
        fx.floaters.push({ x: at.x, y: at.y - 1, text: `${ev.skill === 'farming' ? 'Farming' : 'Battling'} Lv ${ev.level}!`, color: '#ffe08a', born: now });
        sfx.levelUp();
        break;
      }
      case 'door':
        held.clear();
        if (ev.door === 'center') openCenter(layer, world, () => openBag(layer, world, changed, 'pokemon'), changed);
        else if (ev.door === 'hall') openHall(layer, world, () => challenge('kai'), changed);
        else if (ev.door === 'shop') openShop(layer, world, changed);
        else void say(houseLine(world, ev.x, ev.y));
        break;
      case 'gather': fx.splashes.push({ x: ev.x, y: ev.y, color: '#c8905a', born: now }); sfx.pickup(); break;
      case 'spotted':
        held.clear();
        playMusic(SPOTTED);
        break;
      case 'challenge':
        challenge(ev.npc);
        break;
      case 'talk': {
        held.clear();
        const folk = TOWNSFOLK.find((f) => f.id === ev.npc);
        if (folk) {
          void say(folk.lines.map((text) => ({ name: folk.name, palette: folk.palette, text })));
        } else if (canChallenge(world, ev.npc)) {
          challenge(ev.npc);
        } else {
          const t = trainer(ev.npc);
          void say([{ name: `${t.cls} ${t.name}`, palette: t.palette, text: `${t.outro} Come back next week for a rematch!` }]);
        }
        break;
      }
      case 'story':
        held.clear();
        void say(beatLines(ev.beat));
        break;
      case 'chapter': {
        const c = CHAPTERS[ev.chapter];
        toast(c ? `Chapter ${ev.chapter + 1}: ${c.title}` : 'Story complete!');
        sfx.win();
        save();
        break;
      }
      case 'warp':
        held.clear();
        camX = world.player.x;
        camY = world.player.y;
        toast(MAPS[ev.map].name);
        save();
        break;
      case 'encounter':
        held.clear();
        openBattle();
        break;
      case 'day':
        held.clear();
        save();
        lastHour = Math.floor(world.clock / 60);
        camX = world.player.x;
        camY = world.player.y;
        if (ev.summary.earned > 0) sfx.coin();
        openSummary(layer, world, ev.summary, () => updateHud(true));
        break;
    }
    if ('text' in ev && ev.text && 'x' in ev) fx.floaters.push({ x: ev.x, y: ev.y, text: ev.text, color: EVENT_COLOURS[ev.kind] ?? '#fff', born: now });
    changed();
  }

  // --- battles and banners -------------------------------------------------------------
  let battleOpen = false;
  function openBattle(): void {
    if (battleOpen || !world.battle) return;
    battleOpen = true;
    root.classList.add('flash');
    setTimeout(() => root.classList.remove('flash'), 500);
    setTimeout(() => {
      battleScreen(root, world, () => {
        battleOpen = false;
        camX = world.player.x;
        camY = world.player.y;
        handleEvents();
        save();
        updateHud(true);
      });
    }, 350);
  }

  const banner = h('div.banner', { 'aria-live': 'polite' });
  root.insertBefore(banner, layer);
  let bannerTimer = 0;
  function toast(text: string): void {
    banner.textContent = text;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => banner.classList.remove('show'), 1800);
  }

  /** A trainer's opening line, then the battle. */
  function challenge(id: string): void {
    const t = trainer(id);
    void say([{ name: `${t.cls === 'Rival' ? '' : `${t.cls} `}${t.name}`, palette: t.palette, text: t.intro }]).then(() => {
      if (startTrainerBattle(world, id)) handleEvents();
      else void say([{ name: '', palette: null, text: 'Your Pokémon are too tired to battle. Rest them first.' }]);
    });
  }

  // --- loop ---------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    if (!running || !root.isConnected) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!sheetOpen() && !battleOpen && !dialogueOpen() && !document.hidden) {
      if (world.pendingPerks.length) openPerk(layer, world, () => updateHud(true));
      const dir = [...held][0] ?? dpad.held();
      if (dir) step(world, dir);
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
    const size = mapSize(world.map);
    const r = canvas.getBoundingClientRect();
    const px = r.height ? canvas.height / r.height : 1;
    const padTop = Math.max(0, hud.getBoundingClientRect().bottom - r.top) * px;
    const padBottom = Math.max(0, r.bottom - bar.getBoundingClientRect().top) * px;
    view = follow(canvas.width, canvas.height, camX, camY, size.w, size.h, padTop, padBottom);
    if (!battleOpen) playMusic(trackNow());
    pruneFx(fx, now);
    render(ctx, world, view, now, fx);
    updateHud();
    requestAnimationFrame(frame);
  }

  /** The tune for where and when you are: the season's on the farm by day, a lullaby at night, Route 1's own out there. */
  function trackNow(): TrackId {
    const night = isNight(world.clock);
    if (world.approach) return SPOTTED;
    if (world.map === 'route1') return night ? ROUTE_NIGHT : ROUTE_DAY;
    if (world.map === 'town') return TOWN;
    if (world.map === 'route2') return FOREST;
    if (world.map === 'route3') return CAVE;
    return night ? FARM_NIGHT : FARM_TRACKS[seasonOf(world.day)];
  }
  preloadMusic([trackNow(), BATTLE, VICTORY, ROUTE_DAY, TOWN]);

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
    battle: (dex: number, level: number) => startBattle(world, dex, level),
    tap: (x: number, y: number) => tapTile(world, x, y),
    challenge: (id: string) => challenge(id),
    warp: (map: World['map'], x: number, y: number) => warpTo(world, map, x, y),
    sync: () => syncHelpers(world),
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
