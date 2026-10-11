/**
 * Drives the built game in a real browser: makes a captain, jumps, opens
 * every tab, docks, fights, lands and walks about, at phone, short-phone,
 * tablet and desktop sizes, and saves a screenshot of each. Fails on any
 * console error or horizontal overflow.
 *
 * Manual, not part of CI: it's here so a layout change can be *looked* at.
 *
 *   npm run build && npm run preview &
 *   npm run verify
 *
 * VERIFY_URL points it elsewhere; CHROMIUM_PATH uses a browser already on
 * the machine instead of Playwright's own.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Browser, type Page } from 'playwright';
import { runBot } from '../src/game/bot';
import { startCombat } from '../src/game/combat';
import { newGame } from '../src/game/engine';
import { serialize, STORAGE_KEY } from '../src/state/persistence';
import type { GameState } from '../src/state/types';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'short', width: 360, height: 640 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'wide', width: 1440, height: 900 },
];

function botSave(days: number, seed = 11): GameState {
  const s = newGame(seed);
  runBot(s, days);
  // Settle it on the map, whatever the bot was in the middle of.
  s.report = null;
  s.event = null;
  s.combat = null;
  s.away = null;
  s.screen = 'map';
  s.savedAt = Date.now();
  return s;
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/**
 * Each load is a fresh browser context whose init script writes the save
 * (or clears it) before the game boots. The game saves when a page hides, so
 * writing into a running page and reloading would be overwritten.
 */
async function open(browser: Browser, vp: { name?: string; width: number; height: number }, s: GameState | null, errors: string[]): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: vp.width < 800 });
  await ctx.addInitScript(
    ([key, text]) => {
      if (sessionStorage.getItem('vw-seeded')) return;
      sessionStorage.setItem('vw-seeded', '1');
      if (text) localStorage.setItem(key!, text);
      else localStorage.removeItem(key!);
    },
    [STORAGE_KEY, s ? serialize(s) : ''],
  );
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name ?? ''}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${vp.name ?? ''}: ${e.message}`));
  await page.goto(URL);
  await page.waitForSelector('.app');
  return page;
}

async function swap(old: Page, browser: Browser, vp: { name: string; width: number; height: number }, s: GameState | null, errors: string[]): Promise<Page> {
  await old.context().close();
  return open(browser, vp, s, errors);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const errors: string[] = [];
  const mid = botSave(40);
  for (const vp of VIEWPORTS) {
    // A new captain.
    let page = await open(browser, vp, null, errors);
    await shoot(page, `${vp.name}-01-create`);
    await page.fill('[data-input="name"]', 'Vega');
    await page.click('[data-act="origin"][data-arg="navy"]');
    await page.click('[data-act="start"]');
    await shoot(page, `${vp.name}-02-map`);

    // First jump: tap a linked star in the card, or click the canvas.
    const jumpTo = await page.evaluate(() => {
      const s = (window as unknown as { __voidwake: GameState }).__voidwake;
      return s.sector.nodes[s.at]!.links[0]!;
    });
    await page.evaluate((id) => {
      const btn = document.createElement('button');
      btn.dataset['act'] = 'jump';
      btn.dataset['arg'] = String(id);
      document.querySelector('.main')!.appendChild(btn);
      btn.click();
    }, jumpTo);
    await shoot(page, `${vp.name}-03-after-jump`);
    if (await page.locator('.modal [data-act="choose"]').first().isVisible().catch(() => false)) {
      await page.locator('.modal [data-act="choose"]:not([disabled])').first().click();
      await shoot(page, `${vp.name}-04-event-result`);
      await page.locator('.modal [data-act="close-event"]').click();
    }
    while (await page.locator('.modal [data-act="close-report"]').isVisible().catch(() => false)) await page.click('.modal [data-act="close-report"]');

    // Mid-campaign: every tab.
    page = await swap(page, browser, vp, mid, errors);
    for (const tab of ['map', 'ship', 'crew', 'cargo', 'log']) {
      await page.click(`.tabs [data-arg="${tab}"]`);
      if (tab === 'crew') await page.locator('[data-act="crew-sel"]').first().click();
      if (tab === 'cargo') await page.click('[data-act="cargo-tab"][data-arg="fab"]');
      await shoot(page, `${vp.name}-1${['map', 'ship', 'crew', 'cargo', 'log'].indexOf(tab)}-${tab}`);
      const o = await overflow(page);
      if (o > 1) errors.push(`${vp.name}: ${tab} tab overflows by ${o}px`);
    }

    // Docked at a station.
    const docked = structuredClone(mid);
    const st = docked.sector.nodes.find((n) => n.kind === 'station')!;
    docked.at = st.id;
    docked.screen = 'map';
    page = await swap(page, browser, vp, docked, errors);
    await shoot(page, `${vp.name}-20-station`);
    await page.click('[data-act="st-tab"][data-arg="supplies"]');
    await shoot(page, `${vp.name}-21-station-supplies`);

    // A fight.
    const fight = structuredClone(mid);
    startCombat(fight, 'raider');
    page = await swap(page, browser, vp, fight, errors);
    await shoot(page, `${vp.name}-30-combat`);
    for (let i = 0; i < 3; i++) {
      const fire = page.locator('[data-act="cact"][data-arg="fire"]');
      if (!(await fire.isVisible().catch(() => false))) break;
      await fire.click();
      await page.waitForTimeout(1200);
    }
    await shoot(page, `${vp.name}-31-combat-turns`);

    // A landing.
    const land = structuredClone(mid);
    const sys = land.sector.nodes.find((n) => n.kind === 'system' && n.planets.length)!;
    land.at = sys.id;
    sys.planets[0]!.landings = 0;
    land.screen = 'map';
    land.res.energy = 30;
    page = await swap(page, browser, vp, land, errors);
    await page.locator('[data-act="land"]').first().click();
    await shoot(page, `${vp.name}-40-explorer`);
    await page.locator('[data-act="land-go"]:not([disabled])').first().click();
    await page.waitForTimeout(600);
    await shoot(page, `${vp.name}-41-away`);
    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    await page.keyboard.down('a');
    await page.waitForTimeout(600);
    await page.keyboard.up('a');
    await shoot(page, `${vp.name}-42-away-moved`);
    const moved = await page.evaluate(() => {
      const a = (window as unknown as { __voidwake: GameState }).__voidwake.away;
      return a ? Math.hypot(a.x - a.lander.x, a.y - a.lander.y) : -1;
    });
    if (moved < 1) errors.push(`${vp.name}: the explorer didn't move (${moved})`);
    await page.context().close();
  }

  // Sound: the score schedules notes once the page has been tapped.
  const page = await open(browser, { width: 390, height: 844 }, mid, errors);
  await page.click('.tabs [data-arg="ship"]');
  await page.waitForTimeout(2500);
  const notes = await page.evaluate(() => (window as unknown as { __music?: { scheduled: number } }).__music?.scheduled ?? 0);
  if (notes < 1) errors.push('music: nothing scheduled after a tap');
  else console.log(`Music: ${notes} notes scheduled.`);
  await browser.close();

  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.log(`Screenshots in ${OUT}/. No console errors, no overflow.`);
}

void main();
