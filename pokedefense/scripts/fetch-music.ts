/**
 * Downloads the game's music and converts it into the note lists
 * `src/audio/music.ts` plays, one JSON file per track under `public/music/`:
 * Kanto and Johto from Pokémon Crystal's sound engine source
 * (pret/pokecrystal), Hoenn and Sinnoh from Emerald's and Platinum's MIDI
 * files (pret/pokeemerald, pret/pokeplatinum), arranged for the same four
 * Game Boy channels; Kalos's original tunes from `music/kalos.ts`. The
 * output is committed; re-run this only to add or change a track. Tracks
 * already converted are skipped unless `--force` is given.
 *
 * Unova's music comes from Pokémon Black or White's sound archive, which
 * isn't public: pass `--sdat path/to/sound_data.sdat` to convert the tracks
 * named in `UNOVA_SEQ` (`src/data/music.ts`), and add `--list` to print every
 * sequence name in the archive. Only the converted JSON is committed.
 *
 * The music is © Nintendo / Creatures / GAME FREAK (composed by Junichi
 * Masuda, Go Ichinose and Morikazu Aoki), used here for a personal,
 * non-commercial project.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { KALOS_SCORES } from './music/kalos';
import { arrange, convertMidi } from './music/midi';
import { compileScore } from './music/score';
import { drumPrograms, readSdat, readSseq, type SdatSequence } from './music/sseq';
import { convertSong, parseDrumkits, parseWaves } from './music/parse';
import { TRACKS, trackSource } from '../src/data/music';

const EMERALD = 'https://raw.githubusercontent.com/pret/pokeemerald/master/sound/songs/midi';
const PLATINUM = 'https://raw.githubusercontent.com/pret/pokeplatinum/main/res/sound/SEQ';
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
  const sdatAt = process.argv.indexOf('--sdat');
  const sdat: SdatSequence[] | null = sdatAt > 0 ? readSdat(new Uint8Array(readFileSync(process.argv[sdatAt + 1]!))) : null;
  if (sdat && process.argv.includes('--list')) {
    for (const seq of sdat) console.log(`  ${seq.name}`);
    return;
  }
  const midi = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  };

  for (const id of TRACKS) {
    if (!FORCE && existsSync(`public/music/${id}.json`)) continue;
    const source = trackSource(id);
    let song;
    if (source.from === 'crystal') {
      song = convertSong(id, await text(`audio/music/${source.file}.asm`), { drumkits, waves });
    } else if (source.from === 'emerald') {
      song = convertMidi(id, await midi(`${EMERALD}/${source.file}.mid`));
    } else if (source.from === 'platinum') {
      song = convertMidi(id, await midi(`${PLATINUM}/${source.file}.mid`));
    } else if (source.from === 'score') {
      song = compileScore(KALOS_SCORES.get(id)!);
    } else {
      // Unova: only with the archive, and only once the track has a name.
      if (!sdat || !source.file) continue;
      const seq = sdat.find((s) => s.name === source.file);
      if (!seq) throw new Error(`${source.file} isn't in the sound archive (see --list)`);
      song = arrange(id, readSseq(seq.data, drumPrograms(seq.bank)));
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
