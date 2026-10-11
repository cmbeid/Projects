import { BIOME } from '../../data/biomes';
import { CLASS } from '../../data/crew';
import { LORE } from '../../data/lore';
import { MAT } from '../../data/materials';
import { BAL } from '../../data/progression';
import type { MatId } from '../../data/types';
import type { AwayState, GameState } from '../../state/types';
import { gainMats } from '../crafting';
import { grantXp, setMorale } from '../crew';
import { conscious, crewMods, maxHp } from '../derive';
import { node } from '../galaxy';
import { addLog } from '../log';
import { openEvent } from '../events';
import { surveyDone } from '../station';
import { checkRescue, currentMission } from '../story';
import { AWAY_H, AWAY_W, generateMap, populate } from './gen';

export const LAND_ENERGY = 2;

export function canLand(s: GameState, planetIdx: number, crewId: number): string | null {
  const n = node(s);
  const p = n.planets[planetIdx];
  if (s.screen !== 'map') return 'Busy';
  if (!p) return 'No such planet';
  if (p.landings >= BAL.planetLandings && !(p.objective && currentMission(s)?.id === p.objective)) return 'Picked clean';
  const c = s.crew.find((m) => m.id === crewId);
  if (!c || !conscious(c)) return 'They can\'t go down like this';
  if (s.res.energy < LAND_ENERGY) return `Needs ${LAND_ENERGY} energy`;
  return null;
}

export function createAway(s: GameState, planetIdx: number, crewId: number): boolean {
  if (canLand(s, planetIdx, crewId)) return false;
  const n = node(s);
  const p = n.planets[planetIdx]!;
  const c = s.crew.find((m) => m.id === crewId)!;
  const m = crewMods(s, c);
  const lander = s.modules.lander - 1;
  const seed = (p.seed + p.landings * 7919) | 0;
  const { tiles, lander: pad } = generateMap(seed, p.biome, p.size);
  const hpMax = Math.round(BAL.away.hp + c.stats.grit * 4 + (m.hp ?? 0));
  const o2Max = Math.round(BAL.away.o2 + (m.o2 ?? 0) + lander * 20);
  const shieldMax = Math.round(BAL.away.shield + (m.suitShield ?? 0));
  const objective = p.objective && currentMission(s)?.id === p.objective ? p.objective : null;
  const a: AwayState = {
    seed,
    rng: seed ^ 0x2545f491,
    stats: {
      speed: BAL.away.speed * (1 + (m.speed ?? 0) + c.stats.reflex * 0.015),
      dmg: BAL.away.dmg * (1 + (m.awayDmg ?? 0)) * (1 + c.stats.reflex * 0.03),
      fireCd: BAL.away.fireCd / (1 + (m.fireRate ?? 0)),
      range: BAL.away.range + (m.range ?? 0),
      gather: (1 + (m.gather ?? 0)) * (1 + s.sector.index * BAL.away.sectorYield),
      cls: c.cls,
    },
    biome: p.biome,
    planet: p.name,
    node: n.id,
    planetIdx,
    crewId,
    w: AWAY_W,
    h: AWAY_H,
    tiles,
    x: pad.x,
    y: pad.y - 1.2,
    fx: 0,
    fy: -1,
    o2: o2Max,
    o2Max,
    shield: shieldMax,
    shieldMax,
    hp: Math.min(hpMax, Math.round(hpMax * Math.max(0.35, c.hp / maxHp(c)))),
    hpMax,
    carry: 0,
    carryMax: Math.round(BAL.away.carry + (m.carry ?? 0) + [0, 6, 12, 20][lander]!),
    haul: {},
    items: {},
    colonists: 0,
    terminals: 0,
    gotObjective: false,
    objective,
    ents: [],
    shots: [],
    lander: pad,
    t: 0,
    fireCd: 0,
    gatherCd: 0,
    skillCd: 0,
    skillMax: CLASS.get(c.cls)!.away.cooldown * (1 - Math.min(0.6, m.skillCd ?? 0)),
    dash: 0,
    status: 'play',
    pops: [],
    nextEnt: 1,
    kills: 0,
    events: [],
  };
  populate(a, seed, { sector: s.sector.index, pods: p.pods, ruin: p.ruin, objective, size: p.size });
  s.res.energy -= LAND_ENERGY;
  s.away = a;
  s.screen = 'away';
  s.stats.landings++;
  if (!s.codex.biomes.includes(p.biome)) s.codex.biomes.push(p.biome);
  for (const f of BIOME.get(p.biome)!.fauna) if (!s.codex.fauna.includes(f)) s.codex.fauna.push(f);
  return true;
}

/** Ship's consumables can be used on the ground: air and medkits. */
export function useAwayItem(s: GameState, id: 'o2can' | 'medkit'): boolean {
  const a = s.away;
  if (!a || a.status !== 'play' || s.items[id] <= 0) return false;
  s.items[id]--;
  if (id === 'o2can') a.o2 = Math.min(a.o2Max + 30, a.o2 + 60);
  else a.hp = Math.min(a.hpMax, a.hp + 40);
  a.events.push(id);
  return true;
}

/** Back aboard: bank the haul, or count the cost if the explorer went down. */
export function endAway(s: GameState): void {
  const a = s.away;
  if (!a || a.status === 'play') return;
  const n = s.sector.nodes[a.node]!;
  const p = n.planets[a.planetIdx]!;
  const c = s.crew.find((m) => m.id === a.crewId);
  p.landings++;
  p.scanned = true;
  // Sleepers left behind are still there next time; so is an unread terminal.
  if (a.status === 'done') {
    p.pods = Math.max(0, p.pods - a.colonists);
    if (a.terminals) p.ruin = false;
  }
  const lines: string[] = [];
  let title: string;
  if (a.status === 'done') {
    title = `Back from ${a.planet}`;
    const haul = a.haul;
    gainMats(s, haul);
    let total = 0;
    for (const [m, v] of Object.entries(haul) as [MatId, number][]) {
      if (!v) continue;
      total += v;
      lines.push(`+${v} ${MAT.get(m)!.name}`);
    }
    s.stats.gathered += total;
    for (const [k, v] of Object.entries(a.items)) {
      s.items[k as keyof typeof s.items] += v;
      lines.push(`+${v} ${k === 'o2can' ? 'O₂ canister' : k === 'medkit' ? 'Medkit' : 'Ration crate'}`);
    }
    if (a.colonists) {
      s.colonists += a.colonists;
      lines.push(`+${a.colonists} colonist${a.colonists === 1 ? '' : 's'} rescued`);
    }
    for (let i = 0; i < a.terminals; i++) {
      const next = LORE.find((l) => l.sector <= s.sector.index && !s.lore.includes(l.id)) ?? LORE.find((l) => !s.lore.includes(l.id));
      if (next) {
        s.lore.push(next.id);
        lines.push(`Log found: “${next.title}”`);
      }
    }
    if (c) {
      c.hp = Math.max(1, Math.round(maxHp(c) * (a.hp / a.hpMax)));
      setMorale(c, c.morale + 4);
    }
    lines.push(...surveyDone(s, a.node));
    lines.push(`+${20 + 6 * s.sector.index + a.kills * 3} XP`, ...grantXp(s, 20 + 6 * s.sector.index + a.kills * 3));
    addLog(s, `Landed on ${a.planet}: ${total} materials${a.colonists ? `, ${a.colonists} sleepers` : ''}.`, 'away');
  } else {
    title = `Lost on ${a.planet}`;
    lines.push('The lander\'s autopilot brought the explorer home. The haul was left behind.');
    if (c) {
      c.hp = 1;
      setMorale(c, c.morale - 15);
      lines.push(`${c.name} is badly hurt`);
    }
    addLog(s, `A landing on ${a.planet} went wrong.`, 'warn');
  }
  s.stats.kills += a.kills;
  s.away = null;
  s.screen = 'map';
  lines.push(...checkRescue(s));
  s.report = { title, lines };
  if (a.status === 'done' && a.gotObjective && a.objective && currentMission(s)?.id === a.objective) openEvent(s, a.objective, 'story');
}
