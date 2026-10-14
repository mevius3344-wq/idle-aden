// 實測：原版地圖走路時腳下不冒大陰影圈（只留人物圖自帶的原版影子）
// 用法：node tools/_audit-walk-shadow.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9398);
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cbub-'));
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
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'cb' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'cb-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'cb-test', clientId: 'cb-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('泡' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(3000);

    const probe = () => ev(`(()=>{const bv=document.getElementById('battle-view');const pm=document.getElementById('player-morph-sprite');
        const fp=document.getElementById('explore-foot-patch');const fr=fp?fp.getBoundingClientRect():null;const af=getComputedStyle(pm,'::after');
        const puffs=[...document.querySelectorAll('#battle-view .explore-grass-puff')].filter(e=>getComputedStyle(e).display!=='none').length;
        return {walking:bv.classList.contains('is-explore-walking'),lin:bv.classList.contains('is-linmap'),
            patch:fp&&getComputedStyle(fp).display!=='none'&&Number(getComputedStyle(fp).opacity)>0?Math.round(fr.width)+'x'+Math.round(fr.height):'',
            after:af.display!=='none'&&af.content!=='none'?af.width+'x'+af.height:'',puffs,
            shadow:!!pm.querySelector('.pm-shadow[src]')};})()`);
    const p = await ev(`(()=>{const r=document.querySelector('#player-morph-sprite .pm-body').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.bottom)};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x + 320, y: p.y + 60, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x + 320, y: p.y + 60, button: 'left', clickCount: 1 });
    await ev(`(()=>{window.__lr=0;const hook=(proto,k)=>{const d=Object.getOwnPropertyDescriptor(proto,k);Object.defineProperty(proto,k,{configurable:true,get(){if(window.__wrOn&&(this.id==='battle-view'||(this.classList&&this.classList.contains('pm-body'))))window.__lr++;return d.get.call(this);}});};
        hook(Element.prototype,'clientWidth');hook(Element.prototype,'clientHeight');hook(HTMLElement.prototype,'offsetHeight');hook(HTMLElement.prototype,'offsetWidth');})()`);
    await ev(`(()=>{const map=document.getElementById('explore-linmap');const pm=document.getElementById('player-morph-sprite');window.__wr=[];window.__wrOn=true;
        const loop=(t)=>{const b=pm.querySelector('img.pm-body');window.__wr.push([t,map.style.transform,b?b.src:'']);if(window.__wrOn)requestAnimationFrame(loop);};requestAnimationFrame(loop);})()`);
    let seenWalk = false, bad = [];
    for (let i = 0; i < 16; i++) {
        await sleep(120);
        const r = await probe();
        if (r.walking) seenWalk = true;
        if (r.patch || r.after || r.puffs) bad.push(JSON.stringify(r));
        if (i === 5) await shot('_walk_shadow.jpg');
    }
    ok('有走起來（is-explore-walking）', seenWalk);
    const rhythm = await ev(`(()=>{window.__wrOn=false;const r=window.__wr;const ch=[];let both=0,split=0;
        for(let i=1;i<r.length;i++){const pc=r[i][1]!==r[i-1][1],sc=r[i][2]!==r[i-1][2];if(pc)ch.push(r[i][0]);if(pc&&sc)both++;else if(pc||sc)split++;}
        const iv=ch.slice(2).map((t,i)=>t-ch[i+1]).sort((a,b)=>a-b);return {n:iv.length,med:iv.length?Math.round(iv[iv.length>>1]):0,both,split,frames:r.length,layoutReads:window.__lr};})()`);
    // 每幀讀 #battle-view／人物圖的版面大小＝夾在寫樣式之間強制重排（走路一頓一頓）；快取後整段走路只剩換新圖時量一次
    ok('走路不每幀讀版面大小（#battle-view／人物圖，強制重排）', rhythm && rhythm.frames > 60 && rhythm.layoutReads <= 12, 'reads=' + (rhythm && rhythm.layoutReads) + ' frames=' + (rhythm && rhythm.frames));
    ok('走路節奏穩（每幀約 160ms、位移與換幀同一畫面）', rhythm && rhythm.n >= 4 && rhythm.med >= 145 && rhythm.med <= 175 && rhythm.split <= 2, JSON.stringify(rhythm));
    ok('原版地圖走路腳下無大陰影圈／草屑（foot-patch、CSS 橢圓）', bad.length === 0, bad.slice(0, 2).join(' | '));
    const st = await probe();
    ok('原版影子層仍在（.pm-shadow）', st.lin && st.shadow, JSON.stringify(st));

    const dps = await ev(`(()=>{const e=document.getElementById('chud-dps');return e?getComputedStyle(e).display+'/'+e.getClientRects().length:'none';})()`);
    ok('左下 擊殺／EXP/分 一排不顯示', dps === 'none' || /^none\//.test(dps), dps);

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
