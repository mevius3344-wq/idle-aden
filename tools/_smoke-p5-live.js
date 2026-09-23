"use strict";
/**
 * 🌐 I｜P5 線上閉環煙測（需伺服器＋可選帳密）
 *
 * 用法：
 *   SMOKE_HTTP=1 node tools/_smoke-p5-live.js
 *   SMOKE_HTTP=1 SMOKE_ACCOUNT=帳號 SMOKE_PASSWORD=密碼 node tools/_smoke-p5-live.js
 *   BASE=https://host SMOKE_HTTP=1 SMOKE_ACCOUNT=… SMOKE_PASSWORD=… SMOKE_SLOT=1 node tools/_smoke-p5-live.js
 *
 * 無帳密：只探測 /api/econ/status（econAuth／p5a／p5b／p5c）。
 * 有帳密：登入 → wallet → buy 瞬間移動卷 → sell → warehouse gold roundtrip → draw×1 → 併發 buy 衝突觀測。
 */
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = String(process.env.BASE || ("http://127.0.0.1:" + (process.env.PORT || "3000"))).replace(/\/$/, "");
const ACCOUNT = String(process.env.SMOKE_ACCOUNT || "").trim();
const PASSWORD = String(process.env.SMOKE_PASSWORD || "");
const SLOT = Math.max(1, Math.min(8, Math.floor(Number(process.env.SMOKE_SLOT) || 1)));
const BUY_ITEM = String(process.env.SMOKE_BUY_ITEM || "scroll_teleport");
const SKIP_DRAW = process.env.SMOKE_SKIP_DRAW === "1";

let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log("  OK  ", name, detail || "");
  else {
    failed++;
    console.log("  FAIL", name, detail || "");
  }
}

async function jfetch(method, urlPath, body) {
  const opts = { method, headers: {}, cache: "no-store" };
  if (body != null) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("=== P5 live · BASE=" + BASE + " ===");

  if (process.env.SMOKE_HTTP !== "1") {
    console.log("  SKIP（設 SMOKE_HTTP=1 才跑）");
    process.exit(0);
  }

  console.log("── 1) econ/status ──");
  let econ;
  try {
    econ = await jfetch("GET", "/api/econ/status");
  } catch (e) {
    ok("econ reachable", false, String(e.message || e));
    console.log("\nRESULT: FAIL (" + failed + ")");
    process.exit(1);
  }
  ok("econ status HTTP", econ.status === 200 && econ.data && econ.data.ok, JSON.stringify(econ.data));
  ok("econAuth true", !!(econ.data && econ.data.econAuth), JSON.stringify(econ.data));
  ok("p5a && p5b && p5c", !!(econ.data && econ.data.p5a && econ.data.p5b && econ.data.p5c), JSON.stringify(econ.data));
  if (econ.data && econ.data.ok && !econ.data.econAuth) {
    console.log("  NOTE  econAuth=false：本機無 DB 屬預期；部署請設 DATABASE_URL");
  }

  if (!ACCOUNT || !PASSWORD) {
    console.log("── 2) 登入閉環 SKIP（設 SMOKE_ACCOUNT + SMOKE_PASSWORD）──");
    console.log(failed ? "\nRESULT: FAIL (" + failed + ")" : "\nRESULT: PASS（僅 status；閉環需帳密）");
    process.exit(failed ? 1 : 0);
  }

  if (!(econ.data && econ.data.econAuth)) {
    console.log("── 2) 登入閉環 SKIP（econAuth=false，買／賣／抽會 503）──");
    console.log(failed ? "\nRESULT: FAIL (" + failed + ")" : "\nRESULT: PASS（status only）");
    process.exit(failed ? 1 : 0);
  }

  console.log("── 2) login ──");
  const login = await jfetch("POST", "/api/accounts/login", {
    account: ACCOUNT,
    password: PASSWORD,
    clientId: "smoke-p5-live-" + Date.now(),
  });
  ok("login", !!(login.data && login.data.ok && login.data.authToken), JSON.stringify(login.data));
  if (!(login.data && login.data.ok)) {
    console.log("\nRESULT: FAIL (" + failed + ")");
    process.exit(1);
  }
  const auth = {
    account: login.data.account || ACCOUNT,
    authToken: login.data.authToken,
    sessionId: login.data.sessionId || "",
    slot: SLOT,
  };

  console.log("── 3) wallet ──");
  const walletQs =
    "/api/wallet?account=" +
    encodeURIComponent(auth.account) +
    "&slot=" +
    SLOT +
    "&authToken=" +
    encodeURIComponent(auth.authToken) +
    "&sessionId=" +
    encodeURIComponent(auth.sessionId);
  const wallet = await jfetch("GET", walletQs);
  ok("wallet", !!(wallet.data && wallet.data.ok && wallet.data.gold != null), JSON.stringify(wallet.data));
  let gold = wallet.data && wallet.data.ok ? Number(wallet.data.gold) || 0 : 0;
  let walletRev = wallet.data && wallet.data.ok ? Number(wallet.data.walletRev) || 0 : 0;
  console.log("  gold=", gold, "walletRev=", walletRev);

  console.log("── 4) shop/buy " + BUY_ITEM + " ──");
  const buy = await jfetch("POST", "/api/shop/buy", {
    account: auth.account,
    authToken: auth.authToken,
    sessionId: auth.sessionId,
    slot: SLOT,
    itemId: BUY_ITEM,
    qty: 1,
    walletRev: walletRev,
  });
  ok("buy", !!(buy.data && buy.data.ok), JSON.stringify(buy.data));
  let boughtUid = (buy.data && buy.data.uid) || "";
  if (buy.data && buy.data.ok) {
    gold = Number(buy.data.gold);
    walletRev = Number(buy.data.walletRev) || walletRev;
    if (!boughtUid) {
      // 堆疊時可能無新 uid：再讀 wallet 後從雲端存檔找太重；改用 sell 前再 buy 一次非堆疊？
      // 簡化：若無 uid，再買一次並用 gained 路徑的 uid；若仍無則跳過 sell
      console.log("  NOTE  buy 無 uid（可能已堆疊），嘗試再買一次取 uid");
      const buy2 = await jfetch("POST", "/api/shop/buy", {
        account: auth.account,
        authToken: auth.authToken,
        sessionId: auth.sessionId,
        slot: SLOT,
        itemId: BUY_ITEM,
        qty: 1,
        walletRev: walletRev,
      });
      if (buy2.data && buy2.data.ok) {
        boughtUid = buy2.data.uid || "";
        gold = Number(buy2.data.gold);
        walletRev = Number(buy2.data.walletRev) || walletRev;
      }
    }
  }

  console.log("── 5) shop/sell ──");
  if (boughtUid) {
    const sell = await jfetch("POST", "/api/shop/sell", {
      account: auth.account,
      authToken: auth.authToken,
      sessionId: auth.sessionId,
      slot: SLOT,
      uid: boughtUid,
      qty: 1,
      walletRev: walletRev,
    });
    ok("sell", !!(sell.data && sell.data.ok && sell.data.credit > 0), JSON.stringify(sell.data));
    if (sell.data && sell.data.ok) {
      gold = Number(sell.data.gold);
      walletRev = Number(sell.data.walletRev) || walletRev;
    }
  } else {
    ok("sell", false, "no uid from buy（無法販售驗證）");
  }

  console.log("── 6) warehouse gold roundtrip ──");
  {
    const amt = 1;
    if (gold < amt) {
      console.log("  SKIP warehouse gold（金幣不足）");
      ok("warehouse gold skipped", true, "gold=" + gold);
    } else {
      const gin = await jfetch("POST", "/api/warehouse/move", {
        account: auth.account,
        authToken: auth.authToken,
        sessionId: auth.sessionId,
        slot: SLOT,
        dir: "in",
        kind: "gold",
        amount: amt,
        classic: true,
        walletRev: walletRev,
      });
      ok("warehouse gold in", !!(gin.data && gin.data.ok), JSON.stringify(gin.data));
      if (gin.data && gin.data.ok) {
        gold = Number(gin.data.goldAfter != null ? gin.data.goldAfter : gin.data.gold);
        walletRev = Number(gin.data.walletRev) || walletRev;
        const gout = await jfetch("POST", "/api/warehouse/move", {
          account: auth.account,
          authToken: auth.authToken,
          sessionId: auth.sessionId,
          slot: SLOT,
          dir: "out",
          kind: "gold",
          amount: amt,
          classic: true,
          walletRev: walletRev,
        });
        ok("warehouse gold out", !!(gout.data && gout.data.ok), JSON.stringify(gout.data));
        if (gout.data && gout.data.ok) {
          gold = Number(gout.data.goldAfter != null ? gout.data.goldAfter : gout.data.gold);
          walletRev = Number(gout.data.walletRev) || walletRev;
        }
      }
    }
  }

  console.log("── 7) pandora/draw ×1 ──");
  if (SKIP_DRAW) {
    console.log("  SKIP（SMOKE_SKIP_DRAW=1）");
  } else if (gold < 100000) {
    console.log("  SKIP draw（金幣 < 10萬，gold=" + gold + "）");
    ok("draw skipped for gold", true, "gold=" + gold);
  } else {
    const draw = await jfetch("POST", "/api/pandora/draw", {
      account: auth.account,
      authToken: auth.authToken,
      sessionId: auth.sessionId,
      slot: SLOT,
      qty: 1,
      walletRev: walletRev,
    });
    ok("draw", !!(draw.data && draw.data.ok && Array.isArray(draw.data.results)), JSON.stringify(draw.data && {
      ok: draw.data.ok,
      cost: draw.data.cost,
      clientDebit: draw.data.clientDebit,
      n: draw.data.results && draw.data.results.length,
      itemId: draw.data.results && draw.data.results[0] && draw.data.results[0].itemId,
    }));
    if (draw.data && draw.data.ok && draw.data.results && draw.data.results[0]) {
      const id = String(draw.data.results[0].itemId || "");
      ok("draw not card", !id.startsWith("card_"), id);
    }
    if (draw.data && draw.data.ok && draw.data.walletRev != null) {
      walletRev = Number(draw.data.walletRev) || walletRev;
    }
  }

  console.log("── 8) 併發 buy 衝突觀測 ──");
  {
    const body = {
      account: auth.account,
      authToken: auth.authToken,
      sessionId: auth.sessionId,
      slot: SLOT,
      itemId: BUY_ITEM,
      qty: 1,
      walletRev: walletRev,
    };
    const [a, b] = await Promise.all([
      jfetch("POST", "/api/shop/buy", body),
      jfetch("POST", "/api/shop/buy", body),
    ]);
    const errs = [a, b].map((r) => (r.data && r.data.error) || (r.data && r.data.ok ? "ok" : "fail"));
    const oneOk = [a, b].some((r) => r.data && r.data.ok);
    const oneConflict = [a, b].some((r) => r.data && r.data.error === "conflict");
    // 樂觀鎖未必每次都撞上；至少應有一次成功，且兩者不可雙成功同 gold 回寫異常
    ok("concurrent: at least one ok", oneOk, "errs=" + errs.join(","));
    if (oneConflict) {
      ok("concurrent: saw conflict", true, "errs=" + errs.join(","));
    } else {
      console.log("  NOTE  本次未撞到 conflict（競態不一定發生）；errs=" + errs.join(","));
      ok("concurrent observed", true, "no mandatory conflict");
    }
  }

  console.log(failed ? "\nRESULT: FAIL (" + failed + ")" : "\nRESULT: PASS");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
