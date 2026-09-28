/**
 * What the player hears for what happens in a battle: a synth sound per
 * attack type, cries when Pokémon arrive, evolve, get caught or faint, and
 * little jingles for waves, levels and items. Throttled, so a busy late wave
 * is lively rather than a wall of noise.
 */
import type { Game, GameEvent } from '../game/game';
import { cry, sfx } from './index';

let haptics = true;
export function setHaptics(on: boolean): void {
  haptics = on;
}
export function buzz(ms: number | number[]): void {
  if (haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // Not allowed here; never mind.
    }
  }
}

const lastByKey = new Map<string, number>();
/** Play `fn` unless the same kind of sound played in the last `gap` seconds. */
function throttled(key: string, gap: number, now: number, fn: () => void): void {
  if ((lastByKey.get(key) ?? -1) + gap > now) return;
  lastByKey.set(key, now);
  fn();
}

function playCry(dex: number, now: number, opts: { rate?: number; volume?: number; gap?: number } = {}): void {
  throttled('cry', opts.gap ?? 0.25, now, () => {
    cry(dex, { rate: opts.rate ?? 1, volume: opts.volume ?? 0.5 });
  });
}

let attacksThisSecond = 0;
let secondStart = 0;

export function playEvents(g: Game, events: readonly GameEvent[], now: number): void {
  for (const e of events) {
    switch (e.kind) {
      case 'attack': {
        if (now - secondStart > 1) {
          secondStart = now;
          attacksThisSecond = 0;
        }
        if (attacksThisSecond > 14) break;
        attacksThisSecond += 1;
        throttled(`atk-${e.type}`, 0.07, now, () => sfx[e.type]());
        break;
      }
      case 'splash':
        if (e.type === 'electric' && e.radius >= 1.5) sfx.thunder();
        break;
      case 'hit':
        if (e.eff >= 2 || e.crit) throttled('super', 0.12, now, sfx.superEffective);
        break;
      case 'faint':
        if (e.boss) {
          sfx.bossFaint();
          cry(e.dex, { rate: 0.7, volume: 0.7 });
          buzz([40, 40, 80]);
        } else {
          throttled('faint', 0.09, now, sfx.faint);
          playCry(e.dex, now, { rate: 0.8, volume: 0.25, gap: 0.6 });
        }
        break;
      case 'spawn':
        if (e.boss) {
          cry(e.dex, { volume: 0.8 });
          buzz(120);
        } else if (e.shiny) {
          sfx.shiny();
          playCry(e.dex, now, { volume: 0.4 });
        } else if (e.rare) {
          playCry(e.dex, now, { volume: 0.4, gap: 0.1 });
        }
        break;
      case 'evolveEnemy':
        playCry(e.dex, now, { volume: 0.35 });
        break;
      case 'mega':
        sfx.evolve();
        setTimeout(() => cry(e.dex, { volume: 0.8 }), 900);
        buzz([30, 40, 30, 40, 120]);
        break;
      case 'leak':
        throttled('leak', 0.2, now, sfx.leak);
        buzz(e.lives > 1 ? [60, 40, 60] : 50);
        break;
      case 'waveStart':
        if (e.boss) sfx.bossStart();
        else sfx.waveStart();
        break;
      case 'waveClear':
        sfx.waveClear();
        break;
      case 'place':
        sfx.place();
        cry(e.dex, { volume: 0.45 });
        break;
      case 'sell':
        sfx.sell();
        break;
      case 'level':
        if (e.evolved) {
          sfx.evolve();
          setTimeout(() => cry(e.dex, { volume: 0.6 }), 1450);
          buzz([30, 60, 30, 60, 80]);
        } else sfx.levelUp();
        break;
      case 'move':
        sfx.move();
        break;
      case 'money':
        throttled('coin', 0.15, now, sfx.coin);
        break;
      case 'throw':
        sfx.throw();
        break;
      case 'shake':
        sfx.shake();
        buzz(20);
        break;
      case 'catch':
        if (e.success) {
          sfx.caught();
          setTimeout(() => cry(e.dex, { volume: 0.6 }), 700);
          buzz([50, 50, 50, 50, 120]);
        } else sfx.breakFree();
        break;
      case 'powerup':
        if (e.key === 'tm-electric') sfx.thunder();
        else if (e.key === 'tm-ground') sfx.quake();
        else sfx.powerup();
        break;
      case 'stunTowers':
        throttled('stun', 0.2, now, sfx.stun);
        break;
      case 'ability':
        if (e.ability === 'teleport') throttled('tele', 0.2, now, sfx.teleport);
        break;
      case 'pickup':
        sfx.pickup();
        break;
      case 'won':
        sfx.win();
        break;
      case 'lost':
        sfx.lose();
        break;
      default:
        break;
    }
  }
  void g;
}
