/** Entry point: wire up audio, then the title screen. */
import './style.css';
import { suspend, unlock } from './audio/index';
import { applySettings } from './ui/app';
import { farmScreen } from './ui/farm';
import { titleScreen } from './ui/title';
import { clearSave } from './state/save';
import type { World } from './game/model';

applySettings();
document.addEventListener('visibilitychange', () => suspend(document.hidden));
// The first touch anywhere starts audio; browsers allow nothing before one.
window.addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
// Stop iOS pinch-zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault());

function title(): void {
  titleScreen(start);
}

function start(world: World, isNew: boolean): void {
  farmScreen(world, isNew, title, () => {
    clearSave();
    title();
  });
}

title();
