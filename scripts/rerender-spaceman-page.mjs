// Re-render ONE page of "The Spaceman" using the ALREADY-SAVED character
// references, via the real renderPage. Isolates prompt/renderer changes without
// regenerating references or the other pages.
//
//   node scripts/rerender-spaceman-page.mjs [pageNumber]   (default 2)

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, hasImageKey } from '../src/agents/imageRenderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.art', 'spaceman');
const pageNum = Number(process.argv[2] || 2);

if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env — add it and re-run.'); process.exit(2); }

const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
const story = JSON.parse(readFileSync(join(ROOT, 'evals/storyteller/.out/spaceman.json'), 'utf8'));
const pageMani = manifest.pages.find((p) => p.page === pageNum);
const storyPage = story.pages[pageNum - 1];
if (!pageMani || !storyPage) { console.error(`Page ${pageNum} not found.`); process.exit(1); }

const charById = Object.fromEntries(manifest.characters.map((c) => [c.id, c]));
const refsByCharId = {};
for (const id of pageMani.characters) {
  const c = charById[id];
  if (!c?.refPath) continue;
  refsByCharId[id] = {
    mimeType: 'image/png',
    data: readFileSync(c.refPath).toString('base64'),
    name: c.name,
    canonical: c.canonical,
  };
}

const page = {
  text: storyPage.text,
  illustration: { note: storyPage.illustration_note, characters: pageMani.characters },
};

console.log(`Re-rendering page ${pageNum} with saved refs: [${Object.keys(refsByCharId).join(', ')}]`);
console.log(`Note: ${storyPage.illustration_note}`);
const img = await renderPage(page, refsByCharId);
if (!img) { console.error('No image returned.'); process.exit(1); }
const out = join(OUT, `page-${String(pageNum).padStart(2, '0')}.png`);
writeFileSync(out, Buffer.from(img.data, 'base64'));
console.log(`✓ saved → ${out}`);
