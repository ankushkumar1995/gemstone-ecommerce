/**
 * Device label helper for the partner panel (security / sessions views).
 *
 * The partner agreement text no longer lives here: versions are managed in
 * Admin → Partner Agreements and stored in the database
 * (see src/modules/agreements).
 */

/** Short, readable device label from the user agent. */
export function deviceLabel(ua: string) {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
