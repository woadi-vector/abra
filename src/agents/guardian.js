// Abra — Guardian safety agent
// ----------------------------------------------------------------------------
// Guardian is architectural, not a feature: it cannot be disabled and the child
// cannot alter it. It runs THREE lanes, not one filter:
//
//   Lane 1 — Hard block (input): explicit content refused at ingestion; never
//            reaches the Storyteller. Floor-level, NOT parent-toggleable.
//   Lane 2 — Flag to parent (input): concerning-but-not-explicit content in
//            ordinary words. The story STILL processes (child experience is
//            uninterrupted); a private, descriptive flag is surfaced to the
//            parent dashboard — never to the child.
//   Lane 3 — Screen output: every generated artifact (page text, narration,
//            illustration) is screened for the Lane-1 categories before it
//            reaches the child. Anything failing is regenerated, not shown.
//
// Abra is a creative tool, NOT a monitoring/surveillance/safety-assessment
// product. Guardian FLAGS and DESCRIBES; it never diagnoses, scores a child,
// makes determinations, or contacts anyone.
//
// Pure and client-injectable, like the Storyteller. The seed lists come from
// config/guardian_blocklist.json; the classifier is the primary decision-maker.
// ----------------------------------------------------------------------------

import DEFAULT_BLOCKLIST from '../../config/guardian_blocklist.json' with { type: 'json' };

export { DEFAULT_BLOCKLIST };

// Category definitions handed to the classifier. The nuance in graphic_violence
// is load-bearing: ordinary story conflict must PASS.
const HARD_BLOCK_CATEGORIES = {
  profanity: 'Profanity or obscenity.',
  sexual: 'Sexual content or sexualized language.',
  graphic_violence:
    'Graphic violence or gore — explicit, detailed injury/killing. NOT ordinary story ' +
    'conflict, weapons-in-play (a cowboy with a gun, a knight with a sword), monsters, ' +
    'or mild scariness (a scary dragon). Imaginative peril is normal and must pass.',
  slurs: 'Slurs and hate terms targeting a protected group.',
  self_harm_methods: 'Self-harm methods or instructions.',
};

const LANE2_SIGNALS = {
  distress: "Possible emotional distress expressed in ordinary words (fear, hopelessness, feeling unloved or unsafe).",
  harm_indicators: 'Possible signs of harm to the child (being hit/hurt, injuries, deprivation).',
  unsafe_situation: 'Possible unsafe home or living situation (neglect, danger, secrecy an adult should know about).',
};

// Gentle, non-shaming redirect shown to the child on a Lane-1 block. Never
// echoes the flagged word; never scolds.
export const CHILD_REDIRECT = "Let's tell a different part of the story! What happens next?";

// -------------------------------------------------------------------------
// Seed-list fast path (Lane 1). A whole-word match against the committed
// hard_block terms. Unambiguous strong profanity/slurs can block immediately;
// everything else defers to the classifier. Deliberately conservative to avoid
// over-blocking imaginative play.
// -------------------------------------------------------------------------
export function seedScan(text, blocklist = DEFAULT_BLOCKLIST) {
  const lc = String(text).toLowerCase();
  for (const [category, terms] of Object.entries(blocklist.hard_block || {})) {
    if (!Array.isArray(terms)) continue; // skip _desc
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lc)) return { category, term };
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Lane 1 + Lane 2 — combined INPUT check (one classifier call).
// -------------------------------------------------------------------------
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    hard_block: {
      type: 'object',
      properties: {
        blocked: { type: 'boolean' },
        category: {
          type: 'string',
          enum: ['profanity', 'sexual', 'graphic_violence', 'slurs', 'self_harm_methods', 'none'],
        },
      },
      required: ['blocked', 'category'],
      additionalProperties: false,
    },
    flag_to_parent: {
      type: 'object',
      properties: {
        flagged: { type: 'boolean' },
        signals: {
          type: 'array',
          items: { type: 'string', enum: ['distress', 'harm_indicators', 'unsafe_situation'] },
        },
        passage: { type: 'string', description: "The exact concerning passage from the child's words, or empty." },
        note: { type: 'string', description: 'A neutral, descriptive note for the parent — never a diagnosis or conclusion.' },
      },
      required: ['flagged', 'signals', 'passage', 'note'],
      additionalProperties: false,
    },
  },
  required: ['hard_block', 'flag_to_parent'],
  additionalProperties: false,
};

const INPUT_SYSTEM = `You are Guardian, the always-on safety layer for Abra, a children's storytelling app. A child has spoken a story. Assess the child's words on TWO independent lanes. This is a creative tool, not a monitoring or safety-assessment product: you FLAG and DESCRIBE; you never diagnose, score the child, or draw conclusions.

LANE 1 — HARD BLOCK (explicit content that must never be turned into a storybook):
${Object.entries(HARD_BLOCK_CATEGORIES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Set hard_block.blocked=true with the matching category ONLY for genuinely explicit/graphic material. Over-blocking normal childhood imagination is itself a failure — it tells the child their story is "wrong," the exact harm Abra exists to prevent. A cowboy with a gun, a knight fighting a dragon, a scary monster, "I'm so mad I could scream" — all NORMAL, all pass. Tune toward precision, not maximal blocking. If nothing is explicit, blocked=false and category="none".

LANE 2 — FLAG TO PARENT (concerning content in ordinary words, expressed with NO "bad words"):
${Object.entries(LANE2_SIGNALS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
This lane does NOT block — it surfaces a private note to the child's parent. Set flag_to_parent.flagged=true when the story hints at distress, harm, or an unsafe situation a trusted adult should know about. Quote the exact concerning passage in "passage" and write a NEUTRAL, DESCRIPTIVE note ("This story mentioned X") — never a conclusion about the child, never advice, never a diagnosis. Err toward flagging when genuinely uncertain. Pure imaginative peril (monsters, battles, getting "eaten" by a dragon) is NOT distress — do not flag ordinary make-believe. The two lanes are independent: a story can be clean on Lane 1 and still flag on Lane 2, or vice versa.`;

function parseJSONContent(response) {
  const text = (response?.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text);
}

export async function checkInput(text, { client, model = 'claude-opus-5', blocklist = DEFAULT_BLOCKLIST } = {}) {
  if (!client) throw new Error('checkInput requires an injected Anthropic `client`.');

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: INPUT_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: INPUT_SCHEMA } },
    messages: [{ role: 'user', content: `Child's story:\n"""${text}"""` }],
  });
  const parsed = parseJSONContent(response);

  // Seed fast-path/backstop: an unambiguous committed term forces a block even
  // if the classifier missed it.
  const seed = seedScan(text, blocklist);
  const lane1 = { ...parsed.hard_block };
  if (seed && !lane1.blocked) {
    lane1.blocked = true;
    lane1.category = seed.category;
  }
  const blocked = lane1.blocked === true;

  const lane2 = parsed.flag_to_parent;
  return {
    lane1: { blocked, category: blocked ? lane1.category : null },
    lane2: {
      flagged: lane2.flagged === true,
      signals: Array.isArray(lane2.signals) ? lane2.signals : [],
      passage: lane2.passage || null,
      note: lane2.note || null,
    },
    // What the child sees on a block — a gentle redirect, never the flagged word.
    childMessage: blocked ? CHILD_REDIRECT : null,
  };
}

// -------------------------------------------------------------------------
// Lane 3 — OUTPUT screen. Clean input does not guarantee clean output; every
// generated artifact is screened for the Lane-1 categories before the child
// sees it. Anything failing is regenerated, not shown.
// -------------------------------------------------------------------------
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    safe: { type: 'boolean' },
    category: {
      type: 'string',
      enum: ['profanity', 'sexual', 'graphic_violence', 'slurs', 'self_harm_methods', 'none'],
    },
    reason: { type: 'string' },
  },
  required: ['safe', 'category', 'reason'],
  additionalProperties: false,
};

const OUTPUT_SYSTEM = `You are Guardian's output screen for Abra, a children's app. You are given a piece of GENERATED content that is about to be shown to a child — page text, narration, or an illustration description. Judge ONLY whether it is safe for a young child, using the same categories as the input hard-block:
${Object.entries(HARD_BLOCK_CATEGORIES).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Ordinary story content — imaginative peril, weapons-in-play, monsters, mild scariness — is SAFE. Set safe=false with the matching category only for genuinely explicit/graphic/inappropriate output; otherwise safe=true, category="none". Give a one-sentence reason.`;

export async function screenOutput(artifact, { client, model = 'claude-opus-5', kind = 'page_text' } = {}) {
  if (!client) throw new Error('screenOutput requires an injected Anthropic `client`.');
  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    system: OUTPUT_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: `Generated ${kind} to screen:\n"""${artifact}"""` }],
  });
  const parsed = parseJSONContent(response);
  return {
    safe: parsed.safe === true,
    category: parsed.safe ? null : parsed.category,
    reason: parsed.reason || '',
  };
}
