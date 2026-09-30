/**
 * Shared client helpers: type (company / individual), display name and search.
 * Used by the Clients list and the global search palette so both behave the same.
 */
export type ClientType = "company" | "individual";

export type ClientLike = {
  client_type?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  kra_pin?: string | null;
  id_number?: string | null;
  reg_number?: string | null;
  email?: string | null;
  phone?: string | null;
};

export const clientType = (c: ClientLike): ClientType =>
  c.client_type === "individual" ? "individual" : "company";

/** Individuals show "First Last" (falling back to company_name); companies show company_name. */
export function clientDisplayName(c: ClientLike): string {
  if (clientType(c) === "individual") {
    const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    return full || c.company_name || "Unnamed individual";
  }
  return c.company_name || "Unnamed client";
}

/** True when every word typed appears somewhere in the client's searchable fields. */
export function clientMatches(c: ClientLike, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    c.company_name, c.first_name, c.last_name,
    [c.first_name, c.last_name].filter(Boolean).join(" "),
    c.kra_pin, c.id_number, c.reg_number, c.email, c.phone,
  ].filter(Boolean).join(" ").toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

/**
 * PostgREST `.or()` filter for searching the clients table (companies and individuals).
 * `cleaned` must already be stripped of filter-breaking characters.
 */
export function clientSearchFilter(cleaned: string): string {
  const like = `%${cleaned}%`;
  const parts = [
    `company_name.ilike.${like}`,
    `first_name.ilike.${like}`,
    `last_name.ilike.${like}`,
    `kra_pin.ilike.${like}`,
    `id_number.ilike.${like}`,
    `reg_number.ilike.${like}`,
    `email.ilike.${like}`,
  ];
  // "John Doe" -> first name John AND last name Doe
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length >= 2) {
    parts.push(`and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words.slice(1).join(" ")}%)`);
  }
  return parts.join(",");
}
