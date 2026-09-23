"use strict";
/** 戰鬥 HUD／技能特效必要節點自檢（不需登入） */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const hudJs = fs.readFileSync(path.join(ROOT, "js", "46-combat-hud.js"), "utf8");
const vfxJs = fs.readFileSync(path.join(ROOT, "js", "09-vfx-render.js"), "utf8");
const hudCss = fs.readFileSync(path.join(ROOT, "css", "combat-hud.css"), "utf8");

function ok(n, v) {
  console.log(v ? "OK " : "FAIL", n);
  return !!v;
}

let pass = true;
pass = ok("status-avatar in HTML", /id=["']status-avatar["']/.test(html)) && pass;
pass = ok("btn-chud-menu in HTML", /id=["']btn-chud-menu["']/.test(html)) && pass;
pass = ok("chud-menu-rail in HTML", /id=["']chud-menu-rail["']/.test(html)) && pass;
pass = ok("alloc hint ＋／－", html.includes("＋／－")) && pass;
pass = ok("ensureHudShell in combat-hud.js", /function ensureHudShell/.test(hudJs)) && pass;
pass = ok("_vfxToLocal present", /function _vfxToLocal/.test(vfxJs)) && pass;
pass = ok("vfx-layer overflow visible", /#game-screen\.combat-hud > #vfx-layer[\s\S]{0,200}overflow:\s*visible/.test(hudCss)) && pass;
pass = ok("playSpellFx uses _vfxToLocal", /function playSpellFx[\s\S]*?_vfxToLocal/.test(vfxJs)) && pass;
pass = ok("SPELL_FX_SCALE present", /SPELL_FX_SCALE\s*=\s*0\.\d+/.test(vfxJs)) && pass;
pass = ok("_fxBandRefH field/hud cap", /is-field-combat/.test(vfxJs) && /SPELL_FX_SCALE/.test(vfxJs)) && pass;
pass = ok("status-icon-bar exists", /id=["']status-icon-bar["']/.test(html)) && pass;
pass = ok(
  "status icons no outer plate",
  /#game-screen\.combat-hud #status-icon-bar[\s\S]{0,500}background:\s*transparent/.test(hudCss)
) && pass;

console.log(pass ? "\nHUD/VFX CHECK PASS" : "\nHUD/VFX CHECK FAIL");
process.exit(pass ? 0 : 1);
