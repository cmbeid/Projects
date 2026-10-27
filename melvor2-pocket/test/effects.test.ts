import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { newState } from '../src/engine/state';
import { unlockEverything } from '../src/engine/navigation';
import { maxHit } from '../src/engine/combat/stats';
import { effectsView, equip, fight, playerFighter } from '../src/engine/combat/combat';
import { effectsOn, isStunned } from '../src/engine/combat/effects';

const id = (s: string) => `MelvorBase:${s}`;
const SEC = 60; // ticks
const fresh = (seed = 1) => {
  const g = new Game(newState(0, seed));
  unlockEverything(g);
  g.state.xp.Hitpoints = 1e7; // sturdy enough to fight for a while
  g.state.xp.Defence = 1e6;
  return g;
};
const startFight = (g: Game, area: string, enemy: string) => {
  fight(g, id(area), id(enemy));
  g.advance(4 * SEC); // past the spawn
  expect(g.state.combat.phase).toBe('fighting');
};

describe('combat effects', () => {
  it('a Green Slime regenerates from the start of the fight (its Slime passive)', () => {
    const g = fresh();
    startFight(g, 'SlimeForest', 'GreenSlime');
    expect(effectsView(g, 'enemy').map((e) => e.name)).toContain('Rejuvenate');
  });

  it("Slime Forest's area effect ensnares you as you attack", () => {
    const g = fresh(3);
    startFight(g, 'SlimeForest', 'GreenSlime');
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) {
      g.advance(SEC);
      seen = effectsView(g, 'player').some((e) => e.name === 'Ensnared');
    }
    expect(seen).toBe(true);
  });

  it('effects end with the fight', () => {
    const g = fresh();
    startFight(g, 'SlimeForest', 'GreenSlime');
    expect(effectsOn(g, 'enemy').length).toBeGreaterThan(0);
    g.stop();
    fight(g, id('SlimeForest'), id('GreenSlime'));
    expect(effectsOn(g, 'enemy').length).toBe(0);
  });

  it('a stunned character skips its turn', () => {
    const g = fresh();
    startFight(g, 'GolbinForest', 'Golbin');
    g.state.combat.effects!.player.push({ id: 'Stun', kind: 'Stun', source: 'enemy', stacks: 1, turns: 1 });
    expect(isStunned(g, 'player')).toBe(true);
    const hp = g.state.combat.enemyHp;
    g.advance(Math.max(1, g.state.combat.playerLeft));
    expect(g.state.combat.enemyHp).toBe(hp);
    expect(isStunned(g, 'player')).toBe(false);
  });

  it('elemental matchups change max hit: Air magic hits an Earth slime 15% harder than Water magic', () => {
    const g = fresh();
    g.addItem(id('AirWand'), 1);
    expect(equip(g, id('AirWand'))).toBeNull();
    g.state.combat.stance = id('Offensive');
    g.addItem(id('AirRune'), 1000);
    g.addItem(id('WaterRune'), 1000);
    g.addItem(id('MindRune'), 1000);
    g.state.combat.spell = id('AirStrike');
    startFight(g, 'SlimeForest', 'GreenSlime');
    const air = maxHit(playerFighter(g));
    g.state.combat.spell = id('WaterStrike');
    const water = maxHit(playerFighter(g));
    expect(playerFighter(g).style.Id).toBe('Magic');
    // Water vs Earth has no matchup; Air vs Earth is +15% max hit (the spells' base max hits are close).
    expect(air).toBeGreaterThan(water);
  });

  it('damage over time procs on its own timer', () => {
    const g = fresh();
    startFight(g, 'GolbinForest', 'Golbin');
    // Hold the player still with a long stun so only the burn hurts the Golbin.
    g.state.combat.effects!.player.push({ id: 'Stun', kind: 'Stun', source: 'enemy', stacks: 1, turns: 99 });
    g.state.combat.effects!.enemy.push({ id: 'Burn', kind: 'DamageOverTime', source: 'player', stacks: 1, procs: 0, procLeft: 1, perProc: 3 });
    const hp = g.state.combat.enemyHp;
    const kills = g.state.combat.kills[id('Golbin')] ?? 0;
    // Effects added outside a turn are picked up at the fight's next scheduled event.
    g.advance(g.state.combat.pending + 1);
    // The burn alone (the player is stunned) either wore the Golbin down or killed it.
    expect(g.state.combat.enemyHp < hp || (g.state.combat.kills[id('Golbin')] ?? 0) > kills).toBe(true);
  });
});
