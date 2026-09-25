// One-off style test: generate a SINGLE illustration for page 1 of "The Spaceman"
// with the FULL STYLE_BIBLE.md text prepended to the image prompt.
//
//   node scripts/test-stylebible-spaceman.mjs
//
// Uses the same Gemini image model the project's renderer uses. Saves to ./.art/.
// This does NOT touch the pipeline — it's a throwaway confirmation of the look.

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { styleBlock } from '../src/agents/imageRenderer.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('No GEMINI_API_KEY in .env — add it and re-run.');
  process.exit(2);
}

// Page 1 of evals/storyteller/.out/spaceman.json
const page = {
  text: 'So the spaceman goes up and up and up and up and up',
  illustration_note:
    'A spaceman rising straight upward, drawn climbing high with five rising motions shown in the sky.',
};

// Use the EXACT production style block (STYLE_BIBLE.md + frame-fill + no-text),
// so this test matches what the real renderer now produces.
const prompt =
  `${styleBlock()}\n\n` +
  `Scene to illustrate (one page of a children's storybook): ${page.illustration_note} ` +
  `Page text (for context only): "${page.text}"`;

console.log(`Model: ${IMAGE_MODEL}`);
console.log('Generating page-1 illustration with STYLE_BIBLE prepended…');

const res = await fetch(`${API}/${IMAGE_MODEL}:generateContent`, {
  method: 'POST',
  headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
});

if (!res.ok) {
  const body = await res.text().catch(() => '');
  console.error(`FAILED — Gemini image ${res.status}: ${body.slice(0, 400)}`);
  if (res.status === 429) {
    console.error('\n→ Free-tier quota (0 images). Enable BILLING on the Google project for this key, then re-run.');
  }
  process.exit(1);
}

const json = await res.json();
const part = (json?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
if (!part) {
  console.error('No image returned. Raw response head:', JSON.stringify(json).slice(0, 400));
  process.exit(1);
}

mkdirSync('.art', { recursive: true });
const out = '.art/spaceman-p1-stylebible.png';
writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'));
console.log(`✓ saved → ${out}`);
