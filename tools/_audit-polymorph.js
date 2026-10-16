// 實測：使用變形卷軸（象牙塔變身卷軸／自動變身）不會讓整個畫面卡住
//   原版地圖＋奇岩村莊、電腦 1280×720＋手機 412×892：用卷軸後頁面照常回應、畫面幀照常跑、
//   每幀不重排上百次（exploreGroundYLive 同一工作只量一次）、人物換成變身圖、點地照樣走、無 JS 例外
// 用法：node tools/_audit-polymorph.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9412);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'apoly-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const exc = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; exc.push(String((d.exception && d.exception.description) || d.text).split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber); }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr, to) => {
        const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(to || 20000).then(() => ({ __timeout: true }))]);
        if (r.__timeout) return { __timeout: true };
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((m) => [m.name, m.value]));

    const stamp = Date.now() % 100000, acct = 'pl' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'pl-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'pl-test', clientId: 'pl-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable'); await send('Performance.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('變' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(3000);
    ok('新手禮包有象牙塔變身卷軸', await ev(`player.inv.some(i=>i.id==='ivt_scroll_poly')`));

    const goMap = (mid) => ev(`(async()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); await new Promise(r=>setTimeout(r,1500)); return mapState.current;})()`);
    const frames = () => ev(`new Promise(res=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else res(n)};requestAnimationFrame(f);})`, 10000);

    const scenarios = [
        { tag: '電腦 原版野外', w: 1280, h: 720, map: 'zone_13', silent: false },
        { tag: '電腦 奇岩村莊', w: 1280, h: 720, map: 'town_giran', silent: false },
        { tag: '手機 原版野外（自動變身）', w: 412, h: 892, map: 'zone_13', silent: true }
    ];
    for (const sc of scenarios) {
        console.log('\n[' + sc.tag + ']');
        await send('Emulation.setDeviceMetricsOverride', { width: sc.w, height: sc.h, deviceScaleFactor: sc.w < 700 ? 2 : 1, mobile: sc.w < 700 });
        await ev(`(()=>{player.buffs.poly=0;player.poly=null;try{updateUI()}catch(e){}})()`);
        const cur = await goMap(sc.map);
        ok('進入 ' + sc.map, cur === sc.map, String(cur));
        await sleep(6000);
        await ev(`(()=>{window.__rafN=0;window.__rafOn=true;const f=()=>{window.__rafN++;if(window.__rafOn)requestAnimationFrame(f);};requestAnimationFrame(f);})()`);
        const m0 = await metrics();
        const used = await ev(`(()=>{const it=player.inv.find(i=>i.id==='ivt_scroll_poly');const t=performance.now();useItem(it.uid${sc.silent ? ',true' : ''});return {ms:Math.round(performance.now()-t),poly:player.poly&&player.poly.n,buff:player.buffs.poly}})()`, 10000);
        ok('用卷軸立即返回、已變身', used && !used.__timeout && used.ms < 500 && used.poly && used.buff > 0, JSON.stringify(used));
        let maxGap = 0, last = Date.now(), morphSrc = '';
        for (let i = 0; i < 16; i++) {
            await sleep(500);
            const a = await ev(`(()=>{const b=document.querySelector('#player-morph-sprite img.pm-body');return b?(b.getAttribute('src')||''):''})()`, 4000);
            const now = Date.now(); maxGap = Math.max(maxGap, now - last); last = now;
            if (a && a.__timeout) { maxGap = 99999; break; }
            if (/morphanim|assets\/anim\//.test(a)) morphSrc = a;
        }
        ok('頁面一直有回應（輪詢間隔 < 2 秒）', maxGap < 2000, 'max ' + maxGap + 'ms');
        for (let i = 0; i < 24 && !morphSrc; i++) {
            await sleep(500);
            const a = await ev(`(()=>{const b=document.querySelector('#player-morph-sprite img.pm-body');return b?(b.getAttribute('src')||''):''})()`, 4000);
            if (/morphanim|assets\/anim\//.test(a)) morphSrc = a;
        }
        const n = await frames();
        const m1 = await metrics();
        const rafN = await ev(`(()=>{window.__rafOn=false;return window.__rafN})()`);
        ok('畫面幀照常跑（2 秒 ≥ 30 幀）', typeof n === 'number' && n >= 30, String(n));
        const layouts = m1.LayoutCount - m0.LayoutCount;
        ok('每幀重排次數正常（< 3，修前約 10）', rafN > 0 && layouts / rafN < 3, layouts + ' 次重排／' + rafN + ' 幀');
        const fy = await ev(`(()=>{const bv=document.getElementById('battle-view');let reads=0;const d=Object.getOwnPropertyDescriptor(Element.prototype,'clientHeight');
            Object.defineProperty(bv,'clientHeight',{configurable:true,get(){reads++;return d.get.call(this);}});
            return new Promise(res=>setTimeout(()=>{delete bv.clientHeight;res(reads)},1000));})()`, 8000);
        ok('戰場高度每秒讀取次數不爆量（< 600）', typeof fy === 'number' && fy < 600, String(fy));
        ok('人物換成變身圖（morphanim 或 anim 八向）', !!morphSrc, morphSrc.split('/').slice(-3).join('/'));
        const p = await ev(`(()=>{const r=document.querySelector('#player-morph-sprite .pm-body').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.bottom),w:Math.round(r.width)};})()`);
        ok('變身人物看得到（寬 > 0）', p && p.w > 0, JSON.stringify(p));
        const pos0 = await ev(`[explorePlayerX(),explorePlayerY()].map(Math.round).join(',')`);
        const tx = Math.max(20, Math.min(sc.w - 20, p.x + (sc.w < 700 ? 80 : 260))), ty = sc.w < 700 ? Math.max(80, p.y - 80) : p.y + 30;
        // 有 assets/anim 八向 walk 的變身：邊走邊取樣，不可只循環 idle（「圖片在跑人不走」）
        const walkChk = await ev(`(async()=>{
            const name=player.poly&&player.poly.n;
            const has8=typeof _morphHasAnim8==='function'&&_morphHasAnim8(name);
            const el=document.getElementById('player-morph-sprite');
            const afterDisp=el?getComputedStyle(el,'::after').display:'';
            const noEll=!!(el&&el.classList.contains('pm-no-ellipse'));
            if(!has8) return {skip:true,name,noEll,afterDisp};
            // 用程式下令走路（手機點地座標容易點到 UI）
            try{
                const wx=explorePlayerX()+240, wy=explorePlayerY()+120;
                const c=typeof exploreWorldToClient==='function'?exploreWorldToClient(wx,wy):null;
                if(c&&typeof exploreSetTapMoveFromScreen==='function') exploreSetTapMoveFromScreen(c.x,c.y);
            }catch(e){}
            const samples=[];
            for(let i=0;i<14;i++){
                await new Promise(r=>setTimeout(r,120));
                const bd=document.querySelector('#player-morph-sprite img.pm-body');
                const src=bd?(bd.getAttribute('src')||''):'';
                const mov=typeof exploreIsMoving==='function'&&exploreIsMoving();
                samples.push({mov,src:src.replace(/^.*assets\\//,'assets/').split('?')[0]});
            }
            const whileMove=samples.filter(s=>s.mov);
            const walkN=whileMove.filter(s=>/walk_/.test(s.src)).length;
            const idleN=whileMove.filter(s=>/idle_/.test(s.src)).length;
            return {name,has8,moveSamples:whileMove.length,walkN,idleN,noEll,afterDisp,src0:samples[0]&&samples[0].src};
        })()`, 10000);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tx, y: ty, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', clickCount: 1 });
        await sleep(2500);
        const pos1 = await ev(`[explorePlayerX(),explorePlayerY()].map(Math.round).join(',')`);
        ok('變身後點地照樣走', pos0 !== pos1, pos0 + ' → ' + pos1);
        if (walkChk && !walkChk.skip && !walkChk.__timeout && !walkChk.__err) {
            ok('變身移動播 walk 幀（非 idle 空跑）', walkChk.moveSamples >= 3 && walkChk.walkN >= 2 && walkChk.idleN === 0, JSON.stringify(walkChk));
            ok('變身不疊 CSS 腳下黑橢圓', walkChk.noEll || walkChk.afterDisp === 'none', JSON.stringify({ noEll: walkChk.noEll, afterDisp: walkChk.afterDisp }));
        } else if (walkChk && walkChk.skip) {
            ok('變身不疊 CSS 腳下黑橢圓', walkChk.noEll || walkChk.afterDisp === 'none', JSON.stringify(walkChk));
        }
        try { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.mkdirSync(path.join(__dirname, 'lin', '_out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'lin', '_out', '_poly_' + sc.map + '_' + sc.w + '.jpg'), Buffer.from(s.result.data, 'base64')); } catch (eS) {}
    }

    ok('\n無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
