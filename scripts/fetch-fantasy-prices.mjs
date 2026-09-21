#!/usr/bin/env node
/**
 * fetch-fantasy-prices.mjs
 *
 * Fetches the official (public, no auth required) F1 Fantasy statistics feed
 * and appends a snapshot to data/price_snapshots.json. Run daily by
 * .github/workflows/refresh-fantasy-prices.yml, or manually for local testing.
 *
 * Feed: https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json
 * It only reflects current state (no history), so we snapshot it ourselves
 * over time to build a real trend for the Price Manager / predictions.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "..", "data", "price_snapshots.json");
const MAX_SNAPSHOTS = 90;

const FEED_URL = "https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json";

async function fetchFeed() {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (fantasy-f1 price sync)" },
  });
  if (!res.ok) {
    throw new Error(`F1 Fantasy feed returned ${res.status}`);
  }
  return res.json();
}

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

async function loadExistingSnapshots() {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    console.warn(`Could not parse existing ${SNAPSHOT_PATH}, starting fresh:`, err.message);
    return [];
  }
}

async function main() {
  const feed = await fetchFeed();

  const drivers = extractSection(feed.Data.driver);
  const constructors = extractSection(feed.Data.constructor);

  if (drivers.length === 0) {
    throw new Error("Feed returned no driver data — refusing to write an empty snapshot");
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    season: feed.Data.season,
    drivers,
    constructors,
  };

  const existing = await loadExistingSnapshots();
  const updated = [...existing, snapshot].slice(-MAX_SNAPSHOTS);

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(updated, null, 2) + "\n");

  console.log(
    `Wrote snapshot for season ${snapshot.season}: ${drivers.length} drivers, ` +
      `${constructors.length} constructors. Total snapshots on file: ${updated.length}.`
  );
}

main().catch((err) => {
  console.error("fetch-fantasy-prices failed:", err.message);
  process.exit(1);
});
