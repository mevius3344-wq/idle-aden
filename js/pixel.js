/* 原創側向戰鬥圖：武俠江湖剪影與配色。 */
window.PIXEL = (() => {
  const hs = (inner) =>
    `<svg viewBox="0 0 90 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const ms = (inner) =>
    `<svg viewBox="0 0 80 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const gnd = `<ellipse cx="48" cy="106" rx="20" ry="4.5" fill="rgba(0,0,0,.4)"/>`;
  const mg = `<ellipse cx="42" cy="67" rx="18" ry="3.8" fill="rgba(0,0,0,.38)"/>`;

  const heroes = {
    knight_m: hs(`${gnd}
      <path d="M8 78 Q24 50 34 68 L28 100 Q16 92 10 100 Z" fill="#5a1010"/>
      <path d="M12 76 Q26 54 34 70 L30 96 Q18 90 12 96 Z" fill="#8a1818"/>
      <path d="M38 92 L44 104 L50 104 L46 92 Z" fill="#5a6474"/>
      <path d="M50 92 L54 104 L60 104 L58 92 Z" fill="#6a7484"/>
      <path d="M36 70 L62 68 L60 92 L38 94 Z" fill="#b8c0cc"/>
      <path d="M40 70 L58 69 L57 80 L41 81 Z" fill="#d4dce6"/>
      <rect x="40" y="82" width="18" height="4" fill="#c19a4a"/>
      <path d="M28 48 Q46 22 64 50 L62 42 Q46 30 32 42 Z" fill="#c8d0dc"/>
      <ellipse cx="48" cy="52" rx="14" ry="13" fill="#9aa4b4"/>
      <rect x="38" y="50" width="20" height="5" rx="1" fill="#1a120c"/>
      <rect x="44" y="28" width="8" height="8" fill="#c19a4a"/>
      <rect x="66" y="46" width="6" height="42" rx="1" fill="#c8d0dc"/>
      <rect x="62" y="44" width="14" height="5" fill="#c19a4a"/>
      <path d="M68 44 L74 12 L80 44 Z" fill="#e8eef4" stroke="#8a90a0" stroke-width=".6"/>`),

    knight_f: hs(`${gnd}
      <path d="M10 78 Q26 52 36 70 L30 100 Q18 92 12 100 Z" fill="#8a1818"/>
      <path d="M38 92 L44 104 L50 104 L46 92 Z" fill="#5a6474"/>
      <path d="M50 92 L54 104 L60 104 L58 92 Z" fill="#6a7484"/>
      <path d="M36 72 L60 70 L58 92 L38 94 Z" fill="#b8c0cc"/>
      <rect x="40" y="82" width="16" height="3" fill="#c19a4a"/>
      <path d="M30 58 Q34 96 44 98 Q50 78 60 98 Q68 96 70 58 Z" fill="#4a3018"/>
      <path d="M32 48 Q46 24 62 50 L60 42 Q46 32 34 42 Z" fill="#c8d0dc"/>
      <ellipse cx="48" cy="52" rx="13" ry="12" fill="#f0c8a0"/>
      <circle cx="50" cy="52" r="1.6" fill="#1a120c"/>
      <rect x="66" y="48" width="5" height="40" rx="1" fill="#c8d0dc"/>
      <rect x="62" y="46" width="13" height="4" fill="#c19a4a"/>`),

    elf_m: hs(`${gnd}
      <path d="M16 76 Q36 52 46 70 L42 100 Q28 92 18 100 Z" fill="#163820"/>
      <path d="M40 92 L45 104 L50 104 L47 92 Z" fill="#2a4a28"/>
      <path d="M50 92 L54 104 L59 104 L56 92 Z" fill="#2a4a28"/>
      <path d="M38 72 L58 70 L56 92 L40 94 Z" fill="#3d8a4a"/>
      <path d="M22 44 L30 18 L34 50 Z" fill="#d8c46a"/>
      <ellipse cx="48" cy="50" rx="12" ry="13" fill="#f0c8a0"/>
      <path d="M36 38 Q48 22 60 40 Q58 32 48 28 Q38 32 36 38 Z" fill="#d8c46a"/>
      <circle cx="52" cy="50" r="1.7" fill="#1a120c"/>
      <circle cx="52.6" cy="49.4" r=".5" fill="#fff"/>
      <path d="M62 48 Q80 22 84 68 Q72 60 62 70 Z" fill="none" stroke="#6a4018" stroke-width="2.6"/>
      <line x1="64" y1="38" x2="64" y2="74" stroke="#efe4c8" stroke-width="1.2"/>
      <path d="M64 52 L82 46" stroke="#c8d0dc" stroke-width="1.3"/>`),

    elf_f: hs(`${gnd}
      <path d="M16 76 Q36 52 46 70 L42 100 Q28 92 18 100 Z" fill="#163820"/>
      <path d="M40 92 L45 104 L50 104 L47 92 Z" fill="#2a4a28"/>
      <path d="M50 92 L54 104 L59 104 L56 92 Z" fill="#2a4a28"/>
      <path d="M38 72 L58 70 L56 92 L40 94 Z" fill="#3d8a4a"/>
      <path d="M22 42 L30 16 L34 52 Z" fill="#8fd98a"/>
      <path d="M32 56 Q36 100 46 100 Q52 78 60 100 Q70 100 72 56 Z" fill="#8fd98a"/>
      <ellipse cx="48" cy="50" rx="12" ry="13" fill="#f0c8a0"/>
      <path d="M36 36 Q48 20 60 38 Q58 30 48 26 Q38 30 36 36 Z" fill="#8fd98a"/>
      <circle cx="52" cy="50" r="1.7" fill="#1a120c"/>
      <path d="M62 48 Q80 22 84 68 Q72 60 62 70 Z" fill="none" stroke="#6a4018" stroke-width="2.6"/>`),

    mage_m: hs(`${gnd}
      <path d="M14 74 Q40 50 54 74 L52 102 Q32 94 16 102 Z" fill="#2a1048"/>
      <path d="M40 92 L45 104 L50 104 L48 92 Z" fill="#2a1848"/>
      <path d="M50 92 L54 104 L59 104 L57 92 Z" fill="#2a1848"/>
      <path d="M38 72 L60 70 L58 94 L40 96 Z" fill="#5a348c"/>
      <rect x="40" y="82" width="16" height="3" fill="#d4af37"/>
      <ellipse cx="48" cy="54" rx="11" ry="12" fill="#f0c8a0"/>
      <path d="M16 48 L48 6 L80 48 Z" fill="#3c1868"/>
      <path d="M22 48 L48 14 L74 48 Z" fill="#5a2a98"/>
      <ellipse cx="48" cy="48" rx="30" ry="6" fill="#241040"/>
      <rect x="20" y="46" width="56" height="3" fill="#d4af37"/>
      <circle cx="48" cy="10" r="3.5" fill="#ffe27a"/>
      <circle cx="52" cy="54" r="1.6" fill="#1a120c"/>
      <rect x="68" y="50" width="5" height="44" rx="1" fill="#6a4018"/>
      <circle cx="70.5" cy="46" r="7" fill="#7ec8ff"/>
      <circle cx="70.5" cy="46" r="3" fill="#d8f0ff"/>`),

    mage_f: hs(`${gnd}
      <path d="M14 74 Q40 50 54 74 L52 102 Q32 94 16 102 Z" fill="#2a1048"/>
      <path d="M40 92 L45 104 L50 104 L48 92 Z" fill="#2a1848"/>
      <path d="M50 92 L54 104 L59 104 L57 92 Z" fill="#2a1848"/>
      <path d="M38 72 L58 70 L56 94 L40 96 Z" fill="#5a348c"/>
      <path d="M30 58 Q34 100 44 100 Q50 80 60 100 Q70 100 72 58 Z" fill="#241040"/>
      <ellipse cx="48" cy="54" rx="11" ry="12" fill="#f0c8a0"/>
      <path d="M18 48 L48 8 L78 48 Z" fill="#3c1868"/>
      <ellipse cx="48" cy="48" rx="28" ry="6" fill="#241040"/>
      <rect x="22" y="46" width="52" height="3" fill="#d4af37"/>
      <circle cx="48" cy="12" r="3.5" fill="#ffe27a"/>
      <circle cx="52" cy="54" r="1.6" fill="#1a120c"/>
      <rect x="68" y="50" width="5" height="44" rx="1" fill="#6a4018"/>
      <circle cx="70.5" cy="46" r="7" fill="#c9a0ff"/>`),
  };

  const mobs = {
    rabbit: ms(`${mg}<ellipse cx="46" cy="52" rx="11" ry="8" fill="#dcc8b0"/>
      <ellipse cx="52" cy="28" rx="3.5" ry="14" fill="#dcc8b0"/><ellipse cx="60" cy="30" rx="3" ry="12" fill="#dcc8b0"/>
      <ellipse cx="38" cy="42" rx="10" ry="9" fill="#e8d8c8"/>
      <circle cx="34" cy="40" r="1.8" fill="#1a1008"/><ellipse cx="30" cy="44" rx="2.5" ry="1.6" fill="#f0a090"/>`),
    fox: ms(`${mg}<path d="M58 48 Q70 38 74 24" stroke="#d07028" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="50" rx="14" ry="8" fill="#d07028"/>
      <path d="M22 40 L18 22 L30 40 Z" fill="#d07028"/>
      <ellipse cx="32" cy="40" rx="10" ry="8" fill="#e88838"/>
      <circle cx="28" cy="38" r="1.7" fill="#1a1008"/>`),
    goblin: ms(`${mg}<rect x="34" y="52" width="6" height="12" rx="2" fill="#3a6028"/>
      <rect x="44" y="52" width="6" height="12" rx="2" fill="#3a6028"/>
      <ellipse cx="42" cy="50" rx="10" ry="8" fill="#4a8a38"/>
      <path d="M24 34 L16 16 L30 34 Z" fill="#5ca048"/>
      <ellipse cx="34" cy="36" rx="11" ry="10" fill="#5ca048"/>
      <circle cx="30" cy="34" r="1.8" fill="#ffe040"/>
      <rect x="52" y="34" width="4" height="22" fill="#6a5030"/>`),
    orc: ms(`${mg}<rect x="32" y="52" width="7" height="12" rx="2" fill="#6a4830"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#6a4830"/>
      <ellipse cx="42" cy="50" rx="12" ry="9" fill="#8a6040"/>
      <path d="M22 32 L14 12 L28 32 Z" fill="#8a6040"/>
      <ellipse cx="32" cy="34" rx="12" ry="11" fill="#a07050"/>
      <circle cx="28" cy="32" r="1.8" fill="#ff3020"/>
      <rect x="24" y="40" width="14" height="3" rx="1" fill="#f0d0a0"/>
      <path d="M54 32 L70 20 L66 40 Z" fill="#a0a8b0"/>
      <rect x="56" y="36" width="5" height="22" fill="#5a4028"/>`),
    dwarf: ms(`${mg}<rect x="34" y="52" width="7" height="12" rx="2" fill="#506070"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#506070"/>
      <ellipse cx="42" cy="50" rx="12" ry="8" fill="#607080"/>
      <ellipse cx="36" cy="36" rx="11" ry="10" fill="#f0c8a0"/>
      <path d="M24 38 Q36 52 50 38 Q50 54 36 58 Q24 54 24 38 Z" fill="#8a5030"/>
      <rect x="22" y="24" width="28" height="9" rx="3" fill="#8090a0"/>
      <circle cx="32" cy="36" r="1.5" fill="#1a1008"/>
      <rect x="54" y="36" width="4" height="18" fill="#6a5030"/>`),
    slime: ms(`${mg}<ellipse cx="40" cy="48" rx="18" ry="14" fill="#48a858"/>
      <ellipse cx="38" cy="44" rx="14" ry="11" fill="#68c878" opacity=".85"/>
      <circle cx="32" cy="42" r="2.4" fill="#1a4020"/><circle cx="42" cy="42" r="2.4" fill="#1a4020"/>
      <ellipse cx="30" cy="36" rx="5" ry="3" fill="#fff" opacity=".4"/>`),
    boar: ms(`${mg}<ellipse cx="42" cy="50" rx="16" ry="10" fill="#8a6040"/>
      <ellipse cx="30" cy="42" rx="11" ry="9" fill="#a07050"/>
      <path d="M18 44 L8 48 L18 52 Z" fill="#f0d0b0"/>
      <circle cx="26" cy="40" r="1.6" fill="#1a1008"/>
      <path d="M22 30 L14 22" stroke="#8a6040" stroke-width="3" stroke-linecap="round"/>`),
    wolf: ms(`${mg}<path d="M56 50 Q70 38 74 22" stroke="#505860" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="42" cy="52" rx="14" ry="8" fill="#505860"/>
      <path d="M20 34 L14 14 L28 36 Z" fill="#687078"/>
      <ellipse cx="30" cy="40" rx="11" ry="9" fill="#687078"/>
      <circle cx="26" cy="38" r="1.7" fill="#ffe040"/>`),
    floating: ms(`${mg}<circle cx="40" cy="38" r="18" fill="#8040a0" opacity=".55"/>
      <circle cx="40" cy="38" r="15" fill="#a060c0"/>
      <circle cx="40" cy="38" r="8" fill="#1a0820"/>
      <circle cx="40" cy="38" r="4.5" fill="#ff4040"/>
      <circle cx="36" cy="34" r="1.8" fill="#fff" opacity=".65"/>`),
    mushroom: ms(`${mg}<rect x="34" y="44" width="12" height="16" rx="3" fill="#e8dcc8"/>
      <ellipse cx="40" cy="38" rx="18" ry="12" fill="#c04040"/>
      <circle cx="30" cy="34" r="2.8" fill="#fff" opacity=".7"/>
      <circle cx="46" cy="32" r="2.2" fill="#fff" opacity=".7"/>`),
    skeleton: ms(`${mg}<rect x="36" y="52" width="5" height="12" fill="#e8e0d0"/>
      <rect x="46" y="52" width="5" height="12" fill="#e8e0d0"/>
      <rect x="34" y="40" width="20" height="14" rx="2" fill="#e8e0d0"/>
      <line x1="44" y1="40" x2="44" y2="54" stroke="#c8c0b0" stroke-width="2"/>
      <ellipse cx="36" cy="30" rx="10" ry="10" fill="#f0e8d8"/>
      <circle cx="32" cy="28" r="2.2" fill="#1a1008"/>
      <rect x="54" y="32" width="4" height="24" fill="#e8e0d0"/>
      <path d="M56 30 L68 22 L66 36 Z" fill="#c8d0dc"/>`),
    golem: ms(`${mg}<rect x="26" y="22" width="32" height="32" rx="4" fill="#687078"/>
      <rect x="30" y="26" width="24" height="8" rx="2" fill="#889098"/>
      <circle cx="36" cy="30" r="2" fill="#ffe040"/><circle cx="48" cy="30" r="2" fill="#ffe040"/>
      <rect x="28" y="52" width="10" height="10" rx="2" fill="#586068"/>
      <rect x="46" y="52" width="10" height="10" rx="2" fill="#586068"/>`),
    arachne: ms(`${mg}<ellipse cx="42" cy="44" rx="12" ry="9" fill="#302020"/>
      <ellipse cx="32" cy="32" rx="10" ry="9" fill="#403030"/>
      <circle cx="28" cy="30" r="2" fill="#ff2020"/>
      <path d="M16 40 L30 44 M12 50 L30 50 M16 60 L30 54" stroke="#403030" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M56 40 L68 36 M56 50 L72 50 M56 58 L68 62" stroke="#403030" stroke-width="2.8" stroke-linecap="round"/>`),
    zombie: ms(`${mg}<rect x="34" y="52" width="6" height="12" rx="2" fill="#4a5850"/>
      <rect x="44" y="52" width="6" height="12" rx="2" fill="#4a5850"/>
      <ellipse cx="42" cy="50" rx="10" ry="8" fill="#4a6850"/>
      <ellipse cx="34" cy="36" rx="11" ry="10" fill="#5a7860"/>
      <circle cx="30" cy="34" r="2" fill="#fff"/><circle cx="36" cy="34" r="1.4" fill="#1a1008"/>`),
    bear: ms(`${mg}<ellipse cx="42" cy="50" rx="16" ry="11" fill="#503820"/>
      <circle cx="28" cy="30" r="6" fill="#705030"/>
      <ellipse cx="34" cy="38" rx="12" ry="11" fill="#705030"/>
      <circle cx="30" cy="36" r="1.7" fill="#1a1008"/>
      <ellipse cx="32" cy="44" rx="4" ry="3" fill="#403020"/>`),
    ghoul: ms(`${mg}<rect x="34" y="52" width="6" height="12" rx="2" fill="#3a4840"/>
      <rect x="44" y="52" width="6" height="12" rx="2" fill="#3a4840"/>
      <ellipse cx="42" cy="50" rx="10" ry="8" fill="#3a4840"/>
      <ellipse cx="34" cy="36" rx="11" ry="10" fill="#4a5850"/>
      <circle cx="30" cy="34" r="2" fill="#80ff80"/>`),
    ant: ms(`${mg}<ellipse cx="44" cy="48" rx="12" ry="8" fill="#302018"/>
      <ellipse cx="32" cy="38" rx="8" ry="7" fill="#403028"/>
      <circle cx="28" cy="36" r="1.5" fill="#1a1008"/>
      <path d="M22 42 L10 36 M22 48 L8 50 M22 54 L12 58" stroke="#403028" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M54 42 L66 36 M54 48 L68 50 M54 54 L64 58" stroke="#403028" stroke-width="2.3" stroke-linecap="round"/>`),
    scorpion: ms(`${mg}<ellipse cx="38" cy="46" rx="13" ry="8" fill="#604020"/>
      <ellipse cx="28" cy="38" rx="8" ry="7" fill="#806030"/>
      <circle cx="24" cy="36" r="1.6" fill="#ff2020"/>
      <path d="M50 38 L66 18" stroke="#806030" stroke-width="4" stroke-linecap="round"/>
      <circle cx="66" cy="16" r="3.2" fill="#c04040"/>`),
    lizard: ms(`${mg}<rect x="34" y="52" width="6" height="12" rx="2" fill="#3a6848"/>
      <rect x="44" y="52" width="6" height="12" rx="2" fill="#3a6848"/>
      <ellipse cx="42" cy="50" rx="11" ry="8" fill="#3a6848"/>
      <ellipse cx="32" cy="36" rx="10" ry="9" fill="#4a8860"/>
      <circle cx="28" cy="34" r="1.7" fill="#ffe040"/>
      <path d="M52 44 Q66 34 68 22" stroke="#3a6848" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    bugbear: ms(`${mg}<rect x="32" y="52" width="7" height="12" rx="2" fill="#506040"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#506040"/>
      <ellipse cx="42" cy="50" rx="13" ry="9" fill="#506040"/>
      <ellipse cx="32" cy="34" rx="12" ry="11" fill="#608050"/>
      <circle cx="28" cy="32" r="1.8" fill="#ff3020"/>
      <path d="M54 30 L68 20 L64 40 Z" fill="#808890"/>`),
    hellhound: ms(`${mg}<path d="M56 50 Q70 38 72 22" stroke="#402018" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="42" cy="52" rx="14" ry="8" fill="#402018"/>
      <ellipse cx="30" cy="40" rx="11" ry="9" fill="#602820"/>
      <circle cx="26" cy="38" r="2" fill="#ff6020"/>
      <ellipse cx="30" cy="26" rx="6" ry="4" fill="#ff8040" opacity=".55"/>`),
    ogre: ms(`${mg}<rect x="30" y="52" width="8" height="12" rx="2" fill="#506838"/>
      <rect x="44" y="52" width="8" height="12" rx="2" fill="#506838"/>
      <ellipse cx="42" cy="50" rx="15" ry="10" fill="#506838"/>
      <ellipse cx="32" cy="32" rx="13" ry="12" fill="#608848"/>
      <circle cx="28" cy="30" r="2" fill="#ffe040"/>
      <rect x="56" y="30" width="6" height="26" fill="#4a3820"/>`),
    darkelf: ms(`${mg}<rect x="36" y="52" width="5" height="12" rx="2" fill="#1a2038"/>
      <rect x="46" y="52" width="5" height="12" rx="2" fill="#1a2038"/>
      <ellipse cx="44" cy="50" rx="9" ry="8" fill="#283048"/>
      <path d="M22 30 L16 10 L28 30 Z" fill="#384858"/>
      <ellipse cx="34" cy="34" rx="10" ry="10" fill="#384858"/>
      <circle cx="30" cy="32" r="1.5" fill="#c0a0ff"/>
      <path d="M52 36 Q66 28 70 18" stroke="#384858" stroke-width="3" fill="none"/>`),
    succubus: ms(`${mg}<rect x="36" y="52" width="5" height="12" rx="2" fill="#482838"/>
      <rect x="46" y="52" width="5" height="12" rx="2" fill="#482838"/>
      <ellipse cx="44" cy="50" rx="10" ry="9" fill="#482838"/>
      <path d="M18 28 L12 8 L28 28 Z" fill="#683848"/><path d="M58 26 L68 8 L52 28 Z" fill="#683848"/>
      <ellipse cx="36" cy="34" rx="11" ry="10" fill="#683848"/>
      <circle cx="32" cy="32" r="1.7" fill="#ff4060"/>`),
    drake: ms(`${mg}<ellipse cx="42" cy="50" rx="16" ry="9" fill="#286040"/>
      <ellipse cx="30" cy="38" rx="11" ry="9" fill="#388050"/>
      <circle cx="26" cy="36" r="1.8" fill="#ffe040"/>
      <path d="M50 34 L70 18 L64 42 Z" fill="#388050"/>
      <path d="M14 40 Q6 28 12 16" stroke="#388050" stroke-width="4" fill="none" stroke-linecap="round"/>`),
    gargoyle: ms(`${mg}<path d="M24 60 L40 16 L56 60 Z" fill="#687078"/>
      <path d="M30 60 L40 24 L50 60 Z" fill="#889098"/>
      <circle cx="34" cy="36" r="2.2" fill="#ff4040"/><circle cx="44" cy="36" r="2.2" fill="#ff4040"/>
      <path d="M16 40 L6 26 L20 36 Z" fill="#687078"/><path d="M64 40 L74 26 L60 36 Z" fill="#687078"/>`),
    deathk: ms(`${mg}<rect x="32" y="52" width="7" height="12" rx="2" fill="#121018"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#121018"/>
      <ellipse cx="42" cy="50" rx="12" ry="9" fill="#1a1820"/>
      <ellipse cx="32" cy="32" rx="11" ry="11" fill="#2a2830"/>
      <circle cx="28" cy="30" r="2" fill="#ff4040"/>
      <rect x="54" y="28" width="5" height="28" fill="#1a1820"/>
      <path d="M56 24 L70 16 L66 34 Z" fill="#808890"/>`),
    ant_queen: ms(`${mg}<ellipse cx="44" cy="48" rx="16" ry="11" fill="#402818"/>
      <ellipse cx="32" cy="34" rx="12" ry="10" fill="#503028"/>
      <circle cx="28" cy="32" r="2" fill="#ffd040"/>
      <ellipse cx="32" cy="20" rx="8" ry="5" fill="#806040"/>`),
    succubus_q: ms(`${mg}<rect x="32" y="52" width="7" height="12" rx="2" fill="#381828"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#381828"/>
      <ellipse cx="42" cy="50" rx="14" ry="11" fill="#381828"/>
      <path d="M16 22 L10 2 L28 22 Z" fill="#582838"/><path d="M62 22 L70 2 L50 22 Z" fill="#582838"/>
      <ellipse cx="34" cy="32" rx="13" ry="12" fill="#582838"/>
      <circle cx="30" cy="30" r="2.2" fill="#ff3060"/>
      <path d="M16 10 Q40 0 64 10" stroke="#ffd040" stroke-width="2.5" fill="none"/>`),
    demon: ms(`${mg}<rect x="32" y="52" width="7" height="12" rx="2" fill="#501010"/>
      <rect x="44" y="52" width="7" height="12" rx="2" fill="#501010"/>
      <ellipse cx="42" cy="50" rx="12" ry="9" fill="#802020"/>
      <path d="M18 28 L12 8 L28 28 Z" fill="#802020"/><path d="M54 28 L64 8 L46 28 Z" fill="#802020"/>
      <ellipse cx="32" cy="34" rx="12" ry="11" fill="#a03030"/>
      <circle cx="28" cy="32" r="2" fill="#ff4040"/>`),
  };

  const alias = {
    kobold: "goblin", hobgob: "goblin", orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf", dw_f: "dwarf", skel_a: "skeleton",
    sparto: "skeleton", ant_s: "ant", yangol: "scorpion", balrog: "demon", ancient: "drake",
    harpy: "succubus", medusa: "arachne", unicorn: "rabbit", iron_golem: "golem",
    lich: "skeleton", guardian: "golem", baphomet: "succubus_q", black_elder: "darkelf",
    lindvior: "drake", fafurion: "drake", antharas: "drake", valakas: "hellhound",
  };

  return {
    hero: (cls, g) => heroes[`${cls || "knight"}_${g === "f" ? "f" : "m"}`] || heroes.knight_m,
    mob: (id) => mobs[alias[id] || id] || mobs.orc,
  };
})();
