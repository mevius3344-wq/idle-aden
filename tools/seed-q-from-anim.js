// 一次把既有 assets/anim/<怪名>/idle_*.png 複製成 Q 多幀包（一怪一圖）
// 用法：node tools/seed-q-from-anim.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const animRoot = path.join(root, 'assets', 'anim');
const outRoot = path.join(root, 'assets', 'qskin', 'mobs');
if (!fs.existsSync(animRoot)) {
  console.error('missing', animRoot);
  process.exit(1);
}
fs.mkdirSync(outRoot, { recursive: true });
let n = 0;
for (const name of fs.readdirSync(animRoot)) {
  const dir = path.join(animRoot, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const out = path.join(outRoot, name);
  fs.mkdirSync(out, { recursive: true });
  let copied = 0;
  for (const act of ['idle', 'attack', 'hurt', 'walk']) {
    for (let i = 0; i < 8; i++) {
      const src = path.join(dir, act + '_' + i + '.png');
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(out, act + '_' + i + '.png'));
      copied++;
    }
  }
  if (copied) n++;
}
console.log('seeded Q packs from anim:', n);
