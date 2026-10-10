// 區塊渲染：地面 + 物件，輸出 RGBA 畫布（含邊界外溢 margin）
const fs = require("fs");
const path = require("path");
const { CLIENT_ROOT } = require("./pak");
const { loadTil } = require("./til");
const { parseS32, parseSeg } = require("./s32");

// 天堂座標：tile(mx,my) → 螢幕 sx=(mx+my)*24, sy=(my-mx)*12；區塊 3072×1536
const MARGIN = 480;
const BW = 3072 + MARGIN * 2;
const BH = 1536 + MARGIN * 2;
const ORG_X = MARGIN;
const ORG_Y = 63 * 12 + MARGIN;

function listBlocks(mapId) {
  const dir = path.join(CLIENT_ROOT, "map", String(mapId));
  const names = fs.readdirSync(dir);
  const byKey = new Map();
  for (const n of names) {
    const m = /^([0-9a-f]{4})([0-9a-f]{4})\.(s32|seg)$/i.exec(n);
    if (!m) continue;
    const key = m[1] + m[2];
    const prev = byKey.get(key);
    if (!prev || m[3].toLowerCase() === "s32") byKey.set(key, { file: n, bx: parseInt(m[1], 16), by: parseInt(m[2], 16) });
  }
  return [...byKey.values()];
}

function readBlock(mapId, file) {
  const b = fs.readFileSync(path.join(CLIENT_ROOT, "map", String(mapId), file));
  return /\.s32$/i.test(file) ? parseS32(b) : parseSeg(b);
}

function renderBlock(blockData, opts) {
  const o = opts || {};
  const img = new Uint8Array(BW * BH * 4);
  function blit(blk, dx, dy) {
    for (let y = 0; y < blk.h; y++) {
      const ty = dy + blk.y + y;
      if (ty < 0 || ty >= BH) continue;
      const row = ty * BW;
      for (let x = 0; x < blk.w; x++) {
        const so = (y * blk.w + x) * 4;
        const a = blk.px[so + 3];
        if (!a) continue;
        const tx = dx + blk.x + x;
        if (tx < 0 || tx >= BW) continue;
        const d = (row + tx) * 4;
        if (a === 255) { img[d] = blk.px[so]; img[d + 1] = blk.px[so + 1]; img[d + 2] = blk.px[so + 2]; }
        else { const k = a / 255; for (let c = 0; c < 3; c++) img[d + c] = img[d + c] * (1 - k) + blk.px[so + c] * k; }
        img[d + 3] = 255;
      }
    }
  }
  function draw(v, cx, cy) {
    const blocks = loadTil(v >> 8);
    const blk = blocks && blocks[v & 0xff];
    if (!blk) return;
    const mx = cx >> 1;
    blit(blk, cx * 24 - mx * 24 + cy * 24 + ORG_X, cy * 12 - mx * 12 + ORG_Y);
  }
  if (!o.noGround) {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) draw(blockData.ground[y * 128 + x], x, y);
  }
  if (!o.noObjects) {
    const objs = blockData.objs.map((ob, i) => ({ ...ob, i }));
    objs.sort((a, b) => a.layer - b.layer || a.i - b.i);
    for (const ob of objs) {
      if (o.filter && !o.filter(ob)) continue;
      draw(ob.v, ob.x, ob.y);
    }
  }
  return img;
}

module.exports = { MARGIN, BW, BH, ORG_X, ORG_Y, listBlocks, readBlock, renderBlock };
