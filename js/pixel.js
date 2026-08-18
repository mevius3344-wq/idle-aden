/* 雲州閒俠 — 漢服／束髮／長劍／江湖精怪 SVG */
window.PIXEL = (() => {
  const D = `<defs>
    <linearGradient id="pz-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff4c8"/><stop offset="45%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8a6020"/></linearGradient>
    <linearGradient id="pz-silk-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c42828"/><stop offset="55%" stop-color="#6e1010"/><stop offset="100%" stop-color="#3a0808"/></linearGradient>
    <linearGradient id="pz-silk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2d8a48"/><stop offset="55%" stop-color="#1a5028"/><stop offset="100%" stop-color="#0c2814"/></linearGradient>
    <linearGradient id="pz-silk-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a48c8"/><stop offset="55%" stop-color="#402070"/><stop offset="100%" stop-color="#1a0c30"/></linearGradient>
    <linearGradient id="pz-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a5858"/><stop offset="100%" stop-color="#122828"/></linearGradient>
    <linearGradient id="pz-blade" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#f8fcff"/><stop offset="40%" stop-color="#c8d4e0"/><stop offset="100%" stop-color="#6a7888"/></linearGradient>
    <linearGradient id="pz-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe8d0"/><stop offset="100%" stop-color="#e8b890"/></linearGradient>
    <linearGradient id="pz-jade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9be37d"/><stop offset="100%" stop-color="#287838"/></linearGradient>
    <radialGradient id="pz-aura-g" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#9be37d" stop-opacity=".32"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <radialGradient id="pz-aura-r" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#ff8060" stop-opacity=".26"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <radialGradient id="pz-aura-p" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#c9a0ff" stop-opacity=".3"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <filter id="pz-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="pz-soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>`;

  const hs = (inner) =>
    `<svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${D}${inner}</svg>`;
  const ms = (inner) =>
    `<svg viewBox="0 0 88 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${D}${inner}</svg>`;

  const gnd = `<ellipse cx="48" cy="114" rx="22" ry="4.5" fill="rgba(0,0,0,.42)"/>`;
  const mg = `<ellipse cx="44" cy="74" rx="20" ry="3.6" fill="rgba(0,0,0,.4)"/>`;

  const jian = (x = 68) =>
    `<path d="M${x} 16 L${x + 3.2} 16 L${x + 4} 78 L${x - 0.4} 78 Z" fill="url(#pz-blade)" filter="url(#pz-glow)"/>
     <path d="M${x + 1.6} 16 L${x + 1.8} 76" stroke="#fff" stroke-width=".45" opacity=".55"/>
     <rect x="${x - 4}" y="76" width="12" height="3.2" rx=".6" fill="url(#pz-gold)"/>
     <rect x="${x + 0.4}" y="79" width="2.6" height="14" rx=".6" fill="#4a2810"/>
     <path d="M${x + 6} 80 Q${x + 14} 86 ${x + 10} 98" stroke="#c42828" stroke-width="1.4" fill="none"/>`;

  const guan = (cx = 48, ink = "#1a1008") =>
    `<path d="M${cx - 12} 36 Q${cx} 20 ${cx + 12} 36 Q${cx + 10} 30 ${cx} 26 Q${cx - 10} 30 ${cx - 12} 36 Z" fill="${ink}"/>
     <ellipse cx="${cx}" cy="22" rx="6" ry="4.5" fill="${ink}"/>
     <ellipse cx="${cx}" cy="18" rx="4.2" ry="3" fill="url(#pz-gold)"/>
     <rect x="${cx - 1.4}" y="12" width="2.8" height="7" rx="1" fill="url(#pz-gold)"/>`;

  const heroes = {
    knight_m: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-r)"/>
      <path d="M12 76 Q36 46 48 64 L46 106 Q28 98 14 106 Z" fill="url(#pz-silk-r)" filter="url(#pz-soft)"/>
      <path d="M36 68 L62 64 L60 96 L38 100 Z" fill="url(#pz-ink)" stroke="url(#pz-gold)" stroke-width=".7"/>
      <path d="M40 70 L58 67 L56 82 L42 84 Z" fill="#2a6868" opacity=".9"/>
      <path d="M38 72 L48 78 L58 72" fill="none" stroke="#efe4c8" stroke-width=".8"/>
      <rect x="38" y="86" width="22" height="3.4" rx="1" fill="url(#pz-gold)"/>
      <path d="M36 90 L44 108 L40 108 L34 92 Z" fill="#1a1008"/>
      <path d="M50 90 L58 108 L54 108 L48 92 Z" fill="#1a1008"/>
      <circle cx="48" cy="48" r="12.5" fill="url(#pz-skin)"/>
      ${guan(48)}
      <path d="M42 50 Q48 54 54 50" fill="none" stroke="#1a1008" stroke-width="1.1"/>
      <circle cx="44" cy="47" r="1.4" fill="#1a1008"/><circle cx="52" cy="47" r="1.4" fill="#1a1008"/>
      ${jian(68)}`),

    knight_f: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-r)"/>
      <path d="M14 76 Q36 48 48 66 L46 106 Q30 98 16 106 Z" fill="url(#pz-silk-r)" filter="url(#pz-soft)"/>
      <path d="M28 58 Q36 102 46 104 Q52 78 62 104 Q72 102 74 58 Z" fill="#8b1a1a"/>
      <path d="M38 70 L58 68 L56 92 L40 96 Z" fill="url(#pz-ink)" stroke="url(#pz-gold)" stroke-width=".7"/>
      <path d="M40 72 L56 70" stroke="#efe4c8" stroke-width=".8"/>
      <circle cx="48" cy="48" r="12" fill="url(#pz-skin)"/>
      <path d="M30 40 Q48 18 66 40 Q62 30 48 26 Q34 30 30 40 Z" fill="#1a0808"/>
      <ellipse cx="36" cy="28" rx="5" ry="6" fill="#1a0808"/><ellipse cx="60" cy="28" rx="5" ry="6" fill="#1a0808"/>
      <rect x="46" y="16" width="4" height="10" rx="1" fill="url(#pz-gold)"/>
      <circle cx="44" cy="47" r="1.3" fill="#1a1008"/><circle cx="52" cy="47" r="1.3" fill="#1a1008"/>
      <path d="M42 51 Q48 54 54 51" fill="none" stroke="#8a2018" stroke-width=".8"/>
      ${jian(66)}`),

    elf_m: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-g)"/>
      <path d="M16 74 Q38 48 50 66 L46 106 Q32 98 18 106 Z" fill="url(#pz-silk-g)" filter="url(#pz-soft)"/>
      <path d="M38 70 L58 68 L56 96 L40 98 Z" fill="#246838" stroke="#9be37d" stroke-width=".55"/>
      <path d="M40 78 Q48 82 56 78" fill="none" stroke="#efe4c8" stroke-width=".8"/>
      <rect x="40" y="86" width="16" height="3" rx="1" fill="#6a4018"/>
      <path d="M36 90 L44 108 L40 108 L34 92 Z" fill="#1a2810"/>
      <path d="M50 90 L58 108 L54 108 L48 92 Z" fill="#1a2810"/>
      <path d="M22 48 L28 22 L32 52 Z" fill="#d8c46a"/>
      <circle cx="48" cy="46" r="12" fill="url(#pz-skin)"/>
      <path d="M34 32 Q48 16 62 34 Q60 26 48 22 Q36 26 34 32 Z" fill="#3a2810"/>
      <rect x="45" y="16" width="6" height="8" rx="2" fill="#3a2810"/>
      <ellipse cx="48" cy="15" rx="3.5" ry="2.5" fill="url(#pz-jade)" opacity=".9"/>
      <circle cx="44" cy="45" r="1.4" fill="#1a1008"/><circle cx="52" cy="45" r="1.4" fill="#1a1008"/>
      <circle cx="53" cy="44" r=".5" fill="#fff"/>
      <path d="M62 46 Q84 16 88 64 Q76 56 64 68 Z" fill="none" stroke="#6a4018" stroke-width="2.6"/>
      <line x1="66" y1="34" x2="66" y2="72" stroke="#efe4c8" stroke-width="1.1"/>
      <path d="M66 50 L86 42" stroke="url(#pz-blade)" stroke-width="1.3" filter="url(#pz-glow)"/>`),

    elf_f: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-g)"/>
      <path d="M16 74 Q38 48 50 66 L46 106 Q32 98 18 106 Z" fill="url(#pz-silk-g)" filter="url(#pz-soft)"/>
      <path d="M30 56 Q36 102 46 102 Q52 76 62 102 Q72 102 74 56 Z" fill="#8fd98a" opacity=".88"/>
      <path d="M40 70 L56 68 L54 92 L42 96 Z" fill="#246838" stroke="#9be37d" stroke-width=".55"/>
      <path d="M24 40 L30 16 L34 48 Z" fill="#8fd98a"/>
      <circle cx="48" cy="46" r="12" fill="url(#pz-skin)"/>
      <path d="M32 32 Q48 12 64 34 Q62 24 48 20 Q34 24 32 32 Z" fill="#2a1810"/>
      <path d="M58 28 Q72 40 64 58" fill="#2a1810"/>
      <rect x="58" y="30" width="8" height="2" rx="1" fill="url(#pz-gold)"/>
      <circle cx="52" cy="45" r="1.4" fill="#1a1008"/>
      <path d="M62 46 Q84 16 88 64 Q76 56 64 68 Z" fill="none" stroke="#6a4018" stroke-width="2.6"/>
      <line x1="66" y1="34" x2="66" y2="72" stroke="#efe4c8" stroke-width="1.1"/>`),

    mage_m: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-p)"/>
      <path d="M12 72 Q40 44 56 70 L52 106 Q32 98 16 106 Z" fill="url(#pz-silk-p)" filter="url(#pz-soft)"/>
      <path d="M38 70 L60 68 L58 96 L40 98 Z" fill="#502878" stroke="url(#pz-gold)" stroke-width=".6"/>
      <path d="M40 74 L48 80 L56 74" fill="none" stroke="#efe4c8" stroke-width=".8"/>
      <rect x="40" y="86" width="18" height="3" fill="url(#pz-gold)"/>
      <circle cx="48" cy="50" r="11.5" fill="url(#pz-skin)"/>
      <path d="M34 38 Q48 24 62 38 Q58 32 48 30 Q38 32 34 38 Z" fill="#1a0c20"/>
      <rect x="40" y="18" width="16" height="14" rx="2" fill="#3c1868" stroke="url(#pz-gold)" stroke-width=".8"/>
      <rect x="44" y="14" width="8" height="6" rx="1" fill="url(#pz-gold)"/>
      <circle cx="48" cy="21" r="2" fill="#ffe27a" filter="url(#pz-glow)"/>
      <circle cx="52" cy="50" r="1.4" fill="#1a1008"/>
      <path d="M42 54 Q48 58 54 54" fill="none" stroke="#1a1008" stroke-width="1"/>
      <rect x="68" y="36" width="4.2" height="52" rx="1" fill="#5a3820"/>
      <path d="M62 36 Q70 20 78 36 Q70 32 62 36" fill="#efe4c8"/>
      <circle cx="70" cy="32" r="6.5" fill="#7ec8ff" filter="url(#pz-glow)" opacity=".85"/>
      <circle cx="70" cy="32" r="2.8" fill="#e8f8ff"/>
      <rect x="72" y="40" width="8" height="10" rx="1" fill="#fff4c8" stroke="#c42828" stroke-width=".6" transform="rotate(12 76 45)"/>`),

    mage_f: hs(`${gnd}<ellipse cx="48" cy="90" rx="28" ry="16" fill="url(#pz-aura-p)"/>
      <path d="M12 72 Q40 44 56 70 L52 106 Q32 98 16 106 Z" fill="url(#pz-silk-p)" filter="url(#pz-soft)"/>
      <path d="M28 56 Q34 102 44 104 Q50 78 62 104 Q72 102 74 56 Z" fill="#241040"/>
      <path d="M40 70 L56 68 L54 94 L42 96 Z" fill="#502878" stroke="url(#pz-gold)" stroke-width=".6"/>
      <circle cx="48" cy="50" r="11.5" fill="url(#pz-skin)"/>
      <path d="M32 36 Q48 16 64 38 Q62 28 48 24 Q34 28 32 36 Z" fill="#1a0c20"/>
      <path d="M58 28 Q74 42 66 62" fill="#1a0c20"/>
      <rect x="42" y="16" width="12" height="10" rx="2" fill="#3c1868" stroke="url(#pz-gold)" stroke-width=".7"/>
      <circle cx="48" cy="18" r="2.4" fill="#ffe27a" filter="url(#pz-glow)"/>
      <circle cx="52" cy="50" r="1.4" fill="#1a1008"/>
      <rect x="68" y="38" width="4.2" height="50" rx="1" fill="#5a3820"/>
      <circle cx="70" cy="34" r="7" fill="#c9a0ff" filter="url(#pz-glow)"/>
      <circle cx="70" cy="34" r="3" fill="#efe4ff"/>`),
  };

  const mobs = {
    rabbit: ms(`${mg}<ellipse cx="50" cy="56" rx="12" ry="8" fill="#e8d0b8"/>
      <ellipse cx="56" cy="30" rx="3.2" ry="13" fill="#e8d0b8"/><ellipse cx="64" cy="32" rx="2.8" ry="11" fill="#dcc0a0"/>
      <ellipse cx="40" cy="44" rx="11" ry="9" fill="#f0e0c8"/><circle cx="36" cy="42" r="1.8" fill="#1a1008"/>
      <ellipse cx="32" cy="46" rx="3" ry="2" fill="#f0a090"/>`),
    fox: ms(`${mg}<path d="M58 50 Q74 34 78 18" stroke="#c06028" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="54" rx="14" ry="9" fill="#d87830"/>
      <path d="M20 32 L12 12 L28 34 Z" fill="#c06028"/>
      <ellipse cx="30" cy="38" rx="12" ry="10" fill="#e89040"/>
      <circle cx="26" cy="36" r="1.8" fill="#1a1008"/>
      <ellipse cx="24" cy="42" rx="3" ry="2" fill="#1a1008"/>`),
    goblin: ms(`${mg}<rect x="36" y="56" width="6" height="12" rx="2" fill="#3a2a18"/>
      <rect x="46" y="56" width="6" height="12" rx="2" fill="#3a2a18"/>
      <ellipse cx="44" cy="52" rx="11" ry="9" fill="#5a4830"/>
      <path d="M22 34 L14 12 L30 34 Z" fill="#4a3820"/>
      <ellipse cx="34" cy="36" rx="12" ry="11" fill="#6a5840"/>
      <circle cx="30" cy="34" r="2" fill="#9be37d" filter="url(#pz-glow)"/>
      <path d="M24 40 Q34 44 40 40" fill="none" stroke="#2a1810" stroke-width="1.2"/>
      <rect x="54" y="34" width="5" height="24" rx="1" fill="#6a5030"/>
      <path d="M18 48 Q28 42 32 52" stroke="#3a5828" stroke-width="2" fill="none"/>`),
    orc: ms(`${mg}<rect x="32" y="56" width="8" height="12" rx="2" fill="#3a2818"/>
      <rect x="44" y="56" width="8" height="12" rx="2" fill="#3a2818"/>
      <path d="M22 48 Q44 40 64 52 L60 68 Q44 62 26 68 Z" fill="#5a3820"/>
      <ellipse cx="44" cy="50" rx="13" ry="10" fill="#8a6040"/>
      <ellipse cx="32" cy="34" rx="13" ry="12" fill="#b88058"/>
      <path d="M18 30 L8 10 L26 30 Z" fill="#6a4830"/>
      <circle cx="28" cy="32" r="2" fill="#ff4030" filter="url(#pz-glow)"/>
      <path d="M22 40 L18 46 M38 40 L42 46" stroke="#efe4c8" stroke-width="2"/>
      <rect x="24" y="42" width="16" height="3.4" rx="1" fill="#d8c8a0"/>
      ${`<path d="M58 28 L72 12 L68 36 Z" fill="url(#pz-blade)"/>`}
      <rect x="58" y="36" width="5" height="26" fill="#5a4028" rx="1"/>`),
    wolf: ms(`${mg}<path d="M58 52 Q74 36 78 16" stroke="#505868" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="54" rx="15" ry="9" fill="#586068"/>
      <path d="M18 32 L8 10 L28 34 Z" fill="#788088"/>
      <ellipse cx="30" cy="40" rx="12" ry="10" fill="#889098"/>
      <circle cx="26" cy="38" r="2" fill="#ffe040" filter="url(#pz-glow)"/>`),
    skeleton: ms(`${mg}<rect x="36" y="56" width="5" height="12" fill="#e8e0d0"/>
      <rect x="46" y="56" width="5" height="12" fill="#e8e0d0"/>
      <path d="M28 42 L56 40 L54 58 L30 60 Z" fill="#c8b898" opacity=".55"/>
      <rect x="34" y="42" width="22" height="14" rx="2" fill="#f0e8d8"/>
      <ellipse cx="36" cy="28" rx="11" ry="11" fill="#f8f0e0"/>
      <circle cx="32" cy="26" r="2.4" fill="#1a1008"/>
      <path d="M28 32 H42" stroke="#c8c0b0" stroke-width="1.2"/>
      <rect x="58" y="28" width="3.2" height="32" fill="url(#pz-blade)"/>
      <rect x="55" y="58" width="9" height="2.4" fill="url(#pz-gold)"/>
      <path d="M64 60 Q72 66 68 74" stroke="#8a2018" stroke-width="1.2" fill="none"/>`),
    floating: ms(`${mg}<ellipse cx="44" cy="40" rx="20" ry="18" fill="#d8d0c0" opacity=".35"/>
      <path d="M28 28 Q44 12 60 28 Q58 52 44 58 Q30 52 28 28 Z" fill="#e8e0d4" opacity=".85"/>
      <circle cx="38" cy="34" r="2.2" fill="#1a1008"/><circle cx="50" cy="34" r="2.2" fill="#1a1008"/>
      <path d="M38 44 Q44 48 50 44" fill="none" stroke="#8a2018" stroke-width="1"/>
      <rect x="40" y="20" width="8" height="10" rx="1" fill="#fff4c8" stroke="#c42828" stroke-width=".7"/>
      <path d="M42 22 L46 28 M44 22 L42 28" stroke="#c42828" stroke-width=".6"/>`),
    drake: ms(`${mg}<path d="M10 50 Q24 28 44 42 Q64 56 78 22" fill="none" stroke="#286040" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="28" cy="36" rx="12" ry="9" fill="#388050"/>
      <circle cx="24" cy="34" r="2" fill="#ffe040" filter="url(#pz-glow)"/>
      <path d="M16 32 Q8 18 18 12" stroke="#286040" stroke-width="2.4" fill="none"/>
      <path d="M52 28 L74 10 L66 36 Z" fill="#48a060"/>
      <path d="M20 28 Q28 20 22 16" stroke="#efe4c8" stroke-width="1.2" fill="none"/>`),
    deathk: ms(`${mg}<rect x="30" y="56" width="8" height="12" rx="2" fill="#0a0810"/>
      <rect x="44" y="56" width="8" height="12" rx="2" fill="#0a0810"/>
      <path d="M18 48 Q44 36 66 50 L62 68 Q44 60 22 68 Z" fill="#1a1828"/>
      <ellipse cx="44" cy="50" rx="14" ry="10" fill="#2a2838"/>
      <ellipse cx="32" cy="30" rx="12" ry="12" fill="#3a3848"/>
      <path d="M20 24 Q32 12 44 24" fill="#1a1820"/>
      <ellipse cx="32" cy="18" rx="4" ry="3" fill="url(#pz-gold)" opacity=".7"/>
      <circle cx="28" cy="28" r="2.2" fill="#ff4040" filter="url(#pz-glow)"/>
      <rect x="60" y="18" width="3.4" height="40" fill="url(#pz-blade)" filter="url(#pz-glow)"/>
      <rect x="56" y="56" width="11" height="2.6" fill="url(#pz-gold)"/>`),
    slime: ms(`${mg}<ellipse cx="44" cy="50" rx="20" ry="14" fill="#4a5838"/>
      <ellipse cx="42" cy="44" rx="15" ry="11" fill="#6a7850" opacity=".8"/>
      <circle cx="34" cy="42" r="2.6" fill="#1a2810"/><circle cx="46" cy="42" r="2.6" fill="#1a2810"/>
      <ellipse cx="32" cy="36" rx="6" ry="3" fill="#fff" opacity=".3"/>`),
    demon: ms(`${mg}<rect x="30" y="56" width="8" height="12" rx="2" fill="#501010"/>
      <rect x="44" y="56" width="8" height="12" rx="2" fill="#501010"/>
      <ellipse cx="44" cy="50" rx="13" ry="10" fill="#902020"/>
      <path d="M16 24 L6 2 L28 24 Z" fill="#a03030"/><path d="M54 24 L66 2 L44 24 Z" fill="#a03030"/>
      <ellipse cx="32" cy="32" rx="13" ry="12" fill="#c04040"/>
      <circle cx="28" cy="30" r="2.4" fill="#ffe040" filter="url(#pz-glow)"/>
      <rect x="24" y="40" width="16" height="3" rx="1" fill="#2a0808"/>`),
    ant_queen: ms(`${mg}<ellipse cx="46" cy="50" rx="18" ry="12" fill="#503020" stroke="url(#pz-gold)" stroke-width="1"/>
      <ellipse cx="32" cy="34" rx="14" ry="11" fill="#684028"/>
      <circle cx="28" cy="32" r="2.4" fill="#ffd040" filter="url(#pz-glow)"/>
      <ellipse cx="32" cy="16" rx="10" ry="6" fill="url(#pz-gold)" opacity=".85"/>
      <path d="M20 18 Q32 8 44 18" stroke="url(#pz-gold)" stroke-width="1.6" fill="none"/>`),
    succubus_q: ms(`${mg}<rect x="30" y="56" width="8" height="12" rx="2" fill="#381828"/>
      <rect x="44" y="56" width="8" height="12" rx="2" fill="#381828"/>
      <path d="M20 48 Q44 36 68 50 L64 68 Q44 60 24 68 Z" fill="#582838"/>
      <path d="M14 18 L4 0 L28 18 Z" fill="#783848"/><path d="M66 18 L78 0 L52 18 Z" fill="#783848"/>
      <ellipse cx="34" cy="30" rx="14" ry="13" fill="#884858"/>
      <circle cx="30" cy="28" r="2.4" fill="#ff4060" filter="url(#pz-glow)"/>
      <path d="M14 8 Q44 0 74 8" stroke="url(#pz-gold)" stroke-width="2.4" fill="none"/>`),
    dwarf: ms(`${mg}<rect x="34" y="56" width="8" height="12" rx="2" fill="#3a4048"/>
      <rect x="46" y="56" width="8" height="12" rx="2" fill="#3a4048"/>
      <ellipse cx="44" cy="52" rx="13" ry="10" fill="#506878"/>
      <ellipse cx="36" cy="34" rx="12" ry="11" fill="#d8b090"/>
      <path d="M24 36 Q36 48 48 36" fill="#8a5030"/>
      <rect x="24" y="16" width="26" height="8" rx="2" fill="#687888"/>
      <circle cx="32" cy="32" r="1.8" fill="#1a1008"/>
      <rect x="56" y="34" width="5" height="24" fill="#6a5030"/>`),
    boar: ms(`${mg}<ellipse cx="46" cy="54" rx="16" ry="10" fill="#6a4830"/>
      <ellipse cx="34" cy="40" rx="13" ry="11" fill="#8a6040"/>
      <path d="M20 40 L10 46 L20 48 Z" fill="#f0d0b0"/>
      <circle cx="30" cy="36" r="1.8" fill="#1a1008"/>
      <path d="M16 28 L8 22" stroke="#6a4830" stroke-width="3" stroke-linecap="round"/>`),
    mushroom: ms(`${mg}<rect x="38" y="48" width="10" height="16" rx="3" fill="#e8dcc8"/>
      <ellipse cx="44" cy="40" rx="18" ry="14" fill="#a02828"/>
      <circle cx="36" cy="36" r="3" fill="#fff4c8" opacity=".7"/>
      <circle cx="50" cy="34" r="2.4" fill="#fff4c8" opacity=".7"/>`),
    golem: ms(`${mg}<rect x="28" y="54" width="10" height="12" rx="2" fill="#586068"/>
      <rect x="44" y="54" width="10" height="12" rx="2" fill="#586068"/>
      <rect x="26" y="22" width="32" height="34" rx="4" fill="#687078"/>
      <rect x="30" y="26" width="24" height="8" rx="2" fill="#889098"/>
      <circle cx="36" cy="30" r="2" fill="#ffe040"/><circle cx="48" cy="30" r="2" fill="#ffe040"/>`),
    arachne: ms(`${mg}<ellipse cx="44" cy="46" rx="13" ry="11" fill="#302020"/>
      <ellipse cx="36" cy="30" rx="11" ry="10" fill="#403030"/>
      <circle cx="32" cy="28" r="2.2" fill="#ff2020"/>
      <path d="M16 40 L8 32 M14 50 L4 52 M18 58 L8 64" stroke="#403030" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M58 40 L70 32 M60 50 L76 52 M58 58 L70 64" stroke="#403030" stroke-width="2.6" stroke-linecap="round"/>`),
    zombie: ms(`${mg}<rect x="36" y="56" width="6" height="12" fill="#4a5850"/>
      <rect x="46" y="56" width="6" height="12" fill="#4a5850"/>
      <path d="M28 46 L56 44 L54 60 L30 62 Z" fill="#5a6858" opacity=".7"/>
      <ellipse cx="34" cy="32" rx="11" ry="11" fill="#6a7868"/>
      <circle cx="30" cy="30" r="2.2" fill="#fff"/><circle cx="40" cy="30" r="1.6" fill="#1a1008"/>`),
    bear: ms(`${mg}<ellipse cx="46" cy="54" rx="18" ry="11" fill="#503820"/>
      <ellipse cx="34" cy="38" rx="14" ry="12" fill="#705030"/>
      <circle cx="24" cy="26" r="5" fill="#705030"/><circle cx="44" cy="26" r="5" fill="#705030"/>
      <circle cx="30" cy="36" r="2" fill="#1a1008"/>`),
    ghoul: ms(`${mg}<rect x="36" y="56" width="6" height="12" fill="#3a4840"/>
      <ellipse cx="34" cy="32" rx="11" ry="11" fill="#4a5850"/>
      <circle cx="30" cy="30" r="2.4" fill="#80ff80" filter="url(#pz-glow)"/>
      <path d="M26 38 Q34 42 42 38" stroke="#2a3830" fill="none"/>
      <path d="M52 36 L68 28" stroke="#4a5850" stroke-width="4" stroke-linecap="round"/>`),
    ant: ms(`${mg}<ellipse cx="46" cy="50" rx="12" ry="9" fill="#302018"/>
      <ellipse cx="34" cy="36" rx="9" ry="8" fill="#403028"/>
      <circle cx="30" cy="34" r="1.6" fill="#1a1008"/>
      <path d="M22 44 L10 38 M22 52 L8 54" stroke="#403028" stroke-width="2.2" stroke-linecap="round"/>`),
    scorpion: ms(`${mg}<ellipse cx="40" cy="48" rx="14" ry="9" fill="#604020"/>
      <ellipse cx="32" cy="36" rx="10" ry="8" fill="#806030"/>
      <circle cx="28" cy="34" r="1.8" fill="#ff2020"/>
      <path d="M54 40 L70 18" stroke="#806030" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="70" cy="16" r="3" fill="#c04040"/>`),
    lizard: ms(`${mg}<ellipse cx="44" cy="52" rx="15" ry="9" fill="#3a6848"/>
      <ellipse cx="32" cy="36" rx="11" ry="9" fill="#4a8860"/>
      <circle cx="28" cy="34" r="2" fill="#ffe040"/>
      <path d="M56 44 Q72 30 74 18" stroke="#3a6848" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    ogre: ms(`${mg}<rect x="30" y="56" width="10" height="12" rx="2" fill="#405830"/>
      <rect x="44" y="56" width="10" height="12" rx="2" fill="#405830"/>
      <ellipse cx="44" cy="50" rx="16" ry="12" fill="#506838"/>
      <ellipse cx="32" cy="30" rx="14" ry="13" fill="#608848"/>
      <circle cx="28" cy="28" r="2.4" fill="#ffe040"/>
      <rect x="58" y="28" width="6" height="28" fill="#4a3820"/>`),
    darkelf: ms(`${mg}<rect x="34" y="56" width="6" height="12" fill="#1a2030"/>
      <path d="M22 48 Q44 36 64 50 L60 66 Q44 58 26 66 Z" fill="#283048"/>
      <ellipse cx="34" cy="32" rx="11" ry="11" fill="#384858"/>
      <path d="M22 24 Q34 12 46 24" fill="#1a2030"/>
      <circle cx="32" cy="30" r="1.8" fill="#c0a0ff"/>
      <rect x="58" y="24" width="3.2" height="34" fill="url(#pz-blade)"/>`),
    succubus: ms(`${mg}<path d="M22 50 Q44 38 66 52 L62 68 Q44 60 26 68 Z" fill="#482838"/>
      <path d="M16 18 L8 2 L26 18 Z" fill="#683848"/><path d="M58 18 L68 2 L48 18 Z" fill="#683848"/>
      <ellipse cx="34" cy="32" rx="12" ry="12" fill="#683848"/>
      <circle cx="30" cy="30" r="2.2" fill="#ff4060"/>
      <path d="M18 10 Q44 2 70 10" stroke="#804060" stroke-width="2.4" fill="none"/>`),
    gargoyle: ms(`${mg}<path d="M24 62 L44 16 L64 62 Z" fill="#687078"/>
      <circle cx="38" cy="36" r="2.4" fill="#ff4040"/><circle cx="50" cy="36" r="2.4" fill="#ff4040"/>
      <path d="M16 40 L6 28 L20 36 Z" fill="#687078"/><path d="M72 40 L82 28 L68 36 Z" fill="#687078"/>`),
    harpy: ms(`${mg}<ellipse cx="44" cy="48" rx="12" ry="10" fill="#584838"/>
      <ellipse cx="36" cy="32" rx="10" ry="9" fill="#d8c8a0"/>
      <path d="M18 40 Q8 20 22 16" fill="#c8b090"/><path d="M58 40 Q78 16 64 12" fill="#c8b090"/>
      <circle cx="32" cy="30" r="1.8" fill="#1a1008"/>`),
    medusa: ms(`${mg}<path d="M22 50 Q44 38 64 52 L60 68 Q44 60 26 68 Z" fill="#3a5848"/>
      <ellipse cx="34" cy="32" rx="12" ry="12" fill="#d8c8a0"/>
      <path d="M22 18 Q18 4 28 16 M34 12 Q36 0 40 14 M48 18 Q56 4 50 20" stroke="#3a8848" stroke-width="2.4" fill="none"/>
      <circle cx="30" cy="30" r="1.8" fill="#ffe040"/>`),
    unicorn: ms(`${mg}<ellipse cx="46" cy="54" rx="14" ry="9" fill="#e8e0d0"/>
      <ellipse cx="32" cy="38" rx="11" ry="10" fill="#f4eee4"/>
      <path d="M30 18 L34 4 L38 20 Z" fill="url(#pz-gold)"/>
      <circle cx="28" cy="36" r="1.6" fill="#1a1008"/>
      <path d="M58 48 Q72 32 76 16" stroke="#e8e0d0" stroke-width="4.5" fill="none"/>`),
    lich: ms(`${mg}<path d="M20 48 Q44 36 66 50 L62 68 Q44 60 24 68 Z" fill="#2a1840"/>
      <ellipse cx="34" cy="30" rx="11" ry="11" fill="#f0e8d8"/>
      <circle cx="30" cy="28" r="2.4" fill="#7ec8ff" filter="url(#pz-glow)"/>
      <rect x="58" y="24" width="4.2" height="36" fill="#4a2878"/>
      <circle cx="60" cy="22" r="5" fill="#c9a0ff" filter="url(#pz-glow)"/>`),
    guardian: ms(`${mg}<rect x="30" y="54" width="10" height="14" rx="2" fill="#3a4048"/>
      <path d="M22 28 L44 12 L66 28 L62 62 H26 Z" fill="#687078" stroke="url(#pz-gold)" stroke-width=".8"/>
      <circle cx="38" cy="32" r="2" fill="#ffe040"/><circle cx="50" cy="32" r="2" fill="#ffe040"/>
      <rect x="36" y="40" width="16" height="8" fill="#3a4048"/>`),
  };

  const alias = {
    kobold: "goblin", hobgob: "goblin", orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf", dw_f: "dwarf",
    skel_a: "skeleton", sparto: "skeleton",
    iron_golem: "golem", ant_s: "ant", yangol: "scorpion",
    hellhound: "wolf", bugbear: "ogre",
    ancient: "drake", lindvior: "drake", fafurion: "drake", antharas: "drake", valakas: "drake",
    balrog: "demon", baphomet: "demon",
    black_elder: "lich", succubus_q: "succubus_q",
  };

  return {
    hero: (cls, g) => heroes[`${cls || "knight"}_${g === "f" ? "f" : "m"}`] || heroes.knight_m,
    mob: (id) => mobs[alias[id] || id] || mobs.orc,
  };
})();
