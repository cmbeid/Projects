import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/story';
import { MAPS, MAP_IDS, doorAt, mapSize, nodesOn, tileAt, walkable } from '../src/data/maps';
import { TRAINERS, TOWNSFOLK } from '../src/data/people';
import { act, ballBonus, endBattle, startTrainerBattle } from '../src/game/battle';
import { setRole } from '../src/game/barn';
import { gather, nodeReady } from '../src/game/forage';
import { passableFor } from '../src/game/helpers';
import { collectMachine, isDone, loadBlocker, loadMachine, placeMachine, runMachines } from '../src/game/machines';
import { adopt, makeMon } from '../src/game/mon';
import { canChallenge, checkSight, spawnNpcs } from '../src/game/npcs';
import { pathBeside, pathTo } from '../src/game/path';
import { catchUpStory, checkStory, deliverToMayor, kaiReady, progress, visit } from '../src/game/story';
import { parseWorld } from '../src/state/save';
import { sleep, tapTile, tick, warpTo } from '../src/game/world';
import { run, stand, world } from './helpers';

const ALL_FLAGS = CHAPTERS.map((c) => c.flag);

describe('the wider world', () => {
  it('links every map both ways through walkable warps', () => {
    for (const id of MAP_IDS) {
      const { w, h } = mapSize(id);
      for (const row of MAPS[id].rows) expect(row.length, id).toBe(w);
      expect(MAPS[id].rows.length).toBe(h);
      for (const warp of MAPS[id].warps) {
        expect(walkable(tileAt(id, warp.x, warp.y)), `${id} warp`).toBe(true);
        expect(walkable(tileAt(warp.to, warp.tx, warp.ty)), `${id} → ${warp.to}`).toBe(true);
        expect(MAPS[warp.to].warps.some((back) => back.to === id), `${warp.to} leads back to ${id}`).toBe(true);
      }
    }
  });

  it('reaches every patch of grass, resource spot, door and trainer once the story opens the way', () => {
    const w = world();
    w.story.flags.push(...ALL_FLAGS);
    for (const id of ['route1', 'town', 'route2', 'route3'] as const) {
      const ok = passableFor(w, id);
      const entry = MAPS[id].warps[0]!;
      const targets: { x: number; y: number; beside: boolean }[] = [];
      MAPS[id].rows.forEach((row, y) => [...row].forEach((_, x) => {
        const kind = tileAt(id, x, y);
        if (kind === 'tall') targets.push({ x, y, beside: false });
        if (doorAt(id, x, y)) targets.push({ x, y, beside: true });
      }));
      for (const n of nodesOn(id)) targets.push({ x: n.x, y: n.y, beside: true });
      for (const t of [...TRAINERS, ...TOWNSFOLK].filter((p) => p.map === id)) targets.push({ x: t.x, y: t.y, beside: false });
      for (const t of targets) {
        const path = t.beside ? pathBeside(entry, t, ok) : pathTo(entry, t, ok);
        expect(path, `${id} ${t.x},${t.y}`).not.toBeNull();
      }
    }
  });

  it('keeps the road to town shut until the first chapter is done', () => {
    const w = world();
    expect(passableFor(w, 'route1')({ x: 11, y: 30 })).toBe(false);
    w.story.flags.push('road-open');
    expect(passableFor(w, 'route1')({ x: 11, y: 30 })).toBe(true);
  });

  it('gathers from resource spots, which regrow', () => {
    const w = world();
    warpTo(w, 'route2', 1, 13);
    const apricorn = nodesOn('route2').find((n) => n.kind === 'apricorn')!;
    expect(gather(w, apricorn.x, apricorn.y)).toBe(true);
    expect(w.inventory[apricorn.apricorn!]).toBe(1);
    expect(w.stats.apricorns).toBe(1);
    expect(gather(w, apricorn.x, apricorn.y)).toBe(false);
    w.day += 3;
    expect(nodeReady(w, 'route2', apricorn.x, apricorn.y)).toBe(true);
    const log = nodesOn('route2').find((n) => n.kind === 'log')!;
    gather(w, log.x, log.y);
    expect(w.inventory.wood).toBeGreaterThanOrEqual(2);
    warpTo(w, 'route3', 11, 1);
    const ore = nodesOn('route3')[0]!;
    gather(w, ore.x, ore.y);
    expect((w.inventory['copper-ore'] ?? 0) + (w.inventory['iron-ore'] ?? 0) + (w.inventory.nugget ?? 0)).toBeGreaterThan(0);
  });
});

describe('trainers', () => {
  it('battles through a whole team: no catching, no running, gold at the end', () => {
    const w = world(4);
    w.mons[0]!.level = 40;
    w.mons[0]!.hp = 200;
    startTrainerBattle(w, 'ana');
    const b = w.battle!;
    expect(b.trainer!.team.map((m) => m.dex)).toEqual([16, 10]);
    expect(act(w, { kind: 'item', id: 'poke-ball' }).some((e) => e.kind === 'text' && /can't catch/.test(e.text))).toBe(true);
    expect(w.inventory['poke-ball']).toBe(5);
    expect(act(w, { kind: 'run' }).some((e) => e.kind === 'text' && /no running/.test(e.text))).toBe(true);
    const gold = w.player.gold;
    let sent = false;
    for (let i = 0; i < 20 && !b.over; i += 1) if (act(w, { kind: 'move', index: 0 }).some((e) => e.kind === 'sendWild')) sent = true;
    expect(sent).toBe(true);
    expect(b.over).toBe('win');
    expect(w.player.gold).toBe(gold + 150);
    endBattle(w);
    expect(canChallenge(w, 'ana')).toBe(false);
    w.day += 7;
    expect(canChallenge(w, 'ana')).toBe(true);
    startTrainerBattle(w, 'ana');
    expect(w.battle!.trainer!.team[0]!.level).toBe(4 + 3);
  });

  it('spots you in its line of sight, walks over and challenges', () => {
    const w = world();
    w.story.flags.push('road-open');
    warpTo(w, 'route1', 11, 1);
    const joey = w.npcs.find((n) => n.id === 'joey')!;
    joey.facing = 'right';
    stand(w, 9, 11);
    expect(checkSight(w)).toBe(true);
    expect(w.approach).toBe('joey');
    tapTile(w, 2, 2);
    expect(w.player.path).toEqual([]);
    for (let i = 0; i < 200 && w.approach; i += 1) tick(w, 1 / 30);
    expect(w.events.some((e) => e.kind === 'challenge' && e.npc === 'joey')).toBe(true);
  });

  it('respawns trainers on each arrival', () => {
    const w = world();
    w.map = 'route2';
    spawnNpcs(w);
    expect(w.npcs.filter((n) => n.kind === 'trainer')).toHaveLength(TRAINERS.filter((t) => t.map === 'route2').length);
  });
});

describe('stations', () => {
  function farmWith(...ids: string[]) {
    const w = world(7);
    for (const id of ids) w.inventory[id] = (w.inventory[id] ?? 0) + 1;
    ids.forEach((id, i) => expect(placeMachine(w, id, 5 + i, 25)).toBe(true));
    return w;
  }

  it('smelts five ore into a bar, burning wood unless a Fire Pokémon is on the farm', () => {
    const w = farmWith('furnace');
    w.inventory['iron-ore'] = 10;
    expect(loadBlocker(w, 5, 25, 'iron-ore')).toMatch(/Wood/);
    w.inventory.wood = 1;
    expect(loadMachine(w, 5, 25, 'iron-ore')).toBe(true);
    expect(w.inventory['iron-ore']).toBe(5);
    expect(w.inventory.wood).toBeUndefined();
    runMachines(w, 4 * 60);
    expect(collectMachine(w, 5, 25)).toBe(true);
    expect(w.inventory['iron-bar']).toBe(1);
    expect(w.stats.smelted['iron-bar']).toBe(1);
    // A Charmander in the barn: no wood, and twice as fast.
    const charmander = makeMon(4, 10, w.rng);
    adopt(w, charmander, false);
    setRole(w, charmander.uid, 'farm');
    expect(loadMachine(w, 5, 25, 'iron-ore')).toBe(true);
    runMachines(w, 2 * 60);
    expect(isDone(w, '5,25')).toBe(true);
  });

  it('makes Apricorn balls that are better against the right Pokémon', () => {
    const w = farmWith('apricorn-workshop');
    w.inventory['red-apricorn'] = 1;
    expect(loadMachine(w, 5, 25, 'red-apricorn')).toBe(true);
    runMachines(w, 2 * 60);
    collectMachine(w, 5, 25);
    expect(w.inventory['level-ball']).toBe(1);
    w.mons[0]!.level = 20;
    w.battle = null;
    const b = { wild: makeMon(19, 5, w.rng), active: w.mons[0]!.uid } as Parameters<typeof ballBonus>[1];
    expect(ballBonus(w, b, 'level-ball')).toBe(4);
    expect(ballBonus(w, b, 'lure-ball')).toBe(1);
  });
});

describe('the story', () => {
  it("starts a new farm at chapter 1, with the Mayor's letter", () => {
    const w = world();
    expect(w.story.chapter).toBe(0);
    expect(w.events.some((e) => e.kind === 'story' && e.beat === 'intro')).toBe(true);
  });

  it('opens the road once you ship ten berries and make a second friend', () => {
    const w = world();
    w.inventory.cheri = 10;
    for (let i = 0; i < 10; i += 1) w.bin.cheri = 10;
    delete w.inventory.cheri;
    sleep(w);
    expect(w.stats.shippedBerries).toBe(10);
    expect(w.story.chapter).toBe(0);
    adopt(w, makeMon(16, 3, w.rng));
    checkStory(w);
    expect(w.story.chapter).toBe(1);
    expect(w.story.flags).toContain('road-open');
    expect(w.events.some((e) => e.kind === 'story' && e.beat === 'ch1-done')).toBe(true);
  });

  it('takes deliveries for the Pokémon Center and hands over a Workbench', () => {
    const w = world();
    w.story.chapter = 1;
    visit(w, 'town');
    expect(w.events.some((e) => e.kind === 'story' && e.beat === 'ch2-start')).toBe(true);
    w.inventory.wood = 12;
    w.inventory.oran = 4;
    w.inventory.cheri = 6;
    deliverToMayor(w);
    expect(progress(w, CHAPTERS[1]!.objectives[1]!).have).toBe(12);
    expect(w.story.chapter).toBe(1);
    w.inventory.wood = 8;
    deliverToMayor(w);
    expect(w.story.chapter).toBe(2);
    expect(w.story.flags).toContain('center-open');
    expect(w.inventory.workbench).toBe(1);
  });

  it('readies the festival battle once the goods are in, and finishes with Kai', () => {
    const w = world(1);
    w.story.chapter = 4;
    expect(kaiReady(w)).toBe(false);
    w.inventory['oran-jam'] = 3;
    deliverToMayor(w);
    expect(kaiReady(w)).toBe(true);
    startTrainerBattle(w, 'kai');
    expect(w.battle!.trainer!.team.at(-1)!.dex).toBe(5); // Charmeleon, against your Bulbasaur
    w.trainers.kai = { week: 0, wins: 1 };
    w.battle = null;
    checkStory(w);
    expect(w.story.chapter).toBe(CHAPTERS.length);
    expect(w.story.flags).toContain('story-done');
  });

  it('catches an older farm up to the right chapter, silently', () => {
    const w = parseWorld({ helpers: [{ dex: 4 }, { dex: 16 }], stats: { harvested: 40 }, player: { gold: 100 } })!;
    expect(w.story.chapter).toBe(1);
    expect(w.story.flags).toContain('road-open');
    expect(w.events).toEqual([]);
    expect(w.inventory.workbench).toBe(1);
    void catchUpStory;
  });
});

describe('runs smoothly', () => {
  it('keeps playing through a day on the new maps', () => {
    const w = world();
    w.story.flags.push(...ALL_FLAGS);
    for (const [map, x, y] of [['town', 11, 1], ['route2', 1, 13], ['route3', 11, 1]] as const) {
      warpTo(w, map, x, y);
      run(w, 10);
      expect(w.map === map || w.battle !== null || w.map === 'farm').toBe(true);
      w.battle = null;
      w.approach = null;
    }
  });
});
