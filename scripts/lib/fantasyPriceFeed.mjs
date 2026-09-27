/**
 * fantasyPriceFeed.mjs
 *
 * Fetches and parses the official (public, no auth required) F1 Fantasy
 * statistics feed into one snapshot record. Shared by:
 *  - scripts/fetch-fantasy-prices.mjs (daily GitHub Actions cron)
 *  - server.js (POST /api/fantasy-prices/sync, on-demand from the UI)
 *
 * Feed: https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json
 * It only reflects current state (no history), so callers snapshot it over
 * time to build a real trend.
 */

export const FANTASY_PRICE_FEED_URL =
  "https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json";

export const MAX_PRICE_SNAPSHOTS = 90;

/** Merge the fPoints / priceChange / mostPicked categories into one record per player. */
function extractSection(sectionCategories) {
  const byKey = {};
  const categoryLookup = Object.fromEntries(
    sectionCategories.map((cat) => [cat.config.key, cat.participants])
  );

  const fPoints = categoryLookup.fPoints || [];
  const priceChangeByPlayerId = Object.fromEntries(
    (categoryLookup.priceChange || []).map((p) => [p.playerid, p.statvalue])
  );
  const selectionByPlayerId = Object.fromEntries(
    (categoryLookup.mostPicked || []).map((p) => [p.playerid, p.statvalue])
  );

  for (const p of fPoints) {
    byKey[p.playerid] = {
      playerId: p.playerid,
      name: p.playername, // null for constructors
      team: p.teamname,
      priceM: p.curvalue,
      points: p.statvalue,
      seasonPriceChangeM: priceChangeByPlayerId[p.playerid] ?? null,
      selectionPct: selectionByPlayerId[p.playerid] ?? null,
    };
  }

  return Object.values(byKey);
}

/**
 * Fetches the live feed and returns one snapshot record:
 * { fetchedAt, season, drivers, constructors }.
 * Throws if the feed is unreachable or returns no driver data.
 */
export async function fetchFantasyPriceSnapshot() {
  const res = await fetch(FANTASY_PRICE_FEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (fantasy-f1 price sync)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`F1 Fantasy feed returned ${res.status}`);
  }
  const feed = await res.json();

  const drivers = extractSection(feed.Data.driver);
  const constructors = extractSection(feed.Data.constructor);

  if (drivers.length === 0) {
    throw new Error("Feed returned no driver data — refusing to build an empty snapshot");
  }

  return {
    fetchedAt: new Date().toISOString(),
    season: feed.Data.season,
    drivers,
    constructors,
  };
}
