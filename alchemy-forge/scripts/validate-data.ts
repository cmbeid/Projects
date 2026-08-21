/**
 * Data gate. Run with `npm run validate` before committing content changes.
 *
 * Exits non-zero on any integrity or reachability error, so it can also be
 * wired into CI. `npm test` runs the same checks through vitest.
 */
import { ELEMENTS, RECIPES } from '../src/data/index';
import { validateData } from '../src/data/validate';

const report = validateData(ELEMENTS, RECIPES);
const { stats } = report;

console.log('Alchemy Forge — data report');
console.log('---------------------------');
console.log(`Elements       ${stats.elements}`);
console.log(`Recipes        ${stats.recipes}`);
console.log(`Final elements ${stats.finalElements}`);
console.log(`Tame set       ${stats.tameElements} elements / ${stats.tameRecipes} recipes`);
console.log(`Spicy pack     ${stats.spicyElements} elements / ${stats.spicyRecipes} recipes`);
console.log(`Max depth      ${stats.maxDepth}`);
console.log('');
console.log('Elements by depth from air/earth/fire/water:');
for (const [depth, count] of stats.depthHistogram.entries()) {
  const bar = '#'.repeat(Math.round((count / Math.max(...stats.depthHistogram)) * 40));
  console.log(`  ${String(depth).padStart(2)} │ ${String(count).padStart(4)} ${bar}`);
}

if (report.warnings.length > 0) {
  console.log('');
  console.log(`Warnings (${report.warnings.length}):`);
  for (const warning of report.warnings.slice(0, 25)) console.log(`  · ${warning}`);
  if (report.warnings.length > 25) {
    console.log(`  … and ${report.warnings.length - 25} more`);
  }
}

if (report.errors.length > 0) {
  console.error('');
  console.error(`FAILED — ${report.errors.length} error(s):`);
  for (const error of report.errors.slice(0, 60)) console.error(`  ✗ ${error}`);
  if (report.errors.length > 60) {
    console.error(`  … and ${report.errors.length - 60} more`);
  }
  process.exit(1);
}

console.log('');
console.log('OK — every element is reachable and the tables are consistent.');
