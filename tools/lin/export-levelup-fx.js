// 原版升級特效 gfx2127 → assets/fx/升級/
// list.spr: #2127 1 level up effect 0.animation(0 26, …)
// 用法：node tools/lin/export-levelup-fx.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { loadSpr } = require('./spr');
const { loadListSpr } = require('./listspr');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'fx', '升級');

async function main() {
  const list = loadListSpr();
  const entry = list.get(2127);
  if (!entry || !entry.actions[0]) throw new Error('list.spr missing #2127 level up effect');
  const seq = entry.actions[0].frames;
  const spr = loadSpr(2127, 0);
  if (!spr || !spr.length) throw new Error('2127-0.spr missing');

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of spr) {
    if (!f) continue;
    minX = Math.min(minX, f.x);
    minY = Math.min(minY, f.y);
    maxX = Math.max(maxX, f.x + f.w);
    maxY = Math.max(maxY, f.y + f.h);
  }
  const cw = maxX - minX;
  const ch = maxY - minY;
  const ox = -minX; // stand point x in canvas
  const oy = -minY; // stand point y in canvas

  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < spr.length; i++) {
    const f = spr[i];
    const rgba = Buffer.alloc(cw * ch * 4);
    if (f) {
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const si = (y * f.w + x) * 4;
          if (!f.px[si + 3]) continue;
          const r = f.px[si], g = f.px[si + 1], b = f.px[si + 2];
          // screen 加亮：近黑像素在原版客戶端幾乎不畫；留下會變成腳下黑橢圓
          if (r + g + b < 24) continue;
          const dx = f.x - minX + x;
          const dy = f.y - minY + y;
          const di = (dy * cw + dx) * 4;
          rgba[di] = r;
          rgba[di + 1] = g;
          rgba[di + 2] = b;
          rgba[di + 3] = f.px[si + 3];
        }
      }
    }
    await sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, 'lu_' + i + '.png'));
  }

  const meta = {
    gfx: 2127,
    name: 'level up effect',
    canvas: { w: cw, h: ch },
    latticeOrigin: { x: ox, y: oy },
    // list.spr 時長單位＝1/24 秒
    unitMs: 1000 / 24,
    seq: seq.map((fr) => ({ frame: fr.frame, dur: fr.dur })),
    n: spr.length,
    prefix: 'lu',
    note: '原版 list.spr #2127；站立點＝角色腳底'
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('exported', spr.length, 'frames', cw + 'x' + ch, 'origin', ox, oy, 'seq', seq.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
