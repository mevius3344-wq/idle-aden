// 實測：原版可走動村莊（原版拼塊、NPC 原版站位可點、無怪、點地走、出村傳送門）
// 用法：node tools/_audit-lintown.js [baseUrl] [--towns town_talking,town_giran]   截圖 → tools/lin/_out/lintown_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const BASE = args.find((a) => /^https?:/.test(a)) || 'http://localhost:5199';
const ti = args.indexOf('--towns');
const ONLY = ti >= 0 ? args[ti + 1].split(',') : null;
const PORT = 9341;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'lintown-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = []; const bad404 = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber);
        }
        if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && /linmap|linnpc/.test(m.params.response.url)) bad404.push(m.params.response.url);
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };
    const tap = async (x, y, holdMs) => {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await sleep(holdMs || 60);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const changeMap = (mid) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true);})()`);

    // 依原版可走格 BFS 找路（引擎無尋路）；near＝抵達目標 near 格內即可
    const findRoute = (tid, tx, ty, near) => ev(`(()=>{const name=MAP_DEFS[${JSON.stringify(tid)}].lin;const d=linmapData(name);
        const toW=(gx,gy)=>({x:(gx+gy)*24+d.ox-d.w/2,y:d.h/2-((gy-gx)*12+d.oy)});
        const a=linmapTileAt(name,explorePlayerX(),explorePlayerY()),b=linmapTileAt(name,${tx},${ty});
        const W=(x,y)=>{const w=toW(x,y);return linmapWalkable(name,w.x,w.y);};
        const key=(x,y)=>y*d.nx+x;const prev=new Map([[key(a.gx,a.gy),-1]]);const q=[[a.gx,a.gy]];let end=-1;
        const goal=(x,y)=>Math.max(Math.abs(x-b.gx),Math.abs(y-b.gy))<=${near};
        if(goal(a.gx,a.gy))end=key(a.gx,a.gy);
        for(let h=0;h<q.length&&end<0;h++){const [x,y]=q[h];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;const k=key(nx,ny);
          if(nx<0||ny<0||nx>=d.nx||ny>=d.ny||prev.has(k)||!W(nx,ny))continue;if(dx&&dy&&(!W(x+dx,y)||!W(x,y+dy)))continue;prev.set(k,key(x,y));q.push([nx,ny]);if(goal(nx,ny)){end=k;break;}}}
        if(end<0)return null;const path=[];let k=end;while(k>=0){path.push(toW(k%d.nx,Math.floor(k/d.nx)));k=prev.get(k);}
        path.reverse();return path;})()`);
    const walkRoute = async (route, leaveTo) => {
        for (const wp of route || []) {
            for (let i = 0; i < 12; i++) {
                await ev(`(()=>{const p=exploreWorldToClient(${wp.x},${wp.y});exploreSetTapMoveFromScreen(p.x,p.y);})()`);
                await sleep(250);
                const cur = await ev(`[explorePlayerX(),explorePlayerY(),mapState.current]`);
                if (leaveTo && cur[2] === leaveTo) return true;
                if (Math.hypot(cur[0] - wp.x, cur[1] - wp.y) < 10) break;
            }
        }
        return false;
    };

    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'lintown';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='村莊'+Date.now()%100000;
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);

    const towns = (await ev(`Object.keys(MAP_DEFS).filter(k=>mapdefTownLin(k))`)) || [];
    ok(towns.length >= 15, '原版可走動村莊數 ' + towns.length);
    let first = true;
    for (const tid of towns) {
        if (ONLY && !ONLY.includes(tid)) continue;
        await changeMap(tid);
        await sleep(first ? 5000 : 3500);
        first = false;
        const st = await ev(`(()=>{const bv=document.getElementById('battle-view');const tv=document.getElementById('town-view');
            const imgs=[...document.querySelectorAll('#explore-linmap img')];
            const ents=[...document.querySelectorAll('#lin-town-npcs .lin-npc')];
            const game=ents.filter(e=>e.classList.contains('is-game'));
            const want=townVisibleNpcs(${JSON.stringify(tid)}).length;
            const plan=linTownPlan(${JSON.stringify(tid)});
            const same=plan.filter(p=>p.npc&&p.o.n&&(p.o.n===p.npc.n||p.o.n.indexOf(p.npc.n)>=0||p.npc.n.indexOf(p.o.n)>=0)).length;
            const L=linmapData(MAP_DEFS[${JSON.stringify(tid)}].lin);
            return {bvOn:!bv.classList.contains('hidden'),tvOff:tv.classList.contains('hidden'),lin:bv.classList.contains('is-linmap'),explore:exploreWorldActive(),
              imgs:imgs.length,loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,ents:ents.length,game:game.length,want,same,
              mobs:(mapState.mobs||[]).filter(Boolean).length,walk:linmapWalkReady(L&&MAP_DEFS[${JSON.stringify(tid)}].lin)?linmapWalkable(MAP_DEFS[${JSON.stringify(tid)}].lin,explorePlayerX(),explorePlayerY()):null,
              safe:linmapSafeZone(MAP_DEFS[${JSON.stringify(tid)}].lin,explorePlayerX(),explorePlayerY()),
              walkCls:document.getElementById('game-screen').classList.contains('lin-town-walk'),
              name:(document.getElementById('lr-map-name')||{}).textContent,coord:(document.getElementById('lr-map-coord')||{}).textContent};})()`);
        const tag = tid + ' ';
        ok(st && st.bvOn && st.tvOff && st.lin && st.explore, tag + '戰鬥框＝原版拼塊、探索啟用');
        ok(st && st.imgs > 0 && st.loaded === st.imgs, tag + '拼塊圖載入 ' + (st && st.loaded) + '/' + (st && st.imgs));
        ok(st && st.game === st.want && st.want > 0, tag + '本遊戲 NPC 全上地圖 ' + (st && st.game) + '/' + (st && st.want) + '（同名原版位 ' + (st && st.same) + '），原版 NPC 共 ' + (st && st.ents));
        ok(st && st.mobs === 0, tag + '村莊無怪');
        ok(st && st.walk !== false, tag + '出生點可走' + (st && st.safe ? '（安全區）' : ''));
        ok(st && st.walkCls, tag + 'game-screen 有 lin-town-walk');
        // 點最近的本遊戲 NPC → 浮動視窗（畫面上沒有就沿原版可走格走過去）
        const findHit = () => ev(`(()=>{const ents=[...document.querySelectorAll('#lin-town-npcs .lin-npc.is-game')].filter(e=>!e.hidden);
            let best=null,bd=1e9;for(const e of ents){const r=e.getBoundingClientRect();if(r.width<2)continue;const x=r.left+r.width/2,y=r.top+r.height*0.6;if(x<10||x>innerWidth-10||y<90||y>innerHeight-260)continue;
              const h=document.elementFromPoint(x,y);if(!h||!e.contains(h))continue;const d=Math.hypot(x-innerWidth/2,y-innerHeight/2);if(d<bd){bd=d;best={x,y,id:e.dataset.npc};}}
            return best;})()`);
        let hit = await findHit();
        if (!hit) {
            const tgt = await ev(`(()=>{const p=linTownPlan(${JSON.stringify(tid)}).filter(q=>q.npc);let b=null,bd=1e9;for(const q of p){const d=Math.hypot(q.o.x-explorePlayerX(),q.o.y-explorePlayerY());if(d<bd){bd=d;b=q.o;}}return b&&{x:b.x,y:b.y};})()`);
            if (tgt) {
                const route = (await findRoute(tid, tgt.x, tgt.y, 2)) || (await findRoute(tid, tgt.x, tgt.y, 3));
                await walkRoute(route, null);
                await sleep(600);
                hit = await findHit();
            }
        }
        if (hit) {
            await tap(hit.x, hit.y, 60);
            await sleep(700);
            const dlg = await ev(`(()=>{const d=document.getElementById('town-interaction-container');const r=d.getBoundingClientRect();return !d.classList.contains('hidden')&&r.width>100&&r.height>100?document.getElementById('interaction-npc-name').textContent:'';})()`);
            const wh = await ev(`(()=>{const w=document.getElementById('warehouse-window')||document.querySelector('.warehouse-window,#wh-window');return !!w&&getComputedStyle(w).display!=='none';})()`);
            ok(!!dlg || wh, tag + '點 NPC 開對話 (' + hit.id + (dlg ? '→' + dlg : '') + ')');
            await shot('lintown_' + tid + '_dlg.png');
            await ev(`try{closeNpcInteraction()}catch(e){};try{closeWarehouseWindow&&closeWarehouseWindow()}catch(e){}`);
        } else {
            ok(false, tag + '畫面中有可點的本遊戲 NPC');
        }
        await shot('lintown_' + tid + '.png');
        console.log('   ', tid, st && st.name, st && st.coord);
    }

    // 點地面走動（說話之島村莊）
    if (!ONLY || ONLY.includes('town_talking')) {
        await changeMap('town_talking');
        await sleep(3500);
        let moved = 0;
        for (const [tx, ty] of [[300, 330], [110, 340], [206, 260], [300, 480], [110, 470]]) {
            const p0 = await ev('[explorePlayerX(),explorePlayerY()]');
            await tap(tx, ty, 80);
            await sleep(1300);
            const p1 = await ev('[explorePlayerX(),explorePlayerY()]');
            moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            if (moved > 10) break;
        }
        ok(moved > 10, '村莊內點地面會走 (位移 ' + Math.round(moved) + ')');
        // 出村不用傳送門：走出安全區就是說話之島周邊（同一張原版圖）
        const ptl = await ev(`mapdefPortals('town_talking').length`);
        ok(ptl === 0, '說話之島村莊沒有出村傳送門 (' + ptl + ')');
        const p0 = await ev('[explorePlayerX(),explorePlayerY()]');
        const wr = await require('./_world-path').walkRegion(ev, sleep, false, 300);
        const p1 = await ev('[explorePlayerX(),explorePlayerY(),mapState.current]');
        ok(wr.reached && p1[2] === 'talking_island', '走出安全區到說話之島周邊 (' + JSON.stringify(p0) + '→' + JSON.stringify(p1) + ')' + (wr.reached ? '' : ' plan=' + (wr.plan ? wr.plan.dest + '/' + wr.plan.n : 'null') + ' last=' + JSON.stringify(wr.trace.slice(-3))));
        await sleep(2500);
        const back = await ev(`(()=>{const e=document.querySelectorAll('#lin-town-npcs .lin-npc');return {ents:e.length,live:document.querySelectorAll('#lin-town-npcs .lin-npc.is-game').length,lin:exploreActiveMapDef().lin,walk:document.getElementById('game-screen').classList.contains('lin-town-walk'),dlgHome:document.getElementById('town-interaction-container').parentElement.id};})()`);
        ok(back && back.ents > 0 && back.live === 0 && back.lin === 'ti_island' && !back.walk && back.dlgHome === 'town-view',
            '出村後同圖村莊 NPC 仍站著但不可點、對話框歸位 ' + JSON.stringify(back));
    }

    // 非原版村莊仍是舊村莊畫面（鎖定 #2 背景）
    await changeMap('town_hyperia');
    await sleep(3000);
    const old = await ev(`(()=>{const tv=document.getElementById('town-view');return {tv:!tv.classList.contains('hidden'),bvOff:document.getElementById('battle-view').classList.contains('hidden'),inTown:document.getElementById('game-screen').classList.contains('chud-in-town'),bg:/url\\(/.test(getComputedStyle(document.getElementById('town-npc-map')).backgroundImage+getComputedStyle(tv).backgroundImage),npcs:document.querySelectorAll('#town-npc-map .town-npc').length};})()`);
    ok(old && old.tv && old.bvOff && old.inTown && old.bg && old.npcs > 0, '希培利亞（無原版）仍用舊村莊畫面＋背景 ' + JSON.stringify(old));

    ok(bad404.length === 0, '原版圖檔無 404' + (bad404.length ? '：' + bad404.slice(0, 3).join(' ') : ''));
    ok(errors.length === 0, 'JS 例外：' + (errors.length ? errors.slice(0, 5).join(' | ') : '無'));
    ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
