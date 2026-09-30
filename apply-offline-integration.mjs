#!/usr/bin/env node
/**
 * Adds the offline-mode hooks to YOUR CURRENT files without replacing them,
 * so your own changes (e.g. dark mode) are kept.
 *
 * Run from the project root:   node apply-offline-integration.mjs
 * Safe to run twice. Each edited file is first backed up as <file>.before-offline
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let problems = 0;

function patch(rel, steps) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log(`- ${rel}: not found, skipped`); problems++; return; }
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let src = raw.replace(/\r\n/g, "\n");
  const before = src;
  for (const s of steps) {
    if (s.done(src)) { console.log(`  ok (already there): ${rel} - ${s.name}`); continue; }
    const out = s.apply(src);
    if (out === null || out === src) {
      console.log(`  !! could not apply: ${rel} - ${s.name}\n     -> add it by hand (see INSTALL.md, "Manual lines")`);
      problems++;
    } else { src = out; console.log(`  added: ${rel} - ${s.name}`); }
  }
  if (src !== before) {
    fs.writeFileSync(file + ".before-offline", raw);
    fs.writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src);
  }
}

// ---------------------------------------------------------------- app-shell
patch("src/components/app-shell.tsx", [
  {
    name: "imports",
    done: (s) => s.includes("OfflineIndicator"),
    apply: (s) => s.replace(/^(import \{ NotificationBell \} from "\.\/notification-bell";\n)/m,
      `$1import { OfflineIndicator } from "./offline-indicator";\nimport { pendingChangeCount } from "@/lib/offline";\n`),
  },
  {
    name: "confirm before signing out with unsynced changes",
    done: (s) => s.includes("pendingChangeCount()"),
    apply: (s) => s.replace(/^(\s*)await signOut\(\);/m, (_m, ind) =>
      `${ind}const n = await pendingChangeCount();\n` +
      `${ind}if (n > 0 && !window.confirm(\`\${n} change\${n > 1 ? "s haven't" : " hasn't"} synced yet. Signing out now will discard \${n > 1 ? "them" : "it"}. Sign out anyway?\`)) return;\n` +
      `${ind}await signOut();`),
  },
  {
    name: "offline indicator in the top bar",
    done: (s) => s.includes("<OfflineIndicator"),
    apply: (s) => s.replace(/^(\s*)<NotificationBell \/>/m, (_m, ind) =>
      `${ind}<OfflineIndicator paths={items.flatMap((i) => (isGroup(i) ? i.children : [i]).map((l) => l.to))} />\n${ind}<NotificationBell />`),
  },
]);

// --------------------------------------------------------------------- auth
const OLD_LISTENER = `    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadRoles(s.user.id);
      else setRoles([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadRoles(data.session.user.id);
      setLoading(false);
    });`;
const NEW_LISTENER = `    // Offline: an expired token can't be refreshed, which would look like
    // "signed out". If a saved session still exists locally, keep using it.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      const eff = s ?? (event === "INITIAL_SESSION" ? (readStoredSession() as Session | null) : null);
      setSession(eff);
      if (eff?.user) loadRoles(eff.user.id);
      else setRoles([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      const eff = data.session ?? (readStoredSession() as Session | null);
      setSession(eff);
      if (eff?.user) loadRoles(eff.user.id);
      setLoading(false);
    });`;
patch("src/lib/auth.tsx", [
  {
    name: "import",
    done: (s) => s.includes("@/lib/offline"),
    apply: (s) => s.replace(/^(import \{ supabase \} from "@\/integrations\/supabase\/client";\n)/m,
      `$1import { clearOfflineData, readStoredSession } from "@/lib/offline";\n`),
  },
  {
    name: "keep the saved session while offline",
    done: (s) => s.includes("readStoredSession() as Session"),
    apply: (s) => (s.includes(OLD_LISTENER) ? s.replace(OLD_LISTENER, NEW_LISTENER) : null),
  },
  {
    name: "clear device data on sign-out",
    done: (s) => s.includes("clearOfflineData()"),
    apply: (s) => s.replace("signOut: async () => { await supabase.auth.signOut(); },",
      "signOut: async () => { await supabase.auth.signOut(); await clearOfflineData(); },"),
  },
]);

// ------------------------------------------------------------ live refresh
patch("src/hooks/use-live-refresh.ts", [
  {
    name: "refresh when offline changes sync",
    done: (s) => s.includes("naha:refresh"),
    apply: (s) => {
      if (!s.includes('window.addEventListener("online", fire);') || !s.includes('window.removeEventListener("online", fire);')) return null;
      return s
        .replace('window.addEventListener("online", fire);', 'window.addEventListener("online", fire);\n    window.addEventListener("naha:refresh", fire); // offline changes just synced')
        .replace('window.removeEventListener("online", fire);', 'window.removeEventListener("online", fire);\n      window.removeEventListener("naha:refresh", fire);');
    },
  },
]);

console.log(problems ? `\nDone with ${problems} item(s) needing a manual step (see INSTALL.md).` : "\nAll offline hooks are in place. Your other changes were left untouched.");
