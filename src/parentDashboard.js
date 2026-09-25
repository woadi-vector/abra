// Parent dashboard flag store — where Lane 2 (flag-to-parent) notes surface.
// Flags are visible to the PARENT only, never to the child. This is a plain
// record store: Guardian describes, it does not diagnose, and nothing here
// contacts any third party.
//
// Environment-agnostic: persists to localStorage in the app, falls back to an
// in-memory array in Node (evals). A v1 flag is a simple record, which the spec
// says is enough to demonstrate the architecture.

const KEY = 'abra.parent.flags';

function backend() {
  if (typeof localStorage !== 'undefined') {
    return {
      read: () => JSON.parse(localStorage.getItem(KEY) || '[]'),
      write: (arr) => localStorage.setItem(KEY, JSON.stringify(arr)),
    };
  }
  let mem = [];
  return { read: () => mem, write: (arr) => { mem = arr; } };
}

export function createParentDashboard({ now = () => new Date().toISOString() } = {}) {
  const store = backend();

  return {
    // Record a Lane-2 flag. `flag` is Guardian's descriptive output for one story.
    addFlag({ storyText, signals, passage, note }) {
      const flags = store.read();
      const record = {
        id: `flag_${flags.length + 1}`,
        createdAt: now(),
        signals: signals || [],
        passage: passage || null,
        note: note || null, // neutral, descriptive — never a conclusion about the child
        storyExcerpt: String(storyText || '').slice(0, 280),
        reviewed: false,
      };
      flags.push(record);
      store.write(flags);
      return record;
    },
    listFlags() {
      return store.read();
    },
    markReviewed(id) {
      const flags = store.read().map((f) => (f.id === id ? { ...f, reviewed: true } : f));
      store.write(flags);
    },
    clear() {
      store.write([]);
    },
  };
}
