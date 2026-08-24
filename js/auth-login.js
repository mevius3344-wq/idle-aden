"use strict";

/**
 * 登入閘門：帳號／密碼皆為「天堂」。
 * 通過後才顯示主選單「開始遊戲」。
 * 登入時佔用 IP 連線名額（同 IP 最多雙開）。
 */
(function () {
  const ACC_PREFIX = "fb5_account_";
  const SESSION_KEY = "fb5_auth_session";
  const FIXED_ACCOUNT = "天堂";
  const FIXED_PASSWORD = "天堂";

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, tone) {
    const el = $("auth-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("ok", "err");
    if (tone === true || tone === "ok") el.classList.add("ok");
    else if (tone === false || tone === "err") el.classList.add("err");
  }

  function readAccount() {
    const el = $("auth-account");
    return el ? el.value.trim() : "";
  }

  function readPassword() {
    const el = $("auth-password");
    return el ? el.value : "";
  }

  function ensureFixedAccount() {
    try {
      localStorage.setItem(
        ACC_PREFIX + FIXED_ACCOUNT,
        JSON.stringify({ password: FIXED_PASSWORD, createdAt: Date.now() })
      );
    } catch (e) {}
  }

  function isRegistered(account) {
    return !!localStorage.getItem(ACC_PREFIX + account);
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
  }

  function showLoggedOut() {
    const auth = $("account-auth-panel");
    if (auth) auth.classList.remove("hidden");
    document.querySelectorAll(".account-gated").forEach((el) => {
      el.classList.add("hidden");
    });
    const welcome = $("auth-welcome");
    if (welcome) welcome.textContent = "";
    setStatus("請輸入帳號與密碼（皆為「天堂」）。");
  }

  function registerAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account || !password) {
      setStatus("請輸入帳號與密碼。", "err");
      return;
    }
    if (account !== FIXED_ACCOUNT || password !== FIXED_PASSWORD) {
      setStatus("本伺服器僅開放帳號／密碼「天堂」。", "err");
      return;
    }
    ensureFixedAccount();
    setStatus("帳號已就緒，請點登入。", "ok");
  }

  function enterAfterClaim(account) {
    setSession(account);
    setStatus("驗證成功，正在同步雲端進度……", "ok");
    var sync =
      window.cloudSyncOnLogin && typeof window.cloudSyncOnLogin === "function"
        ? window.cloudSyncOnLogin
        : function () {
            return Promise.resolve(false);
          };
    sync().finally(function () {
      setStatus("驗證成功，正在進入……", "ok");
      setTimeout(function () {
        showLoggedIn(account);
      }, 200);
    });
  }

  function loginAccount() {
    const account = readAccount();
    const password = readPassword();
    if (!account || !password) {
      setStatus("請輸入帳號與密碼。", "err");
      return;
    }
    if (account !== FIXED_ACCOUNT || password !== FIXED_PASSWORD) {
      setStatus("帳號或密碼錯誤。（應為「天堂」）", "err");
      return;
    }
    ensureFixedAccount();
    setStatus("驗證中……", "ok");

    const claimer =
      window.IpSessionLimit && typeof window.IpSessionLimit.claim === "function"
        ? window.IpSessionLimit.claim
        : function () {
            return Promise.resolve({ ok: true });
          };

    claimer().then(function (r) {
      if (r && r.ok) {
        enterAfterClaim(FIXED_ACCOUNT);
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
    const pass = $("auth-password");
    if (pass) pass.value = "";
    showLoggedOut();
    setStatus("已登出。", "ok");
  }

  function onIpSessionLost() {
    setSession("");
    showLoggedOut();
    setStatus("連線名額已失效（IP 雙開限制）。請重新登入。", "err");
  }

  function boot() {
    ensureFixedAccount();

    const acc = $("auth-account");
    const pass = $("auth-password");
    if (acc && !acc.value) acc.value = FIXED_ACCOUNT;
    if (pass && !pass.value) pass.placeholder = FIXED_PASSWORD;

    const btnReg = $("btn-auth-register");
    const btnLogin = $("btn-auth-login");
    const btnLogout = $("btn-auth-logout");
    if (btnReg) btnReg.addEventListener("click", registerAccount);
    if (btnLogin) btnLogin.addEventListener("click", loginAccount);
    if (btnLogout) btnLogout.addEventListener("click", logoutAccount);

    if (pass) {
      pass.addEventListener("keydown", function (e) {
        if (e.key === "Enter") loginAccount();
      });
    }

    const session = currentSession();
    if (session === FIXED_ACCOUNT && isRegistered(session)) {
      // 重新整理後仍要重新佔位；失敗則退回登入畫面
      const claimer =
        window.IpSessionLimit && typeof window.IpSessionLimit.claim === "function"
          ? window.IpSessionLimit.claim
          : function () {
              return Promise.resolve({ ok: true });
            };
      claimer().then(function (r) {
        if (r && r.ok) {
          var sync =
            window.cloudSyncOnLogin && typeof window.cloudSyncOnLogin === "function"
              ? window.cloudSyncOnLogin
              : function () {
                  return Promise.resolve(false);
                };
          sync().finally(function () {
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
