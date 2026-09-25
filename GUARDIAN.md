# Abra — Storyteller & Guardian

This document describes the two AI agents at the heart of Abra and how they are
evaluated.

> **Abra is a creative tool — NOT a monitoring, surveillance, or safety-assessment
> product.** Guardian surfaces concerns to a parent; it does not diagnose, score a
> child, make determinations, or contact anyone. This framing must be stated in
> the app and revisited with COPPA / child-safety counsel before any public launch.
>
> **Voice cloning is OFF and out of scope entirely** — the app does not ship it,
> Guardian does not enable it, and no demo shows it.

---

## The two agents

### Storyteller — bring a child's story to life *without tidying it*

Every LLM's default instinct is to smooth nonlinear, contradictory, or unfinished
kid-speech into a clean arc. Tidying tells a neurodivergent creative child that
their mind is "wrong" — the exact harm Abra exists to avoid. The Storyteller's
system prompt encodes 8 hard rules (preserve sequence; no imposed structure or
morals; keep the child's words; preserve retractions, contradictions, lists,
repetition, and non-endings) and emits **structured JSON pages** so its output is
machine-checkable.

- Code: [`src/agents/storyteller.js`](src/agents/storyteller.js)

### Guardian — the always-on, non-bypassable safety layer

Guardian is **architectural, not a feature**: it cannot be disabled and the child
cannot alter it. It runs **three lanes**, not one filter:

| Lane | Trigger | Action |
|---|---|---|
| **1 — Hard block** (input) | Explicit content (profanity, sexual, graphic violence, slurs, self-harm methods) | Refused at ingestion; never reaches the Storyteller. Child sees a gentle, non-shaming redirect — never the flagged word. **Floor-level, not parent-toggleable.** |
| **2 — Flag to parent** (input) | Concerning content in *ordinary words* (distress, harm, unsafe situation) | **Does NOT block.** Story processes normally; a private, descriptive note is surfaced to the parent dashboard — never to the child. |
| **3 — Screen output** | Every generated artifact (page text, narration, illustration) | Screened for the Lane-1 categories before the child sees it. Anything failing is regenerated, not shown. |

Guardian **flags and describes; it never diagnoses**. No third party is contacted;
Abra is not a mandated-reporter system and must not present itself as one. The
key nuance: **normal imaginative play must pass** — a cowboy with a gun, a scary
dragon, a sword fight are all normal. Over-blocking is itself a failure.

- Code: [`src/agents/guardian.js`](src/agents/guardian.js)
- Blocklist config: [`config/guardian_blocklist.json`](config/guardian_blocklist.json) — a **classifier + seed list**, not a pure wordlist. Structure is public and reviewable; raw term lists are intentionally minimal (the classifier is primary), keeping an exhaustive offensive dump out of repo history.

### The pipeline

[`src/agents/pipeline.js`](src/agents/pipeline.js) wires the lanes around the
Storyteller — the single, non-bypassable path a story takes:

```
child transcript
   ├─ Lane 1 checkInput → blocked? ─► gentle child redirect, STOP
   │                       flagged? ─► private note to parent dashboard (child continues)
   ▼
Storyteller.tellStory   (only clean input reaches it)
   ▼
Lane 3 screenOutput every page's text + illustration note
   │  unsafe? → regenerate once → re-screen → drop pages still unsafe
   ▼
storybook shown to the child
```

Lane-2 flags land in [`src/parentDashboard.js`](src/parentDashboard.js) (a simple
flag store — the spec says a v1 flag record is enough to prove the architecture).

---

## Output format

The child's story becomes an **illustrated, paged, narrated storybook**. After
the Storyteller's pages pass Guardian, four steps assemble the deliverable — and
only the first calls an LLM; the rest are deterministic (cheap, offline-tested):

| Step | File | Role |
|---|---|---|
| **Character Friend** | [`src/agents/characterFriend.js`](src/agents/characterFriend.js) | Produces a **stable, reusable character definition** per character: a `canonical` visual sentence + a deterministic `seed` (plus emoji/palette). Preserves contradictions (a dog both "biggest" and "pocket-sized" stays both). Held in a [character library](src/characterLibrary.js) so a character stays consistent across pages **and across stories**. |
| **Illustrator** | [`src/agents/illustrator.js`](src/agents/illustrator.js) | Builds each page's render spec by injecting the **same `canonical` verbatim** for every character on the page — the mechanism that keeps a character identical page to page. Output is the prompt a real image model consumes (swap the renderer, keep the spec). |
| **Narrator** | [`src/agents/narrator.js`](src/agents/narrator.js) | Per-page read-aloud script (the child's exact words). The demo plays it with the browser's speech synthesis; swap in real TTS later. |
| **Bookbinder** | [`src/agents/bookbinder.js`](src/agents/bookbinder.js) | Assembles the **Book**: characters + illustrated/narrated pages + layout variants + the premium stub. |

**V1 layouts (a view option, not a second generation path):**
- **Storybook** — full-page illustrated spreads (the core, filmed/shipped path).
- **Comic** — the *same* pages arranged as panels. Toggle in the child view.

**V2 — animation (premium, stubbed, not built):** a short animated clip is a paid
output. [`src/agents/animator.js`](src/agents/animator.js) is the clean extension
point — `animateBook(book)` throws NotImplemented and consumes the same reusable
character sheets (`canonical` + `seed`). It gates behind the RevenueCat
`full_access` entitlement or a credit pack (see [`src/main.js`](src/main.js)); the
demo shows a locked "Make it move — Premium" button.

> **Why character consistency is designed in from the start:** the same stable
> `canonical` + `seed` that keep the storybook coherent are exactly what a future
> animation step needs. Getting the character representation persistent and
> reusable now is what makes v2 animation viable later.

Offline proof of the deterministic layer: `npm run eval:output:offline`.

---

## Runnable demo (`npm run demo`)

A small Express server ([`server/index.mjs`](server/index.mjs)) runs a real story
end-to-end through the full pipeline and serves a two-view UI ([`demo/`](demo/)) —
built for filming the Next Gen video.

```bash
cp .env.example .env      # add ANTHROPIC_API_KEY (gitignored; server-side only)
npm run demo              # → http://localhost:8787
```

- **Endpoint** `POST /api/story` — body `{ text }` (single author) or
  `{ segments: [{author, text}, …] }` (co-writing). Returns the child-facing
  storybook **plus** a full lane-by-lane `trace`.
- **Child view** — just the story coming to life: title, byline, big warm pages
  with illustration frames and per-page author pills. No safety machinery. On a
  Lane-1 block the child sees only the gentle redirect.
- **Parent view** — the same run's safety trace: Lane 1 (passed/blocked), the
  Storyteller, Lane 3 per-page (passed/regenerated/dropped), and Lane 2 flags as
  they'd appear on the parent dashboard (flags accumulate across the session).
- **Co-writing mode** — two authors each write a segment; the hand-off is shown,
  the parts are brought to life as ONE story with **each page tagged by author**,
  and the seam is not smoothed / their differences not reconciled.

The Anthropic key stays **server-side only** — the browser talks only to the
local endpoint and never sees the key.

---

## Running the evals

Both suites mirror the Storyteller structure-preservation approach: small,
targeted cases, each with a **binary pass/fail tell**.

### Offline (no API key) — proves the eval logic itself

The deterministic checkers are unit-tested against hand-written good/bad fixtures,
so the eval logic is trustworthy even with no credentials:

```bash
npm run eval:offline
```

This runs both:
- `eval:storyteller:offline` — every structure-preservation checker passes on a
  structure-preserving fixture and fails on a tidied one (proves the checks
  discriminate).
- `eval:guardian:offline` — Lane-1 seed-scan catches committed terms but not the
  cowboy-with-a-gun; config shape and parent-dashboard store are sound.

### Live (needs Claude credentials)

Set a key first — the agents default to `claude-opus-5` (override with
`ABRA_MODEL`, e.g. a cheaper model for the Guardian classifier lanes):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run eval:storyteller     # runs the 5 structure cases through the real Storyteller
npm run eval:guardian        # runs the block / pass / flag test sets through Guardian
```

- Storyteller tells combine deterministic checks with an **LLM judge** (strict,
  adversarial) for the nuanced ones. A case passes only if **all** tells pass.
  Generated storybooks are written to `evals/storyteller/.out/<id>.json`.
- Guardian scoring: `block` cases must hard-block; `pass` cases must clear **both**
  lanes (no over-block, no over-flag); `flag` cases must flag without blocking.

### Extending the suites

When a real child's story breaks structure in a new way, add it as a case — a
real failure maps a gap in the taxonomy and is worth more than any invented one.
For Guardian, keep raw explicit/slur block-fixtures private (out of repo history),
same principle as the blocklist config.

---

## Deployment note — the SDK key never ships in the client

`@anthropic-ai/sdk` is a **devDependency**. The agents are pure, client-injectable
modules: the eval harness drives them in Node, and in the shipped app they must
run behind a **backend proxy** that holds the key. **Never embed the Anthropic
key in the Capacitor client bundle** — that would expose a secret credential to
every install. (This is separate from the RevenueCat *public* SDK key, which is
safe to ship; see [`README-TESTSTORE.md`](README-TESTSTORE.md).)

## Build-first order (hackathon scope)

1. **Lane 1 hard-block** + seed list — blocks explicit input, passes normal play. ✅
2. **Lane 3 output screening** on generated artifacts. ✅
3. **Lane 2 flag-to-parent** wired to the dashboard as a surfaced note. ✅

Lane 2's detection sophistication can grow post-hackathon; a basic
signal-flagging pass that surfaces to the parent is enough to demonstrate the
architecture and the principle.
