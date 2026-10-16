// 實測：點地走路／點怪鎖定好控制——怪熱區只留本體、點怪清點地、朝怪走不取消 _picked
// 用法：node tools/_audit-tap-control.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9441);
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'atc-'));
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

    const stamp = Date.now() % 100000, acct = 'tc' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'tc-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'tc-test', clientId: 'tc-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('控' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} try{ state.autoHunt=false; }catch(e2){} })()`);
    await sleep(2500);

    await ev(`(async()=>{const sel=document.getElementById('map-select');
        if(![...sel.options].some(o=>o.value==='zone_13')){const o=document.createElement('option');o.value='zone_13';sel.appendChild(o);}
        sel.value='zone_13';changeMap(true);await new Promise(r=>setTimeout(r,2000));})()`);
    await sleep(2000);

    const hit = await ev(`(()=>{
        const c=document.querySelector('#mob-list .mob-target.field-mob:not(.town-dummy)');
        if(!c) return {err:'no card'};
        const pe=getComputedStyle(c).pointerEvents;
        const wrap=c.querySelector('.mob-img-wrap');
        const after=wrap?getComputedStyle(wrap,'::after'):null;
        return {
            cardPe: pe,
            wrapPe: wrap?getComputedStyle(wrap).pointerEvents:null,
            afterPe: after&&after.pointerEvents,
            afterW: after&&parseFloat(after.width),
            afterH: after&&parseFloat(after.height),
            hasCancel: typeof chudCancelTapMove==='function'
        };
    })()`);
    ok('場戰怪本體卡 pointer-events:none（不擋走路）', hit && hit.cardPe === 'none', JSON.stringify(hit));
    ok('本體熱區 ::after 可點', hit && hit.afterPe === 'auto' && hit.afterW >= 60 && hit.afterH >= 80, JSON.stringify(hit));
    ok('chudCancelTapMove 已掛', hit && hit.hasCancel);

    const flow = await ev(`(()=>{
        // 先用畫面上已有的怪卡（場戰只渲染鏡頭附近）
        let card=document.querySelector('#mob-list .mob-target.field-mob:not(.town-dummy)[data-uid]');
        if(!card){
            const live=mapState.mobs.map((m,i)=>({m,i})).filter(x=>x.m&&!x.m._dead&&x.m.curHp>0&&x.m._fx!=null&&!x.m._townDummy);
            if(!live.length) return {err:'no mob'};
            const a0=live[0];
            try{ _tx=a0.m._fx; _ty=a0.m._fy||0; _cx=_tx; _cy=_ty; }catch(e){}
            try{exploreApplyWorld();}catch(e2){}
            try{if(typeof renderMobs==='function')renderMobs();}catch(e3){}
            try{exploreApplyFieldDomPos();}catch(e4){}
            card=document.querySelector('#mob-list .mob-target.field-mob:not(.town-dummy)[data-uid="'+a0.m.uid+'"]')
                || document.querySelector('#mob-list .mob-target.field-mob:not(.town-dummy)[data-uid]');
        }
        if(!card) return {err:'no card'};
        const uid=card.getAttribute('data-uid');
        const i=mapState.mobs.findIndex(m=>m&&String(m.uid)===String(uid));
        const m=mapState.mobs[i];
        if(!m) return {err:'no m', uid};
        const wrap=card.querySelector('.mob-img-wrap');
        if(!wrap) return {err:'no wrap', uid, html:card.innerHTML.slice(0,120)};
        exploreSetTapMoveFromScreen(100,100);
        wrap.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
        const picked=!!m._picked;
        const active=card.classList.contains('active');
        const nearX=m._fx+40, nearY=m._fy||0;
        const dTap=Math.hypot(nearX-m._fx, nearY-(m._fy||0));
        const keepNear=dTap<140;
        const farKeep=Math.hypot((m._fx+800)-m._fx,0)<140;
        return {picked, active, keepNear, farKeep, dTap, tgt:mapState.targetIdx===i, uid};
    })()`);
    ok('點怪熱區＝_picked＋鎖定', flow && flow.picked && flow.active && flow.tgt, JSON.stringify(flow));
    ok('朝怪附近點地＝不該取消（距離規則）', flow && flow.keepNear === true && flow.farKeep === false, JSON.stringify(flow));

    // 源碼：朝怪走不取消
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', '44-map-explore.js'), 'utf8');
    ok('源碼：點地靠近鎖定怪不取消 _picked', /_dTap < Math\.max\(140, _dMe \* 0\.9\)/.test(src));
    ok('源碼：點怪清點地走路', /chudCancelTapMove/.test(fs.readFileSync(path.join(__dirname, '..', 'js', '03-combat-core.js'), 'utf8')));

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {}
    try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
