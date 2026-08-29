/**
 * Drives the built app in a real browser and writes screenshots.
 *
 * Manual, not part of CI: it is here so the shelf and reader can be *looked*
 * at, at all three breakpoints, rather than merely asserted about. Run
 * `npm run preview` first, or point VERIFY_URL somewhere else.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
/**
 * Set this when the sandbox ships a Chromium that does not match the build
 * Playwright pins — launching the one that is already there beats downloading
 * a second copy. Unset, Playwright resolves its own.
 */
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, mode: 'compact' },
  { name: 'medium', width: 840, height: 1000, mode: 'medium' },
  { name: 'wide', width: 1280, height: 900, mode: 'wide' },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  let failures = 0;

  for (const viewport of VIEWPORTS) {
    failures += await run(browser, viewport);
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\nFAILED — ${failures} problem(s).`);
    process.exit(1);
  }
  console.log(`\nOK — screenshots in ${OUT}/`);
}

/**
 * Shelf → "The Clockwork Aviary" → a choice made deliberately without the
 * key first, so `door` shows both real choices locked and disabled, with
 * `lockedText` — then the always-available third choice there (added after
 * this exact path turned up a genuine dead end during phase 7, since
 * `allowBack: false` means a node with only disabled choices has no
 * recovery at all; see format.md §5) carries it to an ending.
 */
async function run(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  viewport: { name: string; width: number; height: number; mode: string },
): Promise<number> {
  let failures = 0;
  const fail = (message: string): void => {
    console.error(`  ✗ ${viewport.name}: ${message}`);
    failures += 1;
  };

  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => fail(`page error: ${error.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sy-shelf', { timeout: 5000 });

  const cardCount = await page.locator('.sy-card').count();
  if (cardCount < 2) fail(`expected at least 2 story cards on the shelf, found ${cardCount}`);
  await page.screenshot({ path: `${OUT}/${viewport.name}-shelf.png` });

  const card = page.locator('.sy-card', { hasText: 'Clockwork Aviary' });
  if ((await card.count()) === 0) {
    fail('the Clockwork Aviary card is missing');
    await page.close();
    return failures;
  }
  await card.click();
  await page.waitForSelector('.sy-reader', { timeout: 5000 });

  const layoutMode = await page.getAttribute('.sy-reader', 'data-layout');
  if (layoutMode !== viewport.mode) fail(`layout mode was "${layoutMode}", expected "${viewport.mode}"`);

  await page.locator('.sy-choice', { hasText: 'Search the hedges' }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${viewport.name}-node.png` });

  await page.locator('.sy-choice', { hasText: 'Go straight to the aviary door' }).click();
  await page.waitForTimeout(150);

  const lockedChoice = page.locator('.sy-choice.is-locked', { hasText: 'Unlock the door' });
  if ((await lockedChoice.count()) === 0) fail('the locked "Unlock the door" choice is not showing as locked');
  else if (!(await lockedChoice.isDisabled())) fail('the locked choice is visible but not actually disabled');
  const lockedText = await page.locator('.sy-choice-hint').first().textContent();
  if (!lockedText?.includes('No key')) fail(`expected the lockedText hint, got "${lockedText}"`);
  await page.screenshot({ path: `${OUT}/${viewport.name}-locked-choice.png` });

  const escape = page.locator('.sy-choice', { hasText: 'Give up and turn back' });
  if ((await escape.count()) === 0 || (await escape.isDisabled())) {
    fail('no usable way out of "door" without the key — a real dead end (allowBack is false here)');
  } else {
    await escape.click();
    await page.waitForTimeout(150);
    if ((await page.locator('.sy-ending').count()) === 0) fail('did not reach an ending after leaving the door');
  }
  await page.screenshot({ path: `${OUT}/${viewport.name}-ending.png` });

  await page.close();
  console.log(`  ${viewport.name.padEnd(6)} ${failures === 0 ? 'OK' : `${failures} problem(s)`}`);
  return failures;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
