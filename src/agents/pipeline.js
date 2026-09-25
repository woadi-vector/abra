// Abra story pipeline — the architecture that wires Guardian's three lanes
// around the Storyteller. This is the single, non-bypassable path a child's
// spoken story takes.
//
//   child transcript (one author, or several handed back and forth)
//      │
//      ├─ Lane 1  checkInput → blocked?  ──► gentle child redirect, STOP
//      │                        flagged?  ──► private note to the parent dashboard
//      │                                       (child experience continues, unaware)
//      ▼
//   Storyteller  (only clean input reaches it; co-written input keeps per-page authors)
//      │
//      ▼
//   Lane 3  screenOutput every page's text + illustration note
//      │  any unsafe? → regenerate once → re-screen → drop pages still unsafe
//      ▼
//   storybook shown to the child
//
// processStory returns BOTH the child-facing storybook and a full lane-by-lane
// `trace` for the parent view / demo — the safety pipeline is surfaced, not hidden.

import { checkInput, screenOutput } from './guardian.js';
import { tellStory, tellCoStory } from './storyteller.js';
import { describeCharacters } from './characterFriend.js';
import { illustrate } from './illustrator.js';
import { narrate } from './narrator.js';
import { bindBook } from './bookbinder.js';
import { renderBookImages, hasImageKey } from './imageRenderer.js';

// Screen one storybook's artifacts (Lane 3). Returns per-page verdicts.
async function screenStorybook(storybook, ctx) {
  const verdicts = [];
  for (let i = 0; i < storybook.pages.length; i++) {
    const page = storybook.pages[i];
    const [text, note] = await Promise.all([
      screenOutput(page.text, { ...ctx, kind: 'page_text' }),
      screenOutput(page.illustration_note, { ...ctx, kind: 'illustration' }),
    ]);
    verdicts.push({ index: i, safe: text.safe && note.safe, text, note });
  }
  return verdicts;
}

/**
 * Run a story end-to-end through all three Guardian lanes + the Storyteller.
 * @param {{text?: string, segments?: {author: string, text: string}[]}} input
 */
export async function processStory(input, { client, model = 'claude-opus-5', dashboard, blocklist, library, entitlement, renderImages = false, artDir } = {}) {
  if (!client) throw new Error('processStory requires an injected Anthropic `client`.');
  const ctx = { client, model };

  const segments = Array.isArray(input?.segments) && input.segments.length ? input.segments : null;
  const combined = segments ? segments.map((s) => s.text).join('\n\n') : String(input?.text ?? '');
  const authors = segments ? [...new Set(segments.map((s) => s.author).filter(Boolean))] : [];

  if (!combined.trim()) throw new Error('processStory requires non-empty story text.');

  // --- Lane 1 + Lane 2: input ------------------------------------------------
  const inp = await checkInput(combined, { ...ctx, blocklist });
  const lane1 = { ran: true, blocked: inp.lane1.blocked, category: inp.lane1.category };
  const lane2 = { ran: true, flagged: inp.lane2.flagged, signals: inp.lane2.signals, passage: inp.lane2.passage, note: inp.lane2.note };

  if (inp.lane1.blocked) {
    // Refused at ingestion — never reaches the Storyteller. Child sees a gentle,
    // non-shaming redirect and never the flagged content.
    return {
      status: 'blocked',
      authors,
      segments,
      childMessage: inp.childMessage,
      storybook: null,
      flag: null,
      trace: { lane1, storyteller: { ran: false }, lane3: { ran: false }, lane2 },
    };
  }

  // --- Lane 2: surface a private flag to the parent (does NOT block) ----------
  let flag = null;
  if (inp.lane2.flagged) {
    const record = { storyText: combined, signals: inp.lane2.signals, passage: inp.lane2.passage, note: inp.lane2.note };
    flag = dashboard ? dashboard.addFlag(record) : { id: 'flag_preview', reviewed: false, ...record };
  }

  // --- Storyteller (clean input only) ---------------------------------------
  let storybook = segments ? await tellCoStory(segments, ctx) : await tellStory(combined, ctx);
  const storyteller = { ran: true, coWriting: Boolean(segments), pages: storybook.pages.length };

  // --- Lane 3: output --------------------------------------------------------
  let verdicts = await screenStorybook(storybook, ctx);
  let regenerated = false;
  if (verdicts.some((v) => !v.safe)) {
    regenerated = true;
    storybook = segments ? await tellCoStory(segments, ctx) : await tellStory(combined, ctx);
    verdicts = await screenStorybook(storybook, ctx);
  }
  const keptPages = storybook.pages.filter((_, i) => verdicts[i]?.safe !== false);
  const droppedCount = storybook.pages.length - keptPages.length;
  const lane3 = {
    ran: true,
    regenerated,
    droppedCount,
    pages: verdicts.map((v) => ({
      index: v.index,
      kept: v.safe,
      textSafe: v.text.safe,
      noteSafe: v.note.safe,
      category: v.text.category || v.note.category || null,
      reason: v.safe ? '' : v.text.reason || v.note.reason || '',
    })),
  };
  storybook = { ...storybook, pages: keptPages };

  // --- Output format: Character Friend → Illustrator → Narrator → Bookbinder --
  // Character Friend is the only new LLM call; the rest is deterministic
  // assembly. The stable character sheets keep art consistent across pages and
  // are reusable by the v2 animation step.
  const characters = await describeCharacters(
    { story: combined, pages: storybook.pages },
    { ...ctx, library }
  );
  const illustrated = illustrate(storybook.pages, characters);
  const narrated = narrate(illustrated);
  let book = bindBook({
    title: storybook.title,
    authors,
    characters,
    pages: narrated,
    coWriting: Boolean(segments),
    entitlement,
  });

  // Optional: render REAL art via the image renderer. Off by default (keeps the
  // pipeline's cost/behavior unchanged for callers that don't need pixels). When
  // on, this is the production render path — one reference image per character,
  // then every page conditioned on the references of the characters it contains.
  if (renderImages && hasImageKey()) {
    book = await renderBookImages(book, { library, outDir: artDir });
  }

  return {
    status: 'ok',
    authors,
    segments,
    childMessage: null,
    storybook, // raw Storyteller pages (kept for compatibility)
    book, // assembled deliverable: characters + illustrated/narrated pages + layouts + premium stub
    flag,
    trace: {
      lane1,
      storyteller,
      lane3,
      lane2,
      output: { ran: true, characters: characters.length, layouts: book.layout.variants, premium: book.premium.animation },
    },
  };
}
