// Offline unit test for Guardian's deterministic parts — no API calls, no key.
//
//   node evals/guardian/checks.test.mjs
//
// Covers: the Lane-1 seed-scan fast path (must catch committed terms but NOT
// false-positive on ordinary play), the blocklist config shape, and the parent
// dashboard flag store. The classifier-driven Lane 1/2/3 judgments are exercised
// live in run.mjs.

import { seedScan, DEFAULT_BLOCKLIST, CHILD_REDIRECT } from '../../src/agents/guardian.js';
import { createParentDashboard } from '../../src/parentDashboard.js';

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

// --- seed scan --------------------------------------------------------------
ok(seedScan('the guy said shit and ran')?.category === 'profanity', 'seed-scan catches a committed profanity term');
ok(seedScan('a cowboy with a gun shoots the bad guy') === null, 'seed-scan does NOT block imaginative play (cowboy with a gun)');
ok(seedScan('the knight fights a scary dragon') === null, 'seed-scan does NOT block a scary dragon');
ok(seedScan('we went to the shell shop by the well') === null, 'seed-scan is whole-word (no "shell"/"well" false-positive)');
ok(CHILD_REDIRECT && !/shit|fuck/i.test(CHILD_REDIRECT), 'child redirect never echoes a flagged word');

// --- config shape -----------------------------------------------------------
const hb = DEFAULT_BLOCKLIST.hard_block;
const CATS = ['profanity', 'sexual', 'graphic_violence', 'slurs', 'self_harm_methods'];
ok(CATS.every((c) => Array.isArray(hb[c])), 'blocklist has all 5 hard_block categories as arrays');
const sig = DEFAULT_BLOCKLIST.flag_to_parent_signals;
ok(['distress', 'harm_indicators', 'unsafe_situation'].every((s) => Array.isArray(sig[s])), 'blocklist has all 3 Lane-2 signal groups');
ok(typeof DEFAULT_BLOCKLIST.version === 'number', 'blocklist is versioned');

// --- parent dashboard -------------------------------------------------------
let n = 0;
const dash = createParentDashboard({ now: () => `t${++n}` });
dash.clear();
const rec = dash.addFlag({ storyText: 'the boy is home alone all night', signals: ['unsafe_situation'], passage: 'home alone all night', note: 'This story mentioned being home alone at night.' });
ok(dash.listFlags().length === 1, 'dashboard stores a flag');
ok(rec.reviewed === false && rec.note.startsWith('This story mentioned'), 'flag note is descriptive, starts un-reviewed');
dash.markReviewed(rec.id);
ok(dash.listFlags()[0].reviewed === true, 'dashboard can mark a flag reviewed');
dash.clear();
ok(dash.listFlags().length === 0, 'dashboard clears');

console.log('');
if (failures) {
  console.log(`FAIL — ${failures} Guardian offline check(s) failed.`);
  process.exit(1);
}
console.log('PASS — Guardian seed-scan, config, and dashboard all sound.');
