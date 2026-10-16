/** Local-first by default; account-backed cloud sync requires explicit opt-in. */
export function isCloudAccountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CLOUD_ACCOUNTS === "true";
}
