// 天堂 .til 拼塊解碼：每塊為菱形半塊（24×24），type&2 為逐行壓縮
const { openPak } = require("./pak");

let _tilePak = null;
const _cache = new Map();

function rgb555(v) {
  return [((v >> 10) & 31) << 3, ((v >> 5) & 31) << 3, (v & 31) << 3];
}

// 回傳 { x, y, w, h, px: Uint8Array RGBA(w*h) } 或 null
function decodeBlock(b, s, e) {
  const type = b[s];
  let p = s + 1;
  if ((type & 2) === 0) {
    const w = 24, h = 24;
    const px = new Uint8Array(w * h * 4);
    for (let y = 0; y < 23 && p < e; y++) {
      const n = y <= 11 ? (y + 1) * 2 : 46 - y * 2;
      const x0 = (type & 1) ? 0 : 24 - n;
      for (let i = 0; i < n; i++) {
        const c = rgb555(b.readUInt16LE(p)); p += 2;
        const o = (y * w + x0 + i) * 4;
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
    return { type, x: 0, y: 0, w, h, px };
  }
  const x0 = b[p], y0 = b[p + 1], w = b[p + 2], h = b[p + 3];
  p += 4;
  const W = Math.max(1, w), H = Math.max(1, h);
  const px = new Uint8Array(W * H * 4);
  const alpha = (type & 0x14) ? 128 : 255;
  for (let y = 0; y < h && p < e; y++) {
    const segs = b[p++];
    let x = 0;
    for (let s2 = 0; s2 < segs && p < e; s2++) {
      x += b[p++] >> 1;
      const n = b[p++];
      for (let i = 0; i < n; i++) {
        const c = rgb555(b.readUInt16LE(p)); p += 2;
        if (x < W) {
          const o = (y * W + x) * 4;
          px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = alpha;
        }
        x++;
      }
    }
  }
  return { type, x: x0, y: y0, w: W, h: H, px };
}

function loadTil(id) {
  if (_cache.has(id)) return _cache.get(id);
  if (!_tilePak) _tilePak = openPak("Tile");
  const b = _tilePak.read(id + ".til");
  let blocks = null;
  if (b) {
    const count = b.readUInt32LE(0);
    const base = 4 + (count + 1) * 4;
    blocks = [];
    for (let i = 0; i < count; i++) {
      const s = base + b.readUInt32LE(4 + i * 4);
      const e = base + b.readUInt32LE(8 + i * 4);
      try { blocks.push(e > s ? decodeBlock(b, s, e) : null); } catch (_) { blocks.push(null); }
    }
  }
  _cache.set(id, blocks);
  return blocks;
}

module.exports = { loadTil, decodeBlock, rgb555 };
