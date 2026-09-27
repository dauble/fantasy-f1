/**
 * formatDate.js
 *
 * Server timestamps (e.g. price_snapshots.json's `fetchedAt`, written as
 * `new Date().toISOString()` — always UTC) need to render in whichever
 * timezone the person looking at the page is actually in, not the server's.
 * `toLocaleString()` with no `timeZone` option already resolves to the
 * browser's local zone, but leaving that implicit reads as ambiguous (is
 * this UTC or local?) — so this formatter converts to local time explicitly
 * and always appends the zone abbreviation.
 */

const OPTIONS = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

/** e.g. "Sep 26, 2026, 10:01 PM PDT" — always the viewer's local timezone. */
export function formatLocalDateTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, OPTIONS);
}
