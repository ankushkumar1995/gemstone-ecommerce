/**
 * Tiny SHA-256 helper (Web Crypto — edge-safe). Used to store a hash of the
 * refresh token (never the token itself) so a DB leak can't resurrect sessions.
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
