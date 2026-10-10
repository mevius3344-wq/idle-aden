// 實測：說話之島原版拼塊地圖（圖塊顯示、可走格子、出生點、怪物分布、傳送、切圖）
// 用法：node tools/_audit-linmap.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9336;
const SHOT_DIR = path.join(__dirname, 'lin', '_out');
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const LOG = [];
const ok = (name, cond, detail) => {
    const line = (cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '');
    console.log(line);
    LOG.push(line);
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'linmap-'));
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
        window._authAccountForNames=()=>'linmap';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='拼塊'+Date.now()%100000;
        startGame();
        await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv,30); player.hp=player.mhp=99999; try{ calcStats(); }catch(e){} player.hp=player.mhp;
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
        return { map:mapState.current, lin, ready: lin?linmapWalkReady(lin):null,
          linmapOn: document.getElementById('battle-view').classList.contains('is-linmap'),
          layerHidden: layer?layer.classList.contains('hidden'):null,
          imgs: imgs.length, loaded: imgs.filter(i=>i.complete&&i.naturalWidth>0).length,
          px, py, walk: lin?linmapWalkable(lin,px,py):null,
          mobs: mobs.length, mobsWalk: lin?mobs.filter(m=>linmapWalkable(lin,m._fx,m._fy)).length:null,
          mobsSafe: lin?mobs.filter(m=>linmapSafeZone(lin,m._fx,m._fy)).length:null,
          spread: mobs.length? Math.round(Math.max(...mobs.map(m=>Math.hypot(m._fx-px,m._fy-py)))):0,
          floorShown: (()=>{const f=document.getElementById('explore-world-bg'); return !!(f&&getComputedStyle(f).display!=='none'&&!f.classList.contains('hidden'));})(),
          blendShown: (()=>{const f=document.getElementById('explore-world-bg-blend'); return !!(f&&getComputedStyle(f).display!=='none');})(),
          propsShown: (()=>{const f=document.getElementById('explore-prop-layer'); return !!(f&&getComputedStyle(f).display!=='none'&&!f.classList.contains('hidden'));})() };
    })()`);
    const waitMobs = async (want) => {
        const slots = await ev('exploreFieldSlotCount()');
        let s = null;
        for (let i = 0; i < 60; i++) { s = await state(); if (s.mobs >= Math.min(want, slots)) break; await sleep(500); }
        s.slots = slots;
        return s;
    };
    const waitLoaded = async () => { for (let i = 0; i < 30; i++) { const s = await state(); if (s.imgs && s.loaded === s.imgs) return s; await sleep(300); } return state(); };

    console.log('=== 說話之島周邊（原版拼塊） ===');
    await go('talking_island');
    await sleep(3500);
    let s = await waitLoaded();
    console.log('  ', JSON.stringify(s));
    ok('使用原版地圖 ti_island', s.lin === 'ti_island');
    ok('可走格子已載入', s.ready === true);
    ok('圖塊層顯示＋手繪地板／草地墊底／假造景隱藏', s.linmapOn && s.layerHidden === false && !s.floorShown && !s.blendShown && !s.propsShown);
    ok('畫面附近圖塊全部載入', s.imgs > 0 && s.loaded === s.imgs, s.loaded + '/' + s.imgs);
    const cover = await ev(`(()=>{
        const bv=document.getElementById('battle-view'); const r=bv.getBoundingClientRect();
        const layer=document.getElementById('explore-linmap'); const lr=layer.getBoundingClientRect();
        const imgs=[...layer.querySelectorAll('img')].map(i=>{const q=i.getBoundingClientRect();return [i.getAttribute('src').split('/').pop().split('?')[0],Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)];});
        const x=r.left+r.width/2, y=r.top+r.height*0.4;
        const stack=document.elementsFromPoint(x,y).slice(0,8).map(e=>e.tagName+'#'+e.id+'.'+String(e.className).slice(0,40)+' z='+getComputedStyle(e).zIndex+' bg='+getComputedStyle(e).backgroundImage.slice(0,60));
        const kids=[...bv.children].map(e=>{const cs=getComputedStyle(e);const q=e.getBoundingClientRect();return e.tagName+'#'+e.id+'.'+String(e.className).slice(0,50)+' d='+cs.display+' v='+cs.visibility+' op='+cs.opacity+' z='+cs.zIndex+' bgc='+cs.backgroundColor+' bgi='+cs.backgroundImage.slice(0,70)+' r='+[q.left,q.top,q.width,q.height].map(Math.round);});
        const img0=layer.querySelector('img'); const ics=img0?getComputedStyle(img0):null;
        return {kids, img0: ics?{d:ics.display,v:ics.visibility,op:ics.opacity,f:ics.filter,nw:img0.naturalWidth}:null, bvBg:getComputedStyle(bv).backgroundImage.slice(0,80), bv:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], layer:[Math.round(lr.left),Math.round(lr.top)], tf:layer.style.transform, bottom:layer.style.bottom, imgs, stack};
    })()`);
    fs.writeFileSync(path.join(SHOT_DIR, 'audit_cover.json'), JSON.stringify(cover, null, 1));
    const D = await ev('LINMAP_DATA.ti_island.keys');
    ok('出生點＝村莊外（資料 start）', Math.hypot(s.px - D.village.ax, s.py - D.village.ay) < 2, `(${s.px},${s.py})`);
    ok('出生點可走', s.walk === true);
    s = await waitMobs(70);
    ok('怪物格位＝40 練功點×2', s.slots === 80, 'slots=' + s.slots);
    ok('怪物陸續出生', s.mobs >= 60, 'mobs=' + s.mobs);
    ok('怪物全在可走格子上', s.mobs > 0 && s.mobsWalk === s.mobs, s.mobsWalk + '/' + s.mobs);
    ok('怪物不在村莊安全區', s.mobsSafe === 0, 'safe=' + s.mobsSafe);
    ok('怪物散佈全島（非擠在原點）', s.spread > 3000, 'maxDist=' + s.spread);
    await shot('audit_ti_island_start.png');

    // 走路：往東南走 2 秒，位置改變且仍在可走格
    await ev('exploreSetVirtualStick(0.7,0.7,true)');
    await sleep(2000);
    await ev('exploreSetVirtualStick(0,0,false)');
    await sleep(300);
    const s2 = await state();
    ok('搖桿可移動', Math.hypot(s2.px - s.px, s2.py - s.py) > 40, `moved=${Math.round(Math.hypot(s2.px - s.px, s2.py - s.py))}`);
    ok('移動後仍在可走格子', s2.walk === true);
    await shot('audit_ti_island_walk.png');

    // 傳送術：同圖隨機落點且可走
    const tp = [];
    for (let i = 0; i < 6; i++) {
        await ev('exploreRandomTeleportOnMap({mode:"far"})');
        await sleep(400);
        const t = await state();
        tp.push({ x: Math.round(t.px), y: Math.round(t.py), walk: t.walk, map: t.map });
    }
    ok('傳送術落點都在本圖可走格', tp.every((t) => t.walk === true && t.map === 'talking_island'), JSON.stringify(tp.slice(0, 3)));
    ok('傳送術落點會變（隨機）', new Set(tp.map((t) => t.x + ',' + t.y)).size >= 3);
    s = await waitLoaded();
    ok('傳送後圖塊跟上', s.imgs > 0 && s.loaded === s.imgs, s.loaded + '/' + s.imgs);
    await shot('audit_ti_island_tp.png');

    // 海不可走：直接檢查海面座標
    const sea = await ev(`(()=>{const d=LINMAP_DATA.ti_island; return linmapWalkable('ti_island', -d.w/2+300, 0);})()`);
    ok('海面不可走', sea === false);

    console.log('=== 地監 1 樓 / 2 樓 ===');
    await go('zone_13');
    await sleep(3000);
    s = await waitLoaded();
    console.log('  ', JSON.stringify(s));
    const D1 = await ev('LINMAP_DATA.ti_dungeon1.keys');
    ok('地監1樓用 ti_dungeon1', s.lin === 'ti_dungeon1' && s.ready === true);
    ok('地監1樓出生於入口旁', Math.hypot(s.px - D1.entry.ax, s.py - D1.entry.ay) < 2 && s.walk === true);
    s = await waitMobs(36);
    ok('地監1樓怪物在走道上', s.mobs > 20 && s.mobsWalk === s.mobs, s.mobsWalk + '/' + s.mobs);
    ok('地監1樓圖塊載入', s.imgs > 0 && s.loaded === s.imgs);
    await shot('audit_ti_dungeon1.png');
    await go('zone_14');
    await sleep(3000);
    s = await waitLoaded();
    ok('地監2樓用 ti_dungeon2', s.lin === 'ti_dungeon2' && s.ready === true && s.walk === true);
    s = await waitMobs(36);
    ok('地監2樓怪物在走道上', s.mobs > 20 && s.mobsWalk === s.mobs, s.mobsWalk + '/' + s.mobs);
    await shot('audit_ti_dungeon2.png');

    console.log('=== 傳送門：本島 → 村莊 ===');
    await go('talking_island');
    await sleep(3000);
    const walkTo = await ev(`(async()=>{
        const k=LINMAP_DATA.ti_island.keys.village;
        for(let i=0;i<120&&mapState.current==='talking_island';i++){
            const dx=k.x-explorePlayerX(), dy=k.y-explorePlayerY(); const L=Math.hypot(dx,dy)||1;
            exploreSetVirtualStick(dx/L, -dy/L, true);
            await new Promise(r=>setTimeout(r,100));
        }
        exploreSetVirtualStick(0,0,false);
        return mapState.current;
    })()`);
    ok('走進村莊傳送門 → 說話之島村莊', walkTo === 'town_talking', 'map=' + walkTo);
    s = await state();
    ok('村莊改用原版村莊拼塊 tw_talking（v3.9.63 可走動村莊）', s.linmapOn && s.lin === 'tw_talking' && s.layerHidden === false, JSON.stringify({ lin: s.lin, on: s.linmapOn }));

    console.log('=== 未轉換地圖不受影響（野外／地監已由 _audit-linfields.js 驗證） ===');
    await go('pirate_wild');
    await sleep(3000);
    s = await state();
    ok('海賊島不使用原版拼塊', !s.lin && !s.linmapOn && s.floorShown, JSON.stringify({ lin: s.lin, on: s.linmapOn, floor: s.floorShown }));
    await go('thebes_desert');
    await sleep(3000);
    s = await state();
    ok('底比斯沙漠維持原地板', !s.lin && !s.linmapOn && s.floorShown);

    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(SHOT_DIR, 'audit_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
