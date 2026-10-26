import { describe, expect, it } from 'vitest';
import { describeBonus } from '../src/engine/describe';

const ctx = (entity: string) => ({ Component: { Entity: `MelvorBase:${entity}`, Component: 'Action' } });

describe('bonus descriptions', () => {
  it('use the game\'s templates and formats', () => {
    expect(describeBonus({ Stat: { StatsType: 'MelvorBase:FishingAction', Name: 'FlatFishChance' }, Value: 0.03, LocalContext: ctx('Fishing') }))
      .toBe('+3% flat chance to catch a Fish in Fishing');
    expect(describeBonus({ Stat: { StatsType: 'MelvorBase:MagicSpell', Name: 'FlatRuneCost' }, Value: -1, LocalContext: { ...ctx('Combat'), Rune: 'MelvorBase:AirRune' } }))
      .toMatch(/^-1 .*Air Rune/);
  });
});
