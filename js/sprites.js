/* 原創 SVG：怪物與技能（天堂系放置風格） */
window.SPRITES = (() => {
  const s = (inner, vb = "0 0 64 64") =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const sk = (inner) => s(inner, "0 0 32 32");

  const shadow = `<ellipse cx="32" cy="58" rx="18" ry="4" fill="rgba(0,0,0,.35)"/>`;

  const mobs = {
    rabbit: s(`${shadow}<ellipse cx="32" cy="38" rx="14" ry="11" fill="#c8b0a0"/><circle cx="32" cy="24" r="10" fill="#dcc8b8"/><ellipse cx="22" cy="14" rx="4" ry="11" fill="#dcc8b8" transform="rotate(-12 22 14)"/><ellipse cx="42" cy="14" rx="4" ry="11" fill="#dcc8b8" transform="rotate(12 42 14)"/><circle cx="28" cy="22" r="2" fill="#2a1810"/><circle cx="36" cy="22" r="2" fill="#2a1810"/><ellipse cx="32" cy="27" rx="3" ry="2" fill="#ffb0a0"/>`),

    fox: s(`${shadow}<path d="M18 18 L24 8 L30 18 Z" fill="#c06028"/><path d="M34 18 L40 8 L46 18 Z" fill="#c06028"/><ellipse cx="32" cy="36" rx="16" ry="13" fill="#d87830"/><ellipse cx="32" cy="24" r="11" fill="#e89040"/><circle cx="27" cy="22" r="2.5" fill="#1a1008"/><circle cx="37" cy="22" r="2.5" fill="#1a1008"/><path d="M32 26 L32 30" stroke="#1a1008" stroke-width="1.5"/><path d="M48 34 Q58 28 62 22" stroke="#d87830" stroke-width="5" fill="none" stroke-linecap="round"/>`),

    goblin: s(`${shadow}<ellipse cx="32" cy="40" rx="13" ry="14" fill="#4a8a38"/><circle cx="32" cy="24" r="12" fill="#5ca048"/><path d="M18 18 L14 8 L22 16 Z" fill="#5ca048"/><path d="M46 18 L50 8 L42 16 Z" fill="#5ca048"/><circle cx="27" cy="22" r="3" fill="#ffe040"/><circle cx="37" cy="22" r="3" fill="#ffe040"/><ellipse cx="32" cy="28" rx="5" ry="3" fill="#2a5820"/><rect x="26" y="44" width="5" height="12" rx="2" fill="#3a6028"/><rect x="33" y="44" width="5" height="12" rx="2" fill="#3a6028"/><rect x="44" y="30" width="4" height="18" fill="#6a5030" transform="rotate(20 44 30)"/>`),

    orc: s(`${shadow}<ellipse cx="32" cy="40" rx="15" ry="15" fill="#6a4830"/><circle cx="32" cy="23" r="13" fill="#8a6040"/><path d="M20 16 L16 6 L24 14 Z" fill="#6a4830"/><path d="M44 16 L48 6 L40 14 Z" fill="#6a4830"/><circle cx="26" cy="21" r="2.5" fill="#ff3020"/><circle cx="38" cy="21" r="2.5" fill="#ff3020"/><rect x="24" y="26" width="16" height="4" rx="2" fill="#f0d0a0"/><rect x="48" y="28" width="5" height="22" fill="#5a4028" transform="rotate(15 48 28)"/><path d="M52 24 L60 20 L58 28 Z" fill="#a0a8b0"/>`),

    dwarf: s(`${shadow}<ellipse cx="32" cy="42" rx="14" ry="12" fill="#506878"/><rect x="20" cy="18" width="24" height="16" rx="4" fill="#708898"/><rect x="18" y="14" width="28" height="8" rx="3" fill="#8098a8"/><rect x="24" y="20" width="16" height="3" fill="#304050"/><rect x="44" y="32" width="5" height="16" fill="#6a5030"/><circle cx="28" cy="22" r="2" fill="#1a1008"/><circle cx="36" cy="22" r="2" fill="#1a1008"/>`),

    slime: s(`${shadow}<ellipse cx="32" cy="42" rx="20" ry="14" fill="#48a858" opacity=".85"/><ellipse cx="32" cy="36" rx="16" ry="12" fill="#68c878" opacity=".9"/><ellipse cx="28" cy="32" rx="4" ry="3" fill="#fff" opacity=".5"/><circle cx="26" cy="34" r="3" fill="#1a4020"/><circle cx="36" cy="34" r="3" fill="#1a4020"/><ellipse cx="32" cy="40" rx="3" ry="2" fill="#2a6830"/>`),

    boar: s(`${shadow}<ellipse cx="32" cy="40" rx="18" ry="12" fill="#6a4830"/><ellipse cx="32" cy="30" rx="14" ry="11" fill="#8a6040"/><path d="M18 28 L12 32 L18 34 Z" fill="#f0d0b0"/><circle cx="26" cy="26" r="2" fill="#1a1008"/><circle cx="36" cy="26" r="2" fill="#1a1008"/><path d="M32 30 L32 34" stroke="#1a1008" stroke-width="1.5"/><path d="M14 22 L8 18" stroke="#6a4830" stroke-width="3" stroke-linecap="round"/><path d="M50 22 L56 18" stroke="#6a4830" stroke-width="3" stroke-linecap="round"/>`),

    wolf: s(`${shadow}<ellipse cx="32" cy="42" rx="16" ry="11" fill="#505860"/><ellipse cx="32" cy="28" rx="12" ry="10" fill="#687078"/><path d="M20 18 L16 8 L26 16 Z" fill="#687078"/><path d="M44 18 L48 8 L38 16 Z" fill="#687078"/><circle cx="27" cy="24" r="2.5" fill="#ffe040"/><circle cx="37" cy="24" r="2.5" fill="#ffe040"/><path d="M32 28 L32 32" stroke="#304040" stroke-width="1.5"/><path d="M48 36 Q58 30 62 24" stroke="#505860" stroke-width="4" fill="none" stroke-linecap="round"/>`),

    floating: s(`${shadow}<ellipse cx="32" cy="36" rx="22" ry="18" fill="#8040a0" opacity=".7"/><circle cx="32" cy="32" r="18" fill="#a060c0" opacity=".85"/><circle cx="32" cy="32" r="10" fill="#1a0820"/><circle cx="32" cy="32" r="5" fill="#ff4040"/><circle cx="28" cy="28" r="2" fill="#fff" opacity=".6"/>`),

    mushroom: s(`${shadow}<rect x="26" y="36" width="12" height="16" rx="3" fill="#e8dcc8"/><ellipse cx="32" cy="32" rx="18" ry="14" fill="#c04040"/><circle cx="24" cy="28" r="3" fill="#fff" opacity=".7"/><circle cx="36" cy="26" r="2.5" fill="#fff" opacity=".7"/><circle cx="32" cy="34" r="2" fill="#fff" opacity=".6"/>`),

    skeleton: s(`${shadow}<rect x="28" y="20" width="8" height="10" rx="2" fill="#e8e0d0"/><circle cx="32" cy="16" r="9" fill="#f0e8d8"/><circle cx="28" cy="14" r="3" fill="#1a1008"/><circle cx="36" cy="14" r="3" fill="#1a1008"/><rect x="24" y="30" width="16" height="14" rx="2" fill="#e8e0d0"/><line x1="32" y1="30" x2="32" y2="44" stroke="#c8c0b0" stroke-width="2"/><rect x="18" y="32" width="28" height="3" fill="#e8e0d0"/><rect x="26" y="44" width="4" height="12" fill="#e8e0d0"/><rect x="34" y="44" width="4" height="12" fill="#e8e0d0"/>`),

    golem: s(`${shadow}<rect x="18" y="16" width="28" height="32" rx="4" fill="#687078"/><rect x="22" y="20" width="20" height="8" rx="2" fill="#889098"/><circle cx="27" cy="24" r="2" fill="#ffe040"/><circle cx="37" cy="24" r="2" fill="#ffe040"/><rect x="20" y="48" width="10" height="10" rx="2" fill="#586068"/><rect x="34" y="48" width="10" height="10" rx="2" fill="#586068"/><rect x="14" y="28" width="8" height="18" rx="2" fill="#687078"/><rect x="42" y="28" width="8" height="18" rx="2" fill="#687078"/>`),

    arachne: s(`${shadow}<ellipse cx="32" cy="36" rx="14" ry="12" fill="#302020"/><circle cx="32" cy="22" r="10" fill="#403030"/><circle cx="28" cy="20" r="3" fill="#ff2020"/><circle cx="36" cy="20" r="3" fill="#ff2020"/><path d="M12 30 L22 34 M10 38 L22 38 M12 46 L22 42" stroke="#403030" stroke-width="3" stroke-linecap="round"/><path d="M52 30 L42 34 M54 38 L42 38 M52 46 L42 42" stroke="#403030" stroke-width="3" stroke-linecap="round"/>`),

    zombie: s(`${shadow}<ellipse cx="32" cy="42" rx="13" ry="12" fill="#4a6850"/><circle cx="32" cy="24" r="11" fill="#5a7860"/><circle cx="27" cy="22" r="3" fill="#fff"/><circle cx="37" cy="22" r="2" fill="#1a1008"/><path d="M24 28 L40 28" stroke="#3a4838" stroke-width="2"/><rect x="26" y="44" width="5" height="10" fill="#4a5850"/><rect x="33" y="44" width="5" height="10" fill="#4a5850"/>`),

    bear: s(`${shadow}<ellipse cx="32" cy="42" rx="20" ry="14" fill="#503820"/><ellipse cx="32" cy="30" rx="16" ry="13" fill="#705030"/><circle cx="22" cy="20" r="6" fill="#705030"/><circle cx="42" cy="20" r="6" fill="#705030"/><circle cx="27" cy="28" r="2.5" fill="#1a1008"/><circle cx="37" cy="28" r="2.5" fill="#1a1008"/><ellipse cx="32" cy="34" rx="4" ry="3" fill="#403020"/>`),

    ghoul: s(`${shadow}<ellipse cx="32" cy="42" rx="13" ry="12" fill="#3a4840"/><circle cx="32" cy="24" r="11" fill="#4a5850"/><circle cx="27" cy="22" r="3" fill="#80ff80"/><circle cx="37" cy="22" r="3" fill="#80ff80"/><path d="M26 30 Q32 34 38 30" stroke="#2a3830" fill="none" stroke-width="2"/><path d="M48 32 L58 28" stroke="#4a5850" stroke-width="4" stroke-linecap="round"/>`),

    ant: s(`${shadow}<ellipse cx="32" cy="38" rx="12" ry="10" fill="#302018"/><ellipse cx="32" cy="26" rx="8" ry="7" fill="#403028"/><circle cx="28" cy="24" r="2" fill="#1a1008"/><circle cx="36" cy="24" r="2" fill="#1a1008"/><path d="M20 34 L10 30 M20 40 L8 42 M20 46 L10 48" stroke="#403028" stroke-width="2.5" stroke-linecap="round"/><path d="M44 34 L54 30 M44 40 L56 42 M44 46 L54 48" stroke="#403028" stroke-width="2.5" stroke-linecap="round"/>`),

    scorpion: s(`${shadow}<ellipse cx="32" cy="36" rx="14" ry="10" fill="#604020"/><ellipse cx="32" cy="26" rx="10" ry="8" fill="#806030"/><circle cx="28" cy="24" r="2" fill="#ff2020"/><circle cx="36" cy="24" r="2" fill="#ff2020"/><path d="M18 38 Q8 42 4 48" stroke="#806030" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M46 38 Q56 42 60 48" stroke="#806030" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M48 30 L62 18" stroke="#806030" stroke-width="4" stroke-linecap="round"/><circle cx="62" cy="16" r="3" fill="#c04040"/>`),

    lizard: s(`${shadow}<ellipse cx="32" cy="40" rx="15" ry="11" fill="#3a6848"/><ellipse cx="32" cy="26" rx="11" ry="9" fill="#4a8860"/><circle cx="27" cy="24" r="2.5" fill="#ffe040"/><circle cx="37" cy="24" r="2.5" fill="#ffe040"/><path d="M48 34 Q58 28 60 22" stroke="#3a6848" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="44" y="30" width="4" height="14" fill="#6a5030" transform="rotate(20 44 30)"/>`),

    bugbear: s(`${shadow}<ellipse cx="32" cy="42" rx="16" ry="14" fill="#506040"/><circle cx="32" cy="24" r="13" fill="#608050"/><circle cx="26" cy="21" r="2.5" fill="#ff3020"/><circle cx="38" cy="21" r="2.5" fill="#ff3020"/><rect x="46" y="26" width="6" height="24" fill="#5a4028" transform="rotate(10 46 26)"/><path d="M50 22 L58 18 L56 28 Z" fill="#808890"/>`),

    hellhound: s(`${shadow}<ellipse cx="32" cy="42" rx="16" ry="11" fill="#402018"/><ellipse cx="32" cy="28" rx="12" ry="10" fill="#602820"/><circle cx="27" cy="25" r="3" fill="#ff6020"/><circle cx="37" cy="25" r="3" fill="#ff6020"/><path d="M32 30 L32 34" stroke="#301008" stroke-width="1.5"/><ellipse cx="32" cy="18" rx="6" ry="4" fill="#ff8040" opacity=".6"/>`),

    ogre: s(`${shadow}<ellipse cx="32" cy="44" rx="18" ry="14" fill="#506838"/><circle cx="32" cy="24" r="15" fill="#608848"/><circle cx="25" cy="20" r="3" fill="#ffe040"/><circle cx="39" cy="20" r="3" fill="#ffe040"/><rect x="22" y="28" width="20" height="5" rx="2" fill="#405830"/><rect x="48" y="28" width="6" height="28" fill="#4a3820" transform="rotate(12 48 28)"/>`),

    darkelf: s(`${shadow}<ellipse cx="32" cy="42" rx="12" ry="13" fill="#283048"/><circle cx="32" cy="24" r="10" fill="#384858"/><path d="M20 16 L16 6 L24 14 Z" fill="#384858"/><path d="M44 16 L48 6 L40 14 Z" fill="#384858"/><circle cx="28" cy="22" r="2" fill="#c0a0ff"/><circle cx="36" cy="22" r="2" fill="#c0a0ff"/><path d="M48 30 L58 24" stroke="#384858" stroke-width="3" stroke-linecap="round"/>`),

    succubus: s(`${shadow}<ellipse cx="32" cy="42" rx="13" ry="14" fill="#482838"/><circle cx="32" cy="24" r="11" fill="#683848"/><path d="M18 16 L14 4 L24 14 Z" fill="#683848"/><path d="M46 16 L50 4 L40 14 Z" fill="#683848"/><circle cx="27" cy="22" r="3" fill="#ff4060"/><circle cx="37" cy="22" r="3" fill="#ff4060"/><path d="M20 8 Q32 2 44 8" stroke="#804060" stroke-width="3" fill="none"/>`),

    drake: s(`${shadow}<ellipse cx="32" cy="44" rx="20" ry="12" fill="#286040"/><ellipse cx="32" cy="30" rx="14" ry="11" fill="#388050"/><path d="M48 28 L62 18 L58 32 Z" fill="#388050"/><circle cx="27" cy="26" r="3" fill="#ffe040"/><circle cx="37" cy="26" r="3" fill="#ffe040"/><path d="M12 32 Q4 24 8 16" stroke="#388050" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M48 32 Q56 24 52 16" stroke="#388050" stroke-width="4" fill="none" stroke-linecap="round"/>`),

    gargoyle: s(`${shadow}<path d="M20 48 L32 14 L44 48 Z" fill="#687078"/><path d="M24 48 L32 20 L40 48 Z" fill="#889098"/><circle cx="27" cy="32" r="3" fill="#ff4040"/><circle cx="37" cy="32" r="3" fill="#ff4040"/><path d="M14 36 L8 28 L16 32 Z" fill="#687078"/><path d="M50 36 L56 28 L48 32 Z" fill="#687078"/>`),

    deathk: s(`${shadow}<ellipse cx="32" cy="44" rx="16" ry="14" fill="#1a1820"/><rect x="24" y="18" width="16" height="12" rx="2" fill="#2a2830"/><circle cx="32" cy="14" r="10" fill="#3a3840"/><circle cx="28" cy="12" r="3" fill="#ff4040"/><circle cx="36" cy="12" r="3" fill="#ff4040"/><rect x="48" y="24" width="5" height="28" fill="#1a1820"/><path d="M52 20 L62 16 L58 26 Z" fill="#808890" stroke="#c0c8d0" stroke-width=".5"/>`),

    ant_queen: s(`${shadow}<ellipse cx="32" cy="40" rx="20" ry="14" fill="#402818"/><ellipse cx="32" cy="26" rx="14" ry="11" fill="#503028"/><circle cx="27" cy="23" r="3" fill="#ffd040"/><circle cx="37" cy="23" r="3" fill="#ffd040"/><path d="M8 36 L18 32 M6 44 L18 42" stroke="#503028" stroke-width="3" stroke-linecap="round"/><path d="M56 36 L46 32 M58 44 L46 42" stroke="#503028" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="14" rx="8" ry="5" fill="#806040"/>`),

    succubus_q: s(`${shadow}<ellipse cx="32" cy="44" rx="18" ry="15" fill="#381828"/><circle cx="32" cy="24" r="14" fill="#582838"/><path d="M14 12 L10 0 L22 12 Z" fill="#582838"/><path d="M50 12 L54 0 L42 12 Z" fill="#582838"/><circle cx="26" cy="22" r="4" fill="#ff3060"/><circle cx="38" cy="22" r="4" fill="#ff3060"/><path d="M16 4 Q32 -4 48 4" stroke="#ffd040" stroke-width="3" fill="none"/><ellipse cx="32" cy="8" rx="10" ry="5" fill="#ffd040" opacity=".5"/>`),
  };

  const mobAlias = {
    kobold: "goblin", hobgob: "goblin", orc_arch: "orc", orc_f: "orc", gandi: "orc",
    gnoll: "wolf", wolfman: "wolf", lycan: "wolf", dw_f: "dwarf", skel_a: "skeleton",
    sparto: "skeleton", ant_s: "ant", yangol: "scorpion", balrog: "demon", ancient: "drake",
    harpy: "floating", medusa: "arachne", unicorn: "rabbit", iron_golem: "golem",
    lich: "skeleton", demon: "succubus", guardian: "golem",
    baphomet: "succubus_q", black_elder: "lich", lindvior: "drake",
    fafurion: "drake", antharas: "drake", valakas: "hellhound",
  };

  const skillAlias = {
    lightarrow: "ebolt",
    windblade: "slow", icearrow: "icedagger", holyweapon: "holywalk", firarrow: "fireball",
    fireweapon: "fireele", firedance: "burnstrike", fireblade: "burnstrike", fireattr: "fireele",
    firesoul: "burnstrike", energyboost: "holywalk",
    pollute: "aqua", lifefount: "waterbless", stormeye: "windshot", windbind: "slow", precise: "windshot",
    waterele: "waterprot",
    earthprot: "shield", earthsnare: "slow", earthwall: "magbar", earthguard: "shield",
    steelprot: "solid", vigor: "holywalk",
    purify: "resist", worldtree: "heal", elemdef: "resist", bodyswap: "heal", singleres: "magbar",
    mindswap: "heal", dispel: "ebolt", erase: "ebolt", weaken: "slow",
    summon: "resist", mirror: "magbar", strongsummon: "resist", seal: "elfire",
  };

  const skills = {
    bounce: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#c19a4a" stroke-width="1"/><path d="M8 22 L16 8 L24 22" fill="#b8c0cc" stroke="#8090a0" stroke-width=".5"/><rect x="12" y="22" width="8" height="2" fill="#c19a4a"/>`),
    stun: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#c19a4a" stroke-width="1"/><circle cx="16" cy="14" r="6" fill="#ffe040" opacity=".8"/><path d="M10 24 L16 18 L22 24" stroke="#ffe040" stroke-width="2" fill="none"/>`),
    reduction: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#8090a0" stroke-width="1"/><path d="M8 22 L16 8 L24 22 Z" fill="#889098" opacity=".8"/><rect x="10" y="22" width="12" height="4" fill="#c19a4a"/>`),
    solid: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#8090a0" stroke-width="1"/><rect x="8" y="10" width="16" height="14" rx="2" fill="#687078" stroke="#c19a4a" stroke-width="1.5"/>`),
    smash: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#e05040" stroke-width="1"/><path d="M16 6 L20 20 H12 Z" fill="#c0c8d0"/><circle cx="16" cy="24" r="4" fill="#ff6040" opacity=".7"/>`),
    counter: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#ffe040" stroke-width="1"/><circle cx="16" cy="16" r="9" fill="none" stroke="#ffe040" stroke-width="2" opacity=".7"/><path d="M16 8 L16 24 M8 16 L24 16" stroke="#ffe040" stroke-width="1.5" opacity=".5"/>`),
    triple: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#9be37d" stroke-width="1"/><path d="M8 8 Q6 16 8 24" stroke="#8a6030" stroke-width="2" fill="none"/><line x1="10" y1="10" x2="10" y2="22" stroke="#d8c8a0" stroke-width="1"/><path d="M14 12 L26 16 L14 20 Z" fill="#a0a8b0"/><path d="M18 10 L28 14 L18 18 Z" fill="#c0c8d0" opacity=".7"/><path d="M12 14 L22 18 L12 22 Z" fill="#808890" opacity=".5"/>`),
    light: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#ffe040" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#ffe040" opacity=".85"/><circle cx="16" cy="16" r="4" fill="#fff8c0"/>`),
    heal: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#4a9858" stroke-width="1"/><path d="M16 8 L16 24 M10 14 L22 14" stroke="#68c878" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="9" fill="#48a858" opacity=".25"/>`),
    extraheal: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#4a9858" stroke-width="1"/><path d="M16 6 L16 26 M8 12 L24 12 M10 20 L22 20" stroke="#68c878" stroke-width="2.5" stroke-linecap="round"/>`),
    greaterheal: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#68c878" stroke-width="1.5"/><path d="M16 4 L16 28 M6 10 L26 10 M8 18 L24 18 M10 24 L22 24" stroke="#9be37d" stroke-width="2" stroke-linecap="round"/>`),
    fullheal: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#183820" stroke="#9be37d" stroke-width="1.5"/><circle cx="16" cy="16" r="10" fill="#48a858" opacity=".4"/><path d="M16 6 L16 26 M6 16 L26 16" stroke="#c0f0c0" stroke-width="3" stroke-linecap="round"/>`),
    shield: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#8090a0" stroke-width="1"/><path d="M16 6 L26 12 L16 28 L6 12 Z" fill="#687078" stroke="#c19a4a" stroke-width="1"/>`),
    holywalk: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#ffe040" stroke-width="1"/><path d="M8 20 L16 10 L24 20" stroke="#ffe040" stroke-width="2" fill="none"/><ellipse cx="16" cy="22" rx="8" ry="3" fill="#ffe040" opacity=".3"/>`),
    resist: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#7ec8ff" stroke-width="1"/><circle cx="16" cy="16" r="9" fill="#284868" stroke="#7ec8ff" stroke-width="1.5"/><path d="M16 10 L16 22 M10 16 L22 16" stroke="#7ec8ff" stroke-width="1" opacity=".6"/>`),
    magbar: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#7ec8ff" stroke-width="1"/><rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="#7ec8ff" stroke-width="2" opacity=".6"/><rect x="10" y="10" width="12" height="12" rx="2" fill="#4080c0" opacity=".35"/>`),
    slow: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#8090b0" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#384858" opacity=".6"/><path d="M16 10 L16 18 M16 18 L13 22" stroke="#a0b0c0" stroke-width="2" stroke-linecap="round"/>`),
    haste: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#ffe040" stroke-width="1"/><path d="M8 20 L14 12 L20 20 L26 10" stroke="#ffe040" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
    ebolt: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#c9a0ff" stroke-width="1"/><polygon points="16,6 22,16 16,14 20,26 10,16 16,18" fill="#c9a0ff"/>`),
    fireele: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#281008" stroke="#ff6030" stroke-width="1"/><path d="M16 26 Q10 18 14 10 Q16 16 16 6 Q16 16 18 10 Q22 18 16 26" fill="#ff8040"/>`),
    burnstrike: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#281008" stroke="#ff5030" stroke-width="1"/><circle cx="16" cy="18" r="8" fill="#ff6020" opacity=".7"/><path d="M16 6 L16 14" stroke="#ffe040" stroke-width="2"/>`),
    elfire: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#281008" stroke="#ff4020" stroke-width="1.5"/><ellipse cx="16" cy="20" rx="10" ry="6" fill="#ff5020" opacity=".6"/><path d="M10 12 Q16 4 22 12 Q16 8 10 12" fill="#ff8040"/>`),
    waterprot: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#4080e0" stroke-width="1"/><path d="M16 26 Q8 18 12 10 Q16 16 16 6 Q16 16 20 10 Q24 18 16 26" fill="#4090e0" opacity=".7"/>`),
    waterbless: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#60a0f0" stroke-width="1"/><path d="M6 20 Q16 8 26 20 Q16 14 6 20" fill="#60b0ff" opacity=".5"/><circle cx="16" cy="14" r="4" fill="#a0d0ff" opacity=".6"/>`),
    aqua: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#4080e0" stroke-width="1"/><path d="M8 16 L16 8 L24 16 L16 24 Z" fill="#5090e0" opacity=".8"/>`),
    windwalk: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#082018" stroke="#60c080" stroke-width="1"/><path d="M6 18 Q16 10 26 18 M8 22 Q16 14 24 22" stroke="#80e0a0" stroke-width="2" fill="none"/>`),
    windshot: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#082018" stroke="#60c080" stroke-width="1"/><path d="M6 16 L26 16" stroke="#80e0a0" stroke-width="2"/><path d="M18 10 L26 16 L18 22 Z" fill="#a0f0c0"/>`),
    storm: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#082018" stroke="#60c080" stroke-width="1.5"/><path d="M8 12 Q16 6 24 12 M6 20 Q16 14 26 20 M10 26 Q16 20 22 26" stroke="#80e0a0" stroke-width="2" fill="none"/>`),
    icedagger: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#7ec8ff" stroke-width="1"/><path d="M16 6 L20 18 H12 Z" fill="#a0d8ff"/><rect x="14" y="18" width="4" height="8" fill="#6090c0"/>`),
    fireball: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#281008" stroke="#ff5030" stroke-width="1"/><circle cx="16" cy="16" r="9" fill="#ff6020" opacity=".75"/><circle cx="16" cy="16" r="5" fill="#ffe040" opacity=".6"/>`),
    icelance: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#7ec8ff" stroke-width="1"/><path d="M16 4 L19 20 H13 Z" fill="#c0e8ff"/><rect x="13" y="20" width="6" height="8" fill="#6090c0"/>`),
    lightning: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#181028" stroke="#c9a0ff" stroke-width="1"/><polygon points="18,4 12,16 17,16 14,28 22,14 17,14" fill="#ffe040"/>`),
    blizzard: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#081828" stroke="#7ec8ff" stroke-width="1"/><circle cx="12" cy="12" r="3" fill="#fff" opacity=".8"/><circle cx="22" cy="10" r="2.5" fill="#fff" opacity=".7"/><circle cx="16" cy="20" r="3.5" fill="#fff" opacity=".8"/><circle cx="24" cy="22" r="2" fill="#fff" opacity=".6"/>`),
    meteor: sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#181008" stroke="#ffd040" stroke-width="1.5"/><circle cx="12" cy="10" r="4" fill="#ff8040"/><circle cx="24" cy="14" r="3" fill="#ff6040" opacity=".8"/><path d="M10 8 L14 16" stroke="#ffe040" stroke-width="1.5" opacity=".6"/><path d="M22 10 L18 18" stroke="#ffe040" stroke-width="1.5" opacity=".6"/>`),
  };

  function mob(id) {
    const key = mobAlias[id] || id;
    return mobs[key] || mobs.orc;
  }

  function skill(id) {
    const key = skillAlias[id] || id;
    return skills[key] || sk(`<rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2018" stroke="#c19a4a" stroke-width="1"/><text x="16" y="20" text-anchor="middle" fill="#ffe27a" font-size="14" font-family="serif">✦</text>`);
  }

  return { mob, skill };
})();
