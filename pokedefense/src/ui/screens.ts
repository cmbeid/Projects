/**
 * Every screen outside a battle: the title, the Kanto map, choosing a team,
 * the Poké Mart, the Pokédex and settings.
 */
import { busGains, sfx, unlock, loadCries, cry } from '../audio/index';
import { playMusic, preloadMusic } from '../audio/music';
import {
  BALL_KEYS, BALLS, HELD_ITEMS, POWERUP_KEYS, POWERUPS, TRAINER, TRAINER_KEYS, type TrainerKey,
} from '../data/items';
import { COLS, MAPS, type MapDef, ROWS } from '../data/maps';
import { MART_TRACK, TITLE_TRACK } from '../data/music';
import { previousRegion, REGION_IDS, REGIONS, type RegionId } from '../data/regions';
import { SPECIES, species } from '../data/species';
import { LINES, lineForDex, type TowerLine } from '../data/towers';
import { TYPE_COLOURS } from '../data/types';
import { type DifficultyKey } from '../game/waves';
import { renderGround } from '../render/tiles';
import { badgeImg, icon, thumb } from '../render/thumbs';
import { drawPokemon, loadSheets } from '../render/sprites';
import {
  badges, cleared, freshProgress, lineUnlocked, mapUnlocked, type Progress, regionMaps, regionUnlocked, TEAM_SIZE, unlockedLines,
} from '../state/save';
import { button, getProgress, modal, mount, setProgress, toast } from './app';
import { startBattle } from './battle';
import { h } from './dom';
import { fullscreenButton } from './fullscreen';

export const WEATHER_ICON = { rain: '🌧️', sun: '☀️', sand: '🏜️', hail: '🌨️', fog: '🌫️' } as const;

function topbar(title: string, back?: () => void, ...extra: (Node | null)[]): HTMLElement {
  return h('header.topbar', {},
    back ? button('btn.small.icon.ghost', '←', back, { 'aria-label': 'Back', style: 'border-color:rgba(255,255,255,0.35)' }) : null,
    h('h1', {}, title),
    ...extra);
}

function bpChip(p: Progress): HTMLElement {
  return h('span.chip.gold', { title: 'Battle Points — spend them at the Poké Mart' }, `${p.bp} BP`);
}

function starText(n: number): HTMLElement {
  return h('span.stars', {}, ...[1, 2, 3].map((i) => h('span', { className: i <= n ? 'on' : '' }, '★')));
}

// --- title --------------------------------------------------------------------------

export function titleScreen(): void {
  const parade = h('canvas.parade');
  const menu = h('div.menu', {},
    button('btn.primary', '▶ Play', () => worldScreen()),
    button('btn', 'Pokédex', () => dexScreen(titleScreen)),
    button('btn', 'Poké Mart', () => martScreen(titleScreen)),
    button('btn', 'Settings', () => settingsScreen(titleScreen)),
  );
  const fs = fullscreenButton('btn small ghost', () => undefined);
  const el = h('div.screen.title', {},
    parade,
    h('div.logo', {}, h('div.poke', {}, 'Poké', h('br'), 'Defense'), h('div.sub', {}, 'KANTO TOWER DEFENSE')),
    h('div.tap-hint', {}, 'Tap anywhere for sound'),
    menu,
    fs,
    h('div.foot', {}, 'Pokémon and all related names, sprites, cries and music © Nintendo / Creatures / GAME FREAK. A personal fan project.'),
  );
  el.addEventListener('pointerdown', () => {
    unlock();
    playMusic(TITLE_TRACK);
    el.querySelector('.tap-hint')?.remove();
  }, { once: true });

  // A parade of Pokémon marching across the bottom of the title.
  const walkers = [4, 7, 1, 25, 155, 158, 152, 252, 255, 258, 390, 393, 387, 495, 498, 501, 653, 656, 650, 133, 143, 94, 249, 149, 6, 157, 260, 448, 658, 384, 487, 644, 151, 150];
  void loadSheets(walkers);
  const ctx = parade.getContext('2d')!;
  let raf = 0;
  const tick = (ts: number): void => {
    raf = requestAnimationFrame(tick);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = parade.clientWidth * dpr;
    const hh = parade.clientHeight * dpr;
    if (parade.width !== w) parade.width = w;
    if (parade.height !== hh) parade.height = hh;
    ctx.clearRect(0, 0, w, hh);
    ctx.imageSmoothingEnabled = false;
    const spacing = 110 * dpr;
    const total = walkers.length * spacing;
    walkers.forEach((dex, i) => {
      const x = ((i * spacing + ts * 0.05 * dpr) % total) - spacing;
      drawPokemon(ctx, dex, x, hh - 64 * dpr, 1.6 * dpr, { time: ts + i * 300, flip: true, alpha: 0.9 });
    });
  };
  raf = requestAnimationFrame(tick);
  mount(el, () => cancelAnimationFrame(raf));
  playMusic(TITLE_TRACK);
}

// --- world map ------------------------------------------------------------------------------

function mapThumb(map: MapDef): HTMLCanvasElement {
  const ground = renderGround(map);
  const c = document.createElement('canvas');
  c.className = 'pix';
  c.width = COLS * 16;
  c.height = COLS * 16;
  const ctx = c.getContext('2d')!;
  // The middle of the map, square.
  ctx.drawImage(ground, 0, ((ROWS - COLS) / 2) * 16, COLS * 16, COLS * 16, 0, 0, c.width, c.height);
  return c;
}

/** The region the world map is showing; defaults to the newest one open. */
let shownRegion: RegionId | null = null;

export function worldScreen(): void {
  const p = getProgress();
  const open = REGION_IDS.filter((id) => regionUnlocked(p, id));
  const regionId = shownRegion && open.includes(shownRegion) ? shownRegion : open[open.length - 1]!;
  const region = REGIONS[regionId];
  const earned = badges(p);
  const maps = regionMaps(regionId);
  const cards = maps.map((map) => {
    const unlocked = mapUnlocked(p, map);
    const r = p.results[map.id];
    const side = h('div.side', {},
      map.badge ? badgeImg(map.badge, `pix badge${earned.includes(map.badge) ? '' : ' dim'}`) : h('span', { style: 'font-size:26px' }, map.endless ? '♾️' : '🏆'),
      map.endless ? h('span.muted', { style: 'font-size:12px' }, r?.best ? `Best: ${r.best}` : '') : starText(r?.normal ?? 0),
      !map.endless && r?.normal ? h('span', { style: 'font-size:11px' }, h('span.muted', {}, 'Hard '), starText(r.hard)) : null,
    );
    return h('button.map-card', {
      className: `map-card${unlocked ? '' : ' locked'}`,
      disabled: !unlocked,
      onclick: () => {
        unlock();
        sfx.click();
        teamScreen(map);
      },
    },
    h('div.thumb', {}, mapThumb(map)),
    h('div', {},
      h('div.name', {}, unlocked ? map.name : `🔒 ${map.name}`, map.weather ? ` ${WEATHER_ICON[map.weather]}` : ''),
      h('div.sub', {}, `${map.area} · ${map.endless ? 'endless waves' : `${map.waves} waves`} · ${map.leader}`),
      h('div.twist', {}, unlocked ? map.twist : map.endless ? `Become Champion of ${region.name} to enter.` : 'Clear the map before it to unlock.')),
    side);
  });

  const tabs = h('div.tabs.regions', {}, ...REGION_IDS.map((id) => {
    const isOpen = open.includes(id);
    return button(`btn.small${id === regionId ? '.on' : ''}`, isOpen ? REGIONS[id].name : `🔒 ${REGIONS[id].name}`, () => {
      if (!isOpen) {
        toast(`Become Champion of ${REGIONS[previousRegion(id)!].name} to travel to ${REGIONS[id].name}.`);
        return;
      }
      shownRegion = id;
      worldScreen();
    });
  }));
  const regionStars = maps.reduce((sum, m) => sum + (p.results[m.id]?.normal ?? 0) + (p.results[m.id]?.hard ?? 0), 0);
  const badgeRow = h('div.badges-row', {}, ...region.badges.map((n) => badgeImg(n, `pix${earned.includes(n) ? '' : ' dim'}`)));
  const el = h('div.screen', {},
    topbar(region.name, titleScreen, bpChip(p)),
    h('div.scroll', {}, h('div.content', {},
      tabs,
      h('div.card.row', { style: 'justify-content:space-between;flex-wrap:wrap' }, badgeRow, h('span.chip', {}, `★ ${regionStars} / ${(maps.length - 1) * 6}`)),
      h('div.maps', {}, ...cards))),
    h('nav.nav', {},
      button('btn', h('span', {}, icon('poke-ball', 26), h('div', {}, 'Pokédex')), () => dexScreen(worldScreen)),
      button('btn', h('span', {}, icon('great-ball', 26), h('div', {}, 'Poké Mart')), () => martScreen(worldScreen)),
      button('btn', h('span', {}, icon('exp-share', 26), h('div', {}, 'Held items')), () => martScreen(worldScreen, 'held')),
      button('btn', h('span', {}, h('div.emoji', {}, '⚙️'), h('div', {}, 'Settings')), () => settingsScreen(worldScreen)),
    ),
  );
  mount(el);
  // Six regions don't fit a phone's width: keep the one shown in view.
  tabs.querySelector<HTMLElement>('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  playMusic(region.worldTrack);
  if (!p.greeted.includes(regionId)) welcome(regionId);
}

/** Arriving in a new region: its professor hands over the three starters. */
function welcome(id: RegionId): void {
  const region = REGIONS[id];
  const lines = region.starters.map((lineId) => LINES.find((l) => l.id === lineId)!);
  const dexes = lines.map((l) => l.stages[0]!.dex);
  void loadSheets(dexes);
  loadCries(dexes);
  dexes.forEach((dex, i) => setTimeout(() => cry(dex, { volume: 0.5 }), 500 + i * 900));
  const close = modal(h('div', {},
    h('h2', {}, `Welcome to ${region.name}!`),
    h('p.muted', { style: 'margin:0;text-align:center' }, `${region.professor} has three Pokémon for you. All of them join your roster — and your team, if there’s room:`),
    h('div.caught-row', {}, ...lines.map((l) => h('div.mon', {}, thumb(l.stages[0]!.dex, 72, { animate: true }), l.name))),
    button('btn.primary', 'Thanks, Professor!', () => {
      const cur = getProgress();
      // Put the new starters straight onto the team, as far as there is room.
      const team = [...new Set([...cur.team, ...region.starters])].slice(0, TEAM_SIZE);
      setProgress({ ...cur, greeted: [...cur.greeted, id], team });
      close();
    }),
  ), { dismissable: false });
}

// --- team select -----------------------------------------------------------------------------

function towerCard(l: TowerLine, p: Progress, cls: string, onclick: () => void, extra: (Node | null)[] = []): HTMLElement {
  const held = p.held[l.id];
  return h('button', {
    className: cls,
    onclick: () => {
      unlock();
      sfx.click();
      onclick();
    },
    title: `${l.name}: ${l.role}`,
  },
  thumb(l.stages[0]!.dex, 48),
  h('span', {}, l.name),
  h('span.type', { style: `background:${TYPE_COLOURS[l.type]}` }, l.type),
  held ? icon(held, 20, 'pix held') : null,
  ...extra);
}

export function teamScreen(map: MapDef): void {
  const p = getProgress();
  const available = unlockedLines(p);
  let team = p.team.filter((id) => available.some((l) => l.id === id));
  if (!team.length) team = available.slice(0, TEAM_SIZE).map((l) => l.id);
  let difficulty: DifficultyKey = 'normal';
  const hardOpen = cleared(p, map) && !map.endless;

  const wildDex = [...new Set(map.pool.filter((x) => !x.rare).map((x) => x.dex))];
  const rareCount = map.pool.filter((x) => x.rare).length;
  void loadSheets([...wildDex, ...LINES.map((l) => l.stages[0]!.dex)]);
  loadCries(team.map((id) => LINES.find((l) => l.id === id)!.stages[0]!.dex));
  preloadMusic([map.track]);

  const slots = h('div.slots');
  const roster = h('div.roster');
  const diffSeg = h('div.segmented');
  const render = (): void => {
    slots.replaceChildren(...Array.from({ length: TEAM_SIZE }, (_, i) => {
      const id = team[i];
      const l = id ? LINES.find((x) => x.id === id) : undefined;
      if (!l) return h('div.slot.empty', {}, '+');
      return towerCard(l, p, 'slot', () => {
        team = team.filter((x) => x !== l.id);
        render();
      }, [h('span.stripe', { style: `background:${TYPE_COLOURS[l.type]}` })]);
    }));
    roster.replaceChildren(...LINES.map((l) => {
      if (!lineUnlocked(p, l)) {
        const hint = l.unlock.kind === 'badge' ? `Badge ${l.unlock.badge}` : 'Catch one';
        return h('div.roster-card.locked', {}, h('span', { style: 'font-size:30px;line-height:48px' }, '?'), h('span', {}, hint));
      }
      const on = team.includes(l.id);
      return towerCard(l, p, `roster-card${on ? ' on' : ''}`, () => {
        if (on) team = team.filter((x) => x !== l.id);
        else if (team.length < TEAM_SIZE) team = [...team, l.id];
        else toast(`A team has at most ${TEAM_SIZE} Pokémon.`);
        cry(l.stages[0]!.dex, { volume: 0.35 });
        render();
      });
    }));
    diffSeg.replaceChildren(...(['normal', 'hard'] as const).map((d) => h('button', {
      className: difficulty === d ? 'on' : '',
      disabled: d === 'hard' && !hardOpen,
      onclick: () => {
        sfx.click();
        difficulty = d;
        render();
      },
    }, d === 'normal' ? 'Normal' : hardOpen ? 'Hard' : '🔒 Hard')));
    go.disabled = team.length === 0;
  };

  const go = button('btn.primary', `Battle! ${map.name}`, () => {
    setProgress({ ...getProgress(), team });
    startBattle({ mapId: map.id, difficulty, team, onExit: worldScreen });
  }, { style: 'width:100%;min-height:54px;font-size:17px' });

  const el = h('div.screen', {},
    topbar(map.name, worldScreen, bpChip(p)),
    h('div.scroll', {}, h('div.content', {},
      h('div.card', {},
        h('div', { style: 'font-weight:800' }, `${map.area} — ${map.endless ? 'endless' : `${map.waves} waves`}, ${map.endless ? `${map.leader} lurks within` : `then ${map.leader}`}`),
        h('div.muted', { style: 'font-size:13px;margin-top:4px' }, map.twist),
        map.endless ? null : h('div.row', { style: 'margin-top:10px' }, h('span.muted', { style: 'font-size:13px' }, 'Difficulty'), diffSeg)),
      h('div.section-title', {}, 'Wild Pokémon here'),
      h('div.card', {}, h('div.wild', {}, ...wildDex.map((dex) => {
        const sp = species(dex);
        return h('div.mon', {}, thumb(dex, 48), sp.name, h('div', {}, ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]};font-size:8px;padding:0 3px;margin:1px` }, t))));
      }), rareCount ? h('div.mon', {}, h('span', { style: 'font-size:30px;line-height:48px' }, '✨'), `${rareCount} rare`) : null)),
      h('div.section-title', {}, `Your team (${TEAM_SIZE} max) — tap to remove`),
      slots,
      h('div.section-title', {}, 'Your Pokémon — tap to add'),
      roster,
      h('div.sticky-foot', {}, go))),
  );
  render();
  mount(el);
  playMusic(REGIONS[map.regionId].teamTrack);
}

// --- mart ------------------------------------------------------------------------------------------

type MartTab = 'items' | 'balls' | 'held' | 'trainer';

/** The shelf's scroll position, to keep it steady when the Mart redraws after a purchase. */
const shelfScroll = (): number => document.querySelector('.screen .scroll')?.scrollTop ?? 0;

export function martScreen(back: () => void, tab: MartTab = 'items', scrollTop = 0): void {
  const p = getProgress();
  const buy = (price: number, apply: (q: Progress) => Progress, what: string): void => {
    const cur = getProgress();
    if (cur.bp < price) {
      sfx.deny();
      toast('Not enough BP. Win battles to earn more.');
      return;
    }
    setProgress(apply({ ...cur, bp: cur.bp - price }));
    sfx.coin();
    toast(`Bought ${what}!`);
    martScreen(back, tab, shelfScroll());
  };
  const ware = (iconKey: string | null, name: string, desc: string, own: string, price: number | null, onBuy: (() => void) | null, extra: Node | null = null): HTMLElement =>
    h('div.card.ware', {},
      iconKey ? icon(iconKey, 40) : h('span', { style: 'font-size:30px;text-align:center' }, '🎖️'),
      h('div', {}, h('div.name', {}, name), h('div.desc', {}, desc), own ? h('div.own', {}, own) : null, extra),
      price === null ? h('span.muted', { style: 'font-weight:800' }, 'MAX') : button('btn.gold.small', `${price} BP`, () => onBuy?.(), { disabled: p.bp < price }));

  let shelf: HTMLElement[] = [];
  if (tab === 'items') {
    shelf = POWERUP_KEYS.map((k) => {
      const d = POWERUPS[k];
      return ware(k, d.name, d.desc, `In bag: ${p.items[k]}`, d.price, () => buy(d.price, (q) => ({ ...q, items: { ...q.items, [k]: q.items[k] + 1 } }), d.name));
    });
  } else if (tab === 'balls') {
    shelf = BALL_KEYS.map((k) => {
      const d = BALLS[k];
      const desc = k === 'master-ball' ? 'Catches any wild Pokémon without fail.' : `${d.bonus}× the catch rate of a Poké Ball.`.replace('1× the catch rate of a Poké Ball.', 'The standard ball.');
      return ware(k, d.name, desc, `In bag: ${p.balls[k]}`, d.price, () => buy(d.price, (q) => ({ ...q, balls: { ...q.balls, [k]: q.balls[k] + 1 } }), d.name));
    });
  } else if (tab === 'held') {
    shelf = HELD_ITEMS.filter((item) => !item.region || regionUnlocked(p, item.region)).map((item) => {
      const owned = p.heldOwned.includes(item.key);
      const equipped = Object.entries(p.held).filter(([, v]) => v === item.key).map(([lineId]) => LINES.find((l) => l.id === lineId)?.name).filter(Boolean);
      const equip = owned ? button('btn.small', equipped.length ? `On ${equipped.join(', ')}` : 'Give to…', () => equipModal(item.key, () => martScreen(back, tab, shelfScroll())), { style: 'margin-top:6px' }) : null;
      return ware(item.key, item.name, item.desc, owned ? 'Owned' : '', owned ? null : item.price, owned ? null : () => buy(item.price, (q) => ({ ...q, heldOwned: [...q.heldOwned, item.key] }), item.name), equip);
    });
    shelf.unshift(h('div.muted', { style: 'font-size:13px' }, 'Held items are kept for good. Give one to a kind of tower and every tower of that kind carries it — one item per kind.'));
  } else {
    shelf = TRAINER_KEYS.map((k: TrainerKey) => {
      const d = TRAINER[k];
      const tier = p.trainer[k];
      const max = d.prices.length;
      const next = tier < max ? d.prices[tier]! : null;
      const pips = h('div.pips', {}, ...d.prices.map((_, i) => h('i', { className: i < tier ? 'on' : '' })));
      return ware(null, d.name, tier ? d.desc(tier) : d.desc(1), tier < max ? `Next: ${d.desc(tier + 1)}` : '', next, next === null ? null : () => buy(next, (q) => ({ ...q, trainer: { ...q.trainer, [k]: q.trainer[k] + 1 } }), d.name), pips);
    });
  }

  const tabs = h('div.tabs', {}, ...([['items', 'Items'], ['balls', 'Poké Balls'], ['held', 'Held items'], ['trainer', 'Trainer']] as [MartTab, string][]).map(([k, label]) =>
    button(`btn.small${tab === k ? '.on' : ''}`, label, () => martScreen(back, k))));
  const scroll = h('div.scroll', {}, h('div.content', {}, tabs, h('div.shelf', {}, ...shelf)));
  mount(h('div.screen', {}, topbar('Poké Mart', back, bpChip(p)), scroll));
  scroll.scrollTop = scrollTop;
  playMusic(MART_TRACK);
}

function equipModal(itemKey: string, done: () => void): void {
  const p = getProgress();
  const lines = unlockedLines(p);
  const close = modal(h('div', {},
    h('h2', {}, 'Give to which Pokémon?'),
    h('div.roster', {}, ...lines.map((l) => towerCard(l, p, `roster-card${p.held[l.id] === itemKey ? ' on' : ''}`, () => {
      const cur = getProgress();
      const held = { ...cur.held };
      // One of each item: take it off whoever had it.
      for (const [k, v] of Object.entries(held)) if (v === itemKey) delete held[k];
      if (cur.held[l.id] !== itemKey) held[l.id] = itemKey;
      setProgress({ ...cur, held });
      close();
      done();
    }))),
    button('btn.ghost', 'Cancel', () => close())));
}

// --- pokédex ----------------------------------------------------------------------------------------

export function dexScreen(back: () => void): void {
  const p = getProgress();
  // Mega Evolutions are forms, not entries of their own.
  const all = [...SPECIES.values()].filter((sp) => sp.dex < 10000).sort((a, b) => a.dex - b.dex);
  void loadSheets(all.filter((s) => p.seen.includes(s.dex) || p.caught.includes(s.dex)).map((s) => s.dex));
  const cells = all.map((sp) => {
    const seen = p.seen.includes(sp.dex) || p.caught.includes(sp.dex);
    const caught = p.caught.includes(sp.dex);
    const l = lineForDex(sp.dex);
    return h('button.dex-cell', {
      className: `dex-cell${seen ? '' : ' unseen'}${l ? ' tower' : ''}`,
      onclick: () => {
        sfx.click();
        if (seen) dexDetail(sp.dex);
      },
    },
    seen ? thumb(sp.dex, 52, { shiny: p.shinies.includes(sp.dex) }) : h('span', { style: 'font-size:28px;line-height:52px;opacity:0.4' }, '?'),
    h('span.no', {}, `#${String(sp.dex).padStart(3, '0')}`),
    h('span', {}, seen ? sp.name : '???'),
    caught ? icon('poke-ball', 16, 'pix ball') : null,
    p.shinies.includes(sp.dex) ? h('span.shiny', {}, '✦') : null);
  });
  const seenCount = all.filter((s) => p.seen.includes(s.dex) || p.caught.includes(s.dex)).length;
  mount(h('div.screen', {},
    topbar('Pokédex', back, h('span.chip', {}, `Seen ${seenCount} · Caught ${p.caught.length} / ${all.length}`)),
    h('div.scroll', {}, h('div.content', {}, h('div.dex', {}, ...cells)))));
  playMusic(MART_TRACK);
}

function dexDetail(dex: number): void {
  const p = getProgress();
  const sp = species(dex);
  const l = lineForDex(dex);
  loadCries([dex]);
  setTimeout(() => cry(dex, { volume: 0.6 }), 150);
  const where = MAPS.filter((m) => m.pool.some((x) => x.dex === dex) || m.boss.dex === dex).map((m) => m.name);
  const close = modal(h('div', {},
    h('div', { style: 'display:flex;justify-content:center' }, thumb(dex, 120, { animate: true, shiny: p.shinies.includes(dex) })),
    h('h2', {}, `#${String(dex).padStart(3, '0')} ${sp.name}`),
    h('div', { style: 'text-align:center' }, ...sp.types.map((t) => h('span.type', { style: `background:${TYPE_COLOURS[t]};margin:0 3px` }, t))),
    h('div.card', { style: 'font-size:13px;line-height:1.5' },
      h('div', {}, `As a wild Pokémon: ${sp.hp} HP units, ${sp.speed} tiles/s${sp.armor ? `, ${Math.round(sp.armor * 100)}% armour` : ''}.`),
      sp.traits.length ? h('div', {}, `Traits: ${sp.traits.join(', ')}.`) : null,
      where.length ? h('div', {}, `Found in: ${where.join(', ')}.`) : null,
      h('div', {}, `Catch rate: ${sp.catchRate}/255.`),
      p.caught.includes(dex) ? h('div', { style: 'color:var(--green);font-weight:700' }, 'Caught!') : null),
    l ? h('div.card', { style: 'font-size:13px;line-height:1.5' },
      h('div', { style: 'font-weight:800' }, `${l.name} tower — ${l.role}`),
      h('div', {}, `${lineUnlocked(p, l) ? 'On your roster.' : l.unlock.kind === 'badge' ? `Joins with badge ${l.unlock.badge}, or by catching one.` : 'Catch one to add it to your roster.'}`),
      h('div', {}, `Moves at the top level: ${l.moves.map((m) => m.name).join(' or ')}.`),
      l.stages.length > 1 || l.branches ? h('div', {}, `Evolves: ${[...l.stages.map((s) => `${species(s.dex).name} (Lv ${s.level})`), ...(l.branches?.options.map((b) => `${species(b.dex).name} (Lv ${l.branches!.level})`) ?? [])].join(' → ')}`) : null)
      : null,
    button('btn.primary', 'Close', () => close())));
}

// --- settings ---------------------------------------------------------------------------------------

export function settingsScreen(back: () => void): void {
  const p = getProgress();
  const slider = (label: string, key: 'music' | 'cries' | 'sfx'): HTMLElement => {
    const input = h('input', { type: 'range', min: '0', max: '100', value: String(p.volumes[key]) });
    const out = h('span.muted', {}, `${p.volumes[key]}`);
    input.addEventListener('input', () => {
      unlock();
      const cur = getProgress();
      setProgress({ ...cur, volumes: { ...cur.volumes, [key]: Number(input.value) } });
      out.textContent = input.value;
    });
    input.addEventListener('change', () => {
      if (key === 'sfx') sfx.preview();
      if (key === 'cries') cry(25, { volume: 0.5 });
    });
    return h('div.card.setting', {}, h('span', { style: 'font-weight:700' }, label), out, input);
  };
  const toggle = (label: string, value: boolean, set: (v: boolean) => void): HTMLElement => {
    const sw = h('button.switch', { className: `switch${value ? ' on' : ''}`, 'aria-label': label });
    sw.addEventListener('click', () => {
      unlock();
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      set(next);
    });
    return h('div.card.setting', {}, h('span', { style: 'font-weight:700' }, label), sw);
  };
  loadCries([25]);
  mount(h('div.screen', {},
    topbar('Settings', back),
    h('div.scroll', {}, h('div.content', {},
      slider('Music', 'music'),
      slider('Pokémon cries', 'cries'),
      slider('Sound effects', 'sfx'),
      toggle('Mute everything', p.muted, (v) => setProgress({ ...getProgress(), muted: v })),
      toggle('Vibration', p.haptics, (v) => setProgress({ ...getProgress(), haptics: v })),
      // Turning tips back on replays the tutorial next time on the first map.
      toggle('Tips and tutorial', p.hints, (v) => setProgress({ ...getProgress(), hints: v, tutorialDone: v ? false : getProgress().tutorialDone })),
      h('div.card', {},
        h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'How to play'),
        h('div.credits', {},
          'Place Pokémon beside the path to stop wild Pokémon reaching the end. Each one that gets through costs lives. If a Gym Leader’s Pokémon gets through, that wave starts over until you beat it. ',
          'Tap a tower to level it up; at set levels it evolves, and at the top level it learns one of two signature moves. ',
          'Type matchups matter: Water beats Fire, Electric can’t touch Ground, Ground can’t reach flyers. Psychic and Ghost towers can see invisible Pokémon. ',
          'Weaken a wild Pokémon, then throw a Poké Ball to catch it — some towers can only be had this way. ',
          'Keyboard: 1–8 pick a tower, Space starts a wave, F changes speed, P pauses, U levels up, S sells, B throws a ball, Esc cancels or opens the menu.')),
      h('div.card', {},
        h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'Credits'),
        h('div.credits', {},
          'Sprites, item icons, badges and cries from ', h('a', { href: 'https://github.com/PokeAPI', target: '_blank', rel: 'noopener' }, 'PokeAPI'), '. ',
          'Music is Pokémon Crystal’s own, from the ', h('a', { href: 'https://github.com/pret/pokecrystal', target: '_blank', rel: 'noopener' }, 'pret/pokecrystal'), ' disassembly, played by a Game Boy–style synth. ',
          'Pokémon © Nintendo / Creatures / GAME FREAK. A personal, non-commercial fan project.')),
      button('btn.ghost', 'Reset all progress', () => {
        const close = modal(h('div', {},
          h('h2', {}, 'Reset everything?'),
          h('p.muted', { style: 'text-align:center;margin:0' }, 'Badges, stars, your Pokédex, items and BP will all be lost.'),
          button('btn.primary', 'Reset', () => {
            const fresh = freshProgress();
            setProgress({ ...fresh, volumes: getProgress().volumes });
            close();
            toast('Progress reset.');
            titleScreen();
          }),
          button('btn', 'Cancel', () => close())));
      }),
      h('div.muted', { style: 'font-size:11px;text-align:center' }, `Bus gains: ${Object.entries(busGains()).map(([k, v]) => `${k} ${v?.toFixed(2)}`).join(', ') || 'audio not started'}`),
    ))));
}
