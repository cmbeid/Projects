/**
 * Downloads Pokémon Crystal's music from the pret/pokecrystal disassembly and
 * converts it into the note lists `src/audio/music.ts` plays, one JSON file
 * per track under `public/music/`. The output is committed; re-run this only
 * to add or change a track.
 *
 * The music is © Nintendo / Creatures / GAME FREAK (composed by Junichi
 * Masuda and Go Ichinose), used here for a personal, non-commercial project.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { convertSong, parseDrumkits, parseWaves } from './music/parse';
import { TRACKS } from '../src/data/music';

const BASE = 'https://raw.githubusercontent.com/pret/pokecrystal/master';

async function text(path: string): Promise<string> {
  const response = await fetch(`${BASE}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

async function main(): Promise<void> {
  await mkdir('public/music', { recursive: true });
  const drumkits = parseDrumkits(await text('audio/drumkits.asm'));
  const waves = parseWaves(await text('audio/wave_samples.asm'));

  for (const id of TRACKS) {
    const song = convertSong(id, await text(`audio/music/${id}.asm`), { drumkits, waves });
    const json = JSON.stringify(song);
    await writeFile(`public/music/${id}.json`, json);
    const loop = song.channels.map((c) => (c.loop === null ? 'once' : `${((c.end - c.loop) / song.frameRate).toFixed(1)}s`));
    const notes = song.channels.reduce((n, c) => n + c.notes.length, 0);
    console.log(`  ${id.padEnd(20)} ${(json.length / 1024).toFixed(0).padStart(3)} KB  ${String(notes).padStart(5)} notes  loops ${loop.join(' ')}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
