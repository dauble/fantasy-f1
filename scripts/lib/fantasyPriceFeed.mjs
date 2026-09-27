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

// Every other statistic category in the feed, keyed by its feed `key` and the
// snapshot field we store it under. Each category's `participants` carry the
// same `statvalue` shape, just keyed by a different stat — so unlike fPoints
// (the base record) these are only ever looked up by playerid, never iterated.
// `driverOfday` only appears in `Data.driver`; `fastestPitstopstats` only in
// `Data.constructor` — both simply resolve to `null` on the section that
// lacks them, which is fine since every field here is optional context.
const EXTRA_STAT_FIELDS = {
  fAvg: "avgPoints",
  pointsPermillion: "pointsPerMillion",
  overTakepoints: "overtakePoints",
  podiumsStats: "podiums",
  topFinshed: "topTenFinishes", // sic — matches the feed's own (misspelled) key
  mostDnf: "dnfs",
  fastestLap: "fastestLaps",
  driverOfday: "driverOfDayCount",
  fastestPitstopstats: "fastestPitstops",
};

/** Merge every statistics category into one record per player. */
function extractSection(sectionCategories) {
  const byKey = {};
  const categoryLookup = Object.fromEntries(
    sectionCategories.map((cat) => [cat.config.key, cat.participants])
  );

  const byPlayerId = (categoryKey) =>
    Object.fromEntries((categoryLookup[categoryKey] || []).map((p) => [p.playerid, p.statvalue]));

  const fPoints = categoryLookup.fPoints || [];
  const priceChangeByPlayerId = byPlayerId("priceChange");
  const selectionByPlayerId = byPlayerId("mostPicked");
  const extraStatsByField = Object.fromEntries(
    Object.entries(EXTRA_STAT_FIELDS).map(([feedKey, field]) => [field, byPlayerId(feedKey)])
  );

  for (const p of fPoints) {
    const record = {
      playerId: p.playerid,
      name: p.playername, // null for constructors
      team: p.teamname,
      priceM: p.curvalue,
      points: p.statvalue,
      seasonPriceChangeM: priceChangeByPlayerId[p.playerid] ?? null,
      selectionPct: selectionByPlayerId[p.playerid] ?? null,
    };
    for (const field of Object.values(EXTRA_STAT_FIELDS)) {
      record[field] = extraStatsByField[field][p.playerid] ?? null;
    }
    byKey[p.playerid] = record;
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
