// Level-up announcement, after the desktop's: skill icon, "Level Up!", the new level, any new milestones, and a bar
// that runs down for 3 seconds before it dismisses itself. A confetti burst plays behind it. Tap to dismiss early.
import { useEffect, useRef, useState } from 'preact/hooks';
import { milestonesBetween, type Game } from '../engine/game';
import { LEVEL_CAP } from '../engine/xp';
import { SkillBadge } from './common';

const PREF_KEY = 'melvor2-pocket-levelup';
const SHOW_MS = 3000;

export function levelUpPopupsOn(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setLevelUpPopups(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode etc.: the choice just won't persist.
  }
}

interface Announcement { key: number; skill: string; from: number; to: number }

export function LevelUpPopups({ game }: { game: Game }) {
  const [queue, setQueue] = useState<Announcement[]>([]);
  useEffect(() => {
    let key = 0;
    const on = (e: Parameters<Parameters<typeof game.events.add>[0]>[0]) => {
      if (e.type !== 'levelUp' || !levelUpPopupsOn()) return;
      setQueue((q) => {
        // Another level in the skill already waiting: fold it in rather than stacking popups.
        const i = q.findIndex((a) => a.skill === e.skill);
        if (i >= 0) return q.map((a, j) => (j === i ? { ...a, to: e.to } : a));
        return [...q, { key: ++key, skill: e.skill, from: e.from, to: e.to }];
      });
    };
    game.events.add(on);
    return () => game.events.delete(on);
  }, [game]);
  const current = queue[0];
  if (!current) return null;
  return <Popup key={current.key} a={current} onDone={() => setQueue((q) => q.slice(1))} />;
}

function Popup({ a, onDone }: { a: Announcement; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Restart the countdown when a further level is folded into this popup.
  useEffect(() => {
    const t = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(t);
  }, [a.to]);
  useEffect(() => confetti(canvas.current), [a.to]);
  const max = a.to >= LEVEL_CAP;
  const milestones = milestonesBetween(a.skill, a.from, a.to);
  return (
    <div class="levelup-layer" onClick={onDone}>
      <canvas ref={canvas} class="levelup-confetti" />
      <div class="levelup" role="status">
        <div class="levelup-icon">
          <SkillBadge skill={a.skill} size={64} />
        </div>
        <h2>{max ? 'Max Level!' : 'Level Up!'}</h2>
        <p>
          Your <b>{a.skill}</b> is now <b class="levelup-level">Level {a.to}</b>
        </p>
        {milestones > 0 && (
          <div class="levelup-milestones">
            {milestones} new {milestones === 1 ? 'Milestone' : 'Milestones'}!
          </div>
        )}
        <div class="levelup-timer" key={a.to} style={{ animationDuration: `${SHOW_MS}ms` }} />
      </div>
    </div>
  );
}

const COLOURS = ['#e8b84a', '#5fbf6a', '#4aa3e8', '#e85a8a', '#b07ae8', '#ffffff'];

/** Two bursts from either side of the popup that fall under gravity. Returns a cleanup. */
function confetti(el: HTMLCanvasElement | null): (() => void) | void {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  const dpr = devicePixelRatio || 1;
  const w = el.clientWidth;
  const h = el.clientHeight;
  el.width = w * dpr;
  el.height = h * dpr;
  ctx.scale(dpr, dpr);
  const bits = Array.from({ length: 140 }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = 7 + Math.random() * 7;
    return {
      x: left ? w * 0.2 : w * 0.8,
      y: h * 0.38,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.4,
      colour: COLOURS[i % COLOURS.length],
    };
  });
  // Physics in 60 Hz steps scaled by real elapsed time, so it plays the same on 60 and 120 Hz screens.
  const LIFE_MS = 2500;
  const start = performance.now();
  let last = start;
  let raf = 0;
  const step = (now: number) => {
    const k = Math.min(4, (now - last) / (1000 / 60));
    last = now;
    const age = now - start;
    ctx.clearRect(0, 0, w, h);
    for (const b of bits) {
      b.vy += 0.25 * k;
      b.vx *= Math.pow(0.985, k);
      b.x += b.vx * k;
      b.y += b.vy * k;
      b.spin += b.vspin * k;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / LIFE_MS);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = b.colour;
      // Flutter: squash the piece as it turns.
      ctx.fillRect(-b.size / 2, (-b.size / 2) * Math.abs(Math.cos(b.spin)), b.size, b.size * Math.abs(Math.cos(b.spin)) * 0.6);
      ctx.restore();
    }
    if (age < LIFE_MS) raf = requestAnimationFrame(step);
    else ctx.clearRect(0, 0, w, h);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
