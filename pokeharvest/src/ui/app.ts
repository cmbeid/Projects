/** Screens, sound settings and the settings sheet. */
import { setMuted, setVolumes, sfx } from '../audio/index';
import { defaultDpad, loadSettings, saveSettings, type DpadSettings, type Settings } from '../state/save';
import { h } from './dom';
import { fullscreenButton } from './fullscreen';
import { closeSheet, openSheet } from './sheet';

let settings: Settings = loadSettings();

export function applySettings(): void {
  setVolumes({ sfx: settings.sfx, cries: settings.cries, music: settings.music });
  setMuted(settings.muted);
}

export function getSettings(): Settings {
  return settings;
}

/** Change the d-pad's settings, keeping the rest. */
export function setDpad(next: Partial<DpadSettings>): DpadSettings {
  updateSettings({ dpad: { ...settings.dpad, ...next } });
  return settings.dpad;
}

function updateSettings(next: Partial<Settings>): void {
  settings = { ...settings, ...next };
  saveSettings(settings);
  applySettings();
}

/** Replace whatever is on screen. */
export function show(screen: HTMLElement): void {
  const app = document.getElementById('app')!;
  app.replaceChildren(screen);
}

export function openSettings(host: HTMLElement, actions: { help: () => void; dex: () => void; journal: () => void; dpad: (s: DpadSettings) => void; moveDpad: () => void; quit: () => void; restart: () => void }): void {
  openSheet(host, 'Menu', (body, refresh) => {
    const slider = (label: string, key: 'sfx' | 'cries' | 'music'): HTMLElement =>
      h('label.slider', {}, h('span', {}, label), h('input', {
        type: 'range', min: 0, max: 100, value: String(settings[key]),
        oninput: (e: Event) => updateSettings({ [key]: Number((e.target as HTMLInputElement).value) }),
        onchange: () => sfx.preview(),
      }));
    body.append(
      slider('Music', 'music'),
      slider('Sound effects', 'sfx'),
      slider('Pokémon cries', 'cries'),
      h('label.check', {}, h('input', { type: 'checkbox', checked: settings.muted, onchange: (e: Event) => updateSettings({ muted: (e.target as HTMLInputElement).checked }) }), h('span', {}, 'Mute all sound')),
      h('h3', {}, 'On-screen d-pad'),
      h('label.check', {}, h('input', {
        type: 'checkbox', checked: settings.dpad.enabled, 'aria-label': 'Show the d-pad',
        onchange: (e: Event) => { actions.dpad(setDpad({ enabled: (e.target as HTMLInputElement).checked })); refresh(); },
      }), h('span', {}, 'Show the d-pad')),
      ...(settings.dpad.enabled ? [
        h('div.seg-row', {}, h('span', {}, 'Size'), h('div.segmented', {}, ...(['S', 'M', 'L'] as const).map((size) =>
          h('button', { className: settings.dpad.size === size ? 'btn seg on' : 'btn seg', onclick: () => { actions.dpad(setDpad({ size })); refresh(); } }, size)))),
        h('label.slider', {}, h('span', {}, 'Opacity'), h('input', {
          type: 'range', min: 20, max: 100, value: String(settings.dpad.opacity),
          oninput: (e: Event) => actions.dpad(setDpad({ opacity: Number((e.target as HTMLInputElement).value) })),
        })),
        h('div.buttons', {},
          h('button.btn', { onclick: () => { closeSheet(); actions.moveDpad(); } }, 'Move d-pad'),
          h('button.btn', { onclick: () => { const d = defaultDpad(); actions.dpad(setDpad({ x: d.x, y: d.y, size: 'M', opacity: 80 })); refresh(); } }, 'Reset')),
      ] : []),
      h('div.buttons.stack', {},
        h('button.btn', { onclick: actions.journal }, 'Journal'),
        h('button.btn', { onclick: actions.dex }, 'Pokédex'),
        h('button.btn', { onclick: actions.help }, 'How to farm'),
        fullscreenButton('btn', () => undefined),
        h('button.btn', { onclick: () => { closeSheet(); actions.quit(); } }, 'Save & return to title'),
        h('button.btn.danger', {
          onclick: () => {
            body.replaceChildren(
              h('p', {}, 'Start a new farm? This farm and everything on it will be gone for good.'),
              h('div.buttons', {}, h('button.btn', { onclick: refresh }, 'Keep my farm'), h('button.btn.danger', { onclick: () => { closeSheet(); actions.restart(); } }, 'Start over')),
            );
          },
        }, 'New farm…'),
      ),
      h('p.credit', {}, 'Pokémon sprites, cries and item icons from PokeAPI. Pokémon © Nintendo / Creatures / GAME FREAK. A personal, non-commercial fan project.'),
    );
  });
}
