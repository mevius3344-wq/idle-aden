"use strict";

(function () {
  var TOKEN_KEY = "fb5_metrics_token";
  var POLL_MS = 10000;
  var RENDER_METRICS = "https://idle-aden.onrender.com/api/server/metrics";

  var _timer = null;
  var _token = "";

  function $(id) {
    return document.getElementById(id);
  }

  function loadToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function saveToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function neonMetricsUrl() {
    try {
      if (window.GAME_HOST && typeof GAME_HOST.apiUrl === "function") {
        return GAME_HOST.apiUrl("/api/server/metrics");
      }
    } catch (e) {}
    return "/api/server/metrics";
  }

  function renderMetricsUrl() {
    try {
      if (window.GAME_HOST && GAME_HOST.assetBase) {
        return String(GAME_HOST.assetBase).replace(/\/$/, "") + "/api/server/metrics";
      }
    } catch (e) {}
    return RENDER_METRICS;
  }

  function fetchMetrics(url) {
    return fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), {
      method: "GET",
      headers: { Authorization: "Bearer " + _token },
      cache: "no-store",
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  function fmtUptime(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + " 時 " + m + " 分";
    if (m > 0) return m + " 分 " + s + " 秒";
    return s + " 秒";
  }

  function fmtTime(ms) {
    try {
      return new Date(ms).toLocaleString("zh-TW", { hour12: false });
    } catch (e) {
      return String(ms);
    }
  }

  function setKpiStatus(el, status) {
    if (!el) return;
    el.classList.remove("status-ok", "status-warn", "status-critical");
    if (status) el.classList.add("status-" + status);
  }

  function renderDl(target, rows) {
    var el = $(target);
    if (!el) return;
    el.innerHTML = "";
    rows.forEach(function (row) {
      var dt = document.createElement("dt");
      dt.textContent = row[0];
      var dd = document.createElement("dd");
      dd.textContent = row[1];
      el.appendChild(dt);
      el.appendChild(dd);
    });
  }

  function showPanelError(target, msg) {
    var el = $(target);
    if (!el) return;
    el.innerHTML = '<p class="am-panel-err">' + String(msg || "無法取得資料") + "</p>";
  }

  function applyNeon(data) {
    if (!data || !data.ok) return;
    var online = (data.online && data.online.accountSessions) || 0;
    var ip = (data.online && data.online.ipSessions) || 0;
    var dbMb = (data.database && data.database.totalMb) || 0;
    var cap = data.capacity || {};

    $("am-val-ccu").textContent = String(online);
    $("am-val-ip").textContent = String(ip);
    $("am-val-db").textContent = dbMb.toFixed(1) + " MB";
    setKpiStatus($("am-kpi-ccu"), cap.ccuStatus);
    setKpiStatus($("am-kpi-ip"), online > 100 ? "warn" : "ok");
    setKpiStatus($("am-kpi-db"), cap.storageStatus);
    $("am-sub-ccu").textContent =
      "建議 ≤ " + (cap.ccuComfort || 50) + " · " + (cap.ccuLabel || "");
    $("am-sub-db").textContent =
      "免費 " + (cap.storageFreeMb || 512) + " MB · " + (cap.storageLabel || "");

    var db = data.database || {};
    var mem = data.memory || {};
    var lat = data.latency || {};
    renderDl("am-neon-body", [
      ["後端", data.backend || "vercel-neon"],
      ["程序運行", fmtUptime(data.uptimeSec)],
      ["記憶體 RSS", (mem.rssMb || 0).toFixed(1) + " MB"],
      ["Heap 使用", (mem.heapUsedMb || 0).toFixed(1) + " MB"],
      ["DB 延遲", (lat.dbPingMs != null ? lat.dbPingMs : "—") + " ms"],
      ["API 總耗時", (lat.totalMs != null ? lat.totalMs : "—") + " ms"],
      ["註冊帳號", String(db.accounts != null ? db.accounts : "—")],
      ["雲端角色槽", String(db.cloudSlots != null ? db.cloudSlots : "—")],
      ["雲端資料量", (db.cloudDataMb || 0).toFixed(2) + " MB"],
      ["聊天紀錄列", String(db.chatRows != null ? db.chatRows : "—")],
      ["組隊房間", String(db.parties != null ? db.parties : "—")],
      ["金幣倍率", "×" + ((data.rates && data.rates.goldMult) || 1)],
      ["掉寶倍率", "×" + ((data.rates && data.rates.dropMult) || 1)],
    ]);

    var capEl = $("am-capacity");
    if (capEl) {
      capEl.innerHTML =
        '<li class="' +
        (cap.ccuStatus || "ok") +
        '">同時在線 <strong>' +
        online +
        "</strong> 人（舒適 ≤ " +
        (cap.ccuComfort || 50) +
        "，壓力 ≤ " +
        (cap.ccuStress || 100) +
        "）</li>" +
        '<li class="' +
        (cap.storageStatus || "ok") +
        '">Neon 已用 <strong>' +
        dbMb.toFixed(1) +
        " MB</strong>／" +
        (cap.storageFreeMb || 512) +
        " MB</li>" +
        "<li>建議註冊帳號上限約 <strong>" +
        (cap.accountsSafeMax || "—") +
        "</strong>（含雲端存檔）</li>" +
        "<li>IP 連線 <strong>" +
        ip +
        "</strong>（含雙開分頁）</li>";
    }
  }

  function applyRender(data) {
    if (!data || !data.ok) {
      showPanelError(
        "am-render-body",
        (data && data.message) || "Render 節點無回應或未設定 METRICS_TOKEN"
      );
      return;
    }
    var mem = data.memory || {};
    var online = data.online || {};
    var lat = data.latency || {};
    renderDl("am-render-body", [
      ["後端", data.backend || "render"],
      ["運行時間", fmtUptime(data.uptimeSec)],
      ["記憶體 RSS", (mem.rssMb || 0).toFixed(1) + " MB"],
      ["Heap 使用", (mem.heapUsedMb || 0).toFixed(1) + " MB"],
      ["本機帳號連線", String(online.accountSessions != null ? online.accountSessions : "—")],
      ["IP 連線", String(online.ipSessions != null ? online.ipSessions : "—")],
      ["回應耗時", (lat.totalMs != null ? lat.totalMs : "—") + " ms"],
    ]);
  }

  function showAuthErr(msg) {
    var el = $("am-auth-err");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function showDashboard(on) {
    $("am-auth").classList.toggle("hidden", !!on);
    $("am-dashboard").classList.toggle("hidden", !on);
  }

  function refresh() {
    if (!_token) return;
    var neonP = fetchMetrics(neonMetricsUrl());
    var renderP = fetchMetrics(renderMetricsUrl());
    return Promise.all([neonP, renderP])
      .then(function (results) {
        var neon = results[0];
        var render = results[1];
        if (neon.status === 401 || render.status === 401) {
          showAuthErr("Token 無效，請重新輸入。");
          showDashboard(false);
          stopPoll();
          return;
        }
        if (neon.status === 503 || (neon.data && neon.data.error === "not_configured")) {
          showAuthErr("Vercel 尚未設定 METRICS_TOKEN 環境變數。");
          return;
        }
        showAuthErr("");
        showDashboard(true);
        if (neon.data && neon.data.ok) applyNeon(neon.data);
        else showPanelError("am-neon-body", (neon.data && neon.data.message) || "Neon API 錯誤");
        applyRender(render.data);
        $("am-updated").textContent = "最後更新：" + fmtTime(Date.now());
      })
      .catch(function () {
        $("am-updated").textContent = "更新失敗 " + fmtTime(Date.now());
      });
  }

  function startPoll() {
    stopPoll();
    refresh();
    _timer = setInterval(refresh, POLL_MS);
  }

  function stopPoll() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  function bindAuth() {
    var saveBtn = $("am-token-save");
    var input = $("am-token");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var t = input ? String(input.value || "").trim() : "";
        if (t.length < 8) {
          showAuthErr("Token 至少 8 字元。");
          return;
        }
        _token = t;
        saveToken(t);
        startPoll();
      });
    }
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && saveBtn) saveBtn.click();
      });
    }
    var ref = $("am-refresh");
    if (ref) ref.addEventListener("click", refresh);
    var out = $("am-logout");
    if (out) {
      out.addEventListener("click", function () {
        _token = "";
        saveToken("");
        stopPoll();
        showDashboard(false);
        showAuthErr("");
        if (input) input.value = "";
      });
    }
  }

  function boot() {
    bindAuth();
    _token = loadToken();
    var input = $("am-token");
    if (input && _token) input.value = _token;
    if (_token.length >= 8) startPoll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
