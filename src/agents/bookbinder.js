// Abra — Bookbinder
// ----------------------------------------------------------------------------
// Assembles the final deliverable — the Book — from the Storyteller pages, the
// Character Friend's stable character sheets, the Illustrator's per-page specs,
// and the Narrator's read-aloud segments.
//
// The SAME assembled pages support two V1 layouts (a view option, not a second
// generation path):
//   - storybook: full-page illustrated spreads (the core, filmed/shipped path)
//   - comic: the same pages arranged as panels
// and one V2 premium output declared as a locked stub: a short animated clip.
// ----------------------------------------------------------------------------

import { animationGate } from './animator.js';

export function bindBook({ title, authors = [], characters = [], pages = [], coWriting = false, entitlement = {} }) {
  return {
    title,
    authors,
    characters, // stable, reusable sheets (canonical + seed + emoji/palette)
    pages: pages.map((p, i) => ({
      index: i,
      text: p.text,
      author: p.author || null,
      illustration: p.illustration || null, // Illustrator spec (character-consistent)
      narration: p.narration || null, // Narrator segment (read-aloud)
    })),
    layout: {
      variants: ['storybook', 'comic'], // V1 view options over the same pages
      default: 'storybook',
    },
    premium: {
      // V2 — declared, not built. Gated behind subscription / bigger credit pack.
      animation: animationGate(entitlement),
    },
    meta: {
      coWriting: Boolean(coWriting),
      pageCount: pages.length,
      characterCount: characters.length,
    },
  };
}
