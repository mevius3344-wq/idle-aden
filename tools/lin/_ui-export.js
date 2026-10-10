// 匯出客戶端介面圖：Sprite*.pak 的 .img（w,h,flag u16 + RGB555，flag=1 時 0 為透明）與 .png
// 檔尾 u16＝透明色鍵（多為綠 0x324C）
// 輸出 tools/lin/_out/ui/img/*.png、ui/png/*.png，並產生縮圖總表 ui/sheet_*.png 供挑選
// 用法：node tools/lin/_ui-export.js [--sheets-only]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { openPak } = require("./pak");

const OUT = path.join(__dirname, "_out", "ui");
const names = ["Sprite"].concat(Array.from({ length: 16 }, (_, i) => "Sprite" + String(i).padStart(2, "0")));

function decodeImg(b) {
  if (!b || b.length < 8) return null;
  const w = b.readUInt16LE(0), h = b.readUInt16LE(2), flag = b.readUInt16LE(4);
  if (!w || !h || w > 2048 || h > 2048 || 6 + w * h * 2 > b.length) return null;
  const key = b.length >= 8 + w * h * 2 ? b.readUInt16LE(6 + w * h * 2) : 0;
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = b.readUInt16LE(6 + i * 2);
    const r = (v >> 10) & 31, g = (v >> 5) & 31, bl = v & 31;
    px[i * 4] = (r << 3) | (r >> 2);
    px[i * 4 + 1] = (g << 3) | (g >> 2);
    px[i * 4 + 2] = (bl << 3) | (bl >> 2);
    px[i * 4 + 3] = flag === 1 && v === key ? 0 : 255;
  }
  return { w, h, flag, px };
}

async function exportAll() {
  fs.mkdirSync(path.join(OUT, "img"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "png"), { recursive: true });
  const seen = new Set();
  const meta = [];
  for (const n of names) {
    let p;
    try { p = openPak(n); } catch (e) { continue; }
    for (const [k, e] of p.entries) {
      if (seen.has(k)) continue;
      if (k.endsWith(".img")) {
        seen.add(k);
        const d = decodeImg(p.read(k));
        if (!d) continue;
        await sharp(d.px, { raw: { width: d.w, height: d.h, channels: 4 } }).png().toFile(path.join(OUT, "img", k.replace(/\.img$/, ".png")));
        meta.push({ f: "img/" + k.replace(/\.img$/, ".png"), w: d.w, h: d.h, flag: d.flag });
      } else if (k.endsWith(".png")) {
        seen.add(k);
        const b = p.read(k);
        if (!b || b.readUInt32BE(0) !== 0x89504e47) continue;
        fs.writeFileSync(path.join(OUT, "png", k), b);
        try {
          const m = await sharp(b).metadata();
          meta.push({ f: "png/" + k, w: m.width, h: m.height });
        } catch (er) {}
      }
    }
    p.close();
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta), "utf8");
  return meta;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
async function sheets(meta) {
  const CELL = 128, COLS = 10, ROWS = 8, PER = COLS * ROWS;
  const sorted = meta.slice().sort((a, b) => (a.f < b.f ? -1 : 1));
  let si = 0;
  for (let s = 0; s < sorted.length; s += PER) {
    const part = sorted.slice(s, s + PER);
    const comps = [];
    for (let i = 0; i < part.length; i++) {
      const m = part[i];
      const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
      try {
        const buf = await sharp(path.join(OUT, m.f)).resize(CELL - 8, CELL - 24, { fit: "inside" }).png().toBuffer();
        comps.push({ input: buf, left: x + 4, top: y + 4 });
      } catch (e) {}
      const label = path.basename(m.f, ".png") + " " + m.w + "x" + m.h;
      comps.push({ input: Buffer.from(`<svg width="${CELL}" height="18"><rect width="100%" height="100%" fill="#000" opacity="0.7"/><text x="3" y="13" font-size="11" fill="#ff0" font-family="Arial">${esc((m.f.startsWith("png") ? "P:" : "") + label)}</text></svg>`), left: x, top: y + CELL - 18 });
    }
    await sharp({ create: { width: COLS * CELL, height: ROWS * CELL, channels: 4, background: { r: 60, g: 60, b: 70, alpha: 1 } } })
      .composite(comps).png().toFile(path.join(OUT, "sheet_" + String(si++).padStart(3, "0") + ".png"));
  }
  return si;
}

(async () => {
  const meta = process.argv.includes("--sheets-only") ? JSON.parse(fs.readFileSync(path.join(OUT, "meta.json"), "utf8")) : await exportAll();
  const n = await sheets(meta);
  console.log("images", meta.length, "sheets", n);
})();
