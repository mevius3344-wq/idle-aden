// 實測：AUTO 掛機在原版野外會自己走去找怪、打怪拿經驗；AUTO 關時不自己走
// 用法：node tools/_audit-auto-hunt.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9433);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'ahunt-'));
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
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };

    const stamp = Date.now() % 100000, acct = 'ah' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'ah-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'ah-test', clientId: 'ah-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"') === true) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('掛' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(2500);
    await ev(`(()=>{const s=document.getElementById('map-select');if(![...s.options].some(o=>o.value==='silver_knight')){const o=document.createElement('option');o.value='silver_knight';s.appendChild(o);}s.value='silver_knight';changeMap(true);})()`);
    await sleep(3000);

    const snap = () => ev(`(()=>{const x=explorePlayerX(),y=explorePlayerY();
        const live=(mapState.mobs||[]).filter(m=>m&&!m._dead&&m.curHp>0&&m._fx!=null&&!m._townDummy);
        const d=live.map(m=>Math.hypot(m._fx-x,(m._fy||0)-y)).sort((a,b)=>a-b);
        return {map:mapState.current,auto:state.autoHunt,x:Math.round(x),y:Math.round(y),near:d.length?Math.round(d[0]):-1,exp:player.exp,lv:player.lv,dead:!!player.dead};})()`);
    const s0 = await snap();
    ok('進原版野外 silver_knight、AUTO 預設關', s0.map === 'silver_knight' && s0.auto === false, JSON.stringify(s0));
    await sleep(4000);
    const s1 = await snap();
    ok('AUTO 關：人物不會自己走', s1.x === s0.x && s1.y === s0.y, JSON.stringify({ from: [s0.x, s0.y], to: [s1.x, s1.y] }));

    const b = await ev(`(()=>{const b=document.getElementById('chud-auto');if(!b)return null;const q=b.getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2,w:q.width};})()`);
    ok('AUTO 鈕看得到', b && b.w > 20, JSON.stringify(b));
    if (b) await click(b.x, b.y);
    await sleep(300);
    const s2 = await snap();
    ok('點 AUTO 鈕＝開啟掛機', s2.auto === true, JSON.stringify(s2));
    await sleep(3000);
    const s3 = await snap();
    const moved = Math.hypot(s3.x - s2.x, s3.y - s2.y);
    ok('AUTO 開 3 秒內自己走去找怪（出生點附近沒怪也要走）', moved >= 48, JSON.stringify({ moved: Math.round(moved), near0: s2.near, near1: s3.near }));

    let s4 = s3;
    for (let i = 0; i < 60 && !(s4.exp > s2.exp || s4.lv > s2.lv); i++) { await sleep(1000); s4 = await snap(); }
    ok('AUTO 打到怪拿到經驗（60 秒內）', s4.exp > s2.exp || s4.lv > s2.lv, JSON.stringify(s4));

    await ev(`(()=>{document.getElementById('chud-auto').click();})()`);
    await sleep(1500);
    const s5 = await snap();
    await sleep(3000);
    const s6 = await snap();
    ok('再按 AUTO＝關掉，不再自己走', s5.auto === false && Math.hypot(s6.x - s5.x, s6.y - s5.y) < 48, JSON.stringify({ auto: s5.auto, from: [s5.x, s5.y], to: [s6.x, s6.y] }));

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
