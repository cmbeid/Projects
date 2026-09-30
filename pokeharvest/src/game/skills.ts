/** The farmer's skills: experience in, levels and perk choices out. */
import { PERKS, skillLevel, type Skill } from '../data/progress';
import { MAX_ENERGY, type World } from './model';

export const ENERGY_PER_FARMING_LEVEL = 3;

export function levelOf(world: World, skill: Skill): number {
  return skillLevel(world.skills[skill]);
}

export function maxEnergyFor(world: World): number {
  return MAX_ENERGY + ENERGY_PER_FARMING_LEVEL * (levelOf(world, 'farming') - 1);
}

export function addSkillXp(world: World, skill: Skill, amount: number): void {
  const before = levelOf(world, skill);
  world.skills[skill] += amount;
  const after = levelOf(world, skill);
  for (let level = before + 1; level <= after; level += 1) {
    world.events.push({ kind: 'skill', skill, level });
    if (level === 5 || level === 10) world.pendingPerks.push({ skill, level });
  }
  if (skill === 'farming' && after > before) {
    const max = maxEnergyFor(world);
    world.player.energy += max - world.player.maxEnergy;
    world.player.maxEnergy = max;
  }
}

/** Take one of the two perks offered at a milestone. */
export function choosePerk(world: World, perkId: string): boolean {
  const pending = world.pendingPerks[0];
  if (!pending) return false;
  const options = PERKS[pending.skill][pending.level];
  if (!options.some((p) => p.id === perkId)) return false;
  world.perks.push(perkId);
  world.pendingPerks.shift();
  return true;
}
