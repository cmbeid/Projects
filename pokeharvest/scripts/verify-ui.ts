/**
 * Drives the built game in Chromium on a phone, a tablet and a desktop
 * screen: title, starter pick, a morning's farming, nightfall, bed, and the
 * Poké Mart. Writes screenshots to `screenshots/` and checks the layout fits
 * (no scrolling, HUD and hotbar on screen) and that sound plays. Run
 * `npm run preview` first, or point VERIFY_URL elsewhere.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

interface Hook {
  world: {
    clock: number;
    player: { x: number; y: number; path: unknown[]; energy: number };
    plots: Record<string, { watered: boolean; crop: { id: string } | null }>;
    selected: string;
  };
  tileCentre(x: number, y: number): { x: number; y: number };
}

let failures = 0;
function check(ok: boolean, message: string): void {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures += 1;
}

async function listenForSound(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __sounds: number };
    w.__sounds = 0;
    for (const proto of [OscillatorNode.prototype, AudioBufferSourceNode.prototype] as { start: (...a: unknown[]) => void }[]) {
      const start = proto.start;
      proto.start = function (this: unknown, ...a: unknown[]) {
        w.__sounds += 1;
        return start.apply(this, a);
      };
    }
  });
}

async function fits(page: Page, what: string): Promise<void> {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, sh: document.documentElement.scrollHeight, h: innerHeight }));
  check(r.sw <= r.w && r.sh <= r.h, `${what}: fits the screen (${r.sw}×${r.sh} in ${r.w}×${r.h})`);
}

async function onScreen(page: Page, selector: string, what: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize()!;
  check(Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1), `${what} is on screen`);
}

async function tap(page: Page, x: number, y: number, touch: boolean): Promise<void> {
  const at = await page.evaluate(([tx, ty]) => (window as unknown as { __farm: Hook }).__farm.tileCentre(tx!, ty!), [x, y]);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** Wait until the farmer has stopped walking. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __farm: Hook }).__farm.world.player.path.length === 0, undefined, { timeout: 10_000 });
  await page.waitForTimeout(150);
}

async function hold(page: Page, label: string): Promise<void> {
  await page.locator(`.slot[aria-label="${label}"]`).click();
}

async function run(name: string, viewport: { width: number; height: number }, touch: boolean): Promise<void> {
  console.log(`${name} (${viewport.width}×${viewport.height})`);
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await listenForSound(page);
  await page.goto(URL);
  await page.waitForSelector('.title');
  await page.waitForTimeout(600);
  await fits(page, 'title');
  await page.screenshot({ path: `${OUT}/${name}-1-title.png` });

  await page.getByRole('button', { name: 'New farm' }).click();
  await page.waitForSelector('.starter');
  await page.waitForTimeout(600);
  await fits(page, 'starter pick');
  await page.screenshot({ path: `${OUT}/${name}-2-starters.png` });
  await page.locator('.starter').nth(2).click();

  await page.waitForSelector('.sheet');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-3-help.png` });
  await page.getByRole('button', { name: "Let's farm!" }).click();
  await page.waitForTimeout(500);
  await fits(page, 'farm');
  await onScreen(page, '.hud', 'HUD');
  await onScreen(page, '.hotbar', 'hotbar');

  // Till, plant and water a row just below the house.
  for (const x of [6, 7, 8]) {
    await hold(page, 'Hoe');
    await tap(page, x, 7, touch);
    await settle(page);
    await hold(page, 'Oran Seeds');
    await tap(page, x, 7, touch);
    await settle(page);
    await hold(page, 'Watering Can');
    await tap(page, x, 7, touch);
    await settle(page);
  }
  const plots = await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.plots);
  check(['6,7', '7,7', '8,7'].every((k) => plots[k]?.crop?.id === 'oran' && plots[k]?.watered), 'tilled, planted and watered three tiles');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}-4-farm.png` });

  // Nightfall.
  await page.evaluate(() => { (window as unknown as { __farm: Hook }).__farm.world.clock = 21 * 60; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-5-night.png` });

  // Bed, and the morning report.
  await tap(page, 4, 4, touch);
  await page.getByRole('button', { name: 'Sleep' }).click({ timeout: 10_000 });
  await page.waitForSelector('text=Start the day');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-6-morning.png` });
  await page.getByRole('button', { name: 'Start the day' }).click();

  // The Mart by the gate.
  await page.evaluate(() => Object.assign((window as unknown as { __farm: Hook }).__farm.world.player, { x: 12, y: 28, path: [] }));
  await page.waitForTimeout(700);
  await tap(page, 13, 29, touch);
  await page.waitForSelector('text=Buy seeds', { timeout: 10_000 });
  await page.waitForTimeout(400);
  await fits(page, 'mart');
  await page.screenshot({ path: `${OUT}/${name}-7-mart.png` });
  await page.locator('.sheet .row').first().getByRole('button', { name: '×1' }).click();
  await page.locator('.close').click();

  const heard = await page.evaluate(() => (window as unknown as { __sounds: number }).__sounds);
  check(heard > 0, `sound played (${heard} sounds)`);

  await page.reload();
  await page.waitForSelector('.title');
  check(await page.getByRole('button', { name: /Continue · Day 2/ }).isVisible(), 'the farm was saved');
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  await browser.close();
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await run('phone', { width: 390, height: 844 }, true);
  await run('tablet', { width: 768, height: 1024 }, true);
  await run('desktop', { width: 1440, height: 900 }, false);
  if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('all good');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
