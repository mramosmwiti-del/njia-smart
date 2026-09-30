/**
 * Light / dark theme. The dark palette lives in styles.css under `.dark`;
 * this only decides whether <html> carries that class.
 * Saved in localStorage under "theme" ("light" | "dark"). With nothing saved
 * it follows the device setting.
 */
export type Theme = "light" | "dark";
const KEY = "theme";

export function getSavedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch { return null; }
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", t === "dark");
  el.style.colorScheme = t;
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked: still apply for this visit */ }
  applyTheme(t);
  window.dispatchEvent(new Event("theme-change"));
}

/** Runs in <head> before the page paints, so there is no light-theme flash. */
export const THEME_INIT_SCRIPT =
  `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var e=document.documentElement;if(t==="dark")e.classList.add("dark");e.style.colorScheme=t}catch(_){}})();`;
