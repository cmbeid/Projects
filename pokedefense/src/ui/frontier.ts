/**
 * The Battle Frontier's screens: the hub with its four facilities, and the
 * glue from a facility's next battle (`state/frontier.ts`) to the team
 * screen and the battle itself.
 */
import { sfx } from '../audio/index';
import { playMusic } from '../audio/music';
import { mapDef, type MapRules } from '../data/maps';
import { line, type TowerLine } from '../data/towers';
import { type PokeType, TYPE_COLOURS } from '../data/types';
import type { DifficultyKey } from '../game/waves';
import { thumb } from '../render/thumbs';
import {
  CUP_BATTLES, CUP_LINES_NOTE, CUP_MIN_LINES, CUP_TYPES, cupLines, cupMaps, endBattle, FACTORY_TEAM, type FrontierResult, gauntletMap, gauntletOpen,
  nextBattle, ROUND, startRun, swapOffers, typeName,
} from '../state/frontier';
import { type FacilityId, type FrontierRun, unlockedLines } from '../state/save';
import { button, getProgress, modal, mount, setProgress, toast } from './app';
import { startBattle } from './battle';
import { h } from './dom';
import { bpChip, teamScreen, topbar, worldScreen } from './screens';

const FACILITY_NAME: Record<FacilityId, string> = {
  tower: 'Battle Tower', factory: 'Battle Factory', mono: 'Mono-type Cup', gauntlet: 'Champions’ Gauntlet',
};

/** How the last Frontier battle went, for the screen after it. */
let last: { facility: FacilityId; mapId: string; result: FrontierResult } | null = null;

/** The options for a Frontier battle — shared with resuming one after the tab closed. */
export function frontierBattle(facility: FacilityId, mapId: string, difficulty: DifficultyKey, team: string[], rules: MapRules) {
  return {
    mapId, difficulty, team, rules, frontier: facility,
    onEnd: (r: { won: boolean; lives: number; cleared: number }) => {
      const result = endBattle(getProgress(), facility, r);
      setProgress(result.progress);
      last = { facility, mapId, result };
    },
    onExit: afterBattle,
  };
}

function afterBattle(): void {
  const done = last;
  last = null;
  frontierScreen();
  if (!done) return;
  const { result, facility } = done;
  const run = result.progress.frontier.run;
  if (result.trophy) toast(`🏆 ${typeName(result.trophy)} Cup won! +${result.bp} BP`);
  else if (result.over) toast(`${FACILITY_NAME[facility]}: ${facility === 'gauntlet' ? 'over' : 'your run is over'}. +${result.bp} BP`);
  else toast(`Streak: ${run?.streak ?? 0}. +${result.bp} BP`);
  // The Factory: after a win, trade a rental for one of the Pokémon you just beat.
  if (facility === 'factory' && run && !result.over) swapModal(run, done.mapId);
}

function swapModal(run: FrontierRun, mapId: string): void {
  const offers = swapOffers(mapDef(mapId), run.team);
  if (!offers.length) return;
  let give: string | null = null;
  const card = (l: TowerLine, on: boolean, onclick: () => void): HTMLElement => h('button', {
    className: `roster-card${on ? ' on' : ''}`, onclick,
  }, thumb(l.stages[0]!.dex, 48), h('span', {}, l.name), h('span.type', { style: `background:${TYPE_COLOURS[l.type]}` }, l.type));
  const body = h('div');
  const render = (): void => {
    body.replaceChildren(
      h('p.muted', { style: 'margin:0 0 6px;text-align:center' }, give ? 'Now pick the one to take in its place:' : 'Swap a rental? Pick the one to give up:'),
      h('div.roster', {}, ...run.team.map((id) => card(line(id), give === id, () => {
        give = id;
        render();
      }))),
      give ? h('div.roster', { style: 'margin-top:10px' }, ...offers.map((l) => card(l, false, () => {
        const p = getProgress();
        const cur = p.frontier.run;
        if (cur) setProgress({ ...p, frontier: { ...p.frontier, run: { ...cur, team: cur.team.map((x) => (x === give ? l.id : x)) } } });
        close();
        toast(`${l.name} joins your rental team.`);
        frontierScreen();
      }))) : '',
    );
  };
  render();
  const close = modal(h('div', {}, h('h2', {}, 'Battle Factory: swap'), body, button('btn.ghost', 'Keep my team', () => close())));
}

/** Play a run's next battle: the team screen, then the battle. */
function playNext(run: FrontierRun): void {
  const b = nextBattle(getProgress(), run);
  const note = run.facility === 'factory'
    ? `Rentals, already grown to level 3. Lives carry over: ♥ ${run.lives}.`
    : run.facility === 'mono'
      ? `${typeName(run.type!)} types only. Win all ${CUP_BATTLES} battles for the trophy.`
      : `Lives carry over: ♥ ${run.lives}. Hard from the fourth battle; the seventh is a Champion’s ace.`;
  teamScreen(b.map, {
    rules: b.rules, back: frontierScreen, note,
    ...(b.roster ? { roster: b.roster } : {}), ...(b.size ? { size: b.size } : {}),
    onStart: (team) => {
      if (run.facility === 'factory' && !run.team.length) {
        const p = getProgress();
        if (p.frontier.run) setProgress({ ...p, frontier: { ...p.frontier, run: { ...p.frontier.run, team } } });
      } else if (run.facility !== 'factory') setProgress({ ...getProgress(), team });
      startBattle(frontierBattle(b.facility, b.map.id, b.difficulty, team, b.rules));
    },
  });
}

function begin(facility: FrontierRun['facility'], type: PokeType | null = null): void {
  const p = getProgress();
  if (p.frontier.run) {
    toast(`Finish your ${FACILITY_NAME[p.frontier.run.facility]} run first, or forfeit it.`);
    return;
  }
  const next = startRun(p, facility, (Date.now() & 0x7fffffff) ^ 0x5eed, type);
  setProgress(next);
  playNext(next.frontier.run!);
}

function forfeit(): void {
  const p = getProgress();
  const run = p.frontier.run;
  if (!run) return;
  const result = endBattle(p, run.facility, { won: false, lives: 0, cleared: 0 });
  setProgress(result.progress);
  toast(`Run forfeited. +${result.bp} BP`);
  frontierScreen();
}

function cupPicker(): void {
  const owned = unlockedLines(getProgress());
  const won = getProgress().frontier.monoTrophies;
  const close = modal(h('div', {},
    h('h2', {}, 'Choose a cup'),
    h('p.muted', { style: 'margin:0;text-align:center;font-size:13px' }, CUP_LINES_NOTE),
    h('div.tera-types', {}, ...CUP_TYPES.map((type) => {
      const n = cupLines(owned, type).length;
      return h('button.type', {
        style: `background:${TYPE_COLOURS[type]}`,
        disabled: n < CUP_MIN_LINES,
        title: `${n} ${typeName(type)} line${n === 1 ? '' : 's'}${cupMaps(type).length ? `: ${cupMaps(type).map((m) => m.name).join(', ')}` : ''}`,
        onclick: () => {
          close();
          begin('mono', type);
        },
      }, `${won.includes(type) ? '🏆 ' : ''}${type} ${n}`);
    })),
    button('btn.ghost', 'Cancel', () => close())));
}

function facilityCard(title: string, lines: (Node | string | null)[], actions: (HTMLElement | null)[]): HTMLElement {
  return h('div.card.facility', {},
    h('div', { style: 'font-weight:800;font-size:17px' }, title),
    ...lines.map((l) => (typeof l === 'string' ? h('div.muted', { style: 'font-size:13px;margin-top:4px' }, l) : l)),
    h('div.row', { style: 'margin-top:10px;gap:8px;flex-wrap:wrap' }, ...actions));
}

export function frontierScreen(): void {
  const p = getProgress();
  const f = p.frontier;
  const run = f.run;
  const runLine = (facility: FrontierRun['facility']): string | null => {
    if (run?.facility !== facility) return null;
    const total = facility === 'mono' ? CUP_BATTLES : ROUND;
    const at = facility === 'mono' ? run.streak : run.streak % ROUND;
    return `Under way${run.type ? ` (${typeName(run.type)} Cup)` : ''}: battle ${at + 1} of ${total}, streak ${run.streak}, ♥ ${run.lives}.`;
  };
  const actions = (facility: FrontierRun['facility'], start: () => void): HTMLElement[] => (run?.facility === facility
    ? [button('btn.primary.grow', '▶ Next battle', () => playNext(run)), button('btn.ghost', 'Forfeit', forfeit)]
    : [button('btn.primary.grow', run ? '🔒 Another run is under way' : 'Start', start, { disabled: Boolean(run) })]);

  const trophies = h('div.trophies', {}, ...CUP_TYPES.map((type) => h('span.type', {
    className: `type${f.monoTrophies.includes(type) ? ' won' : ''}`,
    style: `background:${TYPE_COLOURS[type]}`,
    title: typeName(type),
  }, f.monoTrophies.includes(type) ? `🏆 ${type}` : type)));

  const g = gauntletMap();
  const el = h('div.screen', {},
    topbar('Battle Frontier', worldScreen, bpChip(p)),
    h('div.scroll', {}, h('div.content', {},
      h('p.muted', { style: 'margin:4px 2px 10px;font-size:13px' }, 'Challenges on the regions’ own maps, under rules of their own. No second tries against a boss; lives carry over from battle to battle. Wins pay BP.'),
      facilityCard('🗼 Battle Tower', [
        'Seven battles on maps drawn at random, Hard from the fourth; the seventh is a Tower Tycoon — some region’s Champion ace. Keep going for longer streaks.',
        `Best streak: ${f.towerBest}`, runLine('tower'),
      ], actions('tower', () => begin('tower'))),
      facilityCard('🏭 Battle Factory', [
        `Choose ${FACTORY_TEAM} of 8 random rental Pokémon — any at all, already grown a little. After each win, you may swap one for a Pokémon you just beat.`,
        `Best streak: ${f.factoryBest}`, runLine('factory'),
      ], actions('factory', () => begin('factory'))),
      facilityCard('🏆 Mono-type Cup', [
        `Three set battles with a team of one type. Win all ${CUP_BATTLES} for its trophy.`,
        trophies, runLine('mono'),
      ], actions('mono', cupPicker)),
      facilityCard('👑 Champions’ Gauntlet', [
        g.twist,
        gauntletOpen(p) ? `Best: ${f.gauntletWon ? 'beaten! ' : ''}${f.gauntletBest} of ${g.waves} waves` : 'Become Champion of all nine mainline regions to enter.',
      ], [button('btn.primary.grow', gauntletOpen(p) ? 'Enter' : '🔒 Enter', () => {
        teamScreen(g, {
          back: frontierScreen, note: 'Every Champion, one after another. No second tries.',
          onStart: (team) => {
            setProgress({ ...getProgress(), team });
            startBattle(frontierBattle('gauntlet', g.id, 'normal', team, {}));
          },
        });
      }, { disabled: !gauntletOpen(p) })]),
    )),
  );
  mount(el);
  playMusic('p_league');
  sfx.click();
}
