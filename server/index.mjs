// Abra demo server — runs a real story end-to-end through the full pipeline
// (all three Guardian lanes + the Storyteller) and returns the child-facing
// storybook PLUS a visible lane-by-lane trace for the parent view.
//
//   npm run demo         # then open http://localhost:8787
//
// The Anthropic key stays SERVER-SIDE ONLY — read from env (a gitignored .env),
// never sent to the client. The browser talks only to this endpoint.

import 'dotenv/config';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createParentDashboard } from '../src/parentDashboard.js';
import { createCharacterLibrary } from '../src/characterLibrary.js';
import { hasImageKey } from '../src/agents/imageRenderer.js';
import { makeClient, hasCredentials, DEFAULT_MODEL } from '../evals/lib/anthropic.js';
import { getRenderedStory, editCharacter, ART_ROOT } from './artStore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, '..', 'demo')));
// Rendered page/character art (ink-and-watercolor), written by the render cache.
app.use('/art', express.static(ART_ROOT));

// One dashboard for the whole demo session, so Lane-2 flags accumulate and can
// be filmed building up on the parent view.
const dashboard = createParentDashboard();
// Seed one representative Lane-2 flag so the parent dashboard has an accumulated
// example to show during the safety beat (a descriptive note, never a diagnosis).
dashboard.addFlag({
  storyText: 'and then everyone went away and the little fox was all alone in the dark and nobody came back and it was the third time this happened',
  signals: ['recurring_theme_of_loss', 'being_left_alone'],
  passage: '…and then everyone went away and the little fox was all alone in the dark and nobody came back…',
  note: 'A recurring theme of loss and being left alone has appeared across several recent stories. This is a descriptive note shared so you can gently check in — not a diagnosis or a conclusion about your child.',
});
// Character Friend holds stable, reusable character definitions across the
// session (consistent art page-to-page; reusable by the v2 animation step).
const characters = createCharacterLibrary();
const client = hasCredentials() ? makeClient() : null;

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: DEFAULT_MODEL, credentials: hasCredentials(), art: hasImageKey() });
});

// POST /api/story
//   single author:  { "text": "..." }
//   co-writing:     { "segments": [ { "author": "Dad", "text": "..." }, ... ] }
app.post('/api/story', async (req, res) => {
  if (!client) {
    return res.status(400).json({
      error:
        'No Claude credentials on the server. Create a .env with ANTHROPIC_API_KEY=... (see .env.example) and restart.',
    });
  }
  const { text, segments } = req.body || {};
  const hasSegments = Array.isArray(segments) && segments.some((s) => s && String(s.text || '').trim());
  if (!hasSegments && !String(text || '').trim()) {
    return res.status(400).json({ error: 'Provide `text` (single author) or non-empty `segments` (co-writing).' });
  }

  try {
    const payload = hasSegments
      ? { segments: segments.filter((s) => s && String(s.text || '').trim()).map((s) => ({ author: String(s.author || 'Anonymous'), text: String(s.text) })) }
      : { text: String(text) };

    // Renders real art (Character Friend refs + per-page conditioning) on first
    // run, then serves the cached images on every later view of the same story.
    const { result, key, cached } = await getRenderedStory(payload, {
      client,
      model: DEFAULT_MODEL,
      dashboard,
      library: characters,
    });
    // `key` lets the client target cast edits at this exact rendered story.
    res.json({ ...result, key, model: DEFAULT_MODEL, cached, dashboardFlags: dashboard.listFlags() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Edit a cast member's look and re-render the pages they appear on.
//   { key, characterId, instruction }
app.post('/api/character-edit', async (req, res) => {
  const { key, characterId, instruction } = req.body || {};
  if (!key || !characterId || !String(instruction || '').trim()) {
    return res.status(400).json({ error: 'Provide key, characterId, and a non-empty instruction.' });
  }
  if (!hasImageKey()) {
    return res.status(400).json({ error: 'No image generation key configured on the server.' });
  }
  try {
    const { result, key: k, edited } = await editCharacter({ key, characterId, instruction: String(instruction) });
    res.json({ ...result, key: k, edited, model: DEFAULT_MODEL, dashboardFlags: dashboard.listFlags() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/flags', (req, res) => res.json({ flags: dashboard.listFlags() }));

app.listen(PORT, () => {
  console.log(`\nAbra demo running → http://localhost:${PORT}`);
  console.log(`Model: ${DEFAULT_MODEL}`);
  if (!hasCredentials()) {
    console.log('\n⚠  No ANTHROPIC_API_KEY found. Create a .env (see .env.example) so the demo can call Claude.');
  }
  console.log('');
});
