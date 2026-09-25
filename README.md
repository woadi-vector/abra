# Abra ✨

**A children's storytelling app that brings a kid's story to life — without tidying it up.**

A child tells a story out loud. Abra turns it into an illustrated, narrated,
flip-through storybook. The one rule that makes Abra different: **it does not fix
the story.**

> **Abra is a creative storytelling tool — not a monitoring, surveillance, or
> safety-assessment product.** Its Guardian safety layer surfaces concerns to a
> parent; it does not diagnose, score a child, or make determinations about
> anyone. **Voice cloning is not part of Abra** — it is not shipped, not enabled,
> and not demonstrated.

### ▶ Try it (no install)

**Live preview → https://woadi-vector.github.io/abra/**

A key-free static preview of two finished example stories — **The Spaceman** and a
**co-written** story ("Rocket") — with both the child view and the parent (Guardian)
view. Flip between **Storybook** and **Comic**, press **Read to me**, and open the
**Parent view** to see the three safety lanes. The full app (this repo) adds live
**voice input** and on-the-fly generation of any story a child tells.

---

## The thesis: don't tidy the story

Every LLM's default instinct is to smooth a child's nonlinear, contradictory, or
unfinished speech into a clean three-act arc — add a moral, resolve the loose
threads, fix the "logic." For a neurodivergent, creative child, that tidying
sends one message: *your mind is wrong.* That is the exact harm Abra exists to
avoid.

So Abra's **Storyteller** is built to hold structure, not fix it:

- Preserve the child's actual sequence of events, even if nonlinear or repetitive.
- No imposed structure, no added moral, no resolved loose threads.
- Keep the child's own words.
- Preserve false starts and retractions — *"The end. Wait — no."* is its own page.
- Never reconcile contradictions — a dog that's both "the biggest" and
  "pocket-sized" stays both.
- Keep repetition at full length — *"up and up and up and up and up"* stays five ups.
- An unfinished story stays unfinished — if it trails off on *"and then"*, that's
  the last page. Never invent an ending.

---

## Architecture

```
child tells a story (one author, or co-written by two, even from a distance)
      │
      ▼
  GUARDIAN — Lane 1: hard-block explicit input   ──► gentle child redirect, stop
             Lane 2: flag concerning content     ──► private note to the parent
      │                                                 (child's story continues)
      ▼
  STORYTELLER — pages, in the child's words, structure held
      │
      ▼
  GUARDIAN — Lane 3: screen every generated page before the child sees it
      │
      ▼
  CHARACTER FRIEND → ILLUSTRATOR → NARRATOR → BOOKBINDER
      │  (stable, reusable characters ⇒ consistent art on every page)
      ▼
  an illustrated, narrated storybook  (storybook layout · comic layout)
```

### Guardian — the always-on safety layer (three lanes, not one filter)

Guardian is **architectural, not a feature**: it cannot be disabled and the child
cannot alter it.

| Lane | Trigger | Action |
|---|---|---|
| **1 — Hard block** (input) | Explicit content (profanity, sexual, graphic violence, slurs, self-harm methods) | Refused at ingestion; never reaches the Storyteller. **Not parent-toggleable.** Normal imaginative play — a cowboy with a gun, a scary dragon — must pass. |
| **2 — Flag to parent** (input) | Concerning content in *ordinary words* (distress, harm, unsafe situation) | **Does not block.** Story processes normally; a private, descriptive note is surfaced to the parent — never to the child. Guardian flags and describes; it never diagnoses. |
| **3 — Screen output** | Every generated page/illustration/narration | Screened before the child sees it; anything unsafe is regenerated, not shown. |

### Storyteller & output format

The Storyteller emits structured pages (in the child's words); then **Character
Friend** builds a stable, reusable character definition (so the same character
renders identically on every page — and can be reused by a future animation
step), **Illustrator** turns each page into a character-consistent art spec,
**Narrator** provides read-aloud, and **Bookbinder** assembles the book. The same
pages support two V1 layouts — **storybook** (default) and **comic** — and a
V2 **premium animated clip** (stubbed, gated behind subscription/credits — not
built).

### Character consistency & art direction

Real illustrations are rendered with **Google Gemini image generation**
(`gemini-2.5-flash-image`), server-side. Two mechanisms keep every page on-model:

- **Reference-image conditioning** — Character Friend's stable `canonical`
  description is rendered once into a **reference image per character**; that
  reference is then passed as *image input* into every page the character appears
  on, so the character holds its design from page to page. For maximum fidelity the
  renderer can also **composite** a matted character cut-out (from a small set of
  approved poses) onto a generated, character-free background — locking the
  character's exact pixels across the whole book while poses still vary.
- **One art-direction spec** — a single injectable **[STYLE_BIBLE.md](STYLE_BIBLE.md)**
  (bright, cheerful hand-drawn ink line with saturated watercolor fill, flat
  storybook lighting) is prepended to *every* generation, so the whole book reads
  as one consistent hand.

If no image key is set, rendering is skipped and the demo falls back to placeholder
art — it never breaks.

Full detail: **[GUARDIAN.md](GUARDIAN.md)**.

---

## Run it

Prerequisites: **Node 18+**. Full reproducibility notes (including the RevenueCat
MCP workaround): **[SETUP.md](SETUP.md)**.

```bash
npm install
cp .env.example .env        # ANTHROPIC_API_KEY (required) + GEMINI_API_KEY (optional, real art)
npm run demo                # → http://localhost:8787
```

Both keys are **server-side only** — read from the environment, never hardcoded,
never in the client bundle. `GEMINI_API_KEY` is optional; without it the demo falls
back to placeholder art.

**Voice is the primary input** — a child taps **🎤 Speak your story** and tells it
out loud (Web Speech API; **Chrome** + mic permission). Typing and **Try an
example** always work as fallbacks. The transcript is captured **raw** — Abra
never pre-cleans the child's words on the client (Chrome's recognizer may drop
some filler on its side; that's surfaced in the UI).

The demo has two views off the same run:
- **Child view** — the story coming to life: cast, pages, narration, layout toggle.
  No safety machinery visible.
- **Parent view** — the same run's safety trace (all three Guardian lanes) and
  any parent flags.

Plus a **co-writing** mode (two authors → one story, each page attributed).

> The Anthropic **and Gemini** keys are **server-side only** — read from the
> environment, never hardcoded, and never in the client bundle. The only key on the
> client is the RevenueCat **public** `test_` SDK key, which is designed to ship.

---

## Evals

Two suites, each with small, targeted cases and a binary pass/fail tell.

```bash
npm run eval:offline        # no API key needed — proves the eval logic itself
npm run eval:storyteller    # live: 5 structure-preservation cases (+ LLM judge)
npm run eval:guardian       # live: block / pass-normal-play / flag test sets
```

What they prove:
- **Storyteller** — structure preservation: retraction survives, non-endings stay
  unfinished, contradictions stay both-true, lists stay lists, repetition stays
  full-length. The deterministic checkers are unit-tested against good/bad
  fixtures, so the eval logic is trustworthy even offline.
- **Guardian** — the three lanes: explicit input blocks, **normal imaginative
  play passes both lanes**, concerning-in-ordinary-words flags to the parent
  without blocking, and output screening catches unsafe generations.
- **Output** — character consistency, layouts, narration, and the premium stub.

---

## Monetization

Abra uses **RevenueCat** (Test Store) for a subscription (`full_access`,
unlimited renders) plus a consumable credit pack. The premium **animated-clip**
output is gated behind that entitlement / a credit pack. See
[README-TESTSTORE.md](README-TESTSTORE.md).

---

## Judge demo (static, key-free)

The [`docs/`](docs/) folder is a **self-contained static build** that plays the two
pre-rendered example stories with **no backend and no API keys** — safe to host
publicly (no key exposure, no per-visitor cost). Enable it as a demo link:

1. In the GitHub repo: **Settings → Pages → Build and deployment → Deploy from a
   branch → `main` / `docs`** → Save.
2. Wait for the Pages build, then share the URL (`https://<user>.github.io/<repo>/`).

To rebuild it after re-rendering art:

```bash
node scripts/build-static-demo.mjs   # regenerates docs/ from the rendered stories
```

## License & credits

[MIT](LICENSE) — open source. Abra is a product of **King Crawler, LLC** (copyright
holder). Created by Jason Wold.
