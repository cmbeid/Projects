/**
 * The content gate, for CI and for anyone editing `src/data/`.
 *
 *   npm run validate
 */
import { validate } from '../src/data/validate';
import { EVENTS } from '../src/data/events';
import { STORY } from '../src/data/story';
import { RECIPES } from '../src/data/recipes';
import { GEAR } from '../src/data/gear';
import { LORE } from '../src/data/lore';

const errs = validate();
for (const e of errs) console.error(`✗ ${e}`);
console.log(`${STORY.length} missions, ${EVENTS.length} events, ${RECIPES.length} recipes, ${GEAR.length} gear, ${LORE.length} logs.`);
if (errs.length) {
  console.error(`${errs.length} problem${errs.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('Content OK.');
