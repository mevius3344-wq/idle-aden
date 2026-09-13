const fs = require('fs');
const path = require('path');
const { PNG } = require('./node_modules/pngjs');
const ROOT = path.join(__dirname, '..', 'assets', 'qskin', 'player');

function scrub(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  const idx = (x, y) => y * w + x;
  // multi-pass fringe kill
  for (let pass = 0; pass < 3; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = idx(x, y) * 4;
        if (data[o + 3] < 10) continue;
        const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
        const bright = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        let t = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) { t++; continue; }
            n++;
            if (data[idx(xx, yy) * 4 + 3] < 10) t++;
          }
        }
        if (t === 0) continue;
        // white/gray halo
        if (sat < 28 && bright > 185) { kill.push(o); continue; }
        // semi-transparent bright junk
        if (a < 180 && bright > 200 && sat < 40) { kill.push(o); continue; }
        // soften remaining fringe alpha
        if (sat < 35 && bright > 170 && t >= 2) {
          data[o + 3] = Math.max(0, a - 90);
        }
      }
    }
    for (const o of kill) {
      data[o] = data[o + 1] = data[o + 2] = 0;
      data[o + 3] = 0;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

for (const c of ['knight', 'elf', 'mage']) {
  const dir = path.join(ROOT, c);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.png')) continue;
    scrub(path.join(dir, f));
  }
  console.log('scrubbed', c);
}
for (const name of ['player-knight.png', 'player-elf.png', 'player-mage.png']) {
  const f = path.join(ROOT, '..', name);
  if (fs.existsSync(f) && fs.readFileSync(f)[0] === 0x89) scrub(f);
}
console.log('ok');
