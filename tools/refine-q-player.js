/**
 * Second pass: crop to content, scrub leftover fringe/dashes, rebuild stronger anim frames.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('./node_modules/pngjs');

const ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
const CLASSES = ['knight', 'elf', 'mage'];

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}
function savePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png));
}

function contentBounds(png) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 30) {
        any = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}

function scrubFringe(png) {
  const { width: w, height: h, data } = png;
  const idx = (x, y) => y * w + x;
  // kill near-white / near-black dash noise at very low saturation next to transparent
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = idx(x, y) * 4;
      const a = data[o + 3];
      if (a < 8) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx - mn;
      const bright = (r + g + b) / 3;
      let touchT = false;
      for (let dy = -2; dy <= 2 && !touchT; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) { touchT = true; break; }
          if (data[idx(xx, yy) * 4 + 3] < 8) { touchT = true; break; }
        }
      }
      if (!touchT) continue;
      // white / gray fringe
      if (sat < 22 && bright > 200) { data[o + 3] = 0; continue; }
      // black-white dash remnants
      if (sat < 18 && (bright < 40 || bright > 210) && a < 220) { data[o + 3] = 0; continue; }
    }
  }
}

function cropPad(png, pad) {
  const b = contentBounds(png);
  if (!b) return png;
  const minX = Math.max(0, b.minX - pad);
  const minY = Math.max(0, b.minY - pad);
  const maxX = Math.min(png.width - 1, b.maxX + pad);
  const maxY = Math.min(png.height - 1, b.maxY + pad);
  const nw = maxX - minX + 1;
  const nh = maxY - minY + 1;
  const out = new PNG({ width: nw, height: nh });
  out.data.fill(0);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const so = ((minY + y) * png.width + (minX + x)) * 4;
      const oo = (y * nw + x) * 4;
      out.data[oo] = png.data[so];
      out.data[oo + 1] = png.data[so + 1];
      out.data[oo + 2] = png.data[so + 2];
      out.data[oo + 3] = png.data[so + 3];
    }
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
  // larger canvas so rotation doesn't clip
  const pad = 80;
  const w = src.width + pad * 2;
  const h = src.height + pad * 2;
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

  // blit src into padded space first logically via inverse sample from src
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let lx = (x - pivotX - dx) / sx;
      let ly = (y - pivotY - dy) / sy;
      const ix = lx * cos + ly * sin + pivotX - pad;
      const iy = -lx * sin + ly * cos + pivotY - pad;
      const [r, g, bc, a] = sample(src, ix, iy);
      if (a < 8) continue;
      const o = (y * w + x) * 4;
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = bc; out.data[o + 3] = a;
    }
  }
  scrubFringe(out);
  return cropPad(out, 12);
}

function prepBase(dir) {
  const f = path.join(dir, 'idle_0.png');
  let png = loadPng(f);
  scrubFringe(png);
  png = cropPad(png, 16);
  scrubFringe(png);
  return png;
}

for (const c of CLASSES) {
  const dir = path.join(ROOT, c);
  if (!fs.existsSync(dir)) continue;
  console.log('==', c);
  const base = prepBase(dir);
  console.log(' base', base.width, 'x', base.height);

  const frames = {
    'idle_0.png': warp(base, { pivot: 'foot' }),
    'idle_1.png': warp(base, { dy: -14, sy: 1.06, sx: 0.95, pivot: 'foot' }),
    'idle_2.png': warp(base, { dy: -6, sy: 1.02, pivot: 'foot' }),
    'walk_0.png': warp(base, { dx: -12, dy: -6, rot: -7, pivot: 'foot' }),
    'walk_1.png': warp(base, { dx: 12, dy: -16, rot: 7, pivot: 'foot' }),
    'walk_2.png': warp(base, { dx: -6, dy: -10, rot: -3, pivot: 'foot' }),
    'attack_0.png': warp(base, { dx: -10, rot: -16, pivot: 'foot' }),
    'attack_1.png': warp(base, { dx: 20, rot: 28, sx: 1.06, pivot: 'foot' }),
    'attack_2.png': warp(base, { dx: 8, rot: 10, pivot: 'foot' }),
    'hurt_0.png': warp(base, { dx: -16, dy: 6, rot: -10, sx: 0.94, pivot: 'foot' }),
    'skill_0.png': warp(base, { dy: -18, sy: 1.1, sx: 0.92, pivot: 'foot' }),
    'skill_1.png': warp(base, { dy: -8, rot: 6, pivot: 'foot' })
  };
  for (const [name, png] of Object.entries(frames)) {
    savePng(path.join(dir, name), png);
  }
  console.log(' wrote', Object.keys(frames).length);
}
console.log('done');
