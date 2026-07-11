import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

/**
 * In-app viewer for code/script/text resources — same full-screen shell as the
 * PDF reader, so shell scripts and C++ files open on-site instead of relying
 * on (popup-blocked) new tabs.
 */
export default function CodeViewer({ book, onClose }) {
  const [text, setText] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    fetch(book.pdf)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setText(t))
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [book]);

  const lines = text === null ? [] : text.replace(/\r\n/g, "\n").split("\n");

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col bg-ink"
    >
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{book.title}</p>
          <p className="truncate text-xs text-white/50">{book.author || book.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={book.pdf}
            download
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </a>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 hover:text-white"
            aria-label="Close viewer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {err ? (
          <p className="p-10 text-center text-sm text-white/50">Couldn't load this file.</p>
        ) : text === null ? (
          <p className="p-10 text-center text-sm text-white/50">Loading…</p>
        ) : (
          <table className="w-full border-collapse font-mono text-[13px] leading-6">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="align-top hover:bg-white/[0.03]">
                  <td className="w-10 select-none border-r border-white/8 pr-3 text-right text-white/25">{i + 1}</td>
                  <td className="whitespace-pre-wrap break-words pl-4 pr-6 text-[#d8e2f2]">{l || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
