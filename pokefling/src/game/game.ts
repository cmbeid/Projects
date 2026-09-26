/**
 * One attempt at one level: the physics world, the sling, whose turn it is,
 * and the score. No DOM in here, so the whole thing runs under Vitest — the
 * renderer only ever reads it, and drains `events` to know what to animate.
 */
import Matter from 'matter-js';
import type { LevelDef } from '../data/levels';
import { MATERIALS, type Material } from '../data/materials';
import {
  LAUNCHERS, TARGETS,
  type LauncherDef, type LauncherKey, type TargetDef, type TargetKey,
} from '../data/roster';
import { blastFalloff, impactDamage } from './damage';
import { UNUSED_LAUNCHER_BONUS } from './scoring';
import { launchVelocity, type Vec } from './sling';
import { GROUND_Y, KILL_MARGIN, MIN_PULL, SLING, WORLD_BOTTOM } from './world';

const { Bodies, Body, Composite, Engine, Events, Sleeping } = Matter;

/** Two physics steps per frame: fast shots stay out of thin planks. */
export const STEP_MS = 1000 / 120;
/** Blocks shuffle into place for this long before anything can break. */
export const GRACE_MS = 1500;

const BLAST_RADIUS = 150;
const BLAST_DAMAGE = 90;
const BLAST_KICK = 16;
/** Voltorb goes off on its own this long after it first hits something. */
const FUSE_MS = 1500;

export type Phase = 'aiming' | 'flying' | 'settling' | 'won' | 'lost';
export type EntityKind = 'ground' | 'terrain' | 'block' | 'target' | 'projectile';

export interface Entity {
  readonly id: number;
  readonly kind: EntityKind;
  readonly body: Matter.Body;
  readonly w: number;
  readonly h: number;
  readonly radius: number;
  readonly material?: Material;
  readonly target?: TargetDef;
  readonly launcher?: LauncherDef;
  hp: number;
  readonly maxHp: number;
  /** Counts down after a hit, so the renderer can flash it. */
  hitFlash: number;
  dead: boolean;
  /** Projectiles only: has it touched anything yet? */
  hasHit: boolean;
  /** Floating targets only: where it hovers. */
  readonly home?: Vec;
}

export type GameEvent =
  | { type: 'launch'; key: LauncherKey }
  | { type: 'impact'; x: number; y: number; strength: number }
  | { type: 'break'; x: number; y: number; w: number; h: number; angle: number; material: Material }
  | { type: 'faint'; x: number; y: number; kind: TargetKey }
  | { type: 'points'; x: number; y: number; points: number }
  | { type: 'ability'; key: LauncherKey; x: number; y: number }
  | { type: 'explode'; x: number; y: number; radius: number }
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

  private phaseTime = 0;
  private calmTime = 0;
  private slowTime = 0;
  private fuse = 0;
  private trailClock = 0;
  private accumulator = 0;
  private nextId = 1;
  private readonly pierce: { entity: Entity; velocity: Vec; victim: Entity }[] = [];

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

  /** The Pokémon in flight whose ability a tap would trigger. */
  get abilityTarget(): Entity | null {
    if (this.phase !== 'flying' || this.abilityUsed) return null;
    const lead = this.projectiles[0];
    if (!lead || lead.dead || !lead.launcher || lead.launcher.ability === 'none') return null;
    // Most abilities only make sense on the way in; a bomb can still go off.
    if (lead.hasHit && lead.launcher.ability !== 'explode') return null;
    return lead;
  }

  /** Fire whatever is in the pouch. `pull` is the pouch offset from the sling. */
  launch(pull: Vec): boolean {
    if (this.phase !== 'aiming' || !this.loaded) return false;
    if (Math.hypot(pull.x, pull.y) < MIN_PULL) return false;

    const def = LAUNCHERS[this.loaded];
    const projectile = this.spawnProjectile(def, { x: SLING.x + pull.x, y: SLING.y + pull.y }, launchVelocity(pull));
    this.projectiles = [projectile];
    this.events.push({ type: 'launch', key: def.key });
    this.loaded = null;
    this.abilityUsed = false;
    this.shots += 1;
    this.lastTrail = this.trail;
    this.trail = [];
    this.fuse = 0;
    this.setPhase('flying');
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
          this.projectiles.push(this.spawnProjectile(lead.launcher, at, dir));
        }
        break;
      case 'explode':
        this.explode(lead);
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
    const span = level.width + KILL_MARGIN * 4;
    const groundHeight = WORLD_BOTTOM - GROUND_Y + 200;
    this.add('ground', Bodies.rectangle(level.width / 2, GROUND_Y + groundHeight / 2, span, groundHeight,
      { isStatic: true, friction: 1, label: 'ground' }), { w: span, h: groundHeight });

    for (const t of level.terrain) {
      this.add('terrain', Bodies.rectangle(t.x, t.y, t.w, t.h, { isStatic: true, friction: 1, label: 'terrain' }),
        { w: t.w, h: t.h });
    }

    for (const b of level.blocks) {
      const mat = MATERIALS[b.material];
      const body = Bodies.rectangle(b.x, b.y, b.w, b.h, {
        density: mat.density, friction: mat.friction, frictionStatic: 1, restitution: 0.05, label: b.material,
      });
      this.add('block', body, { w: b.w, h: b.h, material: b.material, hp: mat.hp });
    }

    for (const t of level.targets) {
      const def = TARGETS[t.kind];
      const body = Bodies.circle(t.x, t.y, def.radius, {
        density: 0.001, friction: 0.8, frictionAir: def.floats ? 0.03 : 0.01, restitution: 0.2, label: def.key,
      });
      if (def.floats) body.sleepThreshold = Infinity;
      this.add('target', body, {
        radius: def.radius, w: def.radius * 2, h: def.radius * 2, target: def, hp: def.hp,
        ...(def.floats ? { home: { x: t.x, y: t.y } } : {}),
      });
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
      hp, maxHp: hp, hitFlash: 0, dead: false, hasHit: false,
      ...(extra.material ? { material: extra.material } : {}),
      ...(extra.target ? { target: extra.target } : {}),
      ...(extra.launcher ? { launcher: extra.launcher } : {}),
      ...(extra.home ? { home: extra.home } : {}),
    };
    this.entities.set(body.id, entity);
    Composite.add(this.engine.world, body);
    return entity;
  }

  private spawnProjectile(def: LauncherDef, at: Vec, velocity: Vec): Entity {
    const body = Bodies.circle(at.x, at.y, def.radius, {
      density: def.density, restitution: def.restitution, friction: 0.6, frictionAir: 0, label: def.key,
    });
    const entity = this.add('projectile', body, { radius: def.radius, w: def.radius * 2, h: def.radius * 2, launcher: def });
    Body.setVelocity(body, velocity);
    return entity;
  }

  // --- simulation -------------------------------------------------------

  private step(): void {
    this.hover();
    Engine.update(this.engine, STEP_MS);
    this.time += STEP_MS;
    this.phaseTime += STEP_MS;

    for (const { entity, velocity, victim } of this.pierce.splice(0)) {
      // Smashing clean through a block keeps most of the momentum, rather than
      // bouncing off something that no longer exists.
      if (victim.dead && !entity.dead) Body.setVelocity(entity.body, { x: velocity.x * 0.6, y: velocity.y * 0.6 });
    }

    for (const e of this.entities.values()) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - STEP_MS);
      if (!e.dead && e.kind !== 'ground' && e.kind !== 'terrain' && this.outOfBounds(e.body)) {
        if (e.kind === 'target') e.hp = 0;
        e.dead = true;
      }
      if (e.kind !== 'projectile' && e.hp <= 0 && !e.dead) e.dead = true;
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

  // --- collisions and damage -------------------------------------------

  private onCollisions(pairs: Matter.Pair[]): void {
    for (const pair of pairs) {
      const a = this.entities.get(pair.bodyA.parent.id);
      const b = this.entities.get(pair.bodyB.parent.id);
      if (!a || !b) continue;

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
      this.hurt(a, impactDamage(closing, massA, massB));
      this.hurt(b, impactDamage(closing, massB, massA));

      if (closing > 4 && (a.kind === 'projectile' || b.kind === 'projectile')) {
        const at = pair.collision.supports[0] ?? a.body.position;
        this.events.push({ type: 'impact', x: at.x, y: at.y, strength: closing });
      }
    }
  }

  private hurt(e: Entity, amount: number): void {
    if (amount <= 0 || e.dead || (e.kind !== 'block' && e.kind !== 'target')) return;
    e.hp -= amount;
    if (amount > 2) e.hitFlash = 220;
  }

  private explode(bomb: Entity): void {
    const at = { x: bomb.body.position.x, y: bomb.body.position.y };
    this.events.push({ type: 'explode', x: at.x, y: at.y, radius: BLAST_RADIUS });
    bomb.dead = true;
    for (const e of this.entities.values()) {
      if (e.dead || e.body.isStatic || e === bomb) continue;
      const dx = e.body.position.x - at.x;
      const dy = e.body.position.y - at.y;
      const distance = Math.hypot(dx, dy);
      const reach = BLAST_RADIUS + Math.max(e.w, e.h) / 2;
      const f = blastFalloff(distance, reach);
      if (f <= 0) continue;
      this.hurt(e, BLAST_DAMAGE * f);
      Sleeping.set(e.body, false);
      const kick = BLAST_KICK * f * Math.min(1, 6 / e.body.mass);
      const v = Body.getVelocity(e.body);
      const d = distance || 1;
      Body.setVelocity(e.body, { x: v.x + (dx / d) * kick, y: v.y + (dy / d) * kick - kick * 0.3 });
    }
  }

  /** Remove everything marked dead, paying out for what was broken. */
  private reap(): void {
    let removed = false;
    for (const [id, e] of this.entities) {
      if (!e.dead) continue;
      const { x, y } = e.body.position;
      if (e.kind === 'block' && e.material) {
        const points = MATERIALS[e.material].points;
        this.score += points;
        this.events.push({ type: 'break', x, y, w: e.w, h: e.h, angle: e.body.angle, material: e.material });
        this.events.push({ type: 'points', x, y, points });
      } else if (e.kind === 'target' && e.target) {
        this.score += e.target.points;
        this.events.push({ type: 'faint', x, y, kind: e.target.key });
        this.events.push({ type: 'points', x, y: y - 20, points: e.target.points });
      }
      Composite.remove(this.engine.world, e.body);
      this.entities.delete(id);
      removed = true;
    }
    if (removed) {
      // Matter does not wake bodies whose support vanished; do it for them.
      for (const e of this.entities.values()) if (e.body.isSleeping) Sleeping.set(e.body, false);
    }
  }
}
