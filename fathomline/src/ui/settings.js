import { exportState, importState, wipeState } from '../core/save.js';

export function renderSettings(state) {
  return `
    <label class="flex items-center justify-between py-2 border-b border-white/5">
      <span>Muted</span>
      <input type="checkbox" data-setting="muted" ${state.settings.muted ? 'checked' : ''} />
    </label>
    <label class="flex items-center justify-between py-2 border-b border-white/5">
      <span>Reduced motion</span>
      <input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion ? 'checked' : ''} />
    </label>
    <label class="flex items-center justify-between py-2 border-b border-white/5">
      <span>Assist mode</span>
      <input type="checkbox" data-setting="assistMode" ${state.settings.assistMode ? 'checked' : ''} />
    </label>
    <div class="flex gap-2 mt-4">
      <button data-settings="export" class="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm">Export save</button>
      <button data-settings="wipe" class="flex-1 rounded-lg border border-red-400/40 text-red-300 px-3 py-2 text-sm">Wipe save</button>
    </div>
    <textarea data-settings="importbox" placeholder="Paste exported save JSON here" class="mt-2 w-full h-20 bg-deep/50 rounded-lg p-2 text-xs"></textarea>
    <button data-settings="import" class="mt-2 w-full rounded-lg border border-white/20 px-3 py-2 text-sm">Import save</button>
  `;
}

export function bindSettings(panelBody, state, onChanged, disableSaving) {
  panelBody.querySelectorAll('[data-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      state.settings[input.dataset.setting] = input.checked;
      onChanged?.();
    });
  });
  panelBody.querySelector('[data-settings="export"]')?.addEventListener('click', () => {
    const json = exportState(state);
    navigator.clipboard?.writeText(json).catch(() => {});
    panelBody.querySelector('[data-settings="importbox"]').value = json;
  });
  panelBody.querySelector('[data-settings="wipe"]')?.addEventListener('click', () => {
    if (confirm('Wipe your save? This cannot be undone.')) {
      // Stop the engine's own autosave/beforeunload save first — otherwise
      // it can win the race against this write and silently resurrect the
      // save on reload.
      disableSaving?.();
      wipeState();
      location.reload();
    }
  });
  panelBody.querySelector('[data-settings="import"]')?.addEventListener('click', () => {
    const text = panelBody.querySelector('[data-settings="importbox"]').value.trim();
    if (!text) return;
    try {
      importState(text); // validates before we touch localStorage
      disableSaving?.();
      localStorage.setItem('fathomline.save.v1', text);
      location.reload();
    } catch {
      alert('That save data could not be read.');
    }
  });
}
