import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { books, categories } from "../data/books";

const PER_PAGE = 12;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const card = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function LibraryGrid({ onOpenBook }) {
  const [active, setActive] = useState("all");
  const [page, setPage] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const sectionRef = useRef(null);

  // close the "more" dropdown when clicking outside it
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  const chips = useMemo(() => {
    const counts = {};
    books.forEach((b) => (counts[b.cat] = (counts[b.cat] || 0) + 1));
    return [{ id: "all", name: "All", count: books.length }].concat(
      categories.filter((c) => counts[c.id]).map((c) => ({ ...c, count: counts[c.id] }))
    );
  }, []);

  const visible = active === "all" ? books : books.filter((b) => b.cat === active);
  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const pageItems = visible.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const selectCat = (id) => {
    setActive(id);
    setPage(1);
    // jump to the results so the newly-filtered category is visible
    requestAnimationFrame(() =>
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };
  const goto = (n) => setPage(Math.min(totalPages, Math.max(1, n)));

  return (
    <section id="library" ref={sectionRef} className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-28">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-soft">The collection</p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {books.length} resources, beautifully shelved
        </h2>
      </motion.div>

      {/* category filter — sticky below the navbar; horizontally scrollable + a "more" menu */}
      <div className="sticky top-[74px] z-30 mt-10 flex items-center gap-2 rounded-2xl bg-ink/80 px-2 py-2.5 backdrop-blur-md">
        {/* scrollable pills */}
        <div className="no-scrollbar flex flex-1 gap-2.5 overflow-x-auto scroll-smooth">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCat(c.id)}
              className={`flex-none rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                active === c.id
                  ? "border-transparent bg-lime text-ink"
                  : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              {c.name}
              <span className={`ml-2 rounded-full px-1.5 text-xs ${active === c.id ? "bg-black/15" : "bg-white/10"}`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>

        {/* fade hint that there's more to scroll */}
        <div className="pointer-events-none absolute right-[3.75rem] top-2 bottom-2 w-12 bg-gradient-to-l from-ink/90 to-transparent" />

        {/* "more" dropdown with every category */}
        <div ref={moreRef} className="relative shrink-0">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Show all categories"
            aria-expanded={moreOpen}
            className={`grid h-10 w-10 place-items-center rounded-full border transition ${
              moreOpen
                ? "border-transparent bg-lime text-ink"
                : "border-white/10 bg-white/[0.05] text-white/70 hover:border-white/25 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          <AnimatePresence>
            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-white/10 bg-ink/95 p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
              >
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  All categories
                </p>
                <div className="no-scrollbar max-h-72 overflow-y-auto">
                  {chips.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        selectCat(c.id);
                        setMoreOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                        active === c.id
                          ? "bg-lime font-semibold text-ink"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span
                        className={`ml-2 shrink-0 rounded-full px-1.5 text-xs ${
                          active === c.id ? "bg-black/15" : "bg-white/10"
                        }`}
                      >
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* paged grid */}
      <div className="mt-8 min-h-[560px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${active}-${page}`}
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {pageItems.map((b) => (
              <motion.button
                key={b.id}
                type="button"
                variants={card}
                whileHover={{ y: -6, scale: 1.02 }}
                onClick={() => onOpenBook(b)}
                title={`Open: ${b.title}`}
                className="glass glass-hover group block overflow-hidden rounded-2xl text-left"
              >
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={b.cover}
                    alt={b.title}
                    loading="lazy"
                    draggable="false"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-soft">{b.category}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{b.title}</h3>
                  {b.author && <p className="mt-1 truncate text-xs text-white/45">{b.author}</p>}
                </div>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          <PageButton disabled={page === 1} onClick={() => goto(page - 1)} aria-label="Previous page">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </PageButton>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <PageButton key={n} active={n === page} onClick={() => goto(n)}>
              {n}
            </PageButton>
          ))}

          <PageButton disabled={page === totalPages} onClick={() => goto(page + 1)} aria-label="Next page">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </PageButton>
        </div>
      )}
    </section>
  );
}

function PageButton({ children, active, disabled, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      disabled={disabled}
      className={`grid h-10 min-w-[2.5rem] place-items-center rounded-xl border px-3 text-sm font-semibold transition-all duration-300 ${
        active
          ? "border-transparent bg-lime text-ink"
          : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white"
      } ${disabled ? "cursor-not-allowed opacity-35 hover:border-white/10 hover:text-white/70" : ""}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
