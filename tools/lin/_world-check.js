// 偵錯：載入原版資料＋mapdef，列出整張大地圖各區（lin／world／出生點／傳送門落點）
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "..");
const win = { console };
win.window = win; win.globalThis = win;
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub, construct: () => stub });
win.document = stub; win.localStorage = { getItem: () => null, setItem() {} }; win.navigator = { userAgent: "" };
win.addEventListener = () => {}; win.setTimeout = () => 0; win.setInterval = () => 0;
win.DB = stub;
const ctx = vm.createContext(win);
for (const f of ["js/49-linmap-data.js", "js/49-linmap.js", "js/52-lintown-data.js", "js/11-world-map.js", "js/47-mapdef.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f }); } catch (e) { console.error(f, String(e).slice(0, 300)); }
}
const D = win.MAP_DEFS;
const bad = [];
for (const [id, d] of Object.entries(D)) {
  if (!d || !d.lin) continue;
  const L = win.LINMAP_DATA[d.lin];
  if (!L) { bad.push(id + " lin missing " + d.lin); continue; }
  for (const p of d.portals || []) {
    if (!p) continue;
    const t = D[p.dest];
    if (t && t.lin && (p.destX == null || p.destY == null)) bad.push(id + " -> " + p.dest + " no dest xy");
    if (t && t.world && t.world === d.world) bad.push(id + " -> " + p.dest + " same-world portal");
  }
  if (d.world) {
    console.log(d.townLin ? "TOWN " : "FIELD", id.padEnd(22), d.lin, "start", JSON.stringify(d.start), "spots", (d.spawns || []).length,
      "portals", JSON.stringify((d.portals || []).map((p) => [p.dest, p.x, p.y, p.destX, p.destY])));
  }
}
for (const [id, d] of Object.entries(D)) {
  if (!d || !d.portals) continue;
  for (const p of d.portals) if (p && D[p.dest] && D[p.dest].world && d.world !== D[p.dest].world) console.log("IN  ", id, "->", p.dest, p.destX, p.destY);
}
console.log(bad.length ? "BAD\n" + bad.join("\n") : "OK no bad portals");
