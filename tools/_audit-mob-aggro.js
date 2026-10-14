// 實測：原版地圖主動怪看得到身旁玩家、追到攻擊距離就播攻擊動作並打中（不再只在旁邊跑來跑去）
//   仇恨／追擊／拴繩用格數（LIN_MOB_SIGHT_T 6／CHASE 12／LEASH 14），拴繩整段走回家才重新索敵；被動怪滿血不索敵、被打才反擊
// 用法：node tools/_audit-mob-aggro.js [baseUrl] [--maps zone_06,zone_13]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const _mi = process.argv.indexOf('--maps');
const MAPS = _mi > 0 ? process.argv[_mi + 1].split(',') : ['zone_06', 'zone_13', 'zone_01', 'elf_forest'];
const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : 'http://localhost:5199';
const PORT = require('./_cdp-port')(9467);
const SECS = 22;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const LOG = [];
const ok = (name, cond, detail) => {
    const line = (cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '');
    LOG.push(line);
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    setTimeout(() => { console.error('TIMEOUT\n' + LOG.join('\n')); process.exit(2); }, 9 * 60 * 1000).unref();
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mobaggro-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--window-size=1280,900', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 120 && !(targets && targets.some((t) => t.type === 'page')); i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
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
    // 實測中別的改版會讓伺服器版本變動 → 自動更新重載頁面打斷取樣：/api/version 一律回頁面自己的版本
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};(function(){var f=window.fetch;window.fetch=function(u,o){try{if(/\\/api\\/version/.test(String(u&&u.url||u))&&typeof GAME_VERSION!=="undefined")return Promise.resolve(new Response(JSON.stringify({ok:true,gameVersion:GAME_VERSION}),{headers:{"Content-Type":"application/json"}}));}catch(e){}return f.apply(this,arguments);};})();' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    ok('載入的 44-map-explore 為格數仇恨版', await ev(`fetch('/js/44-map-explore.js?v='+GAME_VERSION).then(r=>r.text()).then(t=>/LIN_MOB_SIGHT_T/.test(t)&&/_linLeashBack/.test(t))`));
    await ev(`(async()=>{
        window._authAccountForNames=()=>'mobaggro';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='仇恨'+Date.now()%100000;
        startGame();
        for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv,30); try{ calcStats(); }catch(e){} player.hp=player.mhp;
        state.autoHunt=false;
        const oc=enemyAttackChooseVictim;
        window.enemyAttackChooseVictim=function(m,i){ try{ const r=(window.__R||{})[m.uid]; if(r) r.hits++; }catch(e){} return oc.apply(this,arguments); };
        const ot=_mobAnimTrigger;
        window._mobAnimTrigger=function(m,k){ try{ const r=(window.__R||{})[m&&m.uid]; if(r&&k==='attack') r.trig++; }catch(e){} return ot.apply(this,arguments); };
    })()`);

    // 靜態：所有原版八向怪都有攻擊幀（無普攻者已用施法動作代替，#24）
    const noAtk = await ev(`(async()=>{ try{ _expandMob8DirFromLegacyManifest(); }catch(e){}
        const quiet=new Set(Object.values(DB.mobs||{}).filter(m=>m&&m.noAttack).map(m=>m.n));
        const miss=LIN_SPR_MOBS.filter(n=>{ if(quiet.has(n)) return false; for(const d of [6,2,4,0]){ const c=_manifestCount(_mobAnimBaseRaw(n,d)+'attack_0.png'); if(c>1) return false; } return true; });
        const out=[];
        const okUrl=(u)=>fetch(u).then(r=>r.ok).catch(()=>false);
        for(const n of miss){
            if(await okUrl(_mobDirectFrameUrl(n,'attack',0,6)) && await okUrl(_mobDirectFrameUrl(n,'attack',1,6))) continue;
            const root=_mobAnimRootFor(n)+'/'+encodeURIComponent(_animDir(n))+'/';
            if(await okUrl(root+'attack_0.png') && await okUrl(root+'attack_1.png')) continue;
            out.push(n);
        }
        return out; })()`);
    ok('原版八向怪全部有攻擊幀（manifest）', Array.isArray(noAtk) && noAtk.length === 0, Array.isArray(noAtk) ? noAtk.slice(0, 10).join(',') : JSON.stringify(noAtk));

    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    const toNear = () => ev(`(async()=>{
        if(!(exploreActiveMapDef()||{}).lin) return -1;
        const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return (mapState.mobs||[]).filter(m=>m&&m._fx!=null&&m.curHp>0&&m.beh!=='被動'&&exploreTileDist(m._fx,m._fy,px,py)<=5).length;};
        for(let k=0;k<50;k++){ const n=near(); if(n>=2) return n; exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,450)); }
        return near();
    })()`);
    const startSample = (wake) => ev(`(()=>{
        clearInterval(window.__keep); clearInterval(window.__samp);
        const L=exploreActiveMapDef().lin;
        window.__R={};
        window.__keep=setInterval(()=>{ try{ if(player){ player.mhp=Math.max(player.mhp,999999); player.hp=player.mhp; }
            const px=explorePlayerX(),py=explorePlayerY();
            (mapState.mobs||[]).forEach(m=>{ if(m&&m.curHp>0&&!m._svHp&&m._fx!=null&&Math.hypot(m._fx-px,m._fy-py)<500){ m._svHp=1; m.hp=1e6; m.curHp=${wake ? '1e6-1' : '1e6'}; } }); }catch(e){} }, 50);
        window.__samp=setInterval(()=>{
            const px=explorePlayerX(),py=explorePlayerY();
            for(const m of (mapState.mobs||[])){
                if(!m||!(m.curHp>0)||m._fx==null||!m._svHp) continue;
                const r=window.__R[m.uid]||(window.__R[m.uid]={n:m.n,beh:m.beh,rng:(LIN_MOB_TIMING[m.n]||[0,0,0,1])[3],minTd:99,near:0,inR:0,trig:0,hits:0,agg:0,noAtk:!!m.noAttack,slow:(m.atkSpd||0)>=6});
                const td=exploreTileDist(m._fx,m._fy,px,py);
                r.minTd=Math.min(r.minTd,td);
                if(td<=r.rng&&!m._ls) r.inR++;
                if(td<=3) r.near++;
                if(m._aggro) r.agg++;
                if(td<=r.rng){ const im=document.querySelector('#mob-list .mob-target[data-uid="'+m.uid+'"] .mob-img-inner img:not(.mob-anim-shadow)'); if(im&&/\\/attack_\\d+\\.png/.test(decodeURIComponent(im.getAttribute('src')||''))) r.shown=(r.shown||0)+1; }
            }
        },100);
    })()`);
    const stopSample = () => ev(`(()=>{clearInterval(window.__samp);clearInterval(window.__keep);return Object.values(window.__R);})()`);

    const agg = {};
    for (const mapId of MAPS) {
        await go(mapId);
        await sleep(3500);
        const n = await toNear();
        if (!(n >= 1)) { LOG.push('  skip ' + mapId + ' (near ' + n + ') ' + JSON.stringify(await ev('({cur:mapState.current,cls:player&&player.cls,dead:player&&player.dead,scr:[...document.querySelectorAll(".screen.active,[id$=-screen]:not(.hidden)")].map(e=>e.id).slice(0,5)})'))); continue; }
        await startSample(false);
        await sleep(SECS * 1000);
        const R = await stopSample();
        if (!Array.isArray(R)) { ok(mapId + ' 取樣', false, JSON.stringify(R)); continue; }
        const act = R.filter((r) => r.beh !== '被動' && !r.noAtk && !r.slow);
        const reached = act.filter((r) => r.inR >= 15);
        // 取樣結束時剛出手、打中幀還沒到的那一下不算落空
        const dud = reached.filter((r) => !(r.trig > 0 && r.shown > 0 && (r.hits > 0 || r.trig <= 1)));
        // 原版仇恨 6 格：3 格內待超過 3 秒的主動怪要進仇恨（被牆擋住的不算失敗：只要求多數）
        const close = act.filter((r) => r.near >= 30);
        const closeAgg = close.filter((r) => r.agg > 0);
        reached.forEach((r) => { const a = agg[r.n] || (agg[r.n] = { reach: 0, hit: 0 }); a.reach++; if (r.hits > 0 && r.trig > 0) a.hit++; });
        LOG.push('  ' + mapId + ': 主動怪 ' + act.length + '、追到攻擊距離 ' + reached.length + '：' + reached.map((r) => r.n + '(動作' + r.trig + '/打中' + r.hits + '/畫面攻擊幀' + (r.shown || 0) + ')').join(' '));
        ok(mapId + ' 主動怪有追到玩家', reached.length >= 1, 'n=' + reached.length);
        ok(mapId + ' 追到攻擊距離的主動怪都播攻擊動作（畫面出現 attack 幀）且打中', dud.length === 0, dud.map((r) => r.n + ' trig' + r.trig + ' hit' + r.hits + ' shown' + (r.shown || 0)).join(' '));
        ok(mapId + ' 3 格內的主動怪會進仇恨', !close.length || closeAgg.length >= Math.ceil(close.length * 0.6), closeAgg.length + '/' + close.length);
        const pas = R.filter((r) => r.beh === '被動');
        ok(mapId + ' 被動怪滿血不索敵', pas.every((r) => r.agg === 0), pas.filter((r) => r.agg).map((r) => r.n).join(' '));
    }
    const types = Object.keys(agg);
    ok('調查到的主動怪種類 ≥ 5，全部有攻擊', types.length >= 5 && types.every((k) => agg[k].hit >= 1), types.map((k) => k + ' ' + agg[k].hit + '/' + agg[k].reach).join(' '));

    // 被打過的被動怪會追上來反擊
    await go('zone_06');
    await sleep(3500);
    await toNear();
    await startSample(true);
    await ev(`(()=>{ const px=explorePlayerX(),py=explorePlayerY(); (mapState.mobs||[]).forEach(m=>{ if(m&&m.curHp>0&&m.beh==='被動'&&m._fx!=null&&exploreTileDist(m._fx,m._fy,px,py)<=6) m._aggro=true; }); })()`);
    await sleep(SECS * 1000);
    const W = await stopSample();
    const wp = (Array.isArray(W) ? W : []).filter((r) => r.beh === '被動' && r.inR >= 15 && !r.slow);
    ok('受傷的被動怪追到後播攻擊並打中', wp.length >= 1 && wp.every((r) => r.trig > 0 && r.hits > 0 && r.shown > 0), wp.map((r) => r.n + '(' + r.trig + '/' + r.hits + '/' + (r.shown || 0) + ')').join(' '));

    // 拴繩：離家超過 14 格 → 整段走回家，途中不回頭追（開闊野外量）
    await go('zone_01');
    await sleep(3500);
    await toNear();
    const leash = await ev(`(async()=>{
        const px=explorePlayerX(),py=explorePlayerY();
        const L=exploreActiveMapDef().lin;
        const cand=(mapState.mobs||[]).filter(m=>m&&m.curHp>0&&m._fx!=null&&exploreTileDist(m._fx,m._fy,px,py)<=12).sort((a,b)=>Math.hypot(a._fx-px,a._fy-py)-Math.hypot(b._fx-px,b._fy-py));
        if(!cand.length) return {err:'no mob'};
        // 家設在一條直線走得通的 16 格外（不被牆擋，量的是拴繩邏輯而不是尋路）
        let m=null, home=null;
        for(const c0 of cand){
            const t=linmapTileAt(L,c0._fx,c0._fy);
            for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
                let gx=t.gx, gy=t.gy, k=0;
                for(;k<16;k++){ const c=linmapTileCenter(L,gx+dx,gy+dy); if(!c||!linmapWalkable(L,c.x,c.y)||linmapSafeZone(L,c.x,c.y)||(typeof linmapCanStep==='function'&&!linmapCanStep(L,gx,gy,dx,dy))) break; gx+=dx; gy+=dy; }
                if(k===16){ home=linmapTileCenter(L,gx,gy); break; }
            }
            if(home){ m=c0; break; }
        }
        if(!home) return {err:'no home'};
        m.hp=1e6; m.curHp=1e6-1; m._aggro=true;
        // 玩家不鎖定這隻（被玩家打的怪不拉回是另一條規則）
        const untgt=setInterval(()=>{ if(mapState.targetIdx>=0&&mapState.mobs[mapState.targetIdx]===m) mapState.targetIdx=-1; m._picked=false; },20);
        mapState.targetIdx=-1;
        m._homeFx=home.x; m._homeFy=home.y;
        const d0=exploreTileDist(m._fx,m._fy,home.x,home.y), seq=[d0]; let back=0, aggOn=0;
        for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,150)); const d=exploreTileDist(m._fx,m._fy,home.x,home.y); if(d>seq[seq.length-1]) back++; if(d!==seq[seq.length-1]) seq.push(d); if(m._aggro&&i>=14) aggOn++; }
        clearInterval(untgt);
        return {n:m.n,d0,seq:seq.slice(0,12),back,aggOn,leashFlag:!!m._linLeashBack||seq[seq.length-1]<=2};
    })()`);
    ok('拴繩：離家太遠整段走回家、途中不回頭', leash && !leash.err && leash.seq.length >= 3 && leash.back === 0 && leash.aggOn === 0, JSON.stringify(leash));

    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    fs.writeFileSync(path.join(OUT, 'audit_mobaggro_log.txt'), LOG.join('\n'), 'utf8');
    console.log(LOG.join('\n'));
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => {
    LOG.push('FATAL ' + (e && e.stack || e));
    try { fs.writeFileSync(path.join(OUT, 'audit_mobaggro_log.txt'), LOG.join('\n'), 'utf8'); } catch (e2) {}
    console.error('FATAL', e); process.exit(1);
});
