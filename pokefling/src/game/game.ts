/**
 * One attempt at one level: the physics world, the sling, whose turn it is,
 * the bag's effects, and the score. No DOM in here, so the whole thing runs
 * under Vitest — the renderer only ever reads it, and drains `events` to know
 * what to animate.
 */
import Matter from 'matter-js';
import type { LevelDef } from '../data/levels/types';
import { MATERIALS, type Material } from '../data/materials';
import {
  LAUNCHERS, TARGETS,
  type ItemKey, type LauncherDef, type LauncherKey, type TargetDef, type TargetKey,
} from '../data/roster';
import { blastFalloff, impactDamage } from './damage';
import { PICKUP_POINTS, UNUSED_LAUNCHER_BONUS } from './scoring';
import { launchVelocity, type Vec } from './sling';
import { GROUND_Y, KILL_MARGIN, MIN_PULL, SLING, WORLD_BOTTOM } from './world';

const { Bodies, Body, Composite, Engine, Events, Sleeping } = Matter;

/** Two physics steps per frame: fast shots stay out of thin planks. */
export const STEP_MS = 1000 / 120;
/** Blocks shuffle into place for this long before anything can break. */
export const GRACE_MS = 1500;

/** Voltorb's Self-Destruct. */
const BOMB = { radius: 150, damage: 90, kick: 16 };
/** An explosive crate going off. */
const CRATE = { radius: 115, damage: 75, kick: 13 };
/** Gengar coming out of Phantom Force. */
const PHANTOM = { radius: 75, damage: 45, kick: 5 };
/** Voltorb goes off on its own this long after it first hits something. */
const FUSE_MS = 1500;
/** X Attack multiplies the damage a shot deals; X Speed its launch speed. */
export const X_ATTACK_POWER = 2;
export const X_SPEED_BOOST = 1.25;
/** Thickness of a cave roof, above its underside. */
const CEILING_DEPTH = 600;

/** Collision categories, so Gengar can pass through blocks and nothing else. */
const CATEGORY = { solid: 0x1, block: 0x2, target: 0x4, projectile: 0x8, pickup: 0x10 } as const;
const EVERYTHING = 0xffffffff;

export type Phase = 'aiming' | 'flying' | 'settling' | 'won' | 'lost';
export type EntityKind = 'ground' | 'terrain' | 'ceiling' | 'block' | 'target' | 'projectile' | 'pickup';

export interface Entity {
  readonly id: number;
  readonly kind: EntityKind;
  readonly body: Matter.Body;
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly material?: Material;
  readonly shape?: 'box' | 'ball';
  readonly target?: TargetDef;
  readonly launcher?: LauncherDef;
  readonly item?: ItemKey;
  hp: number;
  readonly maxHp: number;
  /** Counts down after a hit, so the renderer can flash it. */
  hitFlash: number;
  dead: boolean;
  /** Projectiles only: has it touched anything yet? */
  hasHit: boolean;
  /** Projectiles only: multiplies the damage it deals (X Attack). */
  power: number;
  /** Projectiles only: passing through blocks (Gengar's Phantom Force). */
  phasing: boolean;
  /** Floating targets only: where it hovers. */
  readonly home?: Vec;
  /** Set when something fell into water, so it is not scored as a plain break. */
  sank?: boolean;
}

export type GameEvent =
  | { type: 'launch'; key: LauncherKey }
  | { type: 'impact'; x: number; y: number; strength: number }
  | { type: 'break'; x: number; y: number; w: number; h: number; angle: number; material: Material }
  | { type: 'faint'; x: number; y: number; kind: TargetKey }
  | { type: 'points'; x: number; y: number; points: number }
  | { type: 'ability'; key: LauncherKey; x: number; y: number }
  | { type: 'explode'; x: number; y: number; radius: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'pickup'; x: number; y: number; item: ItemKey }
  | { type: 'item'; item: ItemKey }
  | { type: 'loaded'; key: LauncherKey }
  /** An unused Pokémon cashing in at the end. */
  | { type: 'bonus'; x: number; y: number; key: LauncherKey }
  | { type: 'won' }
  | { type: 'lost' };

export class Game {
  readonly level: LevelDef;
  readonly engine: Matter.Engine;
  readonly entities = new Map<number, Entity>();
  readonly events: GameEvent[] = [];

  phase: Phase = 'aiming';
  /** In the pouch, ready to fire. Null between shots and at the end. */
  loaded: LauncherKey | null;
  /** Waiting behind the sling, next first. */
  readonly queue: LauncherKey[];
  projectiles: Entity[] = [];
  abilityUsed = false;
  score = 0;
  shots = 0;
  /** Simulated time since the level started, in ms. */
  time = 0;
  /** Where the current shot has been, for the dotted trail. */
  trail: Vec[] = [];
  /** The previous shot's trail, kept on screen while aiming the next. */
  lastTrail: Vec[] = [];
  /** Items used this level: each works once per level. */
  readonly usedItems = new Set<ItemKey>();
  /** Boosts waiting for the next launch. */
  readonly boost = { attack: false, speed: false };
  /** Scope Lens: draw the whole arc while aiming. */
  fullArc = false;
  /** The hidden item, once something has knocked into it. */
  collected: ItemKey | null = null;
  /** Counts down after an earthquake, for the camera shake. */
  quakeTime = 0;

  private lastLaunched: LauncherKey | null = null;
  private phaseTime = 0;
  private calmTime = 0;
  private slowTime = 0;
  private fuse = 0;
  private trailClock = 0;
  private accumulator = 0;
  private nextId = 1;
  private readonly pierce: { entity: Entity; velocity: Vec; victim: Entity }[] = [];
  private readonly blasts: { at: Vec; spec: typeof BOMB; power: number }[] = [];

  constructor(level: LevelDef) {
    this.level = level;
    const [first, ...rest] = level.launchers;
    this.loaded = first ?? null;
    this.queue = rest;

    this.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    this.build();
    Events.on(this.engine, 'collisionStart', (event) => this.onCollisions(event.pairs));
  }

  get targetsLeft(): number {
    let n = 0;
    for (const e of this.entities.values()) if (e.kind === 'target' && !e.dead) n += 1;
    return n;
  }

  get launchersLeft(): number {
    return this.queue.length + (this.loaded ? 1 : 0);
  }

  /** Launch speed multiplier for the next shot, for the aiming arc. */
  get launchScale(): number {
    return this.boost.speed ? X_SPEED_BOOST : 1;
  }

  /** The Pokémon in flight whose ability a tap would trigger. */
  get abilityTarget(): Entity | null {
    if (this.phase !== 'flying' || this.abilityUsed) return null;
    const lead = this.projectiles[0];
    if (!lead || lead.dead || !lead.launcher || lead.launcher.ability === 'none') return null;
    // Most abilities only make sense on the way in; a bomb can still go off,
    // and a ghost can still come out of hiding.
    const ability = lead.launcher.ability;
    if (lead.hasHit && ability !== 'explode' && ability !== 'phase') return null;
    return lead;
  }

  /** Fire whatever is in the pouch. `pull` is the pouch offset from the sling. */
  launch(pull: Vec): boolean {
    if (this.phase !== 'aiming' || !this.loaded) return false;
    if (Math.hypot(pull.x, pull.y) < MIN_PULL) return false;

    const def = LAUNCHERS[this.loaded];
    const v = launchVelocity(pull);
    const scale = this.launchScale;
    const projectile = this.spawnProjectile(def, { x: SLING.x + pull.x, y: SLING.y + pull.y }, { x: v.x * scale, y: v.y * scale });
    if (this.boost.attack) projectile.power = X_ATTACK_POWER;
    this.boost.attack = false;
    this.boost.speed = false;
    this.projectiles = [projectile];
    this.events.push({ type: 'launch', key: def.key });
    this.lastLaunched = def.key;
    this.loaded = null;
    this.abilityUsed = false;
    this.shots += 1;
    this.lastTrail = this.trail;
    this.trail = [];
    this.fuse = 0;
    this.setPhase('flying');
    return true;
  }

  /** Whether an item could be used right now. */
  canUseItem(item: ItemKey): boolean {
    if (this.phase !== 'aiming' || this.usedItems.has(item)) return false;
    if (item === 'max-revive') return this.lastLaunched !== null;
    return true;
  }

  /** Use an item from the bag. The caller takes it out of the bag when this returns true. */
  useItem(item: ItemKey): boolean {
    if (!this.canUseItem(item)) return false;
    this.usedItems.add(item);
    switch (item) {
      case 'x-attack':
        this.boost.attack = true;
        break;
      case 'x-speed':
        this.boost.speed = true;
        break;
      case 'scope-lens':
        this.fullArc = true;
        break;
      case 'max-revive':
        this.queue.unshift(this.lastLaunched!);
        break;
      case 'tm-ground':
        this.quake();
        break;
    }
    this.events.push({ type: 'item', item });
    return true;
  }

  useAbility(): boolean {
    const lead = this.abilityTarget;
    if (!lead?.launcher) return false;
    this.abilityUsed = true;
    const body = lead.body;
    const v = Body.getVelocity(body);
    const speed = Math.hypot(v.x, v.y) || 1;
    this.events.push({ type: 'ability', key: lead.launcher.key, x: body.position.x, y: body.position.y });

    switch (lead.launcher.ability) {
      case 'dash': {
        const boosted = Math.max(speed * 1.9, 22);
        Body.setVelocity(body, { x: (v.x / speed) * boosted, y: (v.y / speed) * boosted });
        break;
      }
      case 'slam':
        Body.setVelocity(body, { x: v.x * 0.25, y: Math.max(v.y, 0) + 22 });
        break;
      case 'split':
        for (const turn of [-0.22, 0.22]) {
          const cos = Math.cos(turn);
          const sin = Math.sin(turn);
          const dir = { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
          const offset = (turn > 0 ? 1 : -1) * lead.radius * 2.2;
          const at = { x: body.position.x - (v.y / speed) * offset, y: body.position.y + (v.x / speed) * offset };
          const clone = this.spawnProjectile(lead.launcher, at, dir);
          clone.power = lead.power;
          this.projectiles.push(clone);
        }
        break;
      case 'gust': {
        // Whip round and fly back the way it came, as fast as it was going.
        const back = Math.max(Math.abs(v.x), speed * 0.8, 10);
        Body.setVelocity(body, { x: v.x > 0 ? -back : back, y: Math.min(v.y, 0) - 2 });
        break;
      }
      case 'phase':
        this.materialize(lead);
        break;
      case 'explode':
        lead.dead = true;
        this.blasts.push({ at: { ...body.position }, spec: BOMB, power: lead.power });
        break;
      case 'none':
        break;
    }
    return true;
  }

  /** Advance by a frame's worth of real time. */
  update(dtMs: number): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.accumulator += Math.min(dtMs, 100);
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      this.step();
    }
  }

  // --- world building ---------------------------------------------------

  private build(): void {
    const { level } = this;
    const left = -KILL_MARGIN * 2;
    const right = level.width + KILL_MARGIN * 2;
    const groundHeight = WORLD_BOTTOM - GROUND_Y + 200;

    // The ground, with gaps cut out where there is water.
    const spans = [...(level.water ?? [])].sort((a, b) => a[0] - b[0]);
    let from = left;
    for (const [x0, x1] of [...spans, [right, right] as const]) {
      if (x0 > from) {
        this.add('ground', Bodies.rectangle((from + x0) / 2, GROUND_Y + groundHeight / 2, x0 - from, groundHeight, {
          isStatic: true, friction: 1, label: 'ground', collisionFilter: { category: CATEGORY.solid, mask: EVERYTHING },
        }), { w: x0 - from, h: groundHeight });
      }
      from = x1;
    }

    if (level.ceiling !== undefined) {
      const w = right - left;
      this.add('ceiling', Bodies.rectangle((left + right) / 2, level.ceiling - CEILING_DEPTH / 2, w, CEILING_DEPTH, {
        isStatic: true, friction: 0.6, label: 'ceiling', collisionFilter: { category: CATEGORY.solid, mask: EVERYTHING },
      }), { w, h: CEILING_DEPTH });
    }

    for (const t of level.terrain) {
      this.add('terrain', Bodies.rectangle(t.x, t.y, t.w, t.h, {
        isStatic: true, friction: 1, label: 'terrain', collisionFilter: { category: CATEGORY.solid, mask: EVERYTHING },
      }), { w: t.w, h: t.h });
    }

    for (const b of level.blocks) {
      const mat = MATERIALS[b.material];
      const options = {
        density: mat.density, friction: mat.friction, frictionStatic: 1, restitution: 0.05, label: b.material,
        collisionFilter: { category: CATEGORY.block, mask: EVERYTHING },
      };
      const ball = b.shape === 'ball';
      const body = ball ? Bodies.circle(b.x, b.y, b.w / 2, { ...options, frictionAir: 0.005 }) : Bodies.rectangle(b.x, b.y, b.w, b.h, options);
      this.add('block', body, {
        w: b.w, h: b.h, radius: ball ? b.w / 2 : 0, material: b.material, shape: ball ? 'ball' : 'box', hp: mat.hp,
      });
    }

    for (const t of level.targets) {
      const def = TARGETS[t.kind];
      const body = Bodies.circle(t.x, t.y, def.radius, {
        density: 0.001, friction: 0.8, frictionAir: def.floats ? 0.03 : 0.01, restitution: 0.2, label: def.key,
        collisionFilter: { category: CATEGORY.target, mask: EVERYTHING },
      });
      if (def.floats) body.sleepThreshold = Infinity;
      this.add('target', body, {
        radius: def.radius, w: def.radius * 2, h: def.radius * 2, target: def, hp: def.hp,
        ...(def.floats ? { home: { x: t.x, y: t.y } } : {}),
      });
    }

    if (level.pickup) {
      const { x, y, item } = level.pickup;
      this.add('pickup', Bodies.circle(x, y, 16, {
        isStatic: true, isSensor: true, label: 'pickup',
        collisionFilter: { category: CATEGORY.pickup, mask: EVERYTHING },
      }), { radius: 16, w: 32, h: 32, item });
    }
  }

  private add(
    kind: EntityKind,
    body: Matter.Body,
    extra: Partial<Omit<Entity, 'id' | 'kind' | 'body' | 'maxHp'>> = {},
  ): Entity {
    const hp = extra.hp ?? Infinity;
    const entity: Entity = {
      id: this.nextId++, kind, body,
      w: extra.w ?? 0, h: extra.h ?? 0, radius: extra.radius ?? 0,
      hp, maxHp: hp, hitFlash: 0, dead: false, hasHit: false, power: 1, phasing: false,
      ...(extra.material ? { material: extra.material } : {}),
      ...(extra.shape ? { shape: extra.shape } : {}),
      ...(extra.target ? { target: extra.target } : {}),
      ...(extra.launcher ? { launcher: extra.launcher } : {}),
      ...(extra.item ? { item: extra.item } : {}),
      ...(extra.home ? { home: extra.home } : {}),
    };
    this.entities.set(body.id, entity);
    Composite.add(this.engine.world, body);
    return entity;
  }

  private spawnProjectile(def: LauncherDef, at: Vec, velocity: Vec): Entity {
    const phasing = def.ability === 'phase';
    const body = Bodies.circle(at.x, at.y, def.radius, {
      density: def.density, restitution: def.restitution, friction: 0.6, frictionAir: 0, label: def.key,
      collisionFilter: { category: CATEGORY.projectile, mask: phasing ? EVERYTHING & ~CATEGORY.block : EVERYTHING },
    });
    const entity = this.add('projectile', body, { radius: def.radius, w: def.radius * 2, h: def.radius * 2, launcher: def });
    entity.phasing = phasing;
    Body.setVelocity(body, velocity);
    return entity;
  }

  /** Gengar leaves Phantom Force: solid again, with a burst that hurts what it is inside. */
  private materialize(ghost: Entity): void {
    ghost.phasing = false;
    ghost.body.collisionFilter.mask = EVERYTHING;
    const v = Body.getVelocity(ghost.body);
    Body.setVelocity(ghost.body, { x: v.x * 0.6, y: v.y * 0.6 });
    this.blasts.push({ at: { ...ghost.body.position }, spec: PHANTOM, power: ghost.power });
  }

  private quake(): void {
    this.quakeTime = 1200;
    let seed = this.time + 1;
    const random = (): number => {
      // Deterministic, so a replay of the same inputs shakes the same way.
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const e of this.entities.values()) {
      if (e.body.isStatic || e.home || e.kind === 'projectile') continue;
      Sleeping.set(e.body, false);
      const scale = Math.min(1, 5 / e.body.mass);
      Body.setVelocity(e.body, { x: (random() - 0.5) * 7 * scale, y: -(2 + random() * 3) * scale });
      Body.setAngularVelocity(e.body, (random() - 0.5) * 0.08 * scale);
    }
  }

  // --- simulation -------------------------------------------------------

  private step(): void {
    this.hover();
    Engine.update(this.engine, STEP_MS);
    this.time += STEP_MS;
    this.phaseTime += STEP_MS;
    if (this.quakeTime > 0) this.quakeTime = Math.max(0, this.quakeTime - STEP_MS);

    for (const { entity, velocity, victim } of this.pierce.splice(0)) {
      // Smashing clean through a block keeps most of the momentum, rather than
      // bouncing off something that no longer exists.
      if (victim.dead && !entity.dead) Body.setVelocity(entity.body, { x: velocity.x * 0.6, y: velocity.y * 0.6 });
    }

    for (const e of this.entities.values()) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - STEP_MS);
      if (e.dead || e.body.isStatic) continue;
      if (this.outOfBounds(e.body)) {
        if (e.kind === 'target') e.hp = 0;
        e.dead = true;
      } else if (this.inWater(e)) {
        e.sank = true;
        e.dead = true;
        this.events.push({ type: 'splash', x: e.body.position.x, y: GROUND_Y });
      }
      if (e.kind !== 'projectile' && e.hp <= 0) e.dead = true;
    }
    this.reap();

    if (this.phase === 'flying') this.stepFlying();
    else if (this.phase === 'settling') this.stepSettling();
  }

  /** Floating targets: cancel gravity and spring back towards home. */
  private hover(): void {
    const g = this.engine.gravity;
    for (const e of this.entities.values()) {
      if (!e.home || e.dead) continue;
      const body = e.body;
      const v = Body.getVelocity(body);
      const bob = Math.sin(this.time / 700 + e.id) * 6;
      body.force.x += body.mass * ((e.home.x - body.position.x) * 1e-5 - v.x * 4e-5);
      body.force.y += body.mass * (-g.y * g.scale + (e.home.y + bob - body.position.y) * 2.5e-5 - v.y * 6e-5);
    }
  }

  private stepFlying(): void {
    const live = this.projectiles.filter((p) => !p.dead);
    const lead = live[0];

    this.trailClock += STEP_MS;
    const first = this.projectiles[0];
    if (first && !first.dead && !first.hasHit && this.trailClock >= 45) {
      this.trailClock = 0;
      this.trail.push({ x: first.body.position.x, y: first.body.position.y });
    }

    if (lead?.launcher?.ability === 'explode' && lead.hasHit && !this.abilityUsed) {
      this.fuse += STEP_MS;
      if (this.fuse >= FUSE_MS) this.useAbility();
    }

    const moving = live.some((p) => Body.getSpeed(p.body) > 0.3 || !p.hasHit);
    this.slowTime = moving ? 0 : this.slowTime + STEP_MS;
    if (live.length === 0 || this.slowTime > 600 || this.phaseTime > 9000) this.setPhase('settling');
  }

  private stepSettling(): void {
    let calm = true;
    for (const e of this.entities.values()) {
      if (e.dead || e.body.isStatic || e.home || e.body.isSleeping) continue;
      if (Body.getSpeed(e.body) > 0.15) {
        calm = false;
        break;
      }
    }
    this.calmTime = calm ? this.calmTime + STEP_MS : 0;
    if (this.calmTime > 400 || this.phaseTime > 5000) this.resolveTurn();
  }

  private resolveTurn(): void {
    if (this.targetsLeft === 0) {
      let x = SLING.x - 60;
      for (const key of this.queue.splice(0)) {
        this.score += UNUSED_LAUNCHER_BONUS;
        this.events.push({ type: 'points', x, y: GROUND_Y - 40, points: UNUSED_LAUNCHER_BONUS });
        this.events.push({ type: 'bonus', x, y: GROUND_Y - 20, key });
        x -= 50;
      }
      this.events.push({ type: 'won' });
      this.setPhase('won');
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      this.events.push({ type: 'lost' });
      this.setPhase('lost');
      return;
    }
    // Spent Pokémon leave the field so they do not clutter the next shot.
    for (const p of this.projectiles) {
      if (!p.dead) p.dead = true;
    }
    this.reap();
    this.projectiles = [];
    this.loaded = next;
    this.events.push({ type: 'loaded', key: next });
    this.setPhase('aiming');
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.calmTime = 0;
    this.slowTime = 0;
  }

  private outOfBounds(body: Matter.Body): boolean {
    const { x, y } = body.position;
    return x < -KILL_MARGIN || x > this.level.width + KILL_MARGIN || y > WORLD_BOTTOM + 200 || y < -3000;
  }

  private inWater(e: Entity): boolean {
    if (!this.level.water || e.home) return false;
    const { x, y } = e.body.position;
    return y > GROUND_Y + 6 && this.level.water.some(([x0, x1]) => x > x0 && x < x1);
  }

  // --- collisions and damage -------------------------------------------

  private onCollisions(pairs: Matter.Pair[]): void {
    for (const pair of pairs) {
      const a = this.entities.get(pair.bodyA.parent.id);
      const b = this.entities.get(pair.bodyB.parent.id);
      if (!a || !b) continue;

      if (a.kind === 'pickup' || b.kind === 'pickup') {
        const [pickup, other] = a.kind === 'pickup' ? [a, b] : [b, a];
        if (!pickup.dead && !other.body.isStatic) this.collect(pickup);
        continue;
      }

      const va = Body.getVelocity(a.body);
      const vb = Body.getVelocity(b.body);
      const n = pair.collision.normal;
      const closing = Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y);

      for (const [self, other, v] of [[a, b, va], [b, a, vb]] as const) {
        if (self.kind === 'projectile' && !self.hasHit) {
          self.hasHit = true;
          Body.set(self.body, 'frictionAir', 0.01);
        }
        if (self.kind === 'projectile' && other.kind === 'block') {
          this.pierce.push({ entity: self, velocity: { x: v.x, y: v.y }, victim: other });
        }
      }

      if (this.time < GRACE_MS) continue;
      const massA = a.body.isStatic ? Infinity : a.body.mass;
      const massB = b.body.isStatic ? Infinity : b.body.mass;
      this.hurt(a, impactDamage(closing, massA, massB) * b.power);
      this.hurt(b, impactDamage(closing, massB, massA) * a.power);

      if (closing > 4 && (a.kind === 'projectile' || b.kind === 'projectile')) {
        const at = pair.collision.supports[0] ?? a.body.position;
        this.events.push({ type: 'impact', x: at.x, y: at.y, strength: closing });
      }
    }
  }

  private collect(pickup: Entity): void {
    if (!pickup.item) return;
    pickup.dead = true;
    this.collected = pickup.item;
    this.score += PICKUP_POINTS;
    const { x, y } = pickup.body.position;
    this.events.push({ type: 'pickup', x, y, item: pickup.item });
    this.events.push({ type: 'points', x, y: y - 20, points: PICKUP_POINTS });
  }

  private hurt(e: Entity, amount: number): void {
    if (amount <= 0 || e.dead || (e.kind !== 'block' && e.kind !== 'target')) return;
    e.hp -= amount;
    if (amount > 2) e.hitFlash = 220;
  }

  private blast(at: Vec, spec: typeof BOMB, power: number): void {
    this.events.push({ type: 'explode', x: at.x, y: at.y, radius: spec.radius });
    for (const e of this.entities.values()) {
      if (e.dead || e.body.isStatic || e.kind === 'projectile') continue;
      const dx = e.body.position.x - at.x;
      const dy = e.body.position.y - at.y;
      const distance = Math.hypot(dx, dy);
      const reach = spec.radius + Math.max(e.w, e.h) / 2;
      const f = blastFalloff(distance, reach);
      if (f <= 0) continue;
      this.hurt(e, spec.damage * f * power);
      Sleeping.set(e.body, false);
      const kick = spec.kick * f * Math.min(1, 6 / e.body.mass);
      const v = Body.getVelocity(e.body);
      const d = distance || 1;
      Body.setVelocity(e.body, { x: v.x + (dx / d) * kick, y: v.y + (dy / d) * kick - kick * 0.3 });
    }
  }

  /**
   * Remove everything marked dead, paying out for what was broken. Blasts go
   * off here too, and a crate caught in one is removed in the same pass, so
   * a row of crates goes up together.
   */
  private reap(): void {
    let removed = false;
    for (let pass = 0; pass < 20; pass += 1) {
      for (const { at, spec, power } of this.blasts.splice(0)) this.blast(at, spec, power);
      for (const e of this.entities.values()) if (!e.dead && e.hp <= 0 && e.kind !== 'projectile') e.dead = true;
      const dead = [...this.entities].filter(([, e]) => e.dead);
      if (dead.length === 0 && this.blasts.length === 0) break;
      for (const [id, e] of dead) {
        const { x, y } = e.body.position;
        if (e.kind === 'block' && e.material) {
          const points = MATERIALS[e.material].points;
          this.score += points;
          if (!e.sank) this.events.push({ type: 'break', x, y, w: e.w, h: e.h, angle: e.body.angle, material: e.material });
          this.events.push({ type: 'points', x, y, points });
          if (e.material === 'tnt' && !e.sank) this.blasts.push({ at: { x, y }, spec: CRATE, power: 1 });
        } else if (e.kind === 'target' && e.target) {
          this.score += e.target.points;
          this.events.push({ type: 'faint', x, y, kind: e.target.key });
          this.events.push({ type: 'points', x, y: y - 20, points: e.target.points });
        }
        Composite.remove(this.engine.world, e.body);
        this.entities.delete(id);
        removed = true;
      }
    }
    if (removed) {
      // Matter does not wake bodies whose support vanished; do it for them.
      for (const e of this.entities.values()) if (e.body.isSleeping) Sleeping.set(e.body, false);
    }
  }
}
