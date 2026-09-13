/**
 * Build richer Q action frames: walk/attack/skill/death (+ turn lean).
 * Uses existing cleaned idle_0 as base.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('./node_modules/pngjs');

const ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
const CLASSES = ['knight', 'elf', 'mage'];

function loadPng(f) { return PNG.sync.read(fs.readFileSync(f)); }
function savePng(f, png) { fs.writeFileSync(f, PNG.sync.write(png)); }

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

function sample(png, x, y) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= png.width || yi >= png.height) return [0, 0, 0, 0];
  const o = (yi * png.width + xi) * 4;
  return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
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

function warp(src, opts) {
  const pad = 100;
  const w = src.width + pad * 2, h = src.height + pad * 2;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  const b = contentBounds(src);
  if (!b) return out;
  const pivotX = (b.minX + b.maxX) / 2 + pad;
  const pivotY = (opts.pivot === 'foot' ? b.maxY : (opts.pivot === 'head' ? b.minY : (b.minY + b.maxY) / 2)) + pad;
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
  return cropPad(out, 10);
}

for (const c of CLASSES) {
  const dir = path.join(ROOT, c);
  const basePath = path.join(dir, 'idle_0.png');
  if (!fs.existsSync(basePath)) continue;
  const base = loadPng(basePath);
  console.log('==', c, base.width + 'x' + base.height);

  const frames = {
    // idle breathe
    'idle_0.png': warp(base, { pivot: 'foot' }),
    'idle_1.png': warp(base, { dy: -12, sy: 1.05, sx: 0.96, pivot: 'foot' }),
    'idle_2.png': warp(base, { dy: -5, sy: 1.02, rot: 2, pivot: 'foot' }),
    'idle_3.png': warp(base, { dy: -9, sx: 1.02, sy: 0.98, rot: -2, pivot: 'foot' }),
    // walk cycle
    'walk_0.png': warp(base, { dx: -14, dy: -4, rot: -10, sx: 0.97, sy: 1.03, pivot: 'foot' }),
    'walk_1.png': warp(base, { dx: 0, dy: -14, rot: 0, sx: 1.03, sy: 0.95, pivot: 'foot' }),
    'walk_2.png': warp(base, { dx: 14, dy: -4, rot: 10, sx: 0.97, sy: 1.03, pivot: 'foot' }),
    'walk_3.png': warp(base, { dx: 0, dy: -12, rot: 0, sx: 1.02, sy: 0.96, pivot: 'foot' }),
    // attack slash
    'attack_0.png': warp(base, { dx: -12, rot: -18, sx: 0.95, sy: 1.05, pivot: 'foot' }),
    'attack_1.png': warp(base, { dx: 8, dy: -6, rot: 8, pivot: 'foot' }),
    'attack_2.png': warp(base, { dx: 22, dy: -8, rot: 30, sx: 1.08, sy: 0.92, pivot: 'foot' }),
    'attack_3.png': warp(base, { dx: 10, dy: -2, rot: 12, pivot: 'foot' }),
    // skill cast (rise + glow lean)
    'skill_0.png': warp(base, { dy: -6, rot: -6, pivot: 'foot' }),
    'skill_1.png': warp(base, { dy: -16, sy: 1.1, sx: 0.9, rot: 0, pivot: 'foot' }),
    'skill_2.png': warp(base, { dy: -22, sy: 1.14, sx: 0.88, rot: 4, pivot: 'foot' }),
    'skill_3.png': warp(base, { dy: -10, rot: 6, pivot: 'foot' }),
    // hurt
    'hurt_0.png': warp(base, { dx: -14, dy: 4, rot: -12, sx: 0.94, pivot: 'foot' }),
    'hurt_1.png': warp(base, { dx: -8, dy: 2, rot: -6, pivot: 'foot' }),
    // death fall
    'death_0.png': warp(base, { dx: -6, rot: -8, pivot: 'foot' }),
    'death_1.png': warp(base, { dx: -10, dy: 8, rot: -25, sx: 1.02, sy: 0.92, pivot: 'foot' }),
    'death_2.png': warp(base, { dx: -8, dy: 18, rot: -55, sx: 1.05, sy: 0.85, pivot: 'foot', alpha: 0.9 }),
    'death_3.png': warp(base, { dx: -4, dy: 28, rot: -82, sx: 1.1, sy: 0.75, pivot: 'foot', alpha: 0.75 }),
    'death_4.png': warp(base, { dx: 0, dy: 34, rot: -90, sx: 1.12, sy: 0.7, pivot: 'foot', alpha: 0.55 })
  };

  for (const [name, png] of Object.entries(frames)) {
    savePng(path.join(dir, name), png);
  }
  console.log('  wrote', Object.keys(frames).length);
}
console.log('done');
