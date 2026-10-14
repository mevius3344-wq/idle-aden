"use strict";

/**
 * 雲端存檔先後判定（取代「等級→經驗→金幣→道具數」猜誰較好：花錢、喝藥、死亡扣經驗都會被當成舊檔拒收＝回溯）。
 * 伺服器每次收檔把 p.srvRev 加 1，並記寫入者工作階段（雜湊）與該次客戶端時間：
 *  - 同一登入工作階段：照它自己的存檔時間先後收（晚到的舊請求擋掉）
 *  - 換了工作階段（重登／換裝置）：存檔必須源自目前雲端版本（srvRev ≥ 雲端）才收
 *  - 舊檔（雲端尚無 srvRev）：較新時間或進度較高才收
 * 被踢下線的舊裝置工作階段已失效（401），寫不進來。
 */

const crypto = require("crypto");

function saveRevOf(data) {
  return Math.max(0, Math.floor(Number(data && data.p && data.p.srvRev) || 0));
}

function saveClientTime(data) {
  const t = Number((data && data.p && data.p.savedAt) || (data && data.savedAt) || 0);
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
}

function sessionTag(sessionId) {
  const s = String(sessionId || "");
  if (!s) return "";
  return crypto.createHash("sha1").update("save-sid|" + s).digest("hex").slice(0, 16);
}

/** @param legacyBeats (incoming, existing) => boolean：雲端尚無 srvRev 時的舊規則 */
function saveOrderAccept(incoming, existing, sessionId, legacyBeats) {
  if (!existing || !existing.p) return true;
  if (!incoming || !incoming.p) return false;
  const exRev = saveRevOf(existing);
  const inRev = saveRevOf(incoming);
  const inAt = saveClientTime(incoming);
  if (exRev === 0) {
    const exAt = saveClientTime(existing);
    if (inAt && exAt && inAt >= exAt) return true;
    return typeof legacyBeats === "function" ? !!legacyBeats(incoming, existing) : true;
  }
  const tag = sessionTag(sessionId);
  if (tag && tag === String(existing.p.srvSid || "")) {
    const exAt = Math.max(0, Math.floor(Number(existing.p.srvAt) || 0)) || saveClientTime(existing);
    return !inAt || !exAt || inAt >= exAt;
  }
  return inRev >= exRev;
}

/** 收檔時蓋章（寫入前呼叫），回傳新版本號 */
function saveOrderStamp(incoming, existing, sessionId) {
  if (!incoming || !incoming.p) return 0;
  const rev = Math.max(saveRevOf(existing), saveRevOf(incoming)) + 1;
  incoming.p.srvRev = rev;
  incoming.p.srvSid = sessionTag(sessionId);
  incoming.p.srvAt = saveClientTime(incoming) || Date.now();
  return rev;
}

module.exports = { saveRevOf, saveOrderAccept, saveOrderStamp, sessionTag };
