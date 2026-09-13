/**
 * 肢體分區木偶：從 idle_0 切出頭身／左右臂／左右腿，
 * 組出有明顯擺臂＋跨步的 walk／attack／skill 幀（覆寫各 d0..d7 與根目錄）。
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('./node_modules/pngjs');

const ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
const CLASSES = ['knight', 'elf', 'mage'];

function loadPng(f) { return PNG.sync.read(fs.readFileSync(f)); }
function savePng(f, png) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, PNG.sync.write(png));
}

function contentBounds(png) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 28) {
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

function blankLike(src, pad) {
  const out = new PNG({ width: src.width + pad * 2, height: src.height + pad * 2 });
  out.data.fill(0);
  return out;
}

function paste(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const so = (y * src.width + x) * 4;
    const a = src.data[so + 3];
    if (a < 8) continue;
    const dx = x + ox, dy = y + oy;
    if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
    const o = (dy * dst.width + dx) * 4;
    const da = dst.data[o + 3] / 255;
    const sa = a / 255;
    const outA = sa + da * (1 - sa);
    if (outA < 0.01) continue;
    dst.data[o] = Math.round((src.data[so] * sa + dst.data[o] * da * (1 - sa)) / outA);
    dst.data[o + 1] = Math.round((src.data[so + 1] * sa + dst.data[o + 1] * da * (1 - sa)) / outA);
    dst.data[o + 2] = Math.round((src.data[so + 2] * sa + dst.data[o + 2] * da * (1 - sa)) / outA);
    dst.data[o + 3] = Math.round(outA * 255);
  }
}

function extractMask(src, pred) {
  const out = new PNG({ width: src.width, height: src.height });
  out.data.fill(0);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const o = (y * src.width + x) * 4;
    if (src.data[o + 3] < 28) continue;
    if (!pred(x, y)) continue;
    out.data[o] = src.data[o];
    out.data[o + 1] = src.data[o + 1];
    out.data[o + 2] = src.data[o + 2];
    out.data[o + 3] = src.data[o + 3];
  }
  return out;
}

function rotatePart(src, pivotX, pivotY, deg, shiftX, shiftY) {
  const pad = 90;
  const out = blankLike(src, pad);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const px = pivotX + pad, py = pivotY + pad;
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const lx = x - px - (shiftX || 0);
    const ly = y - py - (shiftY || 0);
    const ix = lx * cos + ly * sin + pivotX;
    const iy = -lx * sin + ly * cos + pivotY;
    const [r, g, b, a] = sample(src, ix, iy);
    if (a < 8) continue;
    const o = (y * out.width + x) * 4;
    out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = a;
  }
  return { png: out, ox: -pad, oy: -pad };
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

function splitBody(src) {
  const b = contentBounds(src);
  if (!b) return null;
  const h = b.maxY - b.minY + 1;
  const w = b.maxX - b.minX + 1;
  const cx = (b.minX + b.maxX) / 2;
  const headY = b.minY + h * 0.36;
  const waistY = b.minY + h * 0.58;
  const armIn = b.minX + w * 0.22;
  const armOutR = b.maxX - w * 0.22;

  // 軀幹＋頭（中間柱）
  const torso = extractMask(src, (x, y) => {
    if (y > waistY) return false;
    if (y <= headY) return true;
    return x >= armIn && x <= armOutR;
  });
  // 左臂（畫面左＝角色右常見，但用幾何左）
  const armL = extractMask(src, (x, y) => y > headY - h * 0.02 && y <= waistY + h * 0.06 && x < cx - w * 0.02 && (x < armIn || y > headY + h * 0.08));
  const armR = extractMask(src, (x, y) => y > headY - h * 0.02 && y <= waistY + h * 0.06 && x > cx + w * 0.02 && (x > armOutR || y > headY + h * 0.08));
  // 腿
  const legL = extractMask(src, (x, y) => y > waistY && x <= cx);
  const legR = extractMask(src, (x, y) => y > waistY && x > cx);

  const shL = { x: b.minX + w * 0.32, y: b.minY + h * 0.42 };
  const shR = { x: b.minX + w * 0.68, y: b.minY + h * 0.42 };
  const hipL = { x: b.minX + w * 0.40, y: waistY };
  const hipR = { x: b.minX + w * 0.60, y: waistY };

  return { torso, armL, armR, legL, legR, shL, shR, hipL, hipR, b };
}

function compose(parts, pose) {
  const pad = 100;
  const canvas = blankLike(parts.torso, pad);
  const baseOx = pad, baseOy = pad + (pose.bob || 0);

  // 先腿（後層）→ 軀幹 → 臂（前層，手部動作比較明顯）
  const legL = rotatePart(parts.legL, parts.hipL.x, parts.hipL.y, pose.legL || 0, 0, 0);
  const legR = rotatePart(parts.legR, parts.hipR.x, parts.hipR.y, pose.legR || 0, 0, 0);
  paste(canvas, legL.png, baseOx + legL.ox, baseOy + legL.oy);
  paste(canvas, legR.png, baseOx + legR.ox, baseOy + legR.oy);
  paste(canvas, parts.torso, baseOx, baseOy);

  const armL = rotatePart(parts.armL, parts.shL.x, parts.shL.y, pose.armL || 0, pose.armLShiftX || 0, pose.armLShiftY || 0);
  const armR = rotatePart(parts.armR, parts.shR.x, parts.shR.y, pose.armR || 0, pose.armRShiftX || 0, pose.armRShiftY || 0);
  paste(canvas, armL.png, baseOx + armL.ox, baseOy + armL.oy);
  paste(canvas, armR.png, baseOx + armR.ox, baseOy + armR.oy);

  return cropPad(canvas, 12);
}

function buildActionSet(base) {
  const parts = splitBody(base);
  if (!parts) return null;
  const walkAmp = 22;
  const armAmp = 28;
  return {
    'idle_0.png': compose(parts, { bob: 0 }),
    'idle_1.png': compose(parts, { bob: -6, armL: -4, armR: 4 }),
    'idle_2.png': compose(parts, { bob: -3, armL: 3, armR: -3 }),
    'walk_0.png': compose(parts, { bob: 0, armL: armAmp, armR: -armAmp, legL: -walkAmp, legR: walkAmp }),
    'walk_1.png': compose(parts, { bob: -10, armL: 4, armR: -4, legL: -4, legR: 4 }),
    'walk_2.png': compose(parts, { bob: 0, armL: -armAmp, armR: armAmp, legL: walkAmp, legR: -walkAmp }),
    'walk_3.png': compose(parts, { bob: -9, armL: -4, armR: 4, legL: 4, legR: -4 }),
    // 揮砍：持劍側大角度前揮
    'attack_0.png': compose(parts, { bob: 2, armR: -42, armL: 10, legR: 8, legL: -6, armRShiftY: -8 }),
    'attack_1.png': compose(parts, { bob: -4, armR: 8, armL: -8, legR: -4, legL: 4 }),
    'attack_2.png': compose(parts, { bob: -2, armR: 48, armL: -16, legR: -10, legL: 8, armRShiftX: 10, armRShiftY: -4 }),
    'skill_0.png': compose(parts, { bob: -4, armL: -18, armR: -18, armLShiftY: -10, armRShiftY: -10 }),
    'skill_1.png': compose(parts, { bob: -12, armL: -32, armR: -32, armLShiftY: -18, armRShiftY: -18 }),
    'skill_2.png': compose(parts, { bob: -8, armL: -12, armR: 20, armRShiftY: -14 }),
    'hurt_0.png': compose(parts, { bob: 4, armL: 16, armR: -20, legL: 8 }),
    'death_0.png': compose(parts, { bob: 6, armL: 20, armR: -24, legL: 12, legR: -8 }),
    'death_1.png': compose(parts, { bob: 16, armL: 30, armR: -40, legL: 18, legR: -12 }),
    'death_2.png': compose(parts, { bob: 28, armL: 40, armR: -50, legL: 22, legR: -16 })
  };
}

function processDir(dir) {
  const idlePath = path.join(dir, 'idle_0.png');
  if (!fs.existsSync(idlePath)) return false;
  const base = loadPng(idlePath);
  const set = buildActionSet(base);
  if (!set) return false;
  for (const [name, png] of Object.entries(set)) {
    savePng(path.join(dir, name), png);
  }
  return true;
}

let n = 0;
for (const cls of CLASSES) {
  const root = path.join(ROOT, cls);
  if (processDir(root)) { n++; console.log('root', cls); }
  for (let d = 0; d < 8; d++) {
    const dir = path.join(root, 'd' + d);
    if (processDir(dir)) { n++; console.log('ok', cls, 'd' + d); }
  }
}
console.log('done', n, 'packs');
