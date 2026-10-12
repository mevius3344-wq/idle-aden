// 實測：世界王回原地圖（全服跨頻道共用一隻、傷害第一拿掉落、經驗依比例、1 小時重生→測試縮短、存檔）
// 用法：node tools/_audit-field-boss.js   （自己起 _serve.js 在 5211，資料寫 tools/lin/_out/fb-data；截圖 → tools/lin/_out/fb_*.png）
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'lin', '_out');
const DATA = path.join(OUT, 'fb-data');
const SRV_PORT = 5211;
const CDP_PORT = 9369;
const BASE = 'http://localhost:' + SRV_PORT;
const WSURL = 'ws://localhost:' + SRV_PORT + '/ws/world';
const RESPAWN_MS = 6000;
const TEST_MAP = 'zone_14';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const asc = (s) => String(s).replace(/[^\x20-\x7e]/g, '?');
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + asc(msg)); if (!cond) fails.push(msg); };

let srv = null;
async function startServer() {
    srv = spawn(process.execPath, ['_serve.js'], {
        cwd: ROOT,
        env: Object.assign({}, process.env, { PORT: String(SRV_PORT), CLOUD_SAVE_DIR: DATA, WB_RESPAWN_MS: String(RESPAWN_MS) }),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    srv.stdout.on('data', (d) => { if (/READY/.test(String(d))) ready = true; });
    srv.stderr.on('data', () => {});
    for (let i = 0; i < 120 && !ready; i++) await sleep(250);
    if (!ready) throw new Error('server not ready');
}
async function stopServer() {
    if (!srv) return;
    const p = new Promise((r) => srv.once('exit', r));
    srv.kill();
    await p;
    srv = null;
}

const STRONG = { lv: 60, diceMax: 300, hitBonus: 250, dmgBonus: 800, critRate: 0, aspdMs: 120 };
const WEAK = { lv: 10, diceMax: 20, hitBonus: 250, dmgBonus: 0, critRate: 0, aspdMs: 120 };

function wsClient(account, name, combat) {
    return new Promise((resolve, reject) => {
        const w = new WebSocket(WSURL);
        const msgs = [];
        w.addEventListener('message', (e) => { try { msgs.push(JSON.parse(e.data)); } catch (er) {} });
        w.addEventListener('error', reject);
        w.addEventListener('open', () => {
            const c = {
                w, msgs, key: '', account, name,
                body(extra) { return Object.assign({ account, slot: 0, name, cls: 'knight', lv: combat.lv, combat, wx: 0, wy: 0 }, extra || {}); },
                send(o) { w.send(JSON.stringify(o)); },
                async wait(pred, ms, from) {
                    const t0 = Date.now();
                    for (;;) {
                        for (let i = from || 0; i < msgs.length; i++) if (pred(msgs[i])) return msgs[i];
                        if (Date.now() - t0 > (ms || 5000)) return null;
                        await sleep(40);
                    }
                },
            };
            resolve(c);
        });
    });
}

async function join(c, mapId, ch) {
    const mark = c.msgs.length;
    c.send(Object.assign(c.body({ mapId, channel: ch }), { t: 'enter' }));
    const ok1 = await c.wait((m) => m.t === 'enter_ok' || m.t === 'enter_rej', 5000, mark);
    c.send(Object.assign(c.body({ mapId, channel: ch }), { t: 'hello' }));
    const h = await c.wait((m) => m.t === 'hello_ok', 5000, mark);
    c.key = h ? h.key : '';
    return ok1;
}

async function hitOnce(c, sid) {
    const mark = c.msgs.length;
    c.send({ t: 'hit', sid, kind: 'phys' });
    return c.wait((m) => (m.t === 'hit_ok' || m.t === 'hit_rej') && (m.t === 'hit_rej' || m.sid === sid), 3000, mark);
}

const getJson = (u) => fetch(BASE + u, { cache: 'no-store' }).then((r) => r.json());
const bossStatus = async (id) => ((await getJson('/api/worldboss/status')).bosses || []).find((b) => b.id === id) || null;
const chatTexts = async () => ((await getJson('/api/chat/poll?since=0')).messages || []).map((m) => String(m.text || ''));

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.rmSync(DATA, { recursive: true, force: true });
    fs.mkdirSync(DATA, { recursive: true });
    await startServer();

    // ===== 1) 伺服器：兩個不同頻道的玩家打同一隻世界王 =====
    if (!process.env.FB_SKIP1) {
    const A = await wsClient('fbaa' + (Date.now() % 100000), 'fbA', STRONG);
    const B = await wsClient('fbbb' + (Date.now() % 100000), 'fbB', WEAK);
    const ea = await join(A, TEST_MAP, 1);
    const eb = await join(B, TEST_MAP, 2);
    ok(ea && ea.t === 'enter_ok' && eb && eb.t === 'enter_ok' && ea.channel !== eb.channel, '兩人進同圖不同頻道 ch' + (ea && ea.channel) + '/ch' + (eb && eb.channel));
    const SID = 'b:testboss';
    const MHP = 20000;
    let markA = A.msgs.length; let markB = B.msgs.length;
    A.send({ t: 'boss_def', mapId: TEST_MAP, bosses: [{ id: 'testboss', slot: 200, n: '測試頭目', mhp: MHP, lv: 10, ac: 10, x: 111, y: 222, mapName: '測試地' }] });
    const snapA = await A.wait((m) => m.t === 'mobs' && (m.mobs || []).some((r) => r.sid === SID), 4000, markA);
    const snapB = await B.wait((m) => m.t === 'mobs' && (m.mobs || []).some((r) => r.sid === SID), 4000, markB);
    const rowB = snapB && snapB.mobs.find((r) => r.sid === SID);
    ok(!!snapA && !!rowB && rowB.boss && rowB.slot === 200 && rowB.x === 111 && rowB.y === 222 && rowB.hp === MHP, '兩個頻道都看到同一隻世界王（固定點、slot 200）');

    B.send({ t: 'boss_def', mapId: TEST_MAP, bosses: [{ id: 'testboss', slot: 201, n: '測試頭目', mhp: 5, lv: 1, x: 0, y: 0 }] });
    await sleep(300);
    const st0 = await bossStatus('testboss');
    ok(st0 && st0.mhp === MHP && st0.mapId === TEST_MAP && st0.mapName === '測試地', '先到先登記，後來的定義不覆蓋 ' + JSON.stringify(st0 && { mhp: st0.mhp, map: st0.mapId }));

    let sumB = 0;
    markA = A.msgs.length;
    for (let i = 0; i < 6; i++) {
        const r = await hitOnce(B, SID);
        if (r && r.t === 'hit_ok') sumB += r.dmg || 0;
        await sleep(90);
    }
    const fxA = await A.wait((m) => m.t === 'hit_fx' && m.sid === SID && m.boss && m.by === B.key, 2000, markA);
    ok(sumB > 0 && !!fxA, '跨頻道同步：B 打的傷害 A 也看到（B 共 ' + sumB + '）');
    const firstA = await hitOnce(A, SID);
    ok(firstA && firstA.t === 'hit_ok' && firstA.hp === MHP - sumB - firstA.dmg, '共用血量：A 看到的血＝滿血－B 傷害－A 傷害 ' + (firstA && firstA.hp));

    markA = A.msgs.length; markB = B.msgs.length;
    let dead = !!(firstA && firstA.dead);
    for (let i = 0; i < 200 && !dead; i++) {
        const r = await hitOnce(A, SID);
        if (r && r.dead) dead = true;
        await sleep(70);
    }
    const kA = await A.wait((m) => m.t === 'kill' && m.sid === SID && !m.already, 3000, markA);
    const kB = await B.wait((m) => m.t === 'kill' && m.sid === SID && !m.already, 3000, markB);
    const sh = (kB && kB.expShare) || {};
    const sA = Number(sh[A.key]) || 0; const sB = Number(sh[B.key]) || 0;
    ok(dead && kA && kB && kB.boss && kA.lootKey === A.key && kB.lootKey === A.key, '擊殺廣播到兩個頻道，掉落給傷害第一（A）');
    ok(sA > sB && sB > 0 && Math.abs(sA + sB - 1) < 0.01 && Math.abs(sB - sumB / MHP) < 0.01, '經驗依傷害比例 A=' + sA + ' B=' + sB + ' (B 期望 ' + (sumB / MHP).toFixed(4) + ')');
    const again = B.msgs.length;
    await hitOnce(B, SID);
    const kAgain = await B.wait((m) => m.t === 'kill' && m.already && m.sid === SID, 2000, again);
    ok(kAgain && kAgain.lootKey === A.key && kAgain.boss, '死後再打只補發同一筆擊殺（掉落仍是 A）');

    const st1 = await bossStatus('testboss');
    ok(st1 && st1.dead && st1.respawnAt > Date.now() && st1.remainMs <= RESPAWN_MS && st1.lastKillerName === 'fbA', '時刻表：已擊敗＋重生倒數＋擊殺者 ' + JSON.stringify(st1 && { dead: st1.dead, remain: st1.remainMs }));
    await sleep(5500);
    const pf = path.join(DATA, 'field-bosses.json');
    const saved = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : null;
    ok(saved && saved.bosses && saved.bosses.testboss && saved.bosses.testboss.killSeq === 1, '狀態寫進 PERSIST_DIR/field-bosses.json');

    markA = A.msgs.length; markB = B.msgs.length;
    const reA = await A.wait((m) => m.t === 'mobs' && (m.mobs || []).some((r) => r.sid === SID && !r.dead && r.hp === MHP), RESPAWN_MS + 4000, markA);
    const reB = await B.wait((m) => m.t === 'mobs' && (m.mobs || []).some((r) => r.sid === SID && !r.dead && r.hp === MHP), 4000, markB);
    ok(!!reA && !!reB, '時間到在原地滿血重生（兩個頻道都收到）');
    const chats = await chatTexts();
    ok(chats.some((t) => /^【頭目戰報】fbA 於 測試地 擊敗了 測試頭目/.test(t)) && chats.some((t) => /^【頭目戰報】測試頭目 出現在 測試地/.test(t)), '世界頻道公告 擊敗＋重生');
    A.w.close(); B.w.close();

    await stopServer();
    await startServer();
    const st2 = await bossStatus('testboss');
    ok(st2 && st2.mapId === TEST_MAP && st2.lastKillerName === 'fbA' && st2.mhp === MHP, '重開伺服器後世界王狀態還在');
    }

    // ===== 2) 瀏覽器：真頭目在原地圖出現、強者拿掉落、弱者只拿比例經驗 =====
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'fboss-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + udd, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json(); } catch (e) {} }
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
    const acct = 'fbos' + stamp;
    const pj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    await pj('/api/accounts/register', { account: acct, password: 'fboss-test' });
    const lr = await pj('/api/accounts/login', { account: acct, password: 'fboss-test', clientId: 'fboss-' + acct });
    if (!lr || !lr.authToken) throw new Error('login failed');
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};window.__DEV_OFFLINE=false;window.__fb5AuthAccount=' + JSON.stringify(acct) + ';try{localStorage.setItem("gameWipeEpoch","2026-10-12");sessionStorage.setItem("fb5_auth_token",' + JSON.stringify(lr.authToken) + ')}catch(e){}' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof wbBossDefsForMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>${JSON.stringify(acct)};
        window.__DEV_OFFLINE=false; window.__fb5AuthAccount=${JSON.stringify(acct)};
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value=${JSON.stringify('王' + stamp)};
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        return 1;
    })()`);
    let conn = false;
    for (let i = 0; i < 30 && !conn; i++) { await sleep(500); conn = await ev('typeof rtWorldIsConnected==="function"&&rtWorldIsConnected()'); }
    if (!conn) console.log('dbgc ' + asc(await ev(`JSON.stringify({id:typeof rtPartyIdentity==='function'?rtPartyIdentity():'nofn',http:typeof rtPartyIsHttp==='function'?rtPartyIsHttp():'nofn',
        ig:!document.getElementById('game-screen').classList.contains('hidden'),cls:player&&player.cls,proto:location.protocol,susp:typeof gameOnlineSuspended==='function'?gameOnlineSuspended():'nofn',dev:window.__DEV_OFFLINE})`)));
    ok(conn, '瀏覽器連上即時世界通道');
    const reg = JSON.parse(await ev(`JSON.stringify((()=>{const r=wbBossRegistry();
        const wbMaps=Object.keys(DB.maps).filter(k=>k.indexOf('wb_')===0).length;
        const pick=r.filter(e=>{const d=mapdefOf(e.home);return d&&d.lin&&mapEntryOf(e.home)&&mapRegionOf(e.home)&&!mapOptDisabled(mapEntryOf(e.home))&&wbBossDefsForMap(e.home).length})
            .sort((a,b)=>a.lv-b.lv)[0];
        const defs=pick?wbBossDefsForMap(pick.home):[];
        const maxSlots=Object.keys(MAP_DEFS).reduce((mx,id)=>Math.max(mx,((mapdefSpawns(id)||[]).length)*2),0);
        return {n:r.length,wbMaps,pick,defs,list:wbWorldBossList().length,maxSlots};
    })())`));
    ok(reg.n > 10 && reg.wbMaps === 0 && reg.list > 0 && reg.pick, '頭目登記在原地圖（' + reg.n + ' 隻，不再有 wb_ 欄位）pick=' + (reg.pick && reg.pick.mobId + '@' + reg.pick.home));
    const home = reg.pick.home;
    const def = reg.defs.find((d) => d.id === reg.pick.mobId);
    ok(reg.maxSlots < 200, '練功槽最多 ' + reg.maxSlots + ' 格，世界王 slot 200+ 不會撞到一般怪');
    ok(def && def.slot >= 200 && def.mhp > 0, '固定重生點 ' + JSON.stringify(def && { slot: def.slot, x: def.x, y: def.y }));

    // 弱者先在別的頻道登記這隻王（血量縮成 BHP、拿掉護甲方便測），並先打幾下
    const BHP = 400;
    const W = await wsClient('fbww' + stamp, 'fbW', WEAK);
    await join(W, home, 3);
    const BSID = 'b:' + def.id;
    W.send({ t: 'boss_def', mapId: home, bosses: [Object.assign({}, def, { mhp: BHP, lv: 1, ac: 10, dr: 0, hardSkin: 0, er: 0 })] });
    await W.wait((m) => m.t === 'mobs' && (m.mobs || []).some((r) => r.sid === BSID), 4000);
    let sumW = 0;
    for (let i = 0; i < 4; i++) { const r = await hitOnce(W, BSID); if (r && r.t === 'hit_ok') sumW += r.dmg || 0; await sleep(90); }

    await ev(`(()=>{player.lv=60;calcStats();player.hp=player.mhp;return 1})()`);
    await ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(home)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current})()`);
    let seen = null;
    for (let i = 0; i < 40 && !seen; i++) {
        await sleep(500);
        const r = await ev(`(()=>{const i=(mapState.mobs||[]).findIndex(m=>m&&m._fieldBoss&&m.curHp>0&&m._serverMobId===${JSON.stringify(BSID)});if(i<0)return null;const m=mapState.mobs[i];
            return JSON.stringify({i,n:m.n,x:Math.round(m._fx),y:Math.round(m._fy),hp:m.curHp,mhp:m.hp,sid:m._serverMobId})})()`);
        if (r) seen = JSON.parse(r);
    }
    if (!seen) console.log('dbg ' + asc(await ev(`JSON.stringify({cur:mapState.current,len:(mapState.mobs||[]).length,idx:(mapState.mobs||[]).map((m,i)=>m?i:-1).filter(i=>i>=0),
        last:window.__lastMobs||null,conn:typeof rtWorldIsConnected==='function'&&rtWorldIsConnected(),online:typeof gameOnlineSuspended==='function'&&gameOnlineSuspended(),ch:window.__rtWorldChannel,auth:typeof rtWorldAuthCombatActive==='function'&&rtWorldAuthCombatActive(),field:exploreFieldCombatActive()})`)));
    ok(seen && seen.i === def.slot && seen.x === def.x && seen.y === def.y && seen.sid === BSID && seen.hp === BHP - sumW, '進原地圖看到世界王（固定點、血量跟伺服器一致）' + asc(JSON.stringify(seen)));
    const exp0 = await ev('player.exp');
    await ev(`(()=>{const m=mapState.mobs[${def.slot}];exploreTeleportTo(mapState.current,m._fx+30,(m._fy||0)+10);state.autoHunt=false;mapState.targetIdx=-1;return 1})()`);
    await sleep(800);
    const drawn = await ev(`(()=>{mapState.targetIdx=-1;renderMobs();const m=mapState.mobs[${def.slot}];return !!(m&&document.querySelector('#mob-list .mob-target[data-uid="'+m.uid+'"]'))})()`);
    ok(drawn, '世界王（slot ' + def.slot + '）沒被鎖定時也畫在場上');
    await ev(`(()=>{state.autoHunt=true;mapState.targetIdx=${def.slot};return 1})()`);
    await sleep(1500);
    await shot('fb_boss.png');
    const kills0 = await ev('(window.afkReportState?afkReportState().kills:0)');
    let killed = null;
    for (let i = 0; i < 120 && !killed; i++) {
        await sleep(500);
        await ev(`(()=>{player.hp=player.mhp;player.mp=player.mmp;const m=mapState.mobs[${def.slot}];if(m&&m.curHp>0)mapState.targetIdx=${def.slot};return 1})()`);
        killed = W.msgs.find((k) => k.t === 'kill' && k.sid === BSID && !k.already) || null;
        if (i % 20 === 5) console.log('dbgk ' + asc(await ev(`JSON.stringify((()=>{const m=mapState.mobs[${def.slot}];return {hp:m&&m.curHp,t:mapState.targetIdx,auto:state.autoHunt,
            me:[Math.round(explorePlayerX()),Math.round(explorePlayerY())],b:m&&[Math.round(m._fx),Math.round(m._fy)],dead:player.dead,unr:m&&m._unreachUntil>Date.now(),
            near:typeof exploreNearestApproachIdx==='function'?exploreNearestApproachIdx():'nf'}})())`)));
    }
    ok(killed && killed.boss && killed.lootKey && killed.lootKey !== W.key && killed.by !== W.key, '瀏覽器玩家打死世界王，掉落給傷害第一（不是先打的弱者）lootKey=' + asc(killed && killed.lootKey));
    const shareW = killed && killed.expShare ? Number(killed.expShare[W.key]) || 0 : 0;
    ok(shareW > 0 && Math.abs(shareW - sumW / BHP) < 0.01, '弱者經驗比例 ' + shareW + '（期望 ' + (sumW / BHP).toFixed(4) + '）sumW=' + sumW + ' share=' + JSON.stringify(killed && killed.expShare));
    await sleep(1500);
    const after = JSON.parse(await ev(`JSON.stringify({exp:player.exp,lv:player.lv,kills:(window.afkReportState?afkReportState().kills:0),m:!!(mapState.mobs[${def.slot}]&&mapState.mobs[${def.slot}].curHp>0)})`));
    ok(after.exp > exp0 || after.lv > 60, '瀏覽器玩家拿到經驗 ' + exp0 + '→' + after.exp);
    ok(after.kills === kills0 + 1, '掉落者本地只結算一次 killMob（' + kills0 + '→' + after.kills + '）');
    ok(!after.m, '世界王死後畫面上清掉');
    const stB = await bossStatus(def.id);
    ok(stB && stB.dead && stB.mapId === home, '時刻表顯示已擊敗＋地點');
    await sleep(1500);
    const sched = await ev(`(()=>{wbFetchScheduleStatus(true);return 1})()`);
    await sleep(800);
    const html = await ev(`wbScheduleHtml(true)`);
    const mapTitle = await ev(`mapEntryOf(${JSON.stringify(home)}).t`);
    ok(sched && /地點/.test(html || '') && (html || '').indexOf(mapTitle) >= 0 && /已擊敗/.test(html || '') && /data-map=/.test(html || ''), '傳送師世界王分頁：時刻表＋地點＋前往');
    await ev(`(()=>{let d=document.getElementById('tp-test');if(!d){d=document.createElement('div');d.id='tp-test';d.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:#111;overflow:auto';document.body.appendChild(d);}
        renderTeleporterNPC(d);const b=[...d.querySelectorAll('[data-rk]')].find(x=>x.getAttribute('data-rk')==='worldboss');if(b)b.click();return 1})()`);
    await sleep(1200);
    await shot('fb_schedule.png');
    await ev(`(()=>{const d=document.getElementById('tp-test');if(d)d.remove();return 1})()`);

    // 舊存檔停在 wb_ 欄位 → 帶回頭目原地圖
    await ev(`(()=>{mapState.current='wb_'+${JSON.stringify(def.id)};return 1})()`);
    await sleep(2500);
    const mig = await ev('mapState.current');
    ok(mig === home, '舊存檔 wb_ 欄位自動帶回原地圖 → ' + mig);

    W.w.close();
    ok(errors.length === 0, 'JS 例外：' + (errors.slice(0, 4).map(asc).join(' | ') || '無'));
    ws.close(); br.kill();
    await stopServer();
    console.log(fails.length ? '\nFAIL ' + fails.length : '\nALL PASS');
    process.exit(fails.length ? 1 : 0);
})().catch(async (e) => { console.error(e); try { await stopServer(); } catch (e2) {} process.exit(1); });
