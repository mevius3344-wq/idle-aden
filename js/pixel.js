/* 武俠江湖 — 華麗漸層側向 SVG（角色／魔物） */
window.PIXEL = (() => {
  const D = `<defs>
    <linearGradient id="pz-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff4c8"/><stop offset="45%" stop-color="#d4af37"/><stop offset="100%" stop-color="#8a6020"/></linearGradient>
    <linearGradient id="pz-silk-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c42828"/><stop offset="55%" stop-color="#6e1010"/><stop offset="100%" stop-color="#3a0808"/></linearGradient>
    <linearGradient id="pz-silk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2d8a48"/><stop offset="55%" stop-color="#1a5028"/><stop offset="100%" stop-color="#0c2814"/></linearGradient>
    <linearGradient id="pz-silk-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a48c8"/><stop offset="55%" stop-color="#402070"/><stop offset="100%" stop-color="#1a0c30"/></linearGradient>
    <linearGradient id="pz-blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fcff"/><stop offset="40%" stop-color="#b8c8d8"/><stop offset="100%" stop-color="#687888"/></linearGradient>
    <linearGradient id="pz-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe8d0"/><stop offset="100%" stop-color="#e8b890"/></linearGradient>
    <radialGradient id="pz-aura-g" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#9be37d" stop-opacity=".35"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <radialGradient id="pz-aura-r" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#ff8060" stop-opacity=".28"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <radialGradient id="pz-aura-p" cx="50%" cy="80%" r="55%"><stop offset="0%" stop-color="#c9a0ff" stop-opacity=".32"/><stop offset="100%" stop-opacity="0"/></radialGradient>
    <filter id="pz-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="pz-soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>`;

  const hs = (inner) =>
    `<svg viewBox="0 0 96 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${D}${inner}</svg>`;
  const ms = (inner) =>
    `<svg viewBox="0 0 88 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${D}${inner}</svg>`;

  const gnd = `<ellipse cx="50" cy="112" rx="22" ry="5" fill="rgba(0,0,0,.45)"/>`;
  const mg = `<ellipse cx="44" cy="72" rx="20" ry="4" fill="rgba(0,0,0,.42)"/>`;

  const heroes = {
    knight_m: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-r)"/>
      <path d="M14 78 Q34 48 48 66 L44 104 Q28 96 16 104 Z" fill="url(#pz-silk-r)" filter="url(#pz-soft)"/>
      <path d="M38 70 L64 66 L62 94 L40 98 Z" fill="#1a5858" stroke="url(#pz-gold)" stroke-width=".8"/>
      <path d="M42 72 L60 69 L58 82 L44 84 Z" fill="#287878" opacity=".85"/>
      <rect x="40" y="86" width="20" height="4" rx="1" fill="url(#pz-gold)"/>
      <rect x="38" y="92" width="10" height="14" rx="2" fill="#2a1810"/><rect x="50" y="92" width="10" height="14" rx="2" fill="#2a1810"/>
      <circle cx="48" cy="48" r="13" fill="url(#pz-skin)"/>
      <path d="M36 34 Q48 18 60 34 Q58 28 48 24 Q38 28 36 34 Z" fill="#1a1008"/>
      <rect x="44" y="20" width="8" height="10" rx="3" fill="#1a1008"/><ellipse cx="48" cy="18" rx="5" ry="4" fill="url(#pz-gold)" opacity=".7"/>
      <rect x="44" y="46" width="8" height="3" rx="1" fill="#1a1008"/>
      <circle cx="44" cy="47" r="1.5" fill="#1a1008"/><circle cx="52" cy="47" r="1.5" fill="#1a1008"/>
      <path d="M66 42 L72 8 L78 42 Z" fill="url(#pz-blade)" filter="url(#pz-glow)"/>
      <rect x="62" y="40" width="16" height="5" rx="1" fill="url(#pz-gold)"/>
      <rect x="68" y="44" width="5" height="38" rx="1" fill="url(#pz-blade)"/>`),

    knight_f: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-r)"/>
      <path d="M16 78 Q36 50 48 68 L44 104 Q30 96 18 104 Z" fill="url(#pz-silk-r)" filter="url(#pz-soft)"/>
      <path d="M38 72 L60 70 L58 94 L40 98 Z" fill="#1a5858" stroke="url(#pz-gold)" stroke-width=".8"/>
      <path d="M30 56 Q34 98 44 100 Q50 78 62 100 Q72 98 74 56 Z" fill="#8b1a1a" opacity=".9"/>
      <circle cx="48" cy="48" r="12" fill="url(#pz-skin)"/>
      <path d="M32 38 Q48 20 64 38 Q62 30 48 26 Q34 30 32 38 Z" fill="#1a0808"/>
      <path d="M34 32 Q48 14 62 32 L58 52 Q48 58 38 52 Z" fill="#2a1010"/>
      <circle cx="44" cy="47" r="1.4" fill="#1a1008"/><circle cx="52" cy="47" r="1.4" fill="#1a1008"/>
      <path d="M66 44 L72 10 L78 44 Z" fill="url(#pz-blade)" filter="url(#pz-glow)"/>
      <rect x="64" y="42" width="14" height="4" fill="url(#pz-gold)"/>`),

    elf_m: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-g)"/>
      <path d="M18 76 Q38 50 50 68 L46 104 Q32 96 20 104 Z" fill="url(#pz-silk-g)" filter="url(#pz-soft)"/>
      <path d="M40 72 L58 70 L56 94 L42 98 Z" fill="#246838" stroke="#9be37d" stroke-width=".6"/>
      <path d="M24 40 L32 14 L36 48 Z" fill="#d8c46a"/>
      <circle cx="48" cy="46" r="12" fill="url(#pz-skin)"/>
      <path d="M34 32 Q48 16 62 34 Q60 26 48 22 Q36 26 34 32 Z" fill="#d8c46a"/>
      <circle cx="52" cy="46" r="1.5" fill="#1a1008"/><circle cx="53" cy="45" r=".5" fill="#fff"/>
      <path d="M62 46 Q82 18 86 66 Q74 58 64 68 Z" fill="none" stroke="#6a4018" stroke-width="2.8"/>
      <line x1="66" y1="36" x2="66" y2="72" stroke="#efe4c8" stroke-width="1.2"/>
      <path d="M66 52 L84 46" stroke="url(#pz-blade)" stroke-width="1.4" filter="url(#pz-glow)"/>`),

    elf_f: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-g)"/>
      <path d="M18 76 Q38 50 50 68 L46 104 Q32 96 20 104 Z" fill="url(#pz-silk-g)" filter="url(#pz-soft)"/>
      <path d="M40 72 L58 70 L56 94 L42 98 Z" fill="#246838" stroke="#9be37d" stroke-width=".6"/>
      <path d="M24 38 L32 12 L36 50 Z" fill="#8fd98a"/>
      <path d="M32 54 Q36 100 46 100 Q52 76 62 100 Q72 100 74 54 Z" fill="#8fd98a" opacity=".85"/>
      <circle cx="48" cy="46" r="12" fill="url(#pz-skin)"/>
      <path d="M34 30 Q48 14 62 32 Q60 24 48 20 Q36 24 34 30 Z" fill="#8fd98a"/>
      <circle cx="52" cy="46" r="1.5" fill="#1a1008"/>
      <path d="M62 46 Q82 18 86 66 Q74 58 64 68 Z" fill="none" stroke="#6a4018" stroke-width="2.8"/>`),

    mage_m: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-p)"/>
      <path d="M16 74 Q42 48 56 72 L54 104 Q34 96 18 104 Z" fill="url(#pz-silk-p)" filter="url(#pz-soft)"/>
      <path d="M40 72 L60 70 L58 96 L42 98 Z" fill="#502878" stroke="url(#pz-gold)" stroke-width=".6"/>
      <rect x="40" y="84" width="18" height="3" fill="url(#pz-gold)"/>
      <circle cx="48" cy="50" r="11" fill="url(#pz-skin)"/>
      <path d="M14 48 L48 4 L82 48 Z" fill="#3c1868" stroke="url(#pz-gold)" stroke-width=".8"/>
      <path d="M20 48 L48 12 L76 48 Z" fill="#5a2a98" opacity=".85"/>
      <ellipse cx="48" cy="46" rx="30" ry="6" fill="#241040"/>
      <rect x="20" y="44" width="56" height="3" fill="url(#pz-gold)"/>
      <circle cx="48" cy="8" r="4" fill="#ffe27a" filter="url(#pz-glow)"/>
      <circle cx="52" cy="50" r="1.5" fill="#1a1008"/>
      <rect x="68" y="48" width="5" height="46" rx="1" fill="#5a3820"/>
      <circle cx="70.5" cy="44" r="8" fill="#7ec8ff" filter="url(#pz-glow)"/>
      <circle cx="70.5" cy="44" r="3.5" fill="#e8f8ff"/>`),

    mage_f: hs(`${gnd}<ellipse cx="48" cy="88" rx="28" ry="18" fill="url(#pz-aura-p)"/>
      <path d="M16 74 Q42 48 56 72 L54 104 Q34 96 18 104 Z" fill="url(#pz-silk-p)" filter="url(#pz-soft)"/>
      <path d="M40 72 L58 70 L56 96 L42 98 Z" fill="#502878" stroke="url(#pz-gold)" stroke-width=".6"/>
      <path d="M30 56 Q34 100 44 100 Q50 78 62 100 Q72 100 74 56 Z" fill="#241040"/>
      <circle cx="48" cy="50" r="11" fill="url(#pz-skin)"/>
      <path d="M18 48 L48 6 L78 48 Z" fill="#3c1868" stroke="url(#pz-gold)" stroke-width=".8"/>
      <ellipse cx="48" cy="46" rx="28" ry="6" fill="#241040"/>
      <circle cx="48" cy="10" r="4" fill="#ffe27a" filter="url(#pz-glow)"/>
      <circle cx="52" cy="50" r="1.5" fill="#1a1008"/>
      <rect x="68" y="48" width="5" height="46" rx="1" fill="#5a3820"/>
      <circle cx="70.5" cy="44" r="8" fill="#c9a0ff" filter="url(#pz-glow)"/>`),
  };

  const mobs = {
    rabbit: ms(`${mg}<ellipse cx="48" cy="54" rx="12" ry="8" fill="#e8d0b8" stroke="#c8a888" stroke-width=".6"/>
      <ellipse cx="54" cy="28" rx="3.5" ry="14" fill="#e8d0b8"/><ellipse cx="62" cy="30" rx="3" ry="12" fill="#dcc0a0"/>
      <ellipse cx="38" cy="42" rx="11" ry="9" fill="#f0e0c8"/><circle cx="34" cy="40" r="2" fill="#1a1008"/>
      <ellipse cx="30" cy="44" rx="3" ry="2" fill="#f0a090"/>`),
    goblin: ms(`${mg}<rect x="36" y="54" width="6" height="12" rx="2" fill="#2a4818"/>
      <rect x="46" y="54" width="6" height="12" rx="2" fill="#2a4818"/>
      <ellipse cx="44" cy="50" rx="11" ry="9" fill="#4a8838" stroke="#2a5828" stroke-width=".8"/>
      <path d="M24 34 L16 12 L30 34 Z" fill="#5ca048"/>
      <ellipse cx="34" cy="36" rx="12" ry="11" fill="#68b058"/>
      <circle cx="30" cy="34" r="2" fill="#ffe040" filter="url(#pz-glow)"/>
      <rect x="54" y="34" width="5" height="24" fill="#6a5030" rx="1"/>`),
    orc: ms(`${mg}<rect x="32" y="54" width="8" height="12" rx="2" fill="#4a3020"/>
      <rect x="44" y="54" width="8" height="12" rx="2" fill="#4a3020"/>
      <ellipse cx="44" cy="50" rx="13" ry="10" fill="#8a6040" stroke="#5a3820" stroke-width=".8"/>
      <path d="M20 30 L10 8 L26 30 Z" fill="#a07050"/>
      <ellipse cx="32" cy="34" rx="13" ry="12" fill="#b88058"/>
      <circle cx="28" cy="32" r="2" fill="#ff4030" filter="url(#pz-glow)"/>
      <rect x="24" y="40" width="16" height="4" rx="1" fill="#f0d0a0"/>
      <path d="M56 30 L72 16 L68 38 Z" fill="url(#pz-blade)"/>
      <rect x="58" y="36" width="5" height="26" fill="#5a4028" rx="1"/>`),
    wolf: ms(`${mg}<path d="M58 52 Q74 38 78 20" stroke="#505868" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="54" rx="15" ry="9" fill="#586068" stroke="#384048" stroke-width=".8"/>
      <path d="M18 34 L10 12 L28 36 Z" fill="#788088"/>
      <ellipse cx="30" cy="40" rx="12" ry="10" fill="#889098"/>
      <circle cx="26" cy="38" r="2" fill="#ffe040" filter="url(#pz-glow)"/>`),
    skeleton: ms(`${mg}<rect x="36" y="54" width="5" height="12" fill="#e8e0d0"/>
      <rect x="46" y="54" width="5" height="12" fill="#e8e0d0"/>
      <rect x="34" y="40" width="22" height="16" rx="2" fill="#f0e8d8" stroke="#c8c0b0" stroke-width=".6"/>
      <ellipse cx="36" cy="28" rx="11" ry="11" fill="#f8f0e0" stroke="#d8d0c0" stroke-width=".6"/>
      <circle cx="32" cy="26" r="2.5" fill="#ff4040" filter="url(#pz-glow)"/>
      <rect x="56" y="30" width="5" height="28" fill="#e8e0d0"/>
      <path d="M58 26 L72 16 L68 36 Z" fill="url(#pz-blade)"/>`),
    floating: ms(`${mg}<circle cx="44" cy="38" r="20" fill="#8040a0" opacity=".4"/>
      <circle cx="44" cy="38" r="17" fill="#a060c0" stroke="#d080ff" stroke-width="1.2"/>
      <circle cx="44" cy="38" r="9" fill="#1a0820"/>
      <circle cx="44" cy="38" r="5" fill="#ff4040" filter="url(#pz-glow)"/>
      <circle cx="38" cy="32" r="2" fill="#fff" opacity=".7"/>`),
    drake: ms(`${mg}<ellipse cx="44" cy="52" rx="18" ry="10" fill="#286040" stroke="#1a4030" stroke-width=".8"/>
      <ellipse cx="30" cy="38" rx="12" ry="10" fill="#388050"/>
      <circle cx="26" cy="36" r="2" fill="#ffe040" filter="url(#pz-glow)"/>
      <path d="M52 32 L74 14 L66 40 Z" fill="#48a060"/>
      <path d="M12 40 Q4 26 10 12" stroke="#388050" stroke-width="5" fill="none" stroke-linecap="round"/>`),
    deathk: ms(`${mg}<rect x="30" y="54" width="8" height="12" rx="2" fill="#0a0810"/>
      <rect x="44" y="54" width="8" height="12" rx="2" fill="#0a0810"/>
      <ellipse cx="44" cy="50" rx="14" ry="10" fill="#1a1828" stroke="#404060" stroke-width=".8"/>
      <ellipse cx="32" cy="30" rx="12" ry="12" fill="#2a2838" stroke="#606080" stroke-width=".6"/>
      <circle cx="28" cy="28" r="2.5" fill="#ff4040" filter="url(#pz-glow)"/>
      <rect x="56" y="26" width="6" height="32" fill="#1a1828"/>
      <path d="M58 22 L74 12 L70 34 Z" fill="url(#pz-blade)" filter="url(#pz-glow)"/>`),
    slime: ms(`${mg}<ellipse cx="44" cy="48" rx="20" ry="15" fill="#38a048" stroke="#288038" stroke-width=".8"/>
      <ellipse cx="42" cy="42" rx="15" ry="12" fill="#58d068" opacity=".75"/>
      <circle cx="34" cy="40" r="2.8" fill="#1a4020"/><circle cx="46" cy="40" r="2.8" fill="#1a4020"/>
      <ellipse cx="32" cy="34" rx="6" ry="3.5" fill="#fff" opacity=".45"/>`),
    demon: ms(`${mg}<rect x="30" y="54" width="8" height="12" rx="2" fill="#501010"/>
      <rect x="44" y="54" width="8" height="12" rx="2" fill="#501010"/>
      <ellipse cx="44" cy="50" rx="13" ry="10" fill="#902020" stroke="#601010" stroke-width=".8"/>
      <path d="M16 26 L8 4 L28 26 Z" fill="#a03030"/><path d="M54 26 L66 4 L44 26 Z" fill="#a03030"/>
      <ellipse cx="32" cy="32" rx="13" ry="12" fill="#c04040"/>
      <circle cx="28" cy="30" r="2.5" fill="#ff6060" filter="url(#pz-glow)"/>`),
    ant_queen: ms(`${mg}<ellipse cx="46" cy="48" rx="18" ry="12" fill="#503020" stroke="url(#pz-gold)" stroke-width="1"/>
      <ellipse cx="32" cy="32" rx="14" ry="11" fill="#684028"/>
      <circle cx="28" cy="30" r="2.5" fill="#ffd040" filter="url(#pz-glow)"/>
      <ellipse cx="32" cy="16" rx="10" ry="6" fill="url(#pz-gold)" opacity=".85"/>`),
    succubus_q: ms(`${mg}<rect x="30" y="54" width="8" height="12" rx="2" fill="#381828"/>
      <rect x="44" y="54" width="8" height="12" rx="2" fill="#381828"/>
      <ellipse cx="44" cy="50" rx="15" ry="12" fill="#582838" stroke="#ffd040" stroke-width=".8"/>
      <path d="M14 20 L6 0 L28 20 Z" fill="#783848"/><path d="M66 20 L76 0 L52 20 Z" fill="#783848"/>
      <ellipse cx="34" cy="30" rx="14" ry="13" fill="#884858"/>
      <circle cx="30" cy="28" r="2.5" fill="#ff4060" filter="url(#pz-glow)"/>
      <path d="M14 8 Q44 0 74 8" stroke="url(#pz-gold)" stroke-width="2.5" fill="none"/>`),
  };

  const alias = {
    fox: "rabbit", kobold: "goblin", hobgob: "goblin", orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf", dwarf: "orc", dw_f: "orc",
    skel_a: "skeleton", sparto: "skeleton", zombie: "skeleton", lich: "skeleton",
    mushroom: "floating", golem: "orc", arachne: "floating", bear: "orc", ghoul: "skeleton",
    ant: "goblin", ant_s: "goblin", scorpion: "wolf", lizard: "orc", bugbear: "orc",
    hellhound: "wolf", ogre: "orc", darkelf: "skeleton", succubus: "floating",
    gargoyle: "floating", ancient: "drake", balrog: "demon", harpy: "floating",
    medusa: "floating", unicorn: "rabbit", iron_golem: "orc", guardian: "deathk",
    baphomet: "demon", black_elder: "deathk", lindvior: "drake", fafurion: "drake",
    antharas: "drake", valakas: "drake", succubus_q: "succubus_q",
  };

  return {
    hero: (cls, g) => heroes[`${cls || "knight"}_${g === "f" ? "f" : "m"}`] || heroes.knight_m,
    mob: (id) => mobs[alias[id] || id] || mobs.orc,
  };
})();
