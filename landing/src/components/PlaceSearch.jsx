import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MAPTILER_KEY } from "../lib/geo";

/**
 * Search any place on Earth (MapTiler geocoding) — picking a result flies the
 * map there. Debounced suggestions, arrow-key navigation, Esc to close.
 */
export default function PlaceSearch({ onGo }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [openList, setOpenList] = useState(false);
  const [sel, setSel] = useState(-1);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  // debounced geocoding
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setResults([]); setOpenList(false); return; }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=6&language=en`,
          { signal: ctrl.signal }
        );
        if (!r.ok) return;
        const data = await r.json();
        const feats = (data.features || []).map((f) => ({
          name: f.place_name,
          center: f.center,
          kind: f.properties?.place_type_name?.[0] || f.properties?.kind || "",
        }));
        setResults(feats);
        setOpenList(true);
        setSel(-1);
      } catch { /* aborted / offline */ }
    }, 320);
    return () => clearTimeout(t);
  }, [q]);

  // close when clicking outside
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpenList(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (r) => {
    if (!r) return;
    setOpenList(false);
    setQ(r.name.split(",")[0]);
    onGo(r.center);
  };

  const onKey = (e) => {
    if (e.key === "Escape") { setOpenList(false); e.target.blur(); return; }
    if (!openList || !results.length) { if (e.key === "Enter") go(results[0]); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + results.length) % results.length); }
    if (e.key === "Enter") go(results[sel === -1 ? 0 : sel]);
  };

  return (
    <div ref={boxRef} className="absolute right-4 top-4 z-30 w-72">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpenList(true)}
          onKeyDown={onKey}
          placeholder="Search any place on Earth…"
          className="w-full rounded-xl border border-white/12 bg-ink/85 py-2.5 pl-9 pr-3 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] outline-none backdrop-blur-xl placeholder:text-white/35 focus:border-violet"
        />
      </div>

      <AnimatePresence>
        {openList && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="mt-2 overflow-hidden rounded-xl border border-white/12 bg-ink/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            {results.map((r, i) => (
              <li key={`${r.name}${i}`}>
                <button
                  onClick={() => go(r)}
                  onMouseEnter={() => setSel(i)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition ${
                    sel === i ? "bg-white/8" : ""
                  }`}
                >
                  <svg className="mt-0.5 shrink-0 text-violet-soft" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white/85">{r.name}</span>
                    {r.kind && <span className="block text-[10px] capitalize text-white/40">{r.kind}</span>}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
