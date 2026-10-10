// 原版地圖「遮擋物件」：高於地面的物件群組（樹、房屋、牆）各自切成遮罩，依底座深度供人物前後遮擋
// 用法：node tools/lin/export-linobj.js <outName>   （需先有 export-linmap.js 產生的 meta.json）
// 輸出：assets/linmap/<outName>/o_<c>_<r>.webp（無損 alpha 遮罩圖集）＋ o_<c>_<r>.json（[ax,ay,w,h,ix,iy,base] 匯出圖座標）
//   顏色直接拿底圖 c_*.webp（已載入、像素完全對齊），這裡只存「哪些像素屬於這個物件」；
//   只取不透明像素（半透明影子不算）；底座＝群組最南的不透明格中心
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const R = require("./render");
const { loadTil } = require("./til");

const outName = process.argv[2];
if (!outName) { console.error("usage: node tools/lin/export-linobj.js <outName>"); process.exit(1); }
const outDir = path.join(__dirname, "..", "..", "assets", "linmap", outName);
const meta = JSON.parse(fs.readFileSync(path.join(outDir, "meta.json"), "utf8"));
const mapId = String(meta.linMap);

const CH = meta.chunk;
const M = 96;
const MIN_TALL = 40;     // 底座以上至少這麼高才算會擋人
const WIDE = 240;        // 超寬群組（城牆、長籬笆）切直條，各條自己的底座
const STRIP = 96;
const ATLAS_W = 1024;

const nX = meta.tiles.nx / 64, nY = meta.tiles.ny / 64;
const minBx = meta.tiles.bx0, minBy = meta.tiles.by0;
const offY = (nX - 1) * 768;
const blocks = R.listBlocks(mapId).filter((b) => b.bx >= minBx && b.bx < minBx + nX && b.by >= minBy && b.by < minBy + nY);

function tile(v) {
  const t = loadTil(v >> 8);
  return t && t[v & 0xff];
}

const byChunk = new Map();
let nSprites = 0, nGroups = 0;

for (const b of blocks) {
  const i = b.bx - minBx, j = b.by - minBy;
  const ox = (i + j) * 1536 + M, oy = (j - i) * 768 + offY + M + 756;
  const d = R.readBlock(mapId, b.file);
  const objs = d.objs.map((o, k) => ({ ...o, k })).sort((a, c) => a.layer - c.layer || a.k - c.k);
  const groups = new Map();
  for (const o of objs) {
    if (!groups.has(o.g)) groups.set(o.g, []);
    groups.get(o.g).push(o);
  }
  for (const ps of groups.values()) {
    const pieces = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of ps) {
      const blk = tile(o.v);
      if (!blk) continue;
      let opaque = false;
      for (let p = 3; p < blk.px.length; p += 4) if (blk.px[p] === 255) { opaque = true; break; }
      if (!opaque) continue;
      const mx = o.x >> 1;
      const sx = ox + o.x * 24 - mx * 24 + o.y * 24, sy = oy + o.y * 12 - mx * 12;
      const px = sx + blk.x, py = sy + blk.y;
      pieces.push({ blk, px, py, base: sy + 12 });
      x0 = Math.min(x0, px); y0 = Math.min(y0, py);
      x1 = Math.max(x1, px + blk.w); y1 = Math.max(y1, py + blk.h);
    }
    if (!pieces.length) continue;
    const gBase = Math.max(...pieces.map((p) => p.base));
    if (gBase - y0 < MIN_TALL) continue;
    nGroups++;
    const W = x1 - x0, H = y1 - y0;
    const buf = new Uint8Array(W * H * 4);
    for (const p of pieces) {
      const { blk } = p;
      for (let y = 0; y < blk.h; y++) {
        const row = (p.py - y0 + y) * W;
        for (let x = 0; x < blk.w; x++) {
          const so = (y * blk.w + x) * 4;
          if (blk.px[so + 3] !== 255) continue;
          buf[(row + p.px - x0 + x) * 4 + 3] = 255;
        }
      }
    }
    const strips = [];
    if (W > WIDE) {
      for (let sx = 0; sx < W; sx += STRIP) {
        const sw = Math.min(STRIP, W - sx);
        const ax0 = x0 + sx, ax1 = ax0 + sw;
        let base = -Infinity;
        for (const p of pieces) if (p.px < ax1 && p.px + p.blk.w > ax0) base = Math.max(base, p.base);
        if (base > -Infinity) strips.push({ sx, sw, base });
      }
    } else strips.push({ sx: 0, sw: W, base: gBase });
    for (const s of strips) {
      // 裁掉直條內全透明的上下列
      let top = -1, bot = -1;
      for (let y = 0; y < H && top < 0; y++) for (let x = s.sx; x < s.sx + s.sw; x++) if (buf[(y * W + x) * 4 + 3]) { top = y; break; }
      if (top < 0) continue;
      for (let y = H - 1; y >= top && bot < 0; y--) for (let x = s.sx; x < s.sx + s.sw; x++) if (buf[(y * W + x) * 4 + 3]) { bot = y; break; }
      if (s.base - (y0 + top) < MIN_TALL) continue;
      const sh = bot - top + 1;
      const px = new Uint8Array(Math.ceil(s.sw * sh / 8));
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < s.sw; x++) {
          if (!buf[((top + y) * W + s.sx + x) * 4 + 3]) continue;
          const n = y * s.sw + x;
          px[n >> 3] |= 1 << (n & 7);
        }
      }
      const ix = x0 + s.sx, iy = y0 + top;
      const key = Math.floor((ix + s.sw / 2) / CH) + "_" + Math.floor(s.base / CH);
      if (!byChunk.has(key)) byChunk.set(key, []);
      byChunk.get(key).push({ w: s.sw, h: sh, px, ix, iy, base: s.base });
      nSprites++;
    }
  }
}

(async () => {
  for (const f of fs.readdirSync(outDir)) if (/^o_\d+_\d+\.(webp|json)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  let bytes = 0;
  const keys = [];
  for (const [key, list] of byChunk) {
    list.sort((a, c) => c.h - a.h || c.w - a.w);
    const AW = Math.max(ATLAS_W, ...list.map((s) => s.w));
    let x = 0, y = 0, rowH = 0;
    for (const s of list) {
      if (x + s.w > AW) { x = 0; y += rowH + 1; rowH = 0; }
      s.ax = x; s.ay = y;
      x += s.w + 1;
      rowH = Math.max(rowH, s.h);
    }
    const AH = y + rowH;
    const atlas = Buffer.alloc(AW * AH * 2);
    for (const s of list) {
      for (let r = 0; r < s.h; r++) {
        for (let c = 0; c < s.w; c++) {
          const n = r * s.w + c;
          if (s.px[n >> 3] & (1 << (n & 7))) atlas[((s.ay + r) * AW + s.ax + c) * 2 + 1] = 255;
        }
      }
    }
    const out = await sharp(atlas, { raw: { width: AW, height: AH, channels: 2 } }).webp({ lossless: true, effort: 6 }).toBuffer();
    fs.writeFileSync(path.join(outDir, "o_" + key + ".webp"), out);
    const idx = list.map((s) => [s.ax, s.ay, s.w, s.h, s.ix, s.iy, s.base]);
    fs.writeFileSync(path.join(outDir, "o_" + key + ".json"), JSON.stringify(idx), "utf8");
    bytes += out.length;
    keys.push(key);
  }
  meta.objChunks = keys.sort();
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta), "utf8");
  console.log("done", outName, "blocks", blocks.length, "groups", nGroups, "sprites", nSprites, "atlases", keys.length, (bytes / 1048576).toFixed(1) + "MB");
})();
