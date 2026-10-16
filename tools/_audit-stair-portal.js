// 實測：地監下上樓＝走樓梯換層，不畫傳送門拱門（對應 #68）
// 用法：node tools/_audit-stair-portal.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let fails = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok   " : "  FAIL ") + name + (detail ? "  " + detail : ""));
  if (!cond) fails++;
};

function loadMapdefs() {
  const src = fs.readFileSync(path.join(ROOT, "js", "49-linmap-data.js"), "utf8");
  const box = {};
  vm.runInNewContext(src, { window: box });
  const stub = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub),
    apply: () => stub,
    construct: () => stub,
  });
  const ctx = { console };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.document = stub;
  ctx.localStorage = { getItem: () => null, setItem() {} };
  ctx.navigator = { userAgent: "" };
  ctx.addEventListener = () => {};
  ctx.setTimeout = () => 0;
  ctx.setInterval = () => 0;
  ctx.DB = stub;
  ctx.LINMAP_DATA = box.LINMAP_DATA;
  const c = vm.createContext(ctx);
  for (const f of ["js/11-world-map.js", "js/47-mapdef.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), c, { filename: f });
  }
  return ctx;
}

console.log("=== 樓梯／下上樓（無傳送門拱門）===");
const ex = fs.readFileSync(path.join(ROOT, "js/44-map-explore.js"), "utf8");
ok("exploreIsStairPortal＋STAIR_HOLD_TICKS",
  /function exploreIsStairPortal\(p\)/.test(ex) && /var STAIR_HOLD_TICKS = 2;/.test(ex) &&
  /exploreIsStairPortal\(portal\) \? STAIR_HOLD_TICKS : PORTAL_HOLD_TICKS/.test(ex));
ok("樓梯不畫拱門標記",
  /!exploreIsStairPortal\(portals\[mi\]\)/.test(ex) && /stair41041/.test(ex));
ok("樓梯不顯示左右傳送鈕",
  /stairHere/.test(ex) && /portal\.side === 'west' && !stairHere/.test(ex));
ok("走上樓梯訊息（不用「進入了傳送門」）",
  /你走上了樓梯，來到/.test(ex));

const W = loadMapdefs();
const M = W.MAP_DEFS;

function isDungeonLin(def) {
  if (!def) return false;
  const lin = String(def.lin || "");
  return /^(dg_|ti_dungeon)/.test(lin) || /dungeon/i.test(lin);
}
function wouldBeStair(src, p) {
  if (!p || !p.dest) return false;
  if (String(p.dest).indexOf("town_") === 0) return false;
  const lab = String(p.label || "");
  const id = String(p.id || "");
  if (/港口|船|出村/.test(lab)) return false;
  if (/樓|樓梯/.test(lab)) return true;
  if (/^to_b\d+$/.test(id)) return true;
  const sd = M[src], dd = M[p.dest];
  if (isDungeonLin(sd) && isDungeonLin(dd)) return true;
  if (isDungeonLin(sd) || isDungeonLin(dd)) {
    const d = String(p.dest || "");
    const kind = d.indexOf("town_") === 0 ? "town"
      : (/^(zone_|crystal_|rastabad_|shadow_|demon_|eva_|pirate_dungeon|pride_)/.test(d) || /dungeon|cave|tomb/.test(d)) ? "dungeon" : "wild";
    if (kind === "dungeon") return true;
    if (isDungeonLin(sd) && kind !== "town") return true;
  }
  return false;
}

let floorLinks = 0, stairOk = 0, samples = [];
for (const id of Object.keys(M)) {
  const def = M[id];
  if (!def || !isDungeonLin(def)) continue;
  for (const p of def.portals || []) {
    if (!p) continue;
    if (!/樓/.test(String(p.label || "")) && !/^to_b\d+$/.test(String(p.id || "")) && !isDungeonLin(M[p.dest])) continue;
    floorLinks++;
    if (wouldBeStair(id, p)) {
      stairOk++;
      if (samples.length < 6) samples.push(id + "→" + p.dest + " (" + (p.label || p.id) + ")");
    }
  }
}
ok("地監樓層連結判為樓梯（" + stairOk + "/" + floorLinks + "）", floorLinks >= 4 && stairOk === floorLinks, samples.join("; "));

// 說話之島 1F↔2F
const z13 = (M.zone_13 && M.zone_13.portals) || [];
const z14 = (M.zone_14 && M.zone_14.portals) || [];
const tiDown = z13.find((p) => p && p.dest === "zone_14");
const tiUp = z14.find((p) => p && p.dest === "zone_13");
ok("說話之島地監 1↔2 樓是樓梯",
  !!(tiDown && wouldBeStair("zone_13", tiDown) && tiUp && wouldBeStair("zone_14", tiUp)),
  (tiDown && tiDown.label) + " / " + (tiUp && tiUp.label));

const vfx = fs.readFileSync(path.join(ROOT, "js/09-vfx-render.js"), "utf8");
ok("格步走路幀不卡 40ms（跳位同幀換圖）",
  /_wc != null \|\| \(Date\.now\(\) - _pmState\._walkHold\.t\) >= 95/.test(vfx) &&
  /_wc2 != null \|\| \(Date\.now\(\) - _pmState\._walkHold\.t\) >= 95/.test(vfx) &&
  !/\(_wc != null \? 40 : 95\)/.test(vfx));
ok("非八向怪也吃 _linWalkF",
  (vfx.match(/_mv0 && m\._linWalkF != null/g) || []).length >= 1 &&
  (vfx.match(/_mv && m\._linWalkF != null/g) || []).length >= 2);

console.log(fails ? "\nFAIL " + fails : "\nALL PASS");
process.exit(fails ? 1 : 0);
