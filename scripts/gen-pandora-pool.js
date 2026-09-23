"use strict";

const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "../js/00-data.js"), "utf8");
const pool = [];
let cur = null;
let isCard = false;
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*"([^"]+)":\s*\{/);
  if (m) {
    cur = m[1];
    isCard = false;
  }
  if (/eff:\s*['"]card['"]/.test(line)) isCard = true;
  const w = line.match(/gachaWeight:\s*(\d+)/);
  if (cur && w) {
    const wt = Number(w[1]);
    // 🎴 抽抽樂池：跳過技能／怪物卡（card_* 由 js/15 動態生成，00-data 亦雙重排除）
    if (wt > 0 && !cur.startsWith("sk_") && !isCard && !cur.startsWith("card_")) {
      pool.push({ id: cur, weight: wt });
    }
  }
}
const seen = new Set();
const out = pool.filter((p) => {
  if (seen.has(p.id)) return false;
  seen.add(p.id);
  return true;
});
const outPath = path.join(__dirname, "../lib/pandora-gacha-pool.json");
const outPath2 = path.join(__dirname, "../data/pandora-gacha-pool.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
fs.mkdirSync(path.dirname(outPath2), { recursive: true });
fs.writeFileSync(outPath2, JSON.stringify(out));
console.log("wrote", out.length, "items to", outPath, "and data/");
