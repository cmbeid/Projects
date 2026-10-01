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
  battle(dex: number, level: number): unknown;
  tap(x: number, y: number): void;
  challenge(id: string): void;
  warp(map: string, x: number, y: number): void;
  sync(): void;
  world: {
    map: string;
    mons: { level: number; hp: number }[];
    battle: { wild: { hp: number } } | null;
    pendingPerks: { skill: string; level: number }[];
    farm: number[];
    day: number;
    inventory: Record<string, number>;
    machines: Record<string, { output: string | null; id?: string }>;
    barn: { trough: Record<string, number> };
    weather: string;
    greenhouse: boolean;
    story: { chapter: number; flags: string[] };
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

/** Click through any dialogue showing. */
async function dismissTalk(page: Page): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(150);
    const talk = page.locator('.talk');
    if (!(await talk.count())) return;
    await talk.click();
  }
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
  const music = new Set<string>();
  page.on('response', (r) => { if (r.url().includes('/music/') && r.ok()) music.add(r.url().split('/music/')[1]!); });
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
  // The Mayor's letter: the story begins.
  await page.waitForSelector('.talk', { timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-3b-story.png` });
  await dismissTalk(page);
  check(await page.locator('.tracker').isVisible(), 'the quest tracker shows the first goal');
  await page.waitForTimeout(300);
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
  await page.locator('.btn.primary', { hasText: 'Sleep' }).click({ timeout: 10_000 });
  await page.waitForSelector('text=Start the day');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-6-morning.png` });
  await page.getByRole('button', { name: 'Start the day' }).click();

  // The Mart by the gate.
  await page.evaluate(() => Object.assign((window as unknown as { __farm: Hook }).__farm.world.player, { x: 12, y: 28, path: [] }));
  await page.waitForTimeout(700);
  await tap(page, 13, 29, touch);
  await page.waitForSelector('.sheet h2:has-text("Poké Mart")', { timeout: 10_000 });
  await page.waitForTimeout(400);
  await fits(page, 'mart');
  await page.screenshot({ path: `${OUT}/${name}-7-mart.png` });
  await page.locator('.sheet .row').first().getByRole('button', { name: '×1' }).click();
  await page.locator('.close').click();

  // Out of the gate to Route 1.
  await page.evaluate(() => Object.assign((window as unknown as { __farm: Hook }).__farm.world.player, { x: 11, y: 30, path: [] }));
  await page.waitForTimeout(500);
  // The gate is the map's last row, under the hotbar on a phone: tap it through the game.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(11, 31));
  await page.waitForFunction(() => (window as unknown as { __farm: Hook }).__farm.world.map === 'route1', undefined, { timeout: 10_000 });
  await page.waitForTimeout(900);
  await fits(page, 'Route 1');
  await page.screenshot({ path: `${OUT}/${name}-8-route.png` });

  // A wild Rattata: one attack, then weaken it and throw balls until it's ours (or they run out).
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.battle(19, 3));
  await page.waitForSelector('.cmd.fight', { timeout: 15_000 });
  await fits(page, 'battle');
  await onScreen(page, '.poke-card.wild', 'wild HP card');
  await onScreen(page, '.poke-card.you', 'your HP card');
  await onScreen(page, '.commands', 'battle commands');
  await page.screenshot({ path: `${OUT}/${name}-9-battle.png` });
  await page.locator('.cmd.fight').click();
  await page.locator('.cmd.move').first().click();
  await page.waitForSelector('.cmd.fight, .cmd.primary', { timeout: 20_000 });
  for (let i = 0; i < 6; i += 1) {
    if (await page.locator('.cmd.primary').count()) break;
    await page.evaluate(() => { const b = (window as unknown as { __farm: Hook }).__farm.world.battle; if (b) b.wild.hp = 1; });
    await page.locator('.cmd.bag').click();
    await page.locator('.cmd.item', { hasText: 'Poké Ball' }).click();
    await page.waitForSelector('.cmd.fight, .cmd.primary', { timeout: 20_000 });
  }
  await page.screenshot({ path: `${OUT}/${name}-10-caught.png` });
  const caught = await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.mons.length);
  check(caught === 2, `befriended the wild Rattata (${caught} Pokémon)`);
  await page.locator('.cmd.primary', { hasText: 'Continue' }).click();
  await page.waitForSelector('.battle', { state: 'detached' });

  // The Pokémon tab.
  await page.locator('.icon-btn.bag').click();
  await page.getByRole('button', { name: 'Pokémon', exact: true }).click();
  await page.waitForSelector('.mon-card');
  await page.waitForTimeout(400);
  check(await page.locator('.mon-card').count() === 2, 'both Pokémon are in the party');
  await page.screenshot({ path: `${OUT}/${name}-11-pokemon.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // The blacksmith, back on the farm.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('farm', 16, 28));
  await page.waitForTimeout(700);
  await tap(page, 16, 29, touch);
  await page.waitForSelector('text=Blacksmith', { timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-12-smith.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // A perk to pick.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.pendingPerks.push({ skill: 'farming', level: 5 }));
  await page.waitForSelector('.perk-choice', { timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-13-perk.png` });
  await page.locator('.perk-choice').first().click();

  // Send the Rattata to live on the farm.
  await page.locator('.icon-btn.bag').click();
  await page.getByRole('button', { name: 'Pokémon', exact: true }).click();
  await page.locator('.mon-card').nth(1).locator('.seg', { hasText: 'Farm' }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.farm.length) === 1, 'sent a Pokémon to live on the farm');
  await page.screenshot({ path: `${OUT}/${name}-14-roles.png` });

  // Craft a Berry Press.
  await page.evaluate(() => {
    const f = (window as unknown as { __farm: Hook }).__farm;
    Object.assign(f.world.inventory, { 'hard-stone': 4, oran: 12 });
    // Machines are crafted at a Workbench on the farm.
    f.world.machines['20,24'] = { id: 'workbench', output: null, count: 0, progress: 0, needed: 0 } as { output: string | null };
  });
  await page.getByRole('button', { name: 'Craft', exact: true }).click();
  await page.locator('.row', { hasText: 'Berry Press' }).getByRole('button', { name: 'Craft' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}-15-craft.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // The barn: put berries in the trough.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('farm', 19, 13));
  await page.waitForTimeout(700);
  await tap(page, 19, 11, touch);
  await page.waitForSelector('.sheet h2:has-text("Shed")', { timeout: 10_000 });
  await page.locator('.row', { hasText: 'Oran Berry' }).getByRole('button', { name: '+5' }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.barn.trough.oran) === 5, 'filled the trough');
  await fits(page, 'barn');
  await page.screenshot({ path: `${OUT}/${name}-16-barn.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // Place the press and load it.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('farm', 14, 14));
  await page.waitForTimeout(600);
  await hold(page, 'Berry Press');
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(15, 14));
  await settle(page);
  check(await page.evaluate(() => Boolean((window as unknown as { __farm: Hook }).__farm.world.machines['15,14'])), 'placed the Berry Press');
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(15, 14));
  await page.waitForSelector('.sheet h2:has-text("Berry Press")', { timeout: 10_000 });
  await page.locator('.row', { hasText: 'Oran Berry' }).getByRole('button', { name: 'Load' }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.machines['15,14']?.output === 'oran-juice'), 'loaded the press with an Oran Berry');
  await page.locator('.close').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}-17-press.png` });

  // The request board.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('farm', 10, 5));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(10, 4));
  await page.waitForSelector('.sheet h2:has-text("Request board")', { timeout: 10_000 });
  check(await page.locator('.sheet .row').count() === 3, 'three requests on the board');
  await page.screenshot({ path: `${OUT}/${name}-18-board.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // The Seed Box: stock it, pick a seed, and watch a Diglett plant from it.
  await page.evaluate(() => {
    const f = (window as unknown as { __farm: Hook }).__farm;
    const w = f.world as unknown as {
      mons: { uid: number; dex: number }[]; farm: number[]; nextUid: number; inventory: Record<string, number>;
      plots: Record<string, unknown>; field: string[]; helpers: { uid: number; x: number; y: number; cooldown: number }[]; clock: number;
    };
    const uid = w.nextUid++;
    w.mons.push({ ...w.mons[0]!, uid, dex: 50 });
    w.farm.push(uid);
    w.inventory['cheri-seed'] = 5;
    w.plots['14,6'] = { watered: false, crop: null };
    w.field.push('14,6');
    w.clock = 9 * 60;
    f.sync();
    const h = w.helpers.find((x) => x.uid === uid)!;
    Object.assign(h, { x: 13, y: 5, cooldown: 0 });
    f.warp('farm', 12, 5);
  });
  await page.waitForTimeout(600);
  await tap(page, 12, 4, touch);
  await page.waitForSelector('.sheet h2:has-text("Seed Box")', { timeout: 10_000 });
  await page.locator('.row', { hasText: 'Cheri Seeds' }).getByRole('button', { name: '+5' }).click();
  await page.waitForTimeout(300);
  await page.locator('.sheet').getByRole('button', { name: 'Cheri', exact: true }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => {
    const w = (window as unknown as { __farm: { world: { seedBox: Record<string, number>; seedChoice: string } } }).__farm.world;
    return w.seedBox['cheri-seed'] === 5 && w.seedChoice === 'cheri-seed';
  }), 'stocked the Seed Box and chose Cheri');
  await fits(page, 'seed box');
  await page.screenshot({ path: `${OUT}/${name}-18b-seedbox.png` });
  await page.locator('.close').click();
  await page.waitForFunction(() => {
    const w = (window as unknown as { __farm: { world: { plots: Record<string, { crop: { id: string } | null }> } } }).__farm.world;
    return w.plots['14,6']?.crop?.id === 'cheri';
  }, undefined, { timeout: 20_000 });
  check(await page.evaluate(() => (window as unknown as { __farm: { world: { seedBox: Record<string, number> } } }).__farm.world.seedBox['cheri-seed'] === 4), 'a Diglett planted a Cheri seed from the box');
  check(await page.evaluate(() => {
    const w = (window as unknown as { __farm: { world: { mons: { dex: number; level: number; xp: number }[] } } }).__farm.world;
    const d = w.mons.find((m) => m.dex === 50)!;
    return d.xp > d.level ** 3;
  }), 'the Diglett earned XP for planting');
  await page.screenshot({ path: `${OUT}/${name}-18c-sown.png` });

  // The bench: sit, watch time fly, and tap to get up.
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('farm', 6, 7));
  await page.waitForTimeout(500);
  await tap(page, 6, 6, touch);
  await page.waitForSelector('.resting:not([hidden])', { timeout: 10_000 });
  const sat = await page.evaluate(() => (window as unknown as { __farm: { world: { clock: number } } }).__farm.world.clock);
  await page.waitForTimeout(2100);
  const later = await page.evaluate(() => (window as unknown as { __farm: { world: { clock: number } } }).__farm.world.clock);
  check(later - sat > 12, `time runs faster on the bench (${(later - sat).toFixed(0)} min in 2s)`);
  await page.screenshot({ path: `${OUT}/${name}-18d-bench.png` });
  await tap(page, 8, 10, touch);
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (window as unknown as { __farm: { world: { player: { seat: unknown } } } }).__farm.world.player.seat === null), 'a tap gets you up off the bench');

  // The merchant, on a Saturday.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.world.day = 6; f.warp('farm', 14, 26); });
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(14, 27));
  await page.waitForSelector('.sheet h2:has-text("Travelling merchant")', { timeout: 10_000 });
  check(await page.locator('.sheet .row').count() === 4, 'the merchant has four things for sale');
  await page.screenshot({ path: `${OUT}/${name}-19-merchant.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // Phase 5. The d-pad, on touch screens.
  if (touch) {
    check(await page.locator('.dpad').isVisible(), 'the d-pad shows on a touch screen');
    await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.warp('farm', 8, 14); });
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.player.x);
    const right = (await page.locator('.dpad-btn.right').boundingBox())!;
    await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.player.x);
    check(after > before, `walked right with the d-pad (${before} → ${after})`);
    await page.screenshot({ path: `${OUT}/${name}-23-dpad.png` });
    // Move it.
    await page.locator('.icon-btn.menu').click();
    await page.getByRole('button', { name: 'Move d-pad' }).click();
    const box = (await page.locator('.dpad').boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height - 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + box.height - 160, { steps: 6 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Done' }).click();
    const moved = (await page.locator('.dpad').boundingBox())!;
    check(Math.abs(moved.x - box.x) > 50, 'dragged the d-pad somewhere new');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokeharvest.settings.v1') ?? '{}').dpad?.x);
    check(typeof saved === 'number' && saved > 5, 'saved the d-pad position');
  }

  // Cobblevale: the Pokémon Center and the Mayor's Hall.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.world.story.flags.push('road-open', 'center-open', 'pass-open'); f.warp('town', 4, 6); });
  await page.waitForTimeout(500);
  await dismissTalk(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}-24-town.png` });
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(4, 4));
  await page.waitForSelector('.sheet h2:has-text("Pokémon Center")', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Heal my Pokémon' }).click();
  await dismissTalk(page);
  check(await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.mons.every((m) => m.hp > 0)), 'healed at the Pokémon Center');
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.warp('town', 18, 6); });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(18, 4));
  await page.waitForSelector(".sheet h2:has-text(\"Mayor's Hall\")", { timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-25-hall.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // Whisperwood: a trainer battle, and an Apricorn.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.warp('route2', 1, 13); f.world.mons[0]!.level = 50; f.world.mons[0]!.hp = 400; });
  await page.waitForTimeout(600);
  await dismissTalk(page);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.challenge('wade'));
  await page.waitForSelector('.talk', { timeout: 5_000 });
  await dismissTalk(page);
  await page.waitForSelector('.cmd.fight', { timeout: 15_000 });
  check(await page.locator('.pips .pip').count() === 3, 'the trainer\'s team shows as three balls');
  await page.screenshot({ path: `${OUT}/${name}-26-trainer.png` });
  for (let i = 0; i < 12; i += 1) {
    if (await page.locator('.cmd.primary', { hasText: 'Continue' }).count()) break;
    await page.locator('.cmd.fight').click();
    await page.locator('.cmd.move').first().click();
    await page.waitForSelector('.cmd.fight, .cmd.primary', { timeout: 30_000 });
  }
  await page.locator('.cmd.primary', { hasText: 'Continue' }).click();
  await page.waitForSelector('.battle', { state: 'detached' });
  check(await page.evaluate(() => Boolean((window as unknown as { __farm: { world: { trainers: Record<string, unknown> } } }).__farm.world.trainers['wade'])), 'beat Bug Catcher Wade');
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.warp('route2', 3, 7));
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(3, 6));
  await settle(page);
  check(await page.evaluate(() => (window as unknown as { __farm: { world: { stats: { apricorns: number } } } }).__farm.world.stats.apricorns > 0), 'picked an Apricorn');
  await page.screenshot({ path: `${OUT}/${name}-27-forest.png` });

  // Granite Pass: mine some ore.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.warp('route3', 4, 2); });
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(5, 2));
  await settle(page);
  await page.waitForTimeout(300);
  check(await page.evaluate(() => { const inv = (window as unknown as { __farm: Hook }).__farm.world.inventory; return (inv['copper-ore'] ?? 0) + (inv['iron-ore'] ?? 0) + (inv.nugget ?? 0) > 0; }), 'mined ore in Granite Pass');
  await page.screenshot({ path: `${OUT}/${name}-28-cave.png` });
  if (await page.locator('.battle').count()) {
    await page.evaluate(() => { const f = (window as unknown as { __farm: { world: { battle: unknown } } }).__farm; f.world.battle = null; });
  }

  // A Furnace on the farm.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; Object.assign(f.world.inventory, { furnace: 1, 'iron-ore': 5, wood: 2 }); f.warp('farm', 6, 26); });
  await page.waitForTimeout(600);
  await hold(page, 'Furnace');
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(7, 26));
  await settle(page);
  await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.tap(7, 26));
  await page.waitForSelector('.sheet h2:has-text("Furnace")', { timeout: 10_000 });
  await page.locator('.row', { hasText: 'Iron Ore' }).getByRole('button', { name: 'Load' }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => (window as unknown as { __farm: Hook }).__farm.world.machines['7,26']?.output === 'iron-bar'), 'loaded the Furnace with iron ore');
  await page.screenshot({ path: `${OUT}/${name}-29-furnace.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // The journal.
  await page.locator('.tracker').click();
  await page.waitForSelector('.sheet h2:has-text("Journal")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-30-journal.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  // Weather and seasons.
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.world.weather = 'rain'; f.warp('farm', 8, 14); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}-20-rain.png` });
  await page.evaluate(() => { const f = (window as unknown as { __farm: Hook }).__farm; f.world.day = 90; f.world.weather = 'snow'; f.world.greenhouse = true; f.warp('farm', 17, 24); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}-21-winter.png` });
  check(await page.locator('.hud-day', { hasText: 'Winter' }).count() === 1, 'the HUD shows winter');

  // The Pokédex.
  await page.locator('.icon-btn.menu').click();
  await page.getByRole('button', { name: 'Pokédex' }).click();
  await page.waitForSelector('.dex-grid');
  await page.locator('.dex-cell.caught').first().click();
  await page.waitForSelector('.dex-detail');
  await page.waitForTimeout(400);
  const cells = await page.locator('.dex-cell').count();
  check(cells >= 60, `the Pokédex lists every species (${cells})`);
  await fits(page, 'Pokédex');
  await page.screenshot({ path: `${OUT}/${name}-22-dex.png` });
  await page.locator('.close').click();
  await page.waitForTimeout(250);

  check(music.size >= 3, `music loaded (${[...music].join(', ')})`);

  const heard = await page.evaluate(() => (window as unknown as { __sounds: number }).__sounds);
  check(heard > 0, `sound played (${heard} sounds)`);

  await page.reload();
  await page.waitForSelector('.title');
  check(await page.getByRole('button', { name: /Continue · Day \d/ }).isVisible(), 'the farm was saved');
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
