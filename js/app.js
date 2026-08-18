window.App = (() => {
  const E = Engine;
  const KEY = "aden_idle_v1";
  let store = { accounts: {}, session: null };
  let acc = null;
  let ch = null;
  let tab = "hunt";
  let huntCat = "village";
  let huntRegion = "說話之島";
  let bagSub = "bag";
  let chatCh = "sys";
  let marketCat = "weapon";
  let logs = [];
  let combat = { mobs: [], focus: null, tPlayer: 0, respawn: 0, cds: {}, buffs: [] };
  let lastTick = performance.now();
  let hue = 32;
  let soundOn = false;
  let soundVol = 0.4;
  let audioCtx = null;
  let parties = [];
  let market = [];
  let world = { online: 0, maps: {}, tax: 0, taxRate: 0.05, serverLv: 1, parties: [], clans: [], market: [], bosses: {}, players: [] };
  let netOk = false;

  const JUNK_PRESETS = [
    ["club", "木棍"], ["cap", "布帽"], ["cloth", "布衣"],
    ["ssword", "短劍"], ["leather", "皮盔甲"], ["wand", "魔法杖"], ["bow", "短弓"],
  ];
  const POT_PRESETS = [
    ["red", "紅水", "hp"], ["orange", "橙水", "hp"], ["clear", "透水", "hp"],
    ["blue", "藍水", "mp"], ["wisdom", "慎重", "mp"],
  ];

  const $ = (id) => document.getElementById(id);
  const el = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) store = JSON.parse(raw);
    } catch (_) {}
    if (!store.accounts) store.accounts = {};
  }
  function save() {
    if (acc) acc.last = Date.now();
    if (ch) {
      if (acc && acc.chars) {
        const i = acc.chars.findIndex((c) => c.id === ch.id);
        if (i >= 0) acc.chars[i] = ch;
      }
      Net.send({ t: "sync", char: ch, warehouse: acc && acc.warehouse });
    }
    try { localStorage.setItem(KEY, JSON.stringify({ acc: acc && acc.user, hint: "server-side" })); } catch (_) {}
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 1800);
  }

  function ensureAuto() {
    if (!ch) return;
    if (!ch.auto) ch.auto = {};
    if (typeof ch.auto.hp !== "number") ch.auto.hp = 0.45;
    if (typeof ch.auto.mp !== "number") ch.auto.mp = 0.3;
    if (ch.auto.potHp == null) ch.auto.potHp = ch.auto.pot !== false;
    if (ch.auto.potMp == null) ch.auto.potMp = ch.auto.pot !== false;
    if (!Array.isArray(ch.auto.pots)) ch.auto.pots = POT_PRESETS.map((x) => x[0]);
    if (ch.auto.sell == null) ch.auto.sell = true;
    if (!Array.isArray(ch.auto.junk)) ch.auto.junk = ["club", "cap", "cloth"];
    if (!Array.isArray(ch.auto.skillOff)) ch.auto.skillOff = [];
    const remap = {
      slash: "bounce", double: "triple", wind: "windshot",
      nova: "meteor", barrier: "reduction", missile: "ebolt", ice: "icelance",
      fireele: "fireweapon", burnstrike: "firedance", aqua: "pollute", ebolt: "lightarrow",
    };
    ch.auto.skillOff = ch.auto.skillOff.map((s) => remap[s] || s);
    E.learnPending(ch);
  }
  function persistCfg() {
    try { localStorage.setItem("aden_cfg", JSON.stringify({ hue, sound: soundOn, vol: soundVol })); } catch (_) {}
  }
  function applyHue() {
    const app = document.getElementById("app");
    if (app) app.style.setProperty("--hue", hue);
  }
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem("aden_cfg") || "null");
      if (c) {
        if (typeof c.hue === "number") hue = Math.max(0, Math.min(360, c.hue));
        soundOn = !!c.sound;
        if (typeof c.vol === "number") soundVol = Math.max(0, Math.min(1, c.vol));
      }
    } catch (_) {}
    applyHue();
  }
  function sfx(kind) {
    if (!soundOn || soundVol <= 0) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const notes = {
        hit: [[220, 0.05, "square"]],
        crit: [[330, 0.06, "sawtooth"], [520, 0.08, "square"]],
        hurt: [[110, 0.08, "triangle"]],
        miss: [[140, 0.04, "sine"]],
        loot: [[523, 0.07, "sine"], [784, 0.1, "sine"]],
        heal: [[392, 0.08, "sine"], [523, 0.1, "sine"]],
        up: [[392, 0.08, "triangle"], [523, 0.1, "triangle"], [659, 0.14, "triangle"]],
        enchant: [[523, 0.07, "sine"], [784, 0.12, "sine"], [988, 0.16, "triangle"]],
        boom: [[95, 0.18, "sawtooth"], [62, 0.22, "square"], [42, 0.28, "triangle"], [28, 0.32, "sawtooth"]],
        click: [[480, 0.04, "square"]],
      };
      const seq = notes[kind] || notes.click;
      seq.forEach((n, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = n[2];
        o.frequency.value = n[0];
        g.gain.setValueAtTime(soundVol * 0.09, now + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + n[1]);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + i * 0.07);
        o.stop(now + i * 0.07 + n[1] + 0.02);
      });
    } catch (_) {}
  }
  function openCfg() {
    const pal = [
      { n: "金", v: 32, c: "#d4af37" },
      { n: "綠", v: 95, c: "#6bc86b" },
      { n: "青", v: 160, c: "#4ec9b0" },
      { n: "藍", v: 210, c: "#5aa8e8" },
      { n: "紫", v: 275, c: "#b48cff" },
      { n: "赤", v: 0, c: "#e05040" },
    ];
    openSheet(`<h3>配置</h3>
      <p>調色</p>
      <div class="hue-row">${pal.map((p) =>
        `<button type="button" class="hue-chip ${hue === p.v ? "on" : ""}" data-h="${p.v}" title="${p.n}" style="background:${p.c}"></button>`
      ).join("")}</div>
      <input class="range" type="range" min="0" max="360" value="${hue}" id="hue">
      <p class="small" id="hue-lab">色調 ${hue}（角色與道具維持原色）</p>
      <hr class="sep">
      <p>聲音</p>
      <label class="check"><input type="checkbox" id="sfx" ${soundOn ? "checked" : ""}> 開啟音效</label>
      <p class="small" style="margin-top:8px">音量</p>
      <input class="range" type="range" min="0" max="100" value="${Math.round(soundVol * 100)}" id="svol" ${soundOn ? "" : "disabled"}>
      <button class="btn ghost wide" id="sfx-test" style="margin-top:8px">試聽</button>`);
    const lab = $("modal").querySelector("#hue-lab");
    const mark = () => {
      $("modal").querySelectorAll(".hue-chip").forEach((b) => b.classList.toggle("on", +b.dataset.h === hue));
    };
    $("modal").querySelectorAll(".hue-chip").forEach((b) => {
      b.onclick = () => {
        hue = +b.dataset.h;
        $("hue").value = hue;
        applyHue(); persistCfg(); mark();
        lab.textContent = `色調 ${hue}（角色與道具維持原色）`;
        sfx("click");
      };
    });
    $("hue").oninput = (e) => {
      hue = +e.target.value;
      applyHue(); persistCfg(); mark();
      lab.textContent = `色調 ${hue}（角色與道具維持原色）`;
    };
    const vol = $("svol");
    $("sfx").onchange = (e) => {
      soundOn = e.target.checked;
      vol.disabled = !soundOn;
      persistCfg();
      if (soundOn) sfx("click");
    };
    vol.oninput = (e) => {
      soundVol = +e.target.value / 100;
      persistCfg();
    };
    $("sfx-test").onclick = () => {
      if (!soundOn) {
        soundOn = true;
        $("sfx").checked = true;
        vol.disabled = false;
        persistCfg();
      }
      sfx("loot");
    };
  }

  function log(msg, cls = "atk") {
    logs.unshift({ t: Date.now(), msg, cls, ch: "sys" });
    if (logs.length > 200) logs.pop();
    if (tab === "chat") renderPanel();
  }

  function myParty() {
    if (!ch) return null;
    return (world.parties || []).find((p) => (p.members || []).includes(ch.name)) || null;
  }
  function myClan() {
    if (!ch) return null;
    if (ch.clanId) return (world.clans || []).find((c) => c.id === ch.clanId) || null;
    return (world.clans || []).find((c) => (c.members || []).includes(ch.name)) || null;
  }
  function applyClan(clanId, clanName) {
    if (!ch) return;
    ch.clanId = clanId || "";
    ch.clanName = clanName || "";
    save();
    if (tab === "chat" || tab === "hunt") renderPanel();
  }

  let mqIdx = 0;
  let mqHoldUntil = 0;
  let mqTimer = null;

  function fmtWait(sec) {
    sec = Math.max(0, Math.ceil(Number(sec) || 0));
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
    }
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return s ? `${m} 分 ${s} 秒` : `${m} 分`;
    }
    return `${sec} 秒`;
  }
  function bossRespawnSec(mapId) {
    const meta = DATA.bossMeta && DATA.bossMeta[mapId];
    if (meta && meta.respawn) return meta.respawn;
    const map = DATA.maps.find((m) => m.id === mapId);
    return (map && map.respawn) || 1800;
  }

  function ensureClientBosses() {
    if (!world.bosses) world.bosses = {};
    for (const [id, meta] of Object.entries(DATA.bossMeta || {})) {
      const max = meta.maxHp || 25000;
      if (!world.bosses[id]) {
        world.bosses[id] = { max, hp: max, alive: true, next: 0, ranks: {} };
      } else {
        const b = world.bosses[id];
        if (!b.max) b.max = max;
        if (b.alive !== false && (!b.hp || b.hp > b.max)) b.hp = b.max;
      }
    }
  }
  function bossWaitSec(mapId) {
    const b = world.bosses && world.bosses[mapId];
    if (!b || b.alive) return 0;
    return Math.max(0, (Number(b.next) - Date.now()) / 1000);
  }
  function bossStatusText(mapId) {
    const b = world.bosses && world.bosses[mapId];
    if (!b) return "讀取中…";
    if (b.alive !== false) return "存活";
    const sec = bossWaitSec(mapId);
    return sec > 0 ? `重生 ${fmtWait(sec)}` : "即將重生";
  }
  function mq(text, holdMs) {
    const el = $("mqtext");
    if (!el) return;
    el.textContent = text;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    if (holdMs > 0) mqHoldUntil = Date.now() + holdMs;
  }
  function nextMarquee() {
    if (Date.now() < mqHoldUntil) return;
    const pool = DATA.marqueePool || [];
    if (!pool.length) return;
    mqIdx = (mqIdx + 1) % pool.length;
    mq(pool[mqIdx]);
  }
  function startMarquee() {
    const pool = DATA.marqueePool || [];
    if (pool.length) mq(pool[0]);
    if (mqTimer) clearInterval(mqTimer);
    mqTimer = setInterval(nextMarquee, 14000);
  }

  function wepKind(c) {
    const id = c?.equip?.weapon?.id || "";
    if (["bow", "lbow", "xbow", "elvenbow", "moonbow"].includes(id) || (!id && c?.classId === "elf")) return "bow";
    if (["wand", "staff", "crystal", "archstaff", "starstaff"].includes(id) || (!id && c?.classId === "mage")) return "staff";
    return "sword";
  }
  function heroArt(c) {
    if (!window.SPRITES) return "";
    const cls = c?.classId || "knight";
    const g = c?.gender === "f" ? "f" : "m";
    return SPRITES.hero(cls, g, wepKind(c));
  }
  function heroInner(c) {
    return `<div class="hero-svg">${heroArt(c)}</div>`;
  }
  function paintHero(el, c, extra = "") {
    if (!el) return;
    const tr = c?.transform && DATA.transforms?.[c.transform.id];
    if (tr) {
      el.className = `hero art transformed ${extra}`.trim();
      el.innerHTML = `<div class="mob-svg hero-morph">${mobArt(tr.mob)}</div>`;
      return;
    }
    const cls = c?.classId || "knight";
    const g = c?.gender === "f" ? "f" : "m";
    const mini = el.classList.contains("mini") || extra.includes("mini") ? " mini" : "";
    el.className = `hero art wep-${wepKind(c)} cls-${cls} g-${g}${mini} ${extra}`.trim();
    el.innerHTML = heroInner(c);
  }
  function heroThumb(c) {
    return `<div class="hero art mini wep-${wepKind(c)} cls-${c.classId} g-${c.gender === "f" ? "f" : "m"}">${heroInner(c)}</div>`;
  }
  function mobArt(id) {
    return window.SPRITES ? SPRITES.mob(id) : "";
  }
  function skillIcon(sid) {
    return window.SPRITES ? `<span class="sk-svg">${SPRITES.skill(sid)}</span>` : "✦";
  }
  function itemIcon(it) {
    const d = E.itemDef(it) || DATA.items[(it && it.id) || it] || {};
    const id = d.id || (it && it.id) || it;
    const r = d.rarity || "common";
    return `<span class="ico-svg r-${r}">${(window.ICONS && ICONS.of(id, d)) || ""}</span>`;
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  }

  function rememberFill() {
    try {
      const r = JSON.parse(localStorage.getItem("aden_remember") || "null");
      if (r) {
        $("acc").value = r.u;
        $("pwd").value = r.p;
      }
    } catch (_) {}
  }

  function login(reg) {
    const u = $("acc").value.trim();
    const p = $("pwd").value;
    if (u.length < 2 || p.length < 2) return toast("帳號密碼至少 2 字");
    if (!Net.ready) return toast("尚未連上伺服器");
    if ($("remember").checked) localStorage.setItem("aden_remember", JSON.stringify({ u, p }));
    else localStorage.removeItem("aden_remember");
    Net.send({ t: reg ? "register" : "login", user: u, pass: p });
  }

  function showCharSel() {
    const box = $("charsel");
    box.classList.remove("hidden");
    const slots = [0, 1, 2].map((i) => {
      const c = acc.chars[i];
      if (!c) {
        return `<div class="list-item"><div class="info"><div class="ttl">空欄位 ${i + 1}</div><div class="sub2 dim">建立新角色</div></div>
          <button class="go" data-create="${i}">建立</button></div>`;
      }
      return `<div class="list-item">
        <div class="ico keep-color">${heroThumb(c)}</div>
        <div class="info"><div class="ttl">${c.name}</div>
        <div class="sub2">${DATA.classes[c.classId].name}　Lv.${c.level}　💰 ${c.gold.toLocaleString()}</div></div>
        <button class="go" data-enter="${c.id}">進入</button>
      </div>`;
    }).join("");
    box.innerHTML = `<div class="logo" style="font-size:22px">選擇角色</div>
      <div style="width:100%;max-width:360px">${slots}</div>
      <button class="btn ghost" id="btn-logout">登出</button>`;
    box.querySelector("#btn-logout").onclick = () => {
      Net.send({ t: "logout" });
      acc = null; ch = null;
      box.classList.add("hidden"); $("login").classList.remove("hidden");
    };
    box.querySelectorAll("[data-create]").forEach((b) => b.onclick = () => openCreate(+b.dataset.create));
    box.querySelectorAll("[data-enter]").forEach((b) => b.onclick = () => enterChar(b.dataset.enter));
  }

  function openCreate() {
    if (acc.chars.length >= 3) return toast("最多 3 名角色");
    const cls0 = "knight";
    const attrs = { ...DATA.classes[cls0].base };
    const baseCopy = () => ({ ...DATA.classes[state.classId].base });
    const state = { classId: cls0, gender: "m", name: "", attrs, remain: 5, elfElem: null };
    const modal = $("modal");
    const draw = () => {
      const rows = ["str", "dex", "con", "int", "wis", "cha"].map((k) => {
        const lab = { str: "力量", dex: "敏捷", con: "體質", int: "智力", wis: "精神", cha: "魅力" }[k];
        return `<div class="alloc"><span>${lab}</span><b>${state.attrs[k]}</b>
          <button class="btn" data-m="${k}" data-d="-1">−</button>
          <button class="btn" data-m="${k}" data-d="1">＋</button></div>`;
      }).join("");
      modal.classList.remove("hidden");
      modal.innerHTML = `<div class="sheet">
        <h3>建立角色</h3>
        <div class="hero-preview">${heroThumb({ classId: state.classId, gender: state.gender, equip: {} })}</div>
        <input class="field" id="cname" maxlength="8" placeholder="角色名稱" value="${state.name}">
        <p class="small" style="margin:8px 0 4px">職業</p>
        <div class="class-pick">${Object.values(DATA.classes).map((c) =>
          `<button class="btn ${state.classId === c.id ? "on" : ""}" data-cls="${c.id}">${c.name}</button>`).join("")}</div>
        <p class="small" style="margin:8px 0">${DATA.classes[state.classId].desc}</p>
        <div class="class-pick">
          <button class="btn ${state.gender === "m" ? "on" : ""}" data-g="m">男</button>
          <button class="btn ${state.gender === "f" ? "on" : ""}" data-g="f">女</button>
        </div>
        ${state.classId === "elf" ? `<p class="small" style="margin:10px 0 4px">精靈魔法屬性（四選一，永久）</p>
        <div class="class-pick">${(DATA.elfElements || []).map((e) =>
          `<button class="btn ${state.elfElem === e ? "on" : ""}" data-elem="${e}">${(DATA.elfElemNames && DATA.elfElemNames[e]) || e}屬性</button>`).join("")}</div>` : ""}
        <p class="small" style="margin:10px 0 4px">分配屬性點 · 剩餘 <b class="gold">${state.remain}</b></p>
        ${rows}
        <div class="row" style="margin-top:10px">
          <button class="btn ghost wide" id="c-cancel">返回</button>
          <button class="btn wide" id="c-ok">建立角色</button>
        </div>
      </div>`;
      modal.querySelector("#cname").oninput = (e) => state.name = e.target.value;
      modal.querySelectorAll("[data-cls]").forEach((b) => b.onclick = () => {
        state.classId = b.dataset.cls; state.attrs = baseCopy(); state.remain = 5;
        if (state.classId !== "elf") state.elfElem = null;
        draw();
      });
      modal.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { state.gender = b.dataset.g; draw(); });
      modal.querySelectorAll("[data-elem]").forEach((b) => b.onclick = () => { state.elfElem = b.dataset.elem; draw(); });
      modal.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => {
        const k = b.dataset.m, d = +b.dataset.d;
        const min = DATA.classes[state.classId].base[k];
        if (d > 0 && state.remain > 0) { state.attrs[k]++; state.remain--; draw(); }
        if (d < 0 && state.attrs[k] > min) { state.attrs[k]--; state.remain++; draw(); }
      });
      modal.querySelector("#c-cancel").onclick = () => modal.classList.add("hidden");
      modal.querySelector("#c-ok").onclick = () => {
        const name = (modal.querySelector("#cname").value || "").trim();
        if (name.length < 1) return toast("請輸入名稱");
        if (acc.chars.some((c) => c.name === name)) return toast("名稱重複");
        if (state.classId === "elf" && !state.elfElem) return toast("請選擇精靈魔法屬性（火／水／風／地）");
        const neu = E.newCharacter({ name, classId: state.classId, gender: state.gender, attrs: state.attrs, elfElem: state.elfElem });
        Net.send({ t: "create", char: neu });
        modal.classList.add("hidden");
        toast("建立中…");
      };
    };
    draw();
  }

  function enterChar(id) {
    if (!Net.ready) return toast("尚未連上伺服器");
    Net.send({ t: "enter", id });
  }

  function applyEnter(m) {
    ch = m.char;
    if (m.warehouse) acc.warehouse = m.warehouse;
    if (!acc.warehouse) acc.warehouse = [];
    ensureAuto();
    if (ch.transform && (!ch.transform.left || ch.transform.left <= 0 || !DATA.transforms[ch.transform.id])) {
      ch.transform = null;
    }
    $("charsel").classList.add("hidden");
    E.learnPending(ch);
    const sec = Math.floor((m.offline || 0) / 1000);
    const res = E.applyOffline(ch, sec);
    if (res && res.kills) {
      openSheet(`<h3>☾ 離線掛機收益</h3>
        <p>離線 ${Math.floor(res.seconds / 60)} 分鐘</p>
        <p>擊殺 ${res.kills}　經驗 ${res.exp.toLocaleString()}　金幣 ${res.gold.toLocaleString()}</p>
        <p>掉落約 ${res.loot} 件${res.ups ? `　升級 ${res.ups}` : ""}</p>
        <button class="btn wide" id="off-ok">收下</button>`);
      $("modal").querySelector("#off-ok").onclick = closeModal;
    }
    refreshTop();
    setMap(ch.mapId, ch.hunting);
    renderPanel();
    log(`歡迎回來，${ch.name}。`, "sys");
    save();
  }

  function refreshTop() {
    if (!ch) return;
    const st = E.totalStats(ch);
    const k = E.karmaName(ch.karma);
    paintHero($("avatar-face"), ch, "mini");
    $("pname").textContent = ch.name;
    $("pmeta").innerHTML = `${DATA.classes[ch.classId].name} · 等級 ${ch.level}${ch.classId === "elf" && ch.elfElem ? ` · ${(DATA.elfElemNames && DATA.elfElemNames[ch.elfElem]) || ch.elfElem}屬性` : ""} · <span style="color:${k.c}">${k.t} ${ch.karma}</span>`;
    $("pgold").textContent = ch.gold.toLocaleString();
    $("pac").textContent = st.ac;
    $("pmr").textContent = st.mr;
    const need = E.xpNeed(ch.level);
    const pct = Math.min(100, (ch.exp / need) * 100);
    $("xpfill").style.width = pct + "%";
    $("xplbl").textContent = pct.toFixed(2) + "%";
    $("hpf").style.width = (ch.hp / st.maxHp) * 100 + "%";
    $("mpf").style.width = (ch.mp / st.maxMp) * 100 + "%";
    $("hpt").textContent = `${Math.floor(ch.hp)}/${st.maxHp}`;
    $("mpt").textContent = `${Math.floor(ch.mp)}/${st.maxMp}`;
    paintHero($("sp-p-art"), ch);
    $("sp-p").classList.toggle("hunting", !!ch.hunting);
    $("sp-p").classList.toggle("transformed", !!(ch.transform && ch.transform.left > 0));
    let buffHtml = (combat.buffs || []).map((b) => `<div class="buff" title="${b.name}">${skillIcon(b.id) || b.icon || "✦"}</div>`).join("");
    if (ch.transform && ch.transform.left > 0) {
      const tr = DATA.transforms[ch.transform.id];
      if (tr) {
        buffHtml += `<div class="buff poly" title="變身：${tr.name}　剩餘 ${fmtWait(Math.ceil(ch.transform.left))}">${mobArt(tr.mob)}</div>`;
      }
    }
    $("buffs").innerHTML = buffHtml || `<span class="dim">無</span>`;
    const stxt = ch.hunting ? "狩獵中" : ch.transform ? "變身" : combat.buffs.length ? "增益" : "無";
    $("stxt").textContent = stxt;
    updateSkillBar();
  }

  function setMap(mapId, keepHunt) {
    const map = DATA.maps.find((m) => m.id === mapId);
    ch.mapId = map ? map.id : null;
    if (!map) {
      ch.hunting = false;
      combat.mobs = [];
      combat.focus = null;
      $("battle").className = "bg-hall keep-color";
      $("ztitle").textContent = "— 大 廳 —";
      $("zsub").innerHTML = hallTaxHtml();
      $("btn-lobby").classList.add("hidden");
      $("btn-attack").classList.add("hidden");
      $("btn-stop").classList.add("hidden");
      hideMobs();
    } else {
      $("battle").className = "bg-" + (map.bg || "forest") + " keep-color";
      $("ztitle").textContent = map.name;
      $("zsub").textContent = `建議 Lv.${map.rec}`;
      $("btn-lobby").classList.remove("hidden");
      $("btn-attack").classList.toggle("hidden", !!keepHunt);
      $("btn-stop").classList.toggle("hidden", !keepHunt);
      if (!keepHunt) {
        ch.hunting = false;
        combat.mobs = [];
        combat.focus = null;
        hideMobs();
      }
    }
    save();
    Net.send({ t: "map", mapId: ch.mapId || "", hunting: !!ch.hunting });
    if (tab === "hunt") renderPanel();
  }

  function startHunt() {
    if (!ch.mapId) return toast("請先選擇狩獵場");
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (map?.boss) {
      if (!netOk) return toast("世界王需連線伺服器");
      ensureClientBosses();
    }
    const b = world.bosses && world.bosses[map?.id];
    if (map?.boss && b && !b.alive) {
      const sec = bossWaitSec(map.id);
      return toast(`世界王尚未重生（${fmtWait(sec)}）`);
    }
    ch.hunting = true;
    combat.tPlayer = 0;
    combat.respawn = 0;
    if (!liveMobs().length) spawnPack();
    $("btn-attack").classList.add("hidden");
    $("btn-stop").classList.remove("hidden");
    log(`開始在「${DATA.maps.find((m) => m.id === ch.mapId).name}」狩獵。`, "sys");
    save();
    Net.send({ t: "map", mapId: ch.mapId, hunting: true });
  }
  function stopHunt() {
    ch.hunting = false;
    $("btn-attack").classList.remove("hidden");
    $("btn-stop").classList.add("hidden");
    log("停止攻擊。", "sys");
    save();
    Net.send({ t: "map", mapId: ch.mapId || "", hunting: false });
  }

  function playAnim(el, cls, ms) {
    if (!el) return;
    const tags = ["swing", "atk-slash", "atk-thrust", "atk-chop", "atk-lunge", "atk-cast", "atk-crit", "hit", "hurt", "spawn", "mob-swing"];
    tags.forEach((c) => el.classList.remove(c));
    void el.offsetWidth;
    cls.split(" ").forEach((c) => { if (c) el.classList.add(c); });
    clearTimeout(el._animT);
    el._animT = setTimeout(() => {
      cls.split(" ").forEach((c) => { if (c) el.classList.remove(c); });
    }, ms || 480);
  }

  function pickAtkStyle(magic, crit) {
    if (magic) return "atk-cast";
    if (crit) return "atk-crit";
    const by = {
      mage: ["atk-cast", "atk-thrust", "atk-slash"],
      elf: ["atk-thrust", "atk-slash", "atk-lunge"],
      knight: ["atk-slash", "atk-chop", "atk-lunge", "atk-thrust"],
    };
    const pool = by[ch?.classId] || by.knight;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function burst(kind, x, y) {
    const layer = $("fx-layer");
    if (!layer) return;
    if (kind === "slash" || kind === "hit") {
      for (let i = 0; i < 7; i++) {
        const s = document.createElement("div");
        s.className = "spark";
        s.style.left = x + "px";
        s.style.top = y + "px";
        s.style.setProperty("--dx", (Math.random() * 50 - 10) + "px");
        s.style.setProperty("--dy", (Math.random() * -40 - 8) + "px");
        if (kind === "hit") s.style.background = "#ff8a6a";
        layer.appendChild(s);
        setTimeout(() => s.remove(), 500);
      }
    }
    if (kind === "magic") {
      const b = document.createElement("div");
      b.className = "bolt";
      b.style.left = x + "px";
      b.style.top = y + "px";
      layer.appendChild(b);
      setTimeout(() => b.remove(), 320);
    }
    if (kind === "boom") {
      for (let i = 0; i < 18; i++) {
        const s = document.createElement("div");
        s.className = "spark boom-spark";
        s.style.left = x + "px";
        s.style.top = y + "px";
        const ang = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 70;
        s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
        s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
        s.style.background = i % 3 ? "#ff5020" : "#ffe040";
        layer.appendChild(s);
        setTimeout(() => s.remove(), 650);
      }
      const flash = document.createElement("div");
      flash.className = "enchant-flash";
      flash.style.left = (x - 40) + "px";
      flash.style.top = (y - 40) + "px";
      layer.appendChild(flash);
      setTimeout(() => flash.remove(), 500);
    }
  }

  function enchantFx(r) {
    if (r.vanish) {
      sfx("boom");
      shake(true);
      const battle = $("battle");
      if (battle) {
        battle.classList.add("enchant-boom");
        setTimeout(() => battle.classList.remove("enchant-boom"), 900);
      }
      const root = $("battle")?.getBoundingClientRect();
      const hero = $("sp-p")?.getBoundingClientRect();
      if (root && hero) {
        burst("boom", hero.left - root.left + hero.width * 0.5, hero.top - root.top + hero.height * 0.4);
      }
      floatDmg($("sp-p"), "爆裝！", "crit");
      mq(r.msg, 14000);
      log(r.msg, "warn");
      toast(r.msg);
      return;
    }
    if (r.ok) {
      sfx(r.safe ? "enchant" : "up");
      mq(r.msg, r.safe ? 5000 : 8000);
      log(r.msg, "sys");
      toast(r.msg);
      return;
    }
    sfx("miss");
    toast(r.msg);
    log(r.msg);
  }

  function enchantPanelHtml(it) {
    const prev = E.enchantPreview(ch, it, false);
    const prevB = E.enchantPreview(ch, it, true);
    const safeLine = prev.safe
      ? `<span class="ok">安定區（+0～+${prev.safeMax}）— 必成功</span>`
      : `<span class="warn">非安定（+${prev.plus} → +${prev.targetPlus}）— 成功率 ${Math.round(prev.rate * 100)}%</span>`;
    const vanishLine = prev.vanishOnFail > 0
      ? `<p class="small warn">失敗時 <b>${Math.round(prev.vanishOnFail * 100)}%</b> 機率爆裝消失</p>`
      : prev.safe ? "" : `<p class="small ok">祝福保護：失敗不會爆裝</p>`;
    const scrollW = E.countItem(ch, "scroll_w");
    const scrollA = E.countItem(ch, "scroll_a");
    const scrollB = E.countItem(ch, "scroll_b");
    const need = prev.isWeapon ? "scroll_w" : "scroll_a";
    const needLabel = prev.isWeapon ? "武卷" : "防卷";
    return `<h3>強化 ${E.displayName(it)}</h3>
      <p class="small">目前 <b>+${prev.plus}</b>　安定值 +${prev.safeMax}　${safeLine}</p>
      ${vanishLine}
      <p class="small" style="margin-top:8px">背包：武卷 ×${scrollW}　防卷 ×${scrollA}　祝福武卷 ×${scrollB}</p>
      <button class="btn wide" id="en1" ${prev.hasScroll ? "" : "disabled"}>
        使用${needLabel}（${DATA.items[need]?.name || needLabel}）
      </button>
      <button class="btn wide" id="en2" style="margin-top:6px" ${prevB.hasScroll ? "" : "disabled"}>
        使用祝福武卷（失敗不爆裝，成功率 ${Math.round(prevB.rate * 100)}%）
      </button>
      <p class="small" style="margin-top:8px">${prev.isWeapon ? "武器只能用武卷。" : "防具／飾品只能用防卷。"}祝福武卷適用所有裝備。</p>`;
  }

  function shake(crit) {
    const b = $("battle");
    b.classList.remove("shake");
    void b.offsetWidth;
    if (crit) b.classList.add("shake");
  }

  function liveMobs() {
    return (combat.mobs || []).filter((m) => m && m.hp > 0);
  }
  function targetMob() {
    const live = liveMobs();
    if (!live.length) return null;
    return live.find((m) => m.uid === combat.focus) || live[0];
  }
  function mobEl(uid) {
    return document.querySelector(`#mob-pack .sprite.enemy[data-uid="${uid}"]`);
  }
  function hideMobs() {
    combat.mobs = [];
    combat.focus = null;
    const pack = $("mob-pack");
    if (pack) { pack.innerHTML = ""; pack.dataset.n = "0"; }
  }
  function hideMob() { hideMobs(); }

  function packSize(map) {
    if (map.boss) return 1;
    return E.irand(2, map.cat === "dungeon" ? 4 : 3);
  }

  function spawnPack() {
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (!map) return;
    const n = packSize(map);
    combat.mobs = [];
    for (let i = 0; i < n; i++) {
      const mobId = map.boss ? (map.monsters && map.monsters[0]) : null;
      const mob = E.makeMob(map, mobId);
      if (!mob) continue;
      if (map.boss) {
        mob.boss = true;
        ensureClientBosses();
        const meta = DATA.bossMeta && DATA.bossMeta[map.id];
        const b = world.bosses && world.bosses[map.id];
        const fallback = (meta && meta.maxHp) || mob.maxHp;
        mob.maxHp = (b && b.max) || fallback;
        mob.hp = (b && b.alive !== false) ? (b.hp != null ? b.hp : mob.maxHp) : 0;
        if (b && !b.alive) {
          combat.mobs = [];
          return;
        }
      }
      mob.tAtk = 0.2 + i * 0.4 + Math.random() * 0.25;
      combat.mobs.push(mob);
    }
    combat.focus = combat.mobs[0].uid;
    combat.respawn = 0;
    renderMobPack();
    const names = [...new Set(combat.mobs.map((m) => m.name))].join("、");
    if ($("zsub") && !map.boss) $("zsub").textContent = `建議 Lv.${map.rec}　搜尋到 ${combat.mobs.length} 隻（${names}）`;
  }

  function renderMobPack() {
    const pack = $("mob-pack");
    if (!pack) return;
    const live = liveMobs();
    pack.dataset.n = String(live.length);
    pack.innerHTML = live.map((m) => {
      const hp = Math.max(0, (m.hp / Math.max(1, m.maxHp)) * 100);
      const focus = combat.focus === m.uid;
      return `<div class="sprite enemy ${m.boss ? "boss" : ""} ${focus ? "focus" : ""}" data-uid="${m.uid}">
        <div class="slash-arc mob"></div>
        <div class="mob-svg">${mobArt(m.id)}</div>
        <div class="ground-shadow"></div>
        <div class="mhp"><i style="width:${hp}%"></i></div>
      </div>`;
    }).join("");
    pack.querySelectorAll("[data-uid]").forEach((el) => {
      playAnim(el, "spawn", 400);
      el.onclick = () => {
        combat.focus = el.dataset.uid;
        markFocus();
      };
    });
  }

  function markFocus() {
    const t = targetMob();
    if (t) combat.focus = t.uid;
    document.querySelectorAll("#mob-pack .sprite.enemy").forEach((el) => {
      el.classList.toggle("focus", t && el.dataset.uid === t.uid);
    });
  }

  function updateMobHp(mob) {
    const el = mobEl(mob.uid);
    if (!el) return;
    const bar = el.querySelector(".mhp i");
    if (bar) bar.style.width = Math.max(0, (mob.hp / Math.max(1, mob.maxHp)) * 100) + "%";
  }

  function floatDmg(target, text, cls) {
    let box = $("sp-p");
    if (target === "p") box = $("sp-p");
    else if (target && target.nodeType) box = target;
    else if (typeof target === "string" && target !== "m") box = mobEl(target) || $("sp-p");
    else {
      const t = targetMob();
      box = (t && mobEl(t.uid)) || $("sp-p");
    }
    if (!box) return;
    const n = document.createElement("div");
    n.className = "float-dmg " + (cls || "");
    n.textContent = text;
    box.appendChild(n);
    setTimeout(() => n.remove(), 800);
  }

  function onKill(mob) {
    if (mob.boss) {
      ch.stats.kills += 1;
      stopHunt();
      toast("世界王已擊敗，等待伺服器結算獎勵");
      hideMobs();
      burst("hit", 340, 140);
      refreshTop();
      save();
      return;
    }
    ch.stats.kills += 1;
    const gold = E.irand(mob.gold[0], mob.gold[1]);
    ch.gold += gold;
    const ups = E.gainExp(ch, mob.exp);
    const loot = E.rollDrops(mob.id, 1);
    for (const it of loot) {
      E.addToBag(ch, it);
      log(`獲得 ${E.displayName(it)}`, "drop");
      sfx("loot");
      const d = E.itemDef(it);
      if (d && (d.rarity === "rare" || d.rarity === "epic" || d.rarity === "legend" || it.plus >= 4)) {
        Net.send({ t: "announce", text: `恭喜 ${ch.name} 獲得了 ${E.displayName(it)}` });
      }
    }
    const sold = E.autoSellJunk(ch);
    log(`擊殺 ${mob.name}　EXP +${mob.exp}　💰 +${gold}${sold ? `　回收 ${sold}` : ""}`);
    if (ups) {
      log(`${ch.name} 升到了 ${ch.level} 級！`, "sys");
      toast(`升級！Lv.${ch.level}`);
      sfx("up");
      if (ch.classId === "elf" && ch.level >= 10 && !ch.elfElem) {
        toast("請找精靈導師選擇魔法屬性（火／水／風／地）");
      }
    }
    combat.mobs = (combat.mobs || []).filter((m) => m.uid !== mob.uid);
    const el = mobEl(mob.uid);
    if (el) el.remove();
    const pack = $("mob-pack");
    if (pack) pack.dataset.n = String(liveMobs().length);
    if (combat.focus === mob.uid) combat.focus = liveMobs()[0] ? liveMobs()[0].uid : null;
    markFocus();
    burst("hit", 340, 140);
    if (!liveMobs().length) combat.respawn = 0.55;
    refreshTop();
    save();
  }

  function skillList() {
    return (DATA.classes[ch.classId] && DATA.classes[ch.classId].skills) || ch.skills || [];
  }
  function skillLv(sid) {
    return E.skillMinLv(DATA.skills[sid], ch.classId);
  }
  function groupedSkills(list) {
    const trees = [];
    const seen = new Set();
    for (const sid of list) {
      const t = (DATA.skills[sid] && DATA.skills[sid].tree) || "other";
      if (!seen.has(t)) { seen.add(t); trees.push(t); }
    }
    return trees.map((t) => ({
      id: t,
      name: (DATA.skillTrees && DATA.skillTrees[t]) || t,
      skills: list.filter((sid) => ((DATA.skills[sid] && DATA.skills[sid].tree) || "other") === t),
    }));
  }
  function barSkills() {
    const known = new Set(ch.skills || []);
    return skillList().filter((sid) => known.has(sid) && DATA.skills[sid] && E.canCastSkill(ch, sid));
  }

  function updateSkillBar() {
    const bar = $("skillbar");
    if (!bar || !ch) {
      if (bar) bar.innerHTML = "";
      return;
    }
    const list = barSkills();
    const sig = ch.classId + "|" + list.join(",") + "|" + (ch.skills || []).join(",");
    if (bar.dataset.sig !== sig) {
      bar.dataset.sig = sig;
      const known = new Set(ch.skills || []);
      bar.innerHTML = list.map((sid) => {
        const sk = DATA.skills[sid];
        if (!sk) return "";
        const locked = !known.has(sid);
        return `<button type="button" class="sk-slot ${locked ? "lock" : ""} sk-${sk.tree || sk.kind || "misc"}" data-sk="${sid}" title="${sk.name}">
          <span class="sk-ico">${skillIcon(sid)}</span>
          <span class="sk-nm">${sk.name}</span>
          <span class="sk-cd"></span>
        </button>`;
      }).join("");
      bar.querySelectorAll("[data-sk]").forEach((btn) => {
        btn.onclick = () => {
          const r = useSkill(btn.dataset.sk, true);
          if (!r.ok) toast(r.msg);
          else refreshTop();
        };
      });
    }
    const off = new Set(ch.auto?.skillOff || []);
    bar.querySelectorAll("[data-sk]").forEach((btn) => {
      const sid = btn.dataset.sk;
      const sk = DATA.skills[sid];
      const known = (ch.skills || []).includes(sid);
      const cd = combat.cds[sid] || 0;
      const cdEl = btn.querySelector(".sk-cd");
      btn.classList.toggle("off", off.has(sid) && known);
      btn.classList.toggle("lock", !known);
      btn.classList.toggle("ready", known && cd <= 0 && !off.has(sid));
      if (known && cd > 0) {
        cdEl.classList.add("on");
        cdEl.textContent = cd >= 10 ? String(Math.ceil(cd)) : cd.toFixed(1);
      } else {
        cdEl.classList.remove("on");
        cdEl.textContent = "";
      }
      btn.title = known
        ? `${sk.name}　MP ${sk.mp}　CD ${sk.cd}秒\n${sk.desc}`
        : `${sk.name}（Lv.${skillLv(sid)} 學會）`;
    });
  }

  function useSkill(sid, manual) {
    const sk = DATA.skills[sid];
    if (!sk) return { ok: false, msg: "沒有這個技能" };
    if (!(ch.skills || []).includes(sid)) return { ok: false, msg: `Lv.${skillLv(sid)} 學會 ${sk.name}` };
    if (!E.canCastSkill(ch, sid)) {
      const sk2 = DATA.skills[sid];
      if (sk2?.requiresBow && !E.hasBowEquipped(ch)) return { ok: false, msg: "需裝備弓才能施放" };
      return { ok: false, msg: "未選擇此屬性，無法施放" };
    }
    if (!manual && (ch.auto?.skillOff || []).includes(sid)) return { ok: false, msg: "已關閉自動施放" };
    if ((combat.cds[sid] || 0) > 0) return { ok: false, msg: "冷卻中" };
    if (ch.mp < sk.mp) return { ok: false, msg: "魔力不足" };
    const st = E.applyCombatBuffs(E.totalStats(ch), combat.buffs);
    if (sk.kind === "magic" && st.canMagic === false) return { ok: false, msg: "變身中無法施法" };
    const needTarget = sk.kind === "phys" || sk.kind === "magic";
    const tgt = targetMob();
    if (needTarget && !tgt && !sk.aoe) return { ok: false, msg: "沒有目標" };
    if (sk.kind === "heal") {
      const below = sk.below != null ? sk.below : 0.7;
      if (!manual && ch.hp / st.maxHp > below) return { ok: false, msg: "生命充足" };
      if (ch.hp >= st.maxHp) return { ok: false, msg: "生命已滿" };
      combat.cds[sid] = sk.cd;
      ch.mp -= sk.mp;
      let pct = sk.pct;
      for (const b of combat.buffs) {
        if (b.healBoost) pct *= 1 + b.healBoost;
      }
      const h = Math.floor(st.maxHp * pct);
      ch.hp = Math.min(st.maxHp, ch.hp + h);
      floatDmg("p", "+" + h, "heal");
      sfx("heal");
      playAnim($("sp-p"), "atk-cast", 520);
      log(`施放 ${sk.name} 回復 ${h}`);
      return { ok: true };
    }
    if (sk.kind === "mpheal") {
      if (ch.mp >= st.maxMp) return { ok: false, msg: "魔力已滿" };
      combat.cds[sid] = sk.cd;
      ch.mp -= sk.mp;
      const hpLoss = Math.max(1, Math.floor(st.maxHp * (sk.hpCost || 0.12)));
      ch.hp = Math.max(1, ch.hp - hpLoss);
      const m = Math.floor(st.maxMp * (sk.mpPct || 0.35));
      ch.mp = Math.min(st.maxMp, ch.mp + m);
      floatDmg("p", "+" + m, "heal");
      playAnim($("sp-p"), "atk-cast", 520);
      log(`施放 ${sk.name} 回復魔力 ${m}`);
      return { ok: true };
    }
    if (sk.kind === "buff") {
      if (combat.buffs.some((b) => b.id === sid || (sk.tag && b.tag === sk.tag))) return { ok: false, msg: "效果尚在" };
      combat.cds[sid] = sk.cd;
      ch.mp -= sk.mp;
      combat.buffs.push({
        id: sid, name: sk.name, icon: sk.icon || "✦", left: sk.dur, tag: sk.tag,
        reduce: sk.reduce, ac: sk.ac, mr: sk.mr, haste: sk.haste,
        er: sk.er, dmgMul: sk.dmgMul, hit: sk.hit, immune: sk.immune,
        regen: sk.regen, mpRegen: sk.mpRegen, healBoost: sk.healBoost, hp: sk.hp,
      });
      playAnim($("sp-p"), "atk-cast", 520);
      log(`施放 ${sk.name}`);
      return { ok: true };
    }
    const pack = sk.aoe ? liveMobs().slice() : (tgt ? [tgt] : []);
    if (!pack.length) return { ok: false, msg: "沒有目標" };
    if (!manual && sk.slow && pack.every((m) => m.slowed)) return { ok: false, msg: "已緩速" };
    combat.cds[sid] = sk.cd;
    ch.mp -= sk.mp;
    const hits = sk.hits || 1;
    const magic = sk.kind === "magic";
    pack.forEach((mob, mi) => {
      if (sk.slow) mob.slowed = true;
      for (let i = 0; i < hits; i++) {
        const delay = mi * 70 + i * 150;
        const r = E.playerHit(ch, mob, sk.mul, magic, combat.buffs);
        const go = () => {
          if (mob && mob.hp > 0) {
            applyPlayerHit(r, sk.name, magic, mob);
            if (sk.stun) mob.stun = Math.max(mob.stun || 0, sk.stun);
            if (sk.slow) mob.tAtk = (mob.tAtk || 0) + sk.slow;
          }
        };
        if (delay <= 0) go();
        else setTimeout(go, delay);
      }
    });
    return { ok: true };
  }

  function trySkills() {
    const list = (ch.skills || []).filter((sid) => DATA.skills[sid] && E.canCastSkill(ch, sid));
    const by = (pred) => list.filter((sid) => pred(DATA.skills[sid]));
    const score = (sid) => {
      const s = DATA.skills[sid];
      return (s.mul || 1) * (s.hits || 1) * (s.aoe ? 1.35 : 1);
    };
    const heals = by((s) => s.kind === "heal").sort((a, b) => (DATA.skills[b].pct || 0) - (DATA.skills[a].pct || 0));
    const buffs = by((s) => s.kind === "buff").sort((a, b) => skillLv(b) - skillLv(a));
    const debuffs = by((s) => s.slow && (s.kind === "magic" || s.kind === "phys"));
    const dmg = by((s) => (s.kind === "phys" || s.kind === "magic") && !s.slow).sort((a, b) => score(b) - score(a));
    for (const sid of [...heals, ...buffs, ...debuffs, ...dmg]) {
      if (useSkill(sid, false).ok) return true;
    }
    return false;
  }

  function applyPlayerHit(r, skillName, magic, mob) {
    mob = mob || targetMob();
    if (!mob) return;
    const style = pickAtkStyle(magic, r.crit);
    playAnim($("sp-p"), style, r.crit ? 540 : 480);
    const el = mobEl(mob.uid);
    const box = (el || $("mob-pack")).getBoundingClientRect();
    const root = $("battle").getBoundingClientRect();
    const x = box.left - root.left + box.width * 0.45;
    const y = box.top - root.top + box.height * 0.35;
    burst(magic ? "magic" : "slash", x, y);
    if (r.miss) {
      floatDmg(el, "MISS", "miss");
      log(`${skillName || "攻擊"} 未命中`);
      sfx("miss");
      return;
    }
    mob.hp -= r.dmg;
    floatDmg(el, (r.crit ? "★" : "-") + r.dmg, r.crit ? "crit" : "");
    shake(r.crit);
    sfx(r.crit ? "crit" : "hit");
    burst("hit", x, y);
    if (el) playAnim(el, "hit", 380);
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (map && map.boss) {
      if (!netOk) {
        toast("世界王需連線伺服器");
        return;
      }
      Net.send({ t: "bossHit", mapId: map.id, dmg: r.dmg });
      const b = world.bosses[map.id];
      if (b) {
        mob.hp = b.hp;
        mob.maxHp = b.max || mob.maxHp;
      }
      updateMobHp(mob);
      if (b && !b.alive) { onKill(mob); stopHunt(); }
      return;
    }
    updateMobHp(mob);
    if (mob.hp <= 0) onKill(mob);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    requestAnimationFrame(tick);
    if (!ch) return;
    ch.stats.play += dt;
    tickBossUi(dt);
    if (E.tickTransform(ch, dt)) {
      log("變身效果結束。", "sys");
      toast("變身已解除");
    }
    combat.buffs = combat.buffs.filter((b) => (b.left -= dt) > 0);
    if (combat.buffs.some((b) => b.regen)) {
      const stR = E.applyCombatBuffs(E.totalStats(ch), combat.buffs);
      let regen = 0;
      for (const b of combat.buffs) regen += b.regen || 0;
      if (regen > 0) ch.hp = Math.min(stR.maxHp, ch.hp + regen * dt);
    }
    if (combat.buffs.some((b) => b.mpRegen)) {
      const stR = E.applyCombatBuffs(E.totalStats(ch), combat.buffs);
      let mpRegen = 0;
      for (const b of combat.buffs) mpRegen += b.mpRegen || 0;
      if (mpRegen > 0) ch.mp = Math.min(stR.maxMp, ch.mp + mpRegen * dt);
    }
    if (!ch.hunting) {
      refreshTop();
      return;
    }
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (!map) return;
    if (combat.respawn > 0) {
      combat.respawn -= dt;
      if (combat.respawn <= 0) spawnPack();
    } else if (!liveMobs().length) {
      spawnPack();
    }
    if (!liveMobs().length) {
      refreshTop();
      return;
    }

    const pots = E.autoPotions(ch);
    pots.forEach((p) => log(p, "sys"));

    combat.tPlayer -= dt;
    for (const sid of ch.skills) combat.cds[sid] = (combat.cds[sid] || 0) - dt;
    const tgt = targetMob();
    if (combat.tPlayer <= 0 && tgt) {
      if (!trySkills()) {
        applyPlayerHit(E.playerHit(ch, tgt, 1, false, combat.buffs), "普通攻擊", false, tgt);
      }
      combat.tPlayer = E.applyCombatBuffs(E.totalStats(ch), combat.buffs).atkMs / 1000;
    }
    const reduce = combat.buffs.reduce((s, b) => s + (b.reduce || 0), 0);
    for (const mob of liveMobs()) {
      if (mob.stun > 0) {
        mob.stun -= dt;
        continue;
      }
      mob.tAtk = (mob.tAtk || 0) - dt;
      if (mob.tAtk > 0) continue;
      mob.tAtk = 1.05 + mob.lv * 0.02 + Math.random() * 0.35;
      const r = E.mobHit(ch, mob, combat.buffs);
      const el = mobEl(mob.uid);
      if (el) playAnim(el, "mob-swing", 380);
      if (r.miss) {
        floatDmg("p", r.immune ? "IMMUNE" : "MISS", "miss");
        sfx("miss");
        continue;
      }
      const dmg = Math.max(1, Math.floor(r.dmg * (1 - reduce)));
      ch.hp -= dmg;
      floatDmg("p", "-" + dmg);
      sfx("hurt");
      playAnim($("sp-p"), "hurt", 400);
      if (ch.hp <= 0) {
        ch.hp = 0;
        ch.stats.deaths += 1;
        E.cancelTransform(ch, true);
        ch.hunting = false;
        log("你被擊倒了，送回大廳。", "sys");
        toast("陣亡，已送回大廳");
        setMap(null);
        const st = E.totalStats(ch);
        ch.hp = Math.floor(st.maxHp * 0.4);
        break;
      }
    }
    refreshTop();
  }

  function openSheet(inner) {
    const m = $("modal");
    m.classList.remove("hidden");
    m.innerHTML = `<div class="sheet">${inner}<div style="margin-top:10px"><button class="btn ghost wide" id="m-x">關閉</button></div></div>`;
    m.querySelector("#m-x").onclick = closeModal;
  }
  function closeModal() { $("modal").classList.add("hidden"); }

  const BAG_LIMIT = 40;
  const WH_LIMIT = 80;

  function bagWouldBeFull(it) {
    const d = E.itemDef(it);
    if (d?.stack) {
      const found = ch.bag.find((x) => x.id === it.id && !x.plus && !x.blessed);
      if (found) return false;
    }
    return ch.bag.length >= BAG_LIMIT;
  }

  function whCell(it) {
    if (!it) return `<div class="bag-cell empty"></div>`;
    const qty = (it.qty || 1) > 1 ? `<span class="bq">${it.qty}</span>` : "";
    const plus = it.plus ? `<i>+${it.plus}</i>` : "";
    return `<button type="button" class="bag-cell on" data-iid="${it.iid}" title="${E.displayName(it)}" style="--rc:${E.rarityColor(it)}">
      ${itemIcon(it)}${plus}${qty}
    </button>`;
  }

  function openWarehouse(side) {
    if (!acc.warehouse) acc.warehouse = [];
    side = side === "wh" ? "wh" : "bag";
    const list = side === "bag" ? ch.bag : acc.warehouse;
    const slots = Math.max(10, Math.ceil(Math.max(list.length, 10) / 5) * 5);
    const cells = [];
    for (let i = 0; i < slots; i++) cells.push(whCell(list[i]));
    openSheet(`<h3>倉庫</h3>
      <p class="small">背包 <b>${ch.bag.length}</b>/${BAG_LIMIT}　倉庫 <b>${acc.warehouse.length}</b>/${WH_LIMIT}</p>
      <div class="subtabs" style="padding-left:0">
        <div class="subtab ${side === "bag" ? "active" : ""}" data-wh="bag">背包（點選存入）</div>
        <div class="subtab ${side === "wh" ? "active" : ""}" data-wh="wh">倉庫（點選領出）</div>
      </div>
      <p class="small">${side === "bag" ? "點要放進倉庫的物品" : "點要領回背包的物品"}</p>
      <div class="bag-grid">${cells.join("")}</div>`);
    $("modal").querySelectorAll("[data-wh]").forEach((b) => {
      b.onclick = () => openWarehouse(b.dataset.wh);
    });
    $("modal").querySelectorAll("[data-iid]").forEach((b) => {
      b.onclick = () => {
        if (side === "bag") stashToWh(b.dataset.iid);
        else takeFromWh(b.dataset.iid);
      };
    });
  }

  function stashToWh(iid) {
    if (!acc.warehouse) acc.warehouse = [];
    if (acc.warehouse.length >= WH_LIMIT) return toast("倉庫已滿");
    const i = ch.bag.findIndex((x) => x.iid === iid);
    if (i < 0) return;
    const it = ch.bag.splice(i, 1)[0];
    acc.warehouse.push(it);
    save();
    toast("已存入 " + E.displayName(it));
    openWarehouse("bag");
  }

  function takeFromWh(iid) {
    if (!acc.warehouse) acc.warehouse = [];
    const i = acc.warehouse.findIndex((x) => x.iid === iid);
    if (i < 0) return;
    const it = acc.warehouse[i];
    if (bagWouldBeFull(it)) return toast("背包已滿");
    acc.warehouse.splice(i, 1);
    E.addToBag(ch, it);
    save();
    toast("已領出 " + E.displayName(it));
    openWarehouse("wh");
  }

  function openItem(it, where) {
    const d = E.itemDef(it);
    const st = E.itemStats(it);
    const lines = [];
    if (d.dmax) lines.push(`${d.ranged ? "遠距離" : "近距離"}傷害 ${st.dmin} ~ ${st.dmax}`);
    if (d.hit) lines.push(`命中 ${st.hit}`);
    if (d.ac) lines.push(`AC ${st.ac}`);
    if (d.mr || st.mr) lines.push(`MR ${st.mr}`);
    if (st.str) lines.push(`力量 +${st.str}`);
    if (st.dex) lines.push(`敏捷 +${st.dex}`);
    if (st.int) lines.push(`智力 +${st.int}`);
    if (st.hp) lines.push(`HP +${st.hp}`);
    if (st.mp) lines.push(`MP +${st.mp}`);
    if (d.type !== "use") {
      const plus = it.plus || 0;
      const safeMax = DATA.enchant?.safeMax ?? 6;
      lines.push(`強化 +${plus}　安定值 +${safeMax}${plus >= safeMax ? "　<span class=\"warn\">已進入爆裝區</span>" : ""}`);
    }
    lines.push(`重量 ${d.weight || 1}　賣價 ${E.sellPrice({ ...it, qty: 1 })}`);
    if (d.classes) lines.push("職業：" + d.classes.map((x) => DATA.classes[x].name).join(" / "));
    const btns = [];
    if (d.slot && where === "bag") btns.push(`<button class="btn wide" id="i-eq">裝 備</button>`);
    if (d.kind === "potion") btns.push(`<button class="btn wide" id="i-use">使 用</button>`);
    if (d.kind === "poly") btns.push(`<button class="btn wide" id="i-poly">變 身</button>`);
    if (where === "eq") btns.push(`<button class="btn wide" id="i-ue">卸下</button>`);
    if (d.type !== "use") btns.push(`<button class="btn wide" id="i-en">強 化</button>`);
    btns.push(`<button class="btn ghost wide" id="i-sell">出 售</button>`);
    if (where === "bag") btns.push(`<button class="btn danger wide" id="i-drop">丟 棄</button>`);
    openSheet(`<h3 style="color:${E.rarityColor(it)}">${E.displayName(it)}</h3>
      <div class="item-preview">${itemIcon(it)}</div>
      <p class="small">${DATA.R[d.rarity]?.name || ""}　需求等級 ${d.lv || 1}</p>
      <p style="margin:8px 0;line-height:1.6">${lines.join("<br>")}</p>
      <div class="row" style="flex-wrap:wrap">${btns.join("")}</div>`);
    const q = (id, fn) => { const b = $("modal").querySelector(id); if (b) b.onclick = fn; };
    q("#i-eq", () => {
      if (!E.tryEquip(ch, it)) toast("無法裝備（等級或職業不符）");
      else toast("已裝備");
      closeModal(); renderPanel(); refreshTop(); save();
    });
    q("#i-ue", () => {
      const slot = Object.keys(ch.equip).find((k) => ch.equip[k]?.iid === it.iid);
      if (slot) E.unequip(ch, slot);
      closeModal(); renderPanel(); refreshTop(); save();
    });
    q("#i-use", () => {
      const stt = E.totalStats(ch);
      ch.hp = Math.min(stt.maxHp, ch.hp + (d.hp || 0));
      ch.mp = Math.min(stt.maxMp, ch.mp + (d.mp || 0));
      E.removeFromBag(ch, it.iid, 1);
      closeModal(); renderPanel(); refreshTop(); save();
    });
    q("#i-poly", () => {
      closeModal();
      openPolyPicker(d.polyTier || 1);
    });
    q("#i-en", () => {
      closeModal();
      openSheet(enchantPanelHtml(it));
      $("modal").querySelector("#en1").onclick = () => {
        const r = E.enchant(ch, it, false);
        enchantFx(r);
        closeModal(); renderPanel(); refreshTop(); save();
      };
      $("modal").querySelector("#en2").onclick = () => {
        const r = E.enchant(ch, it, true);
        enchantFx(r);
        closeModal(); renderPanel(); refreshTop(); save();
      };
    });
    q("#i-sell", () => {
      const p = E.sellPrice(it);
      ch.gold += p;
      if (where === "eq") {
        const slot = Object.keys(ch.equip).find((k) => ch.equip[k]?.iid === it.iid);
        if (slot) delete ch.equip[slot];
      } else E.removeFromBag(ch, it.iid, it.qty || 1);
      toast(`售出 +${p}`);
      closeModal(); renderPanel(); refreshTop(); save();
    });
    q("#i-drop", () => {
      E.removeFromBag(ch, it.iid, it.qty || 1);
      closeModal(); renderPanel(); save();
    });
  }

  function renderHunt() {
    const cats = [
      ["village", "村莊"], ["field", "野外"], ["dungeon", "地監"], ["boss", "世界王"], ["party", "隊伍"], ["clan", "血盟"],
    ];
    $("subtabs").innerHTML = cats.map(([id, n]) =>
      `<div class="cat ${huntCat === id ? "active" : ""}" data-c="${id}">${n}</div>`).join("");
    $("subtabs").querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { huntCat = b.dataset.c; renderPanel(); });
    const box = $("panel-scroll");
    if (huntCat === "village") {
      const vils = (DATA.villages || []).map((v) => {
        const here = ch.mapId === v.map;
        return `<div class="list-item ${here ? "here" : ""}">
          <div class="info"><div class="ttl">${v.name}${here ? "（目前）" : ""}</div>
          <div class="sub2">建議 Lv.${v.rec}　${v.desc}</div></div>
          <button class="go" data-vil="${v.map}">前往周邊</button></div>`;
      }).join("");
      const npcs = `<div class="npc-grid">${DATA.npcs.map((n) =>
        `<div class="npc" data-npc="${n.id}"><div class="n">${n.name}</div><div class="d">${n.desc}</div></div>`).join("")}</div>`;
      box.innerHTML = `<div class="sec-ttl">${DATA.gameVersion || "亞丁 2.70"} 村莊</div>${vils}<div class="sec-ttl">NPC</div>${npcs}`;
      box.querySelectorAll("[data-vil]").forEach((b) => {
        b.onclick = () => {
          setMap(b.dataset.vil, false);
          const m = DATA.maps.find((x) => x.id === b.dataset.vil);
          toast("已抵達 " + (m ? m.name : "村莊周邊"));
        };
      });
      box.querySelectorAll("[data-npc]").forEach((b) => b.onclick = () => openNpc(b.dataset.npc));
      return;
    }
    if (huntCat === "party") {
      const list = world.parties || [];
      const mine = myParty();
      box.innerHTML = (list.length ? list.map((p) =>
        `<div class="list-item"><div class="info"><div class="ttl">${p.leader} 的隊伍 ${(p.members && p.members.length) || 1}/${p.max || 5}
          ${p.auto ? `<span class="party-tag">自動加入</span>` : ""}</div>
          <div class="sub2">練功點：${p.map || "大廳"}　${(p.members || []).join("、")}</div></div>
          ${mine && mine.id === p.id
            ? `<button class="go" data-pleave="1">離開</button>`
            : `<button class="go" data-join="${p.id}">加入</button>`}</div>`).join("") : `<p class="small">尚無隊伍，當第一個開團的人吧。</p>`) +
        (mine ? "" : `<button class="btn wide" id="mk-party">創建隊伍</button>`);
      box.querySelectorAll("[data-join]").forEach((b) => b.onclick = () => Net.send({ t: "partyJoin", id: b.dataset.join }));
      box.querySelectorAll("[data-pleave]").forEach((b) => b.onclick = () => Net.send({ t: "partyLeave" }));
      const mk = box.querySelector("#mk-party");
      if (mk) mk.onclick = () => Net.send({ t: "partyCreate", map: (DATA.maps.find((x) => x.id === ch.mapId) || {}).name || "大廳" });
      return;
    }
    if (huntCat === "clan") {
      const list = world.clans || [];
      box.innerHTML = (list.length ? list.map((c) =>
        `<div class="list-item"><div class="info"><div class="ttl">${c.name}　${(c.members && c.members.length) || 1}/${c.max || 20}</div>
          <div class="sub2">盟主：${c.leader}　${(c.members || []).join("、")}</div></div>
          ${ch.clanId === c.id
            ? `<button class="go" data-cleave="1">退出</button>`
            : `<button class="go" data-cjoin="${c.id}">加入</button>`}</div>`).join("") : `<p class="small">尚無血盟。</p>`) +
        (ch.clanId ? "" : `<div class="row" style="margin-top:8px;gap:6px;display:flex">
          <input class="field" id="clan-name" maxlength="8" placeholder="血盟名稱 2～8 字" style="flex:1">
          <button class="btn" id="mk-clan">創建</button></div>`);
      box.querySelectorAll("[data-cjoin]").forEach((b) => b.onclick = () => Net.send({ t: "clanJoin", id: b.dataset.cjoin }));
      box.querySelectorAll("[data-cleave]").forEach((b) => b.onclick = () => Net.send({ t: "clanLeave" }));
      const mkc = box.querySelector("#mk-clan");
      if (mkc) mkc.onclick = () => {
        const name = (box.querySelector("#clan-name").value || "").trim();
        if (name.length < 2) return toast("血盟名稱至少 2 字");
        Net.send({ t: "clanCreate", name });
      };
      return;
    }
    const list = DATA.maps.filter((m) => m.cat === (huntCat === "boss" ? "boss" : huntCat));
    const regions = [...new Set(list.map((m) => m.region))];
    if (!regions.includes(huntRegion)) huntRegion = regions[0];
    const regionBar = huntCat === "boss" ? "" : `<div class="cats">${regions.map((r) =>
      `<div class="cat ${huntRegion === r ? "active" : ""}" data-r="${r}">${r}</div>`).join("")}</div>`;
    const rows = list.filter((m) => huntCat === "boss" || m.region === huntRegion).map((m) => {
      const here = ch.mapId === m.id;
      const n = (world.maps && world.maps[m.id]) || 0;
      const mons = (m.monsters || []).map((id) => DATA.monsters[id]?.name).filter(Boolean).join("、");
      const bossLine = m.boss
        ? `<span class="${(world.bosses && world.bosses[m.id] && world.bosses[m.id].alive !== false) ? "ok" : "warn"}">${bossStatusText(m.id)}</span>　重生 ${fmtWait(bossRespawnSec(m.id))}`
        : `出沒 ${mons}`;
      return `<div class="list-item ${here ? "here" : ""}" data-boss-row="${m.boss ? m.id : ""}">
        <div class="info"><div class="ttl">${m.name}${here ? "（目前）" : ""} <span class="dim">(${n} 人)</span></div>
        <div class="sub2">建議 Lv.${m.rec}　${bossLine}</div></div>
        <button class="go" data-go="${m.id}">${here ? "停留" : "前往"}</button></div>`;
    }).join("");
    box.innerHTML = regionBar + rows;
    box.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => { huntRegion = b.dataset.r; renderPanel(); });
    box.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { setMap(b.dataset.go, false); toast("已抵達 " + DATA.maps.find((m) => m.id === b.dataset.go).name); });
  }

  function openPolyPicker(tierFilter) {
    const list = E.availableTransforms(ch).filter((tr) => !tierFilter || tr.tier === tierFilter);
    if (!list.length) return toast("等級或職業不符，尚無可用變身");
    const rows = list.map((tr) => {
      const scroll = DATA.items[tr.scroll];
      const got = E.countItem(ch, tr.scroll);
      const ok = got > 0 && E.canTransform(ch, tr.id).ok;
      const dur = (tr.dur || 120) + Math.floor((ch.attrs?.wis || 10) * 2.5);
      return `<div class="item-row poly-row ${ok ? "" : "dim"}" data-poly="${tr.id}">
        <div class="ico keep-color"><div class="mob-svg poly-thumb">${mobArt(tr.mob)}</div></div>
        <div class="info"><div class="nm">${tr.name}</div>
        <div class="meta">Lv.${tr.minLv}　${tr.desc}<br>
        HP×${tr.hpMul}　AC${tr.ac || 0}　傷害 ${tr.dmg?.join("~") || "—"}　約 ${dur} 秒<br>
        需 ${scroll ? scroll.name : tr.scroll}（${got}）</div></div>
      </div>`;
    }).join("");
    openSheet(`<h3>選擇變身</h3><p class="small">消耗對應卷軸。近戰型變身中無法施放魔法。精神越高，持續越久。</p>${rows}`);
    $("modal").querySelectorAll("[data-poly]").forEach((b) => {
      b.onclick = () => {
        const r = E.startTransform(ch, b.dataset.poly);
        toast(r.msg);
        if (r.ok) {
          log(`變身為 ${r.tr.name}。`, "sys");
          mq(`【變身】${ch.name} 變身為 ${r.tr.name}`);
          closeModal(); refreshTop(); save();
        }
      };
    });
  }

  function openNpc(id) {
    const n = DATA.npcs.find((x) => x.id === id);
    if (n.stock) {
      const rows = n.stock.map((iid) => {
        const d = DATA.items[iid];
        return `<div class="item-row" data-buy="${iid}">
          <div class="ico keep-color">${itemIcon({ id: iid })}</div>
          <div class="info"><div class="nm">${d.name}</div><div class="meta">💰 ${d.price}　稅金 ${shopFee(d.price)}　共 ${d.price + shopFee(d.price)}　Lv.${d.lv || 1}</div></div>
        </div>`;
      }).join("");
      openSheet(`<h3>${n.name}</h3>${rows}`);
      $("modal").querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => buy(b.dataset.buy));
      return;
    }
    if (n.kind === "poly") {
      const list = E.availableTransforms(ch);
      const rows = list.map((tr) => {
        const scroll = DATA.items[tr.scroll];
        const got = E.countItem(ch, tr.scroll);
        const ok = got > 0;
        const dur = (tr.dur || 120) + Math.floor((ch.attrs?.wis || 10) * 2.5);
        const active = ch.transform?.id === tr.id;
        return `<div class="item-row poly-row ${ok ? "" : "dim"}" data-poly="${tr.id}">
          <div class="ico keep-color"><div class="mob-svg poly-thumb">${mobArt(tr.mob)}</div></div>
          <div class="info"><div class="nm">${tr.name}${active ? " <span style='color:#ffd24a'>(變身中)</span>" : ""}</div>
          <div class="meta">Lv.${tr.minLv}　${tr.desc}<br>
          HP×${tr.hpMul}　AC${tr.ac || 0}　${tr.dmg ? "傷害 " + tr.dmg.join("~") : ""}　約 ${dur} 秒<br>
          需 ${scroll ? scroll.name : tr.scroll}（${got}）</div></div>
        </div>`;
      }).join("");
      const cur = ch.transform && DATA.transforms[ch.transform.id];
      openSheet(`<h3>變身師</h3>
        <p class="small">消耗變身卷軸變成魔物，獲得魔物能力。近戰型無法施法；精神越高持續越久。</p>
        ${cur ? `<p class="gold">目前：${cur.name}　剩餘 ${fmtWait(Math.ceil(ch.transform.left))}
          <button class="btn" id="poly-cancel" style="margin-left:8px">解除變身</button></p>` : ""}
        ${rows || "<p>等級不足或職業不符</p>"}`);
      const cancel = $("modal").querySelector("#poly-cancel");
      if (cancel) {
        cancel.onclick = () => {
          const r = E.cancelTransform(ch);
          toast(r.msg);
          if (r.ok) { log(r.msg, "sys"); refreshTop(); save(); openNpc("poly"); }
        };
      }
      $("modal").querySelectorAll("[data-poly]").forEach((b) => {
        b.onclick = () => {
          const r = E.startTransform(ch, b.dataset.poly);
          toast(r.msg);
          if (r.ok) {
            log(`變身為 ${r.tr.name}。`, "sys");
            mq(`【變身】${ch.name} 變身為 ${r.tr.name}`);
            refreshTop(); save(); openNpc("poly");
          }
        };
      });
      return;
    }
    if (n.kind === "craft") {
      const recs = DATA.recipes || [];
      const rows = recs.map((r) => {
        const out = DATA.items[r.out];
        const ok = E.canCraft(ch, r);
        const need = (r.need || []).map(([id, n]) => {
          const d = DATA.items[id];
          const got = E.countItem(ch, id);
          const miss = got < n;
          return `<span style="color:${miss ? "#ff8a8a" : "#9be37d"}">${d ? d.name : id} ${got}/${n}</span>`;
        }).join("　");
        return `<div class="item-row ${ok ? "" : "dim"}" data-craft="${r.id}">
          <div class="ico">${itemIcon({ id: r.out })}</div>
          <div class="info"><div class="nm">${out ? out.name : r.name}</div>
          <div class="meta">${need}<br>金幣 ${r.gold}${ok ? "" : "　材料或金幣不足"}</div></div>
        </div>`;
      }).join("");
      openSheet(`<h3>製作師</h3><p class="small">消耗材料與金幣，製成金屬塊或裝備。不另收稅金。</p>${rows || "<p>沒有配方</p>"}`);
      $("modal").querySelectorAll("[data-craft]").forEach((b) => {
        b.onclick = () => {
          const rec = recs.find((x) => x.id === b.dataset.craft);
          if (!rec) return;
          if (bagWouldBeFull(E.instFrom(rec.out, { qty: rec.qty || 1 }))) return toast("背包已滿");
          const r = E.craft(ch, rec);
          toast(r.msg);
          if (r.ok) { refreshTop(); save(); openNpc("craft"); }
        };
      });
      return;
    }
    if (n.kind === "smith") {
      const eqs = [...E.equippedList(ch), ...ch.bag.filter((it) => {
        const d = E.itemDef(it); return d && d.type !== "use";
      })];
      openSheet(`<h3>鐵匠</h3>
        <p class="small">選擇要強化的裝備。武卷衝武器、防卷衝防具；+0～+${DATA.enchant?.safeMax ?? 6} 安定必成，+7 起失敗可能爆裝。</p>` +
        eqs.map((it) => `<div class="item-row" data-iid="${it.iid}"><div class="ico">${itemIcon(it)}</div>
          <div class="nm" style="color:${E.rarityColor(it)}">${E.displayName(it)}</div></div>`).join("") || "<p>沒有可強化物品</p>");
      $("modal").querySelectorAll("[data-iid]").forEach((b) => {
        b.onclick = () => {
          const it = eqs.find((x) => x.iid === b.dataset.iid);
          closeModal(); openItem(it, "bag");
        };
      });
      return;
    }
    if (n.kind === "trainer") {
      const known = new Set(ch.skills || []);
      const groups = groupedSkills(skillList());
      const elemNote = ch.classId === "elf"
        ? (ch.elfElem
          ? `<p class="small">目前精靈屬性：<b>${(DATA.elfElemNames && DATA.elfElemNames[ch.elfElem]) || ch.elfElem}</b>　（轉換請找精靈導師）</p>`
          : `<p class="small warn">尚未選擇精靈屬性，請找<b>精靈導師</b>選定火／水／風／地之一後，才能習得屬性魔法。</p>`)
        : "";
      const rows = groups.map((g) =>
        `<div class="sec-ttl">${g.name}</div>` + g.skills.map((sid) => {
          const s = DATA.skills[sid];
          const ok = known.has(sid);
          const inactive = ok && !E.canCastSkill(ch, sid);
          const inactiveLbl = inactive
            ? (s.requiresBow && !E.hasBowEquipped(ch) ? "已學（需裝備弓）" : "已學（非當前屬性）")
            : (ok ? "已學會" : "Lv." + skillLv(sid));
          return `<div class="skill ${inactive ? "dim" : ""}"><div class="sk-icon">${skillIcon(sid)}</div><div><b>${s.name}</b><div class="small">${s.desc}　MP ${s.mp}　CD ${s.cd}秒</div></div>
            <span class="small">${inactiveLbl}</span></div>`;
        }).join("")
      ).join("");
      openSheet(`<h3>導師</h3>${elemNote}${rows || "<p>沒有技能</p>"}
        <p class="small" style="margin-top:8px">升級自動習得。妖精：一般共用魔法＋精靈共用魔法＋四選一屬性魔法。點戰鬥下方技能欄可手動施放。</p>`);
      return;
    }
    if (n.kind === "elfmaster") {
      if (ch.classId !== "elf") {
        openSheet(`<h3>精靈導師</h3><p class="small">只有妖精能向精靈導師學習屬性魔法。</p>`);
        return;
      }
      const cost = E.elfElemSwitchCost(ch);
      const cur = ch.elfElem ? (DATA.elfElemNames[ch.elfElem] || ch.elfElem) : "尚未選擇";
      const btns = (DATA.elfElements || []).map((id) => {
        const on = ch.elfElem === id;
        const label = (DATA.elfElemNames && DATA.elfElemNames[id]) || id;
        return `<button class="btn ${on ? "ghost" : ""}" data-elem="${id}" ${on ? "disabled" : ""}>${label}屬性${on ? "（目前）" : ""}</button>`;
      }).join("");
      openSheet(`<h3>精靈導師</h3>
        <p class="small">比照天堂：Lv.10 起可選擇<b>一種</b>屬性精靈魔法（火／水／風／地）。一般共用魔法與精靈共用魔法不受限制。</p>
        <p class="small">目前屬性：<b>${cur}</b>${ch.elfElem && cost > 0 ? `　轉換費用：${cost.toLocaleString()} 金幣` : ""}</p>
        <p class="small">已學過的其他屬性魔法仍保留，但需切換回該屬性後才能施放。</p>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px">${btns}</div>`);
      $("modal").querySelectorAll("[data-elem]").forEach((b) => {
        b.onclick = () => {
          const r = E.setElfElem(ch, b.dataset.elem);
          toast(r.msg);
          if (r.ok) { refreshTop(); save(); closeModal(); openNpc("elfmaster"); }
        };
      });
      return;
    }
    if (n.kind === "warehouse") {
      openWarehouse("bag");
      return;
    }
    if (n.kind === "tele") {
      huntCat = "field"; closeModal(); renderPanel(); toast("選擇要前往的地圖");
    }
  }

  function taxRate() {
    const r = Number(world.taxRate);
    return r > 0 && r < 1 ? r : 0.05;
  }
  function shopFee(price) {
    const p = Math.max(0, Math.floor(Number(price) || 0));
    if (p <= 0) return 0;
    return Math.max(1, Math.floor(p * taxRate()));
  }
  function hallTaxHtml() {
    const pct = Math.round(taxRate() * 100);
    return `稅金：${pct}%（NPC購物手續費）　已收 ${(world.tax || 0).toLocaleString()}<br>
        <span style="color:#ff8ad0">掉寶倍率 1.0</span>　<span style="color:#7ec8ff">金幣倍率 1.0</span><br>
        當前遊玩人數：${world.online || 0}　伺服器等級：${world.serverLv || 1}`;
  }

  function buy(id) {
    const d = DATA.items[id];
    const fee = shopFee(d.price);
    const total = d.price + fee;
    if (ch.gold < total) return toast(`金幣不足（售價 ${d.price}＋稅金 ${fee}）`);
    ch.gold -= total;
    E.addToBag(ch, E.instFrom(id, { qty: d.stack ? 1 : 1 }));
    if (Net.send) Net.send({ t: "shopTax", fee });
    toast(`買下 ${d.name}（稅金 ${fee}）`);
    refreshTop(); save();
  }

  function slotName(slot) {
    const row = DATA.slots.find((x) => x[0] === slot);
    return row ? row[1] : slot;
  }
  function slotMatches(it, slot) {
    const d = E.itemDef(it);
    if (!d || !d.slot) return false;
    if (slot === "ring1" || slot === "ring2") return d.slot === "ring1";
    return d.slot === slot;
  }
  function dollSlot(slot) {
    const it = ch.equip[slot];
    const plus = it && it.plus ? `<i>+${it.plus}</i>` : "";
    const img = it ? itemIcon(it) : "";
    return `<button type="button" class="doll-slot ${it ? "on" : "empty"}" data-slot="${slot}">
      ${img}${plus}<span class="dsl">${slotName(slot)}</span></button>`;
  }
  function wear(slot, cls) {
    const it = ch.equip[slot];
    if (!it) return "";
    return `<div class="wear ${cls}" style="--rc:${E.rarityColor(it)}">${itemIcon(it)}</div>`;
  }
  function openSlotPick(slot) {
    const worn = ch.equip[slot];
    if (worn) return openItem(worn, "eq");
    const cands = ch.bag.filter((it) => slotMatches(it, slot));
    if (!cands.length) return toast("背包沒有可裝的" + slotName(slot));
    openSheet(`<h3>選擇${slotName(slot)}</h3>
      <div class="slot-pick">${cands.map((it) => {
        const d = E.itemDef(it);
        return `<div class="item-row" data-iid="${it.iid}">
          <div class="ico">${itemIcon(it)}</div>
          <div class="info"><div class="nm" style="color:${E.rarityColor(it)}">${E.displayName(it)}</div>
          <div class="meta">${DATA.R[d?.rarity || "common"].name}　Lv.${d?.lv || 1}</div></div>
        </div>`;
      }).join("")}</div>`);
    $("modal").querySelectorAll("[data-iid]").forEach((b) => {
      b.onclick = () => {
        const it = ch.bag.find((x) => x.iid === b.dataset.iid);
        if (!it) return;
        if (!E.tryEquip(ch, it)) toast("無法裝備（等級或職業不符）");
        else toast("已裝備 " + E.displayName(it));
        closeModal(); renderPanel(); refreshTop(); save();
      };
    });
  }
  function renderDoll(box) {
    const st = E.totalStats(ch);
    box.innerHTML = `
      <div class="doll">
        ${dollSlot("weapon")}${dollSlot("helm")}${dollSlot("shield")}
        ${dollSlot("cloak")}${dollSlot("armor")}
        ${dollSlot("gloves")}${dollSlot("amulet")}
        ${dollSlot("boots")}${dollSlot("belt")}
        ${dollSlot("ring1")}${dollSlot("ring2")}
        <div class="doll-stage keep-color">
          ${wear("cloak", "wear-cloak")}
          <div class="doll-ground"></div>
          <div class="hero art doll-body" id="doll-hero"></div>
          ${wear("armor", "wear-armor")}
          ${wear("helm", "wear-helm")}
          ${wear("amulet", "wear-amulet")}
          ${wear("belt", "wear-belt")}
          ${wear("weapon", "wear-weapon")}
          ${wear("shield", "wear-shield")}
          ${wear("gloves", "wear-gloves")}
          ${wear("gloves", "wear-gloves r")}
          ${wear("boots", "wear-boots")}
        </div>
        <div class="doll-stats">
          AC <b>${st.ac}</b>　MR <b>${st.mr}</b><br>
          命中 <b>${st.hit}</b>　迴避 <b>${st.er}</b><br>
          ${st.ranged ? "遠攻" : "近攻"} <b>${st.dmin}~${st.dmax}</b>　魔法 <b>${st.magMin}~${st.magMax}</b>
          負重 <b>${E.weightOf(ch)}</b>/${E.weightMax(ch)}
        </div>
      </div>
      <p class="small" style="margin-top:8px;text-align:center">點空欄從背包穿上，點已穿裝備可卸下</p>`;
    box.querySelectorAll(".doll-slot").forEach((b) => {
      b.onclick = () => openSlotPick(b.dataset.slot);
    });
    paintHero(box.querySelector("#doll-hero"), ch);
  }

  function renderBag() {
    $("subtabs").innerHTML = ["bag:背包", "worn:裝備"].map((x) => {
      const [id, n] = x.split(":");
      return `<div class="subtab ${bagSub === id ? "active" : ""}" data-s="${id}">${n}</div>`;
    }).join("");
    $("subtabs").querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { bagSub = b.dataset.s; renderPanel(); });
    const box = $("panel-scroll");
    if (bagSub === "worn") {
      renderDoll(box);
      return;
    }
    const BAG_SLOTS = BAG_LIMIT;
    const used = ch.bag.length;
    const slots = Math.max(BAG_SLOTS, Math.ceil(used / 5) * 5);
    const cells = [];
    for (let i = 0; i < slots; i++) {
      const it = ch.bag[i];
      if (!it) {
        cells.push(`<div class="bag-cell empty"></div>`);
        continue;
      }
      const qty = (it.qty || 1) > 1 ? `<span class="bq">${it.qty}</span>` : "";
      const plus = it.plus ? `<i>+${it.plus}</i>` : "";
      const rc = E.rarityColor(it);
      cells.push(`<button type="button" class="bag-cell on" data-iid="${it.iid}" title="${E.displayName(it)}" style="--rc:${rc}">
        ${itemIcon(it)}${plus}${qty}
      </button>`);
    }
    box.innerHTML = `
      <div class="bag-head">
        <span>負重 <b>${E.weightOf(ch)}</b>/${E.weightMax(ch)}</span>
        <span>格子 <b>${used}</b>/${slots}</span>
      </div>
      <div class="bag-grid">${cells.join("")}</div>`;
    box.querySelectorAll("[data-iid]").forEach((b) => {
      b.onclick = () => openItem(ch.bag.find((x) => x.iid === b.dataset.iid), "bag");
    });
  }

  function renderStat() {
    $("subtabs").innerHTML = "";
    const st = E.totalStats(ch);
    const tr = ch.transform && DATA.transforms[ch.transform.id];
    const box = $("panel-scroll");
    box.innerHTML = `
      ${tr ? `<div class="poly-status">
        <div class="mob-svg poly-stat">${mobArt(tr.mob)}</div>
        <div><b style="color:#ffd24a">變身：${tr.name}</b>
        <div class="small">剩餘 ${fmtWait(Math.ceil(ch.transform.left))}　${tr.magic === false ? "無法施法" : "可施法"}</div>
        <button class="btn" id="stat-poly-off" style="margin-top:6px">解除變身</button></div>
      </div><hr class="sep">` : ""}
      <div class="stat-grid">
        <div class="stat">等級 <b>${ch.level}</b></div>
        <div class="stat">經驗 <b>${ch.exp}/${E.xpNeed(ch.level)}</b></div>
        <div class="stat">HP <b>${Math.floor(ch.hp)}/${st.maxHp}</b></div>
        <div class="stat">MP <b>${Math.floor(ch.mp)}/${st.maxMp}</b></div>
        <div class="stat">${st.ranged ? "遠距離傷害" : "近距離傷害"} <b>${st.dmin}~${st.dmax}</b></div>
        <div class="stat">魔法傷害 <b>${st.magMin}~${st.magMax}</b></div>
        <div class="stat">命中 <b>${st.hit}</b></div>
        <div class="stat">迴避 <b>${st.er}</b></div>
        <div class="stat">AC <b>${st.ac}</b></div>
        <div class="stat">MR <b>${st.mr}</b></div>
        <div class="stat">SP <b>${st.sp}</b></div>
        <div class="stat">攻速 <b>${st.atkMs} ms</b></div>
        <div class="stat">力量 <b>${st.str}</b></div>
        <div class="stat">敏捷 <b>${st.dex}</b></div>
        <div class="stat">體質 <b>${st.con}</b></div>
        <div class="stat">智力 <b>${st.int}</b></div>
        <div class="stat">精神 <b>${st.wis}</b></div>
        <div class="stat">魅力 <b>${st.cha}</b></div>
        <div class="stat">擊殺/死亡 <b>${ch.stats.kills}/${ch.stats.deaths}</b></div>
      </div>
    `;
    const offBtn = box.querySelector("#stat-poly-off");
    if (offBtn) {
      offBtn.onclick = () => {
        const r = E.cancelTransform(ch);
        toast(r.msg);
        if (r.ok) { log(r.msg, "sys"); refreshTop(); save(); renderStat(); }
      };
    }
  }

  function renderSet() {
    ensureAuto();
    const junk = new Set(ch.auto.junk || []);
    const skillOff = new Set(ch.auto.skillOff || []);
    const next = E.canLearn(ch);
    $("subtabs").innerHTML = "";
    $("panel-scroll").innerHTML = `
      <p class="gold">自動喝水</p>
      <label class="check set-row"><input type="checkbox" id="auto-hp" ${ch.auto.potHp ? "checked" : ""}> HP 過低時自動喝紅水</label>
      <p class="small" id="pot-hp-lab">HP 低於 ${(ch.auto.hp * 100).toFixed(0)}% 時使用</p>
      <input class="range" type="range" min="10" max="80" value="${ch.auto.hp * 100}" id="ahp" ${ch.auto.potHp ? "" : "disabled"}>
      <label class="check set-row"><input type="checkbox" id="auto-mp" ${ch.auto.potMp ? "checked" : ""}> MP 過低時自動喝藍水</label>
      <p class="small" id="pot-mp-lab">MP 低於 ${(ch.auto.mp * 100).toFixed(0)}% 時使用</p>
      <input class="range" type="range" min="5" max="80" value="${ch.auto.mp * 100}" id="amp" ${ch.auto.potMp ? "" : "disabled"}>
      <p class="small" style="margin-top:8px">勾選要自動喝的藥水（沒勾的不會用）</p>
      <div class="junk-grid">${POT_PRESETS.map(([id, name, kind]) => {
        const on = (ch.auto.pots || []).includes(id);
        const dis = kind === "hp" ? !ch.auto.potHp : !ch.auto.potMp;
        return `<label class="check junk-chip"><input type="checkbox" data-pot="${id}" data-kind="${kind}" ${on ? "checked" : ""} ${dis ? "disabled" : ""}> ${name}</label>`;
      }).join("")}</div>
      <hr class="sep">
      <label class="check set-row"><input type="checkbox" id="auto-sell" ${ch.auto.sell ? "checked" : ""}> 自動販賣（打怪後）</label>
      <p class="small">勾選掉落的低級裝，會自動賣成金幣（不含強化裝）</p>
      <div class="junk-grid" id="junk-grid">${JUNK_PRESETS.map(([id, name]) =>
        `<label class="check junk-chip"><input type="checkbox" data-junk="${id}" ${junk.has(id) ? "checked" : ""} ${ch.auto.sell ? "" : "disabled"}> ${name}</label>`
      ).join("")}</div>
      <hr class="sep">
      <p class="gold">技能（戰鬥中自動施放，也可點下方技能欄）</p>
      ${groupedSkills(skillList()).map((g) => {
        const mine = g.skills.filter((s) => (ch.skills || []).includes(s) && E.canCastSkill(ch, s));
        if (!mine.length) return "";
        return `<div class="sec-ttl">${g.name}</div>` + mine.map((s) => {
          const k = DATA.skills[s];
          return `<div class="skill set-skill">
          <label class="check"><input type="checkbox" data-skill="${s}" ${skillOff.has(s) ? "" : "checked"}></label>
          <div class="sk-icon">${skillIcon(s)}</div>
          <div class="info"><b>${k.name}</b><div class="small">${k.desc}</div></div>
          <span class="small">MP ${k.mp}</span>
        </div>`;
        }).join("");
      }).join("") || "<p class='small'>尚未學會技能，升級會自動習得。</p>"}
      ${next.length ? `<p class="small" style="margin-top:6px">即將可學：${next.map((s) => DATA.skills[s].name + `(Lv.${skillLv(s)})`).join("、")}</p>` : ""}
      <hr class="sep">
      <p>修改密碼</p>
      <p class="small">帳號名稱無法更改。目前帳號：${acc.user}</p>
      <input class="field" id="old-pass" type="password" placeholder="舊密碼" style="margin-top:6px" autocomplete="current-password">
      <input class="field" id="new-pass" type="password" placeholder="新密碼（至少 2 字）" style="margin-top:6px" autocomplete="new-password">
      <input class="field" id="new-pass2" type="password" placeholder="再輸入一次新密碼" style="margin-top:6px" autocomplete="new-password">
      <button class="btn wide" id="btn-pass" style="margin-top:8px">更新密碼</button>
      <hr class="sep">
      <p>存檔</p>
      <p class="small">角色資料會自動存到雲端資料庫，關閉網頁或伺服器休眠後進度都會保留。不必匯出。</p>
      <p class="small" style="margin-top:6px">調色與聲音請點左上角「配置」。</p>
      <hr class="sep">
      <button class="btn ghost wide" id="back-char">返回角色選擇</button>
      <p class="small" style="margin-top:10px">擊殺 ${ch.stats.kills}　強化成功 ${ch.stats.enhanceOk}　失敗 ${ch.stats.enhanceFail}<br>
      遊玩 ${Math.floor(ch.stats.play / 60)} 分鐘　連線：${netOk ? "即時伺服器" : "未連線"}</p>`;
    const box = $("panel-scroll");
    const syncPot = () => {
      box.querySelector("#ahp").disabled = !ch.auto.potHp;
      box.querySelector("#amp").disabled = !ch.auto.potMp;
      box.querySelectorAll("[data-pot]").forEach((el) => {
        el.disabled = el.dataset.kind === "hp" ? !ch.auto.potHp : !ch.auto.potMp;
      });
    };
    box.querySelector("#auto-hp").onchange = (e) => {
      ch.auto.potHp = e.target.checked;
      ch.auto.pot = !!(ch.auto.potHp || ch.auto.potMp);
      syncPot();
      save();
    };
    box.querySelector("#auto-mp").onchange = (e) => {
      ch.auto.potMp = e.target.checked;
      ch.auto.pot = !!(ch.auto.potHp || ch.auto.potMp);
      syncPot();
      save();
    };
    box.querySelector("#ahp").oninput = (e) => {
      ch.auto.hp = e.target.value / 100;
      box.querySelector("#pot-hp-lab").textContent = `HP 低於 ${e.target.value}% 時使用`;
      save();
    };
    box.querySelector("#amp").oninput = (e) => {
      ch.auto.mp = e.target.value / 100;
      box.querySelector("#pot-mp-lab").textContent = `MP 低於 ${e.target.value}% 時使用`;
      save();
    };
    box.querySelectorAll("[data-pot]").forEach((el) => {
      el.onchange = () => {
        const set = new Set(ch.auto.pots || []);
        if (el.checked) set.add(el.dataset.pot);
        else set.delete(el.dataset.pot);
        ch.auto.pots = [...set];
        save();
      };
    });
    box.querySelector("#auto-sell").onchange = (e) => {
      ch.auto.sell = e.target.checked;
      box.querySelectorAll("[data-junk]").forEach((el) => { el.disabled = !ch.auto.sell; });
      save();
    };
    box.querySelectorAll("[data-junk]").forEach((el) => {
      el.onchange = () => {
        const id = el.dataset.junk;
        const set = new Set(ch.auto.junk || []);
        if (el.checked) set.add(id);
        else set.delete(id);
        ch.auto.junk = [...set];
        save();
      };
    });
    box.querySelectorAll("[data-skill]").forEach((el) => {
      el.onchange = () => {
        const id = el.dataset.skill;
        const off = new Set(ch.auto.skillOff || []);
        if (el.checked) off.delete(id);
        else off.add(id);
        ch.auto.skillOff = [...off];
        save();
      };
    });
    box.querySelector("#btn-pass").onclick = () => {
      const oldPass = $("old-pass").value;
      const newPass = $("new-pass").value;
      const newPass2 = $("new-pass2").value;
      if (newPass.length < 2) return toast("新密碼至少 2 字");
      if (newPass !== newPass2) return toast("兩次新密碼不一致");
      if (!Net.ready) return toast("尚未連上伺服器");
      Net.send({ t: "changepass", oldPass, newPass });
    };
    box.querySelector("#back-char").onclick = () => {
      save();
      Net.send({ t: "map", mapId: "", hunting: false });
      ch = null;
      showCharSel();
    };
  }

  function renderChat() {
    const tabs = [["sys", "系統"], ["world", "全服"], ["clan", "血盟"], ["party", "隊伍"]];
    $("subtabs").innerHTML = tabs.map(([id, n]) =>
      `<div class="subtab ${chatCh === id ? "active" : ""}" data-c="${id}">${n}</div>`).join("");
    $("subtabs").querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { chatCh = b.dataset.c; renderPanel(); });

    const party = myParty();
    const clan = myClan();
    const canTalk = chatCh === "world" || (chatCh === "party" && party) || (chatCh === "clan" && clan);
    $("chatbar").classList.toggle("hidden", !canTalk);
    const inp = $("chat-in");
    if (inp) {
      inp.placeholder = chatCh === "world" ? "全服頻道…" : chatCh === "clan" ? "血盟頻道…" : "隊伍頻道…";
    }

    const vis = logs.filter((l) => (l.ch || "sys") === chatCh).slice(0, 80);

    let head = "";
    if (chatCh === "sys") {
      head = `<p class="small">戰鬥、掉寶與伺服器公告。此頻道無法發言。</p>`;
    } else if (chatCh === "world") {
      head = `<p class="small">全服頻道　線上 ${world.online || 0} 人</p>`;
    } else if (chatCh === "clan") {
      if (clan) {
        head = `<p class="small">血盟「${clan.name}」　盟主 ${clan.leader}　${(clan.members || []).length}/${clan.max || 20} 人
          <button class="btn ghost" id="chat-cleave" style="margin-left:6px;padding:2px 8px;font-size:11px">退出</button></p>`;
      } else {
        head = `<p class="small">尚未加入血盟。到狩獵場 → 血盟 建立或加入。</p>`;
      }
    } else if (party) {
      head = `<p class="small">${party.leader} 的隊伍　${(party.members || []).join("、")}
        <button class="btn ghost" id="chat-pleave" style="margin-left:6px;padding:2px 8px;font-size:11px">離開</button></p>`;
    } else {
      head = `<p class="small">尚未加入隊伍。到狩獵場 → 隊伍 開團或加入。</p>`;
    }

    const empty = chatCh === "sys" ? "尚無系統訊息。" : "尚無訊息，打個招呼吧。";
    $("panel-scroll").innerHTML = head + `<div class="chat-log">${vis.map((l) =>
      `<div class="${l.cls || l.ch}">${new Date(l.t).toLocaleTimeString()} ${l.msg}</div>`).join("") || `<p class="small" style="padding:8px">${empty}</p>`}</div>`;
    const leaveC = $("chat-cleave");
    if (leaveC) leaveC.onclick = () => Net.send({ t: "clanLeave" });
    const leaveP = $("chat-pleave");
    if (leaveP) leaveP.onclick = () => Net.send({ t: "partyLeave" });
  }

  function marketKind(it) {
    const d = E.itemDef(it);
    if (!d) return "use";
    if (d.type === "weapon") return "weapon";
    if (d.type === "armor" || d.type === "acc") return "armor";
    if (d.type === "mat") return "mat";
    return "use";
  }

  function renderMarket() {
    const cats = [["weapon", "武器"], ["armor", "防具"], ["use", "道具"], ["mat", "材料"]];
    const list = world.market || market || [];
    const vis = list.filter((m) => (m.cat || marketKind(m.it)) === marketCat);
    $("subtabs").innerHTML = cats.map(([id, n]) => {
      const c = list.filter((m) => (m.cat || marketKind(m.it)) === id).length;
      return `<div class="subtab ${marketCat === id ? "active" : ""}" data-c="${id}">${n}${c ? ` ${c}` : ""}</div>`;
    }).join("");
    $("subtabs").querySelectorAll("[data-c]").forEach((b) => {
      b.onclick = () => { marketCat = b.dataset.c; renderMarket(); };
    });
    const mine = (m) => ch && (m.charId === ch.id || (m.seller === ch.name && m.user === acc.user));
    $("panel-scroll").innerHTML = `
      <p class="small">玩家交易所　線上 ${world.online || 0} 人　可自訂價格上架</p>
      <button class="btn wide" id="list-it">上架背包物品</button>
      ${vis.length ? vis.map((m) => {
        const qty = m.it && m.it.qty > 1 ? ` x${m.it.qty}` : "";
        const own = mine(m);
        return `<div class="list-item">
          <div class="ico">${itemIcon(m.it)}</div>
          <div class="info"><div class="ttl" style="color:${E.rarityColor(m.it)}">${E.displayName(m.it)}${qty}</div>
          <div class="sub2">${m.seller}　💰 ${Number(m.price).toLocaleString()}${own ? "　（我的）" : ""}</div></div>
          ${own
            ? `<button class="go" data-un="${m.id}">下架</button>`
            : `<button class="go" data-buy="${m.id}">購買</button>`}
        </div>`;
      }).join("") : `<p class="small" style="margin-top:8px">此分類目前沒有商品</p>`}`;
    const box = $("panel-scroll");
    box.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => Net.send({ t: "marketBuy", id: b.dataset.buy }));
    box.querySelectorAll("[data-un]").forEach((b) => b.onclick = () => Net.send({ t: "marketUnlist", id: b.dataset.un }));
    box.querySelector("#list-it").onclick = openMarketList;
  }

  function openMarketList() {
    if (!ch.bag.length) return toast("背包是空的");
    const rows = ch.bag.map((it) => {
      const d = E.itemDef(it);
      const qty = (it.qty || 1) > 1 ? ` x${it.qty}` : "";
      const sug = Math.max(1, E.sellPrice({ ...it, qty: 1 }) * 3);
      return `<div class="item-row" data-iid="${it.iid}">
        <div class="ico">${itemIcon(it)}</div>
        <div class="info"><div class="nm" style="color:${E.rarityColor(it)}">${E.displayName(it)}${qty}</div>
        <div class="meta">${DATA.R[d?.rarity || "common"].name}　建議 ${sug.toLocaleString()}</div></div>
      </div>`;
    }).join("");
    openSheet(`<h3>選擇上架物品</h3><div class="slot-pick">${rows}</div>`);
    $("modal").querySelectorAll("[data-iid]").forEach((b) => {
      b.onclick = () => {
        const it = ch.bag.find((x) => x.iid === b.dataset.iid);
        if (it) openMarketPrice(it);
      };
    });
  }

  function openMarketPrice(it) {
    const d = E.itemDef(it);
    const maxQty = it.qty || 1;
    const sug = Math.max(1, E.sellPrice({ ...it, qty: 1 }) * 3);
    const stack = !!d?.stack && maxQty > 1;
    openSheet(`<h3>自訂價格</h3>
      <p style="color:${E.rarityColor(it)}">${E.displayName(it)}${maxQty > 1 ? " x" + maxQty : ""}</p>
      <p class="small">商店回收價 ${E.sellPrice({ ...it, qty: 1 })}　建議 ${sug.toLocaleString()}</p>
      ${stack ? `<p class="small" style="margin-top:8px">上架數量</p>
      <input class="field" id="mk-qty" type="number" min="1" max="${maxQty}" value="${maxQty}">` : ""}
      <p class="small" style="margin-top:8px">售價（金幣）</p>
      <input class="field" id="mk-price" type="number" min="1" max="99999999" value="${sug}" inputmode="numeric">
      <button class="btn wide" id="mk-ok" style="margin-top:10px">確認上架</button>`);
    $("modal").querySelector("#mk-ok").onclick = () => {
      const price = Math.floor(Number($("mk-price").value) || 0);
      const qty = stack ? Math.floor(Number($("mk-qty").value) || 1) : 1;
      if (price < 1 || price > 99999999) return toast("價格需為 1～99,999,999");
      if (qty < 1 || qty > maxQty) return toast("數量不正確");
      const listed = E.removeFromBag(ch, it.iid, qty);
      if (!listed) return toast("物品不在背包");
      const cat = marketKind(listed);
      if (!Net.send({ t: "marketList", it: listed, price, cat })) {
        E.addToBag(ch, listed);
        return toast("尚未連線");
      }
      toast("已上架至交易所");
      closeModal();
      renderPanel();
      refreshTop();
      save();
    };
  }

  function renderPanel() {
    $("chatbar").classList.add("hidden");
    if (!ch) return;
    if (tab === "hunt") renderHunt();
    else if (tab === "bag") renderBag();
    else if (tab === "stat") renderStat();
    else if (tab === "chat") renderChat();
    else if (tab === "market") renderMarket();
    else renderSet();
  }

  function bindNet() {
    Net.on("status", (m) => {
      netOk = !!m.ok;
      const eln = $("net-status");
      if (eln) eln.textContent = m.text;
    });
    Net.on("err", (m) => toast(m.msg || "錯誤"));
    Net.on("kicked", (m) => {
      toast(m.msg || "連線已中斷");
      ch = null;
      acc = null;
      if ($("charsel")) $("charsel").classList.add("hidden");
      if ($("login")) $("login").classList.remove("hidden");
      const eln = $("net-status");
      if (eln) eln.textContent = m.msg || "已被強制下線";
    });
    Net.on("ok", (m) => toast(m.msg || "完成"));
    Net.on("passok", (m) => {
      toast(m.msg || "密碼已更新");
      try {
        const r = JSON.parse(localStorage.getItem("aden_remember") || "null");
        if (r && acc && r.u === acc.user) {
          const np = $("new-pass") && $("new-pass").value;
          if (np) localStorage.setItem("aden_remember", JSON.stringify({ u: r.u, p: np }));
        }
      } catch (_) {}
      if (tab === "set") renderPanel();
    });
    Net.on("login", (m) => {
      acc = m.account;
      if (!acc.warehouse) acc.warehouse = [];
      $("login").classList.add("hidden");
      showCharSel();
    });
    Net.on("account", (m) => {
      acc = m.account;
      if (!acc.warehouse) acc.warehouse = [];
      showCharSel();
      toast("角色已建立");
    });
    Net.on("enter", applyEnter);
    Net.on("world", (m) => {
      world.online = m.online || 0;
      world.maps = m.maps || {};
      world.tax = m.tax || 0;
      world.taxRate = m.taxRate > 0 ? m.taxRate : 0.05;
      world.serverLv = m.serverLv || 1;
      world.parties = m.parties || [];
      world.clans = m.clans || [];
      world.market = m.market || [];
      world.bosses = m.bosses || {};
      ensureClientBosses();
      world.players = m.players || [];
      market = world.market;
      parties = world.parties;
      if (ch && !ch.mapId) refreshTop();
      if (ch && tab === "hunt") {
        const hall = $("zsub");
        if (hall && !ch.mapId) {
          hall.innerHTML = hallTaxHtml();
        }
      }
      if (ch && (tab === "hunt" || tab === "market")) renderPanel();
      syncBossSprite();
    });
    Net.on("chat", (m) => {
      const chn = m.ch || "world";
      logs.unshift({ t: m.time || Date.now(), msg: m.name + "：" + m.msg, cls: m.cls || chn, ch: chn });
      if (logs.length > 200) logs.pop();
      if (tab === "chat") renderChat();
    });
    Net.on("clan", (m) => applyClan(m.clanId, m.clanName));
    Net.on("mq", (m) => {
      mq(m.text, 12000);
    });
    Net.on("market", (m) => {
      world.market = m.market || [];
      market = world.market;
      if (tab === "market") renderMarket();
    });
    Net.on("bought", (m) => {
      if (!ch) return;
      E.addToBag(ch, m.it);
      ch.gold = m.gold;
      toast("買下了 " + E.displayName(m.it));
      refreshTop(); save();
      if (tab === "bag" || tab === "market") renderPanel();
    });
    Net.on("unlist", (m) => {
      if (!ch || !m.it) return;
      E.addToBag(ch, m.it);
      toast("已下架，物品回到背包");
      refreshTop(); save();
      if (tab === "bag" || tab === "market") renderPanel();
    });
    Net.on("goldAdd", (m) => {
      if (!ch) return;
      ch.gold = (ch.gold || 0) + (m.gold || 0);
      toast(m.msg || ("金幣 +" + m.gold));
      refreshTop(); save();
    });
    Net.on("boss", (m) => {
      world.bosses = m.bosses || world.bosses;
      ensureClientBosses();
      syncBossSprite();
      if (tab === "hunt" && huntCat === "boss") renderPanel();
    });
    Net.on("bossKill", (m) => {
      if (!ch) return;
      ch.gold = (ch.gold || 0) + (m.gold || 0);
      E.gainExp(ch, m.exp || 0);
      toast(`世界王擊殺獎勵 💰${(m.gold || 0).toLocaleString()}　EXP +${(m.exp || 0).toLocaleString()}`);
      if (ch.mapId === m.mapId) { hideMobs(); stopHunt(); }
      refreshTop(); save();
    });
  }

  let bossUiTick = 0;
  function tickBossUi(dt) {
    if (!ch || tab !== "hunt" || huntCat !== "boss") return;
    bossUiTick += dt;
    if (bossUiTick < 1) return;
    bossUiTick = 0;
    const box = $("panel-scroll");
    if (!box) return;
    box.querySelectorAll("[data-boss-row]").forEach((row) => {
      const id = row.dataset.bossRow;
      const sub = row.querySelector(".sub2");
      if (!sub || !id) return;
      const map = DATA.maps.find((m) => m.id === id);
      if (!map) return;
      const alive = world.bosses && world.bosses[id] && world.bosses[id].alive !== false;
      const st = bossStatusText(id);
      sub.innerHTML = `建議 Lv.${map.rec}　<span class="${alive ? "ok" : "warn"}">${st}</span>　重生 ${fmtWait(bossRespawnSec(id))}`;
    });
  }

  function syncBossSprite() {
    const map = ch && DATA.maps.find((x) => x.id === ch.mapId);
    const boss = liveMobs().find((m) => m.boss);
    if (!map || !map.boss || !boss) return;
    const b = world.bosses[map.id];
    if (!b) return;
    boss.hp = b.hp;
    boss.maxHp = b.max || boss.maxHp;
    updateMobHp(boss);
    if (!b.alive) hideMobs();
  }

  function bind() {
    $("btn-login").onclick = () => login(false);
    $("btn-reg").onclick = () => login(true);
    $("btn-attack").onclick = startHunt;
    $("btn-stop").onclick = stopHunt;
    $("btn-lobby").onclick = () => setMap(null);
    $("btn-cfg").onclick = () => openCfg();
    document.querySelectorAll("#tabbar .tab").forEach((t) => {
      t.onclick = () => {
        tab = t.dataset.tab;
        document.querySelectorAll("#tabbar .tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        renderPanel();
      };
    });
    $("chat-send").onclick = () => {
      const v = $("chat-in").value.trim();
      if (!v) return;
      if (chatCh === "sys") return toast("系統頻道無法發言");
      if (chatCh === "clan" && !myClan()) return toast("尚未加入血盟");
      if (chatCh === "party" && !myParty()) return toast("尚未加入隊伍");
      $("chat-in").value = "";
      const chn = chatCh === "clan" || chatCh === "party" ? chatCh : "world";
      if (!Net.send({ t: "chat", ch: chn, msg: v })) toast("尚未連線");
    };
    $("chat-in").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("chat-send").click();
    });
    $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  }

  function boot() {
    loadCfg();
    rememberFill();
    bind();
    bindNet();
    Net.connect();
    startMarquee();
    requestAnimationFrame(tick);
    setInterval(save, 8000);
  }

  boot();
  return { save };
})();
