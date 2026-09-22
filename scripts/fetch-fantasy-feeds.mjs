#!/usr/bin/env node
/**
 * fetch-fantasy-feeds.mjs
 *
 * Fetches several public (no-auth) F1 Fantasy feeds and saves them as
 * committed snapshots under data/. Run daily by the GitHub Actions workflow
 * alongside fetch-fantasy-prices.mjs so all Fantasy-sourced data files
 * stay current.
 *
 * Feeds fetched:
 *   1. web_config.json   → data/fantasy_config.json
 *      App/game configuration: current game ID, season, active rounds, etc.
 *
 *   2. raceday_en.json   → data/fantasy_schedule.json
 *      Full season race schedule with round names, dates, and status flags.
 *
 *   3. drivers/{gameId}_en.json → data/fantasy_drivers.json
 *      Full driver/constructor roster for the current game, including racing
 *      numbers, abbreviations, headshot URLs, team colours, and prices. This
 *      is the authoritative source for *which* players are in the game and
 *      their official metadata. The game ID is read from web_config.json.
 *
 * Cross-verification with OpenF1:
 *   After saving, the script fetches the OpenF1 driver list for the current
 *   year and reports any mismatches (name, team, number) to stdout so the
 *   GitHub Actions log surfaces them without blocking the commit.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, "..", "data");

const F1_FANTASY_BASE = "https://fantasy.formula1.com";
const OPENF1_BASE     = "https://api.openf1.org/v1";

const HEADERS = { "User-Agent": "Mozilla/5.0 (fantasy-f1 price sync)" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(url, label) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${label} HTTP ${res.status} for ${url}`);
  return res.json();
}

async function writeSnapshot(filename, data) {
  await mkdir(DATA_DIR, { recursive: true });
  const path = join(DATA_DIR, filename);
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ Wrote ${filename}`);
}

// ─── 1. web_config.json ───────────────────────────────────────────────────────

async function fetchConfig() {
  const url  = `${F1_FANTASY_BASE}/feeds/v2/apps/web_config.json`;
  const raw  = await fetchJSON(url, "web_config");

  // Save the full raw payload; server.js will expose it via /api/fantasy/config
  await writeSnapshot("fantasy_config.json", {
    fetchedAt: new Date().toISOString(),
    raw,
  });

  return raw;
}

/**
 * Extract the current "game ID" used by the Fantasy platform.
 * The web_config shape has varied across seasons; we try several known paths.
 */
function extractGameId(config) {
  // Known paths (most recent first):
  const candidates = [
    config?.Data?.Value?.GameId,
    config?.Data?.Value?.gameId,
    config?.Data?.gameId,
    config?.gameId,
    config?.Data?.Value?.CurrentGame?.Id,
    config?.Data?.Value?.CurrentGame?.GameId,
    // Flatten any top-level numeric key that looks like an ID
    ...(Array.isArray(config?.Data?.Value?.Games)
      ? config.Data.Value.Games.filter(g => g.IsActive || g.isActive).map(g => g.Id || g.id || g.GameId || g.gameId)
      : []),
  ].filter(Boolean);

  if (candidates.length === 0) {
    console.warn("⚠️  Could not auto-detect game ID from web_config — defaulting to 15");
    return "15";
  }
  const id = String(candidates[0]);
  console.log(`  game ID: ${id}`);
  return id;
}

// ─── 2. raceday_en.json ───────────────────────────────────────────────────────

async function fetchSchedule() {
  const url = `${F1_FANTASY_BASE}/feeds/v2/schedule/raceday_en.json`;
  const raw = await fetchJSON(url, "raceday_en");

  // Normalise into a flat race list regardless of raw shape.
  // Known shapes:
  //   { Data: { Value: { Races: [...] } } }
  //   { Data: { Races: [...] } }
  //   { races: [...] }
  const races = extractRaces(raw);

  await writeSnapshot("fantasy_schedule.json", {
    fetchedAt: new Date().toISOString(),
    races,
    raw,
  });

  console.log(`  schedule: ${races.length} race(s)`);
  return races;
}

function extractRaces(raw) {
  const inner = raw?.Data?.Value ?? raw?.Data ?? raw;
  const list  = inner?.Races ?? inner?.races ?? inner?.Events ?? inner?.events ?? [];
  return list.map(r => ({
    round:       r.Round       ?? r.round       ?? r.RoundNumber ?? r.roundNumber ?? null,
    name:        r.Name        ?? r.name        ?? r.EventName   ?? r.eventName   ?? null,
    circuit:     r.Circuit     ?? r.circuit     ?? r.CircuitName ?? r.circuitName ?? null,
    country:     r.Country     ?? r.country     ?? null,
    dateStart:   r.DateStart   ?? r.dateStart   ?? r.Date        ?? r.date        ?? null,
    dateEnd:     r.DateEnd     ?? r.dateEnd     ?? null,
    isComplete:  r.IsComplete  ?? r.isComplete  ?? r.Completed   ?? r.completed   ?? false,
    isActive:    r.IsActive    ?? r.isActive    ?? r.Active      ?? r.active      ?? false,
    gameweek:    r.GameweekId  ?? r.gameweekId  ?? r.Gameweek    ?? r.gameweek    ?? null,
  }));
}

// ─── 3. drivers/{gameId}_en.json ─────────────────────────────────────────────

async function fetchDrivers(gameId) {
  const url = `${F1_FANTASY_BASE}/feeds/drivers/${gameId}_en.json`;
  const raw = await fetchJSON(url, `drivers/${gameId}_en`);

  const { drivers, constructors } = extractPlayersFromDriverFeed(raw);

  await writeSnapshot("fantasy_drivers.json", {
    fetchedAt: new Date().toISOString(),
    gameId,
    drivers,
    constructors,
    raw,
  });

  console.log(`  drivers: ${drivers.length}, constructors: ${constructors.length}`);
  return { drivers, constructors };
}

/**
 * Normalise the driver feed into a stable internal shape.
 *
 * The Fantasy platform uses several different raw shapes across seasons.
 * We try several known paths and field name variants so this works even
 * after a schema change.
 *
 * Normalised driver shape:
 * {
 *   playerId:    string,   // Fantasy internal player ID
 *   name:        string,   // Full name ("Lewis Hamilton")
 *   firstName:   string,
 *   lastName:    string,
 *   shortName:   string,   // "HAM"
 *   number:      number,   // Racing number (44)
 *   teamId:      string,
 *   teamName:    string,   // "Ferrari"
 *   teamColour:  string,   // "#E8002D"
 *   headshotUrl: string,
 *   priceM:      number,   // price in millions
 *   isActive:    boolean,
 * }
 */
function extractPlayersFromDriverFeed(raw) {
  // Try to find the players list in various known locations
  const inner   = raw?.Data?.Value ?? raw?.Data ?? raw;
  const allList = inner?.Players ?? inner?.players ?? inner?.Drivers ?? inner?.drivers
                   ?? inner?.Elements ?? inner?.elements ?? [];

  const drivers      = [];
  const constructors = [];

  for (const p of allList) {
    const positionId = String(p.PositionId ?? p.positionId ?? p.position_id ?? "1");
    const isConstructor = positionId === "2" || (p.IsConstructor ?? p.isConstructor ?? false);

    const normalised = {
      playerId:    String(p.PlayerId    ?? p.playerId    ?? p.Id        ?? p.id        ?? ""),
      name:        p.DisplayName ?? p.displayName ?? p.Name ?? p.name
                     ?? `${p.PlayerForename ?? p.firstName ?? ""} ${p.PlayerSurname ?? p.lastName ?? ""}`.trim(),
      firstName:   p.PlayerForename ?? p.firstName  ?? p.FirstName  ?? "",
      lastName:    p.PlayerSurname  ?? p.lastName   ?? p.LastName   ?? "",
      shortName:   p.ShortName ?? p.shortName ?? p.Abbreviation ?? p.abbreviation ?? p.Code ?? "",
      number:      Number(p.Number ?? p.number ?? p.DriverNumber ?? p.driverNumber ?? 0) || null,
      teamId:      String(p.TeamId    ?? p.teamId    ?? p.ConstructorId ?? ""),
      teamName:    p.TeamName  ?? p.teamName  ?? p.Team ?? p.team ?? p.ConstructorName ?? "",
      teamColour:  normaliseColour(p.TeamColour ?? p.teamColour ?? p.Color ?? p.colour ?? ""),
      headshotUrl: p.ImageUrl  ?? p.imageUrl  ?? p.HeadshotUrl ?? p.headshotUrl ?? p.Photo ?? "",
      priceM:      Number(p.Value ?? p.value ?? p.Price ?? p.price ?? 0) / 1_000_000 || null,
      isActive:    p.IsActive  ?? p.isActive  ?? p.Active ?? p.active ?? true,
    };

    if (isConstructor) {
      constructors.push(normalised);
    } else {
      drivers.push(normalised);
    }
  }

  return { drivers, constructors };
}

function normaliseColour(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  // Ensure it starts with #
  return /^#/.test(s) ? s : `#${s}`;
}

// ─── 4. Cross-verify with OpenF1 ─────────────────────────────────────────────

async function crossVerifyWithOpenF1(fantasyDrivers) {
  console.log("\n── Cross-verifying with OpenF1 ──────────────────────────────────");
  try {
    const openF1 = await fetchJSON(
      `${OPENF1_BASE}/drivers?session_key=latest`,
      "OpenF1 drivers"
    );

    if (!Array.isArray(openF1) || openF1.length === 0) {
      console.warn("⚠️  OpenF1 returned no drivers — skipping cross-verification");
      return;
    }

    // Build a lookup by normalised last name for fuzzy matching
    const openF1ByLastName = new Map();
    for (const d of openF1) {
      const key = normaliseName(d.full_name).split(" ").pop();
      openF1ByLastName.set(key, d);
    }

    let matched = 0, mismatched = 0, missing = 0;

    for (const fd of fantasyDrivers) {
      const lastKey = normaliseName(fd.name).split(" ").pop();
      const of1 = openF1ByLastName.get(lastKey);
      if (!of1) {
        console.log(`  [MISSING in OpenF1] ${fd.name} (#${fd.number}, ${fd.teamName})`);
        missing++;
        continue;
      }
      matched++;

      const issues = [];
      if (fd.number && of1.driver_number && fd.number !== of1.driver_number) {
        issues.push(`number: Fantasy=${fd.number} OpenF1=${of1.driver_number}`);
      }
      if (fd.teamName && of1.team_name) {
        const fTeam = fd.teamName.toLowerCase().trim();
        const oTeam = of1.team_name.toLowerCase().trim();
        if (fTeam !== oTeam && !fTeam.includes(oTeam) && !oTeam.includes(fTeam)) {
          issues.push(`team: Fantasy="${fd.teamName}" OpenF1="${of1.team_name}"`);
        }
      }
      if (issues.length) {
        console.log(`  [MISMATCH] ${fd.name}: ${issues.join(", ")}`);
        mismatched++;
      }
    }

    console.log(`  Result: ${matched} matched, ${mismatched} mismatched, ${missing} missing from OpenF1`);
    if (missing > 0) {
      console.log("  (Missing drivers are likely 2026 newcomers not yet in OpenF1's session_key=latest)");
    }
  } catch (err) {
    console.warn(`  OpenF1 cross-verify failed: ${err.message}`);
  }
}

function normaliseName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Fetching F1 Fantasy feeds ===\n");

  // 1. Config (also gives us the game ID)
  console.log("1/3 web_config.json …");
  let gameId = "15"; // fallback
  try {
    const config = await fetchConfig();
    gameId = extractGameId(config);
  } catch (err) {
    console.error(`  ✗ ${err.message} — will use game ID "${gameId}" as fallback`);
  }

  // 2. Race schedule
  console.log("2/3 raceday_en.json …");
  try {
    await fetchSchedule();
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }

  // 3. Driver/constructor roster
  console.log(`3/3 drivers/${gameId}_en.json …`);
  let fantasyDrivers = [];
  try {
    const { drivers } = await fetchDrivers(gameId);
    fantasyDrivers = drivers;
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }

  // 4. Cross-verify
  if (fantasyDrivers.length > 0) {
    await crossVerifyWithOpenF1(fantasyDrivers);
  }

  console.log("\n=== Done ===");
}

main().catch(err => {
  console.error("fetch-fantasy-feeds failed:", err.message);
  process.exit(1);
});
