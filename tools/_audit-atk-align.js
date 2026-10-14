// 實測：原版地圖近戰正面交戰——每次普攻 玩家與怪在相鄰格（切比雪夫距離 1）、玩家站在格子中心、怪不在走路途中、
// 玩家面向怪；怪出手時面向玩家；人物／怪圖的原版站立點落在各自格子中心（畫面差 ≤ 3px）
// 用法：node tools/_audit-atk-align.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9443;
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
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'aalign-'));
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
    const ev = async (expr, ms) => {
        const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms || 150000).then(() => ({ result: { exceptionDetails: { exception: { description: 'TIMEOUT（頁面卡住）' } } } }))]);
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'aalign';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='對位'+Date.now()%100000;
        startGame();
        for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    ok('LIN_PC_FOOT 已載入 16 職業外形', await ev('typeof LIN_PC_FOOT==="object"&&Object.keys(LIN_PC_FOOT).length===16&&JSON.stringify(LIN_PC_FOOT["男騎士"])==="[-1.5,44]"'));
    await ev(`(()=>{const sel=document.getElementById('map-select');const id='talking_island';
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    await sleep(4000);
    const tpNear = `(async()=>{
        const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return Math.min(1e9,...(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&m.curHp>0).map(m=>Math.hypot(m._fx-px,m._fy-py)));};
        for(let k=0;k<30&&near()>200;k++){ exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,500)); }
    })()`;
    await ev(tpNear);
    const preDiag = await ev(`(()=>{ const out={}; const b=(d)=>location.origin+'/assets/classanim/'+encodeURIComponent(player.avatar+ANIM_DIR_SFX8[d])+'/';
        for(let d=0;d<8;d++){ out[d]=['walk','attack'].map(a=>{const i=new Image(); i.src=b(d)+'sword1_'+a+'_0.png?v='+GAME_VERSION; return i.complete&&i.naturalWidth>0?1:0;}).join(''); }
        const f=_playerBattleForm(); return {pre:out, keep:(_pmState._walkPre||[]).length, tag:_pmState._walkPreTag, dom:f&&f.domKey, wpn:f&&f.wpn, keepDone:(_pmState._walkPre||[]).filter(i=>i.complete&&i.naturalWidth>0).length}; })()`);
    console.log('   preload', JSON.stringify(preDiag));
    await ev(`(()=>{ (async()=>{
        const name=exploreLinName();
        const R={name, swings:[], mobAtk:[]}; window.__AR=R;
        const T=(x,y)=>linmapTileAt(name,x,y);
        const keep=setInterval(()=>{ try{ player.hp=player.mhp; (mapState.mobs||[]).forEach(m=>{ if(m&&m.curHp>0&&!m._a){ m._a=1; m.hp=m.curHp=40; } }); }catch(e){} },50);
        const feet=(t)=>{
            const o={};
            const pw=exploreWorldToClient(explorePlayerX(),explorePlayerY()), mw=exploreWorldToClient(t._fx,t._fy||0);
            const bd=document.querySelector('#player-morph-sprite .pm-body');
            const ft=LIN_PC_FOOT[player.avatar];
            if(bd&&bd.naturalHeight&&ft){ const r=bd.getBoundingClientRect(), s=r.height/bd.naturalHeight;
                o.p=[+(r.left+(bd.naturalWidth/2+ft[0])*s-pw.x).toFixed(1), +(r.bottom-ft[1]*s-pw.y).toFixed(1)]; }
            const card=document.querySelector('#mob-list .mob-target[data-uid="'+t.uid+'"]');
            const im=card&&card.querySelector('.mob-img-inner.lin-spr img:not(.mob-anim-shadow)');
            if(im&&im.naturalHeight){ const r=im.getBoundingClientRect(), s=r.height/im.naturalHeight;
                o.m=[+(r.left+r.width/2-mw.x).toFixed(1), +(r.bottom-LIN_SPR_FOOT_PAD*s-mw.y).toFixed(1)]; }
            return o;
        };
        const ob=playerAttackLinBegin;
        window.playerAttackLinBegin=function(){
            const before=state._pLinHitAt;
            const r=ob.apply(this,arguments);
            if(r&&state._pLinHitAt&&state._pLinHitAt!==before){
                const t=getTarget(); const px=explorePlayerX(),py=explorePlayerY();
                const a=T(px,py), b=T(t._fx,t._fy||0), ca=linmapTileCenter(name,a.gx,a.gy);
                const rec={ n:t.n, d:[b.gx-a.gx,b.gy-a.gy], cheb:Math.max(Math.abs(b.gx-a.gx),Math.abs(b.gy-a.gy)),
                    pOff:+Math.hypot(px-ca.x,py-ca.y).toFixed(1), mStep:!!t._ls, want:_vec2dir(t._fx-px,-((t._fy||0)-py)) };
                R.swings.push(rec);
                setTimeout(()=>{ try{ rec.face=player._faceD; rec.f=feet(t); rec.tpFx=(typeof _teleportFxUntil!=='undefined'&&_teleportFxUntil>Date.now());
                    const im=document.querySelector('#player-morph-sprite .pm-body'); rec.dirOk=!!(im&&im.getAttribute('src').indexOf(encodeURIComponent(player.avatar+ANIM_DIR_SFX8[rec.want])+'/')>=0); if(!rec.dirOk&&im){ rec.src=decodeURIComponent(im.getAttribute('src')).split('/').slice(-2).join('/'); rec.act=_pmState.act; rec.pend=im.dataset.animPending; rec.animF=im.dataset.animF; try{ const u=location.origin+'/assets/classanim/'+encodeURIComponent(player.avatar+ANIM_DIR_SFX8[rec.want])+'/sword1_attack_0.png?v='+GAME_VERSION; const pe=performance.getEntriesByName(u); const ti=new Image(); ti.src=u; rec.pre={n:pe.length, end:pe.length?Math.round(pe[0].responseEnd):null, now:Math.round(performance.now()), complete:ti.complete&&ti.naturalWidth>0, keep:(_pmState._walkPre||[]).length, keepDone:(_pmState._walkPre||[]).filter(i=>i.complete&&i.naturalWidth>0).length, tag:_pmState._walkPreTag===(_playerBattleForm()||{}).domKey, res:performance.getEntriesByType('resource').length, seq:[im._animReqSeq,im._animShownSeq]}; }catch(e){ rec.pre=String(e); } } }catch(e){ rec.err=String(e); } },150);
            }
            else if(r){ const t=getTarget(); const k=!t?'none':(!playerAttackInRange(t)?'range':(t._ls?'ls':'other')); R.wait=R.wait||{}; R.wait[k]=(R.wait[k]||0)+1; }
            return r;
        };
        const omt=_mobAnimTrigger;
        window._mobAnimTrigger=function(m,act){
            if(act==='attack'&&m&&m._fx!=null&&exploreLinName()){ const px=explorePlayerX(),py=explorePlayerY();
                const a=T(px,py), b=T(m._fx,m._fy||0);
                const rec={ n:m.n, want:_vec2dir(px-m._fx,-(py-(m._fy||0))), cheb:Math.max(Math.abs(b.gx-a.gx),Math.abs(b.gy-a.gy)), mStep:!!m._ls, range:(typeof LIN_MOB_TIMING!=='undefined'&&LIN_MOB_TIMING[m.n])?LIN_MOB_TIMING[m.n][3]:1 };
                R.mobAtk.push(rec);
                setTimeout(()=>{ rec.face=m._face8; },150);
            }
            return omt.apply(this,arguments);
        };
        state.autoHunt=true;
        let t0=Date.now();
        const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return Math.min(1e9,...(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&m.curHp>0).map(m=>Math.hypot(m._fx-px,m._fy-py)));};
        let lastN=0, lastAt=Date.now();
        while(Date.now()-t0<60000&&R.swings.length<40){ await new Promise(r=>setTimeout(r,100));
            if(R.swings.length!==lastN){ lastN=R.swings.length; lastAt=Date.now(); }
            else if(Date.now()-lastAt>5000){ lastAt=Date.now(); for(let k=0;k<20;k++){ exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,300)); if(near()<200) break; } }
        }
        await new Promise(r=>setTimeout(r,300));
        clearInterval(keep); state.autoHunt=false;
        window.playerAttackLinBegin=ob; window._mobAnimTrigger=omt;
        R.ms=Date.now()-t0; R.done=true;
    })(); return 1; })()`);
    let R = null, shotDone = false;
    for (let i = 0; i < 60 && !R; i++) {
        await sleep(2000);
        if (!shotDone) {
            // 攻擊中截圖（紅點＝玩家格心、青點＝目標怪格心）
            const si = await ev(`(()=>{ const R=window.__AR, t=getTarget(), im=document.querySelector('#player-morph-sprite .pm-body');
                if(!R||R.swings.length<8||!t||!im||!/_attack_\\d+\\.png/.test(im.getAttribute('src')||'')||!playerAttackInRange(t)) return null;
                const dot=(p,c)=>{ const d=document.createElement('div'); d.className='aalign-dot'; d.style.cssText='position:fixed;z-index:99999;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;background:'+c+';left:'+p.x+'px;top:'+p.y+'px;pointer-events:none'; document.body.appendChild(d); };
                const pw=exploreWorldToClient(explorePlayerX(),explorePlayerY()), mw=exploreWorldToClient(t._fx,t._fy||0);
                dot(pw,'red'); dot(mw,'cyan'); return { pw, mw, n:t.n };
            })()`, 10000);
            if (si && si.pw) {
                const cx = Math.round((si.pw.x + si.mw.x) / 2), cy = Math.round((si.pw.y + si.mw.y) / 2) - 50;
                const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: cx - 200, y: cy - 150, width: 400, height: 300, scale: 2 } });
                fs.writeFileSync(path.join(OUT, 'audit_atk_align.png'), Buffer.from(shot.result.data, 'base64'));
                await ev(`document.querySelectorAll('.aalign-dot').forEach(d=>d.remove())`, 10000);
                console.log('   screenshot', path.join(OUT, 'audit_atk_align.png'), si.n);
                shotDone = true;
            }
        }
        const r = await ev('window.__AR&&window.__AR.done?window.__AR:null', 15000);
        if (r && r.__err) { R = r; break; }
        R = r;
    }
    fs.writeFileSync(path.join(OUT, 'audit_atk_align.json'), JSON.stringify(R, null, 1));
    if (!R || R.__err) ok('取樣', false, JSON.stringify(R));
    else {
        const S = R.swings, M = R.mobAtk;
        const dirs = [...new Set(S.map((s) => s.want))];
        console.log('   map', R.name, 'swings', S.length, 'mobAtk', M.length, 'dirs', dirs.join(','), 'mobs', [...new Set(S.map((s) => s.n))].join(','), 'wait', JSON.stringify(R.wait || {}));
        ok('取到足夠普攻', S.length >= 10, 'n=' + S.length);
        const badAdj = S.filter((s) => s.cheb !== 1);
        ok('每次普攻都在相鄰格（切比雪夫 1）', !badAdj.length, badAdj.slice(0, 5).map((s) => s.d.join(',')).join(' | '));
        const badCtr = S.filter((s) => s.pOff > 1.5);
        ok('玩家站在格子中心才揮', !badCtr.length, badCtr.slice(0, 5).map((s) => s.pOff).join(','));
        const badStep = S.filter((s) => s.mStep);
        ok('不打走路途中的怪', !badStep.length, 'n=' + badStep.length);
        const badFace = S.filter((s) => s.face !== s.want);
        ok('玩家面向目標怪', !badFace.length, badFace.slice(0, 5).map((s) => s.want + '→' + s.face).join(' '));
        // 該方向第一次揮＝圖還在下載（沿用舊方向幀）；傳送術特效中人物隱藏不換幀，都不算
        const seenDir = new Set();
        const badImg = S.filter((s) => { const first = !seenDir.has(s.want); seenDir.add(s.want); return !first && !s.tpFx && s.face === s.want && !s.dirOk; });
        ok('人物圖換到面向資料夾', !badImg.length, 'n=' + badImg.length + ' 傳送中 ' + S.filter((s) => s.tpFx).length);
        const pf = S.filter((s) => s.f && s.f.p).map((s) => s.f.p);
        const mf = S.filter((s) => s.f && s.f.m).map((s) => s.f.m);
        const pfBad = pf.filter((p) => Math.abs(p[0]) > 3 || Math.abs(p[1]) > 3);
        const mfBad = mf.filter((p) => Math.abs(p[0]) > 3 || Math.abs(p[1]) > 3);
        ok('人物原版站立點在格子中心（≤3px）', pf.length >= 5 && !pfBad.length, 'n=' + pf.length + ' 例 ' + JSON.stringify(pf[0]) + (pfBad.length ? ' 壞 ' + JSON.stringify(pfBad.slice(0, 3)) : ''));
        ok('怪原版站立點在格子中心（≤3px）', mf.length >= 5 && !mfBad.length, 'n=' + mf.length + ' 例 ' + JSON.stringify(mf[0]) + (mfBad.length ? ' 壞 ' + JSON.stringify(mfBad.slice(0, 3)) : ''));
        const mBadFace = M.filter((s) => s.face != null && s.face !== s.want);
        ok('怪出手時面向玩家', M.length >= 3 && !mBadFace.length, 'n=' + M.length + (mBadFace.length ? ' 壞 ' + mBadFace.slice(0, 5).map((s) => s.n + ':' + s.want + '→' + s.face).join(' ') : ''));
        const mBadAdj = M.filter((s) => s.mStep || s.cheb < 1 || s.cheb > Math.max(1, s.range || 1));
        ok('怪站定且在攻擊距離內才出手', !mBadAdj.length, mBadAdj.slice(0, 5).map((s) => s.n + ':' + s.cheb).join(' '));
    }
    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(OUT, 'audit_atk_align_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
