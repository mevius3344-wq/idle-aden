/**
 * 從男角 Q 包複製並產出女角專用資料夾（knight_f / elf_f / mage_f / royal_f）。
 * 用法：node tools/gen-q-gender-f.js
 *
 * 說明：目前以「複製男包」建立 *_f 目錄骨架；真正不同造型需替換為女角原畫。
 * 在未替換前，執行期會優先讓女角走 classanim（已分男女），避免與男角同造型。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAYER = path.join(ROOT, 'assets', 'qskin', 'player');
const PAIRS = [
    ['knight', 'knight_f'],
    ['elf', 'elf_f'],
    ['mage', 'mage_f'],
    ['royal', 'royal_f']
];

function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn('[skip] missing source:', src);
        return 0;
    }
    fs.mkdirSync(dest, { recursive: true });
    let n = 0;
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, ent.name);
        const d = path.join(dest, ent.name);
        if (ent.isDirectory()) n += copyDir(s, d);
        else {
            fs.copyFileSync(s, d);
            n++;
        }
    }
    return n;
}

let total = 0;
for (const [m, f] of PAIRS) {
    const src = path.join(PLAYER, m);
    const dest = path.join(PLAYER, f);
    if (!fs.existsSync(src)) {
        console.warn('[skip]', m, 'not found');
        continue;
    }
    if (fs.existsSync(dest)) {
        console.log('[keep]', f, 'already exists — not overwrite');
        continue;
    }
    const n = copyDir(src, dest);
    total += n;
    console.log('[ok]', m, '→', f, '(' + n + ' files)');
    console.log('      ※ 請替換為女角專用原畫，勿長期與男包同圖');
}
console.log('done. copied files:', total);
