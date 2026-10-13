// 實測：同 IP 新登入擠掉舊視窗（電腦＋手機同一網路不會卡在登入）
// 用法：node tools/_audit-ip-takeover.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, data: await r.json() }));

async function browser(port, W, H, mob) {
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'ipto-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = []; const alerts = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]); }
        if (m.method === 'Runtime.consoleAPICalled' && m.params.args[0] && /^ALERT /.test(m.params.args[0].value || '')) alerts.push(m.params.args[0].value.slice(6));
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mob });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(m){console.log("ALERT "+m)};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&!!document.getElementById("btn-auth-login")')) break; }
    await sleep(1500);
    return { br, ws, ev, errors, alerts };
}
const login = (b, acct, pw) => b.ev(`(()=>{const a=document.getElementById('auth-account'),p=document.getElementById('auth-password');a.value=${JSON.stringify(acct)};p.value=${JSON.stringify(pw)};
    a.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('btn-auth-login').click();})()`);
const view = (b) => b.ev(`(()=>{const v=(s)=>{const e=document.querySelector(s);if(!e)return false;const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&e.getBoundingClientRect().width>0};
    return {auth:v('#account-auth-panel'),menu:v('#main-menu'),game:v('#game-screen'),held:!!(window.IpSessionLimit&&IpSessionLimit.isHeld()),status:(document.getElementById('auth-status')||{}).textContent||'',
      running:typeof state!=='undefined'&&!!state&&!!state.running};})()`);

(async () => {
    const st = Date.now() % 100000;
    const A = 'ipa' + st, B = 'ipb' + st, PW = 'ipto-pass';
    await pj('/api/accounts/register', { account: A, password: PW });
    await pj('/api/accounts/register', { account: B, password: PW });

    const pc = await browser(9351, 1920, 1080, false);
    await login(pc, A, PW);
    await sleep(5000);
    let v = await view(pc);
    ok(v.menu && v.held, '電腦先登入成功並佔到名額 ' + JSON.stringify({ menu: v.menu, held: v.held }));
    await pc.ev(`(async()=>{currentSlot=1;curCreate.rawCls='m_knight';curCreate.cls='knight';document.getElementById('create-name-input').value='擠'+${st};startGame();})()`);
    await sleep(6000);
    v = await view(pc);
    ok(v.game, '電腦進入遊戲');

    const ph = await browser(9353, 412, 892, true);
    await login(ph, B, PW);
    await sleep(5000);
    v = await view(ph);
    ok(v.menu && !v.auth && v.held, '手機（同 IP）登入不會卡住：直接進選單 ' + JSON.stringify({ menu: v.menu, auth: v.auth, held: v.held, status: v.status }));

    await sleep(14000);
    v = await view(pc);
    ok(v.auth && !v.game && !v.held, '電腦被擠下線：回登入畫面、遊戲收起 ' + JSON.stringify({ auth: v.auth, game: v.game, held: v.held }));
    ok(!v.running, '電腦遊戲已停止（不在背景繼續跑）');
    ok(/另一個裝置/.test(v.status) && pc.alerts.some((a) => /另一個裝置/.test(a)), '電腦顯示原因（同一網路的另一個裝置已登入）');

    await sleep(14000);
    v = await view(ph);
    ok(v.held && !v.auth, '手機名額穩定（舊視窗沒有自動搶回）');

    const hb = await pj('/api/session/heartbeat', { clientId: await pc.ev('IpSessionLimit.getClientId()') });
    ok(hb.status === 429 && hb.data.error === 'taken_over', '被擠掉的視窗心跳回 taken_over，不重新佔位');
    const bg = await pj('/api/session/claim', { clientId: 'c_bgclaim_' + st });
    ok(bg.status === 429, '背景佔位（無 takeover）仍受同 IP 1 個限制');

    // 電腦再按登入 → 擠回來
    await login(pc, A, PW);
    await sleep(5000);
    v = await view(pc);
    ok(v.menu && v.held, '電腦再登入可擠回來');
    await sleep(14000);
    v = await view(ph);
    ok(v.auth && !v.held, '手機這次被擠下線');

    // 同一帳號：電腦在遊戲中，手機登入同帳號 → 開始遊戲 → 進入角色；電腦被擠下線且不自動搶回
    await pc.ev(`document.getElementById('btn-start-menu').click()`);
    await sleep(3000);
    await pc.ev(`loadEnterSelected()`);
    await sleep(8000);
    await pc.ev(`(async()=>{try{saveGame()}catch(e){} try{ if(window.cloudFlushLocalToCloud) await window.cloudFlushLocalToCloud(); }catch(e){}})()`);
    await sleep(12000);
    v = await view(pc);
    ok(v.game, '[同帳號] 電腦用 A 帳號在遊戲中');
    const pcAlert0 = pc.alerts.length;
    await login(ph, A, PW);
    await sleep(5000);
    v = await view(ph);
    ok(v.menu && !v.auth, '[同帳號] 手機登入同一帳號不會被拒（不卡在登入）' + JSON.stringify({ menu: v.menu, auth: v.auth, status: v.status }));
    await ph.ev(`document.getElementById('btn-start-menu').click()`);
    await sleep(4000);
    const hasChar = await ph.ev(`!!slotSummary(1)`);
    ok(hasChar, '[同帳號] 手機選角看得到角色');
    await ph.ev(`loadEnterSelected()`);
    await sleep(8000);
    v = await view(ph);
    ok(v.game, '[同帳號] 手機按開始遊戲 → 進入角色（不卡住）');
    await sleep(12000);
    v = await view(pc);
    const pcLoad = await pc.ev(`(()=>{const e=document.getElementById('load-select-panel');return !!e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none';})()`);
    ok(v.auth && !v.game && !pcLoad, '[同帳號] 電腦被擠下線：只剩登入畫面（不停在選角）' + JSON.stringify({ auth: v.auth, game: v.game, load: pcLoad }));
    ok(pc.alerts.slice(pcAlert0).some((a) => /此帳號已在另一個裝置登入|同一網路的另一個裝置已登入/.test(a)), '[同帳號] 電腦顯示原因（另一個裝置已登入）');
    await sleep(15000);
    v = await view(ph);
    const pv = await view(pc);
    ok(v.game && pv.auth, '[同帳號] 不互踢：手機仍在遊戲、電腦沒有自動重登搶回');

    ok(pc.errors.length === 0 && ph.errors.length === 0, 'JS 例外：' + [...pc.errors, ...ph.errors].slice(0, 3).join(' | '));
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    for (const b of [pc, ph]) { try { b.ws.close(); b.br.kill(); } catch (e) {} }
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
