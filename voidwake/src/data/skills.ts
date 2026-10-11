import type { ClassId, SkillDef } from './types';

/**
 * Eight skills per class, in two branches of four. A crew member gains a
 * skill point every level and spends it here; `req` chains each branch.
 */
export const SKILLS: readonly SkillDef[] = [
  // Pilot — flying / scouting
  { id: 'pil-jink', cls: 'pilot', name: 'Jink', desc: '+5% evasion in ship combat.', level: 2, mods: { evasion: 0.05 } },
  { id: 'pil-burn', cls: 'pilot', name: 'Efficient Burn', desc: 'Jumps cost 10% less fuel.', req: 'pil-jink', level: 4, mods: { fuelEff: 0.1 } },
  { id: 'pil-ace', cls: 'pilot', name: 'Ace', desc: '+8% evasion.', req: 'pil-burn', level: 7, mods: { evasion: 0.08 } },
  { id: 'pil-slip', cls: 'pilot', name: 'Slipstream', desc: 'Jumps cost another 15% less fuel.', req: 'pil-ace', level: 11, mods: { fuelEff: 0.15 } },
  { id: 'pil-eye', cls: 'pilot', name: 'Gunner\'s Eye', desc: '+6% accuracy.', level: 2, mods: { accuracy: 0.06 } },
  { id: 'pil-boost', cls: 'pilot', name: 'Afterburner', desc: 'Faster on landings.', req: 'pil-eye', level: 4, mods: { speed: 0.12 } },
  { id: 'pil-steady', cls: 'pilot', name: 'Steady Hands', desc: '+2 Reflex.', req: 'pil-boost', level: 7, mods: { reflex: 2 } },
  { id: 'pil-lock', cls: 'pilot', name: 'Target Lock', desc: '+10% accuracy, +10% weapon damage.', req: 'pil-steady', level: 11, mods: { accuracy: 0.1, weaponDmg: 0.1 } },
  // Engineer — repair / industry
  { id: 'eng-weld', cls: 'engineer', name: 'Quick Weld', desc: 'Repairs restore 30% more.', level: 2, mods: { repair: 0.3 } },
  { id: 'eng-shield', cls: 'engineer', name: 'Field Tuning', desc: '+1 shield regeneration.', req: 'eng-weld', level: 4, mods: { shieldRegen: 1 } },
  { id: 'eng-over', cls: 'engineer', name: 'Overclock', desc: '+12% weapon damage.', req: 'eng-shield', level: 7, mods: { weaponDmg: 0.12 } },
  { id: 'eng-miracle', cls: 'engineer', name: 'Miracle Worker', desc: 'Repairs restore another 50% more.', req: 'eng-over', level: 11, mods: { repair: 0.5 } },
  { id: 'eng-pick', cls: 'engineer', name: 'Rockbreaker', desc: 'Gather 25% more on landings.', level: 2, mods: { gather: 0.25 } },
  { id: 'eng-rig', cls: 'engineer', name: 'Load Rig', desc: '+10 carry capacity.', req: 'eng-pick', level: 4, mods: { carry: 10 } },
  { id: 'eng-mind', cls: 'engineer', name: 'Systems Mind', desc: '+2 Wits.', req: 'eng-rig', level: 7, mods: { wits: 2 } },
  { id: 'eng-auto', cls: 'engineer', name: 'Automation', desc: 'Skills recharge 25% faster.', req: 'eng-mind', level: 11, mods: { skillCd: 0.25 } },
  // Scientist — sensors / exploration
  { id: 'sci-read', cls: 'scientist', name: 'Spectral Reading', desc: '+5% accuracy.', level: 2, mods: { accuracy: 0.05 } },
  { id: 'sci-learn', cls: 'scientist', name: 'Field Notes', desc: 'All crew gain 10% more XP.', req: 'sci-read', level: 4, mods: { xp: 0.1 } },
  { id: 'sci-mind', cls: 'scientist', name: 'Polymath', desc: '+2 Wits.', req: 'sci-learn', level: 7, mods: { wits: 2 } },
  { id: 'sci-res', cls: 'scientist', name: 'Resonance', desc: '+2 shield regeneration.', req: 'sci-mind', level: 11, mods: { shieldRegen: 2 } },
  { id: 'sci-air', cls: 'scientist', name: 'Air Recycler', desc: '+20s suit air.', level: 2, mods: { o2: 20 } },
  { id: 'sci-filter', cls: 'scientist', name: 'Hazard Filter', desc: '+25 suit shielding.', req: 'sci-air', level: 4, mods: { suitShield: 25 } },
  { id: 'sci-garden', cls: 'scientist', name: 'Xenobotany', desc: 'Crew eat 10% less.', req: 'sci-filter', level: 7, mods: { foodEff: 0.1 } },
  { id: 'sci-deep', cls: 'scientist', name: 'Deep Survey', desc: 'Gather 30% more on landings.', req: 'sci-garden', level: 11, mods: { gather: 0.3 } },
  // Medic — crew care
  { id: 'med-care', cls: 'medic', name: 'Bedside Manner', desc: 'Crew heal 50% faster.', level: 2, mods: { heal: 0.5 } },
  { id: 'med-calm', cls: 'medic', name: 'Counsel', desc: 'The crew loses morale 20% slower.', req: 'med-care', level: 4, mods: { morale: 0.2 } },
  { id: 'med-voice', cls: 'medic', name: 'Warm Voice', desc: '+2 Charm.', req: 'med-calm', level: 7, mods: { charm: 2 } },
  { id: 'med-surgeon', cls: 'medic', name: 'Surgeon', desc: 'Crew heal another 100% faster.', req: 'med-voice', level: 11, mods: { heal: 1 } },
  { id: 'med-diet', cls: 'medic', name: 'Nutritionist', desc: 'Crew eat 10% less.', level: 2, mods: { foodEff: 0.1 } },
  { id: 'med-tough', cls: 'medic', name: 'Inoculation', desc: '+20 health on landings.', req: 'med-diet', level: 4, mods: { hp: 20 } },
  { id: 'med-haggle', cls: 'medic', name: 'Haggler', desc: 'Prices 6% better.', req: 'med-tough', level: 7, mods: { trade: 0.06 } },
  { id: 'med-iron', cls: 'medic', name: 'Iron Constitution', desc: '+2 Grit.', req: 'med-haggle', level: 11, mods: { grit: 2 } },
  // Soldier — combat
  { id: 'sol-aim', cls: 'soldier', name: 'Marksman', desc: '+20% damage on landings.', level: 2, mods: { awayDmg: 0.2 } },
  { id: 'sol-rate', cls: 'soldier', name: 'Rapid Fire', desc: 'Shoot 20% faster on landings.', req: 'sol-aim', level: 4, mods: { fireRate: 0.2 } },
  { id: 'sol-reach', cls: 'soldier', name: 'Long Barrel', desc: '+1.5 tiles of range.', req: 'sol-rate', level: 7, mods: { range: 1.5 } },
  { id: 'sol-wrath', cls: 'soldier', name: 'Wrath', desc: '+35% damage on landings.', req: 'sol-reach', level: 11, mods: { awayDmg: 0.35 } },
  { id: 'sol-tough', cls: 'soldier', name: 'Body Armour', desc: '+25 health on landings.', level: 2, mods: { hp: 25 } },
  { id: 'sol-gun', cls: 'soldier', name: 'Gunnery', desc: '+10% weapon damage.', req: 'sol-tough', level: 4, mods: { weaponDmg: 0.1 } },
  { id: 'sol-grit', cls: 'soldier', name: 'Stubborn', desc: '+2 Grit.', req: 'sol-gun', level: 7, mods: { grit: 2 } },
  { id: 'sol-shield', cls: 'soldier', name: 'Hardened Suit', desc: '+40 suit shielding.', req: 'sol-grit', level: 11, mods: { suitShield: 40 } },
];
export const SKILL = new Map(SKILLS.map((s) => [s.id, s]));
export function skillsFor(cls: ClassId): SkillDef[] {
  return SKILLS.filter((s) => s.cls === cls);
}
