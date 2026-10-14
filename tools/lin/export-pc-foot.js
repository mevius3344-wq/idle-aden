// 原版職業外形站立點匯出 → js/49-linpc-foot.js
// assets/classanim/<avatar>* 每個外形所有方向／動作共用同一張畫布，但站立點（原版 .spr 格心）不在圖底中央；
// 原版拼塊地圖要把站立點對到所在格子中心，人跟怪才站在相鄰格上正面交戰。
// 做法：拿客戶端 .spr 的待機幀跟我們的 unarmed_idle_0.png 對齊（裁掉透明邊後同尺寸），
// 站立點＝.spr 幀座標 (24 - x, 12 - y)（同 export-mob-spr.js／build-town-npcs.js 的 ANCHOR），換算到我們圖上；八個方向取眾數。
// 輸出 { "<avatar>": [站立點距圖中心 x（右正）, 站立點距圖底 y] }（原版像素）
// 用法：node tools/lin/export-pc-foot.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { loadSpr } = require("./spr");
const { loadListSpr } = require("./listspr");

const ROOT = path.join(__dirname, "..", "..");
const AV = { 王子: 0, 公主: 1, 男騎士: 61, 女騎士: 48, 男妖精: 138, 女妖精: 37, 男法師: 734, 女法師: 1186, 男黑暗妖精: 2786, 女黑暗妖精: 2796, 男龍騎士: 6658, 女龍騎士: 6661, 男幻術士: 6671, 女幻術士: 6650, 男戰士: 12490, 女戰士: 12494 };
const SFX = ["2", "F", "", "d3", "d4", "d5", "d6", "d7"];
const ANCHOR_X = 24, ANCHOR_Y = 12;

function trim(px, w, h, th) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

(async () => {
  const list = loadListSpr();
  const out = {};
  const miss = [];
  for (const [av, gfx] of Object.entries(AV)) {
    const e = list.get(gfx);
    const a = e && e.actions[3];
    if (!a || !a.frames.length) { miss.push(av); continue; }
    const votes = {};
    for (let d = 0; d < 8; d++) {
      const file = path.join(ROOT, "assets", "classanim", av + SFX[d], "unarmed_idle_0.png");
      if (!fs.existsSync(file)) continue;
      const fr = a.frames[0];
      const f = loadSpr(e.sprite, fr.img + (a.dir ? d : 0))[fr.frame];
      if (!f) continue;
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const th of [8, 0, 16, 32]) {
        const tb = trim(f.px, f.w, f.h, th), ob = trim(data, info.width, info.height, th);
        if (!tb || !ob || tb.w !== ob.w || tb.h !== ob.h) continue;
        const ax = ob.x0 - tb.x0 + (ANCHOR_X - f.x), ay = ob.y0 - tb.y0 + (ANCHOR_Y - f.y);
        const k = (ax - info.width / 2) + "," + (info.height - ay);
        votes[k] = (votes[k] || 0) + 1;
        break;
      }
    }
    const best = Object.entries(votes).sort((p, q) => q[1] - p[1])[0];
    if (!best) { miss.push(av); continue; }
    out[av] = best[0].split(",").map(Number);
    console.log(av.padEnd(6), JSON.stringify(out[av]), "votes", JSON.stringify(votes));
  }
  fs.writeFileSync(path.join(ROOT, "js", "49-linpc-foot.js"),
    "// 🤖 tools/lin/export-pc-foot.js 產生：職業外形圖內原版站立點 { \"外形\": [距圖中心 x, 距圖底 y] }（原版像素）\n" +
    "var LIN_PC_FOOT = " + JSON.stringify(out) + ";\n", "utf8");
  console.log("pc foot", Object.keys(out).length, "miss", miss.join(" ") || "-");
})();
