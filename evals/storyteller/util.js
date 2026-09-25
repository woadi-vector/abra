// Small pure helpers for reading a Storyteller output object in the tell-checks.
// No SDK import — this stays runnable offline against fixtures.

export const pagesOf = (out) => (Array.isArray(out?.pages) ? out.pages : []);

export const textOf = (out) =>
  pagesOf(out)
    .map((p) => String(p?.text ?? ''))
    .join('\n');

export const notesOf = (out) =>
  pagesOf(out)
    .map((p) => String(p?.illustration_note ?? ''))
    .join('\n');

// Page text + illustration notes, for checks that must hold across both.
export const allTextOf = (out) => `${textOf(out)}\n${notesOf(out)}`;

export const lastPageText = (out) => {
  const p = pagesOf(out);
  return p.length ? String(p[p.length - 1]?.text ?? '') : '';
};

// Index of the first page whose text matches `re` (-1 if none).
export const pageIndexMatching = (out, re) =>
  pagesOf(out).findIndex((p) => re.test(String(p?.text ?? '')));

export const countMatches = (s, re) => (String(s).match(re) || []).length;

// Assemble a uniform check result.
export const result = (pass, detail) => ({ pass, detail });
