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

/**
 * A run far enough along to Relaunch.
 *
 * Seeded through `addInitScript`, so it is in place *before* the app boots.
 * Writing it afterwards and reloading does not work: the outgoing page's
 * `pagehide` flush writes the live state over it on the way out.
 */
const PRESTIGE_SAVE = {
  version: 2,
  seed: 1,
  resources: { ore: '5e8', alloy: '2e5', compute: '1e4' },
  lifetime: { ore: '2e9', alloy: '5e6', compute: '2e5' },
  totals: { ore: '2e9', alloy: '5e6', compute: '2e5' },
  buildings: { probe: 120, drill: 60, sifter: 30, refinery: 40, foundry: 20, lattice: 15, oredepot: 12 },
  upgrades: [],
  automation: ['auto-miner', 'replication'],
  automationOn: { 'auto-miner': true, replication: true },
  milestones: ['first-probe', 'ten-probes', 'first-alloy', 'first-compute'],
  prestige: { schematics: '0e0', schematicsEarned: '0e0', perks: [], directives: [], relaunches: 0 },
  settings: { buyMode: 'max' },
  stats: { playedSeconds: 12_000, runSeconds: 12_000, taps: 60 },
  lastSeen: Date.now(),
};

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

    failures += await verifyPrestige(browser, viewport);
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\nFAILED — ${failures} problem(s).`);
    process.exit(1);
  }
  console.log(`\nOK — screenshots in ${OUT}/`);
}

/**
 * The Relaunch flow, end to end: the payout, the picker's family exclusion, the
 * reset itself, and the tree it opens.
 *
 * Worth driving rather than eyeballing, because it is the one screen in the
 * game that destroys progress — a mis-wired confirmation here costs a player
 * their run, and a screenshot would not catch it.
 */
async function verifyPrestige(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  viewport: { name: string; width: number; height: number },
): Promise<number> {
  let failures = 0;
  const fail = (message: string): void => {
    console.error(`  ✗ ${viewport.name}: ${message}`);
    failures += 1;
  };

  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => fail(`page error: ${error.message}`));

  await page.addInitScript((save) => {
    localStorage.setItem('starseed:save', JSON.stringify(save));
  }, PRESTIGE_SAVE);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  if (!(await page.evaluate(() => document.querySelector('.app')?.classList.contains('has-prestige')))) {
    fail('prestige never revealed on a run that can Relaunch');
  }
  if (viewport.width < 700) {
    await page.click(".tab:has-text('Relaunch')");
    await page.waitForTimeout(200);
  }

  const payout = (await page.textContent('.relaunch-payout'))?.trim() ?? '';
  if (payout.startsWith('0 ')) fail('nothing to Relaunch for');
  await page.screenshot({ path: `${OUT}/${viewport.name}-prestige.png` });

  await page.click('.relaunch-button');
  await page.waitForTimeout(200);
  if (!(await page.isVisible('.modal-sheet'))) fail('the picker did not open');

  // Two clicks inside one family must leave exactly one pick standing.
  const cards = page.locator('.modal-sheet .directive');
  await cards.nth(0).click();
  await cards.nth(1).click();
  await page.waitForTimeout(120);
  const picked = await page.locator('.modal-sheet .directive.is-picked').count();
  if (picked !== 1) fail(`family exclusion let ${picked} directives through`);

  await page.locator('.modal-sheet .directive:not(.is-picked):not(.is-blocked)').first().click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/${viewport.name}-picker.png` });

  await page.click('.relaunch-confirm');
  await page.waitForTimeout(400);
  if (await page.isVisible('.modal-sheet')) fail('the modal stayed open after Relaunch');

  const after = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('starseed:save') ?? '{}') as {
      prestige?: { relaunches?: number; directives?: string[] };
      buildings?: Record<string, number>;
    };
    return {
      relaunches: save.prestige?.relaunches,
      directives: save.prestige?.directives?.length ?? 0,
      buildings: Object.keys(save.buildings ?? {}).length,
    };
  });
  if (after.relaunches !== 1) fail('the Relaunch was not recorded');
  if (after.buildings !== 0) fail('the swarm survived the reset');
  if (after.directives !== 2) fail(`the loadout saved ${after.directives} directives, expected 2`);

  await page.waitForTimeout(300);
  const affordable = await page.locator('.perk.is-affordable').count();
  if (affordable === 0) fail('the Schematics tree opened with nothing buyable');
  else {
    await page.locator('.perk.is-affordable').first().click();
    await page.waitForTimeout(300);
    if ((await page.locator('.perk.is-owned').count()) === 0) fail('buying a perk did nothing');
  }

  console.log(
    `  ${viewport.name.padEnd(6)} relaunch payout=${payout} loadout=${after.directives} ` +
      `tree=${affordable} affordable`,
  );
  await page.screenshot({ path: `${OUT}/${viewport.name}-tree.png` });
  await page.close();
  return failures;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
