// 通用探針：node tools/lin/_probe-eval.js <mapId> <exprFile> <outName> [w] [h]
// 建角進圖後執行 exprFile（回傳值可為 Promise）→ _out/<outName>.json ＋ .png
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const GAME_PORT = 9364, CDP_PORT = 9365;
const BASE = "http://127.0.0.1:" + GAME_PORT;
const OUT = path.join(__dirname, "_out");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mapId = process.argv[2] || "talking_island";
const expr = fs.readFileSync(process.argv[3], "utf8");
const outName = process.argv[4] || "probe_eval";
const VW = Number(process.argv[5]) || 412, VH = Number(process.argv[6]) || 892;

(async () => {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "peval-data-"));
  const env = Object.assign({}, process.env, { PORT: String(GAME_PORT), CLOUD_SAVE_DIR: DIR, IP_SESSION_LIMIT: "0" });
  delete env.DATABASE_URL;
  const game = spawn(process.execPath, ["_serve.js"], { cwd: ROOT, env, stdio: "ignore" });
  const exe = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), "peval-br-"));
  const br = spawn(exe, ["--headless=new", "--remote-debugging-port=" + CDP_PORT, "--user-data-dir=" + udd, "--no-first-run", "--mute-audio", "about:blank"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/api/version")).ok) break; } catch (e) {} await sleep(250); }
    let targets = null;
    for (let i = 0; i < 40 && !targets; i++) { await sleep(250); try { targets = await (await fetch("http://127.0.0.1:" + CDP_PORT + "/json/list")).json(); } catch (e) {} }
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0; const pend = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) return "EXC " + JSON.stringify(r.result.exceptionDetails).slice(0, 600); return r.result && r.result.result ? r.result.result.value : undefined; };
    await send("Page.enable"); await send("Runtime.enable");
    const mobile = VW < 900;
    await send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: mobile ? 2 : 1, mobile });
    if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.alert=function(){};window.confirm=function(){return true};" });
    await send("Page.navigate", { url: BASE + "/" });
    for (let i = 0; i < 120; i++) { await sleep(500); if ((await ev('typeof startGame==="function"&&typeof changeMap==="function"')) === true) break; }
    await ev(`(async()=>{window._authAccountForNames=()=>'peval';let slot=1;for(let s=1;s<=8;s++){try{if(!slotSummary(s)){slot=s;break;}}catch(e){}}
      currentSlot=slot;curCreate.rawCls='m_knight';curCreate.cls='knight';document.getElementById('create-name-input').value='探'+Date.now()%100000;
      startGame();await new Promise(r=>setTimeout(r,3000));try{setPowerSaveOn(false);}catch(e){}})()`);
    await ev(`(()=>{const sel=document.getElementById('map-select');const id=${JSON.stringify(mapId)};if(![...sel.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;sel.appendChild(o);}sel.value=id;changeMap(true);})()`);
    await sleep(6000);
    const info = await ev(expr);
    fs.writeFileSync(path.join(OUT, outName + ".json"), JSON.stringify(info, null, 1), "utf8");
    const s = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, outName + ".png"), Buffer.from(s.result.data, "base64"));
    console.log("ok");
    ws.close();
  } catch (e) { console.log("ERR", e && e.stack); }
  finally { br.kill(); game.kill(); await sleep(300); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {} }
})();
