/**
 * server.js
 * Express server that:
 *  1. Proxies /api/predict → Anthropic API (keeps API key server-side)
 *  2. Serves the Vite production build as static files
 *  3. Falls back to index.html for client-side routing (React Router)
 *
 * Place in the project root alongside package.json.
 */

import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fetchF1News, clearNewsCache } from "./newsService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));

// ─── Security middleware ───────────────────────────────────────────────────────

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes before trying again." },
});

// ─── Anthropic proxy endpoint ─────────────────────────────────────────────────

app.post("/api/predict", rateLimiter, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Set it in your .env file or as an environment variable.");
    return res.status(500).json({
      error: "Server configuration error: API key not set. Please configure ANTHROPIC_API_KEY in your environment.",
    });
  }

  // Validate request body
  if (!req.body || !req.body.messages) {
    console.error("Invalid request body - missing messages array");
    return res.status(400).json({
      error: "Invalid request: missing messages array",
    });
  }

  // Log payload size for debugging (don't log sensitive content)
  const payloadSize = JSON.stringify(req.body).length;
  console.log(`[/api/predict] Request size: ${(payloadSize / 1024).toFixed(2)} KB`);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, JSON.stringify(data, null, 2));
      return res.status(anthropicRes.status).json({
        error: data?.error?.message || "Anthropic API error",
        details: data?.error?.type || "unknown",
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("Proxy fetch error:", err.message);
    console.error("Stack:", err.stack);
    return res.status(502).json({ 
      error: "Failed to reach Anthropic API.",
      details: err.message 
    });
  }
});

// ─── Health check (used by Fly.io) ───────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Public runtime config (safe to expose — anon key is not a secret) ───────

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
});

// ─── Official F1 Fantasy price snapshots ─────────────────────────────────────
//
// data/price_snapshots.json is committed to the repo by the scheduled
// .github/workflows/refresh-fantasy-prices.yml workflow (fetches the public
// F1 Fantasy statistics feed daily). Ships with the deployed image, so it's
// available even though Fly's container disk isn't persistent. Returns an
// empty history gracefully if the file doesn't exist yet (e.g. before the
// workflow has ever run).

const PRICE_SNAPSHOTS_PATH   = join(__dirname, "data", "price_snapshots.json");
const FANTASY_CONFIG_PATH    = join(__dirname, "data", "fantasy_config.json");
const FANTASY_SCHEDULE_PATH  = join(__dirname, "data", "fantasy_schedule.json");
const FANTASY_DRIVERS_PATH   = join(__dirname, "data", "fantasy_drivers.json");
const PRICE_HISTORY_LIMIT = 14;

app.get("/api/fantasy-prices", rateLimiter, async (_req, res) => {
  try {
    const raw = await readFile(PRICE_SNAPSHOTS_PATH, "utf-8");
    const snapshots = JSON.parse(raw);
    const history = snapshots.slice(-PRICE_HISTORY_LIMIT);
    const latest = history[history.length - 1] || null;
    return res.json({ latest, history });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ latest: null, history: [] });
    }
    console.error("[/api/fantasy-prices] Error reading price snapshots:", err.message);
    return res.status(500).json({ error: "Failed to read price snapshots", details: err.message });
  }
});

// ─── Fantasy F1 feed snapshots ────────────────────────────────────────────────
//
// data/fantasy_config.json, data/fantasy_schedule.json, and
// data/fantasy_drivers.json are written daily by the
// scripts/fetch-fantasy-feeds.mjs script (run by the
// refresh-fantasy-prices workflow). They contain:
//
//   /api/fantasy/config   — web_config.json: game IDs, active rounds, etc.
//   /api/fantasy/schedule — raceday_en.json: full season race calendar
//   /api/fantasy/drivers  — drivers/{gameId}_en.json: full player roster
//                           (names, teams, prices). Racing numbers, headshots,
//                           and team colours are NOT in this feed — those
//                           come from the static maps in /api/openf1/drivers.
//
// All three return { ok: false } gracefully when the file hasn't been
// written yet (e.g. first deploy before the workflow has run).

async function readSnapshot(filePath, label) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error(`[${label}] Error reading ${filePath}:`, err.message);
    return null;
  }
}

app.get("/api/fantasy/config", rateLimiter, async (_req, res) => {
  const data = await readSnapshot(FANTASY_CONFIG_PATH, "/api/fantasy/config");
  if (!data) return res.json({ ok: false, reason: "snapshot not yet available" });
  return res.json({ ok: true, fetchedAt: data.fetchedAt, config: data.raw });
});

app.get("/api/fantasy/schedule", rateLimiter, async (_req, res) => {
  const data = await readSnapshot(FANTASY_SCHEDULE_PATH, "/api/fantasy/schedule");
  if (!data) return res.json({ ok: false, reason: "snapshot not yet available", races: [] });
  return res.json({ ok: true, fetchedAt: data.fetchedAt, races: data.races });
});

app.get("/api/fantasy/drivers", rateLimiter, async (_req, res) => {
  const data = await readSnapshot(FANTASY_DRIVERS_PATH, "/api/fantasy/drivers");
  if (!data) return res.json({ ok: false, reason: "snapshot not yet available", drivers: [], constructors: [] });
  return res.json({
    ok: true,
    fetchedAt: data.fetchedAt,
    gameId: data.gameId,
    drivers: data.drivers,
    constructors: data.constructors,
  });
});

// ─── 2026 F1 driver roster: Fantasy player name → racing number + abbreviation ─
//
// The F1 Fantasy feed uses internal player IDs that differ from FIA driver
// numbers. This static map lets us convert the Fantasy driver name into the
// official racing number shown on the car, so the TeamBuilder and pricing
// utilities can key everything off the familiar race-day number.
// Any driver whose name isn't found here will fall back to their Fantasy
// player-ID as the identifier (still displayed correctly, just a larger number).

const FANTASY_NAME_TO_DRIVER_NUMBER = {
  "Max Verstappen":    { number: 1,  abbr: "VER" },
  "Isack Hadjar":      { number: 6,  abbr: "HAD" },
  "George Russell":    { number: 63, abbr: "RUS" },
  "Kimi Antonelli":    { number: 12, abbr: "ANT" },
  "Lewis Hamilton":    { number: 44, abbr: "HAM" },
  "Charles Leclerc":   { number: 16, abbr: "LEC" },
  "Lando Norris":      { number: 4,  abbr: "NOR" },
  "Oscar Piastri":     { number: 81, abbr: "PIA" },
  "Fernando Alonso":   { number: 14, abbr: "ALO" },
  "Lance Stroll":      { number: 18, abbr: "STR" },
  "Pierre Gasly":      { number: 10, abbr: "GAS" },
  "Franco Colapinto":  { number: 43, abbr: "COL" },
  "Carlos Sainz":      { number: 55, abbr: "SAI" },
  "Alexander Albon":   { number: 23, abbr: "ALB" },
  "Yuki Tsunoda":      { number: 22, abbr: "TSU" },
  "Liam Lawson":       { number: 30, abbr: "LAW" },
  "Arvid Lindblad":    { number: 7,  abbr: "LIN" },
  "Nico Hulkenberg":   { number: 27, abbr: "HUL" },
  "Gabriel Bortoleto": { number: 5,  abbr: "BOR" },
  "Valtteri Bottas":   { number: 77, abbr: "BOT" },
  "Sergio Perez":      { number: 11, abbr: "PER" },
  "Esteban Ocon":      { number: 31, abbr: "OCO" },
  "Oliver Bearman":    { number: 87, abbr: "BEA" },
};

// 2026 team hex colours (kept server-side so they can be included in the grid
// response without requiring the client to have its own copy).
const TEAM_COLOURS_2026 = {
  "Red Bull Racing": "#3671C6",
  "Mercedes":        "#27F4D2",
  "Ferrari":         "#E8002D",
  "McLaren":         "#FF8000",
  "Aston Martin":    "#229971",
  "Alpine":          "#FF87BC",
  "Williams":        "#64C4FF",
  "Racing Bulls":    "#6692FF",
  "Audi":            "#D0D0D0",
  "Cadillac":        "#CC1E4A",
  "Haas F1 Team":    "#B6BABD",
};

function teamColour(teamName) {
  if (!teamName) return "#6B7280";
  if (TEAM_COLOURS_2026[teamName]) return TEAM_COLOURS_2026[teamName];
  const lower = teamName.toLowerCase();
  for (const [k, v] of Object.entries(TEAM_COLOURS_2026)) {
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v;
  }
  return "#6B7280";
}

// ─── Build driver grid from Fantasy F1 feeds ─────────────────────────────────
//
// Primary: data/fantasy_drivers.json (drivers/{gameId}_en.json snapshot).
//   Names, team names, abbreviations, and prices come directly from the
//   Fantasy platform. This feed does NOT include racing numbers, team
//   colours, or headshot URLs (verified 2026-09-21) — those still come from
//   the static FANTASY_NAME_TO_DRIVER_NUMBER map / teamColour() below.
//   Written by scripts/fetch-fantasy-feeds.mjs.
//
// Secondary: data/price_snapshots.json (driverconstructors_4.json snapshot).
//   Contains names, teams, and prices but not racing numbers; enriched with a
//   static name→number map so the frontend can key everything off race numbers.
//   Written by scripts/fetch-fantasy-prices.mjs.
//
// Both files are committed to the repo by GitHub Actions and ship inside the
// deployed Docker image, so they're always available even after a cache clear.

function buildGridFromSnapshot(snapshot) {
  if (!snapshot?.drivers?.length) return null;

  // Resolve each fantasy driver entry → racing number
  const byNumber = new Map();

  for (const d of snapshot.drivers) {
    const mapping = FANTASY_NAME_TO_DRIVER_NUMBER[d.name];
    const driverNumber = mapping ? mapping.number : Number(d.playerId);
    const abbr = mapping ? mapping.abbr : d.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 3);

    const entry = {
      driver_number: driverNumber,
      full_name: d.name,
      name_acronym: abbr,
      team_name: d.team,
      team_colour: teamColour(d.team),
      headshot_url: null,
      country_code: null,
      // Extra Fantasy fields (bonus context for the client)
      fantasy_player_id: d.playerId,
      price_m: d.priceM,
    };

    if (!byNumber.has(driverNumber)) {
      byNumber.set(driverNumber, entry);
    } else {
      // Prefer the record whose team matches the mapping, otherwise keep latest
      const newTeam = entry.team_name?.toLowerCase() ?? "";
      // Heuristic: Red Bull Racing / Racing Bulls are the "senior" vs "junior"
      // teams — if both are present prefer the one already stored (first seen
      // usually corresponds to the driver's current seat in the feed order).
      // Fall through to replace only when the new entry has a non-junior team.
      const juniorTeams = ["racing bulls", "rb", "alphatauri", "visa cash app rb"];
      const newIsJunior = juniorTeams.some(t => newTeam.includes(t));
      if (!newIsJunior) {
        byNumber.set(driverNumber, entry);
      }
    }
  }

  return Array.from(byNumber.values());
}

// ─── OpenF1 driver data (via Cloudflare Worker KV cache, with direct fallback) ─
//
// Primary source: Fantasy F1 price snapshot (data/price_snapshots.json).
// This is built from the official fantasy.formula1.com feed, so it always
// reflects the current season's driver grid.  We enrich it with a static
// driver-number mapping so the frontend can use racing numbers as keys.
//
// Secondary source: Cloudflare Worker KV (when CLOUDFLARE_WORKER_URL is set).
// Tertiary fallback: OpenF1 API directly.

const DRIVERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let driversCache = { data: null, fetchedAt: 0 };

async function fetchDriversFromSnapshot() {
  // ── Path 1: fantasy_drivers.json (authoritative names/teams/prices; numbers,
  //    colours, and headshots still come from the static maps below since
  //    this feed doesn't provide them)
  try {
    const raw = await readFile(FANTASY_DRIVERS_PATH, "utf-8");
    const data = JSON.parse(raw);
    const drivers = data?.drivers;
    if (Array.isArray(drivers) && drivers.length > 0) {
      const byNumber = new Map();
      for (const d of drivers) {
        if (!d.isActive && d.isActive !== undefined) continue; // skip inactive
        // Prefer number from feed; fall back to static map; finally use playerId
        const mapping = FANTASY_NAME_TO_DRIVER_NUMBER[d.name];
        const driverNumber = d.number || (mapping ? mapping.number : Number(d.playerId));
        if (!driverNumber) continue;

        const abbr = d.shortName || (mapping ? mapping.abbr : (d.name || "").split(" ").map(p => p[0]).join("").slice(0, 3).toUpperCase());

        const entry = {
          driver_number: driverNumber,
          full_name:     d.name,
          name_acronym:  abbr,
          team_name:     d.teamName,
          team_colour:   d.teamColour || teamColour(d.teamName),
          headshot_url:  d.headshotUrl || null,
          country_code:  null,
          fantasy_player_id: d.playerId,
          price_m:       d.priceM,
        };

        if (!byNumber.has(driverNumber)) {
          byNumber.set(driverNumber, entry);
        } else {
          // Keep the entry whose team is NOT a junior team (same logic as below)
          const newTeam = (d.teamName || "").toLowerCase();
          const juniorTeams = ["racing bulls", "rb", "alphatauri", "visa cash app rb"];
          if (!juniorTeams.some(t => newTeam.includes(t))) {
            byNumber.set(driverNumber, entry);
          }
        }
      }
      const grid = Array.from(byNumber.values());
      if (grid.length > 0) {
        console.log(`[/api/openf1/drivers] Serving ${grid.length} drivers from fantasy_drivers.json`);
        return grid;
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[/api/openf1/drivers] fantasy_drivers.json read error:", err.message);
    }
  }

  // ── Path 2: price_snapshots.json + static name→number map
  try {
    const raw = await readFile(PRICE_SNAPSHOTS_PATH, "utf-8");
    const snapshots = JSON.parse(raw);
    if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
    const latest = snapshots[snapshots.length - 1];
    const drivers = buildGridFromSnapshot(latest);
    if (drivers && drivers.length > 0) {
      console.log(`[/api/openf1/drivers] Serving ${drivers.length} drivers from price_snapshots.json`);
      return drivers;
    }
    return null;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[/api/openf1/drivers] price_snapshots.json read error:", err.message);
    }
    return null;
  }
}

async function fetchDriversFromWorker() {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  if (!workerUrl) return null;

  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/drivers`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Worker /drivers returned ${res.status}`);
  const body = await res.json();
  if (!body.drivers) return null;

  // The Worker returns camelCase fields; normalize back to OpenF1's native
  // snake_case shape so callers don't care which path served the data.
  return body.drivers.map((d) => ({
    driver_number: d.driverNumber,
    full_name: d.fullName,
    name_acronym: d.abbreviation,
    team_name: d.teamName,
    team_colour: d.teamColour,
    headshot_url: d.headshotUrl,
    country_code: d.countryCode,
  }));
}

async function fetchDriversFromOpenF1() {
  const res = await fetch("https://api.openf1.org/v1/drivers?session_key=latest", {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`OpenF1 /drivers returned ${res.status}`);
  return res.json();
}

app.get("/api/openf1/drivers", rateLimiter, async (_req, res) => {
  if (driversCache.data && Date.now() - driversCache.fetchedAt < DRIVERS_CACHE_TTL_MS) {
    return res.json(driversCache.data);
  }

  // 1. Try the Fantasy F1 price snapshot (authoritative 2026 driver list)
  const snapshotDrivers = await fetchDriversFromSnapshot();
  if (snapshotDrivers) {
    driversCache = { data: snapshotDrivers, fetchedAt: Date.now() };
    return res.json(snapshotDrivers);
  }

  // 2. Cloudflare Worker KV cache
  try {
    const workers = await fetchDriversFromWorker();
    if (workers) {
      driversCache = { data: workers, fetchedAt: Date.now() };
      return res.json(workers);
    }
  } catch (workerErr) {
    console.warn(`[/api/openf1/drivers] Worker unavailable (${workerErr.message}), falling back to OpenF1 directly`);
  }

  // 3. OpenF1 directly
  try {
    const drivers = await fetchDriversFromOpenF1();
    driversCache = { data: drivers, fetchedAt: Date.now() };
    return res.json(drivers);
  } catch (openf1Err) {
    console.error(`[/api/openf1/drivers] OpenF1 fallback failed: ${openf1Err.message}`);
    if (driversCache.data) {
      return res.json(driversCache.data); // serve stale rather than nothing
    }
    return res.status(502).json({ error: "Failed to fetch driver data", details: openf1Err.message });
  }
});

// ─── F1 News aggregation endpoint ────────────────────────────────────────────

app.get("/api/news", rateLimiter, async (_req, res) => {
  try {
    const newsData = await fetchF1News();
    return res.json(newsData);
  } catch (err) {
    console.error("News fetch error:", err.message);
    return res.status(502).json({
      error: "Failed to fetch F1 news.",
      details: err.message,
      articles: [],
      sources_attempted: [],
      sources_succeeded: [],
      sources_failed: [{ name: "all", error: err.message }],
      fetched_at: new Date().toISOString(),
    });
  }
});

app.delete("/api/news/cache", (_req, res) => {
  clearNewsCache();
  res.json({ ok: true, message: "News cache cleared" });
});

// ─── Serve Vite build ─────────────────────────────────────────────────────────

const DIST = join(__dirname, "dist");

app.use(rateLimiter, express.static(DIST));

// Fallback: send index.html for all non-API routes (React Router)
// Note: Express 5 doesn't support app.get("*") — use middleware instead
app.use(rateLimiter, (req, res) => {
  res.sendFile(join(DIST, "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const apiKey = process.env.ANTHROPIC_API_KEY;

createServer(app).listen(PORT, () => {
  console.log(`Fantasy F1 server running on port ${PORT}`);
  
  if (apiKey) {
    console.log(`✓ ANTHROPIC_API_KEY loaded (value present in environment)`);
  } else {
    console.warn(`⚠️  ANTHROPIC_API_KEY not found - AI predictions will not work`);
    console.warn(`   Add ANTHROPIC_API_KEY to your .env file`);
  }
});
