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

section("13b) 自動施放／木頭人經驗／法術特效尺寸");
{
  ok("轉換魔法只有 MP 門檻（set-mp-convert）", /id="set-mp-convert"/.test(F.html));
  ok("轉換魔法不可再有第二個 HP 門檻（set-hp-convert 已移除）",
    !/set-hp-convert|setHpConvert/.test(F.html + F.cast + F.shop));
  ok("轉換魔法條件＝MP < set-mp-convert",
    /getElementById\('set-mp-convert'\)[\s\S]{0,200}if\(\(player\.mmp \|\| 0\) > 0 && \(player\.mp \/ player\.mmp \* 100\) < mpTh\) castSkill\(convId\)/.test(F.cast));
  ok("HP 門檻 set-hp-skill 同時管轉換魔法（不排除 convert）",
    /if\(sk\.hpCost\) \{ let _hpSkEl = document\.getElementById\('set-hp-skill'\)/.test(F.cast));
  ok("set-mp-convert 會存檔／讀檔", /setMpConvert:/.test(F.shop) && /c\.setMpConvert/.test(F.shop));
  ok("消耗HP技能說明含轉換魔法", /所有會扣 HP 的技能（含轉換魔法）/.test(F.html));
  ok("木頭人 exp 5", /"wood_dummy":\s*\{[^\n]*\bexp:\s*5\b/.test(F.data));
  ok("木頭人擊殺發玩家經驗",
    /if \(mob\.trainingDummy\) \{\s*try \{\s*let _dExp[\s\S]{0,300}player\.exp \+= _dExp/.test(F.kill));
  ok("法術特效最小尺寸（投射物 0.5／範圍 0.9）",
    /const SPELL_FX_MIN_PROJ_H = 0\.5;/.test(F.vfx) && /const SPELL_FX_MIN_AREA_H = 0\.9;/.test(F.vfx)
    && /if \(fxH > 0 && fxH < _minH\)/.test(F.vfx));
}

section("23) 說話之島原版拼塊地圖");
{
  const css = rd("css/style.css");
  const mapdef = rd("js/47-mapdef.js");
  const lin = rd("js/49-linmap.js");
  ok("index 載入 49-linmap-data／49-linmap（在 47-mapdef 前）",
    /js\/49-linmap-data\.js[\s\S]*js\/49-linmap\.js[\s\S]*js\/47-mapdef\.js/.test(F.html));
  ok("說話之島／地監1F／2F 套用原版地圖",
    /linMapDef\('talking_island', 'ti_island'/.test(mapdef) && /linMapDef\('zone_13', 'ti_dungeon1'/.test(mapdef)
    && /linMapDef\('zone_14', 'ti_dungeon2'/.test(mapdef));
  for (const n of ["ti_island", "ti_dungeon1", "ti_dungeon2"]) {
    const dir = "assets/linmap/" + n;
    let good = exists(dir + "/walk.bin") && exists(dir + "/meta.json");
    if (good) {
      const meta = JSON.parse(rd(dir + "/meta.json"));
      good = meta.chunks.every((k) => exists(dir + "/c_" + k + ".webp"));
    }
    ok("原版圖塊＋可走格子齊全：" + n, good);
  }
  ok("舊地板被 inline 強制顯示時仍會被隱藏（linmapSetOldFloor）",
    /function linmapSetOldFloor/.test(lin) && /linmapSetOldFloor\(true\)/.test(lin) && /linmapSetOldFloor\(false\)/.test(lin));
  ok("原版地圖隱藏手繪地板／造景（CSS）", /#battle-view#battle-view\.is-linmap > #explore-world-bg-blend/.test(css));
  ok("怪物不進村莊安全區", /linmapSafeZone\(linSafe, r\.x, r\.y\)/.test(F.explore));
}

section("24) 原版 .spr 八向怪物");
{
  const css = rd("css/style.css");
  const reg = rd("js/49-linmob-data.js");
  ok("index 載入 49-linmob-data（在 09-vfx-render 前）",
    /js\/49-linmob-data\.js[\s\S]*js\/09-vfx-render\.js/.test(F.html));
  const m = /var LIN_SPR_MOBS = (\[.*\]);/.exec(reg);
  const mobs = m ? JSON.parse(m[1]) : [];
  ok("LIN_SPR_FOOT_PAD = 32", /var LIN_SPR_FOOT_PAD = 32;/.test(reg));
  ok("原版怪清單完整（全部對照怪 229 種）", mobs.length >= 229, "n=" + mobs.length);
  const miss = mobs.filter((n) => {
    for (let d = 0; d < 8; d++) {
      for (const a of ["idle", "walk", "attack", "death"]) if (!exists("assets/anim/" + n + "/d" + d + "/" + a + "_0.png")) return true;
    }
    return false;
  });
  ok("原版怪 d0..d7 idle／walk／attack／death 幀齊全", miss.length === 0, miss.slice(0, 5).join(","));
  ok("_mob8Apply 掛 lin-spr", /_linSprMobSet\(\)\.has\(m\.n\)/.test(F.vfx) && /toggle\('lin-spr', _lin\)/.test(F.vfx));
  ok("lin-spr 圖下移 32px、不縮放、無 CSS 橢圓影",
    /\.mob-img-inner\.lin-spr\.lin-spr img \{\s*translate: 0 32px;\s*padding: 0 !important;\s*max-width: none !important;\s*max-height: none !important;/.test(css)
    && /\.mob-img-inner\.lin-spr::after \{\s*display: none !important;/.test(css));
}

section("19/25) 樂園風 HUD（點地面移動、無搖桿）");
{
  const css = rd("css/lr-hud.css");
  const js = rd("js/51-lr-hud.js");
  const hud = rd("js/46-combat-hud.js");
  ok("index 載入 lr-hud.css（在 combat-hud.css 後）",
    /css\/combat-hud\.css[\s\S]*css\/lr-hud\.css/.test(F.html));
  ok("index 載入 51-lr-hud.js", /js\/51-lr-hud\.js/.test(F.html));
  ok("lr-hud 下搖桿不吃觸控（pointerOnDock 回 false）",
    /function pointerOnDock[\s\S]{0,200}lrHudActive\(\)\) return false;/.test(hud));
  ok("lr-hud 下隱藏搖桿", /\.lr-hud[^{]*\.chud-joystick[^{]*\{[^}]*display:\s*none/.test(css));
  ok("5 格快捷＋回村、選單列、經驗條、地圖座標、小地圖、信件、夥伴",
    ["lr-quick-slots", "lr-home", "lr-menubar", "lr-expbar", "lr-map-coord", "lr-minimap-cv", "lr-mail", "lr-party"].every((k) => js.includes("'" + k + "'") || js.includes('"' + k + '"')));
  ok("聊天提示文字＝點擊輸入聊天內容", /CHAT_PH = '點擊輸入聊天內容'/.test(js));
  ok("村莊 NPC 場景收在快捷欄上方", /chud-in-town #town-view:not\(\.hidden\) \{\s*bottom: auto !important;\s*height: calc\(100% - var\(--lr-quick-b\)/.test(css));
  ok("修練場木頭人／玩家抬到快捷欄上方", /training-yard \.mob-target\.training-fixed,\s*#game-screen\.combat-hud\.lr-hud #battle-view\.training-yard #player-morph-sprite \{\s*translate:/.test(css));
  ok("小地圖用 exploreWorldActive（exploreAllowed 不是全域）", /window\.exploreWorldActive\(\)/.test(js) && !/typeof exploreAllowed/.test(js));
}

section("18/26) 同圖玩家＋原版可走村莊");
{
  const party = rd("js/36-realtime-party.js");
  const pop = rd("js/41-map-population.js");
  const serve = rd("_serve.js");
  const ch = rd("lib/rt-map-channels.js");
  const town = rd("js/52-lin-town.js");
  ok("rtPartyIsHttp／rtPartyIdentity 掛 window（否則同圖玩家／即時連線全失效）",
    /window\.rtPartyIsHttp = rtPartyIsHttp;/.test(party) && /window\.rtPartyIdentity = rtPartyIdentity;/.test(party));
  ok("頻道依序填滿（不把玩家分散到空頻）",
    /for \(let c = 1; c <= MAX_CHANNELS; c\+\+\) \{\s*if \(\(byCh\[c\] \|\| 0\) < CAP_PER_CHANNEL\) return \{ channel: c, full: false \};/.test(ch));
  ok("伺服器同圖玩家清單不排除村莊", /function partyMapPlayersHere[\s\S]{0,200}if \(!cur\) return \[\];/.test(serve));
  ok("伺服器座標夾限涵蓋原版大地圖", /const PRESENCE_WX_MAX = 13000;/.test(serve) && /const PRESENCE_WY_MAX = 7000;/.test(serve));
  ok("可走村莊顯示同圖玩家（mapPopSameMapPlayers 放行 mapdefTownLin）",
    /indexOf\('town_'\) === 0 && !\(typeof mapdefTownLin === 'function' && mapdefTownLin\(mapId\)\)\) return \[\];/.test(pop));
  ok("index 載入 52-lintown-data（在 47-mapdef 前）＋52-lin-town",
    /js\/52-lintown-data\.js[\s\S]*js\/47-mapdef\.js/.test(F.html) && /js\/52-lin-town\.js/.test(F.html));
  ok("原版村莊：mapdefTownLin＋LIN_TOWNS 表", /global\.mapdefTownLin = /.test(F.mapdef) && /LIN_TOWNS/.test(F.mapdef));
  ok("可走村莊不出怪", /exploreInTown\(\)\) return 0;/.test(F.explore) && /exploreInTown\(\)\) return false;/.test(F.explore));
  ok("可走村莊 NPC 點擊開對話", /interactNPC\(/.test(town) && /exploreClearTapMove/.test(town));
  const tw = ["tw_talking", "tw_silver", "tw_gludin", "tw_woodbec", "tw_windawood", "tw_kentcastle", "tw_heine", "tw_giran",
    "tw_oren", "tw_aden", "tw_witon", "tw_elf", "tw_ivory", "tw_pirate", "tw_silent"];
  const missTw = tw.filter((n) => !(exists("assets/linmap/" + n + "/walk.bin") && exists("assets/linmap/" + n + "/meta.json")));
  ok("原版村莊圖塊齊全（15 張）", missTw.length === 0, missTw.join(","));
  ok("hyperia 等無原版圖的村莊仍用靜態背景（ensureTownMapBackground）",
    /_townWalk/.test(F.shop) && /ensureTownMapBackground/.test(F.shop + F.world));
}

section("27) 野外／地監原版拼塊");
{
  const FIELDS = require("./lin/fields-config");
  const data = rd("js/49-linmap-data.js");
  ok("applyLinFields 沿用舊傳送門目的地、位置改原版連結點",
    /function applyLinFields\(\)/.test(F.mapdef) && /L\.pd && L\.pd\[i\] !== p\.dest/.test(F.mapdef) && /backArrive\(p\.dest, src\)/.test(F.mapdef));
  ok("野外 → 原版村莊抵達村莊出口", /var ex = td && td\.townLin && D\[td\.lin\] && D\[td\.lin\]\.keys\.exit;/.test(F.mapdef));
  const ids = Object.keys(FIELDS);
  const miss = ids.filter((id) => {
    const out = FIELDS[id][1];
    const dir = "assets/linmap/" + out;
    if (!exists(dir + "/walk.bin") || !exists(dir + "/meta.json")) return true;
    if (!data.includes('"mapId":"' + id + '"')) return true;
    const meta = JSON.parse(rd(dir + "/meta.json"));
    return !meta.chunks.every((k) => exists(dir + "/c_" + k + ".webp"));
  });
  ok("野外＋地監原版圖塊／資料齊全（" + ids.length + " 張）", ids.length >= 70 && miss.length === 0, miss.slice(0, 8).join(","));
}

section("28) GM API 檔案模式（Railway 無 Neon）");
{
  const serve = rd("_serve.js");
  const gm = rd("lib/rt-gm.js");
  ok("無 Neon 時 /api/gm/ 走檔案模式（不可回 503 no_database）",
    /await fileGm\(\)\.handle\(req, res, u\);/.test(serve) && !/GM 後台需要 DATABASE_URL/.test(serve));
  ok("心跳回報待領 GM 信件數（不可寫死 0）", /gmMail: fileGm\(\)\.pendingMailCount\(/.test(serve));
  ok("lib/rt-gm-file.js 存在", exists("lib/rt-gm-file.js"));
  ok("GM 裝備欄鍵＝遊戲 player.eq（gloves／boots／ear1／ring3）",
    /\["gloves", "手套"\]/.test(gm) && /\["boots", "長靴"\]/.test(gm) && /\["ear1", "耳環1"\]/.test(gm) && /\["ring3", "戒指3"\]/.test(gm) && !/\["glove", /.test(gm));
  ok("GM 職業名＝遊戲 cls（dark／dragon／illusion／warrior）",
    /dark: "黑暗妖精"/.test(gm) && /dragon: "龍騎士"/.test(gm) && /warrior: "戰士"/.test(gm));
}

section("29) 持久存檔＋備份＋負載");
{
  const serve = rd("_serve.js");
  ok("PERSIST_DIR 跟 CLOUD_SAVE_DIR 走", /const PERSIST_DIR = process\.env\.CLOUD_SAVE_DIR/.test(serve));
  ok("隊伍／血盟／拍賣／交易日誌存在持久目錄（不可寫死 ROOT/data）",
    ["parties", "clans", "auction", "gm-trade-log"].every((n) => serve.indexOf('persistFile("' + n + '.json")') >= 0) &&
      !/path\.join\(ROOT, "data", "(parties|clans|auction|gm-trade-log)\.json"\)/.test(serve));
  ok("lib/rt-backup.js 存在且略過 .backups／sessions", exists("lib/rt-backup.js") && /SKIP_NAMES = new Set\(\[SNAP_DIR_NAME, "account-sessions\.json"\]\)/.test(rd("lib/rt-backup.js")));
  ok("設 CLOUD_SAVE_DIR 時啟動每日快照", /backupStore\(\)\.startDaily\(\)/.test(serve));
  const gmf = rd("lib/rt-gm-file.js");
  ok("GM 備份 API（下載／快照／清單）", ['"/api/gm/backup"', '"/api/gm/backups"', '"/api/gm/backup/file"', '"/api/gm/backup/snapshot"'].every((s) => gmf.indexOf(s) >= 0));
  ok("GM 總覽帶伺服器負載", /server: serverLoad \? serverLoad\(\) : null/.test(gmf) && /function serverLoadStats\(\)/.test(serve));
  ok("音效快取一天（不可 no-store）", /ext === "\.mp3" \|\| ext === "\.ogg"[^\n]*\n\s*\? "public, max-age=86400"/.test(serve));
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
