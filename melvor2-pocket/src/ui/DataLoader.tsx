// First-run screen: the deployed app carries no game data, so the player supplies content.json from their own install.
import { useState } from 'preact/hooks';
import { validateContent } from '../engine/content';
import { storeContent } from '../save';
import { isBundle, unpackBundle } from '../bundle';

export function DataLoader({ onLoaded }: { onLoaded: () => void }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg('Reading…');
    try {
      if (await isBundle(file)) {
        setMsg('Unpacking game data, images, sounds and music…');
        await unpackBundle(file);
      } else {
        await storeContent(validateContent(JSON.parse(await file.text())));
      }
      onLoaded();
    } catch (err) {
      setMsg(err instanceof SyntaxError ? "That file isn't valid JSON." : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div class="app">
      <main class="loader">
        <h2>Load your game data</h2>
        <p>
          Melvor 2 Pocket doesn't include any game content. It plays using the data from your own copy of the
          <strong> Melvor Idle 2 Demo</strong>, which you load once on this device. It stays in this browser.
        </p>
        <ol>
          <li>
            On your PC, in the <code>melvor2-pocket</code> folder, run <code>npm run bundle</code>. It reads your Steam install and
            writes <code>data/melvor2-pocket.bundle</code>: the game data, images, sounds and music in one file.
          </li>
          <li>Copy that file to this device (cloud drive, email to yourself, USB…).</li>
          <li>Pick it below. A plain <code>content.json</code> works too, without images and sound.</li>
        </ol>
        <label class={`file-pick ${busy ? 'busy' : ''}`}>
          {/* No accept filter: phone pickers often grey out unfamiliar extensions like .bundle. */}
          <input type="file" onChange={pick} disabled={busy} />
          {busy ? 'Loading…' : 'Choose melvor2-pocket.bundle'}
        </label>
        {msg && <p class="muted">{msg}</p>}
      </main>
    </div>
  );
}
