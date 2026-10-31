// The desktop's combat stats panels (PlayerStatsPanel / PlayerEnemyStatsPanel): offence, matchups, evasion and
// defence for you and the enemy, plus every combat stat ("View all stats"). Values come from the engine's own formulas.
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { NS, all, tryGet } from '../engine/content';
import type { Game } from '../engine/game';
import { type AttackStance, enemy as enemyData } from '../engine/combat/data';
import { darkness as playerDarkness, elementalBonuses, enemyFighter, liveEnemyFighter, playerElement, playerFighter, triangle } from '../engine/combat/combat';
import {
  type Fighter, accuracyRating, armour, attackInterval, combatLevel, evasionRating, hitChance, maxHit, minHit, powerRating, protectionRating, resistance,
} from '../engine/combat/stats';
import { describeBonus } from '../engine/describe';
import { fmt } from './common';

interface CombatStat { Id: string; DisplayName: string; Category: string; IsPercent: boolean }

const elementName = (id?: string) => (id ? tryGet<{ DisplayName: string }>('Element', id)?.DisplayName ?? id.replace(NS, '') : 'None');
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const seconds = (f: Fighter) => `${(attackInterval(f) / 1000).toFixed(2)}s`;

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <>
      <h3>{title}</h3>
      <dl class="stats">{children}</dl>
    </>
  );
}

const Row = ({ k, v }: { k: string; v: ComponentChildren }) => (
  <>
    <dt>{k}</dt>
    <dd>{v}</dd>
  </>
);

interface SideProps {
  f: Fighter;
  foe?: Fighter;
  element?: string;
  foeElement?: string;
  /** Darkness on this fighter (only ever the player) and on its foe. */
  darkness: number;
  foeDarkness: number;
  matchup: string[];
  showAll: boolean;
}

function FighterStats({ f, foe, element, foeElement, darkness, foeDarkness, matchup, showAll }: SideProps) {
  const acc = accuracyRating(f, darkness);
  const max = maxHit(f);
  return (
    <>
      <Section title="Offence">
        <Row k="Combat level" v={combatLevel(f, f.style)} />
        <Row k="Style" v={f.style.DisplayName} />
        <Row k="Stance" v={f.stance.DisplayName} />
        <Row k="Element" v={elementName(element)} />
        <Row k="Hit" v={`${minHit(f, max)}–${max}`} />
        <Row k="Attack interval" v={seconds(f)} />
        <Row k={`Accuracy (${f.stance.DisplayName})`} v={fmt(acc)} />
        {foe && <Row k="Hit chance" v={pct(hitChance(acc, evasionRating(foe, f.stance, foeDarkness)))} />}
        {darkness > 0 && <Row k="Darkness" v={`${darkness} / 20 (−${darkness * 5}%)`} />}
      </Section>
      {foe && (
        <>
          <h3>
            {f.style.DisplayName} vs {foe.style.DisplayName} · {elementName(element)} vs {elementName(foeElement)}
          </h3>
          {matchup.length ? (
            <ul class="bonus-list">
              {matchup.map((m) => (
                <li>{m}</li>
              ))}
            </ul>
          ) : (
            <p class="muted small">No matchup bonuses.</p>
          )}
        </>
      )}
      <Section title="Evasion">
        {all<AttackStance>('AttackStance').map((s) => (
          <Row k={`vs ${s.DisplayName}`} v={fmt(evasionRating(f, s, darkness))} />
        ))}
      </Section>
      <Section title="Defence">
        <Row k="Armour" v={fmt(armour(f))} />
        {(f.stats.MaximumWard ?? 0) > 0 && <Row k="Maximum ward" v={fmt(f.stats.MaximumWard)} />}
        <Row k="Normal power" v={fmt(powerRating(f))} />
        <Row k="Normal protection" v={fmt(protectionRating(f))} />
        {foe && <Row k="Resists their damage" v={pct(resistance(foe, f))} />}
        {(f.stats.Lifesteal ?? 0) > 0 && <Row k="Lifesteal" v={pct(f.stats.Lifesteal)} />}
      </Section>
      {showAll &&
        all<{ Id: string; DisplayName: string }>('CombatStatCategory').map((c) => {
          const rows = all<CombatStat>('CombatStat').filter((s) => s.Category === NS + c.Id);
          if (!rows.length) return null;
          return (
            <Section title={/Evasion$/.test(c.Id) ? `${c.DisplayName} defence` : c.DisplayName}>
              {rows.map((s) => (
                <Row
                  k={s.DisplayName.replace(/ Bonus$/, '')}
                  v={s.Id === 'AttackInterval' ? seconds(f) : s.IsPercent ? pct(f.stats[s.Id] ?? 0) : fmt(f.stats[s.Id] ?? 0)}
                />
              ))}
            </Section>
          );
        })}
    </>
  );
}

/** You and the current (or given) enemy, like the desktop's stats panel with its "View my / enemy stats" switch. */
export function CombatStatsSheet({ game, onClose, enemyId, inline }: { game: Game; onClose?: () => void; enemyId?: string; inline?: boolean }) {
  const c = game.state.combat;
  const fighting = c.phase === 'fighting' && !!c.enemy;
  const foeId = fighting ? c.enemy! : enemyId;
  const [side, setSide] = useState<'player' | 'enemy'>('player');
  const [showAll, setShowAll] = useState(false);
  const darkness = fighting && c.area ? playerDarkness(game, c.area) : 0;
  const p = playerFighter(game, foeId ? enemyFighter(foeId).style.Id : undefined);
  const e = foeId ? (fighting ? liveEnemyFighter(game, undefined, p.style.Id) : enemyFighter(foeId, undefined, p.style.Id)) : undefined;
  const mine = playerElement(game);
  const theirs = foeId ? (enemyData(foeId) as { Element?: string }).Element : undefined;
  // The style triangle and (while fighting) the elemental matchup, split by who each bonus applies to.
  const matchup = (who: 'Player' | 'Enemy') => {
    if (!e) return [];
    const el = (fighting ? elementalBonuses(game) : []).filter((b) => {
      const comp = (b.LocalContext as { Component?: { Component?: string } } | null | undefined)?.Component?.Component;
      return who === 'Player' ? comp !== 'Enemy' : comp === 'Enemy';
    });
    return [...triangle(p.style.Id, e.style.Id, who), ...el].map(describeBonus);
  };
  const enemySide = side === 'enemy' && e;
  const body = (
    <>
        <div class="chips">
          <button class={!enemySide ? 'on' : ''} onClick={() => setSide('player')}>
            You
          </button>
          {e && (
            <button class={enemySide ? 'on' : ''} onClick={() => setSide('enemy')}>
              {enemyData(foeId!).DisplayName}
            </button>
          )}
          <button class={showAll ? 'on' : ''} onClick={() => setShowAll(!showAll)}>
            All stats
          </button>
        </div>
        <div class="combat-stats">
          {enemySide ? (
            <FighterStats f={e} foe={p} element={theirs} foeElement={mine} darkness={0} foeDarkness={darkness} matchup={matchup('Enemy')} showAll={showAll} />
          ) : (
            <FighterStats f={p} foe={e} element={mine} foeElement={theirs} darkness={darkness} foeDarkness={0} matchup={matchup('Player')} showAll={showAll} />
          )}
        </div>
    </>
  );
  if (inline) return <div class="combat-stats-inline">{body}</div>;
  return (
    <div class="sheet" onClick={onClose}>
      <div class="sheet-body" onClick={(ev) => ev.stopPropagation()}>
        <div class="sheet-head">
          <h2 class="grow">Combat stats</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
