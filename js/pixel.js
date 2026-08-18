/* 原創像素風素材：側向 SD，靈感來自經典 MMORPG 放置版（非官方資源） */
window.PIXEL = (() => {
  const S = 2;
  const svg = (w, h, body) =>
    `<svg viewBox="0 0 ${w * S} ${h * S}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;

  function draw(rows, pal, flip) {
    let out = "";
    const w = rows[0].length;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const fx = flip ? w - 1 - x : x;
        const c = rows[y][x];
        if (c === "." || c === " ") continue;
        const fill = pal[c];
        if (!fill) continue;
        out += `<rect x="${fx * S}" y="${y * S}" width="${S}" height="${S}" fill="${fill}"/>`;
      }
    }
    return out;
  }

  const P = {
    ".": null,
    K: "#e8c4a0", k: "#c89870", H: "#5a3820", h: "#8fd98a", Y: "#e8d878",
    A: "#c8d0dc", a: "#687080", G: "#c19a4a", R: "#a02828", r: "#601818",
    B: "#284830", b: "#58a868", W: "#f0f2f8", w: "#9098a8",
    M: "#684898", m: "#402868", P: "#9060d8", p: "#c0a0ff", E: "#382060",
    O: "#8a5030", o: "#5a3018", S: "#e8ecf4", s: "#687888",
    D: "#1a1008", d: "#3a6848", F: "#48a858", f: "#286838",
    Z: "#e8e0d0", z: "#889098", L: "#58b868", l: "#1e5028",
    C: "#8040a0", c: "#b070ff", N: "#302018", n: "#503028",
    T: "#687078", t: "#485860", X: "#ff6040", x: "#402018",
    I: "#ffe040", i: "#806830", Q: "#3a6848", q: "#68c878",
    V: "#906040", v: "#604020", J: "#90ff90", j: "#308838",
  };

  const knightM = [
    "........................",
    "........................",
    "...........HHH..........",
    "..........HAAAH.........",
    ".........HAAKAAH........",
    "........AAAKKKAA........",
    ".......RAAAKKKAA........",
    "......RRAAKKKKAA........",
    "......RAAAKKKKAA........",
    "......AAAKKKKAAA........",
    "......AAAKKKKAA.........",
    ".......AAKKKKAA.........",
    "........AKKKKAA.........",
    "........AKKKAA..........",
    "........AKKAA...........",
    "........A AA............",
    "........A AA............",
    "........A AA............",
    "........SSSS............",
    "........SSSS............",
    "........................",
  ];

  const knightF = [
    "........................",
    "........................",
    "..........HHHH..........",
    ".........HAAAAH.........",
    "........HAAKKAAH........",
    ".......RAAAKKKAA........",
    "......RRAAKKKKAA........",
    "......RAAAKKKKAA........",
    "......AAAKKKKAAA........",
    "......AAAKKKKAA.........",
    ".......AAKKKKAA.........",
    "........AKKKKAA.........",
    "........AKKKAA..........",
    "........AKKAA...........",
    "........A AA............",
    "........A AA............",
    "........SSSS............",
    "........................",
  ];

  const elfM = [
    "........................",
    "........................",
    "..........YHHY..........",
    ".........YBBKBBY........",
    "........YBBKKKBBY.......",
    ".......YBBKKKKKBBY......",
    ".......BBKKKKKKBB.......",
    ".......BBKKKKKKBB.......",
    "........BBKKKKBB........",
    "........BBKKKKBB........",
    ".........BBKKBB.........",
    ".........BBKKBB.........",
    "..........BKKBB.........",
    "..........BKKBB.........",
    "..........B B...........",
    "..........B B...........",
    ".........OOO............",
    "........................",
  ];

  const elfF = [
    "........................",
    "...........hh...........",
    "..........hHHh..........",
    ".........hBBKBh.........",
    "........hBBKKBh.........",
    ".......hBBKKKKBh........",
    ".......BBKKKKKBB........",
    "........BBKKKKBB........",
    "........BBKKKKBB........",
    ".........BBKKBB.........",
    ".........BBKKBB.........",
    "..........BKKBB.........",
    "..........B B...........",
    ".........OOO............",
    "........................",
  ];

  const mageM = [
    "........................",
    "..........PPPP..........",
    ".........PEEEEP.........",
    "........PEKKKEP.........",
    ".......PEKKKKKEP........",
    ".......MEKKKKKEM........",
    ".......MEKKKKKEM........",
    "........MEKKKEM.........",
    "........MEKKKEM.........",
    ".........MEKEM..........",
    ".........MEKEM..........",
    "..........MEM...........",
    "..........MEM...........",
    "..........M M...........",
    ".........OOcO...........",
    "........................",
  ];

  const mageF = [
    "........................",
    "..........PPPP..........",
    ".........PEEEEP.........",
    "........PEKKKEP.........",
    ".......MEKKKKKEM........",
    ".......MEKKKKKEM........",
    "........MEKKKEM.........",
    "........MEKKKEM.........",
    ".........MEKEM..........",
    "..........MEM...........",
    "..........M M...........",
    ".........OOcO...........",
    "........................",
  ];

  const heroes = {
    knight_m: svg(24, 21, draw(knightM, P)),
    knight_f: svg(24, 18, draw(knightF, P)),
    elf_m: svg(24, 18, draw(elfM, P)),
    elf_f: svg(24, 15, draw(elfF, P)),
    mage_m: svg(24, 16, draw(mageM, P)),
    mage_f: svg(24, 13, draw(mageF, P)),
  };

  const mobPx = {
    rabbit: [
      "..YY....",
      ".YYYYY..",
      "YYYYYYYY",
      "YYYKYYYY",
      ".YYYYYY.",
      "..YYYY..",
      ".Y....Y.",
    ],
    goblin: [
      "...GG...",
      "..GKGKG.",
      ".GGKKKGG",
      ".GGKKKGG",
      "..GGGG..",
      "..G..G..",
      "..G..G..",
    ],
    orc: [
      "...GG...",
      "..GKGKG.",
      ".GGKKKGG",
      ".GGKKKGG",
      "..GGGGG.",
      "..GG.GG.",
      "..GG.GG.",
    ],
    wolf: [
      "..NN....",
      ".NNNNN..",
      "NNNINNN.",
      "NNNIINN.",
      ".NNNNN..",
      ".NN.NN..",
      ".NN.NN..",
    ],
    skeleton: [
      "..ZZZ...",
      ".ZIZIZ..",
      ".ZZZZZZ.",
      ".ZZZZZZ.",
      "..ZZZZ..",
      "..Z..Z..",
      "..Z..Z..",
    ],
    floating: [
      "...CC...",
      "..CCCCC.",
      ".CCCIICC",
      ".CCCIICC",
      "..CCCCC.",
      "...CCC..",
    ],
    ant: [
      "..NNN...",
      ".NNINNN.",
      "NNNNNNNN",
      ".NNNNNN.",
      "..NNNN..",
      ".N....N.",
    ],
    drake: [
      "...LL...",
      "..LLLLL.",
      ".LLILLLL",
      ".LLLLLLL",
      "..LLLL..",
      ".LL..LL.",
    ],
    deathk: [
      "..ZZZ...",
      ".ZIZIZ..",
      ".ZZZZZZ.",
      ".ZZZZZZ.",
      "..ZZZZ..",
      "..ZSSZ..",
      "..ZSSZ..",
    ],
    gargoyle: [
      "..TTT...",
      ".TTITTT.",
      ".TTTTTT.",
      ".TTTTTT.",
      "..TTTT..",
      ".TT..TT.",
    ],
    succubus: [
      "..XX....",
      ".XXIXX..",
      ".XXXXXX.",
      ".XXXXXX.",
      "..XXXX..",
      ".XX..XX.",
    ],
    demon: [
      "..XX....",
      ".XXIXX..",
      ".XXXXXX.",
      ".XXXXXX.",
      "..XXXX..",
      ".XX..XX.",
    ],
    hellhound: [
      "..NN....",
      ".NNXNNN.",
      "NNNIINN.",
      "NNNNNNN.",
      ".NNNNN..",
      ".NN.NN..",
    ],
    bear: [
      ".NNNN...",
      "NNNIINN.",
      "NNNNNNNN",
      ".NNNNNN.",
      "..NNNN..",
      ".NN..NN.",
    ],
    golem: [
      "..TTT...",
      ".TTITTT.",
      ".TTTTTT.",
      ".TTTTTT.",
      "..TTTT..",
      ".TT..TT.",
    ],
    mushroom: [
      "..RRR...",
      ".RRRRRR.",
      ".RRRRRR.",
      "..WWWW..",
      "..WWWW..",
      "..WWWW..",
    ],
    lizard: [
      "...LL...",
      "..LLLLL.",
      ".LLILLLL",
      ".LLLLLLL",
      "..LLLL..",
      ".LL..LL.",
    ],
    bugbear: [
      "...GG...",
      "..GKGKG.",
      ".GGKKKGG",
      ".GGGGGG.",
      "..GGGG..",
      "..GG.GG.",
    ],
    fox: [
      "..OO....",
      ".OOOOOO.",
      "OOOOIOOO",
      ".OOOOOO.",
      "..OOOO..",
      ".OO..OO.",
    ],
    slime: [
      "..JJ....",
      ".JJJJJ..",
      "JJJIJJJ.",
      ".JJJJJJ.",
      "..JJJJ..",
    ],
    boar: [
      "..VV....",
      ".VVIVVV.",
      "VVVVVVVV",
      ".VVVVVV.",
      "..VVVV..",
      ".VV..VV.",
    ],
    arachne: [
      "..NNN...",
      ".NNINNN.",
      "NNNNNNNN",
      ".NNNNNN.",
      "N.NN.NN.",
    ],
    ogre: [
      "...GG...",
      "..GKGKG.",
      ".GGKKKGG",
      ".GGGGGGG",
      "..GGGG..",
      "..GG.GG.",
    ],
    dwarf: [
      "..TTT...",
      ".TTKTTT.",
      ".TTTTTT.",
      ".TTTTTT.",
      "..TTTT..",
      ".TT..TT.",
    ],
    darkelf: [
      "..EE....",
      ".EEKEEE.",
      ".EEKKKEE",
      ".EEEEEE.",
      "..EEEE..",
      ".EE..EE.",
    ],
  };

  const mobPal = {
    rabbit: { Y: "#d8c8a0", K: "#e8c4a0", I: "#1a1008", ".": null },
    goblin: { G: "#48a848", K: "#e8c4a0", I: "#ffe040", ".": null },
    orc: { G: "#8a6040", K: "#e8c4a0", I: "#ff3020", ".": null },
    wolf: { N: "#505860", I: "#ffe040", ".": null },
    skeleton: { Z: "#e8e0d0", I: "#1a1008", ".": null },
    floating: { C: "#a060c0", I: "#ff4040", ".": null },
    ant: { N: "#403028", I: "#1a1008", ".": null },
    drake: { L: "#388050", I: "#ffe040", ".": null },
    deathk: { Z: "#3a3840", I: "#ff4040", S: "#808890", ".": null },
    gargoyle: { T: "#889098", I: "#ff4040", ".": null },
    succubus: { X: "#683848", I: "#ff4060", ".": null },
    demon: { X: "#802020", I: "#ff4040", ".": null },
    hellhound: { N: "#402018", I: "#ff6020", X: "#ff8040", ".": null },
    bear: { N: "#503820", I: "#1a1008", ".": null },
    golem: { T: "#687078", I: "#ffe040", ".": null },
    mushroom: { R: "#c04040", W: "#e8dcc8", I: "#1a1008", ".": null },
    lizard: { L: "#4a8860", I: "#ffe040", ".": null },
    bugbear: { G: "#608050", K: "#e8c4a0", I: "#ff3020", ".": null },
    fox: { O: "#d87830", I: "#1a1008", ".": null },
    slime: { J: "#68c878", I: "#1a4020", ".": null },
    boar: { V: "#8a6040", I: "#1a1008", ".": null },
    arachne: { N: "#403030", I: "#ff2020", ".": null },
    ogre: { G: "#608848", K: "#e8c4a0", I: "#ffe040", ".": null },
    dwarf: { T: "#708898", K: "#e8c4a0", I: "#1a1008", ".": null },
    darkelf: { E: "#384858", K: "#c0a0ff", I: "#c0a0ff", ".": null },
  };

  const mobAlias = {
    kobold: "goblin", hobgob: "goblin", gnoll: "wolf", wolfman: "wolf", lycan: "wolf",
    orc_arch: "orc", orc_f: "orc", gandi: "orc", skel_a: "skeleton", sparto: "skeleton",
    zombie: "skeleton", ghoul: "skeleton", lich: "skeleton", dw_f: "dwarf", dwarf: "dwarf",
    slime: "slime", boar: "boar", bear: "bear", hellhound: "hellhound", bugbear: "bugbear",
    ogre: "ogre", yangol: "ant", scorpion: "ant", ant_s: "ant", arachne: "arachne",
    lizard: "lizard", ancient: "drake", harpy: "floating", medusa: "succubus", darkelf: "darkelf",
    iron_golem: "golem", golem: "golem", guardian: "golem", balrog: "demon", demon: "demon",
    mushroom: "mushroom", unicorn: "drake", baphomet: "demon", black_elder: "darkelf",
    fox: "fox", floating: "floating", ant_queen: "ant", succubus_q: "succubus",
    lindvior: "drake", fafurion: "drake", antharas: "drake", valakas: "hellhound",
  };

  const mobs = {};
  for (const [id, rows] of Object.entries(mobPx)) {
    const pal = mobPal[id] || mobPal.goblin;
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    mobs[id] = svg(w, h, draw(rows, pal));
  }

  function hero(cls, gender) {
    const g = gender === "f" ? "f" : "m";
    const c = cls || "knight";
    return heroes[`${c}_${g}`] || heroes.knight_m;
  }

  function mob(id) {
    const key = mobAlias[id] || id;
    return mobs[key] || mobs.orc;
  }

  return { hero, mob, draw, svg };
})();
