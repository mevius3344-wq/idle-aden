// 野外／地監 → 天堂原版地圖（客戶端 zone3-c.tbl 名稱＋區域矩形對照）
// id: [原版 mapid, 輸出資料夾, 取景中心 x, 取景中心 y, 半徑]（無中心＝整張圖）
module.exports = {
  // ── 野外（本土 map 4，依 zone3-c.tbl 區域矩形取景）──
  silver_knight: [4, "fd_silver", 33210, 33440, 72],     // 銀騎士 東部森林
  zone_01: [4, "fd_elfwood", 33000, 32330, 72],          // 妖森 周邊（含眠龍洞穴入口 32938,32284）
  elf_forest: [4, "fd_orcwood", 32735, 32364, 72],       // 妖魔森林
  gludio: [4, "fd_gludio", 32745, 32870, 72],            // 古魯丁 區域（含地監入口 32728,32929）
  windwood: [4, "fd_windawood", 32640, 33380, 72],       // 風木 區域
  desert: [4, "fd_desert", 32835, 33210, 80],            // 風木沙漠（含巨蟻洞穴入口 32755,33208／32914,33220）
  kent: [4, "fd_kent", 33150, 32700, 72],                // 肯特 區域
  dragon_valley: [4, "fd_dragonvalley", 33344, 32351, 72],
  fire_dragon: [4, "fd_firedragon", 33664, 32351, 72],   // 火龍窟
  giran: [4, "fd_giran", 33360, 32990, 80],              // 含奇岩地監入口 33311,33061
  heine: [4, "fd_heine", 33570, 33430, 80],              // 含海音地監入口 33627,33502
  twilight_mt: [4, "fd_twilight", 33730, 32800, 72],     // 奇岩2 東側山區
  mirror_forest: [4, "fd_mirror", 33750, 33300, 72],     // 鏡子森林（變形怪）
  zone_02: [4, "fd_oren", 33990, 32340, 72],             // 歐瑞 區域（含歐瑞村邊）
  zone_03: [4, "fd_orensnow", 34220, 32250, 72],         // 歐瑞雪原
  zone_04: [4, "fd_elmore", 34060, 32480, 72],           // 艾爾摩激戰地
  zone_05: [4, "fd_border", 33840, 32740, 72],           // 國境（盜賊一帶）
  talking_island_port: [0, "fd_tiport", 32680, 33170, 48],
  silent_outer: [304, "fd_silent", 32770, 32900, 96],    // 沉默洞穴
  elf_grave: [430, "fd_elfgrave", 32830, 32900, 96],     // 精靈墓穴
  hidden_cave: [400, "fd_hidden", 32655, 32910, 80],     // 大洞穴 隱遁者地區
  giant_tomb: [400, "fd_gianttomb", 32790, 32930, 80],   // 大洞穴 古代巨人之墓

  // ── 地監 ──
  zone_06: [7, "dg_gludio1"], zone_07: [8, "dg_gludio2"], zone_08: [9, "dg_gludio3"], zone_09: [10, "dg_gludio4"],
  zone_10: [11, "dg_gludio5"], zone_11: [12, "dg_gludio6"], zone_12: [13, "dg_gludio7"],
  zone_15: [19, "dg_sleep1"], zone_16: [20, "dg_sleep2"], zone_17: [21, "dg_sleep3"],          // 眠龍洞穴
  crystal_cave1: [72, "dg_crystal1"], crystal_cave2: [73, "dg_crystal2"], crystal_cave3: [74, "dg_crystal3"],
  zone_18: [53, "dg_giran1"], zone_19: [54, "dg_giran2"], zone_20: [55, "dg_giran3"], zone_21: [56, "dg_giran4"],
  zone_22: [25, "dg_train1"], zone_23: [26, "dg_train2"], zone_24: [27, "dg_train3"], zone_25: [28, "dg_train4"], // 修練洞穴
  zone_26: [30, "dg_dv1"], zone_27: [31, "dg_dv2"], zone_28: [32, "dg_dv3"], zone_29: [33, "dg_dv4"], zone_30: [35, "dg_dv5"], zone_31: [36, "dg_dv6"],
  zone_32: [43, "dg_ant1"], zone_33: [44, "dg_ant2"],
  zone_34: [14, "dg_undersea"], zone_35: [60, "dg_heine2"], zone_36: [61, "dg_heine3"],         // 海底隧道／海音地監 2～3 樓（1 樓水域破碎不可用）
  eva_kingdom: [63, "dg_evakingdom", 32735, 32800, 96],
  zone_37: [78, "dg_ivory4"], zone_38: [79, "dg_ivory5"], zone_39: [80, "dg_ivory6"], zone_40: [81, "dg_ivory7"], zone_41: [82, "dg_ivory8"],
  rastabad_cave1: [307, "dg_rasta1"], rastabad_cave2: [308, "dg_rasta2"], rastabad_cave3: [309, "dg_rasta3"],
  rastabad_gate: [450, "dg_rastagate"], rastabad_beast: [455, "dg_rastabeast"], dark_magic_lab: [461, "dg_rastalab"],
  necro_training: [473, "dg_rastanecro"], elder_room: [534, "dg_rastaelder"],
  demon_temple: [410, "dg_demon", 32800, 32890, 96], shadow_temple: [522, "dg_shadow"],
};
