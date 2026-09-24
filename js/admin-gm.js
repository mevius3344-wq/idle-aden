"use strict";

(function () {
  var TOKEN_KEY = "fb5_gm_token";
  var CLASS_NAMES = {
    royal: "王族",
    knight: "騎士",
    elf: "妖精",
    mage: "法師",
    dark: "黑暗妖精",
    dragon: "龍騎士",
    warrior: "戰士",
    illusion: "幻術士",
  };
  var ACTION_NAMES = {
    grant_item: "發道具",
    grant_gold: "發金幣",
    grant_cancel: "取消信件",
    ban: "停權",
    unban: "解除停權",
    kick: "踢下線",
    rates_set: "設定倍率",
    rates_reset: "恢復倍率",
  };

  var _token = "";
  var _items = [];
  var _itemMap = {};
  var _account = null;
  var _picked = null;
  var _grantKind = "item";
  var _toastTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtTime(ms) {
    ms = Number(ms) || 0;
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleString("zh-TW", { hour12: false });
    } catch (e) {
      return String(ms);
    }
  }

  function fmtNum(n) {
    return (Number(n) || 0).toLocaleString();
  }

  function itemName(id) {
    var it = _itemMap[id];
    return it ? it.n : id;
  }

  function apiUrl(p) {
    try {
      if (window.GAME_HOST && typeof GAME_HOST.apiUrl === "function") return GAME_HOST.apiUrl(p);
    } catch (e) {}
    return p;
  }

  function api(method, path, body) {
    var opts = {
      method: method,
      headers: { Authorization: "Bearer " + _token },
      cache: "no-store",
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(apiUrl(path), opts)
      .then(function (res) {
        return res.json().then(
          function (data) {
            data = data || {};
            data._status = res.status;
            return data;
          },
          function () {
            return { ok: false, _status: res.status, message: "伺服器回應格式錯誤（HTTP " + res.status + "）" };
          }
        );
      })
      .catch(function () {
        return { ok: false, _status: 0, message: "無法連線 API。" };
      })
      .then(function (data) {
        if (data._status === 401 || data._status === 503 || data._status === 429) {
          showAuthErr(data.message || "驗證失敗。");
          showDashboard(false);
        }
        return data;
      });
  }

  function toast(msg, isErr) {
    var el = $("gm-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.remove("hidden");
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      el.classList.add("hidden");
    }, 4000);
  }

  function showAuthErr(msg) {
    var el = $("gm-auth-err");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function showDashboard(on) {
    $("gm-auth").classList.toggle("hidden", !!on);
    $("gm-dashboard").classList.toggle("hidden", !on);
  }

  function saveToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function loadToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  /* ───────── 總覽／倍率 ───────── */

  function toLocalInput(ms) {
    if (!ms) return "";
    var d = new Date(ms);
    var pad = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function applyOverview(data) {
    $("gm-kpi-accounts").textContent = fmtNum(data.counts && data.counts.accounts);
    $("gm-kpi-banned").textContent = fmtNum(data.counts && data.counts.banned);
    $("gm-kpi-pending").textContent = fmtNum(data.counts && data.counts.pendingGrants);
    var eff = (data.rates && data.rates.effective) || {};
    var cfg = data.rates && data.rates.config;
    var txt =
      "目前生效：經驗 ×" + (eff.expMult || 1) +
      "、金幣 ×" + (eff.goldMult || 1) +
      "、掉寶 ×" + (eff.dropMult || 1) +
      (eff.rateLabel ? "（" + eff.rateLabel + "）" : "") +
      (eff.rateEndsAt ? "，至 " + fmtTime(eff.rateEndsAt) : cfg ? "，不限時" : "（預設）");
    if (cfg && cfg.endsAt && cfg.endsAt <= Date.now()) txt += " ／ 上次活動已於 " + fmtTime(cfg.endsAt) + " 結束";
    $("gm-rate-current").textContent = txt;
    var src = cfg && (!cfg.endsAt || cfg.endsAt > Date.now()) ? cfg : null;
    $("gm-rate-exp").value = src ? src.expMult : 1;
    $("gm-rate-gold").value = src ? src.goldMult : eff.goldMult || 1;
    $("gm-rate-drop").value = src ? src.dropMult : eff.dropMult || 1;
    $("gm-rate-label").value = src ? src.label || "" : "";
    $("gm-rate-end").value = src && src.endsAt ? toLocalInput(src.endsAt) : "";
  }

  function refreshOverview() {
    return api("GET", "/api/gm/overview").then(function (data) {
      if (!data.ok) {
        if (data._status !== 401 && data._status !== 503 && data._status !== 429) showAuthErr(data.message || "讀取失敗。");
        return false;
      }
      showAuthErr("");
      showDashboard(true);
      applyOverview(data);
      $("gm-updated").textContent = "最後更新：" + fmtTime(Date.now());
      return true;
    });
  }

  function applyRates() {
    var endStr = $("gm-rate-end").value;
    var endsAt = endStr ? new Date(endStr).getTime() : 0;
    if (endStr && !(endsAt > Date.now())) {
      toast("結束時間必須晚於現在。", true);
      return;
    }
    var body = {
      expMult: Number($("gm-rate-exp").value) || 1,
      goldMult: Number($("gm-rate-gold").value) || 1,
      dropMult: Number($("gm-rate-drop").value) || 1,
      label: $("gm-rate-label").value,
      endsAt: endsAt,
    };
    api("POST", "/api/gm/rates", body).then(function (data) {
      if (!data.ok) return toast(data.message || "設定失敗。", true);
      toast("倍率已套用。");
      refreshOverview();
      refreshAudit();
    });
  }

  function resetRates() {
    if (!confirm("確定恢復預設倍率（×1）？")) return;
    api("POST", "/api/gm/rates", { reset: true }).then(function (data) {
      if (!data.ok) return toast(data.message || "操作失敗。", true);
      toast("已恢復預設倍率。");
      refreshOverview();
      refreshAudit();
    });
  }

  /* ───────── 搜尋／帳號 ───────── */

  function doSearch() {
    var q = String($("gm-search").value || "").trim();
    var box = $("gm-search-results");
    if (!q) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = '<p class="gm-empty">搜尋中…</p>';
    api("GET", "/api/gm/search?q=" + encodeURIComponent(q)).then(function (data) {
      if (!data.ok) {
        box.innerHTML = '<p class="gm-empty">' + esc(data.message || "搜尋失敗") + "</p>";
        return;
      }
      var html = "";
      (data.accounts || []).forEach(function (a) {
        html +=
          '<div class="gm-result" data-account="' + esc(a.account) + '"><span>👤 ' + esc(a.account) +
          (a.banned ? ' <span class="gm-badge ban">停權中</span>' : "") +
          "</span><small>註冊 " + esc(fmtTime(a.createdAt)) + "</small></div>";
      });
      (data.chars || []).forEach(function (c) {
        html +=
          '<div class="gm-result" data-account="' + esc(c.account) + '"><span>⚔️ ' + esc(c.name) +
          "</span><small>帳號 " + esc(c.account) + " · 欄位 " + esc(c.slot) + "</small></div>";
      });
      box.innerHTML = html || '<p class="gm-empty">找不到符合的帳號或角色。</p>';
    });
  }

  function openAccount(account) {
    if (!account) return;
    api("GET", "/api/gm/account?account=" + encodeURIComponent(account)).then(function (data) {
      if (!data.ok) return toast(data.message || "讀取帳號失敗。", true);
      _account = data;
      renderAccount();
      $("gm-player").classList.remove("hidden");
      $("gm-inv-box").classList.add("hidden");
      try {
        $("gm-player").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {}
    });
  }

  function reloadAccount() {
    if (_account) openAccount(_account.account);
  }

  function renderAccount() {
    var a = _account;
    $("gm-p-title").textContent = "帳號：" + a.account;
    var badge = $("gm-p-badge");
    var online = a.lastSeenMs && Date.now() - a.lastSeenMs < 60000;
    if (a.banned) {
      badge.className = "gm-badge ban";
      badge.textContent = "停權中";
    } else if (online) {
      badge.className = "gm-badge online";
      badge.textContent = "線上";
    } else {
      badge.className = "gm-badge ok";
      badge.textContent = "正常";
    }
    var rows = [
      ["註冊時間", fmtTime(a.createdAt)],
      ["最後心跳", a.lastSeenMs ? fmtTime(a.lastSeenMs) : "不在線"],
      ["停權", a.banned ? (a.bannedUntil >= 253402300799000 ? "永久" : "至 " + fmtTime(a.bannedUntil)) : "無"],
    ];
    if (a.banned && a.banReason) rows.push(["停權原因", a.banReason]);
    var dl = $("gm-p-info");
    dl.innerHTML = rows
      .map(function (r) {
        return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>";
      })
      .join("");

    var slotHtml = "";
    (a.slots || []).forEach(function (s) {
      slotHtml +=
        "<tr><td>" + s.slot + "</td><td>" + esc(s.name || "（未命名）") + "</td><td>" + esc(CLASS_NAMES[s.cls] || s.cls || "—") +
        "</td><td>" + (s.lv || "—") + "</td><td>" + fmtNum(s.gold) + "</td><td>" + s.invCount + "</td><td>" + esc(fmtTime(s.updatedAt)) +
        '</td><td><button type="button" class="gm-link" data-inv-slot="' + s.slot + '">看背包</button></td></tr>';
    });
    $("gm-p-slots").innerHTML = slotHtml || '<tr><td colspan="8" class="gm-empty">此帳號尚無雲端角色。</td></tr>';

    var sel = $("gm-g-slot");
    var opts = '<option value="0">任一角色（最先上線的角色領取）</option>';
    (a.slots || []).forEach(function (s) {
      opts += '<option value="' + s.slot + '">欄位 ' + s.slot + "：" + esc(s.name || "未命名") + " Lv." + (s.lv || "?") + "</option>";
    });
    sel.innerHTML = opts;

    var gHtml = "";
    (a.grants || []).forEach(function (g) {
      var what =
        g.kind === "gold"
          ? "💰 " + fmtNum(g.amount) + " 金幣"
          : (g.en > 0 ? "+" + g.en + " " : "") + (g.bless ? "祝福的 " : "") + itemName(g.itemId) + " ×" + fmtNum(g.cnt);
      var st, cls;
      if (g.cancelledAt) {
        st = "已取消";
        cls = "st-cancelled";
      } else if (g.claimedAt) {
        st = "已領取（欄位 " + (g.claimedSlot || "?") + "，" + fmtTime(g.claimedAt) + "）";
        cls = "st-claimed";
      } else {
        st = "待領取";
        cls = "st-pending";
      }
      gHtml +=
        "<tr><td>" + g.id + '</td><td class="gm-wrap-cell">' + esc(what) + "</td><td>" + (g.slot ? "欄位 " + g.slot : "任一") +
        '</td><td class="gm-wrap-cell">' + esc(g.note) + "</td><td>" + esc(fmtTime(g.createdAt)) + '</td><td class="' + cls + '">' + esc(st) +
        "</td><td>" +
        (!g.claimedAt && !g.cancelledAt ? '<button type="button" class="gm-link" data-cancel="' + g.id + '">取消</button>' : "") +
        "</td></tr>";
    });
    $("gm-p-grants").innerHTML = gHtml || '<tr><td colspan="7" class="gm-empty">尚無 GM 信件。</td></tr>';
  }

  function showInventory(slot) {
    if (!_account) return;
    api("GET", "/api/gm/inventory?account=" + encodeURIComponent(_account.account) + "&slot=" + slot).then(function (data) {
      if (!data.ok) return toast(data.message || "讀取背包失敗。", true);
      $("gm-inv-title").textContent = "欄位 " + slot + " 背包（雲端存檔 " + fmtTime(data.updatedAt) + "，共 " + data.inv.length + " 格）";
      var html = (data.inv || [])
        .map(function (it) {
          var cls = it.bless === true ? " bless" : it.bless === "cursed" ? " cursed" : "";
          return (
            '<span class="gm-inv-chip' + cls + '" title="' + esc(it.id) + '">' +
            (it.lock ? "🔒" : "") + (it.en ? (it.en > 0 ? "+" : "") + it.en + " " : "") + esc(itemName(it.id)) +
            (it.cnt > 1 ? " ×" + fmtNum(it.cnt) : "") + "</span>"
          );
        })
        .join("");
      $("gm-inv-list").innerHTML = html || '<p class="gm-empty">背包是空的。</p>';
      $("gm-inv-box").classList.remove("hidden");
    });
  }

  /* ───────── 發送 ───────── */

  function loadItems() {
    if (_items.length) return Promise.resolve(true);
    return api("GET", "/api/gm/items").then(function (data) {
      if (!data.ok) return false;
      _items = data.items || [];
      _itemMap = {};
      _items.forEach(function (it) {
        _itemMap[it.id] = it;
      });
      if (_account) renderAccount();
      return true;
    });
  }

  function typeLabel(it) {
    if (it.card) return "卡片";
    return { wpn: "武器", arm: "防具", acc: "飾品", pot: "藥水", scroll: "卷軸", skillbk: "技能書", etc: "道具", misc: "材料" }[it.t] || it.t || "其他";
  }

  function renderItemList() {
    var q = String($("gm-g-item-q").value || "").trim().toLowerCase();
    var box = $("gm-g-item-list");
    if (!q) {
      box.innerHTML = "";
      return;
    }
    var out = [];
    for (var i = 0; i < _items.length && out.length < 60; i++) {
      var it = _items[i];
      if (it.n.toLowerCase().indexOf(q) >= 0 || it.id.toLowerCase().indexOf(q) >= 0) out.push(it);
    }
    box.innerHTML = out.length
      ? out
          .map(function (it) {
            return (
              '<div class="gm-item-row' + (_picked && _picked.id === it.id ? " sel" : "") + '" data-item="' + esc(it.id) + '"><span>' +
              esc(it.n) + "</span><small>" + esc(typeLabel(it)) + " · " + esc(it.id) + "</small></div>"
            );
          })
          .join("")
      : '<p class="gm-empty" style="padding:8px 10px;margin:0">找不到物品。</p>';
  }

  function pickItem(id) {
    _picked = _itemMap[id] || null;
    $("gm-g-picked").textContent = _picked ? "已選擇：" + _picked.n + "（" + _picked.id + "）" : "尚未選擇物品";
    var eq = !!(_picked && _picked.eq);
    $("gm-g-en").disabled = !eq;
    $("gm-g-bless").disabled = !eq;
    if (!eq) {
      $("gm-g-en").value = 0;
      $("gm-g-bless").checked = false;
    }
    renderItemList();
  }

  function setGrantKind(kind) {
    _grantKind = kind === "gold" ? "gold" : "item";
    document.querySelectorAll(".gm-tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-kind") === _grantKind);
    });
    $("gm-g-item-box").classList.toggle("hidden", _grantKind !== "item");
    $("gm-g-gold-box").classList.toggle("hidden", _grantKind !== "gold");
  }

  function sendGrant() {
    if (!_account) return;
    var slot = Number($("gm-g-slot").value) || 0;
    var note = $("gm-g-note").value;
    var body, desc;
    if (_grantKind === "gold") {
      var amount = Math.floor(Number($("gm-g-gold").value) || 0);
      if (amount < 1) return toast("請輸入金幣數量。", true);
      body = { account: _account.account, slot: slot, kind: "gold", amount: amount, note: note };
      desc = fmtNum(amount) + " 金幣";
    } else {
      if (!_picked) return toast("請先搜尋並點選物品。", true);
      var cnt = Math.max(1, Math.floor(Number($("gm-g-cnt").value) || 1));
      var en = Math.max(0, Math.floor(Number($("gm-g-en").value) || 0));
      var bless = !!$("gm-g-bless").checked;
      body = { account: _account.account, slot: slot, kind: "item", itemId: _picked.id, cnt: cnt, en: en, bless: bless, note: note };
      desc = (en > 0 ? "+" + en + " " : "") + (bless ? "祝福的 " : "") + _picked.n + " ×" + cnt;
    }
    var who = _account.account + (slot ? "（欄位 " + slot + "）" : "（任一角色）");
    if (!confirm("確定發送「" + desc + "」給 " + who + "？")) return;
    api("POST", "/api/gm/grant", body).then(function (data) {
      if (!data.ok) return toast(data.message || "發送失敗。", true);
      toast("已放入 GM 信箱：" + desc);
      reloadAccount();
      refreshOverview();
      refreshAudit();
    });
  }

  function cancelGrant(id) {
    if (!confirm("取消第 " + id + " 號信件？")) return;
    api("POST", "/api/gm/grant/cancel", { id: id }).then(function (data) {
      if (!data.ok) return toast(data.message || "取消失敗。", true);
      toast("已取消。");
      reloadAccount();
      refreshOverview();
      refreshAudit();
    });
  }

  /* ───────── 停權 ───────── */

  function doBan() {
    if (!_account) return;
    var hours = Number($("gm-b-hours").value) || 0;
    var reason = $("gm-b-reason").value;
    var label = $("gm-b-hours").selectedOptions[0].textContent;
    if (!confirm("確定將 " + _account.account + " 停權「" + label + "」並踢下線？")) return;
    api("POST", "/api/gm/ban", { account: _account.account, hours: hours, reason: reason }).then(function (data) {
      if (!data.ok) return toast(data.message || "停權失敗。", true);
      toast(_account.account + " 已停權。");
      reloadAccount();
      refreshOverview();
      refreshAudit();
    });
  }

  function doUnban() {
    if (!_account) return;
    if (!confirm("解除 " + _account.account + " 的停權？")) return;
    api("POST", "/api/gm/unban", { account: _account.account }).then(function (data) {
      if (!data.ok) return toast(data.message || "操作失敗。", true);
      toast("已解除停權。");
      reloadAccount();
      refreshOverview();
      refreshAudit();
    });
  }

  function doKick() {
    if (!_account) return;
    if (!confirm("將 " + _account.account + " 踢下線？（未停權，玩家可重新登入）")) return;
    api("POST", "/api/gm/kick", { account: _account.account }).then(function (data) {
      if (!data.ok) return toast(data.message || "操作失敗。", true);
      toast("已踢下線。");
      reloadAccount();
      refreshAudit();
    });
  }

  /* ───────── 紀錄 ───────── */

  function auditDetail(r) {
    var d = r.detail || {};
    switch (r.action) {
      case "grant_item":
        return (d.en > 0 ? "+" + d.en + " " : "") + (d.bless ? "祝福的 " : "") + (d.name || itemName(d.itemId)) + " ×" + fmtNum(d.cnt) + (d.slot ? "（欄位 " + d.slot + "）" : "") + (d.note ? " · " + d.note : "");
      case "grant_gold":
        return fmtNum(d.amount) + " 金幣" + (d.slot ? "（欄位 " + d.slot + "）" : "") + (d.note ? " · " + d.note : "");
      case "grant_cancel":
        return "#" + d.id + " " + (d.kind === "gold" ? fmtNum(d.amount) + " 金幣" : itemName(d.itemId) + " ×" + fmtNum(d.cnt));
      case "ban":
        return (d.permanent ? "永久" : "至 " + fmtTime(d.until)) + (d.reason ? " · " + d.reason : "");
      case "rates_set":
        return "經驗×" + d.expMult + " 金幣×" + d.goldMult + " 掉寶×" + d.dropMult + (d.endsAt ? " 至 " + fmtTime(d.endsAt) : " 不限時") + (d.label ? " · " + d.label : "");
      default:
        return "";
    }
  }

  function refreshAudit() {
    return api("GET", "/api/gm/audit?limit=60").then(function (data) {
      if (!data.ok) return;
      var html = (data.rows || [])
        .map(function (r) {
          return (
            "<tr><td>" + esc(fmtTime(r.at)) + "</td><td>" + esc(ACTION_NAMES[r.action] || r.action) + "</td><td>" +
            (r.target ? '<button type="button" class="gm-link" data-open="' + esc(r.target) + '">' + esc(r.target) + "</button>" : "—") +
            '</td><td class="gm-wrap-cell">' + esc(auditDetail(r)) + "</td><td>" + esc(r.ip) + "</td></tr>"
          );
        })
        .join("");
      $("gm-audit").innerHTML = html || '<tr><td colspan="5" class="gm-empty">尚無紀錄。</td></tr>';
    });
  }

  /* ───────── 綁定 ───────── */

  function start() {
    refreshOverview().then(function (ok) {
      if (!ok) return;
      loadItems();
      refreshAudit();
    });
  }

  function bind() {
    $("gm-token-save").addEventListener("click", function () {
      var t = String($("gm-token").value || "").trim();
      if (t.length < 12) return showAuthErr("Token 至少 12 字元。");
      _token = t;
      saveToken(t);
      start();
    });
    $("gm-token").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("gm-token-save").click();
    });
    $("gm-refresh").addEventListener("click", function () {
      refreshOverview();
      refreshAudit();
      reloadAccount();
    });
    $("gm-logout").addEventListener("click", function () {
      _token = "";
      saveToken("");
      $("gm-token").value = "";
      showDashboard(false);
    });
    $("gm-rate-apply").addEventListener("click", applyRates);
    $("gm-rate-reset").addEventListener("click", resetRates);
    document.querySelectorAll(".gm-mini[data-hours]").forEach(function (b) {
      b.addEventListener("click", function () {
        var h = Number(b.getAttribute("data-hours")) || 0;
        $("gm-rate-end").value = toLocalInput(Date.now() + h * 3600000);
      });
    });
    $("gm-search-btn").addEventListener("click", doSearch);
    $("gm-search").addEventListener("keydown", function (e) {
      if (e.key === "Enter") doSearch();
    });
    $("gm-search-results").addEventListener("click", function (e) {
      var row = e.target.closest("[data-account]");
      if (row) openAccount(row.getAttribute("data-account"));
    });
    $("gm-p-slots").addEventListener("click", function (e) {
      var b = e.target.closest("[data-inv-slot]");
      if (b) showInventory(Number(b.getAttribute("data-inv-slot")));
    });
    $("gm-p-grants").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cancel]");
      if (b) cancelGrant(Number(b.getAttribute("data-cancel")));
    });
    $("gm-audit").addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]");
      if (b) openAccount(b.getAttribute("data-open"));
    });
    $("gm-g-item-q").addEventListener("input", renderItemList);
    $("gm-g-item-list").addEventListener("click", function (e) {
      var row = e.target.closest("[data-item]");
      if (row) pickItem(row.getAttribute("data-item"));
    });
    document.querySelectorAll(".gm-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        setGrantKind(b.getAttribute("data-kind"));
      });
    });
    $("gm-g-send").addEventListener("click", sendGrant);
    $("gm-b-ban").addEventListener("click", doBan);
    $("gm-b-unban").addEventListener("click", doUnban);
    $("gm-b-kick").addEventListener("click", doKick);
  }

  function boot() {
    bind();
    _token = loadToken();
    if (_token.length >= 12) {
      $("gm-token").value = _token;
      start();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
