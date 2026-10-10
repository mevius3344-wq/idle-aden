// 在 vm 載入 js/47-mapdef.js（不載原版資料＝原始傳送門圖）；直接執行時列出野外／地監傳送門
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
function loadDefs() {
  const win = { console };
  win.window = win; win.globalThis = win;
  const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub, construct: () => stub });
  win.document = stub; win.localStorage = { getItem: () => null, setItem() {} }; win.navigator = { userAgent: "" };
  win.addEventListener = () => {}; win.setTimeout = () => 0; win.setInterval = () => 0;
  win.DB = stub;
  const ctx = vm.createContext(win);
  for (const f of ["js/11-world-map.js", "js/47-mapdef.js"]) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f }); } catch (e) { console.error(f, String(e).slice(0, 200)); }
  }
  try { win.MAP_CATEGORIES = vm.runInContext("MAP_CATEGORIES", ctx); } catch (e) {}
  return win;
}
module.exports = { loadDefs };
if (require.main === module) {
  const w = loadDefs();
  const D = w.MAP_DEFS || (w.mapdefAll && w.mapdefAll()) || {};
  const cats = w.MAP_CATEGORIES || {};
  console.log("defs", Object.keys(D).length, "cats", Object.keys(cats).join(","));
  const want = process.argv.slice(2);
  for (const cat of want.length ? want : ["wild", "dungeon"]) {
    for (const m of cats[cat] || []) {
      const d = D[m.v];
      console.log(cat, m.v, m.t, d ? (d.lin || "") : "NO-DEF", d ? JSON.stringify((d.portals || []).map((p) => p && [p.dest, p.side, p.destX, p.destY])) : "");
    }
  }
}
