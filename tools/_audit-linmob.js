// 實測：原版 .spr 八向怪（LIN_SPR_MOBS）在說話之島的顯示、腳底對位、轉向、走路／攻擊幀
// 用法：node tools/_audit-linmob.js [baseUrl] [--maps a,b,c]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const _mi = process.argv.indexOf('--maps');
const MAPS = _mi > 0 ? process.argv[_mi + 1].split(',') : ['talking_island', 'zone_13'];
const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : 'http://localhost:5199';
const PORT = 9337;
const SHOT_DIR = path.join(__dirname, 'lin', '_out');
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const LOG = [];
const ok = (name, cond, detail) => {
    const line = (cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : '');
    console.log(line);
    LOG.push(line);
    if (!cond) fails++;
};

async function main() {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'linmob-'));
    const br = spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd,
        '--window-size=1600,1000', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
        if (m.method === 'Runtime.exceptionThrown') exc.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 300));    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description).slice(0, 300) };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const shot = async (name, clip) => {
        const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip: Object.assign({ scale: 2 }, clip) } : { format: 'png' });
        if (r.result && r.result.data) fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(r.result.data, 'base64'));
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
        window._authAccountForNames=()=>'linmob';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='原怪'+Date.now()%100000;
        startGame();
        await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv,30); player.hp=player.mhp=99999; try{ calcStats(); }catch(e){} player.hp=player.mhp;    })()`);
    ok('LIN_SPR_MOBS 已載入', await ev('Array.isArray(LIN_SPR_MOBS)&&LIN_SPR_MOBS.length>=10'));
    ok('原版怪全部進八向管線', await ev('LIN_SPR_MOBS.every(n=>MOB_ANIM_8DIR.has(n)&&MOB_ANIM_NAMES.has(n))'),
        JSON.stringify(await ev('LIN_SPR_MOBS.filter(n=>!(MOB_ANIM_8DIR.has(n)&&MOB_ANIM_NAMES.has(n)))')));

    const go = (mapId) => ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true); return mapState.current;})()`);
    // 場上看得到的原版怪卡片量測
    const probe = () => ev(`(()=>{
        const L=new Set(LIN_SPR_MOBS); const out=[];
        const bv=document.getElementById('battle-view').getBoundingClientRect();
        for(const m of (mapState.mobs||[])){
            if(!m||!L.has(m.n)) continue;
            const c=document.querySelector('#mob-list .mob-target[data-uid="'+m.uid+'"]'); if(!c) continue;
            const inner=c.querySelector('.mob-img-inner'); const img=inner&&inner.querySelector('img:not(.mob-anim-shadow)');
            if(!img||!img.naturalWidth) continue;
            const ir=img.getBoundingClientRect(), nr=inner.getBoundingClientRect();
            if(ir.right<bv.left||ir.left>bv.right||ir.bottom<bv.top||ir.top>bv.bottom) continue;
            const src=decodeURIComponent(img.getAttribute('src')||'');
            const mm=/\\/d(\\d)\\/(\\w+?)_(\\d+)\\.png/.exec(src);
            const cs=getComputedStyle(inner,'::after');
            out.push({uid:m.uid,n:m.n,lin:inner.classList.contains('lin-spr'),dir:mm?+mm[1]:null,act:mm?mm[2]:null,f:mm?+mm[3]:null,
              nw:img.naturalWidth,nh:img.naturalHeight,rw:Math.round(ir.width),rh:Math.round(ir.height),
              imgBottom:Math.round(ir.bottom),innerBottom:Math.round(nr.bottom),cx:Math.round(ir.left+ir.width/2),icx:Math.round(nr.left+nr.width/2),
              ell:cs.display, pad:(()=>{const s=getComputedStyle(img);return [s.paddingTop,s.paddingLeft,s.borderTopWidth,s.boxSizing,s.maxWidth,s.maxHeight].join(' ');})(), rect:[Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)]});
        }
        return out;
    })()`);

    for (const mapId of MAPS) {
        console.log('=== ' + mapId + ' ===');
        await ev('clearInterval(window.__auditKeep);window.__auditKeep=0;player.hp=player.mhp;');
        await go(mapId);
        await sleep(4000);
        // 走向最近的原版怪
        const walkInfo = await ev(`(async()=>{
            const L=new Set(LIN_SPR_MOBS); let last=null;
            const near=()=>{const px=explorePlayerX(),py=explorePlayerY();return Math.min(1e9,...(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&L.has(m.n)).map(m=>Math.hypot(m._fx-px,m._fy-py)));};
            for(let k=0;k<30&&near()>420;k++){ exploreRandomTeleportOnMap({mode:'far'}); await new Promise(r=>setTimeout(r,400)); }
            for(let i=0;i<400;i++){
                const px=explorePlayerX(), py=explorePlayerY();
                const ms=(mapState.mobs||[]).filter(m=>m&&m._fx!=null&&L.has(m.n)&&!(m.hp<=0));
                if(!ms.length){ await new Promise(r=>setTimeout(r,250)); continue; }
                ms.sort((a,b)=>Math.hypot(a._fx-px,a._fy-py)-Math.hypot(b._fx-px,b._fy-py));
                const t=ms[0]; const dx=t._fx-px, dy=t._fy-py, d=Math.hypot(dx,dy);
                last={n:t.n,d:Math.round(d),lin:ms.length,all:(mapState.mobs||[]).length,names:[...new Set((mapState.mobs||[]).map(m=>m&&m.n))].join(',')};
                if(d<230) break;
                exploreSetVirtualStick(dx/d,-dy/d,true);
                await new Promise(r=>setTimeout(r,120));
            }
            exploreSetVirtualStick(0,0,false);
            return last;
        })()`);
        console.log('   walk', JSON.stringify(walkInfo));
        await sleep(1500);
        // 6 秒內取樣：方向、動作
        const seen = {};
        let first = null;
        for (let i = 0; i < 24; i++) {
            const p = await probe();
            if (!first && p.length) first = p;
            for (const x of p) {
                const s = seen[x.uid] || (seen[x.uid] = { n: x.n, dirs: new Set(), acts: new Set() });
                if (x.dir != null) s.dirs.add(x.dir);
                if (x.act) s.acts.add(x.act);
            }
            await sleep(250);
        }
        const p = first || [];
        console.log('   visible', p.length, JSON.stringify(p.slice(0, 3)));
        ok(mapId + ' 畫面上有原版怪', p.length > 0, 'n=' + p.length);
        if (!p.length) continue;
        ok(mapId + ' 原版怪掛 lin-spr', p.every((x) => x.lin), p.filter((x) => !x.lin).map((x) => x.n).join(','));
        ok(mapId + ' 原版怪讀 d0..d7 幀', p.every((x) => x.dir != null));
        ok(mapId + ' 原尺寸顯示（不縮放）', p.every((x) => Math.abs(x.rw - x.nw) <= 1 && Math.abs(x.rh - x.nh) <= 1),
            p.map((x) => x.n + ':' + x.rw + 'x' + x.rh + '/' + x.nw + 'x' + x.nh).slice(0, 5).join(' ') + ' css=' + p[0].pad);
        ok(mapId + ' 站立點對齊腳底（圖底下移 32px）', p.every((x) => Math.abs(x.imgBottom - 32 - x.innerBottom) <= 2),
            p.map((x) => x.n + ':' + (x.imgBottom - x.innerBottom)).slice(0, 5).join(' '));
        ok(mapId + ' 水平置中', p.every((x) => Math.abs(x.cx - x.icx) <= 2));
        ok(mapId + ' 不畫 CSS 橢圓影（圖內自帶影子）', p.every((x) => x.ell === 'none'));
        const all = Object.values(seen);
        const dirs = new Set(); const acts = new Set();
        all.forEach((s) => { s.dirs.forEach((d) => dirs.add(d)); s.acts.forEach((a) => acts.add(a)); });
        ok(mapId + ' 多方向（轉向）', dirs.size >= 3, 'dirs=' + [...dirs].sort().join(','));
        ok(mapId + ' 有走路幀', acts.has('walk'), 'acts=' + [...acts].join(','));

        // 強制最近一隻播攻擊／受擊，確認換成原版 attack_／hurt_ 幀
        await ev(`window.__auditKeep||(window.__auditKeep=setInterval(()=>{ try{ if(player&&!player.dead){ player.mhp=Math.max(player.mhp,99999); player.hp=player.mhp; } }catch(e){} }, 50))`);
        await ev(`(mapState.mobs||[]).forEach(m=>{ if(m&&m.hp>0){ m.hp=m.mhp=Math.max(m.mhp||1,1e6); } })`);
        const now = (await probe()).filter((x) => x.act !== 'death');
        const pool = now.length ? now : p;
        const cands = pool.filter((x) => x.act === 'idle').concat(pool.filter((x) => x.act !== 'idle')).slice(0, 3);
        const tgt = cands[0];
        for (const k of ['attack', 'hurt']) {
            let pass = false, label = '', detail = [];
            for (const c of cands) {
                await ev(`(()=>{const m=mapState.mobs.find(m=>m&&m.uid==${JSON.stringify(c.uid)}); if(m){ m.hp=m.mhp=Math.max(m.mhp||1,1e6); m._animAct={k:'${k}',t:Date.now()}; }})()`);
                const got = new Set();
                for (let i = 0; i < 14; i++) {
                    if (i === 7) await ev(`(()=>{const m=mapState.mobs.find(m=>m&&m.uid==${JSON.stringify(c.uid)}); if(m) m._animAct={k:'${k}',t:Date.now()};})()`);
                    await sleep(80);
                    const q = (await probe()).find((x) => x.uid === c.uid);
                    if (q && q.act) got.add(q.act + '_' + q.f);
                }
                label = c.n; detail = [...got];
                if (!detail.length) detail = [JSON.stringify(await ev(`(()=>{const m=mapState.mobs.find(m=>m&&m.uid==${JSON.stringify(c.uid)});const el=document.querySelector('#mob-list .mob-target[data-uid="${c.uid}"]');const img=el&&el.querySelector('.mob-img-inner img:not(.mob-anim-shadow)');const r=img&&img.getBoundingClientRect();const lg=document.getElementById('unified-log-body');return {log:lg?lg.innerText.trim().split('\\n').slice(-3).join(' / '):'',n:mapState.mobs.length,mob:!!m,hp:m&&m.hp,dead:m&&m.dead,card:!!el,src:img&&decodeURIComponent(img.getAttribute('src')||'').slice(-40),nw:img&&img.naturalWidth,r:r&&[r.left|0,r.top|0,r.width|0]};})()`))];
                if (detail.some((g) => g.startsWith(k + '_'))) { pass = true; break; }
            }
            ok(mapId + ' ' + label + ' 播 ' + k + ' 幀', pass, detail.join(','));
        }
        await shot('linmob_' + mapId + '.png');
        const r = tgt.rect;
        await shot('linmob_' + mapId + '_zoom.png', { x: Math.max(0, r[0] - 200), y: Math.max(0, r[1] - 120), width: r[2] + 400, height: r[3] + 220 });
    }

    const relevant = exc.filter((e) => !/Failed to load|404|net::/.test(e));
    ok('無 JS 例外', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    LOG.push(fails ? 'RESULT: FAIL (' + fails + ')' : 'RESULT: PASS');
    console.log(LOG[LOG.length - 1]);
    fs.writeFileSync(path.join(SHOT_DIR, 'audit_linmob_log.txt'), LOG.join('\n'), 'utf8');
    ws.close(); br.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
