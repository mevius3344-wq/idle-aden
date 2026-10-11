// 實測：橫式介面（電腦 1920x1080／手機橫放 892x412）照新創：遊戲滿版、底部整條、面板開右側；手機直拿維持直式
// 用法：node tools/_audit-lr-wide.js [baseUrl]   截圖 → tools/lin/_out/lrwide_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9341;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'lrwide-'));
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
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await sleep(60);
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    const changeMap = (mid) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true);})()`);
    const rects = () => ev(`(()=>{const r=(s)=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);const b=e.getBoundingClientRect();
        if(c.display==='none'||c.visibility==='hidden'||b.width<2||b.height<2)return null;return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),b:Math.round(b.bottom)};};
        return {gs:r('#game-screen'),left:r('#col-left'),mm:r('#lr-minimap'),log:r('#log-row'),quick:r('#lr-quick'),menu:r('#lr-menubar'),exp:r('#lr-expbar'),mapbox:r('#lr-mapbox'),auto:r('#chud-auto'),
            W:innerWidth,H:innerHeight};})()`);
    const overlap = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'lrwide';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='橫式'+Date.now()%100000;
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    await changeMap('zone_13');
    await sleep(5000);

    for (const [tag, W, H, mob] of [['pc', 1920, 1080, false], ['ml', 892, 412, true]]) {
        await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mob });
        await sleep(1500);
        const R = await rects();
        ok(R.gs && R.gs.l === 0 && R.gs.r === W, `[${tag}] 遊戲滿版 (${R.gs && R.gs.l}..${R.gs && R.gs.r})`);
        const bar = ['left', 'mm', 'log', 'quick', 'menu'];
        ok(bar.every((k) => R[k]), `[${tag}] 底條元件都在：狀態／小地圖／聊天／快捷／選單`);
        const barTop = H - (mob ? 108 : 132) - 4;
        ok(bar.every((k) => R[k] && R[k].t >= barTop && R[k].b <= H), `[${tag}] 全收在底部整條內 (頂 ${barTop})`);
        ok(R.left && R.mm && R.log && R.quick && R.left.r <= R.mm.l + 1 && R.mm.r <= R.log.l + 1 && R.log.r <= R.quick.l + 1, `[${tag}] 左→右：狀態｜小地圖｜聊天｜快捷選單`);
        const pairs = [];
        for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) if (overlap(R[bar[i]], R[bar[j]])) pairs.push(bar[i] + '×' + bar[j]);
        ok(pairs.length === 0, `[${tag}] 底條元件互不重疊 ${pairs.join(',')}`);
        ok(R.quick && R.menu && R.quick.b <= R.menu.t + 1, `[${tag}] 快捷列在選單列上方`);
        ok(R.exp && R.exp.l === 0 && R.exp.r === W && R.exp.b === H, `[${tag}] 經驗條整條在最底`);
        ok(R.mapbox && R.mapbox.r > W - 40 && R.mapbox.t < 20, `[${tag}] 地名在右上`);
        const chatHit = await ev(`(()=>{const e=document.getElementById('world-input');if(!e)return false;const b=e.getBoundingClientRect();const h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return h===e||!!(h&&e.contains(h));})()`);
        ok(chatHit, `[${tag}] 聊天輸入框看得到、點得到（不被底條蓋住）`);

        // 點地面（底條上方）會走
        let moved = 0;
        for (const [fx, fy] of [[0.62, 0.42], [0.36, 0.5], [0.5, 0.25], [0.7, 0.6]]) {
            const p0 = await ev('[explorePlayerX(),explorePlayerY()]');
            await click(Math.round(W * fx), Math.round(H * fy));
            await sleep(1800);
            const p1 = await ev('[explorePlayerX(),explorePlayerY()]');
            moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            if (moved > 10) break;
        }
        ok(moved > 10, `[${tag}] 點地面會移動 (位移 ${Math.round(moved)})`);
        const pc = await ev(`(()=>{const e=document.querySelector('#battle-view .player-model, #battle-view [id^=player-model], .pm-body');if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.left+b.width/2),Math.round(b.top+b.height/2)];})()`);
        ok(pc && Math.abs(pc[0] - W / 2) < W * 0.12, `[${tag}] 玩家水平置中 (${pc && pc[0]} / ${W / 2})`);

        // 面板：右側浮窗，不蓋到底條、左半邊地圖照樣看得到
        await ev(`document.querySelector('.lr-menu-btn[data-menu="items"]').click()`);
        await sleep(900);
        const P = await ev(`(()=>{const e=document.getElementById('tab-content-panel');const b=e.getBoundingClientRect();const c=getComputedStyle(e);return {open:document.getElementById('game-screen').classList.contains('sheet-open'),l:Math.round(b.left),r:Math.round(b.right),t:Math.round(b.top),b:Math.round(b.bottom),disp:c.display};})()`);
        ok(P.open && P.disp !== 'none', `[${tag}] 背包面板打開`);
        ok(P.l >= W * 0.5 && P.r <= W, `[${tag}] 面板在右側 (${P.l}..${P.r})`);
        ok(P.b <= H - (mob ? 108 : 132), `[${tag}] 面板不蓋底條 (底 ${P.b})`);
        const mapHit = await ev(`(()=>{const h=document.elementFromPoint(${Math.round(W * 0.25)},${Math.round(H * 0.4)});return !!h&&!h.closest('#tab-content-panel,#col-right');})()`);
        ok(mapHit, `[${tag}] 開面板時左半邊地圖不被蓋`);
        await shot('lrwide_' + tag + '_bag.png');
        await ev(`document.querySelector('.lr-menu-btn[data-menu="items"]').click()`);
        await sleep(600);
        await shot('lrwide_' + tag + '_main.png');
    }

    // 直拿手機：維持直式（480 寬內、聊天整條、選單列在底）
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
    await sleep(1500);
    const P2 = await rects();
    ok(P2.gs && P2.gs.r - P2.gs.l <= 480, '[直式] 遊戲寬 ≤ 480（直式不變）');
    ok(P2.log && P2.log.l === 0 && P2.log.r === 412, '[直式] 聊天框整條寬');
    ok(P2.menu && P2.menu.l === 0 && P2.menu.r === 412, '[直式] 選單列整條寬');
    ok(P2.mm && P2.mm.t < 200, '[直式] 小地圖在右上');
    const bgDisp = await ev(`getComputedStyle(document.getElementById('col-center'),'::after').content`);
    ok(!bgDisp || bgDisp === 'none' || bgDisp === 'normal', '[直式] 無橫式底條');
    await shot('lrwide_portrait.png');

    ok(errors.length === 0, 'JS 例外：' + (errors.length ? errors.slice(0, 3).join(' | ') : '無'));
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    ws.close(); br.kill(); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
