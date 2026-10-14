// 實測：存檔不回溯——花錢／賺錢／用道具／死亡扣經驗都照存；換工作階段需源自最新版本；被擠掉的舊裝置寫不進來；沒有 409
// 用法：node tools/_audit-save-rollback.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9611;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};
const pj = (u, b, m) => fetch(BASE + u, { method: m || 'POST', headers: { 'Content-Type': 'application/json' }, body: b == null ? undefined : JSON.stringify(b) })
    .then(async (r) => ({ st: r.status, j: await r.json().catch(() => null) }));
const cloudP = async (acct, slot) => { const g = await pj('/api/cloud/' + acct + '/slot/' + slot, null, 'GET'); return g.j && g.j.data && g.j.data.p; };

async function apiPart() {
    console.log('— 伺服器收檔規則');
    const acct = 'rbk' + (Date.now() % 1000000), pwd = 'rb-test1';
    await pj('/api/accounts/register', { account: acct, password: pwd });
    const l1 = await pj('/api/accounts/login', { account: acct, password: pwd, clientId: 'a-' + acct });
    const name = '溯' + (Date.now() % 10000);
    const mk = (o) => { const s = { p: Object.assign({ cls: 'knight', name, lv: 12, exp: 3000, gold: 5000, inv: [{ id: 'potion_red', cnt: 20 }], enSeed: 'es' + acct, hp: 100, mhp: 100, mp: 10, mmp: 10, base: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, int: 8 }, cloudOwner: acct }, o) }; s.savedAt = s.p.savedAt; return s; };
    const put = (tok, o) => pj('/api/cloud/' + acct + '/slot/1', { save: mk(o), account: acct, authToken: tok }, 'PUT');
    const t = Date.now();
    let r = await put(l1.j.authToken, { savedAt: t - 10000 });
    ok('首次上傳', r.st === 200 && r.j.rev === 1, JSON.stringify(r.j && { rev: r.j.rev }));
    r = await put(l1.j.authToken, { gold: 4000, savedAt: t - 9000 });
    let p = await cloudP(acct, 1);
    ok('花錢（金幣變少）照存', r.st === 200 && p.gold === 4000, r.st + ' gold=' + p.gold);
    r = await put(l1.j.authToken, { gold: 6500, exp: 3100, savedAt: t - 8000 });
    p = await cloudP(acct, 1);
    ok('賺錢不被夾回', r.st === 200 && p.gold === 6500 && p.exp === 3100, 'gold=' + p.gold);
    r = await put(l1.j.authToken, { gold: 6500, exp: 3100, inv: [{ id: 'potion_red', cnt: 8 }], savedAt: t - 7000 });
    p = await cloudP(acct, 1);
    ok('用掉道具照存', r.st === 200 && p.inv[0].cnt === 8, 'cnt=' + p.inv[0].cnt);
    r = await put(l1.j.authToken, { gold: 6500, exp: 2800, inv: [{ id: 'potion_red', cnt: 8 }], savedAt: t - 6000 });
    p = await cloudP(acct, 1);
    ok('死亡扣經驗照存', r.st === 200 && p.exp === 2800, 'exp=' + p.exp);
    r = await put(l1.j.authToken, { exp: 9000, gold: 99999, savedAt: t - 20000 });
    p = await cloudP(acct, 1);
    ok('同一工作階段晚到的舊存檔被擋', r.st === 409 && r.j.error === 'stale_save' && p.exp === 2800, r.st + ' exp=' + p.exp);
    const rev = p.srvRev;
    // 重登（新工作階段，同裝置）：帶目前版本號 → 收
    const l2 = await pj('/api/accounts/login', { account: acct, password: pwd, clientId: 'a-' + acct, takeover: true });
    r = await put(l2.j.authToken, { gold: 6000, exp: 2800, srvRev: rev, savedAt: t - 5000 });
    p = await cloudP(acct, 1);
    ok('重登後源自最新版本的存檔照收（含花錢）', r.st === 200 && p.gold === 6000, r.st + ' gold=' + p.gold + ' rev=' + p.srvRev);
    // 另一台裝置拿舊版本（較高經驗）來蓋 → 擋
    const l3 = await pj('/api/accounts/login', { account: acct, password: pwd, clientId: 'b-' + acct, takeover: true });
    r = await put(l3.j.authToken, { gold: 99999, exp: 3100, srvRev: rev - 2, savedAt: Date.now() });
    p = await cloudP(acct, 1);
    ok('舊版本存檔（換裝置）不能蓋掉新進度', r.st === 409 && p.gold === 6000, r.st + ' gold=' + p.gold);
    r = await put(l2.j.authToken, { gold: 1, srvRev: p.srvRev, savedAt: Date.now() });
    p = await cloudP(acct, 1);
    ok('被擠掉的舊裝置寫不進來', r.st === 401 && p.gold === 6000, r.st + ' gold=' + p.gold);
    const es = await pj('/api/econ/status', null, 'GET');
    ok('檔案模式經濟權威回報關閉（倉庫照常同步）', es.st === 200 && es.j && es.j.econAuth === false, JSON.stringify(es.j));
    ok('雲端只存工作階段雜湊', /^[0-9a-f]{16}$/.test(String(p.srvSid || '')), String(p.srvSid));
}

async function browserPart() {
    console.log('— 遊戲內（花錢→重登、死亡關頁→重登、舊裝置）');
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((q) => fs.existsSync(q));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'rbk-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((x) => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const exc = []; const statuses = [];
    const reqUrl = new Map();
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; exc.push(String((d.exception && d.exception.description) || d.text).split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber); }
        if (m.method === 'Network.requestWillBeSent') reqUrl.set(m.params.requestId, m.params.request.method + ' ' + m.params.request.url);
        if (m.method === 'Network.responseReceived') { const u = reqUrl.get(m.params.requestId) || ''; if (/^PUT .*\/slot\//.test(u)) statuses.push(m.params.response.status); }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const stamp = Date.now() % 100000, acct = 'rbg' + stamp, pwd = 'rbg-test';
    await pj('/api/accounts/register', { account: acct, password: pwd });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12")}catch(e){};window.__DEV_OFFLINE=false;window.alert=function(){};window.confirm=function(){return true};' });
    // 照玩家流程：開頁 → 登入框登入（登入同步雲端）；wipeLocal＝模擬另一台裝置（本機沒有存檔）
    const boot = async (wipeLocal) => {
        await send('Page.navigate', { url: BASE + '/' });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof loadGame==="function"&&typeof openLoadSelect==="function"&&document.readyState==="complete"') === true) break; }
        await sleep(1000);
        // 本機桌面玩家資料夾（只在 localhost 開）是本機所有測試共用的，關掉免得互相灌存檔
        await ev(`(()=>{['desktopPullBeforeLoad','desktopMirrorAfterSave','desktopPullSlotIntoStorage','desktopPushSlot'].forEach(n=>{window[n]=function(){return false}});return 1})()`);
        if (wipeLocal) await ev(`(()=>{for(let s=1;s<=8;s++){localStorage.removeItem('lineage_idle_save_'+s);localStorage.removeItem('lineage_idle_save_'+s+'_bak');}return 1})()`);
        await ev(`(()=>{document.getElementById('auth-account').value=${JSON.stringify(acct)};document.getElementById('auth-password').value=${JSON.stringify(pwd)};document.getElementById('btn-auth-login').click();return 1})()`);
        for (let i = 0; i < 40; i++) { await sleep(500); if (await ev('!!window.__fb5AuthAccount && !window.__DEV_OFFLINE && cloudCanSync()') === true) break; }
        await sleep(2500);
    };
    await boot(false);
    const slot = await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('溯' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} return slot; })()`);
    let c0 = null;
    for (let i = 0; i < 20 && !(c0 && c0.cls); i++) { await sleep(500); c0 = await cloudP(acct, slot); }
    ok('創角已上雲', !!(c0 && c0.cls === 'knight'), c0 ? 'gold=' + c0.gold + ' rev=' + c0.srvRev : 'none');
    const g0 = await ev('player.gold');
    await ev('player.gold = player.gold + 5000; saveGame(); 1');
    await sleep(1500);
    await ev('player.gold = player.gold - 1234; saveGame(); 1');
    await sleep(1500);
    let c = await cloudP(acct, slot);
    ok('城裡花錢後雲端金幣照存', c && c.gold === g0 + 5000 - 1234, 'cloud=' + (c && c.gold) + ' expect=' + (g0 + 3766));
    const potN = (inv) => (inv || []).filter((it) => it && it.id === 'potion_heal').reduce((s, it) => s + (Number(it.cnt) || 1), 0);
    const pot0 = potN(c && c.inv);
    const exp1 = await ev(`(()=>{player.exp=(player.exp||0)+40; invAddOrStack({id:'potion_heal',cnt:7,uid:uid()}); saveGame(); return player.exp})()`);
    await sleep(1500);
    c = await cloudP(acct, slot);
    ok('打怪經驗＋撿到道具照存', c && c.exp === exp1 && potN(c.inv) === pot0 + 7, 'exp=' + (c && c.exp) + ' 紅水 ' + pot0 + '→' + potN(c && c.inv));
    const memRev = await ev('player.srvRev');
    ok('執行中角色記住伺服器版本號', memRev === c.srvRev, memRev + ' / ' + c.srvRev);

    // 死亡（扣經驗）沒按重新開始就關頁 → 換裝置重登：死前進度在、人在主城
    await ev(`(()=>{const s=document.getElementById('map-select');if(![...s.options].some(o=>o.value==='silver_knight')){const o=document.createElement('option');o.value='silver_knight';s.appendChild(o);}s.value='silver_knight';changeMap(true);return 1})()`);
    await sleep(2500);
    const before = await ev('({gold:player.gold, exp:player.exp})');
    await ev('player.gold = player.gold - 111; killPlayer(); player.exp = Math.max(0, player.exp - 15); 1');
    await sleep(800);
    const dead = await ev('({dead:!!player.dead, gold:player.gold, exp:player.exp})');
    await ev('_flushSaveNow(); 1');
    await sleep(1500);
    c = await cloudP(acct, slot);
    const cms = c && (await pj('/api/cloud/' + acct + '/slot/' + slot, null, 'GET')).j.data.ms;
    ok('倒地關頁：死前花費／扣經驗已上雲（存成回村 1 血）', c && c.gold === dead.gold && c.exp === dead.exp && !c.dead && c.hp === 1 && cms && cms.current === 'town_giran',
        JSON.stringify({ before, dead, cloud: c && { gold: c.gold, exp: c.exp, hp: c.hp, dead: c.dead, map: cms && cms.current } }));
    ok('倒地關頁後本頁仍倒在原地', await ev('!!player.dead && mapState.current === "silver_knight"') === true);

    await boot(true);
    await ev(`(()=>{ currentSlot=${slot}; loadGame(); return 1; })()`);
    await sleep(3500);
    const after = await ev('({map:mapState.current, dead:!!player.dead, hp:player.hp, mhp:player.mhp, gold:player.gold, exp:player.exp})');
    ok('換裝置重登：金幣／經驗＝死亡當下（無回溯）', after.gold === dead.gold && after.exp === dead.exp, JSON.stringify(after));
    ok('換裝置重登：在主城甦醒、非死亡', after.map === 'town_giran' && !after.dead && after.hp >= 1, JSON.stringify(after));
    await ev('player.gold = player.gold - 50; saveGame(); 1');
    await sleep(1500);
    c = await cloudP(acct, slot);
    ok('重登後再花錢照存', c && c.gold === after.gold - 50, 'cloud=' + (c && c.gold));

    // 另一台裝置登入擠掉本頁 → 本頁之後存檔寫不進雲端
    const keep = c.gold;
    await pj('/api/accounts/login', { account: acct, password: pwd, clientId: 'other-' + acct, takeover: true });
    await ev('player.gold = 1; try{ saveGame(); }catch(e){} 1');
    await sleep(1500);
    c = await cloudP(acct, slot);
    ok('被擠掉的舊頁面不能蓋掉雲端', c && c.gold === keep, 'cloud=' + (c && c.gold));
    const n409 = statuses.filter((s) => s === 409).length;
    ok('全程沒有 409（不會改用舊雲端）', n409 === 0, 'PUT 狀態: ' + statuses.join(','));
    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
}

(async () => {
    await apiPart();
    await browserPart();
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
