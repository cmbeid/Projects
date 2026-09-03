/**
 * Drives the built spike in a real browser and writes screenshots.
 *
 * Manual, not part of CI. The whole question this project asks — does a
 * SimTower-shaped tower read on a phone held upright — is answered by looking,
 * so this exists to produce the thing to look at, at each zoom step and at both
 * ends of the day.
 *
 * Run `npm run preview` first, or point VERIFY_URL somewhere else.
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

/** Portrait first, and a tablet to check the layout does not fall apart. */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-small', width: 360, height: 640 },
  { name: 'tablet', width: 820, height: 1180 },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  let failures = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => {
      console.error(`  ✗ page error: ${error.message}`);
      failures += 1;
    });

    // Pinned to the early afternoon: unpinned, the clock starts at midnight and
    // every shot would be of a dark tower.
    await page.goto(`${URL}?hour=13`, { waitUntil: 'networkidle' });
    // Two frames in, the canvas has been sized and the tower drawn.
    await page.waitForTimeout(400);
    // The notice sits over the tower, and the tower is what these shots are of.
    await page.click('.art-collapse');

    const canvas = await page.evaluate(() => {
      const element = document.querySelector<HTMLCanvasElement>('.stage');
      if (!element) return null;
      const context = element.getContext('2d');
      const sample = context?.getImageData(0, 0, element.width, element.height);
      // How many distinct colours are on screen. A blank canvas is one, and a
      // drawn tower is many — the cheapest possible "did anything render".
      const seen = new Set<number>();
      if (sample) {
        for (let i = 0; i < sample.data.length; i += 4) {
          seen.add(((sample.data[i] ?? 0) << 16) | ((sample.data[i + 1] ?? 0) << 8) | (sample.data[i + 2] ?? 0));
        }
      }
      return { width: element.width, height: element.height, colours: seen.size };
    });

    if (!canvas) {
      console.error(`  ✗ ${viewport.name}: no canvas`);
      failures += 1;
      await page.close();
      continue;
    }

    const segments = Math.round(canvas.width / 8);
    const floors = (canvas.height / 36).toFixed(1);
    console.log(
      `  ${viewport.name.padEnd(12)} ${canvas.width}x${canvas.height} art px · ${segments} segments · ${floors} floors · ${canvas.colours} colours`,
    );

    if (canvas.colours < 4) {
      console.error(`  ✗ ${viewport.name}: canvas looks blank`);
      failures += 1;
    }

    await page.screenshot({ path: `${OUT}/${viewport.name}.png` });

    // Each zoom step, so the phone screenshots show what the tower looks like
    // at overview, working and close scales.
    if (viewport.name === 'phone') {
      for (const scale of [1, 3]) {
        await page.evaluate(() => {
          window.dispatchEvent(new Event('resize'));
        });
        await page.mouse.move(195, 400);
        await page.mouse.wheel(0, scale === 1 ? 400 : -800);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${OUT}/phone-${scale}x.png` });
      }

      // Panned to the edge of the block, where the tower stops and the street
      // the original stands it in is what there is to see.
      await page.goto(`${URL}?hour=13`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.click('.art-collapse');
      await page.mouse.move(300, 400);
      await page.mouse.down();
      await page.mouse.move(40, 400, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/phone-street.png` });

      // Placing something, so the build bar and its feedback are in a shot.
      await page.click('button[data-tool="build:office"]');
      await page.mouse.click(195, 420);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${OUT}/phone-building.png` });

      // Night, with the clock pinned so it does not mean waiting for night.
      await page.goto(`${URL}?hour=22`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.click('.art-collapse');
      await page.screenshot({ path: `${OUT}/phone-night.png` });
    }

    await page.close();
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n${failures} problem${failures === 1 ? '' : 's'}.`);
    process.exitCode = 1;
  } else {
    console.log(`\nScreenshots in ${OUT}/`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
