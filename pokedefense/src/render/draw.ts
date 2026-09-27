/**
 * Draws a battle: the ground, then everything standing on it sorted by depth,
 * then shots, effects and overlays. Reads the game; never changes it.
 *
 * Short-lived visuals (beams, bursts, floating numbers, the evolution glow)
 * are spawned from the game's events by `ingest` and live here, in screen
 * time, so they keep animating while the game is paused.
 */
import { COLS, ROWS, type Weather } from '../data/maps';
import { POWERUPS } from '../data/items';
import { type PokeType, TYPE_COLOURS } from '../data/types';
import type { Enemy, Game, GameEvent, Tower } from '../game/game';
import { type TowerStats } from '../game/stats';
import { drawIcon, drawPokemon, drawPokemonTinted, sheetSize } from './sprites';
import { renderGround, TILE_PX } from './tiles';

export interface View {
  /** Canvas pixels per tile. */
  tile: number;
  dpr: number;
}

export interface Overlay {
  selected: number | null;
  ghost: { dex: number; x: number; y: number; ok: boolean; stats: TowerStats } | null;
  /** Highlight tiles where the chosen tower could go. */
  placeable: Set<string> | null;
  aiming: 'ball' | 'spot' | 'tower' | null;
  pointer: { x: number; y: number } | null;
  /** While aiming a ball: each catchable Pokémon's chance, by id. */
  chances: Map<number, number> | null;
}

interface Fx {
  kind: 'beam' | 'chain' | 'ring' | 'burst' | 'text' | 'glow' | 'bolt' | 'flash' | 'throw' | 'stars' | 'poof';
  x: number;
  y: number;
  t0: number;
  dur: number;
  colour: string;
  points?: { x: number; y: number }[];
  radius?: number;
  text?: string;
  size?: number;
  id?: number;
  dex?: number;
  flip?: boolean;
}

const fxs: Fx[] = [];
/** Towers glowing white mid-evolution, by id → end time. */
const evolving = new Map<number, number>();
/** Enemies fainting: drawn falling away after they leave the game. */
const fainting: { dex: number; x: number; y: number; t0: number; flip: boolean; shiny: boolean; scale: number }[] = [];
let groundCache: { id: string; canvas: HTMLCanvasElement } | null = null;

export function resetEffects(): void {
  fxs.length = 0;
  evolving.clear();
  fainting.length = 0;
}

const colour = (t: PokeType): string => TYPE_COLOURS[t];

/** Turn game events into visuals. `now` is screen time in seconds. */
export function ingest(g: Game, events: readonly GameEvent[], now: number, lastEnemies: Map<number, Enemy>): void {
  for (const e of events) {
    switch (e.kind) {
      case 'attack':
        if (e.attack === 'beam') fxs.push({ kind: 'beam', x: e.x, y: e.y - 0.25, points: e.points, t0: now, dur: 0.22, colour: colour(e.type) });
        else if (e.attack === 'chain') fxs.push({ kind: 'chain', x: e.x, y: e.y - 0.3, points: e.points, t0: now, dur: 0.22, colour: colour(e.type) });
        else if (e.attack === 'pulse') fxs.push({ kind: 'ring', x: e.x, y: e.y, radius: e.radius, t0: now, dur: 0.4, colour: colour(e.type) });
        break;
      case 'splash':
        fxs.push({ kind: 'burst', x: e.x, y: e.y, radius: e.radius, t0: now, dur: 0.35, colour: colour(e.type) });
        break;
      case 'hit':
        if (e.eff === 0) fxs.push({ kind: 'text', x: e.x, y: e.y - 0.8, text: 'immune', size: 0.26, t0: now, dur: 0.7, colour: '#c8c8c8' });
        else if (e.eff === -1) fxs.push({ kind: 'text', x: e.x, y: e.y - 0.8, text: 'shield', size: 0.26, t0: now, dur: 0.6, colour: '#8ad8f8' });
        else if (e.crit || e.eff >= 2) {
          fxs.push({ kind: 'text', x: e.x + (Math.random() - 0.5) * 0.4, y: e.y - 0.9, text: `${Math.round(e.damage)}${e.crit ? '!' : ''}`, size: e.crit ? 0.4 : 0.32, t0: now, dur: 0.7, colour: e.eff >= 2 ? '#f8e048' : '#ffffff' });
        }
        break;
      case 'faint': {
        const last = lastEnemies.get(e.id);
        if (last) fainting.push({ dex: last.dex, x: last.x, y: last.y, t0: now, flip: last.facing > 0, shiny: last.shiny, scale: enemyScale(last) });
        fxs.push({ kind: 'poof', x: e.x, y: e.y - 0.3, t0: now, dur: 0.45, colour: '#f8f8f8' });
        fxs.push({ kind: 'text', x: e.x, y: e.y - 1, text: `+₽${e.bounty}`, size: e.boss ? 0.42 : 0.28, t0: now, dur: 0.9, colour: '#f8d848' });
        break;
      }
      case 'life':
        fxs.push({ kind: 'text', x: e.x, y: e.y - 0.4, text: '+♥', size: 0.34, t0: now, dur: 1, colour: '#ff8a8a' });
        break;
      case 'money':
        fxs.push({ kind: 'text', x: e.x, y: e.y - 0.6, text: `+₽${e.amount}`, size: 0.24, t0: now, dur: 0.7, colour: '#f8d848' });
        break;
      case 'level':
        if (e.evolved) {
          evolving.set(e.id, now + 1.4);
          fxs.push({ kind: 'stars', x: e.x, y: e.y - 0.5, t0: now + 1.2, dur: 0.8, colour: '#f8f8f8', radius: 1.2 });
        } else {
          fxs.push({ kind: 'stars', x: e.x, y: e.y - 0.5, t0: now, dur: 0.6, colour: '#f8e048', radius: 0.7 });
        }
        fxs.push({ kind: 'text', x: e.x, y: e.y - 1.2, text: e.evolved ? 'Evolved!' : `Lv ${e.level}`, size: 0.32, t0: now, dur: 1.1, colour: '#ffffff' });
        break;
      case 'move':
        fxs.push({ kind: 'stars', x: e.x, y: e.y - 0.5, t0: now, dur: 0.9, colour: '#b8f8ff', radius: 1.3 });
        fxs.push({ kind: 'text', x: e.x, y: e.y - 1.3, text: e.name, size: 0.3, t0: now, dur: 1.4, colour: '#b8f8ff' });
        break;
      case 'place':
        fxs.push({ kind: 'ring', x: e.x, y: e.y, radius: 0.8, t0: now, dur: 0.35, colour: '#ffffff' });
        break;
      case 'sell':
        fxs.push({ kind: 'text', x: e.x, y: e.y - 0.6, text: `+₽${e.refund}`, size: 0.3, t0: now, dur: 0.8, colour: '#f8d848' });
        fxs.push({ kind: 'poof', x: e.x, y: e.y - 0.3, t0: now, dur: 0.45, colour: '#f8f8f8' });
        break;
      case 'stunTowers':
        fxs.push({ kind: 'ring', x: e.x, y: e.y, radius: e.radius, t0: now, dur: 0.5, colour: '#f8e048' });
        break;
      case 'ability':
        if (e.ability === 'teleport') fxs.push({ kind: 'stars', x: e.x, y: e.y - 0.3, t0: now, dur: 0.4, colour: '#f878c8', radius: 0.6 });
        if (e.ability === 'heal') fxs.push({ kind: 'text', x: e.x, y: e.y - 1.4, text: 'Recover!', size: 0.34, t0: now, dur: 1, colour: '#78f878' });
        if (e.ability === 'summon') fxs.push({ kind: 'ring', x: e.x, y: e.y, radius: 1, t0: now, dur: 0.4, colour: '#f85858' });
        break;
      case 'evolveEnemy':
        fxs.push({ kind: 'flash', x: e.x, y: e.y - 0.4, t0: now, dur: 0.5, colour: '#ffffff', radius: 0.7 });
        fxs.push({ kind: 'text', x: e.x, y: e.y - 1.2, text: 'evolved!', size: 0.26, t0: now, dur: 0.9, colour: '#f89090' });
        break;
      case 'throw':
        fxs.push({ kind: 'throw', x: e.x, y: e.y, t0: now, dur: 0.35, colour: '#fff', text: e.ball });
        break;
      case 'catch':
        if (e.success) {
          fxs.push({ kind: 'stars', x: e.x, y: e.y - 0.2, t0: now, dur: 1, colour: '#f8e048', radius: 1 });
          fxs.push({ kind: 'text', x: e.x, y: e.y - 1, text: 'Gotcha!', size: 0.38, t0: now, dur: 1.4, colour: '#f8e048' });
        } else {
          fxs.push({ kind: 'flash', x: e.x, y: e.y - 0.3, t0: now, dur: 0.3, colour: '#f8f8f8', radius: 0.6 });
        }
        break;
      case 'powerup':
        if (e.key === 'tm-electric') fxs.push({ kind: 'bolt', x: e.x, y: e.y, t0: now, dur: 0.35, colour: '#f8e048' });
        else if (e.key === 'tm-ground') fxs.push({ kind: 'ring', x: COLS / 2, y: ROWS / 2, radius: 9, t0: now, dur: 0.7, colour: '#e0c068' });
        else fxs.push({ kind: 'text', x: COLS / 2, y: ROWS / 2, text: POWERUPS[e.key].name, size: 0.5, t0: now, dur: 1.1, colour: '#ffffff' });
        break;
      case 'drop':
      case 'pickup':
        if (e.kind === 'pickup') fxs.push({ kind: 'stars', x: e.x, y: e.y, t0: now, dur: 0.5, colour: '#b8f8ff', radius: 0.6 });
        break;
      default:
        break;
    }
  }
  // Keep the list from growing without bound in a busy late wave.
  if (fxs.length > 400) fxs.splice(0, fxs.length - 400);
  if (fainting.length > 60) fainting.splice(0, fainting.length - 60);
  void g;
}

/** Sprite pixels to tiles: a typical Black/White sprite is ~48 px for a one-tile Pokémon. */
const SPRITE_TILE = 1 / 46;

function spriteScale(dex: number, shiny: boolean, base: number, maxTiles: number): number {
  const size = sheetSize(dex, shiny);
  if (!size) return base;
  return Math.min(base, maxTiles / size.h, (maxTiles * 1.2) / size.w);
}

function enemyScale(e: Enemy): number {
  const base = SPRITE_TILE * (e.boss ? 1.45 : e.lead ? 1.15 : 0.85);
  return spriteScale(e.dex, e.shiny, base, e.boss ? 2.3 : 1.5);
}

function towerScale(t: Tower): number {
  return spriteScale(t.stats.dex, false, SPRITE_TILE * (0.95 + 0.08 * t.stats.stage), 1.8);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function statusTag(g: Game, e: Enemy): { label: string; colour: string } | null {
  const s = e.status;
  if (s.sleepUntil > g.t) return { label: 'SLP', colour: '#8890a8' };
  if (s.paraUntil > g.t) return { label: 'PAR', colour: '#d8b820' };
  if (s.confuseUntil > g.t) return { label: 'CNF', colour: '#d858a8' };
  if (s.burnUntil > g.t) return { label: 'BRN', colour: '#e05828' };
  if (s.poisonUntil > g.t) return { label: 'PSN', colour: '#a040a0' };
  if (s.slowUntil > g.t) return { label: 'SLW', colour: '#58a8d8' };
  return null;
}

function drawRange(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, T: number, ok: boolean): void {
  ctx.save();
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.16)' : 'rgba(255,80,80,0.18)';
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,90,90,0.8)';
  ctx.lineWidth = Math.max(1, T / 20);
  ctx.setLineDash([T / 6, T / 8]);
  ctx.beginPath();
  ctx.arc(x * T, y * T, r * T, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTower(ctx: CanvasRenderingContext2D, g: Game, t: Tower, T: number, time: number, now: number, selected: boolean): void {
  const cx = (t.x + 0.5) * T;
  const by = (t.y + 0.86) * T;
  ellipse(ctx, cx, by, T * 0.36, T * 0.13, selected ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.28)');
  const scale = towerScale(t) * T;
  // A little hop when it attacks.
  const since = g.t - t.lastShot;
  const hop = since >= 0 && since < 0.15 ? Math.sin((since / 0.15) * Math.PI) * T * 0.06 : 0;
  const glowUntil = evolving.get(t.id);
  const stunned = t.stunnedUntil > g.t;
  const opts = { time: time * 1000, flip: t.facing > 0, phase: t.id * 137, frozen: stunned };
  if (glowUntil && glowUntil > now) {
    // Evolution: the old shape and the new flicker in white, faster and faster.
    const left = glowUntil - now;
    const pulse = Math.sin((1.4 - left) ** 2 * 30) > 0;
    drawPokemonTinted(ctx, t.stats.dex, cx, by - hop, scale * (pulse ? 1 : 0.8), '#ffffff', opts);
  } else {
    drawPokemon(ctx, t.stats.dex, cx, by - hop, scale, opts);
  }
  // Level pips.
  const pips = t.level;
  const pw = T * 0.09;
  for (let i = 0; i < pips; i += 1) {
    const px = cx + (i - (pips - 1) / 2) * pw * 1.3;
    ctx.fillStyle = t.move !== null ? '#b8f8ff' : '#f8d848';
    ctx.fillRect(Math.round(px - pw / 2), Math.round(by + T * 0.06), Math.round(pw), Math.round(pw));
  }
  if (stunned) {
    ctx.fillStyle = '#f8e048';
    ctx.font = `bold ${Math.round(T * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', cx + T * 0.3, by - T * 0.8);
  }
  const held = g.held[t.line.id];
  if (held) drawIcon(ctx, held, cx + T * 0.34, by - T * 0.12, T * 0.34);
}

function drawEnemy(ctx: CanvasRenderingContext2D, g: Game, e: Enemy, T: number, time: number): void {
  const flying = e.sp.traits.includes('flying');
  const bob = flying ? Math.sin(time * 5 + e.id) * T * 0.05 - T * 0.22 : 0;
  const cx = e.x * T;
  const by = (e.y + 0.3) * T;
  const hidden = !e.revealed;
  const ghostly = e.sp.traits.includes('invisible') || e.status.vanishUntil > g.t;

  if (e.catching) {
    // The ball sits where it was, rocking with each shake.
    const c = e.catching;
    const since = g.t - c.started;
    const shakePhase = since > 0.6 ? ((since - 0.6) % 0.6) / 0.6 : 0;
    const rock = since > 0.6 && Math.floor((since - 0.6) / 0.6) < c.shakes ? Math.sin(shakePhase * Math.PI * 2) * 0.35 : 0;
    ctx.save();
    ctx.translate(cx, by - T * 0.2);
    ctx.rotate(rock);
    drawIcon(ctx, c.ball, 0, 0, T * 0.6);
    ctx.restore();
    return;
  }

  ellipse(ctx, cx, by, T * (e.boss ? 0.5 : 0.28), T * (e.boss ? 0.16 : 0.1), hidden ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.25)');
  const scale = enemyScale(e) * T;
  const opts = {
    time: time * 1000,
    shiny: e.shiny,
    flip: e.facing > 0,
    phase: e.id * 97,
    alpha: hidden ? 0.12 : ghostly ? 0.6 : 1,
    frozen: e.status.sleepUntil > g.t || e.status.flinchUntil > g.t,
  };
  if (e.flash > 0) drawPokemonTinted(ctx, e.dex, cx, by + bob, scale, 'rgba(255,90,90,0.75)', opts);
  else if (e.status.shieldUntil > g.t) drawPokemonTinted(ctx, e.dex, cx, by + bob, scale, 'rgba(140,220,255,0.5)', opts);
  else drawPokemon(ctx, e.dex, cx, by + bob, scale, opts);

  if (hidden) return;
  const size = sheetSize(e.dex, e.shiny);
  const top = by + bob - (size ? size.h * scale : T * 0.8) - T * 0.08;
  if (e.shiny && Math.floor(time * 3 + e.id) % 2 === 0) {
    ctx.fillStyle = '#f8f8a8';
    ctx.font = `${Math.round(T * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✦', cx + T * 0.35, top + T * 0.2);
  }
  if (e.hp < e.maxHp || e.boss || e.lead) {
    const w = T * (e.boss ? 1.2 : 0.7);
    const h = Math.max(3, T * (e.boss ? 0.1 : 0.07));
    const f = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(Math.round(cx - w / 2 - 1), Math.round(top - 1), Math.round(w + 2), Math.round(h + 2));
    ctx.fillStyle = f > 0.5 ? '#58d858' : f > 0.2 ? '#f8c828' : '#f84838';
    ctx.fillRect(Math.round(cx - w / 2), Math.round(top), Math.round(w * f), Math.round(h));
  }
  const tag = statusTag(g, e);
  if (tag) {
    const fs = Math.round(T * 0.2);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    const tw = ctx.measureText(tag.label).width + fs * 0.5;
    ctx.fillStyle = tag.colour;
    ctx.fillRect(Math.round(cx - tw / 2), Math.round(top - fs * 1.35), Math.round(tw), Math.round(fs * 1.15));
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag.label, cx, top - fs * 0.78);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, T: number, now: number): void {
  const p = (now - fx.t0) / fx.dur;
  if (p < 0 || p > 1) return;
  ctx.save();
  switch (fx.kind) {
    case 'beam': {
      const end = fx.points![0]!;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = fx.colour;
      ctx.lineCap = 'round';
      ctx.lineWidth = T * 0.28 * (1 - p * 0.5);
      ctx.beginPath();
      ctx.moveTo(fx.x * T, fx.y * T);
      ctx.lineTo(end.x * T, end.y * T);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = T * 0.09;
      ctx.stroke();
      break;
    }
    case 'chain': {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = fx.colour;
      ctx.lineWidth = T * 0.08;
      ctx.lineJoin = 'bevel';
      ctx.beginPath();
      let from = { x: fx.x, y: fx.y };
      ctx.moveTo(from.x * T, from.y * T);
      for (const to of fx.points!) {
        const tgt = { x: to.x, y: to.y - 0.3 };
        for (let k = 1; k <= 4; k += 1) {
          const f = k / 4;
          const jitter = k < 4 ? (Math.sin(now * 90 + k * 7 + to.x * 13) * 0.18) : 0;
          ctx.lineTo((from.x + (tgt.x - from.x) * f + jitter) * T, (from.y + (tgt.y - from.y) * f - jitter) * T);
        }
        from = tgt;
      }
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = T * 0.03;
      ctx.stroke();
      break;
    }
    case 'ring':
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = fx.colour;
      ctx.lineWidth = T * 0.12 * (1 - p);
      ctx.beginPath();
      ctx.arc(fx.x * T, fx.y * T, Math.max(1, fx.radius! * T * (0.3 + 0.7 * p)), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'burst': {
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.fillStyle = fx.colour;
      ctx.beginPath();
      ctx.arc(fx.x * T, fx.y * T, Math.max(1, fx.radius! * T * (0.4 + 0.6 * p)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = fx.radius! * T * p;
        ctx.fillRect(Math.round(fx.x * T + Math.cos(a) * r), Math.round(fx.y * T + Math.sin(a) * r), Math.ceil(T / 12), Math.ceil(T / 12));
      }
      break;
    }
    case 'poof':
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = fx.colour;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = T * (0.15 + 0.4 * p);
        ctx.beginPath();
        ctx.arc(fx.x * T + Math.cos(a) * r, fx.y * T + Math.sin(a) * r * 0.7, T * 0.14 * (1 - p * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'stars':
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = fx.colour;
      ctx.font = `${Math.round(T * 0.32)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2 + p * 2;
        const r = fx.radius! * T * (0.2 + 0.8 * p);
        ctx.fillText('✦', fx.x * T + Math.cos(a) * r, fx.y * T + Math.sin(a) * r);
      }
      break;
    case 'text': {
      const size = Math.round(T * fx.size!);
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, size / 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      const y = (fx.y - p * 0.5) * T;
      ctx.strokeText(fx.text!, fx.x * T, y);
      ctx.fillStyle = fx.colour;
      ctx.fillText(fx.text!, fx.x * T, y);
      break;
    }
    case 'flash':
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = fx.colour;
      ctx.beginPath();
      ctx.arc(fx.x * T, fx.y * T, fx.radius! * T * (0.5 + p), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bolt': {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = fx.colour;
      ctx.lineWidth = T * 0.2;
      ctx.beginPath();
      ctx.moveTo(fx.x * T, 0);
      const steps = 8;
      for (let i = 1; i <= steps; i += 1) {
        const f = i / steps;
        ctx.lineTo((fx.x + (i < steps ? Math.sin(i * 12.9 + fx.t0 * 50) * 0.4 : 0)) * T, fx.y * T * f);
      }
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = T * 0.07;
      ctx.stroke();
      ctx.fillStyle = 'rgba(248,224,72,0.35)';
      ctx.beginPath();
      ctx.arc(fx.x * T, fx.y * T, 1.6 * T * (0.5 + p / 2), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'throw': {
      // An arc up from the bottom of the map into the target.
      const sx = COLS / 2;
      const sy = ROWS;
      const x = sx + (fx.x - sx) * p;
      const y = sy + (fx.y - sy) * p - Math.sin(p * Math.PI) * 3;
      ctx.translate(x * T, y * T);
      ctx.rotate(p * 12);
      drawIcon(ctx, fx.text!, 0, 0, T * 0.55);
      break;
    }
  }
  ctx.restore();
}

export function drawBattle(ctx: CanvasRenderingContext2D, g: Game, view: View, overlay: Overlay, now: number): void {
  const T = view.tile;
  const W = COLS * T;
  const H = ROWS * T;
  if (!groundCache || groundCache.id !== g.map.id) groundCache = { id: g.map.id, canvas: renderGround(g.map) };
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(groundCache.canvas, 0, 0, COLS * TILE_PX, ROWS * TILE_PX, 0, 0, W, H);

  // Where the path comes in and goes out.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (const p of g.paths) {
    const end = p.points[p.points.length - 1]!;
    if (end.x > 0 && end.y > 0 && end.x < COLS && end.y < ROWS) {
      ctx.font = `${Math.round(T * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🏁', end.x * T, (end.y + 0.25) * T);
    }
  }
  ctx.restore();

  if (overlay.placeable) {
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (const key of overlay.placeable) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
    }
  }

  const selected = overlay.selected !== null ? g.towers.find((t) => t.id === overlay.selected) : undefined;
  if (selected) drawRange(ctx, selected.x + 0.5, selected.y + 0.5, selected.stats.range, T, true);
  if (overlay.ghost) drawRange(ctx, overlay.ghost.x + 0.5, overlay.ghost.y + 0.5, overlay.ghost.stats.range, T, overlay.ghost.ok);

  // Drops, pulsing so they're noticed.
  for (const d of g.drops) {
    const left = d.until - g.t;
    if (left < 2 && Math.floor(left * 8) % 2 === 0) continue;
    const s = T * (0.5 + Math.sin(now * 6) * 0.05);
    ellipse(ctx, d.x * T, (d.y + 0.25) * T, T * 0.25, T * 0.08, 'rgba(0,0,0,0.3)');
    drawIcon(ctx, d.item, d.x * T, (d.y - 0.05 + Math.sin(now * 4) * 0.05) * T, s);
  }

  // Everything standing up, back to front.
  const things: { y: number; draw: () => void }[] = [];
  const time = now;
  for (const t of g.towers) things.push({ y: t.y + 0.86, draw: () => drawTower(ctx, g, t, T, time, now, t === selected) });
  for (const e of g.enemies) if (e.alive) things.push({ y: e.y + 0.3, draw: () => drawEnemy(ctx, g, e, T, time) });
  for (const f of fainting) {
    const p = (now - f.t0) / 0.45;
    if (p > 1) continue;
    things.push({
      y: f.y + 0.3,
      draw: () => drawPokemonTinted(ctx, f.dex, f.x * T, (f.y + 0.3) * T + p * T * 0.3, f.scale * T * (1 - p * 0.3), 'rgba(255,255,255,0.6)', { time: 0, flip: f.flip, shiny: f.shiny, alpha: 1 - p, frozen: true }),
    });
  }
  if (overlay.ghost) {
    const gh = overlay.ghost;
    things.push({
      y: gh.y + 0.86,
      draw: () => drawPokemon(ctx, gh.dex, (gh.x + 0.5) * T, (gh.y + 0.86) * T, spriteScale(gh.dex, false, SPRITE_TILE * 0.95, 1.8) * T, { time: now * 1000, alpha: gh.ok ? 0.75 : 0.35 }),
    });
  }
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.draw();
  for (let i = fainting.length - 1; i >= 0; i -= 1) if (now - fainting[i]!.t0 > 0.45) fainting.splice(i, 1);

  for (const p of g.projectiles) {
    const c = TYPE_COLOURS[p.type];
    const r = T * (p.splash ? 0.16 : 0.11);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(p.x * T, p.y * T, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(p.x * T - r * 0.3, p.y * T - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = fxs.length - 1; i >= 0; i -= 1) {
    const fx = fxs[i]!;
    if (now - fx.t0 > fx.dur) fxs.splice(i, 1);
  }
  for (const fx of fxs) drawFx(ctx, fx, T, now);

  if (g.map.weather) drawWeather(ctx, g.map.weather, W, H, T, now);

  if (g.buffs.repel > g.t || g.buffs.scope > g.t) {
    ctx.fillStyle = g.buffs.scope > g.t ? 'rgba(160,120,255,0.08)' : 'rgba(120,200,255,0.08)';
    ctx.fillRect(0, 0, W, H);
  }

  if (overlay.chances) {
    ctx.save();
    ctx.font = `800 ${Math.round(T * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(2, T / 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const e of g.enemies) {
      const c = overlay.chances.get(e.id);
      if (c === undefined) continue;
      const pct = `${Math.round(c * 100)}%`;
      const y = (e.y - 0.75) * T;
      ctx.strokeText(pct, e.x * T, y);
      ctx.fillStyle = c >= 0.5 ? '#78f878' : c >= 0.2 ? '#f8d848' : '#f87878';
      ctx.fillText(pct, e.x * T, y);
    }
    ctx.restore();
  }

  if (overlay.aiming && overlay.pointer) {
    const { x, y } = overlay.pointer;
    ctx.save();
    ctx.strokeStyle = overlay.aiming === 'ball' ? '#f85858' : '#f8e048';
    ctx.lineWidth = Math.max(2, T / 14);
    ctx.beginPath();
    ctx.arc(x * T, y * T, T * (overlay.aiming === 'spot' ? 1.6 : 0.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Hoenn weather over the whole map. Deterministic per time, so no state to keep. */
function drawWeather(ctx: CanvasRenderingContext2D, weather: Weather, W: number, H: number, T: number, now: number): void {
  ctx.save();
  const hash = (i: number, k: number): number => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  if (weather === 'rain') {
    ctx.fillStyle = 'rgba(40,70,120,0.12)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(190,215,255,0.55)';
    ctx.lineWidth = Math.max(1, T / 24);
    ctx.beginPath();
    for (let i = 0; i < 70; i += 1) {
      const speed = 1.6 + hash(i, 1);
      const x = (hash(i, 2) * W + now * T * 1.5) % W;
      const y = ((hash(i, 3) + now * speed) % 1) * (H + T) - T / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x - T * 0.12, y + T * 0.45);
    }
    ctx.stroke();
  } else if (weather === 'sun') {
    const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, H * 0.9);
    glow.addColorStop(0, 'rgba(255,230,140,0.35)');
    glow.addColorStop(1, 'rgba(255,160,60,0.05)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } else if (weather === 'sand') {
    ctx.fillStyle = 'rgba(200,170,100,0.16)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(235,205,140,0.7)';
    const s = Math.max(2, T / 12);
    for (let i = 0; i < 90; i += 1) {
      const x = ((hash(i, 4) + now * (0.25 + hash(i, 5) * 0.3)) % 1) * W;
      const y = (hash(i, 6) * H + Math.sin(now * 2 + i) * T * 0.3 + H) % H;
      ctx.fillRect(Math.round(x), Math.round(y), s * 2, s);
    }
  } else if (weather === 'hail') {
    ctx.fillStyle = 'rgba(200,230,255,0.12)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const s = Math.max(2, T / 10);
    for (let i = 0; i < 60; i += 1) {
      const x = (hash(i, 7) * W + Math.sin(now + i) * T * 0.2 + W) % W;
      const y = ((hash(i, 8) + now * (0.5 + hash(i, 9) * 0.4)) % 1) * H;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
  }
  ctx.restore();
}

/** Snapshot of enemies by id, so fainting ones can still be drawn after the game drops them. */
export function snapshotEnemies(g: Game): Map<number, Enemy> {
  return new Map(g.enemies.map((e) => [e.id, e]));
}
