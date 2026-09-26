/**
 * Drives the built game in Chromium on a phone, a tablet and a desktop
 * screen: through the menus, into the first battle, placing towers and
 * starting waves. Writes screenshots to `screenshots/` and checks the layout
 * fits (no sideways scrolling, the map and dock on screen) and that sound
 * starts. Run `npm run preview` first, or point VERIFY_URL elsewhere.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

let failures = 0;
function check(ok: boolean, message: string): void {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures += 1;
}

async function listenForSound(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __sounds: Record<string, number> };
    w.__sounds = { osc: 0, buffer: 0 };
    const osc = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a: Parameters<typeof osc>) {
      w.__sounds['osc'] = (w.__sounds['osc'] ?? 0) + 1;
      return osc.apply(this, a);
    };
    const buf = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a: Parameters<typeof buf>) {
      w.__sounds['buffer'] = (w.__sounds['buffer'] ?? 0) + 1;
      return buf.apply(this, a);
    };
  });
}

const sounds = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __sounds: Record<string, number> }).__sounds }));

async function fits(page: Page, what: string): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, h: innerHeight }));
  check(r.sw <= r.w && r.sh <= r.h, `${what}: fits the screen (${r.sw}×${r.sh} in ${r.w}×${r.h})`);
}

/** Tap the centre of map tile (x, y). */
async function tapTile(page: Page, x: number, y: number, twice: boolean): Promise<void> {
  const box = (await page.locator('canvas.map').boundingBox())!;
  const px = box.x + ((x + 0.5) / 9) * box.width;
  const py = box.y + ((y + 0.5) / 15) * box.height;
  for (let i = 0; i < (twice ? 2 : 1); i += 1) {
    if (twice) await page.touchscreen.tap(px, py);
    else await page.mouse.click(px, py);
    await page.waitForTimeout(120);
  }
}

async function run(name: string, viewport: { width: number; height: number }, touch: boolean): Promise<void> {
  console.log(`${name} (${viewport.width}×${viewport.height})`);
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await listenForSound(page);
  await page.goto(URL);
  await page.waitForSelector('.logo');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}-1-title.png` });
  await fits(page, 'title');

  await page.getByRole('button', { name: '▶ Play' }).click();
  await page.waitForSelector('.map-card');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-2-world.png` });
  await fits(page, 'world map');

  await page.locator('.map-card').first().click();
  await page.waitForSelector('.roster');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}-3-team.png` });

  await page.getByRole('button', { name: /Battle!/ }).click();
  await page.waitForSelector('canvas.map');
  await page.waitForTimeout(900);
  await fits(page, 'battle');
  const dockVisible = await page.locator('.dock').evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1);
  check(dockVisible, 'battle: dock is on screen');

  await page.evaluate(() => {
    (window as unknown as { __battle: { money: number } }).__battle.money = 5000;
  });
  const spots: [string, number, number][] = [['Charmander', 3, 2], ['Squirtle', 4, 5], ['Bulbasaur', 2, 9], ['Pidgey', 6, 9]];
  for (const [who, x, y] of spots) {
    await page.locator('.shop-card', { hasText: who }).click();
    await tapTile(page, x, y, touch);
  }
  const placed = await page.evaluate(() => (window as unknown as { __battle: { towers: unknown[] } }).__battle.towers.length);
  check(placed === 4, `battle: placed ${placed} of 4 towers`);
  await page.screenshot({ path: `${OUT}/${name}-4-placed.png` });

  await page.locator('.wave-btn').click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/${name}-5-wave.png` });

  await tapTile(page, 3, 2, false);
  await page.waitForTimeout(300);
  check(await page.locator('.panel').isVisible(), 'battle: tapping a tower opens its panel');
  await page.screenshot({ path: `${OUT}/${name}-6-panel.png` });

  const s = await sounds(page);
  check((s['osc'] ?? 0) > 5, `sound: synth effects and music playing (${s['osc']} oscillators)`);
  check((s['buffer'] ?? 0) > 0, `sound: cries or drums playing (${s['buffer']} buffers)`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await run('phone', { width: 390, height: 844 }, true);
  await run('tablet', { width: 820, height: 1180 }, true);
  await run('desktop', { width: 1440, height: 900 }, false);
  if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
