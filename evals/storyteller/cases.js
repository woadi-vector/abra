// Abra — Storyteller Structure-Preservation Eval Suite
// ----------------------------------------------------------------------------
// Each case isolates ONE tidying instinct and has binary pass/fail "tells".
// Tells come in two kinds:
//   - type: 'code'  → a pure function over the Storyteller output. Deterministic,
//                     runs offline, and is itself unit-tested against fixtures.
//   - type: 'judge' → a natural-language criterion an LLM judge rules on. Used
//                     only for the nuanced tells a regex cannot honestly check.
//
// A case PASSES only if every tell passes (code + judge). See run.mjs / the
// scoring in the eval doc: one failing tell names exactly which instinct crept in.
// ----------------------------------------------------------------------------

import {
  textOf,
  notesOf,
  allTextOf,
  lastPageText,
  pageIndexMatching,
  countMatches,
  result,
} from './util.js';

export const CASES = [
  // -------------------------------------------------------------------------
  {
    id: 'bongo',
    name: 'Bongo',
    traps: 'self-interruption, circling-back, absurd logic',
    // Constructed from the eval-doc summary: robot Bongo / land-shark also named
    // Bongo / grandma's pancakes / 100-year tail repair / "The end. Wait — no." /
    // moon revealed as always-having-been-there.
    transcript:
      "Okay so there's a robot and his name is Bongo and he has a jetpack and the " +
      'jetpack is blue. And there is also a shark but he is a land shark and he walks ' +
      'on the ground and his name is Bongo too. Bongo the robot flies up with his blue ' +
      'jetpack, up and up with the blue jetpack. They go to grandma house and grandma ' +
      'makes pancakes and the pancakes are for the shark. Then the tail breaks and it ' +
      'takes a hundred years to fix the tail. A hundred whole years. The end. Wait — no. ' +
      'It was the moon the whole time. The moon was always there.',
    tells: [
      {
        name: 'retraction survives as its own beat BEFORE the moon',
        type: 'code',
        run: (out) => {
          const waitIdx = pageIndexMatching(out, /wait/i);
          const waitHasNo = waitIdx !== -1 && /\bno\b/i.test(String(out.pages[waitIdx].text));
          const moonIdx = pageIndexMatching(out, /moon/i);
          const pass = waitIdx !== -1 && waitHasNo && moonIdx !== -1 && waitIdx < moonIdx;
          return result(
            pass,
            `retraction page #${waitIdx} (has "no": ${waitHasNo}), moon page #${moonIdx}`
          );
        },
      },
      {
        name: 'blue-jetpack repetition kept',
        type: 'code',
        run: (out) => {
          const t = textOf(out);
          const jet = countMatches(t, /jetpack/gi);
          const blue = countMatches(t, /\bblue\b/gi);
          const pass = jet >= 2 && blue >= 2;
          return result(pass, `jetpack×${jet}, blue×${blue} (need ≥2 each)`);
        },
      },
      {
        name: 'both Bongos (robot AND land shark) kept as two characters',
        type: 'judge',
        ask:
          'Both a robot named Bongo and a separate land shark also named Bongo must ' +
          'appear as two distinct characters. Fail if they were merged into one ' +
          'character or if either was renamed or dropped.',
      },
      {
        name: 'moon reveal framed as always-having-been-there (not a tidy resolution)',
        type: 'judge',
        ask:
          'The ending must reveal that it was the moon the whole time / the moon was ' +
          'always there — kept as the abrupt kid-logic reveal it is. Fail if the ending ' +
          'was turned into a neat resolution, a moral, or an explanation of the earlier events.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'bike-girl',
    name: 'Bike Girl',
    traps: 'the urge to resolve',
    transcript:
      'There\'s a girl and she has a bike and the bike is red and she rides it to the ' +
      'store to get gum but the store is closed so she rides to the park and there\'s a ' +
      'duck and the duck wants the gum but she doesn\'t have gum because the store was ' +
      'closed and then',
    tells: [
      {
        name: 'final page ends on "and then" with nothing after',
        type: 'code',
        run: (out) => {
          const t = lastPageText(out).trim().replace(/[.!?…"']+$/g, '').trim();
          const pass = /\band then$/i.test(t);
          return result(pass, `last page ends: "…${t.slice(-24)}"`);
        },
      },
      {
        name: 'no invented resolution words',
        type: 'code',
        run: (out) => {
          const t = allTextOf(out);
          const re = /went home|shared the gum|gave the duck|they lived|happily|the end\b|found some gum|got the gum/i;
          const m = t.match(re);
          return result(!m, m ? `found forbidden resolution: "${m[0]}"` : 'no resolution language');
        },
      },
      {
        name: 'illustrates a non-ending — no fabricated conclusion',
        type: 'judge',
        ask:
          'The story must stop mid-sentence on "and then" with no resolution invented ' +
          'after it. Fail if any ending was added — she goes home, she shares/finds gum, ' +
          'the duck is satisfied, a moral, or any closing that "finishes" the story.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'max',
    name: 'Max the Dog',
    traps: 'the urge to reconcile contradiction',
    transcript:
      "My dog is named Max. He's a really big dog, the biggest. He's brown. Max fits in " +
      "my pocket because he's so tiny. He's the biggest dog and also he's black. We got " +
      "him yesterday but I've had him forever since I was a baby.",
    tells: [
      {
        name: 'both halves of every contradiction survive (size, color, time)',
        type: 'code',
        run: (out) => {
          const t = allTextOf(out);
          const groups = {
            big: /biggest|\bbig\b/i.test(t),
            small: /pocket|tiny|\bsmall\b/i.test(t),
            brown: /brown/i.test(t),
            black: /black/i.test(t),
            yesterday: /yesterday/i.test(t),
            forever: /forever|since i was a baby|\bbaby\b|always/i.test(t),
          };
          const missing = Object.entries(groups).filter(([, v]) => !v).map(([k]) => k);
          return result(missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all six halves present');
        },
      },
      {
        name: 'contradictions left standing — no blending or explaining-away',
        type: 'judge',
        ask:
          'Every contradiction (biggest AND pocket-sized, brown AND black, got him ' +
          'yesterday AND had him forever) must be kept with BOTH halves true and ' +
          'unreconciled, in the page text AND the illustration notes. Fail if any ' +
          'contradiction was blended (e.g. "brownish-black"), explained away ("looks ' +
          'big but is small", "big personality"), or resolved to one side.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'dinosaurs',
    name: 'Dinosaurs',
    traps: 'the urge to add plot',
    transcript:
      "Dinosaurs. There's a red one. And a blue one. And one with a long neck. And one " +
      "that flies but it's not actually a dinosaur my teacher said but I like it anyway. " +
      "And a baby one. And a mean one. And that's all the dinosaurs. Spikes. Some have spikes.",
    tells: [
      {
        name: 'teacher tangent preserved',
        type: 'code',
        run: (out) => {
          const pass = /teacher/i.test(allTextOf(out));
          return result(pass, pass ? 'teacher tangent present' : 'teacher tangent dropped');
        },
      },
      {
        name: '"spikes" kept as a separate afterthought at the end',
        type: 'code',
        run: (out) => {
          const pass = /spike/i.test(lastPageText(out));
          return result(pass, pass ? 'last page is the spikes afterthought' : 'spikes not at the end');
        },
      },
      {
        name: 'no narrative imposed on the list',
        type: 'code',
        run: (out) => {
          const t = textOf(out);
          const re = /one day|went on|adventure|journey|met the|became friends|set off|and so they/i;
          const m = t.match(re);
          return result(!m, m ? `plot language crept in: "${m[0]}"` : 'stayed a list');
        },
      },
      {
        name: 'stays a list / inventory, not a story',
        type: 'judge',
        ask:
          'This is a list of dinosaurs, not a plot. It must stay a list — no events, no ' +
          '"one day the red one met the blue one", no relationships invented between the ' +
          'dinosaurs. The teacher tangent stays, and "Spikes. Some have spikes." stays a ' +
          'separate afterthought at the end (not folded into earlier descriptions).',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 'spaceman',
    name: 'Spaceman',
    traps: 'the urge to neaten rhythm / repetition',
    transcript:
      'So the spaceman goes up and up and up and up and up past the clouds and past the ' +
      'birds and past a plane and the plane says hi and he goes up more and up and there\'s ' +
      'a star and the star is his mom and he\'s so happy and they eat space soup together ' +
      'forever and ever and ever and ever.',
    tells: [
      {
        name: 'the five-up run preserved at full length',
        type: 'code',
        run: (out) => {
          const t = textOf(out);
          // "up and up and up and up and up" = up + four " and up" repeats.
          const pass = /\bup(\s*,?\s*and\s+up){4,}/i.test(t) || countMatches(t, /\bup\b/gi) >= 5;
          return result(pass, `standalone "up"×${countMatches(t, /\bup\b/gi)} (need the 5-run kept)`);
        },
      },
      {
        name: '"forever and ever and ever and ever" kept full-length',
        type: 'code',
        run: (out) => {
          const t = textOf(out);
          const pass = /ever(\s+and\s+ever){3,}/i.test(t) || countMatches(t, /\bever\b/gi) >= 4;
          return result(pass, `standalone "ever"×${countMatches(t, /\bever\b/gi)} (need 4-run kept)`);
        },
      },
      {
        name: '"the star is his mom" stated flatly, not made metaphorical',
        type: 'judge',
        ask:
          'The line "the star is his mom" must be stated flatly and literally, exactly as ' +
          'the child said it. Fail if it was softened or turned into a metaphor ("the star ' +
          'reminded him of his mom", "like a mother watching over him", "a mother\'s love").',
      },
    ],
  },
];

export const CASES_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));
