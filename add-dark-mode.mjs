#!/usr/bin/env node
/**
 * Adds the dark-mode toggle to YOUR CURRENT files without replacing them.
 * Run from the project root:   node add-dark-mode.mjs
 * Safe to run twice. Edited files are backed up as <file>.before-darkmode
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let problems = 0;

function patch(rel, steps) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log(`- ${rel}: not found`); problems++; return; }
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let src = raw.replace(/\r\n/g, "\n");
  const before = src;
  for (const s of steps) {
    if (s.done(src)) { console.log(`  ok (already there): ${rel} - ${s.name}`); continue; }
    const out = s.apply(src);
    if (!out || out === src) { console.log(`  !! could not apply: ${rel} - ${s.name}  (see INSTALL.md, "Manual lines")`); problems++; }
    else { src = out; console.log(`  added: ${rel} - ${s.name}`); }
  }
  if (src !== before) {
    fs.writeFileSync(file + ".before-darkmode", raw);
    fs.writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src);
  }
}

patch("src/components/app-shell.tsx", [
  {
    name: "import",
    done: (s) => s.includes("theme-toggle"),
    apply: (s) => s.replace(/^(import \{ NotificationBell \} from "\.\/notification-bell";\n)/m,
      `$1import { ThemeToggle } from "./theme-toggle";\n`),
  },
  {
    name: "toggle button in the top bar",
    done: (s) => s.includes("<ThemeToggle"),
    apply: (s) => {
      for (const anchor of ["<SoundToggle />", "<OfflineIndicator", "<NotificationBell />"]) {
        const re = new RegExp(`^(\\s*)${anchor.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "m");
        if (re.test(s)) return s.replace(re, (_m, ind) => `${ind}<ThemeToggle />\n${ind}${anchor}`);
      }
      return null;
    },
  },
]);

patch("src/routes/__root.tsx", [
  {
    name: "import",
    done: (s) => s.includes("THEME_INIT_SCRIPT"),
    apply: (s) => s.replace(/^(import appCss from "\.\.\/styles\.css\?url";\n)/m,
      `$1import { THEME_INIT_SCRIPT } from "@/lib/theme";\n`),
  },
  {
    name: "apply saved theme before the page paints (no flash)",
    done: (s) => /scripts:\s*\[\s*\{\s*children:\s*THEME_INIT_SCRIPT/.test(s),
    apply: (s) => (/^\s*scripts:/m.test(s) ? null
      : s.replace(/^(\s*)links: \[/m, (_m, ind) => `${ind}scripts: [{ children: THEME_INIT_SCRIPT }],\n${ind}links: [`)),
  },
]);

console.log(problems ? `\nDone with ${problems} item(s) needing a manual step (see INSTALL.md).` : "\nDark mode toggle added. Your other changes were left untouched.");
