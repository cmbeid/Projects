// Item notifications, after the desktop's: a small card per item gained with the amount and how many are now in the
// bank. More of the same item adds to its card and restarts its 3-second timer. Can be turned off in Settings.
import { useEffect, useState } from 'preact/hooks';
import { itemName } from '../engine/content';
import type { Game } from '../engine/game';
import { Icon, fmt } from './common';

const PREF_KEY = 'melvor2-pocket-item-toasts';
const SHOW_MS = 3000;
/** At most this many cards at once; the oldest goes first. */
const MAX_SHOWN = 4;

export function itemToastsOn(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setItemToasts(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode etc.: the choice just won't persist.
  }
}

interface Toast { id: string; quantity: number; bank: number; until: number; bump: number }

export function ItemToasts({ game }: { game: Game }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Parameters<Parameters<typeof game.events.add>[0]>[0]) => {
      if (e.type !== 'item' || !itemToastsOn()) return;
      const until = Date.now() + SHOW_MS;
      setToasts((list) => {
        const old = list.find((t) => t.id === e.id && t.until > Date.now());
        const rest = list.filter((t) => t !== old && t.until > Date.now());
        const t = { id: e.id, quantity: (old?.quantity ?? 0) + e.quantity, bank: e.bank, until, bump: (old?.bump ?? 0) + 1 };
        return [...rest, t].slice(-MAX_SHOWN);
      });
    };
    game.events.add(on);
    const timer = setInterval(() => setToasts((list) => (list.some((t) => t.until <= Date.now()) ? list.filter((t) => t.until > Date.now()) : list)), 250);
    return () => {
      game.events.delete(on);
      clearInterval(timer);
    };
  }, [game]);
  if (!toasts.length) return null;
  return (
    <div class="item-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div class="item-toast" key={t.id} onClick={() => setToasts((l) => l.filter((x) => x !== t))}>
          <Icon id={t.id} size={28} />
          <strong key={t.bump} class="toast-qty">+{fmt(t.quantity)}</strong>
          <span class="toast-name">{itemName(t.id, t.quantity)}</span>
          <span class="toast-bank">{fmt(t.bank)}</span>
        </div>
      ))}
    </div>
  );
}
