// 無頭瀏覽器逐圖稽核：玩家 sprite 是否消失、背景圖是否 404／落到通用圖
// 用法：node tools/_audit-maps.js [baseUrl] [filterRegex]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5199';
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;
const PORT = 9333;
const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const exe = BROWSERS.find((p) => fs.existsSync(p));
    if (!exe) throw new Error('no browser');
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-'));
    const br = spawn(exe, [
        '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd,
        '--window-size=1280,800', '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
        'about:blank'
    ], { stdio: 'ignore' });
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
    const bad = [];
    const consoleErr = [];
    ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
        if (m.method === 'Network.responseReceived') {
            const r = m.params.response;
            if (r.status >= 400 && /\.(png|jpe?g|gif|webp)/i.test(r.url) && !/\/assets\/anim\/|_skill_|\/npc\//.test(decodeURIComponent(r.url))) bad.push({ st: r.status, url: decodeURIComponent(r.url.replace(BASE, '')) });
        } else if (m.method === 'Runtime.exceptionThrown') {
            consoleErr.push(String((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text).slice(0, 300));
        }
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const evalJs = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description };
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert=function(){};window.confirm=function(){return true};' });
    await send('Page.navigate', { url: BASE + '/' });
    for (let i = 0; i < 120; i++) {
        await sleep(500);
        if (await evalJs('typeof startGame==="function"&&typeof changeMap==="function"&&typeof MAP_CATEGORIES!=="undefined"')) break;
    }
    const boot = await evalJs(`(async()=>{
        try{ window._authAccountForNames=()=>'audit'; }catch(e){}
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot;
        curCreate.rawCls='m_knight'; curCreate.cls='knight';
        let ni=document.getElementById('create-name-input'); if(ni) ni.value='稽核'+Date.now()%100000;
        try{ document.querySelectorAll('#login-screen,#auth-screen,#menu-screen,#slot-screen').forEach(e=>e.classList.add('hidden')); }catch(e){}
        startGame();
        await new Promise(r=>setTimeout(r,4000));
        return {slot, cur: mapState.current, name: player.name, gs: !document.getElementById('game-screen').classList.contains('hidden')};
    })()`);
    console.log('boot', JSON.stringify(boot));

    let maps = await evalJs(`(()=>{let o=[];for(let c in MAP_CATEGORIES){(MAP_CATEGORIES[c]||[]).forEach(m=>o.push({id:m.v,t:m.t,cat:c}));}return o;})()`);
    if (process.env.AVATARS) {
        const av = ['m_royal', 'f_royal', 'm_knight', 'f_knight', 'm_mage', 'f_mage', 'm_elf', 'f_elf', 'm_dark', 'f_dark', 'm_illusionist', 'f_illusionist', 'm_Dknight', 'f_Dknight', 'm_warrior', 'f_warrior'];
        const pick = maps.filter((m) => /^(silver_knight|king_baranka_room)$/.test(m.id));
        maps = [];
        for (const a of av) for (const m of pick) maps.push({ ...m, t: a, av: a });
    }
    const out = [];
    for (const m of maps) {
        if (m.av) {
            await evalJs(`(()=>{const raw=${JSON.stringify(m.av)};
                const map={'m_royal':'王子','f_royal':'公主','m_knight':'男騎士','f_knight':'女騎士','m_mage':'男法師','f_mage':'女法師','m_elf':'男妖精','f_elf':'女妖精','m_dark':'男黑暗妖精','f_dark':'女黑暗妖精','m_illusionist':'男幻術士','f_illusionist':'女幻術士','m_Dknight':'男龍騎士','f_Dknight':'女龍騎士','m_warrior':'男戰士','f_warrior':'女戰士'};
                const cls=raw.includes('royal')?'royal':raw.includes('Dknight')?'dragon':raw.includes('illusionist')?'illusion':raw.includes('dark')?'dark':raw.includes('knight')?'knight':raw.includes('mage')?'mage':raw.includes('elf')?'elf':'warrior';
                const wpn={elf:'wpn_shortbow',dark:'wpn_11',illusion:'wpn_10',dragon:'wpn_10',warrior:'wpn_1',royal:'wpn_11',knight:'wpn_11',mage:'wpn_11'}[cls];
                player.avatar=map[raw]; player.cls=cls;
                try{ if(player.eq.wpn) player.eq.wpn=null; gainItem(wpn,1,true,true); equipItem(player.inv.find(i=>i.id===wpn)); if(cls==='elf'){gainItem('wpn_5',1000,true,true);} }catch(e){}
                try{ calcStats(); }catch(e){}
            })()`);
        }
        if (FILTER && !FILTER.test(m.id)) continue;
        if (m.av) {
            const prev = out.length ? out[out.length - 1] : null;
            if (!prev || prev.av !== m.av) await evalJs(`(()=>{const s=document.getElementById('map-select');s.value='town_silver_knight';changeMap(true);})()`);
        }
        const badBefore = bad.length;
        const r = await evalJs(`(async()=>{
            const id=${JSON.stringify(m.id)};
            player.dead=false; player.hp=player.mhp=Math.max(player.mhp||1,99999); player.lv=Math.max(player.lv,99);
            const sel=document.getElementById('map-select');
            if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;o.textContent=id;sel.appendChild(o);}
            sel.value=id;
            try{ changeMap(true); }catch(e){ return {err:'changeMap '+e.message}; }
            const bv=document.getElementById('battle-view');
            let samples=0, missing=0, hidden=0, firstMissAt=-1, reasons={}, detail=null;
            for(let i=0;i<14;i++){
                await new Promise(r=>setTimeout(r,250));
                samples++;
                const sp=document.getElementById('player-morph-sprite');
                if(!sp||!bv.contains(sp)){missing++; if(firstMissAt<0)firstMissAt=i; continue;}
                const cs=getComputedStyle(sp), rc=sp.getBoundingClientRect(), br=bv.getBoundingClientRect();
                const bd=sp.querySelector('.pm-body');
                const off = rc.right<br.left||rc.left>br.right||rc.bottom<br.top||rc.top>br.bottom;
                const bcs=bd?getComputedStyle(bd):null, brc=bd?bd.getBoundingClientRect():null;
                let why='';
                if(cs.display==='none')why='disp';else if(cs.visibility==='hidden')why='vis';else if(+cs.opacity<0.05)why='op';
                else if(off)why='off';else if(!bd||!bd.getAttribute('src'))why='nosrc';
                else if(bcs.display==='none'||bcs.visibility==='hidden'||+bcs.opacity<0.05)why='bd-css';
                else if(brc.width<4||brc.height<4)why='bd-size';
                else if(bd.complete&&bd.naturalWidth===0)why='bd-broken';
                if(why){hidden++; reasons[why]=(reasons[why]||0)+1; if(!detail) detail={why,rc:[rc.left|0,rc.top|0,rc.width|0,rc.height|0],bvr:[br.left|0,br.top|0,br.width|0,br.height|0],brc:brc?[brc.width|0,brc.height|0]:null,st:sp.getAttribute('style'),bdSt:bd?bd.getAttribute('style'):null,bdSrc:bd?bd.getAttribute('src'):null,bdNat:bd?[bd.naturalWidth,bd.naturalHeight,bd.complete]:null,bdCs:bcs?{w:bcs.width,h:bcs.height,mw:bcs.maxWidth,mh:bcs.maxHeight,d:bcs.display}:null,spCs:{w:cs.width,h:cs.height,cls:sp.className}};}
            }
            const q=(s)=>document.querySelector(s);
            const bgOf=(el)=>{ if(!el) return null; const cs=getComputedStyle(el); return {img:(cs.backgroundImage||'').slice(0,160), hidden:el.classList.contains('hidden')||cs.display==='none', op:cs.opacity}; };
            const sp=document.getElementById('player-morph-sprite');
            return {
                cur: mapState.current,
                town: !bv || bv.classList.contains('hidden'),
                cls: bv ? bv.className : '',
                bv: bgOf(bv),
                cssVar: bv ? getComputedStyle(bv).getPropertyValue('--chud-battle-bg').trim().slice(0,160) : '',
                world: bgOf(q('#explore-world-bg')), far: bgOf(q('#explore-world-bg-far')),
                townBg: bgOf(q('#town-view')),
                corridor: (typeof exploreCorridorBgUrl==='function')?exploreCorridorBgUrl():'',
                scene: (typeof exploreMapSceneBgUrl==='function')?exploreMapSceneBgUrl():'',
                floorOv: (typeof exploreMapFloorOverride==='function')?exploreMapFloorOverride(id):'',
                explore: (typeof exploreWorldActive==='function')?exploreWorldActive():null,
                disp: (typeof mapDisplayName==='function')?mapDisplayName(id):'',
                sprite: {samples,missing,hidden,firstMissAt,reasons,detail, src: sp&&sp.querySelector('.pm-body')?String(sp.querySelector('.pm-body').getAttribute('src')||'').slice(0,100):null}
            };
        })()`);
        const b404 = bad.slice(badBefore).map((x) => x.st + ' ' + x.url);
        out.push({ id: m.id, t: m.t, cat: m.cat, av: m.av, ...r, b404 });
        const s = r && r.sprite ? r.sprite : {};
        const bgShort = r && r.bv ? r.bv.img.replace(/^url\("?[^"]*\/assets\//, '').slice(0, 60) : '';
        console.log([m.cat, m.id, m.t, r && r.town ? 'TOWN' : 'BATTLE', 'exp=' + (r && r.explore), 'miss=' + s.missing + '/' + s.samples, 'hid=' + s.hidden + JSON.stringify(s.reasons || {}), 'bg=' + bgShort, b404.length ? '404:' + b404.join(',') : ''].join(' | '));
    }
    fs.writeFileSync(path.join(__dirname, '_audit-maps.out.json'), JSON.stringify({ out, bad, consoleErr: consoleErr.slice(0, 80) }, null, 1));
    console.log('DONE maps=' + out.length + ' bad404=' + bad.length + ' exceptions=' + consoleErr.length);
    ws.close();
    br.kill();
    process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
