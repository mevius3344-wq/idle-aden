// 重現：本機存檔較新但金幣較少（城裡花錢）→ 伺服器 409 stale_save → 舊碼無限同步 GET↔PUT 卡死
// 用法：node tools/_audit-stale-loop.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9391;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const acct = 'sl' + (Date.now() % 1000000); const pwd = 'sltest123';
    const pj = (u, b, m) => fetch(BASE + u, { method: m || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ st: r.status, j: await r.json().catch(() => null) }));
    await pj('/api/accounts/register', { account: acct, password: pwd });
    const lr = await pj('/api/accounts/login', { account: acct, password: pwd, clientId: 'seed-' + acct });
    const save = { p: { cls: 'knight', name: '', lv: 12, exp: 3000, gold: 0, inv: [{ id: 'potion_red', cnt: 20 }], enSeed: 'es' + acct, hp: 100, mhp: 100, mp: 10, mmp: 10, base: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, int: 8 } } };
    save.cloudOwner = acct; save.p.cloudOwner = acct; save.p.name = '迴' + (Date.now() % 10000);
    save.p.gold = 5000; save.p.savedAt = Date.now() - 600000; save.savedAt = save.p.savedAt;
    console.log('upload', (await pj('/api/cloud/' + acct + '/slot/1', { save, account: acct, authToken: lr.j.authToken }, 'PUT')).st);
    await pj('/api/accounts/logout', { account: acct, authToken: lr.j.authToken }).catch(() => {});
    const local = JSON.parse(JSON.stringify(save)); local.p.gold = 4500; local.p.savedAt = Date.now() - 60000; local.savedAt = local.p.savedAt;

    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); let puts = 0, gets = 0;
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Network.requestWillBeSent' && /\/slot\/1/.test(m.params.request.url)) { if (m.params.request.method === 'PUT') puts++; else gets++; }
        if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr, ms) => {
        const p = send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).then((r) => r.result && r.result.result ? r.result.result.value : 'ERR');
        return Promise.race([p, sleep(ms || 3000).then(() => 'TIMEOUT(凍住)')]);
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 411, height: 832, deviceScaleFactor: 2.625, mobile: true });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof _saveWrap==="function"&&typeof openLoadSelect==="function"&&document.readyState==="complete"') === true) break; }
    await sleep(1500);
    console.log('seed local', await ev(`(()=>{localStorage.setItem('lineage_idle_save_1', _saveWrap(${JSON.stringify(JSON.stringify(local))}));return 1})()`));
    await ev(`(()=>{document.getElementById('auth-account').value=${JSON.stringify(acct)};document.getElementById('auth-password').value=${JSON.stringify(pwd)};document.getElementById('btn-auth-login').click();return 1})()`);
    const t0 = Date.now(); let frozen = 0;
    for (let i = 0; i < 15; i++) {
        await sleep(1000);
        const s = await ev('JSON.stringify({m:!document.getElementById("main-menu").classList.contains("hidden"),acc:window.__fb5AuthAccount||""})');
        if (String(s).startsWith('TIMEOUT')) frozen++;
        console.log('t+' + Math.round((Date.now() - t0) / 1000) + 's ' + s + ' PUT=' + puts + ' GET=' + gets);
    }
    const g = await ev(`(()=>{try{invalidateSlotSummary(null);const s=slotSummary(1);return s?('gold '+JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_1')).payload).p.gold):'none'}catch(e){return 'err '+e.message}})()`);
    console.log('local after', g);
    const pass = !frozen && puts <= 3 && /gold 5000/.test(String(g));
    console.log(pass ? 'PASS' : 'FAIL frozen=' + frozen + ' PUT=' + puts);
    try { ws.close(); } catch (e) {} try { br.kill(); } catch (e) {}
    process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
