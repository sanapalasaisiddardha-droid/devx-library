import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { books, categories, stats } from "../data/books";
import { CAT_PLACES } from "../lib/geo";

/**
 * Auto-collapsing sidebar over the 3D map. Collapsed it's a slim dark rail;
 * hovering (or tapping) expands it into a browsable index of districts →
 * books. Picking a book flies the camera to its building, then opens it.
 */
export default function Sidebar({ onPickBook }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState(null);

  const byCat = useMemo(() => {
    const m = {};
    books.forEach((b) => (m[b.cat] = m[b.cat] || []).push(b));
    return m;
  }, []);
  const cats = useMemo(() => categories.filter((c) => byCat[c.id]), [byCat]);

  const q = query.trim().toLowerCase();
  const results = q
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author || "").toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      )
    : null;

  const expanded = open || pinned;

  const BookRow = ({ b }) => (
    <button
      onClick={() => onPickBook(b)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
    >
      <img src={b.cover} alt="" className="h-11 w-8 shrink-0 rounded object-cover" loading="lazy" />
      <span className="min-w-0">
        <span className="line-clamp-2 text-xs font-medium leading-snug text-white/85">{b.title}</span>
        {b.author && <span className="block truncate text-[10px] text-white/40">{b.author}</span>}
      </span>
    </button>
  );

  return (
    <div
      className="fixed left-0 top-0 z-40 flex h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* rail */}
      <div className="flex h-full w-14 flex-col items-center border-r border-white/10 bg-ink/90 py-4 backdrop-blur-xl">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-[#38bdf8] shadow-[0_10px_24px_-8px_rgba(124,92,255,0.8)]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>

        <button
          onClick={() => setPinned((v) => !v)}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
          className={`mt-6 grid h-9 w-9 place-items-center rounded-xl border transition ${
            pinned ? "border-transparent bg-lime text-ink" : "border-white/10 bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div className="mt-auto -rotate-90 whitespace-nowrap font-display text-xs font-semibold tracking-[0.3em] text-white/30">
          DEVX
        </div>
      </div>

      {/* expanding panel */}
      <AnimatePresence>
        {expanded && (
          <motion.aside
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full w-72 flex-col border-r border-white/10 bg-ink/90 backdrop-blur-xl"
          >
            <div className="px-4 pb-3 pt-5">
              <p className="font-display text-lg font-semibold">DevX</p>
              <p className="text-xs text-white/45">
                {stats.resources} books at the world's most iconic places
              </p>
              <div className="relative mt-3">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the city…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-violet"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {results ? (
                <>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {results.length} result{results.length === 1 ? "" : "s"}
                  </p>
                  {results.map((b) => <BookRow key={b.id} b={b} />)}
                </>
              ) : (
                cats.map((c) => (
                  <div key={c.id} className="mb-0.5">
                    <button
                      onClick={() => setOpenCat(openCat === c.id ? null : c.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-white/80">{c.name}</span>
                        {CAT_PLACES[c.id] && (
                          <span className="block truncate text-[10px] text-white/35">
                            📍 {CAT_PLACES[c.id].join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-white/40">
                        {byCat[c.id].length}
                        <svg
                          viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-transform ${openCat === c.id ? "rotate-90" : ""}`}
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {openCat === c.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden pl-1"
                        >
                          {byCat[c.id].map((b) => <BookRow key={b.id} b={b} />)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>

            <p className="border-t border-white/10 px-4 py-3 text-[10px] text-white/35">
              Pick a book — the camera flies to its city.
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
