/**
 * 🩹 v3.8.415／427～435：真地圖 MapDef（主線野外＋說話之島／古魯丁／奇岩／沙漠／龍之谷地監）
 * 對齊 *_floor.png（1024×1024）＝美術半幅 ±512；v3.9.23 起可走範圍放大＝大地圖探索
 */
(function (global) {
    'use strict';

    var TILE = 64;
    /** 可走＝美術半幅（地板 1024 對齊世界 ±512）；放大會外圈破圖 */
    var REAL_WALK_SCALE_OUTDOOR = 1;
    var REAL_WALK_SCALE_DUNGEON = 1;
    var REAL_ART_HALF = 512;

    var TI_SPAWNS = [
        { id: 0, x: -160, y: 220, label: '北徑草地' },
        { id: 1, x: 40, y: 180, label: '中北空地' },
        { id: 2, x: 200, y: 80, label: '東徑' },
        { id: 3, x: -220, y: 60, label: '西徑' },
        { id: 4, x: 20, y: -20, label: '中央草地' },
        { id: 5, x: 180, y: -100, label: '東南空地' },
        { id: 6, x: -140, y: -80, label: '西南空地' },
        { id: 7, x: 60, y: -180, label: '近岸草地' },
        { id: 8, x: -60, y: 120, label: '路徑折點' },
        { id: 9, x: 260, y: -40, label: '東緣草地' }
    ];

    var TI_ROCKS = [
        { x: -360, y: -420, r: 70 },
        { x: -180, y: -450, r: 64 },
        { x: 40, y: -460, r: 68 },
        { x: 240, y: -440, r: 72 },
        { x: 400, y: -400, r: 66 },
        { x: -460, y: -80, r: 48 },
        { x: 460, y: -60, r: 50 },
        { x: -440, y: 200, r: 44 },
        { x: 440, y: 160, r: 46 },
        { x: -80, y: -140, r: 36 },
        { x: 120, y: 40, r: 32 },
        { x: -200, y: -200, r: 34 },
        { x: -400, y: 420, r: 52 },
        { x: -240, y: 440, r: 48 },
        { x: -300, y: 300, r: 40 }
    ];

    var TI_BOXES = [
        { cx: -340, cy: 390, hw: 55, hh: 48 },
        { cx: -270, cy: 360, hw: 48, hh: 42 }
    ];

    var TI_PORTALS = [
        {
            id: 'to_town',
            dest: 'town_talking',
            x: -500,
            y: 240,
            w: 90,
            h: 200,
            label: '← 說話之島村莊',
            side: 'west'
        },
        {
            id: 'to_port',
            dest: 'talking_island_port',
            x: 410,
            y: -40,
            w: 90,
            h: 220,
            label: '說話之島港口 →',
            side: 'east',
            destX: -280,
            destY: 20
        },
        {
            id: 'to_dungeon',
            dest: 'zone_13',
            x: -70,
            y: 420,
            w: 140,
            h: 70,
            label: '說話之島地監 ↑',
            side: 'north',
            destX: 0,
            destY: -220
        }
    ];

    var PORT_SPAWNS = [
        { id: 0, x: 0, y: 40, label: '中央空地' },
        { id: 1, x: -120, y: 80, label: '西徑' },
        { id: 2, x: 130, y: 60, label: '東徑' },
        { id: 3, x: -40, y: 160, label: '北橋口' },
        { id: 4, x: 50, y: -120, label: '南岸沙地' },
        { id: 5, x: -160, y: -40, label: '西南灘' },
        { id: 6, x: 170, y: -60, label: '東南灘' },
        { id: 7, x: -80, y: -160, label: '南橋口' },
        { id: 8, x: 90, y: 140, label: '東北草地' },
        { id: 9, x: -200, y: 100, label: '西北徑' }
    ];

    var PORT_ROCKS = [
        { x: -420, y: -380, r: 78 },
        { x: -200, y: -430, r: 70 },
        { x: 40, y: -450, r: 72 },
        { x: 260, y: -420, r: 74 },
        { x: 420, y: -360, r: 70 },
        { x: -450, y: -120, r: 62 },
        { x: -460, y: 80, r: 58 },
        { x: -440, y: 280, r: 64 },
        { x: -300, y: 420, r: 68 },
        { x: -60, y: 450, r: 70 },
        { x: 180, y: 440, r: 66 },
        { x: 380, y: 360, r: 62 },
        { x: 450, y: 120, r: 58 },
        { x: 460, y: -80, r: 60 },
        { x: -260, y: 200, r: 42 },
        { x: 240, y: 220, r: 40 },
        { x: -300, y: -160, r: 38 },
        { x: 280, y: -180, r: 40 },
        { x: -100, y: 300, r: 36 },
        { x: 120, y: -280, r: 36 },
        { x: 200, y: 80, r: 28 },
        { x: -180, y: -100, r: 30 },
        { x: 60, y: 200, r: 26 }
    ];

    var PORT_BOXES = [
        { cx: 220, cy: 280, hw: 42, hh: 36 },
        { cx: -40, cy: -300, hw: 48, hh: 28 },
        { cx: -220, cy: 160, hw: 36, hh: 32 }
    ];

    var PORT_PORTALS = [
        {
            id: 'to_island',
            dest: 'talking_island',
            x: -500,
            y: -80,
            w: 90,
            h: 220,
            label: '← 說話之島周邊',
            side: 'west',
            destX: 340,
            destY: 40
        }
    ];

    /* ─── 說話之島地監（俯視地監 1024）─── */
    var DG_SPAWNS = [
        { id: 0, x: 0, y: 0, label: '中央石廳' },
        { id: 1, x: -140, y: 80, label: '西廳' },
        { id: 2, x: 160, y: 100, label: '東廳' },
        { id: 3, x: -40, y: 160, label: '北廊' },
        { id: 4, x: 60, y: -140, label: '南廊' },
        { id: 5, x: -180, y: -60, label: '西南角' },
        { id: 6, x: 180, y: -80, label: '東南角' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 100, y: 180, label: '北岔' },
        { id: 9, x: -200, y: 140, label: '西北廊' }
    ];

    var DG_ROCKS = [
        // 外牆角／石柱感
        { x: -420, y: -420, r: 70 },
        { x: 420, y: -420, r: 70 },
        { x: -420, y: 420, r: 70 },
        { x: 420, y: 420, r: 70 },
        // 🩹 v3.8.439：拿掉 ±460 十字邊石柱（會堵住東西南北傳送廊）
        // 瓦礫堆（對齊俯視地監）
        { x: -220, y: -240, r: 44 },
        { x: 180, y: 40, r: 28 },
        { x: 40, y: 220, r: 34 },
        { x: -80, y: 100, r: 28 },
        { x: 240, y: -160, r: 32 }
    ];

    var DG_BOXES = [
        { cx: -280, cy: -280, hw: 40, hh: 36 },
        { cx: 260, cy: 200, hw: 36, hh: 32 }
    ];

    var DG1_PORTALS = [
        {
            id: 'to_island',
            dest: 'talking_island',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '← 說話之島周邊',
            side: 'south',
            destX: 0,
            destY: 360
        },
        {
            id: 'to_b2',
            dest: 'zone_14',
            x: 410,
            y: -60,
            w: 90,
            h: 160,
            label: '地監 2 樓 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    var DG2_PORTALS = [
        {
            id: 'to_b1',
            dest: 'zone_13',
            x: -500,
            y: -60,
            w: 90,
            h: 160,
            label: '← 地監 1 樓',
            side: 'west',
            destX: 300,
            destY: 0
        }
    ];

    /* ─── 銀騎士地區（俯視野外）─── */
    var SK_SPAWNS = [
        { id: 0, x: 0, y: 40, label: '中央草地' },
        { id: 1, x: -160, y: 120, label: '西北徑' },
        { id: 2, x: 170, y: 100, label: '東北徑' },
        { id: 3, x: -40, y: 200, label: '北緣' },
        { id: 4, x: 80, y: -140, label: '南草地' },
        { id: 5, x: -200, y: -60, label: '西徑' },
        { id: 6, x: 210, y: -40, label: '東徑' },
        { id: 7, x: -100, y: -180, label: '西南' },
        { id: 8, x: 120, y: 180, label: '北岔' },
        { id: 9, x: -180, y: 40, label: '西草地' }
    ];
    var SK_ROCKS = [
        { x: -420, y: -360, r: 56 },
        { x: 400, y: -340, r: 54 },
        { x: -440, y: 200, r: 48 },
        { x: 430, y: 180, r: 50 },
        { x: -80, y: -280, r: 36 },
        { x: 160, y: 60, r: 32 },
        { x: -220, y: 160, r: 34 },
        { x: 60, y: 260, r: 30 },
        { x: -300, y: -100, r: 38 },
        { x: 280, y: -160, r: 36 }
    ];
    var SK_BOXES = [
        { cx: -300, cy: 320, hw: 48, hh: 40 }
    ];
    var SK_PORTALS = [
        {
            id: 'to_town',
            dest: 'town_silver_knight',
            x: -500,
            y: 40,
            w: 90,
            h: 200,
            label: '← 銀騎士村莊',
            side: 'west'
        },
        {
            id: 'to_zone01',
            dest: 'zone_01',
            x: 410,
            y: -40,
            w: 90,
            h: 200,
            label: '妖精森林周邊 →',
            side: 'east',
            destX: -280,
            destY: 20
        }
    ];

    /* ─── 妖精森林周邊（俯視密林）─── */
    var Z01_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '林間空地' },
        { id: 1, x: -140, y: 100, label: '西林徑' },
        { id: 2, x: 150, y: 80, label: '東林徑' },
        { id: 3, x: -60, y: 180, label: '北密林' },
        { id: 4, x: 70, y: -150, label: '南徑' },
        { id: 5, x: -180, y: -50, label: '西南林' },
        { id: 6, x: 190, y: -70, label: '東南林' },
        { id: 7, x: -100, y: -170, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北林' }
    ];
    var Z01_ROCKS = [
        { x: -380, y: -300, r: 52 },
        { x: 360, y: -280, r: 50 },
        { x: -400, y: 220, r: 48 },
        { x: 390, y: 200, r: 46 },
        { x: -160, y: 40, r: 40 },
        { x: 180, y: -40, r: 42 },
        { x: -40, y: 240, r: 36 },
        { x: 80, y: -240, r: 38 },
        { x: -260, y: -140, r: 44 },
        { x: 250, y: 140, r: 40 },
        { x: 40, y: 100, r: 28 },
        { x: -120, y: -100, r: 30 }
    ];
    var Z01_PORTALS = [
        {
            id: 'to_sk',
            dest: 'silver_knight',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 銀騎士地區',
            side: 'west',
            destX: 300,
            destY: 20
        },
        {
            id: 'to_elf',
            dest: 'elf_forest',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '妖魔森林 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_sleep',
            dest: 'zone_15',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '眠龍洞穴 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 妖魔森林（俯視密林·更深）─── */
    var ELF_SPAWNS = [
        { id: 0, x: 20, y: 0, label: '森林中心' },
        { id: 1, x: -150, y: 90, label: '西密林' },
        { id: 2, x: 160, y: 70, label: '東密林' },
        { id: 3, x: -50, y: 190, label: '北林' },
        { id: 4, x: 90, y: -160, label: '南徑' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -80, label: '東南' },
        { id: 7, x: -80, y: -190, label: '南岔' },
        { id: 8, x: 100, y: 180, label: '北岔' },
        { id: 9, x: -210, y: 130, label: '西北' }
    ];
    var ELF_ROCKS = [
        { x: -400, y: -320, r: 58 },
        { x: 380, y: -300, r: 56 },
        { x: -420, y: 240, r: 52 },
        { x: 410, y: 220, r: 50 },
        { x: -180, y: 60, r: 44 },
        { x: 200, y: -20, r: 46 },
        { x: -60, y: 260, r: 40 },
        { x: 100, y: -260, r: 42 },
        { x: -280, y: -160, r: 48 },
        { x: 270, y: 150, r: 44 },
        { x: 20, y: 120, r: 32 },
        { x: -140, y: -120, r: 34 },
        { x: 140, y: 40, r: 30 }
    ];
    var ELF_BOXES = [
        { cx: 240, cy: 280, hw: 40, hh: 36 }
    ];
    var ELF_PORTALS = [
        {
            id: 'to_z01',
            dest: 'zone_01',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 妖精森林周邊',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_gludio',
            dest: 'gludio',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '古魯丁野外 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 古魯丁野外（俯視草原）─── */
    var GLU_SPAWNS = [
        { id: 0, x: 0, y: 30, label: '中央平原' },
        { id: 1, x: -150, y: 110, label: '西北徑' },
        { id: 2, x: 160, y: 90, label: '東北徑' },
        { id: 3, x: -40, y: 190, label: '北緣' },
        { id: 4, x: 90, y: -150, label: '南草地' },
        { id: 5, x: -190, y: -50, label: '西徑' },
        { id: 6, x: 200, y: -30, label: '東徑' },
        { id: 7, x: -100, y: -180, label: '西南' },
        { id: 8, x: 120, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西草地' }
    ];
    var GLU_ROCKS = [
        { x: -400, y: -340, r: 54 },
        { x: 390, y: -320, r: 52 },
        { x: -420, y: 210, r: 48 },
        { x: 410, y: 190, r: 50 },
        { x: -100, y: -260, r: 36 },
        { x: 150, y: 50, r: 32 },
        { x: -230, y: 140, r: 34 },
        { x: 50, y: 250, r: 30 },
        { x: -290, y: -90, r: 38 },
        { x: 270, y: -150, r: 36 },
        { x: 20, y: 80, r: 28 }
    ];
    var GLU_BOXES = [
        { cx: -280, cy: 300, hw: 44, hh: 38 }
    ];
    var GLU_PORTALS = [
        {
            id: 'to_elf',
            dest: 'elf_forest',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 妖魔森林',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_windwood',
            dest: 'windwood',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '風木野外 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_town_gludin',
            dest: 'town_gludin',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '古魯丁村莊 ↑',
            side: 'north',
            destX: 0,
            destY: 0
        },
        {
            id: 'to_dg1',
            dest: 'zone_06',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '古魯丁地監 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 風木野外（俯視綠林）─── */
    var WW_SPAWNS = [
        { id: 0, x: 10, y: 20, label: '林間空地' },
        { id: 1, x: -140, y: 100, label: '西林徑' },
        { id: 2, x: 150, y: 80, label: '東林徑' },
        { id: 3, x: -50, y: 180, label: '北密林' },
        { id: 4, x: 80, y: -160, label: '南徑' },
        { id: 5, x: -180, y: -40, label: '西南林' },
        { id: 6, x: 190, y: -70, label: '東南林' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北林' }
    ];
    var WW_ROCKS = [
        { x: -390, y: -310, r: 56 },
        { x: 370, y: -290, r: 54 },
        { x: -410, y: 230, r: 50 },
        { x: 400, y: 210, r: 48 },
        { x: -170, y: 50, r: 42 },
        { x: 190, y: -30, r: 44 },
        { x: -50, y: 250, r: 38 },
        { x: 90, y: -250, r: 40 },
        { x: -270, y: -150, r: 46 },
        { x: 260, y: 140, r: 42 },
        { x: 30, y: 90, r: 30 },
        { x: -130, y: -110, r: 32 }
    ];
    var WW_BOXES = [
        { cx: 220, cy: 270, hw: 42, hh: 36 }
    ];
    var WW_PORTALS = [
        {
            id: 'to_gludio',
            dest: 'gludio',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 古魯丁野外',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_desert',
            dest: 'desert',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '沙漠 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 沙漠（俯視沙地）─── */
    var DES_SPAWNS = [
        { id: 0, x: 0, y: 0, label: '沙丘中央' },
        { id: 1, x: -160, y: 100, label: '西沙徑' },
        { id: 2, x: 170, y: 80, label: '東沙徑' },
        { id: 3, x: -40, y: 180, label: '北緣' },
        { id: 4, x: 70, y: -160, label: '南沙地' },
        { id: 5, x: -200, y: -40, label: '西南沙' },
        { id: 6, x: 210, y: -60, label: '東南沙' },
        { id: 7, x: -90, y: -190, label: '南岔' },
        { id: 8, x: 100, y: 170, label: '北岔' },
        { id: 9, x: -220, y: 110, label: '西北沙' }
    ];
    var DES_ROCKS = [
        { x: -380, y: -300, r: 60 },
        { x: 360, y: -280, r: 58 },
        { x: -400, y: 200, r: 54 },
        { x: 390, y: 180, r: 52 },
        { x: -140, y: 40, r: 40 },
        { x: 160, y: -50, r: 42 },
        { x: -60, y: 240, r: 36 },
        { x: 80, y: -240, r: 38 },
        { x: -260, y: -140, r: 48 },
        { x: 250, y: 130, r: 46 },
        { x: 40, y: 100, r: 32 },
        { x: -120, y: -100, r: 34 },
        { x: 200, y: 40, r: 30 }
    ];
    var DES_BOXES = [
        { cx: -220, cy: 280, hw: 48, hh: 40 }
    ];
    var DES_PORTALS = [
        {
            id: 'to_windwood',
            dest: 'windwood',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 風木野外',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_kent',
            dest: 'kent',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '肯特野外 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_dg1',
            dest: 'zone_22',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '沙漠地監 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        },
        {
            id: 'to_ant',
            dest: 'zone_32',
            x: 120,
            y: -500,
            w: 140,
            h: 70,
            label: '螞蟻洞窟 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 肯特野外（俯視草原）─── */
    var KENT_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '中央空地' },
        { id: 1, x: -150, y: 100, label: '西北徑' },
        { id: 2, x: 160, y: 80, label: '東北徑' },
        { id: 3, x: -40, y: 190, label: '北緣' },
        { id: 4, x: 80, y: -150, label: '南草地' },
        { id: 5, x: -190, y: -40, label: '西徑' },
        { id: 6, x: 200, y: -50, label: '東徑' },
        { id: 7, x: -100, y: -180, label: '西南' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 40, label: '西草地' }
    ];
    var KENT_ROCKS = [
        { x: -410, y: -330, r: 54 },
        { x: 400, y: -310, r: 52 },
        { x: -430, y: 200, r: 48 },
        { x: 420, y: 180, r: 50 },
        { x: -90, y: -250, r: 36 },
        { x: 140, y: 60, r: 32 },
        { x: -220, y: 150, r: 34 },
        { x: 60, y: 260, r: 30 },
        { x: -300, y: -100, r: 38 },
        { x: 280, y: -160, r: 36 },
        { x: 10, y: 90, r: 28 }
    ];
    var KENT_BOXES = [
        { cx: 260, cy: 290, hw: 46, hh: 40 }
    ];
    var KENT_PORTALS = [
        {
            id: 'to_desert',
            dest: 'desert',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 沙漠',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_dragon',
            dest: 'dragon_valley',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '龍之谷 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 龍之谷（俯視熔岩谷）─── */
    var DV_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '谷心空地' },
        { id: 1, x: -160, y: 110, label: '西岩徑' },
        { id: 2, x: 170, y: 90, label: '東岩徑' },
        { id: 3, x: -40, y: 190, label: '北崖' },
        { id: 4, x: 80, y: -150, label: '南熔岩緣' },
        { id: 5, x: -200, y: -40, label: '西南岩' },
        { id: 6, x: 210, y: -60, label: '東南岩' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 120, y: 170, label: '北岔' },
        { id: 9, x: -220, y: 50, label: '西北崖' }
    ];
    var DV_ROCKS = [
        { x: -390, y: -300, r: 62 },
        { x: 380, y: -280, r: 60 },
        { x: -410, y: 220, r: 56 },
        { x: 400, y: 200, r: 54 },
        { x: -150, y: 40, r: 44 },
        { x: 170, y: -30, r: 46 },
        { x: -50, y: 250, r: 40 },
        { x: 90, y: -240, r: 42 },
        { x: -280, y: -140, r: 50 },
        { x: 260, y: 140, r: 48 },
        { x: 30, y: 100, r: 34 },
        { x: -130, y: -100, r: 36 },
        { x: 200, y: 50, r: 32 }
    ];
    var DV_BOXES = [
        { cx: -240, cy: 290, hw: 50, hh: 42 }
    ];
    var DV_PORTALS = [
        {
            id: 'to_kent',
            dest: 'kent',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 肯特野外',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_fire',
            dest: 'fire_dragon',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '火龍窟 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_dg1',
            dest: 'zone_26',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '龍之谷地監 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 火龍窟（俯視熔岩洞窟）─── */
    var FD_SPAWNS = [
        { id: 0, x: 0, y: 0, label: '熔岩中央' },
        { id: 1, x: -140, y: 90, label: '西廊' },
        { id: 2, x: 150, y: 70, label: '東廊' },
        { id: 3, x: -50, y: 170, label: '北廊' },
        { id: 4, x: 70, y: -150, label: '南廊' },
        { id: 5, x: -180, y: -50, label: '西南角' },
        { id: 6, x: 190, y: -70, label: '東南角' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 100, y: 180, label: '北岔' },
        { id: 9, x: -200, y: 130, label: '西北廊' }
    ];
    var FD_ROCKS = [
        { x: -360, y: -280, r: 58 },
        { x: 350, y: -260, r: 56 },
        { x: -380, y: 200, r: 54 },
        { x: 370, y: 180, r: 52 },
        { x: -160, y: 30, r: 42 },
        { x: 180, y: -40, r: 44 },
        { x: -40, y: 240, r: 38 },
        { x: 80, y: -230, r: 40 },
        { x: -250, y: -130, r: 48 },
        { x: 240, y: 120, r: 46 },
        { x: 20, y: 80, r: 32 },
        { x: -110, y: -90, r: 34 },
        { x: 130, y: 40, r: 30 },
        { x: -200, y: 160, r: 36 }
    ];
    var FD_BOXES = [
        { cx: 220, cy: 260, hw: 44, hh: 38 }
    ];
    var FD_PORTALS = [
        {
            id: 'to_dv',
            dest: 'dragon_valley',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 龍之谷',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_giran',
            dest: 'giran',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '奇岩周邊 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 奇岩周邊（俯視城鎮外圍）─── */
    var GIR_SPAWNS = [
        { id: 0, x: 10, y: 20, label: '中央大道' },
        { id: 1, x: -150, y: 100, label: '西徑' },
        { id: 2, x: 160, y: 80, label: '東徑' },
        { id: 3, x: -40, y: 180, label: '北緣' },
        { id: 4, x: 80, y: -150, label: '南草地' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -60, label: '東南' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北' }
    ];
    var GIR_ROCKS = [
        { x: -400, y: -320, r: 52 },
        { x: 390, y: -300, r: 50 },
        { x: -420, y: 200, r: 48 },
        { x: 410, y: 180, r: 46 },
        { x: -100, y: -240, r: 34 },
        { x: 150, y: 50, r: 30 },
        { x: -220, y: 140, r: 32 },
        { x: 60, y: 250, r: 28 },
        { x: -290, y: -90, r: 36 },
        { x: 270, y: -150, r: 34 },
        { x: 20, y: 90, r: 26 }
    ];
    var GIR_BOXES = [
        { cx: -260, cy: 280, hw: 48, hh: 40 }
    ];
    var GIR_PORTALS = [
        {
            id: 'to_fire',
            dest: 'fire_dragon',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 火龍窟',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_heine',
            dest: 'heine',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '海音 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_town',
            dest: 'town_giran',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '奇岩城鎮 ↑',
            side: 'north'
        },
        {
            id: 'to_dg1',
            dest: 'zone_18',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '奇岩地監 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 海音（俯視海岸）─── */
    var HEI_SPAWNS = [
        { id: 0, x: 0, y: 40, label: '中央濕地' },
        { id: 1, x: -150, y: 120, label: '西徑' },
        { id: 2, x: 160, y: 100, label: '東徑' },
        { id: 3, x: -40, y: 200, label: '北緣' },
        { id: 4, x: 70, y: -80, label: '近岸草地' },
        { id: 5, x: -190, y: -20, label: '西南灘' },
        { id: 6, x: 200, y: -40, label: '東南灘' },
        { id: 7, x: -90, y: -120, label: '南岔' },
        { id: 8, x: 110, y: 180, label: '北岔' },
        { id: 9, x: -210, y: 60, label: '西北徑' }
    ];
    var HEI_ROCKS = [
        { x: -380, y: -200, r: 52 },
        { x: 370, y: -180, r: 50 },
        { x: -400, y: 220, r: 48 },
        { x: 390, y: 200, r: 46 },
        { x: -120, y: 40, r: 36 },
        { x: 140, y: -20, r: 34 },
        { x: -50, y: 250, r: 32 },
        { x: 80, y: 140, r: 30 },
        { x: -260, y: -80, r: 40 },
        { x: 250, y: 80, r: 38 },
        { x: 20, y: 90, r: 28 }
    ];
    var HEI_BOXES = [
        { cx: 240, cy: 280, hw: 44, hh: 36 }
    ];
    var HEI_PORTALS = [
        {
            id: 'to_giran',
            dest: 'giran',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 奇岩周邊',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_twilight',
            dest: 'twilight_mt',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '黃昏山脈 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_town',
            dest: 'town_heine',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '海音城鎮 ↑',
            side: 'north'
        },
        {
            id: 'to_under',
            dest: 'zone_34',
            x: -70,
            y: -150,
            w: 140,
            h: 70,
            label: '地下通道 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 黃昏山脈（俯視山林）─── */
    var TW_SPAWNS = [
        { id: 0, x: 10, y: 20, label: '山間空地' },
        { id: 1, x: -140, y: 100, label: '西坡' },
        { id: 2, x: 150, y: 80, label: '東坡' },
        { id: 3, x: -50, y: 180, label: '北嶺' },
        { id: 4, x: 80, y: -150, label: '南徑' },
        { id: 5, x: -180, y: -40, label: '西南谷' },
        { id: 6, x: 230, y: -110, label: '東南谷' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北嶺' }
    ];
    var TW_ROCKS = [
        { x: -390, y: -300, r: 58 },
        { x: 380, y: -280, r: 56 },
        { x: -410, y: 230, r: 52 },
        { x: 400, y: 210, r: 50 },
        { x: -170, y: 50, r: 44 },
        { x: 180, y: -30, r: 46 },
        { x: -40, y: 250, r: 40 },
        { x: 90, y: -250, r: 42 },
        { x: -270, y: -140, r: 48 },
        { x: 260, y: 140, r: 46 },
        { x: 30, y: 90, r: 32 },
        { x: -120, y: -100, r: 34 }
    ];
    var TW_BOXES = [
        { cx: -230, cy: 290, hw: 46, hh: 40 }
    ];
    var TW_PORTALS = [
        {
            id: 'to_heine',
            dest: 'heine',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 海音',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_mirror',
            dest: 'mirror_forest',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '鏡子森林 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_dream',
            dest: 'dream_island',
            // 🩹 v3.8.439：南岸有海線 seaY=-400，門框須蓋住可行走帶（勿放在 -500）
            x: -70,
            y: -400,
            w: 140,
            h: 80,
            label: '夢幻之島 ↓',
            side: 'south',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 鏡子森林（俯視密林）─── */
    var MF_SPAWNS = [
        { id: 0, x: 0, y: 10, label: '鏡湖空地' },
        { id: 1, x: -150, y: 100, label: '西密林' },
        { id: 2, x: 160, y: 80, label: '東密林' },
        { id: 3, x: -40, y: 190, label: '北林' },
        { id: 4, x: 80, y: -160, label: '南徑' },
        { id: 5, x: -190, y: -40, label: '西南林' },
        { id: 6, x: 200, y: -70, label: '東南林' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北林' }
    ];
    var MF_ROCKS = [
        { x: -400, y: -310, r: 56 },
        { x: 390, y: -290, r: 54 },
        { x: -420, y: 220, r: 50 },
        { x: 410, y: 200, r: 48 },
        { x: -160, y: 40, r: 42 },
        { x: 170, y: -40, r: 44 },
        { x: -50, y: 250, r: 38 },
        { x: 90, y: -250, r: 40 },
        { x: -280, y: -150, r: 46 },
        { x: 270, y: 130, r: 44 },
        { x: 20, y: 100, r: 30 },
        { x: -130, y: -110, r: 32 },
        { x: 140, y: 50, r: 28 }
    ];
    var MF_BOXES = [
        { cx: 230, cy: 270, hw: 42, hh: 36 }
    ];
    var MF_PORTALS = [
        {
            id: 'to_twilight',
            dest: 'twilight_mt',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 黃昏山脈',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_oren',
            dest: 'zone_02',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '歐瑞 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 歐瑞周邊 zone_02 ─── */
    var Z02_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '中央空地' },
        { id: 1, x: -150, y: 100, label: '西徑' },
        { id: 2, x: 160, y: 80, label: '東徑' },
        { id: 3, x: -40, y: 180, label: '北緣' },
        { id: 4, x: 80, y: -150, label: '南草地' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -60, label: '東南' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北' }
    ];
    var Z02_ROCKS = [
        { x: -400, y: -320, r: 54 },
        { x: 390, y: -300, r: 52 },
        { x: -420, y: 210, r: 48 },
        { x: 410, y: 190, r: 50 },
        { x: -100, y: -250, r: 36 },
        { x: 150, y: 50, r: 32 },
        { x: -220, y: 140, r: 34 },
        { x: 60, y: 250, r: 30 },
        { x: -290, y: -90, r: 38 },
        { x: 270, y: -150, r: 36 },
        { x: 20, y: 90, r: 28 }
    ];
    var Z02_BOXES = [
        { cx: -250, cy: 290, hw: 46, hh: 40 }
    ];
    var Z02_PORTALS = [
        {
            id: 'to_mirror',
            dest: 'mirror_forest',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 鏡子森林',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_z03',
            dest: 'zone_03',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '歐瑞雪原 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_town',
            dest: 'town_oren',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '歐瑞村莊 ↑',
            side: 'north'
        },
        {
            id: 'to_crystal',
            dest: 'crystal_cave1',
            x: -70,
            y: -500,
            w: 140,
            h: 70,
            label: '水晶洞穴 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        },
        {
            id: 'to_ivory',
            dest: 'zone_37',
            x: 120,
            y: -500,
            w: 140,
            h: 70,
            label: '象牙塔 ↓',
            side: 'south',
            destX: 0,
            destY: 280
        }
    ];

    /* ─── 歐瑞雪原 zone_03 ─── */
    var Z03_SPAWNS = [
        { id: 0, x: 10, y: 10, label: '雪原中央' },
        { id: 1, x: -140, y: 100, label: '西雪徑' },
        { id: 2, x: 150, y: 80, label: '東雪徑' },
        { id: 3, x: -50, y: 180, label: '北緣' },
        { id: 4, x: 70, y: -160, label: '南雪地' },
        { id: 5, x: -180, y: -40, label: '西南' },
        { id: 6, x: 190, y: -70, label: '東南' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北' }
    ];
    var Z03_ROCKS = [
        { x: -390, y: -300, r: 58 },
        { x: 380, y: -280, r: 56 },
        { x: -410, y: 220, r: 52 },
        { x: 400, y: 200, r: 50 },
        { x: -160, y: 40, r: 42 },
        { x: 170, y: -30, r: 44 },
        { x: -40, y: 250, r: 38 },
        { x: 90, y: -250, r: 40 },
        { x: -270, y: -140, r: 48 },
        { x: 260, y: 130, r: 46 },
        { x: 30, y: 90, r: 32 },
        { x: -120, y: -100, r: 34 }
    ];
    var Z03_BOXES = [
        { cx: 220, cy: 280, hw: 44, hh: 38 }
    ];
    var Z03_PORTALS = [
        {
            id: 'to_z02',
            dest: 'zone_02',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 歐瑞周邊',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_z04',
            dest: 'zone_04',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '艾爾摩激戰地 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 艾爾摩激戰地 zone_04 ─── */
    var Z04_SPAWNS = [
        { id: 0, x: 0, y: 0, label: '戰場中央' },
        { id: 1, x: -150, y: 100, label: '西陣' },
        { id: 2, x: 160, y: 80, label: '東陣' },
        { id: 3, x: -40, y: 180, label: '北緣' },
        { id: 4, x: 80, y: -150, label: '南陣' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -60, label: '東南' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北' }
    ];
    var Z04_ROCKS = [
        { x: -400, y: -310, r: 56 },
        { x: 390, y: -290, r: 54 },
        { x: -420, y: 210, r: 50 },
        { x: 410, y: 190, r: 48 },
        { x: -150, y: 40, r: 40 },
        { x: 160, y: -40, r: 42 },
        { x: -50, y: 250, r: 36 },
        { x: 90, y: -240, r: 38 },
        { x: -280, y: -140, r: 46 },
        { x: 270, y: 140, r: 44 },
        { x: 20, y: 100, r: 30 },
        { x: -130, y: -100, r: 32 },
        { x: 140, y: 50, r: 28 }
    ];
    var Z04_BOXES = [
        { cx: -230, cy: 280, hw: 48, hh: 42 }
    ];
    var Z04_PORTALS = [
        {
            id: 'to_z03',
            dest: 'zone_03',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 歐瑞雪原',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_z05',
            dest: 'zone_05',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '國境要塞 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 國境要塞 zone_05 ─── */
    var Z05_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '要塞廣場' },
        { id: 1, x: -140, y: 100, label: '西牆' },
        { id: 2, x: 150, y: 80, label: '東牆' },
        { id: 3, x: -40, y: 180, label: '北門' },
        { id: 4, x: 70, y: -150, label: '南廊' },
        { id: 5, x: -180, y: -40, label: '西南角' },
        { id: 6, x: 190, y: -70, label: '東南角' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北牆' }
    ];
    var Z05_ROCKS = [
        { x: -380, y: -280, r: 54 },
        { x: 370, y: -260, r: 52 },
        { x: -400, y: 200, r: 50 },
        { x: 390, y: 180, r: 48 },
        { x: -160, y: 30, r: 40 },
        { x: 170, y: -40, r: 42 },
        { x: -40, y: 240, r: 36 },
        { x: 80, y: -230, r: 38 },
        { x: -260, y: -130, r: 46 },
        { x: 250, y: 120, r: 44 },
        { x: 20, y: 80, r: 32 },
        { x: -110, y: -90, r: 34 },
        { x: 130, y: 40, r: 30 }
    ];
    var Z05_BOXES = [
        { cx: 210, cy: 270, hw: 50, hh: 44 }
    ];
    var Z05_PORTALS = [
        {
            id: 'to_z04',
            dest: 'zone_04',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 艾爾摩激戰地',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_silent',
            dest: 'silent_outer',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '沉默洞穴周邊 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 沉默洞穴周邊 ─── */
    var SIL_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '洞穴外緣' },
        { id: 1, x: -150, y: 100, label: '西徑' },
        { id: 2, x: 160, y: 80, label: '東徑' },
        { id: 3, x: -40, y: 180, label: '北緣' },
        { id: 4, x: 80, y: -150, label: '南岩地' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -60, label: '東南' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北' }
    ];
    var SIL_ROCKS = [
        { x: -400, y: -300, r: 56 },
        { x: 390, y: -280, r: 54 },
        { x: -420, y: 210, r: 50 },
        { x: 410, y: 190, r: 48 },
        { x: -150, y: 40, r: 42 },
        { x: 160, y: -40, r: 44 },
        { x: -50, y: 250, r: 38 },
        { x: 90, y: -240, r: 40 },
        { x: -280, y: -140, r: 48 },
        { x: 270, y: 130, r: 46 },
        { x: 20, y: 90, r: 32 },
        { x: -130, y: -100, r: 34 }
    ];
    var SIL_BOXES = [
        { cx: -240, cy: 290, hw: 46, hh: 40 }
    ];
    var SIL_PORTALS = [
        {
            id: 'to_z05',
            dest: 'zone_05',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 國境要塞',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_grave',
            dest: 'elf_grave',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '精靈墓穴 →',
            side: 'east',
            destX: -280,
            destY: 0
        },
        {
            id: 'to_town',
            dest: 'town_silent',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '沉默洞穴 ↑',
            side: 'north'
        }
    ];

    /* ─── 精靈墓穴 ─── */
    var EG_SPAWNS = [
        { id: 0, x: 0, y: 0, label: '墓室中央' },
        { id: 1, x: -140, y: 100, label: '西廊' },
        { id: 2, x: 150, y: 80, label: '東廊' },
        { id: 3, x: -40, y: 180, label: '北廊' },
        { id: 4, x: 70, y: -150, label: '南廊' },
        { id: 5, x: -180, y: -40, label: '西南角' },
        { id: 6, x: 190, y: -70, label: '東南角' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -200, y: 120, label: '西北廊' }
    ];
    var EG_ROCKS = [
        { x: -370, y: -270, r: 54 },
        { x: 360, y: -250, r: 52 },
        { x: -390, y: 200, r: 50 },
        { x: 380, y: 180, r: 48 },
        { x: -160, y: 30, r: 40 },
        { x: 170, y: -40, r: 42 },
        { x: -40, y: 240, r: 36 },
        { x: 80, y: -230, r: 38 },
        { x: -250, y: -130, r: 46 },
        { x: 240, y: 120, r: 44 },
        { x: 20, y: 80, r: 32 },
        { x: -110, y: -90, r: 34 },
        { x: 130, y: 40, r: 30 }
    ];
    var EG_BOXES = [
        { cx: 220, cy: 260, hw: 44, hh: 38 }
    ];
    var EG_PORTALS = [
        {
            id: 'to_silent',
            dest: 'silent_outer',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 沉默洞穴周邊',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_hidden',
            dest: 'hidden_cave',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '大洞穴 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 大洞穴隱遁者村莊地區 ─── */
    var HC_SPAWNS = [
        { id: 0, x: 10, y: 10, label: '洞穴中央' },
        { id: 1, x: -150, y: 100, label: '西隧' },
        { id: 2, x: 160, y: 80, label: '東隧' },
        { id: 3, x: -40, y: 180, label: '北隧' },
        { id: 4, x: 80, y: -150, label: '南隧' },
        { id: 5, x: -190, y: -40, label: '西南' },
        { id: 6, x: 200, y: -60, label: '東南' },
        { id: 7, x: -100, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -210, y: 50, label: '西北' }
    ];
    var HC_ROCKS = [
        { x: -380, y: -290, r: 58 },
        { x: 370, y: -270, r: 56 },
        { x: -400, y: 210, r: 52 },
        { x: 390, y: 190, r: 50 },
        { x: -160, y: 40, r: 44 },
        { x: 180, y: -30, r: 46 },
        { x: -50, y: 250, r: 40 },
        { x: 90, y: -240, r: 42 },
        { x: -270, y: -140, r: 50 },
        { x: 260, y: 130, r: 48 },
        { x: 30, y: 90, r: 34 },
        { x: -120, y: -100, r: 36 },
        { x: 140, y: 50, r: 32 }
    ];
    var HC_BOXES = [
        { cx: -220, cy: 280, hw: 48, hh: 42 }
    ];
    var HC_PORTALS = [
        {
            id: 'to_grave',
            dest: 'elf_grave',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 精靈墓穴',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_tomb',
            dest: 'giant_tomb',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '古代巨人之墓 →',
            side: 'east',
            destX: -280,
            destY: 0
        }
    ];

    /* ─── 古代巨人之墓（鏈尾）─── */
    var GT_SPAWNS = [
        { id: 0, x: 0, y: 20, label: '墓廳中央' },
        { id: 1, x: -140, y: 100, label: '西廳' },
        { id: 2, x: 150, y: 80, label: '東廳' },
        { id: 3, x: -40, y: 180, label: '北廳' },
        { id: 4, x: 70, y: -150, label: '南廳' },
        { id: 5, x: -180, y: -40, label: '西南角' },
        { id: 6, x: 230, y: -110, label: '東南角' },
        { id: 7, x: -90, y: -180, label: '南岔' },
        { id: 8, x: 110, y: 170, label: '北岔' },
        { id: 9, x: -240, y: 80, label: '西北廳' }
    ];
    var GT_ROCKS = [
        { x: -370, y: -280, r: 60 },
        { x: 360, y: -260, r: 58 },
        { x: -390, y: 200, r: 54 },
        { x: 380, y: 180, r: 52 },
        { x: -150, y: 30, r: 44 },
        { x: 160, y: -40, r: 46 },
        { x: -40, y: 240, r: 40 },
        { x: 80, y: -230, r: 42 },
        { x: -260, y: -130, r: 50 },
        { x: 250, y: 120, r: 48 },
        { x: 20, y: 80, r: 34 },
        { x: -110, y: -90, r: 36 },
        { x: 130, y: 40, r: 32 },
        { x: -200, y: 150, r: 38 }
    ];
    var GT_BOXES = [
        { cx: 200, cy: 270, hw: 50, hh: 44 }
    ];
    var GT_PORTALS = [
        {
            id: 'to_hidden',
            dest: 'hidden_cave',
            x: -500,
            y: -20,
            w: 90,
            h: 200,
            label: '← 大洞穴',
            side: 'west',
            destX: 300,
            destY: 0
        },
        {
            id: 'to_rasta',
            dest: 'rastabad_cave1',
            x: 410,
            y: -20,
            w: 90,
            h: 200,
            label: '拉斯塔巴德 →',
            side: 'east',
            destX: 0,
            destY: 280
        }
    ];

    var GLU_DG1_PORTALS = [
        { id: 'to_surface', dest: 'gludio', x: -70, y: -500, w: 140, h: 70, label: '← 古魯丁野外', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'zone_07', x: 410, y: -60, w: 90, h: 160, label: '地監 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_06', x: -500, y: -60, w: 90, h: 160, label: '← 地監 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_08', x: 410, y: -60, w: 90, h: 160, label: '地監 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_07', x: -500, y: -60, w: 90, h: 160, label: '← 地監 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b4', dest: 'zone_09', x: 410, y: -60, w: 90, h: 160, label: '地監 4 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG4_PORTALS = [
        { id: 'to_b3', dest: 'zone_08', x: -500, y: -60, w: 90, h: 160, label: '← 地監 3 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b5', dest: 'zone_10', x: 410, y: -60, w: 90, h: 160, label: '地監 5 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG5_PORTALS = [
        { id: 'to_b4', dest: 'zone_09', x: -500, y: -60, w: 90, h: 160, label: '← 地監 4 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b6', dest: 'zone_11', x: 410, y: -60, w: 90, h: 160, label: '地監 6 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG6_PORTALS = [
        { id: 'to_b5', dest: 'zone_10', x: -500, y: -60, w: 90, h: 160, label: '← 地監 5 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b7', dest: 'zone_12', x: 410, y: -60, w: 90, h: 160, label: '地監 7 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GLU_DG7_PORTALS = [
        { id: 'to_b6', dest: 'zone_11', x: -500, y: -60, w: 90, h: 160, label: '← 地監 6 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 奇岩地監 1～4 樓 ─── */
    var GIR_DG1_PORTALS = [
        { id: 'to_surface', dest: 'giran', x: -70, y: -500, w: 140, h: 70, label: '← 奇岩周邊', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'zone_19', x: 410, y: -60, w: 90, h: 160, label: '地監 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GIR_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_18', x: -500, y: -60, w: 90, h: 160, label: '← 地監 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_20', x: 410, y: -60, w: 90, h: 160, label: '地監 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GIR_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_19', x: -500, y: -60, w: 90, h: 160, label: '← 地監 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b4', dest: 'zone_21', x: 410, y: -60, w: 90, h: 160, label: '地監 4 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var GIR_DG4_PORTALS = [
        { id: 'to_b3', dest: 'zone_20', x: -500, y: -60, w: 90, h: 160, label: '← 地監 3 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 沙漠地監 1～4 樓 ─── */
    var DES_DG1_PORTALS = [
        { id: 'to_surface', dest: 'desert', x: -70, y: -500, w: 140, h: 70, label: '← 沙漠', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'zone_23', x: 410, y: -60, w: 90, h: 160, label: '地監 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DES_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_22', x: -500, y: -60, w: 90, h: 160, label: '← 地監 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_24', x: 410, y: -60, w: 90, h: 160, label: '地監 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DES_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_23', x: -500, y: -60, w: 90, h: 160, label: '← 地監 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b4', dest: 'zone_25', x: 410, y: -60, w: 90, h: 160, label: '地監 4 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DES_DG4_PORTALS = [
        { id: 'to_b3', dest: 'zone_24', x: -500, y: -60, w: 90, h: 160, label: '← 地監 3 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 龍之谷地監 1～6 樓 ─── */
    var DV_DG1_PORTALS = [
        { id: 'to_surface', dest: 'dragon_valley', x: -70, y: -500, w: 140, h: 70, label: '← 龍之谷', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'zone_27', x: 410, y: -60, w: 90, h: 160, label: '地監 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DV_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_26', x: -500, y: -60, w: 90, h: 160, label: '← 地監 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_28', x: 410, y: -60, w: 90, h: 160, label: '地監 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DV_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_27', x: -500, y: -60, w: 90, h: 160, label: '← 地監 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b4', dest: 'zone_29', x: 410, y: -60, w: 90, h: 160, label: '地監 4 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DV_DG4_PORTALS = [
        { id: 'to_b3', dest: 'zone_28', x: -500, y: -60, w: 90, h: 160, label: '← 地監 3 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b5', dest: 'zone_30', x: 410, y: -60, w: 90, h: 160, label: '地監 5 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DV_DG5_PORTALS = [
        { id: 'to_b4', dest: 'zone_29', x: -500, y: -60, w: 90, h: 160, label: '← 地監 4 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b6', dest: 'zone_31', x: 410, y: -60, w: 90, h: 160, label: '地監 6 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DV_DG6_PORTALS = [
        { id: 'to_b5', dest: 'zone_30', x: -500, y: -60, w: 90, h: 160, label: '← 地監 5 樓', side: 'west', destX: 300, destY: 0 }
    ];


    /* ─── 眠龍洞穴 1～3 樓 ─── */
    var SLEEP_DG1_PORTALS = [
        { id: 'to_surface', dest: 'zone_01', x: -70, y: -500, w: 140, h: 70, label: '← 妖精森林周邊', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'zone_16', x: 410, y: -60, w: 90, h: 160, label: '洞穴 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SLEEP_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_15', x: -500, y: -60, w: 90, h: 160, label: '← 洞穴 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_17', x: 410, y: -60, w: 90, h: 160, label: '洞穴 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SLEEP_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_16', x: -500, y: -60, w: 90, h: 160, label: '← 洞穴 2 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 水晶洞穴 1～3 樓 ─── */
    var CRY_DG1_PORTALS = [
        { id: 'to_surface', dest: 'zone_02', x: -70, y: -500, w: 140, h: 70, label: '← 歐瑞周邊', side: 'south', destX: 0, destY: -280 },
        { id: 'to_b2', dest: 'crystal_cave2', x: 410, y: -60, w: 90, h: 160, label: '水晶 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var CRY_DG2_PORTALS = [
        { id: 'to_b1', dest: 'crystal_cave1', x: -500, y: -60, w: 90, h: 160, label: '← 水晶 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'crystal_cave3', x: 410, y: -60, w: 90, h: 160, label: '水晶 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var CRY_DG3_PORTALS = [
        { id: 'to_b2', dest: 'crystal_cave2', x: -500, y: -60, w: 90, h: 160, label: '← 水晶 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_shadow', dest: 'shadow_temple', x: 410, y: -60, w: 90, h: 160, label: '暗影神殿 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SHADOW_TEMPLE_PORTALS = [
        { id: 'to_crystal', dest: 'crystal_cave3', x: -500, y: -60, w: 90, h: 160, label: '← 水晶洞穴 3 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 螞蟻洞窟 1～2 樓 ─── */
    var ANT_DG1_PORTALS = [
        { id: 'to_surface', dest: 'desert', x: -70, y: -500, w: 140, h: 70, label: '← 沙漠', side: 'south', destX: 120, destY: -280 },
        { id: 'to_b2', dest: 'zone_33', x: 410, y: -60, w: 90, h: 160, label: '螞蟻 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var ANT_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_32', x: -500, y: -60, w: 90, h: 160, label: '← 螞蟻 1 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 地下通道 1～3 樓／伊娃王國 ─── */
    var UNDER_DG1_PORTALS = [
        { id: 'to_surface', dest: 'heine', x: -70, y: -500, w: 140, h: 70, label: '← 海音', side: 'south', destX: 0, destY: -120 },
        { id: 'to_b2', dest: 'zone_35', x: 410, y: -60, w: 90, h: 160, label: '通道 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var UNDER_DG2_PORTALS = [
        { id: 'to_b1', dest: 'zone_34', x: -500, y: -60, w: 90, h: 160, label: '← 通道 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'zone_36', x: 410, y: -60, w: 90, h: 160, label: '通道 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var UNDER_DG3_PORTALS = [
        { id: 'to_b2', dest: 'zone_35', x: -500, y: -60, w: 90, h: 160, label: '← 通道 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_eva', dest: 'eva_kingdom', x: 410, y: -60, w: 90, h: 160, label: '伊娃王國 →', side: 'east', destX: -280, destY: 0 }
    ];
    var EVA_PORTALS = [
        { id: 'to_under', dest: 'zone_36', x: -500, y: -60, w: 90, h: 160, label: '← 地下通道 3 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 象牙塔 4～8 樓 ─── */
    var IVORY_DG4_PORTALS = [
        { id: 'to_surface', dest: 'zone_02', x: -70, y: -500, w: 140, h: 70, label: '← 歐瑞周邊', side: 'south', destX: 120, destY: -280 },
        { id: 'to_b5', dest: 'zone_38', x: 410, y: -60, w: 90, h: 160, label: '象牙塔 5 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var IVORY_DG5_PORTALS = [
        { id: 'to_b4', dest: 'zone_37', x: -500, y: -60, w: 90, h: 160, label: '← 象牙塔 4 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b6', dest: 'zone_39', x: 410, y: -60, w: 90, h: 160, label: '象牙塔 6 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var IVORY_DG6_PORTALS = [
        { id: 'to_b5', dest: 'zone_38', x: -500, y: -60, w: 90, h: 160, label: '← 象牙塔 5 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b7', dest: 'zone_40', x: 410, y: -60, w: 90, h: 160, label: '象牙塔 7 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var IVORY_DG7_PORTALS = [
        { id: 'to_b6', dest: 'zone_39', x: -500, y: -60, w: 90, h: 160, label: '← 象牙塔 6 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b8', dest: 'zone_41', x: 410, y: -60, w: 90, h: 160, label: '象牙塔 8 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var IVORY_DG8_PORTALS = [
        { id: 'to_b7', dest: 'zone_40', x: -500, y: -60, w: 90, h: 160, label: '← 象牙塔 7 樓', side: 'west', destX: 300, destY: 0 }
    ];

    /* ─── 拉斯塔巴德洞穴／正門／訓練場／神殿 ─── */
    var RASTA_C1_PORTALS = [
        { id: 'to_surface', dest: 'giant_tomb', x: -70, y: -500, w: 140, h: 70, label: '← 古代巨人之墓', side: 'south', destX: 280, destY: 0 },
        { id: 'to_b2', dest: 'rastabad_cave2', x: 410, y: -60, w: 90, h: 160, label: '洞穴 2 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var RASTA_C2_PORTALS = [
        { id: 'to_b1', dest: 'rastabad_cave1', x: -500, y: -60, w: 90, h: 160, label: '← 洞穴 1 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_b3', dest: 'rastabad_cave3', x: 410, y: -60, w: 90, h: 160, label: '洞穴 3 樓 →', side: 'east', destX: -280, destY: 0 }
    ];
    var RASTA_C3_PORTALS = [
        { id: 'to_b2', dest: 'rastabad_cave2', x: -500, y: -60, w: 90, h: 160, label: '← 洞穴 2 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_gate', dest: 'rastabad_gate', x: 410, y: -60, w: 90, h: 160, label: '拉斯塔巴德正門 →', side: 'east', destX: -280, destY: 0 }
    ];
    var RASTA_GATE_PORTALS = [
        { id: 'to_c3', dest: 'rastabad_cave3', x: -500, y: -60, w: 90, h: 160, label: '← 洞穴 3 樓', side: 'west', destX: 300, destY: 0 },
        { id: 'to_beast', dest: 'rastabad_beast', x: 410, y: -60, w: 90, h: 160, label: '魔獸訓練場 →', side: 'east', destX: -280, destY: 0 },
        { id: 'to_lab', dest: 'dark_magic_lab', x: -80, y: 420, w: 160, h: 70, label: '黑魔法研究室 ↑', side: 'north', destX: 0, destY: -280 },
        { id: 'to_necro', dest: 'necro_training', x: -70, y: -500, w: 140, h: 70, label: '冥法軍訓練場 ↓', side: 'south', destX: 0, destY: 280 }
    ];
    var RASTA_BEAST_PORTALS = [
        { id: 'to_gate', dest: 'rastabad_gate', x: -500, y: -60, w: 90, h: 160, label: '← 正門', side: 'west', destX: 300, destY: 0 },
        { id: 'to_elder', dest: 'elder_room', x: 410, y: -60, w: 90, h: 160, label: '長老之室 →', side: 'east', destX: -280, destY: 0 }
    ];
    var DARK_LAB_PORTALS = [
        { id: 'to_gate', dest: 'rastabad_gate', x: -70, y: -500, w: 140, h: 70, label: '← 正門', side: 'south', destX: 0, destY: 280 },
        { id: 'to_demon', dest: 'demon_temple', x: 410, y: -60, w: 90, h: 160, label: '魔族神殿 →', side: 'east', destX: -280, destY: 0 }
    ];
    var NECRO_PORTALS = [
        { id: 'to_gate', dest: 'rastabad_gate', x: -80, y: 420, w: 160, h: 70, label: '← 正門 ↑', side: 'north', destX: 0, destY: -280 }
    ];
    var ELDER_PORTALS = [
        { id: 'to_beast', dest: 'rastabad_beast', x: -500, y: -60, w: 90, h: 160, label: '← 魔獸訓練場', side: 'west', destX: 300, destY: 0 }
    ];
    var DEMON_TEMPLE_PORTALS = [
        { id: 'to_lab', dest: 'dark_magic_lab', x: -500, y: -60, w: 90, h: 160, label: '← 黑魔法研究室', side: 'west', destX: 300, destY: 0 }
    ];


    /* ─── 傲慢之塔 2～100 樓區間 ─── */
    var PRIDE_1_PORTALS = [
        { id: 'to_entrance', dest: 'town_pride', x: -70, y: -500, w: 140, h: 70, label: '← 傲慢之塔 1 樓', side: 'south', destX: 0, destY: 0 },
        { id: 'to_next', dest: 'pride_11_20', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_2_PORTALS = [
        { id: 'to_prev', dest: 'pride_2_10', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_21_30', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_3_PORTALS = [
        { id: 'to_prev', dest: 'pride_11_20', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_31_40', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_4_PORTALS = [
        { id: 'to_prev', dest: 'pride_21_30', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_41_50', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_5_PORTALS = [
        { id: 'to_prev', dest: 'pride_31_40', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_51_60', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_6_PORTALS = [
        { id: 'to_prev', dest: 'pride_41_50', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_61_70', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_7_PORTALS = [
        { id: 'to_prev', dest: 'pride_51_60', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_71_80', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_8_PORTALS = [
        { id: 'to_prev', dest: 'pride_61_70', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_81_90', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_9_PORTALS = [
        { id: 'to_prev', dest: 'pride_71_80', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 },
        { id: 'to_next', dest: 'pride_91_100', x: 410, y: -60, w: 90, h: 160, label: '上層區間 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PRIDE_10_PORTALS = [
        { id: 'to_prev', dest: 'pride_81_90', x: -500, y: -60, w: 90, h: 160, label: '← 下層區間', side: 'west', destX: 300, destY: 0 }
    ];

    var PIRATE_WILD_PORTALS = [
        { id: 'to_town', dest: 'town_pirate_village', x: -500, y: -20, w: 90, h: 200, label: '← 海賊島村莊', side: 'west', destX: 0, destY: 0 },
        { id: 'to_dg', dest: 'pirate_dungeon', x: 410, y: -20, w: 90, h: 200, label: '海賊島地監 →', side: 'east', destX: -280, destY: 0 }
    ];
    var PIRATE_DG_PORTALS = [
        { id: 'to_wild', dest: 'pirate_wild', x: -500, y: -60, w: 90, h: 160, label: '← 海賊島野外', side: 'west', destX: 300, destY: 0 }
    ];
    /* ─── 夢幻之島（俯視幻想島·南岸海水）─── */
    var DREAM_SPAWNS = [
        { id: 0, x: 0, y: 40, label: '中央草地' },
        { id: 1, x: -160, y: 120, label: '蘑菇西林' },
        { id: 2, x: 170, y: 100, label: '鬼火東林' },
        { id: 3, x: -40, y: 150, label: '北緣空地' },
        { id: 4, x: 80, y: -100, label: '近岸草地' },
        { id: 5, x: -200, y: -40, label: '火蜥蜴丘' },
        { id: 6, x: 210, y: -60, label: '冰人灘' },
        { id: 7, x: -90, y: -160, label: '南岔' },
        { id: 8, x: 110, y: 180, label: '風精靈徑' },
        { id: 9, x: -220, y: 60, label: '地精靈徑' },
        { id: 10, x: 40, y: 140, label: '閃電球坪' },
        { id: 11, x: -100, y: -40, label: '暴走兔徑' }
    ];
    var DREAM_ROCKS = [
        { x: -380, y: -300, r: 48 },
        { x: 370, y: -280, r: 46 },
        { x: -390, y: 200, r: 44 },
        { x: 380, y: 180, r: 42 },
        { x: -140, y: 60, r: 32 },
        { x: 150, y: -40, r: 30 },
        { x: -40, y: 220, r: 30 },
        { x: 80, y: 120, r: 28 },
        { x: -240, y: -100, r: 34 },
        { x: 230, y: 60, r: 32 },
        { x: 30, y: 60, r: 24 },
        { x: -80, y: -120, r: 26 }
    ];
    var DREAM_BOXES = [
        { cx: 200, cy: 260, hw: 40, hh: 32 },
        { cx: -220, cy: 180, hw: 36, hh: 30 }
    ];
    var DREAM_PORTALS = [
        {
            id: 'to_aden',
            dest: 'town_aden',
            x: -80,
            y: 420,
            w: 160,
            h: 70,
            label: '亞丁城鎮 ↑',
            side: 'north'
        },
        {
            id: 'to_twilight',
            dest: 'twilight_mt',
            x: -500,
            y: -40,
            w: 90,
            h: 180,
            label: '← 黃昏山脈',
            side: 'west',
            destX: 0,
            destY: -280
        }
    ];
    var ANTARAS_PORTALS = [];
    var FAFURION_PORTALS = [];
    var VALAKAS_PORTALS = [];
    var THEBES_DES_PORTALS = [
        { id: 'to_town', dest: 'town_rift', x: -500, y: -20, w: 90, h: 200, label: '← 時空裂痕', side: 'west', destX: 0, destY: 0 },
        { id: 'to_pyr', dest: 'thebes_pyramid', x: 410, y: -20, w: 90, h: 200, label: '金字塔 →', side: 'east', destX: -280, destY: 0 }
    ];
    var THEBES_PYR_PORTALS = [
        { id: 'to_des', dest: 'thebes_desert', x: -500, y: -60, w: 90, h: 160, label: '← 底比斯沙漠', side: 'west', destX: 300, destY: 0 },
        { id: 'to_tem', dest: 'thebes_temple', x: 410, y: -60, w: 90, h: 160, label: '歐西里斯祭壇 →', side: 'east', destX: -280, destY: 0 }
    ];
    var THEBES_TEM_PORTALS = [
        { id: 'to_pyr', dest: 'thebes_pyramid', x: -500, y: -60, w: 90, h: 160, label: '← 金字塔', side: 'west', destX: 300, destY: 0 }
    ];
    var TIKAL_A_PORTALS = [
        { id: 'to_town', dest: 'town_rift', x: -500, y: -20, w: 90, h: 200, label: '← 時空裂痕', side: 'west', destX: 0, destY: 0 },
        { id: 'to_deep', dest: 'tikal_deep', x: 410, y: -20, w: 90, h: 200, label: '神廟深處 →', side: 'east', destX: -280, destY: 0 }
    ];
    var TIKAL_D_PORTALS = [
        { id: 'to_area', dest: 'tikal_area', x: -500, y: -60, w: 90, h: 160, label: '← 神廟地區', side: 'west', destX: 300, destY: 0 },
        { id: 'to_alt', dest: 'tikal_altar', x: 410, y: -60, w: 90, h: 160, label: '庫庫爾坎祭壇 →', side: 'east', destX: -280, destY: 0 }
    ];
    var TIKAL_ALT_PORTALS = [
        { id: 'to_deep', dest: 'tikal_deep', x: -500, y: -60, w: 90, h: 160, label: '← 神廟深處', side: 'west', destX: 300, destY: 0 }
    ];
    var SUN_CASTLE_PORTALS = [
        { id: 'to_town', dest: 'town_rift', x: -500, y: -20, w: 90, h: 200, label: '← 時空裂痕', side: 'west', destX: 0, destY: 0 },
        { id: 'to_east', dest: 'sunrise_east', x: 410, y: -20, w: 90, h: 200, label: '東之地 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SUN_EAST_PORTALS = [
        { id: 'to_castle', dest: 'sunrise_castle', x: -500, y: -20, w: 90, h: 200, label: '← 城牆', side: 'west', destX: 300, destY: 0 },
        { id: 'to_west', dest: 'sunrise_west', x: 410, y: -20, w: 90, h: 200, label: '西之地 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SUN_WEST_PORTALS = [
        { id: 'to_east', dest: 'sunrise_east', x: -500, y: -20, w: 90, h: 200, label: '← 東之地', side: 'west', destX: 300, destY: 0 },
        { id: 'to_north', dest: 'sunrise_north', x: 410, y: -20, w: 90, h: 200, label: '北之地 →', side: 'east', destX: -280, destY: 0 }
    ];
    var SUN_NORTH_PORTALS = [
        { id: 'to_west', dest: 'sunrise_west', x: -500, y: -20, w: 90, h: 200, label: '← 西之地', side: 'west', destX: 300, destY: 0 }
    ];

    var MAP_DEFS = {
        talking_island: {
            id: 'talking_island',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -300,
            border: 28,
            footprint: 14,
            layout: 'ti406',
            spawns: TI_SPAWNS,
            rocks: TI_ROCKS,
            boxes: TI_BOXES,
            portals: TI_PORTALS,
            floor: 'assets/area/maps/talking_island_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/說話之島周邊.jpg',
            hint: '說話之島 · 西緣回村／東緣港口／北緣地監 · 南岸不可走'
        },
        talking_island_port: {
            id: 'talking_island_port',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -240,
            border: 36,
            footprint: 14,
            layout: 'port410',
            spawns: PORT_SPAWNS,
            rocks: PORT_ROCKS,
            boxes: PORT_BOXES,
            portals: PORT_PORTALS,
            floor: 'assets/area/maps/talking_island_port_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/說話之島港口.jpg',
            hint: '說話之島港口 · 西緣回周邊 · 環水不可走'
        },
        zone_13: {
            id: 'zone_13',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dg413a',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: DG1_PORTALS,
            floor: 'assets/area/maps/zone_13_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/說話之島地監1樓.jpg',
            hint: '說話之島地監 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_14: {
            id: 'zone_14',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dg413b',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([
                { x: -120, y: -40, r: 30 },
                { x: 140, y: 120, r: 32 },
                { x: -40, y: 200, r: 28 }
            ]),
            boxes: DG_BOXES,
            portals: DG2_PORTALS,
            floor: 'assets/area/maps/zone_14_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/說話之島地監2樓.jpg',
            hint: '說話之島地監 2 樓 · 西緣回 1 樓'
        },
        zone_06: {
            id: 'zone_06',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: GLU_DG1_PORTALS,
            floor: 'assets/area/maps/zone_06_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監1樓.jpg',
            hint: '古魯丁地監 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_07: {
            id: 'zone_07',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -100, y: -20, r: 28 }, { x: 120, y: 100, r: 30 }]),
            boxes: DG_BOXES,
            portals: GLU_DG2_PORTALS,
            floor: 'assets/area/maps/zone_07_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監2樓.jpg',
            hint: '古魯丁地監 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_08: {
            id: 'zone_08',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 40, y: -80, r: 32 }]),
            boxes: DG_BOXES,
            portals: GLU_DG3_PORTALS,
            floor: 'assets/area/maps/zone_08_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監3樓.jpg',
            hint: '古魯丁地監 3 樓 · 西緣回 2 樓／東緣下 4 樓'
        },
        zone_09: {
            id: 'zone_09',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -160, y: 60, r: 30 }, { x: 80, y: -120, r: 28 }]),
            boxes: DG_BOXES,
            portals: GLU_DG4_PORTALS,
            floor: 'assets/area/maps/zone_09_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監4樓.jpg',
            hint: '古魯丁地監 4 樓 · 西緣回 3 樓／東緣下 5 樓'
        },
        zone_10: {
            id: 'zone_10',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg5',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 200, y: 40, r: 34 }]),
            boxes: DG_BOXES,
            portals: GLU_DG5_PORTALS,
            floor: 'assets/area/maps/zone_10_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監5樓.jpg',
            hint: '古魯丁地監 5 樓 · 西緣回 4 樓／東緣下 6 樓'
        },
        zone_11: {
            id: 'zone_11',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg6',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -60, y: 160, r: 30 }, { x: 140, y: -60, r: 32 }]),
            boxes: DG_BOXES,
            portals: GLU_DG6_PORTALS,
            floor: 'assets/area/maps/zone_11_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監6樓.jpg',
            hint: '古魯丁地監 6 樓 · 西緣回 5 樓／東緣下 7 樓'
        },
        zone_12: {
            id: 'zone_12',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'glu_dg7',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -180, y: -40, r: 36 }, { x: 60, y: 120, r: 30 }, { x: 180, y: -100, r: 32 }]),
            boxes: DG_BOXES,
            portals: GLU_DG7_PORTALS,
            floor: 'assets/area/maps/zone_12_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁地監7樓.jpg',
            hint: '古魯丁地監 7 樓 · 西緣回 6 樓（最底層）'
        },
        zone_18: {
            id: 'zone_18',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'gir_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: GIR_DG1_PORTALS,
            floor: 'assets/area/maps/zone_18_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/奇岩地監1樓.jpg',
            hint: '奇岩地監 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_19: {
            id: 'zone_19',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'gir_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -80, y: 40, r: 30 }, { x: 100, y: -80, r: 28 }]),
            boxes: DG_BOXES,
            portals: GIR_DG2_PORTALS,
            floor: 'assets/area/maps/zone_19_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/奇岩地監2樓.jpg',
            hint: '奇岩地監 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_20: {
            id: 'zone_20',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'gir_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 160, y: 60, r: 32 }, { x: -120, y: -100, r: 30 }]),
            boxes: DG_BOXES,
            portals: GIR_DG3_PORTALS,
            floor: 'assets/area/maps/zone_20_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/奇岩地監3樓.jpg',
            hint: '奇岩地監 3 樓 · 西緣回 2 樓／東緣下 4 樓'
        },
        zone_21: {
            id: 'zone_21',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'gir_dg4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -40, y: 140, r: 34 }, { x: 180, y: -40, r: 30 }, { x: -160, y: -60, r: 32 }]),
            boxes: DG_BOXES,
            portals: GIR_DG4_PORTALS,
            floor: 'assets/area/maps/zone_21_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/奇岩地監4樓.jpg',
            hint: '奇岩地監 4 樓 · 西緣回 3 樓（最底層）'
        },
        zone_22: {
            id: 'zone_22',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'des_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: DES_DG1_PORTALS,
            floor: 'assets/area/maps/zone_22_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沙漠地監1樓.jpg',
            hint: '沙漠 · 西緣風木／東緣肯特／南緣沙漠地監與螞蟻洞窟'
        },
        zone_23: {
            id: 'zone_23',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'des_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -90, y: 50, r: 30 }, { x: 110, y: -70, r: 28 }]),
            boxes: DG_BOXES,
            portals: DES_DG2_PORTALS,
            floor: 'assets/area/maps/zone_23_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沙漠地監2樓.jpg',
            hint: '沙漠地監 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_24: {
            id: 'zone_24',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'des_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 150, y: 40, r: 32 }, { x: -130, y: -90, r: 30 }]),
            boxes: DG_BOXES,
            portals: DES_DG3_PORTALS,
            floor: 'assets/area/maps/zone_24_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沙漠地監3樓.jpg',
            hint: '沙漠地監 3 樓 · 西緣回 2 樓／東緣下 4 樓'
        },
        zone_25: {
            id: 'zone_25',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'des_dg4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -50, y: 130, r: 34 }, { x: 170, y: -50, r: 30 }, { x: -170, y: -40, r: 32 }]),
            boxes: DG_BOXES,
            portals: DES_DG4_PORTALS,
            floor: 'assets/area/maps/zone_25_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沙漠地監4樓.jpg',
            hint: '沙漠地監 4 樓 · 西緣回 3 樓（最底層）'
        },
        zone_26: {
            id: 'zone_26',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: DV_DG1_PORTALS,
            floor: 'assets/area/maps/zone_26_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監1樓.jpg',
            hint: '龍之谷地監 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_27: {
            id: 'zone_27',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -90, y: 40, r: 30 }, { x: 100, y: -70, r: 28 }]),
            boxes: DG_BOXES,
            portals: DV_DG2_PORTALS,
            floor: 'assets/area/maps/zone_27_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監2樓.jpg',
            hint: '龍之谷地監 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_28: {
            id: 'zone_28',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 150, y: 50, r: 32 }, { x: -120, y: -90, r: 30 }]),
            boxes: DG_BOXES,
            portals: DV_DG3_PORTALS,
            floor: 'assets/area/maps/zone_28_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監3樓.jpg',
            hint: '龍之谷地監 3 樓 · 西緣回 2 樓／東緣下 4 樓'
        },
        zone_29: {
            id: 'zone_29',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -40, y: 140, r: 34 }, { x: 170, y: -40, r: 30 }]),
            boxes: DG_BOXES,
            portals: DV_DG4_PORTALS,
            floor: 'assets/area/maps/zone_29_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監4樓.jpg',
            hint: '龍之谷地監 4 樓 · 西緣回 3 樓／東緣下 5 樓'
        },
        zone_30: {
            id: 'zone_30',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg5',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -160, y: 20, r: 32 }, { x: 80, y: -110, r: 30 }, { x: 40, y: 100, r: 28 }]),
            boxes: DG_BOXES,
            portals: DV_DG5_PORTALS,
            floor: 'assets/area/maps/zone_30_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監5樓.jpg',
            hint: '龍之谷地監 5 樓 · 西緣回 4 樓／東緣下 6 樓'
        },
        zone_31: {
            id: 'zone_31',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dv_dg6',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: -50, y: 130, r: 36 }, { x: 180, y: -50, r: 32 }, { x: -170, y: -40, r: 34 }]),
            boxes: DG_BOXES,
            portals: DV_DG6_PORTALS,
            floor: 'assets/area/maps/zone_31_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷地監6樓.jpg',
            hint: '龍之谷地監 6 樓 · 西緣回 5 樓（最底層）'
        },
        silver_knight: {
            id: 'silver_knight',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -380,
            border: 32,
            footprint: 14,
            layout: 'sk414',
            spawns: SK_SPAWNS,
            rocks: SK_ROCKS,
            boxes: SK_BOXES,
            portals: SK_PORTALS,
            floor: 'assets/area/maps/silver_knight_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/銀騎士地區.jpg',
            hint: '銀騎士地區 · 西緣回村／東緣往妖精森林周邊'
        },
        zone_01: {
            id: 'zone_01',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'z01_414',
            spawns: Z01_SPAWNS,
            rocks: Z01_ROCKS,
            boxes: [],
            portals: Z01_PORTALS,
            floor: 'assets/area/maps/zone_01_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/妖精森林周邊.jpg',
            hint: '妖精森林周邊 · 西緣回銀騎士／東緣往妖魔森林／南緣眠龍洞穴'
        },
        elf_forest: {
            id: 'elf_forest',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'elf414',
            spawns: ELF_SPAWNS,
            rocks: ELF_ROCKS,
            boxes: ELF_BOXES,
            portals: ELF_PORTALS,
            floor: 'assets/area/maps/elf_forest_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/妖魔森林.jpg',
            hint: '妖魔森林 · 西緣回妖精森林周邊／東緣往古魯丁野外'
        },
        gludio: {
            id: 'gludio',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -380,
            border: 32,
            footprint: 14,
            layout: 'glu427',
            spawns: GLU_SPAWNS,
            rocks: GLU_ROCKS,
            boxes: GLU_BOXES,
            portals: GLU_PORTALS,
            floor: 'assets/area/maps/gludio_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古魯丁.jpg',
            hint: '古魯丁野外 · 西緣妖魔森林／東緣風木／北緣回村（Teon 風專屬地板）'
        },
        windwood: {
            id: 'windwood',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'ww427',
            spawns: WW_SPAWNS,
            rocks: WW_ROCKS,
            boxes: WW_BOXES,
            portals: WW_PORTALS,
            floor: 'assets/area/maps/windwood_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/風木.jpg',
            hint: '風木野外 · 西緣古魯丁／東緣沙漠（地板暫用佔位）'
        },
        desert: {
            id: 'desert',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -420,
            border: 36,
            footprint: 14,
            layout: 'des427',
            spawns: DES_SPAWNS,
            rocks: DES_ROCKS,
            boxes: DES_BOXES,
            portals: DES_PORTALS,
            floor: 'assets/area/maps/desert_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沙漠.jpg',
            hint: '沙漠 · 西緣風木／東緣肯特（Teon 風專屬地板）'
        },
        kent: {
            id: 'kent',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -380,
            border: 32,
            footprint: 14,
            layout: 'kent427',
            spawns: KENT_SPAWNS,
            rocks: KENT_ROCKS,
            boxes: KENT_BOXES,
            portals: KENT_PORTALS,
            floor: 'assets/area/maps/kent_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/肯特.jpg',
            hint: '肯特野外 · 西緣沙漠／東緣龍之谷'
        },
        dragon_valley: {
            id: 'dragon_valley',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -440,
            border: 36,
            footprint: 14,
            layout: 'dv428',
            spawns: DV_SPAWNS,
            rocks: DV_ROCKS,
            boxes: DV_BOXES,
            portals: DV_PORTALS,
            floor: 'assets/area/maps/dragon_valley_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/龍之谷.jpg',
            hint: '龍之谷 · 西緣肯特／東緣火龍窟（Teon 風專屬地板）'
        },
        fire_dragon: {
            id: 'fire_dragon',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 48,
            footprint: 14,
            layout: 'fd428',
            spawns: FD_SPAWNS,
            rocks: FD_ROCKS,
            boxes: FD_BOXES,
            portals: FD_PORTALS,
            floor: 'assets/area/maps/fire_dragon_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/火龍窟.jpg',
            hint: '火龍窟 · 西緣龍之谷／東緣奇岩周邊（Teon 風專屬地板）'
        },
        giran: {
            id: 'giran',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -380,
            border: 32,
            footprint: 14,
            layout: 'gir428',
            spawns: GIR_SPAWNS,
            rocks: GIR_ROCKS,
            boxes: GIR_BOXES,
            portals: GIR_PORTALS,
            floor: 'assets/area/maps/giran_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/奇岩.jpg',
            hint: '奇岩周邊 · 西緣火龍窟／東緣海音／北緣回奇岩城'
        },
        heine: {
            id: 'heine',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -200,
            border: 32,
            footprint: 14,
            layout: 'hei429',
            spawns: HEI_SPAWNS,
            rocks: HEI_ROCKS,
            boxes: HEI_BOXES,
            portals: HEI_PORTALS,
            floor: 'assets/area/maps/heine_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/海音.jpg',
            hint: '海音 · 西緣奇岩／東緣黃昏山脈／北緣回海音城／南緣地下通道'
        },
        twilight_mt: {
            id: 'twilight_mt',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'tw429',
            spawns: TW_SPAWNS,
            rocks: TW_ROCKS,
            boxes: TW_BOXES,
            portals: TW_PORTALS,
            floor: 'assets/area/maps/twilight_mt_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/黃昏山脈.jpg',
            hint: '黃昏山脈 · 西緣海音／東緣鏡子森林／南緣夢幻之島'
        },
        mirror_forest: {
            id: 'mirror_forest',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'mf429',
            spawns: MF_SPAWNS,
            rocks: MF_ROCKS,
            boxes: MF_BOXES,
            portals: MF_PORTALS,
            floor: 'assets/area/maps/mirror_forest_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/鏡子森林.jpg',
            hint: '鏡子森林 · 西緣黃昏山脈／東緣歐瑞'
        },
        zone_02: {
            id: 'zone_02',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 32,
            footprint: 14,
            layout: 'z02_430',
            spawns: Z02_SPAWNS,
            rocks: Z02_ROCKS,
            boxes: Z02_BOXES,
            portals: Z02_PORTALS,
            floor: 'assets/area/maps/zone_02_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/歐瑞.jpg',
            hint: '歐瑞周邊 · 西緣鏡子森林／東緣雪原／北緣回歐瑞村／南緣水晶洞穴與象牙塔'
        },
        zone_03: {
            id: 'zone_03',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -420,
            border: 36,
            footprint: 14,
            layout: 'z03_430',
            spawns: Z03_SPAWNS,
            rocks: Z03_ROCKS,
            boxes: Z03_BOXES,
            portals: Z03_PORTALS,
            floor: 'assets/area/maps/zone_03_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/歐瑞雪原.jpg',
            hint: '歐瑞雪原 · 西緣歐瑞周邊／東緣艾爾摩（地板暫用佔位）'
        },
        zone_04: {
            id: 'zone_04',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'z04_430',
            spawns: Z04_SPAWNS,
            rocks: Z04_ROCKS,
            boxes: Z04_BOXES,
            portals: Z04_PORTALS,
            floor: 'assets/area/maps/zone_04_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/艾爾摩激戰地.jpg',
            hint: '艾爾摩激戰地 · 西緣雪原／東緣國境要塞（地板暫用佔位）'
        },
        zone_05: {
            id: 'zone_05',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 40,
            footprint: 14,
            layout: 'z05_430',
            spawns: Z05_SPAWNS,
            rocks: Z05_ROCKS,
            boxes: Z05_BOXES,
            portals: Z05_PORTALS,
            floor: 'assets/area/maps/zone_05_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/國境要塞.jpg',
            hint: '國境要塞 · 西緣艾爾摩／東緣沉默洞穴周邊'
        },
        silent_outer: {
            id: 'silent_outer',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -420,
            border: 36,
            footprint: 14,
            layout: 'sil431',
            spawns: SIL_SPAWNS,
            rocks: SIL_ROCKS,
            boxes: SIL_BOXES,
            portals: SIL_PORTALS,
            floor: 'assets/area/maps/silent_outer_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/沉默洞穴周邊.jpg',
            hint: '沉默洞穴周邊 · 西緣國境要塞／東緣精靈墓穴／北緣沉默洞穴（地板暫用佔位）'
        },
        elf_grave: {
            id: 'elf_grave',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 48,
            footprint: 14,
            layout: 'eg431',
            spawns: EG_SPAWNS,
            rocks: EG_ROCKS,
            boxes: EG_BOXES,
            portals: EG_PORTALS,
            floor: 'assets/area/maps/elf_grave_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/精靈墓穴.jpg',
            hint: '精靈墓穴 · 西緣沉默周邊／東緣大洞穴（地板暫用佔位）'
        },
        hidden_cave: {
            id: 'hidden_cave',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 48,
            footprint: 14,
            layout: 'hc431',
            spawns: HC_SPAWNS,
            rocks: HC_ROCKS,
            boxes: HC_BOXES,
            portals: HC_PORTALS,
            floor: 'assets/area/maps/hidden_cave_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/大洞穴隱遁者村莊地區.jpg',
            hint: '大洞穴 · 西緣精靈墓穴／東緣古代巨人之墓（地板暫用佔位）'
        },
        giant_tomb: {
            id: 'giant_tomb',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 52,
            footprint: 14,
            layout: 'gt431',
            spawns: GT_SPAWNS,
            rocks: GT_ROCKS,
            boxes: GT_BOXES,
            portals: GT_PORTALS,
            floor: 'assets/area/maps/giant_tomb_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/古代巨人之墓.jpg',
            hint: '古代巨人之墓 · 西緣回大洞穴／東緣拉斯塔巴德'
        },
        zone_15: {
            id: 'zone_15',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'sleep_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: SLEEP_DG1_PORTALS,
            floor: 'assets/area/maps/zone_15_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/眠龍洞穴1樓.jpg',
            hint: '眠龍洞穴 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_16: {
            id: 'zone_16',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'sleep_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-100,"y":-20,"r":28},{"x":120,"y":100,"r":30}]),
            boxes: DG_BOXES,
            portals: SLEEP_DG2_PORTALS,
            floor: 'assets/area/maps/zone_16_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/眠龍洞穴2樓.jpg',
            hint: '眠龍洞穴 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_17: {
            id: 'zone_17',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'sleep_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":40,"y":-80,"r":32}]),
            boxes: DG_BOXES,
            portals: SLEEP_DG3_PORTALS,
            floor: 'assets/area/maps/zone_17_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/眠龍洞穴3樓.jpg',
            hint: '眠龍洞穴 3 樓 · 西緣回 2 樓'
        },
        crystal_cave1: {
            id: 'crystal_cave1',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'cry_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: CRY_DG1_PORTALS,
            floor: 'assets/area/maps/crystal_cave1_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/水晶洞穴1樓.jpg',
            hint: '水晶洞穴 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        crystal_cave2: {
            id: 'crystal_cave2',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'cry_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-80,"y":40,"r":30}]),
            boxes: DG_BOXES,
            portals: CRY_DG2_PORTALS,
            floor: 'assets/area/maps/crystal_cave2_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/水晶洞穴2樓.jpg',
            hint: '水晶洞穴 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        crystal_cave3: {
            id: 'crystal_cave3',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'cry_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":160,"y":-40,"r":34}]),
            boxes: DG_BOXES,
            portals: CRY_DG3_PORTALS,
            floor: 'assets/area/maps/crystal_cave3_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/水晶洞穴3樓.jpg',
            hint: '水晶洞穴 3 樓 · 西緣回 2 樓／東緣暗影神殿'
        },
        shadow_temple: {
            id: 'shadow_temple',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'shadow_temple',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-40,"y":120,"r":36},{"x":180,"y":-100,"r":32}]),
            boxes: DG_BOXES,
            portals: SHADOW_TEMPLE_PORTALS,
            floor: 'assets/area/maps/shadow_temple_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/暗影神殿.jpg',
            hint: '暗影神殿 · 西緣回水晶洞穴 3 樓'
        },
        zone_32: {
            id: 'zone_32',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ant_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: ANT_DG1_PORTALS,
            floor: 'assets/area/maps/zone_32_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/螞蟻洞窟1樓.jpg',
            hint: '螞蟻洞窟 1 樓 · 南緣出洞／東緣下 2 樓'
        },
        zone_33: {
            id: 'zone_33',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ant_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":60,"y":80,"r":30}]),
            boxes: DG_BOXES,
            portals: ANT_DG2_PORTALS,
            floor: 'assets/area/maps/zone_33_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/螞蟻洞窟2樓.jpg',
            hint: '螞蟻洞窟 2 樓 · 西緣回 1 樓'
        },
        zone_34: {
            id: 'zone_34',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'under_dg1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: UNDER_DG1_PORTALS,
            floor: 'assets/area/maps/zone_34_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/地下通道1樓.jpg',
            hint: '地下通道 1 樓 · 南緣出海音／東緣下 2 樓'
        },
        zone_35: {
            id: 'zone_35',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'under_dg2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-120,"y":40,"r":28}]),
            boxes: DG_BOXES,
            portals: UNDER_DG2_PORTALS,
            floor: 'assets/area/maps/zone_35_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/地下通道2樓.jpg',
            hint: '地下通道 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        zone_36: {
            id: 'zone_36',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'under_dg3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":90,"y":-60,"r":30}]),
            boxes: DG_BOXES,
            portals: UNDER_DG3_PORTALS,
            floor: 'assets/area/maps/zone_36_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/地下通道3樓.jpg',
            hint: '地下通道 3 樓 · 西緣回 2 樓／東緣伊娃王國'
        },
        eva_kingdom: {
            id: 'eva_kingdom',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'eva_kingdom',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-60,"y":100,"r":34},{"x":140,"y":-80,"r":32}]),
            boxes: DG_BOXES,
            portals: EVA_PORTALS,
            floor: 'assets/area/maps/eva_kingdom_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/伊娃王國.jpg',
            hint: '伊娃王國 · 西緣回地下通道 3 樓'
        },
        zone_37: {
            id: 'zone_37',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ivory_dg4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: IVORY_DG4_PORTALS,
            floor: 'assets/area/maps/zone_37_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/象牙塔4樓.jpg',
            hint: '象牙塔 4 樓 · 南緣出歐瑞／東緣上 5 樓'
        },
        zone_38: {
            id: 'zone_38',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ivory_dg5',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-40,"y":60,"r":28}]),
            boxes: DG_BOXES,
            portals: IVORY_DG5_PORTALS,
            floor: 'assets/area/maps/zone_38_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/象牙塔5樓.jpg',
            hint: '象牙塔 5 樓 · 西緣回 4 樓／東緣上 6 樓'
        },
        zone_39: {
            id: 'zone_39',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ivory_dg6',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":100,"y":-40,"r":30}]),
            boxes: DG_BOXES,
            portals: IVORY_DG6_PORTALS,
            floor: 'assets/area/maps/zone_39_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/象牙塔6樓.jpg',
            hint: '象牙塔 6 樓 · 西緣回 5 樓／東緣上 7 樓'
        },
        zone_40: {
            id: 'zone_40',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ivory_dg7',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-140,"y":20,"r":32}]),
            boxes: DG_BOXES,
            portals: IVORY_DG7_PORTALS,
            floor: 'assets/area/maps/zone_40_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/象牙塔7樓.jpg',
            hint: '象牙塔 7 樓 · 西緣回 6 樓／東緣上 8 樓'
        },
        zone_41: {
            id: 'zone_41',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'ivory_dg8',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":50,"y":140,"r":34}]),
            boxes: DG_BOXES,
            portals: IVORY_DG8_PORTALS,
            floor: 'assets/area/maps/zone_41_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/象牙塔8樓.jpg',
            hint: '象牙塔 8 樓 · 西緣回 7 樓'
        },
        rastabad_cave1: {
            id: 'rastabad_cave1',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'rasta_c1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS,
            boxes: DG_BOXES,
            portals: RASTA_C1_PORTALS,
            floor: 'assets/area/maps/rastabad_cave1_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/拉斯塔巴德地下洞穴1樓.jpg',
            hint: '拉斯塔巴德地下洞穴 1 樓 · 南緣回巨人之墓／東緣下 2 樓'
        },
        rastabad_cave2: {
            id: 'rastabad_cave2',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'rasta_c2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-90,"y":50,"r":30}]),
            boxes: DG_BOXES,
            portals: RASTA_C2_PORTALS,
            floor: 'assets/area/maps/rastabad_cave2_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/拉斯塔巴德地下洞穴2樓.jpg',
            hint: '拉斯塔巴德地下洞穴 2 樓 · 西緣回 1 樓／東緣下 3 樓'
        },
        rastabad_cave3: {
            id: 'rastabad_cave3',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'rasta_c3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":120,"y":-70,"r":32}]),
            boxes: DG_BOXES,
            portals: RASTA_C3_PORTALS,
            floor: 'assets/area/maps/rastabad_cave3_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/拉斯塔巴德地下洞穴3樓.jpg',
            hint: '拉斯塔巴德地下洞穴 3 樓 · 西緣回 2 樓／東緣正門'
        },
        rastabad_gate: {
            id: 'rastabad_gate',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'rasta_gate',
            spawns: DG_SPAWNS,
            // 🩹 v3.8.439：勿在 (0,0) 放石＝擋住中央出怪／落點
            rocks: DG_ROCKS.concat([{ x: 120, y: -130, r: 34 }, { x: -180, y: 190, r: 30 }]),
            boxes: DG_BOXES,
            portals: RASTA_GATE_PORTALS,
            floor: 'assets/area/maps/rastabad_gate_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/拉斯塔巴德正門.jpg',
            hint: '拉斯塔巴德正門 · 樞紐通往訓練場／研究室／冥法場'
        },
        rastabad_beast: {
            id: 'rastabad_beast',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'rasta_beast',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":80,"y":-100,"r":34}]),
            boxes: DG_BOXES,
            portals: RASTA_BEAST_PORTALS,
            floor: 'assets/area/maps/rastabad_beast_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/魔獸訓練場.jpg',
            hint: '魔獸訓練場 · 西緣回正門／東緣長老之室'
        },
        dark_magic_lab: {
            id: 'dark_magic_lab',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'dark_lab',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-50,"y":80,"r":30}]),
            boxes: DG_BOXES,
            portals: DARK_LAB_PORTALS,
            floor: 'assets/area/maps/dark_magic_lab_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/黑魔法研究室.jpg',
            hint: '黑魔法研究室 · 南緣回正門／東緣魔族神殿'
        },
        necro_training: {
            id: 'necro_training',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'necro_train',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":100,"y":40,"r":32}]),
            boxes: DG_BOXES,
            portals: NECRO_PORTALS,
            floor: 'assets/area/maps/necro_training_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/冥法軍訓練場.jpg',
            hint: '冥法軍訓練場 · 北緣回正門'
        },
        elder_room: {
            id: 'elder_room',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'elder_room',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-80,"y":-60,"r":36},{"x":160,"y":100,"r":34}]),
            boxes: DG_BOXES,
            portals: ELDER_PORTALS,
            floor: 'assets/area/maps/elder_room_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/格蘭肯神殿．長老之室.jpg',
            hint: '格蘭肯神殿．長老之室 · 西緣回魔獸訓練場'
        },
        demon_temple: {
            id: 'demon_temple',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'demon_temple',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{ x: 100, y: -200, r: 34 }, { x: -200, y: 40, r: 30 }]),
            boxes: DG_BOXES,
            portals: DEMON_TEMPLE_PORTALS,
            floor: 'assets/area/maps/demon_temple_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/魔族神殿.jpg',
            hint: '魔族神殿 · 西緣回黑魔法研究室'
        },
        pride_2_10: {
            id: 'pride_2_10',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_1',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-40,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_1_PORTALS,
            floor: 'assets/area/maps/pride_2_10_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔2~10樓.jpg',
            hint: '傲慢之塔 2～10 樓 · 南緣回 1 樓／東緣上層'
        },
        pride_11_20: {
            id: 'pride_11_20',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_2',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-32,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_2_PORTALS,
            floor: 'assets/area/maps/pride_11_20_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔11~20樓.jpg',
            hint: '傲慢之塔 11～20 樓 · 西緣下層／東緣上層'
        },
        pride_21_30: {
            id: 'pride_21_30',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_3',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-24,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_3_PORTALS,
            floor: 'assets/area/maps/pride_21_30_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔21~30樓.jpg',
            hint: '傲慢之塔 21～30 樓 · 西緣下層／東緣上層'
        },
        pride_31_40: {
            id: 'pride_31_40',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_4',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-16,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_4_PORTALS,
            floor: 'assets/area/maps/pride_31_40_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔31~40樓.jpg',
            hint: '傲慢之塔 31～40 樓 · 西緣下層／東緣上層'
        },
        pride_41_50: {
            id: 'pride_41_50',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_5',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":-8,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_5_PORTALS,
            floor: 'assets/area/maps/pride_41_50_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔41~50樓.jpg',
            hint: '傲慢之塔 41～50 樓 · 西緣下層／東緣上層'
        },
        pride_51_60: {
            id: 'pride_51_60',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_6',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":0,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_6_PORTALS,
            floor: 'assets/area/maps/pride_51_60_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔51~60樓.jpg',
            hint: '傲慢之塔 51～60 樓 · 西緣下層／東緣上層'
        },
        pride_61_70: {
            id: 'pride_61_70',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_7',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":8,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_7_PORTALS,
            floor: 'assets/area/maps/pride_61_70_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔61~70樓.jpg',
            hint: '傲慢之塔 61～70 樓 · 西緣下層／東緣上層'
        },
        pride_71_80: {
            id: 'pride_71_80',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_8',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":16,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_8_PORTALS,
            floor: 'assets/area/maps/pride_71_80_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔71~80樓.jpg',
            hint: '傲慢之塔 71～80 樓 · 西緣下層／東緣上層'
        },
        pride_81_90: {
            id: 'pride_81_90',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_9',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":24,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_9_PORTALS,
            floor: 'assets/area/maps/pride_81_90_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔81~90樓.jpg',
            hint: '傲慢之塔 81～90 樓 · 西緣下層／東緣上層'
        },
        pride_91_100: {
            id: 'pride_91_100',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'pride_10',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":32,"y":60,"r":30}]),
            boxes: DG_BOXES,
            portals: PRIDE_10_PORTALS,
            floor: 'assets/area/maps/pride_91_100_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/傲慢之塔91~100樓.jpg',
            hint: '傲慢之塔 91～100 樓 · 西緣下層'
        },
        pirate_wild: {
            id: 'pirate_wild',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'piratewild',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: PIRATE_WILD_PORTALS,
            floor: 'assets/area/maps/pirate_wild_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/海賊島.jpg',
            hint: '海賊島野外 · 西緣回村／東緣地監'
        },
        pirate_dungeon: {
            id: 'pirate_dungeon',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'piratedungeon',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: PIRATE_DG_PORTALS,
            floor: 'assets/area/maps/pirate_dungeon_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/海賊島地監.jpg',
            hint: '海賊島地監 · 西緣回野外'
        },
        dream_island: {
            id: 'dream_island',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -220,
            border: 32,
            footprint: 14,
            layout: 'dream438',
            spawns: DREAM_SPAWNS,
            rocks: DREAM_ROCKS,
            boxes: DREAM_BOXES,
            portals: DREAM_PORTALS,
            floor: 'assets/area/maps/dream_island_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/夢幻之島.jpg',
            hint: '夢幻之島 · 北緣回亞丁／西緣黃昏山脈 · 南岸不可走 · 元素精靈王出沒'
        },
        antaras_lair: {
            id: 'antaras_lair',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'antaraslair',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: ANTARAS_PORTALS,
            floor: 'assets/area/maps/antaras_lair_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/安塔瑞斯棲息地.jpg',
            hint: '安塔瑞斯棲息地 · 龍巢'
        },
        fafurion_lair: {
            id: 'fafurion_lair',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'fafurionlair',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: FAFURION_PORTALS,
            floor: 'assets/area/maps/fafurion_lair_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/法利昂洞穴.jpg',
            hint: '法利昂洞穴 · 龍巢'
        },
        valakas_lair: {
            id: 'valakas_lair',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'valakaslair',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: VALAKAS_PORTALS,
            floor: 'assets/area/maps/valakas_lair_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/巴拉卡斯巢穴.jpg',
            hint: '巴拉卡斯巢穴 · 龍巢'
        },
        thebes_desert: {
            id: 'thebes_desert',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'thebesdesert',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: THEBES_DES_PORTALS,
            floor: 'assets/area/maps/thebes_desert_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/底比斯沙漠.jpg',
            hint: '底比斯沙漠 · 西緣回裂痕村／東緣金字塔'
        },
        thebes_pyramid: {
            id: 'thebes_pyramid',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'thebespyramid',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: THEBES_PYR_PORTALS,
            floor: 'assets/area/maps/thebes_pyramid_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/底比斯 金字塔內部.jpg',
            hint: '底比斯金字塔 · 西緣沙漠／東緣歐西里斯祭壇'
        },
        thebes_temple: {
            id: 'thebes_temple',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'thebestemple',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: THEBES_TEM_PORTALS,
            floor: 'assets/area/maps/thebes_temple_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/底比斯 歐西里斯祭壇.jpg',
            hint: '底比斯歐西里斯祭壇 · 西緣回金字塔'
        },
        tikal_area: {
            id: 'tikal_area',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'tikalarea',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: TIKAL_A_PORTALS,
            floor: 'assets/area/maps/tikal_area_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/提卡爾神廟地區.jpg',
            hint: '提卡爾神廟地區 · 西緣回裂痕村／東緣深處'
        },
        tikal_deep: {
            id: 'tikal_deep',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'tikaldeep',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: TIKAL_D_PORTALS,
            floor: 'assets/area/maps/tikal_deep_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/提卡爾神廟地區深處.jpg',
            hint: '提卡爾神廟深處 · 西緣回外圍／東緣祭壇'
        },
        tikal_altar: {
            id: 'tikal_altar',
            real: true,
            noSea: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -999,
            border: 56,
            footprint: 14,
            layout: 'tikalaltar',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: TIKAL_ALT_PORTALS,
            floor: 'assets/area/maps/tikal_altar_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/提卡爾 庫庫爾坎祭壇.jpg',
            hint: '提卡爾庫庫爾坎祭壇 · 西緣回深處'
        },
        sunrise_castle: {
            id: 'sunrise_castle',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'sunrisecastle',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: SUN_CASTLE_PORTALS,
            floor: 'assets/area/maps/sunrise_castle_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/日出之國城墎.jpg',
            hint: '日出之國城牆 · 西緣回裂痕村／東緣東之地'
        },
        sunrise_east: {
            id: 'sunrise_east',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'sunriseeast',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: SUN_EAST_PORTALS,
            floor: 'assets/area/maps/sunrise_east_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/日出之國東之地.jpg',
            hint: '日出之國東之地 · 西緣城牆／東緣西之地'
        },
        sunrise_west: {
            id: 'sunrise_west',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'sunrisewest',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: SUN_WEST_PORTALS,
            floor: 'assets/area/maps/sunrise_west_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/日出之國西之地.jpg',
            hint: '日出之國西之地 · 西緣東之地／東緣北之地'
        },
        sunrise_north: {
            id: 'sunrise_north',
            real: true,
            tile: TILE,
            maxX: 512,
            maxY: 512,
            seaY: -400,
            border: 36,
            footprint: 14,
            layout: 'sunrisenorth',
            spawns: DG_SPAWNS,
            rocks: DG_ROCKS.concat([{"x":20,"y":-40,"r":32}]),
            boxes: DG_BOXES,
            portals: SUN_NORTH_PORTALS,
            floor: 'assets/area/maps/sunrise_north_floor.png',
            floorTeon: true,
            scenicFar: 'assets/area/1920x1080/日出之國北之地.jpg',
            hint: '日出之國北之地 · 西緣回西之地'
        }
    };

    function mapdefOf(mapId) {
        var id = String(mapId || '');
        return MAP_DEFS[id] || null;
    }

    function mapdefIsReal(mapId) {
        var d = mapdefOf(mapId);
        return !!(d && d.real);
    }

    function mapdefIsCompact(def) {
        if (!def) return false;
        if (def.compact) return true;
        var id = String(def.id || '');
        return /dungeon|_d\d|_d$|cave|pride_|zone_|tomb|temple|lab|rastabad|training|elder|demon|shadow|necro|crystal|ivory|tower|pyramid|altar|grave|room/.test(id);
    }

    /** 大地圖：可走半幅／美術半幅（地板圖仍 1024） */
    function mapdefBounds(def) {
        var baseX = Number(def && def.maxX) || REAL_ART_HALF;
        var baseY = Number(def && def.maxY) || REAL_ART_HALF;
        var scale = 1;
        if (def && def.real) {
            if (def.walkScale != null) scale = Math.max(1, Number(def.walkScale) || 1);
            else scale = mapdefIsCompact(def) ? REAL_WALK_SCALE_DUNGEON : REAL_WALK_SCALE_OUTDOOR;
        }
        return {
            maxX: Math.round(baseX * scale),
            maxY: Math.round(baseY * scale),
            artHalf: Math.min(baseX, REAL_ART_HALF),
            floorArt: Number(def && def.floorArt) || Math.min(baseX, REAL_ART_HALF) * 2,
            scale: scale,
            seaY: (def && def.seaY != null && !def.noSea)
                ? Math.round(Number(def.seaY) * scale)
                : null
        };
    }

    function mapdefRemapPortal(p, bounds) {
        if (!p || !bounds) return p;
        var out = {};
        for (var k in p) {
            if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
        }
        var ah = bounds.artHalf || REAL_ART_HALF;
        var mx = bounds.maxX;
        var my = bounds.maxY;
        var pw = Number(p.w) || 80;
        var ph = Number(p.h) || 80;
        // 原本貼美術邊的門 → 推到大地圖邊緣
        if (Math.abs(Number(p.x) || 0) >= ah * 0.7) {
            out.x = (p.x < 0 ? -1 : 1) * (mx - Math.max(48, pw * 0.45));
        } else {
            out.x = Math.round((Number(p.x) || 0) * Math.min(bounds.scale, 1.35));
        }
        if (Math.abs(Number(p.y) || 0) >= ah * 0.7) {
            out.y = (p.y < 0 ? -1 : 1) * (my - Math.max(48, ph * 0.45));
        } else {
            out.y = Math.round((Number(p.y) || 0) * Math.min(bounds.scale, 1.35));
        }
        return out;
    }

    function mapdefHitBox(def, x, y) {
        var boxes = (def && def.boxes) || [];
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (!b) continue;
            if (Math.abs(x - b.cx) <= (b.hw || 20) && Math.abs(y - b.cy) <= (b.hh || 20)) return true;
        }
        return false;
    }

    function mapdefPointWalkable(def, wx, wy) {
        if (!def) return true;
        var x = Number(wx) || 0;
        var y = Number(wy) || 0;
        var b = mapdefBounds(def);
        var border = Number(def.border) || 28;
        if (Math.abs(x) > b.maxX - border) return false;
        if (Math.abs(y) > b.maxY - border) return false;
        if (b.seaY != null && y < b.seaY) return false;
        if (mapdefHitBox(def, x, y)) return false;
        var rocks = def.rocks || [];
        for (var i = 0; i < rocks.length; i++) {
            var r = rocks[i];
            var dx = x - r.x;
            var dy = y - r.y;
            if (dx * dx + dy * dy < (r.r || 40) * (r.r || 40)) return false;
        }
        return true;
    }

    function mapdefWalkable(def, wx, wy) {
        if (!def) return true;
        var f = Number(def.footprint) || 14;
        if (!mapdefPointWalkable(def, wx, wy)) return false;
        if (!mapdefPointWalkable(def, wx - f, wy)) return false;
        if (!mapdefPointWalkable(def, wx + f, wy)) return false;
        if (!mapdefPointWalkable(def, wx, wy - f)) return false;
        if (!mapdefPointWalkable(def, wx, wy + f)) return false;
        return true;
    }


    /** 🩹 v3.9.18：從圓石／方障推出（貼地感；避免只擋軸還卡進障礙） */
    function mapdefPushOut(def, wx, wy) {
        if (!def) return { x: wx, y: wy, hit: false };
        var x = Number(wx) || 0;
        var y = Number(wy) || 0;
        var pad = Math.max(8, (Number(def.footprint) || 14) * 0.9);
        var hit = false;
        var rocks = def.rocks || [];
        var boxes = def.boxes || [];
        for (var pass = 0; pass < 4; pass++) {
            var moved = false;
            for (var i = 0; i < rocks.length; i++) {
                var r = rocks[i];
                if (!r) continue;
                var need = (Number(r.r) || 40) + pad;
                var dx = x - r.x;
                var dy = y - r.y;
                var d2 = dx * dx + dy * dy;
                if (d2 >= need * need || d2 < 0.0001) continue;
                var d = Math.sqrt(d2);
                x = r.x + (dx / d) * need;
                y = r.y + (dy / d) * need;
                hit = true;
                moved = true;
            }
            for (var j = 0; j < boxes.length; j++) {
                var b = boxes[j];
                if (!b) continue;
                var hw = (b.hw || 20) + pad * 0.55;
                var hh = (b.hh || 20) + pad * 0.55;
                var ox = x - b.cx;
                var oy = y - b.cy;
                if (Math.abs(ox) > hw || Math.abs(oy) > hh) continue;
                var px = hw - Math.abs(ox);
                var py = hh - Math.abs(oy);
                if (px < py) x = b.cx + (ox >= 0 ? hw : -hw);
                else y = b.cy + (oy >= 0 ? hh : -hh);
                hit = true;
                moved = true;
            }
            if (!moved) break;
        }
        if (Math.abs(x) > def.maxX - def.border) {
            x = (x < 0 ? -1 : 1) * (def.maxX - def.border);
            hit = true;
        }
        if (Math.abs(y) > def.maxY - def.border) {
            y = (y < 0 ? -1 : 1) * (def.maxY - def.border);
            hit = true;
        }
        if (!def.noSea && def.seaY != null && y < def.seaY) {
            y = def.seaY + 2;
            hit = true;
        }
        return { x: x, y: y, hit: hit };
    }

    function mapdefResolveMove(def, fromX, fromY, toX, toY) {
        if (!def) return { x: toX, y: toY, hit: false };
        var x = Number(fromX) || 0;
        var y = Number(fromY) || 0;
        var nx = Number(toX) || 0;
        var ny = Number(toY) || 0;
        var hit = false;
        if (mapdefWalkable(def, nx, y)) {
            x = nx;
        } else {
            hit = true;
            nx = x;
        }
        if (mapdefWalkable(def, x, ny)) {
            y = ny;
        } else {
            hit = true;
            ny = y;
        }
        if (!mapdefWalkable(def, x, y)) {
            hit = true;
            x = Number(fromX) || 0;
            y = Number(fromY) || 0;
        }
        var bb = mapdefBounds(def);
        if (x < -bb.maxX) { x = -bb.maxX; hit = true; }
        if (x > bb.maxX) { x = bb.maxX; hit = true; }
        if (y < -bb.maxY) { y = -bb.maxY; hit = true; }
        if (y > bb.maxY) { y = bb.maxY; hit = true; }
        var pushed = mapdefPushOut(def, x, y);
        if (pushed.hit) hit = true;
        return { x: pushed.x, y: pushed.y, hit: hit };
    }

    function mapdefSpawns(mapId) {
        var d = mapdefOf(mapId);
        if (!d || !d.spawns) return null;
        var b = mapdefBounds(d);
        var ah = Math.max(1, Number(d.maxX) || REAL_ART_HALF);
        var sx = Math.min(b.maxX / ah, 2.15);
        var sy = Math.min(b.maxY / ah, 2.15);
        return d.spawns.map(function (s) {
            if (!s) return s;
            return {
                id: s.id,
                x: Math.round((Number(s.x) || 0) * sx),
                y: Math.round((Number(s.y) || 0) * sy),
                label: s.label
            };
        });
    }

    function mapdefPortals(mapId) {
        var d = mapdefOf(mapId);
        if (!d || !d.portals) return [];
        var b = mapdefBounds(d);
        return d.portals.map(function (p) {
            return mapdefRemapPortal(p, b);
        });
    }

    function mapdefPortalAt(mapId, wx, wy) {
        var list = mapdefPortals(mapId);
        var x = Number(wx) || 0;
        var y = Number(wy) || 0;
        for (var i = 0; i < list.length; i++) {
            var p = list[i];
            if (!p) continue;
            var x0 = p.x;
            var y0 = p.y;
            var x1 = p.x + (p.w || 40);
            var y1 = p.y + (p.h || 40);
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return p;
        }
        return null;
    }

    global.MAP_DEFS = MAP_DEFS;
    global.mapdefOf = mapdefOf;
    global.mapdefIsReal = mapdefIsReal;
    global.mapdefBounds = mapdefBounds;
    global.mapdefWalkable = mapdefWalkable;
    global.mapdefResolveMove = mapdefResolveMove;
    global.mapdefPushOut = mapdefPushOut;
    global.mapdefSpawns = mapdefSpawns;
    global.mapdefPortals = mapdefPortals;
    global.mapdefPortalAt = mapdefPortalAt;
})(typeof window !== 'undefined' ? window : this);
