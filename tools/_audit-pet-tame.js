// 實測：原版寵物馴服（帶誘捕道具、打到 1/3 血以下＝當場變寵物、不給經驗／金幣／掉落；老虎 1/16；保管滿不消耗；道具不需使用）
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-pet-tame.js [baseUrl]   截圖 → tools/lin/_out/tame_*.png
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9371;
const OUT = path.join(__dirname, 'lin', '_out');
const FIELD = 'talking_island';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'tame-'));
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
    const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };

    const stamp = Date.now() % 100000;
    const acct = 'tame' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'tame-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'tame-test', clientId: 'tame-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof petTameOnKill==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('馴' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        return 1;
    })()`);
    await ev(`(()=>{window.__fb5AuthAccount=${JSON.stringify(acct)};player.lv=30;calcStats();player.hp=player.mhp;player.gold=100000;return 1})()`);
    await ev(`(()=>{const sel=document.getElementById('map-select');if(![...sel.options].some(o=>o.value==='${FIELD}')){const o=document.createElement('option');o.value='${FIELD}';sel.appendChild(o);}sel.value='${FIELD}';changeMap(true);return 1})()`);
    await sleep(3000);

    // 共用：取一隻活怪改成指定動物，直接走 killMob（等同伺服器授權後的結算路徑）
    const H = `window.__t={
        cnt:(id)=>player.inv.filter(i=>i.id===id).reduce((s,i)=>s+(i.cnt||1),0),
        setInv:(id,n)=>{player.inv=player.inv.filter(i=>i.id!==id);if(n>0)gainItem(id,n,true,true);},
        kill:(name)=>{const idx=(mapState.mobs||[]).findIndex(m=>m&&m.curHp>0&&!m.boss);if(idx<0)return null;const m=mapState.mobs[idx];
            m.n=name;m.exp=37;m.boss=false;m._authKillOk=true;m.curHp=0;const exp0=player.exp,lv0=player.lv,gold0=player.gold,inv0=player.inv.length,pets0=petRoster().length;
            killMob(idx);return {exp:player.exp-exp0,lv:player.lv-lv0,gold:player.gold-gold0,inv:player.inv.length-inv0,pets:petRoster().length-pets0,dead:!!m._dead};},
    };1`;
    await ev(H);
    let ready = false;
    for (let i = 0; i < 30 && !ready; i++) { await sleep(500); ready = await ev('(mapState.mobs||[]).some(m=>m&&m.curHp>0&&!m.boss)'); }
    ok(ready, '說話之島有怪可測');

    // 1) 帶漂浮之眼肉 → 狼被打倒＝馴服：肉 -1、保管 +1、無經驗／金幣
    await ev(`(()=>{__t.setInv('item_eye_meat',3);player.buffs={};return 1})()`);
    const r1 = await ev(`JSON.stringify(Object.assign(__t.kill('狼'),{meat:__t.cnt('item_eye_meat'),last:petRoster().slice(-1)[0]&&petRoster().slice(-1)[0].form}))`);
    const a1 = JSON.parse(r1 || '{}');
    ok(a1.pets === 1 && a1.meat === 2 && a1.last === '狼' && a1.exp === 0 && a1.gold === 0 && a1.dead, '帶肉打倒狼＝馴服（肉-1、保管+1、無經驗金幣）' + r1);

    // 2) 沒帶對應道具 → 正常擊殺（給經驗、不進保管）
    await ev(`(()=>{__t.setInv('item_eye_meat',0);return 1})()`);
    const r2 = await ev(`JSON.stringify(__t.kill('狼'))`);
    const a2 = JSON.parse(r2 || '{}');
    ok(a2.pets === 0 && (a2.exp > 0 || a2.lv > 0), '沒帶肉＝正常擊殺有經驗 ' + r2);

    // 3) 一般肉不能馴服高麗幼犬（專屬誘食）；暴走兔要胡蘿蔔
    await ev(`(()=>{__t.setInv('item_eye_meat',2);return 1})()`);
    const r3 = await ev(`JSON.stringify(Object.assign(__t.kill('高麗幼犬'),{meat:__t.cnt('item_eye_meat')}))`);
    const a3 = JSON.parse(r3 || '{}');
    ok(a3.pets === 0 && a3.meat === 2, '一般肉不能馴服高麗幼犬（不扣肉）' + r3);
    await ev(`(()=>{__t.setInv('item_carrot',1);return 1})()`);
    const r3b = await ev(`JSON.stringify(Object.assign(__t.kill('暴走兔'),{carrot:__t.cnt('item_carrot'),meat:__t.cnt('item_eye_meat')}))`);
    const a3b = JSON.parse(r3b || '{}');
    ok(a3b.pets === 1 && a3b.carrot === 0 && a3b.meat === 2, '胡蘿蔔馴服暴走兔（不動到肉）' + r3b);

    // 4) 老虎：1/16，失敗照扣誘食且正常擊殺；成功變虎男
    await ev(`(()=>{__t.setInv('item_tiger_feed',2);window.__rnd=Math.random;Math.random=()=>0.5;return 1})()`);
    const r4 = await ev(`JSON.stringify(Object.assign(__t.kill('老虎'),{feed:__t.cnt('item_tiger_feed')}))`);
    const a4 = JSON.parse(r4 || '{}');
    await ev(`(()=>{Math.random=()=>0.01;return 1})()`);
    const r4b = await ev(`JSON.stringify(Object.assign(__t.kill('老虎'),{feed:__t.cnt('item_tiger_feed'),last:petRoster().slice(-1)[0]&&petRoster().slice(-1)[0].form}))`);
    const a4b = JSON.parse(r4b || '{}');
    await ev(`(()=>{Math.random=window.__rnd;return 1})()`);
    ok(a4.pets === 0 && a4.feed === 1 && (a4.exp > 0 || a4.lv > 0), '老虎失敗：誘食照扣、正常擊殺 ' + r4);
    ok(a4b.pets === 1 && a4b.feed === 0 && a4b.last === '虎男' && a4b.exp === 0, '老虎成功：變虎男 ' + r4b);
    const odds = await ev(`(()=>{let s=0;for(let i=0;i<16000;i++){if(Math.floor(Math.random()*PET_TAME_ODDS.lure_tiger)===0)s++;}return s/16000})()`);
    ok(Math.abs(odds - 1 / 16) < 0.015, '老虎機率約 1/16（抽樣 ' + odds + '）');

    // 5) 保管滿：不扣肉、正常擊殺
    const full = await ev(`(()=>{const add=PET_STORAGE_MAX-petRoster().length;for(let i=0;i<add;i++)petStoreAdd('牧羊犬',null,true);petRosterSave();return petRoster().length})()`);
    const r5 = await ev(`JSON.stringify(Object.assign(__t.kill('狼'),{meat:__t.cnt('item_eye_meat')}))`);
    const a5 = JSON.parse(r5 || '{}');
    ok(full >= 32 && a5.pets === 0 && a5.meat === 2 && (a5.exp > 0 || a5.lv > 0), '保管滿：不扣肉、正常擊殺 ' + r5);
    const left = await ev(`(()=>{petRoster().filter(p=>p.form==='牧羊犬').map(p=>p.uid).forEach(u=>petReleaseConfirm(u,true));return petRoster().length})()`);
    ok(left < 32, '清掉測試用寵物（剩 ' + left + '）');

    // 6) 道具不需使用：使用不消耗、只顯示說明
    const r6 = await ev(`(()=>{const it=player.inv.find(i=>i.id==='item_eye_meat');const n0=__t.cnt('item_eye_meat');useItem(it.uid);return JSON.stringify({n0,n1:__t.cnt('item_eye_meat'),buff:!!(player.buffs.lure_general>0),log:(document.getElementById('log-sys')||document.body).innerText.indexOf('不需要使用')>=0})})()`);
    const a6 = JSON.parse(r6 || '{}');
    ok(a6.n0 === a6.n1 && !a6.buff, '使用漂浮之眼肉不消耗、不掛狀態 ' + r6);
    const r6b = await ev(`(()=>{const it=player.inv.find(i=>i.id==='item_eye_meat');const a=_autoSellDecision(it,null,{}).sell;const r=getAutoSellRules();r.overrides.item_eye_meat='sell';const b=_autoSellDecision(it,null,{}).sell;delete r.overrides.item_eye_meat;return JSON.stringify({auto:a,override:b})})()`);
    const a6b = JSON.parse(r6b || '{}');
    ok(a6b.auto === false && a6b.override === true, '自動販賣預設不賣誘捕道具（玩家設「永遠賣掉」才賣）' + r6b);

    // 7) 實戰：連線同圖（伺服器權威擊殺）自動打狼／杜賓狗，帶肉會自動馴服
    const rt = await ev('typeof rtWorldIsConnected==="function"&&rtWorldIsConnected()');
    console.log('realtime connected=' + rt + ' auth=' + await ev('typeof rtWorldAuthCombatActive==="function"&&rtWorldAuthCombatActive()'));
    await ev(`(()=>{__t.setInv('item_eye_meat',2);player.lv=12;calcStats();player.hp=player.mhp;window.__pets0=petRoster().length;state.autoHunt=true;
        window.__tlog=[];const ls=window.logSys;window.logSys=function(m){if(/寵物|馴服|保管|丟給|漂浮之眼肉|出售|賣/.test(String(m)))window.__tlog.push(String(m).replace(/<[^>]+>/g,''));return ls.apply(this,arguments)};return 1})()`);
    let live = null;
    for (let i = 0; i < 160 && !live; i++) {
        await sleep(500);
        const s = JSON.parse(await ev(`(()=>{player.hp=player.mhp;const now=Date.now();let near=null;
            (mapState.mobs||[]).forEach(m=>{if(!m)return;const ok=m.n==='狼'||m.n==='杜賓狗';m._unreachUntil=ok?0:now+60000;if(ok&&m.curHp>0&&m._fx!=null&&!near)near=m;});
            if(near&&(mapState.targetIdx<0||!mapState.mobs[mapState.targetIdx]||!['狼','杜賓狗'].includes(mapState.mobs[mapState.targetIdx].n))){
                const d=Math.hypot(near._fx-explorePlayerX(),(near._fy||0)-explorePlayerY());if(d>200)exploreTeleportTo(mapState.current,near._fx,near._fy||0);}
            return JSON.stringify({pets:petRoster().length-window.__pets0,meat:__t.cnt('item_eye_meat'),auth:typeof rtWorldAuthCombatActive==='function'&&rtWorldAuthCombatActive(),near:!!near})})()`));
        if (s.pets > 0) live = s;
        if (i % 20 === 10) console.log('dbg ' + JSON.stringify(s));
    }
    ok(!!live && live.meat === 1, '實戰自動打狼／杜賓狗：帶肉自動馴服 ' + JSON.stringify(live));
    fs.writeFileSync(path.join(OUT, 'tame_log.json'), JSON.stringify({ log: await ev('window.__tlog'), pets: await ev('JSON.stringify(petRoster().map(p=>p.form))') }, null, 1), 'utf8');
    await shot('tame_live.png');

    ok(errors.length === 0, 'JS 例外：' + (errors.slice(0, 4).map(asc).join(' | ') || '無'));
    ws.close(); br.kill();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
