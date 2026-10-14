// 實測：打怪掉落（金幣／道具）直接進背包、不落地（場上沒有 .vfx-drop-loot）、掛機報告照記；PK 噴裝（扣除→轉交擊殺者）照舊
// 用法：先起 _serve.js（PORT=5699），再 node tools/_audit-loot-direct.js [baseUrl]   截圖 → tools/lin/_out/loot_*.png
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5699';
const PORT = require('./_cdp-port')(9373);
const OUT = path.join(__dirname, 'lin', '_out');
const FIELD = 'talking_island';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'loot-'));
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
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };

    const stamp = Date.now() % 100000;
    const acct = 'loot' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'loot-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'loot-test', clientId: 'loot-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof killMob==="function"&&typeof afkReportState==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('掉' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        return 1;
    })()`);
    await ev(`(()=>{player.lv=30;calcStats();player.hp=player.mhp;player.gold=1000;return 1})()`);
    await ev(`(()=>{const sel=document.getElementById('map-select');if(![...sel.options].some(o=>o.value==='${FIELD}')){const o=document.createElement('option');o.value='${FIELD}';sel.appendChild(o);}sel.value='${FIELD}';changeMap(true);return 1})()`);
    await sleep(3000);

    // 掛 DOM 監看：任何 .vfx-drop-loot／#explore-loot-layer 子元素出現都記下
    await ev(`(()=>{window.__lootEls=0;const bv=document.getElementById('battle-view');
        new MutationObserver(ms=>{ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1&&(n.classList.contains('vfx-drop-loot')||(n.querySelector&&n.querySelector('.vfx-drop-loot'))))window.__lootEls++;}));}).observe(bv,{childList:true,subtree:true});
        return 1})()`);
    let ready = false;
    for (let i = 0; i < 30 && !ready; i++) { await sleep(500); ready = await ev('(mapState.mobs||[]).some(m=>m&&m.curHp>0&&!m.boss)'); }
    ok(ready, '說話之島有怪可測');
    ok(await ev('typeof exploreFieldCombatActive==="function"&&exploreFieldCombatActive()'), '在原版場戰地圖（以前這裡會落地待撿）');

    // 1) 強制掉落：金幣 70% 必中＋指定道具 100%
    const r1 = await ev(`(()=>{
        const itemId=Object.keys(DB.items).find(k=>{const d=DB.items[k];return d&&!d.maxHold&&!['wpn','arm','acc'].includes(d.type)&&/藥水/.test(d.n||'')&&!/%/.test(d.n||'')});
        let idx=(mapState.mobs||[]).findIndex(m=>m&&m.curHp>0&&!m.boss&&!m.noGold&&monsterGoldRange(m).max>0);
        if(idx<0)idx=(mapState.mobs||[]).findIndex(m=>m&&m.curHp>0&&!m.boss);const m=mapState.mobs[idx];
        m._authKillOk=true;m.curHp=0;
        const dl0=MOB_DROPS[m.n];MOB_DROPS[m.n]=[[itemId,100]];
        const cnt=()=>player.inv.filter(i=>i.id===itemId).reduce((s,i)=>s+(i.cnt||1),0);
        const a=afkReportState();const ai0=(a.items&&a.items[itemId])||0;
        const g0=player.gold,c0=cnt();const rnd=Math.random;Math.random=()=>0.3;
        try{killMob(idx);}finally{Math.random=rnd;if(dl0)MOB_DROPS[m.n]=dl0;else delete MOB_DROPS[m.n];}
        const layer=document.getElementById('explore-loot-layer');
        return JSON.stringify({itemId,mob:m.n,range:monsterGoldRange(m),gold:player.gold-g0,item:cnt()-c0,afkItem:((afkReportState().items||{})[itemId]||0)-ai0,
            layerKids:layer?layer.children.length:0,lootDom:document.querySelectorAll('.vfx-drop-loot').length,queue:_vfxDropQueue.length,defer:_worldLootDefer});
    })()`);
    const a1 = JSON.parse(r1 || '{}');
    ok(a1.gold > 0, '金幣當下入帳 ' + r1);
    ok(a1.item === 1, '道具當下進背包');
    ok(a1.afkItem === 1, '掛機報告記到這件掉落');
    ok(a1.layerKids === 0 && a1.lootDom === 0 && a1.queue === 0 && a1.defer === false, '地上沒有掉落圖標、沒有待撿佇列');
    await sleep(1200);
    ok(await ev('document.querySelectorAll(".vfx-drop-loot").length') === 0, '1 秒後地上仍無掉落');

    // 2) 實戰：自動打怪 40 秒，金幣增加、全程沒有落地圖標
    await ev(`(()=>{window.__g0=player.gold;window.__k0=afkReportState().kills;state.autoHunt=true;return 1})()`);
    let live = null;
    for (let i = 0; i < 80; i++) {
        await sleep(500);
        live = JSON.parse(await ev(`(()=>{player.hp=player.mhp;return JSON.stringify({kills:afkReportState().kills-window.__k0,gold:player.gold-window.__g0,lootEls:window.__lootEls,dom:document.querySelectorAll('.vfx-drop-loot').length})})()`));
        if (live.kills >= 4 && live.gold > 0) break;
    }
    ok(live && live.kills >= 2, '實戰自動打怪有擊殺 ' + JSON.stringify(live));
    ok(live && live.gold > 0, '實戰金幣直接增加');
    ok(live && live.lootEls === 0 && live.dom === 0, '實戰全程沒有地上掉落圖標');
    await shot('loot_field.png');
    await ev('state.autoHunt=false;1');

    // 3) PK 噴裝：被殺方扣除（不在村莊）→ 擊殺者原樣入包
    const r3 = await ev(`(()=>{
        const before=player.inv.length+Object.values(player.eq||{}).filter(Boolean).length;
        const res=pvpResolveDeathItemLoss({force:true});
        const after=player.inv.length+Object.values(player.eq||{}).filter(Boolean).length;
        const snaps=(res.items||[]).map(x=>x.item);
        const got=pvpGainTransferredItems(snaps,'測試對手',{silent:true});
        const back=player.inv.length+Object.values(player.eq||{}).filter(Boolean).length;
        return JSON.stringify({lost:res.items.length,before,after,back,got:got.length,ids:snaps.map(s=>s.id)});
    })()`);
    const a3 = JSON.parse(r3 || '{}');
    ok(a3.lost >= 1 && a3.got === a3.lost && a3.ids.length === a3.lost, 'PK 噴裝：扣除後轉交擊殺者原樣入包 ' + r3);

    ok(errors.length === 0, 'JS 例外：' + (errors.slice(0, 4).map(asc).join(' | ') || '無'));
    ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
