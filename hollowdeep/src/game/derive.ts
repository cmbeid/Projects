import { biomeAt } from '../data/biomes';
import { GEAR_BASE } from '../data/gear';
import { BALANCE, MACHINES } from '../data/progression';
import type { StatKey } from '../data/types';
import type { GameState } from '../state/types';

export interface Derived {
  tap: number;
  critChance: number;
  critMult: number;
  luck: number;
  light: number;
  heatProof: boolean;
  staminaMax: number;
  staminaRegen: number;
  autoDps: number;
  machineCrit: number;
  xpMult: number;
  oreMult: number;
  sellMult: number;
  refineSpeed: number;
  offlineHours: number;
  offlineYield: number;
  seamMult: number;
  hazard: { tap: number; auto: number; luck: number; warning: string | null };
}

const lvl = (rec: Record<string, number>, id: string): number => rec[id] ?? 0;

/** Sums one stat across every equipped piece, base and affixes. */
export function gearStat(s: GameState, stat: StatKey): number {
  let total = 0;
  for (const uid of Object.values(s.equipped)) {
    if (uid == null) continue;
    const item = s.gear.find((g) => g.uid === uid);
    if (!item) continue;
    total += GEAR_BASE.get(item.base)?.stats[stat] ?? 0;
    for (const a of item.affixes) if (a.stat === stat) total += a.value;
  }
  return total;
}

export function sharpenBase(level: number): number {
  return (1 + level) * 2 ** Math.floor(level / 10);
}

/**
 * Everything the miner's state adds up to. Recomputed on demand rather than
 * cached: it is a few dozen multiplications, and a cache would be one more
 * thing to forget to invalidate.
 */
export function derive(s: GameState): Derived {
  const p = s.passives;
  const e = s.echoUpgrades;
  const u = s.upgrades;
  const biome = biomeAt(s.depth);

  const light = gearStat(s, 'light');
  const heatProof = gearStat(s, 'heatRes') > 0;
  const hazard = { tap: 1, auto: 1, luck: 1, warning: null as string | null };
  const pen = BALANCE.hazardPenalty;
  if (biome.hazard === 'spore' && !s.fixtures.includes('filters')) {
    hazard.auto = pen;
    hazard.warning = 'Spores are choking your machines. Craft Spore Filters.';
  } else if (biome.hazard === 'heat') {
    if (!heatProof) hazard.tap = pen;
    if (!s.fixtures.includes('coolant')) hazard.auto = pen;
    if (!heatProof || !s.fixtures.includes('coolant')) {
      hazard.warning = [!heatProof && 'heat-proof armour', !s.fixtures.includes('coolant') && 'Coolant Lines']
        .filter(Boolean)
        .join(' and ');
      hazard.warning = `The heat is slowing you. You need ${hazard.warning}.`;
    }
  } else if (biome.hazard === 'dark' && light < BALANCE.darkLight) {
    hazard.tap = pen;
    hazard.luck = 0.5;
    hazard.warning = `Too dark to see the veins. You need a lantern with ${BALANCE.darkLight} light.`;
  }

  const hum = lvl(e, 'hum') > 0 ? 1 + 0.02 * s.echoes : 1;

  const tap =
    sharpenBase(lvl(u, 'sharpen')) *
    (1 + 0.1 * s.stats.str) *
    (1 + gearStat(s, 'dmgPct') / 100) *
    (1 + 0.15 * lvl(p, 'heavy')) *
    2 ** lvl(e, 'resonance') *
    hum *
    hazard.tap;

  const critChance = Math.min(
    75,
    BALANCE.baseCrit + 0.5 * s.stats.dex + lvl(u, 'grip') + 2 * lvl(p, 'keen') + gearStat(s, 'critChance'),
  );
  const critMult = BALANCE.baseCritMult + 0.01 * s.stats.dex + 0.3 * lvl(p, 'brutal') + gearStat(s, 'critMult');

  const luck =
    (s.stats.lck + gearStat(s, 'luck') + 4 * lvl(p, 'lucky') + 6 * lvl(e, 'omen') +
      (s.buffs.dowse > 0 ? 30 : 0) + (s.buffs.luck > 0 ? 40 : 0)) * hazard.luck;

  let autoBase = 0;
  for (const m of MACHINES) {
    let dps = m.dps * lvl(s.machines, m.id);
    if (m.id === 'drone' && s.fixtures.includes('workshop')) dps *= 2;
    autoBase += dps;
  }
  const autoDps =
    autoBase *
    1.25 ** lvl(u, 'tuning') *
    (1 + gearStat(s, 'autoPct') / 100) *
    (1 + 0.15 * lvl(p, 'oiled')) *
    2 ** lvl(e, 'ghosts') *
    hum *
    hazard.auto;

  const overclock = lvl(p, 'overclock');
  return {
    tap,
    critChance,
    critMult,
    luck,
    light,
    heatProof,
    staminaMax: BALANCE.baseStamina + 5 * s.stats.end + gearStat(s, 'stamina'),
    staminaRegen: BALANCE.staminaRegen + 0.05 * s.stats.end,
    autoDps,
    machineCrit: overclock > 0 ? critChance * (0.5 + 0.1 * (overclock - 1)) : 0,
    xpMult:
      (1 + gearStat(s, 'xpPct') / 100) * (1 + 0.12 * lvl(p, 'scholar')) * (1 + 0.3 * lvl(e, 'study')) *
      (s.buffs.sage > 0 ? 2 : 1),
    oreMult:
      (1 + 0.1 * lvl(u, 'cart')) * (1 + gearStat(s, 'orePct') / 100) * (1 + 0.1 * lvl(p, 'geologist')) *
      (s.buffs.dowse > 0 ? 2 : 1),
    sellMult: (1 + 0.08 * lvl(u, 'haggle')) * (1 + 0.1 * lvl(p, 'assayer')) * 1.5 ** lvl(e, 'ledger'),
    refineSpeed: (1 + 0.25 * lvl(u, 'bellows')) * (1 + 0.2 * lvl(p, 'tinker')) * (1 + 0.3 * lvl(e, 'embers')),
    offlineHours: BALANCE.offlineHours + lvl(p, 'nightshift') + 2 * lvl(e, 'longnight'),
    offlineYield: 1 + 0.1 * lvl(p, 'nightshift'),
    seamMult: 1 + 0.25 * lvl(p, 'seambreaker'),
    hazard,
  };
}
