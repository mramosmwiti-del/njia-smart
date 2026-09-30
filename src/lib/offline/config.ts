/**
 * Offline layer settings. Everything you might want to tune lives here.
 */
export const OFFLINE_CONFIG = {
  /**
   * Tables that are NEVER stored on the device and never queued offline
   * (salary, bank, national ID, payslips). Their pages simply need internet.
   * Remove a name to make that data available offline too.
   */
  excludeTables: ["hr_employment", "payslips", "hr_documents"] as string[],

  /** Columns stripped from cached copies (never written to the device). */
  redactColumns: { clients: ["portal_password_hash"] } as Record<string, string[]>,

  /**
   * Server functions (rpc) that are safe to queue while offline. Anything not
   * listed (invoice numbering, chat, leave requests...) needs internet.
   */
  queueableRpc: ["set_client_tax_obligation"] as string[],

  /** A read slower than this is answered from the device copy (if one exists). */
  readTimeoutMs: 6000,
  /** Updates/deletes slower than this are queued (they are safe to repeat). */
  writeTimeoutMs: 15000,

  maxCacheEntries: 600,
  maxBodyBytes: 3_000_000,

  /** While unreachable, how often to check whether the server is back. */
  probeIntervalMs: 10_000,
  /** While changes are waiting, how often to retry syncing. */
  retryIntervalMs: 15_000,
};
