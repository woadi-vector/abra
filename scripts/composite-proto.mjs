// Prototype the TRUE-LOCK compositing on a couple of Spaceman pages:
// matte the spaceman reference into a transparent cut-out, generate a
// character-free background per page, composite the SAME cut-out on top.
//
//   node scripts/composite-proto.mjs
//
// Output → .art/proto/ (composited pages + the cut-out, for eyeballing).

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderBackground, hasImageKey } from '../src/agents/imageRenderer.js';
import { readPNG, cutout, trim, place, writePNG, fromBase64 } from '../src/agents/compositor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERO = join(ROOT, '.art', 'served', '2bdbcb5d0117da28');
const OUT = join(ROOT, '.art', 'proto');
mkdirSync(OUT, { recursive: true });

if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env.'); process.exit(2); }

const book = JSON.parse(readFileSync(join(HERO, 'book.json'), 'utf8')).book;
const charById = Object.fromEntries(book.characters.map((c) => [c.id, c]));

// 1) Hero cut-out (matted once, reused on every page → pixel-identical)
console.log('Matting the spaceman reference into a transparent cut-out…');
const heroCut = trim(cutout(readPNG(readFileSync(join(HERO, 'char-spaceman.png')))));
writeFileSync(join(OUT, 'cutout-spaceman.png'), writePNG(heroCut));
console.log(`   cut-out ${heroCut.width}x${heroCut.height} → .art/proto/cutout-spaceman.png`);

const OMIT = ['the spaceman', 'the astronaut', 'any astronaut or boy'];

// helper: read a saved secondary-character ref for background conditioning
const secondaryRef = (id) => {
  try {
    const c = charById[id];
    return { mimeType: 'image/png', data: readFileSync(join(HERO, `char-${id}.png`)).toString('base64'), name: c.name, canonical: c.canonical };
  } catch { return null; }
};

// Page 1 (rising): background = vertical sky column + motion, no character.
// Page 6 (soup): background keeps the star-mom + soup bowl, hero placed at left.
const jobs = [
  { n: 1, page: book.pages[0], keep: [], scale: 0.6, anchorX: 0.5, anchorY: 0.52 },
  {
    n: 6,
    page: book.pages[5],
    keep: ['star_mom', 'space_soup'],
    scale: 0.5, anchorX: 0.3, anchorY: 0.5,
  },
];

for (const j of jobs) {
  console.log(`\nPage ${j.n}: generating character-free background…`);
  const refsByCharId = {};
  for (const id of j.keep) { const r = secondaryRef(id); if (r) refsByCharId[id] = r; }
  const bgImg = await renderBackground(j.page, { omitNames: OMIT, refsByCharId });
  if (!bgImg) { console.log(`   ✗ background failed`); continue; }
  writeFileSync(join(OUT, `bg-page-${String(j.n).padStart(2, '0')}.png`), Buffer.from(bgImg.data, 'base64'));
  const bg = fromBase64(bgImg.data);
  const composed = place(bg, heroCut, { scale: j.scale, anchorX: j.anchorX, anchorY: j.anchorY });
  const outPath = join(OUT, `page-${String(j.n).padStart(2, '0')}-composite.png`);
  writeFileSync(outPath, writePNG(composed));
  console.log(`   ✓ composited → ${outPath}`);
}

console.log('\nProto done → .art/proto/  (compare page-01/06-composite.png; the spaceman is identical in both)');
