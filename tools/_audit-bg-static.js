// 靜態比對：AREA_1920 白名單 vs 磁碟檔案；MAP_CATEGORIES 每張圖側視背景來源；mapdef floor/scenicFar 是否存在
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const shop = rd('js/13-shop-save.js');
const ctx = { console };
vm.createContext(ctx);
const grab = (src, re) => { const m = re.exec(src); if (!m) throw new Error('miss ' + re); return m[0]; };
vm.runInContext(grab(rd('js/11-world-map.js'), /const MAP_CATEGORIES = \{[\s\S]*?\n\};/).replace('const ', 'var '), ctx);
vm.runInContext(grab(shop, /const SPECIAL_AREA_BG = \{[\s\S]*?\n\};/).replace('const ', 'var '), ctx);
vm.runInContext(grab(shop, /const CATEGORY_AREA_BG = [^\n]*/).replace('const ', 'var '), ctx);
vm.runInContext(grab(shop, /const AREA_1920 = [\s\S]*?\/\/ 🐉[^\n]*/).replace('const ', 'var '), ctx);

const dir1920 = path.join(root, 'assets/area/1920x1080');
const onDisk = new Set(fs.readdirSync(dir1920).filter((f) => /\.jpg$/i.test(f)).map((f) => f.replace(/\.jpg$/i, '')));
const listedMissing = [...ctx.AREA_1920].filter((n) => !onDisk.has(n));
const unlisted = [...onDisk].filter((n) => !ctx.AREA_1920.has(n));
console.log('AREA_1920 listed but NOT on disk:', listedMissing.join(', ') || '(none)');
console.log('On disk but NOT in AREA_1920:', unlisted.join(', ') || '(none)');

const exists = (p) => fs.existsSync(path.join(root, decodeURIComponent(String(p).split('?')[0])));
const upgrade = (p) => { const m = /^assets\/area\/([^\/]+)\.jpg$/.exec(p || ''); return (m && ctx.AREA_1920.has(m[1])) ? 'assets/area/1920x1080/' + m[1] + '.jpg' : p; };

const mapdefSrc = rd('js/47-mapdef.js');
const floorRe = /floor:\s*'([^']+)'/g;
let fm; const floors = new Set();
while ((fm = floorRe.exec(mapdefSrc))) floors.add(fm[1]);
const scRe = /scenicFar:\s*'([^']+)'/g;
while ((fm = scRe.exec(mapdefSrc))) floors.add(fm[1]);
const missingFloors = [...floors].filter((f) => !exists(f));
console.log('mapdef floor/scenicFar missing on disk:', missingFloors.join(', ') || '(none)');

console.log('\n--- hunting maps whose side-view bg is generic / missing ---');
for (const cat in ctx.MAP_CATEGORIES) {
    if (cat === 'village') continue;
    for (const m of ctx.MAP_CATEGORIES[cat]) {
        const id = m.v;
        if (id.startsWith('town_')) continue;
        let src = null, how = '';
        if (ctx.AREA_1920.has(m.t)) { src = 'assets/area/1920x1080/' + m.t + '.jpg'; how = 'name'; }
        else {
            const fb = ctx.SPECIAL_AREA_BG[id] || ctx.CATEGORY_AREA_BG[cat] || null;
            if (fb) { const u = upgrade(fb); src = u.indexOf('/') >= 0 ? u : 'assets/background/' + u; how = ctx.SPECIAL_AREA_BG[id] ? 'special' : 'CATEGORY'; }
        }
        const ok = src && exists(src);
        if (how !== 'name' || !ok) console.log([cat, id, m.t, how || 'NONE', src, ok ? 'ok' : 'MISSING'].join(' | '));
    }
}
