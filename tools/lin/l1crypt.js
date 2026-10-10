// 天堂 pak／idx 區塊加密（Lin.Helper.Core PakTools 移植）：8-byte 區塊 16 輪 Feistel，表在 tools/lin/crypt/Map1~5.bin
const fs = require("fs");
const path = require("path");

const M = [1, 2, 3, 4, 5].map((i) => fs.readFileSync(path.join(__dirname, "crypt", `Map${i}.bin`)));
const [map1, map2, map3, map4, map5] = M;

function perm(input, map) {
  const out = Buffer.alloc(8);
  for (let bg = 0, bi = 0; bg < 16; bg += 2, bi++) {
    const b = input[bi], hi = b >> 4, lo = b & 15;
    for (let i = 0; i < 8; i++) {
      const o = bg * 128 + i;
      out[i] |= map[o + hi * 8] | map[o + (16 + lo) * 8];
    }
  }
  return out;
}

function fn(r, key) {
  const e = [
    ((r[3] << 7) | (((r[0] & 249) | ((r[0] >> 2) & 6)) >> 1)) & 255,
    ((((r[0] & 1) | (r[0] << 2)) << 3) | (((r[1] >> 2) | (r[1] & 135)) >> 3)) & 255,
    ((r[2] >> 7) | (((r[1] & 31) | ((r[1] & 248) << 2)) << 1)) & 255,
    ((r[1] << 7) | (((r[2] & 249) | ((r[2] >> 2) & 6)) >> 1)) & 255,
    ((((r[2] & 1) | (r[2] << 2)) << 3) | (((r[3] >> 2) | (r[3] & 135)) >> 3)) & 255,
    ((r[0] >> 7) | (((r[3] & 31) | ((r[3] & 248) << 2)) << 1)) & 255,
  ];
  const x = e.map((v, i) => v ^ map5[key * 6 + i]);
  const s = [
    map4[(x[0] * 16) | (x[1] >> 4)],
    map4[4096 + (x[2] | ((x[1] % 16) * 256))],
    map4[8192 + ((x[3] * 16) | (x[4] >> 4))],
    map4[12288 + (x[5] | ((x[4] % 16) * 256))],
  ];
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const o = (i * 256 + s[i]) * 4;
    out[0] |= map3[o]; out[1] |= map3[o + 1]; out[2] |= map3[o + 2]; out[3] |= map3[o + 3];
  }
  return out;
}

function decodeBlock(src) {
  let cur = perm(src, map1);
  for (let k = 15; k >= 0; k--) {
    const t = fn(cur.subarray(4, 8), k);
    cur = Buffer.from([cur[4], cur[5], cur[6], cur[7], t[0] ^ cur[0], t[1] ^ cur[1], t[2] ^ cur[2], t[3] ^ cur[3]]);
  }
  return perm(Buffer.from([cur[4], cur[5], cur[6], cur[7], cur[0], cur[1], cur[2], cur[3]]), map2);
}

/** 解密 src[index..]；不足 8 bytes 的尾段原樣保留 */
function decode(src, index = 0) {
  const n = src.length - index;
  const out = Buffer.alloc(n);
  const blocks = Math.floor(n / 8);
  for (let i = 0; i < blocks; i++) decodeBlock(src.subarray(index + i * 8, index + i * 8 + 8)).copy(out, i * 8);
  src.copy(out, blocks * 8, index + blocks * 8);
  return out;
}

module.exports = { decode };
