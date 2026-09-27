/**
 * One battle on one map: the whole simulation, with no DOM, so all of it runs
 * under Vitest and in the headless playtest bot.
 *
 * The UI calls the command functions (`placeTower`, `levelUp`, `startWave`,
 * `usePowerup`, `throwBall`…) and `step` at a fixed 60 Hz. Everything the
 * renderer and audio need to know about — shots, hits, faints, evolutions —
 * is pushed onto `game.events`, which they drain each frame.
 *
 * Positions are in tiles; (0, 0) is the top-left corner of the map, so the
 * centre of tile (x, y) is (x + 0.5, y + 0.5).
 */
import {
  BALLS, type BallKey, DROP_CHANCE, DROPS, NO_TRAINER, POWERUPS, type PowerupKey, type TrainerLevels,
} from '../data/items';
import { BUILDABLE, COLS, type MapDef, pathTiles, ROWS, terrainAt } from '../data/maps';
import { type Ability, species, type Species } from '../data/species';
import { type AttackKind, type Effects, levelCost, line, MAX_LEVEL, type TowerLine } from '../data/towers';
import { effectiveness, type PokeType } from '../data/types';
import { buildPath, type PathGeom, pointAt } from './path';
import { makeRng, pickWeighted, type Rng } from './rng';
import { stageIndex, type TowerStats, towerStats } from './stats';
import {
  bountyScale, buildWave, DIFFICULTIES, type DifficultyKey, hpScale, isBossWave, type Spawn, waveBonus, waveCount,
} from './waves';

export const STEP = 1 / 60;
export const BASE_LIVES = 20;
/** Chance that any one wild Pokémon is shiny. */
export const SHINY_CHANCE = 1 / 128;
/**
 * Bosses and mid-map leads lumber: their HP is many times anyone else's, and
 * at full speed they'd cross the map before most towers get a proper go at them.
 */
export const BOSS_SPEED = 0.5;
export const LEAD_SPEED = 0.75;

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'close'];

export interface Status {
  burnUntil: number; burnDps: number;
  poisonUntil: number; poisonDps: number; poisonPer: number; poisonStacks: number;
  slowUntil: number; slow: number;
  sleepUntil: number;
  paraUntil: number;
  confuseUntil: number;
  flinchUntil: number;
  weakenUntil: number;
  shieldUntil: number;
  vanishUntil: number;
  dashUntil: number; dash: number;
}

const NO_STATUS: Status = {
  burnUntil: 0, burnDps: 0, poisonUntil: 0, poisonDps: 0, poisonPer: 0, poisonStacks: 0, slowUntil: 0, slow: 0,
  sleepUntil: 0, paraUntil: 0, confuseUntil: 0, flinchUntil: 0, weakenUntil: 0, shieldUntil: 0,
  vanishUntil: 0, dashUntil: 0, dash: 1,
};

export interface Catching {
  ball: BallKey;
  until: number;
  shakes: number;
  success: boolean;
  started: number;
}

export interface Enemy {
  id: number;
  dex: number;
  sp: Species;
  shiny: boolean;
  wave: number;
  path: number;
  dist: number;
  x: number;
  y: number;
  /** −1 facing left, 1 right. */
  facing: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  bounty: number;
  boss: boolean;
  lead: boolean;
  rare: boolean;
  lives: number;
  born: number;
  abilities: { ability: Ability; next: number }[];
  healed: boolean;
  status: Status;
  catching: Catching | null;
  revealed: boolean;
  alive: boolean;
  /** Seconds left of the red flash after a hit. */
  flash: number;
}

export interface Tower {
  id: number;
  line: TowerLine;
  x: number;
  y: number;
  level: number;
  branch: number | null;
  move: number | null;
  target: TargetMode;
  cooldown: number;
  /** ₽ earned toward the next level, from knockouts. Discounts it by up to half. */
  xp: number;
  invested: number;
  kills: number;
  damageDone: number;
  stunnedUntil: number;
  facing: number;
  /** When it last attacked, for the attack animation. */
  lastShot: number;
  /** The wave count when it was placed: selling it before the next wave refunds everything. */
  placedAt: number;
  stats: TowerStats;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  tx: number;
  ty: number;
  towerId: number;
  damage: number;
  type: PokeType;
  splash: number;
  effects: Effects;
  groundOnly: boolean;
}

export interface Drop {
  id: number;
  x: number;
  y: number;
  item: PowerupKey | BallKey;
  until: number;
}

export type GameEvent =
  | { kind: 'spawn'; id: number; dex: number; boss: boolean; shiny: boolean; rare: boolean }
  | { kind: 'place'; id: number; dex: number; x: number; y: number }
  | { kind: 'level'; id: number; dex: number; level: number; evolved: boolean; x: number; y: number }
  | { kind: 'move'; id: number; name: string; x: number; y: number }
  | { kind: 'sell'; x: number; y: number; refund: number }
  | { kind: 'attack'; tower: number; attack: AttackKind; type: PokeType; x: number; y: number; points: { x: number; y: number }[]; radius: number }
  | { kind: 'hit'; x: number; y: number; type: PokeType; damage: number; crit: boolean; eff: number }
  | { kind: 'splash'; x: number; y: number; type: PokeType; radius: number }
  | { kind: 'faint'; id: number; x: number; y: number; dex: number; bounty: number; boss: boolean }
  | { kind: 'evolveEnemy'; id: number; dex: number; x: number; y: number }
  | { kind: 'leak'; dex: number; lives: number }
  | { kind: 'waveStart'; wave: number; boss: boolean; early: number }
  | { kind: 'waveClear'; wave: number; bonus: number }
  | { kind: 'ability'; ability: Ability['kind']; x: number; y: number; radius: number }
  | { kind: 'stunTowers'; x: number; y: number; radius: number }
  | { kind: 'drop'; id: number; item: string }
  | { kind: 'pickup'; item: string; x: number; y: number }
  | { kind: 'throw'; ball: BallKey; x: number; y: number; id: number }
  | { kind: 'shake'; x: number; y: number }
  | { kind: 'catch'; dex: number; shiny: boolean; success: boolean; x: number; y: number }
  | { kind: 'powerup'; key: PowerupKey; x: number; y: number }
  | { kind: 'money'; amount: number; x: number; y: number }
  | { kind: 'bossFailed'; wave: number }
  | { kind: 'won' }
  | { kind: 'lost' };

/** Everything a retry rewinds. Catches and the Pokédex are kept. */
interface Checkpoint {
  wave: number;
  state: Pick<Game, 't' | 'money' | 'lives' | 'wave' | 'cleared' | 'pending' | 'openWaves' | 'enemies' | 'towers' | 'buffs' | 'cooldowns' | 'items' | 'balls'> & {
    log: Omit<Game['log'], 'caught' | 'seen'>;
  };
}

export interface BattleSetup {
  map: MapDef;
  difficulty: DifficultyKey;
  /** Tower lines the player brought. */
  team: readonly string[];
  items: Partial<Record<PowerupKey, number>>;
  balls: Partial<Record<BallKey, number>>;
  /** Held item per line id. */
  held: Readonly<Record<string, string>>;
  trainer: TrainerLevels;
  seed: number;
}

export interface Game {
  map: MapDef;
  difficulty: DifficultyKey;
  /** Lines that can be placed. A catch that unlocks a new line joins it mid-battle. */
  team: string[];
  rng: Rng;
  paths: PathGeom[];
  pathSet: Set<string>;
  t: number;
  money: number;
  lives: number;
  maxLives: number;
  /** Waves started so far. */
  wave: number;
  totalWaves: number;
  pending: { at: number; wave: number; spawn: Spawn }[];
  openWaves: Set<number>;
  cleared: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  drops: Drop[];
  events: GameEvent[];
  nextId: number;
  buffs: { xAttack: number; xSpeed: number; repel: number; scope: number; amulet: number };
  cooldowns: Partial<Record<PowerupKey, number>>;
  items: Record<PowerupKey, number>;
  balls: Record<BallKey, number>;
  held: Readonly<Record<string, string>>;
  trainer: TrainerLevels;
  /**
   * `retry`: a gym leader's Pokémon got through (or the lives ran out before
   * it fell). The battle waits for `retryWave`, which rewinds to the start of
   * that wave, or for the player to give up.
   */
  status: 'playing' | 'won' | 'lost' | 'retry';
  /** Saved as a boss wave starts, so a failed one can be tried again. */
  checkpoint: Checkpoint | null;
  /** A boss reached the end of the path during the checkpointed wave. */
  bossLeaked: boolean;
  /** Times the current boss wave has been retried. */
  retries: number;
  autoWave: boolean;
  autoAt: number | null;
  /** What happened, for the results screen and the save. */
  log: {
    kills: number;
    leaked: number;
    caught: { dex: number; shiny: boolean }[];
    seen: Set<number>;
    found: (PowerupKey | BallKey)[];
    used: PowerupKey[];
    ballsUsed: BallKey[];
    earned: number;
  };
}

// --- setup -------------------------------------------------------------------

export function newGame(setup: BattleSetup): Game {
  const { map, trainer } = setup;
  const diff = DIFFICULTIES[setup.difficulty];
  const maxLives = BASE_LIVES + trainer.lives * 2;
  const items = Object.fromEntries(Object.keys(POWERUPS).map((k) => [k, setup.items[k as PowerupKey] ?? 0])) as Record<PowerupKey, number>;
  const balls = Object.fromEntries(Object.keys(BALLS).map((k) => [k, setup.balls[k as BallKey] ?? 0])) as Record<BallKey, number>;
  balls['poke-ball'] += trainer.pouch;
  return {
    map,
    difficulty: setup.difficulty,
    team: [...setup.team],
    rng: makeRng(setup.seed),
    paths: map.paths.map((_, i) => buildPath(map, i)),
    pathSet: pathTiles(map),
    t: 0,
    money: Math.round(map.startMoney * diff.money * (1 + trainer.wallet * 0.1)),
    lives: maxLives,
    maxLives,
    wave: 0,
    totalWaves: waveCount(map),
    pending: [],
    openWaves: new Set(),
    cleared: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    drops: [],
    events: [],
    nextId: 1,
    buffs: { xAttack: 0, xSpeed: 0, repel: 0, scope: 0, amulet: 0 },
    cooldowns: {},
    items,
    balls,
    held: setup.held,
    trainer: { ...NO_TRAINER, ...trainer },
    status: 'playing',
    checkpoint: null,
    bossLeaked: false,
    retries: 0,
    autoWave: false,
    autoAt: null,
    log: { kills: 0, leaked: 0, caught: [], seen: new Set(), found: [], used: [], ballsUsed: [], earned: 0 },
  };
}

function emit(g: Game, e: GameEvent): void {
  g.events.push(e);
}

/** Multiplier on everything the player pays for towers. */
function priceFactor(g: Game): number {
  return 1 - g.trainer.discount * 0.04;
}

export function placeCost(g: Game, lineId: string): number {
  return Math.round(line(lineId).cost * priceFactor(g));
}

export function upgradeCost(g: Game, tower: Tower): { cost: number; discount: number } {
  const full = Math.round(levelCost(tower.line, tower.level) * priceFactor(g));
  const discount = Math.min(Math.floor(tower.xp), Math.floor(full / 2));
  return { cost: full - discount, discount };
}

export function moveCost(g: Game, tower: Tower, index: number): number {
  return Math.round(tower.line.moves[index]!.cost * priceFactor(g));
}

export function sellValue(g: Game, tower: Tower): number {
  if (tower.placedAt === g.wave && g.openWaves.size === 0) return tower.invested;
  return Math.floor(tower.invested * (0.7 + g.trainer.refund * 0.1));
}

function setupFor(g: Game, t: Pick<Tower, 'line' | 'level' | 'branch' | 'move' | 'x' | 'y'>): TowerStats {
  return towerStats(t.line, {
    level: t.level,
    branch: t.branch,
    move: t.move,
    held: g.held[t.line.id] ?? null,
    ledge: terrainAt(g.map, t.x, t.y) === 'ledge',
  });
}

// --- placing and upgrading --------------------------------------------------

export function towerAt(g: Game, x: number, y: number): Tower | undefined {
  return g.towers.find((t) => t.x === x && t.y === y);
}

export type PlaceError = 'outside' | 'occupied' | 'terrain' | 'money' | 'team';

/** Whether a tower of `lineId` could go on tile (x, y), and why not. */
export function canPlace(g: Game, lineId: string, x: number, y: number): PlaceError | null {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return 'outside';
  if (!g.team.includes(lineId)) return 'team';
  if (towerAt(g, x, y)) return 'occupied';
  const l = line(lineId);
  const onPath = g.pathSet.has(`${x},${y}`);
  const terrain = terrainAt(g.map, x, y);
  const land = !onPath && BUILDABLE.has(terrain);
  const water = !onPath && terrain === 'water';
  const ok =
    l.placement === 'path' ? onPath && !isWarpPad(g, x, y)
    : l.placement === 'water' ? water
    : l.placement === 'any' ? land || water
    : land;
  if (!ok) return 'terrain';
  if (g.money < placeCost(g, lineId)) return 'money';
  return null;
}

function isWarpPad(g: Game, x: number, y: number): boolean {
  return g.paths.some((p) => p.points.some((pt, i) => i > 0 && p.cum[i] === p.cum[i - 1] && Math.floor(pt.x) === x && Math.floor(pt.y) === y));
}

export function placeTower(g: Game, lineId: string, x: number, y: number): Tower | PlaceError {
  const err = canPlace(g, lineId, x, y);
  if (err) return err;
  const cost = placeCost(g, lineId);
  g.money -= cost;
  const l = line(lineId);
  const base = { line: l, level: 1, branch: null, move: null, x, y };
  const tower: Tower = {
    id: g.nextId++, ...base, target: 'first', cooldown: 0, xp: 0, invested: cost, kills: 0, damageDone: 0,
    stunnedUntil: 0, facing: x < COLS / 2 ? 1 : -1, lastShot: -1, placedAt: g.wave, stats: setupFor(g, base),
  };
  g.towers.push(tower);
  emit(g, { kind: 'place', id: tower.id, dex: tower.stats.dex, x: x + 0.5, y: y + 0.5 });
  return tower;
}

export type LevelError = 'max' | 'money' | 'branch';

/** Whether the next level needs Eevee's evolution stone chosen first. */
export function needsBranch(tower: Tower): boolean {
  return Boolean(tower.line.branches && tower.level + 1 === tower.line.branches.level && tower.branch === null);
}

export function levelUp(g: Game, towerId: number, opts: { free?: boolean; branch?: number } = {}): LevelError | null {
  const tower = g.towers.find((t) => t.id === towerId);
  if (!tower) return 'max';
  if (tower.level >= MAX_LEVEL) return 'max';
  if (needsBranch(tower)) {
    if (opts.branch === undefined) return 'branch';
    tower.branch = opts.branch;
  }
  if (!opts.free) {
    const { cost, discount } = upgradeCost(g, tower);
    if (g.money < cost) return 'money';
    g.money -= cost;
    tower.xp -= discount;
    tower.invested += cost;
  }
  const before = tower.stats.dex;
  tower.level += 1;
  tower.stats = setupFor(g, tower);
  const evolved = tower.stats.dex !== before;
  emit(g, { kind: 'level', id: tower.id, dex: tower.stats.dex, level: tower.level, evolved, x: tower.x + 0.5, y: tower.y + 0.5 });
  return null;
}

export function chooseMove(g: Game, towerId: number, index: number): 'money' | 'invalid' | null {
  const tower = g.towers.find((t) => t.id === towerId);
  if (!tower || tower.level < MAX_LEVEL || tower.move !== null || !tower.line.moves[index]) return 'invalid';
  const cost = moveCost(g, tower, index);
  if (g.money < cost) return 'money';
  g.money -= cost;
  tower.invested += cost;
  tower.move = index;
  tower.stats = setupFor(g, tower);
  emit(g, { kind: 'move', id: tower.id, name: tower.line.moves[index]!.name, x: tower.x + 0.5, y: tower.y + 0.5 });
  return null;
}

export function sellTower(g: Game, towerId: number): number {
  const i = g.towers.findIndex((t) => t.id === towerId);
  if (i < 0) return 0;
  const tower = g.towers[i]!;
  const refund = sellValue(g, tower);
  g.money += refund;
  g.towers.splice(i, 1);
  emit(g, { kind: 'sell', x: tower.x + 0.5, y: tower.y + 0.5, refund });
  return refund;
}

export function setTarget(g: Game, towerId: number, mode: TargetMode): void {
  const tower = g.towers.find((t) => t.id === towerId);
  if (tower) tower.target = mode;
}

// --- waves --------------------------------------------------------------------

export function hasNextWave(g: Game): boolean {
  return g.status === 'playing' && g.wave < g.totalWaves;
}

/** ₽ for calling the next wave while the last is still out. */
export function earlyBonus(g: Game): number {
  return g.openWaves.size > 0 ? Math.round((8 + g.wave * 1.5) * (1 + 0.1 * (g.map.tier - 1))) : 0;
}

export function startWave(g: Game): boolean {
  if (!hasNextWave(g)) return false;
  if (!g.map.endless && isBossWave(g.map, g.wave + 1)) {
    const { caught: _caught, seen: _seen, ...log } = g.log;
    g.checkpoint = {
      wave: g.wave + 1,
      state: structuredClone({
        t: g.t, money: g.money, lives: g.lives, wave: g.wave, cleared: g.cleared, pending: g.pending, openWaves: g.openWaves,
        enemies: g.enemies, towers: g.towers, buffs: g.buffs, cooldowns: g.cooldowns, items: g.items, balls: g.balls, log,
      }),
    };
    g.bossLeaked = false;
  }
  const early = earlyBonus(g);
  g.money += early;
  g.wave += 1;
  const wave = g.wave;
  const spawns = buildWave(g.map, wave);
  for (const spawn of spawns) g.pending.push({ at: g.t + spawn.at, wave, spawn });
  g.pending.sort((a, b) => a.at - b.at);
  g.openWaves.add(wave);
  g.autoAt = null;
  emit(g, { kind: 'waveStart', wave, boss: spawns.some((s) => s.boss), early });
  return true;
}

function spawnEnemy(g: Game, spawn: Spawn, wave: number, dist = 0, shinyAllowed = true): Enemy {
  const sp = species(spawn.dex);
  const diff = DIFFICULTIES[g.difficulty];
  const tier = g.map.endless ? g.map.tier + Math.floor(wave / 15) : g.map.tier;
  const maxHp = Math.round(spawn.hp * hpScale(tier, wave) * diff.hp);
  const boss = spawn.boss;
  const path = g.paths[spawn.path] ?? g.paths[0]!;
  const pos = pointAt(path, dist);
  const e: Enemy = {
    id: g.nextId++,
    dex: sp.dex,
    sp,
    shiny: shinyAllowed && !boss && g.rng() < SHINY_CHANCE,
    wave,
    path: spawn.path,
    dist,
    x: pos.x,
    y: pos.y,
    facing: pos.dx < 0 ? -1 : 1,
    hp: maxHp,
    maxHp,
    speed: (boss?.speed ?? sp.speed) * (boss ? BOSS_SPEED : spawn.lead ? LEAD_SPEED : 1),
    armor: boss?.armor ?? sp.armor,
    bounty: Math.round(sp.bounty * (spawn.hp / sp.hp) ** 0.7 * bountyScale(tier, wave) * (boss ? 3 : 1)),
    boss: Boolean(boss),
    lead: Boolean(spawn.lead),
    rare: Boolean(spawn.rare),
    // The last boss of a map costs half your lives; the Elite Four a quarter.
    lives: boss ? (boss.dex === g.map.boss.dex ? 10 : 5) : spawn.lead ? 3 : 1,
    born: g.t,
    abilities: (boss?.abilities ?? sp.abilities).map((ability) => ({ ability, next: g.t + ('every' in ability ? ability.every * (0.5 + 0.5 * g.rng()) : 0) })),
    healed: false,
    status: { ...NO_STATUS },
    catching: null,
    revealed: true,
    alive: true,
    flash: 0,
  };
  g.enemies.push(e);
  g.log.seen.add(sp.dex);
  emit(g, { kind: 'spawn', id: e.id, dex: e.dex, boss: e.boss, shiny: e.shiny, rare: e.rare });
  return e;
}

// --- power-ups ------------------------------------------------------------------

export type PowerupError = 'none' | 'cooldown' | 'target' | 'unused';

export function powerupReady(g: Game, key: PowerupKey): boolean {
  return g.items[key] > 0 && (g.cooldowns[key] ?? 0) <= g.t && g.status === 'playing';
}

/** Whether the effect of a timed power-up is still running, and for how long. */
export function buffLeft(g: Game, key: PowerupKey): number {
  const until: Partial<Record<PowerupKey, number>> = {
    'x-attack': g.buffs.xAttack, 'x-speed': g.buffs.xSpeed, 'max-repel': g.buffs.repel,
    'silph-scope': g.buffs.scope, 'amulet-coin': g.buffs.amulet,
  };
  return Math.max(0, (until[key] ?? 0) - g.t);
}

export function usePowerup(g: Game, key: PowerupKey, target: { towerId?: number; x?: number; y?: number } = {}): PowerupError | null {
  if (g.items[key] <= 0) return 'none';
  if (!powerupReady(g, key)) return 'cooldown';
  const def = POWERUPS[key];
  const until = g.t + def.duration;
  let at = { x: COLS / 2, y: ROWS / 2 };
  switch (key) {
    case 'rare-candy': {
      const tower = g.towers.find((t) => t.id === target.towerId);
      if (!tower || tower.level >= MAX_LEVEL || needsBranch(tower)) return 'target';
      levelUp(g, tower.id, { free: true });
      at = { x: tower.x + 0.5, y: tower.y + 0.5 };
      break;
    }
    case 'x-attack': g.buffs.xAttack = until; break;
    case 'x-speed': g.buffs.xSpeed = until; break;
    case 'max-repel': g.buffs.repel = until; break;
    case 'silph-scope': g.buffs.scope = until; break;
    case 'amulet-coin': g.buffs.amulet = until; break;
    case 'poke-flute':
      for (const e of g.enemies) {
        if (!e.alive) continue;
        if (e.boss) e.status.slowUntil = Math.max(e.status.slowUntil, g.t + 4), e.status.slow = Math.max(e.status.slow, 0.5);
        else e.status.sleepUntil = Math.max(e.status.sleepUntil, g.t + def.duration);
      }
      break;
    case 'full-restore':
      if (g.lives >= g.maxLives) return 'unused';
      g.lives = Math.min(g.maxLives, g.lives + 5);
      break;
    case 'tm-electric': {
      if (target.x === undefined || target.y === undefined) return 'target';
      at = { x: target.x, y: target.y };
      const power = hpScale(g.map.tier, Math.max(1, g.wave)) * 5;
      for (const e of g.enemies) {
        if (!e.alive || Math.hypot(e.x - at.x, e.y - at.y) > 1.6) continue;
        damageEnemy(g, e, power, 'electric', null, { ...NO_HIT, paralyse: 1 });
      }
      emit(g, { kind: 'splash', x: at.x, y: at.y, type: 'electric', radius: 1.6 });
      break;
    }
    case 'tm-ground': {
      const power = hpScale(g.map.tier, Math.max(1, g.wave)) * 3;
      for (const e of g.enemies) {
        if (e.alive && !e.sp.traits.includes('flying')) damageEnemy(g, e, power, 'ground', null, { ...NO_HIT, flinch: 1 });
      }
      break;
    }
  }
  g.items[key] -= 1;
  g.cooldowns[key] = g.t + def.cooldown;
  g.log.used.push(key);
  emit(g, { kind: 'powerup', key, x: at.x, y: at.y });
  return null;
}

// --- catching ---------------------------------------------------------------------

/** The Pokémon a ball thrown at (x, y) would go for, if any. */
export function catchTarget(g: Game, x: number, y: number): Enemy | undefined {
  let best: Enemy | undefined;
  let bestD = 1;
  for (const e of g.enemies) {
    if (!e.alive || e.catching || !e.revealed) continue;
    if (e.boss && !(g.map.endless && e.dex === 150)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** Probability (0–1) a ball catches this Pokémon right now. */
export function catchChance(g: Game, e: Enemy, ball: BallKey): number {
  const bonus = BALLS[ball].bonus;
  if (bonus === Infinity) return 1;
  const hpFactor = (3 * e.maxHp - 2 * Math.max(0, e.hp)) / (3 * e.maxHp);
  const s = e.status;
  const statusBonus = s.sleepUntil > g.t ? 2 : s.paraUntil > g.t || s.burnUntil > g.t || s.poisonUntil > g.t ? 1.5 : 1;
  const a = (e.sp.catchRate / 255) * hpFactor * bonus * statusBonus * (1 + g.trainer.catching * 0.15);
  return Math.min(1, a);
}

export type ThrowError = 'no-ball' | 'no-target';

export function throwBall(g: Game, ball: BallKey, x: number, y: number): Enemy | ThrowError {
  if (g.balls[ball] <= 0) return 'no-ball';
  const e = catchTarget(g, x, y);
  if (!e) return 'no-target';
  g.balls[ball] -= 1;
  g.log.ballsUsed.push(ball);
  const success = g.rng() < catchChance(g, e, ball);
  // Each shake is a quarter-chance check in the games; here a miss just shakes fewer times.
  const shakes = success ? 3 : Math.floor(g.rng() * 3);
  e.catching = { ball, success, shakes, started: g.t, until: g.t + 0.6 + shakes * 0.6 + (success ? 0.3 : 0) };
  emit(g, { kind: 'throw', ball, x: e.x, y: e.y, id: e.id });
  return e;
}

export function pickUp(g: Game, dropId: number): boolean {
  const i = g.drops.findIndex((d) => d.id === dropId);
  if (i < 0) return false;
  const drop = g.drops[i]!;
  g.drops.splice(i, 1);
  if (drop.item in BALLS) g.balls[drop.item as BallKey] += 1;
  else g.items[drop.item as PowerupKey] += 1;
  g.log.found.push(drop.item);
  emit(g, { kind: 'pickup', item: drop.item, x: drop.x, y: drop.y });
  return true;
}

/** The drop nearest (x, y), within reach of a fingertip. */
export function dropAt(g: Game, x: number, y: number): Drop | undefined {
  return g.drops.find((d) => Math.hypot(d.x - x, d.y - y) < 0.7);
}

// --- combat -------------------------------------------------------------------------

type Hit = Effects;
const NO_HIT: Hit = {
  splash: 0, chain: 0, burn: 0, poison: 0, slow: 0, sleep: 0, paralyse: 0, confuse: 0, flinch: 0,
  crit: 0, knockback: 0, pierceArmour: 0, weaken: 0, ohko: 0, payDay: 0, antiAir: 0,
  auraDamage: 0, auraRate: 0, income: 0, wish: 0, rewind: 0, hex: 0, random: 0,
};

function hasStatus(g: Game, e: Enemy): boolean {
  const s = e.status;
  return s.burnUntil > g.t || s.poisonUntil > g.t || s.sleepUntil > g.t || s.paraUntil > g.t || s.confuseUntil > g.t || s.slowUntil > g.t;
}

/** Deal a hit. Returns the damage done. */
function damageEnemy(g: Game, e: Enemy, raw: number, type: PokeType, tower: Tower | null, fx: Hit): number {
  if (!e.alive || e.catching) return 0;
  const eff = effectiveness(type, e.sp.types);
  if (eff === 0) {
    emit(g, { kind: 'hit', x: e.x, y: e.y, type, damage: 0, crit: false, eff: 0 });
    return 0;
  }
  if (e.status.shieldUntil > g.t) {
    emit(g, { kind: 'hit', x: e.x, y: e.y, type, damage: 0, crit: false, eff: -1 });
    return 0;
  }
  const crit = fx.crit > 0 && g.rng() < fx.crit;
  let dmg = raw * eff * (crit ? 2 : 1);
  if (e.status.weakenUntil > g.t) dmg *= 1.25;
  if (fx.hex && hasStatus(g, e)) dmg *= 2;
  if (fx.antiAir && e.sp.traits.includes('flying')) dmg *= 1 + fx.antiAir;
  dmg *= 1 - e.armor * (1 - Math.min(1, fx.pierceArmour));
  if (fx.ohko && !e.boss && !e.lead && g.rng() < fx.ohko) dmg = e.hp;
  dmg = Math.max(1, dmg);
  e.hp -= dmg;
  e.flash = 0.12;
  emit(g, { kind: 'hit', x: e.x, y: e.y, type, damage: dmg, crit, eff });
  if (tower) tower.damageDone += Math.min(dmg, dmg + e.hp);
  applyEffects(g, e, raw * eff, fx);
  if (fx.payDay && tower) {
    const amount = Math.round(fx.payDay * (1 + g.map.tier * 0.5));
    g.money += amount;
    g.log.earned += amount;
    emit(g, { kind: 'money', amount, x: e.x, y: e.y - 0.4 });
  }
  if (e.hp <= 0) faint(g, e, tower);
  return dmg;
}

function applyEffects(g: Game, e: Enemy, dmg: number, fx: Hit): void {
  const s = e.status;
  const resist = e.boss ? 0.3 : e.lead ? 0.6 : 1;
  const chance = (p: number): boolean => p > 0 && g.rng() < p;
  let { burn, paralyse, sleep } = fx;
  if (fx.random) {
    const r = Math.floor(g.rng() * 3);
    if (r === 0) burn += 0.4;
    else if (r === 1) paralyse += 1;
    else sleep += 1;
  }
  if (burn) {
    s.burnDps = Math.max(s.burnUntil > g.t ? s.burnDps : 0, dmg * burn);
    s.burnUntil = g.t + 3;
  }
  if (fx.poison) {
    const active = s.poisonUntil > g.t;
    s.poisonStacks = active ? Math.min(3, s.poisonStacks + 1) : 1;
    s.poisonPer = Math.max(active ? s.poisonPer : 0, dmg * fx.poison);
    s.poisonDps = s.poisonPer * s.poisonStacks;
    s.poisonUntil = g.t + 4;
  }
  if (fx.slow) {
    s.slow = s.slowUntil > g.t ? Math.max(s.slow, fx.slow) : fx.slow;
    s.slowUntil = g.t + 1.5;
  }
  if (chance(sleep)) s.sleepUntil = Math.max(s.sleepUntil, g.t + 1.5 * resist);
  if (chance(paralyse)) s.paraUntil = Math.max(s.paraUntil, g.t + 2 * resist);
  if (chance(fx.confuse)) s.confuseUntil = Math.max(s.confuseUntil, g.t + 1.2 * resist);
  if (chance(fx.flinch)) s.flinchUntil = Math.max(s.flinchUntil, g.t + 0.5 * resist);
  if (fx.weaken) s.weakenUntil = g.t + 3;
  if (fx.knockback) e.dist = Math.max(0, e.dist - fx.knockback * (e.boss ? 0.2 : 1));
  if (chance(fx.rewind) && !e.boss) e.dist = Math.max(0, e.dist - 2);
}

function faint(g: Game, e: Enemy, tower: Tower | null): void {
  e.alive = false;
  g.log.kills += 1;
  const bounty = Math.round(e.bounty * (g.buffs.amulet > g.t ? 2 : 1) * (1 + (tower?.stats.bounty ?? 0)));
  g.money += bounty;
  g.log.earned += bounty;
  if (tower) {
    tower.kills += 1;
    tower.xp += bounty;
  }
  emit(g, { kind: 'faint', id: e.id, x: e.x, y: e.y, dex: e.dex, bounty, boss: e.boss });

  if (e.sp.split && !e.boss) {
    for (let i = 0; i < e.sp.split.count; i += 1) {
      const child = spawnEnemy(g, { at: 0, dex: e.sp.split.dex, path: e.path, hp: species(e.sp.split.dex).hp }, e.wave, Math.max(0, e.dist - i * 0.35), false);
      child.bounty = Math.ceil(child.bounty / 2);
    }
  }
  if (e.sp.explode) {
    stunTowers(g, e.x, e.y, e.sp.explode.radius, e.sp.explode.duration);
  }
  if (g.rng() < DROP_CHANCE * (e.boss ? 20 : e.lead ? 5 : 1)) {
    const [item] = pickWeighted(g.rng, DROPS, ([, w]) => w);
    const drop: Drop = { id: g.nextId++, x: e.x, y: e.y, item, until: g.t + 7 };
    g.drops.push(drop);
    emit(g, { kind: 'drop', id: drop.id, item });
  }
}

function stunTowers(g: Game, x: number, y: number, radius: number, duration: number): void {
  for (const t of g.towers) {
    if (Math.hypot(t.x + 0.5 - x, t.y + 0.5 - y) <= radius) t.stunnedUntil = Math.max(t.stunnedUntil, g.t + duration);
  }
  emit(g, { kind: 'stunTowers', x, y, radius });
}

function canHit(g: Game, stats: TowerStats, e: Enemy): boolean {
  if (!e.alive || e.catching || !e.revealed) return false;
  if (stats.groundOnly && e.sp.traits.includes('flying')) return false;
  return effectiveness(stats.type, e.sp.types) > 0 || e.status.shieldUntil > g.t;
}

function remaining(g: Game, e: Enemy): number {
  return g.paths[e.path]!.length - e.dist;
}

function pickTarget(g: Game, tower: Tower): Enemy | undefined {
  const cx = tower.x + 0.5;
  const cy = tower.y + 0.5;
  let best: Enemy | undefined;
  let bestScore = -Infinity;
  for (const e of g.enemies) {
    if (!canHit(g, tower.stats, e)) continue;
    const d = Math.hypot(e.x - cx, e.y - cy);
    if (d > tower.stats.range) continue;
    const score =
      tower.target === 'first' ? -remaining(g, e)
      : tower.target === 'last' ? remaining(g, e)
      : tower.target === 'strong' ? e.hp
      : -d;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

function auras(g: Game): Map<number, { damage: number; rate: number }> {
  const out = new Map<number, { damage: number; rate: number }>();
  for (const src of g.towers) {
    const fx = src.stats.effects;
    if (!fx.auraDamage && !fx.auraRate) continue;
    if (src.stunnedUntil > g.t) continue;
    for (const t of g.towers) {
      if (t === src || Math.hypot(t.x - src.x, t.y - src.y) > src.stats.range) continue;
      const a = out.get(t.id) ?? { damage: 0, rate: 0 };
      a.damage += fx.auraDamage;
      a.rate += fx.auraRate;
      out.set(t.id, a);
    }
  }
  return out;
}

function fire(g: Game, tower: Tower, target: Enemy, damageMul: number): void {
  const s = tower.stats;
  const cx = tower.x + 0.5;
  const cy = tower.y + 0.5;
  const dmg = s.damage * damageMul;
  tower.facing = target.x < cx ? -1 : 1;
  tower.lastShot = g.t;
  const fx = s.effects;

  switch (s.attack) {
    case 'bolt':
    case 'splash': {
      g.projectiles.push({
        id: g.nextId++, x: cx, y: cy - 0.2, targetId: target.id, tx: target.x, ty: target.y, towerId: tower.id,
        damage: dmg, type: s.type, splash: s.attack === 'splash' ? Math.max(0.5, fx.splash) : 0, effects: fx, groundOnly: s.groundOnly,
      });
      emit(g, { kind: 'attack', tower: tower.id, attack: s.attack, type: s.type, x: cx, y: cy, points: [{ x: target.x, y: target.y }], radius: 0 });
      break;
    }
    case 'beam': {
      const len = Math.hypot(target.x - cx, target.y - cy) || 1;
      const ux = (target.x - cx) / len;
      const uy = (target.y - cy) / len;
      const reach = s.range + 0.6;
      emit(g, { kind: 'attack', tower: tower.id, attack: 'beam', type: s.type, x: cx, y: cy, points: [{ x: cx + ux * reach, y: cy + uy * reach }], radius: 0 });
      for (const e of [...g.enemies]) {
        if (!canHit(g, s, e)) continue;
        const along = (e.x - cx) * ux + (e.y - cy) * uy;
        if (along < 0 || along > reach) continue;
        const off = Math.abs((e.x - cx) * uy - (e.y - cy) * ux);
        if (off <= (e.boss ? 0.6 : 0.42)) damageEnemy(g, e, dmg, s.type, tower, fx);
      }
      break;
    }
    case 'chain': {
      const hitIds = new Set<number>();
      const points: { x: number; y: number }[] = [];
      let current: Enemy | undefined = target;
      let power = dmg;
      for (let jump = 0; current && jump <= fx.chain; jump += 1) {
        hitIds.add(current.id);
        points.push({ x: current.x, y: current.y });
        const from: Enemy = current;
        damageEnemy(g, from, power, s.type, tower, fx);
        power *= 0.8;
        let next: Enemy | undefined;
        let nd = 1.8;
        for (const e of g.enemies) {
          if (hitIds.has(e.id) || !canHit(g, s, e)) continue;
          const d = Math.hypot(e.x - from.x, e.y - from.y);
          if (d < nd) {
            next = e;
            nd = d;
          }
        }
        current = next;
      }
      emit(g, { kind: 'attack', tower: tower.id, attack: 'chain', type: s.type, x: cx, y: cy - 0.2, points, radius: 0 });
      break;
    }
    case 'pulse': {
      emit(g, { kind: 'attack', tower: tower.id, attack: 'pulse', type: s.type, x: cx, y: cy, points: [], radius: s.range });
      for (const e of [...g.enemies]) {
        if (canHit(g, s, e) && Math.hypot(e.x - cx, e.y - cy) <= s.range) damageEnemy(g, e, dmg, s.type, tower, fx);
      }
      break;
    }
    case 'aura':
      break;
  }
}

function updateProjectiles(g: Game, dt: number): void {
  const SPEED = 10;
  for (let i = g.projectiles.length - 1; i >= 0; i -= 1) {
    const p = g.projectiles[i]!;
    const target = g.enemies.find((e) => e.id === p.targetId && e.alive && !e.catching);
    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const stepLen = SPEED * dt;
    if (d > stepLen) {
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
      continue;
    }
    g.projectiles.splice(i, 1);
    const tower = g.towers.find((t) => t.id === p.towerId) ?? null;
    if (p.splash > 0) {
      emit(g, { kind: 'splash', x: p.tx, y: p.ty, type: p.type, radius: p.splash });
      for (const e of [...g.enemies]) {
        if (!e.alive || e.catching) continue;
        if (p.groundOnly && e.sp.traits.includes('flying')) continue;
        if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash + (e.boss ? 0.3 : 0)) damageEnemy(g, e, p.damage, p.type, tower, p.effects);
      }
    } else if (target) {
      damageEnemy(g, target, p.damage, p.type, tower, p.effects);
    }
  }
}

// --- enemies -------------------------------------------------------------------------

function useAbility(g: Game, e: Enemy, ab: Ability): void {
  switch (ab.kind) {
    case 'stun':
      stunTowers(g, e.x, e.y, ab.radius, ab.duration);
      break;
    case 'summon':
      for (let i = 0; i < ab.count; i += 1) {
        spawnEnemy(g, { at: 0, dex: ab.dex, path: e.path, hp: species(ab.dex).hp * 1.2 }, e.wave, Math.max(0, e.dist - 0.6 - i * 0.4), false);
      }
      break;
    case 'teleport':
      e.dist = Math.min(g.paths[e.path]!.length - 1.5, e.dist + ab.tiles);
      break;
    case 'dash':
      e.status.dashUntil = g.t + ab.duration;
      e.status.dash = ab.factor;
      break;
    case 'shield':
      e.status.shieldUntil = g.t + ab.duration;
      break;
    case 'vanish':
      e.status.vanishUntil = g.t + ab.duration;
      break;
    case 'heal':
      break;
  }
  emit(g, { kind: 'ability', ability: ab.kind, x: e.x, y: e.y, radius: ab.kind === 'stun' ? ab.radius : 0 });
}

function evolveEnemy(g: Game, e: Enemy, dex: number): void {
  const next = species(dex);
  const ratio = next.hp / e.sp.hp;
  e.maxHp = Math.round(e.maxHp * ratio);
  e.hp = Math.round(e.hp * ratio);
  e.bounty = Math.round(e.bounty * ratio ** 0.7);
  e.dex = dex;
  e.sp = next;
  e.speed = next.speed;
  e.armor = next.armor;
  e.born = g.t;
  e.abilities = next.abilities.map((ability) => ({ ability, next: g.t + ('every' in ability ? ability.every : 0) }));
  g.log.seen.add(dex);
  emit(g, { kind: 'evolveEnemy', id: e.id, dex, x: e.x, y: e.y });
}

function updateEnemies(g: Game, dt: number): void {
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    const s = e.status;

    if (e.catching) {
      const c = e.catching;
      const shakesDone = Math.floor((g.t - c.started - 0.6) / 0.6);
      const prevDone = Math.floor((g.t - dt - c.started - 0.6) / 0.6);
      if (shakesDone > prevDone && shakesDone >= 0 && shakesDone < c.shakes) emit(g, { kind: 'shake', x: e.x, y: e.y });
      if (g.t >= c.until) {
        emit(g, { kind: 'catch', dex: e.dex, shiny: e.shiny, success: c.success, x: e.x, y: e.y });
        if (c.success) {
          e.alive = false;
          g.log.caught.push({ dex: e.dex, shiny: e.shiny });
          g.money += e.bounty;
          g.log.earned += e.bounty;
        } else {
          e.catching = null;
        }
      }
      continue;
    }

    // Damage over time. Shields block it; nothing else does.
    if (s.shieldUntil <= g.t) {
      let dot = 0;
      if (s.burnUntil > g.t) dot += s.burnDps;
      if (s.poisonUntil > g.t) dot += s.poisonDps;
      if (dot > 0) {
        e.hp -= dot * dt;
        if (e.hp <= 0) {
          faint(g, e, null);
          continue;
        }
      }
    }
    if (e.sp.regen && !e.boss) e.hp = Math.min(e.maxHp, e.hp + e.sp.regen * e.maxHp * dt);

    for (const slot of e.abilities) {
      const ab = slot.ability;
      if (ab.kind === 'heal') {
        if (!e.healed && e.hp < e.maxHp / 2) {
          e.healed = true;
          e.hp = Math.min(e.maxHp, e.hp + ab.fraction * e.maxHp);
          useAbility(g, e, ab);
        }
      } else if (g.t >= slot.next && s.sleepUntil <= g.t) {
        slot.next = g.t + ab.every;
        useAbility(g, e, ab);
      }
    }

    if (e.sp.evolve && !e.boss && !e.lead && g.t - e.born >= e.sp.evolve.after) evolveEnemy(g, e, e.sp.evolve.dex);

    let speed = e.speed;
    if (s.sleepUntil > g.t || s.flinchUntil > g.t) speed = 0;
    else {
      if (s.paraUntil > g.t) speed *= Math.sin(g.t * 9) > 0 ? 0.6 : 0.05;
      if (s.slowUntil > g.t) speed *= 1 - s.slow;
      if (g.buffs.repel > g.t) speed *= 0.5;
      if (s.dashUntil > g.t) speed *= s.dash;
      if (s.confuseUntil > g.t) speed *= -0.5;
    }
    const path = g.paths[e.path]!;
    e.dist = Math.max(0, e.dist + speed * dt);
    const pos = pointAt(path, e.dist);
    e.x = pos.x;
    e.y = pos.y;
    if (pos.dx !== 0) e.facing = pos.dx * (speed < 0 ? -1 : 1);

    if (e.dist >= path.length) {
      e.alive = false;
      g.lives = Math.max(0, g.lives - e.lives);
      g.log.leaked += 1;
      if (e.boss && g.checkpoint) g.bossLeaked = true;
      emit(g, { kind: 'leak', dex: e.dex, lives: e.lives });
    }
  }
}

function revealEnemies(g: Game): void {
  const scope = g.buffs.scope > g.t;
  for (const e of g.enemies) {
    const hidden = e.sp.traits.includes('invisible') || e.status.vanishUntil > g.t;
    if (!hidden || scope) {
      e.revealed = true;
      continue;
    }
    e.revealed = g.towers.some((t) => t.stats.detect && t.stunnedUntil <= g.t && Math.hypot(t.x + 0.5 - e.x, t.y + 0.5 - e.y) <= t.stats.range);
  }
}

// --- the loop ----------------------------------------------------------------------------

function clearWaves(g: Game): void {
  for (const wave of [...g.openWaves]) {
    if (g.pending.some((p) => p.wave === wave)) continue;
    if (g.enemies.some((e) => e.alive && e.wave === wave)) continue;
    g.openWaves.delete(wave);
    g.cleared += 1;
    if (g.checkpoint?.wave === wave) {
      g.checkpoint = null;
      g.retries = 0;
    }
    let bonus = waveBonus(g.map.tier, wave);
    for (const t of g.towers) {
      bonus += Math.round(t.stats.effects.income * (1 + 0.15 * (g.map.tier - 1)));
      if (t.stats.effects.wish) g.lives = Math.min(g.maxLives, g.lives + t.stats.effects.wish);
    }
    if (g.trainer.interest) bonus += Math.min(g.trainer.interest * 40, Math.floor(g.money * g.trainer.interest * 0.02));
    g.money += bonus;
    g.log.earned += bonus;
    emit(g, { kind: 'waveClear', wave, bonus });
  }
}

export function step(g: Game, dt = STEP): void {
  if (g.status !== 'playing') return;
  g.t += dt;

  while (g.pending.length && g.pending[0]!.at <= g.t) {
    const { spawn, wave } = g.pending.shift()!;
    spawnEnemy(g, spawn, wave);
  }

  updateEnemies(g, dt);
  revealEnemies(g);

  const aura = auras(g);
  const xAttack = g.buffs.xAttack > g.t ? 1.5 : 1;
  const xSpeed = g.buffs.xSpeed > g.t ? 1.5 : 1;
  for (const tower of g.towers) {
    if (tower.stats.attack === 'aura' || tower.stats.rate <= 0) continue;
    const a = aura.get(tower.id);
    tower.cooldown -= dt * xSpeed * (1 + (a?.rate ?? 0));
    if (tower.stunnedUntil > g.t || tower.cooldown > 0) continue;
    const target = pickTarget(g, tower);
    if (!target) {
      tower.cooldown = Math.max(tower.cooldown, 0);
      continue;
    }
    fire(g, tower, target, xAttack * (1 + (a?.damage ?? 0)));
    tower.cooldown += 1 / tower.stats.rate;
  }

  updateProjectiles(g, dt);
  g.enemies = g.enemies.filter((e) => e.alive);
  g.drops = g.drops.filter((d) => d.until > g.t);

  clearWaves(g);

  if (g.checkpoint && g.openWaves.has(g.checkpoint.wave) && (g.bossLeaked || g.lives <= 0)) {
    g.status = 'retry';
    emit(g, { kind: 'bossFailed', wave: g.checkpoint.wave });
    return;
  }
  if (g.lives <= 0) {
    g.status = 'lost';
    emit(g, { kind: 'lost' });
    return;
  }
  if (!g.map.endless && g.wave >= g.totalWaves && g.openWaves.size === 0) {
    g.status = 'won';
    emit(g, { kind: 'won' });
    return;
  }
  // After a retry the player calls the boss wave themselves, when they're ready.
  const retrying = g.checkpoint !== null && g.wave < g.checkpoint.wave;
  if (g.autoWave && !retrying && g.openWaves.size === 0 && hasNextWave(g) && g.wave > 0) {
    g.autoAt ??= g.t + 2;
    if (g.t >= g.autoAt) startWave(g);
  }
}

/**
 * Rewind a failed boss wave to just before it started: towers, ₽, lives and
 * items as they were, the boss wave not yet called. The player can rearrange
 * their team and call it again.
 */
export function retryWave(g: Game): boolean {
  if (g.status !== 'retry' || !g.checkpoint) return false;
  const saved = structuredClone(g.checkpoint.state);
  const { log, ...rest } = saved;
  Object.assign(g, rest);
  g.log = { ...g.log, ...log };
  // structuredClone copies the shared data too; point back at the originals.
  for (const t of g.towers) t.line = line(t.line.id);
  for (const e of g.enemies) e.sp = species(e.dex);
  g.projectiles = [];
  g.drops = [];
  g.bossLeaked = false;
  g.autoAt = null;
  g.retries += 1;
  g.status = 'playing';
  return true;
}

/** 1–3 stars for a win, by lives kept. */
export function starsFor(g: Game): number {
  if (g.status !== 'won') return 0;
  if (g.lives >= g.maxLives * 0.9) return 3;
  if (g.lives >= g.maxLives / 2) return 2;
  return 1;
}

export { stageIndex };
