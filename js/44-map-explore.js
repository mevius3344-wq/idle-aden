// ===== 🗺️ v3.8.223 真・2D 正俯視無縫生態地圖＋世界圍牆 =====
// 各地圖依森林／沙漠／地監／海／火等主題套無縫俯視瓦；外圍石牆；場戰可視剔除。
(function () {
    'use strict';

    var CAM_MAX_X_FIELD = 2200;
    var CAM_MAX_Y_FIELD = 900;
    var CAM_MAX_X_SCENIC = 1200; // 🩹 v3.8.376：對齊鳥視圖景固體／海岸，避免圖小於世界＝地圖跑掉
    var CAM_MAX_Y_SCENIC = 800;
    var CAM_MAX_X = CAM_MAX_X_FIELD;
    var CAM_MAX_Y = CAM_MAX_Y_FIELD;
    var CAM_STEP = 24;       // 相容舊常數（距離基準）
    var CAM_LERP = 1.0;
    var CAM_ACCEL = 1.0;     // 未使用（等速走路）
    var CAM_FRICTION = 0;    // 鬆鍵即停，無滑行
    // 🩹 v3.8.409：真地圖鏡頭硬跟人物（死區＝偏離中央）
    var CAM_DEAD_X = 0;
    var CAM_DEAD_Y = 0;
    var CAM_FOLLOW_REAL = 1.0;
    var TICK_MS = 33;
    var BG_FAR_X = 0.22;
    var BG_FAR_Y = 0.08;
    var BG_MID_X = 1.0;
    var BG_MID_Y = 1.0;
    var TILE_PX = 512;
    var WALL_THICK = 96;
    var VOID_EXT = 520;
    // 🩹 v3.8.416：等速真實走路＋明顯步伐（禁站姿滑行感）
    var GRID_PX = 24;          // 仍作距離基準（交戰／閒逛半徑）
    var PLAYER_SPEED = 152; // v3.8.478 人物 px/秒（等速）
    var MOB_SPEED = 38;        // 🩹 v3.8.426：怪閒逛再慢
    var MOB_CHASE_SPEED = 52;  // 🩹 v3.8.426：怪追擊再慢
    var ENGAGE_MELEE = 48;     // 🩹 v3.8.423：對齊九宮格（鄰格含斜角可交戰）
    var ENGAGE_RANGED = GRID_PX * 8;
    var ENGAGE_PX = ENGAGE_MELEE;
    var APPROACH_WORLD = 420;
    var PICKUP_PX = 88;
    var CHASE_PULL = 4.0;
    var MOB_SIGHT = 78;       // 🩹 v3.8.426：主動仇恨視野縮小
    var MOB_SIGHT_PASSIVE = 48; // 被動怪滿血視野更短
    var CHASE_RANGE = 150;     // 追丟距離隨視野略縮
    var COMBAT_CAM_PULL = 1.7;
    var COMBAT_STAND_OFF = 22;
    var COMBAT_MOB_PULL = 1.6;
    var MOB_MELEE_GAP = 32;
    var SURROUND_CELL = 32;    // 🩹 v3.8.423：九宮格邊長（玩家中心、怪佔周圍格）
    var MOB_SEP_R = SURROUND_CELL;
    var MOB_SEP_PUSH = 0.35;
    var MOB_STRIDE = GRID_PX;  // 相容舊常數
    var MOB_STRIDE_MS = 0;     // 關閉舊滑步節奏
    var MOB_WALK_PHASE_K = 1.35;
    var MOB_FACE_STICK_MS = 50;
    var MOB_FACE_TURN_MS = 0;
    var MOB_FACE_CHASE_STICK_MS = 40;
    var MOB_FACE_CHASE_TURN_MS = 0;
    var MOB_MOVE_STICK_MS = 160;
    var MOB_BOB_PX = 4.2;
    var LEASH = 150;
    var WANDER_R = 88;
    var WANDER_STEP = GRID_PX;
    var WANDER_PAUSE_MIN = 900;
    var WANDER_PAUSE_MAX = 2800;
    var FIELD_MARGIN = 48;
    var SIM_PX = 640;          // 遠於此＝簡化 AI／凍結動畫
    var RENDER_PX = 820;       // 進入繪製
    var RENDER_HIDE_PX = 1180; // 離開繪製（滯後＝防邊界閃進出）
    var EDGE_WARN = 380;
    var FIELD_LAYOUT = 'g391';
    // 場戰開啟＝地上怪卡；造型另由 MOB_USE_LEGACY_LINEAGE 決定（舊版天堂圖）
    var FIELD_COMBAT_ENABLED = true;
    var GROUND_Y_DESIGN = 186;
    var GROUND_Y_REF_H = 450;
    var DEPTH_MAX = 900;
    var FOOT_CONTACT_SINK = 34; // 🩹 v3.8.399：腳再沉一點＝貼地（對齊放大後體型）
    var _footSign = 0;
    var _footPlantUntil = 0;

    /** 腳錨：戰場垂直中央（正俯視） */
    function exploreGroundYLive() {
        var bv = document.getElementById('battle-view');
        var h = (bv && bv.clientHeight) || GROUND_Y_REF_H;
        if (!(h > 80)) h = GROUND_Y_REF_H;
        return Math.max(80, Math.round(h * 0.48));
    }
    var PACK_PER_SPOT = 2; // v3.8.478 denser walk space
    var PORTAL_HOLD_TICKS = 8;
    var _portalBusy = false;
    var _portalHoldL = 0;
    var _portalHoldR = 0;

    // 🩹 v3.8.478：3×3＝9 點×2 隻＝18（原 80），走路有空檔
    var GRIND_SPOTS = [
        { id: 0, x: -1600, y: 480, label: '西北' },
        { id: 1, x: 0, y: 480, label: '正北' },
        { id: 2, x: 1600, y: 480, label: '東北' },
        { id: 3, x: -1600, y: 0, label: '正西' },
        { id: 4, x: 0, y: 0, label: '中央' },
        { id: 5, x: 1600, y: 0, label: '正東' },
        { id: 6, x: -1600, y: -480, label: '西南' },
        { id: 7, x: 0, y: -480, label: '正南' },
        { id: 8, x: 1600, y: -480, label: '東南' }
    ];
    var PACK_OFFSETS = [
        { fx: -110, fy: -70 },
        { fx: 110, fy: 78 }
    ];
    var FIELD_SLOT_COUNT = GRIND_SPOTS.length * PACK_PER_SPOT;
    function exploreFloorVer() {
        return (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.360');
    }
    /** CSS / img URL：路徑段含中文時編碼，避免破圖 */
    function exploreAssetUrl(raw) {
        var s = String(raw || '');
        if (!s) return '';
        var q = '';
        var qi = s.indexOf('?');
        if (qi >= 0) {
            q = s.slice(qi);
            s = s.slice(0, qi);
        }
        try {
            s = s.split('/').map(function (seg) {
                if (!seg) return seg;
                try {
                    return encodeURIComponent(decodeURIComponent(seg));
                } catch (e0) {
                    return encodeURIComponent(seg);
                }
            }).join('/');
        } catch (e1) {}
        return s + q;
    }
    function exploreSeamlessFloorUrl(biome) {
        var id = String(biome || 'wild').replace(/[^a-z]/gi, '') || 'wild';
        return 'assets/area/seamless/' + id + '.png?v=' + exploreFloorVer();
    }
    /**
     * 真地圖地板：優先用可走 floor（Teon／手繪俯視），1:1 鎖世界座標＝真實感。
     * scenicFar 留給遠景氛圍，不當壁紙地板。
     * 🩹 v3.9.22：還原「站在地圖上」；不再用 1920 cover 當 mid。
     */
    function exploreMapFloorOverride(mapId) {
        try {
            if (typeof mapdefOf === 'function') {
                var d = mapdefOf(mapId);
                if (d) {
                    var fl = d.floor ? String(d.floor) : '';
                    var scene = d.scenicFar ? String(d.scenicFar) : '';
                    var pick = fl || scene;
                    if (pick) {
                        pick = exploreAssetUrl(pick);
                        return pick + (pick.indexOf('?') >= 0 ? '' : ('?v=' + exploreFloorVer()));
                    }
                }
            }
        } catch (eFl) {}
        return '';
    }
    /** mid 是否為俯視地板圖（非 1920 側視原圖） */
    function exploreMidIsWalkFloor(url) {
        var u = String(url || '');
        if (!u) return false;
        if (/\/1920x1080\//.test(u)) return false;
        return /\/maps\//.test(u) || /_floor\./.test(u) || /\/seamless\//.test(u) || /\.png(\?|$)/i.test(u);
    }
    /** 有專用俯視地板／專屬場景＝鳥視圖景模式（勿把 1920 場景當 seamless 平鋪） */
    function exploreIsScenicMap(mapId) {
        if (exploreMapFloorOverride(mapId)) return true;
        try {
            if (exploreMapSceneBgUrl()) return true;
        } catch (eScn) {}
        try {
            if (typeof mapdefIsReal === 'function' && mapdefIsReal(mapId)) return true;
        } catch (eSc) {}
        return false;
    }
    /** 依地圖刷新可走邊界（真地圖讀 MapDef 放大後 bounds；美術地板仍 1024） */
    function exploreRefreshCamLimits() {
        var mid = '';
        try {
            mid = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        } catch (eMid) {}
        var def = null;
        try {
            if (typeof mapdefOf === 'function') def = mapdefOf(mid);
        } catch (eDef) {}
        if (def && def.real && def.maxX != null && def.maxY != null) {
            var b = null;
            try {
                if (typeof mapdefBounds === 'function') b = mapdefBounds(def);
            } catch (eB) {}
            CAM_MAX_X = b && b.maxX != null ? b.maxX : def.maxX;
            CAM_MAX_Y = b && b.maxY != null ? b.maxY : def.maxY;
        } else {
            var scenic = false;
            try { scenic = exploreIsScenicMap(mid); } catch (eLim) {}
            CAM_MAX_X = scenic ? CAM_MAX_X_SCENIC : CAM_MAX_X_FIELD;
            CAM_MAX_Y = scenic ? CAM_MAX_Y_SCENIC : CAM_MAX_Y_FIELD;
        }
        CAM_MAX = CAM_MAX_X;
        if (_cx < -CAM_MAX_X) _cx = -CAM_MAX_X;
        if (_cx > CAM_MAX_X) _cx = CAM_MAX_X;
        if (_cy < -CAM_MAX_Y) _cy = -CAM_MAX_Y;
        if (_cy > CAM_MAX_Y) _cy = CAM_MAX_Y;
        if (_tx < -CAM_MAX_X) _tx = -CAM_MAX_X;
        if (_tx > CAM_MAX_X) _tx = CAM_MAX_X;
        if (_ty < -CAM_MAX_Y) _ty = -CAM_MAX_Y;
        if (_ty > CAM_MAX_Y) _ty = CAM_MAX_Y;
    }
    function exploreScenicFarUrl(mapId) {
        if (!exploreIsScenicMap(mapId)) return '';
        try {
            if (typeof mapdefOf === 'function') {
                var d = mapdefOf(mapId);
                if (d && d.scenicFar) {
                    var far = exploreAssetUrl(String(d.scenicFar));
                    return far + (far.indexOf('?') >= 0 ? '' : ('?v=' + exploreFloorVer()));
                }
            }
        } catch (eFar) {}
        var sc = '';
        try { sc = exploreMapSceneBgUrl() || ''; } catch (eSc) {}
        if (!sc) sc = 'assets/area/1920x1080/' + encodeURIComponent('說話之島周邊') + '.jpg?v=' + exploreFloorVer();
        else sc = exploreAssetUrl(sc);
        return sc;
    }
    function exploreTopdownStyles() {
        return {
            wild:    { floor: exploreSeamlessFloorUrl('wild') },
            dungeon: { floor: exploreSeamlessFloorUrl('dungeon') },
            desert:  { floor: exploreSeamlessFloorUrl('desert') },
            snow:    { floor: exploreSeamlessFloorUrl('snow') },
            forest:  { floor: exploreSeamlessFloorUrl('forest') },
            lava:    { floor: exploreSeamlessFloorUrl('lava') },
            swamp:   { floor: exploreSeamlessFloorUrl('swamp') },
            crystal: { floor: exploreSeamlessFloorUrl('crystal') },
            coast:   { floor: exploreSeamlessFloorUrl('coast') },
            tower:   { floor: exploreSeamlessFloorUrl('tower') }
        };
    }
    var TOPDOWN_STYLES = exploreTopdownStyles();
    var CORRIDOR_BG_WILD = TOPDOWN_STYLES.wild.floor;
    var CORRIDOR_BG_DUNGEON = TOPDOWN_STYLES.dungeon.floor;
    var WALKWAY_BG_WILD = CORRIDOR_BG_WILD;
    var WALKWAY_BG_DUNGEON = CORRIDOR_BG_DUNGEON;
    var CAM_MAX = CAM_MAX_X;

    var _cx = 0;
    var _cy = 0;
    var _tx = 0;              // 人物世界座標（等速移動）
    var _ty = 0;
    var _keys = Object.create(null);
    var _vStick = { dx: 0, dy: 0, active: false };
    var _tapMove = { active: false, tx: 0, ty: 0 };
    var _vx = 0;
    var _vy = 0;
    var _moving = false;
    var _faceD = 5;
    var _facePending = 5;
    var _faceHold = 0;
    var _tickTimer = null;
    var _tickN = 0;
    var _lastMap = '';
    var _pendingSpawn = null;
    var _walkPhase = 0;
    var _camMoved = false;
    var FACE_HOLD_TICKS = 4;     // 🩹 v3.8.447：相鄰轉向需連續確認（原 1＝搖桿微抖狂換 dN→閃圖）
    var WALK_PHASE_DIST = 0.055; // 🩹 v3.8.447：放慢走路換幀（原 0.12 過快＝閃圖）
    var WALK_PHASE_KEY = 0.22;
    var WALK_PHASE_CAM = 0.1;
    var TAP_ARRIVE = 14;
    var MOB_GAIT_PX = 5;         // 🩹 v3.8.424：怪每走約 5px 換一幀（左右腳）
    var PLAYER_BOB_PX = 5.2;     // 人物踩地起伏（真地圖）
    var PLAYER_BOB_PX_SOFT = 2.4;

    /** 手動精選相鄰＋各分類自動串鏈；場上左右盡頭可傳送 */
    var MAP_PORTAL_LINKS = {
        talking_island: { left: 'town_talking', right: 'talking_island_port' },
        talking_island_port: { left: 'talking_island', right: null },
        zone_13: { left: 'talking_island', right: 'zone_14' },
        zone_14: { left: 'zone_13', right: null },
        zone_06: { left: 'gludio', right: 'zone_07' },
        zone_07: { left: 'zone_06', right: 'zone_08' },
        zone_08: { left: 'zone_07', right: 'zone_09' },
        zone_09: { left: 'zone_08', right: 'zone_10' },
        zone_10: { left: 'zone_09', right: 'zone_11' },
        zone_11: { left: 'zone_10', right: 'zone_12' },
        zone_12: { left: 'zone_11', right: null },
        zone_18: { left: 'giran', right: 'zone_19' },
        zone_19: { left: 'zone_18', right: 'zone_20' },
        zone_20: { left: 'zone_19', right: 'zone_21' },
        zone_21: { left: 'zone_20', right: null },
        zone_22: { left: 'desert', right: 'zone_23' },
        zone_23: { left: 'zone_22', right: 'zone_24' },
        zone_24: { left: 'zone_23', right: 'zone_25' },
        zone_25: { left: 'zone_24', right: null },
        zone_26: { left: 'dragon_valley', right: 'zone_27' },
        zone_27: { left: 'zone_26', right: 'zone_28' },
        zone_28: { left: 'zone_27', right: 'zone_29' },
        zone_29: { left: 'zone_28', right: 'zone_30' },
        zone_30: { left: 'zone_29', right: 'zone_31' },
        zone_31: { left: 'zone_30', right: null },
        zone_15: { left: 'zone_01', right: 'zone_16' },
        zone_16: { left: 'zone_15', right: 'zone_17' },
        zone_17: { left: 'zone_16', right: null },
        crystal_cave1: { left: 'zone_02', right: 'crystal_cave2' },
        crystal_cave2: { left: 'crystal_cave1', right: 'crystal_cave3' },
        crystal_cave3: { left: 'crystal_cave2', right: 'shadow_temple' },
        shadow_temple: { left: 'crystal_cave3', right: null },
        zone_32: { left: 'desert', right: 'zone_33' },
        zone_33: { left: 'zone_32', right: null },
        zone_34: { left: 'heine', right: 'zone_35' },
        zone_35: { left: 'zone_34', right: 'zone_36' },
        zone_36: { left: 'zone_35', right: 'eva_kingdom' },
        eva_kingdom: { left: 'zone_36', right: null },
        zone_37: { left: 'zone_02', right: 'zone_38' },
        zone_38: { left: 'zone_37', right: 'zone_39' },
        zone_39: { left: 'zone_38', right: 'zone_40' },
        zone_40: { left: 'zone_39', right: 'zone_41' },
        zone_41: { left: 'zone_40', right: null },
        rastabad_cave1: { left: 'giant_tomb', right: 'rastabad_cave2' },
        rastabad_cave2: { left: 'rastabad_cave1', right: 'rastabad_cave3' },
        rastabad_cave3: { left: 'rastabad_cave2', right: 'rastabad_gate' },
        rastabad_gate: { left: 'rastabad_cave3', right: 'rastabad_beast' },
        rastabad_beast: { left: 'rastabad_gate', right: 'elder_room' },
        elder_room: { left: 'rastabad_beast', right: null },
        dark_magic_lab: { left: 'rastabad_gate', right: 'demon_temple' },
        demon_temple: { left: 'dark_magic_lab', right: null },
        necro_training: { left: 'rastabad_gate', right: null },
        silver_knight: { left: 'town_silver_knight', right: 'zone_01' },
        zone_01: { left: 'silver_knight', right: 'elf_forest' },
        elf_forest: { left: 'zone_01', right: 'gludio' },
        gludio: { left: 'elf_forest', right: 'windwood' },
        windwood: { left: 'gludio', right: 'desert' },
        desert: { left: 'windwood', right: 'kent' },
        kent: { left: 'desert', right: 'dragon_valley' },
        dragon_valley: { left: 'kent', right: 'fire_dragon' },
        fire_dragon: { left: 'dragon_valley', right: 'giran' },
        giran: { left: 'fire_dragon', right: 'heine' },
        heine: { left: 'giran', right: 'twilight_mt' },
        twilight_mt: { left: 'heine', right: 'mirror_forest' },
        mirror_forest: { left: 'twilight_mt', right: 'zone_02' },
        zone_02: { left: 'mirror_forest', right: 'zone_03' },
        zone_03: { left: 'zone_02', right: 'zone_04' },
        zone_04: { left: 'zone_03', right: 'zone_05' },
        zone_05: { left: 'zone_04', right: 'silent_outer' },
        silent_outer: { left: 'zone_05', right: 'elf_grave' },
        elf_grave: { left: 'silent_outer', right: 'hidden_cave' },
        hidden_cave: { left: 'elf_grave', right: 'giant_tomb' },
        giant_tomb: { left: 'hidden_cave', right: 'rastabad_cave1' },
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
        dream_island: { left: 'twilight_mt', right: null },
        antaras_lair: { left: null, right: null },
        fafurion_lair: { left: null, right: null },
        valakas_lair: { left: null, right: null },
        pride_2_10: { left: 'town_pride', right: 'pride_11_20' },
        pride_11_20: { left: 'pride_2_10', right: 'pride_21_30' },
        pride_21_30: { left: 'pride_11_20', right: 'pride_31_40' },
        pride_31_40: { left: 'pride_21_30', right: 'pride_41_50' },
        pride_41_50: { left: 'pride_31_40', right: 'pride_51_60' },
        pride_51_60: { left: 'pride_41_50', right: 'pride_61_70' },
        pride_61_70: { left: 'pride_51_60', right: 'pride_71_80' },
        pride_71_80: { left: 'pride_61_70', right: 'pride_81_90' },
        pride_81_90: { left: 'pride_71_80', right: 'pride_91_100' },
        pride_91_100: { left: 'pride_81_90', right: null }
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
            // 🩹 v3.8.377：回選角／game-screen 隱藏後不可再跑探索（否則每 66ms 重繪＝頁面卡死）
            var gs = document.getElementById('game-screen');
            if (!gs || gs.classList.contains('hidden')) return false;
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
    /** 🩹 v3.8.383：人物世界座標（真相）；相機 _cx/_cy 只跟隨 */
    function explorePlayerX() { return _tx; }
    function explorePlayerY() { return _ty; }
    function exploreActiveMapDef() {
        try {
            var id = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
            return (typeof mapdefOf === 'function') ? mapdefOf(id) : null;
        } catch (eD) { return null; }
    }
    function exploreIsRealMap(mapId) {
        if (typeof mapdefIsReal === 'function') {
            try { return !!mapdefIsReal(mapId != null ? mapId : ((mapState && mapState.current) || '')); } catch (eR) {}
        }
        return false;
    }
    function exploreActiveGrindSpots() {
        try {
            var id = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
            if (typeof mapdefSpawns === 'function') {
                var sp = mapdefSpawns(id);
                if (sp && sp.length) return sp;
            }
        } catch (eG) {}
        return GRIND_SPOTS;
    }

    function exploreFieldCombatActive() {
        if (!FIELD_COMBAT_ENABLED) return false;
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
        try {
            var spots = exploreActiveGrindSpots();
            if (spots && spots.length) return spots.length * PACK_PER_SPOT;
        } catch (eF) {}
        return FIELD_SLOT_COUNT;
    }

    /**
     * 場戰進圖：依練功點展開 mobs／spawnAt，並錯開出生時間。
     * 舊制只排 3 格 → 其餘 70+ 格同一 tick 補齊＝出生點錯亂＋瞬間卡頓。
     * @returns {boolean} 是否已套用場戰排程
     */
    function exploreInitFieldSpawns(t0) {
        if (!exploreFieldCombatActive()) return false;
        var n = exploreFieldSlotCount();
        if (!(n > 0)) n = FIELD_SLOT_COUNT;
        var mobs = new Array(n);
        var spawnAt = new Array(n);
        var base = Math.max(0, Math.floor(Number(t0) || 0));
        var spots = exploreActiveGrindSpots();
        var spotN = Math.max(1, spots.length);
        for (var i = 0; i < n; i++) {
            mobs[i] = null;
            var spot = Math.floor(i / PACK_PER_SPOT) % spotN;
            var mem = i % PACK_PER_SPOT;
            var distFromCenter = Math.abs(spot % 3 - 1) + Math.floor(spot / 3);
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
        try {
            var mid = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
            var ov = exploreMapFloorOverride(mid);
            if (ov) return ov;
            // 無 MapDef 時仍用專屬 1920，最後才落到共用 seamless
            var sc = exploreMapSceneBgUrl();
            if (sc) return sc + (String(sc).indexOf('?') >= 0 ? '' : ('?v=' + exploreFloorVer()));
        } catch (eOv) {}
        TOPDOWN_STYLES = exploreTopdownStyles();
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
     * 🩹 v3.8.381：海岸洞窟／法利昂洞窟先於熔岩；風木綠洲偏森林
     */
    function exploreBiomeOf(mapId) {
        try {
            var id = String(mapId || '');
            var cat = (typeof mapCategoryOf === 'function') ? mapCategoryOf(id) : '';
            // 🌊 海／海岸（含 *_cave 海系洞穴；須在熔岩關鍵字之前）
            if (/heine|eva_kingdom|pirate_|talking_island_port|sunrise_|fafurion_cave|coast|sea|ocean|port$/.test(id)) return 'coast';
            // 🔥 火／熔岩（不含 fafurion_cave）
            if (/fire_dragon|valakas|antaras|dragon_valley|fafurion$|lava|immortal_land|hell|balrog/.test(id)) return 'lava';
            // 🏜️ 沙漠（風木綠林改 forest）
            if (/desert|thebes|tikal_/.test(id)) return 'desert';
            // 🌲 密林
            if (/elf_forest|zone_01|mirror_forest|twilight_mt|forest|windwood|orcforest/.test(id)) return 'forest';
            // 🌿 草原／村莊周邊野外
            if (/dream_island/.test(id)) return 'mist';
            if (/silver_knight|talking_island$|training|gludio$|kent$|giran$|wilderness|grass/.test(id)) return 'wild';
            // ❄️ 雪
            if (id === 'zone_03' || /snow|oren|hyperia/.test(id)) return 'snow';
            // 💎 水晶／闇
            if (/crystal|silent|shadow_temple|dark_magic|necro_training|rastabad/.test(id)) return 'crystal';
            // 🏛️ 高塔
            if (cat === 'tower' || id.indexOf('pride_') === 0 || /ivory|tower/.test(id)) return 'tower';
            // 沼澤／濕地（先於泛用地監）
            if (/swamp|marsh/.test(id)) return 'swamp';
            // 🏰 地監
            if (cat === 'dungeon' || cat === 'siege' || id.indexOf('dungeon') >= 0 || id.indexOf('_cave') >= 0 || /^zone_1[34]$/.test(id)) return 'dungeon';
            var zm = id.match(/^zone_(\d+)$/);
            if (zm && Number(zm[1]) >= 6) return 'dungeon';
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
        var spots = exploreActiveGrindSpots();
        var def = exploreActiveMapDef();
        var layoutKey = (def && def.layout) ? def.layout : FIELD_LAYOUT;
        if (mob._fx != null && mob._fy != null && mob._fieldMap === mapState.current && mob._fieldLayout === layoutKey) return;
        var slot = Math.max(0, idx | 0);
        var spot = spots[Math.floor(slot / PACK_PER_SPOT) % spots.length];
        var member = slot % PACK_PER_SPOT;
        var off = PACK_OFFSETS[member] || PACK_OFFSETS[0];
        var h = exploreHashStr(mob.uid || idx);
        var jx = ((h % 17) - 8) * 2;
        var jy = (((h >> 3) % 9) - 4) * 2;
        mob._grindSpot = spot.id;
        mob._packMem = member;
        // 出生點夾在可行走範圍內（避免貼牆／掉到虛空）
        var hx = Math.max(-CAM_MAX_X + 120, Math.min(CAM_MAX_X - 120, spot.x + off.fx + jx));
        var hy = Math.max(-CAM_MAX_Y + 80, Math.min(CAM_MAX_Y - 80, (spot.y || 0) + off.fy + jy));
        if (def && typeof mapdefResolveMove === 'function') {
            var fixed = mapdefResolveMove(def, 0, 0, hx, hy);
            hx = fixed.x;
            hy = fixed.y;
            if (!mapdefWalkable(def, hx, hy)) {
                hx = spot.x;
                hy = spot.y || 0;
            }
        }
        mob._homeFx = hx;
        mob._homeFy = Math.max(-DEPTH_MAX, Math.min(DEPTH_MAX, hy));
        mob._fx = mob._homeFx;
        mob._fy = mob._homeFy;
        mob._gridFx = mob._fx;
        mob._gridFy = mob._fy;
        mob._slideStart = 0;
        mob._fieldMap = mapState.current;
        mob._fieldLayout = layoutKey;
        try { if (typeof rtWorldSeedMob === 'function') rtWorldSeedMob(mob); } catch (eSeed) {}
    }

    /** 🩹 v3.8.423：九宮格包圍偏移（ring1＝8 格；溢出進外圈） */
    var SURROUND_RING1 = [
        { ox: -1, oy: -1 }, { ox: 0, oy: -1 }, { ox: 1, oy: -1 },
        { ox: -1, oy: 0 },                     { ox: 1, oy: 0 },
        { ox: -1, oy: 1 },  { ox: 0, oy: 1 },  { ox: 1, oy: 1 }
    ];
    function exploreSurroundCellCenter(ox, oy) {
        var cell = SURROUND_CELL;
        var pcx = Math.round(_tx / cell) * cell;
        var pcy = Math.round(_ty / cell) * cell;
        return { x: pcx + ox * cell, y: pcy + oy * cell };
    }
    function exploreBuildSurroundSlots(need) {
        var out = [];
        var i, ox, oy, ring, maxR;
        for (i = 0; i < SURROUND_RING1.length; i++) out.push(SURROUND_RING1[i]);
        maxR = 4;
        for (ring = 2; out.length < need && ring <= maxR; ring++) {
            for (oy = -ring; oy <= ring; oy++) {
                for (ox = -ring; ox <= ring; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
                    out.push({ ox: ox, oy: oy });
                }
            }
        }
        return out;
    }
    /** 追擊／交戰怪各佔一格：玩家中心，周圍九宮格包圍 */
    function exploreAssignSurroundSlots() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return;
        var list = mapState.mobs;
        var candidates = [];
        var i, m, d;
        for (i = 0; i < list.length; i++) {
            m = list[i];
            if (!m || m._dead || !(m.curHp > 0) || m._fx == null) continue;
            d = Math.hypot(m._fx - _tx, (m._fy || 0) - _ty);
            if (d > CHASE_RANGE + 40) {
                m._surOx = null;
                m._surOy = null;
                m._surGx = null;
                m._surGy = null;
                continue;
            }
            if (!(m._aggro || (mapState.targetIdx === i) || d <= MOB_SIGHT)) {
                m._surOx = null;
                m._surOy = null;
                m._surGx = null;
                m._surGy = null;
                continue;
            }
            candidates.push(m);
        }
        if (!candidates.length) return;
        candidates.sort(function (a, b) {
            var da = Math.hypot((a._fx || 0) - _tx, (a._fy || 0) - _ty);
            var db = Math.hypot((b._fx || 0) - _tx, (b._fy || 0) - _ty);
            if (da !== db) return da - db;
            return String(a.uid || '').localeCompare(String(b.uid || ''));
        });
        var slots = exploreBuildSurroundSlots(candidates.length);
        var taken = {};
        for (i = 0; i < candidates.length; i++) {
            m = candidates[i];
            var best = -1;
            var bestD = Infinity;
            var si, sl, cen, dd, key;
            // 已佔格仍空閒 → 黏住（防每 tick 換位晃）
            if (m._surOx != null && m._surOy != null) {
                key = m._surOx + ',' + m._surOy;
                if (!taken[key]) {
                    taken[key] = true;
                    cen = exploreSurroundCellCenter(m._surOx, m._surOy);
                    m._surGx = cen.x;
                    m._surGy = cen.y;
                    continue;
                }
            }
            for (si = 0; si < slots.length; si++) {
                sl = slots[si];
                key = sl.ox + ',' + sl.oy;
                if (taken[key]) continue;
                cen = exploreSurroundCellCenter(sl.ox, sl.oy);
                dd = Math.hypot((m._fx || 0) - cen.x, (m._fy || 0) - cen.y);
                if (dd < bestD) {
                    bestD = dd;
                    best = si;
                }
            }
            if (best < 0) {
                m._surOx = null;
                m._surOy = null;
                m._surGx = null;
                m._surGy = null;
                continue;
            }
            sl = slots[best];
            taken[sl.ox + ',' + sl.oy] = true;
            m._surOx = sl.ox;
            m._surOy = sl.oy;
            cen = exploreSurroundCellCenter(sl.ox, sl.oy);
            m._surGx = cen.x;
            m._surGy = cen.y;
        }
    }
    function exploreMobOrbitGoal(m, radius) {
        if (m && m._surGx != null && m._surGy != null) {
            return { x: m._surGx, y: m._surGy };
        }
        var r = Math.max(SURROUND_CELL, Number(radius) || MOB_MELEE_GAP);
        var dx = (m._fx || 0) - _tx;
        var dy = (m._fy || 0) - _ty;
        var toP = Math.hypot(dx, dy) || 1;
        return {
            x: _tx + (dx / toP) * r,
            y: _ty + (dy / toP) * r
        };
    }

    /** 🩹 v3.8.423：同格／過近必推開（一格一怪） */
    function exploreMobSeparateTick() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return;
        var list = mapState.mobs;
        var n = list.length;
        var hard = SURROUND_CELL * 0.92;
        var hard2 = hard * hard;
        for (var i = 0; i < n; i++) {
            var a = list[i];
            if (!a || a._dead || !(a.curHp > 0) || a._fx == null) continue;
            var aToP = Math.hypot(a._fx - _tx, (a._fy || 0) - _ty);
            if (aToP > 360) continue;
            for (var j = i + 1; j < n; j++) {
                var b = list[j];
                if (!b || b._dead || !(b.curHp > 0) || b._fx == null) continue;
                var bToP = Math.hypot(b._fx - _tx, (b._fy || 0) - _ty);
                if (bToP > 360) continue;
                var dx = a._fx - b._fx;
                var dy = (a._fy || 0) - (b._fy || 0);
                var d2 = dx * dx + dy * dy;
                if (d2 >= hard2) continue;
                var d = Math.sqrt(Math.max(d2, 0.0001));
                var nx = dx / d;
                var ny = dy / d;
                if (d2 < 0.25) {
                    var h = ((String(a.uid || i).charCodeAt(0) || 1) + (String(b.uid || j).charCodeAt(0) || 2)) % 628 / 100;
                    nx = Math.cos(h);
                    ny = Math.sin(h);
                    d = 0.5;
                }
                var push = (hard - d) * MOB_SEP_PUSH;
                if (push < 0.8) push = 0.8;
                if (push > 14) push = 14;
                var ax = nx * push * 0.5;
                var ay = ny * push * 0.5;
                a._fx += ax;
                a._fy = (a._fy || 0) + ay;
                b._fx -= ax;
                b._fy = (b._fy || 0) - ay;
                a._gridFx = a._fx;
                a._gridFy = a._fy;
                b._gridFx = b._fx;
                b._gridFy = b._fy;
                // v3.9.18 mob clamp：互推後夾回可走區
                try {
                    var defSep = exploreActiveMapDef();
                    if (defSep && typeof mapdefResolveMove === 'function') {
                        var ra = mapdefResolveMove(defSep, a._fx, a._fy, a._fx, a._fy);
                        var rb = mapdefResolveMove(defSep, b._fx, b._fy, b._fx, b._fy);
                        var pa = explorePushSolidList(ra.x, ra.y);
                        var pb = explorePushSolidList(rb.x, rb.y);
                        a._fx = a._gridFx = pa.x; a._fy = a._gridFy = pa.y;
                        b._fx = b._gridFx = pb.x; b._fy = b._gridFy = pb.y;
                    }
                } catch (eClamp) {}
            }
        }
    }

    /** 腳底：腳錨＋世界 y − 接觸沉入 */
    function exploreFieldFootBottom(fy) {
        return exploreGroundYLive() + (Number(fy) || 0) - FOOT_CONTACT_SINK;
    }
    function exploreMobScreenBottom(fy) {
        return exploreGroundYLive() + (Number(fy) || 0) - _cy - FOOT_CONTACT_SINK;
    }
    function exploreFieldScreenX(fx) {
        return (Number(fx) || 0) - _cx;
    }
    function explorePlayerDepthZ() {
        // 🩹 v3.8.383：依人物世界 Y 景深（腳底越南越高）
        return Math.max(30, Math.min(90, Math.round(50 - _ty * 0.06)));
    }

    function explorePlayerScreenX() {
        // 🩹 v3.8.396：亞像素＝避免整數格跳
        return (Number(_tx) || 0) - (Number(_cx) || 0);
    }
    /** 🩹 v3.8.446：取消 HUD 鏡頭右偏（v3.8.444 過度補正→人物跑到右邊）；置中改只靠本體實際寬 */
    function exploreViewCenterBiasX() {
        return 0;
    }
    function explorePlayerScreenBottom() {
        return exploreMobScreenBottom(_ty);
    }

    function exploreFieldDepthStyle(fy) {
        var worldY = Number(fy) || 0;
        // 與人物同一套腳底 Y 排序
        var z = Math.max(16, Math.min(92, Math.round(50 - worldY * 0.06)));
        return {
            transform: 'translateX(-50%)',
            zIndex: String(z),
            scale: '1',
            bottom: exploreMobScreenBottom(fy),
            screenX: 0
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
        return Math.hypot(mob._fx - _tx, mob._fy - _ty);
    }

    function exploreEngageLimit() {
        try {
            if (typeof isRangedArmed === 'function' && typeof player !== 'undefined' && isRangedArmed(player)) {
                return ENGAGE_RANGED;
            }
        } catch (eR) {}
        return ENGAGE_MELEE;
    }

    function exploreMobWorldDist(mob) {
        if (!mob || mob._fx == null) return Infinity;
        return Math.hypot(mob._fx - _tx, (mob._fy || 0) - _ty);
    }

    function exploreMobInEngageRange(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob || mob._dead || !(mob.curHp > 0)) return false;
        // 🩹 v3.8.403：世界腳距 strictly；近戰須貼近
        if (mob._fx == null) return false;
        return exploreMobWorldDist(mob) <= exploreEngageLimit();
    }

    /** 場戰：是否在模擬半徑內（AI／狀態／音效觸發） */
    function exploreMobShouldSim(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob) return false;
        return exploreMobWorldDist(mob) <= SIM_PX;
    }

    /** 場戰：繪製滯後——進 RENDER_PX、出 RENDER_HIDE_PX，避免邊界閃進出 */
    function exploreMobShouldRender(mob) {
        if (!exploreFieldCombatActive()) return true;
        if (!mob) return false;
        var d = exploreMobWorldDist(mob);
        if (mob._renderOn) {
            if (d > RENDER_HIDE_PX) {
                mob._renderOn = false;
                return false;
            }
            return true;
        }
        if (d <= RENDER_PX) {
            mob._renderOn = true;
            return true;
        }
        return false;
    }

    function exploreNearestEngageIdx() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return -1;
        var best = -1, bestD = Infinity;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            if (!exploreMobInEngageRange(m)) continue;
            var d = (m._fx != null)
                ? Math.hypot(m._fx - _tx, (m._fy || 0) - _ty)
                : exploreMobScreenDistPx(m);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    /** 🩹 v3.8.417：追擊也黏滯面向（即時換 dN＝影子圖重載＝黑影跳） */
    function exploreMobSetMoveFace(m, mdx, mdy, now, chase) {
        if (!m || typeof _vec2dir !== 'function') return;
        if (!(Math.abs(mdx) > 0.12 || Math.abs(mdy) > 0.12)) return;
        try {
            var nd = _vec2dir(mdx, -mdy);
            m._fvx = mdx;
            m._fvy = mdy;
            var od = (m._moveFace8 != null) ? m._moveFace8 : m._face8;
            var dlt = (od == null) ? 99 : Math.min((nd - od + 8) % 8, (od - nd + 8) % 8);
            var age = (m._faceStickAt != null) ? (now - m._faceStickAt) : 9999;
            var need = chase
                ? ((dlt >= 2) ? MOB_FACE_CHASE_TURN_MS : MOB_FACE_CHASE_STICK_MS)
                : ((dlt >= 2) ? MOB_FACE_TURN_MS : MOB_FACE_STICK_MS);
            if (od == null || (dlt > 0 && age >= need)) {
                m._moveFace8 = nd;
                m._face8 = nd;
                m._faceStickAt = now;
            } else {
                m._moveFace8 = od;
            }
        } catch (eF) {}
    }
    function exploreMobMarkWalking(m, until) {
        if (!m) return;
        m._animMoving = true;
        m._moveStickUntil = Math.max(Number(m._moveStickUntil) || 0, until || (Date.now() + MOB_MOVE_STICK_MS));
    }

    /** 🩹 v3.8.417：位移換幀保留；影子幾乎定住（禁黑影狂跳） */
    function exploreMobAdvanceWalkFeel(m, distMoved, now) {
        if (!m || !(distMoved > 0.05)) return;
        m._lastStrideAt = now;
        var add = (distMoved / Math.max(4, MOB_GAIT_PX)) * MOB_WALK_PHASE_K;
        m._walkPhase = (Number(m._walkPhase) || 0) + add;
        var wave = Math.sin(m._walkPhase * Math.PI);
        m._mobBob = wave * MOB_BOB_PX;
        var plant = Math.max(0, -wave);
        m._mobPlant = Math.min(1, plant * 0.85);
        // 接觸影幾乎恆定（僅微調），避免 scale/opacity 跳動
        m._mobShadow = 0.94 + plant * 0.04;
        var prev = Number(m._walkSign) || 0;
        var crossed = (prev <= 0 && wave > 0.4) || (prev >= 0 && wave < -0.4);
        m._walkSign = wave;
        if (crossed && (!m._nextPuffAt || now >= m._nextPuffAt)) {
            m._nextPuffAt = now + 180;
            if (Math.hypot(m._fx - _tx, (m._fy || 0) - _ty) < 420) {
                try { exploreSpawnMobGrassPuff(m); } catch (eP) {}
            }
        }
    }

    /** 步間／黏滯期間也推進腳步相位（否則只瞬移＝飄） */
    function exploreMobTickWalkAnim(m, now) {
        if (!m || !m._animMoving) return;
        var prev = Number(m._walkFeelAt) || now;
        var dt = Math.max(0, Math.min(80, now - prev));
        m._walkFeelAt = now;
        if (dt < 1) return;
        exploreMobAdvanceWalkFeel(m, (dt / 1000) * MOB_SPEED, now);
    }

    function exploreSpawnMobGrassPuff(m) {
        var bv = document.getElementById('battle-view');
        if (!bv || !m || m._fx == null) return;
        var sx = exploreFieldScreenX(m._fx);
        var sy = exploreMobScreenBottom(m._fy);
        for (var i = 0; i < 2; i++) {
            var el = document.createElement('span');
            el.className = 'explore-grass-puff' + (i === 1 ? ' is-dust' : '');
            var ang = (Math.random() - 0.5) * 1.5;
            var dist = 8 + Math.random() * 14;
            el.style.setProperty('--gx', (Math.cos(ang) * dist).toFixed(1) + 'px');
            el.style.setProperty('--gy', (-6 - Math.random() * 12).toFixed(1) + 'px');
            el.style.bottom = (sy + (Math.random() * 3 - 1)) + 'px';
            el.style.left = 'calc(50% + ' + (sx + (Math.random() - 0.5) * 16).toFixed(1) + 'px)';
            el.style.marginLeft = '0';
            bv.appendChild(el);
            setTimeout(function (node) {
                try { if (node && node.parentNode) node.parentNode.removeChild(node); } catch (eR) {}
            }, 560, el);
        }
    }

    /** 🩹 v3.8.393：巢穴內隨機閒逛目標（含 MapDef 可行走） */
    function exploreMobPickWanderGoal(m, now) {
        if (!m || m._homeFx == null) return;
        var seed = exploreHashStr(String(m.uid || '') + ':' + String(now | 0) + ':' + String((m._wandN || 0)));
        m._wandN = (m._wandN || 0) + 1;
        var ang = (seed % 6283) / 1000;
        var rad = 36 + (seed % Math.max(20, WANDER_R - 36));
        var wx = m._homeFx + Math.cos(ang) * rad;
        var wy = (m._homeFy || 0) + Math.sin(ang) * rad * 0.88;
        var def = exploreActiveMapDef();
        if (def && typeof mapdefResolveMove === 'function') {
            var fixed = mapdefResolveMove(def, m._homeFx, m._homeFy || 0, wx, wy);
            wx = fixed.x;
            wy = fixed.y;
        }
        var dx = wx - m._homeFx;
        var dy = wy - (m._homeFy || 0);
        var d = Math.hypot(dx, dy);
        if (d > WANDER_R) {
            wx = m._homeFx + (dx / d) * WANDER_R;
            wy = (m._homeFy || 0) + (dy / d) * WANDER_R;
        }
        m._wandFx = wx;
        m._wandFy = wy;
        m._wandMode = 'go';
        m._wandPauseUntil = 0;
    }

    /** 巢穴閒逛：走一小段→停→張望→再走（沒人追時有生命感） */
    function exploreMobWanderTick(m, now) {
        if (!m || m._homeFx == null) return;
        if (!m._wandMode || m._wandFx == null) {
            exploreMobPickWanderGoal(m, now);
        }
        if (m._wandMode === 'pause') {
            if (now >= (m._wandPauseUntil || 0)) {
                exploreMobPickWanderGoal(m, now);
            } else {
                // 停駐時偶發轉頭
                if (!m._fidgetAt || now >= m._fidgetAt) {
                    m._fidgetAt = now + 800 + (exploreHashStr(String(m.uid) + now) % 1400);
                    var fa = ((exploreHashStr(String(m.uid) + ':' + m._fidgetAt) % 628) / 100);
                    exploreMobSetMoveFace(m, Math.cos(fa) * 8, Math.sin(fa) * 8, now);
                }
                m._mobBob = 0;
                m._mobPlant = 0;
                m._mobShadow = 1;
            }
            return;
        }
        var dx = m._wandFx - m._fx;
        var dy = m._wandFy - (m._fy || 0);
        var dist = Math.hypot(dx, dy);
        if (dist < 14) {
            m._wandMode = 'pause';
            var hold = WANDER_PAUSE_MIN + (exploreHashStr(String(m.uid) + ':' + now) % (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN));
            m._wandPauseUntil = now + hold;
            m._mobBob = 0;
            m._mobPlant = 0;
            m._mobShadow = 1;
            return;
        }
        var moved = exploreMobWalkStep(m, dx, dy, MOB_SPEED);
        if (moved < 0.05) {
            exploreMobPickWanderGoal(m, now);
            return;
        }
        if (Math.hypot((m._fx || 0) - m._homeFx, (m._fy || 0) - (m._homeFy || 0)) > WANDER_R + 24) {
            exploreMobPickWanderGoal(m, now);
            return;
        }
        exploreMobMarkWalking(m, now + MOB_MOVE_STICK_MS);
        exploreMobSetMoveFace(m, dx, dy, now);
    }

    /** 練功點內追逐：靠近點內怪會追；離巢太遠回家；不跨點亂追 */
    function exploreMobChaseTick() {
        if (!exploreFieldCombatActive()) return;
        if (typeof mapState === 'undefined' || !mapState.mobs) return;
        try { exploreAssignSurroundSlots(); } catch (eAs) {}
        var tgt = null;
        try { tgt = mapState.mobs[mapState.targetIdx]; } catch (e0) {}
        if (tgt && (tgt._dead || !(tgt.curHp > 0))) tgt = null;
        var now = Date.now();
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0)) continue;
            // 移動旗標黏滯：停走邊界不狂切 walk/idle
            m._animMoving = !!(m._moveStickUntil && now < m._moveStickUntil);
            if (m._animMoving) {
                try { exploreMobTickWalkAnim(m, now); } catch (eTw) {}
            }
            exploreAssignFieldPos(m, i);
            // 🚀 巢穴離鏡頭很遠且未交戰 → 不每 tick 微移（省 80 隻迴圈）
            if (m._homeFx != null) {
                var homeCam = Math.hypot(m._homeFx - _tx, (m._homeFy || 0) - _ty);
                if (homeCam > SIM_PX + 80) {
                    m._animMoving = false;
                    m._moveStickUntil = 0;
                    m._mobBob = 0;
                    continue;
                }
            }
            if (m._homeFx == null) continue;
            var homeDist = Math.hypot((m._fx || 0) - m._homeFx, (m._fy || 0) - (m._homeFy || 0));
            var toPlayer = Math.hypot(m._fx - _tx, (m._fy || 0) - _ty);
            var engaged = !!(tgt && m === tgt && exploreMobInEngageRange(m));

            // 拴繩：離巢太遠 → 回家
            if (homeDist > LEASH) {
                m._aggro = false;
                var hx = m._homeFx - (m._fx || 0);
                var hy = (m._homeFy || 0) - (m._fy || 0);
                if (Math.hypot(hx, hy) > 2) {
                    exploreMobWalkStep(m, hx, hy, MOB_CHASE_SPEED);
                    exploreMobMarkWalking(m, now + MOB_MOVE_STICK_MS);
                    exploreMobSetMoveFace(m, hx, hy, now, true);
                }
                m._wandMode = null;
                continue;
            }

            // 🩹 v3.8.407／415：視野＝離本體夠近才進仇恨
            var wantChase = !!engaged;
            var passiveFull = (m.beh === '被動' && m.curHp >= (m.hp || 1));
            var sight = passiveFull ? MOB_SIGHT_PASSIVE : MOB_SIGHT;
            if (m._aggro) {
                if (toPlayer > CHASE_RANGE) m._aggro = false;
                else wantChase = true;
            }
            if (!wantChase && toPlayer <= sight) {
                m._aggro = true;
                wantChase = true;
            }
            if (engaged) m._aggro = true;

            if (!wantChase) {
                exploreMobWanderTick(m, now);
                continue;
            }
            m._wandMode = null;

            var goal = exploreMobOrbitGoal(m, engaged ? MOB_MELEE_GAP : Math.max(MOB_MELEE_GAP + 6, ENGAGE_PX * 0.6));
            var dx = goal.x - (m._fx || 0);
            var dy = goal.y - (m._fy || 0);
            var dist = Math.hypot(dx, dy);
            var stopAt = SURROUND_CELL * 0.35;
            if (dist < stopAt) {
                // 已到圍攻位：站定交戰、面朝玩家（真戰鬥感）
                m._animMoving = false;
                m._moveStickUntil = 0;
                m._mobBob = 0;
                m._mobPlant = 0;
                m._mobShadow = 1;
                exploreMobSetMoveFace(m, _tx - m._fx, _ty - (m._fy || 0), now, true);
                continue;
            }
            if (toPlayer > CHASE_RANGE && !engaged) {
                m._aggro = false;
                exploreMobWanderTick(m, now);
                continue;
            }
            // 等速追擊
            var movedC = exploreMobWalkStep(m, dx, dy, MOB_CHASE_SPEED);
            if (movedC > 0.05) {
                exploreMobMarkWalking(m, now + MOB_MOVE_STICK_MS);
                if (m._animAct && (m._animAct.k === 'attack' || m._animAct.k === 'skill') && !engaged) {
                    m._animAct = null;
                }
                exploreMobSetMoveFace(m, dx, dy, now, true);
            } else {
                exploreMobSetMoveFace(m, _tx - m._fx, _ty - (m._fy || 0), now, true);
            }
        }
        // 站定交戰時微推開，避免重疊成一團
        try { exploreMobSeparateTick(); } catch (eSep) {}
    }

    /** 最近可接近之怪（世界座標）；供靠近練功點自動追怪 */
    function exploreNearestApproachIdx(maxDist) {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return -1;
        var lim = maxDist == null ? APPROACH_WORLD : maxDist;
        var best = -1, bestD = Infinity;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._dead || !(m.curHp > 0) || m._fx == null) continue;
            var d = Math.hypot(m._fx - _tx, (m._fy || 0) - _ty);
            if (d <= lim && d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    /**
     * 自動掛機走近：等速追怪，進交戰距離硬停。
     */
    function exploreCombatCamChaseTick(manualControl) {
        if (!exploreFieldCombatActive() || manualControl || explorePlayerDead()) return false;
        try {
            if (typeof state !== 'undefined' && state && state.autoHunt === false) return false;
        } catch (eA) {}
        if (typeof mapState === 'undefined' || !mapState.mobs) return false;
        var t = mapState.mobs[mapState.targetIdx];
        if (!t || t._dead || !(t.curHp > 0) || t._fx == null) t = null;
        var engaged = !!(t && exploreMobInEngageRange(t));
        if (!engaged) {
            var ai = exploreNearestApproachIdx(APPROACH_WORLD);
            if (ai < 0) return false;
            t = mapState.mobs[ai];
            if (!t || t._fx == null) return false;
            try {
                if (mapState.targetIdx !== ai) {
                    if (typeof setTarget === 'function') setTarget(ai);
                    else mapState.targetIdx = ai;
                }
            } catch (eSet) { mapState.targetIdx = ai; }
        }
        var dx = t._fx - _tx;
        var dy = (t._fy || 0) - _ty;
        var dist = Math.hypot(dx, dy);
        if (!(dist > 1)) return false;
        var dirx = dx / dist;
        var diry = dy / dist;
        if (dist <= COMBAT_STAND_OFF) {
            _vx = 0;
            _vy = 0;
            exploreSetFaceFromVec(dirx, -diry);
            return false;
        }
        if (!engaged && dist > APPROACH_WORLD) return false;
        exploreSetFaceFromVec(dirx, -diry);
        return explorePlayerWalkStep(dirx, diry) > 0.08;
    }

    /** 8 向量化（世界座標） */
    function exploreQuantize8(wx, wy) {
        var ax = Math.abs(wx) > 0.28 ? (wx > 0 ? 1 : -1) : 0;
        var ay = Math.abs(wy) > 0.28 ? (wy > 0 ? 1 : -1) : 0;
        if (!ax && !ay) return { x: 0, y: 0 };
        var len = Math.hypot(ax, ay) || 1;
        return { x: ax / len, y: ay / len };
    }

    /**
     * 🩹 v3.8.415：等速位移＋碰撞解析（真走路）
     * @returns {{ x:number, y:number, moved:number, hit:boolean }}
     */
    function exploreTryMoveFrom(ox, oy, dirx, diry, dist) {
        var ox0 = Number(ox) || 0;
        var oy0 = Number(oy) || 0;
        var d = Math.max(0, Number(dist) || 0);
        if (!(d > 0.001) || !(Math.abs(dirx) > 0.001 || Math.abs(diry) > 0.001)) {
            return { x: ox0, y: oy0, moved: 0, hit: false };
        }
        var len = Math.hypot(dirx, diry) || 1;
        var nx = ox0 + (dirx / len) * d;
        var ny = oy0 + (diry / len) * d;
        if (nx < -CAM_MAX_X) nx = -CAM_MAX_X;
        if (nx > CAM_MAX_X) nx = CAM_MAX_X;
        if (ny < -CAM_MAX_Y) ny = -CAM_MAX_Y;
        if (ny > CAM_MAX_Y) ny = CAM_MAX_Y;
        var def = exploreActiveMapDef();
        if (def && typeof mapdefResolveMove === 'function') {
            var r = mapdefResolveMove(def, ox0, oy0, nx, ny);
            var psh = explorePushSolidList(r.x, r.y);
            if (psh.hit) r.hit = true;
            r.x = psh.x;
            r.y = psh.y;
            return {
                x: r.x,
                y: r.y,
                moved: Math.hypot(r.x - ox0, r.y - oy0),
                hit: !!r.hit
            };
        }
        // 無 MapDef：用固體解析
        var saveTx = _tx;
        var saveTy = _ty;
        _tx = nx;
        _ty = ny;
        exploreApplySolidMove(ox0, oy0);
        var fx = _tx;
        var fy = _ty;
        _tx = saveTx;
        _ty = saveTy;
        return {
            x: fx,
            y: fy,
            moved: Math.hypot(fx - ox0, fy - oy0),
            hit: Math.hypot(fx - nx, fy - ny) > 0.5
        };
    }

    /** 人物本 tick 等速走一步（加速／疾走生效；變身 wlk 不拖慢場走） */
    function explorePlayerSpeedMult() {
        var m = 1;
        try {
            var p = (typeof player !== 'undefined') ? player : null;
            if (!p) return 1;
            var buffs = p.buffs || {};
            if (buffs.haste > 0 || p._equipHaste) m *= 1.33;
            if (buffs.brave > 0) m *= 1.33;
            var windDash = (buffs.sk_elf_winddash || 0) > 0;
            if (windDash || (buffs.sk_holy_dash || 0) > 0) m *= 1.33;
            if (buffs.elfcookie > 0 && !windDash) m *= 1.15;
            if ((buffs.sk_dark_walkhaste || 0) > 0) m *= 1.15;
            var equipPct = (p.d && p.d.moveSpeedPct) ? Math.max(-95, Number(p.d.moveSpeedPct) || 0) : 0;
            if (equipPct) m *= (1 + equipPct / 100);
        } catch (eM) {}
        // 大地圖略加快，避免橫跨太久
        try {
            if (exploreIsRealMap() && CAM_MAX_X > 700) m *= 1.12;
        } catch (eLg) {}
        return Math.max(0.25, Math.min(2.8, m));
    }
    function explorePlayerWalkStep(dirx, diry) {
        var step = PLAYER_SPEED * (TICK_MS / 1000) * explorePlayerSpeedMult();
        var r = exploreTryMoveFrom(_tx, _ty, dirx, diry, step);
        _tx = r.x;
        _ty = r.y;
        if (r.moved > 0.08) {
            _walkPhase += r.moved * WALK_PHASE_DIST;
            _moving = true;
        }
        return r.moved;
    }

    /** 怪等速移動（回傳實際位移） */
    function exploreMobWalkStep(m, dirx, diry, speed) {
        if (!m) return 0;
        var sp = Math.max(10, Number(speed) || MOB_SPEED);
        var step = sp * (TICK_MS / 1000);
        var ox = Number(m._fx) || 0;
        var oy = Number(m._fy) || 0;
        var r = exploreTryMoveFrom(ox, oy, dirx, diry, step);
        m._fx = r.x;
        m._fy = r.y;
        m._gridFx = r.x;
        m._gridFy = r.y;
        m._slideStart = 0;
        if (r.moved > 0.08) {
            exploreMobAdvanceWalkFeel(m, r.moved, Date.now());
        }
        return r.moved;
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
                mid.classList.remove('is-map-scene', 'is-ground-tile', 'is-topdown-floor', 'is-scenic-topdown');
            }
            var blendOff = document.getElementById('explore-world-bg-blend');
            if (blendOff) blendOff.classList.add('hidden');
            var propOff = document.getElementById('explore-prop-layer');
            if (propOff) propOff.classList.add('hidden');
            var seaOff = document.getElementById('explore-sea-mask');
            if (seaOff) seaOff.classList.add('hidden');
            var boundOff = document.getElementById('explore-bound-layer');
            if (boundOff) boundOff.classList.add('hidden');
            if (atmo) atmo.classList.add('hidden');
            if (dust) dust.classList.add('hidden');
            if (mist) mist.classList.add('hidden');
            if (light) light.classList.add('hidden');
            if (ground) ground.classList.add('hidden');
            if (vig) vig.classList.add('hidden');
            biomeCls.forEach(function (c) { bv.classList.remove(c); });
            bv.classList.remove('explore-bg-scroll', 'is-explore-walking', 'is-explore-combat', 'is-topdown-map', 'is-scenic-3d', 'is-topdown-3d', 'is-real-map', 'portal-ready-left', 'portal-ready-right', 'has-scenic-bg', 'is-large-explore');
            bv.style.backgroundColor = '';
            // 🩹 v3.8.475／485：離開場戰／真地圖後，若在修練場把側視背景加回來
            try {
                if (typeof mapState !== 'undefined' && mapState && mapState.current === 'training') {
                    if (typeof ensureTrainingYardBackground === 'function') ensureTrainingYardBackground(bv);
                    else {
                        var _cbg = bv.style.getPropertyValue('--chud-battle-bg');
                        if (_cbg) bv.style.backgroundImage = _cbg;
                        bv.style.backgroundSize = 'cover';
                        bv.style.backgroundPosition = 'center center';
                        bv.classList.add('training-yard', 'has-bg', 'area-fit');
                        bv.classList.remove('is-world-scroll', 'is-exploring');
                    }
                }
            } catch (eTrBg) {}
            return;
        }
        var mapId = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var biome = exploreBiomeOf(mapId);
        var scenic = exploreIsScenicMap(mapId);
        var realMap = exploreIsRealMap(mapId);
        biomeCls.forEach(function (c) { bv.classList.remove(c); });
        bv.classList.add('explore-biome-' + biome);

        var floor = exploreCorridorBgUrl();
        var blend = document.getElementById('explore-world-bg-blend');
        var midImg = floor ? ('url("' + floor + '")') : '';
        if (!midImg) midImg = exploreReadBgImage(bv, mid);

        // 🩹 v3.8.360：正俯視捲動；說話之島＝俯視圖景＋遠景 3D 氛圍（取消側視 rotateX）
        bv.classList.add('is-topdown-map', 'explore-bg-scroll');
        bv.classList.remove('is-scenic-3d');
        bv.classList.toggle('is-topdown-3d', !!scenic);
        bv.classList.toggle('has-scenic-bg', !!scenic);
        // 鳥視感改靠人物略小，不再用「世界＞地板」造成破圖
        bv.classList.toggle('is-large-explore', !!realMap);

        // 🩹 v3.8.385：真地圖／鳥視啟用時關掉側視 has-bg（否則看起來「地圖沒變」）
        if (scenic || realMap) {
            try {
                bv.style.backgroundImage = 'none';
                bv.style.backgroundSize = '';
            } catch (eBg) {}
        }

        // 🩹 v3.9.24：地板尺寸＝可走世界（maxX*2），禁止「小圖＋外圈瓦」破圖
        exploreRefreshCamLimits();
        var tileSz = TILE_PX;
        var def = exploreActiveMapDef();
        var scenicPadX = realMap ? 0 : 360;
        var scenicPadY = realMap ? 0 : 300;
        var scenicW = CAM_MAX_X * 2 + scenicPadX * 2;
        var scenicH = CAM_MAX_Y * 2 + scenicPadY * 2;
        if (def && realMap) {
            var bb = null;
            try {
                if (typeof mapdefBounds === 'function') bb = mapdefBounds(def);
            } catch (eBb) {}
            // 世界半幅優先；floorArt 僅當與世界一致時使用
            var worldW = ((bb && bb.maxX) || def.maxX || CAM_MAX_X) * 2;
            var worldH = ((bb && bb.maxY) || def.maxY || CAM_MAX_Y) * 2;
            scenicW = worldW;
            scenicH = worldH;
            scenicPadX = 0;
            scenicPadY = 0;
        }
        // 🩹 v3.9.12：地監／熔岩墊底用對應 seamless，勿一律草地
        var underBiome = (biome === 'lava') ? 'lava'
            : (biome === 'dungeon' || biome === 'crystal' || biome === 'tower') ? 'dungeon'
            : (biome === 'desert') ? 'desert'
            : (biome === 'snow') ? 'snow'
            : (biome === 'coast') ? 'coast'
            : 'wild';
        var grassUrl = exploreSeamlessFloorUrl(underBiome);
        var underColor = (underBiome === 'lava') ? '#3a1810'
            : (underBiome === 'dungeon' || underBiome === 'crystal' || underBiome === 'tower') ? '#1a1512'
            : (underBiome === 'desert') ? '#c4a574'
            : (underBiome === 'snow') ? '#c8d4e0'
            : (underBiome === 'coast') ? '#2a5a6e'
            : '#3a6b32';
        if (midImg) {
            if (mid) {
                if (scenic) {
                    mid.style.backgroundImage = midImg;
                    // 地板＝世界尺寸 1:1（人物／相機／碰撞對齊）
                    mid.style.setProperty('background-size', scenicW + 'px ' + scenicH + 'px', 'important');
                    mid.style.backgroundPosition = '';
                    mid.style.backgroundRepeat = 'no-repeat';
                    mid.classList.remove('is-ground-tile', 'is-map-scene', 'is-scenic-ground', 'hidden');
                    mid.classList.add('is-topdown-floor', 'is-scenic-topdown');
                    // 墊底：僅吃 inset 外圈，與地板同色調避免接縫假破圖
                    if (blend) {
                        blend.style.backgroundImage = 'url("' + grassUrl + '")';
                        blend.style.backgroundSize = tileSz + 'px ' + tileSz + 'px';
                        blend.style.backgroundRepeat = 'repeat';
                        blend.classList.remove('hidden');
                        blend.classList.add('is-topdown-underfill', 'is-scenic-underfill');
                        blend.style.setProperty('display', 'block', 'important');
                        blend.style.setProperty('opacity', '1', 'important');
                        blend.style.setProperty('filter', 'none', 'important');
                    }
                    bv.style.backgroundColor = underColor;
                } else {
                    mid.style.backgroundImage = midImg;
                    mid.style.backgroundSize = tileSz + 'px ' + tileSz + 'px';
                    mid.style.backgroundRepeat = 'repeat';
                    mid.classList.remove('is-ground-tile', 'is-map-scene', 'is-scenic-ground', 'is-scenic-topdown', 'hidden');
                    mid.classList.add('is-topdown-floor');
                    if (blend) {
                        blend.classList.add('hidden');
                        blend.classList.remove('is-topdown-underfill', 'is-scenic-underfill');
                        blend.style.backgroundImage = '';
                        blend.style.removeProperty('display');
                        blend.style.removeProperty('opacity');
                    }
                    bv.style.backgroundColor = '';
                }
                mid.classList.remove('hidden');
            }
            // 🩹 v3.9.24：關掉側視遠景疊層（與俯視地板打架＝破圖／黑帶）
            if (far) {
                far.classList.add('hidden');
                far.classList.remove('is-scenic-far', 'is-horizon-far');
                far.style.backgroundImage = '';
                far.style.removeProperty('display');
                far.style.removeProperty('opacity');
            }
        } else {
            if (far) {
                far.classList.add('hidden');
                far.classList.remove('is-scenic-far');
            }
            if (mid) {
                mid.classList.add('hidden');
                mid.classList.remove('is-topdown-floor', 'is-map-scene', 'is-scenic-ground', 'is-scenic-topdown');
            }
            if (blend) {
                blend.classList.add('hidden');
                blend.classList.remove('is-topdown-underfill');
            }
            bv.classList.remove('explore-bg-scroll', 'has-scenic-bg', 'is-topdown-3d');
            bv.style.backgroundColor = '';
        }

        {
            var half = (tileSz * 0.5).toFixed(1) + 'px';
            var midX, midY;
            if (scenic) {
                // 置中對齊世界原點，相機平移＝圖景反移
                midX = 'calc(50% + ' + (-_cx * BG_MID_X).toFixed(1) + 'px)';
                midY = 'calc(50% + ' + (_cy * BG_MID_Y).toFixed(1) + 'px)';
            } else {
                midX = (-_cx * BG_MID_X).toFixed(1) + 'px';
                midY = (_cy * BG_MID_Y).toFixed(1) + 'px';
            }
            if (mid) {
                mid.style.backgroundPosition = midX + ' ' + midY;
                mid.style.transform = 'none';
                mid.style.setProperty('--tile-x', midX);
                mid.style.setProperty('--tile-y', midY);
                mid.style.setProperty('--tile-half', half);
            }
            if (far && far.classList.contains('is-horizon-far')) {
                var farX = 'calc(50% + ' + (-_cx * BG_FAR_X).toFixed(1) + 'px)';
                var farY = 'calc(42% + ' + (_cy * BG_FAR_Y).toFixed(1) + 'px)';
                far.style.backgroundPosition = farX + ' ' + farY;
            }
            if (blend && scenic) {
                blend.style.backgroundPosition = (-_cx * BG_MID_X).toFixed(1) + 'px ' + (_cy * BG_MID_Y).toFixed(1) + 'px';
                blend.style.transform = 'none';
            } else if (blend && !scenic) {
                blend.style.backgroundPosition = (((-_cx * BG_MID_X) + tileSz * 0.5).toFixed(1) + 'px') + ' ' + (((_cy * BG_MID_Y) + tileSz * 0.5).toFixed(1) + 'px');
                blend.style.transform = 'none';
            }
        }
        if (ground) ground.classList.add('hidden');

        if (mist) mist.classList.add('hidden');
        if (light) light.classList.add('hidden');
        if (atmo) atmo.classList.remove('hidden');
        if (dust) dust.classList.remove('hidden');
        if (vig) vig.classList.remove('hidden');
        exploreSyncBoundWalls(on);
        exploreSyncProps(on, biome, mapId);
        exploreUpdatePropOcclusion();
        bv.classList.toggle('is-explore-walking', !!_moving);
        // 🩹 v3.8.416：步伐相位用 π＝兩幀一步，踩地起伏明顯（消滑冰）
        var bob = 0;
        var shScale = 1;
        var footPlant = 0;
        var realFeel = exploreIsRealMap();
        if (_moving) {
            var wave = Math.sin(_walkPhase * Math.PI);
            bob = realFeel ? (wave * PLAYER_BOB_PX) : (wave * PLAYER_BOB_PX_SOFT);
            var plant = Math.max(0, -wave);
            footPlant = realFeel ? Math.min(1, plant * 1.45) : Math.min(1, plant * 0.85);
            shScale = realFeel
                ? (0.68 + 0.42 * plant + 0.12 * (0.5 + 0.5 * Math.sin(_walkPhase * Math.PI + 0.6)))
                : (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(_walkPhase * Math.PI + 0.6)));
            if (realFeel) exploreMaybeFootPlant(wave);
            bv.style.setProperty('--walk-squash', (1 - plant * 0.06).toFixed(3));
            bv.style.setProperty('--walk-sway', (Math.sin(_walkPhase * Math.PI * 0.5) * 1.8).toFixed(2) + 'px');
        } else {
            _footSign = 0;
            bv.style.setProperty('--walk-squash', '1');
            bv.style.setProperty('--walk-sway', '0px');
        }
        bv.style.setProperty('--walk-bob', bob.toFixed(2) + 'px');
        bv.style.setProperty('--walk-shadow-scale', shScale.toFixed(3));
        bv.style.setProperty('--foot-plant', footPlant.toFixed(3));
        bv.classList.toggle('is-foot-plant', !!(realFeel && footPlant > 0.55));
        exploreSyncFootPatch(!!(realFeel && _moving));
        var inCombat = false;
        try {
            var t = mapState.mobs && mapState.mobs[mapState.targetIdx];
            inCombat = !!(t && exploreMobInEngageRange(t));
        } catch (eC) {}
        bv.classList.toggle('is-explore-combat', inCombat);
    }

    /** 🩹 v3.8.387：步伐過零點＝踩地 → 草屑／塵土 */
    function exploreMaybeFootPlant(wave) {
        var now = Date.now();
        var crossed = (_footSign <= 0 && wave > 0.35) || (_footSign >= 0 && wave < -0.35);
        _footSign = wave;
        if (!crossed || now < _footPlantUntil) return;
        _footPlantUntil = now + 120;
        exploreSpawnGrassPuff();
    }
    function exploreSyncFootPatch(on) {
        var bv = document.getElementById('battle-view');
        var patch = document.getElementById('explore-foot-patch');
        if (!patch || !bv) return;
        if (!exploreIsRealMap()) {
            patch.classList.add('hidden');
            return;
        }
        patch.classList.toggle('hidden', !on);
        // 🩹 v3.8.389：腳印跟著人物螢幕座標（真走在圖上）
        patch.style.left = 'calc(50% + ' + explorePlayerScreenX().toFixed(1) + 'px)';
        patch.style.bottom = (explorePlayerScreenBottom() - 2).toFixed(1) + 'px';
    }
    function exploreSpawnGrassPuff() {
        var bv = document.getElementById('battle-view');
        if (!bv || !exploreIsRealMap()) return;
        var baseY = explorePlayerScreenBottom();
        var baseX = explorePlayerScreenX();
        for (var i = 0; i < 3; i++) {
            var el = document.createElement('span');
            el.className = 'explore-grass-puff' + (i === 2 ? ' is-dust' : '');
            var ang = (Math.random() - 0.5) * 1.4;
            var dist = 10 + Math.random() * 18;
            el.style.setProperty('--gx', (Math.cos(ang) * dist).toFixed(1) + 'px');
            el.style.setProperty('--gy', (-8 - Math.random() * 16).toFixed(1) + 'px');
            el.style.bottom = (baseY + (Math.random() * 4 - 1)) + 'px';
            el.style.left = 'calc(50% + ' + (baseX + (Math.random() - 0.5) * 22).toFixed(1) + 'px)';
            el.style.marginLeft = '0';
            bv.appendChild(el);
            setTimeout(function (node) {
                try { if (node && node.parentNode) node.parentNode.removeChild(node); } catch (eR) {}
            }, 620, el);
        }
    }

    /** 🌿 點綴物：依 biome 專屬 palette／密度／圖資（缺圖 fallback 共用 props） */
    var _propCacheKey = '';
    var PROP_CLEAR_R = 220;   // 練功點／出生點淨空半徑（排除打怪異常）
    var PROP_SRC_FALLBACK = {
        rock: 'assets/area/props/rock.png',
        bush: 'assets/area/props/bush.png',
        tree: 'assets/area/props/tree.png',
        path: 'assets/area/props/path.png'
    };
    // 🩹 v3.8.381：各地形類別點綴設定（一眼可辨）
    var BIOME_PROP_CONFIG = {
        wild: {
            palette: ['tree', 'bush', 'rock', 'path', 'bush'],
            count: 22,
            pathCount: 12,
            pathAmp: 55,
            cluster: 0.18,
            edgeBias: 0
        },
        forest: {
            palette: ['tree', 'tree', 'bush', 'tree', 'path', 'rock', 'bush'],
            count: 36,
            pathCount: 10,
            pathAmp: 40,
            cluster: 0.42,
            edgeBias: 0
        },
        desert: {
            palette: ['rock', 'rock', 'bush', 'path', 'rock'],
            count: 18,
            pathCount: 14,
            pathAmp: 70,
            cluster: 0.08,
            edgeBias: 0
        },
        snow: {
            palette: ['tree', 'rock', 'path', 'bush', 'rock'],
            count: 20,
            pathCount: 12,
            pathAmp: 50,
            cluster: 0.2,
            edgeBias: 0
        },
        coast: {
            palette: ['rock', 'bush', 'path', 'rock', 'tree'],
            count: 20,
            pathCount: 10,
            pathAmp: 60,
            cluster: 0.12,
            edgeBias: 0.55   // 礁岩偏南／邊緣
        },
        swamp: {
            palette: ['bush', 'bush', 'path', 'rock', 'tree', 'bush'],
            count: 30,
            pathCount: 8,
            pathAmp: 35,
            cluster: 0.35,
            edgeBias: 0
        },
        lava: {
            palette: ['rock', 'rock', 'rock', 'path', 'rock'],
            count: 28,
            pathCount: 12,
            pathAmp: 40,
            cluster: 0.12,
            edgeBias: 0.45
        },
        crystal: {
            palette: ['rock', 'rock', 'path', 'bush'],
            count: 18,
            pathCount: 9,
            pathAmp: 40,
            cluster: 0.15,
            edgeBias: 0
        },
        dungeon: {
            palette: ['rock', 'rock', 'rock', 'path', 'rock'],
            count: 30,
            pathCount: 14,
            pathAmp: 28,
            cluster: 0.15,
            edgeBias: 0.5
        },
        tower: {
            palette: ['rock', 'path', 'rock', 'rock'],
            count: 22,
            pathCount: 12,
            pathAmp: 25,
            cluster: 0.1,
            edgeBias: 0.35
        }
    };
    function exploreBiomePropConfig(biome) {
        return BIOME_PROP_CONFIG[biome] || BIOME_PROP_CONFIG.wild;
    }
    function explorePropSrc(biome, kind) {
        var ver = (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : 'v3.8.381');
        var b = String(biome || 'wild').replace(/[^a-z]/gi, '') || 'wild';
        var k = String(kind || 'rock').replace(/[^a-z]/gi, '') || 'rock';
        // 專屬圖優先；執行期不探測 404，由建圖腳本保證存在（缺則與共用同內容）
        return 'assets/area/props/' + b + '/' + k + '.png?v=' + ver;
    }
    function explorePropPalette(biome) {
        var cfg = exploreBiomePropConfig(biome);
        return (cfg.palette && cfg.palette.length) ? cfg.palette.slice() : ['tree', 'bush', 'rock', 'path'];
    }
    /** 是否落在練功點／地圖中心交戰淨空區 */
    function explorePropInCombatClear(wx, wy) {
        if (Math.hypot(wx, wy) < PROP_CLEAR_R) return true;
        var spots = exploreActiveGrindSpots();
        for (var i = 0; i < spots.length; i++) {
            var s = spots[i];
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
        var cfg = exploreBiomePropConfig(biome);
        var palette = explorePropPalette(biome);
        var list = [];
        var pathCount = Math.max(4, cfg.pathCount | 0);
        var pathAmp = Number(cfg.pathAmp) || 50;
        // 有專屬俯視地板＝地圖本體已具真實感；少放貼紙樹石，避免蓋掉場景
        var paintedFloor = false;
        try {
            if (typeof mapdefOf === 'function') {
                var md = mapdefOf(mapId);
                paintedFloor = !!(md && md.floor);
            }
        } catch (ePf) {}
        if (paintedFloor) {
            pathCount = Math.min(pathCount, 2);
        }
        // 路徑走練功點「之間」的走廊，不穿越點心
        var pathY = -420 + rnd() * 120;
        if (Math.abs(pathY) < 120) pathY = (pathY < 0 ? -1 : 1) * (140 + rnd() * 80);
        for (var pi = 0; pi < pathCount; pi++) {
            var px = -CAM_MAX_X + 200 + pi * ((CAM_MAX_X * 2 - 400) / Math.max(1, pathCount - 1));
            var py = pathY + Math.sin(pi * 0.55 + rnd()) * pathAmp + (rnd() - 0.5) * 30;
            if (explorePropInCombatClear(px, py)) continue;
            list.push({
                kind: 'path',
                biome: biome,
                wx: Math.max(-CAM_MAX_X + 80, Math.min(CAM_MAX_X - 80, px)),
                wy: Math.max(-CAM_MAX_Y + 60, Math.min(CAM_MAX_Y - 60, py)),
                s: 0.7 + rnd() * 0.5,
                rot: (rnd() - 0.5) * 48,
                z: 1
            });
        }
        var n = Math.max(8, cfg.count | 0);
        if (paintedFloor) n = Math.min(Math.max(n, 10), 14);
        if (String(mapId) === 'dream_island' && biome === 'mist') n = paintedFloor ? Math.min(n, 8) : Math.max(n, 28);
        if (String(mapId) === 'talking_island' && biome === 'wild') n = paintedFloor ? Math.min(n, 5) : Math.max(n, 26);
        if (String(mapId) === 'talking_island_port' && biome === 'coast') n = paintedFloor ? Math.min(n, 4) : Math.max(n, 18);
        if (!paintedFloor && (String(mapId) === 'zone_13' || String(mapId) === 'zone_14' || /^zone_0[6-9]$/.test(String(mapId)) || String(mapId) === 'zone_10' || String(mapId) === 'zone_11' || String(mapId) === 'zone_12' || /^zone_1[8-9]$/.test(String(mapId)) || String(mapId) === 'zone_20' || String(mapId) === 'zone_21' || /^zone_2[2-9]$/.test(String(mapId)) || String(mapId) === 'zone_30' || String(mapId) === 'zone_31' || /^zone_1[5-7]$/.test(String(mapId)) || /^zone_3[2-9]$/.test(String(mapId)) || String(mapId) === 'zone_40' || String(mapId) === 'zone_41' || /^crystal_cave/.test(String(mapId)) || /^rastabad_/.test(String(mapId)) || String(mapId) === 'eva_kingdom' || String(mapId) === 'dark_magic_lab' || String(mapId) === 'necro_training' || String(mapId) === 'elder_room' || String(mapId) === 'demon_temple' || String(mapId) === 'shadow_temple') && biome === 'dungeon') n = Math.max(n, 16);
        if (!paintedFloor && String(mapId).indexOf('pride_') === 0 && biome === 'tower') n = Math.max(n, 18);
        if (!paintedFloor && (String(mapId) === 'pirate_dungeon' || String(mapId) === 'thebes_pyramid' || String(mapId) === 'thebes_temple' || String(mapId) === 'tikal_deep' || String(mapId) === 'tikal_altar') && (biome === 'dungeon' || biome === 'desert' || biome === 'crystal' || biome === 'wild')) n = Math.max(n, 14);
        if (!paintedFloor && String(mapId) === 'silver_knight' && biome === 'wild') n = Math.max(n, 22);
        if (!paintedFloor && (String(mapId) === 'zone_01' || String(mapId) === 'elf_forest') && biome === 'forest') n = Math.max(n, 24);
        var tries = 0;
        var cluster = Number(cfg.cluster) || 0;
        var edgeBias = Number(cfg.edgeBias) || 0;
        while (list.length < n + pathCount && tries < n * 14) {
            tries++;
            var kind = palette[Math.floor(rnd() * palette.length)] || 'rock';
            if (kind === 'path') kind = (biome === 'lava' || biome === 'dungeon' || biome === 'tower') ? 'rock' : 'bush';
            var wx = (rnd() - 0.5) * CAM_MAX_X * 1.7;
            var wy = (rnd() - 0.5) * CAM_MAX_Y * 1.55;
            // 海岸：礁岩偏南緣
            if (edgeBias > 0 && (kind === 'rock' || kind === 'bush') && rnd() < edgeBias) {
                wy = -CAM_MAX_Y * (0.55 + rnd() * 0.35);
                wx = (rnd() - 0.5) * CAM_MAX_X * 1.8;
            }
            if (kind === 'tree' && rnd() < cluster && list.length) {
                var anchor = list[Math.floor(rnd() * list.length)];
                if (anchor && anchor.kind === 'tree') {
                    wx = anchor.wx + (rnd() - 0.5) * 140;
                    wy = anchor.wy + (rnd() - 0.5) * 110;
                }
            }
            if (explorePropInCombatClear(wx, wy)) continue;
            var depthT = (wy + CAM_MAX_Y) / Math.max(1, CAM_MAX_Y * 2);
            var scBase = (kind === 'tree' ? 0.92 : (kind === 'bush' ? 0.72 : 0.62)) + rnd() * 0.38;
            var sc = scBase * (0.88 + 0.22 * depthT);
            list.push({
                kind: kind,
                biome: biome,
                wx: Math.max(-CAM_MAX_X + 60, Math.min(CAM_MAX_X - 60, wx)),
                wy: Math.max(-CAM_MAX_Y + 50, Math.min(CAM_MAX_Y - 50, wy)),
                s: sc,
                rot: kind === 'tree' ? ((rnd() - 0.5) * 6) : ((rnd() - 0.5) * 14),
                z: 2
            });
        }
        return list;
    }
    function exploreSyncProps(on, biome, mapId) {
        var layer = document.getElementById('explore-prop-layer');
        if (!layer) return;
        var show = !!(on && exploreAllowed());
        layer.classList.toggle('hidden', !show);
        if (!show) {
            if (layer.childNodes.length) layer.innerHTML = '';
            _propCacheKey = '';
            _solidList = [];
            _solidKey = '';
            return;
        }
        var gy = exploreGroundYLive();
        var key = String(mapId || '') + '|' + String(biome || 'wild') + '|g' + gy + '|p418|' + (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '');
        if (_propCacheKey === key && layer.childNodes.length) return;
        _propCacheKey = key;
        var props = exploreBuildPropList(mapId, biome);
        var html = '';
        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            var src = explorePropSrc(biome, p.kind);
            var bot = exploreFieldFootBottom(p.wy);
            // 🩹 v3.8.386：與人／怪同一套腳底 Y→z（真地圖互遮）
            var zDepth = Math.max(18, Math.min(88, Math.round(50 - p.wy * 0.06)));
            if (p.kind === 'tree') zDepth += 2;
            if (p.kind === 'path') zDepth = 18;
            html += '<div class="explore-prop explore-prop--' + p.kind + ' explore-prop-biome-' + biome + '" data-kind="' + p.kind + '" data-biome="' + biome + '" data-wx="' + p.wx.toFixed(1) + '" data-wy="' + p.wy.toFixed(1) + '" style="left:calc(50% + ' + p.wx.toFixed(1) + 'px);bottom:' + bot + 'px;--ps:' + p.s.toFixed(2) + ';--prot:' + p.rot.toFixed(1) + 'deg;--near-fade:1;z-index:' + zDepth + '">' +
                '<span class="explore-prop-shadow" aria-hidden="true"></span>' +
                '<img src="' + src + '" alt="" draggable="false" onerror="this.onerror=null;this.src=\'' + (PROP_SRC_FALLBACK[p.kind] || PROP_SRC_FALLBACK.rock) + '\'"></div>';
        }
        layer.innerHTML = html;
        exploreRebuildSolids(mapId, biome, props);
    }

    /** 🌳 靠近樹／灌木：半透明（可穿過，只當視線遮擋） */
    var PROP_FADE_START = 150;
    var PROP_FADE_FULL = 48;
    function exploreUpdatePropOcclusion() {
        var layer = document.getElementById('explore-prop-layer');
        if (!layer || layer.classList.contains('hidden')) return;
        var kids = layer.children;
        if (!kids || !kids.length) return;
        for (var i = 0; i < kids.length; i++) {
            var el = kids[i];
            var kind = el.dataset ? el.dataset.kind : '';
            if (kind !== 'tree' && kind !== 'bush') {
                el.style.setProperty('--near-fade', '1');
                el.classList.remove('is-near', 'is-occlude');
                continue;
            }
            var wx = Number(el.dataset.wx || 0);
            var wy = Number(el.dataset.wy || 0);
            var d = Math.hypot(wx - _tx, wy - _ty);
            var fade = 1;
            if (d < PROP_FADE_START) {
                var t = Math.max(0, Math.min(1, (d - PROP_FADE_FULL) / Math.max(1, PROP_FADE_START - PROP_FADE_FULL)));
                // 穿過時更透，最低約 0.18
                fade = 0.18 + 0.82 * t;
            }
            el.style.setProperty('--near-fade', fade.toFixed(3));
            el.classList.toggle('is-near', d < PROP_FADE_START);
            el.classList.toggle('is-occlude', d < PROP_FADE_FULL + 20);
        }
    }

    /** 🩹 v3.8.383：真地圖＝MapDef 碰撞；其餘保留外框＋說話島海岸圓 */
    var _solidList = [];
    var _solidKey = '';
    var PROP_SOLID_R = { tree: 20, rock: 30, bush: 10, path: 0 }; // v3.9.18 貼地固體（0＝可穿）
    function exploreScenicExtraSolids(mapId) {
        if (exploreIsRealMap(mapId)) return [];
        if (String(mapId || '') !== 'talking_island') return [];
        return [
            { x: -720, y: -780, r: 70 },
            { x: -280, y: -800, r: 66 },
            { x: 180, y: -790, r: 68 },
            { x: 640, y: -760, r: 72 },
            { x: 1000, y: -700, r: 64 }
        ];
    }
    function exploreRebuildSolids(mapId, biome, props) {
        var key = String(mapId || '') + '|' + String(biome || '') + '|solid418';
        if (_solidKey === key && _solidList.length) return;
        _solidKey = key;
        var list = [];
        var extra = exploreScenicExtraSolids(mapId);
        for (var j = 0; j < extra.length; j++) list.push(extra[j]);
        // MapDef rocks: mapdefPushOut only; here props solids
        if (props && props.length) {
            for (var i = 0; i < props.length; i++) {
                var pr = props[i];
                if (!pr) continue;
                var baseR = PROP_SOLID_R[pr.kind] || 0;
                if (!(baseR > 0)) continue;
                var sc = Math.max(0.55, Number(pr.s) || 1);
                list.push({
                    x: Number(pr.wx) || 0,
                    y: Number(pr.wy) || 0,
                    r: Math.max(10, baseR * sc)
                });
            }
        }
        _solidList = list;
    }
    function exploreEnsureSolids() {
        if (_solidList && _solidList.length) return;
        try {
            var mid = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
            var biome = exploreBiomeOf(mid);
            exploreRebuildSolids(mid, biome, null);
        } catch (eS) {}
    }

    /** 🩹 v3.9.18：props／岩石固體推出 */
    function explorePushSolidList(nx, ny) {
        exploreEnsureSolids();
        var x = Number(nx) || 0;
        var y = Number(ny) || 0;
        var hit = false;
        var pad = 4;
        for (var pass = 0; pass < 4; pass++) {
            var moved = false;
            for (var i = 0; i < _solidList.length; i++) {
                var sld = _solidList[i];
                if (!sld) continue;
                var need = (Number(sld.r) || 20) + pad;
                var dx = x - sld.x;
                var dy = y - sld.y;
                var d2 = dx * dx + dy * dy;
                if (d2 >= need * need || d2 < 0.0001) continue;
                var d = Math.sqrt(d2);
                x = sld.x + (dx / d) * need;
                y = sld.y + (dy / d) * need;
                hit = true;
                moved = true;
            }
            if (!moved) break;
        }
        if (x < -CAM_MAX_X) { x = -CAM_MAX_X; hit = true; }
        if (x > CAM_MAX_X) { x = CAM_MAX_X; hit = true; }
        if (y < -CAM_MAX_Y) { y = -CAM_MAX_Y; hit = true; }
        if (y > CAM_MAX_Y) { y = CAM_MAX_Y; hit = true; }
        return { x: x, y: y, hit: hit };
    }

    /** 把座標推出固體；回傳是否有撞到 */
    function exploreResolveSolids(nx, ny, fromX, fromY) {
        var def = exploreActiveMapDef();
        if (def && typeof mapdefResolveMove === 'function') {
            var ox = (fromX != null) ? fromX : (nx - _vx);
            var oy = (fromY != null) ? fromY : (ny - _vy);
            return mapdefResolveMove(def, ox, oy, nx, ny);
        }
        exploreEnsureSolids();
        var x = nx, y = ny, hit = false;
        var pad = 6;
        for (var pass = 0; pass < 3; pass++) {
            var moved = false;
            for (var i = 0; i < _solidList.length; i++) {
                var s = _solidList[i];
                var dx = x - s.x;
                var dy = y - s.y;
                var need = s.r + pad;
                var d2 = dx * dx + dy * dy;
                if (d2 >= need * need) continue;
                hit = true;
                moved = true;
                var d = Math.sqrt(d2) || 0.001;
                x = s.x + (dx / d) * need;
                y = s.y + (dy / d) * need;
            }
            if (!moved) break;
        }
        if (x < -CAM_MAX_X) x = -CAM_MAX_X;
        if (x > CAM_MAX_X) x = CAM_MAX_X;
        if (y < -CAM_MAX_Y) y = -CAM_MAX_Y;
        if (y > CAM_MAX_Y) y = CAM_MAX_Y;
        return { x: x, y: y, hit: hit };
    }
    function exploreApplySolidMove(fromX, fromY) {
        var r = exploreResolveSolids(_tx, _ty, fromX, fromY);
        if (r.hit || r.x !== _tx || r.y !== _ty) {
            if (Math.abs(r.x - _tx) > 0.2) _vx = 0;
            if (Math.abs(r.y - _ty) > 0.2) _vy = 0;
            _tx = r.x;
            _ty = r.y;
        }
    }

    /** 世界座標外牆＋牆外虛空：走近就看得見，頂死貼牆 */
    function exploreSyncBoundWalls(on) {
        var layer = document.getElementById('explore-bound-layer');
        if (!layer) return;
        var show = !!on;
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
        exploreRefreshCamLimits();
        var on = exploreAllowed();
        var fieldOn = exploreFieldCombatActive();
        var wx = -_cx;
        var wy = _cy;
        bv.style.setProperty('--wx', wx.toFixed(1) + 'px');
        bv.style.setProperty('--wy', wy.toFixed(1) + 'px');
        bv.style.setProperty('--cam-x', _cx.toFixed(1));
        bv.style.setProperty('--cam-y', _cy.toFixed(1));
        if (on && bv.classList.contains('has-bg')) {
            bv.style.backgroundPosition = '50% 50%';
        }
        // 🩹 v3.8.364：俯視地圖跟探索開關；場戰關閉仍可走鳥視圖景＋舊版列排怪
        bv.classList.toggle('is-world-scroll', !!on);
        bv.classList.toggle('is-real-map', !!(on && exploreIsRealMap()));
        bv.classList.toggle('is-exploring', on && (Math.abs(_tx) > 1 || Math.abs(_ty) > 1));
        bv.classList.remove('portal-ready-left', 'portal-ready-right');
        exploreSyncWorldBg(bv, on);
        exploreRenderGrindMarks(fieldOn);
        exploreSyncPropYSort();
        try {
            var pm = document.getElementById('player-morph-sprite');
            if (pm) pm.style.zIndex = String(explorePlayerDepthZ());
        } catch (eZ) {}
    }

    /** 造景依世界 Y 景深；真地圖改相機相對座標以便與人／怪互遮 */
    function exploreSyncPropYSort() {
        var layer = document.getElementById('explore-prop-layer');
        if (!layer || layer.classList.contains('hidden')) return;
        var real = exploreIsRealMap();
        layer.classList.toggle('is-cam-rel', !!real);
        var kids = layer.children;
        for (var i = 0; i < kids.length; i++) {
            var el = kids[i];
            var wx = Number(el.dataset && el.dataset.wx);
            var wy = Number(el.dataset && el.dataset.wy);
            if (!(isFinite(wy))) continue;
            var kind = el.dataset ? el.dataset.kind : '';
            var z = Math.max(18, Math.min(88, Math.round(50 - wy * 0.06)));
            if (kind === 'path') z = 18;
            if (kind === 'tree') z += 2;
            el.style.zIndex = String(z);
            if (real) {
                el.style.left = 'calc(50% + ' + (wx - _cx).toFixed(1) + 'px)';
                el.style.bottom = exploreMobScreenBottom(wy).toFixed(1) + 'px';
            }
        }
    }

    function exploreConsumePendingSpawn() {
        var sx = 0;
        var sy = 0;
        if (_pendingSpawn) {
            sx = Number(_pendingSpawn.x) || 0;
            sy = Number(_pendingSpawn.y) || 0;
            _pendingSpawn = null;
        }
        _tx = sx;
        _ty = sy;
        _cx = sx;
        _cy = sy;
    }

    /**
     * 🌀 傳送術／瞬移卷軸：同圖落點（不清換地圖）。
     * opts.mode：'far'＝手動遠距隨機（預設）｜'near'＝自動逃 BOSS 短距退避
     * 回 true＝有移動。
     */
    function exploreRandomTeleportOnMap(opts) {
        try {
            if (!exploreAllowed()) return false;
            opts = opts || {};
            var mode = opts.mode || (opts.escape ? 'near' : 'far');
            exploreRefreshCamLimits();
            var ox = _tx;
            var oy = _ty;
            var def = exploreActiveMapDef();
            var pool = [];
            var i, hx, hy, d, spot, spots, fixed, ang, dist, nx, ny;

            function pushIfWalkable(x, y, minD, maxD) {
                hx = Math.max(-CAM_MAX_X + 120, Math.min(CAM_MAX_X - 120, x));
                hy = Math.max(-CAM_MAX_Y + 80, Math.min(CAM_MAX_Y - 80, y));
                // 🌀 v3.8.500：額外遠離邊界／海岸（勿貼牆貼海）
                if (def) {
                    var pad = (Number(def.border) || 28) + 48;
                    var maxX = Number(def.maxX) || CAM_MAX_X;
                    var maxY = Number(def.maxY) || CAM_MAX_Y;
                    if (Math.abs(hx) > maxX - pad) return;
                    if (Math.abs(hy) > maxY - pad) return;
                    if (!def.noSea && def.seaY != null && hy < (Number(def.seaY) + 72)) return;
                }
                if (def && typeof mapdefResolveMove === 'function') {
                    fixed = mapdefResolveMove(def, ox, oy, hx, hy);
                    hx = fixed.x; hy = fixed.y;
                    if (typeof mapdefWalkable === 'function' && !mapdefWalkable(def, hx, hy)) return;
                    // resolve 後再驗一次海／邊界
                    if (def && !def.noSea && def.seaY != null && hy < (Number(def.seaY) + 72)) return;
                    var pad2 = (Number(def.border) || 28) + 40;
                    if (Math.abs(hx) > (Number(def.maxX) || CAM_MAX_X) - pad2) return;
                    if (Math.abs(hy) > (Number(def.maxY) || CAM_MAX_Y) - pad2) return;
                } else {
                    fixed = exploreResolveSolids(hx, hy, ox, oy);
                    hx = fixed.x; hy = fixed.y;
                }
                d = Math.hypot(hx - ox, hy - oy);
                if (minD != null && d < minD) return;
                if (maxD != null && d > maxD) return;
                pool.push({ x: hx, y: hy, d: d });
            }

            if (mode === 'near') {
                // 短距退避：優先背離最近 BOSS，距離約 110~240
                var awayX = (Math.random() - 0.5);
                var awayY = (Math.random() - 0.5);
                try {
                    if (typeof mapState !== 'undefined' && mapState && mapState.mobs) {
                        var best = null, bd = 1e9, m, md;
                        for (i = 0; i < mapState.mobs.length; i++) {
                            m = mapState.mobs[i];
                            if (!m || m._dead || !(m.curHp > 0) || !m.boss) continue;
                            if (m._fx == null) continue;
                            md = Math.hypot(m._fx - ox, (m._fy || 0) - oy);
                            if (md < bd) { bd = md; best = m; }
                        }
                        if (best) {
                            awayX = ox - best._fx;
                            awayY = oy - (best._fy || 0);
                        }
                    }
                } catch (eBoss) {}
                var alen = Math.hypot(awayX, awayY) || 1;
                awayX /= alen; awayY /= alen;
                for (i = 0; i < 20; i++) {
                    ang = Math.atan2(awayY, awayX) + (Math.random() - 0.5) * 1.2;
                    dist = 110 + Math.random() * 130;
                    pushIfWalkable(ox + Math.cos(ang) * dist, oy + Math.sin(ang) * dist, 80, 280);
                }
                // 補純隨機短跳
                for (i = 0; i < 16 && pool.length < 4; i++) {
                    ang = Math.random() * Math.PI * 2;
                    dist = 100 + Math.random() * 140;
                    pushIfWalkable(ox + Math.cos(ang) * dist, oy + Math.sin(ang) * dist, 70, 300);
                }
            } else {
                // 遠距：練功點＋全圖隨機（min ≥ 320）
                var minDist = 320;
                spots = exploreActiveGrindSpots() || [];
                for (i = 0; i < spots.length; i++) {
                    spot = spots[i];
                    if (!spot) continue;
                    nx = Number(spot.x) || 0;
                    ny = Number(spot.y) || 0;
                    nx += (Math.random() - 0.5) * 80;
                    ny += (Math.random() - 0.5) * 60;
                    pushIfWalkable(nx, ny, minDist, null);
                }
                for (i = 0; i < 40; i++) {
                    pushIfWalkable(
                        (Math.random() * 2 - 1) * (CAM_MAX_X - 160),
                        (Math.random() * 2 - 1) * (CAM_MAX_Y - 120),
                        minDist,
                        null
                    );
                }
                if (!pool.length) {
                    for (i = 0; i < 24; i++) {
                        pushIfWalkable(
                            (Math.random() * 2 - 1) * (CAM_MAX_X - 200),
                            (Math.random() * 2 - 1) * (CAM_MAX_Y - 150),
                            80,
                            null
                        );
                    }
                }
            }

            if (!pool.length) return false;

            var pick = pool[(Math.random() * pool.length) | 0];
            _tx = pick.x;
            _ty = pick.y;
            _cx = _tx;
            _cy = _ty;
            _vx = 0;
            _vy = 0;
            _moving = false;
            _walkPhase = 0;
            _tapMove.active = false;
            try { exploreApplyWorld(); } catch (eAw) {}
            try { exploreRenderHint(); } catch (eRh) {}
            return true;
        } catch (e) { return false; }
    }

    function exploreReset(reason) {
        exploreRefreshCamLimits();
        exploreConsumePendingSpawn();
        _vx = 0;
        _vy = 0;
        _moving = false;
        _walkPhase = 0;
        _camMoved = false;
        _faceHold = 0;
        _tapMove.active = false;
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
            if (Math.hypot(fx - _tx, fy - _ty) > PICKUP_PX) continue;
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
        var spots = exploreActiveGrindSpots();
        var kids = layer.querySelectorAll('.explore-grind-mark');
        if (kids.length !== spots.length) {
            layer.innerHTML = '';
            for (var i = 0; i < spots.length; i++) {
                var s = spots[i];
                var el = document.createElement('div');
                el.className = 'explore-grind-mark';
                el.setAttribute('data-spot', String(s.id));
                el.innerHTML = '<span class="explore-grind-dot" aria-hidden="true"></span>';
                layer.appendChild(el);
            }
            kids = layer.querySelectorAll('.explore-grind-mark');
        }
        for (var k = 0; k < kids.length; k++) {
            var spot = spots[k];
            if (!spot) continue;
            var near = Math.hypot(_tx - spot.x, _ty - (spot.y || 0)) < 160;
            kids[k].style.left = 'calc(50% + ' + spot.x + 'px)';
            kids[k].style.bottom = (exploreGroundYLive() + (spot.y || 0)) + 'px';
            kids[k].classList.toggle('is-near', near);
        }
    }

    /** 地圖邊界——v3.8.477 起不再顯示東西南北文字指引（僅保留壓暗 class） */
    function exploreRenderEdges() {
        var layer = document.getElementById('explore-edge-layer');
        if (layer) {
            layer.classList.add('hidden');
            layer.style.display = 'none';
        }
        var on = exploreAllowed() && exploreFieldCombatActive();
        if (!on) {
            var bv0 = document.getElementById('battle-view');
            if (bv0) bv0.classList.remove('at-map-edge', 'near-map-edge', 'edge-w', 'edge-e', 'edge-n', 'edge-s', 'portal-ready-left', 'portal-ready-right', 'map-walled');
            return;
        }
        var edgeWarn = Math.max(160, Math.min(EDGE_WARN, Math.floor(CAM_MAX_X * 0.2)));
        var w = _cx <= -CAM_MAX_X + edgeWarn;
        var e = _cx >= CAM_MAX_X - edgeWarn;
        var n = _cy >= CAM_MAX_Y - edgeWarn;
        var s = _cy <= -CAM_MAX_Y + edgeWarn;
        var atW = _cx <= -CAM_MAX_X + 4;
        var atE = _cx >= CAM_MAX_X - 4;
        var atN = _cy >= CAM_MAX_Y - 4;
        var atS = _cy <= -CAM_MAX_Y + 4;
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


    function exploreDoPortal(dest, portalMeta) {
        if (!dest || _portalBusy) return false;
        _portalBusy = true;
        _portalHoldL = 0;
        _portalHoldR = 0;
        try {
            var meta = portalMeta || null;
            if (meta && (meta.destX != null || meta.destY != null)) {
                _pendingSpawn = {
                    x: Number(meta.destX) || 0,
                    y: Number(meta.destY) || 0
                };
            } else {
                _pendingSpawn = null;
            }
            var sel = document.getElementById('map-select');
            if (sel) {
                // 確保選單有該選項
                var ok = false;
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value === dest) { ok = true; break; }
                }
                if (!ok) {
                    var opt = document.createElement('option');
                    opt.value = dest;
                    opt.textContent = dest;
                    sel.appendChild(opt);
                }
                sel.value = dest;
            }
            if (typeof changeMap === 'function') changeMap(true);
            else if (typeof mapState !== 'undefined') mapState.current = dest;
            try {
                if (typeof logSys === 'function') logSys('<span class="text-sky-300">你進入了傳送門。</span>');
            } catch (eL) {}
        } catch (eP) {
            _portalBusy = false;
            _pendingSpawn = null;
            return false;
        }
        setTimeout(function () { _portalBusy = false; }, 900);
        return true;
    }

    function exploreRenderHint() {
        var leftBtn = document.getElementById('explore-portal-left');
        var rightBtn = document.getElementById('explore-portal-right');
        var layer = document.getElementById('explore-exit-layer');
        var hint = document.getElementById('explore-hint');
        if (layer) layer.classList.add('hidden');
        // 🩹 v3.8.406：真地圖狀態列＋傳送提示
        var portal = null;
        try {
            if (exploreIsRealMap() && typeof mapdefPortalAt === 'function') {
                portal = mapdefPortalAt(mapState.current, _tx, _ty);
            }
        } catch (ePr) {}
        if (leftBtn) {
            leftBtn.classList.toggle('hidden', !(portal && portal.side === 'west'));
            if (portal && portal.side === 'west') leftBtn.textContent = portal.label || '← 傳送';
        }
        if (rightBtn) {
            var rightSide = !!(portal && portal.side && portal.side !== 'west');
            rightBtn.classList.toggle('hidden', !rightSide);
            if (rightSide) rightBtn.textContent = portal.label || '傳送 →';
        }
        // 🩹 v3.8.450：上方位置／狀態列永久關閉（傳送仍靠門口標示與按鍵）
        if (hint) {
            hint.classList.add('hidden');
            hint.classList.remove('is-real-map-hint');
            hint.textContent = '';
        }
        exploreSyncSeaMask();
        exploreSyncPortalMarkers();
    }

    /** 南岸海水半透明帶：真地圖視覺可辨（地監 noSea 關閉） */
    function exploreSyncSeaMask() {
        var mask = document.getElementById('explore-sea-mask');
        if (!mask) return;
        var def = exploreActiveMapDef();
        var on = exploreAllowed() && exploreIsRealMap() && !(def && def.noSea);
        mask.classList.toggle('hidden', !on);
        if (!on) return;
        var seaY = (def && def.seaY != null) ? def.seaY : -300;
        var maxX = (def && def.maxX) ? def.maxX : CAM_MAX_X;
        var maxY = (def && def.maxY) ? def.maxY : CAM_MAX_Y;
        try {
            if (def && typeof mapdefBounds === 'function') {
                var sb = mapdefBounds(def);
                if (sb) {
                    if (sb.seaY != null) seaY = sb.seaY;
                    if (sb.maxX != null) maxX = sb.maxX;
                    if (sb.maxY != null) maxY = sb.maxY;
                }
            }
        } catch (eSea) {}
        var h = Math.max(40, (-seaY) + maxY);
        mask.style.left = 'calc(50% - ' + maxX + 'px)';
        mask.style.width = (maxX * 2) + 'px';
        mask.style.bottom = (exploreGroundYLive() - maxY) + 'px';
        mask.style.height = h + 'px';
    }

    /** 傳送門視覺分類：地監入口／回村／野外 */
    function explorePortalKind(p) {
        var d = String((p && p.dest) || '');
        if (d.indexOf('town_') === 0) return 'town';
        if (/^(zone_|crystal_|rastabad_|shadow_|demon_|eva_|pirate_dungeon|pride_|thebes_|tikal_|antaras_|fafurion_|valakas_|elf_grave|giant_tomb|hidden_cave|dark_magic|necro_|elder_room|sunrise_)/.test(d)) return 'dungeon';
        if (/dungeon|cave|temple|pyramid|altar|lair|tomb|gate|lab|training/.test(d)) return 'dungeon';
        return 'wild';
    }

    /** 地圖上標出傳送門入口（相機相對，每幀更新） */
    function exploreSyncPortalMarkers() {
        var layer = document.getElementById('explore-portal-markers');
        if (!layer) return;
        var on = exploreAllowed() && exploreIsRealMap();
        layer.classList.toggle('hidden', !on);
        if (!on) {
            layer.innerHTML = '';
            layer.removeAttribute('data-key');
            return;
        }
        var mid = (typeof mapState !== 'undefined' && mapState) ? mapState.current : '';
        var portals = [];
        try {
            if (typeof mapdefPortals === 'function') portals = mapdefPortals(mid) || [];
        } catch (ePm) {}
        var key = mid + ':' + portals.length + ':gate441';
        if (layer.getAttribute('data-key') !== key) {
            var html = '';
            for (var i = 0; i < portals.length; i++) {
                var p = portals[i];
                if (!p) continue;
                var side = p.side || 'gate';
                var kind = explorePortalKind(p);
                var lab = String(p.label || '傳送門').replace(/</g, '&lt;');
                html += '<div class="explore-portal-mark explore-portal-mark-' + side
                    + ' explore-portal-kind-' + kind
                    + '" data-pi="' + i + '">'
                    + '<div class="explore-portal-arch" aria-hidden="true">'
                    + '<span class="explore-portal-pillar explore-portal-pillar-l"></span>'
                    + '<span class="explore-portal-mouth"><span class="explore-portal-mist"></span></span>'
                    + '<span class="explore-portal-pillar explore-portal-pillar-r"></span>'
                    + '<span class="explore-portal-lintel"></span>'
                    + '<span class="explore-portal-steps"></span>'
                    + '</div>'
                    + '<div class="explore-portal-label">' + lab + '</div>'
                    + '</div>';
            }
            layer.innerHTML = html;
            layer.setAttribute('data-key', key);
        }
        var kids = layer.children;
        for (var j = 0; j < kids.length; j++) {
            var el = kids[j];
            var idx = parseInt(el.getAttribute('data-pi'), 10) || 0;
            var pt = portals[idx];
            if (!pt) continue;
            var cx = pt.x + (pt.w || 40) * 0.5;
            var cy = pt.y + (pt.h || 40) * 0.5;
            el.style.left = 'calc(50% + ' + exploreFieldScreenX(cx).toFixed(1) + 'px)';
            el.style.bottom = exploreMobScreenBottom(cy).toFixed(1) + 'px';
            // 走近入口時加強存在感
            var near = false;
            try {
                if (typeof mapdefPortalAt === 'function') {
                    var hit = mapdefPortalAt(mid, _tx, _ty);
                    near = !!(hit && hit.id === pt.id);
                }
            } catch (eN) {}
            el.classList.toggle('is-near', near);
        }
    }

    /** 走進傳送門熱區並停留 → 切圖 */
    function exploreTryPortal() {
        if (!exploreAllowed() || explorePlayerDead() || _portalBusy) return false;
        if (!exploreIsRealMap()) return false;
        var portal = null;
        try {
            if (typeof mapdefPortalAt === 'function') portal = mapdefPortalAt(mapState.current, _tx, _ty);
        } catch (eT) {}
        if (!portal || !portal.dest) {
            _portalHoldL = 0;
            _portalHoldR = 0;
            return false;
        }
        if (portal.side === 'west') {
            _portalHoldL++;
            _portalHoldR = 0;
            if (_portalHoldL >= PORTAL_HOLD_TICKS) return exploreDoPortal(portal.dest, portal);
        } else {
            _portalHoldR++;
            _portalHoldL = 0;
            if (_portalHoldR >= PORTAL_HOLD_TICKS) return exploreDoPortal(portal.dest, portal);
        }
        return true;
    }

    function exploreSetVirtualStick(dx, dy, active) {
        _vStick.dx = Number(dx) || 0;
        _vStick.dy = Number(dy) || 0;
        _vStick.active = !!active;
        if (!_vStick.active) {
            _vStick.dx = 0;
            _vStick.dy = 0;
        } else {
            _tapMove.active = false;
        }
    }

    function exploreClearTapMove() {
        _tapMove.active = false;
    }

    /** 點螢幕／戰場＝走向該世界座標（相對相機） */
    function exploreSetTapMoveFromScreen(clientX, clientY) {
        if (!exploreAllowed() || explorePlayerDead()) return;
        var bv = document.getElementById('battle-view');
        if (!bv) return;
        var r = bv.getBoundingClientRect();
        if (!(r.width > 40 && r.height > 40)) return;
        var sx = clientX - (r.left + r.width * 0.5);
        var syUp = (r.top + r.height * 0.5) - clientY;
        _tapMove.tx = _cx + sx;
        _tapMove.ty = _cy + syUp * 0.9;
        if (_tapMove.tx < -CAM_MAX_X) _tapMove.tx = -CAM_MAX_X;
        if (_tapMove.tx > CAM_MAX_X) _tapMove.tx = CAM_MAX_X;
        if (_tapMove.ty < -CAM_MAX_Y) _tapMove.ty = -CAM_MAX_Y;
        if (_tapMove.ty > CAM_MAX_Y) _tapMove.ty = CAM_MAX_Y;
        _tapMove.active = true;
    }

    function exploreReadInput() {
        var l = !!( _keys.ArrowLeft || _keys.a || _keys.A );
        var r = !!( _keys.ArrowRight || _keys.d || _keys.D );
        var u = !!( _keys.ArrowUp || _keys.w || _keys.W );
        var d = !!( _keys.ArrowDown || _keys.s || _keys.S );
        var dx = (r ? 1 : 0) - (l ? 1 : 0);
        var dy = (d ? 1 : 0) - (u ? 1 : 0);
        var manual = !!(dx || dy);
        if (manual) _tapMove.active = false;
        if (_vStick.active && (Math.abs(_vStick.dx) > 0.01 || Math.abs(_vStick.dy) > 0.01)) {
            dx = _vStick.dx;
            dy = _vStick.dy;
            manual = true;
            _tapMove.active = false;
        }
        var fromTap = false;
        if (!manual && _tapMove.active) {
            var tdx = _tapMove.tx - _tx;
            var tdy = _tapMove.ty - _ty;
            var td = Math.hypot(tdx, tdy);
            if (td <= TAP_ARRIVE) {
                _tapMove.active = false;
                dx = 0;
                dy = 0;
            } else {
                dx = tdx / td;
                dy = -tdy / td;
                fromTap = true;
                manual = true; // 玩家點螢幕也算手動，暫停自動追
            }
        }
        if (dx && dy) {
            var len = Math.hypot(dx, dy) || 1;
            if (len > 1) { dx /= len; dy /= len; }
        }
        return {
            dx: dx,
            dy: dy,
            manual: manual,
            fromTap: fromTap,
            left: l || (_vStick.active && _vStick.dx < -0.2) || (dx < -0.2),
            right: r || (_vStick.active && _vStick.dx > 0.2) || (dx > 0.2)
        };
    }

    function explorePlayerActionLocked() {
        return false;
    }

    function exploreTick() {
        if (!exploreAllowed()) {
            if (_moving || document.getElementById('battle-view') && document.getElementById('battle-view').classList.contains('is-world-scroll')) {
                _moving = false;
                _vx = 0;
                _vy = 0;
                _tapMove.active = false;
                exploreApplyWorld();
                exploreRenderHint();
                exploreRenderEdges();
            }
            return;
        }
        _tickN = (_tickN + 1) | 0;
        var mapId = mapState.current;
        if (mapId !== _lastMap) {
            _lastMap = mapId;
            exploreConsumePendingSpawn();
            _vx = 0;
            _vy = 0;
            _walkPhase = 0;
            _tapMove.active = false;
        }
        // 💀 死亡不可移動（清鍵＋停步）
        if (explorePlayerDead()) {
            _keys = Object.create(null);
            _vStick.active = false;
            _vStick.dx = 0;
            _vStick.dy = 0;
            _tapMove.active = false;
            _vx = 0;
            _vy = 0;
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
        var wantMove = !!(inp.dx || inp.dy);
        var autoDrive = false;
        var movedDist = 0;
        // 🩹 v3.8.419：攻擊不鎖步（變身攻擊動畫長會感覺變慢）
        _vx = 0;
        _vy = 0;
        _moving = false;
        if (wantMove && inp.manual) {
            var wdx = inp.dx;
            var wdy = -inp.dy;
            if (Math.abs(wdx) > 0.001 || Math.abs(wdy) > 0.001) {
                exploreSetFaceFromVec(inp.dx, inp.dy);
                movedDist = explorePlayerWalkStep(wdx, wdy);
                _moving = movedDist > 0.08;
            }
        } else {
            autoDrive = exploreCombatCamChaseTick(false);
            _moving = !!autoDrive || !!_moving;
        }
        if (_tx < -CAM_MAX_X) _tx = -CAM_MAX_X;
        if (_tx > CAM_MAX_X) _tx = CAM_MAX_X;
        if (_ty < -CAM_MAX_Y) _ty = -CAM_MAX_Y;
        if (_ty > CAM_MAX_Y) _ty = CAM_MAX_Y;
        {
            var realMap = exploreIsRealMap();
            var viewBiasX = exploreViewCenterBiasX();
            var wantCx = _tx - viewBiasX;
            if (realMap) {
                if (_cx !== wantCx || _cy !== _ty) {
                    _cx = wantCx;
                    _cy = _ty;
                    _camMoved = true;
                }
            } else {
                var _lerp = (wantMove || autoDrive || _moving) ? 1.0 : 0.85;
                var _lx = (wantCx - _cx) * _lerp;
                var _ly = (_ty - _cy) * _lerp;
                if (Math.abs(_lx) > 0.03 || Math.abs(_ly) > 0.03 || wantMove || autoDrive) {
                    _cx += _lx;
                    _cy += _ly;
                    movedDist = Math.max(movedDist, Math.hypot(_lx, _ly));
                    _camMoved = true;
                } else {
                    _cx = wantCx;
                    _cy = _ty;
                }
            }
            if (_cx < -CAM_MAX_X) _cx = -CAM_MAX_X;
            if (_cx > CAM_MAX_X) _cx = CAM_MAX_X;
            if (_cy < -CAM_MAX_Y) _cy = -CAM_MAX_Y;
            if (_cy > CAM_MAX_Y) _cy = CAM_MAX_Y;
        }

        exploreMobChaseTick();

        exploreTryPickupLoot();
        // 🩹 v3.8.481：靜止時降頻世界層／提示（移動或相機動才每 tick）
        var _vizHeavy = !!(wantMove || autoDrive || _camMoved || _moving);
        if (_vizHeavy || (_tickN & 1) === 0) {
            exploreApplyWorld();
            exploreRenderHint();
            exploreRenderEdges();
        }
        exploreEngageRetarget();
        exploreApplyFieldDomPos();
        // 🌐 MMORPG：移動時推送座標給同圖玩家
        try {
            if ((wantMove || autoDrive || _camMoved || _moving) && typeof rtWorldPushMove === 'function') rtWorldPushMove(false);
        } catch (eWsMove) {}
        try { exploreTryPortal(); } catch (ePortal) {}
        // 🩹 v3.8.481：動畫改由 js/09 interval＋RAF 專責（此處再呼叫＝每幀×3 重繪＝延遲主因）
    }

    /** 把場座標寫進既有怪卡 DOM（相機相對＝畫面偏移） */
    var _fieldCardCache = Object.create(null);
    var _fieldCardCacheMl = null;
    function exploreApplyFieldDomPos() {
        if (!exploreFieldCombatActive() || typeof mapState === 'undefined' || !mapState.mobs) return;
        var ml = document.getElementById('mob-list');
        if (!ml || !ml.classList.contains('is-field-combat')) return;
        if (_fieldCardCacheMl !== ml) {
            _fieldCardCache = Object.create(null);
            _fieldCardCacheMl = ml;
        }
        var cull = RENDER_HIDE_PX;
        for (var i = 0; i < mapState.mobs.length; i++) {
            var m = mapState.mobs[i];
            if (!m || m._fx == null) continue;
            var dxCam = (m._fx - _tx);
            var dyCam = ((m._fy || 0) - _ty);
            var far = (dxCam * dxCam + dyCam * dyCam) > (cull * cull);
            var uid = String(m.uid || '');
            var card = _fieldCardCache[uid];
            if (!card || !card.isConnected) {
                card = ml.querySelector('.mob-target[data-uid="' + uid + '"]');
                if (card) _fieldCardCache[uid] = card;
            }
            if (!card) continue;
            if (far) {
                if (card.style.visibility !== 'hidden') {
                    card.style.visibility = 'hidden';
                    card.style.pointerEvents = 'none';
                }
                continue;
            }
            if (card.style.visibility === 'hidden') {
                card.style.visibility = '';
                card.style.pointerEvents = '';
            }
            var depth = exploreFieldDepthStyle(m._fy);
            var sx = exploreFieldScreenX(m._fx);
            var leftStr = 'calc(50% + ' + sx.toFixed(1) + 'px)';
            var botStr = (Number(depth.bottom) || 0).toFixed(1) + 'px';
            if (card.style.left !== leftStr) card.style.left = leftStr;
            if (card.style.bottom !== botStr) card.style.bottom = botStr;
            if (card.style.transform !== depth.transform) card.style.transform = depth.transform;
            var zStr = String(depth.zIndex);
            if (card.style.zIndex !== zStr) card.style.zIndex = zStr;
            var eng = exploreMobInEngageRange(m);
            if (!!card.classList.contains('is-engage') !== eng) card.classList.toggle('is-engage', eng);
            var walking = !!m._animMoving;
            if (!!card.classList.contains('is-mob-walking') !== walking) card.classList.toggle('is-mob-walking', walking);
            var plant = Number(m._mobPlant) || 0;
            var plantOn = !!(walking && plant > 0.35);
            if (!!card.classList.contains('is-mob-plant') !== plantOn) card.classList.toggle('is-mob-plant', plantOn);
            if (walking) {
                var bobY = Number(m._mobBob) || 0;
                var swayX = Math.sin((Number(m._walkPhase) || 0) * Math.PI) * 2.4;
                card.style.setProperty('--mob-walk-bob', bobY.toFixed(2) + 'px');
                card.style.setProperty('--mob-walk-sway', swayX.toFixed(2) + 'px');
                card.style.setProperty('--mob-shadow-scale', (Number(m._mobShadow) || 0.94).toFixed(3));
                card.style.setProperty('--mob-foot-plant', plant.toFixed(3));
            }
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
        if (!document.getElementById('explore-portal-left')) {
            var pl = document.createElement('button');
            pl.type = 'button';
            pl.id = 'explore-portal-left';
            pl.className = 'explore-portal explore-portal-left hidden';
            pl.textContent = '← 村莊';
            bv.appendChild(pl);
            pl.addEventListener('click', function () {
                try {
                    var p = (typeof mapdefPortalAt === 'function') ? mapdefPortalAt(mapState.current, _tx, _ty) : null;
                    if (p && p.side === 'west') exploreDoPortal(p.dest, p);
                } catch (eC) {}
            });
        }
        if (!document.getElementById('explore-portal-right')) {
            var pr = document.createElement('button');
            pr.type = 'button';
            pr.id = 'explore-portal-right';
            pr.className = 'explore-portal explore-portal-right hidden';
            pr.textContent = '港口 →';
            bv.appendChild(pr);
            pr.addEventListener('click', function () {
                try {
                    var p2 = (typeof mapdefPortalAt === 'function') ? mapdefPortalAt(mapState.current, _tx, _ty) : null;
                    if (p2 && p2.side && p2.side !== 'west') exploreDoPortal(p2.dest, p2);
                } catch (eC2) {}
            });
        }
        if (!document.getElementById('explore-portal-markers')) {
            var marks = document.createElement('div');
            marks.id = 'explore-portal-markers';
            marks.className = 'explore-portal-markers hidden';
            marks.setAttribute('aria-hidden', 'true');
            bv.appendChild(marks);
        }
        if (!document.getElementById('explore-hint')) {
            var hint = document.createElement('div');
            hint.id = 'explore-hint';
            hint.className = 'explore-hint hidden';
            bv.appendChild(hint);
        }
        if (!document.getElementById('explore-sea-mask')) {
            var sea = document.createElement('div');
            sea.id = 'explore-sea-mask';
            sea.className = 'explore-sea-mask hidden';
            sea.setAttribute('aria-hidden', 'true');
            var propLayer = document.getElementById('explore-prop-layer');
            if (propLayer && propLayer.parentNode === bv) bv.insertBefore(sea, propLayer);
            else bv.appendChild(sea);
        }
        if (!document.getElementById('explore-foot-patch')) {
            var patch = document.createElement('div');
            patch.id = 'explore-foot-patch';
            patch.className = 'hidden';
            patch.setAttribute('aria-hidden', 'true');
            bv.appendChild(patch);
        }
    }

    function exploreOnMapChange() {
        _propCacheKey = '';
        _solidList = [];
        _solidKey = '';
        exploreEnsureUi();
        exploreReset('map');
        exploreRenderHint();
    }

    // 🩹 v3.8.389：真地圖＝人物螢幕偏移（世界−相機）；其餘鎖中央
    function explorePartySpritePos() {
        var real = exploreIsRealMap();
        var ox = real ? explorePlayerScreenX() : 0;
        var gy = real ? explorePlayerScreenBottom() : (exploreGroundYLive() - FOOT_CONTACT_SINK);
        var pz = explorePlayerDepthZ();
        if (!real) {
            return {
                P: { x: '50%', b: gy, z: pz },
                A: [
                    { x: '43%', b: gy - 6, z: pz - 1 },
                    { x: '57%', b: gy - 6, z: pz - 1 },
                    { x: '38%', b: gy + 8, z: pz + 1 },
                    { x: '62%', b: gy + 8, z: pz + 1 },
                    { x: '46%', b: gy + 14, z: pz + 2 },
                    { x: '54%', b: gy + 14, z: pz + 2 },
                    { x: '50%', b: gy + 20, z: pz + 3 }
                ]
            };
        }
        return {
            P: { dx: ox, x: '50%', b: gy, z: pz },
            A: [
                { dx: ox - 52, x: '50%', b: gy - 6, z: pz - 1 },
                { dx: ox + 52, x: '50%', b: gy - 6, z: pz - 1 },
                { dx: ox - 78, x: '50%', b: gy + 8, z: pz + 1 },
                { dx: ox + 78, x: '50%', b: gy + 8, z: pz + 1 },
                { dx: ox - 28, x: '50%', b: gy + 14, z: pz + 2 },
                { dx: ox + 28, x: '50%', b: gy + 14, z: pz + 2 },
                { dx: ox, x: '50%', b: gy + 20, z: pz + 3 }
            ]
        };
    }

    window.exploreSetVirtualStick = exploreSetVirtualStick;
    window.exploreSetTapMoveFromScreen = exploreSetTapMoveFromScreen;
    window.exploreClearTapMove = exploreClearTapMove;
    window.exploreWorldActive = exploreWorldActive;
    window.exploreIsMoving = exploreIsMoving;
    window.exploreFaceDir = exploreFaceDir;
    window.exploreWalkPhase = exploreWalkPhase;
    window.exploreCamX = exploreCamX;
    window.exploreCamY = exploreCamY;
    window.explorePlayerX = explorePlayerX;
    window.explorePlayerY = explorePlayerY;
    window.explorePlayerScreenX = explorePlayerScreenX;
    window.explorePlayerScreenBottom = explorePlayerScreenBottom;
    window.exploreIsRealMap = exploreIsRealMap;
    window.exploreActiveMapDef = exploreActiveMapDef;
    window.exploreFieldCombatActive = exploreFieldCombatActive;
    window.exploreAssignFieldPos = exploreAssignFieldPos;
    window.exploreEnsureAllFieldPos = exploreEnsureAllFieldPos;
    window.exploreMobScreenDistPx = exploreMobScreenDistPx;
    window.exploreMobInEngageRange = exploreMobInEngageRange;
    window.exploreNearestEngageIdx = exploreNearestEngageIdx;
    window.exploreEngageRetarget = exploreEngageRetarget;
    window.exploreMobShouldSim = exploreMobShouldSim;
    window.exploreMobShouldRender = exploreMobShouldRender;
    window.exploreMobWorldDist = exploreMobWorldDist;
    window.exploreEngagePx = function () { return exploreEngageLimit(); };
    window.exploreEngageLimit = exploreEngageLimit;
    window.exploreTryPortal = exploreTryPortal;
    window.exploreOnMapChange = exploreOnMapChange;
    window.exploreReset = exploreReset;
    window.exploreRandomTeleportOnMap = exploreRandomTeleportOnMap;
    window.exploreVacuumLoot = exploreVacuumLoot;
    window.claimExploreLootEl = claimExploreLootEl;
    window.exploreEnsureUi = exploreEnsureUi;
    window.explorePartySpritePos = explorePartySpritePos;
    window.exploreGroundY = exploreGroundYLive;
    window.exploreFieldFootBottom = exploreFieldFootBottom;
    window.exploreMobScreenBottom = exploreMobScreenBottom;
    window.exploreFieldScreenX = exploreFieldScreenX;
    window.explorePlayerDepthZ = explorePlayerDepthZ;
    window.exploreApplyFieldDomPos = exploreApplyFieldDomPos;
    window.exploreFieldDepthStyle = exploreFieldDepthStyle;
    window.exploreGrindSpots = function () { return exploreActiveGrindSpots().slice(); };
    window.exploreFieldSlotCount = exploreFieldSlotCount;
    window.exploreInitFieldSpawns = exploreInitFieldSpawns;
    window.exploreRespawnDelayJitter = exploreRespawnDelayJitter;
    window.exploreCorridorBgUrl = exploreCorridorBgUrl;
    window.exploreWalkwayBgUrl = exploreWalkwayBgUrl;
    window.exploreBiomeOf = exploreBiomeOf;
    window.exploreTopdownStyle = exploreTopdownStyle;
    window.exploreMapSceneBgUrl = exploreMapSceneBgUrl;
    window.exploreMapFloorOverride = exploreMapFloorOverride;
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
        _vx = 0;
        _vy = 0;
        _tapMove.active = false;
    });

    var _hooked = false;
    function exploreHookChangeMap() {
        if (_hooked || typeof changeMap !== 'function') return;
        _hooked = true;
        var orig = changeMap;
        window.changeMap = function () {
            var r = orig.apply(this, arguments);
            try { exploreOnMapChange(); } catch (e) {}
            // 🌐 P4：切圖後向伺服器申請頻道／進出圖
            try {
                if (typeof rtWorldEnter === 'function' && typeof mapState !== 'undefined' && mapState && mapState.current) {
                    rtWorldEnter(mapState.current);
                }
            } catch (eEnt) {}
            return r;
        };
    }
    setTimeout(exploreHookChangeMap, 0);
    setTimeout(exploreHookChangeMap, 1500);
})();
