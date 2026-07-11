// Emits "<index>\t<cat>" per book (local only, no network). Used by download-covers.sh
import fs from "node:fs";
import vm from "node:vm";
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("data.js", "utf8"), ctx);
ctx.window.BOOKS.forEach((b, i) => process.stdout.write(i + "\t" + b.cat + "\n"));
