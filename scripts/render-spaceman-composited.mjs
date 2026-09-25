// Full composited render of the Spaceman story with the WHOLE CAST locked.
//   - Hero (spaceman): a small approved POSE SET, best-fit pose per page.
//   - Secondary actors (star-mom, plane, birds): ONE locked cut-out each, reused.
//   - Pure scenery (clouds, soup) stays in the generated background.
// Each page = a character-free background + the present cast composited via a
// per-count slot layout. All source art (hero ref, poses, secondary cut-outs,
// backgrounds) is CACHED on disk so re-runs are cheap; placement tweaks cost $0.
//
//   node scripts/render-spaceman-composited.mjs            # reuse cached art
//   node scripts/render-spaceman-composited.mjs --fresh-bg # regenerate backgrounds
//   node scripts/render-spaceman-composited.mjs --fresh    # regenerate everything

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCharacterRef, renderCharacterPose, renderBackground, hasImageKey } from '../src/agents/imageRenderer.js';
import { matteBySampledBg, trim, place, writePNG, fromBase64 } from '../src/agents/compositor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = '2bdbcb5d0117da28';
const DIR = join(ROOT, '.art', 'served', KEY);
const CACHE = join(DIR, 'compose');
mkdirSync(CACHE, { recursive: true });

const FRESH = process.argv.includes('--fresh');
const FRESH_BG = FRESH || process.argv.includes('--fresh-bg');
if (!hasImageKey()) { console.error('No GEMINI_API_KEY in .env.'); process.exit(2); }

const result = JSON.parse(readFileSync(join(DIR, 'book.json'), 'utf8'));
const book = result.book;
const HERO = 'spaceman';
const AMBIENT = new Set(['clouds', 'space_soup']); // stays in the background, not composited
const charById = Object.fromEntries(book.characters.map((c) => [c.id, c]));

// hero pose set
const POSES = {
  arms_up: { desc: 'both arms reaching straight up, body stretched upward as if rising fast, looking up excitedly', scale: 0.6, anchorY: 0.5 },
  waving: { desc: 'waving one hand hello with a big friendly smile, the other arm relaxed', scale: 0.56, anchorY: 0.52 },
  floating: { desc: 'floating gently with arms out to the sides, calm happy smile', scale: 0.56, anchorY: 0.5 },
  sitting: { desc: 'sitting cross-legged holding a small bowl in both hands as if eating, content smile', scale: 0.5, anchorY: 0.55 },
};
const pickPose = (page) => {
  const t = `${page.text || ''} ${(page.illustration && page.illustration.note) || ''}`.toLowerCase();
  if (/\b(eat|eats|eating|soup|together|forever)\b/.test(t)) return 'sitting';
  if (/\b(up|rise|rising|rose|higher|climb|climbing)\b/.test(t)) return 'arms_up';
  if (/\b(hi|hello|wave|waving|plane|bird|birds|cloud|clouds|pass|passing)\b/.test(t)) return 'waving';
  return 'floating';
};

// secondary actors: one neutral cut-out each
const SEC_DESC = {
  star_mom: 'facing forward with a warm motherly smile and two slender star-point arms opening for a hug',
  friendly_plane: 'flying and tilting one wing as if waving, with a friendly smile',
  birds: 'a small flock of three little birds flying together',
};
const SCALE = { spaceman: 0.52, star_mom: 0.42, friendly_plane: 0.34, birds: 0.26 };
const PRIORITY = ['star_mom', 'friendly_plane', 'birds']; // placement order after the hero
// per-count anchor slots [x,y] (0..1); index 0 is the hero
const SLOTS = {
  1: [[0.5, 0.52]],
  2: [[0.34, 0.56], [0.7, 0.42]],
  3: [[0.3, 0.6], [0.72, 0.44], [0.52, 0.26]],
  4: [[0.28, 0.62], [0.72, 0.58], [0.3, 0.3], [0.72, 0.28]],
};

const readB64 = (path) => readFileSync(path).toString('base64');
const saveB64 = (path, data) => writeFileSync(path, Buffer.from(data, 'base64'));
const refFromChar = (id) => { try { return { mimeType: 'image/png', data: readB64(join(DIR, `char-${id}.png`)) }; } catch { return null; } };

// 1) hero base reference (cached)
const basePath = join(DIR, `char-${HERO}.png`);
if (FRESH || !existsSync(basePath)) {
  console.log('Hero reference: regenerating…');
  const img = await renderCharacterRef(charById[HERO]);
  if (!img) { console.error('base ref failed'); process.exit(1); }
  saveB64(basePath, img.data);
} else console.log('Hero reference: cached.');
const heroRef = { mimeType: 'image/png', data: readB64(basePath) };

// 2) hero pose set (cached) → matted cut-outs
console.log('Hero pose set…');
const poseCut = {};
for (const [name, p] of Object.entries(POSES)) {
  const posePath = join(CACHE, `pose-${name}.png`);
  if (FRESH || !existsSync(posePath)) {
    const img = await renderCharacterPose(charById[HERO], p.desc, heroRef);
    if (!img) { console.log(`   ✗ ${name}`); continue; }
    saveB64(posePath, img.data);
    console.log(`   ✓ ${name}`);
  }
  poseCut[name] = trim(matteBySampledBg(fromBase64(readB64(posePath))));
}

// 3) secondary actor cut-outs (cached) → matted
console.log('Secondary cast cut-outs…');
const secCut = {};
for (const id of PRIORITY) {
  if (!charById[id]) continue;
  const cutPath = join(CACHE, `cut-${id}.png`);
  if (FRESH || !existsSync(cutPath)) {
    const img = await renderCharacterPose(charById[id], SEC_DESC[id] || 'shown clearly, friendly, facing forward', refFromChar(id));
    if (!img) { console.log(`   ✗ ${id}`); continue; }
    saveB64(cutPath, img.data);
    console.log(`   ✓ ${id}`);
  }
  secCut[id] = trim(matteBySampledBg(fromBase64(readB64(cutPath))));
}

// 4) per page: background (omit ALL locked actors present) + composite the cast
console.log('Pages…');
const v = Date.now();
for (let i = 0; i < book.pages.length; i++) {
  const p = book.pages[i];
  const n = String(i + 1).padStart(2, '0');
  const present = ((p.illustration && p.illustration.characters) || []).filter((id) => charById[id]);
  const actors = present.filter((id) => !AMBIENT.has(id));
  // hero first, then secondary priority order
  const ordered = [
    ...(actors.includes(HERO) ? [HERO] : []),
    ...PRIORITY.filter((id) => actors.includes(id)),
  ];

  // background: omit every actor we will composite; ambient (clouds/soup) stays
  const bgPath = join(CACHE, `bg-${n}.png`);
  if (FRESH_BG || !existsSync(bgPath)) {
    const omitNames = ordered.map((id) => charById[id].name).concat(['any people or main characters']);
    const bgImg = await renderBackground(p, { omitNames });
    if (!bgImg) { console.log(`   page ${i + 1}: bg ✗`); continue; }
    saveB64(bgPath, bgImg.data);
  }
  let img = fromBase64(readB64(bgPath));

  const slots = SLOTS[Math.min(4, ordered.length)] || SLOTS[1];
  const poseName = pickPose(p);
  ordered.forEach((id, idx) => {
    const cut = id === HERO ? (poseCut[poseName] || poseCut.floating) : secCut[id];
    if (!cut) return;
    const [ax, ay] = slots[idx] || [0.5, 0.5];
    const scale = (SCALE[id] || 0.4) * (id === HERO ? (POSES[poseName].scale / 0.56) : 1);
    img = place(img, cut, { scale, anchorX: ax, anchorY: ay });
  });

  writeFileSync(join(DIR, `page-${n}.png`), writePNG(img));
  p.imageUrl = `/art/${KEY}/page-${n}.png?v=${v}`;
  console.log(`   page ${i + 1}: [${ordered.join(', ') || 'scene only'}]${ordered.includes(HERO) ? ` pose=${poseName}` : ''} ✓`);
}

for (const c of book.characters) if (existsSync(join(DIR, `char-${c.id}.png`))) c.refUrl = `/art/${KEY}/char-${c.id}.png?v=${v}`;
result.book.art = { ...(result.book.art || {}), composited: true, castLocked: true };
writeFileSync(join(DIR, 'book.json'), JSON.stringify(result));
console.log('\nDone → served cache. Reload the demo to view.');
