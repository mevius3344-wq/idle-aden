// 實測：原版地圖怪物一格一步（l1j passispeed）、一格一隻、站定才攻擊、打中幀才扣血、玩家鄰格才近戰
// 用法：node tools/_audit-mob-step.js [baseUrl] [--maps zone_13,talking_island]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const _mi = process.argv.indexOf('--maps');
const MAPS = _mi > 0 ? process.argv[_mi + 1].split(',') : ['talking_island', 'zone_14'];
const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : 'http://localhost:5199';
const PORT = 9343;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const LOG = [];
const ok = (name, cond, detail) => {
    const line = (cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '');
    console.log(line); LOG.push(line);
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mobstep-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--window-size=1280,900', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'mobstep';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='格步'+Date.now()%100000;
        startGame();
        for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv,30); try{ calcStats(); }catch(e){} player.hp=player.mhp;
    })()`);
    ok('LIN_MOB_TIMING 已載入', await ev('typeof LIN_MOB_TIMING==="object"&&Object.keys(LIN_MOB_TIMING).length>=200'));
    ok('妖魔原版節奏（走 800／攻 1320／打中 1160）', await ev('JSON.stringify(LIN_MOB_TIMING["妖魔"].slice(0,4))===JSON.stringify([800,1320,1160,1])'));

    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);

    for (const mapId of MAPS) {
        console.log('=== ' + mapId + ' ===');
        await go(mapId);
        await sleep(4000);
        await ev(`(async()=>{
            const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return Math.min(1e9,...(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&m.curHp>0).map(m=>Math.hypot(m._fx-px,m._fy-py)));};
            for(let k=0;k<30&&near()>200;k++){ exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,500)); }
        })()`);
        // 取樣：怪位置／步伐／攻擊與結算時刻
        await ev(`(()=>{
            clearInterval(window.__keep); clearInterval(window.__samp);
            window.__keep=setInterval(()=>{ try{ if(player&&!player.dead){ player.mhp=Math.max(player.mhp,99999); player.hp=player.mhp; } (mapState.mobs||[]).forEach(m=>{ if(m&&m.curHp>0&&!m._auditHp){ m._auditHp=1; m.hp=m.curHp=1e6; } }); }catch(e){} }, 50);
            const L=exploreActiveMapDef().lin;
            window.__S={steps:[],center:[0,0],occ:[0,0],occEx:[],hits:[],patk:[],back:0,diag:0};
            const S=window.__S, prev={};
            window.__samp=setInterval(()=>{
                const px=explorePlayerX(),py=explorePlayerY(), now=Date.now();
                const tiles={};
                for(const m of (mapState.mobs||[])){
                    if(!m||!(m.curHp>0)||m._fx==null) continue;
                    if(Math.hypot(m._fx-px,m._fy-py)>500) continue;
                    const t=linmapTileAt(L,m._fx,m._fy), c=linmapTileCenter(L,t.gx,t.gy);
                    const p=prev[m.uid]||(prev[m.uid]={});
                    if(!m._ls && m._linOnGrid){
                        S.center[1]++; if(Math.hypot(c.x-m._fx,c.y-m._fy)<=1.5) S.center[0]++;
                        const k=t.gx+','+t.gy; S.occ[1]++;
                        if(tiles[k]&&tiles[k]!==m.uid){ S.occEx.push(k); } else { S.occ[0]++; tiles[k]=m.uid; }
                    }
                    if(m._ls && (!p.ls || p.ls!==m._ls)){ p.ls=m._ls; p.k=0; S.steps.push({uid:m.uid,n:m.n,ms:m._ls.dur,t0:m._ls.t0,from:linmapTileAt(L,m._ls.fx,m._ls.fy),to:linmapTileAt(L,m._ls.tx,m._ls.ty),end:0}); p.si=S.steps.length-1; }
                    if(m._ls && p.ls===m._ls){
                        const k=Math.hypot(m._fx-m._ls.fx,m._fy-m._ls.fy); if(k+0.01<p.k) S.back++; p.k=k;
                    }
                    if(!m._ls && p.ls){ const st=S.steps[p.si]; if(st&&!st.end) st.end=now; p.ls=null; }
                }
            },16);
            const oc=enemyAttackChooseVictim;
            window.enemyAttackChooseVictim=function(m,i){
                try{ const a=m._animAct; S.hits.push({n:m.n,lin:!!LIN_MOB_TIMING[m.n],dt:a&&a.k==='attack'?Date.now()-a.t:-1,want:(LIN_MOB_TIMING[m.n]||[0,0,700])[2],td:exploreTileDist(m._fx,m._fy,explorePlayerX(),explorePlayerY()),rng:(LIN_MOB_TIMING[m.n]||[0,0,0,1])[3],ls:!!m._ls}); }catch(e){}
                return oc.apply(this,arguments);
            };
            const opa=playerAttack;
            window.playerAttack=function(){
                try{ const t=getTarget(); if(t&&t._fx!=null) S.patk.push({td:exploreTileDist(t._fx,t._fy,explorePlayerX(),explorePlayerY()),same:exploreTileDist(t._fx,t._fy,explorePlayerX(),explorePlayerY())===0}); }catch(e){}
                return opa.apply(this,arguments);
            };
            state.autoHunt=true;
        })()`);
        await sleep(16000);
        const S = await ev(`(()=>{clearInterval(window.__samp);state.autoHunt=false;return window.__S;})()`);
        if (!S || S.__err) { ok(mapId + ' 取樣', false, JSON.stringify(S)); continue; }
        const done = S.steps.filter((s) => s.end);
        const nb = done.filter((s) => Math.max(Math.abs(s.to.gx - s.from.gx), Math.abs(s.to.gy - s.from.gy)) === 1);
        // 連續兩步的起步間隔＝原版走速（主執行緒卡頓時偵測停步會晚，所以量起步間隔）
        const chain = [];
        for (let i = 0; i < S.steps.length; i++) for (let j = i + 1; j < S.steps.length; j++) {
            const a = S.steps[i], b = S.steps[j];
            if (b.uid !== a.uid) continue;
            if (b.t0 - a.t0 < a.ms * 1.6 && b.from.gx === a.to.gx && b.from.gy === a.to.gy) chain.push({ n: a.n, gap: Math.round(b.t0 - a.t0), ms: a.ms });
            break;
        }
        const timed = chain.filter((c) => Math.abs(c.gap - c.ms) <= 90);
        console.log('   steps', S.steps.length, 'done', done.length, 'hits', S.hits.length, 'patk', S.patk.length);
        ok(mapId + ' 怪有走路（一格一步）', done.length >= 2, 'n=' + done.length);
        ok(mapId + ' 每步都是相鄰一格（8 方向）', done.length && nb.length === done.length, nb.length + '/' + done.length);
        ok(mapId + ' 每步時間＝原版走速（±90ms）', chain.length >= 1 && timed.length >= chain.length * 0.9,
            timed.length + '/' + chain.length + ' ' + chain.slice(0, 4).map((c) => c.n + ':' + c.gap + '/' + c.ms).join(' '));
        ok(mapId + ' 停步時站在格子中心', S.center[1] > 0 && S.center[0] === S.center[1], S.center.join('/'));
        ok(mapId + ' 一格只站一隻怪', S.occEx.length === 0, S.occEx.slice(0, 5).join(' '));
        ok(mapId + ' 步內位移不倒退', S.back === 0, 'back=' + S.back);
        const hv = S.hits.filter((h) => h.lin && h.dt >= 0);
        ok(mapId + ' 怪有攻擊', S.hits.length >= 1, 'n=' + S.hits.length + ' 原版節奏 ' + hv.length);
        // 結算在 100ms 戰鬥 tick 內（無頭瀏覽器常卡頓）：不可早於打中幀，晚到的中位數 ≤ 200ms
        const lateMed = hv.map((h) => h.dt - h.want).sort((a, b) => a - b)[Math.floor(hv.length / 2)];
        ok(mapId + ' 打中幀才扣血（不早於打中幀）', !hv.length || hv.every((h) => h.dt >= h.want - 20) && lateMed <= 200,
            hv.slice(0, 5).map((h) => h.n + ':' + h.dt + '/' + h.want).join(' '));
        ok(mapId + ' 怪在自身攻擊距離內才打（站定）', S.hits.length && S.hits.every((h) => h.td <= h.rng + 1 && !h.ls),
            S.hits.slice(0, 5).map((h) => h.n + ' td' + h.td + '/r' + h.rng + (h.ls ? ' moving' : '')).join(' '));
        // 瞬移落地可能剛好落在怪格（怪下一步會讓開），最多容許 1 次
        ok(mapId + ' 玩家鄰格才近戰、不踩怪格', S.patk.length >= 1 && S.patk.every((p) => p.td <= 1) && S.patk.filter((p) => p.same).length <= 1,
            'n=' + S.patk.length + ' ' + S.patk.slice(0, 6).map((p) => p.td).join(','));
    }
    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(OUT, 'audit_mobstep_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
