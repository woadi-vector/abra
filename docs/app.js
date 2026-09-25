// Abra — STATIC judge demo. No backend, no keys: it loads two pre-rendered stories
// from ./stories/*.json (built by scripts/build-static-demo.mjs) and renders the
// same child + parent views as the live app. Voice input and live generation are
// only in the full app; here you flip between two finished example stories.

const $ = (id) => document.getElementById(id);
let currentBook = null;
let bookById = {};
let layout = 'storybook';
let speaking = false;

const STORIES = { spaceman: 'stories/spaceman.json', cowrite: 'stories/cowrite.json' };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- story picker -----------------------------------------------------------
$('storybar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-story]');
  if (!btn || btn.classList.contains('active')) return;
  [...$('storybar').children].forEach((b) => b.classList.toggle('active', b === btn));
  loadStory(btn.dataset.story);
});

async function loadStory(slug) {
  stopNarration();
  layout = 'storybook';
  try {
    const data = await fetch(STORIES[slug], { cache: 'no-cache' }).then((r) => r.json());
    renderChild(data);
    renderParent(data);
    setView('child');
  } catch (e) {
    $('stage-child').innerHTML = `<p class="muted center">Could not load the story (${esc(e.message)}).</p>`;
    $('stage-child').classList.add('show');
  }
}

// ---- view toggle ------------------------------------------------------------
$('viewbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) setView(btn.dataset.view);
});
function setView(view) {
  $('view-child').classList.toggle('active', view === 'child');
  $('view-parent').classList.toggle('active', view === 'parent');
  $('stage-child').classList.toggle('show', view === 'child');
  $('stage-parent').classList.toggle('show', view === 'parent');
}

// ---- placeholder art (fallback only) ----------------------------------------
const EMOJI = [
  [/spac|rocket|astronaut|planet/i, '🚀'], [/moon/i, '🌙'], [/star/i, '⭐'], [/fox/i, '🦊'],
  [/dog|puppy/i, '🐶'], [/duck/i, '🦆'], [/bird/i, '🐦'], [/cloud|sky/i, '☁️'], [/soup|stew/i, '🍲'],
  [/waffle|pancake|food|eat/i, '🥞'], [/boy|kid|child/i, '🧒'], [/mom|mother/i, '👩'],
];
const GRADS = ['#ffe6f0,#e7ddff', '#e6f7ff,#e7ddff', '#fff4e0,#ffe6f0', '#e9ffe9,#e6f7ff', '#f0e7ff,#ffe9f5'];
function pageArt(text, note, i) {
  const hit = EMOJI.find(([re]) => re.test(`${text} ${note}`));
  return { emoji: hit ? hit[1] : '✨', grad: GRADS[i % GRADS.length] };
}

// ---- cast + pages -----------------------------------------------------------
function castChip(c) {
  const contra = c.contradictions && c.contradictions.length ? ` — both true: ${c.contradictions.join('; ')}` : '';
  const grad = (c.palette || ['#eee', '#ddd']).join(',');
  const av = c.refUrl
    ? `<span class="av"><img src="${esc(c.refUrl)}" alt="${esc(c.name)}" /></span>`
    : `<span class="av" style="background:linear-gradient(135deg,${grad})">${c.emoji || '✨'}</span>`;
  return `<div class="chip" title="${esc(c.canonical)}${esc(contra)}" style="cursor:default">${av}<span class="nm">${esc(c.name)}</span></div>`;
}

function pageCard(p, i, byId) {
  const present = ((p.illustration && p.illustration.characters) || []).map((id) => byId[id]).filter(Boolean);
  let bg, inner;
  if (present.length) {
    bg = `linear-gradient(135deg,${present[0].palette.join(',')})`;
    inner = `<span class="avstack">${present.map((c) => `<span>${c.emoji}</span>`).join('')}</span>`;
  } else {
    const art = pageArt(p.text, (p.illustration && p.illustration.note) || '', i);
    bg = `linear-gradient(135deg,${art.grad})`;
    inner = `<span>${art.emoji}</span>`;
  }
  const note = (p.illustration && p.illustration.note) || '';
  const who = p.author ? `<span class="who">✍️ ${esc(p.author)}</span>` : '';
  const imageUrl = p.imageUrl || null;
  const illusInner = imageUrl
    ? `<img class="pageimg" src="${esc(imageUrl)}" alt="${esc(note)}" /><span class="ph">${inner}</span>`
    : inner;
  const cls = 'illus' + (imageUrl ? ' has-img loading' : '');
  return `<div class="page" data-page="${i}"><div class="${cls}" style="background:${bg}">${illusInner}<span class="cap">🎨 ${esc(note)}</span></div><div class="body"><div class="text">${esc(p.text)}</div>${who}</div></div>`;
}

const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
function comicPanel(p, i, byId) {
  const present = ((p.illustration && p.illustration.characters) || []).map((id) => byId[id]).filter(Boolean);
  let bg, inner;
  if (present.length) {
    bg = `linear-gradient(135deg,${present[0].palette.join(',')})`;
    inner = `<span class="avstack">${present.map((c) => `<span>${c.emoji}</span>`).join('')}</span>`;
  } else {
    const art = pageArt(p.text, (p.illustration && p.illustration.note) || '', i);
    bg = `linear-gradient(135deg,${art.grad})`; inner = `<span>${art.emoji}</span>`;
  }
  const imageUrl = p.imageUrl || null;
  const illusInner = imageUrl ? `<img class="pageimg" src="${esc(imageUrl)}" alt="" /><span class="ph">${inner}</span>` : inner;
  const cls = 'cpanel-illus' + (imageUrl ? ' has-img loading' : '');
  const who = p.author ? `<span class="cwho">✍️ ${esc(p.author)}</span>` : '';
  return `<figure class="cpanel" data-page="${i}"><div class="${cls}" style="background:${bg}">${illusInner}</div><figcaption class="cnarr">${esc(p.text)}${who}</figcaption></figure>`;
}
function comicHtml(pages, byId) {
  let gi = -1;
  return chunk(pages, 4).map((sheet) => `<div class="comic-sheet" data-count="${sheet.length}">${sheet.map((p) => comicPanel(p, ++gi, byId)).join('')}</div>`).join('');
}

function renderPagesHtml() {
  const book = currentBook;
  if (!book || !book.pages || !book.pages.length) return '<p class="muted center">No pages.</p>';
  return layout === 'comic' ? comicHtml(book.pages, bookById) : book.pages.map((p, i) => pageCard(p, i, bookById)).join('');
}
function mountPages() {
  const wrap = $('pages');
  if (!wrap) return;
  wrap.className = 'pages ' + layout;
  wrap.innerHTML = renderPagesHtml();
  document.querySelectorAll('#stage-child .illus.has-img, #stage-child .cpanel-illus.has-img').forEach((illus) => {
    const img = illus.querySelector('img.pageimg');
    if (!img) return;
    const done = () => illus.classList.remove('loading');
    if (img.complete && img.naturalWidth > 0) return done();
    img.addEventListener('load', done);
    img.addEventListener('error', () => { illus.classList.remove('loading', 'has-img'); img.remove(); });
  });
}

function renderChild(d) {
  const el = $('stage-child');
  stopNarration();
  const book = d.book || { title: '', pages: [], characters: [] };
  currentBook = book;
  const chars = book.characters || [];
  bookById = Object.fromEntries(chars.map((c) => [c.id, c]));

  const byline = d.authors && d.authors.length > 1
    ? `<div class="byline">A story by <b>${d.authors.map(esc).join('</b> &amp; <b>')}</b></div>`
    : d.authors && d.authors.length === 1
    ? `<div class="byline">A story by <b>${esc(d.authors[0])}</b></div>` : '';
  const cast = chars.length
    ? `<div class="cast"><div class="lbl">The cast — the same on every page</div>${chars.map(castChip).join('')}</div>` : '';
  const toolbar = `<div class="booktoolbar">
      <button class="mini ${layout === 'storybook' ? 'active' : ''}" data-layout="storybook">📖 Storybook</button>
      <button class="mini ${layout === 'comic' ? 'active' : ''}" data-layout="comic">▦ Comic</button>
      <button class="mini" id="btn-read">▶ Read to me</button>
      <button class="mini" id="btn-stop" style="display:none">⏹ Stop</button>
      <button class="btn-premium" id="btn-animate">🎬 Make it move <span class="tag">PREMIUM</span></button>
    </div>`;
  el.innerHTML = `<div class="child-head">${byline}</div><div class="booktitle">${esc(book.title)}</div>${cast}${toolbar}<div class="pages ${layout}" id="pages"></div>`;
  document.querySelectorAll('#stage-child [data-layout]').forEach((b) => b.addEventListener('click', () => { layout = b.dataset.layout; applyLayout(); }));
  $('btn-read')?.addEventListener('click', readAll);
  $('btn-stop')?.addEventListener('click', stopNarration);
  $('btn-animate')?.addEventListener('click', openPremium);
  mountPages();
}
function applyLayout() {
  mountPages();
  document.querySelectorAll('#stage-child [data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === layout));
}

// ---- narration (browser speech synthesis) -----------------------------------
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
  const el = document.querySelector(`#stage-child [data-page="${i}"]`);
  document.querySelectorAll('#stage-child .speaking').forEach((p) => p.classList.remove('speaking'));
  if (el) { el.classList.add('speaking'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (!window.speechSynthesis) return void setTimeout(() => { if (el) el.classList.remove('speaking'); onEnd && onEnd(); }, 900);
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1.05;
  u.onend = () => { if (el) el.classList.remove('speaking'); onEnd && onEnd(); };
  window.speechSynthesis.speak(u);
}
function readAll() {
  if (!currentBook || !currentBook.pages.length) return;
  stopNarration();
  speaking = true;
  $('btn-read').classList.add('speaking');
  $('btn-stop').style.display = '';
  let i = 0;
  const next = () => { if (!speaking || i >= currentBook.pages.length) return stopNarration(); const cur = i++; speakPage(cur, next); };
  next();
}

// ---- premium modal ----------------------------------------------------------
function openPremium() {
  const g = currentBook && currentBook.premium && currentBook.premium.animation;
  if (g) {
    $('premium-msg').textContent = g.message || 'Short animated clips are a premium Abra output.';
    $('premium-sub').textContent = `Unlock with a subscription${g.requiresEntitlement ? ` (${g.requiresEntitlement})` : ''}`;
    $('premium-credits').textContent = g.creditCost ? `or a ${g.creditCost}-credit pack` : 'or a credit pack';
  }
  $('premium-modal').classList.add('show');
}
$('premium-close').addEventListener('click', () => $('premium-modal').classList.remove('show'));
$('premium-modal').addEventListener('click', (e) => { if (e.target.id === 'premium-modal') e.target.classList.remove('show'); });

// ---- parent (Guardian) view -------------------------------------------------
const laneBadge = (kind, label) => `<span class="badge b-${kind}">${label}</span>`;
function renderParent(d) {
  const el = $('stage-parent');
  const t = d.trace || {};
  const l1 = t.lane1 || {}, st = t.storyteller || {}, l3 = t.lane3 || {}, l2 = t.lane2 || {}, out = t.output || {};
  const lane1 = `<div class="lane"><div class="n">1</div><div class="body"><div class="title">Hard block — input ${l1.blocked ? laneBadge('block', `blocked · ${esc(l1.category)}`) : laneBadge('pass', 'passed')}</div><div class="detail">${l1.blocked ? 'Explicit content refused at ingestion. It never reached the Storyteller.' : 'No explicit content. The story was allowed through to the Storyteller.'}</div></div></div>`;
  const storyteller = `<div class="lane"><div class="n">✎</div><div class="body"><div class="title">Storyteller ${st.ran ? laneBadge('info', `${st.pages} pages${st.coWriting ? ' · co-written' : ''}`) : laneBadge('info', 'not run')}</div><div class="detail">Brought the story to life without tidying it — structure, contradictions, and non-endings preserved.</div></div></div>`;
  let l3rows = '';
  if (l3.ran) l3rows = (l3.pages || []).map((p) => `<div class="pagerow">Page ${p.index + 1} ${p.kept ? laneBadge('pass', 'passed') : laneBadge('block', `dropped · ${esc(p.category || 'unsafe')}`)}${p.reason ? ` <span class="muted">— ${esc(p.reason)}</span>` : ''}</div>`).join('');
  const lane3 = `<div class="lane"><div class="n">3</div><div class="body"><div class="title">Screen output ${l3.ran ? (l3.droppedCount ? laneBadge('block', `${l3.droppedCount} dropped`) : laneBadge('pass', 'all pages passed')) : laneBadge('info', 'not run')}${l3.regenerated ? ' ' + laneBadge('flag', 'regenerated once') : ''}</div><div class="detail">Every generated page + illustration note was screened before reaching the child.</div>${l3rows}</div></div>`;
  const lane2 = `<div class="lane"><div class="n">2</div><div class="body"><div class="title">Flag to parent — input ${l2.flagged ? laneBadge('flag', 'flag raised') : laneBadge('pass', 'nothing to flag')}</div><div class="detail">${l2.flagged ? 'The story processed normally for the child. This private note was surfaced only here, to you.' : "Nothing concerning surfaced. The child's story processed normally."}</div>${l2.flagged ? `<div class="flagcard"><div><b>Signals:</b> ${(l2.signals || []).map((s) => esc(s.replace(/_/g, ' '))).join(', ') || '—'}</div>${l2.passage ? `<div class="passage">${esc(l2.passage)}</div>` : ''}<div class="note">${esc(l2.note || '')}</div></div>` : ''}</div></div>`;
  const prem = out.premium || {};
  const outputLane = `<div class="lane"><div class="n">📕</div><div class="body"><div class="title">Output — storybook ${out.ran ? laneBadge('info', `${out.characters || 0} character${out.characters === 1 ? '' : 's'} · ${(out.layouts || []).join(' / ')}`) : laneBadge('info', 'not run')}</div><div class="detail">Character Friend held ${out.characters || 0} stable character${out.characters === 1 ? '' : 's'} so the art stays consistent on every page. Illustrator + Narrator + Bookbinder assembled the flip-through book; the comic layout is a view option over the same pages.${prem.tier ? ` Animation is ${prem.unlocked ? 'unlocked' : 'a locked premium output'} (v2).` : ''}</div></div></div>`;
  const flags = d.dashboardFlags || [];
  const dash = flags.length
    ? `<div class="panel"><h2>Parent dashboard — flags this session (${flags.length})</h2><p class="lede">Descriptive notes only. Guardian flags; it does not diagnose or contact anyone.</p>${flags.map((f) => `<div class="flagcard"><div class="muted" style="font-size:12px">${esc(f.createdAt)} · ${(f.signals || []).map((s) => esc(s.replace(/_/g, ' '))).join(', ')}</div>${f.passage ? `<div class="passage">${esc(f.passage)}</div>` : ''}<div class="note">${esc(f.note || '')}</div></div>`).join('')}</div>` : '';
  el.innerHTML = `<div class="panel"><h2>Safety trace — this run</h2><p class="lede">The same story, seen from the parent side. Guardian ran three lanes around the Storyteller.</p>${lane1}${storyteller}${lane3}${lane2}${outputLane}</div>${dash}`;
}

// ---- init -------------------------------------------------------------------
loadStory('spaceman');
