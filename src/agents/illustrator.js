// Abra — Illustrator
// ----------------------------------------------------------------------------
// Turns each Storyteller page into a concrete illustration SPEC. It is
// deterministic on purpose: for every page it injects the STABLE `canonical`
// description of each character that appears, verbatim. That verbatim injection
// is the mechanism that keeps a character identical from page to page — and the
// same spec (canonical + seed + shared style) is exactly what a future animation
// step consumes.
//
// There is no image-generation model wired here; the Illustrator's output is the
// render prompt + the metadata a real image model (or the demo's placeholder art)
// consumes. Swap the renderer, keep the spec.
// ----------------------------------------------------------------------------

// One shared style anchor across the whole book keeps a cohesive look — also
// stable and reusable by the animator. This mirrors STYLE_BIBLE.md's one-line
// summary (the image renderer injects the full bible; this keeps the spec text
// in the illustrator aligned, with no stale pastel language anywhere).
export const STORYBOOK_STYLE =
  "Bright, cheerful hand-drawn children's storybook art: loose lively ink outline with full " +
  'saturated watercolor fill, flat storybook lighting, clean bright paper, consistent character design.';

// Words that don't identify a character (so "The Star (his mom)" reduces to the
// meaningful keywords "star", "mom" — which DO appear on the page).
const MATCH_STOP = new Set([
  'the', 'a', 'an', 'and', 'of', 'with', 'in', 'on', 'to', 'that', 'who', 'is', 'are', 'was', 'were',
  'his', 'her', 'its', 'their', 'my', 'your', 'can', 'talk', 'talks', 'talking', 'named', 'called',
  'object', 'thing', 'character', 'little', 'big', 'small', 'some', 'this', 'they', 'them', 'he', 'she',
  'it', 'one', 'made', 'out', 'built', 'from', 'into', 'both', 'at', 'once', 'as', 'like', 'kind',
  // generic setting/filler words — not identifying, and they over-match ("space"
  // in "Space Soup" would otherwise put a soup bowl on every space page)
  'space', 'sky', 'land', 'world', 'water', 'sea', 'air', 'ground', 'place', 'everywhere',
  'forever', 'ever', 'around', 'together', 'again', 'day', 'night', 'time', 'food', 'friend',
]);

// The identifying keywords for a character, drawn from its name + species.
export function matchKeywords(character) {
  const raw = `${character.name || ''} ${character.species || ''}`.toLowerCase().replace(/[()]/g, ' ');
  const kws = [];
  for (const w of raw.split(/[^a-z0-9']+/)) {
    const word = w.replace(/'s$/, '');
    if (!word || word.length < 3 || MATCH_STOP.has(word)) continue;
    kws.push(word);
  }
  return [...new Set(kws)];
}

// A character appears on a page if ANY of its keywords (singularized) shows up in
// the page text or illustration note — robust to verbose/parenthetical names.
function characterAppears(character, page) {
  const hay = `${page.text || ''} ${page.illustration_note || ''}`.toLowerCase();
  for (const kw of matchKeywords(character)) {
    const stem = kw.length >= 4 ? kw.replace(/s$/, '') : kw; // clouds→cloud, birds→bird
    if (new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay)) return true;
  }
  return false;
}

export function illustrate(pages, characters, { style = STORYBOOK_STYLE } = {}) {
  return pages.map((page) => {
    const present = (characters || []).filter((c) => characterAppears(c, page));
    const canon = present.map((c) => c.canonical).filter(Boolean).join(' ');
    const prompt = [
      style,
      canon,
      `Scene: ${page.illustration_note || page.text || ''}`,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      ...page,
      illustration: {
        prompt, // what a real image model renders
        style,
        note: page.illustration_note || '',
        characters: present.map((c) => c.id), // stable ids present in this panel
        seeds: present.map((c) => c.seed), // reproducible per-character seeds
      },
    };
  });
}
