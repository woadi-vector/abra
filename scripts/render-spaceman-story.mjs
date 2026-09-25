// End-to-end render of the FULL "The Spaceman" story through the real character /
// image pipeline, to verify the spaceman stays consistent across every page.
//
//   node scripts/render-spaceman-story.mjs
//
// Uses the REAL agents (no reimplemented prompts):
//   Character Friend (describeCharacters)  → canonical records in the bible's terms,
//                                             stored in the character library (StoryState)
//   Illustrator      (illustrate)          → per-page specs, canonicals injected
//   Renderer         (renderBookImages)    → ONE reference image per character, then
//                                             every page conditioned on those references
//
// The Storyteller half is the already-saved real output (evals/storyteller/.out/
// spaceman.json) so the pages are deterministic; the child's raw transcript is
// passed to Character Friend for context. Writes PNGs + a manifest to .art/spaceman/.

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeCharacters } from '../src/agents/characterFriend.js';
import { illustrate } from '../src/agents/illustrator.js';
import { renderBookImages, hasImageKey } from '../src/agents/imageRenderer.js';
import { createCharacterLibrary } from '../src/characterLibrary.js';
import { makeClient, hasCredentials, DEFAULT_MODEL } from '../evals/lib/anthropic.js';
import { CASES_BY_ID } from '../evals/storyteller/cases.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.art', 'spaceman');

if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env — add it and re-run.'); process.exit(2); }
if (!hasCredentials()) { console.error('No ANTHROPIC_API_KEY in .env — add it and re-run.'); process.exit(2); }

const storybook = JSON.parse(readFileSync(join(ROOT, 'evals/storyteller/.out/spaceman.json'), 'utf8'));
const transcript = CASES_BY_ID.spaceman.transcript;

const client = makeClient();
const model = DEFAULT_MODEL;
const library = createCharacterLibrary(); // StoryState: holds the canonical records

console.log(`Story: "${storybook.title}"  (${storybook.pages.length} pages)`);
console.log(`Model: ${model}\n`);

console.log('1/3  Character Friend — canonical records (bible terms, pinned signature colors)…');
const characters = await describeCharacters(
  { story: transcript, pages: storybook.pages },
  { client, model, library }
);
for (const c of characters) console.log(`   • [${c.id}] ${c.canonical}`);

console.log('\n2/3  Illustrator — per-page specs (canonicals injected)…');
const illustrated = illustrate(storybook.pages, characters);
illustrated.forEach((p, i) =>
  console.log(`   page ${i + 1}: characters = [${(p.illustration.characters || []).join(', ') || '—'}]`)
);

console.log('\n3/3  Renderer — character references, then ref-conditioned pages…');
const book = await renderBookImages(
  { title: storybook.title, characters, pages: illustrated },
  {
    outDir: OUT,
    library,
    onProgress: (e) =>
      e.type === 'character'
        ? console.log(`   ref  ${e.ok ? '✓' : '✗'} ${e.id}${e.refPath ? ' → ' + e.refPath : ''}`)
        : console.log(`   page ${e.ok ? '✓' : '✗'} #${e.index + 1}${e.pagePath ? ' → ' + e.pagePath : ''}`),
  }
);

const manifest = {
  title: book.title,
  model,
  imageModel: book.art?.model,
  characters: book.characters.map((c) => ({ id: c.id, name: c.name, canonical: c.canonical, colors: c.attributes?.colors || [], refPath: c.refPath || null })),
  pages: book.pages.map((p, i) => ({ page: i + 1, text: p.text, characters: p.illustration?.characters || [], pagePath: p.pagePath || null })),
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nDone → ${OUT}\n  refs:  ${book.characters.filter((c) => c.refPath).length}/${book.characters.length}`);
console.log(`  pages: ${book.pages.filter((p) => p.pagePath).length}/${book.pages.length}  (manifest.json written)`);
