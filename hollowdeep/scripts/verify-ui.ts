/**
 * Drives the built game in a real browser and writes screenshots of every
 * tab at a phone size and a desktop size, then checks that the sound is
 * actually running.
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

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  // A phone with the browser's own bars showing leaves the scene short.
  { name: 'short', width: 360, height: 600 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'wide', width: 1440, height: 900 },
];

/** A save some way in, so every tab has something on it. */
function midGameSave(minutes: number): string {
  const s = newGame(11);
  runBot(s, minutes * 60);
  s.savedAt = Date.now();
  return serialize(s);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const errors: string[] = [];
  const saves = { fresh: null as string | null, mid: midGameSave(45), deep: midGameSave(60 * 7) };

  for (const vp of VIEWPORTS) {
    for (const [label, save] of Object.entries(saves)) {
      if (label !== 'mid' && (vp.name === 'tablet' || vp.name === 'short')) continue;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, hasTouch: vp.name === 'phone' });
      if (save) await ctx.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, save]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${vp.name}/${label}: ${e.message}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name}/${label}: ${m.text()}`));
      await page.goto(URL);
      await page.waitForSelector('#scene');
      // Dismiss the offline summary if one came up.
      const close = page.locator('.modal [data-act="close"]').first();
      if (await close.isVisible().catch(() => false)) await close.click();

      const box = (await page.locator('#scene').boundingBox())!;
      for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width * 0.56, box.y + box.height * 0.5);
      await shoot(page, `${vp.name}-${label}-mine`);

      if (label !== 'fresh') {
        const tabs = await page.locator('#tabs .tab').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['act']!));
        for (const act of tabs) {
          await page.locator(`#tabs [data-act="${act}"]`).click();
          await shoot(page, `${vp.name}-${label}-${act.replace('tab:', '')}`);
        }
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (scroll) errors.push(`${vp.name}/${label}: page scrolls horizontally`);
      }

      if (vp.name === 'phone' && label === 'mid') {
        // Tapping the depth label opens the picker; jumping to the top moves there.
        await page.locator('.depth-label').click();
        await page.waitForTimeout(300);
        await shoot(page, `${vp.name}-jump`);
        await page.locator('.modal [data-to="1"]').first().click();
        await page.waitForTimeout(300);
        const depth = await page.evaluate(() => (window as unknown as { __hollowdeep: { depth: number } }).__hollowdeep.depth);
        if (depth !== 1) errors.push(`jump: expected depth 1, got ${depth}`);
        await page.locator('#fs').click();
        await page.waitForTimeout(300);
        const fsOn = await page.evaluate(() => !!document.fullscreenElement);
        await shoot(page, `${vp.name}-fullscreen`);
        await page.locator('#fs').click();
        await page.waitForTimeout(300);
        const fsOff = await page.evaluate(() => !document.fullscreenElement);
        if (!fsOn || !fsOff) errors.push(`fullscreen toggle failed (on ${fsOn}, off ${fsOff})`);
        await page.locator('[data-act="settings"]').click();
        await shoot(page, `${vp.name}-settings`);
        await page.locator('.modal [data-act="close"]').last().click();
        await page.waitForTimeout(2500);
        const audio = await page.evaluate(() => {
          const m = (window as unknown as { __music?: { scheduled: number; m: { ctx: AudioContext } } }).__music;
          return m ? { state: m.m.ctx.state, scheduled: m.scheduled } : null;
        });
        console.log('audio:', JSON.stringify(audio));
        if (!audio || audio.state !== 'running' || audio.scheduled < 1) errors.push(`audio not running: ${JSON.stringify(audio)}`);
      }
      await ctx.close();
    }
  }
  // A save deep in the expansion: a scene to claim, bargains open, the world changed.
  {
    const st = newGame(13);
    runBot(st, 60 * 60);
    st.depth = st.maxDepth = st.deepestEver = 265;
    st.features.push('bargains');
    st.flags.push('other-miner', 'lamp-ahead', 'synced');
    st.story = { id: 'below', base: 0 };
    st.savedAt = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, serialize(st)]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`story: ${e.message}`));
    await page.goto(URL);
    await page.waitForSelector('#scene');
    const close = page.locator('.modal [data-act="close"]').first();
    if (await close.isVisible().catch(() => false)) await close.click();
    await page.waitForTimeout(4200);
    await shoot(page, 'story-waking');
    await page.locator('#tabs [data-act="tab:missions"]').click();
    await page.locator('[data-act="claim"]').click();
    await page.waitForTimeout(6000);
    if (!(await page.locator('.story-scene').isVisible())) errors.push('story: claiming did not play its scene');
    await shoot(page, 'story-scene');
    await page.locator('#scene-next').click();
    await page.locator('#tabs [data-act="tab:miner"]').click();
    await page.locator('[data-key="bargains"]').scrollIntoViewIfNeeded();
    await shoot(page, 'story-bargains');
    await ctx.close();
  }

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Screenshots in ${OUT}/. No console errors.`);
}

void main();
