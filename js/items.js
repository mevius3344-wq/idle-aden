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
    club: `<rect x="14.2" y="5" width="3.6" height="18" rx="1.6" fill="#8a5a28"/><ellipse cx="16" cy="6" rx="4" ry="3" fill="#6a4018"/><path d="M18 24 Q24 26 20 30" stroke="#c42828" stroke-width="1.2" fill="none"/>`,
    ssword: `<rect x="14.6" y="3" width="2.8" height="18" fill="url(#it-blade)"/><path d="M16 3 L16.8 3 L17.4 20 H14.6 Z" fill="#e8f0f8" opacity=".5"/><rect x="11" y="19" width="10" height="2.2" fill="url(#it-gold)"/><rect x="14.6" y="21" width="2.8" height="8" fill="#4a3018"/><path d="M18 22 Q24 26 20 30" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    odagger: `<rect x="14.8" y="4" width="2.4" height="14" fill="url(#it-qing)" filter="url(#it-glow)"/><rect x="11.5" y="16" width="9" height="2" fill="url(#it-gold)"/><rect x="14.6" y="18" width="2.8" height="9" fill="#1a5858"/><path d="M18 20 Q23 24 20 28" stroke="#68d8d0" stroke-width="1" fill="none"/>`,
    osword: `<rect x="14.4" y="3" width="3.2" height="16" fill="url(#it-qing)"/><path d="M16 3 L16.6 19" stroke="#68e8e0" stroke-width=".6"/><rect x="10.5" y="17.5" width="11" height="2.2" fill="url(#it-gold)"/><rect x="14.4" y="19.5" width="3.2" height="9" fill="#0c4040"/><path d="M18.5 21 Q25 26 21 30" stroke="#c42828" stroke-width="1.2" fill="none"/>`,
    bsword: `<rect x="13.6" y="2" width="4.8" height="18" fill="url(#it-blade)"/><path d="M16 2 L17 20" stroke="#fff" stroke-width=".5" opacity=".5"/><rect x="9" y="18.5" width="14" height="2.4" fill="url(#it-gold)"/><rect x="14.2" y="20.8" width="3.6" height="8" fill="#3a2814"/><path d="M19 22 Q26 27 22 30" stroke="#8a2018" stroke-width="1.2" fill="none"/>`,
    lsword: `<rect x="14.4" y="2" width="3.2" height="18" fill="#c8d0dc"/><path d="M16 2 L16.6 20" stroke="#fff" stroke-width=".5"/><rect x="10" y="18.5" width="12" height="2.2" fill="url(#it-gold)"/><rect x="14.4" y="20.6" width="3.2" height="8" fill="#4a3018"/><circle cx="16" cy="12" r="1.1" fill="#d4af37" opacity=".7"/><path d="M18.5 22 Q25 26 21 30" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    scimitar: `<path d="M8 8 Q24 3 25 16 Q18 12 12 22 Z" fill="#d0d6e0" filter="url(#it-soft)"/><rect x="9" y="19" width="7" height="2" transform="rotate(-28 12 20)" fill="url(#it-gold)"/><rect x="7" y="21" width="3" height="8" transform="rotate(-28 8 25)" fill="#5a3818"/><path d="M10 24 Q16 28 12 30" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    katana: `<path d="M7 9 L27 7 L26 11 L8 15 Z" fill="#eef4f8" filter="url(#it-glow)"/><path d="M9 11 L25 9" stroke="#c9a0ff" stroke-width=".8" opacity=".7"/><rect x="6" y="13" width="9" height="2.4" fill="#8a2018"/><rect x="5" y="15" width="3" height="10" fill="#1a1410"/><path d="M8 26 Q14 28 10 30" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    claymore: `<rect x="13.2" y="1" width="5.6" height="19" fill="#9aa4b4"/><path d="M16 1 L16.8 20" stroke="#e8eef4" stroke-width=".7"/><rect x="7" y="18.5" width="18" height="2.6" fill="url(#it-gold)"/><rect x="14" y="21" width="4" height="8" fill="#2a1810"/><path d="M20 22 Q28 26 24 30" stroke="#8a2018" stroke-width="1.2" fill="none"/>`,
    dsword: `<rect x="14.4" y="2" width="3.2" height="16" fill="#4a0818"/><path d="M16 2 L16.6 18" stroke="#a02038" stroke-width="1" filter="url(#it-glow)"/><rect x="10" y="17" width="12" height="2" fill="#2a0810"/><rect x="14.4" y="19" width="3.2" height="10" fill="#1a080c"/><path d="M18.5 21 Q26 26 22 30" stroke="#ff4060" stroke-width="1.2" fill="none"/>`,
    excal: `<rect x="14.2" y="1" width="3.6" height="16" fill="url(#it-holy)" filter="url(#it-glow)"/><path d="M16 1 L16.6 17" stroke="#fff8e0" stroke-width=".7"/><rect x="9" y="16" width="14" height="2.6" fill="url(#it-gold)"/><circle cx="16" cy="14" r="2.2" fill="#7ec8ff" filter="url(#it-glow)"/><rect x="14.4" y="18.5" width="3.2" height="10" fill="url(#it-gold)"/><path d="M19 20 Q27 24 23 30" stroke="#ffe27a" stroke-width="1.3" fill="none"/>`,
    axe: `<rect x="14.5" y="7" width="3" height="21" fill="#6a4018"/><path d="M17 8 L28 12 L17 19 Z" fill="url(#it-blade)"/><path d="M15 9 L4 14 L15 17 Z" fill="#8a949e"/><path d="M18 24 Q24 28 20 30" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    spear: `<rect x="15.2" y="9" width="1.6" height="20" fill="#8a5a28"/><path d="M16 2 L19.2 11 H12.8 Z" fill="url(#it-blade)"/><path d="M12 14 Q16 11 20 14" stroke="#c42828" stroke-width="1.2" fill="none"/>`,
    bow: `<path d="M9 6 Q6 16 9 26 Q17 16 9 6" fill="none" stroke="#8a5a28" stroke-width="2.2"/><line x1="10" y1="8" x2="10" y2="24" stroke="#d8c8a0" stroke-width="1"/>`,
    obow: `<path d="M9 6 Q6 16 9 26 Q17 16 9 6" fill="none" stroke="#287878" stroke-width="2.4"/><line x1="10" y1="8" x2="10" y2="24" stroke="#68d8d0" stroke-width="1"/><rect x="8" y="14" width="4" height="2" fill="url(#it-gold)"/>`,
    lbow: `<path d="M7 4 Q3 16 7 28 Q20 16 7 4" fill="none" stroke="#6a4018" stroke-width="2.5"/><line x1="8" y1="6" x2="8" y2="26" stroke="#eee" stroke-width="1.1"/>`,
    xbow: `<rect x="14" y="7" width="4" height="19" fill="#6a4018"/><rect x="5" y="13" width="22" height="4" rx="1" fill="#8a5a28"/><line x1="7" y1="11" x2="7" y2="19" stroke="#ddd" stroke-width="1.2"/><rect x="18" y="12" width="8" height="1.5" fill="url(#it-blade)"/>`,
    elvenbow: `<path d="M8 4 Q4 16 8 28 Q22 16 8 4" fill="none" stroke="#3a9850" stroke-width="2.5"/><path d="M8 6 Q10 16 8 26" fill="none" stroke="#9be37d" stroke-width="1"/><line x1="9" y1="6" x2="9" y2="26" stroke="#fff8e0" stroke-width="1"/><ellipse cx="20" cy="10" rx="3" ry="2" fill="#9be37d" opacity=".5"/>`,
    moonbow: `<path d="M9 3 Q3 16 9 29 Q24 16 9 3" fill="none" stroke="#c9a0ff" stroke-width="2.6" filter="url(#it-glow)"/><circle cx="23" cy="8" r="4" fill="#ffe27a" filter="url(#it-glow)"/><line x1="10" y1="6" x2="10" y2="26" stroke="#e8d0ff" stroke-width="1"/>`,
    wand: `<rect x="15.2" y="10" width="1.6" height="18" fill="#8a5a28"/><path d="M16 3 L19 11 H13 Z" fill="url(#it-jade)"/><circle cx="16" cy="5" r="2" fill="#7ec8ff" opacity=".7"/>`,
    staff: `<rect x="14.8" y="12" width="2.4" height="16" fill="#6a4018"/><circle cx="16" cy="8" r="5.2" fill="url(#it-jade)"/><circle cx="16" cy="8" r="2.4" fill="#e8ffe0"/><path d="M20 14 Q26 18 22 24" stroke="#efe4c8" stroke-width="1.2" fill="none"/>`,
    crystal: `<rect x="15.2" y="13" width="1.6" height="15" fill="#b8c8e0"/><path d="M16 3 L21 13 H11 Z" fill="#7ec8ff" filter="url(#it-glow)"/><path d="M16 3 L18 13 H14 Z" fill="#d8f0ff"/>`,
    archstaff: `<rect x="14.8" y="12" width="2.4" height="16" fill="#4a2878"/><circle cx="16" cy="8" r="6" fill="#5a3a8a"/><circle cx="16" cy="8" r="2.8" fill="#c9a0ff" filter="url(#it-glow)"/><path d="M20 14 Q26 18 22 24" stroke="url(#it-gold)" stroke-width="1.2" fill="none"/>`,
    starstaff: `<rect x="15.2" y="13" width="1.6" height="15" fill="#2a1848"/><polygon points="16,2 18.5,9 26,9 20,13.5 22.5,21 16,16.5 9.5,21 12,13.5 6,9 13.5,9" fill="url(#it-holy)" filter="url(#it-glow)"/>`,

    /* ── 防具 ── */
    cap: `<path d="M8 20 Q8 12 16 10 Q24 12 24 20" fill="#cbb58a"/><ellipse cx="16" cy="11" rx="5" ry="3.5" fill="#d8c8a0"/><rect x="14" y="6" width="4" height="6" rx="1" fill="url(#it-gold)"/>`,
    ohelm: `<path d="M8 20 Q8 12 16 10 Q24 12 24 20" fill="url(#it-qing)"/><ellipse cx="16" cy="10" rx="5" ry="3.5" fill="#0c4040"/><rect x="14" y="5" width="4" height="6" rx="1" fill="url(#it-gold)"/><path d="M22 18 Q26 22 22 26" stroke="#c42828" stroke-width="1.1" fill="none"/>`,
    lhelm: `<path d="M8 20 Q8 12 16 10 Q24 12 24 20" fill="#8a6a40"/><ellipse cx="16" cy="11" rx="5" ry="3" fill="#6a4a28"/><rect x="14" y="7" width="4" height="5" rx="1" fill="#c19a4a"/>`,
    ihelm: `<path d="M7 20 Q7 10 16 8 Q25 10 25 20" fill="#a8b0bc"/><ellipse cx="16" cy="9" rx="5.5" ry="3.5" fill="#7a8494"/><rect x="14" y="4" width="4" height="7" rx="1" fill="url(#it-gold)"/>`,
    dhelm: `<path d="M7 20 Q7 9 16 7 Q25 9 25 20" fill="#388050"/><ellipse cx="16" cy="8" rx="6" ry="4" fill="#286040"/><rect x="14" y="3" width="4" height="7" rx="1" fill="url(#it-gold)"/><circle cx="10" cy="14" r="1.6" fill="#ffe27a" opacity=".6"/><circle cx="22" cy="14" r="1.6" fill="#ffe27a" opacity=".6"/>`,
    cloth: `<path d="M10 8 L16 4 L22 8 L25 28 H7 Z" fill="#d0c4a8"/><path d="M16 8 L10 28" stroke="#efe4c8" stroke-width="1.1"/><path d="M16 8 L22 28" stroke="#efe4c8" stroke-width="1.1"/>`,
    leather: `<path d="M9 8 L16 4 L23 8 L25 28 H7 Z" fill="#8a5a28"/><path d="M16 8 L10 28" stroke="#efe4c8" stroke-width="1"/><path d="M16 8 L22 28" stroke="#efe4c8" stroke-width="1"/><rect x="13" y="16" width="6" height="6" rx="1" fill="#6a4018" opacity=".5"/>`,
    oring: `<path d="M9 8 L16 4 L23 8 L25 27 H7 Z" fill="url(#it-qing)"/><path d="M16 8 L10 28" stroke="url(#it-gold)" stroke-width=".9"/><path d="M16 8 L22 28" stroke="url(#it-gold)" stroke-width=".9"/><circle cx="16" cy="16" r="1.6" fill="url(#it-gold)"/>`,
    ochain: `<path d="M9 8 L16 4 L23 8 L25 27 H7 Z" fill="#287878"/><path d="M16 8 L10 28" stroke="url(#it-gold)" stroke-width=".9"/><path d="M16 8 L22 28" stroke="url(#it-gold)" stroke-width=".9"/><path d="M11 14 H21 M11 19 H21" stroke="url(#it-gold)" stroke-width="1"/>`,
    ringmail: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a949e"/><circle cx="12" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="16" cy="16" r="1.4" fill="#c8d0d8"/><circle cx="20" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="13" cy="21" r="1.4" fill="#c8d0d8"/><circle cx="19" cy="21" r="1.4" fill="#c8d0d8"/>`,
    bronze: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#a09060"/><path d="M16 8 L10 28" stroke="#efe4c8" stroke-width="1"/><path d="M16 8 L22 28" stroke="#efe4c8" stroke-width="1"/><rect x="13" y="14" width="6" height="5" fill="#c8b878"/>`,
    scale: `<path d="M9 7 L16 4 L23 7 L25 27 H7 Z" fill="#387848"/><path d="M10 12 Q16 10 22 12 Q16 16 10 12" fill="#58a868"/><path d="M10 18 Q16 16 22 18 Q16 22 10 18" fill="#58a868"/><path d="M10 24 Q16 22 22 24 Q16 26 10 24" fill="#58a868"/>`,
    plate: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#c0c6d0"/><path d="M16 8 L10 28" stroke="#efe4c8" stroke-width="1.1"/><path d="M16 8 L22 28" stroke="#efe4c8" stroke-width="1.1"/><rect x="13" y="14" width="6" height="6" fill="url(#it-gold)" opacity=".7"/>`,
    crystalarm: `<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#58a8e8" filter="url(#it-glow)"/><path d="M16 4 L20 12 H12 Z" fill="#d8f0ff"/><rect x="13" y="14" width="6" height="8" fill="#4aa0e0"/>`,
    elvenchain: `<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="url(#it-silk-g)"/><path d="M11 12 H21 M11 17 H21 M11 22 H21" stroke="#9be37d" stroke-width="1.3"/><ellipse cx="16" cy="10" rx="4" ry="2" fill="#68b878" opacity=".6"/>`,
    robe: `<path d="M10 7 L16 4 L22 7 L26 28 H6 Z" fill="url(#it-silk-p)"/><path d="M16 8 L10 28" stroke="#c9a0ff" stroke-width="1"/><path d="M16 8 L22 28" stroke="#c9a0ff" stroke-width="1"/><circle cx="16" cy="12" r="2.2" fill="#ffe27a" opacity=".7"/>`,
    archrobe: `<path d="M9 6 L16 3 L23 6 L27 29 H5 Z" fill="#3c1868"/><path d="M16 7 L9 29" stroke="url(#it-gold)" stroke-width="1.1"/><path d="M16 7 L23 29" stroke="url(#it-gold)" stroke-width="1.1"/><circle cx="16" cy="11" r="3.2" fill="#c9a0ff" filter="url(#it-glow)"/>`,
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
    red: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="url(#it-potion-r)"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#8a2018"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/><circle cx="16" cy="20" r="3" fill="#ff9088" opacity=".45"/>`,
    orange: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="#e08030"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#a05018"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/><circle cx="16" cy="20" r="3" fill="#ffb060" opacity=".5"/>`,
    clear: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="#d8f0ff" stroke="#7ec8ff" stroke-width=".8"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#a8d0e8"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/>`,
    blue: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="url(#it-potion-b)"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#1a4a8a"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/><circle cx="16" cy="20" r="3" fill="#8ac8ff" opacity=".4"/>`,
    wisdom: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="url(#it-silk-p)"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#2e1a52"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/><circle cx="16" cy="20" r="3" fill="#c9a0ff" opacity=".45"/>`,
    haste_pot: `<ellipse cx="16" cy="20" rx="8" ry="8.5" fill="#e08030"/><rect x="13" y="6" width="6" height="8" rx="1" fill="#a05018"/><ellipse cx="16" cy="6" rx="4" ry="2" fill="#c19a4a"/><path d="M14 17 L18 23 L14 25" stroke="#ffe040" stroke-width="1.5" fill="none"/>`,
    scroll_w: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#f4e6b8"/><path d="M10 9 H22 M10 13 H20 M10 17 H21" stroke="#8a2018" stroke-width="1"/><circle cx="20" cy="22" r="3.2" fill="#c42828" opacity=".85"/><text x="20" y="24" text-anchor="middle" font-size="4" fill="#fff4c8" font-weight="bold">武</text>`,
    scroll_a: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#f4e6b8"/><path d="M10 9 H22 M10 13 H20 M10 17 H21" stroke="#1a5028" stroke-width="1"/><circle cx="20" cy="22" r="3.2" fill="#3d8a4a"/><text x="20" y="24" text-anchor="middle" font-size="4" fill="#fff4c8" font-weight="bold">防</text>`,
    scroll_b: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#fff4c8"/><path d="M10 9 H22 M10 13 H20" stroke="#c19a4a" stroke-width="1"/><polygon points="16,15 18,21 16,24 14,21" fill="url(#it-gold)" filter="url(#it-glow)"/>`,
    scroll_poly: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#e8dcc8"/><path d="M10 9 H22 M10 13 H20" stroke="#3d8a4a" stroke-width="1"/><ellipse cx="16" cy="20" rx="4.5" ry="3.5" fill="#5ca048"/>`,
    scroll_poly2: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#d8e8f8"/><path d="M10 9 H22 M10 13 H20" stroke="#4080c0" stroke-width="1"/><circle cx="13" cy="20" r="1.4" fill="#ff4040"/><circle cx="19" cy="20" r="1.4" fill="#ff4040"/>`,
    scroll_poly3: `<rect x="8" y="5" width="16" height="22" rx="1.5" fill="#f0e0ff"/><path d="M10 9 H22 M10 13 H20" stroke="#8050c0" stroke-width="1"/><path d="M16 16 L20 24 L12 24 Z" fill="#889098"/>`,

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
