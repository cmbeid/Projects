/**
 * End-to-end check of the real built game in a real browser.
 *
 * Runs at both of a Pixel Fold's screen sizes and, critically, resizes the
 * viewport between them inside one page session — which is what folding
 * actually does. Screenshots land in `screenshots/`.
 *
 * Usage: npm run build && npm run preview &  then  npm run verify
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const BASE_URL = process.env['VERIFY_URL'] ?? 'http://localhost:4173/';

/**
 * Prefer a Chromium that is already on the machine. Sandboxes often ship one
 * whose build number does not match the installed Playwright, and downloading
 * another is both slow and frequently blocked.
 */
function chromiumPath(): string | undefined {
  const candidates = [
    process.env['CHROMIUM_PATH'],
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter((path): path is string => typeof path === 'string');
  return candidates.find((path) => existsSync(path));
}
const SHOTS = 'screenshots';

/** Pixel Fold, roughly: narrow tall cover screen and squarish inner screen. */
const COVER = { width: 412, height: 892 };
const INNER = { width: 840, height: 740 };

const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

/** Drags one board token onto another by their centres. */
async function dragToken(page: Page, fromLabel: string, toLabel: string): Promise<void> {
  const from = page.locator(`.token[aria-label="${fromLabel}"]`).first();
  const to = page.locator(`.token[aria-label="${toLabel}"]`).first();

  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error(`Cannot locate tokens ${fromLabel} / ${toLabel}`);

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // Several steps: the gesture recogniser needs movement past its threshold,
  // and a single jump reads as a teleport rather than a drag.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function spawn(page: Page, name: string): Promise<void> {
  await page.locator(`.inv-item[data-element-id="${name}"]`).first().click();
  await page.waitForTimeout(120);
}

async function main(): Promise<void> {
  await mkdir(SHOTS, { recursive: true });

  const executablePath = chromiumPath();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: COVER, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  // ---------------------------------------------------------------- compact
  console.log('\nCover screen (412 × 892)');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.inv-item');

  check('starts with the four base elements', (await page.locator('.inv-item').count()) === 4);
  check(
    'progress counter reads 4 of the full tree',
    (await page.locator('#progress').innerText()).startsWith('4 / '),
  );
  check('uses the drawer layout', (await page.locator('html').getAttribute('data-layout')) === 'compact');

  await spawn(page, 'fire');
  await spawn(page, 'water');
  check('two tokens on the board', (await page.locator('.token').count()) === 2);

  await dragToken(page, 'Fire', 'Water');

  const steamExists = (await page.locator('.token[aria-label="Steam"]').count()) === 1;
  check('fire + water produced Steam', steamExists);
  check('both source tokens were consumed', (await page.locator('.token').count()) === 1);
  check(
    'counter incremented to 5',
    (await page.locator('#progress').innerText()).startsWith('5 / '),
  );
  check('Steam appears in the inventory', (await page.locator('.inv-item[data-element-id="steam"]').count()) === 1);

  await page.screenshot({ path: `${SHOTS}/01-cover-board.png` });

  // Drawer + search
  await page.locator('#drawer-handle').click();
  await page.waitForTimeout(300);
  await page.locator('#search-input').fill('ste');
  await page.waitForTimeout(150);
  check('search filters the list to one match', (await page.locator('.inv-item').count()) === 1);
  await page.screenshot({ path: `${SHOTS}/02-cover-drawer-search.png` });
  await page.locator('#search-input').fill('');
  await page.waitForTimeout(150);

  // Detail modal, via long press on a board token.
  const steam = page.locator('.token[aria-label="Steam"]').first();
  const steamBox = await steam.boundingBox();
  if (steamBox) {
    await page.mouse.move(steamBox.x + steamBox.width / 2, steamBox.y + steamBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  check('long press opens the detail modal', await page.locator('.modal[open]').isVisible());
  check(
    'detail modal shows the discovered recipe',
    (await page.locator('.recipe').first().innerText()).toLowerCase().includes('fire'),
  );
  await page.screenshot({ path: `${SHOTS}/03-cover-detail.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Hint
  await page.locator('.control[aria-label="Get a hint"]').click();
  await page.waitForTimeout(250);
  check('hint offers a pair', (await page.locator('.hint-chip').count()) === 2);
  const hintChips = await page.locator('.hint-chip').allInnerTexts();
  check('hint uses only discovered elements', !hintChips.some((text) => text.includes('???')));
  await page.screenshot({ path: `${SHOTS}/04-cover-hint.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Persistence
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.inv-item');
  check(
    'discoveries survive a reload',
    (await page.locator('#progress').innerText()).startsWith('5 / '),
  );
  check('the board survives a reload', (await page.locator('.token').count()) === 1);

  // ---------------------------------------------------------------- the fold
  console.log('\nFolding open (412 → 840) inside one page session');

  // Put a token near the right edge while wide, then narrow the viewport.
  await page.setViewportSize(INNER);
  await page.waitForTimeout(400);
  check('switched to the sidebar layout', (await page.locator('html').getAttribute('data-layout')) === 'expanded');
  check('sidebar is visible without opening a drawer', await page.locator('#search-input').isVisible());

  await spawn(page, 'earth');
  const board = await page.locator('#board').boundingBox();
  const anyToken = page.locator('.token').last();
  const tokenBox = await anyToken.boundingBox();
  if (board && tokenBox) {
    // Drag it hard against the right edge of the wide board.
    await page.mouse.move(tokenBox.x + tokenBox.width / 2, tokenBox.y + tokenBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width - 20, board.y + board.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${SHOTS}/05-inner-sidebar.png` });

  const wideCount = await page.locator('.token').count();

  console.log('\nFolding shut (840 → 412) inside the same page session');
  await page.setViewportSize(COVER);
  await page.waitForTimeout(400);

  check('back to the drawer layout', (await page.locator('html').getAttribute('data-layout')) === 'compact');
  check('no tokens were lost across the fold', (await page.locator('.token').count()) === wideCount);

  const foldedBoard = await page.locator('#board').boundingBox();
  const boxes = await page.locator('.token').evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect()).map((r) => ({
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
    })),
  );
  const outside = foldedBoard
    ? boxes.filter(
        (box) =>
          box.left < foldedBoard.x - 1 ||
          box.right > foldedBoard.x + foldedBoard.width + 1 ||
          box.bottom > foldedBoard.y + foldedBoard.height + 1,
      )
    : [];
  check(
    'every token is still fully on the board after folding shut',
    outside.length === 0,
    `${outside.length} token(s) off-screen`,
  );
  await page.screenshot({ path: `${SHOTS}/06-cover-after-fold.png` });

  // ------------------------------------------------------------------ misc
  console.log('\nGeneral');
  await page.locator('.control[aria-label="Clear the workspace"]').click();
  await page.waitForTimeout(250);
  check('clear empties the board', (await page.locator('.token').count()) === 0);
  check(
    'clear does not touch discoveries',
    (await page.locator('#progress').innerText()).startsWith('5 / '),
  );

  await page.locator('.control[aria-label="Open the encyclopedia"]').click();
  await page.waitForTimeout(250);
  check('encyclopedia lists discoveries', (await page.locator('.encyclopedia-grid .inv-item').count()) === 5);
  await page.screenshot({ path: `${SHOTS}/07-encyclopedia.png` });
  await page.keyboard.press('Escape');

  // --------------------------------------------------------------- offline
  console.log('\nOffline');
  // The service worker registers after load; give it a moment to take control
  // and finish precaching before pulling the network away.
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  check('a service worker is active', swReady);

  if (swReady) {
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.inv-item', { timeout: 10_000 }).catch(() => {});
    check('the game still boots with no network', (await page.locator('.inv-item').count()) > 0);
    check(
      'progress is intact offline',
      (await page.locator('#progress').innerText()).startsWith('5 / '),
    );
    await page.screenshot({ path: `${SHOTS}/08-offline.png` });
    await context.setOffline(false);
  }

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await browser.close();

  console.log('');
  if (failures.length > 0) {
    console.error(`FAILED — ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(`All checks passed. Screenshots in ${SHOTS}/`);
}

await main();
