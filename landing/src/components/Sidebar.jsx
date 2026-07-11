import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { books, categories, stats } from "../data/books";
import { CAT_PLACES } from "../lib/geo";

/**
 * Auto-collapsing sidebar over the map. Collapsed it's a slim dark rail;
 * hovering (or pinning) expands a browsable index of districts → books with
 * staggered reveal animations. Picking a book flies the camera to its city.
 */

const list = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

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
    <motion.button
      variants={item}
      onClick={() => onPickBook(b)}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className="relative shrink-0 overflow-hidden rounded-md shadow-[0_6px_14px_rgba(0,0,0,0.45)]">
        <img
          src={b.cover}
          alt=""
          loading="lazy"
          className="h-12 w-9 object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-xs font-medium leading-snug text-white/85 transition-colors group-hover:text-white">
          {b.title}
        </span>
        {b.author && <span className="block truncate text-[10px] text-white/40">{b.author}</span>}
      </span>
      <svg
        className="ml-auto shrink-0 text-white/0 transition group-hover:text-lime"
        viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </motion.button>
  );

  return (
    <div
      className="fixed left-0 top-0 z-40 flex h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* rail */}
      <div className="flex h-full w-14 flex-col items-center border-r border-white/10 bg-ink/90 py-4 shadow-[8px_0_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <motion.span
          whileHover={{ scale: 1.08, rotate: -4 }}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-gradient-to-br from-violet to-[#38bdf8] shadow-[0_10px_24px_-8px_rgba(124,92,255,0.8)]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </motion.span>

        <motion.button
          onClick={() => setPinned((v) => !v)}
          whileTap={{ scale: 0.9 }}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
          className={`mt-6 grid h-9 w-9 place-items-center rounded-xl border transition-all duration-300 ${
            pinned
              ? "border-transparent bg-lime text-ink shadow-[0_8px_20px_-8px_rgba(195,239,62,0.8)]"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
          }`}
        >
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </motion.svg>
        </motion.button>

        <div className="mt-auto -rotate-90 whitespace-nowrap font-display text-xs font-semibold tracking-[0.3em] text-white/25">
          DEVX
        </div>
      </div>

      {/* expanding panel */}
      <AnimatePresence>
        {expanded && (
          <motion.aside
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full w-[19rem] flex-col border-r border-white/10 bg-gradient-to-b from-ink/95 via-ink/90 to-[#0d0a18]/95 shadow-[24px_0_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          >
            <div className="px-4 pb-3 pt-5">
              <p className="font-display text-xl font-semibold tracking-tight">
                Dev<span className="text-gradient">X</span>
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                {stats.resources} books at the world's most iconic places
              </p>
              <div className="relative mt-3.5">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the library…"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition-all placeholder:text-white/35 focus:border-violet focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(124,92,255,0.18)]"
                />
              </div>
            </div>

            <motion.div
              variants={list}
              initial="hidden"
              animate="show"
              className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-4"
            >
              {results ? (
                <>
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {results.length} result{results.length === 1 ? "" : "s"}
                  </p>
                  {results.map((b) => <BookRow key={b.id} b={b} />)}
                </>
              ) : (
                cats.map((c) => (
                  <motion.div key={c.id} variants={item} className="mb-1">
                    <button
                      onClick={() => setOpenCat(openCat === c.id ? null : c.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                        openCat === c.id ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-white/85">{c.name}</span>
                        {CAT_PLACES[c.id] && (
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-white/35">
                            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-soft">
                              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="truncate">{CAT_PLACES[c.id].join(" · ")}</span>
                          </span>
                        )}
                      </span>
                      <span className="ml-2 flex shrink-0 items-center gap-1.5 text-[10px] text-white/40">
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5">{byCat[c.id].length}</span>
                        <motion.svg
                          animate={{ rotate: openCat === c.id ? 90 : 0 }}
                          transition={{ duration: 0.25 }}
                          viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </motion.svg>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {openCat === c.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <motion.div variants={list} initial="hidden" animate="show" className="ml-1.5 border-l border-white/8 pl-1.5 pt-1">
                            {byCat[c.id].map((b) => <BookRow key={b.id} b={b} />)}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </motion.div>

            <p className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-[10px] text-white/35">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-lime">
                <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
              Pick a book — the camera flies across the world to it.
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
