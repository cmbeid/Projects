import type { FactionDef } from './types';

export const FACTIONS: readonly FactionDef[] = [
  {
    id: 'concord',
    name: 'Concord Remnant',
    desc: 'What is left of the navy that launched the ark. Orderly, short of everything, sure the ark still belongs to them.',
    color: '#5aa0f0',
  },
  {
    id: 'clans',
    name: 'Drift Clans',
    desc: 'Salvagers born out here, long before the ark. To them its wreckage is a gift from the sky.',
    color: '#f0a040',
  },
  {
    id: 'choir',
    name: 'The Choir',
    desc: 'Something that came through the jump with the ark. It speaks in chords, and it is learning.',
    color: '#c070f0',
  },
];
export const FACTION = new Map(FACTIONS.map((f) => [f.id, f]));
