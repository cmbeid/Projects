/**
 * Data gate. Run with `npm run validate` before committing content changes.
 *
 * Exits non-zero on any integrity or reachability error, so CI can gate a
 * release on it. `npm test` runs the same checks through vitest.
 */
import { CONTENT } from '../src/data/index';
import { validateContent } from '../src/data/validate';

const report = validateContent(CONTENT);
const { stats } = report;

console.log('Starseed — content report');
console.log('----------------------------');
console.log(`Resources   ${stats.resources}`);
console.log(`Buildings   ${stats.buildings}`);
console.log(`Upgrades    ${stats.upgrades}`);
console.log(`Automation  ${stats.automation}`);
console.log(`Milestones  ${stats.milestones}`);
console.log('');
console.log('Buildings by era:');
for (const [era, count] of [...stats.byEra].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${era} │ ${String(count).padStart(3)} ${'#'.repeat(count)}`);
}

if (report.warnings.length > 0) {
  console.log('');
  console.log(`Warnings (${report.warnings.length}):`);
  for (const warning of report.warnings.slice(0, 25)) console.log(`  · ${warning}`);
  if (report.warnings.length > 25) console.log(`  … and ${report.warnings.length - 25} more`);
}

if (report.errors.length > 0) {
  console.error('');
  console.error(`FAILED — ${report.errors.length} error(s):`);
  for (const error of report.errors.slice(0, 60)) console.error(`  ✗ ${error}`);
  if (report.errors.length > 60) console.error(`  … and ${report.errors.length - 60} more`);
  process.exit(1);
}

console.log('');
console.log('OK — every unlock is reachable and the tables are consistent.');
