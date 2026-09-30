import { clientType, type ClientLike } from "@/lib/client-search";

/** Small "Company" / "Individual" category badge, shared by the Clients list and global search. */
export function ClientTypeBadge({ client, type }: { client?: ClientLike; type?: string | null }) {
  const t = client ? clientType(client) : type === "individual" ? "individual" : "company";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${
        t === "individual"
          ? "border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300"
          : "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
      }`}
    >
      {t === "individual" ? "Individual" : "Company"}
    </span>
  );
}
