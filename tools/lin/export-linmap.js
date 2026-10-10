// 天堂原版地圖 → 遊戲圖塊（1024 webp）＋ 可走格子 walk.bin ＋ meta.json
// 用法：node tools/lin/export-linmap.js <linMapId> <outName> [quality=72] [--around x,y,r]
//   --around：只取涵蓋原版座標 (x±r, y±r) 的區塊（村莊等大地圖局部）
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const R = require("./render");
const { loadTil } = require("./til");

const mapId = process.argv[2];
const outName = process.argv[3];
const quality = Number(/^\d+$/.test(process.argv[4] || "") ? process.argv[4] : 72);
const _ai = process.argv.indexOf("--around");
const around = _ai > 0 ? process.argv[_ai + 1].split(",").map(Number) : null;
if (mapId == null || !outName) {
  console.error("usage: node tools/lin/export-linmap.js <linMapId> <outName> [quality]");
  process.exit(1);
}

const CH = 1024;
const M = 96;
const outDir = path.join(__dirname, "..", "..", "assets", "linmap", outName);

// 區塊 bx 涵蓋原版 x：[(bx-0x7fff)*64 + 0x7fff - 64, +64)
const blockX0 = (b) => (b - 0x7fff) * 64 + 0x7fff - 64;
const blocks = R.listBlocks(mapId).filter((b) => {
  if (!around) return true;
  const [x, y, r] = around;
  const x0 = blockX0(b.bx), y0 = blockX0(b.by);
  return x0 + 64 > x - r && x0 <= x + r && y0 + 64 > y - r && y0 <= y + r;
});
if (!blocks.length) { console.error("no blocks in range"); process.exit(1); }
const minBx = Math.min(...blocks.map((b) => b.bx)), maxBx = Math.max(...blocks.map((b) => b.bx));
const minBy = Math.min(...blocks.map((b) => b.by)), maxBy = Math.max(...blocks.map((b) => b.by));
const nX = maxBx - minBx + 1, nY = maxBy - minBy + 1;
const W = (nX + nY) * 1536 + M * 2;
const H = (nX + nY) * 768 + M * 2;
const offY = (nX - 1) * 768;

const data = blocks
  .map((b) => {
    const i = b.bx - minBx, j = b.by - minBy;
    const d = R.readBlock(mapId, b.file);
    const objs = d.objs.map((o, k) => ({ ...o, k })).sort((a, c) => a.layer - c.layer || a.k - c.k);
    return { ...b, i, j, d, objs, ox: (i + j) * 1536 + M, oy: (j - i) * 768 + offY + M + 756 };
  })
  .sort((a, b) => (a.j - a.i) - (b.j - b.i) || a.i - b.i);

function drawInto(buf, bufY0, bufH, v, sx, sy) {
  const blocksT = loadTil(v >> 8);
  const blk = blocksT && blocksT[v & 0xff];
  if (!blk) return;
  const top = sy + blk.y;
  if (top + blk.h <= bufY0 || top >= bufY0 + bufH) return;
  for (let y = 0; y < blk.h; y++) {
    const ty = top + y - bufY0;
    if (ty < 0 || ty >= bufH) continue;
    const row = ty * W;
    for (let x = 0; x < blk.w; x++) {
      const so = (y * blk.w + x) * 4;
      const a = blk.px[so + 3];
      if (!a) continue;
      const tx = sx + blk.x + x;
      if (tx < 0 || tx >= W) continue;
      const d = (row + tx) * 4;
      if (a === 255) { buf[d] = blk.px[so]; buf[d + 1] = blk.px[so + 1]; buf[d + 2] = blk.px[so + 2]; }
      else { const k = a / 255; buf[d] = buf[d] * (1 - k) + blk.px[so] * k; buf[d + 1] = buf[d + 1] * (1 - k) + blk.px[so + 1] * k; buf[d + 2] = buf[d + 2] * (1 - k) + blk.px[so + 2] * k; }
      buf[d + 3] = 255;
    }
  }
}

function cellPos(b, cx, cy) {
  const mx = cx >> 1;
  return [b.ox + cx * 24 - mx * 24 + cy * 24, b.oy + cy * 12 - mx * 12];
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^c_\d+_\d+\.webp$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  const cols = Math.ceil(W / CH), rows = Math.ceil(H / CH);
  const chunks = [];
  let bytes = 0;
  for (let r = 0; r < rows; r++) {
    const y0 = r * CH, h = Math.min(CH, H - y0);
    const buf = new Uint8Array(W * h * 4);
    const near = data.filter((b) => b.oy - 756 - 600 < y0 + h && b.oy + 800 + 600 > y0);
    for (const b of near) {
      for (let cy = 0; cy < 64; cy++) for (let cx = 0; cx < 128; cx++) {
        const [sx, sy] = cellPos(b, cx, cy);
        drawInto(buf, y0, h, b.d.ground[cy * 128 + cx], sx, sy);
      }
    }
    for (const b of near) {
      for (const o of b.objs) {
        const [sx, sy] = cellPos(b, o.x, o.y);
        drawInto(buf, y0, h, o.v, sx, sy);
      }
    }
    for (let c = 0; c < cols; c++) {
      const x0 = c * CH, w = Math.min(CH, W - x0);
      const piece = Buffer.alloc(w * h * 4);
      let any = false;
      for (let y = 0; y < h; y++) {
        const src = (y * W + x0) * 4;
        Buffer.from(buf.buffer, buf.byteOffset + src, w * 4).copy(piece, y * w * 4);
      }
      for (let p = 3; p < piece.length; p += 4) if (piece[p]) { any = true; break; }
      if (!any) continue;
      const file = `c_${c}_${r}.webp`;
      const out = await sharp(piece, { raw: { width: w, height: h, channels: 4 } }).webp({ quality, alphaQuality: 80, effort: 5 }).toBuffer();
      fs.writeFileSync(path.join(outDir, file), out);
      bytes += out.length;
      chunks.push(`${c}_${r}`);
    }
    process.stdout.write(`row ${r + 1}/${rows} chunks ${chunks.length} ${(bytes / 1048576).toFixed(1)}MB\n`);
  }

  // 可走格子：1=可走 2=安全區
  const tnx = nX * 64, tny = nY * 64;
  const walk = new Uint8Array(tnx * tny);
  const attrStat = {};
  for (const b of data) {
    const a = b.d.attr;
    if (!a) continue;
    for (let my = 0; my < 64; my++) for (let mx = 0; mx < 64; mx++) {
      const a1 = a[(my * 64 + mx) * 2], a2 = a[(my * 64 + mx) * 2 + 1];
      const key = a1 + "/" + a2;
      attrStat[key] = (attrStat[key] || 0) + 1;
      let v = 0;
      if (!((a1 | a2) & 1)) v |= 1;
      if ((a1 | a2) & 4) v |= 2;
      walk[(b.j * 64 + my) * tnx + (b.i * 64 + mx)] = v;
    }
  }
  fs.writeFileSync(path.join(outDir, "walk.bin"), walk);
  const meta = {
    linMap: Number(mapId), w: W, h: H, chunk: CH, cols, rows, chunks,
    tiles: { nx: tnx, ny: tny, bx0: minBx, by0: minBy },
    iso: { ox: M + 24, oy: M + offY + 756 + 12 }
  };
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta), "utf8");
  const top = Object.entries(attrStat).sort((a, b) => b[1] - a[1]).slice(0, 16);
  console.log("done", outDir, "W", W, "H", H, "chunks", chunks.length, (bytes / 1048576).toFixed(1) + "MB", "attr", JSON.stringify(top));
})();
