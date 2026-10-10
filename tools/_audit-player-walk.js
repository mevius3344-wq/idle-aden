// 實測：玩家走路播 walk 幀（不可滑行）＋樂園風 HUD 無右側普攻鈕
// 用法：node tools/_audit-player-walk.js [mapId] [--slow 模擬線上 300ms 延遲]   結果 → tools/lin/_out/player-walk.json、截圖 player_walk_*.png
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GAME_PORT = 9344;
const CDP_PORT = 9345;
const BASE = "http://127.0.0.1:" + GAME_PORT;
const OUT = path.join(__dirname, "lin", "_out");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SLOW = process.argv.indexOf("--slow") >= 0;
const MAP_ARG = process.argv.slice(2).find((a) => !a.startsWith("--"));
const fails = [];
const ok = (cond, msg) => {
  console.log((cond ? "PASS " : "FAIL ") + msg);
  if (!cond) fails.push(msg);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pwalk-data-"));
  const env = Object.assign({}, process.env, { PORT: String(GAME_PORT), CLOUD_SAVE_DIR: DIR, IP_SESSION_LIMIT: "0" });
  delete env.DATABASE_URL;
  const game = spawn(process.execPath, ["_serve.js"], { cwd: ROOT, env, stdio: "ignore" });
  const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), "pwalk-br-"));
  const br = spawn(exe, ["--headless=new", "--remote-debugging-port=" + CDP_PORT, "--user-data-dir=" + udd, "--no-first-run", "--mute-audio", "about:blank"], { stdio: "ignore" });
  const report = {};
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(BASE + "/api/version")).ok) break;
      } catch (e) {}
      await sleep(250);
    }
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) {
      await sleep(250);
      try {
        targets = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/list")).json();
      } catch (e) {}
    }
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0;
    const pend = new Map();
    const errors = [];
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) {
        pend.get(m.id)(m);
        pend.delete(m.id);
      }
      if (m.method === "Runtime.exceptionThrown") errors.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || "").split("\n")[0]);
    });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const tap = async (x, y) => {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await sleep(70);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 892, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.alert=function(){};window.confirm=function(){return true};" });
    if (SLOW) {
      await send("Network.enable");
      await send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 1500000, uploadThroughput: 500000 });
    }
    await send("Page.navigate", { url: BASE + "/" });
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      if ((await ev('typeof startGame==="function"&&typeof changeMap==="function"')) === true) break;
    }
    await ev(`(async()=>{
        window._authAccountForNames=()=>'pwalk';
        let slot=1; for(let s=1;s<=8;s++){ try{ if(!slotSummary(s)){slot=s;break;} }catch(e){} }
        currentSlot=slot; curCreate.rawCls='m_knight'; curCreate.cls='knight';
        document.getElementById('create-name-input').value='走'+Date.now()%100000;
        startGame(); await new Promise(r=>setTimeout(r,3000));
        try{ setPowerSaveOn(false); }catch(e){}
    })()`);
    const mapId = MAP_ARG || "talking_island";
    await ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};
        if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}
        sel.value=id; changeMap(true);})()`);
    await sleep(5000);
    for (let i = 0; i < 90; i++) {
      if (await ev(`(()=>{const b=document.querySelector('#player-morph-sprite .pm-body');return !!(b&&b.getAttribute('src')&&b.naturalWidth>0)})()`)) break;
      await sleep(500);
    }

    // 1) 樂園風 HUD：右側普攻鈕不可見
    const atk = await ev(`(()=>{const gs=document.getElementById('game-screen');const b=document.querySelector('#chud-hotbar .chud-hot-slot.is-atk');if(!b)return {lr:gs.classList.contains('lr-hud'),exists:false,vis:false};const c=getComputedStyle(b);const r=b.getBoundingClientRect();return {lr:gs.classList.contains('lr-hud'),exists:true,vis:c.display!=='none'&&c.visibility!=='hidden'&&r.width>4};})()`);
    report.atk = atk;
    ok(atk && atk.lr, "lr-hud 啟用");
    ok(atk && !atk.vis, "樂園風 HUD 右側普攻鈕已移除");
    const emptyVis = await ev(`[...document.querySelectorAll('#chud-hotbar .chud-hot-slot.is-empty')].filter(b=>getComputedStyle(b).display!=='none').length`);
    ok(emptyVis === 0, "樂園風 HUD 空技能格不顯示 (" + emptyVis + ")");

    // 2) 走路：移動期間 .pm-body 顯示 walk 幀且會換幀
    await ev(`(()=>{window.__pw={samples:[]};const t0=performance.now();window.__pwTimer=setInterval(()=>{try{const bd=document.querySelector('#player-morph-sprite .pm-body');__pw.samples.push({t:Math.round(performance.now()-t0),mv:!!exploreIsMoving(),f:decodeURIComponent(String(bd.getAttribute('src')||'').split('?')[0].split('/').pop()),x:Math.round(explorePlayerX()),y:Math.round(explorePlayerY())});}catch(e){}},40);return 1})()`);
    for (const [tx, ty] of [[60, 260], [360, 640], [70, 640], [350, 260], [206, 220], [206, 680]]) {
      await tap(tx, ty);
      await sleep(1400);
    }
    for (let i = 0; i < 40 && (await ev("exploreIsMoving()")); i++) await sleep(250);
    await sleep(2500);
    await ev("clearInterval(__pwTimer);1");
    const samples = (await ev("JSON.stringify(__pw.samples)")) || "[]";
    const S = JSON.parse(samples);
    const moving = S.filter((s) => s.mv);
    const walkShown = moving.filter((s) => /_walk_\d+\.png$/.test(s.f));
    const walkFrames = new Set(walkShown.map((s) => s.f.replace(/^.*_(walk_\d+)\.png$/, "$1")));
    report.movingSamples = moving.length;
    report.walkShown = walkShown.length;
    report.walkFrames = Array.from(walkFrames);
    report.sampleTail = moving.slice(0, 40);
    ok(moving.length >= 10, "有實際移動 (" + moving.length + " 個取樣)");
    ok(moving.length && walkShown.length / moving.length >= 0.7, "移動中顯示 walk 幀 (" + walkShown.length + "/" + moving.length + ")");
    ok(walkFrames.size >= 3, "走路會換幀（" + Array.from(walkFrames).join(",") + "）");
    const idleAfter = S.filter((s) => !s.mv).slice(-5);
    ok(idleAfter.length && idleAfter.every((s) => !/_walk_/.test(s.f)), "停下後回待機幀");
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, "player_walk_field.png"), Buffer.from(r.result.data, "base64"));
    report.errors = errors;
    ok(errors.length === 0, "JS 例外：" + (errors.slice(0, 3).join(" | ") || "無"));
    ws.close();
  } catch (e) {
    ok(false, "exception " + (e && e.stack ? e.stack : e));
  } finally {
    fs.writeFileSync(path.join(OUT, "player-walk.json"), JSON.stringify(report, null, 1), "utf8");
    br.kill();
    game.kill();
    await sleep(300);
    try {
      fs.rmSync(DIR, { recursive: true, force: true });
    } catch (e) {}
  }
  console.log(fails.length ? "\nFAIL (" + fails.length + ")" : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})();
