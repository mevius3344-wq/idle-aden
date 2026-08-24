"use strict";

/**
 * 登入閘門：帳號／密碼預設空白（不再固定為「天堂」）。
 * 註冊後寫入本機；登入成功才顯示主選單。
 * 登入時佔用 IP 連線名額（同 IP 最多雙開）。
 */
(function () {
  const ACC_PREFIX = "fb5_account_";
  const SESSION_KEY = "fb5_auth_session";

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

  function setStatus(msg, tone) {
    const el = $("auth-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("ok", "err");
    if (tone === true || tone === "ok") el.classList.add("ok");
    else if (tone === false || tone === "err") el.classList.add("err");
  }

  function clearCredFields() {
    const acc = $("auth-account");
    const pass = $("auth-password");
    if (acc) acc.value = "";
    if (pass) pass.value = "";
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
    const auth = $("account-auth-panel");
    if (auth) auth.classList.add("hidden");
    document.querySelectorAll(".account-gated").forEach((el) => {
      el.classList.remove("hidden");
    });
    const welcome = $("auth-welcome");
    if (welcome) welcome.textContent = "歡迎「" + account + "」進入經典天堂";
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
    clearCredFields();
    setStatus("請輸入帳號與密碼。");
    try {
      window.__fb5AuthAccount = "";
    } catch (e) {}
  }

  function claimIp() {
    if (window.IpSessionLimit && typeof window.IpSessionLimit.claim === "function") {
      return window.IpSessionLimit.claim();
    }
    return Promise.resolve({ ok: true });
  }

  function syncCloud() {
    if (window.cloudSyncOnLogin && typeof window.cloudSyncOnLogin === "function") {
      return window.cloudSyncOnLogin();
    }
    return Promise.resolve(false);
  }

  function enterGame(account) {
    setSession(account);
    setStatus("驗證成功，正在進入……", "ok");
    return syncCloud().finally(function () {
      showLoggedIn(account);
    });
  }

  function registerAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account) {
      setStatus("請輸入帳號。", "err");
      return;
    }
    if (isRegistered(account)) {
      setStatus("此帳號已註冊，請直接登入。", "err");
      return;
    }
    if (!saveAccount(account, password)) {
      setStatus("註冊失敗（本機儲存空間不足）。", "err");
      return;
    }
    setStatus("註冊成功，請點登入。", "ok");
  }

  function loginAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account) {
      setStatus("請輸入帳號。", "err");
      return;
    }
    const stored = getStoredPassword(account);
    if (stored === null) {
      setStatus("帳號不存在，請先註冊。", "err");
      return;
    }
    if (stored !== password) {
      setStatus("帳號或密碼錯誤。", "err");
      return;
    }
    setStatus("驗證中……", "ok");
    claimIp().then(function (r) {
      if (r && r.ok) {
        enterGame(account);
        return;
      }
      const msg =
        (r && r.message) ||
        "此 IP 已達雙開上限（最多 2 個連線）。請先關閉其他視窗後再試。";
      setStatus(msg, "err");
      try {
        alert(msg);
      } catch (e) {}
    });
  }

  function logoutAccount() {
    if (window.IpSessionLimit && typeof window.IpSessionLimit.release === "function") {
      try {
        window.IpSessionLimit.release();
      } catch (e) {}
    }
    setSession("");
    showLoggedOut();
    setStatus("已登出。", "ok");
  }

  function onIpSessionLost() {
    setSession("");
    showLoggedOut();
    setStatus("連線名額已失效（IP 雙開限制）。請重新登入。", "err");
  }

  function boot() {
    // 強制空白：阻擋瀏覽器自動填入舊的「天堂」
    clearCredFields();
    setTimeout(clearCredFields, 0);
    setTimeout(clearCredFields, 200);
    setTimeout(clearCredFields, 800);

    const btnReg = $("btn-auth-register");
    const btnLogin = $("btn-auth-login");
    const btnLogout = $("btn-auth-logout");
    if (btnReg) btnReg.addEventListener("click", registerAccount);
    if (btnLogin) btnLogin.addEventListener("click", loginAccount);
    if (btnLogout) btnLogout.addEventListener("click", logoutAccount);

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
      claimIp().then(function (r) {
        if (r && r.ok) {
          syncCloud().finally(function () {
            showLoggedIn(session);
          });
        } else {
          setSession("");
          showLoggedOut();
          setStatus(
            (r && r.message) || "此 IP 已達雙開上限。請先關閉其他視窗後再登入。",
            "err"
          );
        }
      });
    } else {
      showLoggedOut();
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
  };
})();
