"use strict";

const wrongCryptoTexts = [
  "暗號錯誤！平安鎮傳送師懷疑你是血刀門派來的臥底！",
  "查無此人，你是不是走錯平安鎮、誤闖黑衣人總部了？",
  "暗號不對！大師兄甄建翻了個白眼，並拒絕幫你開門！",
  "密碼錯誤！少林方丈搖了搖頭，念了一句：阿彌陀佛，施主請回。",
];

const shaoLinIdleLines = [
  "【少林】你敲木魚，野豬以為在聽經，血量先扣一半。",
  "【少林】大力金剛掌拍出，史萊姆變成牆上抽象藝術。",
  "【少林】羅漢陣啟動：罪過罪過——先罪過你的 HP！",
];

const $ = (id) => document.getElementById(id);

function setStatus(msg, color) {
  const status = $("statusMessage");
  status.innerHTML = msg;
  status.style.color = color || "#ffcc00";
}

function handleRegister() {
  const user = $("username").value.trim();
  const pass = $("password").value.trim();

  if (!user || !pass) {
    setStatus("連名字和暗號都沒有，你是哪來的無名小卒？", "#ff4d4d");
    return;
  }

  if (localStorage.getItem(user)) {
    setStatus("這個江湖名號太響亮了，已被別的大俠捷足先登！", "#ff4d4d");
    return;
  }

  const pData = {
    password: pass,
    faction: "江湖小蝦米",
    str: 10,
    agi: 10,
    int: 10,
  };
  localStorage.setItem(user, JSON.stringify(pData));
  setStatus("🎉 註冊成功！你已正式登錄六扇門戶籍管理系統。快點擊踏入江湖！", "#00ff66");
}

function handleLogin() {
  const user = $("username").value.trim();
  const pass = $("password").value.trim();

  if (!user || !pass) {
    setStatus("不留下名號與暗號，休想跨入平安鎮半步！", "#ff4d4d");
    return;
  }

  const localData = localStorage.getItem(user);
  if (!localData) {
    setStatus("查無此人，你是不是走錯平安鎮了？先點註冊吧！", "#ff4d4d");
    return;
  }

  let userData;
  try {
    userData = JSON.parse(localData);
  } catch {
    setStatus("戶籍資料損壞，六扇門請你重新註冊。", "#ff4d4d");
    return;
  }

  if (userData.password !== pass) {
    const randomIndex = Math.floor(Math.random() * wrongCryptoTexts.length);
    setStatus(wrongCryptoTexts[randomIndex], "#ff4d4d");
    return;
  }

  setStatus("⚡ 驗證成功！大俠請進，正在傳送至平安鎮...", "#00ff66");

  setTimeout(() => {
    $("authScene").style.display = "none";
    $("worldScene").style.display = "flex";
    $("displayFaction").innerText = userData.faction || "江湖小蝦米";
    $("statStr").innerText = userData.str ?? 10;
    $("statAgi").innerText = userData.agi ?? 10;
    $("statInt").innerText = userData.int ?? 10;
  }, 1200);
}

function logout() {
  stopIdlePreview();
  $("worldScene").style.display = "none";
  $("authScene").style.display = "block";
  const log = $("idleLog");
  log.hidden = true;
  log.innerHTML = "";
  setStatus("【六扇門提示】大俠已告老還鄉，帳號已安全登出。", "#ffcc00");
}

let idleTimer = null;

function startIdlePreview() {
  const log = $("idleLog");
  log.hidden = false;
  log.innerHTML = "<div class='line'>【系統】踏入東郊文字掛機秘境……日誌開始暴走。</div>";
  stopIdlePreview();
  idleTimer = setInterval(() => {
    const line = shaoLinIdleLines[Math.floor(Math.random() * shaoLinIdleLines.length)];
    const div = document.createElement("div");
    div.className = "line shao";
    div.textContent = line;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }, 1500);
}

function stopIdlePreview() {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}

$("btn-register").addEventListener("click", handleRegister);
$("btn-login").addEventListener("click", handleLogin);
$("btn-logout").addEventListener("click", logout);

$("btn-blue-portal").addEventListener("click", () => {
  startIdlePreview();
});

$("btn-red-portal").addEventListener("click", () => {
  stopIdlePreview();
  alert("進入紅色傳送門！開啟 2D 俯視角手操副本，危險 PvP 區域，隨時注意爆裝！（預覽：尚未實作）");
});
