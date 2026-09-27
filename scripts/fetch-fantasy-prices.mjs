#!/usr/bin/env node
/**
 * fetch-fantasy-prices.mjs
 *
 * Fetches the official F1 Fantasy statistics feed (via fantasyPriceFeed.mjs)
 * and appends a snapshot to data/price_snapshots.json. Run daily by
 * .github/workflows/refresh-fantasy-prices.yml, or manually for local testing.
 *
 * This is the durable path: the workflow commits the updated file to git, so
 * the history survives redeploys. The server's POST /api/fantasy-prices/sync
 * (triggered by the "Sync Official Prices" button) uses the same shared
 * fetch logic for an immediate, on-demand update between scheduled runs.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFantasyPriceSnapshot, MAX_PRICE_SNAPSHOTS } from "./lib/fantasyPriceFeed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "..", "data", "price_snapshots.json");

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
  const snapshot = await fetchFantasyPriceSnapshot();

  const existing = await loadExistingSnapshots();
  const updated = [...existing, snapshot].slice(-MAX_PRICE_SNAPSHOTS);

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(updated, null, 2) + "\n");

  console.log(
    `Wrote snapshot for season ${snapshot.season}: ${snapshot.drivers.length} drivers, ` +
      `${snapshot.constructors.length} constructors. Total snapshots on file: ${updated.length}.`
  );
}

main().catch((err) => {
  console.error("fetch-fantasy-prices failed:", err.message);
  process.exit(1);
});
