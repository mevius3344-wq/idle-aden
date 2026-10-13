// 實測：角色 ID 點到才顯示（自己／同圖玩家），點地面收起、點別人換人
// 用法：node tools/_audit-name-tap.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9395;
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'ntap-'));
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
    const tap = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await sleep(400);
    };
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'nt' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'nt-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'nt-test', clientId: 'nt-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('名' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(3000);

    const vis = `(sel)=>{const e=document.querySelector(sel);return !!(e&&getComputedStyle(e).display!=='none'&&e.getClientRects().length);}`;
    const s0 = await ev(`(()=>{const v=${vis};const b=document.querySelector('#player-morph-sprite .pm-body').getBoundingClientRect();
        return {name:v('#player-morph-sprite .pm-name'), text:(document.querySelector('#player-morph-sprite .pm-name')||{}).textContent, bx:Math.round(b.left+b.width/2), by:Math.round(b.top+b.height*0.6)};})()`);
    ok('一開始自己的名字不顯示', s0 && s0.name === false, JSON.stringify(s0));

    await tap(s0.bx, s0.by);
    const s1 = await ev(`(${vis})('#player-morph-sprite .pm-name')`);
    ok('點自己＝顯示自己的名字', s1 === true);
    await shot('_name_tap_self.jpg');

    await tap(s0.bx, s0.by - 200);
    const s2 = await ev(`(${vis})('#player-morph-sprite .pm-name')`);
    ok('點地面＝收起名字', s2 === false);

    // 同圖玩家：塞一個假的同圖玩家精靈（同 class／結構）測點選
    await ev(`(()=>{const bv=document.getElementById('battle-view');
        const el=document.createElement('div');el.className='party-sprite remote-party is-peer';el.setAttribute('data-peer-key','fake:1');
        const pm=document.getElementById('player-morph-sprite');
        el.style.cssText='position:absolute;left:calc('+(pm.style.left||'50%')+' + 120px);bottom:'+(pm.style.bottom||'200px')+';width:60px;height:80px;z-index:50';
        const tag=document.createElement('div');tag.className='remote-party-tag';tag.textContent='別人 Lv.5';
        const hit=document.createElement('div');hit.className='remote-party-hit';hit.style.cssText='position:absolute;inset:0';
        el.append(tag,hit);bv.appendChild(el);})()`);
    const r0 = await ev(`(()=>{const v=${vis};const r=document.querySelector('[data-peer-key="fake:1"] .remote-party-hit').getBoundingClientRect();return {tag:v('[data-peer-key="fake:1"] .remote-party-tag'),x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()`);
    ok('同圖玩家名字一開始不顯示', r0 && r0.tag === false, JSON.stringify(r0));
    await tap(r0.x, r0.y);
    await ev(`(()=>{const m=document.getElementById('peer-menu');if(m)m.classList.add('hidden');})()`);
    const r1 = await ev(`(()=>{const v=${vis};return {tag:v('[data-peer-key="fake:1"] .remote-party-tag'), self:v('#player-morph-sprite .pm-name')};})()`);
    ok('點同圖玩家＝顯示他的名字', r1.tag === true && r1.self === false, JSON.stringify(r1));
    await tap(s0.bx, s0.by);
    const r2 = await ev(`(()=>{const v=${vis};return {tag:v('[data-peer-key="fake:1"] .remote-party-tag'), self:v('#player-morph-sprite .pm-name')};})()`);
    ok('改點自己＝換成自己的名字', r2.tag === false && r2.self === true, JSON.stringify(r2));
    await ev(`(()=>{const e=document.querySelector('[data-peer-key="fake:1"]');if(e)e.remove();})()`);

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
