// 實測：新手禮包（照新創）—功能道具／象牙塔裝備／象牙塔卷軸藥水；自動系統優先用綁定版；不可販售；負重不超標
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-starter-kit.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9377;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-'));
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
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };

    const stamp = Date.now() % 100000;
    const acct = 'kit' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'kit-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'kit-test', clientId: 'kit-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });

    for (const [raw, cls, slot] of [['m_knight', 'knight', 1], ['m_mage', 'mage', 2]]) {
        await send('Page.navigate', { url: BASE + '/' });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof invFindPref==="function"')) break; }
        await ev(`(async()=>{
            window._authAccountForNames=()=>${JSON.stringify(acct)};
            currentSlot=${slot}; curCreate.rawCls='${raw}'; curCreate.cls='${cls}';
            document.getElementById('create-name-input').value=${JSON.stringify('禮' + stamp)}+'${slot}';
            startGame(); await new Promise(r=>setTimeout(r,3500));
            try{ setPowerSaveOn(false); }catch(e){}
        })()`);
        const r = await ev(`(async()=>{
            const cnt=(id)=>player.inv.filter(i=>i.id===id).reduce((a,i)=>a+(i.cnt||1),0);
            const eq=(s)=>player.eq[s]&&player.eq[s].id;
            const ids=['fn_home','fn_tele','fn_auto','fn_settings','fn_drop','ivt_helm','ivt_armor','ivt_gloves','ivt_boots','ivt_sword','ivt_2hsword','ivt_scroll_teleport','ivt_scroll_poly','ivt_potion_haste'];
            const imgs={};
            for(const id of ids){ const src=getIconUrl(DB.items[id]); imgs[id]=await new Promise(res=>{const im=new Image();im.onload=()=>res(im.naturalWidth>0);im.onerror=()=>res(false);im.src=src;}); }
            const c={}; ids.forEach(id=>{ c[id]=cnt(id)+(Object.values(player.eq).some(e=>e&&e.id===id)?1:0); });
            return { cls:player.cls, c, imgs, helm:eq('helm'), armor:eq('armor'), gloves:eq('gloves'), boots:eq('boots'), wpn:eq('wpn'),
                load:(player.d&&player.d.loadTier)||0, noSell:ids.every(id=>DB.items[id].noSell) };
        })()`);
        console.log('INFO ' + cls + ' ' + asc(JSON.stringify(r)));
        const c = r.c;
        ok(['fn_home', 'fn_tele', 'fn_auto', 'fn_settings', 'fn_drop'].every((k) => c[k] === 1), cls + ' 5 個功能道具');
        ok(c.ivt_helm === 1 && c.ivt_armor === 1 && c.ivt_gloves === 1 && c.ivt_boots === 1, cls + ' 象牙塔防具 4 件');
        ok(r.helm === 'ivt_helm' && r.armor === 'ivt_armor' && r.gloves === 'ivt_gloves' && r.boots === 'ivt_boots', cls + ' 象牙塔防具已穿上');
        if (cls === 'knight') {
            ok(c.ivt_sword === 1 && c.ivt_2hsword === 1 && r.wpn === 'ivt_sword', '騎士 單手劍(裝備)＋雙手劍');
        } else {
            ok(c.ivt_sword === 0 && c.ivt_2hsword === 0, '法師 不給劍');
        }
        ok(c.ivt_scroll_teleport === 500 && c.ivt_scroll_poly === 10 && c.ivt_potion_haste === 50, cls + ' 瞬移500／變身10／加速50');
        ok(Object.values(r.imgs).every(Boolean), cls + ' 圖示全部載入 ' + Object.entries(r.imgs).filter((e) => !e[1]).map((e) => e[0]).join(','));
        ok(r.noSell, cls + ' 全部不可販售');
        ok(r.load < 1, cls + ' 不超重 (loadTier ' + r.load + ')');
    }

    // 功能道具＋優先使用綁定版（以法師角色續測）
    const f = await ev(`(async()=>{
        const out={};
        const use=(id)=>{ const it=player.inv.find(i=>i.id===id); useItem(it.uid); };
        out.prefTp=invFindPref('scroll_teleport').id;
        out.prefPoly=invFindPref('scroll_poly').id;
        out.prefHaste=invFindPref('potion_haste').id;
        gainItem('scroll_teleport',3,true,true);
        out.prefTp2=invFindPref('scroll_teleport').id;
        out.cntTp=invCountPref('scroll_teleport');
        use('fn_tele'); await new Promise(r=>setTimeout(r,500));
        const box=document.getElementById('town-interaction-container');
        out.teleOpen=!!box&&!box.classList.contains('hidden')&&!!document.querySelector('#interaction-content .tp-panel');
        try{ closeNpcInteraction(); }catch(e){}
        use('fn_settings'); await new Promise(r=>setTimeout(r,400));
        out.settingsTab=(document.querySelector('#col-right .tab-bar-buttons .active')||{}).getAttribute?document.querySelector('#col-right .tab-bar-buttons .active').getAttribute('data-tab'):null;
        use('fn_drop'); await new Promise(r=>setTimeout(r,400));
        out.dropTab=document.querySelector('#col-right .tab-bar-buttons .active')&&document.querySelector('#col-right .tab-bar-buttons .active').getAttribute('data-tab');
        out.auditView=_auditView;
        out.fnStill=['fn_home','fn_tele','fn_settings','fn_drop'].every(id=>player.inv.some(i=>i.id===id));
        // 自動加速優先綁定版
        const h0=invCountPref('potion_haste'), hv0=player.inv.filter(i=>i.id==='ivt_potion_haste').reduce((a,i)=>a+i.cnt,0);
        player.buffs.haste=0; const hc=document.getElementById('set-haste'); if(hc) hc.checked=true;
        try{ autoActions(); }catch(e){ out.autoErr=String(e&&e.message); }
        if(!(player.buffs.haste>0)){ try{ for(let k=0;k<3&&!(player.buffs.haste>0);k++){ await new Promise(r=>setTimeout(r,1100)); } }catch(e){} }
        out.hasteBuff=player.buffs.haste;
        out.ivtHasteUsed=hv0-player.inv.filter(i=>i.id==='ivt_potion_haste').reduce((a,i)=>a+i.cnt,0);
        if(hc) hc.checked=false;
        // 賣不掉
        const sell=player.inv.find(i=>i.id==='ivt_scroll_teleport');
        out.canSell=(typeof itemSellable==='function')?itemSellable(sell):null;
        return out;
    })()`);
    console.log('INFO fn ' + asc(JSON.stringify(f)));
    ok(f.prefTp === 'ivt_scroll_teleport' && f.prefPoly === 'ivt_scroll_poly' && f.prefHaste === 'ivt_potion_haste', '自動使用優先綁定版');
    ok(f.prefTp2 === 'ivt_scroll_teleport' && f.cntTp === 503, '同時有一般卷軸仍先用綁定版、計數合併 (' + f.cntTp + ')');
    ok(f.teleOpen, '傳送 開啟傳送選單');
    ok(f.settingsTab === 'automation', '設定 開設定分頁 (' + f.settingsTab + ')');
    ok(f.dropTab === 'audit' && f.auditView === 'drops', '掉落查詢 開本圖掉落物');
    ok(f.fnStill, '功能道具使用後不消失');
    ok(f.hasteBuff > 0 && f.ivtHasteUsed === 1, '自動加速用掉 1 瓶象牙塔加速藥水 (' + f.ivtHasteUsed + ')');
    await shot('kit_mage.jpg');
    ok(errors.length === 0, 'JS 例外：' + (errors[0] || '無'));
    try { ws.close(); } catch (e) {}
    try { br.kill(); } catch (e) {}
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
