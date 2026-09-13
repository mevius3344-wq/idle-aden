// ===== 🗺️ v3.8.223 真・2D 正俯視無縫生態地圖＋世界圍牆 =====
// 各地圖依森林／沙漠／地監／海／火等主題套無縫俯視瓦；外圍石牆；場戰可視剔除。
(function () {
    'use strict';

    var CAM_MAX_X = 2200;
    var CAM_MAX_Y = 900;
    var CAM_STEP = 14;
    var TICK_MS = 50;
    var BG_FAR_X = 1.0;
    var BG_FAR_Y = 1.0;
    var BG_MID_X = 1.0;
    var BG_MID_Y = 1.0;
    var TILE_PX = 880;        // 🌿 略放大瓦面，降低草原接縫重複感（原 720）
    var WALL_THICK = 96;
    var VOID_EXT = 520;
    var ENGAGE_PX = 175;      // 含點內 4 怪散開距離，站點心也能交戰
    var APPROACH_WORLD = 340; // 世界座標：靠近練功點即自動朝怪拉近
    var PICKUP_PX = 88;       // 🗺️ 地上掉落撿取距離（需靠近，不可遠距自動入帳）
    var CHASE_PULL = 2.8;
    var CHASE_RANGE = 340;
    var COMBAT_CAM_PULL = 3.6;
    var COMBAT_MOB_PULL = 3.6;
    var LEASH = 190;
    var SIM_PX = 720;         // 🚀 場戰模擬半徑：圈外怪不跑 AI／狀態（省主因卡頓）
    var RENDER_PX = 980;      // 🚀 場戰繪製半徑：只畫鏡頭附近怪
    var EDGE_WARN = 380;      // 提早看到盡頭圍牆接近
    var FIELD_LAYOUT = 'g214';
    var GROUND_Y_DESIGN = 186; // 腳錨設計值（800×450、Q≈78 → (450-78)/2）
    var GROUND_Y_REF_H = 450;  // 設計基準戰場高度
    var DEPTH_MAX = 900;      // 須涵蓋最遠練功點 y

    /** 依目前 #battle-view 高度等比換算腳錨（手機矮框不再把人頂到上方） */
    function exploreGroundYLive() {
        var bv = document.getElementById('battle-view');
        var h = (bv && bv.clientHeight) || GROUND_Y_REF_H;
        if (!(h > 40)) h = GROUND_Y_REF_H;
        return Math.max(28, Math.round(h * (GROUND_Y_DESIGN / GROUND_Y_REF_H)));
    }
    var PACK_PER_SPOT = 4;
    var PORTAL_HOLD_TICKS = 8;
    var _portalBusy = false;
    var _portalHoldL = 0;
    var _portalHoldR = 0;

    // 5×4＝20 點：間距約 1000／420，補正中與南北，避免大片空曠
    var GRIND_SPOTS = [
        { id: 0, x: -2000, y: 630, label: '西北' },
        { id: 1, x: -1000, y: 630, label: '北偏西' },
        { id: 2, x: 0, y: 630, label: '正北' },
        { id: 3, x: 1000, y: 630, label: '北偏東' },
        { id: 4, x: 2000, y: 630, label: '東北' },
        { id: 5, x: -2000, y: 210, label: '西偏北' },
        { id: 6, x: -1000, y: 210, label: '中西北' },
        { id: 7, x: 0, y: 210, label: '中北' },
        { id: 8, x: 1000, y: 210, label: '中東北' },
        { id: 9, x: 2000, y: 210, label: '東偏北' },
        { id: 10, x: -2000, y: -210, label: '西偏南' },
        { id: 11, x: -1000, y: -210, label: '中西南' },
        { id: 12, x: 0, y: -210, label: '中南' },
        { id: 13, x: 1000, y: -210, label: '中東南' },
        { id: 14, x: 2000, y: -210, label: '東偏南' },
        { id: 15, x: -2000, y: -630, label: '西南' },
        { id: 16, x: -1000, y: -630, label: '南偏西' },
        { id: 17, x: 0, y: -630, label: '正南' },
        { id: 18, x: 1000, y: -630, label: '南偏東' },
        { id: 19, x: 2000, y: -630, label: '東南' }
    ];
    var PACK_OFFSETS = [
        { fx: -90, fy: -58 },
        { fx: 90, fy: -48 },
        { fx: -100, fy: 58 },
        { fx: 100, fy: 64 }
    ];
    var FIELD_SLOT_COUNT = GRIND_SPOTS.length * PACK_PER_SPOT;
    var CORRIDOR_BG_WILD = 'assets/area/俯視野外.png';
    var CORRIDOR_BG_DUNGEON = 'assets/area/俯視地監.png';
    var WALKWAY_BG_WILD = 'assets/area/俯視野外.png';
    var WALKWAY_BG_DUNGEON = 'assets/area/俯視地監.png';
    /** 正俯視無縫生態地板（同圖作底，避免異圖雙層拼湊） */
    var TOPDOWN_STYLES = {
        wild:    { floor: 'assets/area/俯視野外.png' },
        dungeon: { floor: 'assets/area/俯視地監.png' },
        desert:  { floor: 'assets/area/俯視沙漠.png' },
        snow:    { floor: 'assets/area/俯視雪原.png' },
        forest:  { floor: 'assets/area/俯視密林.png' },
        lava:    { floor: 'assets/area/俯視熔岩.png' },
        swamp:   { floor: 'assets/area/俯視沼澤.png' },
        crystal: { floor: 'assets/area/俯視水晶.png' },
        coast:   { floor: 'assets/area/俯視海岸.png' },
        tower:   { floor: 'assets/area/俯視高塔.png' }
    };
    var CAM_MAX = CAM_MAX_X;

    var _cx = 0;
    var _cy = 0;
    var _keys = Object.create(null);
    var _vStick = { dx: 0, dy: 0, active: false };
    var _moving = false;
    var _faceD = 5;
    var _facePending = 5;
    var _faceHold = 0;        // 轉向滯後：同一方向連續 tick 才套用，減少斜走抖向
    var _tickTimer = null;
    var _lastMap = '';
    var _walkPhase = 0;
    var _camMoved = false;    // 本 tick 是否因交戰／接近被相機拉動（也算走動）
    var FACE_HOLD_TICKS = 2;  // ≈100ms 穩定後才換向（大轉彎立即換）
    var WALK_PHASE_KEY = 0.72;
    var WALK_PHASE_CAM = 0.48;

    /** 手動精選相鄰＋各分類自動串鏈；場上左右盡頭可傳送 */
    var MAP_PORTAL_LINKS = {
        talking_island: { left: 'town_talking', right: 'talking_island_port' },
        talking_island_port: { left: 'talking_island', right: null },
        silver_knight: { left: 'town_silver_knight', right: 'zone_01' },
        zone_01: { left: 'silver_knight', right: 'elf_forest' },
        elf_forest: { left: 'zone_01', right: 'gludio' },
        gludio: { left: 'elf_forest', right: 'windwood' },
        windwood: { left: 'gludio', right: 'desert' },
        desert: { left: 'windwood', right: 'kent' },
        kent: { left: 'desert', right: 'dragon_valley' },
        dragon_valley: { left: 'kent', right: 'fire_dragon' },
        fire_dragon: { left: 'dragon_valley', right: 'giran' },
        giran: { left: 'town_giran', right: 'heine' },
        heine: { left: 'giran', right: 'twilight_mt' },
        twilight_mt: { left: 'heine', right: 'mirror_forest' },
        mirror_forest: { left: 'twilight_mt', right: 'zone_02' },
        zone_02: { left: 'town_oren', right: 'zone_03' },
        zone_03: { left: 'zone_02', right: 'zone_04' },
        zone_04: { left: 'zone_03', right: 'zone_05' },
        zone_05: { left: 'zone_04', right: 'silent_outer' },
        silent_outer: { left: 'zone_05', right: 'elf_grave' },
        elf_grave: { left: 'silent_outer', right: 'hidden_cave' },
        hidden_cave: { left: 'elf_grave', right: 'giant_tomb' },
        giant_tomb: { left: 'hidden_cave', right: null },
        pirate_wild: { left: 'town_pirate_village', right: 'pirate_dungeon' },
        pirate_dungeon: { left: 'pirate_wild', right: null },
        thebes_desert: { left: 'town_rift', right: 'thebes_pyramid' },
        thebes_pyramid: { left: 'thebes_desert', right: 'thebes_temple' },
        thebes_temple: { left: 'thebes_pyramid', right: null },
        tikal_area: { left: 'town_rift', right: 'tikal_deep' },
        tikal_deep: { left: 'tikal_area', right: 'tikal_altar' },
        tikal_altar: { left: 'tikal_deep', right: null },
        sunrise_castle: { left: 'town_rift', right: 'sunrise_east' },
        sunrise_east: { left: 'sunrise_castle', right: 'sunrise_west' },
        sunrise_west: { left: 'sunrise_east', right: 'sunrise_north' },
        sunrise_north: { left: 'sunrise_west', right: null },
        dream_island: { left: null, right: null },
        antaras_lair: { left: null, right: null },
        fafurion_lair: { left: null, right: null },
        valakas_lair: { left: null, right: null }
    };

    function exploreLinkPortal(cur, left, right) {
        if (!cur) return;
        if (!MAP_PORTAL_LINKS[cur]) MAP_PORTAL_LINKS[cur] = { left: left || null, right: right || null };
        else {
            if (left && !MAP_PORTAL_LINKS[cur].left) MAP_PORTAL_LINKS[cur].left = left;
            if (right && !MAP_PORTAL_LINKS[cur].right) MAP_PORTAL_LINKS[cur].right = right;
        }
    }

    function exploreSameFloorChain(a, b) {
        if (!a || !b) return false;
        var ma = String(a).match(/^(.*?)(\d+)$/);
        var mb = String(b).match(/^(.*?)(\d+)$/);
        if (!ma || !mb || ma[1] !== mb[1]) return false;
        return Math.abs(Number(ma[2]) - Number(mb[2])) === 1;
    }

    function exploreBuildDungeonChains() {
        try {
            if (typeof MAP_CATEGORIES === 'undefined' || !MAP_CATEGORIES.dungeon) return;
            var floors = MAP_CATEGORIES.dungeon.filter(function (m) {
                return m && m.v && !m.needKey && !m.keyHoldReq && !m.questReq && !m.affinityReq;
            });
            for (var i = 0; i < floors.length; i++) {
                var cur = floors[i].v;
                var prev = i > 0 ? floors[i - 1].v : null;
                var next = i < floors.length - 1 ? floors[i + 1].v : null;
                var left = prev && exploreSameFloorChain(cur, prev) ? prev : null;
                var right = next && exploreSameFloorChain(cur, next) ? next : null;
                exploreLinkPortal(cur, left, right);
            }
        } catch (e) {}
    }

    /** 野外清單依序左右串（已手動指定者保留） */
    function exploreBuildWildChains() {
        try {
            if (typeof MAP_CATEGORIES === 'undefined' || !MAP_CATEGORIES.wild) return;
            var list = MAP_CATEGORIES.wild.filter(function (m) { return m && m.v; });
            for (var i = 0; i < list.length; i++) {
                var cur = list[i].v;
                var prev = i > 0 ? list[i - 1].v : null;
                var next = i < list.length - 1 ? list[i + 1].v : null;
                exploreLinkPortal(cur, prev, next);
            }
        } catch (e) {}
    }

    /** 傲慢之塔樓層左右串 */
    function exploreBuildTowerChains() {
        try {
            if (typeof MAP_CATEGORIES === 'undefined' || !MAP_CATEGORIES.tower) return;
            var list = MAP_CATEGORIES.tower.filter(function (m) {
                return m && m.v && String(m.v).indexOf('town_') !== 0;
            });
            for (var i = 0; i < list.length; i++) {
                var cur = list[i].v;
                var prev = i > 0 ? list[i - 1].v : 'town_pride';
                var next = i < list.length - 1 ? list[i + 1].v : null;
                exploreLinkPortal(cur, prev, next);
            }
        } catch (e) {}
    }

    function exploreBuildAllPortalChains() {
        exploreBuildDungeonChains();
        exploreBuildWildChains();
        exploreBuildTowerChains();
    }

    function exploreMapTitle(mapId) {
        try {
            if (typeof MAP_CATEGORIES !== 'undefined') {
                for (var cat in MAP_CATEGORIES) {
                    var list = MAP_CATEGORIES[cat] || [];
                    for (var i = 0; i < list.length; i++) {
                        if (list[i] && list[i].v === mapId) return list[i].t || mapId;
                    }
                }
            }
        } catch (e) {}
        return mapId || '';
    }

    function exploreAllowed() {
        try {
            if (typeof mapState === 'undefined' || !mapState || !mapState.current) return false;
            var id = String(mapState.current);
            if (id.indexOf('town_') === 0) return false;
            if (id === 'training' || id === 'arena_pvp' || id === 'rift_battle') return false;
            if (typeof isWorldBossMap === 'function' && isWorldBossMap(id)) return false;
            if (typeof KING_ROOMS !== 'undefined' && KING_ROOMS && KING_ROOMS[id]) return false;
            if (typeof isSiegeArea === 'function' && isSiegeArea(id)) return false;
            var bv = document.getElementById('battle-view');
            if (!bv || bv.classList.contains('hidden') || !bv.classList.contains('area-fit')) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function exploreWorldActive() { return exploreAllowed(); }
    function explorePlayerDead() {
        try {
            if (typeof player === 'undefined' || !player) return false;
            return !!(player.dead || !(player.hp > 0));
        } catch (e) { return false; }
    }
    function exploreIsMoving() { return !!(exploreAllowed() && _moving && !explorePlayerDead()); }
    function exploreFaceDir() { return _faceD; }
    function exploreWalkPhase() { return _walkPhase; }

    /** 滯後轉向：相鄰方向需連續確認；相差 ≥2 格（約 90°+）立即轉 */
    function exploreSetFaceFromVec(dx, dy) {
        if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) return;
        var nd = exploreVec2Dir(dx, dy);
        if (nd === _faceD) {
            _facePending = nd;
            _faceHold = 0;
            return;
        }
        var diff = Math.min((nd - _faceD + 8) % 8, (_faceD - nd + 8) % 8);
        if (diff >= 2) {
            _faceD = nd;
            _facePending = nd;
            _faceHold = 0;
        } else if (nd === _facePending) {
            _faceHold++;
            if (_faceHold >= FACE_HOLD_TICKS) {
                _faceD = nd;
                _faceHold = 0;
            }
        } else {
            _facePending = nd;
            _faceHold = 1;
        }
        try {
            if (typeof player !== 'undefined' && player) player._faceD = _faceD;
        } catch (e) {}
    }
    function exploreCamX() { return _cx; }
    function exploreCamY() { return _cy; }

    function exploreFieldCombatActive() {
        if (!exploreAllowed()) return false;
        try {
            if (typeof BOSS_BIG_MAPS !== 'undefined' && BOSS_BIG_MAPS.indexOf(mapState.current) >= 0) return false;
        } catch (e) {}
        return true;
    }

    function exploreHashStr(s) {
        var h = 0;
        var str = String(s || '');
        for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    function exploreFieldSlotCount() {
        if (!exploreFieldCombatActive()) return 0;
        return FIELD_SLOT_COUNT;
    }

    /**
     * 場戰進圖：依練功點展開 mobs／spawnAt，並錯開出生時間。
     * 舊制只排 3 格 → 其餘 70+ 格同一 tick 補齊＝出生點錯亂＋瞬間卡頓。
     * @returns {boolean} 是否已套用場戰排程
     */
    function exploreInitFieldSpawns(t0) {
        if (!exploreFieldCombatActive()) return false;
        var n = FIELD_SLOT_COUNT;
        var mobs = new Array(n);
        var spawnAt = new Array(n);
        var base = Math.max(0, Math.floor(Number(t0) || 0));
        for (var i = 0; i < n; i++) {
            mobs[i] = null;
            var spot = Math.floor(i / PACK_PER_SPOT);
            var mem = i % PACK_PER_SPOT;
            var gx = spot % 5;
            var gy = Math.floor(spot / 5);
            // 越靠近地圖中心越早出現；同點 4 隻再微錯開
            var distFromCenter = Math.abs(gx - 2) + Math.abs(gy - 2);
            var delay = 18 + distFromCenter * 10 + mem * 5 + (spot % 3) * 2;
            spawnAt[i] = base + delay;
        }
        mapState.mobs = mobs;
        mapState.spawnAt = spawnAt;
        mapState.targetIdx = -1;
        return true;
    }

    /** 空欄重生延遲微錯開（避免整點同步刷） */
    function exploreRespawnDelayJitter(slot, baseDelay) {
        var d = Math.max(5, Math.floor(Number(baseDelay) || 50));
        var i = Math.max(0, slot | 0);
        return d + (i % PACK_PER_SPOT) * 3 + (Math.floor(i / PACK_PER_SPOT) % 5);
    }

    function exploreCorridorBgUrl() {
        var st = exploreTopdownStyle();
        return (st && st.floor) || CORRIDOR_BG_WILD;
    }

    function exploreWalkwayBgUrl() {
        var st = exploreTopdownStyle();
        return (st && st.floor) || CORRIDOR_BG_WILD;
    }

    /**
     * 地圖 → 正俯視生態（森林／沙漠／地監／海／火 為主軸）
     * 優先看地圖 id 關鍵字，再依分類。
     */
    function exploreBiomeOf(mapId) {
        try {
            var id = String(mapId || '');
            var cat = (typeof mapCategoryOf === 'function') ? mapCategoryOf(id) : '';
            // 🔥 火／熔岩
            if (/fire_dragon|valakas|antaras|dragon_valley|fafurion|lava|immortal_land|hell|balrog/.test(id)) return 'lava';
            // 🌊 海／海岸
            if (/heine|eva_kingdom|pirate_|talking_island_port|sunrise_|fafurion_cave|coast|sea|ocean/.test(id)) return 'coast';
            // 🏜️ 沙漠
            if (/desert|thebes|windwood|tikal_/.test(id)) return 'desert';
            // 🌲 密林（真森林；銀騎士／說話之島周邊改走草原 wild）
            if (/elf_forest|zone_01|mirror_forest|twilight_mt|forest/.test(id)) return 'forest';
            // 🌿 草原／村莊周邊野外
            if (/silver_knight|talking_island$|training|gludio$|kent$|giran$|dream_island|wilderness|grass/.test(id)) return 'wild';
            // ❄️ 雪
            if (id === 'zone_03' || /snow|oren|hyperia/.test(id)) return 'snow';
            // 💎 水晶／闇
            if (/crystal|silent|shadow_temple|dark_magic|necro_training|rastabad/.test(id)) return 'crystal';
            // 🏛️ 高塔
            if (cat === 'tower' || id.indexOf('pride_') === 0 || /ivory|tower/.test(id)) return 'tower';
            // 🏰 地監
            if (cat === 'dungeon' || cat === 'siege' || id.indexOf('dungeon') >= 0 || id.indexOf('_cave') >= 0) return 'dungeon';
            var zm = id.match(/^zone_(\d+)$/);
            if (zm && Number(zm[1]) >= 6) return 'dungeon';
            // 沼澤／濕地
            if (/swamp|marsh/.test(id)) return 'swamp';
            if (cat === 'wild' || cat === 'rift' || cat === 'pirate_island' || cat === 'special') return 'wild';
        } catch (e) {}
        return 'wild';
    }

    function exploreTopdownStyle() {
        var id = '';
        try { id = mapState && mapState.current; } catch (e) {}
        var biome = exploreBiomeOf(id);
        return TOPDOWN_STYLES[biome] || TOPDOWN_STYLES.wild;
    }

    /** 各地圖專屬 1920 場景（完成「其他地圖」辨識度） */
    function exploreMapSceneBgUrl() {
        try {
            var id = mapState && mapState.current;
            if (!id) return '';
            var nm = null;
            if (typeof mapDisplayName === 'function') nm = mapDisplayName(id);
            if (!nm && typeof HIDDEN_AREA_BG !== 'undefined' && HIDDEN_AREA_BG[id]) nm = HIDDEN_AREA_BG[id];
            if (!nm && typeof ANTHARAS_AREA_NAMES !== 'undefined' && ANTHARAS_AREA_NAMES[id]) nm = ANTHARAS_AREA_NAMES[id];
            if (typeof areaBg1920 === 'function') {
                var u = areaBg1920(nm);
                if (u) return u;
            }
            if (typeof SPECIAL_AREA_BG !== 'undefined' && SPECIAL_AREA_BG[id]) {
                var p = SPECIAL_AREA_BG[id];
                if (typeof upgradeAreaPath === 'function') p = upgradeAreaPath(p);
                if (p && String(p).indexOf('assets/') === 0) return p;
            }
        } catch (e) {}
        return '';
    }

    /** 每點連續填滿 4 隻；點有 x/y（俯視網格） */
    function exploreAssignFieldPos(mob, idx) {
        if (!mob || !exploreFieldCombatActive()) return;
        if (mob._fx != null && mob._fy != null && mob._fieldMap === mapState.current && mob._fieldLayout === FIELD_LAYOUT) return;
        var slot = Math.max(0, idx | 0);
        var spot = GRIND_SPOTS[Math.floor(slot / PACK_PER_SPOT) % GRIND_SPOTS.length];
        var member = slot % PACK_PER_SPOT;
        var off = PACK_OFFSETS[member] || PACK_OFFSETS[0];
        var h = exploreHashStr(mob.uid || idx);
        var jx = ((h % 17) - 8) * 2;
        var jy = (((h >> 3) % 9) - 4) * 2;
        mob._grindSpot = spot.id;
        // 出生點夾在可行走範圍內（避免貼牆／掉到虛空）
        var hx = Math.max(-CAM_MAX_X + 120, Math.min(CAM_MAX_X - 120, spot.x + off.fx + jx));
        var hy = Math.max(-CAM_MAX_Y + 80, Math.min(CAM_MAX_Y - 80, (spot.y || 0) + off.fy + jy));
        mob._homeFx = hx;
        mob._homeFy = Math.max(-DEPTH_MAX, Math.min(DEPTH_MAX, hy));
        mob._fx = mob._homeFx;
        mob._fy = mob._homeFy;
        mob._fieldMap = mapState.current;
        mob._fieldLayout = FIELD_LAYOUT;
    }

    /** 腳底：俯視用腳錨＋世界 y（可為負＝偏南） */
    function exploreFieldFootBottom(fy) {
        return exploreGroundYLive() + (Number(fy) || 0);
    }

    function exploreFieldDepthStyle(fy) {
        var t = Math.max(0, Math.min(1, (Math.abs(Number(fy) || 0)) / Math.max(1, DEPTH_MAX)));
        var scale = (1.05 - t * 0.08).toFixed(3);
        var z = String(Math.round(28 - (Number(fy) || 0) * 0.04));
        return {
            transform: 'translateX(-50%) scale(' + scale + ')',
            zIndex: z,
            scale: scale,
            bottom: exploreFieldFootBottom(fy)
        };
    }

    function exploreEnsureAllFieldPos() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return;
        for (var i = 0; i < mapState.mobs.length; i++) {
            if (mapState.mobs[i]) exploreAssignFieldPos(mapState.mobs[i], i);
        }
    }

    function explorePlayerAnchorRect() {
        var el = document.getElementById('player-morph-sprite');
        if (el) return el.getBoundingClientRect();
        var bv = document.getElementById('battle-view');
        if (!bv) return null;
        var r = bv.getBoundingClientRect();
        return { left: r.left + r.width * 0.5 - 20, top: r.top + r.height * 0.5 - 30, width: 40, height: 60 };
    }

    /** 主角與怪物精靈的畫面實際距離（px） */
    function exploreMobScreenDistPx(mob) {
        if (!mob || mob._dead || !(mob.curHp > 0)) return Infinity;
        try {
            var ml = document.getElementById('mob-list');
            var card = ml && ml.querySelector('.mob-target[data-uid="' + mob.uid + '"]');
            var pr = explorePlayerAnchorRect();
            if (card && pr) {
                var mr = card.getBoundingClientRect();
                if (mr.width > 2 && mr.height > 2) {
                    var pcx = pr.left + pr.width / 2;
                    var pcy = pr.top + pr.height * 0.72;
                    var mcx = mr.left + mr.width / 2;
                    var mcy = mr.top + mr.height * 0.72;
                    return Math.hypot(mcx - pcx, mcy - pcy);
                }
            }
        } catch (e) {}
        if (mob._fx == null || mob._fy == null) return Infinity;
        return Math.hypot(mob._fx - _cx, mob._fy - _cy);
    }

    function exploreMobInEngageRange(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob || mob._dead || !(mob.curHp > 0)) return false;
        // 世界座標為準（不受 DOM／transform 干擾）；畫面距離僅作輔助
        if (mob._fx != null) {
            var wd = Math.hypot(mob._fx - _cx, (mob._fy || 0) - _cy);
            if (wd <= ENGAGE_PX) return true;
            if (wd > ENGAGE_PX + 80) return false;
        }
        return exploreMobScreenDistPx(mob) <= ENGAGE_PX;
    }

    /** 場戰：是否在模擬半徑內（AI／狀態／音效觸發） */
    function exploreMobShouldSim(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob) return false;
        return exploreMobScreenDistPx(mob) <= SIM_PX;
    }

    /** 場戰：是否在繪製半徑內（DOM／動畫） */
    function exploreMobShouldRender(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob) return false;
        return exploreMobScreenDistPx(mob) <= RENDER_PX;
    }

    function exploreNearestEngageIdx() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return -1;
        var best = -1, bestD = Infinity;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            if (!exploreMobInEngageRange(m)) continue;
            var d = (m._fx != null)
                ? Math.hypot(m._fx - _cx, (m._fy || 0) - _cy)
                : exploreMobScreenDistPx(m);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    /** 練功點內追逐：靠近點內怪會追；離巢太遠回家；不跨點亂追 */
    function exploreMobChaseTick() {
        if (!exploreFieldCombatActive()) return;
        if (typeof mapState === 'undefined' || !mapState.mobs) return;
        var tgt = null;
        try { tgt = mapState.mobs[mapState.targetIdx]; } catch (e0) {}
        if (tgt && (tgt._dead || !(tgt.curHp > 0))) tgt = null;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            exploreAssignFieldPos(m, i);
            // 🚀 巢穴離鏡頭很遠且未交戰 → 不每 tick 微移（省 80 隻迴圈）
            if (m._homeFx != null) {
                var homeCam = Math.hypot(m._homeFx - _cx, (m._homeFy || 0) - _cy);
                if (homeCam > SIM_PX + 80) continue;
            }
            if (m._homeFx == null) continue;
            var homeDist = Math.hypot(m._fx - m._homeFx, (m._fy || 0) - (m._homeFy || 0));
            var toPlayer = Math.hypot(m._fx - _cx, (m._fy || 0) - _cy);
            var engaged = !!(tgt && m === tgt && exploreMobInEngageRange(m));
            var playerNearHome = Math.hypot(_cx - m._homeFx, _cy - (m._homeFy || 0)) <= CHASE_RANGE;
            var playerNearMob = toPlayer <= CHASE_RANGE;

            // 拴繩：離巢太遠 → 回家
            if (homeDist > LEASH) {
                var hx = m._homeFx - m._fx;
                var hy = (m._homeFy || 0) - (m._fy || 0);
                var hd = Math.hypot(hx, hy) || 1;
                m._fx += (hx / hd) * Math.min(4.2, hd * 0.2);
                m._fy += (hy / hd) * Math.min(2.2, hd * 0.15);
                continue;
            }

            if (!engaged && m.beh === '被動' && m.curHp >= (m.hp || 1)) {
                // 被動閒置：慢慢回巢位（玩家靠近點時仍會在下方改追）
                if (!(playerNearHome || playerNearMob)) {
                    if (homeDist > 4) {
                        m._fx += (m._homeFx - m._fx) * 0.06;
                        m._fy += ((m._homeFy || 0) - (m._fy || 0)) * 0.06;
                    }
                    continue;
                }
            }

            // 玩家不在此練功點附近且未交戰 → 回巢
            if (!engaged && !playerNearHome && !playerNearMob) {
                if (homeDist > 3) {
                    m._fx += (m._homeFx - m._fx) * 0.08;
                    m._fy += ((m._homeFy || 0) - (m._fy || 0)) * 0.08;
                }
                continue;
            }

            // 玩家手動移動中且尚未交戰：仍可小幅靠近（避免永遠追不上）
            var dx = _cx - m._fx;
            var dy = _cy - (m._fy || 0);
            var dist = Math.hypot(dx, dy);
            if (dist < (engaged ? 18 : 16)) continue;
            if (toPlayer > CHASE_RANGE && !engaged && !playerNearHome) continue;
            var pull = engaged ? COMBAT_MOB_PULL : (_moving ? CHASE_PULL * 0.55 : CHASE_PULL);
            var step = Math.min(pull, dist * (engaged ? 0.14 : 0.1));
            var nextFx = m._fx + (dx / dist) * step;
            var nextFy = (m._fy || 0) + (dy / dist) * step * 0.85;
            if (Math.hypot(nextFx - m._homeFx, nextFy - (m._homeFy || 0)) <= LEASH) {
                m._fx = nextFx;
                m._fy = nextFy;
            }
        }
    }

    /** 最近可接近之怪（世界座標）；供靠近練功點自動追怪 */
    function exploreNearestApproachIdx(maxDist) {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return -1;
        var lim = maxDist == null ? APPROACH_WORLD : maxDist;
        var best = -1, bestD = Infinity;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0) || m._fx == null) continue;
            var d = Math.hypot(m._fx - _cx, (m._fy || 0) - _cy);
            if (d <= lim && d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    /** 交戰／靠近追逐：死亡不拉；手動按鍵時不搶控制（勿用 _moving，否則自動走近會自鎖） */
    function exploreCombatCamChaseTick(keyMoving) {
        if (!exploreFieldCombatActive() || keyMoving || explorePlayerDead()) return;
        // AUTO OFF：不自動拉鏡頭追怪（玩家用手搖／鍵盤靠近）
        try {
            if (typeof state !== 'undefined' && state && state.autoHunt === false) return;
        } catch (eA) {}
        if (typeof mapState === 'undefined' || !mapState.mobs) return;
        var t = mapState.mobs[mapState.targetIdx];
        if (!t || t._dead || !(t.curHp > 0) || t._fx == null) t = null;
        var engaged = !!(t && exploreMobInEngageRange(t));
        if (!engaged) {
            var ai = exploreNearestApproachIdx(APPROACH_WORLD);
            if (ai < 0) return;
            t = mapState.mobs[ai];
            if (!t || t._fx == null) return;
            try {
                if (mapState.targetIdx !== ai) {
                    if (typeof setTarget === 'function') setTarget(ai);
                    else mapState.targetIdx = ai;
                }
            } catch (eSet) { mapState.targetIdx = ai; }
        }
        var dx = t._fx - _cx;
        var dy = (t._fy || 0) - _cy;
        var dist = Math.hypot(dx, dy);
        if (dist < 14) return;
        if (!engaged && dist > APPROACH_WORLD) return;
        var pull = engaged ? COMBAT_CAM_PULL : COMBAT_CAM_PULL * 0.9;
        var step = Math.min(pull, dist * (engaged ? 0.08 : 0.1));
        if (dist > 8) {
            _cx += (dx / dist) * step;
            _cy += (dy / dist) * step;
            if (_cx < -CAM_MAX_X) _cx = -CAM_MAX_X;
            if (_cx > CAM_MAX_X) _cx = CAM_MAX_X;
            if (_cy < -CAM_MAX_Y) _cy = -CAM_MAX_Y;
            if (_cy > CAM_MAX_Y) _cy = CAM_MAX_Y;
            _camMoved = true;
            exploreSetFaceFromVec(dx, -dy);
        }
    }

    /** 距離開戰器：鎖最近交戰圈內目標（不改攻速算式） */
    function exploreEngageRetarget() {
        if (!exploreFieldCombatActive()) return;
        exploreEnsureAllFieldPos();
        var idx = exploreNearestEngageIdx();
        if (idx < 0) {
            // 尚未進交戰圈：若已靠近練功點，先鎖最近怪供相機／面向追
            idx = exploreNearestApproachIdx(APPROACH_WORLD);
            if (idx < 0) return;
        }
        try {
            if (mapState.targetIdx !== idx) {
                if (typeof setTarget === 'function') setTarget(idx);
                else mapState.targetIdx = idx;
            }
        } catch (e) {}
    }

    function explorePortalsFor(mapId) {
        var row = MAP_PORTAL_LINKS[mapId] || {};
        return { left: row.left || null, right: row.right || null };
    }

    // 螢幕向量 → 8 向（x 右、y 下；與 _vec2dir 一致）
    function exploreVec2Dir(dx, dy) {
        if (typeof _vec2dir === 'function') return _vec2dir(dx, dy);
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return _faceD;
        var deg = Math.atan2(dy, dx) * 180 / Math.PI;
        if (deg >= -22.5 && deg < 22.5) return 3;
        if (deg >= 22.5 && deg < 67.5) return 4;
        if (deg >= 67.5 && deg < 112.5) return 5;
        if (deg >= 112.5 && deg < 157.5) return 6;
        if (deg >= 157.5 || deg < -157.5) return 7;
        if (deg >= -157.5 && deg < -112.5) return 0;
        if (deg >= -112.5 && deg < -67.5) return 1;
        return 2;
    }

    /** 走道式橫捲：遠／中景 repeat-x，用 background-position 跟相機 */
    function exploreReadBgImage(bv, midEl) {
        var img = '';
        try { img = bv.style.backgroundImage || ''; } catch (e0) {}
        if (!img || img === 'none') {
            try {
                var cs = getComputedStyle(bv);
                img = (cs && cs.backgroundImage) || '';
            } catch (e1) {}
        }
        if ((!img || img === 'none') && midEl) {
            try { img = midEl.style.backgroundImage || ''; } catch (e2) {}
        }
        return (img && img !== 'none') ? img : '';
    }

    function exploreSyncWorldBg(bv, on) {
        if (!bv) return;
        var far = document.getElementById('explore-world-bg-far');
        var mid = document.getElementById('explore-world-bg');
        var atmo = document.getElementById('explore-atmosphere');
        var dust = document.getElementById('explore-dust');
        var mist = document.getElementById('explore-mist');
        var light = document.getElementById('explore-light');
        var ground = document.getElementById('explore-ground');
        var vig = document.getElementById('explore-vignette');
        var biomeCls = ['explore-biome-wild', 'explore-biome-dungeon', 'explore-biome-tower', 'explore-biome-desert', 'explore-biome-snow', 'explore-biome-forest', 'explore-biome-lava', 'explore-biome-swamp', 'explore-biome-crystal', 'explore-biome-coast', 'explore-biome-heat', 'explore-biome-mist', 'explore-biome-cold'];
        if (!on) {
            if (far) {
                far.classList.add('hidden');
                far.classList.remove('is-scenic-far');
            }
            if (mid) {
                mid.classList.add('hidden');
                mid.classList.remove('is-map-scene', 'is-ground-tile', 'is-topdown-floor');
            }
            var blendOff = document.getElementById('explore-world-bg-blend');
            if (blendOff) blendOff.classList.add('hidden');
            var propOff = document.getElementById('explore-prop-layer');
            if (propOff) propOff.classList.add('hidden');
            var boundOff = document.getElementById('explore-bound-layer');
            if (boundOff) boundOff.classList.add('hidden');
            if (atmo) atmo.classList.add('hidden');
            if (dust) dust.classList.add('hidden');
            if (mist) mist.classList.add('hidden');
            if (light) light.classList.add('hidden');
            if (ground) ground.classList.add('hidden');
            if (vig) vig.classList.add('hidden');
            biomeCls.forEach(function (c) { bv.classList.remove(c); });
            bv.classList.remove('explore-bg-scroll', 'is-explore-walking', 'is-explore-combat', 'is-topdown-map', 'portal-ready-left', 'portal-ready-right', 'has-scenic-bg');
            return;
        }
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var biome = exploreBiomeOf(mapId);
        biomeCls.forEach(function (c) { bv.classList.remove(c); });
        bv.classList.add('explore-biome-' + biome);

        // 真・2D 正俯視：只用對應生態的無縫俯視瓦（不用側視 1920）
        bv.classList.add('is-topdown-map');
        bv.classList.remove('has-scenic-bg');
        var floor = exploreCorridorBgUrl();
        var blend = document.getElementById('explore-world-bg-blend');
        var midImg = floor ? ('url("' + floor + '")') : '';
        if (!midImg) midImg = exploreReadBgImage(bv, mid);

        if (midImg) {
            if (far) {
                far.classList.add('hidden');
                far.classList.remove('is-scenic-far');
            }
            if (mid) {
                mid.style.backgroundImage = midImg;
                mid.style.backgroundSize = TILE_PX + 'px ' + TILE_PX + 'px';
                mid.classList.remove('is-ground-tile', 'is-map-scene');
                mid.classList.add('is-topdown-floor');
                mid.classList.remove('hidden');
            }
            if (blend) {
                blend.style.backgroundImage = midImg;
                blend.style.backgroundSize = TILE_PX + 'px ' + TILE_PX + 'px';
                blend.classList.remove('hidden');
            }
            bv.classList.add('explore-bg-scroll');
        } else {
            if (far) {
                far.classList.add('hidden');
                far.classList.remove('is-scenic-far');
            }
            if (mid) {
                mid.classList.add('hidden');
                mid.classList.remove('is-topdown-floor', 'is-map-scene');
            }
            if (blend) blend.classList.add('hidden');
            bv.classList.remove('explore-bg-scroll', 'has-scenic-bg');
        }

        var half = (TILE_PX * 0.5).toFixed(1) + 'px';
        var midX = (-_cx * BG_MID_X).toFixed(1) + 'px';
        var midY = (_cy * BG_MID_Y).toFixed(1) + 'px';
        var blendX = ((-_cx * BG_MID_X) + TILE_PX * 0.5).toFixed(1) + 'px';
        var blendY = ((_cy * BG_MID_Y) + TILE_PX * 0.5).toFixed(1) + 'px';
        if (mid) {
            mid.style.backgroundPosition = midX + ' ' + midY;
            mid.style.transform = 'none';
            mid.style.setProperty('--tile-x', midX);
            mid.style.setProperty('--tile-y', midY);
            mid.style.setProperty('--tile-half', half);
        }
        if (blend) {
            blend.style.backgroundPosition = blendX + ' ' + blendY;
            blend.style.transform = 'none';
        }
        if (ground) ground.classList.add('hidden');
        if (mist) mist.classList.add('hidden');
        if (light) light.classList.add('hidden');
        if (atmo) atmo.classList.remove('hidden');
        if (dust) dust.classList.remove('hidden');
        if (vig) vig.classList.remove('hidden');
        exploreSyncBoundWalls(on);
        exploreSyncProps(on, biome, mapId);
        bv.classList.toggle('is-explore-walking', !!_moving);
        var inCombat = false;
        try {
            var t = mapState.mobs && mapState.mobs[mapState.targetIdx];
            inCombat = !!(t && exploreMobInEngageRange(t));
        } catch (eC) {}
        bv.classList.toggle('is-explore-combat', inCombat);
    }

    /** 🌿 點綴物：石頭／矮樹／灌木／路徑；與怪同世界層（--wx/--wy），避開練功點 */
    var _propCacheKey = '';
    var PROP_CLEAR_R = 220;   // 練功點／出生點淨空半徑（排除打怪異常）
    var PROP_SRC = {
        rock: 'assets/area/props/rock.png?v=' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.251'),
        bush: 'assets/area/props/bush.png?v=' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.251'),
        tree: 'assets/area/props/tree.png?v=' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.251'),
        path: 'assets/area/props/path.png?v=' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.251')
    };
    function explorePropPalette(biome) {
        if (biome === 'desert') return ['rock', 'rock', 'path', 'bush'];
        if (biome === 'snow') return ['rock', 'tree', 'path', 'bush'];
        if (biome === 'lava') return ['rock', 'rock', 'path'];
        if (biome === 'forest') return ['tree', 'tree', 'bush', 'path', 'rock'];
        if (biome === 'coast') return ['rock', 'bush', 'path', 'tree'];
        if (biome === 'swamp') return ['bush', 'bush', 'path', 'rock'];
        if (biome === 'dungeon' || biome === 'tower' || biome === 'crystal') return ['rock', 'rock', 'path'];
        return ['tree', 'bush', 'rock', 'path', 'bush'];
    }
    /** 是否落在練功點／地圖中心交戰淨空區 */
    function explorePropInCombatClear(wx, wy) {
        if (Math.hypot(wx, wy) < PROP_CLEAR_R) return true;
        for (var i = 0; i < GRIND_SPOTS.length; i++) {
            var s = GRIND_SPOTS[i];
            if (Math.hypot(wx - s.x, wy - (s.y || 0)) < PROP_CLEAR_R) return true;
        }
        return false;
    }
    function exploreBuildPropList(mapId, biome) {
        var key = String(mapId || '') + '|' + String(biome || 'wild');
        var seed = exploreHashStr(key) || 1;
        function rnd() {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        }
        var palette = explorePropPalette(biome);
        var list = [];
        // 路徑走練功點「之間」的走廊，不穿越點心
        var pathY = -420 + rnd() * 120;
        if (Math.abs(pathY) < 120) pathY = (pathY < 0 ? -1 : 1) * (140 + rnd() * 80);
        for (var pi = 0; pi < 16; pi++) {
            var px = -CAM_MAX_X + 200 + pi * ((CAM_MAX_X * 2 - 400) / 15);
            var py = pathY + Math.sin(pi * 0.55 + rnd()) * 55 + (rnd() - 0.5) * 30;
            if (explorePropInCombatClear(px, py)) continue;
            list.push({
                kind: 'path',
                wx: Math.max(-CAM_MAX_X + 80, Math.min(CAM_MAX_X - 80, px)),
                wy: Math.max(-CAM_MAX_Y + 60, Math.min(CAM_MAX_Y - 60, py)),
                s: 0.75 + rnd() * 0.55,
                rot: (rnd() - 0.5) * 50,
                z: 1
            });
        }
        var n = biome === 'lava' || biome === 'dungeon' ? 20 : 28;
        var tries = 0;
        while (list.length < n + 16 && tries < n * 8) {
            tries++;
            var kind = palette[Math.floor(rnd() * palette.length)] || 'rock';
            if (kind === 'path') kind = 'rock';
            var wx = (rnd() - 0.5) * CAM_MAX_X * 1.85;
            var wy = (rnd() - 0.5) * CAM_MAX_Y * 1.7;
            if (explorePropInCombatClear(wx, wy)) continue;
            list.push({
                kind: kind,
                wx: Math.max(-CAM_MAX_X + 60, Math.min(CAM_MAX_X - 60, wx)),
                wy: Math.max(-CAM_MAX_Y + 50, Math.min(CAM_MAX_Y - 50, wy)),
                s: (kind === 'tree' ? 0.85 : 0.65) + rnd() * 0.55,
                rot: (rnd() - 0.5) * 24,
                z: kind === 'tree' ? 3 : 2
            });
        }
        return list;
    }
    function exploreSyncProps(on, biome, mapId) {
        var layer = document.getElementById('explore-prop-layer');
        if (!layer) return;
        var show = !!(on && exploreFieldCombatActive());
        layer.classList.toggle('hidden', !show);
        if (!show) {
            if (layer.childNodes.length) layer.innerHTML = '';
            _propCacheKey = '';
            return;
        }
        var gy = exploreGroundYLive();
        var key = String(mapId || '') + '|' + String(biome || 'wild') + '|g' + gy + '|' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '');
        if (_propCacheKey === key && layer.childNodes.length) return;
        _propCacheKey = key;
        var props = exploreBuildPropList(mapId, biome);
        var html = '';
        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            var src = PROP_SRC[p.kind] || PROP_SRC.rock;
            var bot = exploreFieldFootBottom(p.wy);
            html += '<div class="explore-prop explore-prop--' + p.kind + '" style="left:calc(50% + ' + p.wx.toFixed(1) + 'px);bottom:' + bot + 'px;--ps:' + p.s.toFixed(2) + ';--prot:' + p.rot.toFixed(1) + 'deg;z-index:' + p.z + '">' +
                '<img src="' + src + '" alt="" draggable="false"></div>';
        }
        layer.innerHTML = html;
    }

    /** 世界座標外牆＋牆外虛空：走近就看得見，頂死貼牆 */
    function exploreSyncBoundWalls(on) {
        var layer = document.getElementById('explore-bound-layer');
        if (!layer) return;
        var show = !!(on && exploreFieldCombatActive());
        layer.classList.toggle('hidden', !show);
        if (!show) return;
        var w = CAM_MAX_X * 2 + WALL_THICK * 2;
        var h = CAM_MAX_Y * 2 + WALL_THICK * 2;
        var west = document.getElementById('explore-bound-west');
        var east = document.getElementById('explore-bound-east');
        var north = document.getElementById('explore-bound-north');
        var south = document.getElementById('explore-bound-south');
        var voidW = document.getElementById('explore-void-west');
        var voidE = document.getElementById('explore-void-east');
        var voidN = document.getElementById('explore-void-north');
        var voidS = document.getElementById('explore-void-south');
        if (west) {
            west.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK) + 'px)';
            west.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK) + 'px';
            west.style.width = WALL_THICK + 'px';
            west.style.height = h + 'px';
        }
        if (east) {
            east.style.left = 'calc(50% + ' + CAM_MAX_X + 'px)';
            east.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK) + 'px';
            east.style.width = WALL_THICK + 'px';
            east.style.height = h + 'px';
        }
        if (north) {
            north.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK) + 'px)';
            north.style.bottom = (exploreGroundYLive() + CAM_MAX_Y) + 'px';
            north.style.width = w + 'px';
            north.style.height = WALL_THICK + 'px';
        }
        if (south) {
            south.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK) + 'px)';
            south.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK) + 'px';
            south.style.width = w + 'px';
            south.style.height = WALL_THICK + 'px';
        }
        if (voidW) {
            voidW.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK + VOID_EXT) + 'px)';
            voidW.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK - VOID_EXT) + 'px';
            voidW.style.width = VOID_EXT + 'px';
            voidW.style.height = (h + VOID_EXT * 2) + 'px';
        }
        if (voidE) {
            voidE.style.left = 'calc(50% + ' + (CAM_MAX_X + WALL_THICK) + 'px)';
            voidE.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK - VOID_EXT) + 'px';
            voidE.style.width = VOID_EXT + 'px';
            voidE.style.height = (h + VOID_EXT * 2) + 'px';
        }
        if (voidN) {
            voidN.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK + VOID_EXT) + 'px)';
            voidN.style.bottom = (exploreGroundYLive() + CAM_MAX_Y + WALL_THICK) + 'px';
            voidN.style.width = (w + VOID_EXT * 2) + 'px';
            voidN.style.height = VOID_EXT + 'px';
        }
        if (voidS) {
            voidS.style.left = 'calc(50% - ' + (CAM_MAX_X + WALL_THICK + VOID_EXT) + 'px)';
            voidS.style.bottom = (exploreGroundYLive() - CAM_MAX_Y - WALL_THICK - VOID_EXT) + 'px';
            voidS.style.width = (w + VOID_EXT * 2) + 'px';
            voidS.style.height = VOID_EXT + 'px';
        }
    }

    function exploreApplyWorld() {
        var bv = document.getElementById('battle-view');
        if (!bv) return;
        var on = exploreAllowed();
        var wx = -_cx;
        var wy = _cy;
        bv.style.setProperty('--wx', wx.toFixed(1) + 'px');
        bv.style.setProperty('--wy', wy.toFixed(1) + 'px');
        bv.style.setProperty('--cam-x', _cx.toFixed(1));
        bv.style.setProperty('--cam-y', _cy.toFixed(1));
        if (on && bv.classList.contains('has-bg')) {
            bv.style.backgroundPosition = '50% 50%';
        }
        bv.classList.toggle('is-world-scroll', on);
        bv.classList.toggle('is-exploring', on && (Math.abs(_cx) > 1 || Math.abs(_cy) > 1));
        bv.classList.remove('portal-ready-left', 'portal-ready-right');
        exploreSyncWorldBg(bv, on);
        exploreRenderGrindMarks(on);
    }

    function exploreReset(reason) {
        _cx = 0;
        _cy = 0;
        _moving = false;
        _walkPhase = 0;
        _camMoved = false;
        _faceHold = 0;
        exploreApplyWorld();
        exploreRenderHint();
        if (reason === 'map' || reason === 'portal') {
            _lastMap = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
            // 換圖前把地上物吸入背包，避免無故消失
            try { exploreVacuumLoot(true); } catch (eVac) {}
        }
    }

    /** 🗺️ 原子撿取：先標記 claimed，再入帳，同一 DOM／lootUid 不會領兩次 */
    function claimExploreLootEl(el) {
        if (!el || !el.dataset) {
            try { if (el && el.parentNode) el.remove(); } catch (e0) {}
            return false;
        }
        if (el.dataset.claimed === '1') {
            try { el.remove(); } catch (e1) {}
            return false;
        }
        // 裝飾用圖標：只移除
        if (el.dataset.pickable !== '1') {
            try { el.remove(); } catch (e2) {}
            return false;
        }
        el.dataset.claimed = '1';
        el.dataset.pickable = '0';
        var payload = null;
        try { payload = JSON.parse(el.dataset.payload || '{}'); } catch (e3) { payload = null; }
        el.dataset.payload = '';
        try { el.remove(); } catch (e4) {}
        if (!payload || !payload.deferred) return false;
        try {
            if (typeof commitWorldLootDrop === 'function') commitWorldLootDrop(payload);
            return true;
        } catch (e5) {
            return false;
        }
    }

    /** 🗺️ 強制撿取／清空地上掉落；grant=true 時先入帳再清 */
    function exploreVacuumLoot(grant) {
        var layer = document.getElementById('explore-loot-layer');
        if (!layer) return;
        var kids = Array.prototype.slice.call(layer.children);
        for (var i = 0; i < kids.length; i++) {
            var el = kids[i];
            if (!el) continue;
            if (grant) claimExploreLootEl(el);
            else {
                try { el.remove(); } catch (e2) {}
            }
        }
    }

    /** 🗺️ 靠近落地物即撿取（每 tick 最多 8 件） */
    function exploreTryPickupLoot() {
        if (!exploreFieldCombatActive() || explorePlayerDead()) return;
        var layer = document.getElementById('explore-loot-layer');
        if (!layer || !layer.children.length) return;
        var picked = 0;
        for (var i = layer.children.length - 1; i >= 0; i--) {
            var el = layer.children[i];
            if (!el || !el.dataset || el.dataset.pickable !== '1') continue;
            if (el.dataset.claimed === '1') continue;
            if (el.dataset.ready !== '1' && !el.classList.contains('is-landed')) continue;
            var fx = Number(el.dataset.fx) || 0;
            var fy = Number(el.dataset.fy) || 0;
            if (Math.hypot(fx - _cx, fy - _cy) > PICKUP_PX) continue;
            if (claimExploreLootEl(el)) picked++;
            if (picked >= 8) break;
        }
        if (picked > 0) {
            try {
                if (typeof saveGame === 'function') saveGame();
            } catch (eSav) {}
        }
    }

    /** 場上練功點標記（隨世界捲動） */
    function exploreRenderGrindMarks(on) {
        var layer = document.getElementById('explore-grind-layer');
        if (!layer) return;
        var show = !!(on && exploreFieldCombatActive());
        layer.classList.toggle('hidden', !show);
        if (!show) return;
        var kids = layer.querySelectorAll('.explore-grind-mark');
        if (kids.length !== GRIND_SPOTS.length) {
            layer.innerHTML = '';
            for (var i = 0; i < GRIND_SPOTS.length; i++) {
                var s = GRIND_SPOTS[i];
                var el = document.createElement('div');
                el.className = 'explore-grind-mark';
                el.setAttribute('data-spot', String(s.id));
                el.innerHTML = '<span class="explore-grind-dot" aria-hidden="true"></span>';
                layer.appendChild(el);
            }
            kids = layer.querySelectorAll('.explore-grind-mark');
        }
        for (var k = 0; k < kids.length; k++) {
            var spot = GRIND_SPOTS[k];
            if (!spot) continue;
            var near = Math.hypot(_cx - spot.x, _cy - (spot.y || 0)) < 160;
            kids[k].style.left = 'calc(50% + ' + spot.x + 'px)';
            kids[k].style.bottom = (exploreGroundYLive() + (spot.y || 0)) + 'px';
            kids[k].classList.toggle('is-near', near);
        }
    }

    /** 地圖邊界圍牆（不可傳送）— 接近提示、頂死顯示圍牆 */
    function exploreRenderEdges() {
        var layer = document.getElementById('explore-edge-layer');
        if (!layer) return;
        var on = exploreAllowed() && exploreFieldCombatActive();
        layer.classList.toggle('hidden', !on);
        if (!on) {
            var bv0 = document.getElementById('battle-view');
            if (bv0) bv0.classList.remove('at-map-edge', 'near-map-edge', 'edge-w', 'edge-e', 'edge-n', 'edge-s', 'portal-ready-left', 'portal-ready-right', 'map-walled');
            return;
        }
        var w = _cx <= -CAM_MAX_X + EDGE_WARN;
        var e = _cx >= CAM_MAX_X - EDGE_WARN;
        var n = _cy >= CAM_MAX_Y - EDGE_WARN;
        var s = _cy <= -CAM_MAX_Y + EDGE_WARN;
        var atW = _cx <= -CAM_MAX_X + 4;
        var atE = _cx >= CAM_MAX_X - 4;
        var atN = _cy >= CAM_MAX_Y - 4;
        var atS = _cy <= -CAM_MAX_Y + 4;
        function setEdge(id, show, atEnd, nearLabel, endLabel) {
            var el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('hidden', !show);
            el.classList.toggle('is-end', !!atEnd);
            el.classList.toggle('is-near', !!show && !atEnd);
            el.classList.toggle('is-wall', !!atEnd);
            el.textContent = atEnd ? endLabel : nearLabel;
        }
        setEdge('explore-edge-west', w, atW, '← 西牆在前方', '⬛ 已到西邊盡頭');
        setEdge('explore-edge-east', e, atE, '東牆在前方 →', '已到東邊盡頭 ⬛');
        setEdge('explore-edge-north', n, atN, '↑ 北牆在前方', '⬛ 已到北邊盡頭');
        setEdge('explore-edge-south', s, atS, '南牆在前方 ↓', '已到南邊盡頭 ⬛');
        var bv = document.getElementById('battle-view');
        if (bv) {
            bv.classList.toggle('near-map-edge', !!(w || e || n || s));
            bv.classList.toggle('at-map-edge', !!(atW || atE || atN || atS));
            bv.classList.toggle('map-walled', !!(atW || atE || atN || atS));
            bv.classList.toggle('edge-w', atW);
            bv.classList.toggle('edge-e', atE);
            bv.classList.toggle('edge-n', atN);
            bv.classList.toggle('edge-s', atS);
            bv.classList.remove('portal-ready-left', 'portal-ready-right');
        }
    }

    function exploreDoPortal() { return false; }

    function exploreRenderHint() {
        var leftBtn = document.getElementById('explore-portal-left');
        var rightBtn = document.getElementById('explore-portal-right');
        var layer = document.getElementById('explore-exit-layer');
        var hint = document.getElementById('explore-hint');
        if (leftBtn) leftBtn.classList.add('hidden');
        if (rightBtn) rightBtn.classList.add('hidden');
        if (layer) layer.classList.add('hidden');
        // 用戶：戰鬥 2D 畫面上方提示字關閉
        if (hint) {
            hint.classList.add('hidden');
            hint.textContent = '';
        }
    }

    function exploreTryPortal() { return false; }

    function exploreSetVirtualStick(dx, dy, active) {
        _vStick.dx = Number(dx) || 0;
        _vStick.dy = Number(dy) || 0;
        _vStick.active = !!active;
        if (!_vStick.active) {
            _vStick.dx = 0;
            _vStick.dy = 0;
        }
    }

    function exploreReadInput() {
        var l = !!( _keys.ArrowLeft || _keys.a || _keys.A );
        var r = !!( _keys.ArrowRight || _keys.d || _keys.D );
        var u = !!( _keys.ArrowUp || _keys.w || _keys.W );
        var d = !!( _keys.ArrowDown || _keys.s || _keys.S );
        var dx = (r ? 1 : 0) - (l ? 1 : 0);
        var dy = (d ? 1 : 0) - (u ? 1 : 0);
        if (_vStick.active && (Math.abs(_vStick.dx) > 0.01 || Math.abs(_vStick.dy) > 0.01)) {
            dx = _vStick.dx;
            dy = _vStick.dy;
        }
        if (dx && dy) {
            var len = Math.hypot(dx, dy) || 1;
            if (len > 1) { dx /= len; dy /= len; }
        }
        return { dx: dx, dy: dy, left: l || (_vStick.active && _vStick.dx < -0.2), right: r || (_vStick.active && _vStick.dx > 0.2) };
    }

    function exploreTick() {
        if (!exploreAllowed()) {
            if (_moving || document.getElementById('battle-view') && document.getElementById('battle-view').classList.contains('is-world-scroll')) {
                _moving = false;
                exploreApplyWorld();
                exploreRenderHint();
                exploreRenderEdges();
            }
            return;
        }
        var mapId = mapState.current;
        if (mapId !== _lastMap) {
            _lastMap = mapId;
            _cx = 0;
            _cy = 0;
            _walkPhase = 0;
        }
        // 💀 死亡不可移動（清鍵＋停步）
        if (explorePlayerDead()) {
            _keys = Object.create(null);
            _vStick.active = false;
            _vStick.dx = 0;
            _vStick.dy = 0;
            _moving = false;
            _camMoved = false;
            exploreMobChaseTick();
            exploreTryPickupLoot();
            exploreApplyWorld();
            exploreRenderHint();
            exploreRenderEdges();
            exploreApplyFieldDomPos();
            return;
        }
        _camMoved = false;
        var inp = exploreReadInput();
        var keyMoving = !!(inp.dx || inp.dy);
        if (keyMoving) {
            _cx += inp.dx * CAM_STEP;
            _cy += (-inp.dy) * CAM_STEP;
            if (_cx < -CAM_MAX_X) _cx = -CAM_MAX_X;
            if (_cx > CAM_MAX_X) _cx = CAM_MAX_X;
            if (_cy < -CAM_MAX_Y) _cy = -CAM_MAX_Y;
            if (_cy > CAM_MAX_Y) _cy = CAM_MAX_Y;
            _walkPhase += WALK_PHASE_KEY;
            exploreSetFaceFromVec(inp.dx, inp.dy);
        }

        exploreMobChaseTick();
        exploreCombatCamChaseTick(keyMoving);
        // 手動走 或 相機自動拉近：都算走動（播 walk 幀／腳步感）
        if (keyMoving) {
            _moving = true;
        } else if (_camMoved) {
            _moving = true;
            _walkPhase += WALK_PHASE_CAM;
        } else {
            _moving = false;
        }

        exploreTryPickupLoot();
        exploreApplyWorld();
        exploreRenderHint();
        exploreRenderEdges();
        exploreEngageRetarget();
        exploreApplyFieldDomPos();
    }

    /** 把場座標寫進既有怪卡 DOM（追逐微移不必整列 rebuild） */
    function exploreApplyFieldDomPos() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return;
        var ml = document.getElementById('mob-list');
        if (!ml || !ml.classList.contains('is-field-combat')) return;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._fx == null) continue;
            var card = ml.querySelector('.mob-target[data-uid="' + m.uid + '"]');
            if (!card) continue;
            var depth = exploreFieldDepthStyle(m._fy);
            card.style.left = 'calc(50% + ' + Math.round(m._fx) + 'px)';
            card.style.bottom = Math.round(depth.bottom) + 'px';
            card.style.transform = depth.transform;
            card.style.zIndex = depth.zIndex;
            card.classList.toggle('is-engage', exploreMobInEngageRange(m));
        }
    }

    function exploreEnsureUi() {
        var bv = document.getElementById('battle-view');
        if (!bv) return;
        function ensureLayer(id, cls, first) {
            var el = document.getElementById(id);
            if (el) return el;
            el = document.createElement('div');
            el.id = id;
            el.className = cls + ' hidden';
            el.setAttribute('aria-hidden', 'true');
            if (first) bv.insertBefore(el, bv.firstChild);
            else bv.appendChild(el);
            return el;
        }
        ensureLayer('explore-world-bg-far', 'explore-world-bg-far', true);
        ensureLayer('explore-world-bg', 'explore-world-bg', true);
        ensureLayer('explore-world-bg-blend', 'explore-world-bg-blend', true);
        ensureLayer('explore-prop-layer', 'explore-prop-layer', true);
        ensureLayer('explore-atmosphere', 'explore-atmosphere', false);
        ensureLayer('explore-mist', 'explore-mist', false);
        ensureLayer('explore-light', 'explore-light', false);
        ensureLayer('explore-dust', 'explore-dust', false);
        ensureLayer('explore-ground', 'explore-ground', false);
        ensureLayer('explore-vignette', 'explore-vignette', false);
        var bound = ensureLayer('explore-bound-layer', 'explore-bound-layer', false);
        bound.classList.add('explore-bound-layer');
        if (!document.getElementById('explore-bound-west')) {
            ['west', 'east', 'north', 'south'].forEach(function (dir) {
                var voidEl = document.createElement('div');
                voidEl.id = 'explore-void-' + dir;
                voidEl.className = 'explore-void explore-void-' + dir;
                bound.appendChild(voidEl);
                var wallEl = document.createElement('div');
                wallEl.id = 'explore-bound-' + dir;
                wallEl.className = 'explore-bound explore-bound-' + dir;
                bound.appendChild(wallEl);
            });
        }
        var grind = ensureLayer('explore-grind-layer', 'explore-grind-layer', false);
        grind.classList.add('explore-grind-layer');
        var loot = ensureLayer('explore-loot-layer', 'explore-loot-layer', false);
        loot.classList.add('explore-loot-layer');
        loot.classList.remove('hidden');
        var edges = ensureLayer('explore-edge-layer', 'explore-edge-layer', false);
        edges.classList.add('explore-edge-layer');
        if (!document.getElementById('explore-edge-west')) {
            ['west', 'east', 'north', 'south'].forEach(function (dir) {
                var el = document.createElement('div');
                el.id = 'explore-edge-' + dir;
                el.className = 'explore-edge explore-edge-' + dir + ' hidden';
                edges.appendChild(el);
            });
        }
        // 隱藏舊出口 UI（若殘留）
        var layer = document.getElementById('explore-exit-layer');
        if (layer) layer.classList.add('hidden');
        var leftEl = document.getElementById('explore-portal-left');
        var rightEl = document.getElementById('explore-portal-right');
        if (leftEl) leftEl.classList.add('hidden');
        if (rightEl) rightEl.classList.add('hidden');
        if (!document.getElementById('explore-hint')) {
            var hint = document.createElement('div');
            hint.id = 'explore-hint';
            hint.className = 'explore-hint hidden';
            bv.appendChild(hint);
        }
    }

    function exploreOnMapChange() {
        exploreEnsureUi();
        exploreReset('map');
        exploreRenderHint();
    }

    // 探索模式：主角鎖畫面正中央，傭兵簇擁四周
    function explorePartySpritePos() {
        var gy = exploreGroundYLive();
        return {
            P: { x: '50%', b: gy },
            A: [
                { x: '43%', b: gy - 6 },
                { x: '57%', b: gy - 6 },
                { x: '38%', b: gy + 8 },
                { x: '62%', b: gy + 8 },
                { x: '46%', b: gy + 14 },
                { x: '54%', b: gy + 14 },
                { x: '50%', b: gy + 20 }
            ]
        };
    }

    window.exploreSetVirtualStick = exploreSetVirtualStick;
    window.exploreWorldActive = exploreWorldActive;
    window.exploreIsMoving = exploreIsMoving;
    window.exploreFaceDir = exploreFaceDir;
    window.exploreWalkPhase = exploreWalkPhase;
    window.exploreCamX = exploreCamX;
    window.exploreCamY = exploreCamY;
    window.exploreFieldCombatActive = exploreFieldCombatActive;
    window.exploreAssignFieldPos = exploreAssignFieldPos;
    window.exploreEnsureAllFieldPos = exploreEnsureAllFieldPos;
    window.exploreMobScreenDistPx = exploreMobScreenDistPx;
    window.exploreMobInEngageRange = exploreMobInEngageRange;
    window.exploreNearestEngageIdx = exploreNearestEngageIdx;
    window.exploreEngageRetarget = exploreEngageRetarget;
    window.exploreMobShouldSim = exploreMobShouldSim;
    window.exploreMobShouldRender = exploreMobShouldRender;
    window.exploreEngagePx = function () { return ENGAGE_PX; };
    window.exploreTryPortal = exploreTryPortal;
    window.exploreOnMapChange = exploreOnMapChange;
    window.exploreReset = exploreReset;
    window.exploreVacuumLoot = exploreVacuumLoot;
    window.claimExploreLootEl = claimExploreLootEl;
    window.exploreEnsureUi = exploreEnsureUi;
    window.explorePartySpritePos = explorePartySpritePos;
    window.exploreGroundY = exploreGroundYLive;
    window.exploreFieldFootBottom = exploreFieldFootBottom;
    window.exploreFieldDepthStyle = exploreFieldDepthStyle;
    window.exploreGrindSpots = function () { return GRIND_SPOTS.slice(); };
    window.exploreFieldSlotCount = exploreFieldSlotCount;
    window.exploreInitFieldSpawns = exploreInitFieldSpawns;
    window.exploreRespawnDelayJitter = exploreRespawnDelayJitter;
    window.exploreCorridorBgUrl = exploreCorridorBgUrl;
    window.exploreWalkwayBgUrl = exploreWalkwayBgUrl;
    window.exploreBiomeOf = exploreBiomeOf;
    window.exploreTopdownStyle = exploreTopdownStyle;
    window.exploreMapSceneBgUrl = exploreMapSceneBgUrl;
    window.MAP_PORTAL_LINKS = MAP_PORTAL_LINKS;

    document.addEventListener('DOMContentLoaded', function () {
        exploreBuildAllPortalChains();
        exploreEnsureUi();
        exploreRenderHint();
        if (!_tickTimer) _tickTimer = setInterval(exploreTick, TICK_MS);
    });
    // 若腳本晚於 DOMContentLoaded 載入
    if (document.readyState !== 'loading') {
        exploreBuildAllPortalChains();
        exploreEnsureUi();
        if (!_tickTimer) _tickTimer = setInterval(exploreTick, TICK_MS);
    }

    document.addEventListener('keydown', function (e) {
        if (!exploreAllowed()) return;
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        var k = e.key;
        if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown'
            || k === 'a' || k === 'A' || k === 'd' || k === 'D'
            || k === 'w' || k === 'W' || k === 's' || k === 'S') {
            _keys[k] = 1;
            if (k.indexOf('Arrow') === 0) e.preventDefault();
        }
    });
    document.addEventListener('keyup', function (e) {
        delete _keys[e.key];
    });
    window.addEventListener('blur', function () {
        _keys = Object.create(null);
        _moving = false;
    });

    var _hooked = false;
    function exploreHookChangeMap() {
        if (_hooked || typeof changeMap !== 'function') return;
        _hooked = true;
        var orig = changeMap;
        window.changeMap = function () {
            var r = orig.apply(this, arguments);
            try { exploreOnMapChange(); } catch (e) {}
            return r;
        };
    }
    setTimeout(exploreHookChangeMap, 0);
    setTimeout(exploreHookChangeMap, 1500);
})();
