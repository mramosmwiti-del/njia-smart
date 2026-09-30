#!/usr/bin/env node
/**
 * Undoes ONLY the edits made by the earlier "dark mode toggle" package, after you
 * have restored YOUR OWN src/lib/theme.ts and src/components/theme-toggle.tsx.
 * Run from the project root:   node undo-my-dark-mode-edits.mjs
 * Safe to run twice.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => { const f = path.join(root, rel); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
let warn = 0;
const say = (m) => console.log(m);
const bad = (m) => { warn++; say("  !! " + m); };

function edit(rel, fn) {
  const raw = read(rel);
  if (raw === null) return bad(`${rel} not found`);
  const crlf = raw.includes("\r\n");
  const src = raw.replace(/\r\n/g, "\n");
  const out = fn(src);
  if (out !== src) { fs.writeFileSync(path.join(root, rel), crlf ? out.replace(/\n/g, "\r\n") : out); return true; }
  return false;
}

// 1) __root.tsx: remove the two lines my package added
say("__root.tsx");
const rootChanged = edit("src/routes/__root.tsx", (s) => s
  .replace(/^[ \t]*import \{ THEME_INIT_SCRIPT \} from "@\/lib\/theme";\n/m, "")
  .replace(/^[ \t]*scripts: \[\{ children: THEME_INIT_SCRIPT \}\],\n/m, ""));
say(rootChanged ? "  removed my THEME_INIT_SCRIPT lines" : "  nothing of mine to remove");

// 2) app-shell.tsx: never two ThemeToggle imports / buttons
say("app-shell.tsx");
const shellChanged = edit("src/components/app-shell.tsx", (s) => {
  const mine = 'import { ThemeToggle } from "./theme-toggle";\n';
  const imports = s.match(/^import .*\bThemeToggle\b.*$/gm) ?? [];
  if (imports.length > 1) s = s.replace(mine, "");
  const uses = s.match(/^[ \t]*<ThemeToggle \/>\n/gm) ?? [];
  if (uses.length > 1) { let seen = 0; s = s.replace(/^[ \t]*<ThemeToggle \/>\n/gm, (m) => (++seen > 1 ? "" : m)); }
  return s;
});
say(shellChanged ? "  removed a duplicate ThemeToggle" : "  no duplicates");

// 3) checks
say("checks");
const theme = read("src/lib/theme.ts");
if (!theme) bad("src/lib/theme.ts is missing - restore your own copy");
else if (!/\bThemeProvider\b/.test(theme)) bad("src/lib/theme.ts is still MY version (no ThemeProvider). Restore YOUR copy first - see INSTALL.md.");
else say("  ok: src/lib/theme.ts exports ThemeProvider (yours)");

const toggle = read("src/components/theme-toggle.tsx");
if (!toggle) bad("src/components/theme-toggle.tsx is missing - restore your own copy");
else {
  const names = [...toggle.matchAll(/export (?:default )?(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
  if (/getSavedTheme|THEME_INIT/.test(toggle)) bad("theme-toggle.tsx looks like MY version. Restore YOUR copy first - see INSTALL.md.");
  else if (!names.includes("ThemeToggle")) bad(`theme-toggle.tsx exports [${names.join(", ")}] but app-shell imports { ThemeToggle } - rename the import in app-shell.tsx to match.`);
  else say("  ok: theme-toggle.tsx exports ThemeToggle");
}

// any leftover reference to my helper anywhere?
const leftovers = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && /THEME_INIT_SCRIPT|getSavedTheme|currentTheme/.test(fs.readFileSync(p, "utf8"))) leftovers.push(path.relative(root, p));
  }
})(path.join(root, "src"));
if (leftovers.length) bad("still referencing my theme helpers: " + leftovers.join(", "));

say(warn ? `\n${warn} item(s) need attention (see INSTALL.md).` : "\nAll clear. Rebuild now.");
