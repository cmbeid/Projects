/**
 * Plays the built game in a real browser and writes screenshots.
 *
 * Manual, not part of CI: it is here so the look of a change can be checked,
 * in both orientations, rather than asserted about. It also checks that sound
 * actually starts — music, cries and effects — and that the volume sliders
 * reach the mixer. Run `npm run preview` first, or point VERIFY_URL elsewhere.
 */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { AREAS } from '../src/data/areas';
import { LEVELS } from '../src/data/levels/index';

const URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';
/** Set when the sandbox ships a Chromium other than the one Playwright pins. */
const EXECUTABLE = process.env['CHROMIUM_PATH'];
const OUT = 'screenshots';

let failures = 0;
function check(ok: boolean, message: string): void {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures += 1;
}

/** Count sounds as they start, by kind, so a silent game is caught. */
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
      // Cries are the only buffers longer than a second's worth of drum.
      const key = this.buffer && this.buffer.duration < 0.99 ? 'cry' : 'buffer';
      w.__sounds[key] = (w.__sounds[key] ?? 0) + 1;
      return buf.apply(this, a);
    };
  });
}

const sounds = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __sounds: Record<string, number> }).__sounds }));

async function pouch(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => (window as unknown as { __pouch(): { x: number; y: number } }).__pouch());
}

async function fling(page: Page): Promise<void> {
  const at = await pouch(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x - 200, at.y + 60, { steps: 8 });
  await page.mouse.up();
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  for (const viewport of [{ name: 'landscape', width: 844, height: 390 }, { name: 'portrait', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', (error) => check(false, `page error: ${error.message}`));
    await listenForSound(page);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/${viewport.name}-title.png` });
    await page.click('text=Play');
    await page.waitForTimeout(1500);
    // Nothing but the menu music is playing yet.
    const menu = await sounds(page);
    check((menu['osc'] ?? 0) > 10, `${viewport.name}: the title music plays (${menu['osc']} notes in 1.5 s)`);
    await page.screenshot({ path: `${OUT}/${viewport.name}-levels.png` });
    await page.click('.level-tile >> nth=0');
    await page.waitForTimeout(2500); // the intro pan
    await page.screenshot({ path: `${OUT}/${viewport.name}-level1.png` });
    await fling(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${viewport.name}-flight.png` });
    await page.waitForTimeout(6000);
    const score = await page.textContent('.hud-score');
    check(score !== '0', `${viewport.name}: a shot scores (${score})`);
    const heard = await sounds(page);
    check((heard['osc'] ?? 0) > 50, `${viewport.name}: music and effects play (${heard['osc']} oscillator starts)`);
    check((heard['cry'] ?? 0) > 0, `${viewport.name}: a cry plays (${heard['cry'] ?? 0})`);
    await page.close();
  }

  // Everything unlocked, for the later areas, the bag and the settings.
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => check(false, `page error: ${error.message}`));
  await page.addInitScript((ids: string[]) => {
    const best: Record<string, { score: number; stars: number }> = {};
    ids.forEach((id, i) => { best[id] = { score: 1, stars: (i % 3) + 1 }; });
    const bag = { 'x-attack': 3, 'x-speed': 2, 'scope-lens': 1, 'max-revive': 0, 'tm-ground': 1 };
    localStorage.setItem('pokefling:progress', JSON.stringify({
      version: 2, best, bag, found: [], volumes: { sfx: 80, cries: 70, music: 50 }, muted: false,
    }));
  }, LEVELS.slice(0, -1).map((l) => l.id));
  await page.goto(URL, { waitUntil: 'networkidle' });

  await page.click('[aria-label=Settings]');
  await page.fill('input[aria-label=Music]', '0');
  await page.fill('input[aria-label="Sound effects"]', '100');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings.png` });
  const gains = await page.evaluate(() => (window as unknown as { __busGains(): Record<string, number> }).__busGains());
  check(gains['music'] !== undefined && gains['music'] < 0.01, `music slider at 0 silences the music bus (${gains['music']})`);
  check(gains['sfx'] !== undefined && gains['sfx'] > 0.9, `effects slider at 100 opens the effects bus (${gains['sfx']})`);
  await page.click('text=Done');

  await page.click('text=Play');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/levels-all.png`, fullPage: true });
  for (const [i, area] of AREAS.entries()) {
    const level = LEVELS.find((l) => l.area === i && l.index === (i === AREAS.length - 1 ? 6 : 3))!;
    await page.click(`[data-level="${level.id}"]`);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/area-${i + 1}-${area.key}.png` });
    if (i === 3) {
      await page.click('[aria-label=Bag]');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/bag.png` });
      await page.click('[data-item="x-attack"]');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/bag-used.png` });
    }
    await page.click('[aria-label=Pause]');
    await page.click('text=Levels');
    await page.waitForTimeout(300);
  }
  await page.close();

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
