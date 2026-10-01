/**
 * The battle screen: the wild Pokémon up top, yours from behind below, and
 * a message box with your commands. The engine in `game/battle.ts` settles a
 * whole turn at once; this plays its events back one by one — messages, HP
 * bars draining, lunges, faints, the ball's wobbles — before taking the next
 * command.
 */
import { cry, loadCries, sfx } from '../audio/index';
import { playMusic } from '../audio/music';
import { BATTLE, VICTORY } from '../data/music';
import { isNight } from '../data/encounters';
import { item } from '../data/items';
import { move } from '../data/moves';
import { species } from '../data/species';
import { TYPE_COLOURS } from '../data/types';
import { act, activeMon, battleItems, endBattle, type BattleAction, type BattleEvent } from '../game/battle';
import { maxHp, xpForLevel } from '../game/mon';
import { monByUid, partyMons, type Mon, type World } from '../game/model';
import { drawIcon, drawPokemon, loadSheet } from '../render/sprites';
import { skyTint } from '../render/light';
import { h } from './dom';
import { itemIcon } from './icons';

type Sfx = keyof typeof sfx;

interface Anim {
  wildX: number;
  youX: number;
  wildAlpha: number;
  youAlpha: number;
  wildDrop: number;
  youDrop: number;
  flash: 'wild' | 'you' | null;
  ball: { t: number; wobble: number; shut: boolean } | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function hpColour(frac: number): string {
  return frac > 0.5 ? '#48c050' : frac > 0.2 ? '#f0b020' : '#e04030';
}

export function battleScreen(host: HTMLElement, world: World, onDone: () => void): void {
  const b = world.battle!;
  const wild = b.wild;
  const canvas = h('canvas.arena', { 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d')!;
  const wildCard = card();
  const youCard = card(true);
  const message = h('div.battle-text', { 'aria-live': 'polite' });
  const commands = h('div.commands');
  const root = h('section.battle', { role: 'dialog', 'aria-label': 'Battle' }, h('div.arena-wrap', {}, canvas, wildCard.el, youCard.el), h('div.battle-bottom', {}, message, commands));
  host.append(root);

  // What's shown, which lags the model while events play back.
  let shownActive = b.active;
  let wildHp = wild.hp;
  let youHp = activeMon(world, b).hp;
  const anim: Anim = { wildX: 0, youX: 0, wildAlpha: 1, youAlpha: 1, wildDrop: 0, youDrop: 0, flash: null, ball: null };
  let busy = false;
  let closed = false;

  void loadSheet(wild.dex, wild.shiny);
  for (const m of partyMons(world)) void loadSheet(m.dex, false, true);
  loadCries([wild.dex, ...partyMons(world).map((m) => m.dex)]);

  // --- drawing ---------------------------------------------------------------------
  const resize = (): void => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function draw(now: number): void {
    if (closed) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.imageSmoothingEnabled = false;
    const night = isNight(world.clock);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, night ? '#1c2450' : '#9ad8ff');
    sky.addColorStop(0.55, night ? '#34406e' : '#d8f0ff');
    sky.addColorStop(0.551, night ? '#2e5a2e' : '#78c860');
    sky.addColorStop(1, night ? '#1f4020' : '#58a844');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const tint = skyTint(world.clock);
    if (tint.a > 0) {
      ctx.fillStyle = `rgba(${tint.r | 0},${tint.g | 0},${tint.b | 0},${(tint.a * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const unit = Math.min(W / 240, H / 200);
    const scale = Math.max(1, Math.floor(unit * 2)) / 2 * 2;
    const wildPos = { x: W * 0.72 + anim.wildX * unit, y: H * 0.5 };
    const youPos = { x: W * 0.28 + anim.youX * unit, y: H * 0.95 };
    platform(wildPos.x - anim.wildX * unit, wildPos.y, unit * 52);
    platform(youPos.x - anim.youX * unit, youPos.y - unit * 4, unit * 64);
    if (!anim.ball?.shut) {
      const blink = anim.flash === 'wild' && Math.floor(now / 70) % 2 === 0;
      if (!blink) drawPokemon(ctx, wild.dex, wildPos.x, wildPos.y + anim.wildDrop * unit, scale, { time: now, shiny: wild.shiny, alpha: anim.wildAlpha });
    }
    const mine = monByUid(world, shownActive);
    if (mine) {
      const blink = anim.flash === 'you' && Math.floor(now / 70) % 2 === 0;
      if (!blink) drawPokemon(ctx, mine.dex, youPos.x, youPos.y + anim.youDrop * unit, scale * 1.25, { time: now, back: true, alpha: anim.youAlpha });
    }
    if (anim.ball) {
      const t = Math.min(1, anim.ball.t);
      const x = youPos.x + (wildPos.x - youPos.x) * t;
      const y = youPos.y - unit * 40 + (wildPos.y - unit * 10 - (youPos.y - unit * 40)) * t - Math.sin(t * Math.PI) * unit * 50;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(anim.ball.wobble);
      drawIcon(ctx, 'poke-ball', 0, 0, unit * 22);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }

  function platform(x: number, y: number, r: number): void {
    ctx.fillStyle = 'rgba(40, 70, 30, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- cards -----------------------------------------------------------------------
  function card(mine = false): { el: HTMLElement; set: (mon: Mon, hp: number) => void } {
    const name = h('div.card-name');
    const fill = h('div.hp-fill');
    const nums = h('div.hp-nums');
    const xp = h('div.xp-fill');
    const el = h('div', { className: mine ? 'poke-card you' : 'poke-card wild' }, name, h('div.hp-row', {}, h('span.hp-label', {}, 'HP'), h('div.hp-bar', {}, fill)), mine ? nums : null, mine ? h('div.xp-bar', {}, xp) : null);
    return {
      el,
      set: (mon, hp) => {
        const max = maxHp(mon);
        name.replaceChildren(h('span', {}, `${species(mon.dex).name}${mon.shiny ? ' ★' : ''}`), h('span.lv', {}, `Lv${mon.level}`));
        const frac = Math.max(0, hp / max);
        fill.style.width = `${frac * 100}%`;
        fill.style.background = hpColour(frac);
        nums.textContent = `${Math.max(0, Math.round(hp))} / ${max}`;
        const lo = xpForLevel(mon.level);
        xp.style.width = `${Math.min(100, ((mon.xp - lo) / Math.max(1, xpForLevel(mon.level + 1) - lo)) * 100)}%`;
      },
    };
  }

  function refreshCards(): void {
    wildCard.set(wild, wildHp);
    const mine = monByUid(world, shownActive);
    if (mine) youCard.set(mine, youHp);
  }

  // --- playback --------------------------------------------------------------------
  let skip: (() => void) | null = null;
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.commands button')) return;
    skip?.();
  });

  async function say(text: string, hold = 900): Promise<void> {
    message.textContent = '';
    refreshCards();
    for (let i = 1; i <= text.length; i += 2) {
      message.textContent = text.slice(0, i);
      await sleep(12);
    }
    message.textContent = text;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, hold);
      skip = () => {
        clearTimeout(t);
        resolve();
      };
    });
    skip = null;
  }

  async function tween(from: number, to: number, ms: number, set: (v: number) => void): Promise<void> {
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / ms);
      set(from + (to - from) * t);
      refreshCards();
      if (t >= 1) return;
      await sleep(16);
    }
  }

  async function play(ev: BattleEvent): Promise<void> {
    switch (ev.kind) {
      case 'text': {
        if (ev.text.includes('grew to level')) sfx.levelUp();
        if (ev.text.includes('evolved into')) sfx.evolve();
        if (ev.text.startsWith("It's super effective")) sfx.superEffective();
        await say(ev.text, ev.text.includes('evolved') ? 1800 : 900);
        return;
      }
      case 'attack': {
        const mv = move(ev.move);
        const key = mv.type as Sfx;
        if (mv.power > 0) (sfx[key] ?? sfx.normal)();
        else sfx.stun();
        const dir = ev.side === 'you' ? 1 : -1;
        await tween(0, 14 * dir, 110, (v) => (ev.side === 'you' ? (anim.youX = v) : (anim.wildX = v)));
        await tween(14 * dir, 0, 140, (v) => (ev.side === 'you' ? (anim.youX = v) : (anim.wildX = v)));
        return;
      }
      case 'hp': {
        const drop = ev.side === 'wild' ? ev.hp < wildHp : ev.hp < youHp;
        if (drop) {
          anim.flash = ev.side;
          setTimeout(() => (anim.flash = null), 350);
        }
        if (ev.side === 'wild') await tween(wildHp, ev.hp, 450, (v) => (wildHp = v));
        else await tween(youHp, ev.hp, 450, (v) => (youHp = v));
        return;
      }
      case 'faint':
        sfx.faint();
        if (ev.side === 'wild') cry(wild.dex, { rate: 0.8, volume: 0.4 });
        await tween(0, 1, 450, (v) => {
          if (ev.side === 'wild') { anim.wildDrop = v * 30; anim.wildAlpha = 1 - v; } else { anim.youDrop = v * 30; anim.youAlpha = 1 - v; }
        });
        return;
      case 'send': {
        shownActive = ev.uid;
        const mon = monByUid(world, ev.uid)!;
        youHp = mon.hp;
        anim.youDrop = 0;
        anim.youAlpha = 1;
        cry(mon.dex, { volume: 0.45 });
        refreshCards();
        return;
      }
      case 'throw':
        sfx.throw();
        anim.ball = { t: 0, wobble: 0, shut: false };
        await tween(0, 1, 600, (v) => (anim.ball!.t = v));
        anim.ball.shut = true;
        await sleep(250);
        return;
      case 'shake':
        for (let i = 0; i < ev.count; i += 1) {
          sfx.shake();
          await tween(0, 1, 420, (v) => (anim.ball!.wobble = Math.sin(v * Math.PI * 2) * 0.45));
          await sleep(200);
        }
        if (world.battle?.over !== 'caught' || ev.count < 3) {
          sfx.breakFree();
          anim.ball = null;
        }
        return;
      case 'caught':
        sfx.caught();
        await sleep(700);
        return;
      case 'end':
        if (ev.result === 'win' || ev.result === 'caught') playMusic(VICTORY);
        if (ev.result === 'lose') sfx.lose();
        return;
    }
  }

  async function run(action: BattleAction): Promise<void> {
    if (busy) return;
    busy = true;
    commands.replaceChildren();
    const events = act(world, action);
    for (const ev of events) await play(ev);
    busy = false;
    next();
  }

  // --- commands --------------------------------------------------------------------
  function button(label: HTMLElement | string, onclick: () => void, cls = '', disabled = false): HTMLButtonElement {
    return h('button', { className: `cmd ${cls}`, onclick, disabled }, label);
  }

  function next(): void {
    const battle = world.battle;
    if (!battle || closed) return;
    if (battle.over) {
      message.textContent = battle.over === 'lose' ? 'You rush home to the farmhouse...' : message.textContent;
      commands.replaceChildren(button('Continue', close, 'wide primary'));
      return;
    }
    if (battle.mustSwitch) {
      message.textContent = 'Who will you send out?';
      showParty(true);
      return;
    }
    const mon = activeMon(world, battle);
    message.textContent = `What will ${species(mon.dex).name} do?`;
    commands.replaceChildren(
      button('Fight', showMoves, 'fight'),
      button('Bag', showBag, 'bag'),
      button('Pokémon', () => showParty(false), 'mons'),
      button('Run', () => void run({ kind: 'run' }), 'run'),
    );
  }

  function back(): HTMLButtonElement {
    return button('Back', next, 'back');
  }

  function showMoves(): void {
    const mon = activeMon(world, world.battle!);
    commands.replaceChildren(
      ...mon.moves.map((id, i) => {
        const mv = move(id);
        return button(
          h('span.move', {}, h('b', {}, mv.name), h('span.move-meta', {}, h('span.type', { style: `background:${TYPE_COLOURS[mv.type]}` }, mv.type), mv.power ? ` ${mv.power}` : ' status')),
          () => void run({ kind: 'move', index: i }),
          'move',
        );
      }),
      back(),
    );
  }

  function showBag(): void {
    const ids = battleItems(world);
    const rows = ids.map((id) => {
      const def = item(id);
      const verb = def.kind === 'ball' ? 'Throw' : def.heals ? 'Heal' : 'Offer';
      return button(h('span.bag-item', {}, itemIcon(id, 'cmd-icon'), h('span', {}, `${def.name} ×${world.inventory[id]}`), h('span.verb', {}, verb)), () => void run({ kind: 'item', id }), 'item');
    });
    commands.replaceChildren(...(rows.length ? rows : [h('p.cmd-empty', {}, 'Nothing useful in your bag. Buy Poké Balls at the Mart, and berries heal or calm.')]), back());
  }

  function showParty(forced: boolean): void {
    const battle = world.battle!;
    const rows = partyMons(world).map((mon) => {
      const max = maxHp(mon);
      const out = mon.uid === battle.active;
      return button(
        h('span.party-row', {}, h('b', {}, species(mon.dex).name), h('span', {}, `Lv${mon.level}`), h('span.hp-mini', {}, h('span', { style: `width:${(mon.hp / max) * 100}%;background:${hpColour(mon.hp / max)}` })), h('span.hp-text', {}, `${mon.hp}/${max}`)),
        () => void run({ kind: 'switch', uid: mon.uid }),
        'party',
        out || mon.hp <= 0,
      );
    });
    commands.replaceChildren(...rows, ...(forced ? [] : [back()]));
  }

  function close(): void {
    if (closed) return;
    closed = true;
    observer.disconnect();
    endBattle(world);
    root.classList.add('leaving');
    setTimeout(() => root.remove(), 250);
    onDone();
  }

  // --- start -----------------------------------------------------------------------
  resize();
  refreshCards();
  requestAnimationFrame(draw);
  playMusic(BATTLE);
  void (async () => {
    busy = true;
    anim.wildAlpha = 0;
    await sleep(350);
    cry(wild.dex, { volume: 0.5 });
    await tween(0, 1, 300, (v) => (anim.wildAlpha = v));
    await say(`A wild ${species(wild.dex).name} appeared!${wild.shiny ? ' It sparkles!' : ''}`, 1100);
    if (wild.shiny) sfx.shiny();
    await say(`Go, ${species(activeMon(world, b).dex).name}!`, 700);
    cry(activeMon(world, b).dex, { volume: 0.4 });
    busy = false;
    next();
  })();
}
