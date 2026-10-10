// .s32 地圖區塊解析：ground(64×128 u32)、L2、屬性(64×64×4)、物件群組
function parseS32(b) {
  const ground = new Uint32Array(64 * 128);
  for (let i = 0; i < 64 * 128; i++) ground[i] = b.readUInt32LE(i * 4);
  let p = 64 * 128 * 4;
  const l2 = b.readUInt16LE(p); p += 2 + l2 * 6;
  const attr = new Uint16Array(64 * 128);
  for (let i = 0; i < 64 * 128; i++) attr[i] = b.readUInt16LE(p + i * 2);
  p += 64 * 128 * 2;
  const objs = [];
  const groups = p + 4 <= b.length ? b.readInt32LE(p) : 0;
  p += 4;
  for (let g = 0; g < groups && p + 4 <= b.length; g++) {
    const gid = b.readInt16LE(p), n = b.readUInt16LE(p + 2); p += 4;
    for (let k = 0; k < n && p + 7 <= b.length; k++) {
      objs.push({ g, gid, x: b[p], y: b[p + 1], layer: b[p + 2], v: b.readUInt32LE(p + 3) });
      p += 7;
    }
  }
  return { ground, attr, objs };
}

function parseSeg(b) {
  const ground = new Uint32Array(64 * 128);
  for (let i = 0; i < 64 * 128; i++) ground[i] = b.readUInt16LE(i * 2);
  return { ground, attr: null, objs: [] };
}

module.exports = { parseS32, parseSeg };
