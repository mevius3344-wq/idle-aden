/**
 * Install true 8-dir Q stands: import generated art → transparent PNG →
 * assets/qskin/player/<cls>/d0..d7/ + action frames from each idle.
 */
const fs = require('fs');
const path = require('path');
const jpeg = require('./node_modules/jpeg-js');
const { PNG } = require('./node_modules/pngjs');

const SRC_DIR = path.join(
  process.env.USERPROFILE || '',
  '.cursor', 'projects', 'c-Users-FUTURE-Desktop', 'assets'
);
const OUT_ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
const CLASSES = ['knight', 'elf', 'mage'];

function loadRgba(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    const png = new PNG({ width: decoded.width, height: decoded.height });
    png.data = Buffer.from(decoded.data);
    return png;
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) return PNG.sync.read(buf);
  throw new Error('bad image ' + file);
}

function savePng(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function isBackdrop(r, g, b) {
  if (r >= 242 && g >= 242 && b >= 242) return true;
  if (Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10) {
    if (r >= 175 && r <= 235) return true;
    if (r >= 130 && r <= 175) return true;
  }
  // near-black void sometimes used as bg
  if (r < 18 && g < 18 && b < 18) return true;
  return false;
}

function removeBackdrop(png) {
  const { width: w, height: h, data } = png;
  const N = w * h;
  const mark = new Uint8Array(N);
  const qx = new Int32Array(N), qy = new Int32Array(N);
  let qh = 0, qt = 0;
  const idx = (x, y) => y * w + x;
  function push(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = idx(x, y);
    if (mark[i]) return;
    const o = i * 4;
    if (!isBackdrop(data[o], data[o + 1], data[o + 2])) return;
    mark[i] = 1; qx[qt] = x; qy[qt] = y; qt++;
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (qh < qt) {
    const x = qx[qh], y = qy[qh]; qh++;
    const o = idx(x, y) * 4;
    data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  // fringe
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const o = idx(x, y) * 4;
    if (data[o + 3] < 8) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const bright = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    let touch = false;
    for (let dy = -1; dy <= 1 && !touch; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (data[idx(x + dx, y + dy) * 4 + 3] < 8) { touch = true; break; }
    }
    if (touch && sat < 28 && bright > 185) {
      data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 0;
    }
  }
  return png;
}

function contentBounds(png) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 30) {
      any = true;
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}

function cropPad(png, pad) {
  const b = contentBounds(png);
  if (!b) return png;
  const minX = Math.max(0, b.minX - pad);
  const minY = Math.max(0, b.minY - pad);
  const maxX = Math.min(png.width - 1, b.maxX + pad);
  const maxY = Math.min(png.height - 1, b.maxY + pad);
  const nw = maxX - minX + 1, nh = maxY - minY + 1;
  const out = new PNG({ width: nw, height: nh });
  out.data.fill(0);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const so = ((minY + y) * png.width + (minX + x)) * 4;
    const oo = (y * nw + x) * 4;
    out.data[oo] = png.data[so]; out.data[oo + 1] = png.data[so + 1];
    out.data[oo + 2] = png.data[so + 2]; out.data[oo + 3] = png.data[so + 3];
  }
  return out;
}

function sample(png, x, y) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return [0, 0, 0, 0];
  const o = (yi * png.width + xi) * 4;
  return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
}

function warp(src, opts) {
  const pad = 80;
  const w = src.width + pad * 2, h = src.height + pad * 2;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  const b = contentBounds(src);
  if (!b) return out;
  const pivotX = (b.minX + b.maxX) / 2 + pad;
  const pivotY = (opts.pivot === 'foot' ? b.maxY : (b.minY + b.maxY) / 2) + pad;
  const rad = ((opts.rot || 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const sx = opts.sx == null ? 1 : opts.sx;
  const sy = opts.sy == null ? 1 : opts.sy;
  const dx = opts.dx || 0, dy = opts.dy || 0;
  const alphaMul = opts.alpha == null ? 1 : opts.alpha;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let lx = (x - pivotX - dx) / sx;
    let ly = (y - pivotY - dy) / sy;
    const ix = lx * cos + ly * sin + pivotX - pad;
    const iy = -lx * sin + ly * cos + pivotY - pad;
    const [r, g, bc, a] = sample(src, ix, iy);
    if (a < 8) continue;
    const o = (y * w + x) * 4;
    out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = bc;
    out.data[o + 3] = Math.max(0, Math.min(255, Math.round(a * alphaMul)));
  }
  return cropPad(out, 8);
}

function buildActions(base, dirOut) {
  const frames = {
    'idle_0.png': warp(base, { pivot: 'foot' }),
    'idle_1.png': warp(base, { dy: -10, sy: 1.04, sx: 0.97, pivot: 'foot' }),
    'idle_2.png': warp(base, { dy: -4, rot: 2, pivot: 'foot' }),
    'walk_0.png': warp(base, { dx: -10, dy: -4, rot: -8, pivot: 'foot' }),
    'walk_1.png': warp(base, { dy: -12, pivot: 'foot' }),
    'walk_2.png': warp(base, { dx: 10, dy: -4, rot: 8, pivot: 'foot' }),
    'walk_3.png': warp(base, { dy: -10, pivot: 'foot' }),
    'attack_0.png': warp(base, { dx: -10, rot: -14, pivot: 'foot' }),
    'attack_1.png': warp(base, { dx: 8, rot: 8, pivot: 'foot' }),
    'attack_2.png': warp(base, { dx: 18, rot: 24, sx: 1.06, pivot: 'foot' }),
    'skill_0.png': warp(base, { dy: -8, pivot: 'foot' }),
    'skill_1.png': warp(base, { dy: -16, sy: 1.1, sx: 0.9, pivot: 'foot' }),
    'skill_2.png': warp(base, { dy: -12, rot: 4, pivot: 'foot' }),
    'hurt_0.png': warp(base, { dx: -12, rot: -10, pivot: 'foot' }),
    'death_0.png': warp(base, { rot: -10, pivot: 'foot' }),
    'death_1.png': warp(base, { dy: 10, rot: -40, pivot: 'foot' }),
    'death_2.png': warp(base, { dy: 22, rot: -75, alpha: 0.7, pivot: 'foot' })
  };
  for (const [name, png] of Object.entries(frames)) savePng(path.join(dirOut, name), png);
}

let ok = 0, miss = 0;
for (const cls of CLASSES) {
  for (let d = 0; d < 8; d++) {
    const src = path.join(SRC_DIR, `q-${cls}-d${d}.png`);
    if (!fs.existsSync(src)) {
      console.log('MISSING', src);
      miss++;
      continue;
    }
    let png = loadRgba(src);
    removeBackdrop(png);
    png = cropPad(png, 12);
    const dirOut = path.join(OUT_ROOT, cls, 'd' + d);
    buildActions(png, dirOut);
    ok++;
    console.log('ok', cls, 'd' + d);
  }
}
console.log({ ok, miss, src: SRC_DIR });
