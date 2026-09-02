"use strict";

const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "../js/00-data.js"), "utf8");
const pool = [];
let cur = null;
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*"([^"]+)":\s*\{/);
  if (m) cur = m[1];
  const w = line.match(/gachaWeight:\s*(\d+)/);
  if (cur && w) {
    const wt = Number(w[1]);
    if (wt > 0 && !cur.startsWith("sk_")) pool.push({ id: cur, weight: wt });
  }
}
const seen = new Set();
const out = pool.filter((p) => {
  if (seen.has(p.id)) return false;
  seen.add(p.id);
  return true;
});
const outPath = path.join(__dirname, "../lib/pandora-gacha-pool.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log("wrote", out.length, "items to", outPath);
