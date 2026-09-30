/** Screens, sound settings and the settings sheet. */
import { setMuted, setVolumes, sfx } from '../audio/index';
import { loadSettings, saveSettings, type Settings } from '../state/save';
import { h } from './dom';
import { fullscreenButton } from './fullscreen';
import { closeSheet, openSheet } from './sheet';

let settings: Settings = loadSettings();

export function applySettings(): void {
  setVolumes({ sfx: settings.sfx, cries: settings.cries, music: 0 });
  setMuted(settings.muted);
}

export function getSettings(): Settings {
  return settings;
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

export function openSettings(host: HTMLElement, actions: { help: () => void; quit: () => void; restart: () => void }): void {
  openSheet(host, 'Menu', (body, refresh) => {
    const slider = (label: string, key: 'sfx' | 'cries'): HTMLElement =>
      h('label.slider', {}, h('span', {}, label), h('input', {
        type: 'range', min: 0, max: 100, value: String(settings[key]),
        oninput: (e: Event) => updateSettings({ [key]: Number((e.target as HTMLInputElement).value) }),
        onchange: () => sfx.preview(),
      }));
    body.append(
      slider('Sound effects', 'sfx'),
      slider('Pokémon cries', 'cries'),
      h('label.check', {}, h('input', { type: 'checkbox', checked: settings.muted, onchange: (e: Event) => updateSettings({ muted: (e.target as HTMLInputElement).checked }) }), h('span', {}, 'Mute all sound')),
      h('div.buttons.stack', {},
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
