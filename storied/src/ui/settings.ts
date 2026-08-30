/**
 * The settings sheet: text size (applies everywhere, via preferences.ts)
 * and restarting the current story. `allowsBack`'s "leave to the shelf"
 * job and the back stack's "undo" job both already live on the reader's
 * back button (phase 4) — this module is deliberately just the two things
 * §1's original file tree still left for it.
 */
import type { TextSize } from '../state/preferences';
import { applyTextSize, loadTextSize, saveTextSize, TEXT_SIZE_SCALE } from '../state/preferences';

const TEXT_SIZES: readonly TextSize[] = ['small', 'normal', 'large'];

export interface SettingsCallbacks {
  /** Called after the player confirms — clearing the save is the caller's job. */
  onRestart: () => void;
}

/** Mounts the gear toggle into `header` and the sheet itself into `shell`. */
export function mountSettings(header: HTMLElement, shell: HTMLElement, callbacks: SettingsCallbacks): void {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sy-settings-toggle';
  toggle.setAttribute('aria-label', 'Settings');
  toggle.textContent = '⚙';
  header.append(toggle);

  const sheet = document.createElement('div');
  sheet.className = 'sy-settings-sheet is-hidden';

  const sizeLabel = document.createElement('p');
  sizeLabel.className = 'sy-settings-label';
  sizeLabel.textContent = 'Text size';
  sheet.append(sizeLabel);

  const sizeRow = document.createElement('div');
  sizeRow.className = 'sy-settings-sizes';
  sheet.append(sizeRow);

  let current = loadTextSize();
  const sizeButtons = new Map<TextSize, HTMLButtonElement>();

  function refreshActive(): void {
    for (const [size, button] of sizeButtons) button.classList.toggle('is-active', size === current);
  }

  for (const size of TEXT_SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sy-settings-size';
    button.style.fontSize = `${TEXT_SIZE_SCALE[size]}em`;
    button.textContent = 'A';
    button.setAttribute('aria-label', size);
    button.addEventListener('click', () => {
      current = size;
      saveTextSize(size);
      applyTextSize(size);
      refreshActive();
    });
    sizeButtons.set(size, button);
    sizeRow.append(button);
  }
  refreshActive();

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'sy-settings-restart';
  restart.textContent = 'Restart this story';
  restart.addEventListener('click', () => {
    sheet.classList.add('is-hidden');
    if (window.confirm('Restart this story from the beginning? Your progress in it will be lost.')) {
      callbacks.onRestart();
    }
  });
  sheet.append(restart);

  shell.append(sheet);

  toggle.addEventListener('click', () => {
    sheet.classList.toggle('is-hidden');
  });
}
