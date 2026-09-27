// 實測：木頭人擊殺經驗、轉換魔法 HP/MP 條件、目標法術特效顯示尺寸
// 用法：node tools/_audit-autocast-fx.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9335;
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, detail) => {
    console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
    if (!cond) fails++;
};

async function main() {
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'acfx-'));
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
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
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
    await ev(`(async()=>{
        window._authAccountForNames=()=>'acfx';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_elf'; curCreate.cls='elf';
        document.getElementById('create-name-input').value='測試'+Date.now()%100000;
        startGame();
        await new Promise(r=>setTimeout(r,3000));
    })()`);
    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);

    console.log('=== 木頭人經驗 ===');
    await go('training');
    await sleep(2500);
    const dummy = await ev(`(()=>{
        player.lv=1; player.exp=0; calcStats(); player.hp=player.mhp;
        let i=mapState.mobs.findIndex(m=>m&&m.trainingDummy&&!m._dead);
        if(i<0) return {err:'no dummy', mobs:mapState.mobs.map(m=>m&&m.n)};
        let m=mapState.mobs[i]; let hp=m.hp; m.curHp=0;
        let e0=player.exp, l0=player.lv; killMob(i);
        return {i, hp, exp:m.exp, gained:(player.lv>l0?'levelup':player.exp-e0), gold:player.gold};
    })()`);
    console.log('  ', JSON.stringify(dummy));
    ok('木頭人 HP 40', dummy && dummy.hp === 40);
    ok('木頭人擊殺獲得經驗', dummy && (dummy.gained === 'levelup' || dummy.gained > 0), 'gained=' + (dummy && dummy.gained));

    console.log('=== 轉換魔法 ===');
    await go('silver_knight');
    await sleep(2500);
    const conv = await ev(`(async()=>{
        let sid=Object.keys(DB.skills).find(k=>DB.skills[k].type==='convert');
        if(!sid) return {err:'no convert skill'};
        if(!player.skills.includes(sid)) player.skills.push(sid);
        try{ updateSkillSelects && updateSkillSelects(); }catch(e){}
        let row=document.getElementById('ui-convert-row');
        let sel=document.getElementById('sel-convert-skill');
        if(![...sel.options].some(o=>o.value===sid)){ let o=document.createElement('option'); o.value=sid; sel.appendChild(o); }
        sel.value=sid;
        document.getElementById('set-hp-convert').value='50';
        document.getElementById('set-mp-convert').value='30';
        let calls=[]; let orig=window.castSkill; window.castSkill=function(id){ calls.push(id); return false; };
        let res={};
        try{
            player.hp=player.mhp; player.mp=Math.floor(player.mmp*0.6); calls.length=0; autoCastSpells(); res.mp60=calls.includes(sid);
            player.hp=player.mhp; player.mp=Math.floor(player.mmp*0.1); calls.length=0; autoCastSpells(); res.mp10=calls.includes(sid);
            player.hp=Math.floor(player.mhp*0.3); player.mp=Math.floor(player.mmp*0.1); calls.length=0; autoCastSpells(); res.hp30=calls.includes(sid);
        } finally { window.castSkill=orig; }
        res.sid=sid; res.hint=!!document.body.innerHTML.includes('以 HP 換 MP');
        return res;
    })()`);
    console.log('  ', JSON.stringify(conv));
    ok('MP 60% > 門檻 30% → 不轉換', conv && conv.mp60 === false);
    ok('MP 10% < 門檻 30% 且 HP 滿 → 轉換', conv && conv.mp10 === true);
    ok('HP 30% < 門檻 50% → 不轉換', conv && conv.hp30 === false);

    console.log('=== 法術特效尺寸（相對帶高基準） ===');
    const fx = await ev(`(async()=>{
        player.hp=player.mhp;
        let t=mapState.mobs.find(m=>m&&!m._dead&&m.curHp>0);
        if(!t) return {err:'no mob'};
        try{ setPowerSaveOn(false); }catch(e){}
        try{ localStorage.setItem(_VFX_PREF_KEY,'0'); }catch(e){}
        window.__vfxOff=false;
        await new Promise(r=>setTimeout(r,800));
        window.__vfxOff=false;
        let _diag={vfxOff:!!window.__vfxOff, hidden:document.hidden, ff:!!(state&&state.ff), slot:!!document.querySelector('#mob-list .mob-target[data-uid="'+t.uid+'"]'), mobs:mapState.mobs.length, layer:!!document.getElementById('vfx-layer')};
        if(_diag.vfxOff||_diag.hidden||_diag.ff||!_diag.slot) return {err:'diag', _diag};
        let names=['冰箭','光箭','火箭','燃燒的火球','地獄之牙','毒咒','緩速術','風刃','地裂術','極道落雷','流星雨'];
        let out={};
        for(const n of names){
            for(const k in _spellFxActive) delete _spellFxActive[k];
            let layer=document.getElementById('vfx-layer'); let before=new Set([...layer.children]);
            playSpellFx(n,t);
            let maxH=0;
            for(let k=0;k<30;k++){
                [...layer.children].filter(e=>!before.has(e)).forEach(e=>{ let h=parseFloat(e.style.height)||0; if(h>maxH) maxH=h; });
                if(maxH>0) break;
                await new Promise(r=>setTimeout(r,16));
            }
            let slot=document.querySelector('.mob-target[data-uid="'+t.uid+'"] .mob-img-inner');
            let ref=_fxBandRefH(slot?slot.getBoundingClientRect().height:112);
            let _css=[...layer.children].filter(e=>!before.has(e)).map(e=>e.tagName+'|'+e.className+'|'+e.style.cssText.slice(0,200));
            out[n]=maxH>0&&isFinite(maxH)?{h:Math.round(maxH), rel:+(maxH/ref).toFixed(2)}:{bad:String(maxH), css:_css};
            [...layer.children].filter(e=>!before.has(e)).forEach(e=>e.remove());
            await new Promise(r=>setTimeout(r,50));
        }
        return out;
    })()`);
    console.log('  ', JSON.stringify(fx));
    if (fx && !fx.err) {
        for (const n of ['冰箭', '光箭', '火箭', '燃燒的火球']) ok(n + ' ≥ 0.5×', fx[n] && fx[n].rel >= 0.49, fx[n] && ('rel=' + fx[n].rel));
        for (const n of ['地獄之牙', '毒咒', '緩速術', '風刃', '地裂術']) ok(n + ' ≥ 0.9×', fx[n] && fx[n].rel >= 0.89, fx[n] && ('rel=' + fx[n].rel));
        for (const n of ['極道落雷', '流星雨']) ok(n + ' 維持原尺寸（>1.0×）', fx[n] && fx[n].rel > 1.0, fx[n] && ('rel=' + fx[n].rel));
    } else ok('特效量測', false, JSON.stringify(fx));

    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    console.log(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
