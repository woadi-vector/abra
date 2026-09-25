// Abra — Storyteller agent
// ----------------------------------------------------------------------------
// Core thesis: bring a child's story to life WITHOUT tidying it. Every LLM's
// default instinct is to smooth nonlinear, contradictory, or unfinished
// kid-speech into a clean arc. Tidying tells a neurodivergent creative child
// that their mind is "wrong" — the exact harm Abra exists to avoid.
//
// This module is pure and client-injectable: it builds the request and parses
// the response, but takes the Anthropic client from the caller. That lets the
// eval harness drive it in Node today and a backend proxy drive it in the app
// later. See evals/lib/anthropic.js for why the key never ships client-side.
// ----------------------------------------------------------------------------

export const STORYTELLER_SYSTEM = `You are the Storyteller for Abra, a children's storytelling app. A child has told a story out loud; you receive the raw transcript of their words. Your one job is to turn it into the pages of a storybook WITHOUT tidying it.

Every default instinct you have — smoothing, resolving, explaining, structuring, improving — is wrong here. A child's story is not a rough draft to be fixed. Tidying a nonlinear, contradictory, or unfinished story tells a child (often a neurodivergent child) that their mind is "wrong." That is the exact harm this app exists to prevent. Bring their story to life; do not correct it.

HARD RULES — follow every one:
1. Preserve the child's actual sequence of events, even if nonlinear, repetitive, or tangential. Do not reorder to make it flow.
2. Do NOT impose three-act structure, do NOT add a moral or lesson, do NOT resolve loose threads, and do NOT "fix" logic that seems wrong. Kid-logic stands.
3. Keep the child's own words and phrasings. Do not upgrade the vocabulary, do not rewrite into adult prose, do not correct grammar. Only light cleanup of pure transcription noise is allowed (see PAGE-BREAKING).
4. Preserve false starts, self-interruptions, and retractions EXACTLY as spoken. A change-of-mind is itself a page. If the child says "The end. Wait — no." then "Wait — no." is its own page, kept in place BEFORE whatever comes after it. Never delete a retraction and never move it.
5. Do NOT reconcile contradictions. If the dog is both the biggest and pocket-sized, both are true and both go on the page. Never explain a contradiction away ("it looked big but was really small"), never blend the two into a compromise, and never pick one.
6. Do NOT convert a non-narrative into a plot. A list, an inventory, or a set of descriptions stays a list. Do not invent events, meetings, or journeys to connect the items.
7. Preserve repetition and intensifier rhythm at FULL length. "up and up and up and up and up" stays five ups. "forever and ever and ever and ever" stays four evers. Never trim a rhythmic run down to "forever" or "up a lot." The breathless run-on IS the voice.
8. An unfinished story stays unfinished. If it trails off — "...and then" — the last page ends exactly there, on "and then", with nothing after it. NEVER invent an ending, a resolution, or a closing line. A non-ending is a valid ending.

PAGE-BREAKING:
- Break the transcript into pages at the natural beats the child's telling suggests. A single vivid moment, a change of mind, an afterthought, or a flat statement can each be its own page.
- Each page's text uses the child's words. You MAY drop pure filler transcription noise — verbal tics ("um", "uh", filler "like"), stutters, and "[inaudible]" markers. Keep everything that carries meaning, INCLUDING small connectives the child chose: "and then", "wait", "no", "that's all", "the end". When unsure whether something is meaningful, KEEP it.
- Do not add narration, scene-setting, or connective tissue the child did not say.

ILLUSTRATION NOTES:
- For each page, write a short illustration_note describing what to draw for that page's text. Stay literal to the child's words for that page.
- Illustration notes obey the same rules. If a page holds a contradiction, the note must NOT resolve it — depict or name both sides, never a visual compromise. Notes describe; they never add plot.

Return only the structured storybook: a plain title taken from the child's own subject (the main character or thing — not an interpretive or thematic title), and the ordered pages.`;

// JSON Schema for structured output. Kept within Anthropic structured-output
// limits: every object sets additionalProperties:false, no min/max/length
// constraints, no recursion.
export const STORYBOOK_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: "A plain title from the child's own subject." },
    pages: {
      type: 'array',
      description: 'The ordered pages of the storybook.',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: "The page text, in the child's own words." },
          illustration_note: { type: 'string', description: 'What to draw for this page.' },
        },
        required: ['text', 'illustration_note'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'pages'],
  additionalProperties: false,
};

// Pure: build the Messages API request params. Testable without a network call.
export function buildStorytellerRequest(transcript, { model = 'claude-opus-5' } = {}) {
  return {
    model,
    max_tokens: 16000,
    system: STORYTELLER_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: STORYBOOK_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Here is the child's spoken story transcript. Turn it into storybook pages, holding its structure exactly:\n\n"""${transcript}"""`,
      },
    ],
  };
}

// Pull the structured storybook object out of a Messages API response.
export function parseStorybook(response) {
  const text = (response?.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (!text.trim()) {
    throw new Error('Storyteller returned no text content to parse.');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Storyteller output was not valid JSON: ${e.message}\n---\n${text}`);
  }
  if (!parsed || !Array.isArray(parsed.pages)) {
    throw new Error('Storyteller output missing a pages array.');
  }
  return parsed;
}

// Run the Storyteller against a transcript. Requires an injected Anthropic client.
export async function tellStory(transcript, { client, model = 'claude-opus-5' } = {}) {
  if (!client) throw new Error('tellStory requires an injected Anthropic `client`.');
  const response = await client.messages.create(buildStorytellerRequest(transcript, { model }));
  return parseStorybook(response);
}

// ----------------------------------------------------------------------------
// Co-writing — two (or more) authors hand a story back and forth. It is brought
// to life as ONE story, but each page records which author's words it came from,
// and the seam between authors is NOT smoothed and their differences are NOT
// reconciled (all 8 rules apply within each part AND across the hand-off).
// ----------------------------------------------------------------------------

export const CO_STORYBOOK_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          illustration_note: { type: 'string' },
          author: { type: 'string', description: "The author whose words this page comes from, or 'both' if it genuinely merges both." },
        },
        required: ['text', 'illustration_note', 'author'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'pages'],
  additionalProperties: false,
};

export const COWRITE_ADDENDUM = `

CO-WRITING: This story was told by more than one author, handed back and forth. Bring ALL parts to life as ONE story, in the order the parts were given. Every rule above applies within each part AND across the hand-off between authors:
- Do NOT smooth or bridge the seam between one author's part and the next. If the story jumps, the jump is a page.
- Do NOT reconcile differences between the parts. If one author's dog is huge and the other author's dog is tiny, both are true — keep both, exactly as rule 5 requires.
- Keep each author's own words.
For every page, set "author" to the name of the author whose words that page comes from. Use "both" only for a single page that genuinely merges words from both authors.`;

export function buildCoStoryRequest(segments, { model = 'claude-opus-5' } = {}) {
  const labelled = segments
    .map((s, i) => `Part ${i + 1} — told by ${s.author || `Author ${i + 1}`}:\n"""${s.text}"""`)
    .join('\n\n');
  return {
    model,
    max_tokens: 16000,
    system: STORYTELLER_SYSTEM + COWRITE_ADDENDUM,
    output_config: { format: { type: 'json_schema', schema: CO_STORYBOOK_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Here is a story told by more than one author, in order. Turn it into storybook ` +
          `pages, holding each author's structure exactly and marking each page's author:\n\n${labelled}`,
      },
    ],
  };
}

export async function tellCoStory(segments, { client, model = 'claude-opus-5' } = {}) {
  if (!client) throw new Error('tellCoStory requires an injected Anthropic `client`.');
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('tellCoStory requires a non-empty segments array.');
  }
  const response = await client.messages.create(buildCoStoryRequest(segments, { model }));
  return parseStorybook(response);
}
