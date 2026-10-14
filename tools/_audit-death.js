// 實測：死亡照原版天堂——倒地不自動回村、跳「重新開始」，按下才回村甦醒（低血）
// 用法：node tools/_audit-death.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
let PORT = 9421;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    PORT = await new Promise((r) => { const s = require('net').createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'death-'));
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
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };

    const stamp = Date.now() % 100000, acct = 'dz' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'dz-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'dz-test', clientId: 'dz-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.__alerts=[];window.alert=function(m){window.__alerts.push(String(m))};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"') === true) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('死' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(2500);
    const cr = await ev(`({inGame:!document.getElementById('game-screen').classList.contains('hidden')&&!!player.name,alerts:window.__alerts})`);
    ok('創角進入遊戲', cr && cr.inGame, JSON.stringify(cr));
    await ev(`(()=>{const s=document.getElementById('map-select');if(![...s.options].some(o=>o.value==='silver_knight')){const o=document.createElement('option');o.value='silver_knight';s.appendChild(o);}s.value='silver_knight';changeMap(true);})()`);
    await sleep(3000);
    const field = await ev('mapState.current');

    await ev('killPlayer()');
    await sleep(2500);
    const st = await ev(`(()=>{const d=document.getElementById('lin-death');const b=document.getElementById('lin-death-restart');const r=b?b.getBoundingClientRect():null;
        return {map:mapState.current,dead:!!player.dead,hp:player.hp,dlg:!!d&&!d.classList.contains('hidden')&&getComputedStyle(d).display!=='none',btn:r?{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}:null};})()`);
    ok('死亡 2.5 秒後仍在原地圖（不自動回村）', st.map === field && st.dead, JSON.stringify({ field, map: st.map, dead: st.dead }));
    ok('跳出「重新開始」視窗', st.dlg && st.btn && st.btn.w > 40);
    await shot('_death_dialog.jpg');
    // 死亡幀第一次用到才下載，機器忙時晚 1～3 秒才換上（期間 _pmState.act 已是 death）
    let corpse = null;
    for (let i = 0; i < 24; i++) {
        corpse = await ev(`(()=>{const b=document.querySelector('#player-morph-sprite .pm-body');const f=document.querySelector('#lin-death .lin-death-frame');if(!b||!f)return null;
        const r=b.getBoundingClientRect(),q=f.getBoundingClientRect();return {src:(b.getAttribute('src')||'').replace(/.*\\//,''),vis:getComputedStyle(b).visibility,body:[r.left|0,r.top|0,r.width|0,r.height|0],dlgTop:q.top|0,dlgBottom:q.bottom|0,pad:getComputedStyle(f.parentElement).paddingTop,ai:getComputedStyle(f.parentElement).alignItems};})()`);
        if (corpse && /death/.test(corpse.src) && corpse.body[2] > 10) break;
        await sleep(250);
    }
    if (process.env.DBG) console.log(await ev(`(async()=>{const l=[...document.querySelectorAll('link[rel=stylesheet]')].find(x=>/lin-menus/.test(x.href));const t1=await (await fetch(l.href)).text();const t2=await (await fetch(l.href,{cache:'no-store'})).text();return l.href+' cached:'+/padding-top: max/.test(t1)+' fresh:'+/padding-top: max/.test(t2);})()`));
    if (process.env.DBG) console.log(await ev(`(()=>{const e=document.getElementById('lin-death');const out=[];for(const ss of document.styleSheets){let rs;try{rs=ss.cssRules}catch(x){continue}
        const walk=(rs)=>{for(const r of rs){if(r.cssRules&&!r.selectorText){walk(r.cssRules);continue;}if(!r.selectorText)continue;try{if(e.matches(r.selectorText)&&(r.style.alignItems||r.style.padding||r.style.paddingTop))out.push((ss.href||'inline').replace(/.*\\//,'')+' '+r.selectorText+' {'+r.style.cssText.slice(0,120)+'}');}catch(x){}}};walk(rs);}
        return out.join('\\n')+'\\nINLINE:'+e.getAttribute('style')+' parent:'+e.parentElement.id;})()`));
    ok('倒地屍體看得到（死亡幀、不被視窗蓋住）', corpse && /death/.test(corpse.src) && corpse.body[2] > 10 && corpse.body[1] + corpse.body[3] * 0.4 > corpse.dlgBottom, JSON.stringify(corpse));

    const pos0 = await ev(`(()=>{const r=document.querySelector('#explore-linmap');return r?r.style.transform:'';})()`);
    await click(900, 560);
    await sleep(1200);
    const pos1 = await ev(`(()=>{const r=document.querySelector('#explore-linmap');return r?r.style.transform:'';})()`);
    ok('死亡中點地面不會走', pos0 === pos1, pos0 + ' / ' + pos1);
    const rt = await ev('(()=>{const r=returnToTown();return {r,map:mapState.current,dead:!!player.dead};})()');
    ok('死亡中回村鈕無效', rt.map === field && rt.dead, JSON.stringify(rt));
    const tp = await ev('(()=>{const r=openTeleportMenu();return {r,map:mapState.current};})()');
    ok('死亡中傳送選單無效', tp.r === false && tp.map === field, JSON.stringify(tp));

    // 甦醒當下的血量（之後自動喝紅水會補血，量 400ms 後的值會碰運氣）
    await ev(`(()=>{const o=window.revive;window.revive=function(){const r=o.apply(this,arguments);window.__revHp=[player.hp,player.mhp];return r;};})()`);
    await click(st.btn.x, st.btn.y);
    await sleep(400);
    const af = await ev(`(()=>{const d=document.getElementById('lin-death');return {map:mapState.current,dead:!!player.dead,hp:player.hp,mhp:player.mhp,rev:window.__revHp||null,dlg:!!d&&!d.classList.contains('hidden')};})()`);
    ok('按「重新開始」回到主城甦醒', af.map === 'town_giran' && !af.dead, JSON.stringify(af));
    ok('甦醒 HP 不為 0 也不是滿血', !!af.rev && af.rev[0] >= 1 && af.rev[0] < af.rev[1], JSON.stringify(af.rev) + ' 400ms 後 ' + af.hp + '/' + af.mhp);
    ok('視窗收起', !af.dlg);
    await shot('_death_after.jpg');

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
