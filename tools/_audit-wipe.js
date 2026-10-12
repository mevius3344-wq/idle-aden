// 實測：全服洗白—伺服器開機清空玩家資料（留玩家回報／GM 操作紀錄／倍率）、同編號只清一次、清完可正常註冊登入；
// 瀏覽器第一次開遊戲清掉本機舊存檔、之後不再清
// 用法：node tools/_audit-wipe.js（自己起伺服器，PORT 5198）
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPORT = 5198;
const BASE = 'http://localhost:' + SPORT;
const CDP = 9379;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

const srvEpoch = (fs.readFileSync(path.join(ROOT, '_serve.js'), 'utf8').match(/const WIPE_EPOCH = "([^"]+)"/) || [])[1];
const cliEpoch = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/var EPOCH = '([^']+)'/) || [])[1];

function startServer(dir) {
    const env = Object.assign({}, process.env, { PORT: String(SPORT), CLOUD_SAVE_DIR: dir, WIPE_ON_BOOT: '1', DESKTOP_PLAYER_DATA: '0', BACKUP_DAILY: '0' });
    const p = spawn(process.execPath, ['_serve.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d.toString('utf8'); });
    p.stderr.on('data', (d) => { out += d.toString('utf8'); });
    p.getOut = () => out;
    return p;
}
async function waitUp() {
    for (let i = 0; i < 80; i++) {
        await sleep(250);
        try { const r = await fetch(BASE + '/api/version'); if (r.ok) return true; } catch (e) {}
    }
    return false;
}
async function stopServer(p) {
    p.kill();
    for (let i = 0; i < 40; i++) { await sleep(150); try { await fetch(BASE + '/api/version'); } catch (e) { return; } }
}
const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

(async () => {
    ok(srvEpoch && srvEpoch === cliEpoch, 'server WIPE_EPOCH == index.html EPOCH (' + srvEpoch + ')');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wipe-'));
    const wipeFiles = ['accounts.json', 'char-names.json', 'account-sessions.json', 'parties.json', 'clans.json', 'auction.json',
        'gm-trade-log.json', 'trades.json', 'field-bosses.json', 'gm-mail.json'];
    const keepFiles = ['client-log.json', 'gm-audit.json', 'gm-rates.json'];
    for (const f of wipeFiles.concat(keepFiles)) fs.writeFileSync(path.join(dir, f), JSON.stringify({ old: f }));
    fs.mkdirSync(path.join(dir, 'oldplayer'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'oldplayer', 'slot-1.json'), JSON.stringify({ name: 'old' }));
    fs.mkdirSync(path.join(dir, '.backups'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.backups', 'b.json.gz'), 'x');

    let srv = startServer(dir);
    ok(await waitUp(), 'server 1 up');
    for (const f of wipeFiles) {
        let gone = !fs.existsSync(path.join(dir, f));
        if (!gone) { try { gone = !JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).old; } catch (e) { gone = true; } }
        ok(gone, 'wiped ' + f);
    }
    ok(!fs.existsSync(path.join(dir, 'oldplayer')), 'wiped account save dir');
    ok(!fs.existsSync(path.join(dir, '.backups', 'b.json.gz')), 'wiped .backups');
    for (const f of keepFiles) {
        let kept = false;
        try { kept = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).old === f; } catch (e) {}
        ok(kept, 'kept ' + f);
    }
    ok(fs.readFileSync(path.join(dir, 'wipe-epoch.txt'), 'utf8').trim() === srvEpoch, 'marker written');
    ok(/WIPE /.test(srv.getOut()), 'wipe logged');

    const acct = 'wp' + (Date.now() % 100000);
    const rr = await pj('/api/accounts/register', { account: acct, password: 'wp-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'wp-test', clientId: 'wp-' + acct });
    ok(rr && rr.ok !== false && lr && lr.authToken, 'register+login after wipe');
    const oldLogin = await pj('/api/accounts/login', { account: 'oldplayer', password: 'x', clientId: 'wp-old' });
    ok(!oldLogin || !oldLogin.authToken, 'old account gone');
    await stopServer(srv);

    srv = startServer(dir);
    ok(await waitUp(), 'server 2 up');
    ok(!/WIPE /.test(srv.getOut()), 'second boot does not wipe again');
    const lr2 = await pj('/api/accounts/login', { account: acct, password: 'wp-test', clientId: 'wp2-' + acct, takeover: true });
    ok(lr2 && lr2.authToken, 'new account survives restart');

    // 瀏覽器本機舊存檔
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'wpb-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + CDP, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    await send('Page.enable'); await send('Runtime.enable');
    const nav = async (url) => { await send('Page.navigate', { url }); await sleep(2500); };

    await nav(BASE + '/robots.txt');
    await ev("localStorage.clear();localStorage.setItem('fb5_save_slot_1','{\"old\":1}');localStorage.setItem('fb5AuthAccount','oldplayer');sessionStorage.setItem('s','1');true");
    await nav(BASE + '/');
    const a = await ev("JSON.stringify({n:localStorage.length,ep:localStorage.getItem('gameWipeEpoch'),save:localStorage.getItem('fb5_save_slot_1'),acc:localStorage.getItem('fb5AuthAccount'),s:sessionStorage.getItem('s')})");
    const ja = JSON.parse(a || '{}');
    ok(ja.ep === cliEpoch && ja.save === null && ja.acc === null && ja.s === null, 'browser old local saves cleared ' + a);
    ok(!!(await ev("!!document.getElementById('auth-overlay')||!!document.querySelector('input')")), 'login page renders after clear');
    await ev("localStorage.setItem('fb5_save_slot_1','{\"new\":1}');true");
    await nav(BASE + '/');
    ok((await ev("localStorage.getItem('fb5_save_slot_1')")) === '{"new":1}', 'second open keeps new local save');

    ws.close(); br.kill();
    await stopServer(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('ERR ' + e.message); process.exit(2); });
