/**
 * Plays the built game in a real browser and writes screenshots.
 *
 * Manual, not part of CI: it is here so the look of a change can be checked,
 * in both orientations, rather than asserted about. Run `npm run preview`
 * first, or point VERIFY_URL somewhere else.
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
/** Set when the sandbox ships a Chromium other than the one Playwright pins. */
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

const VIEWPORTS = [
  { name: 'landscape', width: 844, height: 390 },
  { name: 'portrait', width: 390, height: 844 },
];

/** Where the pouch is on screen, read from the running camera. */
async function pouch(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => (window as unknown as { __pouch(): { x: number; y: number } }).__pouch());
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  let failures = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => {
      console.error(`  ✗ page error: ${error.message}`);
      failures += 1;
    });

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/${viewport.name}-title.png` });
    await page.click('text=Play');
    await page.screenshot({ path: `${OUT}/${viewport.name}-levels.png` });
    await page.click('.level-tile >> nth=0');
    await page.waitForTimeout(2500); // the intro pan
    await page.screenshot({ path: `${OUT}/${viewport.name}-level1.png` });

    const at = await pouch(page);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x - 60, at.y + 22, { steps: 8 });
    await page.screenshot({ path: `${OUT}/${viewport.name}-aim.png` });
    await page.mouse.move(at.x - 200, at.y + 50, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${viewport.name}-flight.png` });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/${viewport.name}-after.png` });

    const score = await page.textContent('.hud-score');
    console.log(`  ${viewport.name.padEnd(10)} score after one shot: ${score}`);
    if (score === '0') {
      console.error(`  ✗ ${viewport.name}: the shot scored nothing`);
      failures += 1;
    }
    await page.close();
  }

  // The later worlds, reached through a save with everything unlocked.
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    const best: Record<number, { score: number; stars: number }> = {};
    for (let id = 1; id <= 11; id += 1) best[id] = { score: 1, stars: (id % 3) + 1 };
    localStorage.setItem('pokefling:progress', JSON.stringify({ version: 1, best, muted: true }));
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('text=Play');
  for (const id of [7, 12]) {
    await page.click(`.level-tile >> nth=${id - 1}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/level${id}.png` });
    await page.click('[aria-label=Pause]');
    await page.screenshot({ path: `${OUT}/level${id}-paused.png` });
    await page.click('text=Levels');
  }
  await page.close();

  await browser.close();
  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
