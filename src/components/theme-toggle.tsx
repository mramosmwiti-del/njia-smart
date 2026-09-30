import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, currentTheme, getSavedTheme, setTheme, type Theme } from "@/lib/theme";

/** Sun/moon button for the top bar. Click to switch between light and dark. */
export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>("light");

  useEffect(() => {
    // Saved choice wins; otherwise follow the device (and keep following it).
    const saved = getSavedTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setLocal(currentTheme());
    if (saved) applyTheme(saved); else applyTheme(mq.matches ? "dark" : "light");
    sync();
    const onSystem = () => { if (!getSavedTheme()) { applyTheme(mq.matches ? "dark" : "light"); sync(); } };
    mq.addEventListener("change", onSystem);
    window.addEventListener("theme-change", sync);
    return () => { mq.removeEventListener("change", onSystem); window.removeEventListener("theme-change", sync); };
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setTheme(next)}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
