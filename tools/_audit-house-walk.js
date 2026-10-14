// 實測：原版房屋可進（l1j 邊界通行，牆是線不是格）＋村莊 NPC 不被屋頂／攤位蓋住
// 用法：node tools/_audit-house-walk.js [baseUrl]   截圖 → tools/lin/_out/house_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9397);
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'house-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const exc = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; exc.push(String((d.exception && d.exception.description) || d.text).split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber); }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 411, height: 832, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12")}catch(e){};window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>'house';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='屋'+Date.now()%100000;
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(2000);
    ok('出生在奇岩', (await ev('mapState.current')) === 'town_giran');
    for (let i = 0; i < 40 && !(await ev('linmapWalkReady(exploreActiveMapDef().lin)')); i++) await sleep(250);

    // 1) 可走格資料：l1j 邊界（bit4）＋牆擋得住
    const data = await ev(`(()=>{const name=exploreActiveMapDef().lin;const d=linmapData(name);
        const t=linmapTileAt(name,explorePlayerX(),explorePlayerY());let edge=0,wall=0;
        for(let y=t.gy-40;y<=t.gy+40;y++)for(let x=t.gx-40;x<=t.gx+40;x++){const c=linmapTileCenter(name,x,y);
          if(!linmapWalkable(name,c.x,c.y))continue;edge++;
          for(const [dx,dy] of [[1,0],[0,1]]){const e=linmapTileCenter(name,x+dx,y+dy);if(linmapWalkable(name,e.x,e.y)&&!linmapCanStep(name,x,y,dx,dy))wall++;}}
        return {name,edge,wall,fn:typeof linmapCanStep};})()`);
    ok('linmapCanStep 存在', data && data.fn === 'function');
    ok('奇岩有「兩邊都可走、中間是牆」的格（牆是線）', data && data.wall >= 5, JSON.stringify(data));

    // 2) 走進房屋：迪歐的店（原版屋內格），只靠點地＋邊界尋路一路走進去
    const npcs = await ev(`linTownPlan('town_giran').filter(p=>p.npc).map(p=>({n:p.npc.n,on:p.o.n,x:p.o.x,y:p.o.y}))`);
    const shop = (npcs || []).find((p) => p.on === '迪歐');
    ok('迪歐的店有本遊戲 NPC 站著', !!shop, shop && shop.n);
    const inside = await ev(`(()=>{const name=exploreActiveMapDef().lin;const L=linmapData(name);
        const lin=[33450,32805];const gx=lin[0]-L.x0,gy=lin[1]-L.y0;const c=linmapTileCenter(name,gx,gy);
        return {x:c.x,y:c.y,walk:linmapWalkable(name,c.x,c.y)};})()`);
    ok('迪歐店內 (33450,32805) 可走', inside && inside.walk);
    const route = await ev(`(()=>{const name=exploreActiveMapDef().lin;const d=linmapData(name);
        const a=linmapTileAt(name,explorePlayerX(),explorePlayerY()),b=linmapTileAt(name,${inside.x},${inside.y});
        const key=(x,y)=>y*d.nx+x;const prev=new Map([[key(a.gx,a.gy),-1]]);const q=[[a.gx,a.gy]];let end=-1;
        for(let h=0;h<q.length&&end<0&&h<200000;h++){const [x,y]=q[h];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const k=key(x+dx,y+dy);
          if(prev.has(k)||!linmapCanStep(name,x,y,dx,dy))continue;prev.set(k,key(x,y));q.push([x+dx,y+dy]);if(x+dx===b.gx&&y+dy===b.gy){end=k;break;}}}
        if(end<0)return null;const path=[];let k=end;while(k>=0){path.push(linmapTileCenter(name,k%d.nx,Math.floor(k/d.nx)));k=prev.get(k);}
        return path.reverse();})()`);
    ok('邊界尋路找得到進店的路', Array.isArray(route) && route.length > 1, route ? 'steps ' + route.length : 'none');
    let arrived = false;
    if (Array.isArray(route)) {
        const wps = route.filter((p, i) => i % 3 === 0 || i === route.length - 1);
        for (const wp of wps) {
            for (let i = 0; i < 16; i++) {
                await ev(`(()=>{const p=exploreWorldToClient(${wp.x},${wp.y});exploreSetTapMoveFromScreen(p.x,p.y);})()`);
                await sleep(250);
                const cur = await ev('[explorePlayerX(),explorePlayerY()]');
                if (Math.hypot(cur[0] - wp.x, cur[1] - wp.y) < 10) break;
            }
        }
        const cur = await ev('[explorePlayerX(),explorePlayerY()]');
        arrived = Math.hypot(cur[0] - inside.x, cur[1] - inside.y) < 30;
        ok('玩家點地走進迪歐的店', arrived, JSON.stringify(cur) + ' → ' + inside.x + ',' + inside.y);
    }
    await sleep(600);
    const inH = await ev(`(()=>{const L=document.getElementById('explore-linobj');const box=L&&L.querySelector('.explore-linobj-veil');
        const pb=document.querySelector('#player-morph-sprite .pm-body').getBoundingClientRect();
        const hid=typeof linmapHouseActive==='function'?linmapHouseActive():null;
        const hp=document.getElementById('explore-linhouse');
        const over=[...L.querySelectorAll('.explore-linobj-spr')].filter(o=>!o.hidden).filter(o=>{const q=o.getBoundingClientRect();return q.right>pb.left+6&&q.left<pb.right-6&&q.bottom>pb.top+6&&q.top<pb.bottom-6;});
        return {house:hid,patch:!!(hp&&!hp.hidden&&hp.complete&&hp.naturalWidth>0&&getComputedStyle(hp).display!=='none'),
            shellOver:over.filter(o=>o.getAttribute('data-house')===String(hid)).length,
            loose:over.filter(o=>o.parentNode!==box&&o.classList.contains('is-veil')).length};})()`);
    ok('進屋＝收掉外殼（屋內補圖顯示、屋頂不再蓋在人身上）', inH && inH.house != null && inH.patch && inH.shellOver === 0 && inH.loose === 0, JSON.stringify(inH));
    await shot('house_inside.jpg');

    // 3) 牆擋得住：找「兩邊都可走、隔著牆、繞路很遠」的一對格，站一邊點另一邊 → 不可直接穿過去
    const wallTest = await ev(`(async()=>{const name=exploreActiveMapDef().lin;
        const t0=linmapTileAt(name,explorePlayerX(),explorePlayerY());
        const W=(x,y)=>{const c=linmapTileCenter(name,x,y);return linmapWalkable(name,c.x,c.y);};
        const far=(ax,ay,bx,by)=>{const seen=new Set([ax+','+ay]);let q=[[ax,ay]];for(let s=0;s<8;s++){const nq=[];for(const [x,y] of q)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const k=(x+dx)+','+(y+dy);if(seen.has(k)||!linmapCanStep(name,x,y,dx,dy))continue;if(x+dx===bx&&y+dy===by)return false;seen.add(k);nq.push([x+dx,y+dy]);}q=nq;}return true;};
        let pick=null;
        for(let r=0;r<=30&&!pick;r++)for(let y=t0.gy-r;y<=t0.gy+r&&!pick;y++)for(let x=t0.gx-r;x<=t0.gx+r&&!pick;x++){
          if(Math.max(Math.abs(x-t0.gx),Math.abs(y-t0.gy))!==r||!W(x,y))continue;
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(W(x+dx,y+dy)&&!linmapCanStep(name,x,y,dx,dy)&&far(x,y,x+dx,y+dy)){pick={a:[x,y],b:[x+dx,y+dy]};break;}}}
        if(!pick)return {skip:true};
        const a=linmapTileCenter(name,pick.a[0],pick.a[1]),b=linmapTileCenter(name,pick.b[0],pick.b[1]);
        exploreTeleportTo(mapState.current,a.x,a.y);await new Promise(r=>setTimeout(r,600));
        for(let i=0;i<10;i++){const p=exploreWorldToClient(b.x,b.y);exploreSetTapMoveFromScreen(p.x,p.y);await new Promise(r=>setTimeout(r,250));}
        const n=linmapTileAt(name,explorePlayerX(),explorePlayerY());return {pick,now:[n.gx,n.gy],crossed:n.gx===pick.b[0]&&n.gy===pick.b[1]};})()`);
    if (wallTest && !wallTest.skip) ok('點牆另一邊不會直接穿牆', !wallTest.crossed, JSON.stringify(wallTest));
    else ok('附近找得到隔牆的一對格', false, JSON.stringify(wallTest));

    // 4) 村莊 NPC 不被原版物件蓋住（玩家走遠）
    await ev(`exploreTeleportTo('town_giran', LINTOWN_START.town_giran.x, LINTOWN_START.town_giran.y)`);
    await sleep(1500);
    const covered = [];
    for (const p of npcs || []) {
        await ev(`exploreTeleportTo('town_giran', ${p.x}, ${p.y - 220})`);
        await sleep(900);
        const r = await ev(`(()=>{const el=[...document.querySelectorAll('#lin-town-npcs .lin-npc.is-game')].find(e=>!e.hidden&&e.querySelector('.lin-npc-name')&&e.querySelector('.lin-npc-name').textContent.indexOf(${JSON.stringify(p.n)})>=0);if(!el)return {miss:1};
            const b=el.querySelector('.lin-npc-spr').getBoundingClientRect();const z=+getComputedStyle(el).zIndex;
            return {cov:[...document.querySelectorAll('#explore-linobj .explore-linobj-spr')].filter(o=>!o.hidden).filter(o=>{const q=o.getBoundingClientRect();return q.right>b.left+8&&q.left<b.right-8&&q.bottom>b.top+8&&q.top<b.bottom-8&&+getComputedStyle(o).zIndex>=z&&!o.classList.contains('is-veil');}).length};})()`);
        if (!r || r.miss || r.cov) covered.push(p.n + (r && r.miss ? '(不在畫面)' : '×' + (r && r.cov)));
    }
    if (covered.length) console.log('  info', JSON.stringify(await ev(`({cur:mapState.current,act:linTownActive(),n:document.querySelectorAll('#lin-town-npcs .lin-npc').length,live:document.querySelectorAll('#lin-town-npcs .lin-npc.is-game').length,vis:document.querySelectorAll('#lin-town-npcs .lin-npc:not([hidden])').length,names:[...document.querySelectorAll('#lin-town-npcs .lin-npc.is-game .lin-npc-name')].slice(0,3).map(e=>e.textContent)})`)));
    ok('奇岩 NPC 都看得到、不被屋頂／攤位蓋住', covered.length === 0, covered.join(' '));
    await shot('house_npc.jpg');
    await ev(`exploreTeleportTo('town_giran', LINTOWN_START.town_giran.x, LINTOWN_START.town_giran.y)`);
    await sleep(900);
    const outH = await ev(`(()=>{const hp=document.getElementById('explore-linhouse');return {house:linmapHouseActive(),patch:!!(hp&&!hp.hidden)};})()`);
    ok('出屋＝外殼回來（屋內補圖收起）', outH && outH.house == null && !outH.patch, JSON.stringify(outH));

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
