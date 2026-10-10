// 實測：野外／地監原版拼塊（tools/lin/fields-config.js）
//   離線：每張圖 MapDef.lin／出生點／傳送門／抵達點／練功點都落在可走格；傳送門目的地沿用舊圖
//   瀏覽器（有 baseUrl 參數或 --browser）：逐圖切換，圖塊載入、出生可走、怪物在可走格；走進傳送門換圖
// 用法：node tools/_audit-linfields.js [--browser] [baseUrl]
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIELDS = require('./lin/fields-config');
const WORLDS = require('./lin/worlds-config');
// 整張大地圖（worlds-config）上的野外沒有自己的取景圖，改用大地圖
const worldOf = (id) => (FIELDS[id][2] != null ? Object.keys(WORLDS).find((n) => WORLDS[n].map === FIELDS[id][0]) : null) || null;
const linOf = (id) => worldOf(id) || FIELDS[id][1];
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

function loadWorld(withLin) {
    const { loadDefs } = require('./lin/mapdefs-vm');
    if (!withLin) return loadDefs();
    const src = fs.readFileSync(path.join(ROOT, 'js', '49-linmap-data.js'), 'utf8');
    const box = {};
    vm.runInNewContext(src, { window: box });
    const win = (function () {
        const fsx = require('fs');
        const ctx = { console };
        ctx.window = ctx; ctx.globalThis = ctx;
        const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub), apply: () => stub, construct: () => stub });
        ctx.document = stub; ctx.localStorage = { getItem: () => null, setItem() {} }; ctx.navigator = { userAgent: '' };
        ctx.addEventListener = () => {}; ctx.setTimeout = () => 0; ctx.setInterval = () => 0; ctx.DB = stub;
        ctx.LINMAP_DATA = box.LINMAP_DATA;
        const c = vm.createContext(ctx);
        for (const f of ['js/11-world-map.js', 'js/47-mapdef.js']) {
            try { vm.runInContext(fsx.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f }); } catch (e) { console.error(f, String(e).slice(0, 200)); }
        }
        return ctx;
    })();
    return win;
}

function walkGrid(name) {
    const dir = path.join(ROOT, 'assets', 'linmap', name);
    return fs.readFileSync(path.join(dir, 'walk.bin'));
}
function cell(L, walk, wx, wy) {
    const u = (wx + L.w / 2 - L.ox) / 24, v = (L.h / 2 - wy - L.oy) / 12;
    const gx = Math.round((u - v) / 2), gy = Math.round((u + v) / 2);
    if (gx < 0 || gy < 0 || gx >= L.nx || gy >= L.ny) return 0;
    return walk[gy * L.nx + gx];
}

function offline() {
    console.log('=== 離線：資料／傳送門 ===');
    const before = loadWorld(false).MAP_DEFS;
    const W = loadWorld(true);
    const D = W.LINMAP_DATA, M = W.MAP_DEFS;
    const walks = {};
    const wk = (n) => walks[n] || (walks[n] = walkGrid(n));
    let n = 0;
    for (const id of Object.keys(FIELDS)) {
        const out = linOf(id), wn = worldOf(id);
        const L = D[out], def = M[id];
        const bad = [];
        if (!L) { ok(id + ' 有原版資料 ' + out, false); continue; }
        if (!def || def.lin !== out) bad.push('lin=' + (def && def.lin));
        if (!(cell(L, wk(out), def.start.x, def.start.y) & 1)) bad.push('start 不可走');
        const sameWorld = (dest) => wn && M[dest] && M[dest].world === wn;
        const oldDest = ((before[id] && before[id].portals) || []).filter(Boolean).map((p) => p.dest).filter((d) => !sameWorld(d)).join(',');
        const newDest = (def.portals || []).map((p) => p.dest).join(',');
        if (oldDest !== newDest) bad.push('傳送門目的地變了 ' + oldDest + ' → ' + newDest);
        if (wn && (def.portals || []).some((p) => sameWorld(p.dest))) bad.push('同一張大地圖內仍有傳送門');
        for (const p of def.portals || []) {
            if (!(cell(L, wk(out), p.x + p.w / 2, p.y + p.h / 2) & 1)) bad.push('門 ' + p.dest + ' 不在可走格');
            const dd = M[p.dest];
            if (dd && dd.lin && D[dd.lin]) {
                if (p.destX == null || !(cell(D[dd.lin], wk(dd.lin), p.destX, p.destY) & 1)) bad.push('抵達 ' + p.dest + ' 不可走');
            }
        }
        const spots = wn ? def.spawns : L.spots;
        const spotsBad = spots.filter((s) => (cell(L, wk(out), s.x, s.y) & 3) !== 1).length;
        if (!spots.length) bad.push('無練功點');
        if (spotsBad) bad.push('練功點不可走／在安全區 ' + spotsBad);
        ok(id + ' → ' + out, bad.length === 0, bad.join('；') || `門 ${def.portals.length}、點 ${spots.length}`);
        n++;
    }
    // 其他地圖（村莊、特殊圖、說話之島）走進這些圖的抵達點
    const into = [];
    for (const [src, def] of Object.entries(M)) {
        for (const p of (def && def.portals) || []) {
            if (!p || !FIELDS[p.dest] || FIELDS[src]) continue;
            const dd = M[p.dest];
            const L = D[dd.lin];
            const a = (p.destX != null) ? [p.destX, p.destY] : [dd.start.x, dd.start.y];
            if (!(cell(L, wk(dd.lin), a[0], a[1]) & 1)) into.push(src + '→' + p.dest);
        }
    }
    ok('其他地圖進入原版野外／地監的抵達點皆可走', into.length === 0, into.join(', '));
    ok('全部 ' + Object.keys(FIELDS).length + ' 張已轉換', n === Object.keys(FIELDS).length);
}

const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browser(BASE) {
    console.log('=== 瀏覽器：逐圖切換 ===');
    const PORT = 9338;
    const SHOT_DIR = path.join(__dirname, 'lin', '_out');
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'linfields-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd,
        '--window-size=1600,1000', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
        await sleep(250);
        try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {}
    }
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pend = new Map();
    const exc = [];
    ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') exc.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 300));
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        if (r.result && r.result.data) fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(r.result.data, 'base64'));
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) {
        await sleep(500);
        if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break;
    }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'linfields';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='原野'+Date.now()%100000;
        startGame();
        await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv,90); player.hp=player.mhp=999999; try{ calcStats(); }catch(e){} player.hp=player.mhp=999999;
    })()`);
    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    const state = () => ev(`(()=>{
        const def=exploreActiveMapDef(); const lin=def&&def.lin;
        const layer=document.getElementById('explore-linmap');
        const imgs=layer?[...layer.querySelectorAll('img')]:[];
        const px=explorePlayerX(), py=explorePlayerY();
        const mobs=(mapState.mobs||[]).filter(m=>m&&m._fx!=null);
        const ps=document.getElementById('player-morph-sprite'); const pr=ps?ps.getBoundingClientRect():null;
        return { map:mapState.current, lin, ready: lin?linmapWalkReady(lin):null,
          linmapOn: document.getElementById('battle-view').classList.contains('is-linmap'),
          imgs: imgs.length, loaded: imgs.filter(i=>i.complete&&i.naturalWidth>0).length,
          px, py, walk: lin?linmapWalkable(lin,px,py):null,
          mobs: mobs.length, mobsWalk: lin?mobs.filter(m=>linmapWalkable(lin,m._fx,m._fy)).length:null,
          player: pr?[Math.round(pr.width),Math.round(pr.height)]:null,
          floorShown: (()=>{const f=document.getElementById('explore-world-bg'); return !!(f&&getComputedStyle(f).display!=='none'&&!f.classList.contains('hidden'));})() };
    })()`);
    const ids = process.argv.includes('--portals') ? [] : Object.keys(FIELDS);
    const shots = new Set(['gludio', 'zone_06', 'desert', 'zone_26', 'zone_02', 'crystal_cave1', 'rastabad_gate', 'heine']);
    for (const mid of ids) {
        await go(mid);
        let s = null;
        for (let i = 0; i < 40; i++) {
            await sleep(400);
            s = await state();
            if (s && s.ready && s.imgs && s.loaded === s.imgs && s.mobs >= 6) break;
        }
        const bad = [];
        if (s.map !== mid) bad.push('map=' + s.map);
        if (s.lin !== linOf(mid) || !s.linmapOn) bad.push('lin=' + s.lin);
        if (!s.ready) bad.push('walk 未載');
        if (!(s.imgs > 0 && s.loaded === s.imgs)) bad.push('圖塊 ' + s.loaded + '/' + s.imgs);
        if (s.walk !== true) bad.push('出生不可走');
        if (s.floorShown) bad.push('舊地板仍顯示');
        if (!(s.mobs > 0) || s.mobsWalk !== s.mobs) bad.push('怪 ' + s.mobsWalk + '/' + s.mobs);
        if (!s.player || s.player[0] < 40) bad.push('人物 ' + JSON.stringify(s.player));
        ok(mid + ' 瀏覽器', bad.length === 0, bad.join('；') || `圖塊 ${s.imgs}、怪 ${s.mobs}`);
        if (shots.has(mid)) await shot('linfield_' + mid + '.png');
    }

    console.log('=== 走進傳送門：古魯丁地監 1 樓 → 古魯丁 → 回地監 ===');
    const walkInto = async (from, dest) => ev(`(async()=>{
        const p=(MAP_DEFS[${JSON.stringify(from)}].portals||[]).find(q=>q.dest===${JSON.stringify(dest)});
        if(!p) return 'no-portal';
        const tx=p.x+p.w/2, ty=p.y+p.h/2;
        for(let i=0;i<200&&mapState.current===${JSON.stringify(from)};i++){
            const dx=tx-explorePlayerX(), dy=ty-explorePlayerY(); const L=Math.hypot(dx,dy)||1;
            exploreSetVirtualStick(dx/L, -dy/L, true);
            await new Promise(r=>setTimeout(r,100));
        }
        exploreSetVirtualStick(0,0,false);
        return mapState.current;
    })()`);
    const arriveKey = (lin, dest, area) => ev(`(()=>{let L=LINMAP_DATA[${JSON.stringify(lin)}]; if(L.world) L=L.areas[${JSON.stringify(area || '')}]; const k=L.keys['p'+L.pd.indexOf(${JSON.stringify(dest)})]; return {x:k.ax,y:k.ay};})()`);
    await go('zone_06');
    await sleep(3000);
    let r = await walkInto('zone_06', 'gludio');
    ok('地監 1 樓走進出口 → 古魯丁', r === 'gludio', 'map=' + r);
    await sleep(2500);
    let s = await state();
    let k = await arriveKey(linOf('gludio'), 'zone_06', 'gludio');
    ok('抵達古魯丁地監入口旁（原版位置 32728,32929）', s.walk === true && Math.hypot(s.px - k.x, s.py - k.y) < 40, `(${Math.round(s.px)},${Math.round(s.py)}) vs (${k.x},${k.y})`);
    await shot('linfield_gludio_arrive.png');
    r = await walkInto('gludio', 'zone_06');
    ok('古魯丁走進地監入口 → 地監 1 樓', r === 'zone_06', 'map=' + r);
    await sleep(2500);
    s = await state();
    k = await arriveKey('dg_gludio1', 'gludio');
    ok('抵達地監 1 樓出口旁', s.walk === true && Math.hypot(s.px - k.x, s.py - k.y) < 40, `(${Math.round(s.px)},${Math.round(s.py)}) vs (${k.x},${k.y})`);

    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    ws.close(); br.kill();
}

(async () => {
    offline();
    const args = process.argv.slice(2);
    const base = args.find((a) => /^https?:/.test(a));
    if (base || args.includes('--browser') || args.includes('--portals')) await browser(base || 'http://localhost:5199');
    console.log(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    process.exit(fails ? 1 : 0);
})();
