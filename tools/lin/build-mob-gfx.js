// 遊戲怪物（DB.mobs 中文名）→ 原版 sprite 編號
// 路徑：中文名 → 客戶端 desc-c.tbl 行號 i → (l1j npc.nameid==$i) 或 (desc-e[i]==l1j npc.name) → gfxid
// 用法：node tools/lin/build-mob-gfx.js [l1jdb.sql]  → tools/lin/mob-gfx.json
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDesc } = require("./text");
const { loadListSpr } = require("./listspr");

const ROOT = path.join(__dirname, "..", "..");
const SQL = process.argv[2] || path.join(os.tmpdir(), "l1jen", "db", "l1jdb_m10.sql");
// 客戶端 desc 對不到的怪物：中文名 → list.spr 編號
const ALIAS = { "長老": 32, "狼人": 1110 };

function gameMobs() {
  const src = fs.readFileSync(path.join(ROOT, "js", "00-data.js"), "utf8");
  const a = src.indexOf("\n    mobs: {");
  const b = src.indexOf("\n    towns: {", a);
  const out = [];
  const re = /^\s*"?([\w\u4e00-\u9fff]+)"?\s*:\s*\{[^\n]*?\bn:\s*"([^"]+)"/gm;
  for (const m of src.slice(a, b).matchAll(re)) out.push({ key: m[1], name: m[2] });
  return out;
}

function l1jNpcs() {
  const sql = fs.readFileSync(SQL, "utf8");
  const rows = [];
  const re = /INSERT INTO `npc` VALUES \('(\d+)', '((?:[^'\\]|\\.|'')*)', '([^']*)', '((?:[^'\\]|\\.|'')*)', '([^']*)', '(\d+)'/g;
  for (const m of sql.matchAll(re)) rows.push({ npcid: +m[1], name: m[2].replace(/\\'|''/g, "'"), nameid: m[3], impl: m[5], gfx: +m[6] });
  return rows;
}

function main() {
  const descC = readDesc("c").map((s) => s.trim());
  const descE = readDesc("e").map((s) => s.trim());
  const npcs = l1jNpcs();
  const list = loadListSpr();
  const byNameId = new Map();
  const byEn = new Map();
  for (const r of npcs) {
    if (r.nameid) (byNameId.get(r.nameid) || byNameId.set(r.nameid, []).get(r.nameid)).push(r);
    const k = r.name.toLowerCase();
    (byEn.get(k) || byEn.set(k, []).get(k)).push(r);
  }
  const cIndex = new Map();
  descC.forEach((s, i) => { if (s && !cIndex.has(s)) cIndex.set(s, []); if (s) cIndex.get(s).push(i); });

  const usable = (gfx) => {
    const e = list.get(gfx);
    return !!(e && e.actions[0] && (e.actions[1] || e.actions[3]));
  };
  const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const sim = (en, gfx) => {
    const a = words(en), b = new Set(words((list.get(gfx) || {}).name));
    return a.filter((w) => b.has(w) || b.has(w.replace(/s$/, ""))).length / Math.max(1, a.length);
  };
  const sprByName = new Map();
  for (const e of list.values()) {
    const k = words(e.name).join(" ");
    if (k && !sprByName.has(k) && usable(e.id)) sprByName.set(k, e.id);
  }

  const result = {};
  const miss = [];
  for (const mob of gameMobs()) {
    if (result[mob.name]) continue;
    if (ALIAS[mob.name] != null && usable(ALIAS[mob.name])) {
      const g = ALIAS[mob.name];
      result[mob.name] = { gfx: g, en: list.get(g).name, key: mob.key, sprName: list.get(g).name, src: "alias" };
      continue;
    }
    const cands = [];
    for (const i of cIndex.get(mob.name) || []) {
      const en = descE[i] || "";
      if (!en) continue;
      for (const r of byEn.get(en.toLowerCase()) || []) if (usable(r.gfx)) cands.push({ gfx: r.gfx, en, src: "l1j", s: sim(en, r.gfx) + (r.impl === "L1Monster" ? 0.01 : 0) });
      const direct = sprByName.get(words(en).join(" "));
      if (direct != null) cands.push({ gfx: direct, en, src: "list", s: 1.005 });
    }
    cands.sort((a, b) => b.s - a.s);
    if (cands.length) {
      const c = cands[0];
      result[mob.name] = { gfx: c.gfx, en: c.en, key: mob.key, sprName: list.get(c.gfx).name, src: c.src };
    } else miss.push(mob.name);
  }
  fs.writeFileSync(path.join(__dirname, "mob-gfx.json"), JSON.stringify(result, null, 1), "utf8");
  console.log("npc rows", npcs.length, "list.spr entries", list.size);
  console.log("matched", Object.keys(result).length, "missing", miss.length);
  fs.writeFileSync(path.join(__dirname, "_out", "mob-gfx-missing.txt"), miss.join("\n"), "utf8");
}
main();
