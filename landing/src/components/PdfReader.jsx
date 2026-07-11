import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { highlightPlugin, Trigger } from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { loadNotes, saveNotes, loadPage, savePage } from "../lib/annotations";

const COLORS = [
  { name: "Yellow", value: "#ffe14d" },
  { name: "Green", value: "#7df0a0" },
  { name: "Blue", value: "#7cc4ff" },
  { name: "Pink", value: "#ff92c2" },
];

export default function PdfReader({ book, onClose }) {
  const [notes, setNotes] = useState(() => loadNotes(book.id));
  const [showNotes, setShowNotes] = useState(true);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const uid = () => `n${Date.now().toString(36)}${Math.round(performance.now())}${notesRef.current.length}`;
  const addNote = (n) => setNotes((prev) => { const next = [...prev, n]; saveNotes(book.id, next); return next; });
  const removeNote = (id) => setNotes((prev) => { const next = prev.filter((x) => x.id !== id); saveNotes(book.id, next); return next; });

  // lock body scroll + close on Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // ---- highlight plugin (selection → color/note; renders stored highlights) ----
  const renderHighlightTarget = (props) => (
    <div
      style={{
        position: "absolute",
        left: `${props.selectionRegion.left}%`,
        top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
        transform: "translate(-50%, 8px)",
        zIndex: 30,
      }}
    >
      <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#15131f] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
        {COLORS.map((c) => (
          <button
            key={c.value}
            title={`Highlight ${c.name}`}
            onClick={() => { addNote({ id: uid(), quote: props.selectedText, color: c.value, content: "", areas: props.highlightAreas }); props.cancel(); }}
            className="h-5 w-5 rounded-full border border-black/20 transition hover:scale-110"
            style={{ background: c.value }}
          />
        ))}
        <span className="mx-0.5 h-5 w-px bg-white/15" />
        <button
          onClick={props.toggle}
          className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/15"
        >
          Note
        </button>
      </div>
    </div>
  );

  const renderHighlightContent = (props) => {
    let message = "";
    return (
      <div
        style={{
          position: "absolute",
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          transform: "translate(-50%, 8px)",
          zIndex: 30,
          width: 280,
        }}
      >
        <div className="rounded-2xl border border-white/15 bg-[#15131f] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <textarea
            rows={3}
            autoFocus
            placeholder="Add a note…"
            onChange={(e) => (message = e.target.value)}
            className="w-full resize-none rounded-lg border border-white/15 bg-white/5 p-2 text-sm text-white outline-none placeholder:text-white/40"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={props.cancel} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={() => { addNote({ id: uid(), quote: props.selectedText, color: COLORS[0].value, content: message, areas: props.highlightAreas }); props.cancel(); }}
              className="rounded-lg bg-lime px-3 py-1.5 text-xs font-semibold text-ink"
            >
              Add note
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHighlights = (props) => (
    <div>
      {notes.map((note) => (
        <Fragment key={note.id}>
          {(note.areas || [])
            .filter((a) => a.pageIndex === props.pageIndex)
            .map((area, idx) => (
              <div
                key={idx}
                title={note.content || note.quote}
                onClick={() => setShowNotes(true)}
                style={Object.assign({}, props.getCssProperties(area, props.rotation), {
                  background: note.color,
                  opacity: 0.4,
                  borderRadius: 2,
                  cursor: "pointer",
                  mixBlendMode: "multiply",
                })}
              />
            ))}
        </Fragment>
      ))}
    </div>
  );

  // NOTE: react-pdf-viewer plugin factories use hooks internally, so they must be
  // called at the top level every render (do NOT wrap them in useMemo).
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const highlightPluginInstance = highlightPlugin({
    trigger: Trigger.TextSelection,
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights,
  });
  const { jumpToHighlightArea } = highlightPluginInstance;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col bg-ink"
    >
      {/* header */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur-xl">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{book.title}</p>
          <p className="truncate text-xs text-white/50">{book.author || book.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showNotes ? "border-transparent bg-lime text-ink" : "border-white/15 bg-white/5 text-white/80 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Notes
            {notes.length > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${showNotes ? "bg-black/15" : "bg-white/10"}`}>{notes.length}</span>
            )}
          </button>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 hover:text-white"
            aria-label="Close reader"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Worker workerUrl={workerUrl}>
            <div className="rpv-reader h-full">
              <Viewer
                fileUrl={book.pdf}
                theme="dark"
                plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
                initialPage={loadPage(book.id)}
                onPageChange={(e) => savePage(book.id, e.currentPage)}
              />
            </div>
          </Worker>
        </div>

        {/* annotations sidebar */}
        {showNotes && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-white/10 bg-ink/80 md:flex">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-display text-sm font-semibold">Your highlights</h3>
              <span className="text-xs text-white/40">{notes.length}</span>
            </div>
            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {notes.length === 0 ? (
                <p className="mt-8 px-2 text-center text-sm text-white/40">
                  Select any text in the PDF to highlight it or add a note. Everything is saved in your browser.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {notes.map((note) => (
                    <li key={note.id} className="group rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <button
                        onClick={() => note.areas?.[0] && jumpToHighlightArea(note.areas[0])}
                        className="block w-full text-left"
                      >
                        <span className="mb-1.5 block h-1.5 w-8 rounded-full" style={{ background: note.color }} />
                        <p className="line-clamp-3 text-[13px] leading-snug text-white/80">“{note.quote}”</p>
                        {note.content && <p className="mt-1.5 text-xs text-white/55">{note.content}</p>}
                      </button>
                      <button
                        onClick={() => removeNote(note.id)}
                        className="mt-2 text-xs text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
