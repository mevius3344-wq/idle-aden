// 實測：說話頭上冒對話泡泡（自己／同圖玩家），5 秒後消失
// 用法：node tools/_audit-chat-bubble.js [baseUrl]
require('./_gm-cleanup').autoCleanup();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9397;
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

    ok('chatBubbleShow 已載入', await ev('typeof chatBubbleShow==="function"'));
    const msg = '大家好 一起打怪嗎';
    await ev(`(()=>{const i=document.getElementById('world-input');i.value=${JSON.stringify(msg)};worldChannelAsk();})()`);
    await sleep(400);
    const b1 = await ev(`(()=>{const b=document.querySelector('#player-morph-sprite .chat-bubble');if(!b)return null;
        const r=b.getBoundingClientRect(),p=document.querySelector('#player-morph-sprite .pm-body').getBoundingClientRect();
        return {text:b.textContent,vis:getComputedStyle(b).display!=='none'&&r.width>0,above:r.bottom<=p.top+p.height*0.35,cx:Math.abs((r.left+r.width/2)-(p.left+p.width/2))};})()`);
    ok('自己說話＝頭上冒泡泡', b1 && b1.text === msg && b1.vis, JSON.stringify(b1));
    ok('泡泡在頭上且置中', b1 && b1.above && b1.cx < 8, JSON.stringify(b1));
    await shot('_chat_bubble_self.jpg');

    await ev(`(()=>{const bv=document.getElementById('battle-view');
        const el=document.createElement('div');el.className='party-sprite remote-party is-peer';el.setAttribute('data-peer-key','fake:1');el.setAttribute('data-peer-name','路人甲');
        const pm=document.getElementById('player-morph-sprite');
        el.style.cssText='position:absolute;left:calc('+(pm.style.left||'50%')+' + 160px);bottom:'+(pm.style.bottom||'200px')+';width:60px;height:80px;z-index:50';
        bv.appendChild(el);
        _chatDeliver({ch:'world',name:'路人甲',text:'你好',id:'cbfake'+Date.now(),t:Date.now(),classic:!!player.classicMode},true,false);})()`);
    await sleep(300);
    const b2 = await ev(`(()=>{const b=document.querySelector('[data-peer-key="fake:1"] .chat-bubble');return b?b.textContent:null;})()`);    ok('同圖玩家說話＝他頭上冒泡泡', b2 === '你好', String(b2));

    await ev(`_chatDeliver({ch:'world',name:'不在畫面',text:'遠方',id:'cbfar'+Date.now(),t:Date.now(),classic:!!player.classicMode},true,false)`);
    const b3 = await ev(`document.querySelectorAll('#battle-view .chat-bubble').length`);
    ok('不在畫面的人不冒泡泡', b3 === 2, String(b3));

    await sleep(5400);
    const b4 = await ev(`document.querySelectorAll('#battle-view .chat-bubble').length`);
    ok('5 秒後泡泡消失', b4 === 0, String(b4));
    await ev(`(()=>{const e=document.querySelector('[data-peer-key="fake:1"]');if(e)e.remove();})()`);

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
