/**
 * 從動作表切片安裝 walk／attack，並用原始八方向立繪還原 idle。
 * 來源：%USERPROFILE%/.cursor/projects/c-Users-FUTURE-Desktop/assets/
 */
const fs = require('fs');
const path = require('path');
const jpeg = require('./node_modules/jpeg-js');
const { PNG } = require('./node_modules/pngjs');

const SRC = path.join(process.env.USERPROFILE || '', '.cursor', 'projects', 'c-Users-FUTURE-Desktop', 'assets');
const OUT = path.join(__dirname, '..', 'assets', 'qskin', 'player');
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
  throw new Error('bad ' + file);
}

function savePng(file, png) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function isBackdrop(r, g, b, a) {
  if (a < 12) return true;
  if (r >= 242 && g >= 242 && b >= 242) return true;
  if (Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12) {
    if (r >= 165 && r <= 235) return true;
  }
  // sheet separators / near-black void
  if (r < 22 && g < 22 && b < 22) return true;
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
    if (!isBackdrop(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
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
    if (touch && sat < 30 && bright > 180) {
      data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 0;
    }
  }
  return png;
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

function sliceGrid(png, cols, rows) {
  const cw = Math.floor(png.width / cols);
  const ch = Math.floor(png.height / rows);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = new PNG({ width: cw, height: ch });
    cell.data.fill(0);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const sx = c * cw + x, sy = r * ch + y;
      const so = (sy * png.width + sx) * 4;
      const oo = (y * cw + x) * 4;
      cell.data[oo] = png.data[so]; cell.data[oo + 1] = png.data[so + 1];
      cell.data[oo + 2] = png.data[so + 2]; cell.data[oo + 3] = png.data[so + 3];
    }
    cells.push(cropPad(removeBackdrop(cell), 8));
  }
  return cells;
}

function prepareStand(file) {
  return cropPad(removeBackdrop(loadRgba(file)), 10);
}

function writeIdleBreath(dir, stand) {
  // 輕呼吸：複製 stand 為 idle 多幀（不做肢體切刀）
  savePng(path.join(dir, 'idle_0.png'), stand);
  savePng(path.join(dir, 'idle_1.png'), stand);
  savePng(path.join(dir, 'idle_2.png'), stand);
}

function installPack(cls, walkCells, atkCells) {
  const root = path.join(OUT, cls);
  // 根目錄
  writeIdleBreath(root, walkCells[0] || prepareStand(path.join(SRC, 'q-' + cls + '-d5.png')));
  walkCells.forEach((p, i) => savePng(path.join(root, 'walk_' + i + '.png'), p));
  atkCells.forEach((p, i) => savePng(path.join(root, 'attack_' + i + '.png'), p));
  // skill／hurt／death 暫用攻擊／idle
  atkCells.forEach((p, i) => savePng(path.join(root, 'skill_' + i + '.png'), p));
  savePng(path.join(root, 'hurt_0.png'), walkCells[0]);
  savePng(path.join(root, 'death_0.png'), walkCells[0]);
  savePng(path.join(root, 'death_1.png'), atkCells[0] || walkCells[0]);
  savePng(path.join(root, 'death_2.png'), atkCells[2] || walkCells[0]);

  for (let d = 0; d < 8; d++) {
    const dir = path.join(root, 'd' + d);
    const standFile = path.join(SRC, 'q-' + cls + '-d' + d + '.png');
    const stand = fs.existsSync(standFile) ? prepareStand(standFile) : walkCells[0];
    writeIdleBreath(dir, stand);
    // 各方向共用真動作表（肢體變化優先；朝向仍靠 idle 立繪換向）
    walkCells.forEach((p, i) => savePng(path.join(dir, 'walk_' + i + '.png'), p));
    atkCells.forEach((p, i) => savePng(path.join(dir, 'attack_' + i + '.png'), p));
    atkCells.forEach((p, i) => savePng(path.join(dir, 'skill_' + i + '.png'), p));
    savePng(path.join(dir, 'hurt_0.png'), stand);
    savePng(path.join(dir, 'death_0.png'), stand);
    savePng(path.join(dir, 'death_1.png'), atkCells[0] || stand);
    savePng(path.join(dir, 'death_2.png'), atkCells[2] || stand);
    console.log('installed', cls, 'd' + d);
  }
}

for (const cls of CLASSES) {
  const walkPath = path.join(SRC, 'q-' + cls + '-walk-cycle.png');
  const atkPath = path.join(SRC, 'q-' + cls + '-attack-cycle.png');
  if (!fs.existsSync(walkPath)) {
    console.warn('missing walk', walkPath);
    continue;
  }
  const walkSheet = removeBackdrop(loadRgba(walkPath));
  const walkCells = sliceGrid(walkSheet, 2, 2);
  let atkCells;
  if (fs.existsSync(atkPath)) {
    const atkSheet = removeBackdrop(loadRgba(atkPath));
    atkCells = sliceGrid(atkSheet, 3, 1);
  } else {
    // 無攻擊表：用 walk 0/1/2 暫代
    atkCells = [walkCells[0], walkCells[1], walkCells[2]];
  }
  installPack(cls, walkCells, atkCells);
}
console.log('done');
