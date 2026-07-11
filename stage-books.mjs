// Copies every book to _staging/<bookId>.<ext> — the asset names the site
// expects on the GitHub release. Run: node stage-books.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("data.js", "utf8"), ctx);
const BOOKS = ctx.window.BOOKS;

fs.mkdirSync("_staging", { recursive: true });
let total = 0;
BOOKS.forEach((b, i) => {
  const ext = path.extname(b.path).toLowerCase();
  const dest = path.join("_staging", `${i}${ext}`);
  fs.copyFileSync(b.path, dest);
  total += fs.statSync(dest).size;
});
console.log(`Staged ${BOOKS.length} files → _staging/ (${(total / 1073741824).toFixed(2)} GB)`);
