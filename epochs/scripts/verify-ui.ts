/**
 * Drives the built game in a real browser: screenshots every tab at phone,
 * tablet and desktop sizes, plays the main verbs the way a player would
 * (build, assign, research, answer the Chronicle, pick a building on the
 * skyline and rebuild it) and checks the sound is running.
 *
 * Manual, not part of CI: it is here so a layout change can be *looked* at.
 *
 *   npm run build && npm run preview &
 *   npm run verify
 *
 * VERIFY_URL points it elsewhere; CHROMIUM_PATH uses a browser already on the
 * machine instead of Playwright's own.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { runBot } from '../src/game/bot';
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

function botSave(minutes: number, seed = 11): GameState {
  const s = newGame(seed);
  runBot(s, minutes * 60);
  s.savedAt = Date.now();
  return s;
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function dismiss(page: Page): Promise<void> {
  const close = page.locator('.modal [data-act="close-modal"]').first();
  if (await close.isVisible().catch(() => false)) await close.click();
}

type Win = { __epochs: GameState; __music?: { scheduled: number; m: { ctx: AudioContext } } };

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const errors: string[] = [];
  const mid = botSave(100);
  // A question waiting, and stores full enough to do anything.
  mid.chronicle.pending = { id: 'comet', left: 80 };
  for (const k of Object.keys(mid.res) as (keyof GameState['res'])[]) mid.res[k] = Math.max(mid.res[k], 1e5);
  const deep = botSave(60 * 5);
  const saves: Record<string, GameState | null> = { fresh: null, mid, deep };

  for (const vp of VIEWPORTS) {
    for (const [label, save] of Object.entries(saves)) {
      if (label !== 'mid' && (vp.name === 'tablet' || vp.name === 'short')) continue;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: vp.name === 'phone' });
      if (save) await ctx.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, serialize(save)]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${vp.name}/${label}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name}/${label}: ${m.text()}`));
      await page.goto(URL);
      await page.waitForSelector('#scene');
      await dismiss(page);
      await shoot(page, `${vp.name}-${label}-city`);

      if (label === 'fresh') {
        // The first things anyone does: build a farm, put someone on it, research.
        const before = await page.evaluate(() => (window as unknown as Win).__epochs.plots.filter(Boolean).length);
        await page.locator('[data-act="build"][data-arg="farm"]').click();
        await page.waitForTimeout(200);
        const after = await page.evaluate(() => (window as unknown as Win).__epochs.plots.filter(Boolean).length);
        if (after !== before + 1) errors.push(`${vp.name} build: expected ${before + 1} buildings, got ${after}`);
        await page.locator('#tabs [data-arg="jobs"]').click();
        await page.locator('[data-act="assign"][data-arg="farmer"]').click();
        const farmers = await page.evaluate(() => (window as unknown as Win).__epochs.jobs.farmer);
        if (farmers !== 1) errors.push(`${vp.name} assign: expected 1 farmer, got ${farmers}`);
        await shoot(page, `${vp.name}-fresh-jobs`);
        await page.locator('#tabs [data-arg="research"]').click();
        await shoot(page, `${vp.name}-fresh-research`);
      } else {
        const tabs = await page.locator('#tabs .tab').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['arg']!));
        for (const t of tabs) {
          await page.locator(`#tabs [data-arg="${t}"]`).click();
          await shoot(page, `${vp.name}-${label}-${t}`);
        }
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (scroll) errors.push(`${vp.name}/${label}: page scrolls horizontally`);
      }

      if (label === 'mid' && (vp.name === 'phone' || vp.name === 'wide')) {
        // Answer the Chronicle.
        const events = await page.evaluate(() => (window as unknown as Win).__epochs.stats.events);
        await page.locator('.event [data-act="answer"]').first().click();
        await page.waitForTimeout(200);
        const answered = await page.evaluate(() => (window as unknown as Win).__epochs.stats.events);
        if (answered !== events + 1) errors.push(`${vp.name}: answering the Chronicle did nothing`);
        // Tap a building on the skyline, then rebuild it if it is old.
        const plot = await page.evaluate(() => {
          const s = (window as unknown as Win).__epochs;
          const i = s.plots.findIndex((p) => p && p.era < s.era);
          return i >= 0 ? i : s.plots.findIndex(Boolean);
        });
        await page.evaluate((i) => (window as unknown as { __scene: { reveal(i: number): void } }).__scene.reveal(i), plot);
        await page.waitForTimeout(200);
        const box = (await page.locator('#scene').boundingBox())!;
        const x = await page.evaluate((i) => {
          const sc = (window as unknown as { __scene: { plotX(i: number): number; scroll: number } }).__scene;
          return sc.plotX(i) - sc.scroll + 8;
        }, plot);
        const scale = await page.evaluate(() => {
          const c = document.querySelector('#scene') as HTMLCanvasElement;
          const sc = (window as unknown as { __scene: { scale: number } }).__scene;
          return sc.scale / (c.width / c.getBoundingClientRect().width);
        });
        await page.mouse.click(box.x + x * scale, box.y + box.height - 40);
        await page.waitForTimeout(300);
        if (!(await page.locator('.pick').isVisible())) errors.push(`${vp.name}: tapping a building did not pick it`);
        await shoot(page, `${vp.name}-pick`);
        const rebuild = page.locator('[data-act="modernize-plot"]');
        if (await rebuild.isVisible()) {
          await rebuild.click();
          const era = await page.evaluate((i) => {
            const s = (window as unknown as Win).__epochs;
            return s.plots[i]!.era === s.era;
          }, plot);
          if (!era) errors.push(`${vp.name}: rebuilding did not modernize the building`);
        }
        await page.waitForTimeout(2500);
        const audio = await page.evaluate(() => {
          const m = (window as unknown as Win).__music;
          return m ? { state: m.m.ctx.state, scheduled: m.scheduled } : null;
        });
        console.log(`${vp.name} audio:`, JSON.stringify(audio));
        if (!audio || audio.state !== 'running' || audio.scheduled < 1) errors.push(`audio not running: ${JSON.stringify(audio)}`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Screenshots in ${OUT}/. No console errors.`);
}

void main();
