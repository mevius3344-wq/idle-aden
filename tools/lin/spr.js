// 天堂 .spr 解碼（Lin.Helper.Core SprReader 移植）
// 回傳每幀 { x, y, w, h, px: RGBA }；(x,y)＝圖左上相對於站立點（腳底格中心）的偏移
const { openPak } = require("./pak");

const MASK = 0x8000;
let _paks = null;
function paks() {
  if (_paks) return _paks;
  _paks = ["Sprite"].concat(Array.from({ length: 16 }, (_, i) => "Sprite" + String(i).padStart(2, "0"))).map(openPak);
  return _paks;
}

function readSprFile(name) {
  for (const p of paks()) {
    const b = p.read(name);
    if (b) return b;
  }
  return null;
}

function rgb555(c) {
  return [((c >> 10) & 31) << 3, ((c >> 5) & 31) << 3, (c & 31) << 3];
}

function decodeSpr(buf) {
  let o = 0;
  const u8 = () => buf[o++];
  const i8 = () => { const v = buf.readInt8(o); o += 1; return v; };
  const u16 = () => { const v = buf.readUInt16LE(o); o += 2; return v; };
  const i16 = () => { const v = buf.readInt16LE(o); o += 2; return v; };
  const i32 = () => { const v = buf.readInt32LE(o); o += 4; return v; };

  let palette = null;
  let frameCount = u8();
  if (frameCount === 255) {
    let ps = u8();
    if (ps === 0) ps = 256;
    palette = new Array(ps);
    for (let i = 0; i < ps; i++) palette[i] = u16();
    frameCount = u8();
  }
  const defs = [];
  for (let i = 0; i < frameCount; i++) {
    i16(); i16(); i16(); i16(); u16(); u16();
    const n = u16();
    const blocks = [];
    for (let j = 0; j < n; j++) blocks.push({ a: i8(), b: i8(), type: u8(), id: u16() });
    defs.push(blocks);
  }
  const tableSize = i32();
  const offs = [];
  for (let i = 0; i < tableSize; i++) offs.push(i32());
  i32();
  const dataStart = o;
  const blockPx = new Array(tableSize);
  for (let i = 0; i < tableSize; i++) {
    const px = new Uint16Array(576).fill(MASK);
    o = dataStart + offs[i];
    const sx = u8(), sy = u8();
    u8();
    const lines = u8();
    for (let ln = 0; ln < lines; ln++) {
      let x = sx;
      const segs = u8();
      for (let s = 0; s < segs; s++) {
        x += u8() >> 1;
        const cnt = u8();
        for (let k = 0; k < cnt; k++) {
          const c = palette ? palette[u8()] : u16();
          const yy = ln + sy;
          if (x < 24 && yy < 24) px[yy * 24 + x] = c;
          x++;
        }
      }
    }
    blockPx[i] = px;
  }
  const frames = [];
  for (const blocks of defs) {
    if (!blocks.length) { frames.push(null); continue; }
    const pos = blocks.map(({ a, b }) => {
      const aa = a < 0 ? a - 1 : a;
      const half = Math.trunc(aa / 2);
      return { bx: 24 * (b + a - half), by: 12 * (b - half) };
    });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pos) {
      minX = Math.min(minX, p.bx); maxX = Math.max(maxX, p.bx + 23);
      minY = Math.min(minY, p.by); maxY = Math.max(maxY, p.by + 23);
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = Buffer.alloc(w * h * 4);
    blocks.forEach((bl, bi) => {
      const src = blockPx[bl.id];
      if (!src) return;
      const { bx, by } = pos[bi];
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const c = src[y * 24 + x];
        if (c === MASK) continue;
        const di = ((by + y - minY) * w + (bx + x - minX)) * 4;
        const [r, g, b] = rgb555(c);
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
      }
    });
    frames.push({ x: minX, y: minY, w, h, px: out });
  }
  return frames;
}

const _cache = new Map();
function loadSpr(gfx, sub) {
  const k = gfx + "-" + sub;
  if (_cache.has(k)) return _cache.get(k);
  const b = readSprFile(k + ".spr");
  let f = null;
  try { f = b ? decodeSpr(b) : null; } catch (e) { f = null; }
  _cache.set(k, f);
  return f;
}

module.exports = { loadSpr, decodeSpr };
