// 實測：登入 → 按「開始遊戲」（真實滑鼠／觸控點擊）→ 選角出現 → 創角／進入遊戲
// 用法：node tools/_audit-start-menu.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

async function browser(port, W, H, mob, slow) {
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = []; const logs = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').split('\n').slice(0, 3).join(' / ')); }
        if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 300));
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description }; return r.result && r.result.result ? r.result.result.value : undefined; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mob });
    if (mob) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(m){console.log("ALERT "+m)};window.confirm=function(){return true};window.__DEV_OFFLINE=false;' });
    if (slow) {
        // 慢網路＋無快取（改版後第一次開）：登入框先出現，後面遊戲腳本還在下載
        await send('Network.enable');
        await send('Network.setCacheDisabled', { cacheDisabled: true });
        await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 });
    }
    await send('Page.navigate', { url: BASE + '/' });
    if (slow) {
        for (let i = 0; i < 480; i++) { await sleep(250); if (await ev('!!document.getElementById("btn-auth-login")&&!!window.GameAccountAuth')) break; }
    } else {
        for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('!!document.getElementById("btn-auth-login")&&document.readyState==="complete"')) break; }
        await sleep(1500);
    }
    const unthrottle = () => send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    // 真實點擊：滑鼠或觸控，打到畫面上真正最上層的元素
    const realClick = async (sel) => {
        const box = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;try{e.scrollIntoView({block:'center'})}catch(eS){}const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);
            return {x,y,w:r.width,h:r.height,top:top?(top.id||top.tagName)+'.'+String(top.className||'').slice(0,60):null,hit:!!top&&(top===e||e.contains(top))};})()`);
        if (!box || !box.w) return box;
        if (mob) {
            await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
            await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
        }
        return box;
    };
    return { br, ws, ev, errors, logs, realClick, unthrottle };
}
const vis = (b, sel) => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&e.getBoundingClientRect().width>0;})()`);

async function run(label, port, W, H, mob, acct, PW, mode, slow) {
    const b = await browser(port, W, H, mob, slow);
    await b.ev(`(()=>{const a=document.getElementById('auth-account'),p=document.getElementById('auth-password');a.value=${JSON.stringify(acct)};p.value=${JSON.stringify(PW)};
        a.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    if (slow) {
        ok(await b.ev('document.readyState') === 'loading' && await b.ev('typeof openLoadSelect') !== 'function', `[${label}] 登入框出現時遊戲腳本仍在下載`);
        await sleep(1500);
        const ui = await b.ev(`(()=>{const bar=document.getElementById('auth-load-bar');const bt=document.getElementById('btn-auth-login');return {bar:bar?bar.textContent:null,dis:bt.disabled,lbl:bt.textContent,status:document.getElementById('auth-status').textContent}})()`);
        ok(ui.bar && /下載中 \d+%/.test(ui.bar), `[${label}] 登入框顯示下載進度條（${ui.bar}）`);
        ok(ui.dis && /下載中 \d+%/.test(ui.lbl), `[${label}] 下載中登入鈕鎖住並顯示百分比（${ui.lbl}）`);
        await b.ev(`(()=>{const p=document.getElementById('auth-password');p.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
        await sleep(800);
        ok(!(await vis(b, '#main-menu')), `[${label}] 下載中按 Enter 不會登入（不會停在按了沒反應的開始遊戲）`);
        const pcts = [];
        let ready = false;
        for (let i = 0; i < 720 && !ready; i++) {
            await sleep(250);
            ready = await b.ev(`!document.getElementById('btn-auth-login').disabled`);
            if (i % 20 === 0) pcts.push(await b.ev(`(document.getElementById('auth-load-bar')||{}).textContent||''`));
        }
        console.log('  progress', pcts.map((t) => (t.match(/\d+%/) || [''])[0]).join(' '));
        ok(ready && await b.ev(`!document.getElementById('auth-load-bar')&&document.getElementById('btn-auth-login').textContent==='登入'&&typeof openLoadSelect==='function'`), `[${label}] 下載完：進度條消失、登入鈕恢復`);
        await b.unthrottle();
        await b.realClick('#btn-auth-login');
    } else {
        await b.realClick('#btn-auth-login');
    }
    for (let i = 0; i < 40; i++) { await sleep(500); if (await vis(b, '#main-menu')) break; }
    await sleep(2500);
    ok(await vis(b, '#main-menu'), `[${label}] 登入後看到主選單`);
    if (!(await vis(b, '#main-menu'))) console.log('  auth-status:', await b.ev(`document.getElementById('auth-status').textContent`), b.logs.slice(-6).join(' || '));
    const box = await b.realClick('#btn-start-menu');
    console.log(`  [${label}] 開始遊戲按鈕 ` + JSON.stringify(box));
    let loadOn = false;
    for (let i = 0; i < 20 && !loadOn; i++) { await sleep(250); loadOn = await vis(b, '#load-select-panel'); }
    ok(loadOn, `[${label}] 按「開始遊戲」→ 選角畫面出現`);
    if (slow) {
        let sum = null;
        for (let i = 0; i < 40 && !sum; i++) { await sleep(500); sum = await b.ev(`(()=>{const s=typeof slotSummary==='function'&&slotSummary(1);return s?s.name:null})()`); }
        ok(!!sum, `[${label}] 雲端角色有同步進選角（${sum}）`);
        try { await b.ev('renderLoadSelect()'); } catch (e) {}
        await sleep(500);
    }
    if (!loadOn) {
        console.log('  state:', JSON.stringify(await b.ev(`(()=>({openLoadSelect:typeof openLoadSelect,main:!document.getElementById('main-menu').classList.contains('hidden'),load:document.getElementById('load-select-panel')&&document.getElementById('load-select-panel').className,cs:document.getElementById('creation-screen')&&document.getElementById('creation-screen').className}))()`)));
    }
    await sleep(1500);
    ok(await vis(b, '#load-select-panel'), `[${label}] 選角畫面 1.5 秒後仍在（沒被收回）`);
    if (mode === 'create') {
        // 空格 → 創新角色 → 創角面板 → 騎士＋名字 → 開始遊戲
        await b.realClick('#load-btn-create');
        for (let i = 0; i < 20; i++) { await sleep(400); if (await vis(b, '#creation-panel')) break; }
        ok(await vis(b, '#creation-panel'), `[${label}] 創新角色 → 創角面板`);
        await b.realClick('#btn-class-base-knight');
        await sleep(500);
        await b.ev(`(()=>{const i=document.getElementById('create-name-input');i.value='測'+(Date.now()%100000);i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await sleep(500);
        const dis = await b.ev(`document.getElementById('btn-start').disabled`);
        if (dis) await b.ev(`(()=>{const s=document.getElementById('btn-start');s.disabled=false;})()`);
        const sb = await b.realClick('#btn-start');
        console.log(`  [${label}] 創角開始鈕 ` + JSON.stringify(sb) + ' vh=' + H);
        if (sb && !sb.hit) console.log('  chain', JSON.stringify(await b.ev(`(()=>{const o=[];let e=document.getElementById('btn-start');while(e&&o.length<10){const c=getComputedStyle(e);const r=e.getBoundingClientRect();o.push((e.id||e.tagName)+'.'+String(e.className).slice(0,30)+' t'+Math.round(r.top)+' b'+Math.round(r.bottom)+' ov'+c.overflowY+' pos'+c.position+' z'+c.zIndex+' pe'+c.pointerEvents+' sh'+e.scrollHeight+' ch'+e.clientHeight);e=e.parentElement}return o})()`)));
    } else {
        await b.realClick('#load-btn-enter');
    }
    let inGame = false;
    for (let i = 0; i < 60 && !inGame; i++) { await sleep(500); inGame = await vis(b, '#game-screen'); }
    await sleep(2000);
    const st = await b.ev(`(()=>({game:!document.getElementById('game-screen').classList.contains('hidden'),running:typeof state!=='undefined'&&!!state&&!!state.running,name:typeof player!=='undefined'&&player?player.name:null}))()`);
    ok(inGame && st && st.running, `[${label}] 進入遊戲 ` + JSON.stringify(st));
    ok(b.errors.length === 0, `[${label}] JS 例外：` + b.errors.slice(0, 4).join(' | '));
    if (fails.length) console.log(b.logs.filter((l) => /^(error|warning)|ALERT/.test(l)).slice(-15).join('\n'));
    try { b.ws.close(); b.br.kill(); } catch (e) {}
}

(async () => {
    const st = Date.now() % 100000;
    const A = 'stm' + st, B = 'stn' + st, PW = 'stm-pass1';
    if (process.env.ONLY) {
        const [acc, mode, mob, slow] = process.env.ONLY.split(',');
        await run('only', 9366, mob === '1' ? 412 : 1920, mob === '1' ? 892 : 1080, mob === '1', acc, PW, mode, slow === '1');
        console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
        process.exit(fails.length ? 1 : 0);
    }
    console.log('register', (await pj('/api/accounts/register', { account: A, password: PW })).status, (await pj('/api/accounts/register', { account: B, password: PW })).status);
    await run('電腦 創角', 9361, 1920, 1080, false, A, PW, 'create');
    await sleep(3000);
    await run('電腦 進入', 9362, 1920, 1080, false, A, PW, 'enter');
    await sleep(3000);
    await run('手機 創角', 9363, 412, 892, true, B, PW, 'create');
    await sleep(3000);
    await run('手機 進入', 9364, 412, 892, true, B, PW, 'enter');
    await sleep(3000);
    await run('手機 慢網路 載入中登入', 9365, 412, 892, true, B, PW, 'enter', true);
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
