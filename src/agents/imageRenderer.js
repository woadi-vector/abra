// Abra — Gemini image renderer
// ----------------------------------------------------------------------------
// Turns the Illustrator's per-page prompt spec into REAL storybook art, and
// keeps a character looking the same on every page by generating a reference
// image once per character and feeding it into each page render (Gemini image /
// "Nano Banana" is strong at holding a referenced subject consistent).
//
// This is the production renderer that plugs into the Illustrator's existing
// output — nothing about the storybook pipeline changes. It reads GEMINI_API_KEY
// from the environment (server-side only, never the client). On any error, or
// when no key is set, it returns null so the demo falls back to the emoji
// placeholder and never breaks.
// ----------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// ---------------------------------------------------------------------------
// Art direction. Single source of truth is STYLE_BIBLE.md at the repo root (the
// same spec used by the style test). It is read once and prepended, verbatim, to
// every generation — together with the frame-fill directive and a no-text guard.
// ---------------------------------------------------------------------------
const STYLE_BIBLE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../STYLE_BIBLE.md');

// Fallback if the file can't be read at runtime: the bible's own one-line summary,
// so generations still carry the intended look instead of crashing.
const STYLE_BIBLE_FALLBACK =
  "Bright, cheerful hand-drawn children's storybook art: loose lively ink outline with full " +
  'saturated watercolor fill, flat storybook lighting, clean bright paper, consistent character design.';

let _styleBible;
function styleBible() {
  if (_styleBible === undefined) {
    try {
      _styleBible = readFileSync(STYLE_BIBLE_PATH, 'utf8').trim();
    } catch (e) {
      console.warn(`[imageRenderer] could not read STYLE_BIBLE.md (${e.message}); using fallback summary.`);
      _styleBible = STYLE_BIBLE_FALLBACK;
    }
  }
  return _styleBible;
}

// Composition default for ALL page generations — keeps the subject large with
// only a modest margin (matches the bible's "modest negative space, not sparse").
export const FRAME_FILL =
  'Framing: Fill the frame. The subject and scene occupy most of the image and extend close to the ' +
  'edges, leaving only a modest, even margin of clean paper — NOT a small centered element on a large ' +
  'empty white background. Push the main subject large in the composition; keep it readable and ' +
  'uncluttered, but do not leave the page mostly blank.';

// Legibility default for ALL generations — keeps a character's extremities from
// melting into a same-colored background (e.g. blue gloves/boots on a blue sky).
// Space stays deep blue per the bible; contrast is solved with color + ink line,
// never by darkening the palette.
export const LEGIBILITY =
  "Legibility & contrast: Every character's hands, feet, and other extremities must stay clearly " +
  'readable against whatever is behind them — never let gloves, boots, or limbs blend into a ' +
  'same-colored field. Always keep the confident warm brown-black ink outline around every shape, ' +
  'and give extremities a color that visibly contrasts with the background (e.g. warm accents such ' +
  'as red, orange, or yellow against a blue sky). If a limb sits on a similar-colored field, separate ' +
  'it with the ink line plus a slightly lighter or darker flat tint. Space is a deep, saturated, ' +
  'cheerful blue — never black.';

const NO_TEXT =
  'Absolutely no text anywhere in the image: no letters, numbers, words, captions, labels, or signs. ' +
  'Do NOT draw speech bubbles, thought bubbles, or empty callout shapes at all. Even if the scene says a ' +
  'character speaks or "says hi", convey that ONLY through friendly body language — a wave and a smile — ' +
  'with no bubble and no words.';

// The full style block prepended to every generation
// (bible + framing + legibility + no-text).
export function styleBlock() {
  return `${styleBible()}\n\n${FRAME_FILL}\n\n${LEGIBILITY}\n${NO_TEXT}`;
}

export function hasImageKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Low-level call. `parts` is a Gemini `contents[0].parts` array (text + inlineData
// image parts). Returns { mimeType, data (base64) } or null.
async function generateImage(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(`${API}/${IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini image ${res.status}: ${body.slice(0, 220)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const part = (json?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!part) return null;
  return { mimeType: part.inlineData.mimeType || 'image/png', data: part.inlineData.data };
}

// Convenience: a data: URI the browser can render directly.
export const toDataUri = (img) => (img ? `data:${img.mimeType};base64,${img.data}` : null);

// A stable reference portrait for one character (generated once, reused on every
// page — this is what keeps the character consistent, and is reusable by the
// future animation step).
export async function renderCharacterRef(character) {
  const prompt =
    `${styleBlock()}\n\n` +
    `Character reference sheet for a single character named "${character.name}". ` +
    `${character.canonical} ` +
    `Show the full character large and centered, in a neutral friendly pose, on a plain white background.`;
  return generateImage([{ text: prompt }]);
}

// One page. `refsByCharId` maps character id → its reference image ({mimeType,data}).
// The references for the characters present are passed in so the model keeps them
// consistent with earlier pages.
export async function renderPage(page, refsByCharId = {}) {
  const ill = page.illustration || {};
  const ids = ill.characters || [];
  const refs = ids.map((id) => refsByCharId[id]).filter(Boolean);

  let head = `${styleBlock()}\n\nIllustrate this page of a children's storybook.`;
  if (refs.length) {
    // Label each reference IN ORDER with its name + canonical, then bind the model
    // to match each one exactly. Labeling per-character (not "the characters")
    // stops details bleeding between characters on busy pages, and keeps signature
    // colors (e.g. gloves/boots) from drifting to a generic version.
    const labels = refs
      .map((r, i) => `(${i + 1}) ${r.name || `Character ${i + 1}`}${r.canonical ? ` — ${r.canonical}` : ''}`)
      .join('\n');
    head +=
      `\n\nReference images are attached below, in this exact order:\n${labels}\n` +
      `Draw each of these characters to match ITS OWN reference image EXACTLY — identical silhouette, ` +
      `proportions, signature colors, and distinguishing features (keep the very same glove, boot, and ` +
      `helmet colors as the reference). Do not invent a different-looking version of any character, and ` +
      `do not swap or blend details between them.`;
  }

  // FINAL rules come AFTER the scene so they override wording in the note itself
  // (the Storyteller preserves the child's rhythm, e.g. "repeating upward five
  // times" / "the scene repeats four times" — rendered literally that clones the
  // character; we translate that repetition into MOTION for a single figure).
  const finalRules =
    `Overriding any wording in the scene above: draw each character EXACTLY ONCE — a single figure per ` +
    `character, never duplicated, cloned, or shown as several copies. If the scene says the character ` +
    `repeats, rises multiple times, or that "the scene repeats N times", express that rhythm with a ` +
    `SINGLE figure plus motion cues — a motion trail, speed lines, or small repeated background marks ` +
    `(puffs, stars) — not by drawing the character more than once. Every character's face must be drawn ` +
    `COMPLETE and clearly visible — two eyes, a nose, and a mouth, seen through a clear helmet or visor ` +
    `if they wear one — never a blank, eyeless, or partial face.\n\n${NO_TEXT}`;

  const parts = [{ text: `${head}\n\nScene: ${ill.note || page.text || ''}\n\n${finalRules}` }];
  for (const r of refs) parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } });
  return generateImage(parts);
}

// Render a CHARACTER-FREE background for a page (used by the compositing path that
// locks the hero pixel-perfect). Draws the setting and any non-hero scenery, and
// deliberately leaves the main-subject area open so a cut-out can be placed there.
export async function renderBackground(page, { omitNames = [], refsByCharId = {} } = {}) {
  const ill = page.illustration || {};
  const ids = ill.characters || [];
  const keepRefs = ids.map((id) => refsByCharId[id]).filter(Boolean); // non-hero refs to keep consistent
  const omit = omitNames.length
    ? `Do NOT draw ${omitNames.join(' or ')} anywhere in the image — no people or main characters at all. `
    : '';
  let head =
    `${styleBlock()}\n\nDraw ONLY the background and setting for this page of a children's storybook — a ` +
    `COMPLETE, continuous scene that fills the ENTIRE frame edge to edge. ${omit}Draw the scenery, sky, and ` +
    `any objects with NO blank, empty, or white rectangular areas anywhere in the picture.`;
  if (keepRefs.length) {
    const labels = keepRefs
      .map((r, i) => `(${i + 1}) ${r.name || `Character ${i + 1}`}${r.canonical ? ` — ${r.canonical}` : ''}`)
      .join('\n');
    head += `\n\nAny of these secondary characters that appear must match their reference image exactly:\n${labels}`;
  }
  const oneScene =
    'Draw ONE single continuous scene — do NOT tile, grid, or repeat the scene into multiple panels. ' +
    'If the note mentions the scene repeating or an action happening several times, show that rhythm with ' +
    'motion cues or scattered background marks (stars, puffs), not by dividing the image into panels.';
  // FINAL, authoritative omit — after the scene so it overrides a note that names or
  // describes the characters. This is a background PLATE; the cast is added later.
  const omitFinal = omitNames.length
    ? `CRITICAL: this is a BACKGROUND PLATE only. It must contain NO ${omitNames.join(', no ')}, and no ` +
      `people, astronauts, or characters of ANY kind anywhere — EVEN THOUGH the scene text above mentions ` +
      `them. Draw only the empty setting and scenery. Do not repeat or scatter any characters.`
    : '';
  const parts = [{ text: `${head}\n\nScene: ${ill.note || page.text || ''}\n\n${oneScene}\n\n${omitFinal}\n\n${NO_TEXT}` }];
  for (const r of keepRefs) parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } });
  return generateImage(parts);
}

// Render the SAME character in a specific pose, conditioned on its base reference so
// the design/colours/face/hair stay identical — used to build the hero's pose set for
// the compositing path. Plain white background for clean matting.
export async function renderCharacterPose(character, pose, baseRef) {
  const parts = [
    {
      text:
        `${styleBlock()}\n\n` +
        `This is the SAME character as the attached reference image. Keep the design, colours, face, ` +
        `and hair EXACTLY the same as the reference. ${character.canonical} ` +
        `Redraw the FULL BODY (head to feet, nothing cropped) in this pose: ${pose}. ` +
        `Center the whole character on a SOLID, UNIFORM chroma-key GREEN background (bright green #00B140) — ` +
        `absolutely no scenery, no shadows, no paper texture, no border, just flat green behind the whole ` +
        `character, with a clear margin around it.\n\n${NO_TEXT}`,
    },
  ];
  if (baseRef) parts.push({ inlineData: { mimeType: baseRef.mimeType, data: baseRef.data } });
  return generateImage(parts);
}

// Render a whole Book: ONE canonical reference image per character first (in
// parallel), then every page (in parallel) CONDITIONED on the reference image(s)
// of the character(s) present — that per-page conditioning is what holds each
// character identical from page to page. Attaches `imageDataUri` to every
// character and page. Best-effort: any failed render leaves that item without an
// image (demo shows the emoji).
//
// Options:
//   outDir  — if set, also write PNGs to disk: char-<id>.png and page-NN.png, and
//             record the path on each record (`refPath` / `pagePath`).
//   library — if set (a characterLibrary), persist each character's `refPath` onto
//             its stored record, so the saved reference travels with the sheet
//             (reused across pages and by the future animation step).
export async function renderBookImages(book, { onProgress, outDir, library } = {}) {
  if (!hasImageKey() || !book) return book;
  if (outDir) mkdirSync(outDir, { recursive: true });

  // 1) ONE canonical reference image per character (parallel).
  const refsByCharId = {};
  const characters = await Promise.all(
    (book.characters || []).map(async (c) => {
      try {
        const img = await renderCharacterRef(c);
        if (!img) {
          onProgress?.({ type: 'character', id: c.id, ok: false });
          return c;
        }
        // Held in memory to condition every page below. Carry the name + canonical
        // so each page can LABEL each reference and lock the model to it (prevents
        // blending on busy multi-character pages).
        refsByCharId[c.id] = { mimeType: img.mimeType, data: img.data, name: c.name, canonical: c.canonical };
        let refPath;
        if (outDir) {
          refPath = join(outDir, `char-${c.id}.png`);
          writeFileSync(refPath, Buffer.from(img.data, 'base64'));
        }
        const enriched = { ...c, imageDataUri: toDataUri(img), ...(refPath ? { refPath } : {}) };
        if (library && refPath) {
          try { library.upsert(enriched); } catch { /* best-effort persistence */ }
        }
        onProgress?.({ type: 'character', id: c.id, ok: true, refPath });
        return enriched;
      } catch (e) {
        onProgress?.({ type: 'character', id: c.id, ok: false, error: e.message });
        return c;
      }
    })
  );

  // 2) pages (parallel), each conditioned on the reference image(s) of its
  //    character(s) — the consistency mechanism.
  const pages = await Promise.all(
    (book.pages || []).map(async (p, i) => {
      const index = Number.isInteger(p.index) ? p.index : i;
      try {
        const img = await renderPage(p, refsByCharId);
        if (!img) {
          onProgress?.({ type: 'page', index, ok: false });
          return p;
        }
        let pagePath;
        if (outDir) {
          pagePath = join(outDir, `page-${String(index + 1).padStart(2, '0')}.png`);
          writeFileSync(pagePath, Buffer.from(img.data, 'base64'));
        }
        onProgress?.({ type: 'page', index, ok: true, pagePath });
        return { ...p, imageDataUri: toDataUri(img), ...(pagePath ? { pagePath } : {}) };
      } catch (e) {
        onProgress?.({ type: 'page', index, ok: false, error: e.message });
        return p;
      }
    })
  );

  return { ...book, characters, pages, art: { rendered: true, model: IMAGE_MODEL, outDir: outDir || null } };
}
