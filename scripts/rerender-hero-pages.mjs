// Re-render just the PAGES of an already-cached hero story, reusing its saved
// character reference images (so no Anthropic call and no ref regeneration — only
// page images cost). Picks up prompt/renderer changes in renderPage. Also retries
// any page whose image failed on the first pass.
//
//   node scripts/rerender-hero-pages.mjs <key>

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPage, hasImageKey } from '../src/agents/imageRenderer.js';
import { ART_ROOT } from '../server/artStore.mjs';

const key = process.argv[2];
if (!key) { console.error('usage: node scripts/rerender-hero-pages.mjs <key>'); process.exit(1); }
if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env.'); process.exit(2); }

const dir = join(ART_ROOT, key);
const result = JSON.parse(readFileSync(join(dir, 'book.json'), 'utf8'));
const book = result.book;

// Rebuild the ref map from the saved character reference PNGs.
const refsByCharId = {};
for (const c of book.characters || []) {
  try {
    const data = readFileSync(join(dir, `char-${c.id}.png`)).toString('base64');
    refsByCharId[c.id] = { mimeType: 'image/png', data, name: c.name, canonical: c.canonical };
  } catch { /* character had no saved reference */ }
}

const v = Date.now(); // cache-bust so the browser fetches the new images
let ok = 0;
for (let i = 0; i < book.pages.length; i++) {
  const p = book.pages[i];
  const n = String(i + 1).padStart(2, '0');
  try {
    const img = await renderPage(p, refsByCharId);
    if (img) {
      writeFileSync(join(dir, `page-${n}.png`), Buffer.from(img.data, 'base64'));
      p.imageUrl = `/art/${key}/page-${n}.png?v=${v}`;
      ok++;
      console.log(`   page ${i + 1} ✓`);
    } else {
      console.log(`   page ${i + 1} ✗ (no image returned)`);
    }
  } catch (e) {
    console.log(`   page ${i + 1} ✗ ${e.message}`);
  }
}

writeFileSync(join(dir, 'book.json'), JSON.stringify(result));
console.log(`\nDone: ${ok}/${book.pages.length} pages re-rendered → ${dir}`);
