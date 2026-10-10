// 實測：原版村莊多人同圖（兩個瀏覽器分頁進同一村莊，互相看得到、位置跟著動）
// 用法：node tools/_audit-town-mp.js [baseUrl]   截圖 → tools/lin/_out/townmp_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9343;
const OUT = path.join(__dirname, 'lin', '_out');
const TOWN = 'town_talking';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

async function page(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };
    return { ws, send, ev, shot, errors };
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'townmp-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const t2 = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const A = await page(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    const B = await page(t2.webSocketDebuggerUrl);
    const stamp = Date.now() % 100000;
    const login = async (acct) => {
        const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
        await pj('/api/accounts/register', { account: acct, password: 'townmp-test' });
        const r = await pj('/api/accounts/login', { account: acct, password: 'townmp-test', clientId: 'townmp-audit-' + acct });
        if (!r || !r.authToken) throw new Error('login failed ' + acct + ' ' + JSON.stringify(r));
        return r.authToken;
    };
    for (const [P, acct, nm] of [[A, 'mptesta', '甲' + stamp], [B, 'mptestb', '乙' + stamp]]) {
        const token = await login(acct);
        await P.send('Page.enable'); await P.send('Runtime.enable');
        await P.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
        await P.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(token) + ')}catch(e){}'
            + 'window.__hb=[];const _f=window.fetch;window.fetch=function(u,o){const p=_f.apply(this,arguments);if(String(u).indexOf("/api/party/")>=0){p.then(r=>r.clone().text()).then(t=>{window.__hb.push(String(u).slice(0,40)+" "+t.slice(0,200));if(window.__hb.length>12)window.__hb.shift();}).catch(()=>{});}return p;};' });
        await P.send('Page.navigate', { url: BASE + '/' });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await P.ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
        await P.ev(`(async()=>{
            window._authAccountForNames=()=>${JSON.stringify(acct)};
            window.__DEV_OFFLINE=false; window.__fb5AuthAccount=${JSON.stringify(acct)};
            let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
            currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
            document.getElementById('create-name-input').value=${JSON.stringify(nm)};
            startGame(); await new Promise(r=>setTimeout(r,3000));
            try{ setPowerSaveOn(false); }catch(e){}
            const sel=document.getElementById('map-select');const id=${JSON.stringify(TOWN)};
            if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
            sel.value=id; changeMap(true);
        })()`);
        P.name = nm;
    }
    await sleep(6000);
    const seen = async (P, other) => P.ev(`(()=>{const el=[...document.querySelectorAll('#battle-view .remote-party')].find(e=>(e.getAttribute('data-peer-name')||'')===${JSON.stringify(other)});
        if(!el)return {found:false,map:mapState.current,ws:(typeof rtWorldIsConnected==='function'&&rtWorldIsConnected()),acct:String(window.__fb5AuthAccount||''),susp:(typeof gameOnlineSuspended==='function'?gameOnlineSuspended():null),dev:!!window.__DEV_OFFLINE,pop:(typeof mapPopSameMapPlayers==='function'?mapPopSameMapPlayers().map(m=>m.name):null),members:(typeof _remoteSameMapMembersMerged==='function'?_remoteSameMapMembersMerged().map(m=>m.name+'@'+m.mapId):[])};
        let w=0,h=0;for(const n of [el,...el.querySelectorAll('*')]){const r=n.getBoundingClientRect();w=Math.max(w,r.width);h=Math.max(h,r.height);}
        return {found:true,vis:getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&w>4&&h>4,left:el.style.left,bottom:el.style.bottom,tf:el.style.transform};})()`);
    let sa = null, sb = null;
    for (let i = 0; i < 20; i++) {
        await A.send('Page.bringToFront'); await sleep(300);
        sa = await seen(A, B.name);
        await B.send('Page.bringToFront'); await sleep(300);
        sb = await seen(B, A.name);
        if (sa.found && sb.found) break;
        await sleep(1000);
    }
    ok(sa && sa.found && sa.vis, '甲在村莊看得到乙 ' + JSON.stringify(sa));
    ok(sb && sb.found && sb.vis, '乙在村莊看得到甲 ' + JSON.stringify(sb));
    // 乙在村莊走動 → 甲畫面中乙的位置跟著變
    const posOf = (s) => s && s.found ? [s.left, s.bottom, s.tf].join('|') : null;
    const before = posOf(sa);
    await B.send('Page.bringToFront'); await sleep(200);
    await B.ev(`(()=>{const bv=document.getElementById('battle-view').getBoundingClientRect();exploreSetTapMoveFromScreen(bv.left+bv.width*0.85,bv.top+bv.height*0.5);})()`);
    await sleep(3000);
    await B.shot('townmp_B.png');
    await A.send('Page.bringToFront');
    let after = before;
    for (let i = 0; i < 16 && after === before; i++) {
        await sleep(500);
        after = posOf(await seen(A, B.name));
    }
    const chInfo = async (P) => P.ev('JSON.stringify({ch:window.__rtWorldChannel,pop:mapPopSameMapPlayers().map(m=>m.name+"@"+m.wx+","+m.wy),me:[Math.round(explorePlayerX()),Math.round(explorePlayerY())]})');
    ok(before && after && after !== before, '乙走動後甲看到的位置更新 (' + before + ' → ' + after + ') A=' + await chInfo(A) + ' B=' + await chInfo(B));
    await A.shot('townmp_A.png');

    // 野外（鎖定 #18）：同圖互見＋即時同步開啟後仍能正常打怪拿經驗
    const FIELD = 'talking_island';
    for (const P of [A, B]) {
        await P.send('Page.bringToFront');
        await P.ev(`(()=>{player.lv=60;calcStats();player.hp=player.mhp;const sel=document.getElementById('map-select');const id=${JSON.stringify(FIELD)};
            if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
            sel.value=id; changeMap(true);})()`);
        await sleep(2500);
    }
    let fa = null, fb = null;
    for (let i = 0; i < 15; i++) {
        await A.send('Page.bringToFront'); await sleep(300);
        fa = await seen(A, B.name);
        await B.send('Page.bringToFront'); await sleep(300);
        fb = await seen(B, A.name);
        if (fa.found && fb.found) break;
        await sleep(1000);
    }
    ok(fa && fa.found && fa.vis, '野外 甲看得到乙 ' + JSON.stringify(fa));
    ok(fb && fb.found && fb.vis, '野外 乙看得到甲 ' + JSON.stringify(fb));
    await A.send('Page.bringToFront');
    const exp0 = await A.ev('JSON.stringify({exp:player.exp,lv:player.lv,mobs:(mapState.mobs||[]).filter(Boolean).length,map:mapState.current})');
    let maxMobs = 0;
    for (let i = 0; i < 25; i++) {
        await sleep(1000);
        const n = await A.ev('player.hp=player.mhp;(mapState.mobs||[]).filter(m=>m&&m.curHp>0).length');
        maxMobs = Math.max(maxMobs, n || 0);
        await B.ev('player.hp=player.mhp');
    }
    const exp1 = await A.ev('JSON.stringify({exp:player.exp,lv:player.lv,ch:window.__rtWorldChannel,ws:rtWorldIsConnected()})');
    const e0 = JSON.parse(exp0), e1 = JSON.parse(exp1);
    ok(maxMobs > 0, '野外有怪 (最多 ' + maxMobs + ' 隻) ' + exp0);
    ok(e1.exp !== e0.exp || e1.lv !== e0.lv, '野外打怪有拿到經驗 ' + exp0 + ' → ' + exp1);
    await A.shot('townmp_field_A.png');
    ok(A.errors.length + B.errors.length === 0, 'JS 例外：' + (A.errors.concat(B.errors).slice(0, 4).join(' | ') || '無'));
    A.ws.close(); B.ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
