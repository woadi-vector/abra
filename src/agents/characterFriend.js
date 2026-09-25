// Abra — Character Friend agent
// ----------------------------------------------------------------------------
// Character consistency is make-or-break: the SAME character must render the
// same on every page of the storybook, and the definition must be REUSABLE by a
// future animation step (v2). So Character Friend produces a STABLE, persistent
// character definition from the child's story and holds it in a character
// library keyed by a stable id.
//
// The definition is built ONLY from the child's words, and — like the
// Storyteller — it PRESERVES CONTRADICTIONS: if the child says the dog is both
// the biggest and pocket-sized, the character IS both. We never average or
// reconcile; we instruct that both be shown. The `canonical` sentence is
// injected verbatim into every page's illustration prompt (by the Illustrator),
// which is the mechanism that keeps the character identical page to page.
//
// Two things make a character reusable by an animator later:
//   - `canonical`  — a single stable visual description string, and
//   - `seed`       — a deterministic integer for reproducible rendering.
// Both travel with the sheet wherever it goes.
// ----------------------------------------------------------------------------

// ---- deterministic visual identity (pure, no LLM) --------------------------
export function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'character'
  );
}

// FNV-1a → stable 32-bit seed. Same string ⇒ same seed, forever.
export function stableSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Placeholder-art emoji, matched on the character's NAME/SPECIES first. Patterns
// use a leading \b and an OPEN end so plurals/compounds match ("birds",
// "waffles", "rocket ship"). Order = most specific first. This is placeholder
// art ONLY — it never touches the Illustrator prompt a real image model consumes.
const SPECIES_EMOJI = [
  // --- people (specific so different people get different faces) ---
  [/\bspace ?man|astronaut|cosmonaut/, '👨‍🚀'],
  [/\bgrandpa|grandad|grandfather/, '👴'], [/\bgrandma|granny|grandmother/, '👵'],
  [/\bmom|mum|mother|mommy|mama/, '👩'], [/\bdad|father|daddy|papa/, '👨'],
  [/\bbab(?:y|ies)|infant|toddler/, '👶'],
  [/\bqueen/, '👸'], [/\bprincess/, '👸'], [/\bking/, '🤴'], [/\bprince/, '🤴'],
  [/\bwitch/, '🧙‍♀️'], [/\bwizard|sorcerer|mage/, '🧙'], [/\bfair(?:y|ies)|pixie/, '🧚'],
  [/\bknight/, '🤺'], [/\bpirate/, '🏴‍☠️'], [/\bninja/, '🥷'], [/\bsuperhero|\bhero/, '🦸'],
  [/\bteacher/, '🧑‍🏫'], [/\bdoctor|nurse/, '🧑‍⚕️'], [/\bfarmer/, '🧑‍🌾'],
  [/\bgirl/, '👧'], [/\bboy/, '👦'],
  [/\bwoman|lady|aunt|sister/, '👩'], [/\bman\b|\bguy|uncle|brother/, '👨'],
  [/\bkid|child|children|person|people|human/, '🧒'],
  // --- birds ---
  [/\bowl/, '🦉'], [/\bpenguin/, '🐧'], [/\beagle|hawk|falcon/, '🦅'], [/\bparrot|macaw/, '🦜'],
  [/\bduck/, '🦆'], [/\bswan/, '🦢'], [/\bchick|\bhen\b|rooster|chicken/, '🐔'],
  [/\bbird|robin|sparrow|crow|raven|finch|wren|pigeon/, '🐦'],
  // --- animals ---
  [/\bfox/, '🦊'], [/\bwol(?:f|ves)/, '🐺'], [/\bdog|puppy|puppies|pup\b/, '🐶'], [/\bcat|kitten|kitty/, '🐱'],
  [/\blion/, '🦁'], [/\btiger/, '🐯'], [/\bpanda/, '🐼'], [/\bkoala/, '🐨'], [/\bbear/, '🐻'],
  [/\belephant/, '🐘'], [/\bgiraffe/, '🦒'], [/\bzebra/, '🦓'], [/\bhorse|pony|ponies/, '🐴'], [/\bunicorn/, '🦄'],
  [/\bcow|cattle/, '🐮'], [/\bpig|piglet/, '🐷'], [/\bsheep|lamb/, '🐑'], [/\bgoat/, '🐐'],
  [/\bmonkey|ape|gorilla/, '🐵'], [/\bmouse|mice|\brat/, '🐭'], [/\bhamster/, '🐹'],
  [/\bbunny|bunnies|rabbit/, '🐰'], [/\bdeer|reindeer|fawn/, '🦌'],
  [/\bfrog|toad/, '🐸'], [/\bturtle|tortoise/, '🐢'], [/\bsnake|serpent/, '🐍'],
  [/\bfish|goldfish|minnow/, '🐟'], [/\bshark/, '🦈'], [/\bwhale/, '🐳'], [/\bdolphin/, '🐬'], [/\boctopus/, '🐙'], [/\bcrab/, '🦀'],
  [/\bbee\b|bumblebee/, '🐝'], [/\bbutterfl(?:y|ies)/, '🦋'], [/\bladybug/, '🐞'], [/\bspider/, '🕷️'], [/\bsnail/, '🐌'],
  [/\bt-?rex|raptor/, '🦖'], [/\bdino|dinosaur/, '🦕'], [/\bdragon/, '🐉'],
  [/\bmonster|creature|beast/, '👾'], [/\brobot|android|\bbot\b/, '🤖'], [/\balien/, '👽'], [/\bghost/, '👻'],
  // --- sky / space / weather ---
  [/\brocket|spaceship/, '🚀'], [/\bufo|flying saucer/, '🛸'],
  [/\bsun\b|sunshine/, '☀️'], [/\bmoon/, '🌙'], [/\bstar/, '⭐'], [/\bcomet|shooting star/, '☄️'],
  [/\bplanet/, '🪐'], [/\brainbow/, '🌈'], [/\bcloud/, '☁️'], [/\bsnow|snowflake/, '❄️'], [/\blightning|thunderbolt/, '⚡'],
  // --- vehicles / places / objects ---
  [/\bplane|airplane|\bjet\b/, '✈️'], [/\bhelicopter/, '🚁'], [/\btrain/, '🚂'], [/\bcar\b|automobile/, '🚗'], [/\btruck/, '🚚'],
  [/\bship|boat|sailboat|canoe|ferry/, '⛵'], [/\bsubmarine/, '🚤'], [/\bbike|bicycle/, '🚲'],
  [/\bcastle/, '🏰'], [/\bhouse|\bhome\b/, '🏠'], [/\bslide|playground/, '🛝'],
  [/\bteddy/, '🧸'], [/\bboot|shoe|sneaker/, '🥾'], [/\bcrown/, '👑'], [/\bsword/, '⚔️'], [/\bshield/, '🛡️'], [/\bwand/, '🪄'],
  [/\bbook/, '📖'], [/\bballoon/, '🎈'], [/\bkite/, '🪁'], [/\bball\b/, '⚽'],
  [/\bflower|rose|dais(?:y|ies)|tulip/, '🌸'], [/\btree/, '🌳'], [/\bmushroom/, '🍄'], [/\bcactus|cacti/, '🌵'],
  // --- food ---
  [/\bpizza/, '🍕'], [/\bcookie/, '🍪'], [/\bcake|cupcake/, '🎂'], [/\bapple/, '🍎'], [/\bbanana/, '🍌'],
  [/\bice ?cream/, '🍦'], [/\bcand(?:y|ies)|sweet/, '🍬'], [/\blollipop/, '🍭'], [/\bdo(?:ughnut|nut)/, '🍩'],
  [/\bwaffle|pancake|toast/, '🧇'], [/\bsoup|stew|broth/, '🍲'], [/\bbread|loaf/, '🍞'], [/\begg/, '🥚'], [/\bcheese/, '🧀'], [/\bpie\b/, '🥧'],
];

// Category-aware FALLBACK when nothing above matches — so a person is never
// rendered as an animal, a bird never as a bear, etc. Hashed by id so different
// unmatched characters get different stand-ins.
const PERSON_POOL = ['🧑', '👩', '👨', '🧒', '👧', '👦', '🧓', '👵', '👴', '🧑‍🦱', '👩‍🦰', '👨‍🦱', '🧕', '🧑‍🦰'];
const CELESTIAL_POOL = ['✨', '🌟', '⭐', '☁️', '🌙', '☀️', '🪐', '🌈', '💫'];
const FOOD_POOL = ['🍽️', '🍎', '🍪', '🥞', '🍲', '🧁', '🍩', '🍌', '🍬'];
const PLANT_POOL = ['🌱', '🌸', '🌳', '🍄', '🌵', '🌻', '🍀'];
const ANIMAL_POOL = ['🦊', '🐻', '🐰', '🐱', '🐶', '🐸', '🦉', '🐢', '🐨', '🐼', '🦁', '🐯', '🐮', '🐷'];
const OBJECT_POOL = ['✨', '🎁', '🧸', '🎈', '🪀', '🔮', '🪄', '🎨', '⭐'];
const NEUTRAL_POOL = ['✨', '🌈', '🎨', '🎀', '🌟', '💫', '🔵', '🟣', '🟢', '🟡'];

const CATEGORY_FALLBACK = [
  [/\b(?:person|people|human|boy|girl|kid|child|baby|man|woman|lady|guy|mom|dad|mum|grand\w*|aunt|uncle|sister|brother|cousin|prince|princess|king|queen|hero|giant|witch|wizard|fair(?:y|ies)|elf|angel|knight|pirate|astronaut|spaceman|farmer|teacher|doctor|nurse|friend|villain)\b/, PERSON_POOL],
  [/\b(?:sun|moon|star\w*|planet|sky|space|cosmic|galaxy|cloud\w*|rainbow|comet|snow\w*|storm|weather)\b/, CELESTIAL_POOL],
  [/\b(?:food|snack|meal|treat|fruit|veg\w*|dessert|soup|cake|candy|sweet|dinner|lunch|breakfast|pancake|waffle|pie|bread|cheese|egg\w*)\b/, FOOD_POOL],
  [/\b(?:flower\w*|tree\w*|plant\w*|leaf|leaves|forest|garden|mushroom\w*|bush|grass)\b/, PLANT_POOL],
  [/\b(?:animal\w*|creature\w*|beast\w*|pet\w*|cub|critter\w*|bug\w*|insect\w*|fish|bird\w*)\b/, ANIMAL_POOL],
  [/\b(?:toy\w*|ball\w*|balloon\w*|book\w*|box\w*|thing\w*|object\w*|robot\w*|machine\w*|car\w*|truck\w*|train\w*|boat\w*|ship\w*|house\w*|castle\w*|rock\w*|stone\w*|gem\w*|treasure|crown|sword|wand|key\w*)\b/, OBJECT_POOL],
];

const PALETTES = [
  ['#ffd6a5', '#fdffb6'], ['#caffbf', '#9bf6ff'], ['#a0c4ff', '#bdb2ff'],
  ['#ffc6ff', '#ffadad'], ['#ffe5ec', '#e0c3fc'], ['#d0f4de', '#a9def9'],
  ['#fde2e4', '#cddafd'], ['#fff1c1', '#c8e7ff'],
];

const orderedTokens = (str) =>
  String(str || '').toLowerCase().replace(/[()]/g, ' ').split(/[^a-z0-9']+/).filter(Boolean);

const firstMappedEmoji = (tokens) => {
  for (const t of tokens) {
    const hit = SPECIES_EMOJI.find(([re]) => re.test(t));
    if (hit) return hit[1];
  }
  return null;
};

export function pickEmoji(sheet) {
  // 1) Lead-noun match: scan the SPECIES tokens in order (then the NAME), taking
  //    the first that maps. Respecting the character's own word order fixes both:
  //    "star who is his mom" → ⭐ (a star), and "Grandpa house" (species: house)
  //    → 🏠 (not 👴 from the name).
  const emoji = firstMappedEmoji(orderedTokens(sheet.species)) || firstMappedEmoji(orderedTokens(sheet.name));
  if (emoji) return emoji;

  // 2) Multi-word patterns (e.g. "ice cream") + the canonical description.
  const full = `${sheet.species || ''} ${sheet.name || ''} ${sheet.canonical || ''}`.toLowerCase();
  const direct = SPECIES_EMOJI.find(([re]) => re.test(full));
  if (direct) return direct[1];

  // 3) Category-aware fallback — never a generic animal for a person, etc.
  const seed = stableSeed(sheet.id || sheet.name || 'x');
  for (const [re, pool] of CATEGORY_FALLBACK) {
    if (re.test(full)) return pool[seed % pool.length];
  }
  // 4) Neutral (sparkle/shape), never a specific animal.
  return NEUTRAL_POOL[seed % NEUTRAL_POOL.length];
}

export function pickPalette(sheet) {
  return PALETTES[stableSeed(`${sheet.id || sheet.name}:palette`) % PALETTES.length];
}

// Attach the deterministic, reusable render identity to an LLM-produced sheet.
export function withVisualIdentity(raw) {
  const id = slugify(raw.id || raw.name);
  const sheet = {
    id,
    name: raw.name,
    species: raw.species || '',
    canonical: raw.canonical,
    attributes: raw.attributes || {},
    contradictions: Array.isArray(raw.contradictions) ? raw.contradictions : [],
  };
  sheet.seed = stableSeed(id); // reproducible render seed — reused by a future animator
  sheet.emoji = pickEmoji(sheet);
  sheet.palette = pickPalette(sheet);
  return sheet;
}

// ---- the LLM agent ---------------------------------------------------------
const CHARACTER_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'short stable slug, e.g. "rocket" or "max_the_dog"' },
          name: { type: 'string' },
          species: { type: 'string', description: 'what it is: boy, fox, rocket ship, dragon…' },
          canonical: {
            type: 'string',
            description:
              'ONE stable visual sentence, injected verbatim into every page so the character looks identical each time. Written in the Style Bible\'s terms and locking fixed silhouette, fixed proportions, fixed SIGNATURE COLORS (warm contrasting accents where the child was silent, so extremities read against the background), and fixed distinguishing features. Include contradictory traits as both-true.',
          },
          attributes: {
            type: 'object',
            properties: {
              colors: { type: 'array', items: { type: 'string' } },
              features: { type: 'array', items: { type: 'string' } },
              size: { type: 'string' },
              clothing: { type: 'string' },
              expression: { type: 'string' },
            },
            required: ['colors', 'features', 'size', 'clothing', 'expression'],
            additionalProperties: false,
          },
          contradictions: {
            type: 'array',
            items: { type: 'string' },
            description: "Contradictions the child stated, kept both-true (e.g. 'biggest AND fits in a pocket').",
          },
        },
        required: ['id', 'name', 'species', 'canonical', 'attributes', 'contradictions'],
        additionalProperties: false,
      },
    },
  },
  required: ['characters'],
  additionalProperties: false,
};

const CHARACTER_SYSTEM = `You are the Character Friend for Abra, a children's storytelling app. Given a child's story and its storybook pages, identify the distinct characters (and important objects) that must be drawn, and produce ONE STABLE visual definition for each so the same character renders IDENTICALLY on every page — and can later be animated.

The art style is fixed by Abra's Style Bible: bright, cheerful hand-drawn children's storybook art — loose lively ink outline with full saturated watercolor fill, flat storybook lighting, clean bright paper. Write every "canonical" description in those terms.

ONE FIXED DESIGN per character. "canonical" is a single sentence, pasted verbatim into EVERY page prompt, so it must lock the design down in concrete, drawable terms:
- fixed SILHOUETTE — the overall shape you'd recognize in outline;
- fixed PROPORTIONS — head-to-body ratio, limb length, relative size;
- fixed SIGNATURE COLORS — specific named colors for the character's main parts;
- fixed DISTINGUISHING FEATURES — the 1–3 details that make this character unmistakably itself;
- fixed FULL FACE — if the character has a face, spell out its COMPLETE set of features (two eyes, a nose, a mouth, and the expression) so the face is always drawn whole. Never describe only a mouth or leave the face blank. If it wears a clear helmet, visor, or bubble, state that the full face is visible THROUGH it. Also pin HAIR — its colour AND style — for any character that has hair (e.g. "short tousled brown hair"), so it never changes colour or style from page to page.
Loose in rendering, identical in structure every single time. Each character is ONE individual — a single one of them, never a crowd or multiple copies — unless the child explicitly says there are several.

SIGNATURE COLORS — legibility rule (art direction, layered on top of the child's words):
- Keep every color the child explicitly stated; NEVER override or change a child's stated color.
- Where the child did NOT specify a color for a part that would otherwise sit on a same-hue background and get lost, PIN a fixed WARM contrasting accent (red, orange, or yellow) as that part's signature color, and keep it identical on every page. Example: a spaceman in blue space → red helmet ring + red gloves + orange boots, so his hands and feet always read against the blue. Contrast is guaranteed by design, not left to chance each render.
- Put the signature colors in BOTH "canonical" and attributes.colors.

Content rules (the child's story is sacred — unchanged):
- Base each character's identity, traits, and story details ONLY on the child's own words. Do not invent personality, backstory, or plot. The signature-color legibility pinning above is the ONLY thing you may add, and only where the child was silent about a color.
- PRESERVE CONTRADICTIONS, exactly like the Storyteller. If the child says the dog is both the biggest and pocket-sized, the character IS both — record both as true in "canonical" and in "contradictions", show both, never average, blend, or explain away.
- Keep the child's own descriptive words.
- Give each character a short stable "id" slug.
Return only the characters.`;

function parseCharacters(response) {
  const text = (response?.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = JSON.parse(text);
  return Array.isArray(parsed.characters) ? parsed.characters : [];
}

/**
 * Produce stable, reusable character sheets for a story and hold them in the
 * library. If a character id already exists in the library, the STORED sheet is
 * reused (the Character Friend "holds" a stable definition across the session).
 */
export async function describeCharacters({ story, pages }, { client, model = 'claude-opus-5', library } = {}) {
  if (!client) throw new Error('describeCharacters requires an injected Anthropic `client`.');
  const pagesText = (pages || []).map((p, i) => `Page ${i + 1}: ${p.text}`).join('\n');
  const response = await client.messages.create({
    model,
    max_tokens: 3000,
    system: CHARACTER_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: CHARACTER_SCHEMA } },
    messages: [
      { role: 'user', content: `Child's story:\n"""${story}"""\n\nStorybook pages:\n${pagesText}` },
    ],
  });

  const raw = parseCharacters(response);
  return raw.map((r) => {
    const fresh = withVisualIdentity(r);
    if (library) {
      const held = library.get(fresh.id);
      if (held) return held; // reuse the stable, previously-held definition
      library.upsert(fresh);
    }
    return fresh;
  });
}
