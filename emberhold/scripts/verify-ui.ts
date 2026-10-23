/**
 * Drives the built game in a real browser at phone size: screenshots of
 * every main view, a check for console errors and sideways scrolling, and
 * a save round trip through a reload.
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
import { addItem, newGame } from '../src/game/core';
import { equip, equipFood } from '../src/game/combat';
import { advance } from '../src/game/engine';
import { startAction } from '../src/game/skilling';
import { serialize, STORAGE_KEY } from '../src/state/persistence';
import { xpFor } from '../src/game/xp';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

/** A save some way in, so every view has something on it. */
function midSave(): string {
  const s = newGame(11, Date.now() - 3600_000);
  for (const k of ['woodcutting', 'fishing', 'mining', 'attack', 'strength', 'defence', 'hitpoints', 'farming', 'agility', 'cartography', 'construction', 'ranching', 'astrology'] as const) s.xp[k] = xpFor(32);
  s.gp = 250_000;
  for (const [id, n] of [['iron-sword', 1], ['iron-platebody', 1], ['food-trout', 80], ['log-oak', 400], ['ore-iron', 200], ['bones', 40], ['stardust', 300], ['seed-cabbage', 20], ['potion-attack', 3], ['sunken-chest', 2]] as const) addItem(s, id, n);
  equip(s, 'iron-sword');
  equip(s, 'iron-platebody');
  equipFood(s, 'food-trout');
  startAction(s, 'wc-oak');
  advance(s, 120_000);
  s.savedAt = Date.now();
  return serialize(s);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // First launch: the welcome sheet.
  await page.goto(URL);
  await page.waitForSelector('#nav button');
  await shoot(page, '00-welcome');
  await page.click('.sheet [data-act="close"]');

  // A save some way in, put in place before the game boots (a plain reload would save over it).
  await ctx.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('injected')) {
      sessionStorage.setItem('injected', '1');
      localStorage.setItem(k!, v!);
    }
  }, [STORAGE_KEY, midSave()]);
  await page.reload();
  await page.waitForSelector('#nav button');
  await shoot(page, '01-offline');
  const close = page.locator('.sheet .x');
  if (await close.isVisible()) await close.click();
  await shoot(page, '02-skills');

  const views: [string, string][] = [['bank', '03-bank'], ['combat', '04-combat'], ['guilds', '05-guilds'], ['more', '06-more']];
  for (const [v, name] of views) {
    await page.click(`#nav [data-view="${v}"]`);
    await shoot(page, name);
    const o = await overflow(page);
    if (o > 0) errors.push(`${v}: page scrolls sideways by ${o}px`);
  }
  for (const sk of ['woodcutting', 'farming', 'agility', 'cartography', 'construction', 'ranching', 'astrology', 'smithing']) {
    await page.click('[data-act="drawer"]');
    await page.click(`#drawer [data-skill="${sk}"]`);
    await shoot(page, `10-${sk}`);
    const o = await overflow(page);
    if (o > 0) errors.push(`${sk}: page scrolls sideways by ${o}px`);
  }
  // Start a fight with chickens.
  await page.click('#nav [data-view="combat"]');
  await page.click('[data-act="fight"][data-monster="chicken"]');
  await page.waitForTimeout(4000);
  await shoot(page, '20-fight');
  for (const tab of ['gear', 'prayer', 'magic', 'slayer']) {
    await page.click(`[data-act="combat-tab"][data-tab="${tab}"]`);
    await shoot(page, `21-${tab}`);
  }
  // Bank item sheet.
  await page.click('#nav [data-view="bank"]');
  await page.click('.bankgrid .slot >> nth=0');
  await shoot(page, '30-item');
  await page.click('.sheet .x');
  for (const v of ['shop', 'quests', 'raid', 'pets', 'completion', 'museum', 'settings']) {
    await page.click('#nav [data-view="more"]');
    await page.click(`.tile[data-view="${v}"]`);
    await shoot(page, `40-${v}`);
    const o = await overflow(page);
    if (o > 0) errors.push(`${v}: page scrolls sideways by ${o}px`);
  }
  // Save survives a reload.
  const before = await page.evaluate(() => (window as unknown as { __emberhold: { xp: { attack: number } } }).__emberhold.xp.attack);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForSelector('#nav button');
  const after = await page.evaluate(() => (window as unknown as { __emberhold: { xp: { attack: number } } }).__emberhold.xp.attack);
  if (after < before) errors.push(`save lost XP across a reload: ${before} → ${after}`);

  await browser.close();
  if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'));
    process.exit(1);
  }
  console.log(`Screenshots in ${OUT}/. No console errors, no sideways scrolling.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
