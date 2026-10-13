// 實測：新手禮包 200%經驗藥水（創角送 10 瓶、喝下 exp2=1800 秒、玩家經驗 ×2、圖示載入、不可賣）
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-exp-potion.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9373;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'expp-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
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
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; console.log('EVAL_ERR ' + asc(String((d.exception && d.exception.description) || d.text).split('\n')[0])); }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    const stamp = Date.now() % 100000;
    const acct = 'expp' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'expp-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'expp-test', clientId: 'expp-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof expPotionMult==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('經' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);

    const r = await ev(`(async()=>{
        const out={};
        const it=player.inv.filter(i=>i.id==='potion_exp2');
        out.count=it.reduce((a,i)=>a+(i.cnt||i.qty||i.n||1),0);
        out.raw=it.map(i=>JSON.stringify(i)).join('|').slice(0,200);
        out.multBefore=expPotionMult();
        const src=DB.items.potion_exp2.img;
        out.imgOk=await new Promise(res=>{const im=new Image();im.onload=()=>res(im.naturalWidth>0);im.onerror=()=>res(false);im.src=src;});
        out.noSell=!!DB.items.potion_exp2.noSell;
        if(it[0]) useItem(it[0].uid);
        await new Promise(r=>setTimeout(r,300));
        out.buff=player.buffs&&player.buffs.exp2;
        out.multAfter=expPotionMult();
        const left=player.inv.filter(i=>i.id==='potion_exp2');
        out.countAfter=left.reduce((a,i)=>a+(i.cnt||i.qty||i.n||1),0);
        return out;
    })()`);
    console.log('INFO ' + asc(JSON.stringify(r)));
    ok(r && r.count === 10, '創角獲得 200%經驗藥水 x10 (' + (r && r.count) + ')');
    ok(r && r.imgOk, '圖示載入');
    ok(r && r.noSell, '不可販售');
    ok(r && r.multBefore === 1, '未喝前經驗倍率 1');
    ok(r && r.buff >= 1795 && r.buff <= 1800, '喝下 exp2 約 1800 秒 (' + (r && r.buff) + ')');
    ok(r && r.multAfter === 2, '喝下後經驗倍率 2');
    ok(r && r.countAfter === 9, '剩 9 瓶 (' + (r && r.countAfter) + ')');
    const bad = await fetch(BASE + '/assets/icons/items/200%25%E7%B6%93.png'.replace('%25', '%')).then((x) => x.status).catch(() => 0);
    ok(bad === 400, '壞 URI 回 400 (' + bad + ')');
    const alive = await fetch(BASE + '/api/version').then((x) => x.status).catch(() => 0);
    ok(alive === 200, '伺服器仍存活 (' + alive + ')');
    ok(errors.length === 0, 'JS 例外：' + (errors[0] || '無'));
    try { ws.close(); } catch (e) {}
    try { br.kill(); } catch (e) {}
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
