/**
 * 將俯視地板瓦做成可平鋪無縫：四邊交叉淡化＋半格錯位再合成。
 * 用法：node tools/make-seamless-tiles.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(process.env.USERPROFILE || '', '.cursor', 'projects', 'c-Users-FUTURE-Desktop', 'assets');
const OUT = path.join(ROOT, 'assets', 'area');
const SIZE = 1024;
const BAND = 96;

const JOBS = [
  { src: 'seamless-forest.png', dest: '俯視密林.png' },
  { src: 'seamless-desert.png', dest: '俯視沙漠.png' },
  { src: 'seamless-dungeon.png', dest: '俯視地監.png' },
  { src: 'seamless-coast.png', dest: '俯視海岸.png' },
  { src: 'seamless-lava.png', dest: '俯視熔岩.png' }
];

async function loadRgba(file) {
  const { data, info } = await sharp(file)
    .resize(SIZE, SIZE, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function idx(x, y, w) {
  return (y * w + x) * 4;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 水平＋垂直邊緣交叉淡化，讓左右／上下接縫消失 */
function wrapBlend(buf, w, h, band) {
  const out = Buffer.from(buf);
  // 左右
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < band; x++) {
      const t = x / band;
      const lx = x;
      const rx = w - band + x;
      for (let c = 0; c < 4; c++) {
        const L = buf[idx(lx, y, w) + c];
        const R = buf[idx(rx, y, w) + c];
        // 左緣混入右緣內容；右緣混入左緣內容
        out[idx(lx, y, w) + c] = Math.round(lerp(R, L, t));
        out[idx(rx, y, w) + c] = Math.round(lerp(L, R, t));
      }
    }
  }
  // 上下（在已水平處理的 out 上再處理）
  const mid = Buffer.from(out);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < band; y++) {
      const t = y / band;
      const ty = y;
      const by = h - band + y;
      for (let c = 0; c < 4; c++) {
        const T = mid[idx(x, ty, w) + c];
        const B = mid[idx(x, by, w) + c];
        out[idx(x, ty, w) + c] = Math.round(lerp(B, T, t));
        out[idx(x, by, w) + c] = Math.round(lerp(T, B, t));
      }
    }
  }
  return out;
}

async function processOne(job) {
  const srcPath = path.join(SRC, job.src);
  const destPath = path.join(OUT, job.dest);
  if (!fs.existsSync(srcPath)) throw new Error('missing ' + srcPath);
  const { data, w, h } = await loadRgba(srcPath);
  const seamless = wrapBlend(data, w, h, BAND);
  await sharp(seamless, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 8 })
    .toFile(destPath);
  console.log('OK', job.dest, fs.statSync(destPath).size);
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const job of JOBS) await processOne(job);
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
