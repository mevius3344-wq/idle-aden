/* 裝備／道具 — 每件獨立武俠 SVG（青鋒／玄鐵／宗師系列） */
window.ITEM_ART = (() => {
  const RARITY = {
    common: { stroke: "#8a7350", rim: "#5a4830", glow: "rgba(193,154,74,.12)" },
    uncommon: { stroke: "#4a9858", rim: "#2a5838", glow: "rgba(155,227,125,.22)" },
    rare: { stroke: "#4080c0", rim: "#204868", glow: "rgba(126,200,255,.28)" },
    epic: { stroke: "#8050c0", rim: "#402868", glow: "rgba(201,160,255,.32)" },
    legend: { stroke: "#c9a030", rim: "#806018", glow: "rgba(255,210,74,.38)" },
  };

  const D = `<defs>
    <linearGradient id="it-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff4c8"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8a6020"/></linearGradient>
    <linearGradient id="it-blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fcff"/><stop offset="45%" stop-color="#b8c8d8"/><stop offset="100%" stop-color="#687888"/></linearGradient>
    <linearGradient id="it-qing" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#68d8d0"/><stop offset="55%" stop-color="#287878"/><stop offset="100%" stop-color="#0c4040"/></linearGradient>
    <linearGradient id="it-xuan" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#88a8c8"/><stop offset="50%" stop-color="#384858"/><stop offset="100%" stop-color="#182028"/></linearGradient>
    <linearGradient id="it-holy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff8d0"/><stop offset="50%" stop-color="#ffe27a"/><stop offset="100%" stop-color="#c9a030"/></linearGradient>
    <linearGradient id="it-silk-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c42828"/><stop offset="100%" stop-color="#3a0808"/></linearGradient>
    <linearGradient id="it-silk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a9850"/><stop offset="100%" stop-color="#0c2814"/></linearGradient>
    <linearGradient id="it-silk-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a48c8"/><stop offset="100%" stop-color="#1a0c30"/></linearGradient>
    <linearGradient id="it-jade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9be37d"/><stop offset="100%" stop-color="#287838"/></linearGradient>
    <linearGradient id="it-potion-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7068"/><stop offset="100%" stop-color="#a82020"/></linearGradient>
    <linearGradient id="it-potion-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#68b0f0"/><stop offset="100%" stop-color="#1a5090"/></linearGradient>
    <filter id="it-glow"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="it-soft"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".45"/></filter>
  </defs>`;

  let _seq = 0;
  const frame = (inner, rarity, id) => {
    const r = RARITY[rarity] || RARITY.common;
    const gid = `ibg-${String(id ?? _seq++).replace(/[^a-z0-9_]/gi, "")}-${_seq++}`;
    return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="item-art-svg">
      ${D}
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2a2018"/><stop offset="100%" stop-color="#120e08"/></linearGradient></defs>
      <rect x="1" y="1" width="30" height="30" rx="5" fill="url(#${gid})" stroke="${r.stroke}" stroke-width="1.6"/>
      <rect x="3" y="3" width="26" height="26" rx="3.5" fill="none" stroke="${r.rim}" stroke-width=".6" opacity=".45"/>
      <ellipse cx="16" cy="28" rx="10" ry="2" fill="${r.glow}"/>
      ${inner}
    </svg>`;
  };

  /* ── 武器 ── */
  const art = {
    club: `<rect x="14" y="5" width="4" height="20" rx="1.8" fill="#8a5a28" filter="url(#it-soft)"/><ellipse cx="16" cy="6" rx="3" ry="2" fill="#6a4018"/><rect x="12" y="23" width="8" height="5" rx="1.5" fill="#5a3818"/>`,
    ssword: `<path d="M16 3 L18.8 17 H13.2 Z" fill="url(#it-blade)"/><rect x="11" y="17" width="10" height="2.4" fill="#8a6a40"/><rect x="14" y="19.5" width="4" height="9" fill="#4a3018"/>`,
    odagger: `<path d="M16 4 L18 15 H14 Z" fill="url(#it-qing)" filter="url(#it-glow)"/><rect x="12" y="15" width="8" height="2" fill="url(#it-gold)"/><rect x="14.5" y="17" width="3" height="10" fill="#1a5858"/>`,
    osword: `<path d="M16 3 L19 16 H13 Z" fill="url(#it-qing)"/><path d="M16 3 L17 16 H15 Z" fill="#68e8e0" opacity=".5"/><rect x="11" y="16" width="10" height="2.2" fill="url(#it-gold)"/><rect x="14" y="18" width="4" height="9" fill="#0c4040"/>`,
    bsword: `<path d="M16 2 L21 18 H11 Z" fill="url(#it-blade)"/><rect x="9" y="18" width="14" height="2.6" fill="#a07830"/><rect x="13" y="20.5" width="6" height="8" fill="#3a2814"/>`,
    lsword: `<path d="M16 2 L19.5 18 H12.5 Z" fill="#c8d0dc"/><rect x="10" y="18" width="12" height="2.4" fill="url(#it-gold)"/><rect x="14" y="20" width="4" height="9" fill="#4a3018"/><circle cx="16" cy="12" r="1.2" fill="#d4af37" opacity=".6"/>`,
    scimitar: `<path d="M8 7 Q24 3 25 15 Q18 11 11 21 Z" fill="#d0d6e0" filter="url(#it-soft)"/><rect x="9" y="19" width="7" height="2" transform="rotate(-28 12 20)" fill="url(#it-gold)"/><rect x="7" y="21" width="3" height="8" transform="rotate(-28 8 25)" fill="#5a3818"/>`,
    katana: `<path d="M7 9 L27 7 L26 11 L8 15 Z" fill="#eef4f8" filter="url(#it-glow)"/><path d="M9 11 L25 9" stroke="#c9a0ff" stroke-width=".8" opacity=".7"/><rect x="6" y="13" width="9" height="2.4" fill="#8a2018"/><rect x="5" y="15" width="3" height="11" fill="#1a1410"/><circle cx="8" cy="14" r="1.5" fill="url(#it-gold)"/>`,
    claymore: `<path d="M16 1 L22 19 H10 Z" fill="#9aa4b4"/><path d="M16 1 L18 19 H14 Z" fill="#c8d0dc" opacity=".5"/><rect x="7" y="19" width="18" height="2.8" fill="url(#it-gold)"/><rect x="13" y="21.5" width="6" height="8" fill="#2a1810"/>`,
    dsword: `<path d="M16 2 L19.5 17 H12.5 Z" fill="#4a0818"/><path d="M16 2 L17.5 17 H14.5 Z" fill="#a02038" filter="url(#it-glow)"/><rect x="10" y="17" width="12" height="2" fill="#2a0810"/><rect x="14" y="19" width="4" height="10" fill="#1a080c"/><circle cx="16" cy="8" r="2" fill="#ff4060" opacity=".45"/>`,
    excal: `<path d="M16 1 L20 16 H12 Z" fill="url(#it-holy)" filter="url(#it-glow)"/><path d="M16 1 L17.2 16 H14.8 Z" fill="#fff8e0"/><rect x="9" y="16" width="14" height="2.8" fill="url(#it-gold)"/><circle cx="16" cy="14" r="2.5" fill="#7ec8ff" filter="url(#it-glow)"/><rect x="14" y="18.5" width="4" height="10" fill="url(#it-gold)"/>`,
    axe: `<rect x="14.5" y="7" width="3" height="21" fill="#6a4018"/><path d="M17 8 L28 12 L17 19 Z" fill="url(#it-blade)"/><path d="M15 9 L4 14 L15 17 Z" fill="#8a949e"/>`,
    spear: `<rect x="15" y="9" width="2" height="20" fill="#8a5a28"/><path d="M16 3 L19.5 11 H12.5 Z" fill="url(#it-blade)"/><path d="M13 14 Q16 12 19 14" stroke="#c42828" stroke-width="1.2" fill="none"/>`,
    bow: `<path d="M9 6 Q6 16 9 26 Q17 16 9 6" fill="none" stroke="#8a5a28" stroke-width="2.2"/><line x1="10" y1="8" x2="10" y2="24" stroke="#d8c8a0" stroke-width="1"/>`,
    obow: `<path d="M9 6 Q6 16 9 26 Q17 16 9 6" fill="none" stroke="#287878" stroke-width="2.4"/><line x1="10" y1="8" x2="10" y2="24" stroke="#68d8d0" stroke-width="1"/><rect x="8" y="14" width="4" height="2" fill="url(#it-gold)"/>`,
    lbow: `<path d="M7 4 Q3 16 7 28 Q20 16 7 4" fill="none" stroke="#6a4018" stroke-width="2.5"/><line x1="8" y1="6" x2="8" y2="26" stroke="#eee" stroke-width="1.1"/>`,
    xbow: `<rect x="14" y="7" width="4" height="19" fill="#6a4018"/><rect x="5" y="13" width="22" height="4" rx="1" fill="#8a5a28"/><line x1="7" y1="11" x2="7" y2="19" stroke="#ddd" stroke-width="1.2"/><rect x="18" y="12" width="8" height="1.5" fill="url(#it-blade)"/>`,
    elvenbow: `<path d="M8 4 Q4 16 8 28 Q22 16 8 4" fill="none" stroke="#3a9850" stroke-width="2.5"/><path d="M8 6 Q10 16 8 26" fill="none" stroke="#9be37d" stroke-width="1"/><line x1="9" y1="6" x2="9" y2="26" stroke="#fff8e0" stroke-width="1"/><ellipse cx="20" cy="10" rx="3" ry="2" fill="#9be37d" opacity=".5"/>`,
    moonbow: `<path d="M9 3 Q3 16 9 29 Q24 16 9 3" fill="none" stroke="#c9a0ff" stroke-width="2.6" filter="url(#it-glow)"/><circle cx="23" cy="8" r="4" fill="#ffe27a" filter="url(#it-glow)"/><line x1="10" y1="6" x2="10" y2="26" stroke="#e8d0ff" stroke-width="1"/>`,
    wand: `<rect x="15" y="10" width="2" height="18" fill="#8a5a28"/><circle cx="16" cy="8" r="4.5" fill="#7ec8ff" opacity=".85"/><circle cx="16" cy="8" r="2" fill="#e8f8ff"/>`,
    staff: `<rect x="14.5" y="12" width="3" height="17" fill="#6a4018"/><circle cx="16" cy="8" r="5.5" fill="url(#it-jade)"/><circle cx="16" cy="8" r="2.8" fill="#e8ffe0"/>`,
    crystal: `<rect x="15" y="13" width="2" height="16" fill="#b8c8e0"/><path d="M16 3 L21.5 13 H10.5 Z" fill="#7ec8ff" filter="url(#it-glow)"/><path d="M16 3 L18 13 H14 Z" fill="#d8f0ff"/>`,
    archstaff: `<rect x="14.5" y="12" width="3" height="17" fill="#4a2878"/><circle cx="16" cy="8" r="6.5" fill="#5a3a8a"/><circle cx="16" cy="8" r="3.2" fill="#c9a0ff" filter="url(#it-glow)"/><rect x="14" y="18" width="4" height="1.5" fill="url(#it-gold)"/>`,
    starstaff: `<rect x="15" y="13" width="2" height="16" fill="#2a1848"/><polygon points="16,2 18.5,9 26,9 20,13.5 22.5,21 16,16.5 9.5,21 12,13.5 6,9 13.5,9" fill="url(#it-holy)" filter="url(#it-glow)"/>`,

    /* ── 防具 ── */
    cap: `<ellipse cx="16" cy="19" rx="10" ry="6" fill="#cbb58a"/><path d="M8 19 Q16 9 24 19" fill="#d8c8a0"/><rect x="12" y="8" width="8" height="3" rx="1" fill="#b8a888"/>`,
    ohelm: `<path d="M7 18 Q7 9 16 8 Q25 9 25 18 Z" fill="url(#it-qing)"/><rect x="6" y="17" width="20" height="4" rx="1" fill="#0c4040"/><rect x="12" y="12" width="8" height="3" fill="url(#it-gold)"/>`,
    lhelm: `<path d="M8 18 Q8 10 16 9 Q24 10 24 18 Z" fill="#8a6a40"/><rect x="7" y="17" width="18" height="4" fill="#6a4a28"/>`,
    ihelm: `<path d="M6 18 Q6 8 16 7 Q26 8 26 18 Z" fill="#a8b0bc"/><rect x="5" y="17" width="22" height="4" fill="#7a8494"/><rect x="14" y="7" width="4" height="6" fill="url(#it-gold)"/>`,
    dhelm: `<path d="M6 19 Q6 7 16 5 Q26 7 26 19 Z" fill="#388050"/><path d="M10 8 L16 2 L22 8" fill="#286040"/><rect x="6" y="18" width="20" height="4" fill="#1a4030"/><circle cx="10" cy="12" r="2" fill="#ffe27a" opacity=".5"/><circle cx="22" cy="12" r="2" fill="#ffe27a" opacity=".5"/>`,
    cloth: `<path d="M10 8 L16 6 L22 8 L24 27 H8 Z" fill="#d0c4a8"/><path d="M10 8 L8 14" stroke="#b8a888" stroke-width="2"/><path d="M22 8 L24 14" stroke="#b8a888" stroke-width="2"/>`,
    leather: `<path d="M9 8 L16 5 L23 8 L25 28 H7 Z" fill="#8a5a28"/><path d="M16 8 V25" stroke="#6a4018" stroke-width="1.4"/><rect x="13" y="14" width="6" height="8" rx="1" fill="#6a4018" opacity=".5"/>`,
    oring: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="url(#it-qing)"/><circle cx="12" cy="14" r="1.5" fill="url(#it-gold)"/><circle cx="16" cy="16" r="1.5" fill="url(#it-gold)"/><circle cx="20" cy="14" r="1.5" fill="url(#it-gold)"/><circle cx="14" cy="21" r="1.5" fill="url(#it-gold)"/><circle cx="18" cy="21" r="1.5" fill="url(#it-gold)"/>`,
    ochain: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#287878"/><path d="M11 12 H21 M11 17 H21 M11 22 H21" stroke="url(#it-gold)" stroke-width="1.3"/><rect x="13" y="10" width="6" height="3" fill="#0c4040"/>`,
    ringmail: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a949e"/><circle cx="12" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="16" cy="16" r="1.4" fill="#c8d0d8"/><circle cx="20" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="13" cy="21" r="1.4" fill="#c8d0d8"/><circle cx="19" cy="21" r="1.4" fill="#c8d0d8"/>`,
    bronze: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#a09060"/><path d="M16 6 V25" stroke="#6a5a38" stroke-width="2"/><rect x="12" y="12" width="8" height="6" fill="#c8b878"/>`,
    scale: `<path d="M9 7 L16 4 L23 7 L25 27 H7 Z" fill="#387848"/><path d="M10 12 Q16 10 22 12 Q16 16 10 12" fill="#58a868"/><path d="M10 18 Q16 16 22 18 Q16 22 10 18" fill="#58a868"/><path d="M10 24 Q16 22 22 24 Q16 26 10 24" fill="#58a868"/>`,
    plate: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#c0c6d0"/><path d="M16 6 V25" stroke="#8a90a0" stroke-width="2"/><rect x="12" y="12" width="8" height="7" fill="#d8dce4"/><rect x="14" y="8" width="4" height="3" fill="url(#it-gold)"/>`,
    crystalarm: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#58a8e8" filter="url(#it-glow)"/><path d="M16 4 L20 12 H12 Z" fill="#d8f0ff"/><rect x="13" y="14" width="6" height="8" fill="#4aa0e0"/>`,
    elvenchain: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="url(#it-silk-g)"/><path d="M11 12 H21 M11 17 H21 M11 22 H21" stroke="#9be37d" stroke-width="1.3"/><ellipse cx="16" cy="10" rx="4" ry="2" fill="#68b878" opacity=".6"/>`,
    robe: `<path d="M10 7 L16 5 L22 7 L26 28 H6 Z" fill="url(#it-silk-p)"/><path d="M16 5 V28" stroke="#c9a0ff" stroke-width="1.2"/><circle cx="16" cy="12" r="2.5" fill="#ffe27a" opacity=".6"/>`,
    archrobe: `<path d="M9 6 L16 3 L23 6 L27 29 H5 Z" fill="#3c1868"/><path d="M16 4 V28" stroke="url(#it-gold)" stroke-width="1.4"/><circle cx="16" cy="11" r="3.5" fill="#c9a0ff" filter="url(#it-glow)"/><polygon points="16,6 17,9 20,9 17.5,11 18.5,14 16,12 13.5,14 14.5,11 12,9 15,9" fill="#ffe27a" opacity=".7"/>`,
    buckler: `<circle cx="16" cy="16" r="10" fill="#8a6a40" stroke="url(#it-gold)" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="#d4af37"/><path d="M16 6 V26" stroke="#6a4a28" stroke-width="1"/>`,
    kite: `<path d="M16 3 L27 12 L16 29 L5 12 Z" fill="#7a8494" stroke="url(#it-gold)" stroke-width="1.6"/><path d="M16 8 V22" stroke="#ffe27a" stroke-width="1.4"/><path d="M12 12 H20" stroke="#8a2018" stroke-width="2"/>`,
    tower: `<rect x="7" y="4" width="18" height="24" rx="2" fill="#5a6270" stroke="url(#it-gold)" stroke-width="1.6"/><rect x="10" y="8" width="12" height="4" fill="#8a2018"/><rect x="12" y="16" width="8" height="8" fill="#3a4048"/><circle cx="16" cy="18" r="2" fill="#d4af37"/>`,
    cloak1: `<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="#6a5428"/><path d="M16 8 V24" stroke="#5a4020" stroke-width="1"/>`,
    ocloak: `<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="url(#it-qing)"/><path d="M16 8 V24" stroke="#0c4040" stroke-width="1.2"/><rect x="14" y="10" width="4" height="4" fill="url(#it-gold)"/>`,
    cloak2: `<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="#3a2878"/><circle cx="16" cy="14" r="4" fill="#7ec8ff" filter="url(#it-glow)"/><path d="M12 20 Q16 18 20 20" stroke="#c9a0ff" stroke-width="1" fill="none"/>`,
    gloves1: `<path d="M10 18 Q8 10 14 8 L18 8 Q24 10 22 18 L20 26 H12 Z" fill="#8a5a28"/><path d="M13 12 V18 M16 11 V17 M19 12 V18" stroke="#6a4018" stroke-width="1.2"/>`,
    gloves2: `<path d="M10 18 Q8 10 14 8 L18 8 Q24 10 22 18 L20 26 H12 Z" fill="#8a2018"/><rect x="13" y="12" width="6" height="3" fill="url(#it-gold)"/><circle cx="16" cy="13.5" r="1" fill="#ffe27a"/>`,
    boots1: `<path d="M10 8 H18 V20 L26 24 V28 H8 V14 Z" fill="#6a4018"/><path d="M18 10 H22" stroke="#5a3018" stroke-width="1.5"/>`,
    boots2: `<path d="M10 8 H18 V20 L26 24 V28 H8 V14 Z" fill="#3a5a88"/><path d="M18 12 H23" stroke="#7ec8ff" stroke-width="2" filter="url(#it-glow)"/><ellipse cx="20" cy="22" rx="3" ry="1.5" fill="#68b0f0" opacity=".4"/>`,

    /* ── 飾品 ── */
    amu1: `<circle cx="16" cy="6" r="2" fill="url(#it-gold)"/><path d="M16 8 V15" stroke="url(#it-gold)" stroke-width="1.6"/><circle cx="16" cy="20" r="6" fill="#c4453c" filter="url(#it-soft)"/><path d="M14 19 H18" stroke="#ffe0d0" stroke-width="1"/>`,
    amu2: `<circle cx="16" cy="6" r="2" fill="url(#it-gold)"/><path d="M16 8 V15" stroke="url(#it-gold)" stroke-width="1.6"/><circle cx="16" cy="20" r="6" fill="#4aa0e0" filter="url(#it-glow)"/><circle cx="16" cy="20" r="3" fill="#d8f0ff"/>`,
    amu3: `<circle cx="16" cy="6" r="2.2" fill="#ffe27a" filter="url(#it-glow)"/><path d="M16 8 V13" stroke="#ffe27a" stroke-width="2"/><polygon points="16,14 21.5,21 16,28 10.5,21" fill="url(#it-holy)" filter="url(#it-glow)"/>`,
    ring_mr: `<circle cx="16" cy="16" r="8" fill="none" stroke="#7ec8ff" stroke-width="3.5"/><circle cx="16" cy="9" r="3.2" fill="#4aa0e0" filter="url(#it-glow)"/>`,
    ring_str: `<circle cx="16" cy="16" r="8" fill="none" stroke="url(#it-gold)" stroke-width="3.5"/><circle cx="16" cy="9" r="3.2" fill="#e05040"/>`,
    ring_dex: `<circle cx="16" cy="16" r="8" fill="none" stroke="#9be37d" stroke-width="3.5"/><circle cx="16" cy="9" r="3.2" fill="#4aa85a"/>`,
    ring_imm: `<circle cx="16" cy="16" r="8" fill="none" stroke="#c9a0ff" stroke-width="3.5" filter="url(#it-glow)"/><circle cx="16" cy="9" r="3.5" fill="#ffe27a" filter="url(#it-glow)"/>`,
    belt1: `<rect x="4" y="13" width="24" height="7" rx="2" fill="#8a5a28"/><rect x="13" y="12" width="6" height="9" fill="url(#it-gold)"/><circle cx="16" cy="16.5" r="1.5" fill="#5a3818"/>`,
    belt2: `<rect x="4" y="13" width="24" height="7" rx="2" fill="#3a1860"/><rect x="13" y="12" width="6" height="9" fill="#c9a0ff" filter="url(#it-glow)"/><circle cx="16" cy="16.5" r="2" fill="#ffe27a" opacity=".7"/>`,

    /* ── 藥水／卷軸 ── */
    red: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="url(#it-potion-r)"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#8a2018"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#ff9088" opacity=".5"/>`,
    orange: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#e08030"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a05018"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#ffb060" opacity=".55"/>`,
    clear: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#d8f0ff" opacity=".92" stroke="#7ec8ff" stroke-width="1"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a8d0e8"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#fff" opacity=".35"/>`,
    blue: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="url(#it-potion-b)"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#1a4a8a"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#8ac8ff" opacity=".45"/>`,
    wisdom: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="url(#it-silk-p)"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#2e1a52"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#c9a0ff" opacity=".5"/>`,
    haste_pot: `<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#e08030"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a05018"/><path d="M14 16 L18 22 L14 24" stroke="#ffe040" stroke-width="1.6" fill="none"/>`,
    scroll_w: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8d8b0"/><rect x="6" y="8" width="20" height="4" fill="#c19a4a"/><path d="M11 16 H21 M13 12 L19 20" stroke="#8a2018" stroke-width="1.6"/><text x="16" y="19" text-anchor="middle" font-size="5" fill="#8a2018" font-weight="bold">武</text>`,
    scroll_a: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8d8b0"/><rect x="6" y="8" width="20" height="4" fill="#4a7a50"/><rect x="13" y="13" width="6" height="8" fill="#3d8a4a"/><text x="16" y="19" text-anchor="middle" font-size="5" fill="#1a4020" font-weight="bold">防</text>`,
    scroll_b: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#fff4c8"/><rect x="6" y="8" width="20" height="4" fill="#ffe27a"/><polygon points="16,12 18,18 16,22 14,18" fill="url(#it-gold)" filter="url(#it-glow)"/>`,
    scroll_poly: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8dcc8"/><rect x="6" y="8" width="20" height="4" fill="#9be37d"/><ellipse cx="16" cy="18" rx="5" ry="4" fill="#5ca048"/><circle cx="14" cy="17" r="1" fill="#1a3010"/><circle cx="18" cy="17" r="1" fill="#1a3010"/>`,
    scroll_poly2: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#d8e8f8"/><rect x="6" y="8" width="20" height="4" fill="#7ec8ff"/><path d="M10 22 Q16 12 22 22" fill="#687078"/><circle cx="13" cy="17" r="1.5" fill="#ff4040"/><circle cx="19" cy="17" r="1.5" fill="#ff4040"/>`,
    scroll_poly3: `<rect x="6" y="8" width="20" height="16" rx="2" fill="#f0e0ff"/><rect x="6" y="8" width="20" height="4" fill="#c9a0ff"/><path d="M16 12 L20 22 L12 22 Z" fill="#889098"/><circle cx="14" cy="18" r="1.5" fill="#ff4040"/><circle cx="18" cy="18" r="1.5" fill="#ff4040"/>`,

    /* ── 材料 ── */
    hide: `<path d="M8 10 Q16 4 24 10 Q26 18 22 24 Q16 20 10 24 Q6 18 8 10" fill="#a07040"/>`,
    hide2: `<path d="M8 10 Q16 4 24 10 Q26 18 22 24 Q16 20 10 24 Q6 18 8 10" fill="#6a3818"/><path d="M12 12 Q16 8 20 12 Q18 18 16 20 Q14 18 12 12" fill="url(#it-gold)"/>`,
    bone: `<rect x="8" y="14" width="16" height="4" rx="2" fill="#e8dcc8"/><circle cx="7" cy="13" r="3.2" fill="#e8dcc8"/><circle cx="7" cy="19" r="3.2" fill="#e8dcc8"/><circle cx="25" cy="13" r="3.2" fill="#e8dcc8"/><circle cx="25" cy="19" r="3.2" fill="#e8dcc8"/>`,
    ore: `<path d="M8 20 L12 8 L20 10 L24 20 L16 26 Z" fill="#6a7080"/><path d="M12 8 L16 16 L20 10" fill="#a8b0bc"/>`,
    ingot: `<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#b8c0cc"/><path d="M8 14 H24 V20 H8 Z" fill="#8a949e"/>`,
    steel: `<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#7a8494"/><path d="M8 14 H24 V20 H8 Z" fill="#4a5460"/>`,
    mithril: `<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="url(#it-xuan)" filter="url(#it-glow)"/><path d="M8 14 H24 V20 H8 Z" fill="#384858"/><path d="M10 12 L14 16 L12 18" stroke="#88a8c8" stroke-width=".8" fill="none"/>`,
    rough_mith: `<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#586878" opacity=".85"/><path d="M8 14 H24 V20 H8 Z" fill="#384858" opacity=".7"/><circle cx="12" cy="12" r="1.5" fill="#88a8c8"/>`,
    gem: `<polygon points="16,4 24,12 16,28 8,12" fill="#7ec8ff" filter="url(#it-glow)"/><polygon points="16,4 20,12 16,18 12,12" fill="#d8f0ff"/>`,
    gem_r: `<polygon points="16,4 24,12 16,28 8,12" fill="#e05040" filter="url(#it-glow)"/><polygon points="16,4 20,12 16,18 12,12" fill="#ff9080"/>`,
    gem_g: `<polygon points="16,4 24,12 16,28 8,12" fill="#48a858"/><polygon points="16,4 20,12 16,18 12,12" fill="#9be37d"/>`,
    scale_mat: `<path d="M8 18 Q16 6 24 18 Q16 26 8 18" fill="#387848"/><path d="M12 16 Q16 10 20 16 Q16 20 12 16" fill="#58a868"/><path d="M10 20 Q16 14 22 20" stroke="url(#it-gold)" stroke-width=".8" fill="none"/>`,
    candle: `<rect x="14" y="10" width="4" height="16" rx="1" fill="#e8dcc8"/><ellipse cx="16" cy="8" rx="3" ry="4" fill="#ffe27a" opacity=".85" filter="url(#it-glow)"/><rect x="15" y="4" width="2" height="4" fill="#404040"/>`,
  };

  function fallback(def) {
    const rarity = (def && def.rarity) || "common";
    return frame(`<rect x="10" y="10" width="12" height="12" rx="2" fill="#3a2e20"/><path d="M13 16 H19 M16 13 V19" stroke="#6a5838" stroke-width="1.5"/>`, rarity, "unknown");
  }

  function of(id, def) {
    const rarity = (def && def.rarity) || "common";
    const inner = art[id];
    if (!inner) return fallback(def);
    return frame(inner, rarity, id);
  }

  return { of, art, RARITY };
})();
