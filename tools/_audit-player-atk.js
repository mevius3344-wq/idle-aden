// 實測：原版地圖玩家普攻照原版節奏——攻擊動作各幀照 list.spr（LIN_PC_ATK），播到打中幀才結算，連續揮不閃待機
// 用法：node tools/_audit-player-atk.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = require('./_cdp-port')(9398);
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'patk-'));
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
        window._authAccountForNames=()=>'patk';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='普攻'+Date.now()%100000;
        startGame();
        for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    ok('LIN_PC_ATK 已載入', await ev('typeof LIN_PC_ATK==="object"&&Object.keys(LIN_PC_ATK).length>=60'));
    ok('男騎士單手劍＝原版 [3,6,5,1,4,3] 第 5 幀打中', await ev('JSON.stringify(LIN_PC_ATK["男騎士|sword1"])===JSON.stringify([[3,6,5,1,4,3],4])'));

    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    await go('talking_island');
    await sleep(4000);
    await ev(`(async()=>{
        const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return Math.min(1e9,...(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&m.curHp>0).map(m=>Math.hypot(m._fx-px,m._fy-py)));};
        for(let k=0;k<30&&near()>200;k++){ exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,500)); }
    })()`);
    const R = await ev(`(async()=>{
        const R={swings:[],hits:[],idleGap:0,frames:[]};
        const keep=setInterval(()=>{ try{ player.hp=player.mhp; (mapState.mobs||[]).forEach(m=>{ if(m&&m.curHp>0&&!m._a){ m._a=1; m.hp=m.curHp=1e6; } }); }catch(e){} },50);
        const opa=playerAttack; window.playerAttack=function(){ const t=getTarget(); if(t&&playerAttackInRange(t)) R.hits.push(Date.now()); return opa.apply(this,arguments); };
        state.autoHunt=true;
        let lastAct=null, lastF=-1, swingAt=0, idle=null;
        R.idleWait=0;
        // 等待中的待機不算閃：目標在走一步、人在走、或還不在出手範圍（原版：站定在格子中心、怪站上鄰格才揮）
        const mustWait=()=>{ try{ const t=getTarget(); return !t||!!t._ls||exploreIsMoving()||!playerAttackInRange(t); }catch(e){ return false; } };
        // 天堂職業硬直（被直接命中延後下次普攻 d.hitstun tick）是另一套規則：取樣期間關掉，只量連段節奏
        R.stunAt=0; R.stuns=[]; const ohs=applyPlayerHitstun; window.applyPlayerHitstun=function(){ R.stuns.push(Date.now()); };
        const f=()=>{
            const im=document.querySelector('#player-morph-sprite img');
            const src=im?(im.getAttribute('src')||''):'';
            const m=/_(attack|idle|walk)_(?:s_)?(\\d+)\\.png/.exec(src);
            const act=m?m[1]:'', fi=m?+m[2]:-1;
            if(act==='attack'&&(lastAct!=='attack'||fi<lastF)){ swingAt=Date.now(); R.swings.push(swingAt); }
            if(lastAct==='attack'&&act==='idle'&&R.swings.length>=2) idle={wait:false};
            if(idle&&act!=='attack'&&mustWait()) idle.wait=true;
            if(idle&&act==='attack'){ if(idle.wait) R.idleWait++; else R.idleGap++; idle=null; }
            if(act==='attack'&&fi!==lastF&&R.frames.length<40) R.frames.push([fi,Date.now()-swingAt]);
            lastAct=act; lastF=fi;
            if(R.swings.length<12) requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
        for(let i=0;i<120&&R.swings.length<12;i++) await new Promise(r=>setTimeout(r,100));
        clearInterval(keep); state.autoHunt=false; window.playerAttack=opa; window.applyPlayerHitstun=ohs;
        const form=_playerBattleForm(); const p=_linPcAtkProfile(form,_pmAtkSeqLen(form));
        R.prof=p; R.key=player.avatar+'|'+(form&&form.wpn);
        return R;
    })()`);
    if (!R || R.__err) { ok('取樣', false, JSON.stringify(R)); }
    else {
        console.log('   key', R.key, 'prof', R.prof && R.prof.ms.map(Math.round).join(','), 'hit', R.prof && R.prof.hit, 'swings', R.swings.length, 'hits', R.hits.length);
        ok('攻擊動作照原版節奏（不等長幀）', R.prof && Math.max(...R.prof.ms) > Math.min(...R.prof.ms) * 2, R.prof && R.prof.ms.map(Math.round).join(','));
        // 每次結算對到前一次出手：不早於打中幀，晚到 ≤ 250ms（戰鬥 tick 100ms＋無頭卡頓）
        const pairs = R.hits.map((h) => { const s = R.swings.filter((x) => x <= h).pop(); return s ? h - s : -1; }).filter((d) => d >= 0);
        const med = pairs.slice().sort((a, b) => a - b)[Math.floor(pairs.length / 2)];
        ok('打中幀才扣血（不在出手當下）', pairs.length >= 3 && pairs.every((d) => d >= R.prof.hit - 30) && med <= R.prof.hit + 250,
            'hit=' + (R.prof && R.prof.hit) + ' dt=' + pairs.slice(0, 12).join(','));
        const gaps = R.swings.slice(1).map((s, i) => s - R.swings[i]);
        ok('連續揮擊間隔＝攻擊間隔', gaps.length >= 3 && gaps.filter((g) => Math.abs(g - R.prof.total) <= 220).length >= gaps.length * 0.7,
            'total=' + (R.prof && R.prof.total) + ' gaps=' + gaps.slice(0, 8).join(',') + ' 硬直(取樣關閉)=' + (R.stuns || []).length);
        ok('揮擊之間不閃待機（等怪走完一步／走位不算）', R.idleGap <= 1, 'idle=' + R.idleGap + ' wait=' + R.idleWait);
    }
    // 非原版地圖照舊（出手當下結算）
    const nonLin = await ev(`(()=>{ const ids=Object.keys((DB&&DB.maps)||{}); const id=ids.find(x=>x&&typeof mapdefOf==='function'&&mapdefOf(x)&&!mapdefOf(x).lin&&!/town|training|siege|wb_/.test(x)); return id||''; })()`);
    if (nonLin) {
        await go(nonLin); await sleep(2500);
        const r2 = await ev(`(()=>{ const form=_playerBattleForm(); return { lin: exploreLinName(), prof: _linPcAtkProfile(form,_pmAtkSeqLen(form)), begin: playerAttackLinBegin() }; })()`);
        ok('非原版地圖不改（' + nonLin + '）', r2 && !r2.lin && !r2.prof && r2.begin === false, JSON.stringify(r2));
    } else ok('找到非原版地圖對照', false);
    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(OUT, 'audit_player_atk_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
