// Abra — Narrator
// ----------------------------------------------------------------------------
// Produces the per-page narration script. Rule 3 (keep the child's words) means
// the narration IS the child's words — the Narrator does not rewrite the page.
// It carries the read-aloud text (plus room for pacing/voice hints later).
//
// The demo plays this with the browser's built-in speech synthesis (no external
// TTS dependency, no key). A production build swaps in a real TTS voice by
// replacing the player, not the script — the narration segments stay the same.
// ----------------------------------------------------------------------------

export function narrate(pages, { voice = 'warm' } = {}) {
  return pages.map((page) => ({
    ...page,
    narration: {
      text: page.text || '', // the child's exact words, read aloud
      voice,
    },
  }));
}
