#!/usr/bin/env node
/**
 * One-command repair for: "ThemeProvider is not exported by src/lib/theme.ts".
 *
 * Run from the project root:   node repair-theme.mjs
 * Safe to run twice. Anything it removes is copied to .theme-repair-backup/ first.
 *
 * Case A - your provider lives in src/lib/theme.tsx (or src/lib/theme/index.tsx):
 *          my src/lib/theme.ts was SHADOWING it. It is removed, so yours is used again.
 * Case B - your provider was in src/lib/theme.ts and my file replaced it:
 *          a compatible src/lib/theme.tsx (ThemeProvider + useTheme) is written.
 * Both:    my leftover edits in __root.tsx are removed, duplicate toggles in
 *          app-shell.tsx are removed, and my theme-toggle.tsx (if it is still mine)
 *          is rewritten to use whatever provider is now in place.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const P = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(P(rel));
const read = (rel) => (exists(rel) ? fs.readFileSync(P(rel), "utf8") : null);
const say = (m) => console.log(m);
let warn = 0;
const bad = (m) => { warn++; say("  !! " + m); };

function backup(rel) {
  const dest = P(path.join(".theme-repair-backup", rel));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(P(rel), dest);
}
function write(rel, text) { fs.mkdirSync(path.dirname(P(rel)), { recursive: true }); fs.writeFileSync(P(rel), text); }
function editFile(rel, fn) {
  const raw = read(rel);
  if (raw === null) return false;
  const crlf = raw.includes("\r\n");
  const src = raw.replace(/\r\n/g, "\n");
  const out = fn(src);
  if (out === src) return false;
  backup(rel);
  fs.writeFileSync(P(rel), crlf ? out.replace(/\n/g, "\r\n") : out);
  return true;
}

const isMineTheme = (s) => !!s && /THEME_INIT_SCRIPT/.test(s) && /getSavedTheme/.test(s) && !/ThemeProvider/.test(s);
const isMineToggle = (s) => !!s && /getSavedTheme/.test(s);

// ------------------------------------------------------------------ templates
const COMPAT_THEME = String.raw`import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Light / dark theme provider. The dark palette lives in styles.css under ".dark";
 * this only decides whether <html> carries that class.
 */
export type Theme = "light" | "dark" | "system";
const KEY = "theme";

export const THEME_INIT_SCRIPT =
  '(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var e=document.documentElement;if(t==="dark")e.classList.add("dark");e.style.colorScheme=t}catch(_){}})();';

const systemDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function getSavedTheme(): Theme | null {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" || v === "system" ? v : null; } catch { return null; }
}
export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
export function applyTheme(t: "light" | "dark") {
  const el = document.documentElement;
  el.classList.toggle("dark", t === "dark");
  el.style.colorScheme = t;
}

type Ctx = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggle: () => void;
};
const noop = () => {};
const ThemeContext = createContext<Ctx>({ theme: "system", resolvedTheme: "light", setTheme: noop, toggleTheme: noop, toggle: noop });

export function ThemeProvider({ children, defaultTheme = "system" }: { children?: ReactNode; defaultTheme?: Theme; [key: string]: unknown }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => { const saved = getSavedTheme(); if (saved) setThemeState(saved); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const run = () => {
      const r: "light" | "dark" = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      applyTheme(r);
      setResolved(r);
    };
    run();
    if (theme !== "system") return;
    mq.addEventListener("change", run);
    return () => mq.removeEventListener("change", run);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(KEY, t); } catch { /* storage blocked: still applies for this visit */ }
    setThemeState(t);
  }, []);
  const toggleTheme = useCallback(() => setTheme(resolved === "dark" ? "light" : "dark"), [resolved, setTheme]);

  const value = useMemo<Ctx>(
    () => ({ theme, resolvedTheme: resolved, setTheme, toggleTheme, toggle: toggleTheme }),
    [theme, resolved, setTheme, toggleTheme],
  );
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Ctx { return useContext(ThemeContext); }
`;

const ADAPTIVE_TOGGLE = String.raw`import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** Sun/moon button for the top bar. Works with the app's own ThemeProvider. */
export function ThemeToggle() {
  const ctx = useTheme() as any;
  const current = ctx?.resolvedTheme ?? ctx?.theme;
  const isDark = current === "dark" || (current === "system" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  function flip() {
    if (typeof ctx?.toggleTheme === "function") ctx.toggleTheme();
    else if (typeof ctx?.toggle === "function") ctx.toggle();
    else if (typeof ctx?.setTheme === "function") ctx.setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      onClick={flip}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
`;

// ---------------------------------------------------------------------- 1. theme file
say("src/lib/theme");
const mineTs = read("src/lib/theme.ts");
const theirsTsx = exists("src/lib/theme.tsx") ? "src/lib/theme.tsx"
  : exists("src/lib/theme/index.tsx") ? "src/lib/theme/index.tsx"
  : exists("src/lib/theme/index.ts") ? "src/lib/theme/index.ts" : null;
let providerFile = null;

if (mineTs !== null && isMineTheme(mineTs)) {
  backup("src/lib/theme.ts");
  fs.unlinkSync(P("src/lib/theme.ts"));
  if (theirsTsx) {
    say("  Case A: your provider is in " + theirsTsx + ". Removed my src/lib/theme.ts that was hiding it.");
    providerFile = theirsTsx;
  } else {
    write("src/lib/theme.tsx", COMPAT_THEME);
    say("  Case B: wrote a compatible src/lib/theme.tsx (ThemeProvider + useTheme).");
    providerFile = "src/lib/theme.tsx";
  }
} else if (mineTs !== null && /ThemeProvider/.test(mineTs)) {
  say("  src/lib/theme.ts exports ThemeProvider (yours) - left alone.");
  providerFile = "src/lib/theme.ts";
} else if (mineTs === null && theirsTsx) {
  say("  your provider is in " + theirsTsx + " - left alone.");
  providerFile = theirsTsx;
} else if (mineTs === null) {
  write("src/lib/theme.tsx", COMPAT_THEME);
  say("  no theme file found: wrote a compatible src/lib/theme.tsx.");
  providerFile = "src/lib/theme.tsx";
} else {
  bad("src/lib/theme.ts exists but exports no ThemeProvider and is not mine - please send it to me.");
}

// ---------------------------------------------------------------------- 2. toggle
say("src/components/theme-toggle.tsx");
const toggle = read("src/components/theme-toggle.tsx");
const providerSrc = providerFile ? read(providerFile) : null;
const providerHasHook = !!providerSrc && /export\s+(?:function|const)\s+useTheme\b/.test(providerSrc);
if (toggle === null) {
  if (providerHasHook) { write("src/components/theme-toggle.tsx", ADAPTIVE_TOGGLE); say("  was missing: wrote a toggle that uses your ThemeProvider."); }
  else bad("no theme-toggle.tsx and your provider has no useTheme - tell me how your toggle worked.");
} else if (isMineToggle(toggle)) {
  if (providerHasHook || providerFile === "src/lib/theme.tsx") {
    backup("src/components/theme-toggle.tsx");
    write("src/components/theme-toggle.tsx", ADAPTIVE_TOGGLE);
    say("  it was my version: rewrote it to use your ThemeProvider.");
  } else bad("your provider has no useTheme export, so I could not rewrite my toggle safely - send me src/lib/theme.tsx.");
} else say("  yours - left alone.");

// ---------------------------------------------------------------------- 3. __root.tsx
say("src/routes/__root.tsx");
const rootFixed = editFile("src/routes/__root.tsx", (s) => s
  .replace(/^[ \t]*import \{ THEME_INIT_SCRIPT \} from "@\/lib\/theme";\n/m, "")
  .replace(/^[ \t]*scripts: \[\{ children: THEME_INIT_SCRIPT \}\],\n/m, ""));
say(rootFixed ? "  removed my leftover lines." : "  nothing of mine to remove.");
const rootSrc = read("src/routes/__root.tsx");
if (rootSrc && /ThemeProvider/.test(rootSrc) && providerSrc && !/\bThemeProvider\b/.test(providerSrc)) bad("__root.tsx uses ThemeProvider but " + providerFile + " does not export it.");

// ---------------------------------------------------------------------- 4. app-shell.tsx
say("src/components/app-shell.tsx");
const shellFixed = editFile("src/components/app-shell.tsx", (s) => {
  const mine = 'import { ThemeToggle } from "./theme-toggle";\n';
  const imports = s.match(/^import .*\bThemeToggle\b.*$/gm) ?? [];
  if (imports.length > 1) s = s.replace(mine, "");
  let seen = 0;
  return s.replace(/^[ \t]*<ThemeToggle \/>\n/gm, (m) => (++seen > 1 ? "" : m));
});
say(shellFixed ? "  removed a duplicate ThemeToggle." : "  no duplicates.");
const shell = read("src/components/app-shell.tsx");
if (shell && !/<ThemeToggle/.test(shell)) say("  note: no <ThemeToggle /> in the top bar. Run add-dark-mode.mjs from the earlier package, or add it by hand next to <SoundToggle />.");

// ---------------------------------------------------------------------- 5. leftovers
const left = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && /THEME_INIT_SCRIPT|getSavedTheme/.test(fs.readFileSync(p, "utf8"))) left.push(path.relative(root, p).replace(/\\/g, "/"));
  }
})(P("src"));
const allowed = new Set(["src/lib/theme.tsx"]);
const stray = left.filter((f) => !allowed.has(f));
if (stray.length) bad("still referencing my old theme helpers: " + stray.join(", "));

say(warn ? "\n" + warn + " item(s) need attention (see above)." : "\nAll clear. Commit, push, and Vercel will rebuild.");
