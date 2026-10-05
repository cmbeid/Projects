/**
 * Drives the built game in a real browser and writes screenshots of every
 * tab at phone, tablet and desktop sizes, puts a building on the map the way
 * a player would, and checks that the sound is actually running.
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
import { BUILDINGS } from '../src/data/buildings';
import { runBot } from '../src/game/bot';
import { spawnRuin } from '../src/game/clearing';
import { canAffordPlace } from '../src/game/economy';
import { newGame } from '../src/game/engine';
import { freeSpots } from '../src/game/grid';
import { districtIndex } from '../src/data/districts';
import { serialize, STORAGE_KEY } from '../src/state/persistence';
import type { GameState } from '../src/state/types';

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
function botSave(minutes: number): GameState {
  const s = newGame(11);
  runBot(s, minutes * 60);
  s.savedAt = Date.now();
  return s;
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function dismiss(page: Page): Promise<void> {
  const close = page.locator('.modal [data-act="close"]').first();
  if (await close.isVisible().catch(() => false)) await close.click();
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const errors: string[] = [];
  const mid = botSave(45);
  // A player saving up for something: enough in the purse to place whatever is unlocked.
  mid.coins = Math.max(mid.coins, 1e9);
  // The bot fills every tile; pull one 1×1 down in the district on show, so there is room to place.
  const gap = mid.buildings.findIndex((b) => b.district === districtIndex(mid.ward) && b.type === 'tent');
  if (gap >= 0) mid.buildings.splice(gap, 1);
  const saves = { fresh: null as GameState | null, mid, deep: botSave(60 * 4) };

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

      // Swing at the ruin on the work site.
      const box = (await page.locator('#scene').boundingBox())!;
      for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.5);
      await shoot(page, `${vp.name}-${label}-city`);

      if (label !== 'fresh') {
        const tabs = await page.locator('#tabs .tab').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['act']!));
        for (const act of tabs) {
          await page.locator(`#tabs [data-act="${act}"]`).click();
          await shoot(page, `${vp.name}-${label}-${act.replace('tab:', '')}`);
        }
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (scroll) errors.push(`${vp.name}/${label}: page scrolls horizontally`);
      }

      if (label === 'mid' && (vp.name === 'phone' || vp.name === 'wide')) {
        // Put a building down: pick it in Build, then tap open ground — twice on a phone.
        const district = districtIndex(mid.ward);
        const def = BUILDINGS.find((b) => b.w === 1 && canAffordPlace(mid, b.id) && freeSpots(mid, b.id, district).length > 0);
        if (!def) errors.push('placement: the mid save cannot place anything');
        else {
          const spot = freeSpots(mid, def.id, district)[0]!;
          const before = await page.evaluate(() => (window as unknown as { __hearthrise: GameState }).__hearthrise.buildings.length);
          await page.locator('#tabs [data-act="tab:build"]').click();
          await page.locator(`[data-act="place:${def.id}"]`).click();
          const at = await page.evaluate(([x, y]) => (window as unknown as { __scene: { tileCenter(x: number, y: number): { x: number; y: number } } }).__scene.tileCenter(x!, y!), [spot.x, spot.y]);
          if (vp.name === 'phone') {
            await page.touchscreen.tap(box.x + at.x, box.y + at.y);
            await page.waitForTimeout(300);
            await shoot(page, `${vp.name}-placing`);
            await page.touchscreen.tap(box.x + at.x, box.y + at.y);
          } else {
            await page.mouse.move(box.x + at.x, box.y + at.y);
            await page.waitForTimeout(300);
            await shoot(page, `${vp.name}-placing`);
            await page.mouse.click(box.x + at.x, box.y + at.y);
          }
          await page.waitForTimeout(300);
          const after = await page.evaluate(() => (window as unknown as { __hearthrise: GameState }).__hearthrise.buildings.length);
          if (after !== before + 1) errors.push(`${vp.name} placement: expected ${before + 1} buildings, got ${after}`);
          await page.keyboard.press('Escape');
          // Tap the new building: its sheet opens.
          await page.mouse.click(box.x + at.x, box.y + at.y);
          await page.waitForTimeout(300);
          if (!(await page.locator('#sheet-move').isVisible())) errors.push(`${vp.name}: tapping a building did not open its sheet`);
          await shoot(page, `${vp.name}-building`);
          await dismiss(page);
        }
      }

      if (vp.name === 'phone' && label === 'mid') {
        // Tapping the ward chip opens the picker; going to the first ward moves there.
        await page.locator('.depth-label').click();
        await page.waitForTimeout(300);
        await shoot(page, `${vp.name}-jump`);
        await page.locator('.modal [data-to="1"]').first().click();
        await page.waitForTimeout(300);
        const ward = await page.evaluate(() => (window as unknown as { __hearthrise: GameState }).__hearthrise.ward);
        if (ward !== 1) errors.push(`jump: expected ward 1, got ${ward}`);
        await page.locator('#fs').click();
        await page.waitForTimeout(300);
        const fsOn = await page.evaluate(() => !!document.fullscreenElement);
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

  // Beyond the Spire: the Cloudline in a gust, and the Undercroft and Far Shore on the map.
  {
    const st = botSave(30);
    st.ward = st.maxWard = st.furthestEver = 52;
    st.features.push('tide', 'festival', 'survey', 'passives');
    st.flags.push('heard', 'rang', 'below', 'above');
    st.story = { id: 'docks', base: 0 };
    st.time = 3;
    spawnRuin(st);
    let uid = 9000;
    const put = (type: string, district: number, x: number, y: number, lvl = 3): void => {
      st.buildings.push({ uid: uid++, type, district, x, y, lvl });
    };
    put('sky-terrace', 6, 0, 0);
    put('wind-garden', 6, 2, 0, 1);
    put('cloud-exchange', 6, 3, 0);
    put('airship-dock', 6, 4, 1);
    put('sky-terrace', 6, 0, 2);
    put('wind-garden', 6, 2, 2, 1);
    put('cistern-homes', 5, 0, 0);
    put('pump-gang', 5, 1, 0);
    put('vault-market', 5, 2, 0);
    put('lamp-garden', 5, 3, 0, 1);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, serialize(st)]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`expansion: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`expansion: ${m.text()}`));
    await page.goto(URL);
    await page.waitForSelector('#scene');
    await dismiss(page);
    await shoot(page, 'expansion-cloudline');
    await page.locator('#wardchip [aria-label="Previous district"]').click();
    await shoot(page, 'expansion-undercroft');
    await page.locator('#tabs [data-act="tab:build"]').click();
    await shoot(page, 'expansion-build');
    await ctx.close();
  }

  // The end of the story: the last door, and the choice.
  {
    const st = botSave(30);
    st.ward = st.maxWard = st.furthestEver = 40;
    st.features.push('tide', 'festival', 'survey');
    st.flags.push('heard', 'remembered');
    st.story = { id: 'summit', base: 0 };
    st.time = 400;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, serialize(st)]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`story: ${e.message}`));
    await page.goto(URL);
    await page.waitForSelector('#scene');
    await dismiss(page);
    await shoot(page, 'story-spire');
    await page.locator('#tabs [data-act="tab:missions"]').click();
    await page.locator('[data-act="claim"]').click();
    await page.waitForTimeout(400);
    await shoot(page, 'story-choice');
    await page.locator('[data-choice="0"]').click();
    await page.waitForTimeout(7000);
    if (!(await page.locator('.story-scene').isVisible())) errors.push('story: the choice did not play its scene');
    await shoot(page, 'story-scene');
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
