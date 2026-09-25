// Abra demo — talks only to the local server (/api/story). The Anthropic key
// lives on the server; the browser never sees it.

const $ = (id) => document.getElementById(id);
let lastResult = null;
let currentBook = null;
let bookById = {};
let currentKey = null; // the rendered-story key, for targeting cast edits
let editTargetId = null;
let layout = 'storybook';
let speaking = false;

// Clear any rendered story/book/cast/trace and return to just the composer.
function resetOutput() {
  stopNarration();
  stopListening();
  currentBook = null;
  lastResult = null;
  layout = 'storybook';
  $('stage-child').innerHTML = '';
  $('stage-parent').innerHTML = '';
  $('stage-child').classList.remove('show');
  $('stage-parent').classList.remove('show');
  $('viewbar').classList.remove('show');
  $('view-child')?.classList.add('active');
  $('view-parent')?.classList.remove('active');
}

// Empty every composer input + status line.
function clearComposers() {
  ['single-author', 'single-text', 'a1-name', 'a1-text', 'a2-name', 'a2-text'].forEach((id) => {
    const el = $(id);
    if (el) el.value = '';
  });
  ['status-single', 'status-cowrite'].forEach((id) => {
    const el = $(id);
    if (el) { el.textContent = ''; el.className = 'status'; }
  });
}

// ---- mode toggle (single / cowrite) ----------------------------------------
$('modebar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn || btn.classList.contains('active')) return; // no-op if the mode didn't change
  [...$('modebar').children].forEach((b) => b.classList.toggle('active', b === btn));
  const single = btn.dataset.mode === 'single';
  $('composer-single').style.display = single ? '' : 'none';
  $('composer-cowrite').style.display = single ? 'none' : '';
  // Switching modes starts fresh: clear the story, book, cast, trace, and inputs.
  resetOutput();
  clearComposers();
});

// ---- view toggle (child / parent) ------------------------------------------
$('viewbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  setView(btn.dataset.view);
});
function setView(view) {
  $('view-child').classList.toggle('active', view === 'child');
  $('view-parent').classList.toggle('active', view === 'parent');
  $('stage-child').classList.toggle('show', view === 'child');
  $('stage-parent').classList.toggle('show', view === 'parent');
}

// ---- examples --------------------------------------------------------------
$('ex-single').addEventListener('click', () => {
  resetOutput(); // fully reset before loading — don't leave the previous story showing
  // Left un-named on purpose — this reads as "your own" story, not one kid's.
  $('single-author').value = '';
  $('single-text').value =
    'So the spaceman goes up and up and up and up and up past the clouds and past the birds ' +
    'and past a plane and the plane says hi and he goes up more and up and there\'s a star and ' +
    'the star is his mom and he\'s so happy and they eat space soup together forever and ever and ever and ever.';
});
$('ex-cowrite').addEventListener('click', () => {
  resetOutput(); // fully reset before loading — don't leave the previous story showing
  $('a1-name').value = 'Jason';
  $('a1-text').value =
    'Once upon a time there was a boy who built a rocket ship out of a cardboard box and a whole ' +
    'roll of tape, and the rocket was named Rocket.';
  $('a2-name').value = 'Trenton';
  $('a2-text').value =
    "And then Rocket flew far far away to grandpa's house and they had waffles for dinner. The end. " +
    'Wait — no. Rocket also flew up and up to the moon and the moon had a big slide.';
});

// ---- submit ----------------------------------------------------------------
$('go-single').addEventListener('click', () =>
  run(
    { text: $('single-text').value, author: $('single-author').value },
    { text: $('single-text').value },
    'status-single',
    'go-single'
  )
);
$('go-cowrite').addEventListener('click', () => {
  const segments = [
    { author: $('a1-name').value || 'Author 1', text: $('a1-text').value },
    { author: $('a2-name').value || 'Author 2', text: $('a2-text').value },
  ].filter((s) => s.text.trim());
  run({ segments }, { segments }, 'status-cowrite', 'go-cowrite');
});

async function run(_display, payload, statusId, btnId) {
  stopListening(); // if the child was still speaking, finalize before we send
  const status = $(statusId);
  const btn = $(btnId);
  btn.disabled = true;
  status.className = 'status';
  status.textContent =
    'Guardian is checking the story, the Storyteller is writing the pages, and Abra is painting the illustrations… (first render can take a moment)';
  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    lastResult = data;
    currentKey = data.key || null;
    status.textContent = '';
    $('viewbar').classList.add('show');
    renderChild(data);
    renderParent(data);
    setView('child');
    $('viewbar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    status.className = 'status err';
    status.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

// ---- rendering helpers -----------------------------------------------------
const EMOJI = [
  [/spac|rocket|astronaut|planet/i, '🚀'],
  [/moon/i, '🌙'],
  [/star/i, '⭐'],
  [/dragon/i, '🐉'],
  [/fox/i, '🦊'],
  [/dog|puppy/i, '🐶'],
  [/cat|kitten/i, '🐱'],
  [/duck/i, '🦆'],
  [/dino|dinosaur/i, '🦕'],
  [/bird/i, '🐦'],
  [/cloud|sky/i, '☁️'],
  [/sun\b|sunshine/i, '☀️'],
  [/rainbow/i, '🌈'],
  [/soup|stew/i, '🍲'],
  [/pancake|waffle|food|eat/i, '🥞'],
  [/knight|sword|castle/i, '🏰'],
  [/pirate|ship|sea|water/i, '🏴‍☠️'],
  [/bike|bicycle/i, '🚲'],
  [/bear/i, '🐻'],
  [/robot/i, '🤖'],
  [/monster/i, '👾'],
  [/boot|shoe/i, '🥾'],
  [/bunny|rabbit/i, '🐰'],
];
const GRADS = ['#ffe6f0,#e7ddff', '#e6f7ff,#e7ddff', '#fff4e0,#ffe6f0', '#e9ffe9,#e6f7ff', '#f0e7ff,#ffe9f5'];
function pageArt(text, note, i) {
  const src = `${text} ${note}`;
  const hit = EMOJI.find(([re]) => re.test(src));
  const emoji = hit ? hit[1] : '✨';
  const grad = GRADS[i % GRADS.length];
  return { emoji, grad };
}
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function castChip(c) {
  const contra = c.contradictions && c.contradictions.length ? ` — both true: ${c.contradictions.join('; ')}` : '';
  const grad = (c.palette || ['#eee', '#ddd']).join(',');
  // Prefer the real rendered character reference as the avatar; fall back to the
  // emoji/palette placeholder if there's no art (or it fails to load).
  const av = c.refUrl
    ? `<span class="av"><img src="${esc(c.refUrl)}" alt="${esc(c.name)}" onerror="this.parentNode.textContent='${(c.emoji || '✨')}'" /></span>`
    : `<span class="av" style="background:linear-gradient(135deg,${grad})">${c.emoji || '✨'}</span>`;
  return `<div class="chip" data-id="${esc(c.id)}" title="Click to edit ${esc(c.name)} — ${esc(c.canonical)}${esc(contra)}">
    ${av}
    <span class="nm">${esc(c.name)}</span>
    <span class="edit-badge">✏️</span>
  </div>`;
}

function pageCard(p, i, byId) {
  const present = ((p.illustration && p.illustration.characters) || []).map((id) => byId[id]).filter(Boolean);
  let bg, inner;
  if (present.length) {
    // Same character ⇒ same emoji + palette on EVERY page it appears. This is
    // the character-consistency differentiator (also the fallback if art is off).
    bg = `linear-gradient(135deg,${present[0].palette.join(',')})`;
    inner = `<span class="avstack">${present.map((c) => `<span>${c.emoji}</span>`).join('')}</span>`;
  } else {
    const art = pageArt(p.text, (p.illustration && p.illustration.note) || p.illustration_note || '', i);
    bg = `linear-gradient(135deg,${art.grad})`;
    inner = `<span>${art.emoji}</span>`;
  }
  const note = (p.illustration && p.illustration.note) || p.illustration_note || '';
  const who = p.author ? `<span class="who">✍️ ${esc(p.author)}</span>` : '';

  // Real rendered art when present: <img> over a shimmer, with the emoji/palette
  // placeholder kept behind it as a graceful fallback if the image fails to load.
  const imageUrl = p.imageUrl || null;
  const illusInner = imageUrl
    ? `<img class="pageimg" src="${esc(imageUrl)}" alt="${esc(note)}" /><span class="ph">${inner}</span>`
    : inner;
  const illusClass = 'illus' + (imageUrl ? ' has-img loading' : '');

  return `
    <div class="page" data-page="${i}">
      <div class="${illusClass}" style="background:${bg}">${illusInner}<span class="cap">🎨 ${esc(note)}</span></div>
      <div class="body"><div class="text">${esc(p.text)}</div>${who}</div>
    </div>`;
}

// After a render, clear each image's loading shimmer on load, and fall back to the
// emoji/palette placeholder (never a broken image) on error. Covers both the
// storybook (.illus) and comic (.cpanel-illus) layouts.
function wirePageImages() {
  document.querySelectorAll('#stage-child .illus.has-img, #stage-child .cpanel-illus.has-img').forEach((illus) => {
    const img = illus.querySelector('img.pageimg');
    if (!img) return;
    const done = () => illus.classList.remove('loading');
    if (img.complete && img.naturalWidth > 0) return done();
    img.addEventListener('load', done);
    img.addEventListener('error', () => {
      illus.classList.remove('loading', 'has-img'); // reveals the .ph placeholder
      img.remove();
    });
  });
}

// ---- comic layout: same pages, blocked together into comic-book pages ----------
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

function comicPanel(p, i, byId) {
  const present = ((p.illustration && p.illustration.characters) || []).map((id) => byId[id]).filter(Boolean);
  let bg, inner;
  if (present.length) {
    bg = `linear-gradient(135deg,${present[0].palette.join(',')})`;
    inner = `<span class="avstack">${present.map((c) => `<span>${c.emoji}</span>`).join('')}</span>`;
  } else {
    const art = pageArt(p.text, (p.illustration && p.illustration.note) || p.illustration_note || '', i);
    bg = `linear-gradient(135deg,${art.grad})`;
    inner = `<span>${art.emoji}</span>`;
  }
  const imageUrl = p.imageUrl || null;
  const illusInner = imageUrl
    ? `<img class="pageimg" src="${esc(imageUrl)}" alt="" /><span class="ph">${inner}</span>`
    : inner;
  const cls = 'cpanel-illus' + (imageUrl ? ' has-img loading' : '');
  const who = p.author ? `<span class="cwho">✍️ ${esc(p.author)}</span>` : '';
  return `<figure class="cpanel" data-page="${i}">
      <div class="${cls}" style="background:${bg}">${illusInner}</div>
      <figcaption class="cnarr">${esc(p.text)}${who}</figcaption>
    </figure>`;
}

// Block pages into comic-book pages of up to 4 panels each.
function comicHtml(pages, byId) {
  let gi = -1;
  return chunk(pages, 4)
    .map((sheet) => {
      const panels = sheet.map((p) => comicPanel(p, ++gi, byId)).join('');
      return `<div class="comic-sheet" data-count="${sheet.length}">${panels}</div>`;
    })
    .join('');
}

// Build the inner HTML for #pages based on the current layout.
function renderPagesHtml() {
  const book = currentBook;
  if (!book || !book.pages || !book.pages.length) return '<p class="muted center">No pages.</p>';
  if (layout === 'comic') return comicHtml(book.pages, bookById);
  return book.pages.map((p, i) => pageCard(p, i, bookById)).join('');
}

// (Re)mount the pages region for the current layout, then wire up the images.
function mountPages() {
  const wrap = $('pages');
  if (!wrap) return;
  wrap.className = 'pages ' + layout;
  wrap.innerHTML = renderPagesHtml();
  wirePageImages();
}

function renderChild(d) {
  const el = $('stage-child');
  stopNarration();
  currentBook = d.book || d.storybook || null;

  if (d.status === 'blocked') {
    el.innerHTML = `
      <div class="redirect">
        <div class="big">${esc(d.childMessage || "Let's tell a different part of the story!")}</div>
        <div class="sub">Abra gently steers here — the child never sees what was flagged, and is never scolded.</div>
      </div>`;
    return;
  }
  const book = d.book || d.storybook || { title: '', pages: [], characters: [] };
  const chars = book.characters || [];
  const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
  bookById = byId;

  const byline =
    d.authors && d.authors.length > 1
      ? `<div class="byline">A story by <b>${d.authors.map(esc).join('</b> &amp; <b>')}</b></div>`
      : d.authors && d.authors.length === 1
      ? `<div class="byline">A story by <b>${esc(d.authors[0])}</b></div>`
      : '';

  const cast = chars.length
    ? `<div class="cast"><div class="lbl">The cast — the same on every page · tap to edit</div>${chars.map(castChip).join('')}</div>`
    : '';

  const toolbar = `
    <div class="booktoolbar">
      <button class="mini ${layout === 'storybook' ? 'active' : ''}" data-layout="storybook">📖 Storybook</button>
      <button class="mini ${layout === 'comic' ? 'active' : ''}" data-layout="comic">▦ Comic</button>
      <button class="mini" id="btn-read">▶ Read to me</button>
      <button class="mini" id="btn-stop" style="display:none">⏹ Stop</button>
      <button class="btn-premium" id="btn-animate">🎬 Make it move <span class="tag">PREMIUM</span></button>
    </div>`;

  el.innerHTML = `
    <div class="child-head">${byline}</div>
    <div class="booktitle">${esc(book.title)}</div>
    ${cast}
    ${toolbar}
    <div class="pages ${layout}" id="pages"></div>`;

  wireBookToolbar();
  mountPages();
}

// ---- book toolbar: layout / narrate / animate ------------------------------
function wireBookToolbar() {
  document.querySelectorAll('#stage-child [data-layout]').forEach((b) =>
    b.addEventListener('click', () => { layout = b.dataset.layout; applyLayout(); })
  );
  $('btn-read')?.addEventListener('click', readAll);
  $('btn-stop')?.addEventListener('click', stopNarration);
  $('btn-animate')?.addEventListener('click', openPremium);
}

// Comic vs storybook is the SAME pages re-laid-out — the two layouts use different
// DOM (comic blocks panels into sheets), so re-mount rather than just swap a class.
function applyLayout() {
  mountPages();
  document.querySelectorAll('#stage-child [data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === layout));
}

// ---- Narrator: browser speech synthesis (swap for real TTS later) ----------
function stopNarration() {
  speaking = false;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  document.querySelectorAll('#stage-child .speaking').forEach((p) => p.classList.remove('speaking'));
  const b = $('btn-read'), s = $('btn-stop');
  if (b) { b.classList.remove('speaking'); b.style.display = ''; }
  if (s) s.style.display = 'none';
}
function speakPage(i, onEnd) {
  const book = currentBook;
  if (!book || !book.pages[i]) return onEnd && onEnd();
  const text = (book.pages[i].narration && book.pages[i].narration.text) || book.pages[i].text || '';
  const pageEl = document.querySelector(`#stage-child [data-page="${i}"]`);
  document.querySelectorAll('#stage-child .speaking').forEach((p) => p.classList.remove('speaking'));
  if (pageEl) { pageEl.classList.add('speaking'); pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (!window.speechSynthesis) { return void setTimeout(() => { if (pageEl) pageEl.classList.remove('speaking'); onEnd && onEnd(); }, 900); }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1.05;
  u.onend = () => { if (pageEl) pageEl.classList.remove('speaking'); onEnd && onEnd(); };
  window.speechSynthesis.speak(u);
}
function readAll() {
  if (!currentBook || !currentBook.pages.length) return;
  stopNarration();
  speaking = true;
  $('btn-read').classList.add('speaking');
  $('btn-stop').style.display = '';
  let i = 0;
  const next = () => {
    if (!speaking || i >= currentBook.pages.length) return stopNarration();
    const cur = i++;
    speakPage(cur, next);
  };
  next();
}

// ---- Premium (v2) animation gate — stub, does not animate ------------------
function openPremium() {
  const g = currentBook && currentBook.premium && currentBook.premium.animation;
  if (g) {
    $('premium-msg').textContent = g.message;
    $('premium-sub').textContent = `Unlock with a subscription (${g.requiresEntitlement})`;
    $('premium-credits').textContent = `or a ${g.creditCost}-credit pack`;
  }
  $('premium-modal').classList.add('show');
}
$('premium-close').addEventListener('click', () => $('premium-modal').classList.remove('show'));
$('premium-modal').addEventListener('click', (e) => { if (e.target.id === 'premium-modal') e.target.classList.remove('show'); });

// ---- edit a cast member: click its chip → type a change → regenerate -----------
// Delegated so it survives every re-render of the child stage.
$('stage-child').addEventListener('click', (e) => {
  const chip = e.target.closest('.cast .chip');
  if (chip && chip.dataset.id) openEditModal(chip.dataset.id);
});

function openEditModal(id) {
  const c = ((currentBook && currentBook.characters) || []).find((x) => x.id === id);
  if (!c) return;
  editTargetId = id;
  $('edit-name').textContent = `Edit: ${c.name}`;
  $('edit-av').innerHTML = c.refUrl ? `<img src="${esc(c.refUrl)}" alt="" />` : (c.emoji || '✨');
  $('edit-canon').textContent = c.canonical || '';
  const inp = $('edit-input');
  inp.value = '';
  const st = $('edit-status');
  st.textContent = '';
  st.className = 'status';
  $('edit-modal').classList.add('show');
  setTimeout(() => inp.focus(), 30);
}

async function submitEdit() {
  const instruction = $('edit-input').value.trim();
  const st = $('edit-status');
  if (!instruction) { st.className = 'status err'; st.textContent = 'Type what to change first.'; return; }
  if (!currentKey || !editTargetId) { st.className = 'status err'; st.textContent = 'No rendered story to edit.'; return; }
  const goBtn = $('edit-go');
  goBtn.disabled = true;
  st.className = 'status';
  st.textContent = 'Regenerating this character and re-rendering their pages…';
  try {
    const res = await fetch('/api/character-edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: currentKey, characterId: editTargetId, instruction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Edit failed');
    lastResult = data;
    currentKey = data.key || currentKey;
    $('edit-modal').classList.remove('show');
    renderChild(data);
    renderParent(data);
  } catch (e) {
    st.className = 'status err';
    st.textContent = e.message;
  } finally {
    goBtn.disabled = false;
  }
}

$('edit-go').addEventListener('click', submitEdit);
$('edit-cancel').addEventListener('click', () => $('edit-modal').classList.remove('show'));
$('edit-modal').addEventListener('click', (e) => { if (e.target.id === 'edit-modal') e.target.classList.remove('show'); });
$('edit-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEdit(); });

// ============================================================================
// Voice input — Web Speech API (SpeechRecognition). PRIMARY input; typing and
// "Try an example" stay fully functional as fallbacks (nothing here disables
// them).
//
// RAW capture: final transcripts are appended VERBATIM — we do NOT strip filler
// or "clean up" the child's words on the client. Chrome's recognizer (Google
// backend) may itself drop some disfluencies/false-starts server-side; that's a
// known limitation we surface in the UI (.micnote). Abra's own "remove sounds,
// never decisions" handling belongs in the Storyteller/ingestion, not here.
// ============================================================================
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null; // the SpeechRecognition currently listening, or null
let activeBtn = null;

const micStatusFor = (btn) => $(btn.id.replace('mic-', 'micstatus-'));

function stopListening() {
  if (activeRec) {
    activeRec._manualStop = true;
    try { activeRec.stop(); } catch { /* not started */ }
  }
}

function startListening(targetId, btn, statusEl) {
  if (!SR) return;
  if (activeRec) stopListening(); // one recognizer at a time; old session cleans itself up

  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true; // keep listening across a child's pauses
  rec.interimResults = true; // live preview + capture as much as we can
  rec.maxAlternatives = 1;
  rec._manualStop = false;

  const idle = btn.dataset.idleLabel || (btn.dataset.idleLabel = btn.textContent);
  const setIdle = () => { btn.classList.remove('listening'); btn.textContent = idle; };

  rec.onresult = (event) => {
    const target = $(targetId);
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      const chunk = r[0] ? r[0].transcript : '';
      if (r.isFinal) {
        // Append the child's words verbatim — no trimming/cleanup.
        const sep = target.value && !/\s$/.test(target.value) ? ' ' : '';
        target.value += sep + chunk;
      } else {
        interim += chunk;
      }
    }
    statusEl.classList.remove('err');
    statusEl.innerHTML = interim ? `Listening… <span class="live">${esc(interim)}</span>` : 'Listening…';
  };

  rec.onerror = (event) => {
    const err = event.error;
    if (err === 'no-speech' || err === 'aborted') return; // benign
    let msg = `Mic error: ${err}`;
    if (err === 'not-allowed' || err === 'service-not-allowed') msg = 'Microphone blocked. Allow mic access in Chrome — or just type your story.';
    else if (err === 'network') msg = 'Speech service network error — type your story, or try again.';
    statusEl.textContent = msg;
    statusEl.classList.add('err');
    rec._manualStop = true; // don't auto-restart after a real error
  };

  rec.onend = () => {
    // Chrome ends the session after silence; if the user didn't stop, resume.
    if (!rec._manualStop) {
      try { rec.start(); return; } catch { /* fall through */ }
    }
    setIdle();
    if (!statusEl.classList.contains('err')) statusEl.textContent = '';
    if (activeRec === rec) { activeRec = null; activeBtn = null; }
  };

  activeRec = rec;
  activeBtn = btn;
  btn.classList.add('listening');
  btn.textContent = '⏹ Stop listening';
  statusEl.classList.remove('err');
  statusEl.textContent = 'Starting… allow the mic if Chrome asks.';
  try {
    rec.start();
  } catch (e) {
    statusEl.textContent = `Could not start the mic: ${e.message}`;
    statusEl.classList.add('err');
    setIdle();
    if (activeRec === rec) { activeRec = null; activeBtn = null; }
  }
}

function toggleMic(btn) {
  if (activeBtn === btn) { stopListening(); return; }
  startListening(btn.dataset.target, btn, micStatusFor(btn));
}

// Wire the mic buttons (or disable them gracefully where speech isn't supported).
document.querySelectorAll('.mic').forEach((btn) => {
  if (!SR) {
    btn.disabled = true;
    const s = micStatusFor(btn);
    if (s) s.textContent = 'Voice input needs Chrome — type your story instead.';
    return;
  }
  btn.addEventListener('click', () => toggleMic(btn));
});

function laneBadge(kind, label) {
  return `<span class="badge b-${kind}">${label}</span>`;
}

function renderParent(d) {
  const el = $('stage-parent');
  const t = d.trace || {};
  const l1 = t.lane1 || {};
  const st = t.storyteller || {};
  const l3 = t.lane3 || {};
  const l2 = t.lane2 || {};
  const out = t.output || {};

  // Lane 1
  const lane1 = `
    <div class="lane">
      <div class="n">1</div>
      <div class="body">
        <div class="title">Hard block — input ${l1.blocked ? laneBadge('block', `blocked · ${esc(l1.category)}`) : laneBadge('pass', 'passed')}</div>
        <div class="detail">${l1.blocked ? 'Explicit content refused at ingestion. It never reached the Storyteller; the child saw a gentle redirect.' : 'No explicit content. The story was allowed through to the Storyteller.'}</div>
      </div>
    </div>`;

  // Storyteller
  const storyteller = `
    <div class="lane">
      <div class="n">✎</div>
      <div class="body">
        <div class="title">Storyteller ${st.ran ? laneBadge('info', `${st.pages} pages${st.coWriting ? ' · co-written' : ''}`) : laneBadge('info', 'not run')}</div>
        <div class="detail">${st.ran ? 'Brought the story to life without tidying it — structure, contradictions, and non-endings preserved.' : 'Skipped because the input was blocked.'}</div>
      </div>
    </div>`;

  // Lane 3
  let l3rows = '';
  if (l3.ran) {
    l3rows = (l3.pages || [])
      .map((p) => {
        const badge = p.kept ? laneBadge('pass', 'passed') : laneBadge('block', `dropped · ${esc(p.category || 'unsafe')}`);
        return `<div class="pagerow">Page ${p.index + 1} ${badge}${p.reason ? ` <span class="muted">— ${esc(p.reason)}</span>` : ''}</div>`;
      })
      .join('');
  }
  const lane3 = `
    <div class="lane">
      <div class="n">3</div>
      <div class="body">
        <div class="title">Screen output ${l3.ran ? (l3.droppedCount ? laneBadge('block', `${l3.droppedCount} dropped`) : laneBadge('pass', 'all pages passed')) : laneBadge('info', 'not run')}${l3.regenerated ? ' ' + laneBadge('flag', 'regenerated once') : ''}</div>
        <div class="detail">Every generated page + illustration note was screened before reaching the child.</div>
        ${l3rows}
      </div>
    </div>`;

  // Lane 2
  const lane2 = `
    <div class="lane">
      <div class="n">2</div>
      <div class="body">
        <div class="title">Flag to parent — input ${l2.flagged ? laneBadge('flag', 'flag raised') : laneBadge('pass', 'nothing to flag')}</div>
        <div class="detail">${l2.flagged ? 'The story processed normally for the child. This private note was surfaced only here, to you.' : 'Nothing concerning surfaced. The child\'s story processed normally.'}</div>
        ${l2.flagged ? `
          <div class="flagcard">
            <div><b>Signals:</b> ${(l2.signals || []).map((s) => esc(s.replace(/_/g, ' '))).join(', ') || '—'}</div>
            ${l2.passage ? `<div class="passage">${esc(l2.passage)}</div>` : ''}
            <div class="note">${esc(l2.note || '')}</div>
          </div>` : ''}
      </div>
    </div>`;

  // Output pipeline (Character Friend → Illustrator → Narrator → Bookbinder)
  const prem = out.premium || {};
  const outputLane = `
    <div class="lane">
      <div class="n">📕</div>
      <div class="body">
        <div class="title">Output — storybook ${out.ran ? laneBadge('info', `${out.characters || 0} character${out.characters === 1 ? '' : 's'} · ${(out.layouts || []).join(' / ')}`) : laneBadge('info', 'not run')}</div>
        <div class="detail">Character Friend held ${out.characters || 0} stable character${out.characters === 1 ? '' : 's'} so the art stays consistent on every page. Illustrator + Narrator + Bookbinder assembled the flip-through book; the comic layout is a view option over the same pages.${prem.tier ? ` Animation is ${prem.unlocked ? 'unlocked' : 'a locked premium output'} (v2).` : ''}</div>
      </div>
    </div>`;

  // Accumulated dashboard flags this session
  const flags = d.dashboardFlags || [];
  const dash = flags.length
    ? `<div class="panel">
        <h2>Parent dashboard — flags this session (${flags.length})</h2>
        <p class="lede">Descriptive notes only. Guardian flags; it does not diagnose or contact anyone.</p>
        ${flags
          .map(
            (f) => `<div class="flagcard">
              <div class="muted" style="font-size:12px">${esc(f.createdAt)} · ${(f.signals || []).map((s) => esc(s.replace(/_/g, ' '))).join(', ')}</div>
              ${f.passage ? `<div class="passage">${esc(f.passage)}</div>` : ''}
              <div class="note">${esc(f.note || '')}</div>
            </div>`
          )
          .join('')}
       </div>`
    : '';

  el.innerHTML = `
    <div class="panel">
      <h2>Safety trace — this run</h2>
      <p class="lede">The same story, seen from the parent side. Guardian ran three lanes around the Storyteller.</p>
      ${lane1}
      ${storyteller}
      ${lane3}
      ${lane2}
      ${outputLane}
    </div>
    ${dash}`;
}
