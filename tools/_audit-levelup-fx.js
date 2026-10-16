// 實測：升級特效＝原版天堂 list.spr #2127（assets/fx/升級/lu_*），腳底錨定、screen 加亮、無英文 LEVEL UP!
// 用法：node tools/_audit-levelup-fx.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9427);
const OUT = path.join(__dirname, 'lin', '_out');
const ROOT = path.join(__dirname, '..');
const FX = path.join(ROOT, 'assets', 'fx', '升級');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    ok('匯出目錄存在', fs.existsSync(FX));
    ok('meta.json 標 #2127', (() => {
        try {
            const m = JSON.parse(fs.readFileSync(path.join(FX, 'meta.json'), 'utf8'));
            return m.gfx === 2127 && m.n === 26 && m.latticeOrigin && m.latticeOrigin.x === 72 && m.latticeOrigin.y === 132;
        } catch (e) { return false; }
    })());
    let miss = [];
    for (let i = 0; i < 26; i++) if (!fs.existsSync(path.join(FX, 'lu_' + i + '.png'))) miss.push(i);
    ok('lu_0..25.png 齊全', miss.length === 0, miss.slice(0, 5).join(','));

    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'alv-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const exc = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            exc.push(String((d.exception && d.exception.description) || d.text).split('\n')[0] + ' @' + (d.url || '') + ':' + d.lineNumber);
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr, to) => {
        const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(to || 20000).then(() => ({ __timeout: true }))]);
        if (r.__timeout) return { __timeout: true };
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'lv' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'lv-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'lv-test', clientId: 'lv-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('升' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} try{ window.__vfxOff=false; }catch(e2){} })()`);
    await sleep(3000);

    ok('vfxLevelUp／LEVELUP_FX 已載入', await ev('typeof vfxLevelUp==="function"&&typeof LEVELUP_FX==="object"&&LEVELUP_FX.n===26'));

    const goMap = (mid) => ev(`(async()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); await new Promise(r=>setTimeout(r,1500)); return mapState.current;})()`);

    for (const sc of [
        { tag: '奇岩村莊', map: 'town_giran', shot: '_levelup_giran.jpg' },
        { tag: '原版野外', map: 'zone_13', shot: '_levelup_field.jpg' }
    ]) {
        console.log('\n[' + sc.tag + ']');
        const cur = await goMap(sc.map);
        ok('進入 ' + sc.map, cur === sc.map, String(cur));
        await sleep(1200);
        await ev(`(()=>{try{window.__vfxOff=false;}catch(e){} vfxLevelUp();})()`);
        await sleep(200);
        const info = await ev(`(()=>{
            const el=document.querySelector('#vfx-layer img.vfx-levelup')||document.querySelector('img.vfx-levelup');
            if(!el) return null;
            const pr=(typeof _pmCasterRect==='function')?_pmCasterRect():null;
            const er=el.getBoundingClientRect();
            const src=String(el.currentSrc||el.src||'');
            const fake=!!document.querySelector('.vfx-lvtext,.vfx-lvring');
            const textHit=[...document.querySelectorAll('#vfx-layer *')].some(n=>/LEVEL\\s*UP/i.test(n.textContent||''));
            let footY=pr?pr.bottom:null, footX=pr?pr.left+pr.width/2:null;
            const ox=er.left+(72/192)*er.width, oy=er.top+(132/192)*er.height;
            return {
                srcOk:/assets\\/fx\\/%E5%8D%87%E7%B4%9A\\/lu_|assets\\/fx\\/升級\\/lu_/.test(src)||src.indexOf('lu_')>=0&&src.indexOf('fx')>=0,
                blend:getComputedStyle(el).mixBlendMode,
                fake, textHit,
                w:Math.round(er.width), h:Math.round(er.height),
                dx:footX!=null?Math.abs(ox-footX):null,
                dy:footY!=null?Math.abs(oy-footY):null,
                vis:er.width>0&&getComputedStyle(el).display!=='none'
            };
        })()`);
        ok('播出原版幀（lu_*）', info && info.srcOk && info.vis, JSON.stringify(info));
        ok('screen 加亮混合', info && info.blend === 'screen', info && info.blend);
        ok('無舊 CSS 金環／LEVEL UP 文字', info && !info.fake && !info.textHit, JSON.stringify(info && { fake: info.fake, textHit: info.textHit }));
        ok('錨在腳底附近（origin 對齊）', info && info.dx != null && info.dx < 40 && info.dy < 40, JSON.stringify(info && { dx: info.dx, dy: info.dy, w: info.w }));
        await shot(sc.shot);
        await sleep(3200);
        const gone = await ev(`!document.querySelector('img.vfx-levelup')`);
        ok('播完自動消失', gone === true, String(gone));
    }

    // 確認升級路徑仍呼叫 vfxLevelUp（不改數值邏輯，只觸發一次視覺）
    const wired = await ev(`(()=>{const s=String(checkLvUp);return /vfxLevelUp\\(\\)/.test(s)&&/playSfx\\(['"]levelup['"]\\)/.test(s);})()`);
    ok('checkLvUp 仍呼叫 vfxLevelUp＋levelup 音效', wired === true);

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {}
    try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
