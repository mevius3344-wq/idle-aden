"use strict";
/**
 * 🔒 已鎖定修正防回歸檢查（對應 .cursor/rules/no-regression.mdc）
 *
 * 每一條都是玩家回報過、修過、之後又被改回去的問題。
 * 任何一條 FAIL ＝ 這次改動把舊 bug 放回來了，禁止 bump／部署。
 * 若某條是「刻意」改規格，必須先得到使用者同意，再同步改這裡與 no-regression.mdc。
 *
 * 用法：node tools/_verify-locked-fixes.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
let fails = 0;
let passes = 0;

function rd(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function ok(name, cond, detail) {
  if (cond) {
    passes++;
    console.log("  ok  " + name);
  } else {
    fails++;
    console.log("  FAIL " + name + (detail ? "  → " + detail : ""));
  }
}
function section(t) {
  console.log("\n=== " + t + " ===");
}

const F = {
  data: rd("js/00-data.js"),
  drops: rd("js/01-drops-config.js"),
  kill: rd("js/05-kill-progression.js"),
  cast: rd("js/07-skills-cast.js"),
  items: rd("js/08-items-equip.js"),
  vfx: rd("js/09-vfx-render.js"),
  tabs: rd("js/10-ui-tabs.js"),
  world: rd("js/11-world-map.js"),
  shop: rd("js/13-shop-save.js"),
  pandora: rd("js/14-craft-pandora.js"),
  pets: rd("js/22-pets.js"),
  relic: rd("js/24-pandora-relic-market.js"),
  wb: rd("js/40-world-boss.js"),
  explore: rd("js/44-map-explore.js"),
  mapdef: rd("js/47-mapdef.js"),
  html: rd("index.html"),
  css: rd("css/style.css"),
  hud: rd("css/combat-hud.css"),
};

section("1) 語法（index.html 載入的 js ＋ lib/ 全部 node --check）");
{
  const files = [];
  F.html.replace(/<script[^>]+src="(js\/[^"?]+\.js)/g, (_, p) => files.push(p));
  const libDir = path.join(ROOT, "lib");
  if (fs.existsSync(libDir)) for (const f of fs.readdirSync(libDir)) if (f.endsWith(".js")) files.push("lib/" + f);
  const bad = [];
  for (const rel of files) {
    if (!exists(rel)) { bad.push(rel + ": index.html 引用但檔案不存在"); continue; }
    const r = spawnSync(process.execPath, ["--check", path.join(ROOT, rel)], { encoding: "utf8" });
    if (r.status !== 0) bad.push(rel + ": " + String(r.stderr || "").split("\n").slice(0, 4).join(" | "));
  }
  ok("載入腳本全部可解析（" + files.length + " 檔）", files.length > 40 && bad.length === 0, bad.join("\n        "));
}

section("2) 編碼：不可出現 U+FFFD 亂碼");
{
  const bad = [];
  const scan = (rel) => {
    if (rd(rel).indexOf("\uFFFD") >= 0) bad.push(rel);
  };
  for (const f of fs.readdirSync(path.join(ROOT, "js"))) if (f.endsWith(".js")) scan("js/" + f);
  for (const f of fs.readdirSync(path.join(ROOT, "css"))) if (f.endsWith(".css")) scan("css/" + f);
  scan("index.html");
  ok("js/css/index.html 無 U+FFFD", bad.length === 0, bad.join(", "));
}

section("3) 新兵修練場（回報壞過 5+ 次）");
{
  ok("SPECIAL_AREA_BG.training 指向 新兵修練場.jpg",
    /training:\s*'assets\/area\/1920x1080\/新兵修練場\.jpg'/.test(F.shop));
  ok("新兵修練場.jpg 檔案存在", exists("assets/area/1920x1080/新兵修練場.jpg"));
  ok("ensureTrainingYardBackground 存在且掛 window",
    /function ensureTrainingYardBackground\(/.test(F.shop) && /window\.ensureTrainingYardBackground\s*=\s*ensureTrainingYardBackground/.test(F.shop));
  ok("修練場強制 training-yard class",
    /classList\.add\('training-yard'/.test(F.shop));
  ok("修練場不開探索（exploreAllowed 排除 training）",
    /id\s*===\s*'training'[^\n]*return false/.test(F.explore));
  ok("木頭人 HP = 40", /"wood_dummy":\s*\{[^\n]*\bhp:\s*40\b/.test(F.data));
}

section("4) 村莊背景不可消失");
{
  ok("TOWN_BG_1920 表存在", /const TOWN_BG_1920\s*=\s*\{/.test(F.shop));
  ok("_townMapBg 優先用 TOWN_BG_1920", /TOWN_BG_1920\[townId\]/.test(F.world));
  ok("ensureTownMapBackground 存在", /function ensureTownMapBackground\(/.test(F.world));
  const m = /const TOWN_BG_1920\s*=\s*\{([\s\S]*?)\};/.exec(F.shop);
  const missing = [];
  if (m) {
    const re = /(town_\w+)\s*:\s*'([^']+)'/g;
    let x;
    while ((x = re.exec(m[1]))) {
      if (!exists("assets/area/1920x1080/" + x[2] + ".jpg")) missing.push(x[1] + "→" + x[2] + ".jpg");
    }
  }
  ok("TOWN_BG_1920 每張圖都存在", !!m && missing.length === 0, missing.join(", "));
}

section("5) 狩獵地圖背景／地板／素材（每張圖用自己的，不可 404）");
{
  const setM = /const AREA_1920\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(F.shop);
  const names = [];
  if (setM) setM[1].replace(/'([^']+)'/g, (_, n) => names.push(n));
  F.shop.replace(/AREA_1920\.add\('([^']+)'\)/g, (_, n) => names.push(n));
  F.shop.replace(/\[([^\]]+)\]\.forEach\(name => AREA_1920\.add\(name\)\)/g, (_, list) => {
    list.replace(/'([^']+)'/g, (__, n) => names.push(n));
  });
  const missA = names.filter((n) => !exists("assets/area/1920x1080/" + n + ".jpg"));
  ok("AREA_1920 白名單圖全部存在（" + names.length + " 張）", names.length > 50 && missA.length === 0, missA.slice(0, 20).join(", "));

  // 與遊戲 upgradeAreaPath 相同：assets/area/<名>.jpg 在白名單 → 走 1920x1080 版
  const nameSet = new Set(names);
  const effective = (p) => {
    const m = /^assets\/area\/([^\/]+)\.jpg$/.exec(p);
    return m && nameSet.has(m[1]) ? "assets/area/1920x1080/" + m[1] + ".jpg" : p;
  };
  const missSp = [];
  for (const re of [/const SPECIAL_AREA_BG\s*=\s*\{([\s\S]*?)\n\};/, /const CATEGORY_AREA_BG\s*=\s*\{([^}]*)\}/]) {
    const blk = re.exec(F.shop);
    if (!blk) { missSp.push("找不到 " + re.source.slice(6, 30)); continue; }
    blk[1].replace(/(\w+)\s*:\s*'(assets\/area\/[^']+\.(?:jpg|png))'/g, (_, k, p) => {
      const e = effective(p);
      if (!exists(e)) missSp.push(k + "→" + e);
    });
  }
  ok("SPECIAL_AREA_BG／CATEGORY_AREA_BG 實際背景全部存在", missSp.length === 0, missSp.join(", "));

  const floors = [];
  F.mapdef.replace(/floor:\s*'([^']+)'/g, (_, p) => floors.push(p));
  const missF = floors.filter((p) => !exists(p));
  ok("mapdef floor 全部存在（" + floors.length + " 張）", floors.length > 50 && missF.length === 0, missF.slice(0, 20).join(", "));

  const pm = /var PROP_BIOME_DIRS\s*=\s*\{([^}]*)\}/.exec(F.explore);
  const missP = [];
  if (pm) {
    pm[1].replace(/(\w+)\s*:/g, (_, b) => {
      for (const k of ["rock", "bush", "tree", "path"]) {
        if (!exists("assets/area/props/" + b + "/" + k + ".png")) missP.push(b + "/" + k);
      }
    });
  }
  ok("PROP_BIOME_DIRS 存在且素材齊全", !!pm && missP.length === 0, missP.join(", "));
  ok("無素材 biome 退回 wild（explorePropSrc）", /if \(!PROP_BIOME_DIRS\[b\]\) b = 'wild'/.test(F.explore));
  ok("mist 無縫地板退回 wild", /id === 'mist'\) id = 'wild'/.test(F.explore));
}

section("6) 玩家人物：置中、不消失、不半身");
{
  ok("固定站位分支設定容器寬度（v3.9.55 人物消失修正）",
    /_pmState\.el\.style\.width\s*=\s*Math\.max\(1,\s*Math\.round\(_pw \|\| 100\)\)\s*\+\s*'px'/.test(F.vfx));
  ok("固定站位以寬度一半置中",
    /_pmState\.el\.style\.left\s*=\s*'calc\('\s*\+\s*_pp\.x\s*\+\s*' - '\s*\+\s*Math\.round\(_pw \/ 2\)/.test(F.vfx));
}

section("7) 怪物目標：頂部目標列永久關閉");
{
  ok("#chud-target 永久 display:none",
    /#game-screen\.combat-hud #chud-target,\s*\n\.chud-target\s*\{\s*\n\s*display:\s*none !important/.test(F.hud));
}

section("8) 潘朵拉：遺物搜尋／布告欄／收購 下架");
{
  ok("遺物搜尋送出＝已下架", /遺物搜尋已下架/.test(F.pandora));
  ok("pandoraRelicBalanceHTML 回傳空",
    /function pandoraRelicBalanceHTML\([^)]*\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*return '';/.test(F.relic));
  ok("pandoraRelicBoardHTML 回傳空",
    /function pandoraRelicBoardHTML\([^)]*\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*return '';/.test(F.relic));
}

section("9) 死亡：自動回村、無原地復活");
{
  ok("reviveInPlace 已停用（不復活）",
    /function reviveInPlace\(\)\s*\{\s*if \(!player\.dead\) return;\s*if \(typeof logSys === 'function'\) \{\s*logSys\([^)]*自動回村/.test(F.kill));
  ok("原地復活按鈕永遠隱藏",
    /function updateReviveInPlaceBtn\(\)\s*\{\s*let btn = document\.getElementById\('btn-revive-inplace'\);\s*if \(btn\) btn\.classList\.add\('hidden'\);\s*\}/.test(F.kill));
  ok("index.html 沒有原地復活按鈕", !/id="btn-revive-inplace"/.test(F.html));
  ok("祈求復活按鈕保持隱藏", /id="btn-revive" class="hidden" style="display:none!important"/.test(F.html));
}

section("10) 職業：幻術士／龍騎士／戰士 關閉創角；傭兵移除");
{
  ok("CREATION_CLOSED_CLASS_BASES 含 illusionist/Dknight/warrior",
    /CREATION_CLOSED_CLASS_BASES\s*=\s*\{\s*illusionist:\s*1,\s*Dknight:\s*1,\s*warrior:\s*1\s*\}/.test(F.shop));
  ok("index.html 無傭兵面板", !/id="[^"]*merc[^"]*"/i.test(F.html));
}

section("11) 自動購買：藥水／寵物藥 只在 0 時才買");
{
  ok("藥水自動購買條件 _cnt <= 0",
    /let _cnt = _cur \? \(Number\(_cur\.cnt\) \|\| 0\) : 0;\s*if \(_cnt <= 0\) \{/.test(F.cast));
  ok("寵物自動購買條件 _have <= 0",
    /if \(_buyChk && _buyChk\.checked\) \{[\s\S]{0,400}?if \(_have <= 0\) \{/.test(F.pets));
}

section("12) 廢品不變暗");
{
  ok("背包：廢品不 dimIcon", /if \(!i\.junk\) dimIcon = true;/.test(F.tabs));
  ok("CSS：廢品圖示 opacity:1",
    /\.classic-item-junk img \{\s*\n\s*opacity:\s*1 !important;/.test(F.css));
}

section("13) 數值規格");
{
  ok("萬能藥上限 30", /const PANACEA_USE_MAX\s*=\s*30;/.test(F.drops));
  ok("世界王重生 1 小時（前端）", /var _wbScheduleRespawnMs\s*=\s*3600000;/.test(F.wb));
  if (exists("lib/rt-world-boss.js")) {
    ok("世界王重生 1 小時（伺服器）", /WB_RESPAWN_MS \|\| 3600000/.test(rd("lib/rt-world-boss.js")));
  }
  ok("傳送卷軸效果存在", /d\.eff === 'teleport_scroll'/.test(F.items));
}

section("14) 公告文字");
{
  const all = F.html + fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js")).map((f) => rd("js/" + f)).join("\n");
  ok("公告不可出現「同 IP 單開」", !/同\s*IP\s*單開/.test(all));
}

console.log("\n──────────────────────────────");
console.log(" locked-fixes: " + passes + " ok, " + fails + " fail");
if (fails) {
  console.log(" RESULT: FAIL — 有已修好的問題被改回去了，禁止 bump／部署");
  process.exit(1);
}
console.log(" RESULT: PASS");
process.exit(0);
