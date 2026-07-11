// Per-book annotations + reading position, persisted in the browser (localStorage).
// Everything a user highlights/notes stays on their device — no server needed.

const NOTES_KEY = (id) => `siddlib.notes.${id}`;
const PAGE_KEY = (id) => `siddlib.page.${id}`;

export function loadNotes(id) {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY(id))) || [];
  } catch {
    return [];
  }
}

export function saveNotes(id, notes) {
  try {
    localStorage.setItem(NOTES_KEY(id), JSON.stringify(notes));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function loadPage(id) {
  try {
    const p = parseInt(localStorage.getItem(PAGE_KEY(id)), 10);
    return Number.isFinite(p) && p >= 0 ? p : 0;
  } catch {
    return 0;
  }
}

export function savePage(id, page) {
  try {
    localStorage.setItem(PAGE_KEY(id), String(page));
  } catch {
    /* ignore */
  }
}

// how many books have any saved notes (for a small "continue reading" hint, etc.)
export function countAnnotatedBooks() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("siddlib.notes.")) {
        const v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v) && v.length) n++;
      }
    }
  } catch {
    /* ignore */
  }
  return n;
}
