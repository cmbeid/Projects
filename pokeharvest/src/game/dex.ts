/** Pokédex rewards. */
import { DEX_REWARDS } from '../data/dex';
import { giveItem } from './farm';
import type { World } from './model';

/** Milestones reached but not yet claimed. */
export function claimable(world: World): number[] {
  return DEX_REWARDS.filter((r) => world.caught.length >= r.caught && !world.dexClaimed.includes(r.caught)).map((r) => r.caught);
}

export function claimDexReward(world: World, caught: number): boolean {
  const reward = DEX_REWARDS.find((r) => r.caught === caught);
  if (!reward || !claimable(world).includes(caught)) return false;
  world.dexClaimed.push(caught);
  if (reward.gold) world.player.gold += reward.gold;
  for (const [id, n] of Object.entries(reward.items ?? {})) giveItem(world, id, n);
  return true;
}
