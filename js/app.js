window.App = (() => {
  const E = Engine;
  const KEY = "aden_idle_v1";
  let store = { accounts: {}, session: null };
  let acc = null;
  let ch = null;
  let tab = "hunt";
  let huntCat = "village";
  let huntRegion = "亞丁大陸";
  let bagSub = "bag";
  let chatCh = "sys";
  let logs = [];
  let combat = { mob: null, tPlayer: 0, tMob: 0, cds: {}, buffs: [] };
  let lastTick = performance.now();
  let hue = 32;
  let soundOn = false;
  let parties = [];
  let market = [];
  let world = { online: 0, maps: {}, tax: 0, serverLv: 1, parties: [], market: [], bosses: {}, players: [] };
  let netOk = false;

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

  function log(msg, cls = "atk") {
    logs.unshift({ t: Date.now(), msg, cls, ch: chatCh === "sys" ? "sys" : chatCh });
    if (logs.length > 200) logs.pop();
    if (tab === "chat") renderPanel();
  }

  function mq(text) {
    $("mqtext").textContent = text;
  }

  function portraitOf(c) {
    if (!c) return "assets/port-knight-m.png";
    return `assets/port-${c.classId}-${c.gender}.png`;
  }
  function spriteOf(c) {
    if (!c) return "assets/spr-knight-m.png";
    return `assets/spr-${c.classId}-${c.gender}.png`;
  }
  function mobArt(id) {
    const map = {
      fox: "fox", orc: "orc", kobold: "orc", gnoll: "wolf", skeleton: "skel", zombie: "skel",
      wolfman: "wolf", ghoul: "skel", ant: "scorpion", scorpion: "scorpion", lizard: "drake",
      drake: "drake", gargoyle: "skel", deathk: "dk", balrog: "balrog", ancient: "dragon",
    };
    return `assets/mob-${map[id] || "orc"}.png`;
  }
  function itemIconSrc(it) {
    const d = E.itemDef(it) || DATA.items[it];
    if (!d) return "assets/ico-armor.png";
    if (d.kind === "potion") return d.hp ? "assets/ico-red.png" : "assets/ico-blue.png";
    if (d.kind === "scroll") return "assets/ico-scroll.png";
    if (d.type === "weapon") return "assets/ico-sword.png";
    if (d.slot === "shield") return "assets/ico-shield.png";
    if (d.type === "acc") return "assets/ico-ring.png";
    return "assets/ico-armor.png";
  }
  function setImg(el, src) {
    if (!el) return;
    if (el.getAttribute("src") !== src) el.setAttribute("src", src);
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
        <div class="ico keep-color"><img class="ico-img" src="${portraitOf(c)}" alt=""></div>
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
    const state = { classId: cls0, gender: "m", name: "", attrs, remain: 5 };
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
        <input class="field" id="cname" maxlength="8" placeholder="角色名稱" value="${state.name}">
        <p class="small" style="margin:8px 0 4px">職業</p>
        <div class="class-pick">${Object.values(DATA.classes).map((c) =>
          `<button class="btn ${state.classId === c.id ? "on" : ""}" data-cls="${c.id}">${c.name}</button>`).join("")}</div>
        <p class="small" style="margin:8px 0">${DATA.classes[state.classId].desc}</p>
        <div class="class-pick">
          <button class="btn ${state.gender === "m" ? "on" : ""}" data-g="m">男</button>
          <button class="btn ${state.gender === "f" ? "on" : ""}" data-g="f">女</button>
        </div>
        <p class="small" style="margin:10px 0 4px">分配屬性點 · 剩餘 <b class="gold">${state.remain}</b></p>
        ${rows}
        <div class="row" style="margin-top:10px">
          <button class="btn ghost wide" id="c-cancel">返回</button>
          <button class="btn wide" id="c-ok">建立角色</button>
        </div>
      </div>`;
      modal.querySelector("#cname").oninput = (e) => state.name = e.target.value;
      modal.querySelectorAll("[data-cls]").forEach((b) => b.onclick = () => {
        state.classId = b.dataset.cls; state.attrs = baseCopy(); state.remain = 5; draw();
      });
      modal.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { state.gender = b.dataset.g; draw(); });
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
        const neu = E.newCharacter({ name, classId: state.classId, gender: state.gender, attrs: state.attrs });
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
    setImg($("avatar-face"), portraitOf(ch));
    $("pname").textContent = ch.name;
    $("pmeta").innerHTML = `${DATA.classes[ch.classId].name} · 等級 ${ch.level} · <span style="color:${k.c}">${k.t} ${ch.karma}</span>`;
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
    setImg($("sp-p-art"), spriteOf(ch));
    const buffHtml = (combat.buffs || []).map((b) => `<div class="buff" title="${b.name}">${b.icon}</div>`).join("");
    $("buffs").innerHTML = buffHtml || `<span class="dim">無</span>`;
    $("stxt").textContent = ch.hunting ? "狩獵中" : combat.buffs.length ? "增益" : "無";
  }

  function setMap(mapId, keepHunt) {
    const map = DATA.maps.find((m) => m.id === mapId);
    ch.mapId = map ? map.id : null;
    if (!map) {
      ch.hunting = false;
      combat.mob = null;
      $("battle").className = "bg-hall keep-color";
      $("ztitle").textContent = "— 大 廳 —";
      $("zsub").innerHTML = `稅金：${(world.tax || 0).toLocaleString()}<br>
        <span style="color:#ff8ad0">掉寶倍率 1.0</span>　<span style="color:#7ec8ff">金幣倍率 1.0</span><br>
        當前遊玩人數：${world.online || 0}　伺服器等級：${world.serverLv || 1}`;
      $("btn-lobby").classList.add("hidden");
      $("btn-attack").classList.add("hidden");
      $("btn-stop").classList.add("hidden");
      hideMob();
      $("mhp").classList.add("hidden");
    } else {
      $("battle").className = "bg-" + (map.bg || "forest") + " keep-color";
      $("ztitle").textContent = map.name;
      $("zsub").textContent = `建議 Lv.${map.rec}`;
      $("btn-lobby").classList.remove("hidden");
      $("btn-attack").classList.toggle("hidden", !!keepHunt);
      $("btn-stop").classList.toggle("hidden", !keepHunt);
      if (!keepHunt) {
        ch.hunting = false;
        combat.mob = null;
        hideMob();
        $("mhp").classList.add("hidden");
      }
    }
    save();
    Net.send({ t: "map", mapId: ch.mapId || "", hunting: !!ch.hunting });
    if (tab === "hunt") renderPanel();
  }

  function startHunt() {
    if (!ch.mapId) return toast("請先選擇狩獵場");
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    const b = world.bosses && world.bosses[map?.id];
    if (map?.boss && b && !b.alive) {
      const sec = Math.max(0, Math.ceil((b.next - Date.now()) / 1000));
      return toast(`世界王尚未重生（${sec}s）`);
    }
    ch.hunting = true;
    combat.tPlayer = 0;
    combat.tMob = 0;
    if (!combat.mob) spawn();
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

  function hideMob() {
    $("sp-m-art").classList.add("hidden");
    $("sp-m-art").removeAttribute("src");
    $("mhp").classList.add("hidden");
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
  }

  function shake(crit) {
    const b = $("battle");
    b.classList.remove("shake");
    void b.offsetWidth;
    if (crit) b.classList.add("shake");
  }

  function spawn() {
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (!map) return;
    combat.mob = E.makeMob(map);
    if (map.boss && world.bosses[map.id]) {
      const b = world.bosses[map.id];
      combat.mob.hp = b.hp;
      combat.mob.maxHp = b.max || b.hp;
      combat.mob.boss = true;
    }
    const img = $("sp-m-art");
    setImg(img, mobArt(combat.mob.id));
    img.classList.remove("hidden");
    $("sp-m").classList.remove("spawn");
    void $("sp-m").offsetWidth;
    $("sp-m").classList.add("spawn");
    $("mhp").classList.remove("hidden");
    $("mhpf").style.width = Math.max(0, (combat.mob.hp / combat.mob.maxHp) * 100) + "%";
  }

  function floatDmg(target, text, cls) {
    const box = target === "p" ? $("sp-p") : $("sp-m");
    const n = document.createElement("div");
    n.className = "float-dmg " + (cls || "");
    n.textContent = text;
    box.appendChild(n);
    setTimeout(() => n.remove(), 800);
  }

  function onKill(mob) {
    ch.stats.kills += 1;
    const gold = E.irand(mob.gold[0], mob.gold[1]);
    ch.gold += gold;
    const ups = E.gainExp(ch, mob.exp);
    const loot = E.rollDrops(mob.id, 1);
    for (const it of loot) {
      E.addToBag(ch, it);
      log(`獲得 ${E.displayName(it)}`, "drop");
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
    }
    if (mob.boss) {
      stopHunt();
      toast("世界王倒下了");
    }
    combat.mob = null;
    hideMob();
    burst("hit", 340, 140);
    refreshTop();
    save();
  }

  function trySkills() {
    const st = E.totalStats(ch);
    for (const sid of ch.skills) {
      const sk = DATA.skills[sid];
      if ((combat.cds[sid] || 0) > 0 || ch.mp < sk.mp || !combat.mob) continue;
      if (sk.kind === "heal" && ch.hp / st.maxHp > 0.7) continue;
      if (sk.kind === "buff" && combat.buffs.some((b) => b.id === sid)) continue;
      combat.cds[sid] = sk.cd;
      ch.mp -= sk.mp;
      if (sk.kind === "heal") {
        const h = Math.floor(st.maxHp * sk.pct);
        ch.hp = Math.min(st.maxHp, ch.hp + h);
        floatDmg("p", "+" + h, "heal");
        log(`施放 ${sk.name} 回復 ${h}`);
        return true;
      }
      if (sk.kind === "buff") {
        combat.buffs.push({ id: sid, name: sk.name, icon: "🛡️", left: sk.dur, reduce: sk.reduce });
        log(`施放 ${sk.name}`);
        return true;
      }
      const hits = sk.hits || 1;
      for (let i = 0; i < hits; i++) {
        const r = E.playerHit(ch, combat.mob, sk.mul, sk.kind === "magic");
        applyPlayerHit(r, sk.name, sk.kind === "magic");
      }
      if (sk.stun && combat.mob) combat.mob.stun = sk.stun;
      return true;
    }
    return false;
  }

  function applyPlayerHit(r, skillName, magic) {
    if (!combat.mob) return;
    $("sp-p").classList.remove("swing");
    void $("sp-p").offsetWidth;
    $("sp-p").classList.add("swing");
    const box = $("sp-m").getBoundingClientRect();
    const root = $("battle").getBoundingClientRect();
    const x = box.left - root.left + box.width * 0.45;
    const y = box.top - root.top + box.height * 0.35;
    burst(magic ? "magic" : "slash", x, y);
    if (r.miss) {
      floatDmg("m", "MISS", "miss");
      log(`${skillName || "攻擊"} 未命中`);
      return;
    }
    combat.mob.hp -= r.dmg;
    floatDmg("m", (r.crit ? "★" : "-") + r.dmg, r.crit ? "crit" : "");
    shake(r.crit);
    burst("hit", x, y);
    $("sp-m").classList.remove("hit");
    void $("sp-m").offsetWidth;
    $("sp-m").classList.add("hit");
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (map && map.boss) {
      Net.send({ t: "bossHit", mapId: map.id, dmg: r.dmg });
      const b = world.bosses[map.id];
      if (b) {
        combat.mob.hp = b.hp;
        combat.mob.maxHp = b.max || combat.mob.maxHp;
      }
      $("mhpf").style.width = Math.max(0, (combat.mob.hp / combat.mob.maxHp) * 100) + "%";
      if (b && !b.alive) { hideMob(); stopHunt(); }
      return;
    }
    $("mhpf").style.width = Math.max(0, (combat.mob.hp / combat.mob.maxHp) * 100) + "%";
    if (combat.mob.hp <= 0) onKill(combat.mob);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    requestAnimationFrame(tick);
    if (!ch) return;
    ch.stats.play += dt;
    combat.buffs = combat.buffs.filter((b) => (b.left -= dt) > 0);
    if (!ch.hunting) {
      refreshTop();
      return;
    }
    const map = DATA.maps.find((m) => m.id === ch.mapId);
    if (!map) return;
    if (!combat.mob) spawn();
    if (!combat.mob) return;

    const pots = E.autoPotions(ch);
    pots.forEach((p) => log(p, "sys"));

    combat.tPlayer -= dt;
    combat.tMob -= dt;
    for (const sid of ch.skills) combat.cds[sid] = (combat.cds[sid] || 0) - dt;
    if (combat.tPlayer <= 0) {
      if (!trySkills()) {
        applyPlayerHit(E.playerHit(ch, combat.mob, 1, false), "普通攻擊");
      }
      combat.tPlayer = E.totalStats(ch).atkMs / 1000;
    }
    if (combat.mob && combat.mob.stun > 0) {
      combat.mob.stun -= dt;
    } else if (combat.mob && combat.tMob <= 0) {
      const reduce = combat.buffs.reduce((s, b) => s + (b.reduce || 0), 0);
      const r = E.mobHit(ch, combat.mob);
      if (r.miss) floatDmg("p", "MISS", "miss");
      else {
        const dmg = Math.max(1, Math.floor(r.dmg * (1 - reduce)));
        ch.hp -= dmg;
        floatDmg("p", "-" + dmg);
        if (ch.hp <= 0) {
          ch.hp = 0;
          ch.stats.deaths += 1;
          ch.hunting = false;
          log("你被擊倒了，送回大廳。", "sys");
          toast("陣亡，已送回大廳");
          setMap(null);
          const st = E.totalStats(ch);
          ch.hp = Math.floor(st.maxHp * 0.4);
        }
      }
      combat.tMob = 1.1 + combat.mob.lv * 0.02;
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

  function itemIcon(it) {
    return `<img class="ico-img" src="${itemIconSrc(it)}" alt="">`;
  }

  function openItem(it, where) {
    const d = E.itemDef(it);
    const st = E.itemStats(it);
    const lines = [];
    if (d.dmax) lines.push(`傷害 ${st.dmin} ~ ${st.dmax}`);
    if (d.ac) lines.push(`AC ${st.ac}`);
    if (d.mr || st.mr) lines.push(`MR ${st.mr}`);
    if (st.str) lines.push(`力量 +${st.str}`);
    if (st.dex) lines.push(`敏捷 +${st.dex}`);
    if (st.int) lines.push(`智力 +${st.int}`);
    if (st.hp) lines.push(`HP +${st.hp}`);
    if (st.mp) lines.push(`MP +${st.mp}`);
    lines.push(`重量 ${d.weight || 1}　賣價 ${E.sellPrice({ ...it, qty: 1 })}`);
    if (d.classes) lines.push("職業：" + d.classes.map((x) => DATA.classes[x].name).join(" / "));
    const btns = [];
    if (d.slot && where === "bag") btns.push(`<button class="btn wide" id="i-eq">裝 備</button>`);
    if (d.kind === "potion") btns.push(`<button class="btn wide" id="i-use">使 用</button>`);
    if (where === "eq") btns.push(`<button class="btn wide" id="i-ue">卸下</button>`);
    if (d.type !== "use") btns.push(`<button class="btn wide" id="i-en">強 化</button>`);
    btns.push(`<button class="btn ghost wide" id="i-sell">出 售</button>`);
    if (where === "bag") btns.push(`<button class="btn danger wide" id="i-drop">丟 棄</button>`);
    openSheet(`<h3 style="color:${E.rarityColor(it)}">${E.displayName(it)}</h3>
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
    q("#i-en", () => {
      closeModal();
      openSheet(`<h3>強化 ${E.displayName(it)}</h3>
        <p class="small">目前 +${it.plus || 0}　成功率約 ${Math.round(E.enchantRate(it.plus || 0, false) * 100)}%</p>
        <p class="small">+7 以上失敗可能消失。祝福卷軸較安全。</p>
        <button class="btn wide" id="en1">使用對應卷軸</button>
        <button class="btn wide" id="en2" style="margin-top:6px">使用祝福卷軸</button>`);
      $("modal").querySelector("#en1").onclick = () => {
        const r = E.enchant(ch, it, false);
        toast(r.msg); mq(r.msg); closeModal(); renderPanel(); refreshTop(); save();
      };
      $("modal").querySelector("#en2").onclick = () => {
        const r = E.enchant(ch, it, true);
        toast(r.msg); mq(r.msg); closeModal(); renderPanel(); refreshTop(); save();
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
      ["village", "村莊"], ["field", "野外"], ["dungeon", "地監"], ["boss", "世界王"], ["party", "隊伍"],
    ];
    $("subtabs").innerHTML = cats.map(([id, n]) =>
      `<div class="cat ${huntCat === id ? "active" : ""}" data-c="${id}">${n}</div>`).join("");
    $("subtabs").querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { huntCat = b.dataset.c; renderPanel(); });
    const box = $("panel-scroll");
    if (huntCat === "village") {
      box.innerHTML = `<div class="npc-grid">${DATA.npcs.map((n) =>
        `<div class="npc" data-npc="${n.id}"><div class="n">${n.name}</div><div class="d">${n.desc}</div></div>`).join("")}</div>`;
      box.querySelectorAll("[data-npc]").forEach((b) => b.onclick = () => openNpc(b.dataset.npc));
      return;
    }
    if (huntCat === "party") {
      const list = world.parties || [];
      box.innerHTML = (list.length ? list.map((p) =>
        `<div class="list-item"><div class="info"><div class="ttl">${p.leader} 的隊伍 ${(p.members && p.members.length) || 1}/${p.max || 5}
          ${p.auto ? `<span class="party-tag">自動加入</span>` : ""}</div>
          <div class="sub2">練功點：${p.map || "大廳"}</div></div>
          <button class="go" data-join="${p.id}">加入</button></div>`).join("") : `<p class="small">尚無隊伍，當第一個開團的人吧。</p>`) +
        `<button class="btn wide" id="mk-party">創建隊伍</button>`;
      box.querySelectorAll("[data-join]").forEach((b) => b.onclick = () => Net.send({ t: "partyJoin", id: b.dataset.join }));
      box.querySelector("#mk-party").onclick = () => Net.send({ t: "partyCreate", map: (DATA.maps.find((x) => x.id === ch.mapId) || {}).name || "大廳" });
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
      return `<div class="list-item ${here ? "here" : ""}">
        <div class="info"><div class="ttl">${m.name}${here ? "（目前）" : ""} <span class="dim">(${n} 人)</span></div>
        <div class="sub2">建議等級 ${m.rec}${m.boss ? "　世界王" : ""}</div></div>
        <button class="go" data-go="${m.id}">${here ? "停留" : "前往"}</button></div>`;
    }).join("");
    box.innerHTML = regionBar + rows;
    box.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => { huntRegion = b.dataset.r; renderPanel(); });
    box.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { setMap(b.dataset.go, false); toast("已抵達 " + DATA.maps.find((m) => m.id === b.dataset.go).name); });
  }

  function openNpc(id) {
    const n = DATA.npcs.find((x) => x.id === id);
    if (n.stock) {
      const rows = n.stock.map((iid) => {
        const d = DATA.items[iid];
        return `<div class="item-row" data-buy="${iid}">
          <div class="ico keep-color">${itemIcon({ id: iid })}</div>
          <div class="info"><div class="nm">${d.name}</div><div class="meta">💰 ${d.price}　Lv.${d.lv || 1}</div></div>
        </div>`;
      }).join("");
      openSheet(`<h3>${n.name}</h3>${rows}`);
      $("modal").querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => buy(b.dataset.buy));
      return;
    }
    if (n.kind === "smith") {
      const eqs = [...E.equippedList(ch), ...ch.bag.filter((it) => {
        const d = E.itemDef(it); return d && d.type !== "use";
      })];
      openSheet(`<h3>鐵匠</h3><p class="small">選擇要強化的裝備</p>` +
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
      const known = ch.skills.map((s) => DATA.skills[s]).map((s) => `<div class="skill"><div><b>${s.name}</b><div class="small">${s.desc}　MP ${s.mp}</div></div></div>`).join("");
      const next = E.canLearn(ch);
      openSheet(`<h3>導師</h3>${known || "<p>尚未學會技能</p>"}
        <p class="small" style="margin-top:8px">${next.length ? "即將可學：" + next.map((s) => DATA.skills[s].name + `(Lv.${DATA.skills[s].minLv})`).join("、") : "目前沒有新技能可學。升級會自動習得。"}</p>`);
      return;
    }
    if (n.kind === "warehouse") {
      openSheet(`<h3>倉庫</h3><p class="small">角色共用倉庫 ${acc.warehouse.length} 件</p>
        <p class="small">點背包物品可存入；點倉庫物品可領出。</p>
        <button class="btn wide" id="wh-in">從背包存入第一件</button>
        <button class="btn wide" id="wh-out" style="margin-top:6px">領出第一件</button>`);
      $("modal").querySelector("#wh-in").onclick = () => {
        if (!ch.bag.length) return toast("背包是空的");
        acc.warehouse.push(ch.bag.shift()); save(); toast("已存入"); closeModal();
      };
      $("modal").querySelector("#wh-out").onclick = () => {
        if (!acc.warehouse.length) return toast("倉庫是空的");
        ch.bag.push(acc.warehouse.shift()); save(); toast("已領出"); closeModal(); renderPanel();
      };
      return;
    }
    if (n.kind === "tele") {
      huntCat = "field"; closeModal(); renderPanel(); toast("選擇要前往的地圖");
    }
  }

  function buy(id) {
    const d = DATA.items[id];
    if (ch.gold < d.price) return toast("金幣不足");
    ch.gold -= d.price;
    E.addToBag(ch, E.instFrom(id, { qty: d.stack ? 1 : 1 }));
    toast(`買下 ${d.name}`);
    refreshTop(); save();
  }

  function renderBag() {
    $("subtabs").innerHTML = ["bag:背包", "worn:裝備欄"].map((x) => {
      const [id, n] = x.split(":");
      return `<div class="subtab ${bagSub === id ? "active" : ""}" data-s="${id}">${n}</div>`;
    }).join("");
    $("subtabs").querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { bagSub = b.dataset.s; renderPanel(); });
    const box = $("panel-scroll");
    if (bagSub === "worn") {
      box.innerHTML = `<div class="eq-grid">${DATA.slots.map(([slot, name]) => {
        const it = ch.equip[slot];
        return `<div class="eq-slot" data-slot="${slot}"><div class="sn">${name}</div>
          <div class="en" style="color:${it ? E.rarityColor(it) : "#5a4a2a"}">${it ? E.displayName(it) : "－"}</div></div>`;
      }).join("")}</div>
      <p class="small" style="margin-top:8px">負重 ${E.weightOf(ch)} / ${E.weightMax(ch)}</p>`;
      box.querySelectorAll("[data-slot]").forEach((b) => {
        b.onclick = () => { const it = ch.equip[b.dataset.slot]; if (it) openItem(it, "eq"); };
      });
      return;
    }
    if (!ch.bag.length) { box.innerHTML = `<p class="dim" style="padding:12px">背包空空如也</p>`; return; }
    box.innerHTML = ch.bag.map((it) => {
      const d = E.itemDef(it);
      const qty = (it.qty || 1) > 1 ? ` ×${it.qty}` : "";
      return `<div class="item-row" data-iid="${it.iid}">
        <div class="ico">${itemIcon(it)}</div>
        <div class="info"><div class="nm" style="color:${E.rarityColor(it)}">${E.displayName(it)}${qty}</div>
        <div class="meta">${DATA.R[d?.rarity || "common"].name}　${d?.type === "use" ? "消耗" : "裝備"}</div></div>
      </div>`;
    }).join("");
    box.querySelectorAll("[data-iid]").forEach((b) => {
      b.onclick = () => openItem(ch.bag.find((x) => x.iid === b.dataset.iid), "bag");
    });
  }

  function renderStat() {
    $("subtabs").innerHTML = "";
    const st = E.totalStats(ch);
    const box = $("panel-scroll");
    box.innerHTML = `
      <div class="stat-grid">
        <div class="stat">等級 <b>${ch.level}</b></div>
        <div class="stat">經驗 <b>${ch.exp}/${E.xpNeed(ch.level)}</b></div>
        <div class="stat">HP <b>${Math.floor(ch.hp)}/${st.maxHp}</b></div>
        <div class="stat">MP <b>${Math.floor(ch.mp)}/${st.maxMp}</b></div>
        <div class="stat">攻擊 <b>${st.dmin}~${st.dmax}</b></div>
        <div class="stat">攻速 <b>${st.atkMs} ms</b></div>
        <div class="stat">力量 <b>${st.str}</b></div>
        <div class="stat">敏捷 <b>${st.dex}</b></div>
        <div class="stat">體質 <b>${st.con}</b></div>
        <div class="stat">智力 <b>${st.int}</b></div>
        <div class="stat">精神 <b>${st.wis}</b></div>
        <div class="stat">魅力 <b>${st.cha}</b></div>
        <div class="stat">命中 <b>${st.hit}</b></div>
        <div class="stat">擊殺/死亡 <b>${ch.stats.kills}/${ch.stats.deaths}</b></div>
      </div>
      <hr class="sep">
      <p class="small">自動喝藥 HP 低於 ${(ch.auto.hp * 100).toFixed(0)}%</p>
      <input class="range" type="range" min="10" max="80" value="${ch.auto.hp * 100}" id="ahp">
      <p class="small">自動喝藥 MP 低於 ${(ch.auto.mp * 100).toFixed(0)}%</p>
      <input class="range" type="range" min="5" max="80" value="${ch.auto.mp * 100}" id="amp">
      <hr class="sep"><p class="gold">技能（戰鬥中自動施放）</p>
      ${ch.skills.map((s) => { const k = DATA.skills[s]; return `<div class="skill"><div><b>${k.name}</b><div class="small">${k.desc}</div></div><span class="small">MP ${k.mp}</span></div>`; }).join("") || "<p class='small'>尚未學會</p>"}
    `;
    box.querySelector("#ahp").oninput = (e) => { ch.auto.hp = e.target.value / 100; renderPanel(); save(); };
    box.querySelector("#amp").oninput = (e) => { ch.auto.mp = e.target.value / 100; renderPanel(); save(); };
  }

  function renderChat() {
    $("subtabs").innerHTML = ["sys:通知", "world:全服", "party:隊伍"].map((x) => {
      const [id, n] = x.split(":");
      return `<div class="subtab ${chatCh === id ? "active" : ""}" data-c="${id}">${n}</div>`;
    }).join("");
    $("subtabs").querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { chatCh = b.dataset.c; renderPanel(); });
    $("chatbar").classList.remove("hidden");
    const vis = logs.filter((l) => {
      if (chatCh === "sys") return l.cls === "sys" || l.ch === "sys";
      if (chatCh === "world") return l.ch === "world" || l.cls === "atk";
      return l.ch === "party";
    }).slice(0, 80);
    $("panel-scroll").innerHTML = `<div class="chat-log">${vis.map((l) =>
      `<div class="${l.cls}">${new Date(l.t).toLocaleTimeString()} ${l.msg}</div>`).join("") || "<p class='small' style='padding:8px'>尚無訊息，打個招呼吧。</p>"}</div>`;
  }

  function renderMarket() {
    $("subtabs").innerHTML = "";
    const list = world.market || market || [];
    $("panel-scroll").innerHTML = `<p class="small">玩家上架（全服即時）　線上 ${world.online || 0} 人</p>` +
      (list.length ? list.map((m) => `<div class="list-item">
        <div class="info"><div class="ttl" style="color:${E.rarityColor(m.it)}">${E.displayName(m.it)}</div>
        <div class="sub2">${m.seller}　售價 ${Number(m.price).toLocaleString()}</div></div>
        <button class="go" data-buy="${m.id}">購買</button></div>`).join("") : `<p class="small">目前沒有商品</p>`) +
      `<button class="btn wide" id="list-it">上架背包第一件</button>`;
    $("panel-scroll").querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => {
      Net.send({ t: "marketBuy", id: b.dataset.buy });
    });
    $("panel-scroll").querySelector("#list-it").onclick = () => {
      if (!ch.bag.length) return toast("背包是空的");
      const it = ch.bag[0];
      const price = Math.max(10, E.sellPrice(it) * 3);
      E.removeFromBag(ch, it.iid, it.qty || 1);
      Net.send({ t: "marketList", it, price });
      toast("已上架至全服交易所");
      renderPanel(); save();
    };
  }

  function renderSet() {
    $("subtabs").innerHTML = "";
    $("panel-scroll").innerHTML = `
      <p>面板配色</p>
      <input class="range" type="range" min="0" max="360" value="${hue}" id="hue">
      <p class="small">選擇喜歡的色調（角色與道具維持可讀性）</p>
      <hr class="sep">
      <label class="check"><input type="checkbox" id="sfx" ${soundOn ? "checked" : ""}> 遊戲音效（實驗）</label>
      <hr class="sep">
      <button class="btn wide" id="exp">匯出存檔</button>
      <button class="btn wide" id="imp" style="margin-top:6px">匯入存檔</button>
      <textarea class="field" id="savebox" rows="4" style="margin-top:8px" placeholder="存檔 JSON"></textarea>
      <hr class="sep">
      <button class="btn ghost wide" id="back-char">返回角色選擇</button>
      <p class="small" style="margin-top:10px">擊殺 ${ch.stats.kills}　強化成功 ${ch.stats.enhanceOk}　失敗 ${ch.stats.enhanceFail}<br>
      遊玩 ${Math.floor(ch.stats.play / 60)} 分鐘　連線：${netOk ? "即時伺服器" : "未連線"}</p>`;
    $("panel-scroll").querySelector("#hue").oninput = (e) => {
      hue = +e.target.value; document.getElementById("app").style.setProperty("--hue", hue);
    };
    $("panel-scroll").querySelector("#sfx").onchange = (e) => soundOn = e.target.checked;
    $("panel-scroll").querySelector("#exp").onclick = () => {
      $("savebox").value = JSON.stringify(store);
      toast("已填入下方，請複製保存");
    };
    $("panel-scroll").querySelector("#imp").onclick = () => {
      try {
        store = JSON.parse($("savebox").value);
        localStorage.setItem(KEY, $("savebox").value);
        toast("匯入成功，請重新登入");
        location.reload();
      } catch { toast("格式錯誤"); }
    };
    $("panel-scroll").querySelector("#back-char").onclick = () => {
      save();
      Net.send({ t: "map", mapId: "", hunting: false });
      ch = null;
      showCharSel();
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
    Net.on("ok", (m) => toast(m.msg || "完成"));
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
      world.serverLv = m.serverLv || 1;
      world.parties = m.parties || [];
      world.market = m.market || [];
      world.bosses = m.bosses || {};
      world.players = m.players || [];
      market = world.market;
      parties = world.parties;
      if (ch && !ch.mapId) refreshTop();
      if (ch && tab === "hunt") {
        const hall = $("zsub");
        if (hall && !ch.mapId) {
          hall.innerHTML = `稅金：${(world.tax || 0).toLocaleString()}<br>
            <span style="color:#ff8ad0">掉寶倍率 1.0</span>　<span style="color:#7ec8ff">金幣倍率 1.0</span><br>
            當前遊玩人數：${world.online || 0}　伺服器等級：${world.serverLv || 1}`;
        }
      }
      if (ch && (tab === "hunt" || tab === "market")) renderPanel();
      syncBossSprite();
    });
    Net.on("chat", (m) => {
      logs.unshift({ t: m.time || Date.now(), msg: m.name + "：" + m.msg, cls: m.cls || "atk", ch: m.ch || "world" });
      if (logs.length > 200) logs.pop();
      if (tab === "chat") renderChat();
    });
    Net.on("mq", (m) => mq(m.text));
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
    Net.on("goldAdd", (m) => {
      if (!ch) return;
      ch.gold = (ch.gold || 0) + (m.gold || 0);
      toast(m.msg || ("金幣 +" + m.gold));
      refreshTop(); save();
    });
    Net.on("boss", (m) => {
      world.bosses = m.bosses || world.bosses;
      syncBossSprite();
    });
    Net.on("bossKill", (m) => {
      if (!ch) return;
      ch.gold = (ch.gold || 0) + (m.gold || 0);
      E.gainExp(ch, m.exp || 0);
      toast("世界王擊殺獎勵 💰" + (m.gold || 0));
      if (ch.mapId === m.mapId) { hideMob(); stopHunt(); }
      refreshTop(); save();
    });
  }

  function syncBossSprite() {
    const map = ch && DATA.maps.find((x) => x.id === ch.mapId);
    if (!map || !map.boss || !combat.mob) return;
    const b = world.bosses[map.id];
    if (!b) return;
    combat.mob.hp = b.hp;
    combat.mob.maxHp = b.max || combat.mob.maxHp;
    $("mhpf").style.width = Math.max(0, (combat.mob.hp / Math.max(1, combat.mob.maxHp)) * 100) + "%";
    if (!b.alive) hideMob();
  }

  function bind() {
    $("btn-login").onclick = () => login(false);
    $("btn-reg").onclick = () => login(true);
    $("btn-attack").onclick = startHunt;
    $("btn-stop").onclick = stopHunt;
    $("btn-lobby").onclick = () => setMap(null);
    $("btn-cfg").onclick = () => { tab = "stat"; document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "stat")); renderPanel(); };
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
      $("chat-in").value = "";
      if (!Net.send({ t: "chat", ch: chatCh === "party" ? "party" : "world", msg: v })) toast("尚未連線");
    };
    $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  }

  function boot() {
    rememberFill();
    bind();
    bindNet();
    Net.connect();
    requestAnimationFrame(tick);
    setInterval(save, 8000);
  }

  boot();
  return { save };
})();
