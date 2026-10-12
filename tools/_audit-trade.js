// 實測：玩家交易（兩個分頁同村莊 → 點對方 → 交易 → 放物品／金幣 → 雙方鎖定 → 成交；另測取消退回）
// 用法：先以 CLOUD_SAVE_DIR=<dir> PORT=5199 起 _serve.js，再 node tools/_audit-trade.js [dir（預設同 CLOUD_SAVE_DIR 或 tools/lin/_out/trade-data）] [baseUrl]
// 截圖 → tools/lin/_out/trade_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA = path.resolve(process.argv[2] || process.env.CLOUD_SAVE_DIR || path.join(__dirname, 'lin', '_out', 'trade-data'));
const BASE = process.argv[3] || 'http://localhost:5199';
const PORT = 9366;
const OUT = path.join(__dirname, 'lin', '_out');
const TOWN = 'town_talking';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

async function page(wsUrl) {
    const ws = new WebSocket(wsUrl);
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
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; console.log('EVAL_ERR ' + String((d.exception && d.exception.description) || d.text).split('\n')[0].replace(/[^\x20-\x7e]/g, '?')); } return r.result && r.result.result ? r.result.result.value : undefined; };
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };
    const tap = async (x, y) => {
        for (const type of ['mousePressed', 'mouseReleased']) {
            await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
        }
    };
    return { ws, send, ev, shot, tap, errors };
}

const cloudFile = (acct, slot) => path.join(DATA, acct, 'slot-' + slot + '.json');
const readCloud = (acct, slot) => { try { return JSON.parse(fs.readFileSync(cloudFile(acct, slot), 'utf8')); } catch (e) { return null; } };
const invCnt = (save, id) => ((save && save.p && save.p.inv) || []).filter((i) => i && i.id === id).reduce((s, i) => s + (i.cnt || 1), 0);

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const t2 = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const A = await page(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    const B = await page(t2.webSocketDebuggerUrl);
    const stamp = Date.now() % 100000;
    const login = async (acct) => {
        const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
        await pj('/api/accounts/register', { account: acct, password: 'trade-test' });
        const r = await pj('/api/accounts/login', { account: acct, password: 'trade-test', clientId: 'trade-audit-' + acct });
        if (!r || !r.authToken) throw new Error('login failed ' + acct + ' ' + JSON.stringify(r));
        return r.authToken;
    };
    for (const [P, acct, nm] of [[A, 'trta' + stamp, '甲' + stamp], [B, 'trtb' + stamp, '乙' + stamp]]) {
        const token = await login(acct);
        await P.send('Page.enable'); await P.send('Runtime.enable');
        await P.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
        await P.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__promptAns=null;window.prompt=function(){return window.__promptAns};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(token) + ')}catch(e){}' });
        await P.send('Page.navigate', { url: BASE + '/' });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await P.ev('typeof startGame==="function"&&typeof changeMap==="function"&&typeof tradeRequest==="function"')) break; }
        P.slot = await P.ev(`(async()=>{
            window._authAccountForNames=()=>${JSON.stringify(acct)};
            window.__DEV_OFFLINE=false; window.__fb5AuthAccount=${JSON.stringify(acct)};
            let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
            currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
            document.getElementById('create-name-input').value=${JSON.stringify(nm)};
            startGame(); await new Promise(r=>setTimeout(r,3000));
            try{ setPowerSaveOn(false); }catch(e){}
            const sel=document.getElementById('map-select');const id=${JSON.stringify(TOWN)};
            if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
            sel.value=id; changeMap(true);
            return currentSlot;
        })()`);
        P.name = nm; P.acct = acct;
    }
    // 測試用物品：甲拿到兩疊可交易道具；乙的雲端錢包放 50000 金（模擬伺服器入帳）
    const ITEM = await A.ev(`(()=>{const ids=Object.keys(DB.items).filter(id=>{const d=DB.items[id];return d&&d.n&&!d.noSell&&!d.doll&&d.slot!=='doll'&&(d.type==='potion'||/藥水/.test(d.n));});return ids[0]||''})()`);
    ok(!!ITEM, '找到測試道具 ' + ITEM);
    const pushDiag = `(()=>{saveGame();const d=JSON.parse(saveStateJson());const x=new XMLHttpRequest();x.open('PUT','/api/cloud/'+encodeURIComponent(window.__fb5AuthAccount)+'/slot/'+currentSlot,false);x.setRequestHeader('Content-Type','application/json');
        const w={save:d};try{Object.assign(w,anticheatAuthExtras())}catch(e){}x.send(JSON.stringify(w));return {slot:currentSlot,st:x.status,body:String(x.responseText).slice(0,160)}})()`;
    await A.ev(`(()=>{gainItem(${JSON.stringify(ITEM)},10,true);return 1})()`);
    console.log('pushA ' + String(JSON.stringify(await A.ev(pushDiag))).replace(/[^\x20-\x7e]/g, '?'));
    console.log('pushB ' + String(JSON.stringify(await B.ev(pushDiag))).replace(/[^\x20-\x7e]/g, '?'));
    const seedGold = (P, g) => {
        const f = cloudFile(P.acct, P.slot);
        const s = JSON.parse(fs.readFileSync(f, 'utf8'));
        s.p.gold = g; s.p._walletRev = (Number(s.p._walletRev) || 0) + 1;
        fs.writeFileSync(f, JSON.stringify(s), 'utf8');
        return P.ev('(()=>{player.gold=' + g + ';player._walletRev=' + s.p._walletRev + ';saveGame();return player.gold})()');
    };
    await seedGold(B, 50000);
    const goldA0 = await A.ev('player.gold||0');

    // 等互相看得到
    const peerRect = (P, other) => P.ev(`(()=>{const el=[...document.querySelectorAll('#battle-view .remote-party')].find(e=>(e.getAttribute('data-peer-name')||'')===${JSON.stringify(other)});
        if(!el)return null;const h=el.querySelector('.remote-party-hit');if(!h)return {nohit:1};const r=h.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,pe:getComputedStyle(h).pointerEvents};})()`);
    let ra = null;
    for (let i = 0; i < 25; i++) {
        await A.send('Page.bringToFront'); await sleep(300);
        ra = await peerRect(A, B.name);
        await B.send('Page.bringToFront'); await sleep(300);
        if (ra && ra.w > 0) break;
        await sleep(800);
    }
    ok(ra && ra.w > 0 && ra.pe === 'auto', '甲畫面上乙有可點區 ' + JSON.stringify(ra));

    // 甲點乙 → 出現選單 → 按「交易」
    await A.send('Page.bringToFront'); await sleep(200);
    ra = await peerRect(A, B.name);
    const tapped = await A.ev(`(()=>{const x=${ra ? ra.x : 0},y=${ra ? ra.y : 0};const t=document.elementFromPoint(x,y);return t?(t.className||t.id||t.tagName):'none'})()`);
    await A.tap(ra.x, ra.y);
    await sleep(400);
    const menu = await A.ev('(()=>{const m=document.getElementById("peer-menu");return m?m.innerText.replace(/\\s+/g," "):""})()');
    ok(/交易/.test(menu || ''), '點對方跳出選單 ' + JSON.stringify(menu) + ' target=' + tapped);
    await A.shot('trade_menu.png');
    await A.ev('(()=>{const b=[...document.querySelectorAll("#peer-menu button")].find(b=>b.getAttribute("data-act")==="trade");b&&b.click();return !!b})()');

    // 乙收到邀請 → 接受
    await B.send('Page.bringToFront');
    let ask = '';
    for (let i = 0; i < 20 && !ask; i++) { await sleep(400); ask = await B.ev('(()=>{const a=document.getElementById("trade-ask");return a?a.innerText.replace(/\\s+/g," "):""})()'); }
    ok(ask.indexOf(A.name) >= 0, '乙收到交易邀請 ' + JSON.stringify(ask));
    await B.shot('trade_ask.png');
    await B.ev('tradeRespond(true)');
    const winOpen = async (P) => { for (let i = 0; i < 20; i++) { await sleep(300); if (await P.ev('(()=>{const w=document.getElementById("trade-win");return !!(w&&!w.classList.contains("hidden"))})()')) return true; } return false; };
    ok(await winOpen(B), '乙交易視窗打開');
    await A.send('Page.bringToFront');
    ok(await winOpen(A), '甲交易視窗打開');

    // 甲放 6 個道具；乙放 12345 金
    await A.ev(`(()=>{window.__promptAns='6';const it=player.inv.find(i=>i.id===${JSON.stringify(ITEM)});tradeAddFromBag(it.uid);return 1})()`);
    await sleep(800);
    await B.send('Page.bringToFront');
    await B.ev("(()=>{window.__promptAns='12345';tradeSetGold();return 1})()");
    let seenB = null;
    for (let i = 0; i < 15; i++) {
        await sleep(400);
        seenB = await B.ev('JSON.stringify((()=>{const t=tradeCurrent();return t&&{them:t.them.items.map(x=>x.item.id+"x"+x.cnt),gold:t.me.gold}})())');
        if (seenB && seenB.indexOf('x6') >= 0 && seenB.indexOf('12345') >= 0) break;
    }
    ok(seenB && seenB.indexOf(ITEM + 'x6') >= 0 && seenB.indexOf('12345') >= 0, '乙看到甲放的道具、自己放了金幣 ' + seenB);
    await A.send('Page.bringToFront');
    let seenA = null;
    for (let i = 0; i < 15; i++) {
        await sleep(400);
        seenA = await A.ev('JSON.stringify((()=>{const t=tradeCurrent();return t&&{gold:t.them.gold,mine:t.me.items.length}})())');
        if (seenA && seenA.indexOf('12345') >= 0) break;
    }
    ok(seenA && seenA.indexOf('12345') >= 0, '甲看到乙放的金幣 ' + seenA);
    await A.shot('trade_window.png');

    // 雙方鎖定 → 成交
    await A.ev('tradeLock()');
    await sleep(1200);
    const aLockedInv = await A.ev(`(()=>player.inv.filter(i=>i.id===${JSON.stringify(ITEM)}).reduce((s,i)=>s+(i.cnt||1),0))()`);
    ok(aLockedInv === 4, '甲鎖定後背包少了 6 個（剩 ' + aLockedInv + '）');
    await B.send('Page.bringToFront');
    for (let i = 0; i < 10; i++) { await sleep(300); if (await B.ev('!!(tradeCurrent()&&tradeCurrent().them.locked)')) break; }
    await B.ev('tradeLock()');
    let doneB = null;
    for (let i = 0; i < 20; i++) {
        await sleep(400);
        doneB = await B.ev(`JSON.stringify({t:!!tradeCurrent(),gold:player.gold,item:player.inv.filter(i=>i.id===${JSON.stringify(ITEM)}).reduce((s,i)=>s+(i.cnt||1),0)})`);
        const d = JSON.parse(doneB);
        if (!d.t && d.item === 6) break;
    }
    const dB = JSON.parse(doneB);
    ok(!dB.t && dB.item === 6 && dB.gold === 50000 - 12345, '乙成交：收到 6 個道具、金幣 50000→' + dB.gold + ' ' + doneB);
    await A.send('Page.bringToFront');
    let doneA = null;
    for (let i = 0; i < 20; i++) {
        await sleep(400);
        doneA = await A.ev(`JSON.stringify({t:!!tradeCurrent(),gold:player.gold,item:player.inv.filter(i=>i.id===${JSON.stringify(ITEM)}).reduce((s,i)=>s+(i.cnt||1),0)})`);
        if (JSON.parse(doneA).gold === goldA0 + 12345) break;
    }
    const dA = JSON.parse(doneA);
    ok(!dA.t && dA.item === 4 && dA.gold === goldA0 + 12345, '甲成交：道具剩 4、金幣 ' + goldA0 + '→' + dA.gold);
    await A.shot('trade_done_A.png');
    await sleep(1500);
    await A.ev('(()=>{saveGame();return cloudPushSlotSync(currentSlot,JSON.parse(saveStateJson()))})()');
    await B.ev('(()=>{saveGame();return cloudPushSlotSync(currentSlot,JSON.parse(saveStateJson()))})()');
    const cA = readCloud(A.acct, A.slot), cB = readCloud(B.acct, B.slot);
    ok(invCnt(cA, ITEM) === 4 && cA.p.gold === goldA0 + 12345, '甲雲端存檔一致（道具 ' + invCnt(cA, ITEM) + '、金幣 ' + (cA && cA.p.gold) + '）');
    ok(invCnt(cB, ITEM) === 6 && cB.p.gold === 50000 - 12345, '乙雲端存檔一致（道具 ' + invCnt(cB, ITEM) + '、金幣 ' + (cB && cB.p.gold) + '）');

    // 第二次：甲放 2 個並鎖定，乙取消 → 甲拿回
    await A.ev(`tradeRequest(${JSON.stringify(await A.ev('(()=>{const el=[...document.querySelectorAll("#battle-view .remote-party")].find(e=>e.getAttribute("data-peer-name")===' + JSON.stringify(B.name) + ');return el?el.getAttribute("data-peer-key"):""})()'))},${JSON.stringify(B.name)})`);
    await B.send('Page.bringToFront');
    for (let i = 0; i < 15; i++) { await sleep(400); if (await B.ev('!!document.getElementById("trade-ask")')) break; }
    await B.ev('tradeRespond(true)');
    await sleep(800);
    await A.send('Page.bringToFront');
    await winOpen(A);
    await A.ev(`(()=>{window.__promptAns='2';const it=player.inv.find(i=>i.id===${JSON.stringify(ITEM)});tradeAddFromBag(it.uid);return 1})()`);
    await sleep(800);
    await A.ev('tradeLock()');
    await sleep(1000);
    const midA = await A.ev(`player.inv.filter(i=>i.id===${JSON.stringify(ITEM)}).reduce((s,i)=>s+(i.cnt||1),0)`);
    await B.send('Page.bringToFront');
    await B.ev('tradeCancel()');
    await A.send('Page.bringToFront');
    let backA = null;
    for (let i = 0; i < 20; i++) {
        await sleep(400);
        backA = await A.ev(`JSON.stringify({t:!!tradeCurrent(),item:player.inv.filter(i=>i.id===${JSON.stringify(ITEM)}).reduce((s,i)=>s+(i.cnt||1),0)})`);
        if (JSON.parse(backA).item === 4) break;
    }
    ok(midA === 2 && JSON.parse(backA).item === 4 && !JSON.parse(backA).t, '鎖定後對方取消 → 物品退回（鎖定時 ' + midA + '，退回後 ' + backA + '）');

    const log = await A.ev('(()=>{const el=document.getElementById("combat-log")||document.body;return (el.innerText.match(/【交易】[^\\n]*/g)||[]).slice(-4).join(" / ")})()');
    console.log('log: ' + String(log || '').replace(/[^\x20-\x7e]/g, '?').slice(0, 200));
    ok(A.errors.length + B.errors.length === 0, 'JS 例外：' + (A.errors.concat(B.errors).slice(0, 4).join(' | ') || '無'));
    A.ws.close(); B.ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
