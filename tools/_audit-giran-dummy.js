// 實測：奇岩村莊 3 個木頭人（取代新兵修練場）、城鎮按 AUTO 開傳送選單、原版地圖畫面拉遠
// 用法：node tools/_audit-giran-dummy.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9394;
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'gdum-'));
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
    const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'gd' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'gd-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'gd-test', clientId: 'gd-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('木' + stamp)};
        startGame(); for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){} })()`);
    await sleep(3000);

    const a = await ev(`(()=>{
        const ds=(mapState.mobs||[]).filter(m=>m&&m._townDummy);
        const sel=document.getElementById('map-select');
        state.autoHunt=false; mapState.targetIdx=-1;
        return {map:mapState.current, n:ds.length, pos:ds.map(m=>m._fx+','+m._fy).join(' '), names:ds.map(m=>m.n).join(','),
            cards:document.querySelectorAll('#mob-list .mob-target').length,
            spots:JSON.stringify(townDummySpots('town_giran')),
            zoom:exploreLinZoom(), trainingOpt:[...sel.options].some(o=>o.value==='training'),
            regionTraining:JSON.stringify(MAP_REGIONS).indexOf('"training"')>=0};
    })()`);
    ok('創角出生在奇岩', a.map === 'town_giran', a.map);
    ok('奇岩有 3 個木頭人', a.n === 3 && /^木頭人,木頭人,木頭人$/.test(a.names), a.n + ' ' + a.names);
    ok('木頭人站在指定格子', a.pos === '600,1080 504,1080 408,1080', a.pos);
    ok('木頭人有畫出來', a.cards >= 3, 'cards ' + a.cards);
    ok('地圖選單沒有新兵修練場', !a.trainingOpt && !a.regionTraining);
    ok('原版地圖畫面拉遠（1280×720 → 1.6 倍）', a.zoom === 1.6, 'zoom ' + a.zoom);
    await shot('_giran_dummy.jpg');

    // AUTO 開著也不會自己去打木頭人（回村買東西不被拖走）
    const p0 = await ev(`(()=>{state.autoHunt=true;mapState.targetIdx=-1;return Math.round(explorePlayerX())+','+Math.round(explorePlayerY())})()`);
    await sleep(6000);
    const p1 = await ev(`(()=>{const t=mapState.mobs[mapState.targetIdx];return Math.round(explorePlayerX())+','+Math.round(explorePlayerY())+(t&&t._townDummy?' 鎖定木頭人':'')})()`);
    ok('AUTO 不會自動打城鎮木頭人（停在出生點）', p0 === '744,1056' && p0 === p1, p0 + ' → ' + p1);
    await ev('state.autoHunt=false;mapState.targetIdx=-1');

    // 木頭人不走動：5 秒後位置不變
    await sleep(5000);
    const b = await ev(`(mapState.mobs||[]).filter(m=>m&&m._townDummy).map(m=>m._fx+','+m._fy).join(' ')`);
    ok('木頭人 5 秒內不走動', b === '600,1080 504,1080 408,1080', b);

    // 點木頭人本體可鎖定（點擊範圍縮小後仍點得到）
    const clk = await ev(`(()=>{
        const idx=mapState.mobs.findIndex(m=>m&&m._townDummy&&m._fx===504);
        const p=exploreWorldToClient(504,1080); if(!p) return {err:'no p'};
        const z=exploreLinZoom(); const x=p.x, y=p.y-20*z;
        const h=document.elementFromPoint(x,y); const card=h&&h.closest&&h.closest('.mob-target');
        if(card) card.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));
        return {idx, tgt:mapState.targetIdx, uid:card&&card.getAttribute('data-uid'), want:String(mapState.mobs[idx].uid)};
    })()`);
    ok('點木頭人本體可鎖定', clk && clk.uid === clk.want && clk.tgt === clk.idx, JSON.stringify(clk));
    await ev('mapState.targetIdx=-1');

    // 鎖定木頭人＝走過去打、打死給經驗、約 1.5 秒重生
    const c = await ev(`(async()=>{
        const idx=mapState.mobs.findIndex(m=>m&&m._townDummy&&m._fx===600&&m._fy===1080&&m.curHp>0);
        const uid0=mapState.mobs[idx].uid; const exp0=(player.exp||0)+(player.lv||1)*1e6; const hp0=player.hp;
        player.hp=player.mhp; state.autoHunt=true; mapState.mobs[idx]._picked=true; setTarget(idx);
        let killed=false, respawn=false, t0=Date.now();
        for(let i=0;i<300;i++){ await new Promise(r=>setTimeout(r,100));
            const m=mapState.mobs[idx];
            if(!killed && (!m||m.uid!==uid0)) killed=Date.now()-t0;
            if(killed && m && m.uid!==uid0 && m.curHp>0){ respawn=m._fx+','+m._fy; break; }
            if(!killed && m && mapState.targetIdx!==idx) setTarget(idx);
        }
        return {killed, respawn, gained:((player.exp||0)+(player.lv||1)*1e6)>exp0, hpOk:player.hp>0, map:mapState.current};
    })()`);
    ok('鎖定木頭人可打死', !!c.killed, JSON.stringify(c));
    ok('打木頭人有經驗', c.gained);
    ok('木頭人在原位重生', c.respawn === '600,1080', String(c.respawn));
    ok('木頭人不還手（玩家沒扣血）', c.hpOk && c.map === 'town_giran');

    // 城鎮按 AUTO：維持開、開傳送選單
    const d = await ev(`(async()=>{
        const box=document.getElementById('town-interaction-container'); if(box) box.classList.add('hidden');
        const r=[]; for(let k=0;k<2;k++){ document.getElementById('chud-auto').click(); await new Promise(r=>setTimeout(r,300));
            r.push({auto:state.autoHunt, tp:!!box&&!box.classList.contains('hidden')&&(document.getElementById('interaction-npc-name')||{}).innerText==='傳送'});
            if(box) box.classList.add('hidden'); }
        return r;
    })()`);
    ok('城鎮按 AUTO 開傳送選單且維持 AUTO', Array.isArray(d) && d.every((x) => x.auto && x.tp), JSON.stringify(d));

    // 野外按 AUTO 仍可正常開關
    await ev(`(()=>{const sel=document.getElementById('map-select');sel.value='talking_island';changeMap(true);return 1})()`);
    await sleep(3000);
    const e = await ev(`(async()=>{ const r=[]; for(let k=0;k<2;k++){ document.getElementById('chud-auto').click(); await new Promise(r=>setTimeout(r,200)); r.push(state.autoHunt); } return r; })()`);
    ok('野外 AUTO 可開關', Array.isArray(e) && e[0] === false && e[1] === true, JSON.stringify(e));
    ok('野外沒有木頭人', await ev(`!(mapState.mobs||[]).some(m=>m&&m._townDummy)`));

    ok('無 JS 例外', exc.length === 0, exc.slice(0, 3).join(' | '));
    try { ws.close(); } catch (e2) {} try { br.kill(); } catch (e3) {}
    console.log(fails ? '\nFAIL ' + fails : '\nPASS');
    process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
