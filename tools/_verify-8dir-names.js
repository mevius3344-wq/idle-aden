"use strict";
/**
 * 模擬展開後：八向怪是否都會進 MOB_ANIM_NAMES，且主樹 walk 可用
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const raw = fs.readFileSync(path.join(ROOT, "js/anim-manifest.js"), "utf8");
const ANIM_MANIFEST = JSON.parse(raw.slice(raw.indexOf("=") + 1, raw.lastIndexOf(";")).trim());
const deny = new Set([
  "冰人", "夢幻之島冰人", "火焰弓箭手", "火焰戰士", "火蜥蜴", "夢幻之島火蜥蜴", "暗黑火焰弓箭手", "暗黑火焰戰士",
]);

const MOB_ANIM_8DIR = new Set();
const MOB_ANIM_NAMES = new Set();
const MOB_ANIM_SPRITE_SHADOW = new Set();

function _tryAdd8(ent, name) {
  if (!name || !ent) return;
  if (deny.has(name)) return;
  if (!((ent["d0/idle_"] || 0) > 0 && (ent["d6/idle_"] || 0) > 0)) return;
  MOB_ANIM_8DIR.add(name);
  MOB_ANIM_NAMES.add(name);
  let hasS = false;
  for (let d = 0; d < 8 && !hasS; d++) {
    if ((ent["d" + d + "/idle_s_"] || 0) > 0 || (ent["d" + d + "/walk_s_"] || 0) > 0) hasS = true;
  }
  if (hasS) MOB_ANIM_SPRITE_SHADOW.add(name);
}

const leg = ANIM_MANIFEST["assets/anim/_legacy_lineage"];
if (leg) {
  Object.keys(leg).forEach((k) => {
    const mm = /^(.+)\/d6\/idle_$/.exec(k);
    if (mm && mm[1]) _tryAdd8(leg, mm[1]);
  });
}
Object.keys(ANIM_MANIFEST).forEach((bucket) => {
  if (!bucket.startsWith("assets/anim/") || bucket === "assets/anim/_legacy_lineage") return;
  const name = bucket.slice("assets/anim/".length);
  if (!name || name[0] === "_") return;
  _tryAdd8(ANIM_MANIFEST[bucket], name);
});

let fail = 0;
function ok(n, c, d) {
  if (c) console.log("  OK ", n, d || "");
  else {
    fail++;
    console.log("  FAIL", n, d || "");
  }
}

console.log("=== 8dir → NAMES sync ===");
ok("8dir count", MOB_ANIM_8DIR.size >= 70, "n=" + MOB_ANIM_8DIR.size);
ok("all 8dir in NAMES", [...MOB_ANIM_8DIR].every((n) => MOB_ANIM_NAMES.has(n)));

const samples = ["巨大牛人", "虎男", "黃金龍", "艾多倫", "安普", "厄運蜥蜴", "高等狼", "真‧虎男"];
for (const n of samples) {
  ok("NAMES has " + n, MOB_ANIM_NAMES.has(n));
  ok("8DIR has " + n, MOB_ANIM_8DIR.has(n));
  const ent = ANIM_MANIFEST["assets/anim/" + n];
  if (ent) {
    ok(n + " walk×8", [...Array(8)].every((_, d) => (ent["d" + d + "/walk_"] || 0) > 1));
  }
}

console.log("sprite shadow auto", MOB_ANIM_SPRITE_SHADOW.size);
console.log(fail ? "\nRESULT: FAIL (" + fail + ")" : "\nRESULT: PASS");
process.exit(fail ? 1 : 0);
