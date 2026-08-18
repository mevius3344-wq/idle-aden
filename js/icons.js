/* 每個道具獨立原創 SVG 圖示（天堂系背包格風格） */
window.ICONS = (() => {
  const RARITY = {
    common: { stroke: "#8a7350", glow: "none" },
    uncommon: { stroke: "#4a9858", glow: "0 0 4px rgba(155,227,125,.35)" },
    rare: { stroke: "#4080c0", glow: "0 0 5px rgba(126,200,255,.4)" },
    epic: { stroke: "#8050c0", glow: "0 0 6px rgba(201,160,255,.45)" },
    legend: { stroke: "#c9a030", glow: "0 0 7px rgba(255,210,74,.5)" },
  };

  let _seq = 0;
  const s = (inner, rarity, id) => {
    const r = RARITY[rarity] || RARITY.common;
    const gid = `ibg-${id ?? _seq++}`;
    return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="filter:drop-shadow(${r.glow === "none" ? "0 0 0 transparent" : r.glow.replace("0 0", "0 1px")})">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2a2018"/><stop offset="100%" stop-color="#120e08"/></linearGradient></defs>
      <rect x="1" y="1" width="30" height="30" rx="4" fill="url(#${gid})" stroke="${r.stroke}" stroke-width="1.5"/>
      <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke="${r.stroke}" stroke-width=".5" opacity=".35"/>
      ${inner}
    </svg>`;
  };

  const rawInner = {
    club: s(`<rect x="14" y="4" width="4" height="22" rx="1.5" fill="#8a5a28"/><rect x="13" y="24" width="6" height="5" rx="1" fill="#5a3818"/>`),
    ssword: s(`<path d="M16 3 L18.5 18 H13.5 Z" fill="#c8d0dc"/><rect x="12" y="18" width="8" height="2.5" fill="#c19a4a"/><rect x="14.5" y="20" width="3" height="8" fill="#6a4a20"/>`),
    bsword: s(`<path d="M16 2 L20 19 H12 Z" fill="#b8c0cc"/><rect x="10" y="19" width="12" height="2.5" fill="#a07830"/><rect x="14" y="21" width="4" height="8" fill="#4a3018"/>`),
    scimitar: s(`<path d="M8 6 Q22 4 24 16 Q18 12 12 20 Z" fill="#d0d6e0"/><rect x="10" y="18" width="7" height="2" transform="rotate(-30 13 19)" fill="#c19a4a"/><rect x="8" y="20" width="3" height="8" transform="rotate(-30 9 24)" fill="#5a3818"/>`),
    katana: s(`<path d="M6 8 L26 6 L25 10 L7 14 Z" fill="#e8eef4"/><rect x="5" y="12" width="8" height="2.2" fill="#8a2018"/><rect x="4" y="14" width="3" height="10" fill="#1a1410"/>`),
    claymore: s(`<path d="M16 1 L21 20 H11 Z" fill="#9aa4b4"/><rect x="8" y="20" width="16" height="2.5" fill="#c19a4a"/><rect x="14" y="22" width="4" height="8" fill="#3a2814"/>`),
    dsword: s(`<path d="M16 2 L19 18 H13 Z" fill="#4a1020"/><path d="M16 2 L17.5 18 H14.5 Z" fill="#8a2038"/><rect x="11" y="18" width="10" height="2" fill="#2a0810"/><rect x="14.5" y="20" width="3" height="9" fill="#1a080c"/>`),
    excal: s(`<path d="M16 1 L19.5 17 H12.5 Z" fill="#f4f0c8"/><path d="M16 1 L17.2 17 H14.8 Z" fill="#ffe27a"/><rect x="10" y="17" width="12" height="2.5" fill="#d4af37"/><circle cx="16" cy="16" r="2" fill="#7ec8ff"/><rect x="14.5" y="19.5" width="3" height="9" fill="#c19a4a"/>`),

    bow: s(`<path d="M8 6 Q6 16 8 26 Q16 16 8 6" fill="none" stroke="#8a5a28" stroke-width="2.4"/><line x1="9" y1="8" x2="9" y2="24" stroke="#d8c8a0" stroke-width="1"/>`),
    lbow: s(`<path d="M7 4 Q4 16 7 28 Q18 16 7 4" fill="none" stroke="#6a4018" stroke-width="2.6"/><line x1="8" y1="6" x2="8" y2="26" stroke="#eee" stroke-width="1"/>`),
    xbow: s(`<rect x="14" y="6" width="4" height="20" fill="#6a4018"/><rect x="6" y="12" width="20" height="4" fill="#8a5a28"/><line x1="8" y1="10" x2="8" y2="18" stroke="#ddd" stroke-width="1.2"/>`),
    elvenbow: s(`<path d="M8 4 Q5 16 8 28 Q20 16 8 4" fill="none" stroke="#4aa85a" stroke-width="2.5"/><path d="M8 4 Q10 16 8 28" fill="none" stroke="#9be37d" stroke-width="1"/><line x1="9" y1="6" x2="9" y2="26" stroke="#fff8e0" stroke-width="1"/>`),
    moonbow: s(`<path d="M9 3 Q4 16 9 29 Q22 16 9 3" fill="none" stroke="#c9a0ff" stroke-width="2.6"/><circle cx="22" cy="8" r="3.5" fill="#ffe27a"/><line x1="10" y1="6" x2="10" y2="26" stroke="#e8d0ff" stroke-width="1"/>`),

    wand: s(`<rect x="15" y="8" width="2.4" height="20" fill="#8a5a28"/><circle cx="16.2" cy="7" r="4" fill="#7ec8ff"/>`),
    staff: s(`<rect x="14.5" y="10" width="3" height="19" fill="#6a4018"/><circle cx="16" cy="8" r="5" fill="#3d8a4a"/><circle cx="16" cy="8" r="2.5" fill="#9be37d"/>`),
    crystal: s(`<rect x="15" y="12" width="2.4" height="17" fill="#b8c8e0"/><path d="M16 3 L21 12 H11 Z" fill="#7ec8ff"/><path d="M16 3 L18 12 H14 Z" fill="#d8f0ff"/>`),
    archstaff: s(`<rect x="14.5" y="11" width="3" height="18" fill="#4a2878"/><circle cx="16" cy="8" r="6" fill="#5a3a8a"/><circle cx="16" cy="8" r="3" fill="#c9a0ff"/>`),
    starstaff: s(`<rect x="15" y="12" width="2.4" height="17" fill="#2a1848"/><polygon points="16,2 18,8 24,8 19,12 21,18 16,14 11,18 13,12 8,8 14,8" fill="#ffe27a"/>`),

    cap: s(`<ellipse cx="16" cy="18" rx="10" ry="6" fill="#cbb58a"/><path d="M8 18 Q16 8 24 18" fill="#d8c8a0"/>`),
    lhelm: s(`<path d="M7 18 Q7 8 16 7 Q25 8 25 18 Z" fill="#8a6a40"/><rect x="6" y="17" width="20" height="4" rx="1" fill="#6a4a28"/>`),
    ihelm: s(`<path d="M6 18 Q6 7 16 6 Q26 7 26 18 Z" fill="#a8b0bc"/><rect x="5" y="17" width="22" height="4" fill="#7a8494"/><rect x="14" y="6" width="4" height="6" fill="#c19a4a"/>`),
    dhelm: s(`<path d="M6 19 Q6 7 16 5 Q26 7 26 19 Z" fill="#3a8a48"/><path d="M10 8 L16 2 L22 8" fill="#2a5a30"/><rect x="6" y="18" width="20" height="4" fill="#245c30"/>`),

    cloth: s(`<path d="M10 8 L16 6 L22 8 L24 26 H8 Z" fill="#d0c4a8"/><path d="M10 8 L8 14" stroke="#b8a888" stroke-width="2"/>`),
    leather: s(`<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a5a28"/><path d="M16 8 V24" stroke="#6a4018" stroke-width="1.4"/>`),
    ringmail: s(`<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a949e"/><circle cx="12" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="16" cy="16" r="1.4" fill="#c8d0d8"/><circle cx="20" cy="14" r="1.4" fill="#c8d0d8"/><circle cx="13" cy="20" r="1.4" fill="#c8d0d8"/><circle cx="19" cy="20" r="1.4" fill="#c8d0d8"/>`),
    scale: s(`<path d="M9 7 L16 4 L23 7 L25 27 H7 Z" fill="#4a7a50"/><path d="M10 12 Q16 10 22 12 Q16 16 10 12" fill="#6aaa70"/><path d="M10 18 Q16 16 22 18 Q16 22 10 18" fill="#6aaa70"/>`),
    plate: s(`<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#c0c6d0"/><path d="M16 6 V25" stroke="#8a90a0" stroke-width="2"/><rect x="12" y="12" width="8" height="6" fill="#d8dce4"/>`),
    crystalarm: s(`<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#7ec8ff"/><path d="M16 4 L20 12 H12 Z" fill="#d8f0ff"/><rect x="13" y="14" width="6" height="8" fill="#4aa0e0"/>`),
    elvenchain: s(`<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#3d8a4a"/><path d="M11 12 H21 M11 17 H21 M11 22 H21" stroke="#9be37d" stroke-width="1.3"/>`),
    robe: s(`<path d="M10 7 L16 5 L22 7 L26 28 H6 Z" fill="#5a3a8a"/><path d="M16 5 V28" stroke="#c9a0ff" stroke-width="1.2"/>`),
    archrobe: s(`<path d="M9 6 L16 3 L23 6 L27 29 H5 Z" fill="#3c1868"/><path d="M16 4 V28" stroke="#ffe27a" stroke-width="1.4"/><circle cx="16" cy="12" r="3" fill="#c9a0ff"/>`),

    buckler: s(`<circle cx="16" cy="16" r="11" fill="#8a6a40" stroke="#c19a4a" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="#d4af37"/>`),
    kite: s(`<path d="M16 3 L27 12 L16 29 L5 12 Z" fill="#7a8494" stroke="#c19a4a" stroke-width="1.6"/><path d="M16 8 V22" stroke="#ffe27a" stroke-width="1.4"/>`),
    tower: s(`<rect x="7" y="4" width="18" height="24" rx="2" fill="#5a6270" stroke="#c19a4a" stroke-width="1.6"/><rect x="10" y="8" width="12" height="4" fill="#8a2018"/><rect x="12" y="16" width="8" height="8" fill="#3a4048"/>`),

    cloak1: s(`<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="#6a5428"/>`),
    cloak2: s(`<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="#3a2878"/><circle cx="16" cy="14" r="3" fill="#7ec8ff"/>`),
    gloves1: s(`<path d="M10 18 Q8 10 14 8 L18 8 Q24 10 22 18 L20 26 H12 Z" fill="#8a5a28"/>`),
    gloves2: s(`<path d="M10 18 Q8 10 14 8 L18 8 Q24 10 22 18 L20 26 H12 Z" fill="#8a2018"/><rect x="13" y="12" width="6" height="3" fill="#ffe27a"/>`),
    boots1: s(`<path d="M10 8 H18 V20 L26 24 V28 H8 V14 Z" fill="#6a4018"/>`),
    boots2: s(`<path d="M10 8 H18 V20 L26 24 V28 H8 V14 Z" fill="#3a5a88"/><path d="M18 12 H22" stroke="#7ec8ff" stroke-width="2"/>`),

    amu1: s(`<circle cx="16" cy="6" r="2" fill="#c19a4a"/><path d="M16 8 V16" stroke="#c19a4a" stroke-width="1.6"/><circle cx="16" cy="20" r="6" fill="#e05040"/>`),
    amu2: s(`<circle cx="16" cy="6" r="2" fill="#c19a4a"/><path d="M16 8 V16" stroke="#c19a4a" stroke-width="1.6"/><circle cx="16" cy="20" r="6" fill="#4aa0e0"/>`),
    amu3: s(`<circle cx="16" cy="6" r="2" fill="#ffe27a"/><path d="M16 8 V14" stroke="#ffe27a" stroke-width="1.8"/><polygon points="16,15 21,22 16,28 11,22" fill="#ffd24a"/>`),
    ring_mr: s(`<circle cx="16" cy="16" r="8" fill="none" stroke="#7ec8ff" stroke-width="3.5"/><circle cx="16" cy="9" r="3" fill="#4aa0e0"/>`),
    ring_str: s(`<circle cx="16" cy="16" r="8" fill="none" stroke="#c19a4a" stroke-width="3.5"/><circle cx="16" cy="9" r="3" fill="#e05040"/>`),
    ring_dex: s(`<circle cx="16" cy="16" r="8" fill="none" stroke="#9be37d" stroke-width="3.5"/><circle cx="16" cy="9" r="3" fill="#4aa85a"/>`),
    ring_imm: s(`<circle cx="16" cy="16" r="8" fill="none" stroke="#c9a0ff" stroke-width="3.5"/><circle cx="16" cy="9" r="3.2" fill="#ffe27a"/>`),
    belt1: s(`<rect x="4" y="13" width="24" height="7" rx="2" fill="#8a5a28"/><rect x="13" y="12" width="6" height="9" fill="#c19a4a"/>`),
    belt2: s(`<rect x="4" y="13" width="24" height="7" rx="2" fill="#3a1860"/><rect x="13" y="12" width="6" height="9" fill="#c9a0ff"/>`),

    red: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#c4453c"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#8a2018"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#e07068"/>`),
    orange: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#e08030"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a05018"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#ffb060"/>`),
    clear: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#d8f0ff" opacity=".9" stroke="#7ec8ff" stroke-width="1"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a8d0e8"/>`),
    blue: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#3a7ebd"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#1a4a8a"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#6ab0e8"/>`),
    wisdom: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#5a3a8a"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#2e1a52"/><ellipse cx="16" cy="18" rx="4" ry="3" fill="#c9a0ff"/>`),

    scroll_w: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8d8b0"/><rect x="6" y="8" width="20" height="4" fill="#c19a4a"/><path d="M12 16 L20 16 M14 12 L18 20" stroke="#8a2018" stroke-width="1.6"/>`),
    scroll_a: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8d8b0"/><rect x="6" y="8" width="20" height="4" fill="#4a7a50"/><rect x="13" y="13" width="6" height="8" fill="#3d8a4a"/>`),
    scroll_b: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#fff4c8"/><rect x="6" y="8" width="20" height="4" fill="#ffe27a"/><polygon points="16,12 18,18 16,22 14,18" fill="#d4af37"/>`),
    scroll_poly: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#e8dcc8"/><rect x="6" y="8" width="20" height="4" fill="#9be37d"/><ellipse cx="16" cy="18" rx="5" ry="4" fill="#5ca048"/><circle cx="14" cy="17" r="1" fill="#1a3010"/><circle cx="18" cy="17" r="1" fill="#1a3010"/>`),
    scroll_poly2: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#d8e8f8"/><rect x="6" y="8" width="20" height="4" fill="#7ec8ff"/><path d="M10 22 Q16 12 22 22" fill="#687078"/><circle cx="13" cy="17" r="1.5" fill="#ff4040"/><circle cx="19" cy="17" r="1.5" fill="#ff4040"/>`),
    scroll_poly3: s(`<rect x="6" y="8" width="20" height="16" rx="2" fill="#f0e0ff"/><rect x="6" y="8" width="20" height="4" fill="#c9a0ff"/><path d="M16 12 L20 22 L12 22 Z" fill="#889098"/><circle cx="14" cy="18" r="1.5" fill="#ff4040"/><circle cx="18" cy="18" r="1.5" fill="#ff4040"/>`),

    hide: s(`<path d="M8 10 Q16 4 24 10 Q26 18 22 24 Q16 20 10 24 Q6 18 8 10" fill="#a07040"/>`),
    hide2: s(`<path d="M8 10 Q16 4 24 10 Q26 18 22 24 Q16 20 10 24 Q6 18 8 10" fill="#6a3818"/><path d="M12 12 Q16 8 20 12 Q18 18 16 20 Q14 18 12 12" fill="#c19a4a"/>`),
    bone: s(`<rect x="8" y="14" width="16" height="4" rx="2" fill="#e8dcc8"/><circle cx="7" cy="13" r="3.2" fill="#e8dcc8"/><circle cx="7" cy="19" r="3.2" fill="#e8dcc8"/><circle cx="25" cy="13" r="3.2" fill="#e8dcc8"/><circle cx="25" cy="19" r="3.2" fill="#e8dcc8"/>`),
    ore: s(`<path d="M8 20 L12 8 L20 10 L24 20 L16 26 Z" fill="#6a7080"/><path d="M12 8 L16 16 L20 10" fill="#a8b0bc"/>`),
    ingot: s(`<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#b8c0cc"/><path d="M8 14 H24 V20 H8 Z" fill="#8a949e"/>`),
    steel: s(`<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#7a8494"/><path d="M8 14 H24 V20 H8 Z" fill="#4a5460"/>`),
    mithril: s(`<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#c8e8f4"/><path d="M8 14 H24 V20 H8 Z" fill="#7ec8ff"/>`),
    gem: s(`<polygon points="16,4 24,12 16,28 8,12" fill="#7ec8ff"/><polygon points="16,4 20,12 16,18 12,12" fill="#d8f0ff"/>`),
    scale_mat: s(`<path d="M8 18 Q16 6 24 18 Q16 26 8 18" fill="#3d8a4a"/><path d="M12 16 Q16 10 20 16 Q16 20 12 16" fill="#9be37d"/>`),
    osword: s(`<path d="M16 3 L18.2 17 H13.8 Z" fill="#c0b090"/><rect x="12" y="17" width="8" height="2.4" fill="#6a4018"/><rect x="14.5" y="19" width="3" height="8" fill="#4a2810"/>`),
    lsword: s(`<path d="M16 2 L19.2 18 H12.8 Z" fill="#c8d0dc"/><rect x="11" y="18" width="10" height="2.4" fill="#a07830"/><rect x="14.2" y="20" width="3.6" height="8" fill="#4a3018"/>`),
    axe: s(`<rect x="14.5" y="6" width="3" height="22" fill="#6a4018"/><path d="M17 8 L28 12 L17 18 Z" fill="#a8b0bc"/><path d="M15 8 L4 14 L15 16 Z" fill="#8a949e"/>`),
    spear: s(`<rect x="15" y="8" width="2.2" height="21" fill="#8a5a28"/><path d="M16 2 L19 10 H13 Z" fill="#c8d0dc"/>`),
    ohelm: s(`<path d="M7 18 Q7 8 16 7 Q25 8 25 18 Z" fill="#8a6a40"/><rect x="6" y="17" width="20" height="4" rx="1" fill="#5a3a18"/><rect x="12" y="12" width="8" height="3" fill="#c19a4a"/>`),
    oring: s(`<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a6a40"/><circle cx="12" cy="14" r="1.4" fill="#c19a4a"/><circle cx="16" cy="16" r="1.4" fill="#c19a4a"/><circle cx="20" cy="14" r="1.4" fill="#c19a4a"/>`),

    odagger: s(`<path d="M16 3 L18 16 H14 Z" fill="#c0b090"/><rect x="13" y="16" width="6" height="2" fill="#6a4018"/><rect x="14.5" y="18" width="3" height="9" fill="#4a2810"/>`),
    obow: s(`<path d="M9 6 Q7 16 9 26 Q16 16 9 6" fill="none" stroke="#8a6a40" stroke-width="2.2"/><line x1="10" y1="8" x2="10" y2="24" stroke="#d8c8a0" stroke-width="1"/><rect x="8" y="14" width="4" height="2" fill="#c19a4a"/>`),
    ochain: s(`<path d="M9 8 L16 5 L23 8 L25 27 H7 Z" fill="#8a6a40"/><path d="M11 12 H21 M11 17 H21 M11 22 H21" stroke="#c19a4a" stroke-width="1.2"/>`),
    bronze: s(`<path d="M8 8 L16 4 L24 8 L26 27 H6 Z" fill="#8a7a50"/><path d="M16 6 V25" stroke="#6a5a38" stroke-width="2"/><rect x="12" y="12" width="8" height="6" fill="#a09060"/>`),
    ocloak: s(`<path d="M8 8 Q16 4 24 8 L26 26 Q16 22 6 26 Z" fill="#8a6a40"/><path d="M16 8 V24" stroke="#6a4a28" stroke-width="1.2"/>`),
    rough_mith: s(`<path d="M6 14 L10 10 H22 L26 14 V22 H6 Z" fill="#98b8c8"/><path d="M8 14 H24 V20 H8 Z" fill="#6a8898" opacity=".7"/>`),
    gem_r: s(`<polygon points="16,4 24,12 16,28 8,12" fill="#e05040"/><polygon points="16,4 20,12 16,18 12,12" fill="#ff9080"/>`),
    gem_g: s(`<polygon points="16,4 24,12 16,28 8,12" fill="#48a858"/><polygon points="16,4 20,12 16,18 12,12" fill="#9be37d"/>`),
    haste_pot: s(`<path d="M12 8 H20 V12 Q24 14 24 22 Q24 28 16 28 Q8 28 8 22 Q8 14 12 12 Z" fill="#e08030"/><rect x="13" y="4" width="6" height="5" rx="1" fill="#a05018"/><path d="M14 16 L18 22 L14 24" stroke="#ffe040" stroke-width="1.5" fill="none"/>`),
    candle: s(`<rect x="14" y="10" width="4" height="16" rx="1" fill="#e8dcc8"/><ellipse cx="16" cy="8" rx="3" ry="4" fill="#ffe27a" opacity=".85"/><rect x="15" y="4" width="2" height="4" fill="#404040"/>`),
  };

  const raw = rawInner;

  const map = {};
  for (const [id, svg] of Object.entries(raw)) map[id] = svg;

  function innerOf(svg) {
    if (!svg) return null;
    const i = svg.indexOf('opacity=".35"/>');
    if (i < 0) return null;
    const j = svg.lastIndexOf("</svg>");
    return svg.slice(i + 14, j).trim();
  }
  const inners = {};
  for (const [id, svg] of Object.entries(raw)) {
    const inner = innerOf(svg);
    if (inner) inners[id] = inner;
  }

  function fallback(d) {
    const rarity = (d && d.rarity) || "common";
    return s(`<rect x="10" y="10" width="12" height="12" rx="2" fill="#3a2e20"/>`, rarity);
  }

  function of(id, def) {
    const rarity = (def && def.rarity) || "common";
    if (inners[id]) return s(inners[id], rarity, id);
    return fallback(def);
  }

  return { of, map, RARITY };
})();