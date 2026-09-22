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

  // Normalise into a flat, one-row-per-meeting race list.
  //
  // Verified live shape (2026-09-21): { Data: { fixtures: [...], circuit: {...} } }
  // `fixtures` is a flat array of *sessions* (Qualifying / Race / Sprint
  // Qualifying), several per race weekend, keyed by `MeetingId`. There is no
  // `Races`/`Events` wrapper — that was an unverified guess in an earlier
  // version of this script and silently produced an empty list.
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
  const fixtures = raw?.Data?.fixtures ?? raw?.Data?.Value?.fixtures ?? raw?.fixtures ?? [];
  const byMeeting = new Map();

  for (const f of fixtures) {
    const meetingId = f.MeetingId ?? f.meetingId;
    if (meetingId == null) continue;

    let race = byMeeting.get(meetingId);
    if (!race) {
      race = {
        round:       f.MeetingNumber ?? f.meetingNumber ?? null,
        name:        f.MeetingName   ?? f.meetingName   ?? null,
        circuit:     f.CircuitOfficialName ?? f.circuitOfficialName ?? f.CircuitLocation ?? f.circuitLocation ?? null,
        country:     f.CountryName   ?? f.countryName   ?? null,
        dateStart:   null,
        dateEnd:     null,
        isComplete:  false,
        isActive:    false,
        gameweek:    f.GamedayId ?? f.gamedayId ?? null,
        // OpenF1 `session_key` for this meeting's Race session — lets callers
        // join precisely against OpenF1 instead of fuzzy name matching.
        openf1SessionKey: null,
      };
      byMeeting.set(meetingId, race);
    }

    const start = f.SessionStartDateISO8601 ?? f.sessionStartDateISO8601 ?? null;
    if (start && (!race.dateStart || start < race.dateStart)) race.dateStart = start;
    const end = f.SessionEndDateISO8601 ?? f.sessionEndDateISO8601 ?? null;
    if (end && (!race.dateEnd || end > race.dateEnd)) race.dateEnd = end;

    // The "Race" session's MatchStatus is the definitive completion signal
    // for the whole weekend (verified: "4" == finished, "0" == not yet run).
    const sessionType = f.SessionType ?? f.sessionType ?? "";
    if (sessionType === "Race") {
      race.isComplete = String(f.MatchStatus ?? f.GDStatus ?? "") === "4";
      race.isActive = !race.isComplete;
      race.openf1SessionKey = f.FOMMEETINGSESSIONKEY ?? f.fommeetingsessionkey ?? null;
    }
  }

  return Array.from(byMeeting.values()).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
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
 * Verified live shape (2026-09-21): { Data: { Value: [ {...}, {...} ] } } —
 * `Value` is a *flat array* of player rows, not wrapped in a Players/
 * Drivers/Elements key. Each row is either a DRIVER or a CONSTRUCTOR, told
 * apart by `PositionName` (there is no `PositionId`/`IsConstructor` field).
 *
 * Confirmed fields present on a real row (Gasly, #18):
 *   PlayerId, F1PlayerId, PositionName, TeamId, TeamName, FUllName (sic),
 *   DisplayName, DriverTLA, DriverReference, FirstName, LastName, Value
 *   (price in millions, e.g. 12.0), IsActive ("1"/"0" string), Status.
 *
 * Important: this feed does NOT include a racing car number, a team colour,
 * or a headshot URL — those fields are set to null/"" below rather than
 * guessed at, so downstream consumers (server.js, fantasyF1FeedService.js)
 * know to fall back to their static maps instead of silently matching zero
 * rows. We still try a handful of alternate key spellings in case the feed
 * schema changes again, but no longer pretend fields exist that don't.
 *
 * Normalised driver shape:
 * {
 *   playerId:    string,   // Fantasy internal player ID
 *   name:        string,   // Full name ("Lewis Hamilton")
 *   firstName:   string,
 *   lastName:    string,
 *   shortName:   string,   // "HAM"
 *   number:      number|null,  // NOT provided by this feed today
 *   teamId:      string,
 *   teamName:    string,   // "Ferrari"
 *   teamColour:  string,   // NOT provided by this feed today
 *   headshotUrl: string,   // NOT provided by this feed today
 *   priceM:      number,   // price in millions, used as-is (feed value IS in millions)
 *   isActive:    boolean,
 * }
 */
// Like `a ?? b ?? c`, but also skips empty strings — several fields in the
// real feed (e.g. CONSTRUCTOR rows' TeamName) are present but blank ("")
// rather than absent, which `??` alone would treat as a valid value.
function firstNonEmpty(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return "";
}

function extractPlayersFromDriverFeed(raw) {
  const inner = raw?.Data?.Value ?? raw?.Data ?? raw;
  const allList = Array.isArray(inner)
    ? inner
    : (inner?.Players ?? inner?.players ?? inner?.Drivers ?? inner?.drivers
        ?? inner?.Elements ?? inner?.elements ?? []);

  const drivers      = [];
  const constructors = [];

  for (const p of allList) {
    const positionName = String(p.PositionName ?? p.positionName ?? "").toUpperCase();
    const isConstructor = positionName === "CONSTRUCTOR"
      || (p.IsConstructor ?? p.isConstructor ?? false);

    const fullName = firstNonEmpty(
      p.DisplayName, p.displayName, p.FUllName, p.FullName, p.fullName, p.Name, p.name,
      `${firstNonEmpty(p.FirstName, p.PlayerForename, p.firstName)} ${firstNonEmpty(p.LastName, p.PlayerSurname, p.lastName)}`.trim(),
      p.TeamName, p.teamName,
    );

    const normalised = {
      playerId:    String(p.PlayerId    ?? p.playerId    ?? p.Id        ?? p.id        ?? ""),
      name:        fullName,
      firstName:   firstNonEmpty(p.FirstName, p.PlayerForename, p.firstName),
      lastName:    firstNonEmpty(p.LastName, p.PlayerSurname, p.lastName),
      shortName:   firstNonEmpty(p.DriverTLA, p.ShortName, p.shortName, p.Abbreviation, p.abbreviation, p.Code),
      number:      Number(p.Number ?? p.number ?? p.DriverNumber ?? p.driverNumber ?? 0) || null,
      teamId:      String(p.TeamId    ?? p.teamId    ?? p.ConstructorId ?? ""),
      // CONSTRUCTOR rows carry the team's own name in DisplayName/FUllName,
      // not TeamName (which is blank there) — fullName already resolves this.
      teamName:    isConstructor ? fullName : firstNonEmpty(p.TeamName, p.teamName, p.Team, p.team, p.ConstructorName),
      teamColour:  normaliseColour(p.TeamColour ?? p.teamColour ?? p.Color ?? p.colour ?? ""),
      headshotUrl: p.ImageUrl  ?? p.imageUrl  ?? p.HeadshotUrl ?? p.headshotUrl ?? p.Photo ?? "",
      priceM:      Number(p.Value ?? p.value ?? p.Price ?? p.price ?? 0) || null,
      isActive:    String(p.IsActive ?? p.isActive ?? p.Active ?? p.active ?? "1") !== "0",
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

async function crossVerifyWithOpenF1(fantasyDrivers, openf1SessionKey) {
  console.log("\n── Cross-verifying with OpenF1 ──────────────────────────────────");
  // Prefer the exact OpenF1 session_key for the most recently completed race,
  // read from the Fantasy schedule's FOMMEETINGSESSIONKEY field (verified to
  // match OpenF1's session_key one-to-one). `session_key=latest` is only a
  // fallback: right after a season rolls over (or before OpenF1 has ingested
  // the new season's sessions) it can silently point at last season's grid —
  // the exact bug this whole data pipeline was built to avoid.
  const sessionKey = openf1SessionKey || "latest";
  if (openf1SessionKey) {
    console.log(`  Using exact OpenF1 session_key=${sessionKey} (from Fantasy schedule)`);
  } else {
    console.warn("  No session key found in Fantasy schedule — falling back to session_key=latest (less reliable)");
  }
  try {
    const openF1 = await fetchJSON(
      `${OPENF1_BASE}/drivers?session_key=${sessionKey}`,
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
      console.log(`  (Missing drivers didn't appear in OpenF1 session_key=${sessionKey} — could be a session ${openf1SessionKey ? "absence (e.g. reserve/substitute who sat out)" : "mismatch since no exact session_key was available"})`);
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
  let races = [];
  try {
    races = await fetchSchedule();
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

  // 4. Cross-verify against the OpenF1 session for the most recently
  // completed race, so we compare against the correct season's grid instead
  // of guessing via session_key=latest.
  if (fantasyDrivers.length > 0) {
    const lastCompleted = races
      .filter(r => r.isComplete && r.openf1SessionKey)
      .sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart))[0];
    await crossVerifyWithOpenF1(fantasyDrivers, lastCompleted?.openf1SessionKey);
  }

  console.log("\n=== Done ===");
}

main().catch(err => {
  console.error("fetch-fantasy-feeds failed:", err.message);
  process.exit(1);
});
