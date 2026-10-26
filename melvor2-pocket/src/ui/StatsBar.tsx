// Bottom stats bar, after the demo's action tracker: current action, level, time to a target level, and per-hour
// rates (XP, gold value, items gained or used, and how long ingredients last). Tap to expand.
import { useState } from 'preact/hooks';
import { itemName } from '../engine/content';
import type { Game } from '../engine/game';
import { LEVEL_CAP, xpForLevel } from '../engine/xp';
import { Bar, Icon, SkillBadge, duration, fmt } from './common';

const WINDOWS: [string, number][] = [
  ['1 min', 60 * 60],
  ['10 min', 10 * 60 * 60],
  ['1 hour', 60 * 60 * 60],
];

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;

export function StatsBar({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const [win, setWin] = useState(1);
  const [target, setTarget] = useState<number | null>(null);
  const a = game.state.active;
  if (!a) return null;
  const t = game.tracker;
  t.sync(`${a.skill}|${a.recipe}`, game.state.tick);
  const r = t.rates(game.state.tick, WINDOWS[win][1]);
  // The XP shown is the action's own skill, or the most-gained one (combat splits XP between skills).
  const xpSkill = a.skill in r.xp ? a.skill : Object.entries(r.xp).sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.skill;
  const level = game.level(xpSkill);
  const goal = Math.min(LEVEL_CAP, Math.max(level + 1, target ?? level + 1));
  const xpPerHour = r.xp[xpSkill] ?? 0;
  const needed = Math.max(0, xpForLevel(goal) - game.xp(xpSkill));
  const timeLeft = level >= LEVEL_CAP ? 'max level' : xpPerHour > 0 ? duration((needed / xpPerHour) * 3600_000) : '—';
  const recipeName = game.handler(a.skill).recipe(a.recipe).DisplayName;
  const items = Object.entries(r.items).filter(([, v]) => Math.abs(v) >= 0.01).sort((x, y) => y[1] - x[1]);
  const depleting = items.filter(([, v]) => v < 0).map(([id, v]) => ({ id, left: game.count(id) / -v }));
  const soonest = depleting.sort((x, y) => x.left - y.left)[0];
  const warming = r.spanTicks < 60 * 10;

  return (
    <div class={`statsbar ${open ? 'open' : ''}`}>
      <button class="statsbar-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span class="sb-skill">
          <SkillBadge skill={a.skill} size={18} /> {recipeName}
        </span>
        <span>Lv {level}</span>
        <span>{warming ? '…' : `${fmt(xpPerHour)} xp/h`}</span>
        <span class="sb-gold">{warming ? '' : `${signed(r.value)} gp/h`}</span>
        <span class="sb-caret">{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <div class="statsbar-detail">
          <div class="chips">
            {WINDOWS.map(([label], i) => (
              <button class={i === win ? 'on' : ''} onClick={() => setWin(i)}>
                {label}
              </button>
            ))}
          </div>
          <div class="sb-line">
            <span class="grow">
              {xpSkill} level {level} → {goal}: <strong>{timeLeft}</strong> left
            </span>
            <button class="step" onClick={() => setTarget(Math.max(level + 1, goal - 1))} aria-label="Lower target level">
              −
            </button>
            <button class="step" onClick={() => setTarget(Math.min(LEVEL_CAP, goal + 1))} aria-label="Raise target level">
              +
            </button>
          </div>
          <Bar value={game.xp(xpSkill) - xpForLevel(level)} max={Math.max(1, xpForLevel(Math.min(LEVEL_CAP, level + 1)) - xpForLevel(level))} />
          <div class="sb-grid">
            {Object.entries(r.xp).map(([skill, v]) => (
              <span>
                <SkillBadge skill={skill} size={14} /> {fmt(v)} {skill} xp/h
              </span>
            ))}
            <span>{signed(r.gold)} gold/h</span>
            <span>💰 {signed(r.value)} value/h</span>
          </div>
          <div class="sb-items">
            {items.map(([id, v]) => (
              <span class={v < 0 ? 'neg' : 'pos'}>
                <Icon id={id} size={18} /> {signed(v)}/h <span class="muted">{itemName(id, 2)}</span>
              </span>
            ))}
            {!items.length && <span class="muted">No items yet in this window.</span>}
          </div>
          {soonest && (
            <div class="sb-line warn">
              {duration(soonest.left * 3600_000)} until {itemName(soonest.id, 2)} run out
            </div>
          )}
          <div class="muted small">Rates over the last {duration((r.spanTicks / 60) * 1000)} of this action.</div>
        </div>
      )}
    </div>
  );
}
