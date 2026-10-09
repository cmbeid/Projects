import { LINE, LINES, tierFor } from '../data/buildings';
import { EVENT } from '../data/chronicle';
import { ERAS, LAST_ERA, goalText } from '../data/eras';
import { HERITAGE, TRAIT } from '../data/heritage';
import { JOB, JOBS, RESOURCE } from '../data/resources';
import { TECH, TECHS } from '../data/techs';
import type { Outcome, ResId } from '../data/types';
import { WONDERS } from '../data/wonders';
import {
  buildBlock,
  buildCost,
  canAfford,
  countLine,
  currentTier,
  available,
  idle,
  modernizeCost,
  outdatedCount,
} from '../game/city';
import { canChoose, payAmounts, rateFor } from '../game/chronicle';
import { canBuyNode, heritageFor, shipReady } from '../game/colony';
import type { Derived } from '../game/derive';
import { hasFeature } from '../game/features';
import {
  canAdvance,
  eraTechsKnown,
  festivalCost,
  festivalLength,
  goalMet,
  techAvailable,
  techCost,
  wonderComplete,
  wonderOpen,
  wonderStageCost,
  wonderState,
  yearOf,
  yearText,
} from '../game/progress';
import { fmt, fmtInt, fmtTime } from '../num/format';
import { iconHtml } from '../sprites/atlas';
import { buildingSprite } from '../sprites/defs';
import type { GameState } from '../state/types';
import { esc } from './dom';
import { costHtml, effectsText, rate, resIcon, tierText } from './text';

export type Tab = 'city' | 'jobs' | 'research' | 'wonders' | 'chronicle' | 'heritage' | 'settings';

export interface UiState {
  tab: Tab;
  /** Plot picked on the skyline, or -1. */
  pick: number;
  step: 1 | 10;
  /** Show techs of earlier eras. */
  pastTechs: boolean;
  importOpen: boolean;
  confirmReset: boolean;
}

export const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: 'city', label: 'City', icon: 'icon-land' },
  { id: 'jobs', label: 'Jobs', icon: 'icon-people' },
  { id: 'research', label: 'Research', icon: 'res-knowledge' },
  { id: 'wonders', label: 'Wonders', icon: 'icon-stability' },
  { id: 'chronicle', label: 'Chronicle', icon: 'icon-clock' },
  { id: 'heritage', label: 'Heritage', icon: 'icon-heritage' },
  { id: 'settings', label: 'Settings', icon: 'icon-clock' },
];

export function tabVisible(s: GameState, t: Tab): boolean {
  switch (t) {
    case 'wonders':
      return hasFeature(s, 'wonders');
    case 'chronicle':
      return hasFeature(s, 'chronicle');
    case 'heritage':
      return hasFeature(s, 'heritage') || s.stats.launches > 0 || s.era >= LAST_ERA;
    default:
      return true;
  }
}

/** Little badges on the tabs: something there wants you. */
export function tabBadge(s: GameState, d: Derived, t: Tab): boolean {
  switch (t) {
    case 'city':
      return canAdvance(s, d);
    case 'jobs':
      return d.idle > 0;
    case 'research':
      return TECHS.some((x) => techAvailable(s, x) && canAfford(s, techCost(s, x, d)));
    case 'wonders':
      return WONDERS.some((w) => wonderOpen(s, w) && !wonderComplete(s, w) && wonderState(s, w.id).left <= 0 && canAfford(s, wonderStageCost(s, w, d) ?? {}));
    case 'chronicle':
      return s.chronicle.pending !== null;
    case 'heritage':
      return s.offers !== null || HERITAGE.some((h) => canBuyNode(s, h.id));
    default:
      return false;
  }
}

// --- Header -------------------------------------------------------------------------

/** The age and the year, top left. */
export function renderEra(s: GameState): string {
  const era = ERAS[s.era]!;
  return `${iconHtml(`era-${s.era}`, 2)}<div><b>${esc(era.name)}</b><small>${yearText(yearOf(s))}${s.world.number > 0 ? ` · ${esc(s.world.name)}` : ''}</small></div>`;
}

/** People, stability, land and power, top right. */
export function renderStats(s: GameState, d: Derived): string {
  const stab = Math.round(d.stability);
  return `
    <div class="stat" title="Citizens / housing">${iconHtml('icon-people', 2)}<span>${fmtInt(s.pop)}<small>/${fmtInt(d.housing)}</small></span></div>
    <div class="stat${stab < 50 ? ' bad' : stab >= 120 ? ' good' : ''}" title="Stability">${iconHtml('icon-stability', 2)}<span>${stab}%</span></div>
    <div class="stat" title="Land used / land">${iconHtml('icon-land', 2)}<span>${d.plotsUsed}<small>/${d.plotsTotal}</small></span></div>
    ${d.power.demand > 0 || d.power.supply > 0 ? `<div class="stat${d.power.ratio < 1 ? ' bad' : ''}" title="Power supply / demand">${iconHtml('icon-power', 2)}<span>${fmt(d.power.supply)}<small>/${fmt(d.power.demand)}</small></span></div>` : ''}`;
}

export function renderResources(s: GameState, d: Derived): string {
  const shown = RESOURCE_ORDER.filter((r) => RESOURCE.get(r)!.era <= s.era || s.res[r] > 0);
  return shown
    .map((r) => {
      const def = RESOURCE.get(r)!;
      const cap = d.caps[r];
      const full = def.capped && s.res[r] >= cap * 0.999;
      const fill = def.capped ? Math.min(100, (s.res[r] / cap) * 100) : 0;
      const net = d.net[r];
      return `<div class="rchip${full ? ' full' : ''}" data-key="${r}" title="${esc(def.name)}${def.capped ? ` (holds ${fmt(cap)})` : ''}">
        ${resIcon(r)}<span class="n">${fmt(s.res[r])}</span><span class="r${net < -0.004 ? ' neg' : ''}">${rate(net)}</span>
        ${def.capped ? `<i style="width:${fill.toFixed(1)}%"></i>` : ''}
      </div>`;
    })
    .join('');
}

const RESOURCE_ORDER: readonly ResId[] = ['food', 'wood', 'stone', 'metal', 'coal', 'steel', 'oil', 'alloy', 'knowledge', 'data', 'culture', 'gold'];

// --- The Chronicle card --------------------------------------------------------------

function outcomeText(s: GameState, d: Derived, o: Outcome): string {
  const name = (r: ResId): string => RESOURCE.get(r)!.name.toLowerCase();
  switch (o.k) {
    case 'gain':
      return `+${fmt(rateFor(s, d, o.r) * o.secs)} ${name(o.r)}`;
    case 'insight':
      return `+${fmt(rateFor(s, d, 'knowledge') * o.secs)} knowledge`;
    case 'lose':
      return `lose ${Math.round(o.pct * 100)}% of the ${name(o.r)}`;
    case 'pop':
      return `${o.pct > 0 ? '+' : '−'}${Math.round(Math.abs(o.pct) * 100)}% people`;
    case 'mod': {
      const sign = o.x >= 0 ? '+' : '−';
      const what =
        o.target === 'stability'
          ? `${sign}${Math.abs(o.x)} stability`
          : `${o.target === 'all' ? 'every job' : o.target === 'growth' ? 'births' : JOB.get(o.target)!.plural} ${sign}${Math.round(Math.abs(o.x) * 100)}%`;
      return `${what} for ${fmtTime(o.secs)}`;
    }
  }
}

export function renderEventCard(s: GameState, d: Derived): string {
  const p = s.chronicle.pending;
  if (!p) return '';
  const e = EVENT.get(p.id);
  if (!e) return '';
  const choices = e.choices
    .map((c, i) => {
      const ok = canChoose(s, c, d);
      const pay = payAmounts(s, c, d);
      const price = pay.length ? `<span class="price">${pay.map((x) => `<span class="cost${s.res[x.r] < x.n ? ' short' : ''}">${resIcon(x.r, 1)}${fmt(x.n)}</span>`).join('')}</span>` : '';
      const fx = c.outcomes.map((o) => outcomeText(s, d, o)).join(', ') || 'nothing more';
      return `<button class="choice${e.fallback === i ? ' default' : ''}" data-act="answer" data-arg="${i}"${ok ? '' : ' disabled'}>${esc(c.label)}${price}<small>${esc(fx)}</small></button>`;
    })
    .join('');
  return `<div class="event" role="dialog" aria-label="${esc(e.title)}">
    <div class="ehead">${iconHtml('icon-clock', 2)}<b>${esc(e.title)}</b><span class="timer"><i style="width:${((p.left / 90) * 100).toFixed(1)}%"></i></span></div>
    <p>${esc(e.text)}</p>
    <div class="choices">${choices}</div>
  </div>`;
}

// --- City ---------------------------------------------------------------------------

function ageCard(s: GameState, d: Derived): string {
  const era = ERAS[s.era]!;
  const goals = era.goals
    .map((g) => {
      const ok = goalMet(s, g, d);
      let progress = '';
      if (g.k === 'pop') progress = ` <small>${fmtInt(s.pop)}/${g.n}</small>`;
      if (g.k === 'techs') progress = ` <small>${eraTechsKnown(s, s.era)}/${g.n}</small>`;
      if (g.k === 'line') progress = ` <small>${s.plots.filter((p) => p?.line === g.line && p.era === s.era).length}/${g.n}</small>`;
      if (g.k === 'stability') progress = ` <small>${Math.round(d.stability)}/${g.n}</small>`;
      if (g.k === 'res') progress = ` <small>${fmt(s.res[g.r])}/${fmt(g.n)}</small>`;
      if (g.k === 'wonder') {
        const w = WONDERS.find((x) => x.id === g.id)!;
        progress = ` <small>${wonderState(s, g.id).done}/${w.stages.length}</small>`;
      }
      return `<li class="${ok ? 'done' : ''}">${ok ? '✔' : '○'} ${esc(goalText(g, s.era))}${progress}</li>`;
    })
    .join('');
  const next = ERAS[s.era + 1];
  const festival = hasFeature(s, 'festival')
    ? `<button class="festival" data-act="festival"${s.festival > 0 || s.res.culture < festivalCost(s) ? ' disabled' : ''}>${
        s.festival > 0 ? `Festival! ${fmtTime(s.festival)}` : `Hold a festival <span class="cost${s.res.culture < festivalCost(s) ? ' short' : ''}">${resIcon('culture', 1)}${fmt(festivalCost(s))}</span>`
      }<small>${s.festival > 0 ? '+50% to every job' : `+50% to every job for ${fmtTime(festivalLength(d))}`}</small></button>`
    : '';
  return `<section class="card age">
    <h3>${next ? `Toward the ${esc(next.name)}` : 'The last age'}</h3>
    <p class="blurb">${esc(era.blurb)}</p>
    <ul class="goals">${goals}</ul>
    ${next ? `<button class="primary" data-act="advance"${canAdvance(s, d) ? '' : ' disabled'}>Enter the ${esc(next.name)} ${costHtml(s, era.advanceCost)}</button>` : shipReady(s) ? '<button class="primary" data-act="tab" data-arg="heritage">The ship is ready — choose a world</button>' : '<p class="hint">Build the Colony Ship in Wonders to leave for a new world.</p>'}
    ${festival}
  </section>`;
}

function pickCard(s: GameState, d: Derived, ui: UiState): string {
  const p = s.plots[ui.pick];
  if (ui.pick < 0) return '';
  if (!p) return `<section class="card pick"><h3>Open ground</h3><p class="hint">Build something below and it goes up on a free plot.</p><button data-act="unpick">Close</button></section>`;
  const line = LINE.get(p.line)!;
  const t = line.tiers.find((x) => x.era === p.era)!;
  const cur = currentTier(s, p.line);
  const outdated = cur && cur.era > p.era;
  const mcost = outdated ? modernizeCost(s, p.line, d) : null;
  return `<section class="card pick">
    <div class="row">${iconHtml(buildingSprite(p.line, p.era), 2, 'bicon')}<div><h3>${esc(t.name)}</h3><small>${esc(ERAS[p.era]!.name)} · ${esc(line.name)}</small></div></div>
    <p class="blurb">${esc(t.blurb)}</p>
    <p class="what">${esc(tierText(t, line.job))}</p>
    <div class="btns">
      ${outdated ? `<button class="primary" data-act="modernize-plot" data-arg="${ui.pick}"${mcost && canAfford(s, mcost) ? '' : ' disabled'}>Rebuild as ${esc(cur!.name)} ${costHtml(s, mcost)}</button>` : ''}
      <button class="danger" data-act="demolish-plot" data-arg="${ui.pick}">Pull down</button>
      <button data-act="unpick">Close</button>
    </div>
  </section>`;
}

export function renderCity(s: GameState, d: Derived, ui: UiState): string {
  const rows = LINES.map((line) => {
    const t = tierFor(line, s.era);
    if (!t) return '';
    const cur = currentTier(s, line.id);
    const n = countLine(s, line.id);
    const old = outdatedCount(s, line.id);
    const cost = buildCost(s, line.id, d);
    const block = buildBlock(s, line.id, d);
    const mcost = old > 0 ? modernizeCost(s, line.id, d) : null;
    const job = line.job ? JOB.get(line.job)! : null;
    const info = job ? d.jobs[job.id] : null;
    const tech = !cur && t.tech ? TECH.get(t.tech) : undefined;
    return `<div class="line" data-key="${line.id}">
      ${iconHtml(buildingSprite(line.id, t.era), 2, 'bicon')}
      <div class="body">
        <div class="title"><b>${esc(t.name)}</b><span class="count">×${n}${old ? ` <em>${old} old</em>` : ''}</span></div>
        <small>${esc(tierText(t, line.job))}${info && info.slots > 0 ? ` · ${info.workers}/${info.slots} working` : ''}</small>
        ${tech ? `<small class="lock">Needs ${esc(tech.name)}</small>` : `<div class="costs">${costHtml(s, cost)}</div>`}
      </div>
      <div class="acts">
        <button class="build" data-act="build" data-arg="${line.id}"${block === null ? '' : ' disabled'} title="${block === 'land' ? 'No free land' : ''}">${block === 'land' ? 'No land' : 'Build'}</button>
        ${old ? `<button data-act="modernize" data-arg="${line.id}"${mcost && canAfford(s, mcost) ? '' : ' disabled'} title="Rebuild the oldest in the style of the age">Modernize ${costHtml(s, mcost)}</button>` : ''}
        ${old > 1 && hasFeature(s, 'modernizeAll') ? `<button data-act="modernize-all" data-arg="${line.id}"${mcost && canAfford(s, mcost) ? '' : ' disabled'}>All</button>` : ''}
      </div>
    </div>`;
  }).join('');
  const land = d.plotsTotal - d.plotsUsed;
  return `${pickCard(s, d, ui)}${ageCard(s, d)}
    <section class="card">
      <h3>Build <small>${land} free land · tap a building on the skyline to rebuild or pull it down</small></h3>
      <div class="lines">${rows}</div>
    </section>`;
}

// --- Jobs ---------------------------------------------------------------------------

export function renderJobs(s: GameState, d: Derived, ui: UiState): string {
  const free = idle(s);
  const auto = hasFeature(s, 'autoAssign');
  const rows = JOBS.filter((j) => j.era <= s.era)
    .map((j) => {
      const info = d.jobs[j.id];
      const makes = Object.entries(info.makes).filter(([, v]) => (v ?? 0) > 0);
      const uses = Object.entries(info.uses).filter(([, v]) => (v ?? 0) > 0);
      const slots = info.slots === Infinity ? '∞' : fmtInt(info.slots);
      const pri = s.settings.priority.includes(j.id);
      const short = info.supply < 0.999 ? `<em class="bad">${Math.round(info.supply * 100)}% supplied${j.power ? ' (power)' : ''}</em>` : '';
      return `<div class="job" data-key="${j.id}">
        <div class="body">
          <div class="title"><b>${esc(j.plural)}</b><span class="count">${fmtInt(info.workers)}<small>/${slots}</small></span></div>
          <small>${makes.map(([r, v]) => `${resIcon(r as ResId, 1)}${rate(v ?? 0)}`).join(' ')}${uses.length ? ` · uses ${uses.map(([r, v]) => `${resIcon(r as ResId, 1)}${fmt(v ?? 0)}/s`).join(' ')}` : ''} ${short}</small>
        </div>
        <div class="acts">
          ${auto && j.id !== 'forager' ? `<button class="pin${pri ? ' on' : ''}" data-act="priority" data-arg="${j.id}" title="Fill this job first">★</button>` : ''}
          <button data-act="unassign" data-arg="${j.id}"${info.workers > 0 ? '' : ' disabled'}>−${ui.step}</button>
          <button class="primary" data-act="assign" data-arg="${j.id}"${available(s, j.id) > 0 && info.workers < info.slots ? '' : ' disabled'}>+${ui.step}</button>
        </div>
      </div>`;
    })
    .join('');
  const parts = d.stabilityParts
    .filter((p) => Math.abs(p.n) >= 0.5)
    .map((p) => `<li><span>${esc(p.label)}</span><b class="${p.n < 0 ? 'bad' : ''}">${p.n >= 0 ? '+' : '−'}${Math.round(Math.abs(p.n))}</b></li>`)
    .join('');
  const mods = s.modifiers.map((m) => `<li><span>${esc(m.label)}</span><b>${fmtTime(m.left)}</b></li>`).join('');
  return `<section class="card">
      <h3>People <small>${fmtInt(s.pop)} citizens${free ? `, ${free} idle` : ''} · eat ${fmt(d.eat)} food/s</small></h3>
      <div class="jobbar">
        <div class="seg"><button class="${ui.step === 1 ? 'on' : ''}" data-act="step" data-arg="1">×1</button><button class="${ui.step === 10 ? 'on' : ''}" data-act="step" data-arg="10">×10</button></div>
        ${auto ? `<label class="toggle"><input type="checkbox" data-act="auto"${s.settings.autoAssign ? ' checked' : ''}> Auto-assign idle people</label>` : '<small class="hint">Foragers are free hands: +1 on a job takes one of them. The Census (Bronze Age) lets new citizens find work themselves.</small>'}
      </div>
      <div class="jobs">${rows}</div>
    </section>
    <section class="card">
      <h3>Stability <small>${Math.round(d.stability)}% · output ×${d.stabilityMult.toFixed(2)}</small></h3>
      <ul class="parts">${parts}</ul>
      ${mods ? `<h4>For now</h4><ul class="parts">${mods}</ul>` : ''}
    </section>`;
}

// --- Research -----------------------------------------------------------------------

export function renderResearch(s: GameState, d: Derived, ui: UiState): string {
  const queue = hasFeature(s, 'queue');
  const eras = [...new Set(TECHS.map((t) => t.era))].filter((e) => e <= s.era && (ui.pastTechs || e === s.era || eraTechsKnown(s, e) < 10)).reverse();
  const sections = eras
    .map((era) => {
      const cards = TECHS.filter((t) => t.era === era)
        .map((t) => {
          const known = s.techs.includes(t.id);
          const open = techAvailable(s, t);
          const cost = techCost(s, t, d);
          const missing = t.requires.filter((r) => !s.techs.includes(r)).map((r) => TECH.get(r)!.name);
          const qi = s.queue.indexOf(t.id);
          return `<div class="tech${known ? ' known' : open ? ' open' : ' locked'}" data-key="${t.id}">
            <div class="title"><b>${esc(t.name)}</b>${known ? '<span class="ok">✔</span>' : ''}</div>
            <small class="fx">${esc(effectsText(t.effects))}</small>
            <small class="blurb">${esc(t.blurb)}</small>
            ${known ? '' : missing.length ? `<small class="lock">After ${esc(missing.join(', '))}</small>` : ''}
            ${
              known
                ? ''
                : `<div class="acts"><button class="primary" data-act="research" data-arg="${t.id}"${open && canAfford(s, cost) ? '' : ' disabled'}>Research ${costHtml(s, cost)}</button>${
                    queue ? `<button class="${qi >= 0 ? 'on' : ''}" data-act="queue" data-arg="${t.id}">${qi >= 0 ? `Queued ${qi + 1}` : 'Queue'}</button>` : ''
                  }</div>`
            }
          </div>`;
        })
        .join('');
      return `<section class="card"><h3>${iconHtml(`era-${era}`, 1)} ${esc(ERAS[era]!.name)} <small>${eraTechsKnown(s, era)}/10</small></h3><div class="techs">${cards}</div></section>`;
    })
    .join('');
  const hidden = s.era > 0 && !ui.pastTechs;
  return `${sections}${s.era > 0 ? `<button class="ghost" data-act="past-techs">${hidden ? 'Show every era' : 'Hide finished eras'}</button>` : ''}`;
}

// --- Wonders ------------------------------------------------------------------------

export function renderWonders(s: GameState, d: Derived): string {
  const cards = WONDERS.filter((w) => w.era <= s.era + 1)
    .map((w) => {
      const st = wonderState(s, w.id);
      const done = wonderComplete(s, w);
      const open = wonderOpen(s, w);
      const cost = wonderStageCost(s, w, d);
      const building = st.left > 0;
      const tech = w.tech && !s.techs.includes(w.tech) ? TECH.get(w.tech) : undefined;
      const pct = building ? (1 - st.left / w.stageTime) * 100 : 0;
      let action = '';
      if (done) action = `<p class="fx">${esc(effectsText(w.effects)) || 'Ready to launch.'}</p>`;
      else if (w.era > s.era) action = `<small class="lock">${esc(ERAS[w.era]!.name)}</small>`;
      else if (tech) action = `<small class="lock">Needs ${esc(tech.name)}</small>`;
      else if (building) action = `<div class="progress"><i style="width:${pct.toFixed(1)}%"></i><span>Stage ${st.done + 1}: ${fmtTime(st.left / (1 + d.bonuses.wonderSpeed))}</span></div>`;
      else if (open) action = `<button class="primary" data-act="stage" data-arg="${w.id}"${cost && canAfford(s, cost) ? '' : ' disabled'}>Build stage ${st.done + 1} of ${w.stages.length} ${costHtml(s, cost)}</button>`;
      return `<div class="wonder${done ? ' done' : ''}${w.required ? ' required' : ''}" data-key="${w.id}">
        <div class="pic">${iconHtml(`wonder-${w.id}`, w.w <= 48 && w.h <= 48 ? 2 : 1)}</div>
        <div class="body">
          <div class="title"><b>${esc(w.name)}</b>${w.required ? '<span class="tag">Age goal</span>' : ''}<span class="count">${st.done}/${w.stages.length}</span></div>
          <small class="blurb">${esc(w.blurb)}</small>
          ${done ? '' : `<small class="fx">${esc(effectsText(w.effects))}</small>`}
          ${action}
        </div>
      </div>`;
    })
    .join('');
  return `<section class="card"><h3>Wonders <small>stand for good on the far bank</small></h3><div class="wonders">${cards}</div></section>`;
}

// --- Chronicle ----------------------------------------------------------------------

export function renderChronicle(s: GameState): string {
  const entries: string[] = [];
  let era = -1;
  for (const e of [...s.chronicle.log].reverse()) {
    if (e.era !== era) {
      era = e.era;
      entries.push(`<li class="eh">${iconHtml(`era-${e.era}`, 1)} ${esc(ERAS[e.era]!.name)}</li>`);
    }
    entries.push(`<li><span class="yr">${yearText(e.year)}</span> The city ${esc(e.text)}.</li>`);
  }
  return `<section class="card chronicle">
    <h3>The Chronicle of ${esc(s.world.number === 0 ? 'the City' : s.world.name)} <small>${s.stats.events} decisions so far</small></h3>
    ${s.chronicle.pending ? '<p class="hint">Something is waiting for a decision — see the card above.</p>' : `<p class="hint">Next event in about ${fmtTime(Math.max(0, s.chronicle.next))}.</p>`}
    <ul class="log">${entries.join('')}</ul>
  </section>`;
}

// --- Heritage -----------------------------------------------------------------------

export function renderHeritage(s: GameState): string {
  const traits = s.world.traits.map((t) => TRAIT.get(t)!).map((t) => `<li><b>${esc(t.name)}</b> ${esc(t.blurb)}</li>`).join('');
  const offers = s.offers
    ? `<section class="card launch">
        <h3>The Colony Ship is ready</h3>
        <p>Choose a world. Everything here stays behind except Heritage: <b>${heritageFor(s)}</b> to carry.</p>
        <div class="worlds">${s.offers
          .map(
            (w, i) => `<div class="world" data-key="${esc(w.name)}">
              <b>${esc(w.name)}</b>
              <ul>${w.traits.map((t) => `<li><b>${esc(TRAIT.get(t)!.name)}</b> ${esc(TRAIT.get(t)!.blurb)}</li>`).join('')}</ul>
              <button class="primary" data-act="launch" data-arg="${i}">Launch</button>
            </div>`,
          )
          .join('')}</div>
      </section>`
    : s.era >= LAST_ERA
      ? `<section class="card"><h3>Leaving</h3><p>Finish the Colony Ship and the colonists will carry about <b>${heritageFor(s)}</b> Heritage to a new world.</p></section>`
      : '';
  const nodes = HERITAGE.map((h) => {
    const owned = s.heritage.nodes.includes(h.id);
    const ok = canBuyNode(s, h.id);
    const missing = h.requires.filter((r) => !s.heritage.nodes.includes(r));
    return `<div class="node${owned ? ' owned' : ok ? ' open' : ''}" data-key="${h.id}">
      <div class="title"><b>${esc(h.name)}</b>${owned ? '<span class="ok">✔</span>' : `<span class="cost">${iconHtml('icon-heritage', 1)}${h.cost}</span>`}</div>
      <small>${esc(h.blurb)}</small>
      ${owned ? '' : missing.length ? `<small class="lock">After ${esc(missing.map((m) => HERITAGE.find((x) => x.id === m)!.name).join(', '))}</small>` : `<button class="primary" data-act="node" data-arg="${h.id}"${ok ? '' : ' disabled'}>Adopt</button>`}
    </div>`;
  }).join('');
  return `${offers}
    <section class="card">
      <h3>${esc(s.world.number === 0 ? 'Home' : s.world.name)} <small>world ${s.world.number + 1}</small></h3>
      ${traits ? `<ul class="traits">${traits}</ul>` : '<p class="hint">The home world: no traits, for better or worse.</p>'}
    </section>
    <section class="card">
      <h3>Heritage ${iconHtml('icon-heritage', 2)} ${s.heritage.points} <small>${s.heritage.earned} earned over ${s.stats.launches} launches</small></h3>
      <p class="hint">What the colonists remember. Adopted traditions last for every world after.</p>
      <div class="nodes">${nodes}</div>
    </section>`;
}

// --- Settings -----------------------------------------------------------------------

function fullscreenOk(): boolean {
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export function renderSettings(s: GameState, ui: UiState): string {
  return `<section class="card settings">
    <h3>Settings</h3>
    <label>Music <input type="range" min="0" max="100" value="${s.settings.music}" data-act="vol-music"></label>
    <label>Effects <input type="range" min="0" max="100" value="${s.settings.sfx}" data-act="vol-sfx"></label>
    <label class="toggle"><input type="checkbox" data-act="mute"${s.settings.muted ? ' checked' : ''}> Mute everything</label>
    ${fullscreenOk() ? '<button data-act="fullscreen">Full screen (F)</button>' : ''}
    <h4>Save</h4>
    <p class="hint">The game saves itself in this browser every few seconds. To move it to another device, copy the code.</p>
    <div class="btns"><button data-act="export">Copy save code</button><button data-act="import-open">Paste a save code</button></div>
    ${ui.importOpen ? '<textarea id="import-code" rows="3" placeholder="Paste a save code here"></textarea><div class="btns"><button class="primary" data-act="import">Load it</button></div>' : ''}
    <h4>Since the first fire</h4>
    <ul class="parts">
      <li><span>Time played</span><b>${fmtTime(s.stats.totalTime)}</b></li>
      <li><span>Buildings raised</span><b>${fmtInt(s.stats.built)}</b></li>
      <li><span>Buildings modernized</span><b>${fmtInt(s.stats.modernized)}</b></li>
      <li><span>Decisions made</span><b>${fmtInt(s.stats.events)}</b></li>
      <li><span>Most citizens at once</span><b>${fmtInt(s.stats.peakPop)}</b></li>
      <li><span>Colony ships launched</span><b>${s.stats.launches}</b></li>
    </ul>
    <h4>Start over</h4>
    ${ui.confirmReset ? '<p class="bad">This erases everything, Heritage included.</p><div class="btns"><button class="danger" data-act="reset">Erase it all</button><button data-act="reset-cancel">Keep playing</button></div>' : '<button class="danger" data-act="reset-ask">Erase this save…</button>'}
  </section>`;
}
