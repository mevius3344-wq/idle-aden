// 實測：掛機巡邏範圍／附近沒怪自動瞬移／書籤（同圖＋跨圖，消耗瞬移卷軸）／掛機報告
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-afk-bookmark.js [baseUrl]   截圖 → tools/lin/_out/afkbm_*.png
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9367;
const OUT = path.join(__dirname, 'lin', '_out');
const FIELD = 'talking_island';
const PATROL = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'afkbm-'));
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
    const acct = 'afkbm' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'afkbm-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'afkbm-test', clientId: 'afkbm-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__promptAns=null;window.prompt=function(){return window.__promptAns};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof bookmarkOpen==="function"')) break; }
    const goMap = (mid) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current})()`);
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('巡' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        return 1;
    })()`);
    await ev(`(()=>{player.lv=60;calcStats();player.hp=player.mhp;player.gold=100000;return 1})()`);
    await goMap(FIELD);
    await sleep(2500);
    await ev(`(()=>{document.getElementById('set-patrol').value='${PATROL}';document.getElementById('set-nomob-tp').checked=false;state.autoHunt=true;return 1})()`);

    // 1) 巡邏範圍：站到怪旁邊開始掛機 18 秒，人物不離開錨點 N 格太遠，且有打到怪
    for (let i = 0; i < 20; i++) {
        const near = await ev(`(()=>{const ms=(mapState.mobs||[]).filter(m=>m&&m.curHp>0&&m._fx!=null);if(!ms.length)return false;
            const m=ms[0];exploreTeleportTo(mapState.current,m._fx,m._fy||0);return true})()`);
        if (near) break;
        await sleep(500);
    }
    const samples = [];
    const kills0 = await ev('(window.afkReportState()||{kills:0}).kills');
    for (let i = 0; i < 36; i++) {
        await sleep(500);
        const s = await ev(`(()=>{player.hp=player.mhp;const a=explorePatrolAnchor();if(!a)return null;return exploreTileDist(a.x,a.y,explorePlayerX(),explorePlayerY())})()`);
        if (s != null) samples.push(s);
        if (i % 12 === 5) console.log('dbg ' + await ev(`(()=>{const a=explorePatrolAnchor();const ms=(mapState.mobs||[]).filter(m=>m&&m.curHp>0&&m._fx!=null);
            return JSON.stringify({a:a&&[Math.round(a.x),Math.round(a.y)],me:[Math.round(explorePlayerX()),Math.round(explorePlayerY())],auto:state.autoHunt,t:mapState.targetIdx,map:mapState.current,
            mobs:ms.map(m=>a?exploreTileDist(a.x,a.y,m._fx,m._fy||0):-1).sort((x,y)=>x-y).slice(0,6)})})()`));
    }
    const kills1 = await ev('(window.afkReportState()||{kills:0}).kills');
    const maxD = samples.length ? Math.max(...samples) : -1;
    ok(samples.length > 20 && maxD <= PATROL + 3, '巡邏範圍 ' + PATROL + ' 格：人物離錨點最遠 ' + maxD + ' 格（樣本 ' + samples.length + '）');
    ok(kills1 > kills0, '巡邏範圍內有打怪（擊殺 ' + kills0 + '→' + kills1 + '）');

    // 2) 附近沒怪自動瞬移：把所有怪標成不可達 → 4 秒後自動瞬移，卷軸 0 張時自動買 1 張並用掉
    const tp0 = await ev(`(()=>{if(!window.__gainWrap){window.__gainWrap=1;window.__tpBought=0;const g=window.gainItem;window.gainItem=function(id,n){if(id==='scroll_teleport')window.__tpBought+=(n||1);return g.apply(this,arguments)};}
        window.__tpBought=0;player.inv=player.inv.filter(i=>i.id!=='scroll_teleport'&&i.id!=='ivt_scroll_teleport');document.getElementById('set-nomob-tp').checked=true;
        return JSON.stringify({x:explorePlayerX(),y:explorePlayerY(),gold:player.gold,cost:shopPrice(DB.items.scroll_teleport.p)})})()`);
    const t0 = JSON.parse(tp0);
    let jumped = null;
    for (let i = 0; i < 60 && !jumped; i++) {
        await sleep(200);
        const r = await ev(`(()=>{player.hp=player.mhp;const now=Date.now();(mapState.mobs||[]).forEach(m=>{if(m)m._unreachUntil=now+60000});
            mapState.targetIdx=-1;const x=explorePlayerX(),y=explorePlayerY();return JSON.stringify({x,y,bought:window.__tpBought,sc:player.inv.filter(i=>i.id==='scroll_teleport').length})})()`);
        const p = JSON.parse(r);
        if (Math.hypot(p.x - t0.x, p.y - t0.y) > 150) jumped = p;
    }
    ok(!!jumped && jumped.bought === 1 && jumped.sc === 0, '附近沒怪自動瞬移（沒卷軸自動買 1 張並用掉）' + JSON.stringify(jumped) + ' from ' + tp0);
    await ev(`(()=>{document.getElementById('set-nomob-tp').checked=false;document.getElementById('set-patrol').value='0';(mapState.mobs||[]).forEach(m=>{if(m)m._unreachUntil=0});return 1})()`);

    // 3) 書籤：同圖記錄 → 隨機瞬移走 → 書籤傳回原點（消耗 1 張卷軸）
    await sleep(1500);
    const bm0 = JSON.parse(await ev(`(()=>{window.__promptAns='練功點';const ok=bookmarkAdd();return JSON.stringify({ok,x:explorePlayerX(),y:explorePlayerY(),n:(player.bookmarks||[]).length})})()`));
    ok(bm0.ok && bm0.n === 1, '記錄書籤 ' + JSON.stringify(bm0));
    await ev('exploreRandomTeleportOnMap({mode:"far"})');
    await sleep(800);
    const g0 = await ev('(()=>{player.inv=player.inv.filter(i=>i.id!=="scroll_teleport"&&i.id!=="ivt_scroll_teleport");gainItem("scroll_teleport",2,true,true);return player.gold})()');
    const back = JSON.parse(await ev(`(()=>{const r=bookmarkGo(0);return JSON.stringify({r,x:explorePlayerX(),y:explorePlayerY(),map:mapState.current,gold:player.gold,sc:player.inv.filter(i=>i.id==='scroll_teleport').reduce((s,i)=>s+(i.cnt||1),0)})})()`));
    ok(back.r && Math.hypot(back.x - bm0.x, back.y - bm0.y) < 3 && back.map === FIELD && back.sc === 1 && back.gold === g0, '同圖書籤傳回原點、用掉 1 張卷軸 ' + asc(JSON.stringify(back)));

    // 4) 跨圖：到另一個原版村莊記書籤 → 回說話之島 → 書籤傳過去（沒卷軸自動買）
    const other = 'town_giran';
    await goMap(other);
    await sleep(2500);
    const bm1 = JSON.parse(await ev(`(()=>{window.__promptAns='村莊';const ok=bookmarkAdd();return JSON.stringify({ok,map:mapState.current,x:explorePlayerX(),y:explorePlayerY(),n:player.bookmarks.length})})()`));
    ok(bm1.ok && bm1.n === 2 && bm1.map === other, '跨圖記錄書籤 ' + JSON.stringify(bm1));
    await goMap(FIELD);
    await sleep(2500);
    await ev('(()=>{player.inv=player.inv.filter(i=>i.id!=="scroll_teleport"&&i.id!=="ivt_scroll_teleport");return 1})()');
    const g1 = await ev('player.gold');
    await ev('bookmarkGo(1)');
    await sleep(2500);
    const cross = JSON.parse(await ev(`JSON.stringify({map:mapState.current,x:explorePlayerX(),y:explorePlayerY(),gold:player.gold,sc:player.inv.filter(i=>i.id==='scroll_teleport').length,cost:shopPrice(DB.items.scroll_teleport.p)})`));
    ok(cross.map === other && Math.hypot(cross.x - bm1.x, cross.y - bm1.y) < 3 && cross.sc === 0 && cross.gold === g1 - cross.cost, '跨圖書籤傳送（自動買卷軸並用掉）' + JSON.stringify(cross) + ' gold0=' + g1);

    // 5) 存檔：書籤＋巡邏設定寫進存檔
    await ev(`(()=>{document.getElementById('set-patrol').value='7';document.getElementById('set-nomob-tp').checked=true;saveGame();return 1})()`);
    const sv = JSON.parse(await ev(`(()=>{const d=JSON.parse(saveStateJson());return JSON.stringify({bm:(d.p.bookmarks||[]).length,patrol:d.p.config&&d.p.config.setPatrol,tp:d.p.config&&d.p.config.setNoMobTp})})()`));
    ok(sv.bm === 2 && String(sv.patrol) === '7' && sv.tp === true, '書籤與巡邏設定有存檔 ' + JSON.stringify(sv));

    // 6) 選單打開掛機報告／書籤
    await goMap(FIELD);
    await sleep(2000);
    await ev(`(()=>{switchMobileTabGroup('ability');activateMobileTabSub('afkreport');return 1})()`);
    await sleep(1200);
    const afk = await ev(`(()=>{const w=document.getElementById('afk-win');return w&&!w.classList.contains('hidden')?w.innerText.replace(/\\s+/g,' '):''})()`);
    ok(/掛機報告/.test(afk || '') && /擊殺/.test(afk || ''), '選單 → 掛機報告 ' + asc(String(afk).slice(0, 120)));
    const afkItems = await ev('JSON.stringify(Object.keys(afkReportState().items))');
    ok(afkItems && afkItems.indexOf('scroll_teleport') < 0, '掛機報告只算掉落，不算買的卷軸 ' + afkItems);
    await shot('afkbm_report.png');
    // 統計已併入掛機報告：能力選單沒有「統計」、舊統計入口開同一個視窗、本圖掉落在第二頁
    const subs = await ev(`(()=>MOBILE_TAB_GROUPS.ability.map(x=>x.label).join(','))()`);
    ok(!/統計/.test(subs) && /掛機報告/.test(subs), '能力選單只剩掛機報告（無統計）' + asc(subs));
    const merged = JSON.parse(await ev(`(()=>{const w=document.getElementById('afk-win');w.classList.add('hidden');switchTab('audit');const open=!w.classList.contains('hidden');w.querySelector('[data-view="drops"]').click();const rows=w.querySelectorAll('.afk-drop-row').length;const on=w.querySelector('[data-view].is-on').getAttribute('data-view');return JSON.stringify({open,rows,on})})()`));
    ok(merged.open && merged.on === 'drops' && merged.rows > 0, '舊統計入口開掛機報告＋本圖掉落頁 ' + JSON.stringify(merged));
    await shot('afkbm_drops.png');
    await ev(`(()=>{document.querySelector('#afk-win [data-view="report"]').click();return 1})()`);
    const backRep = await ev(`(()=>{const w=document.getElementById('afk-win');return !!w.querySelector('.lin-stat-grid')&&!w.querySelector('.afk-drop-row')})()`);
    ok(backRep, '切回報告頁');
    await ev(`(()=>{document.getElementById('afk-win').classList.add('hidden');switchMobileTabGroup('settings');activateMobileTabSub('bookmark');return 1})()`);
    await sleep(600);
    const bmw = await ev(`(()=>{const w=document.getElementById('bm-win');return w&&!w.classList.contains('hidden')?w.querySelectorAll('[data-go]').length:-1})()`);
    ok(bmw === 2, '選單 → 書籤（列出 ' + bmw + ' 個）');
    await shot('afkbm_bookmark.png');
    await ev(`(()=>{document.getElementById('bm-win').classList.add('hidden');linMenuOpen('auto');return 1})()`);
    await sleep(600);
    const patrolIn = await ev(`(()=>{const e=document.getElementById('set-patrol');return !!(e&&e.closest('#lm-win-auto')&&e.offsetParent)})()`);
    ok(patrolIn, '內掛選單 → 狩獵 看得到巡邏範圍');
    await sleep(300);
    await shot('afkbm_settings.png');

    ok(errors.length === 0, 'JS 例外：' + (errors.slice(0, 4).map(asc).join(' | ') || '無'));
    ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
