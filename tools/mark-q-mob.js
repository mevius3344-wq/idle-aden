// 為指定怪寫入真 Q 包標記（之後才會蓋掉原生 anim）
// 用法：node tools/mark-q-mob.js 哥布林
const fs = require('fs');
const path = require('path');
const name = process.argv[2];
if (!name) {
  console.log('用法: node tools/mark-q-mob.js <怪名>');
  process.exit(1);
}
const dir = path.join(__dirname, '..', 'assets', 'qskin', 'mobs', name);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'q.json'), JSON.stringify({ name: name, style: 'korean-q', frames: ['idle', 'attack', 'hurt'] }, null, 2));
console.log('marked', dir);
