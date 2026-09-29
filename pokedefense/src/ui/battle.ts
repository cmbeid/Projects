/**
 * The battle screen: HUD, the map canvas, power-ups, and the dock — the shop
 * of towers you brought, or the panel for the tower you tapped.
 *
 * Portrait phones stack HUD / map / power-ups / dock; wide screens put the
 * power-ups in a left rail and the dock on the right (see style.css).
 */
import { playEvents } from '../audio/events';
import { sfx, unlock } from '../audio/index';
import { playMusic, preloadMusic } from '../audio/music';
import { BALL_KEYS, BALLS, type BallKey, POWERUP_KEYS, POWERUPS, type PowerupKey } from '../data/items';
import { COLS, type MapDef, mapBosses, mapDef, type MapRules, MAPS, ROWS, terrainAt } from '../data/maps';
import { REGIONS } from '../data/regions';
import { species } from '../data/species';
import { DYNAMAX_SECONDS, KEY_STONE, line, lineDexes, lineForDex, MAX_LEVEL, MEGA_SECONDS, MEGAS, type TowerLine, Z_MOVES } from '../data/towers';
import { type PokeType, TYPE_COLOURS } from '../data/types';
import {
  buffLeft, canDynamax, canMega, canPlace, canTera, canZMove, dynamax, terastallize, zMove, catchChance, chooseMove, dropAt, earlyBonus, type Enemy, type Game, hasNextWave, levelUp, moveCost,
  megaEvolve, needsBranch, newGame, pickUp, placeCost, placeTower, powerupReady, sellTower, sellValue, setTarget, starsFor, startWave,
  retryWave, STEP, step, TARGET_MODES, type TargetMode, throwBall, type Tower, towerAt, upgradeCost, usePowerup,
} from '../game/game';
import { stageIndex, towerStats } from '../game/stats';
import { type DifficultyKey, wavePreview } from '../game/waves';
import { drawBattle, ingest, type Overlay, resetEffects, snapshotEnemies } from '../render/draw';
import { loadSheets } from '../render/sprites';
import { badgeImg, icon, thumb } from '../render/thumbs';
import { loadCries } from '../audio/index';
import { getProgress, mount, modal, modalOpen, setProgress, toast, button } from './app';
import { h } from './dom';
import { fullscreenButton } from './fullscreen';
import { clearBattle, type FacilityId, lineUnlocked, recordBattle, type Progress, saveBattle, type SavedBattle } from '../state/save';
import { restoreGame, serializeGame } from '../game/snapshot';

type Mode =
  | { kind: 'idle' }
  | { kind: 'place'; lineId: string }
  | { kind: 'ball'; ball: BallKey }
  | { kind: 'power'; key: PowerupKey };

/** Game speeds, in the order the speed button steps through them. 0 is paused. */
const SPEEDS: readonly number[] = [0, 1, 2, 3, 5];
const speedLabel = (v: number): string => (v === 0 ? '❚❚' : `${v}×`);

const TARGET_LABEL: Record<TargetMode, string> = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };

const PLACE_ERROR: Record<string, string> = {
  terrain: "Can't place that there.",
  occupied: 'Something is already there.',
  money: 'Not enough ₽.',
  team: 'Not on your team.',
  rule: 'This challenge’s rules don’t allow that Pokémon.',
  limit: 'No more towers allowed in this challenge.',
  outside: '',
};

export interface BattleOptions {
  mapId: string;
  difficulty: DifficultyKey;
  team: string[];
  onExit: () => void;
  /** A Battle Frontier challenge's rules, on top of the map's. */
  rules?: MapRules;
  /** A Battle Frontier battle: no retries, no stars, and `onEnd` hears how it went. */
  frontier?: FacilityId;
  onEnd?: (result: { won: boolean; lives: number; cleared: number }) => void;
}

function trainerFor(map: MapDef, e: Enemy): string {
  const leaders = [map.boss, ...(map.boss.partners ?? []), ...(map.rotation ?? [])];
  if (leaders.some((b) => b.dex === e.origin)) return map.leader;
  return map.extraBosses?.find((b) => b.boss.dex === e.origin)?.trainer ?? 'Wild';
}

/**
 * Start a battle, or with `resume`, carry on one saved when the tab closed.
 * A resumed battle opens paused. Returns false, having shown nothing, if the
 * saved battle can't be read.
 */
export function startBattle(opts: BattleOptions, resume?: SavedBattle): boolean {
  const map = mapDef(opts.mapId);
  const start: Progress = getProgress();
  const setup = {
    difficulty: opts.difficulty, team: opts.team, items: start.items, balls: start.balls, held: start.held,
    trainer: start.trainer, seed: (Date.now() & 0xffffff) ^ 0x5eed, ...(opts.rules ? { rules: opts.rules } : {}),
  };
  const restored = resume ? restoreGame(resume.game, setup) : null;
  if (resume && !restored) {
    clearBattle();
    return false;
  }
  const g: Game = restored ?? newGame({ map, ...setup });
  const newThisBattle = new Set<string>(restored ? resume!.newLines : []);
  if (!restored) clearBattle();
  // For scripts/verify-ui.ts and poking around in the console.
  (window as unknown as { __battle?: Game }).__battle = g;
  resetEffects();

  // Load what this map needs up front: every wild Pokémon, the team, the bosses.
  const dexes = new Set<number>([
    ...map.pool.map((p) => p.dex),
    ...opts.team.flatMap((id) => lineDexes(line(id))),
  ]);
  for (const dex of [...dexes]) {
    const mega = MEGAS.get(dex);
    if (mega && start.heldOwned.includes(KEY_STONE)) dexes.add(mega.form);
  }
  for (const b of mapBosses(map)) {
    dexes.add(b.dex);
    for (const dex of b.escort) dexes.add(dex);
    if (b.mega) dexes.add(b.mega);
    for (const ab of b.abilities) if (ab.kind === 'summon') dexes.add(ab.dex);
  }
  for (const p of map.pool) {
    const sp = species(p.dex);
    if (sp.evolve) dexes.add(sp.evolve.dex);
    if (sp.split) dexes.add(sp.split.dex);
  }
  void loadSheets(dexes);
  loadCries([...dexes]);
  const region = REGIONS[map.regionId];
  preloadMusic([map.track, map.bossTrack, ...(map.finalTrack ? [map.finalTrack] : []), region.winTrack]);
  playMusic(map.track);

  // --- elements ---------------------------------------------------------------
  const canvas = h('canvas.map');
  const ctx = canvas.getContext('2d')!;
  const livesEl = h('span.chip.lives');
  const moneyEl = h('span.chip.money');
  const waveEl = h('span.chip.wave');
  // Phones get one button that cycles the speeds; wide layouts show them all (style.css picks).
  const speedBtn = button('btn.small.speed', '1×', () => cycleSpeed(), { title: 'Game speed (F); pause (P)' });
  const speedSeg = h('div.segmented.speeds', { role: 'group', 'aria-label': 'Game speed' }, ...SPEEDS.map((v) => h('button', {
    'data-speed': String(v),
    title: v === 0 ? 'Pause (P)' : `${v}× speed`,
    onclick: () => {
      unlock();
      sfx.click();
      setSpeed(v);
    },
  }, speedLabel(v))));
  const menuBtn = button('btn.small.icon', '☰', () => pause(), { title: 'Menu (Esc)', 'aria-label': 'Menu' });
  const fs = fullscreenButton('btn small icon');
  const hud = h('header.hud', {}, livesEl, moneyEl, waveEl, h('span.grow'), speedBtn, speedSeg, fs, menuBtn);
  const pausedTag = h('div.paused-tag', {}, '❚❚ Paused — you can still build');

  const waveBtn = button('btn.primary.wave-btn', 'Start', () => callWave());
  const preview = h('div.preview');
  const waveBar = h('div.wave-bar', {}, waveBtn, preview);
  const bossBar = h('div.boss-bar', { style: 'display:none' });
  const coach = h('div.coach', { style: 'display:none' });
  const stage = h('main.stage', {}, canvas, bossBar, coach, pausedTag);
  const rail = h('aside.rail');
  const dock = h('footer.dock');
  const root = h('div.battle', {}, hud, stage, waveBar, rail, dock);

  let mode: Mode = { kind: 'idle' };
  let selected: number | null = null;
  let ghost: { x: number; y: number } | null = null;
  let pointer: { x: number; y: number } | null = null;
  let speed = 1;
  /** The speed to go back to when unpausing. */
  let lastSpeed = 1;
  let paused = false;
  let finished = false;
  let raf = 0;
  let tile = 32;
  let dpr = 1;
  /** The boss track playing, if any. */
  let bossMusic: string | null = null;

  // --- layout ---------------------------------------------------------------------
  const resize = (): void => {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssTile = Math.max(8, Math.floor(Math.min((rect.width - 8) / COLS, (rect.height - 8) / ROWS)));
    tile = Math.round(cssTile * dpr);
    canvas.width = COLS * tile;
    canvas.height = ROWS * tile;
    canvas.style.width = `${(COLS * tile) / dpr}px`;
    canvas.style.height = `${(ROWS * tile) / dpr}px`;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  /**
   * Phones stack everything under the map. When the map at full height would
   * leave room beside it, the controls move into that room instead: one side
   * column, or with plenty of room, a column either side.
   */
  const arrange = (): void => {
    const r = root.getBoundingClientRect();
    const mapWidth = ((r.height - 20) * COLS) / ROWS;
    const spare = r.width - mapWidth - 20;
    const mode = spare >= 560 ? 'split' : spare >= 300 ? 'side' : 'stack';
    root.classList.toggle('side', mode === 'side');
    root.classList.toggle('split', mode === 'split');
    if (mode === 'split') {
      const left = Math.round(Math.min(380, Math.max(230, spare * 0.42)));
      root.style.setProperty('--left', `${left}px`);
      root.style.setProperty('--side', `${Math.round(Math.min(520, spare - left))}px`);
    } else if (mode === 'side') {
      root.style.setProperty('--side', `${Math.round(Math.min(480, spare))}px`);
    }
  };
  const rootObserver = new ResizeObserver(arrange);
  rootObserver.observe(root);

  // --- input -------------------------------------------------------------------------
  const toTile = (ev: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * COLS, y: ((ev.clientY - r.top) / r.height) * ROWS };
  };
  let down: { x: number; y: number; id: number } | null = null;
  canvas.addEventListener('pointerdown', (ev) => {
    unlock();
    down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  });
  canvas.addEventListener('pointermove', (ev) => {
    pointer = toTile(ev);
    if (ev.pointerType === 'mouse' && mode.kind === 'place') ghost = { x: Math.floor(pointer.x), y: Math.floor(pointer.y) };
  });
  canvas.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse') {
      pointer = null;
      if (mode.kind === 'place') ghost = null;
    }
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (!down || down.id !== ev.pointerId) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    down = null;
    if (moved > 14) return;
    tap(toTile(ev), ev.pointerType === 'mouse');
  });

  function setMode(next: Mode): void {
    mode = next;
    ghost = null;
    if (next.kind !== 'idle') selected = null;
    renderRail();
    renderDock();
  }

  function tap(p: { x: number; y: number }, mouse: boolean): void {
    if (g.status !== 'playing') return;
    pointer = p;
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    const drop = dropAt(g, p.x, p.y);
    if (drop) {
      pickUp(g, drop.id);
      renderRail();
      return;
    }
    switch (mode.kind) {
      case 'ball': {
        const result = throwBall(g, mode.ball, p.x, p.y);
        if (result === 'no-target') toast('Tap a wild Pokémon to throw at it.');
        else if (result === 'no-ball') setMode({ kind: 'idle' });
        else setMode({ kind: 'idle' });
        return;
      }
      case 'power': {
        const def = POWERUPS[mode.key];
        if (def.target === 'spot') {
          usePowerup(g, mode.key, { x: p.x, y: p.y });
          setMode({ kind: 'idle' });
        } else if (def.target === 'tower') {
          const t = towerAt(g, tx, ty);
          if (!t) {
            toast('Tap one of your Pokémon.');
            return;
          }
          const err = usePowerup(g, mode.key, { towerId: t.id });
          if (err === 'target') toast(t.level >= MAX_LEVEL ? 'Already at its top level.' : 'Choose its evolution stone first.');
          setMode({ kind: 'idle' });
          selected = t.id;
          renderDock();
        }
        return;
      }
      case 'place': {
        const existing = towerAt(g, tx, ty);
        if (existing) {
          setMode({ kind: 'idle' });
          selected = existing.id;
          renderDock();
          return;
        }
        const err = canPlace(g, mode.lineId, tx, ty);
        const confirm = mouse || (ghost && ghost.x === tx && ghost.y === ty);
        if (err && err !== 'outside') {
          ghost = { x: tx, y: ty };
          if (err === 'money' || confirm) {
            sfx.deny();
            toast(PLACE_ERROR[err] ?? '');
          }
          return;
        }
        if (err) return;
        if (!confirm) {
          ghost = { x: tx, y: ty };
          return;
        }
        const t = placeTower(g, mode.lineId, tx, ty);
        if (typeof t !== 'string') {
          // The same Pokémon stays chosen, to build another straight away; tap its card again to stop.
          ghost = null;
          renderDock();
        }
        return;
      }
      case 'idle': {
        const t = towerAt(g, tx, ty);
        selected = t && t.id !== selected ? t.id : null;
        renderDock();
      }
    }
  }

  const onKey = (ev: KeyboardEvent): void => {
    if (modalOpen() || ev.metaKey || ev.ctrlKey) return;
    const k = ev.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
      ev.preventDefault();
      callWave();
    } else if (k === 'escape') {
      if (mode.kind !== 'idle' || selected !== null) {
        selected = null;
        setMode({ kind: 'idle' });
      } else pause();
    } else if (k === 'f') cycleSpeed();
    else if (k === 'p') setSpeed(speed === 0 ? lastSpeed : 0);
    else if (k === 'u' && selected !== null) doLevel();
    else if (k === 's' && selected !== null) doSell();
    else if (k === 'b') chooseBall();
    else if (/^[1-9]$/.test(k)) {
      const id = g.team[Number(k) - 1];
      if (id) pickShop(id);
    }
  };
  window.addEventListener('keydown', onKey);

  // --- actions ------------------------------------------------------------------------
  function callWave(): void {
    if (!hasNextWave(g)) return;
    unlock();
    // Calling a wave while paused means "go".
    if (speed === 0) setSpeed(lastSpeed);
    startWave(g);
    renderDock();
  }

  function setSpeed(v: number): void {
    speed = v;
    if (v > 0) lastSpeed = v;
    speedBtn.textContent = speedLabel(v);
    speedBtn.classList.toggle('paused', v === 0);
    for (const b of speedSeg.querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset['speed']) === v);
    stage.classList.toggle('frozen', v === 0);
  }

  function cycleSpeed(): void {
    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!);
  }

  function pickShop(lineId: string): void {
    if (mode.kind === 'place' && mode.lineId === lineId) setMode({ kind: 'idle' });
    else setMode({ kind: 'place', lineId });
  }

  function selectedTower(): Tower | undefined {
    return selected === null ? undefined : g.towers.find((t) => t.id === selected);
  }

  function doLevel(branch?: number): void {
    const t = selectedTower();
    if (!t) return;
    const err = levelUp(g, t.id, branch === undefined ? {} : { branch });
    if (err === 'money') {
      sfx.deny();
      toast('Not enough ₽.');
    }
    renderDock();
  }

  function doSell(): void {
    const t = selectedTower();
    if (!t) return;
    sellTower(g, t.id);
    selected = null;
    renderDock();
  }

  function chooseBall(): void {
    const owned = BALL_KEYS.filter((b) => g.balls[b] > 0);
    if (!owned.length) {
      sfx.deny();
      toast('No Poké Balls left. Buy more at the Poké Mart.');
      return;
    }
    if (mode.kind === 'ball') {
      setMode({ kind: 'idle' });
      return;
    }
    if (owned.length === 1) {
      setMode({ kind: 'ball', ball: owned[0]! });
      toast('Tap a wild Pokémon to throw.');
      return;
    }
    const close = modal(
      h('div', {},
        h('h2', {}, 'Throw which ball?'),
        h('p.muted', { style: 'margin:0;text-align:center;font-size:13px' }, 'Weaker and sleeping Pokémon are easier to catch.'),
        ...owned.map((b) => button('btn', h('span.row', {}, icon(b, 28), `${BALLS[b].name} ×${g.balls[b]}`), () => {
          close();
          setMode({ kind: 'ball', ball: b });
        })),
        button('btn.ghost', 'Cancel', () => close()),
      ),
    );
  }

  function pause(note?: string): void {
    if (finished) return;
    paused = true;
    const auto = h('button.switch', { className: `switch${g.autoWave ? ' on' : ''}`, 'aria-label': 'Auto-start waves' });
    auto.addEventListener('click', () => {
      g.autoWave = !g.autoWave;
      auto.classList.toggle('on', g.autoWave);
    });
    const close = modal(
      h('div', {},
        h('h2', {}, 'Paused'),
        note ? h('p.muted', { style: 'margin:0;text-align:center' }, note) : null,
        h('div.card.setting', {}, h('span', {}, 'Start waves automatically'), auto),
        button('btn.primary', 'Resume', () => close()),
        button('btn', 'Restart', () => {
          close();
          quit(true);
        }),
        button('btn.ghost', 'Give up', () => {
          close();
          quit(false);
        }),
      ),
      { onClose: () => (paused = false) },
    );
  }

  // --- HUD, rail, dock --------------------------------------------------------------------
  let hudKey = '';
  function renderHud(): void {
    const total = map.endless ? '∞' : String(g.totalWaves);
    const key = `${g.lives}|${g.money}|${g.wave}|${total}`;
    if (key === hudKey) return;
    hudKey = key;
    livesEl.textContent = `♥ ${g.lives}`;
    moneyEl.textContent = `₽ ${g.money}`;
    waveEl.textContent = `Wave ${Math.max(1, g.wave)}/${total}`;
  }

  let waveKey = '';
  function renderWaveBar(): void {
    const next = g.wave + 1;
    const show = hasNextWave(g);
    const bonus = earlyBonus(g);
    const key = `${show}|${next}|${bonus}|${g.openWaves.size}`;
    if (key === waveKey) return;
    waveKey = key;
    waveBar.style.display = show ? '' : 'none';
    if (!show) return;
    waveBtn.replaceChildren(
      g.wave === 0 ? '▶ Start' : g.openWaves.size ? `⏩ Wave ${next}` : `▶ Wave ${next}`,
      ...(bonus ? [h('span.bonus', {}, `+₽${bonus} early`)] : []),
    );
    const rows = wavePreview(map, next);
    preview.replaceChildren(
      ...rows.slice(0, 4).map((r) => h('div.p', { className: `p${r.boss ? ' boss' : ''}` }, thumb(r.dex, 30), r.boss ? '⚠' : `×${r.count}`)),
    );
  }

  let railKey = '';
  const puButtons = new Map<string, { el: HTMLButtonElement; cd: HTMLElement; active: HTMLElement }>();
  function renderRail(): void {
    const ballCount = BALL_KEYS.reduce((n, b) => n + g.balls[b], 0);
    const key = `${POWERUP_KEYS.map((k) => g.items[k]).join()}|${ballCount}|${mode.kind === 'ball'}|${mode.kind === 'power' ? mode.key : ''}`;
    if (key === railKey) return;
    railKey = key;
    puButtons.clear();
    const ballKind = BALL_KEYS.find((b) => g.balls[b] > 0) ?? 'poke-ball';
    const ballBtn = h('button.pu.ball', {
      className: `pu ball${mode.kind === 'ball' ? ' on' : ''}`,
      title: 'Throw a Poké Ball (B)',
      onclick: () => {
        unlock();
        chooseBall();
      },
    }, icon(ballKind, 32), h('span.n', {}, String(ballCount)));
    const items = POWERUP_KEYS.filter((k) => g.items[k] > 0).map((k) => {
      const cd = h('span.cd');
      const active = h('span.active', { style: 'transform:scaleX(0)' });
      const el = h('button.pu', {
        className: `pu${mode.kind === 'power' && mode.key === k ? ' on' : ''}`,
        title: `${POWERUPS[k].name}: ${POWERUPS[k].desc}`,
        onclick: () => {
          unlock();
          usePower(k);
        },
      }, icon(k, 32), cd, active, h('span.n', {}, String(g.items[k])));
      puButtons.set(k, { el, cd, active });
      return el;
    });
    rail.replaceChildren(ballBtn, ...items);
  }

  function tickRail(): void {
    for (const [k, b] of puButtons) {
      const key = k as PowerupKey;
      const left = Math.max(0, (g.cooldowns[key] ?? 0) - g.t);
      const pct = left > 0 ? (left / POWERUPS[key].cooldown) * 100 : 0;
      b.cd.style.setProperty('--cd', `${pct}%`);
      const buff = buffLeft(g, key);
      b.active.style.transform = `scaleX(${buff > 0 ? buff / POWERUPS[key].duration : 0})`;
      b.el.disabled = !powerupReady(g, key) && !(mode.kind === 'power' && mode.key === key);
    }
  }

  function usePower(k: PowerupKey): void {
    const def = POWERUPS[k];
    if (mode.kind === 'power' && mode.key === k) {
      setMode({ kind: 'idle' });
      return;
    }
    if (!powerupReady(g, k)) {
      sfx.deny();
      return;
    }
    if (def.target === 'none') {
      const err = usePowerup(g, k);
      if (err === 'unused') toast('Your lives are already full.');
      renderRail();
      return;
    }
    setMode({ kind: 'power', key: k });
    toast(def.target === 'spot' ? `${def.name}: tap where to strike.` : `${def.name}: tap one of your Pokémon.`);
  }

  let dockKey = '';
  /** What the once-a-battle power buttons and their countdowns show, so the panel redraws when it changes. */
  function powersKey(t: Tower): string {
    const left = (until: number): number => Math.max(0, Math.ceil(until - g.t));
    return `${left(t.megaUntil)}|${left(t.dynamaxUntil)}|${t.tera}|${canZMove(g, t)}|${canDynamax(g, t)}|${canTera(g, t)}|${g.megaUsed}`;
  }

  function renderDock(force = false): void {
    const t = selectedTower();
    if (selected !== null && !t) selected = null;
    const affordable = g.team.map((id) => g.money >= placeCost(g, id)).join();
    const key = t
      ? `t|${t.id}|${t.level}|${t.move}|${t.branch}|${t.target}|${g.money >= upgradeCost(g, t).cost}|${t.level >= MAX_LEVEL ? t.line.moves.map((_, i) => g.money >= moveCost(g, t, i)).join() : ''}|${sellValue(g, t)}|${Math.floor(t.xp / 10)}|${powersKey(t)}`
      : `s|${mode.kind === 'place' ? mode.lineId : ''}|${affordable}|${g.team.join()}`;
    if (key === dockKey && !force) return;
    dockKey = key;
    dock.replaceChildren(t ? towerPanel(t) : shopRow());
  }

  function shopRow(): HTMLElement {
    const cards = g.team.map((id, i) => {
      const l = line(id);
      const cost = placeCost(g, id);
      const on = mode.kind === 'place' && mode.lineId === id;
      return h('button.shop-card', {
        className: `shop-card${on ? ' on' : ''}${g.money < cost ? ' poor' : ''}`,
        title: `${l.name} — ${l.role} (${i + 1})`,
        onclick: () => {
          unlock();
          sfx.click();
          pickShop(id);
        },
      },
      thumb(l.stages[0]!.dex, 50),
      h('span', {}, l.name),
      h('span.cost', {}, `₽${cost}`),
      h('span.stripe', { style: `background:${TYPE_COLOURS[l.type]}` }),
      newThisBattle.has(id) ? h('span.new', {}, 'NEW') : null);
    });
    if (!getProgress().hints) return h('div', {}, h('div.shop', {}, ...cards));
    const hint = mode.kind === 'place'
      ? h('div.hint', {}, `${line(mode.lineId).role}. ${line(mode.lineId).placement === 'path' ? 'Goes on the path itself.' : line(mode.lineId).placement === 'any' ? 'Can swim.' : ''} Tap a tile${matchMedia('(pointer: coarse)').matches ? ' twice' : ''} to place — as many as you like; tap its card again when done.`)
      : h('div.hint', {}, 'Choose a Pokémon, then tap the map to place it.');
    return h('div', {}, h('div.shop', {}, ...cards), hint);
  }

  function towerPanel(t: Tower): HTMLElement {
    const s = t.stats;
    const l = t.line;
    const name = species(s.dex).name;
    const close = button('btn.small.icon.ghost.close-x', '✕', () => {
      selected = null;
      renderDock();
    }, { 'aria-label': 'Close' });
    const head = h('div.head', {},
      thumb(s.dex, 56, { animate: true }),
      h('div', {},
        h('div.name', {}, `${name} `, h('span.muted', {}, `Lv ${t.level}`)),
        h('div.row', { style: 'gap:4px;margin-top:2px' },
          h('span.type', { style: `background:${TYPE_COLOURS[s.type]}` }, s.type),
          h('span.muted', { style: 'font-size:12px' }, t.move !== null ? l.moves[t.move]!.name : l.role))),
      close);
    const rate = s.rate > 0 ? `${s.rate.toFixed(2)}/s` : '—';
    const stats = h('div.stats', {},
      h('span', {}, 'Dmg ', h('b', {}, s.attack === 'aura' ? `+${Math.round(s.effects.auraDamage * 100)}%` : String(Math.round(s.damage)))),
      h('span', {}, 'Range ', h('b', {}, s.range.toFixed(1))),
      h('span', {}, 'Speed ', h('b', {}, rate)),
      h('span', {}, 'KOs ', h('b', {}, String(t.kills))),
      s.detect ? h('span', {}, '👁 sees invisible') : null,
      s.groundOnly ? h('span', {}, '⛰ ground only') : null);

    const parts: HTMLElement[] = [head, stats];
    if (t.level < MAX_LEVEL) {
      if (needsBranch(t)) {
        const opts = l.branches!.options;
        const { cost } = upgradeCost(g, t);
        parts.push(h('div.hint', {}, `Evolve with a stone — ₽${cost}`));
        parts.push(h('div.stones', {}, ...opts.map((b, i) => button('btn', h('span', {}, icon(b.item, 28), h('div', {}, species(b.dex).name)), () => doLevel(i), {
          disabled: g.money < cost, title: b.desc,
        }))));
      } else {
        const { cost, discount } = upgradeCost(g, t);
        const nextStage = stageIndex(l, t.level + 1) !== stageIndex(l, t.level) ? species(l.stages[stageIndex(l, t.level + 1)]!.dex).name : null;
        const nextStats = towerStats(l, { level: t.level + 1, branch: t.branch, move: t.move, held: g.held[l.id] ?? null, ledge: terrainAt(map, t.x, t.y) === 'ledge' });
        const gain = s.attack === 'aura' ? '' : ` · Dmg ${Math.round(s.damage)}→${Math.round(nextStats.damage)}`;
        parts.push(h('div.actions', {},
          button(`btn.${nextStage ? 'gold' : 'green'}`, h('span', {}, nextStage ? `Evolve → ${nextStage}` : `Level up → ${t.level + 1}`, h('br'), h('small', {}, `₽${cost}${discount ? ` (−${discount} XP)` : ''}${gain}`)), () => doLevel(), { disabled: g.money < cost }),
          button('btn', h('span', {}, 'Sell', h('br'), h('small', {}, `+₽${sellValue(g, t)}`)), () => doSell()),
        ));
      }
    } else if (t.move === null) {
      parts.push(h('div.hint', {}, 'Top level! Teach it a signature move:'));
      parts.push(h('div.moves', {}, ...l.moves.map((m, i) => button('btn.gold', h('span', {}, m.name, h('small', {}, m.desc), h('small', {}, `₽${moveCost(g, t, i)}`)), () => {
        if (chooseMove(g, t.id, i) === 'money') {
          sfx.deny();
          toast('Not enough ₽.');
        }
        renderDock();
      }, { disabled: g.money < moveCost(g, t, i) }))));
      parts.push(h('div.actions', {}, button('btn.small', `Sell +₽${sellValue(g, t)}`, () => doSell())));
    } else {
      parts.push(h('div.hint', {}, `Fully grown. ${l.moves[t.move]!.desc}`));
      parts.push(h('div.actions', {}, button('btn.small', `Sell +₽${sellValue(g, t)}`, () => doSell())));
    }
    if (t.megaUntil > g.t) {
      parts.push(h('div.hint', {}, `✨ Mega Evolved — for ${Math.ceil(t.megaUntil - g.t)} s more.`));
    } else if (canMega(g, t)) {
      const form = species(MEGAS.get(s.dex)!.form).name;
      parts.push(h('div.actions', {}, button('btn.mega', h('span', {}, `✨ Mega Evolve → ${form}`, h('br'), h('small', {}, `Once a battle, for ${MEGA_SECONDS} s`)), () => {
        megaEvolve(g, t.id);
        renderDock();
      })));
    } else if (t.level >= MAX_LEVEL && MEGAS.has(s.dex) && !g.megaUsed && g.held[l.id] !== KEY_STONE && start.heldOwned.includes(KEY_STONE)) {
      parts.push(h('div.hint', {}, 'Give this kind of tower your Key Stone (in the Mart) and it can Mega Evolve.'));
    }
    // Alola, Galar and Paldea's once-a-battle powers, for a tower holding the item.
    const powers: HTMLElement[] = [];
    if (canZMove(g, t)) {
      powers.push(button('btn.zmove', h('span', {}, `💎 ${Z_MOVES[s.type]}`, h('br'), h('small', {}, 'Z-Move · once a battle')), () => {
        zMove(g, t.id);
        renderDock();
      }));
    }
    if (t.dynamaxUntil > g.t) parts.push(h('div.hint', {}, `🔴 Dynamaxed — for ${Math.ceil(t.dynamaxUntil - g.t)} s more.`));
    else if (canDynamax(g, t)) {
      powers.push(button('btn.dynamax', h('span', {}, '🔴 Dynamax', h('br'), h('small', {}, `Max Moves for ${DYNAMAX_SECONDS} s`)), () => {
        dynamax(g, t.id);
        renderDock();
      }));
    }
    if (t.tera) parts.push(h('div.hint', {}, `💠 Terastallized: ${t.tera} type.`));
    else if (canTera(g, t)) {
      powers.push(button('btn.tera', h('span', {}, '💠 Terastallize', h('br'), h('small', {}, 'Pick its type · once a battle')), () => teraPicker(t)));
    }
    if (powers.length) parts.push(h('div.actions', {}, ...powers));
    if (s.attack !== 'aura') {
      const seg = h('div.segmented', {}, ...TARGET_MODES.map((m) => h('button', {
        className: t.target === m ? 'on' : '',
        onclick: () => {
          sfx.click();
          setTarget(g, t.id, m);
          renderDock();
        },
      }, TARGET_LABEL[m])));
      parts.push(h('div.row', {}, h('span.muted', { style: 'font-size:12px' }, 'Target'), seg));
    }
    return h('div.panel', {}, ...parts);
  }

  /** Choose a Tera type: any of the eighteen. */
  function teraPicker(t: Tower): void {
    const close = modal(h('div', {},
      h('h2', {}, 'Terastallize into…'),
      h('div.tera-types', {}, ...(Object.keys(TYPE_COLOURS) as PokeType[]).map((type) => h('button.type', {
        style: `background:${TYPE_COLOURS[type]}`,
        onclick: () => {
          terastallize(g, t.id, type);
          close();
          renderDock();
        },
      }, type))),
      button('btn.ghost', 'Cancel', () => close())));
  }

  // --- boss bar, banners, coach ------------------------------------------------------------
  function renderBoss(): void {
    const boss = g.enemies.find((e) => e.alive && e.boss);
    if (!boss) {
      bossBar.style.display = 'none';
      if (bossMusic) {
        bossMusic = null;
        playMusic(map.track);
      }
      return;
    }
    // A Champion gets their own theme.
    const want = boss.origin === map.boss.dex && map.finalTrack ? map.finalTrack : map.bossTrack;
    if (bossMusic !== want) {
      bossMusic = want;
      playMusic(want);
    }
    bossBar.style.display = '';
    const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    bossBar.replaceChildren(
      h('div', {}, `${trainerFor(map, boss)}'s ${boss.dynamaxUntil > g.t ? 'Dynamax ' : ''}${boss.totem ? 'Totem ' : ''}${boss.frenzy > 0 ? 'frenzied Noble ' : ''}${boss.sp.name}`,
        boss.tera ? h('span.type', { style: `background:${TYPE_COLOURS[boss.tera]};margin-left:6px` }, `Tera ${boss.tera}`) : null),
      h('div.hp', {}, h('div', { style: `width:${pct}%` })),
    );
  }

  function banner(text: string, sub = '', good = false): void {
    const el = h('div.banner', { className: `banner${good ? ' good' : ''}` }, text, sub ? h('small', {}, sub) : null);
    stage.append(el);
    setTimeout(() => el.remove(), 2500);
  }

  const tutorial = start.hints && !start.tutorialDone && map.id === MAPS[0]!.id;
  let coachStep = tutorial ? 0 : -1;
  let coachShownAt = 0;
  function renderCoach(): void {
    if (coachStep < 0) {
      coach.style.display = 'none';
      return;
    }
    const steps: [string, () => boolean][] = [
      ['Pick a Pokémon below, then tap the grass beside the path to place it.', () => g.towers.length > 0],
      ['Tap ▶ Start to send out the first wave of wild Pokémon!', () => g.wave > 0],
      ['Tap one of your Pokémon to level it up. At certain levels, it evolves!', () => g.towers.some((t) => t.level > 1) || g.wave >= 5],
      ['Weakened wild Pokémon can be caught: tap the Poké Ball, then tap the Pokémon.', () => g.log.ballsUsed.length > 0 || g.wave >= 8],
      ['Items like X Attack help in a pinch. Find more by tapping what fainted Pokémon drop.', () => g.log.used.length > 0 || g.wave >= 11],
    ];
    while (coachStep < steps.length && steps[coachStep]![1]()) {
      coachStep += 1;
      coachShownAt = performance.now();
    }
    if (coachStep >= steps.length) {
      coachStep = -1;
      coach.style.display = 'none';
      return;
    }
    // Step 4 waits for a Pokémon worth catching to be on the field.
    if (coachStep === 3 && !g.enemies.some((e) => e.alive && e.hp < e.maxHp * 0.6)) {
      coach.style.display = 'none';
      return;
    }
    const text = steps[coachStep]![0];
    if (coach.dataset.text !== text) {
      coach.dataset.text = text;
      const hide = h('button.coach-close', {
        'aria-label': 'Hide tips',
        title: 'Hide tips',
        onclick: () => {
          sfx.click();
          coachStep = -1;
          coach.style.display = 'none';
          setProgress({ ...getProgress(), hints: false, tutorialDone: true });
          renderDock(true);
          toast('Tips hidden. Turn them back on in Settings.');
        },
      }, '✕');
      coach.replaceChildren(thumb(25, 36, { animate: true }), h('span', {}, text), hide);
    }
    coach.style.display = performance.now() - coachShownAt > 300 ? '' : 'none';
  }

  // --- events -------------------------------------------------------------------------------
  let hurtTimer = 0;
  function handle(events: ReturnType<typeof g.events.splice>): void {
    for (const e of events) {
      if (e.kind === 'spawn' && e.boss) {
        const boss = g.enemies.find((x) => x.id === e.id);
        if (boss) banner(`${trainerFor(map, boss)} ${/ and /.test(trainerFor(map, boss)) ? 'send' : 'sends'} out ${boss.sp.name}!`, map.twist && boss.dex === map.boss.dex ? 'Gym Leader battle' : '');
      } else if (e.kind === 'spawn' && e.shiny) {
        toast('✨ A shiny Pokémon appeared!');
      } else if (e.kind === 'catch' && e.success) {
        const l = lineForDex(e.dex);
        const name = species(e.dex).name;
        if (l && !g.team.includes(l.id) && !lineUnlocked(getProgress(), l)) {
          g.team.push(l.id);
          newThisBattle.add(l.id);
          void loadSheets(lineDexes(l));
          toast(`Gotcha! ${name} was caught — and joins your team!`);
          renderDock(true);
        } else {
          toast(`Gotcha! ${name} was caught!${e.shiny ? ' ✨' : ''}`);
        }
      } else if (e.kind === 'catch') {
        toast(`Oh no! The Pokémon broke free!`);
      } else if (e.kind === 'leak') {
        stage.classList.remove('hurt');
        void stage.offsetWidth;
        stage.classList.add('hurt');
        clearTimeout(hurtTimer);
        hurtTimer = window.setTimeout(() => stage.classList.remove('hurt'), 400);
      } else if (e.kind === 'waveClear') {
        if (!map.endless && e.wave === g.totalWaves) continue;
      } else if (e.kind === 'pickup') {
        toast(`Found ${e.item in BALLS ? BALLS[e.item as BallKey].name : POWERUPS[e.item as PowerupKey].name}!`);
        renderRail();
      } else if (e.kind === 'bossFailed') {
        bossFailed();
      } else if (e.kind === 'won' || e.kind === 'lost') {
        finish();
      }
    }
  }

  // --- ending --------------------------------------------------------------------------------
  function bagAfter(p: Progress): Pick<Progress, 'items' | 'balls'> {
    const items = { ...p.items };
    for (const k of g.log.used) items[k] = Math.max(0, items[k] - 1);
    const balls = { ...p.balls };
    let pouch = start.trainer.pouch;
    for (const b of g.log.ballsUsed) {
      if (b === 'poke-ball' && pouch > 0) pouch -= 1;
      else balls[b] = Math.max(0, balls[b] - 1);
    }
    for (const f of g.log.found) {
      if (f in BALLS) balls[f as BallKey] += 1;
      else items[f as PowerupKey] += 1;
    }
    return { items, balls };
  }

  function record(won: boolean): ReturnType<typeof recordBattle> {
    const p = getProgress();
    const result = recordBattle({ ...p, ...bagAfter(p), tutorialDone: p.tutorialDone || tutorial }, {
      mapId: map.id, difficulty: opts.difficulty, won, stars: won ? starsFor(g) : 0, cleared: g.cleared,
      caught: g.log.caught, seen: [...g.log.seen], ...(opts.frontier ? { frontier: true } : {}),
    });
    setProgress(result.progress);
    opts.onEnd?.({ won, lives: g.lives, cleared: g.cleared });
    return result;
  }

  /** A gym leader's Pokémon got through: rewind to the start of its wave and try again. */
  function bossFailed(): void {
    // The Battle Frontier gives no second tries.
    if (opts.frontier) {
      g.status = 'lost';
      finish();
      return;
    }
    const boss = map.extraBosses?.find((b) => b.wave === g.checkpoint?.wave);
    const trainer = boss?.trainer ?? map.leader;
    const dex = boss?.boss.dex ?? map.boss.dex;
    selected = null;
    setMode({ kind: 'idle' });
    setTimeout(() => {
      const close = modal(
        h('div', {},
          h('div', { style: 'display:flex;justify-content:center' }, thumb(dex, 96, { animate: true })),
          h('h2', {}, `${trainer}'s ${species(dex).name} was too strong!`),
          h('p.muted', { style: 'margin:0;text-align:center;font-size:14px' },
            'You have to beat it to move on. The wave starts over with your towers, ₽, lives and items as they were — change your team around first if you like, then call the wave again.'),
          g.retries > 0 ? h('div', { style: 'text-align:center;font-size:12px' }, h('span.chip', {}, `Attempt ${g.retries + 2}`)) : null,
          button('btn.primary', '↻ Try the wave again', () => {
            close();
            retryWave(g);
            resetEffects();
            bossMusic = null;
            playMusic(map.track);
            renderRail();
            renderDock(true);
            banner(`Try again: ${trainer}`, 'Get ready, then call the wave', true);
          }),
          button('btn.ghost', 'Give up', () => {
            close();
            quit(false);
          }),
        ),
        { dismissable: false },
      );
    }, 700);
  }

  function quit(restart: boolean): void {
    if (finished) return;
    finished = true;
    clearBattle();
    record(false);
    if (restart) startBattle(opts);
    else opts.onExit();
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    clearBattle();
    const won = g.status === 'won';
    const hadBadges = MAPS.filter((m) => m.badge && getProgress().results[m.id] && (getProgress().results[m.id]!.normal || getProgress().results[m.id]!.hard)).length;
    const { bp, newLines } = record(won);
    const stars = won ? starsFor(g) : 0;
    if (won) playMusic(map.id === region.league ? region.championTrack : region.winTrack);
    else if (!map.endless) playMusic(map.track);
    const earnedBadge = won && map.badge && MAPS.filter((m) => m.badge && getProgress().results[m.id] && (getProgress().results[m.id]!.normal || getProgress().results[m.id]!.hard)).length > hadBadges;

    setTimeout(() => {
      const caught = g.log.caught.length
        ? h('div', {}, h('div.section-title', { style: 'text-align:center' }, 'Caught'),
          h('div.caught-row', {}, ...g.log.caught.map((c) => h('div.mon', {}, thumb(c.dex, 56, { shiny: c.shiny, animate: true }), `${c.shiny ? '✨ ' : ''}${species(c.dex).name}`))))
        : null;
      const unlocked = newLines.length
        ? h('div.card', { style: 'text-align:center;font-weight:700' }, `New tower${newLines.length > 1 ? 's' : ''}: ${newLines.map((l: TowerLine) => l.name).join(', ')}`)
        : null;
      const title = map.endless ? `Cleared ${g.cleared} waves` : won ? (map.id === 'indigo-plateau' ? 'You are the Champion!' : 'Victory!') : 'Defeated…';
      const close = modal(
        h('div', {},
          h('h2', {}, title),
          map.endless ? null : h('div.result-stars', {}, ...[1, 2, 3].map((i) => h('span', { className: i <= stars ? 'on' : '' }, '★'))),
          earnedBadge && map.badge ? badgeImg(map.badge, 'pix big-badge') : null,
          earnedBadge ? h('div', { style: 'text-align:center;font-weight:800' }, `You earned a Gym Badge from ${map.leader}!`) : null,
          h('div', { style: 'text-align:center' }, h('span.chip.gold', {}, `+${bp} BP`), ' ', h('span.chip', {}, `${g.log.kills} KOs`), ' ', h('span.chip', {}, `♥ ${g.lives}`)),
          caught,
          unlocked,
          h('div.row', {},
            opts.frontier ? null : button('btn.grow', 'Retry', () => {
              close();
              startBattle(opts);
            }),
            button('btn.primary.grow', 'Continue', () => {
              close();
              opts.onExit();
            })),
        ),
        { dismissable: false },
      );
    }, won ? 900 : 700);
  }

  // --- loop ------------------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  let lastRailTick = 0;
  function frame(ts: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    const now = ts / 1000;
    const running = !paused && !modalOpen() && !document.hidden && g.status === 'playing';
    const snap = snapshotEnemies(g);
    if (running) {
      acc += dt * speed;
      let n = 0;
      while (acc >= STEP && n < 20) {
        step(g);
        acc -= STEP;
        n += 1;
      }
      if (n === 20) acc = 0;
    }
    if (g.events.length) {
      const events = g.events.splice(0);
      ingest(g, events, now, snap);
      playEvents(g, events, now);
      handle(events);
    }

    const placeLine = mode.kind === 'place' ? mode.lineId : null;
    const overlay: Overlay = {
      selected,
      ghost: placeLine && ghost
        ? {
          dex: line(placeLine).stages[0]!.dex, x: ghost.x, y: ghost.y, ok: !canPlace(g, placeLine, ghost.x, ghost.y),
          stats: towerStats(line(placeLine), { level: 1, branch: null, move: null, held: g.held[placeLine] ?? null, ledge: false }),
        }
        : null,
      placeable: placeLine ? placeableTiles(placeLine) : null,
      aiming: mode.kind === 'ball' ? 'ball' : mode.kind === 'power' ? (POWERUPS[mode.key].target === 'spot' ? 'spot' : 'tower') : null,
      pointer,
      chances: mode.kind === 'ball' ? new Map(g.enemies.filter((e) => e.alive && !e.catching && e.revealed && (!e.boss || (map.endless && e.dex === 150))).map((e) => [e.id, catchChance(g, e, (mode as { ball: BallKey }).ball)])) : null,
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBattle(ctx, g, { tile, dpr }, overlay, now);

    renderHud();
    renderWaveBar();
    renderBoss();
    renderCoach();
    if (ts - lastRailTick > 100) {
      lastRailTick = ts;
      renderRail();
      tickRail();
      renderDock();
    }
  }

  let placeableCache: { lineId: string; money: number; towers: number; set: Set<string> } | null = null;
  function placeableTiles(lineId: string): Set<string> {
    if (placeableCache && placeableCache.lineId === lineId && placeableCache.towers === g.towers.length) return placeableCache.set;
    const set = new Set<string>();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const err = canPlace(g, lineId, x, y);
        if (!err || err === 'money') set.add(`${x},${y}`);
      }
    }
    placeableCache = { lineId, money: g.money, towers: g.towers.length, set };
    return set;
  }

  /** Keep the battle saved as it goes, so a closed tab can pick up where it was. */
  function save(): void {
    if (finished || (g.status !== 'playing' && g.status !== 'retry')) return;
    saveBattle({
      mapId: map.id, difficulty: opts.difficulty, team: opts.team, game: serializeGame(g), newLines: [...newThisBattle],
      ...(opts.frontier ? { frontier: opts.frontier } : {}), ...(opts.rules ? { rules: opts.rules } : {}),
    });
  }
  const saveTimer = window.setInterval(save, 3000);

  const onVisibility = (): void => {
    if (!document.hidden) return;
    save();
    if (!finished && !paused) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);

  mount(root, () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    rootObserver.disconnect();
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', save);
    clearInterval(saveTimer);
  });
  resize();
  setSpeed(1);
  renderHud();
  renderRail();
  renderDock(true);
  raf = requestAnimationFrame(frame);
  if (restored) {
    // Pick up where the tab closed: paused, so nothing happens until you're ready.
    if (g.status === 'retry') bossFailed();
    else pause('Welcome back! Your battle was saved just as you left it.');
  } else if (g.rules.label) toast(`📜 ${g.rules.label}`);
  return true;
}
