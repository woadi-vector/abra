// Persistent, reusable character store. Character Friend "holds" a stable
// definition here so the same character stays consistent across pages and
// across stories in a session — and so a future animation step can pull the
// exact same sheet (canonical + seed) it needs.
//
// Environment-agnostic: localStorage in the app, in-memory in Node.

const KEY = 'abra.characters';

function backend() {
  if (typeof localStorage !== 'undefined') {
    return {
      read: () => JSON.parse(localStorage.getItem(KEY) || '{}'),
      write: (obj) => localStorage.setItem(KEY, JSON.stringify(obj)),
    };
  }
  let mem = {};
  return { read: () => mem, write: (obj) => { mem = obj; } };
}

export function createCharacterLibrary() {
  const store = backend();
  return {
    get(id) {
      return store.read()[id] || null;
    },
    upsert(sheet) {
      const all = store.read();
      // Keep the first-held canonical definition stable; refresh only metadata.
      const held = all[sheet.id];
      all[sheet.id] = held ? { ...sheet, canonical: held.canonical, seed: held.seed } : sheet;
      store.write(all);
      return all[sheet.id];
    },
    all() {
      return Object.values(store.read());
    },
    clear() {
      store.write({});
    },
  };
}
