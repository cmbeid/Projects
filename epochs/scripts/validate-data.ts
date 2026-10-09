import { validate } from '../src/data/validate';

const problems = validate();
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('Content is sound.');
