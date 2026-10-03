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
      if (label !== 'mid' && vp.name === 'tablet') continue;
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
  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`Screenshots in ${OUT}/. No console errors.`);
}

void main();
