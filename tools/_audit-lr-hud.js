// 實測：樂園風 HUD（無搖桿點地移動、快捷欄、選單列、聊天框、小地圖、村莊）
// 用法：node tools/_audit-lr-hud.js [baseUrl]   截圖 → tools/lin/_out/lrhud_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9339;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'lrhud-'));
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
            errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber);
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };
    const tap = async (x, y, holdMs) => {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await sleep(holdMs || 60);
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const center = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})()`);
    const changeMap = (mid) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true);})()`);

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'lrhud';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='樂園'+Date.now()%100000;
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    await changeMap('zone_13');
    await sleep(5000);

    // 1) 版面
    const base = await ev(`(()=>{const gs=document.getElementById('game-screen');const vis=(s)=>{const e=document.querySelector(s);if(!e)return false;const c=getComputedStyle(e);const r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>4&&r.height>4;};
        return {lr:gs.classList.contains('lr-hud'),joy:vis('#chud-joystick'),fabLog:vis('#chud-fab-log'),menu:vis('#lr-menubar'),exp:vis('#lr-expbar .status-exp-bar')&&!!document.querySelector('#lr-expbar #bar-exp'),quick:document.querySelectorAll('#lr-quick-slots .lr-slot').length,
        home:vis('#lr-home'),mm:vis('#lr-minimap'),mapbox:vis('#lr-mapbox'),auto:vis('#chud-auto'),mail:vis('#lr-mail'),pvp:vis('#chud-pvp'),chat:vis('#combat-log-panel'),input:vis('#world-input'),tabs:document.querySelectorAll('.lr-chat-tabs [data-lr]').length,
        coord:document.getElementById('lr-map-coord').textContent,target:vis('#chud-target')};})()`);
    ok(base && base.lr, 'game-screen 有 lr-hud');
    ok(base && !base.joy && !base.fabLog, '搖桿／日誌浮鈕已隱藏');
    ok(base && base.menu && base.exp, '下方選單列＋整條經驗條');
    ok(base && base.quick === 5 && base.home, '5 格快捷＋回村鈕');
    ok(base && base.mm && base.mapbox && /^\d+,\d+$/.test(base.coord), '地圖名＋座標＋小地圖 (' + (base && base.coord) + ')');
    ok(base && base.auto && base.mail && base.pvp, 'AUTO／信件／PVP 可見');
    ok(base && base.chat && base.input && base.tabs === 5, '聊天框＋輸入框＋5 個直排分頁');
    ok(base && !base.target, '頂部 #chud-target 仍隱藏（鎖定 #4）');

    const mmPix = await ev(`(()=>{const c=document.getElementById('lr-minimap-cv');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;})()`);
    ok(mmPix > 2000, '小地圖有繪製 (' + mmPix + ' px)');

    // 2) 點地面移動（無搖桿）
    let moved = 0;
    for (const [tx, ty] of [[296, 400], [120, 420], [206, 300], [300, 520], [110, 300], [206, 560]]) {
        const p0 = await ev('[explorePlayerX(),explorePlayerY()]');
        await tap(tx, ty, 80);
        await sleep(1200);
        const p1 = await ev('[explorePlayerX(),explorePlayerY()]');
        moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (moved > 10) break;
    }
    ok(moved > 10, '點地面會移動 (位移 ' + Math.round(moved) + ')');
    await shot('lrhud_field.png');

    // 3) 快捷欄：紅水
    await ev('player.hp=1;try{updateUI&&updateUI()}catch(e){}');
    const cnt0 = await ev(`(player.inv.find(x=>x.id==='potion_heal')||{cnt:0}).cnt`);
    const q0 = await center('#lr-quick-slots .lr-slot:nth-child(1)');
    if (q0) await tap(q0[0], q0[1], 60);
    await sleep(700);
    const cnt1 = await ev(`(player.inv.find(x=>x.id==='potion_heal')||{cnt:0}).cnt`);
    ok(cnt1 === cnt0 - 1, '快捷欄點紅水會喝 (' + cnt0 + '→' + cnt1 + ')');
    const shown = await ev(`(document.querySelector('#lr-quick-slots .lr-slot:nth-child(1)')||{}).textContent`);
    ok(String(shown || '').indexOf(String(cnt1)) >= 0, '快捷欄數量更新 (' + shown + ')');

    // 長按 → 選擇視窗
    const q2 = await center('#lr-quick-slots .lr-slot:nth-child(2)');
    if (q2) await tap(q2[0], q2[1], 800);
    await sleep(300);
    const picker = await ev(`(()=>{const e=document.getElementById('lr-picker');return !!e&&getComputedStyle(e).display!=='none'&&e.querySelectorAll('button').length>=2;})()`);
    ok(picker, '長按快捷格開啟道具選擇');
    await ev(`(()=>{const e=document.getElementById('lr-picker');if(e){const b=[...e.querySelectorAll('button')].find(x=>/關閉/.test(x.textContent));b&&b.click();}})()`);

    // 4) 選單列 → 面板
    const mb = await center('.lr-menu-btn[data-menu="stats"]');
    if (mb) await tap(mb[0], mb[1], 60);
    await sleep(700);
    const open1 = await ev(`(()=>{const c=document.getElementById('col-right');const p=document.getElementById('tab-content-panel');const r=p&&p.getBoundingClientRect();return {open:c.classList.contains('mobile-tab-open'),h:r?Math.round(r.height):0,top:r?Math.round(r.top):0,bottom:r?Math.round(r.bottom):0};})()`);
    ok(open1 && open1.open && open1.h > 150, '角色鈕開面板 (h=' + (open1 && open1.h) + ')');
    const menuTop = await ev(`Math.round(document.getElementById('lr-menubar').getBoundingClientRect().top)`);
    ok(open1 && open1.bottom <= menuTop + 2, '面板不蓋到選單列');
    await shot('lrhud_sheet.png');
    if (mb) await tap(mb[0], mb[1], 60);
    await sleep(600);
    const open2 = await ev(`document.getElementById('col-right').classList.contains('mobile-tab-open')`);
    ok(!open2, '再按一次角色鈕關閉面板');
    const ib = await center('.lr-menu-btn[data-menu="items"]');
    if (ib) await tap(ib[0], ib[1], 60);
    await sleep(600);
    const itemsOpen = await ev(`(()=>{const t=document.querySelector('#col-right .tab-bar-buttons [data-tab="items"]');return document.getElementById('col-right').classList.contains('mobile-tab-open')&&!!t&&t.classList.contains('active');})()`);
    ok(itemsOpen, '背包鈕開背包');
    await ev('try{collapseMobileTabPanel()}catch(e){}');
    await sleep(400);
    const mn = await center('.lr-menu-btn[data-menu="menu"]');
    if (mn) await tap(mn[0], mn[1], 60);
    await sleep(500);
    const rail = await ev(`(()=>{const c=document.getElementById('col-right');const r=document.querySelector('#col-right .mobile-tab-primary');const rr=r&&r.getBoundingClientRect();return {exp:c.classList.contains('chud-menu-expanded'),vis:!!rr&&rr.width>10&&rr.height>10};})()`);
    ok(rail && rail.exp && rail.vis, '選單鈕展開功能列');
    const railTop = await ev(`(()=>{const b=document.querySelector('#col-right .mobile-tab-primary button, #col-right .mobile-tab-primary [data-group]');if(!b)return null;const r=b.getBoundingClientRect();const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!h&&!!h.closest('#col-right');})()`);
    ok(railTop === true, '功能列按鈕在最上層（不被回村鈕等擋住）');
    await shot('lrhud_menu.png');
    if (mn) await tap(mn[0], mn[1], 60);
    await sleep(400);
    const rail2 = await ev(`document.getElementById('col-right').classList.contains('chud-menu-expanded')`);
    ok(!rail2, '再按選單鈕收合');

    // 5) 聊天框放大／分頁／輸入
    const h0 = await ev(`Math.round(document.getElementById('combat-log-panel').getBoundingClientRect().height)`);
    const ex = await center('#lr-chat-expand');
    if (ex) await tap(ex[0], ex[1], 60);
    await sleep(400);
    const h1 = await ev(`Math.round(document.getElementById('combat-log-panel').getBoundingClientRect().height)`);
    ok(h1 > h0 + 60, '聊天框可放大 (' + h0 + '→' + h1 + ')');
    await shot('lrhud_chatbig.png');
    const ex2 = await center('#lr-chat-expand');
    if (ex2) await tap(ex2[0], ex2[1], 60);
    await sleep(300);
    const h2 = await ev(`Math.round(document.getElementById('combat-log-panel').getBoundingClientRect().height)`);
    ok(h2 === h0, '聊天框可縮回 (' + h2 + ')');
    const wt = await center('.lr-chat-tabs [data-lr="世"]');
    if (wt) await tap(wt[0], wt[1], 60);
    await sleep(300);
    ok((await ev('_unifiedLogTab')) === 'world', '點「世」切到世界頻道');
    const inp = await ev(`(()=>{const i=document.getElementById('world-input');const s=document.getElementById('world-send');return {ph:i.placeholder,send:s.textContent.trim()};})()`);
    ok(inp && inp.ph === '點擊輸入聊天內容' && inp.send === '發送', '輸入框提示＋發送鈕');

    // 6) 原版可走動村莊（說話之島）：無回村鈕，小地圖／座標照常
    await changeMap('town_talking');
    await sleep(4000);
    const walkTown = await ev(`(()=>{const vis=(s)=>{const e=document.querySelector(s);if(!e)return false;const c=getComputedStyle(e);const r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>4&&r.height>4;};
        return {walk:document.getElementById('game-screen').classList.contains('lin-town-walk'),home:vis('#lr-home'),mm:vis('#lr-minimap'),menu:vis('#lr-menubar'),quick:vis('#lr-quick'),coord:document.getElementById('lr-map-coord').textContent};})()`);
    ok(walkTown && walkTown.walk && !walkTown.home && walkTown.mm && walkTown.menu && walkTown.quick && /^\d+,\d+$/.test(walkTown.coord), '原版村莊：無回村鈕、有小地圖＋座標＋選單＋快捷 ' + JSON.stringify(walkTown));
    await shot('lrhud_town_walk.png');

    // 7) 無原版對應的村莊（希培利亞）：舊村莊畫面
    await changeMap('town_hyperia');
    await sleep(4000);
    const town = await ev(`(()=>{const vis=(s)=>{const e=document.querySelector(s);if(!e)return false;const c=getComputedStyle(e);const r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>4&&r.height>4;};
        return {town:document.getElementById('game-screen').classList.contains('chud-in-town'),home:vis('#lr-home'),mm:vis('#lr-minimap'),menu:vis('#lr-menubar'),quick:vis('#lr-quick'),name:document.getElementById('lr-map-name').textContent,bg:getComputedStyle(document.getElementById('battle-view')).backgroundImage};})()`);
    ok(town && town.town && !town.home && !town.mm && town.menu && town.quick, '村莊：無回村鈕／小地圖，保留選單＋快捷');
    ok(town && town.name && town.name !== '—', '村莊地名 (' + (town && town.name) + ')');
    ok(town && /url\(/.test(town.bg || '') || await ev(`/url\\(/.test(getComputedStyle(document.getElementById('town-npc-map')).backgroundImage)`), '村莊背景存在（鎖定 #2）');
    const hidden = await ev(`(()=>{const out=[];document.querySelectorAll('#town-npc-map .town-npc').forEach(n=>{const r=n.getBoundingClientRect();if(r.width<2)return;const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||x>innerWidth)return;const h=document.elementFromPoint(x,y);if(!h||!n.contains(h)&&!h.closest('.town-npc'))out.push((n.innerText||'').split('\\n')[0]);});return out;})()`);
    ok(Array.isArray(hidden) && hidden.length === 0, '村莊 NPC 都點得到（未被聊天框／快捷欄遮）' + (hidden && hidden.length ? '：' + hidden.join('、') : ''));
    await shot('lrhud_town.png');

    ok(errors.length === 0, 'JS 例外：' + (errors.length ? errors.slice(0, 5).join(' | ') : '無'));
    ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
