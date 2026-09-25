// Offline unit test for the Storyteller tell-CHECKERS. No API calls, no key.
//
//   node evals/storyteller/checks.test.mjs
//
// Verifies, for every case, that the deterministic (`code`) tells:
//   - all PASS on the structure-preserving `good` fixture, and
//   - at least one FAILS on the `bad` fixture (the tidied one).
// If a checker rubber-stamps everything, the `bad` half catches it here.

import { CASES } from './cases.js';
import { FIXTURES } from './fixtures.js';

let failures = 0;
const codeTells = (c) => c.tells.filter((t) => t.type === 'code');

for (const c of CASES) {
  const fx = FIXTURES[c.id];
  if (!fx) {
    console.log(`✗ ${c.name}: no fixture`);
    failures++;
    continue;
  }
  const tells = codeTells(c);

  // good → every code tell passes
  const goodResults = tells.map((t) => ({ name: t.name, ...t.run(fx.good) }));
  const goodBad = goodResults.filter((r) => !r.pass);
  if (goodBad.length) {
    failures++;
    console.log(`✗ ${c.name}: good fixture failed ${goodBad.length} tell(s):`);
    goodBad.forEach((r) => console.log(`    - ${r.name} — ${r.detail}`));
  } else {
    console.log(`✓ ${c.name}: good passes all ${tells.length} code tell(s)`);
  }

  // bad → at least one code tell fails
  const badResults = tells.map((t) => ({ name: t.name, ...t.run(fx.bad) }));
  const badFails = badResults.filter((r) => !r.pass);
  if (badFails.length === 0) {
    failures++;
    console.log(`✗ ${c.name}: bad fixture passed EVERY code tell — checks don't discriminate`);
  } else {
    console.log(`  ↳ bad correctly fails: ${badFails.map((r) => r.name).join('; ')}`);
  }
}

console.log('');
if (failures) {
  console.log(`FAIL — ${failures} checker problem(s).`);
  process.exit(1);
}
console.log('PASS — all Storyteller checkers discriminate good vs. tidied outputs.');
