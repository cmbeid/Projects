/**
 * Downloads the game's music from Pokémon Crystal's sound engine source
 * (pret/pokecrystal) and converts each song into the note lists
 * `src/audio/music.ts` plays, one JSON file per track under `public/music/`.
 * Adapted from PokéDefense's, Crystal only. The output is committed; tracks
 * already converted are skipped unless `--force` is given.
 *
 * The music is © Nintendo / Creatures / GAME FREAK (composed by Junichi
 * Masuda, Go Ichinose and Morikazu Aoki), used here for a personal,
 * non-commercial project.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { convertSong, parseDrumkits, parseWaves } from './music/parse';
import { TRACKS } from '../src/data/music';

const BASE = 'https://raw.githubusercontent.com/pret/pokecrystal/master';
const FORCE = process.argv.includes('--force');

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
    if (!FORCE && existsSync(`public/music/${id}.json`)) continue;
    const song = convertSong(id, await text(`audio/music/${id}.asm`), { drumkits, waves });
    const json = JSON.stringify(song);
    await writeFile(`public/music/${id}.json`, json);
    const notes = song.channels.reduce((n, c) => n + c.notes.length, 0);
    console.log(`  ${id.padEnd(22)} ${(json.length / 1024).toFixed(0).padStart(3)} KB  ${String(notes).padStart(5)} notes`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
