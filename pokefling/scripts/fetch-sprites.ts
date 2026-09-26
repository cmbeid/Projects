/**
 * Downloads the Pokémon artwork the game uses from PokeAPI's sprites repo into
 * `public/sprites/`. The result is committed, so this only needs re-running
 * when the roster in `src/data/roster.ts` changes.
 *
 * Pokémon and its artwork are © Nintendo / Creatures / GAME FREAK. They are
 * used here for a personal, non-commercial project.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { spriteDexes } from '../src/data/roster';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const OUT = 'public/sprites';

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  for (const dex of spriteDexes()) {
    const response = await fetch(`${BASE}/${dex}.png`);
    if (!response.ok) throw new Error(`#${dex}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(`${OUT}/${dex}.png`, bytes);
    console.log(`  #${String(dex).padEnd(4)} ${(bytes.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
