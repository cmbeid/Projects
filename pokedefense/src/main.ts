/** Entry point: load the save, wire up audio, show the title. */
import './style.css';
import { suspend, unlock } from './audio/index';
import { applySettings } from './ui/app';
import { titleScreen } from './ui/screens';

applySettings();
document.addEventListener('visibilitychange', () => suspend(document.hidden));
// The first touch anywhere starts audio; browsers allow nothing before one.
window.addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
// Stop iOS pinch-zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault());
titleScreen();
