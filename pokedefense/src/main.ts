/** Entry point: load the save, wire up audio, show the title — or the battle the tab closed on. */
import './style.css';
import { suspend, unlock } from './audio/index';
import { clearBattle, loadBattle } from './state/save';
import { applySettings } from './ui/app';
import { startBattle } from './ui/battle';
import { titleScreen, worldScreen } from './ui/screens';

applySettings();
document.addEventListener('visibilitychange', () => suspend(document.hidden));
// The first touch anywhere starts audio; browsers allow nothing before one.
window.addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
// Stop iOS pinch-zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault());
/** Carry on the battle the tab closed on, if there is one that can still be read. */
function resumeBattle(): boolean {
  const saved = loadBattle();
  if (!saved) return false;
  try {
    return startBattle({ mapId: saved.mapId, difficulty: saved.difficulty, team: saved.team, onExit: worldScreen }, saved);
  } catch {
    clearBattle();
    return false;
  }
}

if (!resumeBattle()) titleScreen();
