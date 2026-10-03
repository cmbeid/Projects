/**
 * The content gate: fails if any recipe, mission or material in `src/data`
 * references something that does not exist or cannot be reached in time.
 */
import { validateData } from '../src/data/validate';

const errors = validateData();
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('Content is consistent.');
