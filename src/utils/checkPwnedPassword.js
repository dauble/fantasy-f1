/**
 * checkPwnedPassword.js
 *
 * Supabase's built-in "leaked password protection" (HaveIBeenPwned check) is
 * gated to paid plans. This replicates it client-side using HIBP's public
 * Pwned Passwords API and its k-anonymity range model: only the first 5
 * characters of the password's SHA-1 hash are ever sent over the network,
 * so the password itself never leaves the browser.
 *
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function sha1Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Checks a password against known data breaches via HIBP.
 *
 * Returns `{ pwned: boolean, count: number }`. Fails open (`pwned: false`)
 * on any network or API error, so an HIBP outage never blocks sign-up.
 */
export async function checkPwnedPassword(password) {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return { pwned: false, count: 0 };

    const body = await res.text();
    const match = body
      .split('\n')
      .map((line) => line.trim().split(':'))
      .find(([lineSuffix]) => lineSuffix === suffix);

    return match ? { pwned: true, count: Number(match[1]) } : { pwned: false, count: 0 };
  } catch {
    return { pwned: false, count: 0 };
  }
}
