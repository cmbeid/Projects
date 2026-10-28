// Small shared UI pieces.
import { useState } from 'preact/hooks';
import { itemIcon, skillGlyph, skillIconUrl } from '../art/icons';
import { assetUrl } from '../art/assets';

export const fmt = (n: number) => Math.floor(n).toLocaleString();

export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Simulation ticks (60 per second) to a duration string. */
export const ticksToDuration = (ticks: number) => duration((ticks / 60) * 1000);

export function Icon({ id, size = 40 }: { id: string; size?: number }) {
  return <img class="icon" src={itemIcon(id)} width={size} height={size} alt="" />;
}

export function SkillBadge({ skill, size = 36 }: { skill: string; size?: number }) {
  const real = skillIconUrl(skill);
  if (real) return <img class="badge-img" src={real} width={size} height={size} alt="" />;
  const { glyph, color } = skillGlyph(skill);
  return (
    <span class="badge" style={{ background: color, width: size, height: size, fontSize: size * 0.5 }}>
      {glyph}
    </span>
  );
}

export function Bar({ value, max = 1, color }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div class="bar">
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * A timer bar (attack or action progress) that fills smoothly on its own: a CSS animation over the whole cycle,
 * started part-way through, so it doesn't wait for the screen to redraw. A new cycle (`cycle`: the tick it ends on)
 * restarts it.
 */
export function TimerBar({ elapsed, total, cycle, paused, color }: { elapsed: number; total: number; cycle: number | string; paused?: boolean; color?: string }) {
  return (
    <div class="bar">
      <TimerFill key={cycle} elapsed={elapsed} total={total} paused={paused} color={color} />
    </div>
  );
}

/** One cycle's fill. Its start offset is fixed when it mounts: changing it on a running animation would skip ahead. */
function TimerFill({ elapsed, total, paused, color }: { elapsed: number; total: number; paused?: boolean; color?: string }) {
  const [start] = useState(() => ({ elapsed, total }));
  return (
    <div
      class="timer-fill"
      style={{
        background: color,
        animationDuration: `${Math.max(1, start.total) * (1000 / 60)}ms`,
        animationDelay: `${-Math.max(0, Math.min(start.elapsed, start.total)) * (1000 / 60)}ms`,
        animationPlayState: paused ? 'paused' : 'running',
      }}
    />
  );
}

export interface BarMarker { at: number; kind: 'eat' | 'hit'; label: string; icon?: preact.ComponentChildren }

/**
 * A health bar with the desktop's markers: where auto-eat kicks in, and the opponent's max hit (below it, one hit could
 * finish you). Markers outside the bar are left off.
 */
export function HpBar({ value, max, color, markers }: { value: number; max: number; color: string; markers: BarMarker[] }) {
  return (
    <div class="hpbar">
      <Bar value={value} max={max} color={color} />
      {markers
        .filter((m) => m.at > 0 && m.at < max)
        .map((m) => (
          <span class={`hp-mark ${m.kind}`} style={{ left: `${(m.at / max) * 100}%` }} title={m.label} aria-label={m.label}>
            <span class="hp-mark-icon">{m.icon ?? (m.kind === 'eat' ? '🍴' : '⚔')}</span>
          </span>
        ))}
    </div>
  );
}

/** Ingredient list with have/need counts, red when short. */
export function Costs({ items, gold, have }: { items: { Item: string; Quantity: number }[]; gold?: number; have: (id: string) => number }) {
  return (
    <div class="ingredients">
      {gold ? (
        <span>
          <Icon id="MelvorBase:GoldPieces" size={18} />
          {fmt(gold)}
        </span>
      ) : null}
      {items.map((i) => (
        <span class={have(i.Item) < i.Quantity ? 'short' : ''}>
          <Icon id={i.Item} size={18} />
          {fmt(have(i.Item))}/{fmt(i.Quantity)}
        </span>
      ))}
    </div>
  );
}

/** The game's art for a res:// path when the asset pack has it, otherwise an item icon. */
export function Art({ path, fallbackItem, size = 44 }: { path?: string; fallbackItem: string; size?: number }) {
  const url = assetUrl(path);
  return url ? <img class="icon art" src={url} width={size} height={size} alt="" /> : <Icon id={fallbackItem} size={size} />;
}
