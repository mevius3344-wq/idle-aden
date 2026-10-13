// 實測：設定／內掛選單／輔助設定 視窗（照新創）＋應急／自動解毒／自動購買數量
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-lin-menus.js [baseUrl]；SHOTS=資料夾 另存截圖
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9385;
const SHOTS = process.env.SHOTS || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

(async () => {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map(); const errors = [];
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]); }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 20000 }), sleep(30000).then(() => ({ result: { exceptionDetails: { text: 'TIMEOUT ' + expr.slice(0, 80) } } }))]);
        if (r.result && r.result.exceptionDetails) { const d = r.result.exceptionDetails; console.log('EVAL_ERR ' + asc(String((d.exception && d.exception.description) || d.text).split('\n')[0])); }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name) => { if (!SHOTS) return; const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 75 }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(s.result.data, 'base64')); };

    const stamp = Date.now() % 100000, acct = 'lm' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'lm-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'lm-test', clientId: 'lm-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof linMenuOpen==="function"')) break; }
    await ev(`(async()=>{ window._authAccountForNames=()=>${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_elf'; curCreate.cls='elf';
        document.getElementById('create-name-input').value=${JSON.stringify('選' + stamp)};
        startGame();
        for(let k=0;k<40&&!(player.inv||[]).some(i=>i.id==='fn_settings');k++) await new Promise(r=>setTimeout(r,250));
        await new Promise(r=>setTimeout(r,1000)); try{ setPowerSaveOn(false); }catch(e){} })()`);

    // 內掛選單
    const a = await ev(`(async()=>{
        const vis=(id)=>{const w=document.getElementById(id);return !!w&&!w.classList.contains('hidden');};
        const fns=player.inv.filter(i=>/^fn_/.test(i.id)).map(i=>i.id+'x'+i.cnt).join(',');
        const it=player.inv.find(i=>i.id==='fn_auto'); useItem(it.uid); await new Promise(r=>setTimeout(r,400));
        const fns2=player.inv.filter(i=>/^fn_/.test(i.id)).map(i=>i.id+'x'+i.cnt).join(',');
        const w=document.getElementById('lm-win-auto');
        const tabs=[...w.querySelectorAll('.lm-tabs [data-tab]')].map(b=>b.textContent).join(',');
        const inPane=(elId,pane)=>{const e=document.getElementById(elId);return !!(e&&e.closest('[data-pane="'+pane+'"]')&&e.closest('#lm-win-auto'));};
        const out={fns,fns2,open:vis('lm-win-auto'),tabs,
            patrol:inPane('set-patrol','hunt'),tp:inPane('set-teleport','hunt'),nomob:inPane('set-nomob-tp','hunt'),
            buyPot:inPane('set-auto-buy-pot','supply'),qtyPot:inPane('set-buy-qty-pot','supply'),qtyArrow:inPane('set-buy-qty-arrow','supply'),
            atk:inPane('sel-atk-skill','magic'),mpAtk:inPane('set-mp-atk','magic'),hpSkill:inPane('set-hp-skill','magic'),
            pet:inPane('set-pet-heal-hp','summon')};
        out.patrolVisible=!!document.getElementById('set-patrol').offsetParent;
        w.querySelector('[data-tab="magic"]').click(); await new Promise(r=>setTimeout(r,100));
        out.magicShown=!!document.getElementById('sel-atk-skill').offsetParent && !document.getElementById('set-patrol').offsetParent;
        const tg=w.querySelector('.lm-auto-toggle'); out.toggleTxt=tg&&tg.textContent;
        return out; })()`);
    console.log('INFO auto ' + asc(JSON.stringify(a)));
    ok(a && a.open, '內掛道具開內掛選單');
    ok(a && a.tabs === '狩獵,補給,魔法,召喚', '分頁：狩獵／補給／魔法／召喚');
    ok(a && a.patrol && a.tp && a.nomob && a.patrolVisible, '狩獵：巡邏範圍／看見頭目瞬移／沒怪瞬移');
    ok(a && a.buyPot && a.qtyPot && a.qtyArrow, '補給：自動購買＋一次買幾個');
    ok(a && a.atk && a.mpAtk && a.hpSkill && a.magicShown, '魔法：攻擊魔法／魔力不足改普攻／消耗 HP 門檻，切分頁正常');
    ok(a && a.pet, '召喚：寵物補血');
    ok(a && /掛機/.test(a.toggleTxt || ''), '開始／停止掛機按鈕');
    await ev(`(()=>{document.querySelector('#lm-win-auto [data-tab="hunt"]').click();return 1})()`);
    await shot('lm_auto.jpg');

    // 輔助設定
    const b = await ev(`(async()=>{
        linMenuClose(); const it=player.inv.find(i=>i.id==='fn_settings'); useItem(it.uid); await new Promise(r=>setTimeout(r,400));
        const w=document.getElementById('lm-win-assist');
        const inPane=(elId,pane)=>{const e=document.getElementById(elId);return !!(e&&e.closest('[data-pane="'+pane+'"]')&&e.closest('#lm-win-assist'));};
        const opts=[...document.getElementById('set-emerg-item').options].map(o=>o.value);
        return {open:!w.classList.contains('hidden'),tabs:[...w.querySelectorAll('.lm-tabs [data-tab]')].map(b=>b.textContent).join(','),
            vfx:inPane('set-vfx-on','general'),ps:inPane('set-power-save','general'),
            pot:inPane('set-pot','potion'),hpPot:inPane('set-hp-pot','potion'),emerg:inPane('set-emerg-hp','potion'),
            haste:inPane('set-haste','status'),buffs:inPane('auto-buff-skills','status'),elf:inPane('set-elfcookie','status'),
            elfShown:!document.getElementById('ui-elfcookie-row').classList.contains('hidden'),
            cure:inPane('set-auto-cure','aux'),
            emergOpts:opts.length, emergHome:opts[0]==='fn_home', emergTown:opts.includes('scroll_town_heine')}; })()`);
    console.log('INFO assist ' + asc(JSON.stringify(b)));
    ok(b && b.open && b.tabs === '一般,藥水,狀態,輔助', '設定道具開輔助設定（一般／藥水／狀態／輔助）');
    ok(b && b.vfx && b.ps, '一般：特效／省電');
    ok(b && b.pot && b.hpPot && b.emerg, '藥水：補血＋應急');
    ok(b && b.haste && b.buffs && b.elf && b.elfShown, '狀態：補狀態道具＋魔法（妖精看得到精靈餅乾）');
    ok(b && b.cure, '輔助：自動解毒');
    ok(b && b.emergHome && b.emergTown, '應急道具：主城符＋村莊傳送卷軸 (' + (b && b.emergOpts) + ')');
    await ev(`(()=>{document.querySelector('#lm-win-assist [data-tab="potion"]').click();return 1})()`);
    await shot('lm_assist.jpg');

    // 設定（遊戲選單）
    const c = await ev(`(async()=>{
        linMenuClose(); switchMobileTabGroup('settings'); await new Promise(r=>setTimeout(r,400));
        const w=document.getElementById('lm-win-settings');
        const btns=w?[...w.querySelectorAll('.lm-list .lm-btn')].map(b=>b.textContent):[];
        const open=!!w&&!w.classList.contains('hidden');
        const audio=[...w.querySelectorAll('.lm-btn')].find(b=>/音樂/.test(b.textContent)); if(audio) audio.click(); await new Promise(r=>setTimeout(r,100));
        const vol=!!document.getElementById('set-bgm-vol').closest('#lm-win-settings') && !!document.getElementById('set-bgm-vol').offsetParent;
        const back=[...w.querySelectorAll('.lm-btn')].find(b=>/返回/.test(b.textContent)); if(back) back.click();
        switchTab('automation'); await new Promise(r=>setTimeout(r,200));
        const viaTab=!document.getElementById('lm-win-settings').classList.contains('hidden');
        const sub=[...document.querySelectorAll('#mobile-tab-sub [data-sub]')].map(b=>b.getAttribute('data-sub')).join(',');
        return {open,n:btns.length,btns:btns.join('|'),vol,viaTab,sub}; })()`);
    console.log('INFO settings ' + asc(JSON.stringify(c)));
    ok(c && c.open, '右側選單「設定」開遊戲選單視窗');
    ok(c && c.n === 11 && /輔助設定/.test(c.btns) && /內掛選單/.test(c.btns) && /書籤/.test(c.btns) && /排行榜/.test(c.btns) && /回選角/.test(c.btns), '遊戲選單 11 項（輔助設定／內掛／自動賣出／書籤／排行榜／音量／畫面／全螢幕／回選角／刪除角色／離開）');
    ok(c && c.vol, '音樂／音效音量 子頁');
    ok(c && c.viaTab, '舊「設定分頁」入口改開視窗');
    await shot('lm_settings.jpg');

    // 行為：自動購買數量、自動解毒、應急
    const d = await ev(`(async()=>{
        linMenuClose();
        const out={};
        const cnt=(id)=>player.inv.filter(i=>i.id===id).reduce((a,i)=>a+(i.cnt||1),0);
        player.gold=100000;
        player.inv=player.inv.filter(i=>i.id!=='potion_heal');
        document.getElementById('set-pot').value='potion_heal';
        document.getElementById('set-auto-buy-pot').checked=true;
        document.getElementById('set-buy-qty-pot').value='37';
        autoActions(); out.bought=cnt('potion_heal');
        document.getElementById('set-auto-buy-pot').checked=false;
        player.statuses.poison=50; player.statuses.poisonDmg=3;
        document.getElementById('set-auto-cure').checked=true;
        autoActions(); out.poison=player.statuses.poison; out.cureLeft=cnt('potion_cure');
        document.getElementById('set-auto-cure').checked=false;
        setMapSelectors('talking_island'); changeMap(); await new Promise(r=>setTimeout(r,1500));
        out.field=mapState.current;
        document.getElementById('set-emerg-hp').value='50';
        document.getElementById('set-emerg-item').value='fn_home';
        document.getElementById('set-hp-pot').value='0';
        state._emergAt=null;
        player.hp=Math.max(1,Math.floor(player.mhp*0.2));
        autoActions(); await new Promise(r=>setTimeout(r,1500));
        out.afterEmerg=mapState.current; out.fnHome=cnt('fn_home');
        document.getElementById('set-emerg-hp').value='0';
        return out; })()`);
    console.log('INFO logic ' + asc(JSON.stringify(d)));
    ok(d && d.bought === 37, '藥水用完自動買自訂數量 37 (' + (d && d.bought) + ')');
    ok(d && d.poison === 0 && d.cureLeft === 0, '中毒自動買翡翠藥水並解毒');
    ok(d && d.field && d.field.indexOf('town_') !== 0 && d.afterEmerg === 'town_giran' && d.fnHome === 1, '應急：野外 HP 低於門檻用主城符回奇岩、不消耗 (' + (d && d.field) + '→' + (d && d.afterEmerg) + ')');
    ok(errors.length === 0, 'JS 例外：' + (errors.slice(0, 3).map(asc).join(' | ') || '無'));
    try { ws.close(); } catch (e) {}
    try { br.kill(); } catch (e) {}
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
