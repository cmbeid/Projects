import './styles/base.css';
import './styles/board.css';
import './styles/inventory.css';
import './styles/modal.css';

import { INDEX } from './data/index';
import { pickHint, progress } from './game/engine';
import { store } from './state/store';
import { primeAudio } from './audio/sfx';
import { Board } from './ui/board';
import { Inventory } from './ui/inventory';
import { LayoutWatcher } from './ui/layout';
import { initModal, openElementDetail, openEncyclopedia, openHint, openSettings } from './ui/modal';
import { initToasts, toastMessage } from './ui/toast';

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

const boardElement = required('board');
const trashElement = required('trash');
const progressElement = required('progress');
const controlsElement = required('controls');

const layout = new LayoutWatcher(boardElement);
initToasts(required('toasts'));
initModal(
  required<HTMLDialogElement>('modal'),
  required('modal-content'),
  openElementDetail,
);

const board = new Board(boardElement, trashElement, layout, openElementDetail);
const inventory = new Inventory(
  {
    root: required('inventory'),
    handle: required<HTMLButtonElement>('drawer-handle'),
    label: required('drawer-label'),
    grid: required('inventory-grid'),
    empty: required('inventory-empty'),
    search: required<HTMLInputElement>('search-input'),
    dragLayer: required('drag-layer'),
  },
  layout,
  board,
  openElementDetail,
);

// --- Control bar -----------------------------------------------------------

interface Control {
  icon: string;
  label: string;
  action: () => void;
}

const controls: Control[] = [
  {
    icon: '🧹',
    label: 'Clear the workspace',
    action: () => {
      if (store.get().tokens.length === 0) {
        toastMessage('The workspace is already empty.');
        return;
      }
      store.clearBoard();
      // Worth saying explicitly: players hesitate over this button otherwise.
      toastMessage('Workspace cleared. Your discoveries are safe.');
    },
  },
  {
    icon: '💡',
    label: 'Get a hint',
    action: () => {
      const hint = pickHint(INDEX, store.get().discovered);
      if (hint) store.recordHintUsed();
      openHint(hint);
    },
  },
  { icon: '📖', label: 'Open the encyclopedia', action: () => openEncyclopedia() },
  {
    icon: '⚙️',
    label: 'Settings and stats',
    action: () =>
      openSettings(() => {
        store.resetProgress();
        toastMessage('Progress reset. Back to the four.');
      }),
  },
];

for (const control of controls) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'control';
  button.textContent = control.icon;
  button.title = control.label;
  button.setAttribute('aria-label', control.label);
  button.addEventListener('click', () => {
    primeAudio();
    control.action();
  });
  controlsElement.append(button);
}

// --- Progress counter ------------------------------------------------------

function renderProgress(): void {
  const stats = progress(INDEX, store.discovered);
  progressElement.textContent = `${stats.found} / ${stats.total} discovered`;
  progressElement.title = `${stats.percent}% complete · ${stats.finalsFound} of ${stats.finalsTotal} final elements`;
}

store.subscribe(renderProgress);
renderProgress();

// --- Start -----------------------------------------------------------------

layout.start();
board.init();
inventory.init();

// Audio contexts may only be created inside a user gesture.
window.addEventListener('pointerdown', primeAudio, { once: true });

// A backgrounded tab on Android can be killed without warning, so flush the
// debounced save on the way out rather than trusting an unload event.
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Registered by vite-plugin-pwa's generated bundle.
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
