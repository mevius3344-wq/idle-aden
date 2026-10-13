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
  // v3.10.1：新兵修練場下架（不在地圖選單），木頭人改放奇岩村莊 3 個
  const wm = rd("js/11-world-map.js"), cc = rd("js/03-combat-core.js"), hud = rd("js/46-combat-hud.js");
  ok("新兵修練場不在地圖選單／地區", !/\{v:'training'/.test(wm));
  ok("出發回退不再去修練場（改主城）", !/tgt = 'training';/.test(wm) && /if \(tgt === 'training'\) \{ tgt = MAIN_CITY;/.test(wm));
  ok("奇岩 3 個木頭人固定格子", /const TOWN_DUMMY_SPOTS = \{ town_giran: \[\[600, 1080\], \[504, 1080\], \[408, 1080\]\] \};/.test(cc));
  ok("spawnMob 生城鎮木頭人（不還手、_townDummy）", /let _tds = townDummySpots\(\);[\s\S]{0,400}trainingDummy: true, noAttack: true, _townDummy: true/.test(cc));
  ok("進奇岩就生木頭人", /_tds\.forEach\(\(p, k\) => spawnMob\(k\)\);/.test(wm));
  ok("城鎮木頭人不走動、不重排出生點", /m\._linOnGrid = true;\s*if \(m\._townDummy\) return;/.test(F.explore) && /if \(mob\._townDummy\) return;/.test(F.explore));
  ok("自動狩獵不挑城鎮木頭人、只打玩家點過的", /\|\| m\._townDummy\) continue;/.test(F.explore) && /if \(t && t\._townDummy && !t\._picked\) t = null;/.test(cc) && /if \(idx >= 0\) mapState\.mobs\[idx\]\._picked = true;/.test(cc));
  ok("木頭人點擊範圍只留本體（不蓋 NPC）", /#battle-view \.mob-target\.town-dummy > \.mob-img-wrap::after \{/.test(rd("css/style.css")));
  ok("城鎮開 AUTO＝提示＋開傳送選單", /if \(inTown && state\.autoHunt\) \{/.test(hud) && /openTeleportMenu\(\)/.test(hud));
  // v3.10.2：AUTO 預設關；關時只打玩家點過的怪（點地取消），進場戰圖照樣開戰鬥迴圈
  ok("AUTO 預設關", /inTick: false, autoHunt: false \}/.test(rd("js/01-drops-config.js")) && /state\.autoHunt == null\) state\.autoHunt = false;/.test(hud));
  ok("AUTO 關＝只打點過的怪", /if \(state && state\.autoHunt === false\) \{\s*if \(!t \|\| !t\._picked/.test(cc) && /var _autoOn = !\(state && state\.autoHunt === false\) \|\| !!getTarget\(\);/.test(cc) && /if \(!pt \|\| !pt\._picked/.test(F.explore));
  ok("AUTO 關不自動改鎖、追點過的怪不放棄", /state\.autoHunt === false\) return;   \/\/ AUTO 關：不自動改鎖/.test(F.explore) && /else if \(!manualHunt && nowC - _chaseSince > CHASE_STUCK_MS\)/.test(F.explore));
  ok("AUTO 關也開戰鬥迴圈（不然場上沒怪）", !/if \(state\.autoHunt !== false\) \{\s*state\.running = true;/.test(wm));
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
  ok("抽抽樂下架：潘朵拉 NPC 不在任何村莊", !/id: "npc_pandora"/.test(rd("js/00-data.js")));
}

section("9) 死亡：倒地＋「重新開始」回村、無原地復活");
{
  const dz = rd("js/58-lin-death.js"), atk = rd("js/04-combat-attack.js"), wm9 = rd("js/11-world-map.js");
  ok("reviveInPlace 已停用（不復活）",
    /function reviveInPlace\(\)\s*\{\s*if \(!player\.dead\) return;\s*if \(typeof logSys === 'function'\) \{\s*logSys\([^)]*重新開始/.test(F.kill));
  ok("死亡不自動回村：跳重新開始視窗", /if \(typeof linDeathSync === 'function'\) \{ linDeathSync\(\); return; \}/.test(atk) && /id="lin-death-restart"/.test(dz) && /js\/58-lin-death\.js/.test(F.html));
  ok("重新開始＝revive 回村", /function linDeathRestart\(\)[\s\S]{0,200}revive\(\)/.test(dz));
  ok("死亡中不可回村／傳送", /function returnToTown\(dest\) \{[\s\S]{0,200}if \(player && player\.dead\)/.test(wm9) && /function openTeleportMenu\(\) \{\s*if \(player && player\.dead\)/.test(wm9));
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
  ok("世界王重生 1 小時（伺服器）", exists("lib/rt-field-boss.js") && /WB_RESPAWN_MS \|\| 3600000/.test(rd("lib/rt-field-boss.js")));
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
  ok("伺服器座標夾限涵蓋原版大地圖（本土整張 wd_main ±40800×±20448）", /const PRESENCE_WX_MAX = 42000;/.test(serve) && /const PRESENCE_WY_MAX = 21000;/.test(serve));
  ok("可走村莊顯示同圖玩家（mapPopSameMapPlayers 放行 mapdefTownLin）",
    /indexOf\('town_'\) === 0 && !\(typeof mapdefTownLin === 'function' && mapdefTownLin\(mapId\)\)\) return \[\];/.test(pop));
  ok("index 載入 52-lintown-data（在 47-mapdef 前）＋52-lin-town",
    /js\/52-lintown-data\.js[\s\S]*js\/47-mapdef\.js/.test(F.html) && /js\/52-lin-town\.js/.test(F.html));
  ok("原版村莊：mapdefTownLin＋LIN_TOWNS 表", /global\.mapdefTownLin = /.test(F.mapdef) && /LIN_TOWNS/.test(F.mapdef));
  ok("可走村莊不出怪", /exploreInTown\(\)\) return 0;/.test(F.explore) && /exploreInTown\(\)\) return false;/.test(F.explore));
  ok("可走村莊 NPC 點擊開對話", /interactNPC\(/.test(town) && /exploreClearTapMove/.test(town));
  const tw = ["tw_talking", "tw_silver", "tw_gludin", "tw_woodbec", "tw_windawood", "tw_kentcastle", "tw_heine", "tw_giran",
    "tw_oren", "tw_aden", "tw_witon", "tw_elf", "tw_ivory", "tw_pirate", "tw_silent"];
  const TOWNS_CFG = require("./lin/towns-config");
  const WORLDS_CFG = require("./lin/worlds-config");
  const worldOf = (map) => Object.keys(WORLDS_CFG).find((n) => WORLDS_CFG[n].map === map);
  const missTw = tw.filter((n) => {
    const dir = "assets/linmap/" + (worldOf(TOWNS_CFG[n].map) || n);
    return !(exists(dir + "/walk.bin") && exists(dir + "/meta.json"));
  });
  ok("原版村莊圖塊齊全（15 張；本土／說話之島村莊在整張大地圖內）", missTw.length === 0, missTw.join(","));
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
  const WORLDS_CFG = require("./lin/worlds-config");
  const miss = ids.filter((id) => {
    const wn = FIELDS[id][2] != null ? Object.keys(WORLDS_CFG).find((n) => WORLDS_CFG[n].map === FIELDS[id][0]) : null;
    const out = wn || FIELDS[id][1];
    const dir = "assets/linmap/" + out;
    if (!exists(dir + "/walk.bin") || !exists(dir + "/meta.json")) return true;
    if (!data.includes(wn ? '"' + id + '":{"start"' : '"mapId":"' + id + '"')) return true;
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
  const hc = rd("js/00-host-config.js");
  ok("#30 前端 /api/ 不轉發到已停用的 Vercel（Railway 同源）",
    !/idle-aden\.vercel\.app/.test(hc) && !/apiBase\s*=\s*VERCEL_API/.test(hc));
  const lrcss = rd("css/lr-hud.css");
  ok("#31 樂園風 HUD 不顯示右側普攻鈕／空技能格",
    /\.lr-hud \.chud-hotbar \.chud-hot-slot\.is-atk,\s*\n#game-screen\.combat-hud\.lr-hud \.chud-hotbar \.chud-hot-slot\.is-empty \{\s*\n\s*display: none !important;/.test(lrcss));
  const vfx = rd("js/09-vfx-render.js");
  ok("#31 換幀只擋舊幀（載入慢不可卡在待機＝滑行）",
    /if \(reqSeq <= \(img\._animShownSeq \|\| 0\)\) return;/.test(vfx) && !/if \(img\.dataset\.animPending !== fkey\) return;/.test(vfx));
  ok("#31 八向 walk 幀預載", /function _preloadPlayerWalkFrames\(form\)/.test(vfx) && /_preloadPlayerWalkFrames\(form\);/.test(vfx));
  ok("音效快取一天（不可 no-store）", /ext === "\.mp3" \|\| ext === "\.ogg"[^\n]*\n\s*\? "public, max-age=86400"/.test(serve));
}

section("32) 整張原版大地圖（出村不用傳送門）");
{
  const WORLDS_CFG = require("./lin/worlds-config");
  const data = rd("js/49-linmap-data.js");
  const lin = rd("js/49-linmap.js");
  const town = rd("js/52-lin-town.js");
  ok("worlds-config：本土 wd_main（map 4）＋說話之島 ti_island（map 0）",
    WORLDS_CFG.wd_main && WORLDS_CFG.wd_main.map === 4 && WORLDS_CFG.ti_island && WORLDS_CFG.ti_island.map === 0);
  const missW = Object.keys(WORLDS_CFG).filter((n) => {
    const dir = "assets/linmap/" + n;
    if (!exists(dir + "/walk.bin") || !exists(dir + "/meta.json")) return true;
    if (!new RegExp('"' + n + '":\\{[^]*?"world":true').test(data)) return true;
    const meta = JSON.parse(rd(dir + "/meta.json"));
    return !meta.chunks.every((k) => exists(dir + "/c_" + k + ".webp"));
  });
  ok("大地圖圖塊／資料齊全（world:true）", missW.length === 0, missW.join(","));
  ok("applyLinWorlds：同圖村莊／野外不設傳送門、區域練功點", /function applyLinWorlds\(\)/.test(F.mapdef) && /def\.spawns = A\.spots;/.test(F.mapdef) && /if \(inWorld\.has\(p\.dest\)\) return;/.test(rd("tools/lin/build-linmap-data.js")));
  ok("linmapRegionAt：村莊範圍（安全區＋村內角落）優先、其餘最近野外", /global\.linmapRegionAt = linmapRegionAt;/.test(lin) && /function linmapTownMasks\(name\)/.test(lin));
  ok("走過邊界就地換區（exploreTryWalkRegion 每 tick、保留原地座標）",
    /try \{ exploreTryWalkRegion\(\); \} catch/.test(F.explore) && /if \(walkover\) \{\s*_pendingSpawn = \{ x: _tx, y: _ty \};/.test(F.explore));
  ok("#11 大地圖傳送術只落在本區", /if \(def && def\.world && typeof linmapRegionAt === 'function'\) \{\s*var rg = linmapRegionAt\(def\.lin, hx, hy\);/.test(F.explore));
  ok("大地圖野外仍看得到村莊 NPC（只有所在村可點）", /function worldTowns\(world, cur\)/.test(town) && /buildEntity\(p, tid, tid === mapId\)/.test(town));
  ok("自動打怪被地形擋住會換目標（CHASE_STUCK_MS／_unreachUntil）",
    /var CHASE_STUCK_MS = \d+;/.test(F.explore) && /t\._unreachUntil = nowC \+ CHASE_UNREACH_MS;/.test(F.explore) && /if \(m\._unreachUntil && m\._unreachUntil > now\) continue;/.test(F.explore));
  ok("怪物出生點不落在村莊安全區", /\|\| \(def\.lin && typeof linmapSafeZone === 'function' && linmapSafeZone\(def\.lin, hx, hy\)\)\) \{/.test(F.explore));
}

section("33) 樂園風原版材質");
{
  const css = rd("css/lr-hud.css");
  const kit = ["stone.webp", "frame.png", "ring.png"].filter((f) => !exists("assets/ui/lin/" + f));
  ok("原版介面素材在 assets/ui/lin/", kit.length === 0, kit.join(","));
  ok("HUD 變數引用原版材質", /--lr-stone: url\('\.\.\/assets\/ui\/lin\/stone\.webp'\)/.test(css) && /--lr-ring: url\('\.\.\/assets\/ui\/lin\/ring\.png'\)/.test(css));
  ok("聊天輸入框深色（不可白底）", !/rgba\(240, 240, 240/.test(css) && /#world-input \{[^}]*background: rgba\(0, 0, 0, 0\.6\)/.test(css));
  ok("AUTO／信件／回村 同一款金環圓鈕", /\.chud-auto,\s*#game-screen\.combat-hud\.lr-hud \.chud-auto\.is-off,\s*\.lr-mail,\s*\.lr-home \{[^}]*var\(--lr-ring\)/.test(css) && !/#3b82f6 0%, #1e3a8a/.test(css));
  const menuMiss = ["stats", "equip", "items", "skill", "menu"].filter((k) => !exists("assets/ui/lin/menu_" + k + ".png"));
  ok("底部選單用原版道具圖示（menu_*.png）", menuMiss.length === 0 && /assets\/ui\/lin\/menu_' \+ m\.key \+ '\.png/.test(rd("js/51-lr-hud.js")), menuMiss.join(","));
  ok("觸發技能借用原版技能圖示（SKILL_ICON_ALIAS）", /SKILL_ICON_ALIAS\[d\.n\] \|\| d\.n/.test(rd("js/01-drops-config.js")));
}

section("34) 原版格步走路");
{
  const ex = rd("js/44-map-explore.js");
  const fx = rd("js/09-vfx-render.js");
  ok("原版地圖玩家走格步（explorePlayerWalkStep → exploreLinWalkStep）", /function explorePlayerWalkStep\(dirx, diry, goal\) \{\s*var linW = exploreLinName\(\);\s*if \(linW && typeof linmapTileCenter === 'function'\)/.test(ex) && /var LIN_STEP_MS = \d+;/.test(ex));
  ok("只走 8 個格線方向（LIN_NB）＋格心（linmapTileCenter）", /var LIN_NB = \[\[1, 0\], \[1, 1\], \[0, 1\], \[-1, 1\], \[-1, 0\], \[-1, -1\], \[0, -1\], \[1, -1\]\];/.test(ex) && /global\.linmapTileCenter = linmapTileCenter;/.test(rd("js/49-linmap.js")));
  ok("點地／追怪帶 goal（先斜後直）", /explorePlayerWalkStep\(wdx, wdy, inp\.fromTap \? \{ x: _tapMove\.tx, y: _tapMove\.ty \} : null\)/.test(ex) && /explorePlayerWalkStep\(dirx, diry, \{ x: t\._fx, y: t\._fy \|\| 0 \}\)/.test(ex));
  ok("每格 640ms（加速 480）＋第 k 幀跳到 (k+1)/4 格＋每步從第 0 幀起播＋實際時間", /var LIN_STEP_MS = 640;/.test(ex) && /var kd = s\.cyc >= 1 \? Math\.min\(1, \(Math\.floor\(k \* LIN_STEP_FRAMES\) \+ 1\) \/ LIN_STEP_FRAMES\) : k;/.test(ex) && /_walkCycle = s\.c0 \+ k \* s\.cyc;/.test(ex) && /var el = Math\.max\(0, Math\.min\(120, now - s\.t\)\);/.test(ex) && /explorePlayerSpeedMult\(true\)/.test(ex));
  ok("一步＝一整輪走路幀＋走路中 RAF 換幀", /window\.exploreWalkCycle = exploreWalkCycle;/.test(ex) && /Math\.floor\(_wc \* base\.length\)/.test(fx) && /_pmWalkRafWas/.test(fx));
  ok("格步跳位同時換幀（queueMicrotask _playerMorphApply）", /queueMicrotask\(function \(\) \{ try \{ _playerMorphApply\(\); \} catch \(e\) \{\} \}\)/.test(ex));
}

section("43) 新手禮包 200%經驗藥水／伺服器壞網址");
{
  const d = rd("js/00-data.js"), dc = rd("js/01-drops-config.js"), kp = rd("js/05-kill-progression.js"), ss = rd("js/13-shop-save.js"), sv = rd("_serve.js");
  ok("potion_exp2 定義（exp2、1800 秒、有 img、不可賣）", /"potion_exp2": \{[^\n]*img: "assets\/icons\/(items|private)\/[^"%]+\.png"[^\n]*eff: "exp2", dur: 1800, noSell: true/.test(d));
  ok("expPotionMult 套用到玩家經驗（兩處）", /function expPotionMult\(\)/.test(dc) && (kp.match(/expPotionMult\(\)/g) || []).length >= 2);
  ok("創角送 200%經驗藥水 ×10", /gainItem\('potion_exp2', 10, true, true\)/.test(ss));
  ok("_serve.js 壞 URI 回 400 不崩潰", /catch \(eUri\) \{\s*res\.writeHead\(400/.test(sv));
}

section("44) 新手禮包（照新創）");
{
  const d = rd("js/00-data.js"), ie = rd("js/08-items-equip.js"), ss = rd("js/13-shop-save.js"), sk = rd("js/07-skills-cast.js"), st = rd("js/02-stats-recompute.js"), bm = rd("js/54-afk-bookmark.js"), wm = rd("js/11-world-map.js");
  const ids = ["fn_home", "fn_tele", "fn_auto", "fn_settings", "fn_drop", "ivt_helm", "ivt_armor", "ivt_gloves", "ivt_boots", "ivt_sword", "ivt_2hsword", "ivt_scroll_teleport", "ivt_scroll_poly", "ivt_potion_haste"];
  ok("14 個禮包道具定義、都有 img、都不可賣", ids.every((id) => new RegExp('"' + id + '": \\{ n: "[^"]+", img: "assets/[^"]+"[^\\n]*noSell: true').test(d)));
  ok("功能道具不消耗（useFnItem）", /if \(d\.eff === 'fn'\) \{ if \(!silent\) useFnItem\(d\.fn\); return; \}/.test(ie) && /function openTeleportMenu\(\)/.test(wm));
  ok("創角發放禮包並穿上象牙塔防具", /'fn_home', 'fn_tele', 'fn_auto', 'fn_settings', 'fn_drop', 'ivt_helm'/.test(ss) && /gainItem\('ivt_scroll_teleport', 500/.test(ss) && /\['ivt_helm', 'ivt_armor', 'ivt_gloves', 'ivt_boots'\]\.forEach\(id => \{ let it = player\.inv\.find\(i => i\.id === id\); if \(it\) equipItem\(it\); \}\)/.test(ss));
  ok("自動使用／沒怪瞬移／書籤先用綁定版", /function invFindPref\(id\)/.test(ie) && /let item = invFindPref\(cfg\.pot\);/.test(sk) && /let item = invFindPref\('scroll_teleport'\);/.test(sk) && /let item = invFindPref\('scroll_teleport'\);/.test(st) && /var item = invFindPref\('scroll_teleport'\);/.test(bm));
}

section("45) 橫式介面（電腦／手機橫放，照新創）");
{
  const css = rd("css/lr-wide.css"), html = rd("index.html");
  ok("index.html 在 lr-hud.css 之後載入 lr-wide.css", /lr-hud\.css[^\n]*\n\s*<link rel="stylesheet" href="css\/lr-wide\.css/.test(html));
  ok("只在橫式＋寬 ≥ 720px 套用（直式手機不變）", /@media \(orientation: landscape\) and \(min-width: 720px\) \{/.test(css) && !/@media \(orientation: portrait\)/.test(css));
  ok("遊戲滿版＋底條畫在 #col-center 內（聊天在它的疊層，不可畫在 #game-screen 上蓋住聊天）", /width: 100vw !important;/.test(css) && /> #col-center::after \{/.test(css) && !/#game-screen\.combat-hud\.lr-hud::(before|after)/.test(css));
  ok("分頁改右側浮窗、不蓋底條", /sheet-open > #tab-content-panel \{[^}]*left: auto !important;[^}]*bottom: calc\(var\(--lrw-bar-h\)/.test(css));
}

section("46) 同 IP 新登入擠掉舊視窗");
{
  const sv = rd("_serve.js"), ip = rd("js/34-ip-session-limit.js"), au = rd("js/auth-login.js");
  ok("伺服器 claim 支援 takeover、記錄被擠掉的視窗", /function claimIpSession\(ip, clientId, takeover\)/.test(sv) && /claimIpSession\(ip, clientId, data\.takeover === true\)/.test(sv) && /ipTakenOver\.set\(oldId, now\)/.test(sv));
  ok("被擠掉的視窗心跳回 taken_over、不重新佔位", /if \(!result\.ok && ipTakenOver\.has\(clientId\)\)/.test(sv) && /error: "taken_over"/.test(sv));
  ok("主動登入才帶 takeover；背景 claim 不帶", /window\.IpSessionLimit\.claim\(\{ takeover: true \}\)/.test(au) && /if \(opts && opts\.takeover\) body\.takeover = true;/.test(ip) && !/claim\(\{ takeover: true \}\)/.test(rd("js/27-offline-rewards.js")));
  ok("被擠掉時停止遊戲並提示原因", /function onIpSessionLost\(payload\)/.test(au) && /window\.returnToCharacterSelect\(\)/.test(au) && /同一網路的另一個裝置已登入/.test(sv));
  const as = rd("lib/rt-account-session.js"), acs = rd("js/36-account-session.js");
  ok("同帳號：主動登入擠掉舊裝置（claim takeover＋kicked）", /async function claim\(accountKey, clientId, takeover\)/.test(as) && /kicked\.set\(String\(existing\.session_id\), now\)/.test(as) && /_accountSessions\.claim\(accountKey\(account\), clientId, data\.takeover === true\)/.test(sv));
  ok("同帳號：使用者登入帶 takeover（3 處），背景 silentRelogin／恢復登入不帶", (au.match(/takeover: true,/g) || []).length === 3 && !/function silentRelogin[\s\S]{0,400}takeover/.test(au));
  ok("同帳號：taken_over 不自動重登、立即處理", /if \(payload && payload\.error === "taken_over"\) \{/.test(au) && /r\.data\.error === "banned" \|\| r\.data\.error === "taken_over"/.test(acs) && /error: "taken_over"/.test(as));
  ok("登出狀態收起選角／創角面板", /\["load-select-panel", "creation-panel"\]\.forEach/.test(au));
}

section("47) 遊戲腳本還在下載時登入（開始遊戲排隊、雲端同步等載完）");
{
  const au = rd("js/auth-login.js");
  ok("開始遊戲鈕走 GameAccountAuth.startMenu（不可直接 openLoadSelect）", /onclick="GameAccountAuth\.startMenu\(\)" id="btn-start-menu"/.test(F.html) && !/onclick="openLoadSelect\(\)"/.test(F.html));
  ok("載入完成判定＝readyState 非 loading 且 openLoadSelect 已定義", /return document\.readyState !== "loading" && typeof window\.openLoadSelect === "function";/.test(au));
  ok("未載完：開始遊戲鈕顯示百分比、載完自動開選角", /function startMenu\(\)/.test(au) && /載入完成後自動進入 /.test(au) && /document\.addEventListener\("DOMContentLoaded", flushGameReadyQueue\);/.test(au));
  ok("背景雲端同步等遊戲腳本載完（否則選角是空的）", /function runBackgroundCloudSync\(account\) \{\s*return new Promise\(function \(resolve\) \{\s*whenGameReady\(resolve\);/.test(au));
  ok("登入框下載進度條＋登入／註冊鈕下載完才解鎖", /bar\.id = "auth-load-bar";/.test(au) && /b\.disabled = !ready;/.test(au) && /startLoadingUi\(\);/.test(au) && /#auth-load-bar \.auth-load-fill/.test(rd("css/style.css")));
  ok("下載中按 Enter 也不登入", /if \(!gameScriptsReady\(\)\) \{\s*setStatus\("遊戲還在下載（"/.test(au));
  ok("靜態文字檔 gzip（首頁約 7MB 腳本）", /const GZIP_EXT = new Set\(/.test(rd("_serve.js")) && /headers\["Content-Encoding"\] = "gzip";/.test(rd("_serve.js")));
}

section("52) 全服洗白（開機清玩家資料、客戶端清本機舊存檔）");
{
  const sv = rd("_serve.js");
  const se = (sv.match(/const WIPE_EPOCH = "([^"]+)";/) || [])[1];
  const ce = (F.html.match(/var EPOCH = '([^']+)';/) || [])[1];
  ok("伺服器與 index.html 洗白編號一致", !!se && se === ce);
  ok("洗白在任何 lib 載入前執行", sv.indexOf("(function bootWipe()") > 0 && sv.indexOf("(function bootWipe()") < sv.indexOf('require("./lib/'));
  ok("洗白保留玩家回報／GM 操作紀錄／倍率", ['"client-log.json"', '"gm-audit.json"', '"gm-rates.json"', '"wipe-epoch.txt"', '"lost+found"'].every((s) => /const WIPE_KEEP = new Set\(\[[\s\S]{0,300}\]\);/.test(sv) && sv.match(/const WIPE_KEEP = new Set\(\[[\s\S]{0,300}\]\);/)[0].includes(s)));
  ok("只在 Railway 或 WIPE_ON_BOOT=1 才洗", /if \(!onRailway && process\.env\.WIPE_ON_BOOT !== "1"\) return;/.test(sv));
  ok("客戶端洗白腳本是 head 第一支腳本", F.html.indexOf("var EPOCH = '") > 0 && F.html.indexOf("var EPOCH = '") < F.html.indexOf("<script", F.html.indexOf("<script") + 1));
}

section("53) 私服整理（移除非原版系統、補私服道具）");
{
  const dt = rd("js/00-data.js");
  const ie = rd("js/08-items-equip.js");
  const dc = rd("js/01-drops-config.js");
  const cd = rd("js/15-cards.js");
  const wc = rd("js/26-world-channel.js");
  ok("城堡護衛招募／魔物追蹤／決鬥競技場 NPC 不在任何村莊",
    !/id: "npc_(kent_guard|ww_guard|heine_guard|obel|hert|diren|arena)"/.test(dt));
  ok("世界頻道假玩家閒聊維持關閉", /function _wcPostIdleChat\(\) \{\s*return;/.test(wc));
  const exps = { 130: 1.3, 150: 1.5, 170: 1.7, 200: 2, 250: 2.5, 300: 3 };
  ok("經驗藥水 130~300%（10 分鐘、私服自製圖示）", Object.keys(exps).every((k) =>
    new RegExp('"potion_exp' + k + '": \\{[^\\n]*img: "assets/icons/private/potion_exp' + k + '\\.png"[^\\n]*eff: "exp' + k + '", dur: 600').test(dt)));
  ok("私服道具自製圖示檔都在（tools/lin/build-private-icons.js）", ["potion_exp2", "potion_exp130", "potion_exp300", "scroll_town_giran", "doll_pick_6", "fn_home", "item_newbie_embark", "scroll_attr_fire"]
    .every((k) => fs.existsSync(path.join(ROOT, "assets/icons/private/" + k + ".png")) && new RegExp('"?' + k + '"?:\\s*\\{[^\\n]*img: "assets/icons/private/' + k + '\\.png"').test(dt)));
  ok("經驗藥水取最高倍率、不疊加", Object.keys(exps).every((k) => new RegExp("exp" + k + ": " + exps[k] + "\\b").test(dc)) &&
    /if \(b\[k\] > 0 && EXP_POTION_BUFF_MULT\[k\] > m\) m = EXP_POTION_BUFF_MULT\[k\];/.test(dc));
  const towns = ["talking", "gludin", "silver_knight", "gludio", "elf", "giran", "heine", "oren", "witon", "aden"];
  ok("村莊傳送卷軸 10 張", towns.every((t) => new RegExp('"scroll_town_' + t + '":[^\\n]*eff: "town_tp", town: "town_' + t + '"').test(dt)));
  ok("村莊傳送卷軸走 returnToTown(指定村莊)", /d\.eff === 'town_tp'/.test(ie) && /returnToTown\(d\.town\)/.test(ie));
  ok("魔法娃娃任選卷 二~六階", [2, 3, 4, 5, 6].every((t) => new RegExp('"doll_pick_' + t + '": \\{[^\\n]*eff: "doll_pick", pickTier: ' + t).test(dt)));
  ok("任選卷：選定才扣卷、只能選該階", /d\.eff === 'doll_pick'[^\n]*openDollPick\(item\)/.test(ie) &&
    /function openDollPick\(item\)/.test(cd) && /\(DOLL_BY_TIER\[sd\.pickTier\] \|\| \[\]\)\.indexOf\(dollId\) < 0\) return;/.test(cd));
}

section("55) 原版地圖怪物一格一步／打中幀才扣血");
{
  const ex = rd("js/44-map-explore.js");
  const cc = rd("js/03-combat-core.js");
  const vr = rd("js/09-vfx-render.js");
  const tm = rd("js/49-linmob-timing.js");
  ok("index 載入 49-linmob-timing（l1j passispeed／atkspeed＋list.spr 打中幀）", /js\/49-linmob-timing\.js/.test(F.html) && /var LIN_MOB_TIMING = \{/.test(tm) && fs.existsSync(path.join(ROOT, "tools/lin/export-mob-timing.js")));
  ok("怪一格一步：位移跟走路幀一格格跳、連續走接上一步結束時刻", /function exploreMobLinTick\(/.test(ex) && /var kd = \(f \+ 1\) \/ n;/.test(ex) && /now - m\._lsEnd < dur\) \? Math\.min\(dur \* 0\.9/.test(ex));
  ok("一格一隻（佔格表）、不進玩家格、原版地圖不推擠", /function exploreLinMobOccupy\(/.test(ex) && /if \(pt && gx === pt\.gx && gy === pt\.gy\) return null;/.test(ex) && /if \(!linN\) try \{ exploreMobSeparateTick\(\); \}/.test(ex));
  ok("怪站定且在自身攻擊距離（格）內才攻擊；玩家近戰＝鄰格", /function exploreMobCanHitPlayer\(/.test(ex) && /mob\._ls\) return false;/.test(ex) && /exploreEngageLimit\(\) > ENGAGE_MELEE \? 8 : 1/.test(ex) && /exploreMobCanHitPlayer\(m\)/.test(cc));
  ok("攻擊先播動作、打中幀才結算", /m\._linHitAt = _now \+ _lt\.hit;/.test(cc) && /if \(m\._linHitAt && Date\.now\(\) >= m\._linHitAt\)/.test(cc));
  ok("攻擊動作照原版各幀時長、不被受擊打斷、原版地圖 ~25fps 換幀", /function _linMobActFrame\(/.test(vr) && /\(k === 'attack' \|\| k === 'hurt'\) && m\._linAtkHold && Date\.now\(\) < m\._linAtkHold\) return;/.test(vr) && /classList\.contains\('is-linmap'\)\) \? 38 :/.test(vr));
}

section("54) 設定／內掛選單／輔助設定 視窗（照新創）");
{
  const lm = rd("js/55-lin-menus.js");
  const tb = rd("js/10-ui-tabs.js");
  const ie = rd("js/08-items-equip.js");
  const sc = rd("js/07-skills-cast.js");
  const ss = rd("js/13-shop-save.js");
  ok("index 載入 55-lin-menus.js／lin-menus.css", /js\/55-lin-menus\.js/.test(F.html) && /css\/lin-menus\.css/.test(F.html));
  ok("三個視窗：設定（遊戲選單）／內掛選單 狩獵·補給·魔法·召喚／輔助設定 一般·藥水·狀態·輔助",
    /\['hunt', '狩獵'\], \['supply', '補給'\], \['magic', '魔法'\], \['summon', '召喚'\]/.test(lm) && /\['general', '一般'\], \['potion', '藥水'\], \['status', '狀態'\], \['aux', '輔助'\]/.test(lm));
  ok("設定欄位沿用原元素（同 id 搬進視窗，不另做一份）", /function grab\(id\) \{ var e = \$\(id\); return e/.test(lm) && /id="set-patrol"/.test(F.html) && /id="set-hp-skill"/.test(F.html));
  ok("舊設定分頁入口改開視窗", /if \(t === 'automation' && typeof linMenuOpen === 'function'\) \{ linMenuOpen\('settings'\); return; \}/.test(tb));
  ok("右側選單「設定」組：設定／內掛／輔助設定／自動賣出／書籤", /key: 'gamemenu'[\s\S]{0,200}key: 'automenu'[\s\S]{0,200}key: 'assist'[\s\S]{0,200}action: 'autosell'[\s\S]{0,200}action: 'bookmark'/.test(tb));
  ok("內掛道具開內掛選單、設定道具開輔助設定", /linMenuOpen\(fn === 'auto' \? 'auto' : 'assist'\)/.test(ie));
  ok("應急（HP 低於門檻用回村道具）／自動解毒（翡翠藥水）", /set-emerg-hp/.test(sc) && /useFnItem\(DB\.items\[_eId\]\.fn\)/.test(sc) && /set-auto-cure/.test(sc) && /"potion_cure": \{[^\n]*eff: "curepoison"/.test(F.data));
  ok("自動購買一次買幾個（仍只在 0 個時才買）", /autoBuyQty\('set-buy-qty-pot', 100, 1, 1000\)/.test(sc) && /autoBuyQty\('set-buy-qty-arrow'/.test(rd("js/03-combat-core.js")));
  ok("寵物補血預設門檻（個別寵物設定優先）", /p\.potPct > 0 \? p\.potPct : \(parseInt\(\(typeof document !== 'undefined' && document\.getElementById\('set-pet-heal-hp'\)/.test(rd("js/22-pets.js")));
  ok("新設定會存檔", ["setEmergHp", "setEmergItem", "setAutoCure", "setPetHealHp", "setBuyQtyPot", "setBuyQtyArrow"].every((k) => ss.includes(k + ":")));
}

section("51) 主城奇岩");
{
  const wm = rd("js/11-world-map.js");
  const ss = rd("js/13-shop-save.js");
  const ie = rd("js/08-items-equip.js");
  const ui = rd("js/10-ui-tabs.js");
  const dt = rd("js/00-data.js");
  ok("主城常數＝奇岩，家鄉／回村／死亡都回主城", /const MAIN_CITY = 'town_giran';\s*function getHomeTown\(\) \{ return MAIN_CITY; \}/.test(wm) && /function getLastTown\(\) \{\s*return getHomeTown\(\);\s*\}/.test(wm));
  ok("血盟據點（Ctrl+C）仍走原本家鄉邏輯 getPledgeTown", /function getPledgeTown\(\)/.test(wm) && /victoryCityCfg\(\)\.castle : getPledgeTown\(\)\);/.test(wm));
  ok("回村鈕 onclick 帶事件不可當目的地", /function returnToTown\(dest\) \{\s*if \(typeof dest !== 'string'\) dest = '';/.test(wm));
  ok("創角一律主城出生", /setMapSelectors\(getHomeTown\(\)\);\s*_uiConfigReady = true;/.test(ss) && !/startMap = 'town_silver_knight';\s*if \(player\.cls === 'mage'\)/.test(ss));
  ok("主城符固定回奇岩、不消失", /if \(fn === 'home'\) \{[\s\S]{0,400}returnToTown\(city\);/.test(ie) && /"fn_home": \{[^}]*返回主城奇岩/.test(dt));
  ok("奇岩補傳送師爾瑪／魔法傳授／寵物保管／道具回收", ['n: "爾瑪", title: "傳送師", type: "teleport"', 'id: "npc_giran_magic"', 'id: "npc_giran_pet"', 'type: "recycle"'].every((s) => dt.includes(s)));
  ok("魔法傳授＝各魔法商人合集、只列本職業可學", /SHOP_LISTS\.npc_giran_magic = \[\.\.\.new Set/.test(ss) && /npcId === 'npc_giran_magic' && d\.type === 'skillbk'/.test(ss) && /\n\s+default: \['potion_heal'/.test(ss));
  ok("道具回收不改自動販賣規則", /function _qjSellNow\(selected, label, remember\)/.test(ui) && /_qjSellNow\(selected, '道具回收', false\)/.test(ui) && /npc\.type === 'recycle'\) \{[\s\S]{0,80}renderRecycleNPC/.test(wm));
}

section("50) 原版地圖人物不疊 CSS 黑橢圓影");
{
  const css = rd("css/style.css");
  ok("is-linmap＋人物圖自帶影子層時隱藏 ::after 橢圓", /#battle-view\.is-linmap\.is-world-scroll > #player-morph-sprite:not\(:has\(> \.pm-shadow\[style\*="hidden"\]\)\)::after,[\s\S]{0,200}display: none;/.test(css));
  ok("所有地圖：人物圖自帶影子層就不疊橢圓（v3.10.1）", /#battle-view > #player-morph-sprite:has\(> \.pm-shadow\[src\]:not\(\[style\*="hidden"\]\)\)::after,[\s\S]{0,200}display: none !important;/.test(css));
  ok("奇岩木頭人縮到人物大小", /#battle-view \.mob-target\.town-dummy \.mob-img-inner \{\s*scale: 0\.62;/.test(css));
  ok("原版地圖職業圖人物 1:1（不吃 196×236 上限）", /#battle-view\.is-linmap\.is-real-map\.is-world-scroll > #player-morph-sprite:not\(\.q-chibi-actor\) > img,[\s\S]{0,200}max-width: none !important;\s*max-height: none !important;/.test(css));
}

section("49) 登入同步不用同步 XHR（慢網路整頁凍住）");
{
  const cs = rd("js/35-cloud-save.js");
  ok("登入同步：刪角墓碑非同步上傳", /_persistDeletedCharsShared\(mergedTombs, true\);/.test(cs) && /function _persistDeletedCharsShared\(merged, async\)/.test(cs));
  ok("套用雲端包：本機較佳改非同步回填、刪殘留改非同步", /\} else if \(_localBelongsToCurrent\(localData, true\)\) \{\s*cloudPushSlot\(slot, localData\);/.test(cs) && /_xhrJson\('DELETE', _base\(\) \+ '\/slot\/' \+ slot, null, false, 8000\)/.test(cs));
  ok("進角 10 分鐘內同步過就不再同步 XHR 拉槽", /var RECENT_MS = 10 \* 60000;/.test(cs));
}

section("48) 主畫面捷徑舊頁面自動更新");
{
  const lu = rd("js/38-live-update.js");
  ok("自己版本≠伺服器版本就更新（不可只記第一次伺服器版本當基準）", /clientVer && clientVer !== serverVer && _staleTryOnce\(serverVer\)/.test(lu));
  ok("每個版本只試一次（sessionStorage 防無限重整）", /function _staleTryOnce\(ver\)/.test(lu) && /sessionStorage\.getItem\(k\) === ver/.test(lu));
  ok("登入框最底：目前版本＋更新鈕（內嵌腳本，不依賴後面遊戲腳本）", /id="auth-cur-ver">目前版本 v3\.\d+\.\d+</.test(F.html) && /id="btn-auth-update" onclick="authForceUpdate\(\)"/.test(F.html) && /function authForceUpdate\(\)[\s\S]{0,900}location\.replace\(/.test(F.html));
  {
    const gv = (rd("js/00-data.js").match(/GAME_VERSION = '([^']+)'/) || [])[1];
    const hv = (F.html.match(/id="auth-cur-ver">目前版本 (v[\d.]+)</) || [])[1];
    ok("登入框顯示的版本＝GAME_VERSION（bump 會一起改）", !!gv && gv === hv);
  }
  ok("玩家端錯誤／開始遊戲狀態回報（/api/client-log → GM /api/gm/client-log）", /window\.__clientLog = function/.test(F.html) && /log\(after\.load === "on" \? "start_ok" : "start_stuck"/.test(rd("js/auth-login.js")) && /if \(u === "\/api\/client-log"\)/.test(rd("_serve.js")) && /u === "\/api\/gm\/client-log"/.test(rd("lib/rt-gm-file.js")) && /'tap_trail'/.test(F.html) && /'freeze'/.test(F.html) && /window\.__clientAlive = function/.test(F.html) && /log\("start_tap"/.test(rd("js/auth-login.js")));
  ok("主執行緒卡死由 Worker 看門狗代報 hard_freeze（附最後步驟）", /kind:"hard_freeze"/.test(F.html) && /new Worker\(URL\.createObjectURL/.test(F.html) && /window\.__phase = function/.test(F.html) && /'tap_any'/.test(F.html) && /window\.__phase\('applied'\)/.test(rd("js/35-cloud-save.js")) && /window\.__phase\('openLoadSelect'\)/.test(rd("js/13-shop-save.js")));
  ok("卡死回報附正在跑的計時器／動畫幀（task）＋長畫面幀歸因（loaf）", /task:info\.task/.test(F.html) && /wd\.postMessage\(\{ task: curTask/.test(F.html) && /type: 'long-animation-frame'/.test(F.html) && /window\.__clientLog\('loaf'/.test(F.html));
  { const cs = rd("js/35-cloud-save.js");
    ok("存檔 409 改用雲端、不可回推（防同步 GET↔PUT 無限迴圈）", /function _adoptCloudSlotAsync\(slot\)/.test(cs) && /body\.error === 'stale_save'\)\) \{\s*_adoptCloudSlotAsync\(slot\);/.test(cs) && (cs.match(/cloudPullSlotIntoStorage\(slot, \{ adoptCloud: true \}\)/g) || []).length === 2 && /if \(opts\.adoptCloud\) \{/.test(cs)); }
  ok("回前景／頁面還原時檢查版本", /visibilitychange', function \(\) \{ if \(!document\.hidden\) _poll\(\); \}/.test(lu) && /ev\.persisted\) _poll\(\)/.test(lu));
}

section("58) 房屋可進（l1j 邊界通行）＋NPC 不被屋頂蓋住");
{
  const lin = rd("js/49-linmap.js");
  const ex = rd("js/44-map-explore.js");
  const town = rd("js/52-lin-town.js");
  const exp = rd("tools/lin/export-linmap.js");
  ok("linmapCanStep：bit4 有邊界資料、bit2 東／bit3 北、斜走走 L 形", /function linmapCanStep\(name, gx, gy, dx, dy\)/.test(lin) && /if \(!\(c0 & 16\) \|\| !\(c0 & 1\)\) return/.test(lin) && /& 4\) === 4/.test(lin) && /& 8\) === 8/.test(lin) && /global\.linmapCanStep = linmapCanStep;/.test(lin));
  ok("玩家／怪格步都走 linmapCanStep", (ex.match(/if \(typeof linmapCanStep === 'function'\) \{/g) || []).length === 2 && /linmapCanStep\(name, t\.gx, t\.gy, o\.gx - t\.gx, o\.gy - t\.gy\)/.test(ex) && /linmapCanStep\(name, t\.gx, t\.gy, cx, cy\)/.test(ex));
  ok("export-linmap 套 l1j 邊界（tools/lin/l1j-walk.js）", /require\("\.\/l1j-walk"\)\.applyL1jWalk\(walk, meta\)/.test(exp) && exists("tools/lin/l1j-walk.js"));
  for (const n of ["wd_main", "ti_island"]) {
    let edge = 0;
    try { const w = fs.readFileSync(path.join(ROOT, "assets/linmap", n, "walk.bin")); for (let i = 0; i < w.length; i += 997) if (w[i] & 16) edge++; } catch (e) {}
    ok(n + " walk.bin 帶 l1j 邊界資料（bit4）", edge > 100, "samples " + edge);
  }
  ok("NPC 是 shield：屋頂只有擋到玩家本人才疊", /h: 72, shield: true/.test(town) && /if \(a\.shield\) \{ shield = true; continue; \}/.test(lin) && /if \(hit && \(hero \|\| !shield\)\) want\.push/.test(lin) && /if \(typeof linTownActors === 'function'\) out = out\.concat\(linTownActors\(\)\);/.test(ex));
  ok("擋到玩家的物件收進同一個半透明盒（只淡一次）", /veilBox\.className = 'explore-linobj-veil';/.test(lin) && /var home = w\.hero \? veilBox : layer;/.test(lin) && /#explore-linobj > \.explore-linobj-veil \{[^}]*opacity: \.5;/.test(rd("css/style.css")));
  ok("本遊戲 NPC 只接手走得到的原版站位", /reachable\(orig\[j\]\)\) free\.push\(j\);/.test(town) && /_walkWait/.test(town));
  ok("村莊 NPC 圖層漏建／被清掉會自動補（linTownEnsure）", /global\.linTownEnsure = function/.test(town) && /linTownEnsure\(mapState\.current\)/.test(ex) && /!_ents\[0\]\.el\.isConnected/.test(town));
  ok("gzip 快取鍵含修改時間（同大小改內容也重壓）", /size = size \+ ":" \+ fs\.statSync\(full\)\.mtimeMs/.test(rd("_serve.js")));
}

section("59) 原版地圖玩家普攻（原版節奏＋打中幀才扣血）");
{
  const fx = rd("js/09-vfx-render.js");
  const atk = rd("js/04-combat-attack.js");
  const core = rd("js/03-combat-core.js");
  ok("index 載入 49-linpc-atk（list.spr 各幀 dur＋打中幀）", /js\/49-linpc-atk\.js/.test(F.html) && /var LIN_PC_ATK = \{/.test(rd("js/49-linpc-atk.js")) && exists("tools/lin/export-pc-atk.js") && /"男騎士\|sword1":\[\[3,6,5,1,4,3\],4\]/.test(rd("js/49-linpc-atk.js")));
  ok("攻擊動作照原版各幀、整段＝攻擊間隔", /function _linPcAtkProfile\(form, n\)/.test(fx) && /function _pmAtkFrameAt\(form, elapsed, n\)/.test(fx) && (fx.match(/_pmAtkFrameAt\(form, Date\.now\(\) - /g) || []).length >= 1 && /_pmAtkFrameAt\(form, Date\.now\(\) - _pmState\.t, _nA\)/.test(fx));
  ok("先揮後算：playerAttackLinBegin 播動作、打中幀 playerAttackLinHit 才結算", /function playerAttackLinBegin\(\)/.test(atk) && /state\._pLinHitAt = Date\.now\(\) \+ prof\.hit;/.test(atk) && /function playerAttackLinHit\(\)/.test(atk) && /!playerAttackLinBegin\(\)\) playerAttack\(\);/.test(core) && /playerAttackLinHit\(\);/.test(core));
  ok("原版地圖普攻不被受擊打斷", /if \(k === 'hurt' && st\.act === 'attack' && curP === _PM_PRIO\.attack\) return;/.test(fx));
}

section("60) 排行榜（照新創：職業分頁＋血盟、自己固定在最底）");
{
  const rk = rd("js/56-lin-rank.js");
  const sv = rd("_serve.js");
  ok("index 載入 56-lin-rank、視窗＝職業五頁＋血盟＋綜合榜", /js\/56-lin-rank\.js/.test(F.html) && /\['royal', '王族'\], \['knight', '騎士'\], \['elf', '妖精'\], \['mage', '法師'\], \['dark', '黑妖'\], \['clan', '血盟'\]/.test(rk) && /\['level', '等級總榜'\]/.test(rk) && /window\.linRankOpen = linRankOpen;/.test(rk));
  ok("排行榜入口：pvp 分頁與設定選單都開新視窗", /if \(t === 'pvp' && typeof linRankOpen === 'function'\) \{ linRankOpen\(\); return; \}/.test(rd("js/10-ui-tabs.js")) && /\['排行榜', function \(\) \{ if \(typeof linRankOpen === 'function'\) linRankOpen\(\); \}\]/.test(rd("js/55-lin-menus.js")));
  ok("伺服器 cls／clan 榜＋自己名次 me（榜外也給）", /const LEADERBOARD_BOARDS = new Set\(\["level", "gold", "pride", "rift", "cls", "clan"\]\);/.test(sv) && /function leaderboardClanByName\(\)/.test(sv) && /function leaderboardClanRows\(clanOf\)/.test(sv) && /me: mi >= 0 \? \{ \.\.\.pub\(sorted\[mi\], mi\), inTop: mi < limit \} : null,/.test(sv));
  ok("排行榜樣式（.lr-row／.lr-foot）", /\.lr-row \{/.test(rd("css/lin-menus.css")) && /\.lr-foot \{/.test(rd("css/lin-menus.css")));
}

section("61) 存檔成功不顯示訊息（失敗仍提示）");
{
  const sv = rd("js/13-shop-save.js");
  ok("saveGame 成功不再 logSys「遊戲進度已儲存」", !/遊戲進度已儲存/.test(sv) && /遊戲進度儲存失敗，本次進度未寫入/.test(sv));
}

section("62) GM 刪除帳號＋線上實測不留測試帳號");
{
  const gf = rd("lib/rt-gm-file.js");
  ok("檔案模式 /api/gm/account/delete（需再打一次帳號、刪存檔資料夾／角色名／血盟）", /if \(u === "\/api\/gm\/account\/delete"\) return accountDelete\(req, res, ip\);/.test(gf) && /error: "confirm_mismatch"/.test(gf) && /if \(path\.dirname\(abs\) !== root \|\| !fs\.existsSync\(abs\)\) continue;/.test(gf) && /function gmPurgeAccountRefs\(account\)/.test(rd("_serve.js")));
  ok("實測註冊的線上帳號結束時自動刪除（_gm-cleanup autoCleanup）", exists("tools/_gm-cleanup.js") && /autoCleanup\(\)/.test(rd("tools/_audit-start-menu.js")) && /autoCleanup\(\)/.test(rd("tools/_audit-stale-loop.js")) && /if \(account && !isLocal\(origin\)\)/.test(rd("tools/_gm-cleanup.js")));
}

section("25b) 進遊戲不閃舊 HUD");
{
  const css = rd("css/lr-hud.css"), js = rd("js/51-lr-hud.js");
  ok("套上 lr-hud 前 game-screen 透明", /#game-screen:not\(\.lr-hud\)\s*\{\s*opacity:\s*0 !important;/.test(css));
  ok("combat-hud 一出現當幀補套 lr-hud", /new MutationObserver\(function \(\) \{\s*if \(!s\.classList\.contains\('lr-hud'\) && s\.classList\.contains\('combat-hud'\)/.test(js));
}

section("34b) 格步跟畫面幀同步（走路不飄跳）");
{
  const ex = rd("js/44-map-explore.js");
  ok("走一步期間 RAF 每幀推進、走完當幀補跑 tick", /function exploreLinRafFrame\(\)/.test(ex) && /if \(!_linStep\) \{ try \{ exploreTick\(\); \} catch \(eT\) \{\} return; \}/.test(ex) && /if \(k >= 1\) _linStep = null;\s*else exploreLinRafKick\(\);/.test(ex));
}

section("64) 進屋收外殼（原版天堂）");
{
  const lm = rd("js/49-linmap.js");
  ok("執行期：進屋判定＋屋內補圖＋外殼遮擋不疊＋遮擋顏色取補圖", /function linmapHouseAt\(name, d, actors\)/.test(lm) && /el\.id = 'explore-linhouse';/.test(lm) && /if \(house && s\.house === house\.id\) continue;/.test(lm) && /bg\.img = 'url\("' \+ house\.url \+ '"\),' \+ bg\.img;/.test(lm) && /house: s\[7\]/.test(lm));
  ok("匯出工具（linhouse 偵測、export-linhouse、export-linobj 標外殼）", exists("tools/lin/linhouse.js") && exists("tools/lin/export-linhouse.js") && /shellOf\.get\(b\.file \+ ":" \+ gKey\)/.test(rd("tools/lin/export-linobj.js")) && /FLOOR_SAFE_MIN = 0\.5/.test(rd("tools/lin/linhouse.js")));
  const sb = { window: {} };
  require("vm").runInNewContext(rd("js/49-linmap-data.js"), sb);
  const LD = sb.window.LINMAP_DATA || {};
  ok("大地圖有房子資料（wd_main／ti_island houses＋houses.json）", LD.wd_main && LD.wd_main.houses > 100 && LD.ti_island && LD.ti_island.houses > 0 && exists("assets/linmap/wd_main/houses.json") && exists("assets/linmap/wd_main/h_0.webp"));
  ok("屋內補圖樣式（在人物底下）", /#explore-linmap > \.explore-linhouse \{[^}]*z-index: 1;/.test(rd("css/style.css")));
}

section("63) 說話頭上冒對話泡泡");
{
  const cb = exists("js/57-chat-bubble.js") ? rd("js/57-chat-bubble.js") : "";
  const wc = rd("js/26-world-channel.js");
  ok("js/57-chat-bubble.js 載入（chatBubbleShow、5 秒消失）", /js\/57-chat-bubble\.js/.test(F.html) && /window\.chatBubbleShow = chatBubbleShow;/.test(cb) && /var SHOW_MS = 5000;/.test(cb));
  ok("_chatDeliver 一般頻道（自己／同圖玩家）冒泡泡，歷史訊息不冒", /if \(!isHistory && payload\.ch === 'world' && payload\.name !== '系統' && !payload\.pandoraDraw && typeof chatBubbleShow === 'function'\)/.test(wc) && /if \(bMe \|\| fromRemote\) chatBubbleShow\(payload\.name, payload\.text, bMe\);/.test(wc));
  ok("泡泡樣式（字級隨 --lin-zoom 縮回、不擋點擊）", /#battle-view \.chat-bubble \{[^}]*pointer-events: none;[^}]*font-size: calc\(13px \/ var\(--lin-zoom, 1\)\);/.test(rd("css/style.css")));
}

section("35) 名字在頭上");
{
  const fx = rd("js/09-vfx-render.js");
  const css = rd("css/style.css");
  ok("場戰名牌依頭頂高度（_sprHeadPx）", /function _sprHeadPx\(img\)/.test(fx) && /nm\.style\.bottom = _pmState\._nameHead > 0 \?/.test(fx));
  ok("同圖玩家名牌／血條依頭頂高度", /var rHead = _sprHeadPx\(st\.imgs\.bd\);/.test(fx));
  ok("場戰名牌不可再用 bottom:100% !important", !/is-world-scroll #player-morph-sprite \.pm-name \{\s*bottom: calc\(100% \+ 2px\) !important;/.test(css));
}

section("36) 原版地圖畫面放大");
{
  const ex = rd("js/44-map-explore.js");
  const css = rd("css/style.css");
  ok("整個 #battle-view 縮放（短邊 480 世界像素、0.8～1.1 倍；放大 scale、拉遠 zoom，v3.10.15 再拉遠）", /var LIN_VIEW_SPAN = 480;/.test(ex) && /var LIN_ZOOM_MAX = 1\.1;/.test(ex) && /var LIN_ZOOM_MIN = 0\.8;/.test(ex) && /bv\.style\.setProperty\('scale', String\(z\)\);/.test(ex) && /bv\.style\.zoom = String\(z\);/.test(ex));
  ok("不可對各世界層各自 transform／scale（會拆散前後遮擋）", !/LIN_ZOOM_IDS/.test(ex));
  ok("點地換算含放大（exploreLinZoomPivot）＋反函數 exploreWorldToClient", /_tapMove\.tx = _cx \+ \(clientX - \(r\.left \+ pv\.x \* lz\)\) \/ lz;/.test(ex) && /window\.exploreWorldToClient = exploreWorldToClient;/.test(ex));
  ok("角色 ID 點到才顯示（自己 self-name-on／同圖玩家 name-on）", /body:not\(\.self-name-on\) #player-morph-sprite \.pm-name,\s*\.party-sprite\.remote-party:not\(\.name-on\) \.remote-party-tag \{\s*display: none !important;/.test(css) && /function _nameShowSet\(key\)/.test(rd("js/09-vfx-render.js")) && /classList\.toggle\('name-on', window\.__nameShowKey === mem\.key\)/.test(rd("js/09-vfx-render.js")));
  ok("原版地圖走路不冒腳下大陰影圈／草屑", /#battle-view\.is-linmap > #explore-foot-patch,\s*#battle-view\.is-linmap \.explore-grass-puff \{ display: none !important; \}/.test(css));
  ok("原版地圖人物影子半透明（不可實心黑）", /#battle-view\.is-linmap #player-morph-sprite \.pm-shadow,\s*#battle-view\.is-linmap \.party-sprite \.pm-shadow \{ opacity: \.45; \}/.test(css));
  ok("名牌字級反向縮回（--lin-zoom）", /#battle-view\.is-lin-zoom #player-morph-sprite \.pm-name \{\s*font-size: calc\(13px \/ var\(--lin-zoom, 1\)\);/.test(css));
}

section("37) 人物走到物件後面（原版遮擋）");
{
  const lin = rd("js/49-linmap.js");
  const ex = rd("js/44-map-explore.js");
  const css = rd("css/style.css");
  ok("遮擋物件同步（linmapObjSync）由探索每 tick 呼叫", /function linmapObjSync\(bv, name, camX, camY, actors, depthZ, screenBottom\)/.test(lin) && /linmapObjSync\(bv, linName, _cx, _cy, exploreOccluders\(\), exploreDepthZ, exploreMobScreenBottom\);/.test(ex));
  ok("原版地圖細刻度景深（exploreDepthZ 每 2px 一層）", /if \(exploreLinName\(\)\) return Math\.max\(100, Math\.min\(1900, Math\.round\(1000 - d \/ 2\)\)\);/.test(ex) && /return exploreDepthZ\(_ty, 30, 90\);/.test(ex));
  ok("遮擋層不可設 z-index／transform（物件要插在人物之間）", /#explore-linobj \{\s*position: absolute;\s*inset: 0;\s*pointer-events: none;\s*overflow: visible;\s*\}/.test(css));
  ok("擋住玩家＝半透明（is-veil）", /\.explore-linobj-spr\.is-veil \{ opacity: \.5; \}/.test(css));
  const sandbox = { window: {} };
  require("vm").runInNewContext(rd("js/49-linmap-data.js"), sandbox);
  const LD = sandbox.window.LINMAP_DATA || {};
  const names = Object.keys(LD);
  const noObj = names.filter((n) => !(LD[n].objChunks && LD[n].objChunks.length));
  ok("每張原版地圖都有遮擋物件圖集（objChunks）", names.length > 0 && noObj.length === 0, noObj.join(","));
  const missObj = names.filter((n) => {
    const k = (LD[n].objChunks || [])[0];
    return !k || !exists("assets/linmap/" + n + "/o_" + k + ".webp") || !exists("assets/linmap/" + n + "/o_" + k + ".json");
  });
  ok("遮擋圖集檔案存在（o_*.webp＋o_*.json）", missObj.length === 0, missObj.join(","));
}

section("38) NPC 頭上兩行（職稱＋名字）");
{
  const town = rd("js/52-lin-town.js");
  const css = rd("css/style.css");
  ok("職稱在上一行（lin-npc-title display:block）", /#lin-town-npcs \.lin-npc-title \{\s*display: block;/.test(css) && /nm\.insertBefore\(t, nm\.firstChild\);/.test(town));
  ok("NPC 名牌依頭頂高度（sprHeadAbove）", /function sprHeadAbove\(key, spr, url, cb\)/.test(town) && /nm\.style\.bottom = Math\.round\(head \+ 3\) \+ 'px';/.test(town));
}

section("39) 玩家交易（點同圖玩家 → 交易，伺服器托管）");
{
  const has = (p) => fs.existsSync(path.join(ROOT, p));
  const srv = rd("_serve.js");
  const css = rd("css/style.css");
  ok("lib/rt-trade.js＋js/53-trade.js 存在", has("lib/rt-trade.js") && has("js/53-trade.js"));
  ok("_serve.js 轉送 /api/trade，交易狀態存 PERSIST_DIR", /u\.startsWith\("\/api\/trade"\)/.test(srv) && /persistFile\("trades\.json"\)/.test(srv));
  ok("index.html 載入 js/53-trade.js", /js\/53-trade\.js/.test(F.html));
  ok("同圖玩家可點區 .remote-party-hit pointer-events:auto", /\.remote-party-hit\s*\{[^}]*pointer-events:\s*auto/.test(css) && /remote-party-hit/.test(rd("js/09-vfx-render.js")));
  ok("點玩家不觸發點地移動（isUiBlockTarget 含 .remote-party-hit）", /\.remote-party-hit, #peer-menu, #trade-win, #trade-ask/.test(rd("js/46-combat-hud.js")));
  ok("party poll 轉交易事件", /ev\.type === 'trade' \|\| ev\.type === 'trade_claim'/.test(rd("js/36-realtime-party.js")));
  ok("雲端存檔 _seedOf 有定義（否則同步上傳必拋錯、交易／拍賣鎖不了）", /function _seedOf\(data\)/.test(rd("js/35-cloud-save.js")));
}

section("40) 掛機巡邏範圍／沒怪瞬移／書籤／掛機報告");
{
  const ex = rd("js/44-map-explore.js");
  const save = rd("js/13-shop-save.js");
  const tabs = rd("js/10-ui-tabs.js");
  const ab = fs.existsSync(path.join(ROOT, "js/54-afk-bookmark.js")) ? rd("js/54-afk-bookmark.js") : "";
  ok("設定有巡邏範圍＋沒怪瞬移，且寫進存檔", /id="set-patrol"/.test(F.html) && /id="set-nomob-tp"/.test(F.html) && /'set-patrol', 'set-nomob-tp'/.test(save) && /setPatrol:/.test(save) && /setNoMobTp:/.test(save));
  ok("巡邏範圍以錨點原版格距篩怪（exploreTileDist）", /exploreTileDist\(anchor\.x, anchor\.y, m\._fx/.test(ex) && /function explorePatrolIdleTick\(\)/.test(ex));
  ok("沒怪瞬移走 autoNoMobTeleport（同卷軸限制、0 張才買）", /function autoNoMobTeleport\(\)/.test(rd("js/02-stats-recompute.js")) && /autoNoMobTeleport\(\)/.test(ex));
  ok("書籤傳送消耗瞬移卷軸、檢查進入條件", /consume\(item\)/.test(ab) && /mapOptDisabled\(def\)/.test(ab) && /window\.exploreTeleportTo = function/.test(ex));
  ok("掛機報告只算打怪掉落（killMob／commitWorldLootDrop 期間）", /\['killMob', 'commitWorldLootDrop'\]/.test(ab) && /if \(!_lootDepth\) return;/.test(ab));
  ok("選單有 掛機報告／書籤", /action: 'afkreport'/.test(tabs) && /action: 'bookmark'/.test(tabs) && /js\/54-afk-bookmark\.js/.test(F.html));
  ok("左下 擊殺／EXP/分／金/分 一排不顯示", /#game-screen \.chud-dps \{ display: none !important; \}/.test(rd("css/combat-hud.css")));
  ok("統計併入掛機報告（選單無統計、舊入口與掉落查詢開同一視窗、本圖掉落頁）", !/label: '統計'/.test(tabs) && /if \(t === 'audit' && typeof afkReportOpen === 'function'\) \{ afkReportOpen\(\); return; \}/.test(tabs) && /afkReportOpen\('drops'\)/.test(rd("js/08-items-equip.js")) && /data-view="drops">本圖掉落/.test(ab) && /function auditMapDropRows\(\)/.test(rd("js/05-kill-progression.js")) && /afkReportState\(\)/.test(rd("js/46-combat-hud.js")));
}

section("41) 世界王回原地圖（全服共用、傷害第一拿掉落、經驗依比例）");
{
  const fb = exists("lib/rt-field-boss.js") ? rd("lib/rt-field-boss.js") : "";
  const ws = rd("lib/rt-world-ws.js");
  const mm = rd("lib/rt-map-mobs.js");
  const rw = rd("js/48-realtime-world.js");
  const kp = rd("js/05-kill-progression.js");
  const wm = rd("js/11-world-map.js");
  const sv = rd("_serve.js");
  ok("沒有 wb_ 專屬房（不再建 DB.maps[wb_*]、無 BOSS專區）", !/DB\.maps\[wbMap\]/.test(F.wb) && !/BOSS專區/.test(wm) && !/wbSpawnCenterBoss|wbShouldHost/.test(rd("js/03-combat-core.js")));
  ok("頭目定義帶原地圖固定點（wbBossDefsForMap）＋進圖提報 boss_def", /function wbBossDefsForMap\(mapId\)/.test(F.wb) && /t: 'boss_def'/.test(rw) && /t === "boss_def"/.test(ws));
  ok("伺服器全服一隻：掉落＝傷害第一、expShare 依比例、存 persistFile", /lootKey = top \|\| who/.test(fb) && /expShare\[k\] = total > 0/.test(fb) && /persistFile\("field-bosses\.json"\)/.test(sv));
  ok("跨頻道同步（broadcastMapAll）＋各頻道 snap 帶頭目列", /broadcastMapAll\(mapId, killPack, null\)/.test(ws) && /fieldBoss\.rowsForMap\(room\.mapId\)/.test(mm));
  ok("客戶端：世界王不本地補結算、同次擊殺只結算一次、經驗乘比例", /if \(!mob\._fieldBoss\) try \{/.test(kp) && /_expEach \*= mob\._expShare/.test(kp) && /_bossLooted\[bk\]/.test(rw) && /grantAuthKillExp\(mob \|\| data\.n \|\| '', bossShare\)/.test(rw));
  ok("時刻表含地點欄＋傳送師前往", /<th>地點<\/th>/.test(F.html) && /function wbScheduleHtml\(withGo\)/.test(F.wb) && /wbScheduleHtml\(true\)/.test(wm));
}

section("42) 原版寵物馴服（帶道具、1/3 血以下當場變寵物）");
{
  const pets = rd("js/22-pets.js");
  const kp = rd("js/05-kill-progression.js");
  const iTame = kp.indexOf("petTameOnKill(mob)");
  const iExp = kp.indexOf("let _expEach = mob.exp", iTame);
  ok("killMob 結算獎勵前先判定馴服（馴服＝無經驗／金幣／掉落）", iTame > 0 && iExp > iTame && !/petCaptureOnKill/.test(kp));
  ok("觸發＝背包帶對應道具（不需使用、不靠誘捕狀態）", /function petTameOnKill\(mob\)/.test(pets) && /PET_TAME_ITEM = \{ lure_general: 'item_eye_meat'/.test(pets) && /return false;\s*\}\s*function petUseDragonEgg/.test(pets));
  ok("老虎 1/16（失敗照扣）、保管滿不消耗", /PET_TAME_ODDS = \{ lure_tiger: 16 \}/.test(pets) && /petRoster\(\)\.length >= PET_STORAGE_MAX\) \{\s*if \(Date\.now\(\) - _petTameFullMsgAt/.test(pets));
  ok("自動販賣預設不賣誘捕道具", /if \(d\.eff === 'petlure'\) return \{ sell:false \};/.test(F.tabs));
  ok("出戰魅力含職業加成（妖精 +12、王族等 +6）", /PET_CHA_CLASS_BONUS = \{ royal: 6, mage: 6, dark: 6, dragon: 6, illusion: 6, elf: 12 \}/.test(pets) && /petChaUsed\(\) \+ need > petChaCap\(\)/.test(pets) && /let cha = petChaCap\(\), used = 0/.test(pets));
  ok("寵物叫聲 Lv12/24/36/48＋捕捉指南推薦地點", /const PET_VOICE_LV = \[12, 24, 36, 48\]/.test(pets) && /petVoiceSay\(p\)/.test(pets) && /data-pet-tame-guide/.test(pets) && /推薦捕捉地點/.test(rd("js/26-world-channel.js")));
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
