// 原版怪物節奏匯出 → js/49-linmob-timing.js
// 每隻 LIN_SPR_MOBS 怪：[走一格 ms, 攻擊動作 ms, 打中時刻 ms, 攻擊距離(格), 走路各幀 ms[], 攻擊各幀 ms[]]
// 來源：l1j npc 表 passispeed／atkspeed／ranged（以 gfxid 對 mob-gfx.json），list.spr 各幀 dur（1 單位 40ms）與 "!" 打中幀
// 用法：node tools/lin/export-mob-timing.js
const fs = require("fs");
const path = require("path");
const { loadListSpr } = require("./listspr");
const db = require("./l1jdb");

const ROOT = path.join(__dirname, "..", "..");
const UNIT = 40;
const BOW_ACT = { 0: 20, 1: 21 };
const ALT_ACT = { 1: [18, 19, 30] };

function actOf(entry, act) {
  const bow = !entry.actions[1] && entry.actions[21] && BOW_ACT[act] != null;
  const main = entry.actions[bow ? BOW_ACT[act] : act];
  if (main && main.frames.length) return main;
  for (const alt of ALT_ACT[act] || []) if (entry.actions[alt] && entry.actions[alt].frames.length) return entry.actions[alt];
  return null;
}

const reg = JSON.parse(/LIN_SPR_MOBS = (\[.*\]);/.exec(fs.readFileSync(path.join(ROOT, "js", "49-linmob-data.js"), "utf8"))[1]);
const gfxMap = JSON.parse(fs.readFileSync(path.join(__dirname, "mob-gfx.json"), "utf8"));
const list = loadListSpr();
const npcByGfx = new Map();
for (const r of db.rows("npc")) {
  if (!r.gfxid || !/Monster|Guardian/.test(String(r.impl || ""))) continue;
  if (!npcByGfx.has(r.gfxid)) npcByGfx.set(r.gfxid, r);
}

const out = {};
let miss = 0;
for (const name of reg) {
  const g = gfxMap[name];
  const entry = g && list.get(g.gfx);
  if (!entry) { miss++; continue; }
  const npc = npcByGfx.get(g.gfx) || {};
  const walk = actOf(entry, 0);
  const atk = actOf(entry, 1);
  const wDur = walk ? walk.frames.map((f) => Math.max(1, f.dur) * UNIT) : [];
  const aDur = atk ? atk.frames.map((f) => Math.max(1, f.dur) * UNIT) : [];
  const wSum = wDur.reduce((a, b) => a + b, 0) || 800;
  const aSum = aDur.reduce((a, b) => a + b, 0) || 1000;
  let hit = aSum;
  if (atk) {
    const hi = atk.frames.findIndex((f) => f.hit);
    const k = hi >= 0 ? hi : atk.frames.length - 1;
    hit = aDur.slice(0, k).reduce((a, b) => a + b, 0);
  }
  const walkMs = npc.passispeed > 0 ? npc.passispeed : wSum;
  const atkMs = npc.atkspeed > 0 ? npc.atkspeed : aSum;
  const range = Math.max(1, Math.min(10, Number(npc.ranged) || 1));
  out[name] = [walkMs, atkMs, Math.round(hit * atkMs / aSum), range, wDur, aDur];
}

fs.writeFileSync(path.join(ROOT, "js", "49-linmob-timing.js"),
  "// 🤖 tools/lin/export-mob-timing.js 產生：原版怪物節奏 [走一格ms, 攻擊ms, 打中ms, 攻擊距離格, 走路各幀ms, 攻擊各幀ms]\n" +
  "var LIN_MOB_TIMING = " + JSON.stringify(out) + ";\n", "utf8");
console.log("timing", Object.keys(out).length, "miss", miss);
