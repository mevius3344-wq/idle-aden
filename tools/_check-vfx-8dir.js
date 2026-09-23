"use strict";
/**
 * E+F｜VFX 座標殘留＋八方覆蓋煙測
 * 用法：node tools/_check-vfx-8dir.js
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  OK  ", name, detail || "");
  else {
    failed++;
    console.log("  FAIL", name, detail || "");
  }
}

console.log("=== E) VFX 座標 ===");
{
  const siege = fs.readFileSync(path.join(ROOT, "js/30-siege-v2.js"), "utf8");
  const vfx = fs.readFileSync(path.join(ROOT, "js/09-vfx-render.js"), "utf8");
  ok("_vfxToLocal helper", /function _vfxToLocal/.test(vfx));
  ok("siege death ghost uses _vfxToLocal", /playDeath[\s\S]{0,800}_vfxToLocal/.test(siege));
  // 舊寫法：直接把 getBoundingClientRect().left 塞進 vfx-layer
  ok(
    "siege not raw screen left on ghost",
    !/ghost\.style\.left = \(r\.left \+ r\.width \/ 2\) \+ 'px'/.test(siege)
  );
}

console.log("=== F) 八方自動發現 ===");
{
  const vfx = fs.readFileSync(path.join(ROOT, "js/09-vfx-render.js"), "utf8");
  ok("MOB_ANIM_8DIR_DENY", /MOB_ANIM_8DIR_DENY/.test(vfx) && /冰人/.test(vfx));
  ok("expand scans top-level assets/anim", /assets\/anim\//.test(vfx) && /_tryAdd8/.test(vfx));
  ok("expand still scans _legacy_lineage", /_legacy_lineage/.test(vfx));

  const raw = fs.readFileSync(path.join(ROOT, "js/anim-manifest.js"), "utf8");
  const eq = raw.indexOf("=");
  const semi = raw.lastIndexOf(";");
  const ANIM_MANIFEST = JSON.parse(raw.slice(eq + 1, semi).trim());
  const deny = new Set([
    "冰人",
    "夢幻之島冰人",
    "火焰弓箭手",
    "火焰戰士",
    "火蜥蜴",
    "夢幻之島火蜥蜴",
    "暗黑火焰弓箭手",
    "暗黑火焰戰士",
  ]);
  const set = new Set();
  // simulate expand
  const leg = ANIM_MANIFEST["assets/anim/_legacy_lineage"] || {};
  Object.keys(leg).forEach((k) => {
    const mm = /^(.+)\/d6\/idle_$/.exec(k);
    if (mm && mm[1] && (leg[mm[1] + "/d0/idle_"] || 0) > 0 && !deny.has(mm[1])) set.add(mm[1]);
  });
  Object.keys(ANIM_MANIFEST).forEach((bucket) => {
    if (bucket.indexOf("assets/anim/") !== 0) return;
    if (bucket === "assets/anim/_legacy_lineage") return;
    const name = bucket.slice("assets/anim/".length);
    if (!name || name.charAt(0) === "_") return;
    const ent = ANIM_MANIFEST[bucket];
    if (ent && (ent["d0/idle_"] || 0) > 0 && (ent["d6/idle_"] || 0) > 0 && !deny.has(name)) set.add(name);
  });
  ok("discovered 8dir >= 70", set.size >= 70, "n=" + set.size);
  ok("deny not in set", [...deny].every((n) => !set.has(n)));
  ok("sample: 巨大牛人", set.has("巨大牛人"));
  ok("sample: 黃金龍", set.has("黃金龍"));
  ok("sample: 虎男", set.has("虎男"));

  // 🩹 v3.9.2：expand 必須把八向怪掛進 MOB_ANIM_NAMES（否則無行走／轉向）
  const vfxFull = fs.readFileSync(path.join(ROOT, "js/09-vfx-render.js"), "utf8");
  ok(
    "expand adds MOB_ANIM_NAMES",
    /MOB_ANIM_NAMES\.add\(name\)/.test(vfxFull)
  );
  ok(
    "apply allows 8DIR without NAMES gate",
    /MOB_ANIM_NAMES\.has\(m\.n\) && !\(typeof MOB_ANIM_8DIR/.test(vfxFull)
      || /!MOB_ANIM_NAMES\.has\(m\.n\) && !\(typeof MOB_ANIM_8DIR/.test(vfxFull)
  );
  // 抽樣：這些曾缺 NAMES、有完整 walk×8
  const needNames = ["巨大牛人", "虎男", "黃金龍", "艾多倫", "安普", "厄運蜥蜴"];
  for (const n of needNames) ok("in expand set: " + n, set.has(n));
}

console.log(failed ? "\nRESULT: FAIL (" + failed + ")" : "\nRESULT: PASS");
process.exit(failed ? 1 : 0);
