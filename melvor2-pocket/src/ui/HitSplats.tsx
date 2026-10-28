// Hit splats over a fighter, as the desktop shows them: the damage each hit dealt, "Miss" when it didn't land, and
// critical hits called out. Each one floats up and fades; a fast flurry keeps only the latest few.
import { useEffect, useState } from 'preact/hooks';
import type { Game } from '../engine/game';

const SHOW_MS = 1200;
const MAX_SHOWN = 4;

interface Splat { key: number; text: string; kind: 'hit' | 'miss' | 'crit' | 'zero'; until: number }
let nextKey = 0;

export function HitSplats({ game, side }: { game: Game; side: 'player' | 'enemy' }) {
  const [splats, setSplats] = useState<Splat[]>([]);
  useEffect(() => {
    const on = (e: Parameters<Parameters<typeof game.events.add>[0]>[0]) => {
      if (e.type !== 'hit' || e.target !== side) return;
      const kind: Splat['kind'] = !e.landed ? 'miss' : e.crit ? 'crit' : e.damage > 0 ? 'hit' : 'zero';
      const text = !e.landed ? 'Miss' : `${e.crit ? 'Crit! ' : ''}${e.damage > 0 ? `−${e.damage}` : '0'}`;
      const now = Date.now();
      setSplats((list) => [...list.filter((s) => s.until > now), { key: nextKey++, text, kind, until: now + SHOW_MS }].slice(-MAX_SHOWN));
    };
    game.events.add(on);
    const timer = setInterval(() => setSplats((list) => (list.some((s) => s.until <= Date.now()) ? list.filter((s) => s.until > Date.now()) : list)), 300);
    return () => {
      game.events.delete(on);
      clearInterval(timer);
    };
  }, [game, side]);
  return (
    <div class="hit-splats" aria-live="polite">
      {splats.map((s, i) => (
        <span key={s.key} class={`hit-splat ${s.kind}`} style={{ left: `${50 + ((i % 3) - 1) * 18}%` }}>
          {s.text}
        </span>
      ))}
    </div>
  );
}
