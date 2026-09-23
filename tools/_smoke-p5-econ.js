"use strict";
/**
 * 🌐 P5 經濟權威＋抽抽樂去卡 — 煙測（不需登入 DB 亦可跑離線斷言）
 * 用法：node tools/_smoke-p5-econ.js
 * 可選：SMOKE_HTTP=1 且本機有伺服器時探測 /api/econ/status
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  OK  ", name, detail || "");
  else {
    failed++;
    console.log("  FAIL", name, detail || "");
  }
}

console.log("=== 1) 抽抽樂池無卡片 ===");
const poolPath = path.join(ROOT, "lib/pandora-gacha-pool.json");
const pool = JSON.parse(fs.readFileSync(poolPath, "utf8"));
const cardish = pool.filter((r) => String(r.id || "").startsWith("card_"));
ok("pool size > 0", pool.length > 0, String(pool.length));
ok("no card_* in pool", cardish.length === 0, "cardish=" + cardish.length);

console.log("=== 2) gen 腳本語意：00-data 卡項不應進池 ===");
{
  const raw = fs.readFileSync(path.join(ROOT, "js/00-data.js"), "utf8");
  let cur = null,
    isCard = false,
    w = 0;
  const cards = [];
  for (const line of raw.split(/\n/)) {
    const m = line.match(/^\s*"([^"]+)":\s*\{/);
    if (m) {
      if (cur && isCard && w > 0) cards.push(cur);
      cur = m[1];
      isCard = false;
      w = 0;
    }
    if (/eff:\s*['"]card['"]/.test(line)) isCard = true;
    const wm = line.match(/gachaWeight:\s*(\d+)/);
    if (wm) w = Number(wm[1]);
  }
  if (cur && isCard && w > 0) cards.push(cur);
  const ids = new Set(pool.map((p) => p.id));
  const leak = cards.filter((id) => ids.has(id));
  ok("00-data cards not in pool", leak.length === 0, "leaks=" + leak.length);
}

console.log("=== 3) rt-shop 買／賣報價 ===");
{
  const shop = require(path.join(ROOT, "lib/rt-shop.js"));
  ok("econAuthEnabled is boolean", typeof shop.econAuthEnabled() === "boolean", String(shop.econAuthEnabled()));

  const buy = shop.buyQuote("scroll_teleport", 1);
  ok("buyQuote scroll_teleport", !!(buy && buy.ok && buy.cost > 0), JSON.stringify(buy));

  const sellPlain = shop.sellUnitOf({ id: "scroll_teleport" });
  ok(
    "sellUnit ~30% of buy",
    !!(sellPlain && sellPlain.ok && sellPlain.unit > 0),
    "unit=" + (sellPlain && sellPlain.unit)
  );
  if (buy && buy.ok && sellPlain && sellPlain.ok) {
    const base = Math.floor(buy.cost / Math.max(1, buy.qty || 1));
    const expect = Math.floor(base * 0.3);
    ok("SELL_RATE 0.3", sellPlain.unit === expect || Math.abs(sellPlain.unit - expect) <= 1, "expect~" + expect + " got=" + sellPlain.unit);
  }

  const sellBless = shop.sellUnitOf({ id: "scroll_teleport", bless: true });
  ok(
    "bless sell >= plain",
    !!(sellBless && sellBless.ok && sellBless.unit >= sellPlain.unit),
    "bless=" + (sellBless && sellBless.unit) + " plain=" + sellPlain.unit
  );

  const nosell = shop.sellUnitOf({ id: "acc_116" }); // unique ring may be nosell — just ensure function returns
  ok("sellUnitOf returns object", !!(nosell && typeof nosell.ok === "boolean"), JSON.stringify(nosell));
}

console.log("=== 4) 抽抽樂費用 ===");
{
  // inline same formula as rt-pandora-market (avoid spinning sql)
  const COST = 100000,
    MAX = 10;
  function drawCostOf(qty) {
    const q = Math.max(1, Math.min(MAX, Math.floor(Number(qty) || 1)));
    let cost = COST * q;
    if (q >= 10) cost = Math.floor(cost * 0.9);
    return { qty: q, cost };
  }
  ok("1 draw = 100k", drawCostOf(1).cost === 100000, String(drawCostOf(1).cost));
  ok("10 draw = 900k", drawCostOf(10).cost === 900000, String(drawCostOf(10).cost));
}

console.log("=== 5) client 源碼斷言：抽獎／odds 去卡 ===");
{
  const src = fs.readFileSync(path.join(ROOT, "js/14-craft-pandora.js"), "utf8");
  ok("local draw excludeCards true", /getWeightedGachaResult\(false,\s*true\)/.test(src));
  ok("odds skip card", /item\.eff === 'card'/.test(src) && /pandoraComputeGachaOdds/.test(src));
  ok("server loadPool filters card_", /isGachaCardId/.test(fs.readFileSync(path.join(ROOT, "lib/rt-pandora-market.js"), "utf8")));
}

console.log("=== 5b) A 自動逃短距／手動遠距 ===");
{
  const tp = fs.readFileSync(path.join(ROOT, "js/02-stats-recompute.js"), "utf8");
  const it = fs.readFileSync(path.join(ROOT, "js/08-items-equip.js"), "utf8");
  const ex = fs.readFileSync(path.join(ROOT, "js/44-map-explore.js"), "utf8");
  ok("doTeleport accepts escape opts", /opts\.escape/.test(tp));
  ok("silent scroll uses escape", /doTeleport\(forceBoss,\s*\{\s*escape:\s*!!silent\s*\}\)/.test(it));
  ok("near mode in exploreRandomTeleport", /mode === 'near'/.test(ex) && /mode === 'far'|else \{/.test(ex));
}

console.log("=== 5c) B P5 衝突／walletRev ===");
{
  const econ = fs.readFileSync(path.join(ROOT, "js/49-econ-wallet.js"), "utf8");
  const pandora = fs.readFileSync(path.join(ROOT, "js/38-pandora-global-auction.js"), "utf8");
  ok("econErrorMessage conflict", /econErrorMessage/.test(econ) && /conflict/.test(econ));
  ok("buy/sell attach walletRev", /econAttachWalletRev/.test(econ));
  ok("conflict retry after pull", /error === 'conflict'/.test(econ) && /rtWalletPull/.test(econ));
  ok("draw sends auth+walletRev", /walletRev/.test(pandora) && /authToken/.test(pandora));
  ok("draw calls pandoraOnDrawComplete", /pandoraOnDrawComplete/.test(pandora));
}

console.log("=== 5d) C 抽抽樂 UX ===");
{
  const src = fs.readFileSync(path.join(ROOT, "js/14-craft-pandora.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "css/style.css"), "utf8");
  ok("recent + overlay helpers", /pandoraRenderRecentHTML/.test(src) && /pandoraShowDrawOverlay/.test(src));
  ok("afford estimate copy", /約可單抽/.test(src));
  ok("status badge", /pandoraGachaStatusBadgeHTML/.test(src) && /pandora-gacha-badge/.test(css));
}

console.log("=== 5e) P5c 倉庫權威源碼 ===");
{
  const wh = require(path.join(ROOT, "lib/rt-warehouse.js"));
  ok("whSharedName classic", wh.whSharedName(true) === "warehouse_classic");
  ok("whSharedName normal", wh.whSharedName(false) === "warehouse");
  ok("isWarehouseSharedName", wh.isWarehouseSharedName("warehouse") && wh.isWarehouseSharedName("warehouse_classic"));
  ok("itemSig stable", wh.itemSig({ id: "scroll_teleport", en: 0 }) === wh.itemSig({ id: "scroll_teleport" }));
  const api = fs.readFileSync(path.join(ROOT, "lib/rt-wallet-shop-api.js"), "utf8");
  ok("API /warehouse/move", /\/api\/warehouse\/move/.test(api) && /p5c:\s*true/.test(api));
  const router = fs.readFileSync(path.join(ROOT, "lib/api-router.js"), "utf8");
  ok("PUT warehouse blocked when econ", /warehouse_auth/.test(router) && /isWarehouseSharedName/.test(router));
  const econ = fs.readFileSync(path.join(ROOT, "js/49-econ-wallet.js"), "utf8");
  ok("client rtWarehouseMoveSecure", /rtWarehouseMoveSecure/.test(econ));
  const npc = fs.readFileSync(path.join(ROOT, "js/12-npc-quests.js"), "utf8");
  ok("whDeposit hooks secure", /rtWarehouseMoveSecure/.test(npc) && /whDepositLocal/.test(npc));
  ok("saveWarehouse skips push when econ", /econAuthActive/.test(npc) && /_skipWhPush/.test(npc));
}

console.log("=== 5f) Sprint3 sink 白名單 ===");
{
  const sink = require(path.join(ROOT, "lib/rt-econ-sink.js"));
  ok("sinkQuote obel_track", !!(sink.sinkQuote("obel_track").ok && sink.sinkQuote("obel_track").cost === 100000));
  ok("sinkQuote elf_switch", sink.sinkQuote("elf_switch").cost === 500000);
  ok("sinkQuote mastery", sink.sinkQuote("mastery_switch").cost === 3000000);
  ok("unknown sink rejected", !sink.sinkQuote("hack_free").ok);
  const api = fs.readFileSync(path.join(ROOT, "lib/rt-wallet-shop-api.js"), "utf8");
  ok("API /econ/sink", /\/api\/econ\/sink/.test(api) && /sprint3:\s*true/.test(api));
  const econ = fs.readFileSync(path.join(ROOT, "js/49-econ-wallet.js"), "utf8");
  ok("client rtEconSinkSecure", /rtEconSinkSecure/.test(econ));
  const world = fs.readFileSync(path.join(ROOT, "js/11-world-map.js"), "utf8");
  ok("obel + mastery hooks", /obel_track/.test(world) && /mastery_switch/.test(world));
}

console.log("=== 6) 可選 HTTP /api/econ/status ===");
async function httpProbe() {
  if (process.env.SMOKE_HTTP !== "1") {
    console.log("  SKIP (set SMOKE_HTTP=1 to probe)");
    return;
  }
  try {
    const res = await fetch("http://127.0.0.1:" + (process.env.PORT || "3000") + "/api/econ/status");
    const j = await res.json();
    ok("econ status ok", !!(j && j.ok), JSON.stringify(j));
    ok("p5a/p5b/p5c flags", !!(j && j.p5a && j.p5b && j.p5c), JSON.stringify(j));
  } catch (e) {
    ok("econ status reachable", false, String(e.message || e));
  }
}

httpProbe().then(() => {
  console.log(failed ? "\nRESULT: FAIL (" + failed + ")" : "\nRESULT: PASS");
  process.exit(failed ? 1 : 0);
});
