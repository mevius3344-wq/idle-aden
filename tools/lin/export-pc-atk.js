// 原版職業普攻節奏匯出 → js/49-linpc-atk.js
// 每個職業外形（assets/classanim/<avatar>）× 武器動畫 key：{ "<avatar>|<key>": [各幀 dur（list.spr 單位）[], 打中幀 index] }
// 來源：客戶端 list.spr 該外形 gfx 的攻擊動作（各幀 dur＋"!" 打中幀）；幀數必須跟我們的 <key>_attack_N.png 一樣才收
// 用法：node tools/lin/export-pc-atk.js
const fs = require("fs");
const path = require("path");
const { loadListSpr } = require("./listspr");

const ROOT = path.join(__dirname, "..", "..");
const AV = { 王子: 0, 公主: 1, 男騎士: 61, 女騎士: 48, 男妖精: 138, 女妖精: 37, 男法師: 734, 女法師: 1186, 男黑暗妖精: 2786, 女黑暗妖精: 2796, 男龍騎士: 6658, 女龍騎士: 6661, 男幻術士: 6671, 女幻術士: 6650, 男戰士: 12490, 女戰士: 12494 };
const PREF = { unarmed: [1], sword1: [5], sword2: [51, 56, 55], dagger: [47], blunt: [12], dblunt: [12, 41], bow: [21], spear: [25], wand: [41], dual: [55], claw: [59] };

const list = loadListSpr();
const out = {};
let miss = [];
for (const [av, gfx] of Object.entries(AV)) {
  const e = list.get(gfx);
  const dir = path.join(ROOT, "assets", "classanim", av);
  if (!e || !fs.existsSync(dir)) { miss.push(av); continue; }
  const counts = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^([a-z0-9]+)_attack_(\d+)\.png$/.exec(f);
    if (m) counts[m[1]] = Math.max(counts[m[1]] || 0, +m[2] + 1);
  }
  const atks = Object.keys(e.actions).map(Number).filter((id) => /attack/.test(e.actions[id].name || ""));
  for (const [key, n] of Object.entries(counts)) {
    const order = (PREF[key] || []).concat(atks);
    let hit = null;
    for (const id of order) {
      const a = e.actions[id];
      if (!a) continue;
      const fr = a.frames.filter((f) => f.dur > 0);
      if (fr.length !== n) continue;
      const hi = fr.findIndex((f) => f.hit);
      hit = [fr.map((f) => f.dur), hi >= 0 ? hi : n - 1];
      break;
    }
    if (hit) out[av + "|" + key] = hit; else miss.push(av + "|" + key + "(" + n + ")");
  }
}
fs.writeFileSync(path.join(ROOT, "js", "49-linpc-atk.js"),
  "// 🤖 tools/lin/export-pc-atk.js 產生：原版職業普攻節奏 { \"外形|武器key\": [各幀 dur（list.spr 單位）, 打中幀 index] }\n" +
  "var LIN_PC_ATK = " + JSON.stringify(out) + ";\n", "utf8");
console.log("pc atk", Object.keys(out).length, "miss", miss.join(" "));
