// 原版整張大地圖（無縫）：同一原版 mapid 的村莊＋野外共用一張圖，走過邊界即換區（不經傳送門）
// 村莊＝towns-config 同 map 的原版安全區；其餘格子歸最近的野外中心（fields-config 同 map 且有取景中心者）
// extraFields：fields-config 沒有中心的野外；portalAt：指定傳送門原版座標（"區>目的"）
module.exports = {
  ti_island: {
    map: 0,
    extraFields: { talking_island: [32520, 32930] },
    portalAt: { "talking_island>zone_13": [32477, 32851] },
  },
  wd_main: { map: 4 },
};
