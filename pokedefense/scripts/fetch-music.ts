/**
 * Downloads the game's music and converts it into the note lists
 * `src/audio/music.ts` plays, one JSON file per track under `public/music/`:
 * Kanto and Johto from Pokémon Crystal's sound engine source
 * (pret/pokecrystal), Hoenn from Pokémon Emerald's MIDI files
 * (pret/pokeemerald), arranged for the same four Game Boy channels. The
 * output is committed; re-run this only to add or change a track. Tracks
 * already converted are skipped unless `--force` is given.
 *
 * The music is © Nintendo / Creatures / GAME FREAK (composed by Junichi
 * Masuda, Go Ichinose and Morikazu Aoki), used here for a personal,
 * non-commercial project.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { convertMidi } from './music/midi';
import { convertSong, parseDrumkits, parseWaves } from './music/parse';
import { TRACKS, trackSource } from '../src/data/music';

const EMERALD = 'https://raw.githubusercontent.com/pret/pokeemerald/master/sound/songs/midi';
const FORCE = process.argv.includes('--force');

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
    if (!FORCE && existsSync(`public/music/${id}.json`)) continue;
    const source = trackSource(id);
    let song;
    if (source.from === 'crystal') {
      song = convertSong(id, await text(`audio/music/${source.file}.asm`), { drumkits, waves });
    } else {
      const response = await fetch(`${EMERALD}/${source.file}.mid`);
      if (!response.ok) throw new Error(`${source.file}.mid: HTTP ${response.status}`);
      song = convertMidi(id, new Uint8Array(await response.arrayBuffer()));
    }
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
