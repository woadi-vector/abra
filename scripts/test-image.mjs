// Quick check that Gemini image generation works with the key in .env.
// Run AFTER enabling billing on the Google project:
//
//   node scripts/test-image.mjs
//
// Saves a character reference and a page that reuses it (to eyeball quality +
// character consistency) into ./.art/ (gitignored).

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderCharacterRef, renderPage, hasImageKey } from '../src/agents/imageRenderer.js';

if (!hasImageKey()) {
  console.error('No GEMINI_API_KEY in .env — add it and re-run.');
  process.exit(2);
}
mkdirSync('.art', { recursive: true });

const star = {
  id: 'star_mom',
  name: 'The Star (his mom)',
  canonical:
    'A big warm yellow five-pointed star with a gentle smiling face and soft rosy cheeks; she is his mom, both at once.',
};

console.log('1/2  Generating a character reference…');
let ref;
try {
  ref = await renderCharacterRef(star);
} catch (e) {
  console.error('FAILED:', e.message);
  if (String(e.message).includes('429')) {
    console.error('\n→ This is the free-tier quota (0 images). Enable BILLING on the Google project for this key, then re-run.');
  }
  process.exit(1);
}
if (!ref) {
  console.error('No image was returned.');
  process.exit(1);
}
writeFileSync('.art/character.png', Buffer.from(ref.data, 'base64'));
console.log('   ✓ saved → .art/character.png');

console.log('2/2  Generating a page that reuses the reference (consistency test)…');
const page = {
  text: 'and they eat space soup together forever',
  illustration: {
    note: 'The spaceman and the star-mom eating bowls of space soup together, floating in space, spoons up.',
    characters: ['star_mom'],
  },
};
const img = await renderPage(page, { star_mom: ref });
if (img) {
  writeFileSync('.art/page.png', Buffer.from(img.data, 'base64'));
  console.log('   ✓ saved → .art/page.png');
} else {
  console.log('   (no page image returned)');
}

console.log('\nDone. Open .art/character.png and .art/page.png — check the art quality and whether the star looks the same in both.');
