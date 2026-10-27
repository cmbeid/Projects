// Settings → Sound: load the optional sound/music packs, volumes and track choice.
import { useState } from 'preact/hooks';
import { NS } from '../engine/content';
import { applyVisibility, clearSoundPack, hasSoundPack, loadSoundPack, musicTracks, nowPlaying, saveSettings, settings, startMusic } from '../audio/sound';
import { forgetBlob, storeBlob } from '../save';

export function SoundSettings() {
  const [, redraw] = useState(0);
  const [msg, setMsg] = useState('');
  const refresh = () => redraw((n) => n + 1);

  const picker = (which: 'sounds' | 'music', label: string) => (
    <div class="row">
      <label class="file-pick small-pick">
        <input
          type="file"
          accept=".pack"
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
              const n = await loadSoundPack(f, which);
              await storeBlob(which, f);
              setMsg(`Loaded ${n} ${which === 'music' ? 'music tracks' : 'sounds'}.`);
            } catch (err) {
              setMsg((err as Error).message);
            }
            refresh();
          }}
        />
        {hasSoundPack(which) ? `Replace ${label}` : `Load ${label}`}
      </label>
      {hasSoundPack(which) && (
        <button
          onClick={async () => {
            await forgetBlob(which);
            clearSoundPack(which);
            refresh();
          }}
        >
          Remove
        </button>
      )}
    </div>
  );

  const slider = (key: 'sfx' | 'music', label: string) => (
    <label class="slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings[key]}
        onInput={(e) => {
          settings[key] = Number((e.target as HTMLInputElement).value);
          saveSettings();
          refresh();
        }}
      />
    </label>
  );

  return (
    <section>
      <h3>Sound</h3>
      <p class="muted">
        The game is silent unless you load its sounds and music from your own install (<code>npm run audio</code> on your PC
        makes game-sounds.pack and game-music.pack). Audio starts after your first tap.
      </p>
      {picker('sounds', 'game sounds')}
      {hasSoundPack('sounds') && slider('sfx', 'Sound effects')}
      {picker('music', 'game music')}
      {hasSoundPack('music') && (
        <>
          {slider('music', 'Music')}
          <label class="slider">
            <span>Track</span>
            <select
              value={settings.track}
              onChange={(e) => {
                settings.track = (e.target as HTMLSelectElement).value;
                saveSettings();
                startMusic();
                refresh();
              }}
            >
              <option value="shuffle">Like the desktop game</option>
              <option value="off">Off</option>
              {musicTracks().map((t) => (
                <option value={NS + t.Id}>{t.TrackName}</option>
              ))}
            </select>
          </label>
          {nowPlaying && (
            <div class="row">
              <p class="muted small">Now playing: {nowPlaying}</p>
              {settings.track === 'shuffle' && (
                <button class="small" onClick={() => { startMusic(); refresh(); }}>
                  Next track
                </button>
              )}
            </div>
          )}
        </>
      )}
      {(hasSoundPack('sounds') || hasSoundPack('music')) && (
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.muteHidden}
            onChange={(e) => {
              settings.muteHidden = (e.target as HTMLInputElement).checked;
              saveSettings();
              applyVisibility();
              refresh();
            }}
          />
          Mute when the game isn't visible
        </label>
      )}
      {msg && <p class="muted">{msg}</p>}
    </section>
  );
}
