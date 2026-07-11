import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import LoadingCards from "./components/LoadingCards";
import PdfReader from "./components/PdfReader";
import CodeViewer from "./components/CodeViewer";

const TEXT_EXTS = new Set(["sh", "cpp", "h", "c", "hpp", "txt", "js", "py", "md", ""]);
const extOf = (url) => {
  const name = decodeURIComponent(url.split("/").pop());
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
};

/**
 * DevX — the homepage is a real, live 3D world map (MapLibre + MapTiler).
 * Books are glowing pins in the cities that made their fields famous.
 * Pick one (map or sidebar) → the camera flies there → straight-line card
 * loading animation → in-app PDF reader.
 */
export default function App() {
  const [flyTo, setFlyTo] = useState(null);     // {book, open, ts}
  const [loading, setLoading] = useState(null); // book during loading animation
  const [reader, setReader] = useState(null);   // book open in the PDF reader
  const [codeBook, setCodeBook] = useState(null); // book open in the code viewer

  const beginOpen = useCallback((book) => {
    if (!book) return;
    try { localStorage.setItem("siddlib.lastBook", String(book.id)); } catch { /* ignore */ }
    const ext = extOf(book.pdf);
    if (ext === "pdf" || TEXT_EXTS.has(ext)) {
      setLoading(book); // → reader / code viewer after the loading animation
    } else {
      // formats the browser can't render (djvu, ppt): download directly —
      // no window.open, so nothing for the popup blocker to kill
      const a = document.createElement("a");
      a.href = book.pdf;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, []);

  // any pick (map pin or sidebar) → fly there, open on arrival
  const onPickBook = useCallback((book) => {
    setFlyTo({ book, open: true, ts: Date.now() });
  }, []);

  const onArrived = useCallback((book) => beginOpen(book), [beginOpen]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView flyTo={flyTo} onPickBook={onPickBook} onArrived={onArrived} />
      <Sidebar onPickBook={onPickBook} />

      <AnimatePresence>
        {loading && (
          <LoadingCards
            book={loading}
            onDone={() => {
              if (extOf(loading.pdf) === "pdf") setReader(loading);
              else setCodeBook(loading);
              setLoading(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reader && <PdfReader book={reader} onClose={() => setReader(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {codeBook && <CodeViewer book={codeBook} onClose={() => setCodeBook(null)} />}
      </AnimatePresence>
    </div>
  );
}
