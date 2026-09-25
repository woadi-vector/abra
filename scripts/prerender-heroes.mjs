// Pre-render the hero demo stories (Spaceman + the co-write example) so they hit
// the render cache and load INSTANTLY in the demo — no live Gemini/Anthropic wait
// on camera. Uses the exact payloads the demo submits (demo/examples.json) through
// the same cache path the server uses, so keys match.
//
//   node scripts/prerender-heroes.mjs

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRenderedStory, storyKey } from '../server/artStore.mjs';
import { createParentDashboard } from '../src/parentDashboard.js';
import { createCharacterLibrary } from '../src/characterLibrary.js';
import { hasImageKey } from '../src/agents/imageRenderer.js';
import { makeClient, hasCredentials, DEFAULT_MODEL } from '../evals/lib/anthropic.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = JSON.parse(readFileSync(join(ROOT, 'demo/examples.json'), 'utf8'));

if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env — needed to pre-render art.'); process.exit(2); }
if (!hasCredentials()) { console.error('No ANTHROPIC_API_KEY in .env — needed to run the pipeline.'); process.exit(2); }

const deps = {
  client: makeClient(),
  model: DEFAULT_MODEL,
  dashboard: createParentDashboard(),
  library: createCharacterLibrary(),
};

const heroes = [
  ['Spaceman (single author)', examples.spaceman],
  ['Co-write (Jason + Trenton)', examples.cowrite],
];

for (const [label, payload] of heroes) {
  const key = storyKey(payload);
  console.log(`\n▶ ${label}  [key ${key}]`);
  const t0 = Date.now();
  const { result, cached } = await getRenderedStory(payload, deps);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const pages = result.book?.pages?.length ?? 0;
  const withArt = (result.book?.pages || []).filter((p) => p.imageUrl).length;
  console.log(`   ${cached ? 'already cached ✓' : `rendered + cached ✓ (${secs}s)`} — ${withArt}/${pages} pages have art`);
}

console.log('\nHeroes pre-rendered. They will load instantly in the demo (npm run demo).');
