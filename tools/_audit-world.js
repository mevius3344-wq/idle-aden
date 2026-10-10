// 實測：整張原版大地圖（村莊＋野外同一張圖）——走出村莊安全區直接到野外、走回村莊，不經傳送門
// 用法：node tools/_audit-world.js   結果 → tools/lin/_out/world.json、截圖 world_*.png
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GAME_PORT = 9346;
const CDP_PORT = 9347;
const BASE = "http://127.0.0.1:" + GAME_PORT;
const OUT = path.join(__dirname, "lin", "_out");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const ok = (cond, msg) => {
  console.log((cond ? "PASS " : "FAIL ") + msg);
  if (!cond) fails.push(msg);
};

const { PATH_FN } = require("./_world-path");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "world-data-"));
  const env = Object.assign({}, process.env, { PORT: String(GAME_PORT), CLOUD_SAVE_DIR: DIR, IP_SESSION_LIMIT: "0" });
  delete env.DATABASE_URL;
  const game = spawn(process.execPath, ["_serve.js"], { cwd: ROOT, env, stdio: "ignore" });
  const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), "world-br-"));
  const br = spawn(exe, ["--headless=new", "--remote-debugging-port=" + CDP_PORT, "--user-data-dir=" + udd, "--no-first-run", "--mute-audio", "about:blank"], { stdio: "ignore" });
  const report = {};
  try {
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(BASE + "/api/version")).ok) break; } catch (e) {}
      await sleep(250);
    }
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(250);
      try { targets = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/list")).json(); } catch (e) {}
    }
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0;
    const pend = new Map();
    const errors = [];
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
      if (m.method === "Runtime.exceptionThrown") errors.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || "").split("\n")[0]);
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const evErr = [];
    const ev = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result && r.result.exceptionDetails && evErr.length < 5) evErr.push(String((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text).split("\n")[0] + " @ " + expr.slice(0, 80));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    report.evErr = evErr;
    const shot = async (name) => {
      const r = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, "base64"));
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 892, height: 412, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.alert=function(){};window.confirm=function(){return true};" });
    await send("Page.navigate", { url: BASE + "/" });
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      if ((await ev('typeof startGame==="function"&&typeof changeMap==="function"')) === true) break;
    }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'world';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='界'+Date.now()%100000;
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
        player.lv=Math.max(player.lv||1,60);
    })()`);
    await ev(PATH_FN);

    const goMap = async (mid) => {
      await ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mid)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true);})()`);
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        if (await ev(`(()=>{const d=exploreActiveMapDef();return !!(d&&d.lin&&linmapRegionAt(d.lin,explorePlayerX(),explorePlayerY()))})()`)) break;
      }
      await sleep(800);
    };
    // 沿路徑走：每步點下一個路徑點，直到地圖換成目標或走完
    const walkTo = async (wantTown, tag) => {
      const start = await ev(`(()=>({map:mapState.current,x:explorePlayerX(),y:explorePlayerY()}))()`);
      const plan = await ev(`(()=>{const p=__worldPath(${wantTown},260);return p&&{dest:p.dest,n:p.steps.length,steps:p.steps}})()`);
      ok(!!plan, tag + " 找得到可走路線到" + (wantTown ? "村莊" : "野外") + (plan ? "（" + plan.dest + "，" + plan.n + " 點）" : ""));
      if (!plan) return null;
      await ev(`(()=>{window.__wlog=[];window.__wlast=mapState.current;window.__wt=setInterval(()=>{const m=mapState.current;if(m!==__wlast){__wlog.push({from:__wlast,to:m,x:Math.round(explorePlayerX()),y:Math.round(explorePlayerY()),t:Date.now()});__wlast=m;}},20);return 1})()`);
      const before = await ev(`(()=>({x:explorePlayerX(),y:explorePlayerY()}))()`);
      let reached = false;
      const trace = [];
      for (let i = 0; i < plan.steps.length && !reached; i++) {
        const s = plan.steps[i];
        let st = null;
        for (let k = 0; k < 30; k++) {
          await ev(`__tapWorld(${s.x},${s.y})`);
          await sleep(120);
          st = await ev(`(()=>({m:mapState.current,d:Math.hypot(explorePlayerX()-(${s.x}),explorePlayerY()-(${s.y})),x:Math.round(explorePlayerX()),y:Math.round(explorePlayerY()),mv:exploreIsMoving(),cx:Math.round(exploreCamX()),cy:Math.round(exploreCamY())}))()`);
          if (!st) continue;
          if (st.m === plan.dest) { reached = true; break; }
          if (st.d < 30) break;
        }
        trace.push({ to: [s.x, s.y], at: st });
      }
      report["trace_" + tag] = trace;
      for (let k = 0; k < 20 && !reached; k++) {
        await sleep(150);
        reached = (await ev("mapState.current")) === plan.dest;
      }
      await sleep(600);
      const log = await ev(`(()=>{clearInterval(__wt);return __wlog})()`);
      const after = await ev(`(()=>({map:mapState.current,x:explorePlayerX(),y:explorePlayerY(),layer:(document.getElementById('explore-linmap')||{}).getAttribute&&document.getElementById('explore-linmap').getAttribute('data-map'),portals:document.querySelectorAll('#explore-portal-markers .explore-portal-mark').length,npcs:document.querySelectorAll('#lin-town-npcs .lin-npc').length,liveNpc:document.querySelectorAll('#lin-town-npcs .lin-npc.is-game').length,mobSlots:(mapState.mobs||[]).length,townView:!document.getElementById('town-view').classList.contains('hidden'),battle:!document.getElementById('battle-view').classList.contains('hidden')}))()`);
      const sw = (log || []).find((l) => l.to === plan.dest);
      ok(reached && after.map === plan.dest, tag + " 走過邊界換區 " + start.map + " → " + after.map);
      ok(!!sw && Math.hypot(sw.x - before.x, sw.y - before.y) < 260 * 24, tag + " 換區時人在原地（不被傳送）" + (sw ? JSON.stringify(sw) : ""));
      ok((log || []).length === 1, tag + " 只換區一次（不來回跳）" + JSON.stringify((log || []).map((l) => l.to)));
      return { plan, log, after, start };
    };

    // ── 本土大陸：奇岩村 → 野外 → 回村 ──
    await goMap("town_giran");
    const g0 = await ev(`(()=>{const d=exploreActiveMapDef();return {map:mapState.current,lin:d.lin,world:d.world,npcs:document.querySelectorAll('#lin-town-npcs .lin-npc').length,live:document.querySelectorAll('#lin-town-npcs .lin-npc.is-game').length,portals:mapdefPortals(mapState.current).length,marks:document.querySelectorAll('#explore-portal-markers .explore-portal-mark').length}})()`);
    report.giranTown = g0;
    ok(g0 && g0.world === "wd_main" && g0.lin === "wd_main", "奇岩村在本土大地圖 wd_main " + JSON.stringify(g0));
    ok(g0 && g0.portals === 0 && g0.marks === 0, "奇岩村沒有出村傳送門");
    ok(g0 && g0.live > 0, "奇岩村 NPC 可點 (" + (g0 && g0.live) + ")");
    await shot("world_giran_town.png");
    const out1 = await walkTo(false, "[奇岩]");
    report.giranOut = out1;
    if (out1) {
      ok(out1.after.layer === "wd_main", "[奇岩] 野外沿用同一張大地圖（不重載）");
      ok(!out1.after.townView && out1.after.battle, "[奇岩] 野外顯示戰場");
      ok(out1.after.npcs > 0 && out1.after.liveNpc === 0, "[奇岩] 野外仍看得到村莊 NPC、但不可點 (" + out1.after.npcs + ")");
      ok(out1.after.mobSlots > 5, "[奇岩] 野外排出怪物槽 (" + out1.after.mobSlots + ")");
      await sleep(2500);
      await shot("world_giran_field.png");
      const back = await walkTo(true, "[奇岩回村]");
      report.giranBack = back;
      if (back) ok(back.plan.dest === "town_giran" && back.after.liveNpc > 0 && back.after.portals === 0, "[奇岩回村] 回到奇岩村 NPC 可點、無傳送門");
    }
    // 傳送術：留在本區
    await goMap("giran");
    const tp = await ev(`(()=>{const d=exploreActiveMapDef(),out=[];for(let i=0;i<6;i++){exploreRandomTeleportOnMap();const r=linmapRegionAt(d.lin,explorePlayerX(),explorePlayerY())||[];out.push(r.indexOf(mapState.current)>=0);}return out})()`);
    ok(tp && tp.every(Boolean), "[奇岩] 傳送術落點都在本區 " + JSON.stringify(tp));

    // ── 地監入口仍是傳送門 ──
    await goMap("giran");
    const gp = await ev(`(()=>mapdefPortals('giran').map(p=>[p.dest,p.destX,p.destY]))()`);
    report.giranPortals = gp;
    ok(gp && gp.length >= 1 && gp.every((p) => p[0].indexOf("town_") !== 0), "奇岩野外只剩地監入口傳送門 " + JSON.stringify(gp));

    // ── 說話之島：村莊 → 野外 ──
    await goMap("town_talking");
    const t0 = await ev(`(()=>{const d=exploreActiveMapDef();return {world:d.world,portals:mapdefPortals(mapState.current).length}})()`);
    ok(t0 && t0.world === "ti_island" && t0.portals === 0, "說話之島村莊在整張島圖、無傳送門 " + JSON.stringify(t0));
    const out2 = await walkTo(false, "[說話之島]");
    report.tiOut = out2;
    if (out2) await shot("world_talking_field.png");

    report.errors = errors;
    ok(errors.length === 0, "JS 例外：" + (errors.slice(0, 3).join(" | ") || "無"));
    ws.close();
  } catch (e) {
    ok(false, "exception " + (e && e.stack ? e.stack : e));
  } finally {
    fs.writeFileSync(path.join(OUT, "world.json"), JSON.stringify(report, null, 1), "utf8");
    br.kill();
    game.kill();
    await sleep(300);
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
  }
  console.log(fails.length ? "\nFAIL (" + fails.length + ")" : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})();
