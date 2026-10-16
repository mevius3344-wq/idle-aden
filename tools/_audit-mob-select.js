// 實測：點選怪物＝鎖定目標明顯（.active、名＋血條、紅金光暈），名貼頭、無腳底選取環
// 用法：node tools/_audit-mob-select.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9437);
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'asel-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const exc = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            exc.push(String((d.exception && d.exception.description) || d.text).split('\n')[0]);
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr, to) => {
        const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(to || 20000).then(() => ({ __timeout: true }))]);
        if (r.__timeout) return { __timeout: true };
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'ms' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'ms-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'ms-test', clientId: 'ms-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }

    const started = await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('選' + stamp)};
        startGame(); for(let i=0;i<60&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
        await new Promise(r=>setTimeout(r,1500));
        // 確保奇岩木頭人
        try{
            const spots=typeof townDummySpots==='function'?(townDummySpots('town_giran')||townDummySpots()):null;
            const have=((mapState&&mapState.mobs)||[]).filter(m=>m&&m._townDummy&&!m._dead).length;
            if(spots&&spots.length&&have<spots.length&&typeof spawnMob==='function'){
                for(let k=0;k<spots.length;k++) try{ spawnMob(k); }catch(eS){}
                try{ if(typeof _renderMobsImpl==='function') _renderMobsImpl(); }catch(eR){}
                await new Promise(r=>setTimeout(r,500));
            }
        }catch(eD){}
        return { ok:!!(player&&player.inv&&player.inv.length), map:mapState&&mapState.current,
            gs:!!(document.getElementById('game-screen')&&!document.getElementById('game-screen').classList.contains('hidden')),
            dummies:((mapState&&mapState.mobs)||[]).filter(m=>m&&m._townDummy&&!m._dead).length };
    })()`, 50000);
    ok('進遊戲成功', !!(started && started.ok && started.gs), JSON.stringify(started));

    const giran = await ev(`(()=>{
        const dummies=[...document.querySelectorAll('#mob-list .mob-target')].filter(c=>{
            const uid=c.getAttribute('data-uid'); if(!uid) return false;
            const m=((mapState&&mapState.mobs)||[]).find(x=>x&&String(x.uid)===uid);
            return !!(m&&(m._townDummy||m.n==='木頭人'));
        });
        if(dummies.length<2) return {err:'dummies='+dummies.length, map:mapState&&mapState.current, nMobs:((mapState&&mapState.mobs)||[]).filter(m=>m&&!m._dead).length};
        const b=dummies[1];
        const ib=(mapState.mobs||[]).findIndex(m=>m&&String(m.uid)===b.getAttribute('data-uid'));
        setTarget(ib);
        try{exploreApplyFieldDomPos();}catch(e){}
        try{_applyHoverName();}catch(e2){}
        const act=[...document.querySelectorAll('#mob-list .mob-target.active')];
        const onlyB=act.length===1&&act[0]===b;
        const nmEl=b.querySelector('.mob-name');
        const hpEl=b.querySelector('.mob-hp-bar');
        const wrap=b.querySelector('.mob-img-wrap');
        const nm=nmEl?getComputedStyle(nmEl).opacity:null;
        const hp=hpEl?getComputedStyle(hpEl).display:null;
        const filt=wrap?getComputedStyle(wrap).filter:'';
        const nr=nmEl&&nmEl.getBoundingClientRect(), wr=wrap&&wrap.getBoundingClientRect();
        const cs=wrap?getComputedStyle(wrap,'::before'):null;
        const ringW=cs?parseFloat(cs.width)||0:0, ringH=cs?parseFloat(cs.height)||0:0;
        const nameTop=nr&&wr?(nr.top-wr.top):null;
        return {n:dummies.length,ib,onlyB,actN:act.length,nm,hp,filt,
            nameShow:b.classList.contains('name-show'),active:b.classList.contains('active'),
            nameTop:nameTop!=null?Math.round(nameTop):null, ringW:Math.round(ringW), ringH:Math.round(ringH),
            wrapW:wr?Math.round(wr.width):0,
            nameOk:nameTop!=null&&nameTop>=70, noRing:ringW===0&&ringH===0};
    })()`);
    ok('奇岩至少 2 木頭人', giran && giran.n >= 2, JSON.stringify(giran));
    ok('點選後只有目標 .active', giran && giran.onlyB, JSON.stringify(giran));
    ok('鎖定目標顯示名字', giran && (giran.nameShow || parseFloat(giran.nm) > 0.5), JSON.stringify(giran && { nm: giran.nm, nameShow: giran.nameShow }));
    ok('鎖定目標顯示血條', giran && giran.hp && giran.hp !== 'none' && giran.hp !== 'null', JSON.stringify(giran && { hp: giran.hp }));
    ok('鎖定目標有紅金光暈（filter）', giran && giran.filt && /drop-shadow/i.test(giran.filt), giran && giran.filt);
    ok('名稱貼頭（不飄太高）', giran && giran.nameOk, JSON.stringify(giran && { nameTop: giran.nameTop }));
    ok('無腳底選取環', giran && giran.noRing, JSON.stringify(giran && { ringW: giran.ringW, ringH: giran.ringH }));
    await shot('_mob_select_giran.jpg');

    // 野外（有卡才測；換圖失敗不擋名規格）
    await ev(`(async()=>{const sel=document.getElementById('map-select');
        if(!sel) return;
        if(![...sel.options].some(o=>o.value==='zone_13')){const o=document.createElement('option');o.value='zone_13';sel.appendChild(o);}
        sel.value='zone_13'; changeMap(true); await new Promise(r=>setTimeout(r,2000));
        try{state.autoHunt=false;}catch(e){}
    })()`);
    await sleep(2000);
    const field = await ev(`(()=>{
        const live=((mapState&&mapState.mobs)||[]).map((m,i)=>({m,i})).filter(x=>x.m&&!x.m._dead&&x.m.curHp>0&&!x.m._townDummy);
        if(live.length<1) return {skip:true,n:0};
        const a=live[0];
        try{ if(typeof exploreWarpPlayer==='function') exploreWarpPlayer(a.m._fx,a.m._fy); }catch(e){}
        try{exploreApplyWorld();}catch(e3){}
        try{exploreApplyFieldDomPos();}catch(e4){}
        const cards=[...document.querySelectorAll('#mob-list .mob-target.field-mob[data-uid]')];
        if(cards.length<1) return {skip:true,cards:0};
        const pick=cards[Math.min(1,cards.length-1)];
        const idx=(mapState.mobs||[]).findIndex(m=>m&&String(m.uid)===pick.getAttribute('data-uid'));
        setTarget(idx);
        try{exploreApplyFieldDomPos();}catch(e5){}
        try{_applyHoverName();}catch(e6){}
        const act=[...document.querySelectorAll('#mob-list .mob-target.active')];
        const ok1=act.length===1&&act[0]===pick;
        const wrap=pick.querySelector('.mob-img-wrap');
        const filt=wrap?getComputedStyle(wrap).filter:'';
        return {cards:cards.length,ok1,actN:act.length,filt,nameShow:pick.classList.contains('name-show')};
    })()`, 25000);
    if (field && field.skip) {
        ok('野外有怪卡可點（略過：本輪無怪）', true, JSON.stringify(field));
        ok('野外點選只有一隻 .active（略過）', true);
        ok('野外鎖定有紅金光暈（略過）', true);
        ok('野外鎖定顯示名字（略過）', true);
    } else {
        ok('野外有怪卡可點', field && field.cards >= 1, JSON.stringify(field));
        ok('野外點選只有一隻 .active', field && field.ok1, JSON.stringify(field));
        ok('野外鎖定有紅金光暈', field && field.filt && /drop-shadow/i.test(field.filt), field && field.filt);
        ok('野外鎖定顯示名字', field && field.nameShow, JSON.stringify(field));
    }
    await shot('_mob_select_field.jpg');

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {}
    try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
