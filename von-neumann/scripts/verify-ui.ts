/**
 * Drives the built game in a real browser and writes screenshots.
 *
 * Manual, not part of CI: it is here so a change to the layout can be *looked*
 * at, at both breakpoints, rather than asserted about. Run `npm run preview`
 * first, or point VERIFY_URL somewhere else.
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
  { name: 'phone', width: 390, height: 844 },
  { name: 'wide', width: 1100, height: 800 },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  let failures = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (error) => {
      console.error(`  ✗ page error: ${error.message}`);
      failures += 1;
    });

    await page.goto(URL, { waitUntil: 'networkidle' });
    // Earn enough ore for the first purchases to light up.
    for (let i = 0; i < 40; i += 1) await page.click('.mine');
    await page.waitForTimeout(600);

    const wide = await page.evaluate(() => document.querySelector('.app')?.classList.contains('is-wide'));
    const expected = viewport.width >= 700;
    if (wide !== expected) {
      console.error(`  ✗ ${viewport.name}: is-wide was ${wide}, expected ${expected}`);
      failures += 1;
    }

    const ore = await page.textContent('.resource-amount');
    const buildings = await page.locator('.building').count();
    console.log(`  ${viewport.name.padEnd(6)} ore=${ore} buildings=${buildings} wide=${wide}`);
    if (buildings === 0) {
      console.error(`  ✗ ${viewport.name}: no buildings rendered`);
      failures += 1;
    }

    await page.screenshot({ path: `${OUT}/${viewport.name}.png`, fullPage: false });
    await page.close();
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\nFAILED — ${failures} problem(s).`);
    process.exit(1);
  }
  console.log(`\nOK — screenshots in ${OUT}/`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
