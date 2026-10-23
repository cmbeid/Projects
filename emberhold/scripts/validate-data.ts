/**
 * The content gate: fails if any recipe, drop, quest or icon in `src/data`
 * references something that does not exist or cannot be got.
 */
import { validateData } from '../src/data/validate';
import { TEMPLATE_NAMES } from '../src/sprites/defs';

const errors = validateData(new Set(TEMPLATE_NAMES));
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('Content is consistent.');
