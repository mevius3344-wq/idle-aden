// 實測：主城奇岩—所有職業出生奇岩；主城符／回村鈕／死亡都回奇岩；奇岩有傳送師爾瑪、魔法傳授、寵物保管、道具回收
// 用法：先起 _serve.js（PORT=5199），再 node tools/_audit-main-city.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9378;
const OUT = path.join(__dirname, 'lin', '_out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

(async () => {
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-'));
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
    const acct = 'mc' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'mc-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'mc-test', clientId: 'mc-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });

    const goMap = (m) => ev(`(async()=>{ setMapSelectors(${JSON.stringify(m)}); changeMap(true); await new Promise(r=>setTimeout(r,1500)); return mapState.current; })()`);

    for (const [raw, cls, slot] of [['m_elf', 'elf', 2], ['m_knight', 'knight', 1]]) {
        await send('Page.navigate', { url: BASE + '/' });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof renderRecycleNPC==="function"')) break; }
        await ev(`(async()=>{
            window._authAccountForNames=()=>${JSON.stringify(acct)};
            currentSlot=${slot}; curCreate.rawCls='${raw}'; curCreate.cls='${cls}';
            document.getElementById('create-name-input').value=${JSON.stringify('城' + stamp)}+'${slot}';
            startGame(); await new Promise(r=>setTimeout(r,3500));
            try{ setPowerSaveOn(false); }catch(e){}
        })()`);
        const born = (await ev(`({ cur: mapState.current, home: getHomeTown(), last: getLastTown() })`)) || {};
        if (!born.cur) console.log('INFO errors ' + JSON.stringify(errors.slice(0, 5)) + ' href=' + (await ev('location.href')));
        ok(born.cur === 'town_giran' && born.home === 'town_giran' && born.last === 'town_giran', cls + ' 出生在奇岩 (' + born.cur + ')');
        const magic = await ev(`getShopItemsForNpc('npc_giran_magic')`);
        console.log('INFO ' + cls + ' magic ' + magic.join(','));
        const bad = await ev(`getShopItemsForNpc('npc_giran_magic').filter(id=>{const d=DB.items[id];return d.type==='skillbk'&&skillReqLv(DB.skills[d.sk],d.sk)===undefined;})`);
        const learnable = Array.isArray(bad) && bad.length === 0;
        if (!learnable) console.log('INFO ' + cls + ' not learnable ' + JSON.stringify(bad));
        const other = await ev(`[].concat(SHOP_LISTS.npc_saedia, SHOP_LISTS.npc_sphere, SHOP_LISTS.npc_sempal${cls === 'elf' ? '' : ', SHOP_LISTS.npc_linda'})`);
        const leak = magic.filter((x) => other.includes(x));
        if (cls === 'elf') ok(learnable && magic.some((x) => /^bk_elf_/.test(x)) && !leak.length, '妖精 魔法傳授只列妖精能學的 (' + magic.length + ' ' + leak.join(',') + ')');
        else ok(learnable && magic.length > 0 && !leak.length, '騎士 魔法傳授只列騎士能學的 (' + magic.length + ' ' + leak.join(',') + ')');
    }

    // 奇岩 NPC：名字、可互動
    await sleep(1500);
    const npcs = await ev(`(async()=>{
        const vis = townVisibleNpcs('town_giran').map(n=>n.n);
        const dom = [...document.querySelectorAll('.lin-npc.is-game[data-npc] .lin-npc-name')].map(e=>e.textContent.trim());
        const plan = linTownPlan('town_giran').filter(p=>p.npc).map(p=>p.npc.n+'@'+(p.o.n||'?'));
        return { vis, dom, plan };
    })()`);
    console.log('INFO npcs ' + JSON.stringify(npcs));
    const want = ['爾瑪', '瑟琳娜', '布魯諾', '亞丁商團'];
    ok(want.every((n) => npcs.vis.includes(n)), '奇岩 NPC 名單有 ' + want.join('／'));
    ok(npcs.vis.filter((n) => n === '傳送師').length === 0, '奇岩不另外多一位無名傳送師');
    ok(want.every((n) => npcs.dom.some((d) => d.includes(n))), '奇岩畫面上站著 4 位新 NPC');
    ok(npcs.plan.includes('爾瑪@爾瑪'), '爾瑪站在原版爾瑪的位置');
    await shot('maincity_giran.jpg');

    const panels = await ev(`(async()=>{
        const out={};
        const open=async(id)=>{ interactNPC(id,'town_giran'); await new Promise(r=>setTimeout(r,500)); return document.getElementById('interaction-content').innerHTML; };
        out.tele=(await open('npc_teleport')).includes('tp-panel');
        closeNpcInteraction();
        const mh=await open('npc_giran_magic'); out.magicRows=document.querySelectorAll('#shop-items-list > *').length;
        closeNpcInteraction();
        out.pet=(await open('npc_giran_pet')).length>50;
        closeNpcInteraction();
        gainItem('wpn_shortsword',1,true,true); gainItem('wpn_shortsword',1,true,true);
        const g0=player.gold;
        await open('npc_giran_recycle');
        out.listed=document.querySelectorAll('#recycle-list input[type=checkbox]').length;
        out.fnListed=document.getElementById('interaction-content').innerHTML.includes('主城');
        const sw=player.inv.find(i=>i.id==='wpn_shortsword');
        recycleToggle(String(sw.uid));
        const prefs0=Object.keys(player.junkPrefs||{}).length;
        recycleSellNow();
        out.goldGain=player.gold-g0;
        out.swLeft=player.inv.filter(i=>i.id==='wpn_shortsword').reduce((a,i)=>a+(i.cnt||1),0);
        out.prefsAdded=Object.keys(player.junkPrefs||{}).length-prefs0;
        closeNpcInteraction();
        return out;
    })()`);
    console.log('INFO panels ' + JSON.stringify(panels));
    ok(panels.tele, '爾瑪 開傳送選單');
    ok(panels.magicRows > 0, '瑟琳娜 開魔法書商店 (' + panels.magicRows + ' 列)');
    ok(panels.pet, '布魯諾 開寵物保管');
    ok(panels.listed > 0 && !panels.fnListed, '亞丁商團 列出可賣物品、不列綁定功能道具');
    ok(panels.goldGain > 0 && panels.prefsAdded === 0, '亞丁商團 賣出拿到金幣、不改自動販賣規則 (+' + panels.goldGain + ')');

    // 從野外：主城符、回村鈕（onclick 帶事件）、死亡
    const field = 'zone_13';
    let cur = await goMap(field);
    ok(cur === field, '進野外 ' + cur);
    const fh = await ev(`(async()=>{ const it=player.inv.find(i=>i.id==='fn_home'); useItem(it.uid); await new Promise(r=>setTimeout(r,1500)); return { cur: mapState.current, still: player.inv.some(i=>i.id==='fn_home') }; })()`);
    ok(fh.cur === 'town_giran' && fh.still, '主城符 回奇岩且不消失 (' + fh.cur + ')');
    const again = await ev(`(async()=>{ const it=player.inv.find(i=>i.id==='fn_home'); useItem(it.uid); await new Promise(r=>setTimeout(r,500)); return mapState.current; })()`);
    ok(again === 'town_giran', '在奇岩再用主城符留在奇岩');
    await goMap('town_silver_knight');
    const fh2 = await ev(`(async()=>{ const it=player.inv.find(i=>i.id==='fn_home'); useItem(it.uid); await new Promise(r=>setTimeout(r,1500)); return mapState.current; })()`);
    ok(fh2 === 'town_giran', '在別的村莊用主城符也回奇岩 (' + fh2 + ')');
    await goMap(field);
    const rb = await ev(`(async()=>{ returnToTown(new MouseEvent('click')); await new Promise(r=>setTimeout(r,1500)); return mapState.current; })()`);
    ok(rb === 'town_giran', '回村鈕（帶點擊事件）回奇岩 (' + rb + ')');
    await goMap('town_silver_knight');
    await goMap(field);
    const dd = await ev(`(async()=>{ player.hp=0; player.dead=true; revive(); await new Promise(r=>setTimeout(r,1500)); return { cur: mapState.current, hp: player.hp }; })()`);
    ok(dd.cur === 'town_giran' && dd.hp > 0, '死亡後回奇岩甦醒 (' + dd.cur + ' hp ' + dd.hp + ')');

    ok(errors.length === 0, 'JS 例外：' + (errors[0] || '無'));
    try { ws.close(); } catch (e) {}
    try { br.kill(); } catch (e) {}
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
