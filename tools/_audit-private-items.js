// 實測：私服整理（v3.9.98）——下架 NPC 不在村莊、經驗藥水取最高倍率、村莊傳送卷軸、魔法娃娃任選卷
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-private-items.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9381;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'pvi-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails;
            errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; console.log('EVAL_ERR ' + asc(String((d.exception && d.exception.description) || d.text).split('\n')[0])); }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    const stamp = Date.now() % 100000;
    const acct = 'pvi' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'pvi-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'pvi-test', clientId: 'pvi-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof openDollPick==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('私' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);

    const r = await ev(`(async()=>{
        const out={};
        const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
        const cnt=(id)=>player.inv.filter(i=>i.id===id).reduce((a,i)=>a+(i.cnt||1),0);
        const use=async(id)=>{ const it=player.inv.find(i=>i.id===id); if(it) useItem(it.uid); await wait(300); };
        const gone=['npc_kent_guard','npc_ww_guard','npc_heine_guard','npc_obel','npc_hert','npc_diren','npc_arena','npc_pandora'];
        out.npcLeft=[]; for(const t in DB.towns){ for(const n of (DB.towns[t].npcs||[])) if(gone.includes(n.id)) out.npcLeft.push(t+':'+n.id); }
        const ids=['potion_exp130','potion_exp150','potion_exp170','potion_exp200','potion_exp250','potion_exp300','scroll_town_heine','scroll_town_giran','doll_pick_3'];
        out.imgBad=[]; for(const id of ids){ const ok=await new Promise(res=>{const im=new Image();im.onload=()=>res(im.naturalWidth>0);im.onerror=()=>res(false);im.src=DB.items[id].img;}); if(!ok) out.imgBad.push(id); }
        // 經驗藥水
        for(const k in player.buffs) if(/^exp/.test(k)) delete player.buffs[k];
        gainItem('potion_exp130',2,true,true); gainItem('potion_exp300',1,true,true);
        out.m0=expPotionMult();
        await use('potion_exp130'); out.b130=player.buffs.exp130; out.m130=expPotionMult();
        await use('potion_exp300'); out.m300=expPotionMult();
        await use('potion_exp2'); out.mWith2=expPotionMult();
        delete player.buffs.exp300; out.mDrop=expPotionMult();
        out.left130=cnt('potion_exp130');
        // 村莊傳送卷軸
        out.townStart=mapState.current;
        gainItem('scroll_town_giran',1,true,true); gainItem('scroll_town_heine',1,true,true);
        if(mapState.current==='town_giran'){ await use('scroll_town_giran'); out.sameKept=cnt('scroll_town_giran'); }
        await use('scroll_town_heine'); await wait(1200);
        out.townAfter=mapState.current; out.heineLeft=cnt('scroll_town_heine');
        // 魔法娃娃任選卷
        gainItem('doll_pick_3',2,true,true);
        await use('doll_pick_3');
        const w=document.getElementById('dollpick-win');
        out.winShown=!!w && !w.classList.contains('hidden');
        out.rows=w?w.querySelectorAll('[data-pick]').length:0;
        out.tier3=DOLL_BY_TIER[3].length;
        out.pickBefore=cnt('doll_pick_3');
        const pickId=w&&w.querySelector('[data-pick]')&&w.querySelector('[data-pick]').getAttribute('data-pick');
        const dollBefore=cnt(pickId);
        if(pickId) w.querySelector('[data-pick]').click(); await wait(300);
        out.pickAfter=cnt('doll_pick_3'); out.dollGain=cnt(pickId)-dollBefore; out.pickTier=DB.items[pickId]&&DB.items[pickId].dollTier;
        out.winHidden=w.classList.contains('hidden');
        dollPickChoose('doll_pick_3', DOLL_BY_TIER[4][0]); out.wrongTierLeft=cnt('doll_pick_3');
        return out;
    })()`);
    console.log('INFO ' + asc(JSON.stringify(r)));
    ok(r && r.npcLeft.length === 0, '下架 NPC 不在任何村莊 (' + (r && r.npcLeft.join(',')) + ')');
    ok(r && r.imgBad.length === 0, '新道具圖示全部載入 (' + (r && r.imgBad.join(',')) + ')');
    ok(r && r.m0 === 1, '未喝經驗倍率 1');
    ok(r && r.b130 >= 595 && r.b130 <= 600 && r.m130 === 1.3, '130% 藥水 10 分鐘、倍率 1.3 (' + (r && r.b130) + ')');
    ok(r && r.m300 === 3, '再喝 300% 取最高 3');
    ok(r && r.mWith2 === 3, '加喝新手 200% 不疊加仍 3');
    ok(r && r.mDrop === 2, '300% 結束後回落到仍生效的 2');
    ok(r && r.left130 === 1, '130% 藥水消耗 1 瓶');
    ok(r && (r.townStart !== 'town_giran' || r.sameKept === 1), '人在奇岩用奇岩傳送卷軸不消耗 (' + (r && r.townStart) + ')');
    ok(r && r.townAfter === 'town_heine' && r.heineLeft === 0, '海音傳送卷軸傳到海音並消耗 (' + (r && r.townAfter) + ')');
    ok(r && r.winShown && r.rows === r.tier3 && r.rows > 0, '任選卷列出全部三階娃娃 (' + (r && r.rows) + '/' + (r && r.tier3) + ')');
    ok(r && r.pickBefore === 2, '開視窗不扣卷');
    ok(r && r.pickAfter === 1 && r.dollGain === 1 && r.pickTier === 3 && r.winHidden, '選定後扣 1 張、得到該三階娃娃');
    ok(r && r.wrongTierLeft === 1, '不能用三階卷選四階娃娃');
    ok(errors.length === 0, 'JS 例外：' + (errors[0] || '無'));
    if (process.env.SHOT) {
        await ev(`(async()=>{ const it=player.inv.find(i=>i.id==='doll_pick_3'); if(it) useItem(it.uid); await new Promise(r=>setTimeout(r,500)); })()`);
        const s = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(process.env.SHOT, Buffer.from(s.result.data, 'base64'));
    }
    try { ws.close(); } catch (e) {}
    try { br.kill(); } catch (e) {}
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
