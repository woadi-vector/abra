// Build a key-free STATIC judge demo into ./docs (GitHub Pages "deploy from
// /docs"). It plays the two pre-rendered hero stories with NO backend and NO API
// keys: images are copied in, book data is bundled as JSON, image URLs are made
// relative, and a representative parent-dashboard flag is attached for the safety
// beat. Styling is reused from demo/index.html so the two stay in sync.
//
//   node scripts/build-static-demo.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
mkdirSync(join(DOCS, 'stories'), { recursive: true });
mkdirSync(join(DOCS, 'art'), { recursive: true });

const HEROES = [
  { slug: 'spaceman', key: '2bdbcb5d0117da28' },
  { slug: 'cowrite', key: 'e86bb8811d43f3ad' },
];

// Representative Lane-2 flag for the parent dashboard (descriptive, not a diagnosis).
const SAMPLE_FLAGS = [
  {
    id: 'flag_1',
    createdAt: '2026-02-18T09:14:00Z',
    signals: ['recurring_theme_of_loss', 'being_left_alone'],
    passage: '…and then everyone went away and the little fox was all alone in the dark and nobody came back…',
    note: 'A recurring theme of loss and being left alone has appeared across several recent stories. This is a descriptive note shared so you can gently check in — not a diagnosis or a conclusion about your child.',
    reviewed: false,
  },
];

for (const { slug, key } of HEROES) {
  const srcDir = join(ROOT, '.art', 'served', key);
  const result = JSON.parse(readFileSync(join(srcDir, 'book.json'), 'utf8'));
  // strip local absolute paths, attach the dashboard flag for the parent view
  if (result.book && result.book.art) delete result.book.art.outDir;
  result.dashboardFlags = SAMPLE_FLAGS;
  // make every /art/... URL relative for GitHub Pages
  const json = JSON.stringify(result).split('/art/').join('art/');
  writeFileSync(join(DOCS, 'stories', `${slug}.json`), json);

  // copy the page + character images this story references
  const outArt = join(DOCS, 'art', key);
  mkdirSync(outArt, { recursive: true });
  let n = 0;
  for (const f of readdirSync(srcDir)) {
    if (/^(page-\d+|char-.+)\.png$/.test(f)) { copyFileSync(join(srcDir, f), join(outArt, f)); n++; }
  }
  console.log(`✓ ${slug} [${key}] — ${result.book.pages.length} pages, ${n} images copied`);
}

// index.html — reuse demo styling, static body
const style = (readFileSync(join(ROOT, 'demo', 'index.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Abra — story demo</title>
    ${style}
  </head>
  <body>
    <div class="wrap">
      <header>
        <h1>Abra ✨</h1>
        <p>Every child makes their own story. Tell it out loud — Abra brings it to life without tidying it, and Guardian keeps it safe.</p>
      </header>

      <div class="center">
        <div class="segmented" id="storybar">
          <button data-story="spaceman" class="active">🚀 The Spaceman</button>
          <button data-story="cowrite">✍️ Co-written · Rocket</button>
        </div>
      </div>

      <div class="callout">
        <span class="ic">👀</span>
        <div>A live preview of two example stories brought to life by Abra — flip between the <b>child view</b> and the <b>parent (Guardian) view</b>. The full app adds <b>voice input</b> and on-the-fly generation of any story a child tells.</div>
      </div>

      <div class="viewbar show" id="viewbar">
        <div class="segmented">
          <button data-view="child" class="active" id="view-child">👦 Child view</button>
          <button data-view="parent" id="view-parent">👪 Parent view</button>
        </div>
      </div>

      <div class="stage" id="stage-child"></div>
      <div class="stage" id="stage-parent"></div>

      <p class="hint">
        Abra is a creative storytelling tool — not a monitoring or safety-assessment product.
        Guardian surfaces concerns to a parent; it does not diagnose or make determinations about a child.
        Voice cloning is not part of Abra.
      </p>
    </div>

    <div class="modal-bg" id="premium-modal">
      <div class="modal">
        <div class="lock">🎬🔒</div>
        <h3>Make it move — Premium</h3>
        <p id="premium-msg">Short animated clips are a premium Abra output.</p>
        <div>
          <span class="pill" id="premium-sub">Unlock with a subscription</span>
          <span class="pill" id="premium-credits">or a credit pack</span>
        </div>
        <p style="margin-top:14px;font-size:12px">Coming in v2. The same characters from your storybook — kept consistent — are what make animation possible.</p>
        <button class="close" id="premium-close">Back to the story</button>
      </div>
    </div>

    <script src="app.js"></script>
  </body>
</html>
`;
writeFileSync(join(DOCS, 'index.html'), indexHtml);
writeFileSync(join(DOCS, '.nojekyll'), ''); // let GitHub Pages serve files as-is
console.log('✓ docs/index.html + .nojekyll written');
console.log('\nStatic demo built → ./docs  (app.js is committed source, not generated)');
