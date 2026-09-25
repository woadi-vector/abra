// LLM-as-judge for the nuanced Storyteller tells that a regex cannot honestly
// check (e.g. "contradictions left standing, not blended"). Deliberately strict
// and adversarial: default to FAIL unless the single criterion is clearly met.

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['pass', 'reason'],
  additionalProperties: false,
};

const JUDGE_SYSTEM = `You are a strict, adversarial evaluator for Abra's Storyteller. The Storyteller's job is to turn a child's spoken story into storybook pages WITHOUT tidying it — preserving nonlinearity, contradictions, retractions, repetition, lists, and non-endings exactly as the child spoke them.

You check exactly ONE binary criterion at a time. Rules:
- Judge only the given criterion. Ignore spelling, art quality, and everything else.
- Default to pass=false unless the output CLEARLY satisfies the criterion.
- "Tidying" in any form — resolving, explaining, blending, moralizing, reordering, trimming rhythm, inventing an ending — is a FAIL when the criterion targets it.
- Give a one-sentence reason citing the specific page or wording.`;

function parseVerdict(response) {
  const text = (response?.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = JSON.parse(text);
  return { pass: Boolean(parsed.pass), reason: String(parsed.reason ?? '') };
}

export async function judgeTell({ client, model }, { transcript, tellName, ask, storybook }) {
  const user =
    `Child's original spoken transcript:\n"""${transcript}"""\n\n` +
    `Storyteller output (JSON storybook pages):\n${JSON.stringify(storybook, null, 2)}\n\n` +
    `CRITERION — "${tellName}":\n${ask}\n\n` +
    `Does the output clearly satisfy this criterion? Set pass=true only if it clearly does.`;

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: JUDGE_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
    messages: [{ role: 'user', content: user }],
  });
  return parseVerdict(response);
}
