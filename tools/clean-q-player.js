/**
 * Q player files are JPEG disguised as .png (no alpha → white/checkerboard baked in).
 * Decode JPEG → remove backdrop → write true PNG + synthesize idle/walk/attack frames.
 */
const fs = require('fs');
const path = require('path');
const jpeg = require('./node_modules/jpeg-js');
const { PNG } = require('./node_modules/pngjs');

const ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
const CLASSES = ['knight', 'elf', 'mage'];

function loadRgba(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    const png = new PNG({ width: decoded.width, height: decoded.height });
    png.data = Buffer.from(decoded.data);
    return png;
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return PNG.sync.read(buf);
  }
  throw new Error('unsupported image: ' + file);
}

function savePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png));
}

function isBackdrop(r, g, b) {
  // pure / near white
  if (r >= 242 && g >= 242 && b >= 242) return true;
  // checkerboard greys (light & mid)
  if (Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10) {
    if (r >= 175 && r <= 235) return true;
    if (r >= 130 && r <= 175) return true;
  }
  return false;
}

function removeBackdrop(png) {
  const { width: w, height: h, data } = png;
  const N = w * h;
  const mark = new Uint8Array(N);
  const qx = new Int32Array(N);
  const qy = new Int32Array(N);
  let qh = 0, qt = 0;
  const idx = (x, y) => y * w + x;

  function push(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = idx(x, y);
    if (mark[i]) return;
    const o = i * 4;
    if (!isBackdrop(data[o], data[o + 1], data[o + 2])) return;
    mark[i] = 1;
    qx[qt] = x; qy[qt] = y; qt++;
  }

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (qh < qt) {
    const x = qx[qh], y = qy[qh]; qh++;
    const o = idx(x, y) * 4;
    data[o] = data[o + 1] = data[o + 2] = 0;
    data[o + 3] = 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }

  // fringe pass: near-white next to transparent → kill
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = idx(x, y) * 4;
      if (data[o + 3] < 8) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const bright = (r + g + b) / 3;
      if (bright < 210) continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (data[idx(x + dx, y + dy) * 4 + 3] < 8) { touch = true; break; }
        }
      }
      if (touch && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) {
        data[o] = data[o + 1] = data[o + 2] = 0;
        data[o + 3] = 0;
      }
    }
  }
  return png;
}

function alphaPct(png) {
  let z = 0, n = png.width * png.height;
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] < 10) z++;
  return +(100 * z / n).toFixed(1);
}

function contentBounds(png) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY };
}

function sample(png, x, y) {
  const w = png.width, h = png.height;
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return [0, 0, 0, 0];
  const o = (yi * w + xi) * 4;
  return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
}

function warp(src, opts) {
  const out = new PNG({ width: src.width, height: src.height });
  out.data.fill(0);
  const b = contentBounds(src);
  if (!b) return out;
  const cx = (b.minX + b.maxX) / 2;
  const footY = b.maxY;
  const pivotX = cx;
  const pivotY = opts.pivot === 'foot' ? footY : (b.minY + b.maxY) / 2;
  const rad = ((opts.rot || 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const sx = opts.sx == null ? 1 : opts.sx;
  const sy = opts.sy == null ? 1 : opts.sy;
  const dx = opts.dx || 0, dy = opts.dy || 0;
  const w = src.width, h = src.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let lx = (x - pivotX - dx) / sx;
      let ly = (y - pivotY - dy) / sy;
      const ix = lx * cos + ly * sin + pivotX;
      const iy = -lx * sin + ly * cos + pivotY;
      const [r, g, bc, a] = sample(src, ix, iy);
      if (a < 8) continue;
      const o = (y * w + x) * 4;
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = bc; out.data[o + 3] = a;
    }
  }
  return out;
}

function pickBestBase(dir) {
  const cands = ['idle_0.png', 'idle_1.png', 'walk_0.png', 'attack_0.png'];
  let best = null, bestScore = -1, bestName = '';
  for (const c of cands) {
    const f = path.join(dir, c);
    if (!fs.existsSync(f)) continue;
    let png;
    try { png = loadRgba(f); } catch (e) { console.log('fail', f, e.message); continue; }
    removeBackdrop(png);
    const st = alphaPct(png);
    const b = contentBounds(png);
    const area = b ? (b.maxX - b.minX) * (b.maxY - b.minY) : 0;
    const score = area + st * 50;
    console.log(' ', c, 'alpha%', st, 'area', area);
    if (score > bestScore) { bestScore = score; best = png; bestName = c; }
  }
  console.log('  pick', bestName);
  return best;
}

function buildSet(dir) {
  console.log('==', path.basename(dir));
  const base = pickBestBase(dir);
  if (!base) return;

  const frames = {
    'idle_0.png': warp(base, { dy: 0, pivot: 'foot' }),
    'idle_1.png': warp(base, { dy: -10, sy: 1.04, sx: 0.97, pivot: 'foot' }),
    'idle_2.png': warp(base, { dy: -4, sy: 1.015, pivot: 'foot' }),
    'walk_0.png': warp(base, { dx: -8, dy: -4, rot: -5, pivot: 'foot' }),
    'walk_1.png': warp(base, { dx: 8, dy: -12, rot: 5, pivot: 'foot' }),
    'walk_2.png': warp(base, { dx: -4, dy: -7, rot: -2, pivot: 'foot' }),
    'attack_0.png': warp(base, { dx: -6, rot: -12, pivot: 'foot' }),
    'attack_1.png': warp(base, { dx: 14, rot: 22, sx: 1.05, pivot: 'foot' }),
    'attack_2.png': warp(base, { dx: 6, rot: 8, pivot: 'foot' }),
    'hurt_0.png': warp(base, { dx: -12, dy: 4, rot: -8, sx: 0.96, pivot: 'foot' }),
    'skill_0.png': warp(base, { dy: -14, sy: 1.08, sx: 0.94, pivot: 'foot' }),
    'skill_1.png': warp(base, { dy: -6, rot: 5, pivot: 'foot' })
  };

  for (const [name, png] of Object.entries(frames)) {
    savePng(path.join(dir, name), png);
  }
  console.log('  wrote', Object.keys(frames).length, 'true PNG frames, alpha%', alphaPct(frames['idle_0.png']));
}

for (const c of CLASSES) {
  const dir = path.join(ROOT, c);
  if (fs.existsSync(dir)) buildSet(dir);
}

// also clean root single portraits used elsewhere
for (const name of ['player-knight.png', 'player-elf.png', 'player-mage.png']) {
  const f = path.join(ROOT, '..', name);
  if (!fs.existsSync(f)) continue;
  try {
    const png = loadRgba(f);
    removeBackdrop(png);
    savePng(f, png);
    console.log('portrait', name, 'alpha%', alphaPct(png));
  } catch (e) {
    console.log('portrait fail', name, e.message);
  }
}
console.log('done');
