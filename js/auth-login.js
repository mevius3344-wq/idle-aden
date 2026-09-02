"use strict";

/**
 * 登入閘門：帳號／密碼預設空白（不再固定為「天堂」）。
 * 線上：帳號全站唯一（/api/accounts）；本機快取密碼以便同瀏覽器自動續登。
 * 登入時佔用 IP 連線名額（同 IP 最多雙開）·帳號單一裝置登入。
 */
(function () {
  const ACC_PREFIX = "fb5_account_";
  const SESSION_KEY = "fb5_auth_session";
  const REMEMBER_KEY = "fb5_auth_remember";

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeCred(s) {
    var t = String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
    try {
      if (typeof t.normalize === "function") t = t.normalize("NFC");
    } catch (e) {}
    return t;
  }

  function accountLooksValid(account) {
    if (!account || account.length > 32) return false;
    return /^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(account);
  }

  function setStatus(msg, tone) {
    const el = $("auth-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("ok", "err");
    if (tone === true || tone === "ok") el.classList.add("ok");
    else if (tone === false || tone === "err") el.classList.add("err");
  }

  var _serverStatsTimer = null;

  function formatMult(n) {
    var v = Math.max(1, Number(n) || 1);
    return "×" + (Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(1));
  }

  function applyServerStats(data) {
    if (!data) return;
    try {
      window.__serverStats = {
        onlinePlayers: Number(data.onlinePlayers) || 0,
        goldMult: Math.max(1, Number(data.goldMult) || 1),
        dropMult: Math.max(1, Number(data.dropMult) || 1),
      };
    } catch (e) {}
    var pel = $("auth-stat-players");
    var gel = $("auth-stat-gold");
    var del = $("auth-stat-drop");
    if (pel) pel.textContent = String(data.onlinePlayers != null ? data.onlinePlayers : "—");
    if (gel) gel.textContent = formatMult(data.goldMult);
    if (del) del.textContent = formatMult(data.dropMult);
  }

  function serverStatsUrl() {
    try {
      if (window.GAME_HOST && typeof window.GAME_HOST.apiUrl === "function") {
        return window.GAME_HOST.apiUrl("/api/server/status");
      }
    } catch (e) {}
    return "/api/server/status";
  }

  function refreshServerStats() {
    var pel = $("auth-stat-players");
    var gel = $("auth-stat-gold");
    var del = $("auth-stat-drop");
    if (pel && pel.textContent === "—") pel.textContent = "…";
    if (gel && gel.textContent === "—") gel.textContent = "…";
    if (del && del.textContent === "—") del.textContent = "…";
    fetch(serverStatsUrl() + "?t=" + Date.now(), { method: "GET", cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          applyServerStats(data);
          return;
        }
        applyServerStats({ ok: true, onlinePlayers: 0, goldMult: 1, dropMult: 1 });
      })
      .catch(function () {
        fetch("/api/server/status?t=" + Date.now(), { method: "GET", cache: "no-store" })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data && data.ok) applyServerStats(data);
            else applyServerStats({ ok: true, onlinePlayers: 0, goldMult: 1, dropMult: 1 });
          })
          .catch(function () {
            applyServerStats({ ok: true, onlinePlayers: 0, goldMult: 1, dropMult: 1 });
          });
      });
  }

  function startServerStatsPolling() {
    refreshServerStats();
    if (_serverStatsTimer) clearInterval(_serverStatsTimer);
    _serverStatsTimer = setInterval(refreshServerStats, 30000);
  }

  function stopServerStatsPolling() {
    if (_serverStatsTimer) {
      clearInterval(_serverStatsTimer);
      _serverStatsTimer = null;
    }
  }

  function clearCredFields() {
    const acc = $("auth-account");
    const pass = $("auth-password");
    if (acc) acc.value = "";
    if (pass) pass.value = "";
  }

  function rememberChecked() {
    const el = $("auth-remember");
    return !!(el && el.checked);
  }

  function setRememberChecked(on) {
    const el = $("auth-remember");
    if (el) el.checked = !!on;
  }

  function loadRememberedCreds() {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.account !== "string") return null;
      return {
        account: normalizeCred(data.account),
        password: typeof data.password === "string" ? data.password : "",
      };
    } catch (e) {
      return null;
    }
  }

  function saveRememberedCreds(account, password) {
    try {
      localStorage.setItem(
        REMEMBER_KEY,
        JSON.stringify({
          account: normalizeCred(account),
          password: String(password == null ? "" : password),
          savedAt: Date.now(),
        })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearRememberedCreds() {
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
  }

  function applyRememberedCreds() {
    const remembered = loadRememberedCreds();
    if (!remembered || !remembered.account) {
      setRememberChecked(false);
      clearCredFields();
      return false;
    }
    const acc = $("auth-account");
    const pass = $("auth-password");
    if (acc) acc.value = remembered.account;
    if (pass) pass.value = remembered.password;
    setRememberChecked(true);
    return true;
  }

  function persistRememberPreference(account, password) {
    if (rememberChecked()) saveRememberedCreds(account, password);
    else clearRememberedCreds();
  }

  function readAccount() {
    const el = $("auth-account");
    return el ? normalizeCred(el.value) : "";
  }

  function readPassword() {
    const el = $("auth-password");
    return el ? String(el.value == null ? "" : el.value) : "";
  }

  function saveAccount(account, password) {
    try {
      localStorage.setItem(
        ACC_PREFIX + account,
        JSON.stringify({ password: String(password), createdAt: Date.now() })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  function getStoredPassword(account) {
    try {
      const raw = localStorage.getItem(ACC_PREFIX + account);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data.password === "string" ? data.password : null;
    } catch (e) {
      return null;
    }
  }

  function isRegistered(account) {
    return getStoredPassword(account) !== null;
  }

  function currentSession() {
    try {
      return sessionStorage.getItem(SESSION_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setSession(account) {
    try {
      if (account) sessionStorage.setItem(SESSION_KEY, account);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function showLoggedIn(account) {
    stopServerStatsPolling();
    const auth = $("account-auth-panel");
    if (auth) auth.classList.add("hidden");
    document.querySelectorAll(".account-gated").forEach((el) => {
      el.classList.remove("hidden");
    });
    const welcome = $("auth-welcome");
    if (welcome) welcome.textContent = "歡迎「" + account + "」進入" + (typeof GAME_TITLE !== "undefined" ? GAME_TITLE : "躺著變強");
    try {
      window.__fb5AuthAccount = account;
    } catch (e) {}
  }

  function showLoggedOut() {
    const auth = $("account-auth-panel");
    if (auth) auth.classList.remove("hidden");
    document.querySelectorAll(".account-gated").forEach((el) => {
      el.classList.add("hidden");
    });
    const welcome = $("auth-welcome");
    if (welcome) welcome.textContent = "";
    if (!applyRememberedCreds()) clearCredFields();
    setStatus("請輸入帳號與密碼。");
    startServerStatsPolling();
    try {
      window.__fb5AuthAccount = "";
    } catch (e) {}
  }

  function getClientId() {
    try {
      if (window.IpSessionLimit && typeof window.IpSessionLimit.getClientId === "function") {
        return window.IpSessionLimit.getClientId();
      }
    } catch (e) {}
    return "";
  }

  function holdAccountSession() {
    if (window.AccountSessionLimit && typeof window.AccountSessionLimit.hold === "function") {
      return window.AccountSessionLimit.hold();
    }
    return Promise.resolve({ ok: true });
  }

  function validateAccountSession() {
    if (window.AccountSessionLimit && typeof window.AccountSessionLimit.validate === "function") {
      return window.AccountSessionLimit.validate();
    }
    return Promise.resolve({ ok: true, offline: true });
  }

  function releaseAccountSession() {
    if (window.AccountSessionLimit && typeof window.AccountSessionLimit.release === "function") {
      return window.AccountSessionLimit.release();
    }
    return Promise.resolve({ ok: true });
  }

  function claimIp() {
    if (window.IpSessionLimit && typeof window.IpSessionLimit.claim === "function") {
      return window.IpSessionLimit.claim();
    }
    return Promise.resolve({ ok: true });
  }

  function syncCloud() {
    if (window.cloudSyncOnLoginWithTimeout && typeof window.cloudSyncOnLoginWithTimeout === "function") {
      return window.cloudSyncOnLoginWithTimeout(12000);
    }
    if (window.cloudSyncOnLogin && typeof window.cloudSyncOnLogin === "function") {
      return window.cloudSyncOnLogin();
    }
    return Promise.resolve(false);
  }

  function runBackgroundCloudSync(account) {
    return ensureLocalAccountsOnServer()
      .catch(function () {
        return false;
      })
      .then(function () {
        return syncCloud();
      })
      .then(function (synced) {
        if (synced) setStatus("雲端存檔已同步。", "ok");
      })
      .catch(function () {});
  }

  function verifySessionInBackground(account, opts) {
    opts = opts || {};
    claimIp().then(function (r) {
      if (!r || !r.ok) {
        if (opts.onFail) {
          opts.onFail(
            (r && r.message) || "此 IP 已達雙開上限。請先關閉其他視窗後再登入。"
          );
        }
        return;
      }
      validateAccountSession().then(function (sess) {
        if (sess && sess.ok) {
          if (opts.onOk) opts.onOk(sess);
          else runBackgroundCloudSync(account);
          return;
        }
        if (opts.onFail) {
          opts.onFail((sess && sess.message) || "登入驗證失敗，請重新登入。");
        }
      });
    });
  }

  function resetAuthActivity() {
    try {
      if (window.IdleLogout && typeof window.IdleLogout.resetActivity === "function") {
        window.IdleLogout.resetActivity();
      }
    } catch (e) {}
  }

  function finishAuthSession(acc) {
    var name = acc || "";
    try {
      window.__fb5AuthAccount = name;
    } catch (e) {}
    setSession(name);
    resetAuthActivity();
    holdAccountSession();
  }

  function restoreSession(account) {
    setStatus("正在恢復連線……", "ok");
    startServerStatsPolling();
    claimIp().then(function (r) {
      if (!r || !r.ok) {
        kickToLogin((r && r.message) || "此 IP 已達雙開上限。請先關閉其他視窗。", "err");
        return;
      }
      var password = getStoredPassword(account);
      if (password == null) {
        validateAccountSession().then(function (sess) {
          if (sess && sess.ok) {
            finishAuthSession(account);
            resumeSession(account);
            return;
          }
          kickToLogin((sess && sess.message) || "請重新登入。", "err");
        });
        return;
      }
      httpJson("POST", "/api/accounts/login", {
        account: account,
        password: password,
        clientId: getClientId(),
      })
        .then(function (lr) {
          if (lr && lr.data && lr.data.ok) {
            if (lr.data.authToken && typeof window.anticheatSetAuthToken === "function") {
              window.anticheatSetAuthToken(lr.data.authToken);
            }
            var acc = (lr.data && lr.data.account) || account;
            finishAuthSession(acc);
            resumeSession(acc);
            return;
          }
          var msg =
            (lr && lr.data && lr.data.message) ||
            (lr && lr.data && lr.data.error === "session_active"
              ? "此帳號已在其他裝置登入。請先於該裝置登出後再試。"
              : "登入已失效，請重新登入。");
          kickToLogin(msg, "err");
        })
        .catch(function () {
          kickToLogin("無法連線伺服器，請重新登入。", "err");
        });
    });
  }

  function resumeSession(account) {
    showLoggedIn(account);
    setStatus("歡迎回來，正在背景同步雲端……", "ok");
    runBackgroundCloudSync(account);
  }

  function silentRelogin(account) {
    var password = getStoredPassword(account);
    if (password == null) return Promise.resolve({ ok: false });
    return httpJson("POST", "/api/accounts/login", {
      account: account,
      password: password,
      clientId: getClientId(),
    }).then(function (r) {
      if (r && r.data && r.data.ok) {
        if (r.data.authToken && typeof window.anticheatSetAuthToken === "function") {
          window.anticheatSetAuthToken(r.data.authToken);
        }
        var acc = (r.data && r.data.account) || account;
        try {
          window.__fb5AuthAccount = acc;
        } catch (e) {}
        holdAccountSession();
        return { ok: true, account: acc };
      }
      return {
        ok: false,
        message:
          (r && r.data && r.data.message) ||
          (r && r.data && r.data.error === "session_active"
            ? "此帳號已在其他裝置登入。請先於該裝置登出後再試。"
            : "登入已失效，請重新登入。"),
      };
    });
  }

  function kickToLogin(message, tone) {
    setSession("");
    try {
      window.__fb5AuthAccount = "";
    } catch (e) {}
    if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
    showLoggedOut();
    setStatus(message || "請重新登入。", tone || "err");
  }

  function listLocalAccounts() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(ACC_PREFIX) !== 0) continue;
        var account = normalizeCred(k.slice(ACC_PREFIX.length));
        if (!accountLooksValid(account)) continue;
        var password = getStoredPassword(account);
        if (password == null) continue;
        out.push({ account: account, password: password });
      }
    } catch (e) {}
    return out;
  }

  /** 把本機已註冊帳號補上伺服器（409＝已存在略過）。解決：甲機離線註冊／伺服器重部屬後乙機「帳號不存在」。 */
  function ensureLocalAccountsOnServer() {
    return accountsApiReady().then(function (online) {
      if (!online) return false;
      var rows = listLocalAccounts();
      if (!rows.length) return false;
      return Promise.all(
        rows.map(function (row) {
          return httpJson("POST", "/api/accounts/register", {
            account: row.account,
            password: row.password,
          }).then(
            function (r) {
              return !!(r && r.data && (r.data.ok || r.status === 409));
            },
            function () {
              return false;
            }
          );
        })
      ).then(function () {
        return true;
      });
    });
  }

  function enterGame(account) {
    setSession(account);
    try {
      window.__fb5AuthAccount = account;
    } catch (e) {}
    persistRememberPreference(account, readPassword());
    showLoggedIn(account);
    setStatus("歡迎進入遊戲，正在背景同步雲端……", "ok");
  }

  function httpJson(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body != null ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      cache: "no-store",
    }).then(function (res) {
      return res.json().then(
        function (data) {
          return { status: res.status, data: data };
        },
        function () {
          return { status: res.status, data: null };
        }
      );
    });
  }

  function accountsApiReady() {
    try {
      if (location.protocol !== "http:" && location.protocol !== "https:") {
        return Promise.resolve(false);
      }
    } catch (e) {
      return Promise.resolve(false);
    }
    return httpJson("GET", "/api/accounts/status")
      .then(function (r) {
        return !!(r && r.data && r.data.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function registerAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account) {
      setStatus("請輸入帳號。", "err");
      return;
    }
    if (!accountLooksValid(account)) {
      setStatus("帳號僅能使用中文、英數、底線或連字號。", "err");
      return;
    }
    if (isRegistered(account)) {
      setStatus("此帳號已在本機註冊，請直接登入。", "err");
      return;
    }
    setStatus("註冊中……", "ok");
    accountsApiReady().then(function (online) {
      if (!online) {
        if (!saveAccount(account, password)) {
          setStatus("註冊失敗（本機儲存空間不足）。", "err");
          return;
        }
        persistRememberPreference(account, password);
        setStatus("註冊成功（僅本機）。換手機前請先連線再開一次並登入，帳號才會同步到伺服器。", "ok");
        return;
      }
      httpJson("POST", "/api/accounts/register", { account: account, password: password })
        .then(function (r) {
          if (r && r.data && r.data.ok) {
            saveAccount(account, password);
            persistRememberPreference(account, password);
            setStatus("註冊成功（已上雲），其他手機可用同一帳密登入。", "ok");
            return;
          }
          const msg =
            (r && r.data && r.data.message) ||
            (r && r.status === 409 ? "此帳號已被註冊，請換一個帳號。" : "註冊失敗，請稍後再試。");
          setStatus(msg, "err");
        })
        .catch(function () {
          setStatus("無法連線伺服器註冊，請稍後再試。", "err");
        });
    });
  }

  function wakeServerBeforeAuth() {
    if (window.GameServerWake && typeof window.GameServerWake.ensureAwake === "function") {
      return window.GameServerWake.ensureAwake(90000);
    }
    return Promise.resolve({ ok: true });
  }

  function loginAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account) {
      setStatus("請輸入帳號。", "err");
      return;
    }
    if (!accountLooksValid(account)) {
      setStatus("帳號僅能使用中文、英數、底線或連字號。", "err");
      return;
    }
    setStatus("伺服器喚醒中……", "ok");

    wakeServerBeforeAuth().then(function (wake) {
      if (!wake || !wake.ok) {
        setStatus("伺服器喚醒逾時，請稍後再試。", "err");
        return;
      }
      doLoginAccount(account, password);
    });
  }

  function doLoginAccount(account, password) {
    setStatus("驗證中……", "ok");

    const finishOk = function (acc) {
      saveAccount(acc || account, password);
      claimIp().then(function (r) {
        if (!r || !r.ok) {
          setStatus((r && r.message) || "此 IP 已達雙開上限。請先關閉其他視窗後再登入。", "err");
          return;
        }
        enterGame(acc || account);
        finishAuthSession(acc || account);
        runBackgroundCloudSync(acc || account);
      });
    };

    const tryOffline = function () {
      const stored = getStoredPassword(account);
      if (stored === null) {
        setStatus("帳號不存在，請先註冊（需連線伺服器）。", "err");
        return;
      }
      if (stored !== password) {
        setStatus("帳號或密碼錯誤。", "err");
        return;
      }
      finishOk(account);
    };

    httpJson("POST", "/api/accounts/login", {
      account: account,
      password: password,
      clientId: getClientId(),
    })
      .then(function (r) {
        if (r && r.data && r.data.ok) {
          if (r.data.authToken && typeof window.anticheatSetAuthToken === "function") {
            window.anticheatSetAuthToken(r.data.authToken);
          }
          finishOk((r.data && r.data.account) || account);
          return;
        }
        if (r && r.status === 404) {
          const stored = getStoredPassword(account);
          if (stored !== null && stored === password) {
            return httpJson("POST", "/api/accounts/register", {
              account: account,
              password: password,
            }).then(function (reg) {
              if (reg && reg.data && reg.data.ok) {
                return httpJson("POST", "/api/accounts/login", {
                  account: account,
                  password: password,
                  clientId: getClientId(),
                }).then(function (lr) {
                  if (lr && lr.data && lr.data.ok && lr.data.authToken && typeof window.anticheatSetAuthToken === "function") {
                    window.anticheatSetAuthToken(lr.data.authToken);
                  }
                  finishOk(account);
                });
              }
              if (reg && reg.status === 409) {
                setStatus("此帳號已被他人註冊，請換帳號或確認密碼。", "err");
                return;
              }
              setStatus((reg && reg.data && reg.data.message) || "帳號同步失敗。", "err");
            });
          }
          setStatus(
            "帳號不存在於伺服器。請確認帳密，或回原手機連線登入一次以同步帳號；勿在乙機重新註冊同名以免蓋掉進度。",
            "err"
          );
          return;
        }
        const msg =
          (r && r.data && r.data.message) ||
          (r && r.data && r.data.error === "session_active"
            ? "此帳號已在其他裝置登入。請先於該裝置登出後再試。"
            : "帳號或密碼錯誤。");
        setStatus(msg, "err");
      })
      .catch(function () {
        accountsApiReady().then(function (online) {
          if (online) {
            setStatus("無法連線伺服器，請稍後再試。", "err");
            return;
          }
          tryOffline();
        });
      });
  }

  function logoutAccount(opts) {
    if (window.IpSessionLimit && typeof window.IpSessionLimit.release === "function") {
      try {
        window.IpSessionLimit.release();
      } catch (e) {}
    }
    releaseAccountSession();
    // 先把本機存檔刷上雲端，再清快取（避免雲端空／部署後登出把角色洗掉）
    try {
      if (window.cloudFlushLocalToCloud && typeof window.cloudFlushLocalToCloud === "function") {
        window.cloudFlushLocalToCloud();
      }
    } catch (e) {}
    try {
      if (window.cloudClearLocalCache && typeof window.cloudClearLocalCache === "function") {
        window.cloudClearLocalCache();
      }
    } catch (e2) {}
    setSession("");
    if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
    showLoggedOut();
    var msg = opts && opts.message ? String(opts.message) : "已登出。";
    var tone = opts && opts.tone ? opts.tone : opts && opts.message ? "err" : "ok";
    setStatus(msg, tone);
    try {
      if (window.IdleLogout && typeof window.IdleLogout.resetActivity === "function") window.IdleLogout.resetActivity();
    } catch (e3) {}
  }

  function onIpSessionLost() {
    setSession("");
    if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
    showLoggedOut();
    setStatus("連線名額已失效（IP 雙開限制）。請重新登入。", "err");
  }

  var _sessionRecovering = false;

  function onAccountSessionLost(payload) {
    if (_sessionRecovering) return;
    var account = "";
    try {
      account = currentSession() || String(window.__fb5AuthAccount || "").trim();
    } catch (e0) {}
    account = normalizeCred(account);
    var password = account ? getStoredPassword(account) : null;
    if (account && password != null) {
      _sessionRecovering = true;
      httpJson("POST", "/api/accounts/login", {
        account: account,
        password: password,
        clientId: getClientId(),
      })
        .then(function (lr) {
          _sessionRecovering = false;
          if (lr && lr.data && lr.data.ok) {
            if (lr.data.authToken && typeof window.anticheatSetAuthToken === "function") {
              window.anticheatSetAuthToken(lr.data.authToken);
            }
            finishAuthSession((lr.data && lr.data.account) || account);
            return;
          }
          setSession("");
          if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
          showLoggedOut();
          var msg2 =
            (lr && lr.data && lr.data.message) ||
            (payload && payload.message) ||
            "此帳號已在其他裝置登入，本裝置已自動登出。";
          setStatus(msg2, "err");
        })
        .catch(function () {
          _sessionRecovering = false;
          setSession("");
          if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
          showLoggedOut();
          setStatus((payload && payload.message) || "連線中斷，請重新登入。", "err");
        });
      return;
    }
    setSession("");
    if (typeof window.anticheatSetAuthToken === "function") window.anticheatSetAuthToken("");
    showLoggedOut();
    var msg =
      (payload && payload.message) ||
      "此帳號已在其他裝置登入，本裝置已自動登出。";
    setStatus(msg, "err");
    try {
      alert(msg);
    } catch (e) {}
  }

  function boot() {
    // 有「記住」則還原帳密；否則清空，並阻擋瀏覽器自動填入舊的「天堂」
    if (!applyRememberedCreds()) {
      clearCredFields();
      setTimeout(clearCredFields, 0);
      setTimeout(clearCredFields, 200);
      setTimeout(clearCredFields, 800);
    }

    const btnReg = $("btn-auth-register");
    const btnLogin = $("btn-auth-login");
    const btnLogout = $("btn-auth-logout");
    if (btnReg) btnReg.addEventListener("click", registerAccount);
    if (btnLogin) btnLogin.addEventListener("click", loginAccount);
    if (btnLogout) btnLogout.addEventListener("click", logoutAccount);

    const remember = $("auth-remember");
    if (remember) {
      remember.addEventListener("change", function () {
        if (!remember.checked) clearRememberedCreds();
        else {
          const account = readAccount();
          const password = readPassword();
          if (account) saveRememberedCreds(account, password);
        }
      });
    }

    const pass = $("auth-password");
    if (pass) {
      pass.addEventListener("keydown", function (e) {
        if (e.key === "Enter") loginAccount();
      });
    }

    const session = currentSession();
    // 舊版固定帳號「天堂」的 session 作廢，避免一進來就跳過登入框
    if (session === "天堂") {
      setSession("");
      showLoggedOut();
      return;
    }
    if (session && isRegistered(session)) {
      try {
        window.__fb5AuthAccount = session;
      } catch (e) {}
      restoreSession(session);
    } else {
      showLoggedOut();
      // 未登入也嘗試把本機帳號補上伺服器，方便稍後乙機登入
      try {
        ensureLocalAccountsOnServer().catch(function () {});
      } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.GameAccountAuth = {
    registerAccount: registerAccount,
    loginAccount: loginAccount,
    logoutAccount: logoutAccount,
    currentAccount: currentSession,
    onIpSessionLost: onIpSessionLost,
    onAccountSessionLost: onAccountSessionLost,
  };
})();
