import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The PDFs / notes / code live in the repo root, one level above this app.
const LIBRARY_ROOT = path.resolve(__dirname, "..");

const TYPES = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".djvu": "image/vnd.djvu",
  ".cpp": "text/plain",
  ".h": "text/plain",
  ".sh": "text/plain",
  ".txt": "text/plain",
};

// Serves the parent library files under /books/* (dev + preview) with HTTP range
// support so large PDFs stream in the browser's built-in viewer.
function serveBooks() {
  const handler = (req, res, next) => {
    try {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const file = path.join(LIBRARY_ROOT, rel);
      if (!file.startsWith(LIBRARY_ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return next();
      }
      const size = fs.statSync(file).size;
      const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.setHeader("Content-Type", type);
      res.setHeader("Accept-Ranges", "bytes");

      const range = req.headers.range;
      if (range) {
        const [s, e] = range.replace("bytes=", "").split("-");
        const start = parseInt(s, 10);
        const end = e ? parseInt(e, 10) : size - 1;
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
        res.setHeader("Content-Length", end - start + 1);
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", size);
        fs.createReadStream(file).pipe(res);
      }
    } catch {
      next();
    }
  };
  return {
    name: "serve-books",
    configureServer(server) {
      server.middlewares.use("/books", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/books", handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "./", // relative asset URLs → works on GitHub Pages subpaths
  plugins: [react(), serveBooks()],
  optimizeDeps: { include: ["pdfjs-dist"] },
});
