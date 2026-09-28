/**
 * Drives the built game in Chromium on a phone, a tablet and a desktop
 * screen: through the menus, into the first battle, placing towers and
 * starting waves. Writes screenshots to `screenshots/` and checks the layout
 * fits (no sideways scrolling, the map and dock on screen) and that sound
 * starts. Run `npm run preview` first, or point VERIFY_URL elsewhere.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { MAPS } from '../src/data/maps';

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

  // The last Pokémon picked stays picked: two more Pidgey without touching the dock.
  await tapTile(page, 6, 5, touch);
  await tapTile(page, 4, 9, touch);
  const more = await page.evaluate(() => (window as unknown as { __battle: { towers: unknown[] } }).__battle.towers.length);
  check(more === 6, `battle: built ${more - 4} more of the same without choosing it again`);
  check(await page.locator('.shop-card.on', { hasText: 'Pidgey' }).count() === 1, 'battle: Pidgey is still chosen after building');

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

  // Close the tab mid-battle (a reload will do) and come back: the battle carries on, paused.
  type Snap = { wave: number; money: number; towers: unknown[]; enemies: unknown[] };
  const before = await page.evaluate(() => {
    const g = (window as unknown as { __battle: Snap }).__battle;
    return { wave: g.wave, towers: g.towers.length };
  });
  await page.waitForTimeout(3500); // past a save
  await page.reload();
  await page.waitForSelector('canvas.map', { timeout: 10_000 }).catch(() => undefined);
  const after = await page.evaluate(() => {
    const g = (window as unknown as { __battle?: Snap }).__battle;
    return g ? { wave: g.wave, towers: g.towers.length } : null;
  });
  check(after !== null && after.wave === before.wave && after.towers === before.towers,
    `reopened: the battle resumes (wave ${after?.wave}/${before.wave}, ${after?.towers}/${before.towers} towers)`);
  check(await page.locator('.modal', { hasText: 'Welcome back' }).isVisible(), 'reopened: waiting, paused, to carry on');
  await page.screenshot({ path: `${OUT}/${name}-6b-resumed.png` });
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Give up' }).click();
  await page.waitForSelector('.map-card');
  await page.reload();
  await page.waitForSelector('.logo', { timeout: 10_000 }).catch(() => undefined);
  check(await page.locator('.logo').isVisible(), 'after giving up, reopening shows the title, not the old battle');
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
}

/**
 * Johto and Hoenn, from a save that has cleared everything up to Mt. Chimney:
 * the professor's welcome, the region tabs, and a battle in each new region,
 * Hoenn's with its weather showing.
 */
async function regions(name: string, viewport: { width: number; height: number }, touch: boolean): Promise<void> {
  console.log(`${name} regions (${viewport.width}×${viewport.height})`);
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cleared = [
    'viridian-forest', 'mt-moon', 'ss-anne', 'celadon', 'pokemon-tower', 'silph-co', 'cinnabar', 'viridian-gym', 'indigo-plateau',
    'sprout-tower', 'ilex-forest', 'goldenrod', 'burned-tower', 'cianwood', 'olivine-lighthouse', 'lake-of-rage', 'dragons-den', 'johto-league',
    'petalburg-woods', 'granite-cave', 'new-mauville',
  ];
  await page.addInitScript((ids: string[]) => {
    const results = Object.fromEntries(ids.map((id) => [id, { normal: 3, hard: 0, best: 0 }]));
    localStorage.setItem('pokedefense.save.v1', JSON.stringify({ results, greeted: ['kanto', 'johto'], tutorialDone: true, bp: 500 }));
  }, cleared);
  await page.goto(URL);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(700);
  check((await page.locator('.modal h2').textContent()) === 'Welcome to Hoenn!', 'Professor Birch welcomes you to Hoenn');
  await page.screenshot({ path: `${OUT}/${name}-7-welcome.png` });
  await page.getByRole('button', { name: /Thanks, Professor/ }).click();
  check(await page.locator('.tabs.regions button').count() === 6, 'six region tabs');
  await page.screenshot({ path: `${OUT}/${name}-8-hoenn.png` });

  for (const [tab, mapName, shot] of [['Johto', 'Sprout Tower', '9-johto-battle'], ['Hoenn', 'Mt. Chimney', '10-hoenn-battle']] as const) {
    await page.locator('.tabs.regions button', { hasText: tab }).click();
    await page.locator('.map-card', { hasText: mapName }).click();
    await page.getByRole('button', { name: /Battle!/ }).click();
    await page.waitForSelector('canvas.map');
    await page.locator('.wave-btn').click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}-${shot}.png` });
    const map = await page.evaluate(() => (window as unknown as { __battle: { map: { id: string } } }).__battle.map.id);
    check(map === (tab === 'Johto' ? 'sprout-tower' : 'mt-chimney'), `${tab}: ${mapName} battle running`);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.waitForSelector('.map-card');
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
}

/**
 * Sinnoh, Unova and Kalos, from a save that has cleared everything up to
 * Kalos: Professor Sycamore's welcome, six region tabs, Hearthome's fog,
 * the Striaton triplets, and Korrina's Lucario Mega Evolving.
 */
async function laterRegions(name: string, viewport: { width: number; height: number }, touch: boolean): Promise<void> {
  console.log(`${name} later regions (${viewport.width}×${viewport.height})`);
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const cleared = MAPS.filter((m) => !m.endless && ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova'].includes(m.regionId)).map((m) => m.id)
    .concat(['santalune-forest', 'glittering-cave']);
  await page.addInitScript((ids: string[]) => {
    const results = Object.fromEntries(ids.map((id) => [id, { normal: 3, hard: 0, best: 0 }]));
    localStorage.setItem('pokedefense.save.v1', JSON.stringify({
      results, greeted: ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova'], tutorialDone: true, bp: 500, heldOwned: ['key-stone'],
    }));
  }, cleared);
  await page.goto(URL);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(700);
  check((await page.locator('.modal h2').textContent()) === 'Welcome to Kalos!', 'Professor Sycamore welcomes you to Kalos');
  await page.screenshot({ path: `${OUT}/${name}-11-welcome-kalos.png` });
  await page.getByRole('button', { name: /Thanks, Professor/ }).click();
  check(await page.locator('.tabs.regions button').count() === 6, 'six region tabs');
  const tabInView = await page.locator('.tabs.regions button.on').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth;
  });
  check(tabInView, 'the chosen region’s tab is in view');
  await page.screenshot({ path: `${OUT}/${name}-12-kalos.png` });

  const battles = [
    ['Sinnoh', 'Hearthome City', 'hearthome', '13-sinnoh-fog'],
    ['Unova', 'Striaton City', 'striaton', '14-unova-triplets'],
    ['Kalos', 'Tower of Mastery', 'tower-of-mastery', '15-kalos-mega'],
  ] as const;
  for (const [tab, mapName, id, shot] of battles) {
    await page.locator('.tabs.regions button', { hasText: tab }).click();
    await page.locator('.map-card', { hasText: mapName }).click();
    await page.getByRole('button', { name: /Battle!/ }).click();
    await page.waitForSelector('canvas.map');
    const boss = id !== 'hearthome';
    // Skip ahead to the gym leader's wave, and keep the battle going through it.
    if (boss) await page.evaluate(() => {
      const g = (window as unknown as { __battle: { wave: number; lives: number; map: { waves: number } } }).__battle;
      g.wave = g.map.waves - 1;
      g.lives = 999;
    });
    await page.locator('.wave-btn').click();
    if (boss) {
      // The gym leader comes out after the wave's wild Pokémon.
      await page.waitForFunction(
        (n) => (window as unknown as { __battle: { enemies: { boss: boolean; alive: boolean }[] } }).__battle.enemies.filter((e) => e.boss && e.alive).length >= n,
        id === 'striaton' ? 3 : 1, { timeout: 60_000 },
      ).catch(() => undefined);
      await page.waitForTimeout(1500);
    } else {
      await page.waitForTimeout(4000);
    }
    if (id === 'tower-of-mastery') {
      const mega = await page.evaluate(async () => {
        const g = (window as unknown as { __battle: { enemies: { boss: boolean; hp: number; maxHp: number; dex: number }[] } }).__battle;
        const lucario = g.enemies.find((e) => e.boss);
        if (!lucario) return 0;
        lucario.hp = lucario.maxHp * 0.45;
        await new Promise((r) => setTimeout(r, 900));
        return lucario.dex;
      });
      check(mega === 10059, 'Korrina’s Lucario Mega Evolves at half HP');
    }
    if (id === 'striaton') {
      const bosses = await page.evaluate(() => (window as unknown as { __battle: { enemies: { boss: boolean; alive: boolean }[] } }).__battle.enemies.filter((e) => e.boss && e.alive).length);
      check(bosses === 3, 'the Striaton triplets come out together');
    }
    await page.screenshot({ path: `${OUT}/${name}-${shot}.png` });
    const map = await page.evaluate(() => (window as unknown as { __battle: { map: { id: string } } }).__battle.map.id);
    check(map === id, `${tab}: ${mapName} battle running`);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Give up' }).click();
    await page.waitForSelector('.map-card');
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await laterRegions('phone', { width: 390, height: 844 }, true);
  await laterRegions('desktop', { width: 1440, height: 900 }, false);
  await regions('phone', { width: 390, height: 844 }, true);
  await regions('desktop', { width: 1440, height: 900 }, false);
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
