/**
 * The in-level screen: canvas, HUD, touch input and the frame loop. It owns
 * one `Game` at a time and reports the outcome through `onFinish`.
 */
import { cry, sfx, unlock } from '../audio';
import { playMusic, stopMusic } from '../audio/music';
import { AREAS } from '../data/areas';
import type { LevelDef } from '../data/levels';
import { BOSS_WIN_TRACK, WIN_TRACK, type TrackId } from '../data/music';
import { ITEM_KEYS, ITEMS, itemUrl, LAUNCHERS, TARGETS, type ItemKey } from '../data/roster';
import { Game, type GameEvent } from '../game/game';
import { starsFor } from '../game/scoring';
import { clampPull, type Vec } from '../game/sling';
import { SLING } from '../game/world';
import { Camera } from '../render/camera';
import { Renderer, type AimState } from '../render/draw';
import { h } from './dom';

export interface Outcome {
  won: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  /** The level's hidden item, if something knocked into it. */
  collected: ItemKey | null;
}

export interface PlayCallbacks {
  onFinish(outcome: Outcome): void;
  onPause(): void;
  /** How many of an item the player has. */
  bagCount(item: ItemKey): number;
  /** Take one out of the bag: the game has just used it. */
  spendItem(item: ItemKey): void;
}

/** The music for a level: its own, the area's boss track, or the area's. */
export function levelTrack(level: LevelDef): TrackId {
  const area = AREAS[level.area]!;
  return level.music ?? (level.index === 6 && area.bossMusic ? area.bossMusic : area.music);
}

/** How close to the pouch, in screen pixels, a press has to land to grab it. */
const GRAB_RADIUS = 60;
/** Let the last things fall and the score count before the results appear. */
const RESULT_DELAY_MS = 1400;

type Gesture = 'none' | 'aim' | 'pan' | 'pinch';

export class PlayScreen {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly camera = new Camera();
  private game: Game;
  private readonly aim: AimState = { pull: null };

  private readonly scoreEl = h('span.hud-score', {}, '0');
  private readonly targetsEl = h('span.hud-targets');
  private readonly hintEl = h('div.hud-hint');
  private readonly bagButton: HTMLButtonElement;
  private readonly bagTray = h('div.bag-tray', { role: 'menu', 'aria-label': 'Bag' });

  private paused = false;
  private frame = 0;
  private last = 0;
  private finishTimer = 0;

  private gesture: Gesture = 'none';
  private readonly pointers = new Map<number, Vec>();
  private panX = 0;
  private pinchDistance = 0;

  constructor(private level: LevelDef, private readonly callbacks: PlayCallbacks) {
    this.canvas = h('canvas.playfield', { 'aria-label': `Level ${level.id}: ${level.name}` });
    this.renderer = new Renderer(this.canvas);
    this.game = new Game(level);

    const pause = h('button.hud-button', { 'aria-label': 'Pause', onclick: () => this.pause() }, 'Ⅱ');
    const area = AREAS[level.area]!;
    const title = h('div.hud-level', {}, h('b', {}, `${area.name} ${level.index}`), h('span', {}, level.name));
    this.bagButton = h('button.hud-button.bag-button', { 'aria-label': 'Bag', onclick: () => this.toggleBag() },
      h('img', { src: itemUrl('poke-ball'), alt: '' }));
    this.bagTray.hidden = true;
    this.el = h('div.play',
      {},
      this.canvas,
      h('div.hud', {}, pause, this.bagButton, title, h('div.hud-right', {}, this.scoreEl, this.targetsEl)),
      this.bagTray,
      this.hintEl,
    );

    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Call once the element is in the document, so it has a size. */
  start(): void {
    // For scripts/verify-ui.ts, which needs to know where to grab.
    (window as unknown as { __pouch(): Vec }).__pouch = () => this.camera.toScreen(SLING);
    this.resize();
    this.camera.reset(this.level.width);
    this.last = performance.now();
    this.frame = requestAnimationFrame((t) => this.tick(t));
    playMusic(levelTrack(this.level));
    const area = AREAS[this.level.area]!;
    const intro = this.level.index === 1 && area.introduces ? LAUNCHERS[area.introduces] : null;
    if (intro) this.flashHint(`New: ${intro.name} — ${intro.abilityLabel.replace('Tap: ', 'tap in flight for ')}`, 4000);
    else if (window.innerHeight > window.innerWidth) this.flashHint('Turn sideways for a wider view', 3000);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.finishTimer);
  }

  resize(): void {
    const rect = this.el.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    this.camera.resize(rect.width, rect.height);
  }

  restart(level: LevelDef = this.level): void {
    window.clearTimeout(this.finishTimer);
    this.level = level;
    this.game = new Game(level);
    this.aim.pull = null;
    this.renderer.effects.clear();
    this.camera.reset(level.width);
    this.paused = false;
    this.closeBag();
    playMusic(levelTrack(level));
  }

  pause(): void {
    if (this.paused || this.game.phase === 'won' || this.game.phase === 'lost') return;
    this.paused = true;
    this.aim.pull = null;
    this.gesture = 'none';
    this.closeBag();
    this.callbacks.onPause();
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
  }

  // --- loop -------------------------------------------------------------

  private tick(now: number): void {
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const { game, camera } = this;

    if (!this.paused) {
      game.update(dt);
      for (const event of game.events.splice(0)) this.onEvent(event);

      const lead = game.projectiles.find((p) => !p.dead);
      if (game.phase === 'flying' && lead) camera.track(lead.body.position);
      camera.update(dt);
      this.renderer.effects.update(dt);
    }

    this.renderer.draw(game, camera, this.aim, now);
    this.updateHud();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private onEvent(event: GameEvent): void {
    this.renderer.effects.consume(event);
    switch (event.type) {
      case 'launch':
        sfx.launch();
        cry(LAUNCHERS[event.key].dex);
        break;
      case 'impact':
        sfx.thud(event.strength);
        break;
      case 'break':
        sfx.crack();
        break;
      case 'faint':
        // Lower and slower, the way a fainting cry sounds in the games.
        if (!cry(TARGETS[event.kind].dex, { rate: 0.8 })) sfx.faint();
        break;
      case 'explode':
        sfx.boom();
        break;
      case 'ability':
        sfx.ability();
        break;
      case 'loaded':
        this.camera.aim();
        break;
      case 'splash':
        sfx.crack();
        break;
      case 'pickup':
        sfx.pickup();
        this.flashHint(`Found ${ITEMS[event.item].name}!`, 2200);
        break;
      case 'item':
        if (event.item === 'tm-ground') sfx.quake();
        else sfx.item();
        this.flashHint(`${ITEMS[event.item].name}! ${ITEMS[event.item].blurb}`, 2400);
        break;
      case 'won':
      case 'lost': {
        const won = event.type === 'won';
        this.closeBag();
        if (won) playMusic(this.level.index === 6 ? BOSS_WIN_TRACK : WIN_TRACK);
        else stopMusic();
        this.finishTimer = window.setTimeout(() => {
          if (!won) sfx.lose();
          this.callbacks.onFinish({
            won, score: this.game.score, stars: starsFor(this.level, this.game.score, won), collected: this.game.collected,
          });
        }, RESULT_DELAY_MS);
        break;
      }
      default:
        break;
    }
  }

  // --- the bag ----------------------------------------------------------

  private toggleBag(): void {
    unlock();
    if (!this.bagTray.hidden) {
      this.closeBag();
      return;
    }
    if (this.game.phase !== 'aiming') {
      this.flashHint('Use items while aiming', 1600);
      return;
    }
    sfx.click();
    this.bagTray.replaceChildren(...ITEM_KEYS.map((key) => {
      const count = this.callbacks.bagCount(key);
      const usable = count > 0 && this.game.canUseItem(key);
      const used = this.game.usedItems.has(key);
      return h('button.bag-item', {
        role: 'menuitem',
        disabled: !usable,
        'data-item': key,
        onclick: () => this.useItem(key),
      },
      h('img', { src: itemUrl(key), alt: '' }),
      h('span.bag-name', {}, ITEMS[key].name),
      h('span.bag-blurb', {}, used ? 'Used this level' : ITEMS[key].blurb),
      h('span.bag-count', {}, `×${count}`));
    }));
    this.bagTray.hidden = false;
  }

  private closeBag(): void {
    this.bagTray.hidden = true;
  }

  private useItem(key: ItemKey): void {
    if (this.callbacks.bagCount(key) <= 0) return;
    if (this.game.useItem(key)) this.callbacks.spendItem(key);
    this.closeBag();
  }

  private updateHud(): void {
    this.bagButton.classList.toggle('dim', this.game.phase !== 'aiming');
    const score = this.game.score.toLocaleString('en-US');
    if (this.scoreEl.textContent !== score) this.scoreEl.textContent = score;
    const targets = `${this.game.targetsLeft} left`;
    if (this.targetsEl.textContent !== targets) this.targetsEl.textContent = targets;

    const ability = this.game.abilityTarget?.launcher?.abilityLabel ?? '';
    if (ability && this.hintEl.textContent !== ability) {
      this.hintEl.textContent = ability;
      this.hintEl.classList.add('show');
    } else if (!ability && this.hintEl.dataset['sticky'] !== '1' && this.hintEl.classList.contains('show')) {
      this.hintEl.classList.remove('show');
    }
  }

  private flashHint(text: string, ms: number): void {
    this.hintEl.textContent = text;
    this.hintEl.dataset['sticky'] = '1';
    this.hintEl.classList.add('show');
    window.setTimeout(() => {
      this.hintEl.dataset['sticky'] = '';
      this.hintEl.classList.remove('show');
    }, ms);
  }

  // --- input ------------------------------------------------------------

  private point(e: PointerEvent): Vec {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onDown(e: PointerEvent): void {
    unlock();
    if (this.paused) return;
    if (!this.bagTray.hidden) {
      this.closeBag();
      return;
    }
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size === 2) {
      // A second finger turns whatever was happening into a pinch.
      this.aim.pull = null;
      this.gesture = 'pinch';
      this.pinchDistance = this.spread();
      return;
    }
    if (this.pointers.size > 2) return;

    const { game, camera } = this;
    const pouch = camera.toScreen(SLING);
    const grab = Math.max(GRAB_RADIUS, 40 * camera.scale);
    if (game.phase === 'aiming' && game.loaded && Math.hypot(p.x - pouch.x, p.y - pouch.y) < grab) {
      this.gesture = 'aim';
      this.aim.pull = clampPull(camera.toWorld(p));
      if (camera.mode === 'manual') camera.aim();
      sfx.stretch();
      return;
    }
    if (game.useAbility()) {
      this.gesture = 'none';
      return;
    }
    this.gesture = 'pan';
    this.panX = p.x;
  }

  private onMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);

    if (this.gesture === 'aim') {
      this.aim.pull = clampPull(this.camera.toWorld(p));
    } else if (this.gesture === 'pan') {
      this.camera.pan(p.x - this.panX);
      this.panX = p.x;
    } else if (this.gesture === 'pinch' && this.pointers.size >= 2) {
      const d = this.spread();
      if (this.pinchDistance > 0 && d > 0) this.camera.pinch(d / this.pinchDistance, this.midX());
      this.pinchDistance = d;
    }
  }

  private onUp(e: PointerEvent, cancelled = false): void {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.gesture === 'aim') {
      const pull = this.aim.pull;
      this.aim.pull = null;
      if (!cancelled && pull && this.game.launch(pull)) {
        const shot = this.game.projectiles[0];
        if (shot) this.camera.startFollow(shot.body.position);
      }
    }
    if (this.pointers.size === 0) this.gesture = 'none';
    else if (this.pointers.size === 1 && this.gesture === 'pinch') {
      this.gesture = 'pan';
      this.panX = [...this.pointers.values()][0]?.x ?? 0;
    }
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private midX(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? (a.x + b.x) / 2 : 0;
  }
}
