// Optional game audio from the player's own install: game-sounds.pack (action sounds, hits, level-ups) and
// game-music.pack (the soundtrack). Without packs the game is silent. Settings are per device.
import { NS, all, tryGet } from '../engine/content';
import { decodeQoa } from './qoa';

type Kind = 'ogg' | 'wav' | 'qoa';
interface Pack { blob: Blob; index: Record<string, [number, number, Kind]> }

const packs: { sounds: Pack | null; music: Pack | null } = { sounds: null, music: null };
let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

export interface SoundSettings { sfx: number; music: number; track: string }
const SETTINGS_KEY = 'melvor2-pocket-sound';
export const settings: SoundSettings = (() => {
  try {
    return { sfx: 0.6, music: 0.4, track: 'shuffle', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { sfx: 0.6, music: 0.4, track: 'shuffle' };
  }
})();

export function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode etc.: settings just won't persist.
  }
  if (sfxGain) sfxGain.gain.value = settings.sfx;
  if (musicGain) musicGain.gain.value = settings.music;
  if (settings.track === 'off') stopMusic();
  else if (!musicSource) startMusic();
}

/** Throws if the file isn't a sound pack. Returns the number of sounds. */
export async function loadSoundPack(blob: Blob, which: 'sounds' | 'music'): Promise<number> {
  const head = new DataView(await blob.slice(0, 8).arrayBuffer());
  if (String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3)) !== 'M2SP') {
    throw new Error("That isn't a game-sounds.pack or game-music.pack. Build them with `npm run audio` on your PC.");
  }
  const len = head.getUint32(4, true);
  const raw = JSON.parse(await blob.slice(8, 8 + len).text()) as Record<string, [number, number, Kind]>;
  const index: Pack['index'] = {};
  for (const [k, [o, l, kind]] of Object.entries(raw)) index[k] = [8 + len + o, l, kind];
  packs[which] = { blob, index };
  buffers.clear();
  if (which === 'music' && ctx) startMusic();
  return Object.keys(index).length;
}

export function clearSoundPack(which: 'sounds' | 'music'): void {
  packs[which] = null;
  buffers.clear();
  if (which === 'music') stopMusic();
}

export const hasSoundPack = (which: 'sounds' | 'music') => packs[which] !== null;

/** Browsers only allow audio after a tap; the first one creates the audio context and starts the music. */
export function unlockAudioOnFirstTap(): void {
  const start = () => {
    if (!ctx) {
      ctx = new AudioContext();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = settings.sfx;
      sfxGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = settings.music;
      musicGain.connect(ctx.destination);
      startMusic();
    }
    void ctx.resume();
  };
  window.addEventListener('pointerdown', start, { passive: true });
  window.addEventListener('keydown', start);
}

function qoaToBuffer(bytes: Uint8Array): AudioBuffer {
  const a = decodeQoa(bytes);
  const buf = ctx!.createBuffer(a.channels, a.samples, a.sampleRate);
  for (let c = 0; c < a.channels; c++) {
    const out = buf.getChannelData(c);
    const src = a.data[c];
    for (let i = 0; i < a.samples; i++) out[i] = src[i] / 32768;
  }
  return buf;
}

function bufferFor(which: 'sounds' | 'music', path: string): Promise<AudioBuffer | null> {
  const pack = packs[which];
  const entry = pack?.index[path];
  if (!ctx || !pack || !entry) return Promise.resolve(null);
  const key = `${which}:${path}`;
  let p = buffers.get(key);
  if (!p) {
    const [o, l, kind] = entry;
    p = pack.blob
      .slice(o, o + l)
      .arrayBuffer()
      .then((ab) => (kind === 'qoa' ? qoaToBuffer(new Uint8Array(ab)) : ctx!.decodeAudioData(ab)))
      .catch(() => null);
    // Music tracks are big once decoded; only sound effects stay cached.
    if (which === 'sounds') buffers.set(key, p);
  }
  return p;
}

const lastPlayed = new Map<string, number>();

/** Play a sound effect by its res:// path, at most every 150 ms per sound. */
export function playSound(path: string | null | undefined): void {
  if (!path || !ctx || !packs.sounds || settings.sfx <= 0) return;
  const now = performance.now();
  if (now - (lastPlayed.get(path) ?? 0) < 150) return;
  lastPlayed.set(path, now);
  void bufferFor('sounds', path).then((buf) => {
    if (!buf || !ctx || !sfxGain) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(sfxGain);
    src.start();
  });
}

// ---- music ------------------------------------------------------------------------------------

interface MusicTrack { Id: string; TrackName: string; AudioStream: string }
export const musicTracks = () => all<MusicTrack>('MusicTrack').filter((t) => packs.music?.index[t.AudioStream]);

let musicSource: AudioBufferSourceNode | null = null;
export let nowPlaying: string | null = null;

function stopMusic(): void {
  if (musicSource) {
    musicSource.onended = null;
    musicSource.stop();
  }
  musicSource = null;
  nowPlaying = null;
}

// The desktop's rules: two playlists, Combat and NonCombat, each shuffled like a deck (no repeats until all have
// played). Starting or stopping a fight switches list at once. Entering the game plays Story of a Hero first. The Main
// Theme is title-screen only. Boss Battle loops while fighting an enemy whose data names it (the desktop demo loads that
// override but never plays it; here it does).
export type MusicMood = 'NonCombat' | 'Combat' | 'Boss';
const PLAYLISTS: Record<Exclude<MusicMood, 'Boss'>, string[]> = {
  NonCombat: ['Track1', 'Track2', 'Track3', 'Track4', 'Track5', 'Track6'],
  Combat: ['Track7', 'Track8', 'Track9', 'Track10'],
};
const FIRST_TRACK = 'Track6';
const BOSS_TRACK = 'BossTrack1';
let mood: MusicMood = 'NonCombat';
const played = new Set<string>();
let started = false;

function nextShuffled(tracks: MusicTrack[]): MusicTrack | undefined {
  const list = PLAYLISTS[mood === 'Boss' ? 'Combat' : mood].map((id) => tracks.find((t) => t.Id === id)).filter((t) => !!t);
  if (!list.length) return tracks[0];
  const firstStart = !started;
  started = true;
  if (firstStart) {
    const first = list.find((t) => t.Id === FIRST_TRACK);
    if (first) {
      played.add(first.Id);
      return first;
    }
  }
  if (list.every((t) => played.has(t.Id))) played.clear();
  const left = list.filter((t) => !played.has(t.Id));
  const pick = left[Math.floor(Math.random() * left.length)];
  played.add(pick.Id);
  return pick;
}

/** Tell the player what's happening; switching mood cuts to a track from the new list, as the desktop does. */
export function setMusicMood(next: MusicMood): void {
  if (next === mood) return;
  mood = next;
  played.clear();
  if (settings.track === 'shuffle' && ctx) startMusic();
}

export function startMusic(): void {
  stopMusic();
  const tracks = musicTracks();
  if (!ctx || !musicGain || !tracks.length || settings.track === 'off') return;
  const boss = settings.track === 'shuffle' && mood === 'Boss' ? tracks.find((t) => t.Id === BOSS_TRACK) : undefined;
  const pick = boss ?? (settings.track === 'shuffle' ? nextShuffled(tracks) : tracks.find((t) => NS + t.Id === settings.track) ?? tracks[0]);
  if (!pick) return;
  const loop = !!boss || settings.track !== 'shuffle';
  nowPlaying = pick.TrackName;
  void bufferFor('music', pick.AudioStream).then((buf) => {
    if (!buf || !ctx || !musicGain || nowPlaying !== pick.TrackName) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(musicGain);
    src.onended = () => {
      if (musicSource === src) startMusic();
    };
    src.start();
    musicSource = src;
  });
}

// ---- which sound for which game event -------------------------------------------------------------

type Audio = { ActionAudio?: string | null; HitAudio?: string | null; RockHitAudio?: string | null; AttackAudio?: string | null };
const audioOf = (type: string, id: string | null | undefined) => (id ? tryGet<Audio>(type, id) : undefined);

/** Sound for one action of a skill: the hit sound for trees and rocks, otherwise the recipe category's sound. */
export function actionSound(skill: string, recipe: { Category?: string; Location?: string } | undefined): string | undefined {
  if (!recipe) return undefined;
  switch (skill) {
    case 'Woodcutting':
      return audioOf('WoodcuttingRecipeCategory', recipe.Category)?.HitAudio ?? undefined;
    case 'Mining':
      return audioOf('MiningRecipeCategory', recipe.Category)?.RockHitAudio ?? undefined;
    case 'Fishing':
      return audioOf('FishingLocation', recipe.Location)?.ActionAudio ?? undefined;
    default:
      return audioOf('RecipeCategory', recipe.Category)?.ActionAudio ?? undefined;
  }
}

export const weaponSound = (weaponType: string | undefined) => audioOf('WeaponType', weaponType)?.AttackAudio ?? undefined;

/** Level-up jingle: the skill's own if the pack has one, else the generic one. */
export function levelUpSound(skill: string): string | undefined {
  const keys = Object.keys(packs.sounds?.index ?? {});
  const own = keys.find((k) => k.includes('/SkillLevelUps/') && k.toLowerCase().includes(skill.toLowerCase()));
  return own ?? keys.find((k) => /level_?up/i.test(k));
}

export const questSound = () => Object.keys(packs.sounds?.index ?? {}).find((k) => k.endsWith('/QuestComplete.wav'));
