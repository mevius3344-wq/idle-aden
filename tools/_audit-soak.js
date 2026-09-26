// 浸泡測試：長時間掛機＋各種切換情境下，玩家 sprite 是否異常消失
// 用法：node tools/_audit-soak.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9334;
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLER = `(()=>{
  if (window.__soak) return;
  const S = window.__soak = { phase:'boot', stats:{}, runMs:0, lastVis:true, cur:null };
  const vis = () => {
    const bv = document.getElementById('battle-view');
    if (!bv || bv.classList.contains('hidden')) return null;
    if (player && (player.dead || player.hp <= 0)) return null;
    if (typeof _teleportFxUntil !== 'undefined' && _teleportFxUntil > Date.now()) return null;
    const sp = document.getElementById('player-morph-sprite');
    if (!sp || !bv.contains(sp)) return 'missing';
    const cs = getComputedStyle(sp);
    if (cs.display === 'none') return 'disp';
    if (cs.visibility === 'hidden') return 'vis';
    if (+cs.opacity < 0.05) return 'op';
    const bd = sp.querySelector('.pm-body');
    if (!bd || !bd.getAttribute('src')) return 'nosrc';
    const r = bd.getBoundingClientRect(), b = bv.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return 'size0';
    if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) return 'offscreen';
    if (bd.complete && bd.naturalWidth === 0) return 'broken';
    return '';
  };
  setInterval(() => {
    const v = vis();
    const st = S.stats[S.phase] = S.stats[S.phase] || { samples:0, bad:0, maxGapMs:0, reasons:{}, map:'' };
    st.map = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
    if (v === null) { S.runMs = 0; return; }
    st.samples++;
    if (v) {
      st.bad++; st.reasons[v] = (st.reasons[v] || 0) + 1;
      S.runMs += 150; if (S.runMs > st.maxGapMs) st.maxGapMs = S.runMs;
    } else S.runMs = 0;
  }, 150);
})()`;

async function main() {
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'soak-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd,
        '--window-size=1280,800', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
        await sleep(250);
        try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {}
    }
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pend = new Map();
    const exc = [];
    ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') exc.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 300));
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 200) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) {
        await sleep(500);
        if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break;
    }
    console.log('boot', JSON.stringify(await ev(`(async()=>{
        window._authAccountForNames=()=>'soak';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='浸泡'+Date.now()%100000;
        startGame();
        await new Promise(r=>setTimeout(r,3000));
        player.lv=60; calcStats(); player.hp=player.mhp;
        return {cur:mapState.current};
    })()`)));
    await ev(SAMPLER);
    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    const phase = (n) => ev(`window.__soak.phase=${JSON.stringify(n)}`);
    const tank = () => ev(`player.hp=player.mhp; player.mp=player.mmp;`);

    await phase('A 銀騎士掛機30s'); await go('silver_knight');
    for (let i = 0; i < 30; i++) { await sleep(1000); await tank(); }

    await phase('B 傳送x5');
    for (let i = 0; i < 5; i++) { await ev('try{doTeleport(false)}catch(e){String(e)}'); await sleep(3000); await tank(); }

    await phase('C 死亡復活');
    await ev('killPlayer()'); await sleep(3000);
    console.log('revive', JSON.stringify(await ev('(()=>{try{revive()}catch(e){return String(e)} return mapState.current})()')));
    await sleep(3000); await go('silver_knight'); await sleep(6000); await tank();

    await phase('D 回村再出發x2');
    for (let i = 0; i < 2; i++) {
        await ev('try{returnToTown()}catch(e){String(e)}'); await sleep(3000);
        await go('silver_knight'); await sleep(6000); await tank();
    }

    await phase('E 省電模式20s');
    await ev('try{setPowerSaveOn(true)}catch(e){String(e)}');
    for (let i = 0; i < 20; i++) { await sleep(1000); await tank(); }
    await ev('try{setPowerSaveOn(false)}catch(e){String(e)}');
    await sleep(3000);

    await phase('F 分頁凍結後恢復');
    await send('Page.setWebLifecycleState', { state: 'frozen' }); await sleep(6000);
    await send('Page.setWebLifecycleState', { state: 'active' }); await sleep(6000); await tank();

    await phase('G 軍王之室10s'); await go('king_baranka_room');
    for (let i = 0; i < 10; i++) { await sleep(1000); await tank(); }
    await phase('G2 回銀騎士10s'); await go('silver_knight');
    for (let i = 0; i < 10; i++) { await sleep(1000); await tank(); }

    await phase('H 說話之島地監20s'); await go('zone_13');
    for (let i = 0; i < 20; i++) { await sleep(1000); await tank(); }
    await phase('I 底比斯祭壇10s'); await go('thebes_temple');
    for (let i = 0; i < 10; i++) { await sleep(1000); await tank(); }
    await phase('end');

    const stats = await ev('window.__soak.stats');
    for (const k of Object.keys(stats)) {
        const s = stats[k];
        if (k === 'boot' || k === 'end') continue;
        console.log(k.padEnd(18), 'map=' + s.map, 'samples=' + s.samples, 'bad=' + s.bad, 'maxGapMs=' + s.maxGapMs, JSON.stringify(s.reasons));
    }
    console.log('exceptions', exc.length, exc.slice(0, 8).join('\n'));
    ws.close(); br.kill(); process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
