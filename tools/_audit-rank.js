// 實測：排行榜（照新創）——職業分頁＋血盟榜 API、名次｜職業｜角色｜血盟｜等級、前三獎盃、自己固定最底、點角色看裝備
// 用法：node tools/_audit-rank.js [baseUrl]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const PORT = 9399;
const OUT = path.join(__dirname, 'lin', '_out');
const SHOTS = 'C:/Users/FUTURE/shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const LOG = [];
const ok = (name, cond, detail) => {
    const line = (cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '');
    console.log(line); LOG.push(line);
    if (!cond) fails++;
};
const getj = (u) => fetch(BASE + u).then((r) => r.json());

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    // API
    const k = await getj('/api/leaderboard?board=cls&cls=knight&limit=100');
    ok('職業榜 API（騎士）', k && k.ok && Array.isArray(k.rows), 'rows ' + (k.rows || []).length);
    ok('職業榜只列該職業、等級由高到低', (k.rows || []).every((r, i, a) => r.cls === 'knight' && (!i || a[i - 1].lv >= r.lv)));
    ok('每列帶血盟／頭像欄位', (k.rows || []).every((r) => 'clan' in r && 'avatar' in r && r.rank >= 1));
    if (k.rows && k.rows.length) {
        const me = await getj('/api/leaderboard?board=cls&cls=knight&limit=1&me=' + encodeURIComponent(k.rows[0].name));
        ok('me＝自己的名次', me.me && me.me.rank === 1 && me.me.name === k.rows[0].name, JSON.stringify(me.me || null).slice(0, 120));
        const last = k.rows[k.rows.length - 1];
        if (k.rows.length > 1) {
            const me2 = await getj('/api/leaderboard?board=cls&cls=knight&limit=1&me=' + encodeURIComponent(last.name));
            ok('沒進前 N 名也回自己的名次', me2.me && me2.me.rank === last.rank && me2.me.inTop === false, JSON.stringify(me2.me || null).slice(0, 120));
        }
    }
    // 臨時血盟：盟主＋排行榜第一名騎士，看血盟欄／血盟榜，最後退盟清掉
    const postj = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
    const stamp = Date.now() % 100000, clanName = '榜盟' + stamp;
    const lead = { account: 'rankaud' + stamp, slot: 1, name: '盟主' + stamp, lv: 20, cls: 'royal' };
    const mem = k.rows && k.rows[0] ? { account: 'rankaud' + stamp, slot: 2, name: k.rows[0].name, lv: k.rows[0].lv, cls: 'knight' } : null;
    const cr = await postj('/api/clan/create', { ...lead, clanName });
    if (mem) await postj('/api/clan/join', { ...mem, clanName });
    const k2 = await getj('/api/leaderboard?board=cls&cls=knight&limit=3');
    ok('角色列顯示血盟名', !mem || (k2.rows[0] && k2.rows[0].clan === clanName), cr.ok + ' ' + (k2.rows[0] && k2.rows[0].clan));
    const cb = await getj('/api/leaderboard?board=clan&limit=100&me=' + encodeURIComponent(mem ? mem.name : ''));
    const crow = (cb.rows || []).find((r) => r.name === clanName);
    ok('血盟榜列出（人數／等級總和／盟主）', crow && crow.members === (mem ? 2 : 1) && crow.lvSum === 20 + (mem ? mem.lv : 0) && crow.leader === lead.name, JSON.stringify(crow || null));
    ok('血盟榜 me＝自己的血盟', !mem || (cb.me && cb.me.name === clanName), JSON.stringify(cb.me || null));
    const cleanup = async () => { if (mem) await postj('/api/clan/leave', mem); await postj('/api/clan/leave', lead); };
    const c = await getj('/api/leaderboard?board=clan&limit=100');
    ok('血盟榜 API（人數＋等級總和，總和高者在前）', c && c.ok && Array.isArray(c.rows) && c.rows.every((r, i, a) => r.members >= 1 && r.lvSum >= r.members && (!i || a[i - 1].lvSum >= r.lvSum)), 'clans ' + (c.rows || []).length);
    const lv = await getj('/api/leaderboard?board=level&limit=5');
    ok('舊綜合榜照舊（等級總榜）', lv && lv.ok && Array.isArray(lv.rows));

    // 畫面
    const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'rank-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, '--window-size=420,860', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
    const shot = async (name) => {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        if (r.result && r.result.data) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); }
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 411, height: 832, deviceScaleFactor: 1, mobile: true });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('typeof startGame==="function"&&typeof changeMap==="function"')) break; }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'rank';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='榜'+Date.now()%100000;
        startGame();
        for(let i=0;i<40&&!(player&&player.inv&&player.inv.length);i++) await new Promise(r=>setTimeout(r,250));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    await sleep(1500);
    const u = await ev(`(async()=>{
        switchTab('pvp');
        const w=document.getElementById('lm-win-rank');
        for(let i=0;i<40&&!(w&&w.querySelector('.lr-row:not(.lr-head)'));i++) await new Promise(r=>setTimeout(r,150));
        const act=w&&w.querySelector('.lr-tabs .active');
        const rows=w?[...w.querySelectorAll('.lr-list .lr-row:not(.lr-head)')]:[];
        return { open: !!(w&&!w.classList.contains('hidden')), tab: act&&act.getAttribute('data-tab'),
            tabs: w?[...w.querySelectorAll('.lr-tabs-cls button')].map(b=>b.textContent).join(','):'',
            head: w?(w.querySelector('.lr-head')||{}).textContent:'', n: rows.length,
            cups: w?w.querySelectorAll('.lr-list .lr-rk-cup').length:0, icons: w?w.querySelectorAll('.lr-list .lr-cls img').length:0,
            foot: !!(w&&w.querySelector('.lr-foot .lr-me')) };
    })()`);
    ok('排行榜開成原版視窗', u.open, JSON.stringify(u));
    ok('上排職業分頁＋血盟', u.tabs === '王族,騎士,妖精,法師,黑妖,血盟', u.tabs);
    ok('預設開自己職業（騎士）', u.tab === 'knight', u.tab);
    ok('欄位：名次／角色／血盟／等級', /名次.*角色.*血盟.*等級/.test(u.head || ''), u.head);
    ok('前三名獎盃＋職業頭像', u.n >= 1 && u.cups === Math.min(3, u.n) && u.icons === u.n, 'rows ' + u.n + ' cups ' + u.cups + ' icons ' + u.icons);
    ok('自己固定在最底', u.foot);
    await shot('rank_knight.png');
    const cl = await ev(`(async()=>{
        const w=document.getElementById('lm-win-rank');
        w.querySelector('.lr-tabs [data-tab="clan"]').click();
        for(let i=0;i<30&&!w.querySelector('.lr-head.is-clan');i++) await new Promise(r=>setTimeout(r,150));
        await new Promise(r=>setTimeout(r,300));
        return { head:(w.querySelector('.lr-head')||{}).textContent, n:w.querySelectorAll('.lr-list .lr-row.is-clan:not(.lr-head)').length };
    })()`);
    ok('血盟分頁：名次／血盟／人數／等級總和', /名次.*血盟.*人數.*等級總和/.test(cl.head || '') && cl.n >= 1, JSON.stringify(cl));
    await shot('rank_clan.png');
    const eq = await ev(`(async()=>{
        const w=document.getElementById('lm-win-rank');
        w.querySelector('.lr-tabs [data-tab="level"]').click();
        for(let i=0;i<30&&!w.querySelector('.lr-list .lr-row[data-name]');i++) await new Promise(r=>setTimeout(r,150));
        const r=w.querySelector('.lr-list .lr-row[data-name]'); if(!r) return {err:'no row'};
        r.click(); await new Promise(r=>setTimeout(r,800));
        const m=document.getElementById('lb-equip-modal');
        const out={modal:!!m, name:r.getAttribute('data-name')};
        if(typeof closeLeaderboardEquipModal==='function') closeLeaderboardEquipModal();
        w.querySelector('.lm-x').click();
        out.closed=w.classList.contains('hidden');
        linMenuOpen('settings');
        const has=[...document.querySelectorAll('#lm-win-settings .lm-btn')].some(b=>b.textContent==='排行榜');
        linMenuClose();
        out.settings=has;
        return out;
    })()`);
    ok('點角色開裝備檢視', eq.modal, JSON.stringify(eq));
    ok('× 關閉', eq.closed);
    ok('設定選單有「排行榜」', eq.settings);
    await cleanup();
    const after = await getj('/api/leaderboard?board=clan&limit=100');
    ok('臨時血盟已清掉', !(after.rows || []).some((r) => r.name === clanName));
    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(OUT, 'audit_rank_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
