// Rendered-story cache for the demo. Rendering real art costs Gemini calls + time,
// so a story is rendered ONCE and reused: images are written under .art/served/<key>/
// and the finished (URL-ified) result is cached as book.json. Same story ⇒ cache
// hit ⇒ instant, no API calls. The demo route and the hero pre-render script both
// go through here, so their cache keys always agree.

import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processStory } from '../src/agents/pipeline.js';
import { renderCharacterRef, renderPage } from '../src/agents/imageRenderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ART_ROOT = join(__dirname, '..', '.art', 'served');
mkdirSync(ART_ROOT, { recursive: true });

// Canonical payload → stable 16-char key. Normalized (trimmed, fixed field order)
// so the same story from the demo and from the pre-render script hash identically.
export function storyKey(payload) {
  const norm = payload.segments
    ? { segments: payload.segments.map((s) => ({ author: String(s.author || ''), text: String(s.text || '').trim() })) }
    : { text: String(payload.text || '').trim() };
  return crypto.createHash('sha1').update(JSON.stringify(norm)).digest('hex').slice(0, 16);
}

// Replace absolute on-disk paths with served /art/<key>/... URLs, and drop the
// heavy base64 data URIs from the payload sent to the browser.
function urlify(result, key) {
  if (!result || !result.book) return result;
  const toUrl = (p) => (p ? `/art/${key}/${basename(p)}` : null);
  const book = {
    ...result.book,
    characters: (result.book.characters || []).map(({ imageDataUri, refPath, ...c }) => ({
      ...c,
      refUrl: toUrl(refPath),
    })),
    pages: (result.book.pages || []).map(({ imageDataUri, pagePath, ...p }) => ({
      ...p,
      imageUrl: toUrl(pagePath),
    })),
  };
  return { ...result, book };
}

/**
 * Get a fully rendered, URL-ified story result for a payload, using the disk cache
 * when present. Returns { result, key, cached }.
 * @param deps { client, model, dashboard, library } for processStory.
 */
export async function getRenderedStory(payload, deps = {}) {
  const key = storyKey(payload);
  const dir = join(ART_ROOT, key);
  const bookJson = join(dir, 'book.json');

  if (existsSync(bookJson)) {
    return { result: JSON.parse(readFileSync(bookJson, 'utf8')), key, cached: true };
  }

  const input = payload.segments ? { segments: payload.segments } : { text: payload.text };
  const raw = await processStory(input, { ...deps, renderImages: true, artDir: dir });
  const result = urlify(raw, key);

  mkdirSync(dir, { recursive: true });
  writeFileSync(bookJson, JSON.stringify(result));
  return { result, key, cached: false };
}

/**
 * Edit one cast member: fold the instruction into that character's canonical, regenerate
 * its ONE reference image, then re-render every page it appears on (conditioned on the new
 * reference). Cache-busts the changed image URLs. Returns { result, key, edited }.
 */
export async function editCharacter({ key, characterId, instruction }) {
  const dir = join(ART_ROOT, key);
  const bookJson = join(dir, 'book.json');
  if (!existsSync(bookJson)) throw new Error('Story not found in cache — render it first.');

  const result = JSON.parse(readFileSync(bookJson, 'utf8'));
  const book = result.book;
  const char = (book.characters || []).find((c) => c.id === characterId);
  if (!char) throw new Error(`Character "${characterId}" not found in this story.`);

  const edit = String(instruction || '').trim().replace(/\s+/g, ' ');
  if (!edit) throw new Error('Describe the change you want.');

  // Fold the change into the canonical as an explicit override so BOTH the new
  // reference image and every page prompt (which labels each ref with its canonical)
  // carry it.
  char.canonical = `${char.canonical} IMPORTANT design change (override any of the above that conflicts): ${edit}${/[.!?]$/.test(edit) ? '' : '.'}`;

  // 1) regenerate this character's single reference image
  const ref = await renderCharacterRef(char);
  if (!ref) throw new Error('Reference image generation failed — try again.');
  writeFileSync(join(dir, `char-${characterId}.png`), Buffer.from(ref.data, 'base64'));

  // 2) rebuild the ref map (edited char from memory, the rest from disk)
  const refsByCharId = {};
  for (const c of book.characters || []) {
    try {
      const data = c.id === characterId ? ref.data : readFileSync(join(dir, `char-${c.id}.png`)).toString('base64');
      refsByCharId[c.id] = { mimeType: 'image/png', data, name: c.name, canonical: c.canonical };
    } catch { /* character has no saved reference */ }
  }

  // 3) re-render every page this character appears on
  const v = Date.now();
  const affectedPages = [];
  for (let i = 0; i < book.pages.length; i++) {
    const p = book.pages[i];
    if (!((p.illustration && p.illustration.characters) || []).includes(characterId)) continue;
    const n = String(i + 1).padStart(2, '0');
    const img = await renderPage(p, refsByCharId);
    if (img) {
      writeFileSync(join(dir, `page-${n}.png`), Buffer.from(img.data, 'base64'));
      p.imageUrl = `/art/${key}/page-${n}.png?v=${v}`; // cache-bust the changed page
      affectedPages.push(i + 1);
    }
  }
  char.refUrl = `/art/${key}/char-${characterId}.png?v=${v}`; // cache-bust the avatar

  writeFileSync(bookJson, JSON.stringify(result));
  return { result, key, edited: { characterId, instruction: edit, affectedPages } };
}
