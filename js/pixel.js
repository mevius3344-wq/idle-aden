/* 原創天堂風 Q 版：側向大頭、經典職業／魔物剪影。非官方圖檔。 */
window.PIXEL = (() => {
  const hs = (inner) =>
    `<svg viewBox="0 0 96 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const ms = (inner) =>
    `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  const ground = (cx = 48) =>
    `<ellipse cx="${cx}" cy="106" rx="22" ry="5" fill="rgba(0,0,0,.38)"/>`;
  const mGround = `<ellipse cx="40" cy="74" rx="20" ry="4.2" fill="rgba(0,0,0,.36)"/>`;

  function qFace(cx, cy, skin, eye, blush = true) {
    return `
      <circle cx="${cx}" cy="${cy}" r="20" fill="${skin}"/>
      <ellipse cx="${cx - 7}" cy="${cy - 1}" rx="3.6" ry="4.6" fill="${eye}"/>
      <ellipse cx="${cx + 7}" cy="${cy - 1}" rx="3.6" ry="4.6" fill="${eye}"/>
      <circle cx="${cx - 8}" cy="${cy - 2.4}" r="1.3" fill="#fff"/>
      <circle cx="${cx + 6}" cy="${cy - 2.4}" r="1.3" fill="#fff"/>
      ${blush ? `<ellipse cx="${cx - 12}" cy="${cy + 7}" rx="3" ry="1.6" fill="#f2a090" opacity=".5"/>
      <ellipse cx="${cx + 12}" cy="${cy + 7}" rx="3" ry="1.6" fill="#f2a090" opacity=".5"/>` : ""}
      <path d="M${cx - 3} ${cy + 8} Q${cx} ${cy + 11} ${cx + 3} ${cy + 8}" fill="none" stroke="#c07060" stroke-width="1.15" stroke-linecap="round"/>`;
  }

  const heroes = {
    knight_m: hs(`${ground()}
      <path d="M10 78 Q28 52 36 70 L32 96 Q20 90 12 96 Z" fill="#7a1818"/>
      <path d="M14 80 Q28 58 34 74 L30 94 Q20 88 14 94 Z" fill="#a02828"/>
      <rect x="36" y="90" width="8" height="14" rx="3" fill="#6a7484"/>
      <rect x="48" y="90" width="8" height="14" rx="3" fill="#6a7484"/>
      <ellipse cx="46" cy="82" rx="14" ry="12" fill="#c8d0dc"/>
      <path d="M34 78 H58 L56 88 H36 Z" fill="#d4af37"/>
      <circle cx="46" cy="50" r="21" fill="#f0c8a0"/>
      <path d="M26 48 Q46 12 66 48 L64 38 Q46 22 28 38 Z" fill="#d8dee8"/>
      <path d="M28 46 Q46 18 64 46" fill="none" stroke="#9aa4b4" stroke-width="2"/>
      <rect x="32" y="46" width="28" height="6" rx="1.5" fill="#1a1410"/>
      <rect x="42" y="16" width="8" height="10" rx="1" fill="#d4af37"/>
      ${qFace(46, 54, "#f0c8a0", "#1a120c")}
      <rect x="32" y="46" width="28" height="6" rx="1.5" fill="#1a1410" opacity=".35"/>
      <rect x="68" y="44" width="7" height="48" rx="2" fill="#c8d0dc"/>
      <rect x="64" y="42" width="15" height="6" rx="1" fill="#d4af37"/>
      <path d="M70 44 L76 18 L80 44 Z" fill="#eef2f8"/>`),

    knight_f: hs(`${ground()}
      <path d="M12 78 Q30 54 38 72 L34 96 Q22 90 14 96 Z" fill="#7a1818"/>
      <path d="M16 80 Q30 60 36 74 L32 94 Q22 88 16 94 Z" fill="#a02828"/>
      <rect x="36" y="90" width="8" height="14" rx="3" fill="#6a7484"/>
      <rect x="48" y="90" width="8" height="14" rx="3" fill="#6a7484"/>
      <ellipse cx="46" cy="82" rx="13" ry="11" fill="#c8d0dc"/>
      <path d="M35 78 H57 L55 86 H37 Z" fill="#d4af37"/>
      <path d="M24 58 Q28 96 40 98 Q46 80 56 98 Q66 96 70 58 Z" fill="#5a3828"/>
      <circle cx="46" cy="50" r="20" fill="#f0c8a0"/>
      <path d="M28 46 Q46 16 64 46 L62 36 Q46 24 30 36 Z" fill="#d8dee8"/>
      ${qFace(46, 53, "#f0c8a0", "#1a120c")}
      <rect x="68" y="46" width="6" height="44" rx="2" fill="#c8d0dc"/>
      <rect x="64" y="44" width="14" height="5" rx="1" fill="#d4af37"/>`),

    elf_m: hs(`${ground()}
      <path d="M18 76 Q40 54 50 72 L46 96 Q32 90 20 96 Z" fill="#1e4a28"/>
      <rect x="36" y="90" width="7" height="14" rx="3" fill="#2a4a28"/>
      <rect x="48" y="90" width="7" height="14" rx="3" fill="#2a4a28"/>
      <ellipse cx="46" cy="82" rx="12" ry="11" fill="#3d8a4a"/>
      <path d="M18 42 L28 18 L32 48 Z" fill="#e8d070"/>
      <circle cx="46" cy="50" r="19" fill="#f0c8a0"/>
      <path d="M28 34 Q46 12 62 34 Q60 24 46 18 Q32 24 28 34 Z" fill="#e8d070"/>
      ${qFace(46, 52, "#f0c8a0", "#1a120c")}
      <path d="M64 48 Q82 28 86 70 Q74 62 64 72 Z" fill="none" stroke="#6a4018" stroke-width="2.8"/>
      <line x1="66" y1="40" x2="66" y2="76" stroke="#f4ead0" stroke-width="1.3"/>
      <path d="M66 52 L84 48" stroke="#c8d0dc" stroke-width="1.4"/>`),

    elf_f: hs(`${ground()}
      <path d="M18 76 Q40 54 50 72 L46 98 Q32 92 20 98 Z" fill="#1e4a28"/>
      <rect x="36" y="90" width="7" height="14" rx="3" fill="#2a4a28"/>
      <rect x="48" y="90" width="7" height="14" rx="3" fill="#2a4a28"/>
      <ellipse cx="46" cy="82" rx="12" ry="11" fill="#3d8a4a"/>
      <path d="M18 40 L28 16 L32 50 Z" fill="#8fd98a"/>
      <path d="M26 56 Q30 100 42 100 Q48 78 58 100 Q68 100 70 56 Z" fill="#8fd98a"/>
      <circle cx="46" cy="50" r="19" fill="#f0c8a0"/>
      <path d="M28 32 Q46 10 62 32 Q60 22 46 16 Q32 22 28 32 Z" fill="#8fd98a"/>
      ${qFace(46, 52, "#f0c8a0", "#1a120c")}
      <path d="M64 48 Q82 28 86 70 Q74 62 64 72 Z" fill="none" stroke="#6a4018" stroke-width="2.8"/>`),

    mage_m: hs(`${ground()}
      <path d="M16 74 Q44 52 58 74 L56 100 Q36 94 18 100 Z" fill="#3c1868"/>
      <rect x="36" y="90" width="7" height="14" rx="3" fill="#2a1848"/>
      <rect x="48" y="90" width="7" height="14" rx="3" fill="#2a1848"/>
      <ellipse cx="46" cy="82" rx="13" ry="11" fill="#6a40a8"/>
      <path d="M34 78 H58" stroke="#d4af37" stroke-width="2"/>
      <circle cx="46" cy="54" r="18" fill="#f0c8a0"/>
      <path d="M12 48 L46 4 L80 48 Z" fill="#4a2080"/>
      <path d="M18 48 L46 12 L74 48 Z" fill="#6a38b0"/>
      <ellipse cx="46" cy="48" rx="32" ry="7" fill="#2e1458"/>
      <rect x="18" y="46" width="56" height="4" fill="#d4af37"/>
      <circle cx="46" cy="8" r="4.5" fill="#ffe27a"/>
      ${qFace(46, 56, "#f0c8a0", "#1a120c")}
      <rect x="70" y="50" width="5" height="44" rx="2" fill="#6a4018"/>
      <circle cx="72.5" cy="46" r="8" fill="#7ec8ff"/>
      <circle cx="72.5" cy="46" r="4" fill="#fff" opacity=".7"/>`),

    mage_f: hs(`${ground()}
      <path d="M16 74 Q44 52 58 74 L56 100 Q36 94 18 100 Z" fill="#3c1868"/>
      <rect x="36" y="90" width="7" height="14" rx="3" fill="#2a1848"/>
      <rect x="48" y="90" width="7" height="14" rx="3" fill="#2a1848"/>
      <ellipse cx="46" cy="82" rx="12" ry="11" fill="#6a40a8"/>
      <path d="M26 58 Q30 100 42 100 Q48 80 58 100 Q68 100 70 58 Z" fill="#2c1848"/>
      <circle cx="46" cy="54" r="18" fill="#f0c8a0"/>
      <path d="M14 48 L46 6 L78 48 Z" fill="#4a2080"/>
      <ellipse cx="46" cy="48" rx="30" ry="7" fill="#2e1458"/>
      <rect x="20" y="46" width="52" height="4" fill="#d4af37"/>
      <circle cx="46" cy="10" r="4.5" fill="#ffe27a"/>
      ${qFace(46, 56, "#f0c8a0", "#1a120c")}
      <rect x="70" y="50" width="5" height="44" rx="2" fill="#6a4018"/>
      <circle cx="72.5" cy="46" r="8" fill="#c9a0ff"/>`),
  };

  function mFace(cx, cy, skin, eye, r = 16) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}"/>
      <ellipse cx="${cx - 5}" cy="${cy - 1}" rx="3" ry="3.8" fill="${eye}"/>
      <ellipse cx="${cx + 5}" cy="${cy - 1}" rx="3" ry="3.8" fill="${eye}"/>
      <circle cx="${cx - 6}" cy="${cy - 2}" r="1" fill="#fff"/>
      <circle cx="${cx + 4}" cy="${cy - 2}" r="1" fill="#fff"/>`;
  }

  const mobs = {
    rabbit: ms(`${mGround}
      <ellipse cx="38" cy="58" rx="12" ry="8" fill="#e8d4c0"/>
      <ellipse cx="28" cy="28" rx="4" ry="16" fill="#e8d4c0"/><ellipse cx="46" cy="26" rx="4" ry="15" fill="#e8d4c0"/>
      <ellipse cx="28" cy="28" rx="2" ry="10" fill="#f4b8b0"/><ellipse cx="46" cy="26" rx="2" ry="9" fill="#f4b8b0"/>
      ${mFace(40, 46, "#f0e0d0", "#1a1008", 14)}
      <ellipse cx="40" cy="52" rx="3" ry="2" fill="#f0a090"/>`),

    fox: ms(`${mGround}
      <path d="M58 52 Q72 40 74 28" stroke="#e07830" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="36" cy="56" rx="14" ry="9" fill="#e07830"/>
      <path d="M18 36 L24 14 L32 38 Z" fill="#e07830"/><path d="M40 38 L48 14 L54 36 Z" fill="#e07830"/>
      ${mFace(36, 42, "#f08840", "#1a1008", 14)}`),

    goblin: ms(`${mGround}
      <rect x="28" y="58" width="7" height="12" rx="3" fill="#3a7028"/>
      <rect x="40" y="58" width="7" height="12" rx="3" fill="#3a7028"/>
      <ellipse cx="38" cy="56" rx="11" ry="8" fill="#4a8a38"/>
      <path d="M16 38 L10 18 L26 36 Z" fill="#5ca048"/><path d="M54 38 L62 18 L46 36 Z" fill="#5ca048"/>
      ${mFace(38, 40, "#68b050", "#ffe040", 15)}
      <ellipse cx="38" cy="48" rx="5" ry="2.5" fill="#2a5820"/>
      <rect x="52" y="42" width="4" height="20" rx="1" fill="#6a5030"/>`),

    orc: ms(`${mGround}
      <rect x="26" y="58" width="8" height="12" rx="3" fill="#6a4830"/>
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#6a4830"/>
      <ellipse cx="38" cy="56" rx="13" ry="9" fill="#8a6040"/>
      <path d="M16 34 L10 14 L26 32 Z" fill="#8a6040"/><path d="M54 34 L62 14 L46 32 Z" fill="#8a6040"/>
      ${mFace(38, 36, "#a07050", "#ff3020", 16)}
      <rect x="28" y="44" width="20" height="4" rx="2" fill="#f0d0a0"/>
      <path d="M54 38 L70 28 L66 48 Z" fill="#a0a8b0"/>
      <rect x="56" y="40" width="5" height="22" fill="#5a4028"/>`),

    dwarf: ms(`${mGround}
      <rect x="28" y="58" width="8" height="12" rx="3" fill="#506070"/>
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#506070"/>
      <ellipse cx="38" cy="56" rx="13" ry="8" fill="#607080"/>
      ${mFace(38, 38, "#f0c8a0", "#1a1008", 15)}
      <path d="M22 40 Q38 56 54 40 Q54 58 38 62 Q22 58 22 40 Z" fill="#8a5030"/>
      <rect x="20" y="24" width="36" height="10" rx="4" fill="#8090a0"/>
      <rect x="54" y="40" width="5" height="20" fill="#6a5030"/>`),

    slime: ms(`${mGround}
      <ellipse cx="40" cy="50" rx="20" ry="16" fill="#68c878"/>
      <ellipse cx="40" cy="48" rx="16" ry="13" fill="#88e098" opacity=".85"/>
      ${mFace(40, 46, "transparent", "#1a4020", 0)}
      <ellipse cx="34" cy="44" rx="3.2" ry="4" fill="#1a4020"/><ellipse cx="46" cy="44" rx="3.2" ry="4" fill="#1a4020"/>
      <circle cx="33" cy="43" r="1" fill="#fff"/><circle cx="45" cy="43" r="1" fill="#fff"/>
      <ellipse cx="32" cy="38" rx="5" ry="3" fill="#fff" opacity=".4"/>`),

    boar: ms(`${mGround}
      <ellipse cx="38" cy="54" rx="16" ry="10" fill="#8a6040"/>
      ${mFace(36, 42, "#a07050", "#1a1008", 13)}
      <path d="M20 44 L10 48 L20 52 Z" fill="#f0d0b0"/><path d="M50 44 L60 48 L50 52 Z" fill="#f0d0b0"/>
      <path d="M22 32 L16 24" stroke="#8a6040" stroke-width="3" stroke-linecap="round"/>
      <path d="M48 32 L54 24" stroke="#8a6040" stroke-width="3" stroke-linecap="round"/>`),

    wolf: ms(`${mGround}
      <path d="M56 52 Q70 40 74 26" stroke="#687078" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="36" cy="56" rx="15" ry="9" fill="#687078"/>
      <path d="M18 34 L12 14 L30 34 Z" fill="#8090a0"/><path d="M42 34 L50 14 L54 34 Z" fill="#8090a0"/>
      ${mFace(36, 40, "#8090a0", "#ffe040", 14)}`),

    floating: ms(`${mGround}
      <circle cx="40" cy="40" r="22" fill="#8040a0" opacity=".55"/>
      <circle cx="40" cy="40" r="18" fill="#a060c0"/>
      <circle cx="40" cy="40" r="10" fill="#1a0820"/>
      <circle cx="40" cy="40" r="6" fill="#ff4040"/>
      <circle cx="36" cy="36" r="2.2" fill="#fff" opacity=".7"/>`),

    mushroom: ms(`${mGround}
      <rect x="32" y="48" width="16" height="18" rx="5" fill="#f0e4d0"/>
      <ellipse cx="40" cy="40" rx="20" ry="14" fill="#c04040"/>
      <circle cx="30" cy="36" r="3.2" fill="#fff" opacity=".75"/>
      <circle cx="48" cy="32" r="2.6" fill="#fff" opacity=".75"/>
      <ellipse cx="34" cy="54" rx="2.4" ry="3" fill="#1a1008"/><ellipse cx="46" cy="54" rx="2.4" ry="3" fill="#1a1008"/>`),

    skeleton: ms(`${mGround}
      <rect x="30" y="58" width="6" height="12" rx="2" fill="#efe8d8"/>
      <rect x="42" y="58" width="6" height="12" rx="2" fill="#efe8d8"/>
      <rect x="28" y="46" width="24" height="14" rx="3" fill="#efe8d8"/>
      <line x1="40" y1="46" x2="40" y2="60" stroke="#c8c0b0" stroke-width="2"/>
      ${mFace(40, 32, "#f4eee0", "#1a1008", 14)}
      <rect x="54" y="36" width="4" height="24" fill="#efe8d8"/>
      <path d="M56 34 L66 28 L64 40 Z" fill="#c8d0dc"/>`),

    golem: ms(`${mGround}
      <rect x="22" y="24" width="36" height="36" rx="8" fill="#889098"/>
      <rect x="26" y="28" width="28" height="10" rx="3" fill="#a8b0b8"/>
      <ellipse cx="34" cy="33" rx="3" ry="3.5" fill="#ffe040"/><ellipse cx="46" cy="33" rx="3" ry="3.5" fill="#ffe040"/>
      <rect x="24" y="58" width="12" height="10" rx="3" fill="#687078"/>
      <rect x="44" y="58" width="12" height="10" rx="3" fill="#687078"/>`),

    arachne: ms(`${mGround}
      <ellipse cx="40" cy="48" rx="14" ry="10" fill="#403030"/>
      ${mFace(40, 32, "#504040", "#ff3030", 12)}
      <path d="M16 42 L28 48 M12 52 L28 52 M16 62 L28 56" stroke="#403030" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M64 42 L52 48 M68 52 L52 52 M64 62 L52 56" stroke="#403030" stroke-width="3.2" stroke-linecap="round"/>`),

    zombie: ms(`${mGround}
      <rect x="28" y="58" width="7" height="12" rx="3" fill="#4a6850"/>
      <rect x="40" y="58" width="7" height="12" rx="3" fill="#4a6850"/>
      <ellipse cx="38" cy="56" rx="11" ry="8" fill="#5a7860"/>
      ${mFace(38, 38, "#6a8870", "#1a1008", 15)}
      <path d="M28 46 L48 46" stroke="#3a4838" stroke-width="2"/>`),

    bear: ms(`${mGround}
      <ellipse cx="40" cy="52" rx="18" ry="12" fill="#705030"/>
      <circle cx="24" cy="30" r="7" fill="#705030"/><circle cx="52" cy="30" r="7" fill="#705030"/>
      ${mFace(40, 40, "#8a6840", "#1a1008", 15)}
      <ellipse cx="40" cy="48" rx="5" ry="3.5" fill="#403020"/>`),

    ghoul: ms(`${mGround}
      <rect x="28" y="58" width="7" height="12" rx="3" fill="#3a4840"/>
      <rect x="40" y="58" width="7" height="12" rx="3" fill="#3a4840"/>
      <ellipse cx="38" cy="56" rx="11" ry="8" fill="#4a5850"/>
      ${mFace(38, 38, "#5a6860", "#80ff80", 15)}`),

    ant: ms(`${mGround}
      <ellipse cx="40" cy="50" rx="13" ry="9" fill="#403028"/>
      ${mFace(40, 36, "#503830", "#1a1008", 10)}
      <path d="M24 46 L10 38 M24 52 L8 54 M24 58 L12 64" stroke="#503830" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M56 46 L70 38 M56 52 L72 54 M56 58 L68 64" stroke="#503830" stroke-width="2.6" stroke-linecap="round"/>`),

    scorpion: ms(`${mGround}
      <ellipse cx="38" cy="48" rx="14" ry="9" fill="#806030"/>
      ${mFace(36, 38, "#907040", "#ff2020", 11)}
      <path d="M20 52 Q8 58 6 66" stroke="#806030" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M54 42 L70 22" stroke="#806030" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="70" cy="20" r="4" fill="#c04040"/>`),

    lizard: ms(`${mGround}
      <rect x="28" y="58" width="7" height="12" rx="3" fill="#3a6848"/>
      <rect x="40" y="58" width="7" height="12" rx="3" fill="#3a6848"/>
      <ellipse cx="38" cy="56" rx="12" ry="8" fill="#4a8860"/>
      ${mFace(38, 38, "#5aa070", "#ffe040", 14)}
      <path d="M52 46 Q68 36 70 24" stroke="#4a8860" stroke-width="6" fill="none" stroke-linecap="round"/>
      <rect x="52" y="40" width="4" height="18" fill="#6a5030" transform="rotate(18 54 40)"/>`),

    bugbear: ms(`${mGround}
      <rect x="26" y="58" width="8" height="12" rx="3" fill="#506040"/>
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#506040"/>
      <ellipse cx="38" cy="56" rx="14" ry="9" fill="#608050"/>
      ${mFace(38, 36, "#70a060", "#ff3020", 16)}
      <path d="M54 34 L70 24 L66 44 Z" fill="#808890"/>`),

    hellhound: ms(`${mGround}
      <path d="M56 52 Q70 40 72 26" stroke="#602820" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="36" cy="56" rx="15" ry="9" fill="#602820"/>
      ${mFace(36, 40, "#803830", "#ff6020", 14)}
      <ellipse cx="36" cy="26" rx="8" ry="5" fill="#ff8040" opacity=".6"/>`),

    ogre: ms(`${mGround}
      <rect x="24" y="58" width="9" height="12" rx="3" fill="#506838"/>
      <rect x="42" y="58" width="9" height="12" rx="3" fill="#506838"/>
      <ellipse cx="38" cy="56" rx="16" ry="10" fill="#608848"/>
      ${mFace(38, 34, "#70a058", "#ffe040", 17)}
      <rect x="56" y="34" width="6" height="28" rx="2" fill="#4a3820"/>`),

    darkelf: ms(`${mGround}
      <rect x="30" y="58" width="6" height="12" rx="3" fill="#1a2038"/>
      <rect x="42" y="58" width="6" height="12" rx="3" fill="#1a2038"/>
      <ellipse cx="40" cy="56" rx="10" ry="9" fill="#283048"/>
      <path d="M20 32 L14 12 L28 30 Z" fill="#384858"/><path d="M56 32 L64 12 L48 30 Z" fill="#384858"/>
      ${mFace(40, 38, "#485868", "#c0a0ff", 13)}
      <path d="M54 40 Q68 32 72 24" stroke="#384858" stroke-width="3" fill="none" stroke-linecap="round"/>`),

    succubus: ms(`${mGround}
      <rect x="30" y="58" width="6" height="12" rx="3" fill="#482838"/>
      <rect x="42" y="58" width="6" height="12" rx="3" fill="#482838"/>
      <ellipse cx="40" cy="56" rx="11" ry="10" fill="#683848"/>
      <path d="M16 28 L10 8 L28 26 Z" fill="#683848"/><path d="M64 28 L70 8 L52 26 Z" fill="#683848"/>
      ${mFace(40, 36, "#884858", "#ff4060", 14)}
      <path d="M18 14 Q40 4 62 14" stroke="#804060" stroke-width="3" fill="none"/>`),

    drake: ms(`${mGround}
      <ellipse cx="38" cy="54" rx="16" ry="10" fill="#286040"/>
      ${mFace(36, 40, "#388050", "#ffe040", 14)}
      <path d="M50 36 L70 20 L64 44 Z" fill="#388050"/>
      <path d="M16 40 Q6 28 12 16" stroke="#388050" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M48 40 Q62 28 58 16" stroke="#388050" stroke-width="5" fill="none" stroke-linecap="round"/>`),

    gargoyle: ms(`${mGround}
      <path d="M22 66 L40 18 L58 66 Z" fill="#889098"/>
      <path d="M28 66 L40 28 L52 66 Z" fill="#a8b0b8"/>
      <ellipse cx="34" cy="40" rx="3.2" ry="4" fill="#ff4040"/><ellipse cx="46" cy="40" rx="3.2" ry="4" fill="#ff4040"/>
      <path d="M16 42 L6 28 L20 38 Z" fill="#889098"/><path d="M64 42 L74 28 L60 38 Z" fill="#889098"/>`),

    deathk: ms(`${mGround}
      <rect x="26" y="58" width="8" height="12" rx="3" fill="#121018"/>
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#121018"/>
      <ellipse cx="38" cy="56" rx="13" ry="10" fill="#1a1820"/>
      ${mFace(38, 32, "#2a2830", "#ff4040", 15)}
      <rect x="54" y="30" width="5" height="30" fill="#1a1820"/>
      <path d="M56 26 L70 18 L66 36 Z" fill="#808890"/>`),

    ant_queen: ms(`${mGround}
      <ellipse cx="40" cy="52" rx="18" ry="12" fill="#503028"/>
      ${mFace(40, 34, "#604038", "#ffd040", 14)}
      <ellipse cx="40" cy="20" rx="10" ry="6" fill="#806040"/>
      <path d="M14 46 L26 40 M10 56 L26 52" stroke="#503028" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M66 46 L54 40 M70 56 L54 52" stroke="#503028" stroke-width="3.2" stroke-linecap="round"/>`),

    succubus_q: ms(`${mGround}
      <rect x="26" y="58" width="8" height="12" rx="3" fill="#381828"/>
      <rect x="42" y="58" width="8" height="12" rx="3" fill="#381828"/>
      <ellipse cx="40" cy="56" rx="15" ry="12" fill="#582838"/>
      <path d="M14 22 L8 2 L28 22 Z" fill="#582838"/><path d="M66 22 L72 2 L52 22 Z" fill="#582838"/>
      ${mFace(40, 34, "#783848", "#ff3060", 16)}
      <path d="M16 10 Q40 0 64 10" stroke="#ffd040" stroke-width="3" fill="none"/>`),

    demon: ms(`${mGround}
      <rect x="26" y="58" width="8" height="12" rx="3" fill="#501010"/>
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#501010"/>
      <ellipse cx="38" cy="56" rx="13" ry="10" fill="#802020"/>
      <path d="M16 28 L10 8 L28 26 Z" fill="#802020"/><path d="M56 28 L64 8 L46 26 Z" fill="#802020"/>
      ${mFace(38, 36, "#a03030", "#ff4040", 16)}`),
  };

  const mobAlias = {
    kobold: "goblin", hobgob: "goblin", orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf", dw_f: "dwarf", skel_a: "skeleton",
    sparto: "skeleton", ant_s: "ant", yangol: "scorpion", balrog: "demon", ancient: "drake",
    harpy: "succubus", medusa: "arachne", unicorn: "rabbit", iron_golem: "golem",
    lich: "skeleton", guardian: "golem", baphomet: "succubus_q", black_elder: "darkelf",
    lindvior: "drake", fafurion: "drake", antharas: "drake", valakas: "hellhound",
  };

  function hero(cls, gender) {
    const g = gender === "f" ? "f" : "m";
    return heroes[`${cls || "knight"}_${g}`] || heroes.knight_m;
  }
  function mob(id) {
    return mobs[mobAlias[id] || id] || mobs.orc;
  }
  return { hero, mob };
})();
