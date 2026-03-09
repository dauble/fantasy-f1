/**
 * openf1DataService.js
 * Fetches and aggregates historical race data from OpenF1 API
 * for use in AI-powered Fantasy F1 predictions.
 *
 * Drop this into: src/services/openf1DataService.js
 */

const BASE_URL = "https://api.openf1.org/v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Cache helpers (reuses your existing pattern) ───────────────────────────

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage errors silently
  }
}

async function fetchWithCache(url) {
  const cached = getCached(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenF1 API error: ${res.status} ${url}`);
  const data = await res.json();
  setCache(url, data);
  return data;
}

// ─── Core fetchers ───────────────────────────────────────────────────────────

/** Get the most recent N completed race sessions */
export async function getRecentRaceSessions(limit = 5) {
  const url = `${BASE_URL}/sessions?session_type=Race&limit=${limit * 2}`;
  const sessions = await fetchWithCache(url);
  // Filter only completed sessions and take the most recent `limit`
  return sessions
    .filter((s) => s.date_end && new Date(s.date_end) < new Date())
    .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
    .slice(0, limit);
}

/** Get the next upcoming race session */
export async function getNextRaceSession() {
  const url = `${BASE_URL}/sessions?session_type=Race&limit=5`;
  const sessions = await fetchWithCache(url);
  const upcoming = sessions
    .filter((s) => new Date(s.date_start) > new Date())
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  return upcoming[0] || null;
}

/** Get all drivers in a session */
export async function getDriversForSession(sessionKey) {
  const url = `${BASE_URL}/drivers?session_key=${sessionKey}`;
  return fetchWithCache(url);
}

/** Get race results / positions for a session */
export async function getPositionsForSession(sessionKey) {
  const url = `${BASE_URL}/position?session_key=${sessionKey}`;
  const positions = await fetchWithCache(url);

  // OpenF1 streams positions throughout the race – get the final position per driver
  const finalPositions = {};
  for (const p of positions) {
    if (
      !finalPositions[p.driver_number] ||
      new Date(p.date) > new Date(finalPositions[p.driver_number].date)
    ) {
      finalPositions[p.driver_number] = p;
    }
  }
  return Object.values(finalPositions).sort(
    (a, b) => a.position - b.position
  );
}

/** Get lap time data for a session */
export async function getLapsForSession(sessionKey) {
  const url = `${BASE_URL}/laps?session_key=${sessionKey}`;
  return fetchWithCache(url);
}

/** Get qualifying/sprint positions from a given session key */
export async function getQualifyingPositions(sessionKey) {
  const url = `${BASE_URL}/position?session_key=${sessionKey}`;
  const positions = await fetchWithCache(url);
  const finalPositions = {};
  for (const p of positions) {
    if (
      !finalPositions[p.driver_number] ||
      new Date(p.date) > new Date(finalPositions[p.driver_number].date)
    ) {
      finalPositions[p.driver_number] = p;
    }
  }
  return Object.values(finalPositions).sort(
    (a, b) => a.position - b.position
  );
}

/** Get pit stop data for a session */
export async function getPitStopsForSession(sessionKey) {
  const url = `${BASE_URL}/pit?session_key=${sessionKey}`;
  return fetchWithCache(url);
}

/** Get intervals/gaps between drivers */
export async function getIntervalsForSession(sessionKey) {
  const url = `${BASE_URL}/intervals?session_key=${sessionKey}&interval<5`;
  return fetchWithCache(url);
}

// ─── Aggregated stats builder ─────────────────────────────────────────────────

/**
 * Builds a rich stats payload for a single race session.
 * Returns per-driver summaries ready to feed to the AI.
 */
export async function buildSessionStats(session) {
  const [drivers, positions, laps, pitStops] = await Promise.all([
    getDriversForSession(session.session_key),
    getPositionsForSession(session.session_key),
    getLapsForSession(session.session_key),
    getPitStopsForSession(session.session_key),
  ]);

  // Index drivers by number
  const driverMap = {};
  for (const d of drivers) driverMap[d.driver_number] = d;

  // Calculate per-driver lap stats
  const lapsByDriver = {};
  for (const lap of laps) {
    if (!lapsByDriver[lap.driver_number]) lapsByDriver[lap.driver_number] = [];
    if (lap.lap_duration) lapsByDriver[lap.driver_number].push(lap.lap_duration);
  }

  // Count pit stops per driver
  const pitsByDriver = {};
  for (const pit of pitStops) {
    pitsByDriver[pit.driver_number] = (pitsByDriver[pit.driver_number] || 0) + 1;
  }

  // Build driver result objects
  const results = positions.map((pos) => {
    const driverNum = pos.driver_number;
    const driver = driverMap[driverNum] || {};
    const driverLaps = lapsByDriver[driverNum] || [];
    const cleanLaps = driverLaps.filter((l) => l > 0);
    const fastestLap = cleanLaps.length ? Math.min(...cleanLaps) : null;
    const avgLap = cleanLaps.length
      ? cleanLaps.reduce((a, b) => a + b, 0) / cleanLaps.length
      : null;

    return {
      driver_number: driverNum,
      full_name: driver.full_name || `Driver #${driverNum}`,
      abbreviation: driver.name_acronym || "",
      team_name: driver.team_name || "Unknown",
      team_colour: driver.team_colour || "#888888",
      finish_position: pos.position,
      fastest_lap_ms: fastestLap ? Math.round(fastestLap * 1000) : null,
      avg_lap_ms: avgLap ? Math.round(avgLap * 1000) : null,
      pit_stops: pitsByDriver[driverNum] || 0,
      laps_completed: driverLaps.length,
    };
  });

  return {
    session_key: session.session_key,
    race_name: session.session_name || session.circuit_short_name,
    circuit: session.circuit_short_name,
    country: session.country_name,
    date: session.date_start,
    results,
  };
}

/**
 * Master function: builds the full data payload to send to the AI.
 * Fetches recent races + next race info and computes driver trend stats.
 *
 * @param {number} recentRaceCount - How many past races to include (default 5)
 * @returns {Object} Structured payload for AI prediction
 */
export async function buildPredictionPayload(recentRaceCount = 5) {
  const [recentSessions, nextSession] = await Promise.all([
    getRecentRaceSessions(recentRaceCount),
    getNextRaceSession(),
  ]);

  // Build stats for each recent race in parallel
  const recentRaceStats = await Promise.all(
    recentSessions.map((s) => buildSessionStats(s))
  );

  // Aggregate per-driver trends across recent races
  const driverTrends = {};
  for (const race of recentRaceStats) {
    for (const result of race.results) {
      const key = result.abbreviation || result.driver_number;
      if (!driverTrends[key]) {
        driverTrends[key] = {
          full_name: result.full_name,
          abbreviation: result.abbreviation,
          team_name: result.team_name,
          team_colour: result.team_colour,
          finish_positions: [],
          fastest_laps_ms: [],
          avg_laps_ms: [],
          total_pit_stops: 0,
          races_counted: 0,
        };
      }
      const trend = driverTrends[key];
      trend.finish_positions.push(result.finish_position);
      if (result.fastest_lap_ms) trend.fastest_laps_ms.push(result.fastest_lap_ms);
      if (result.avg_lap_ms) trend.avg_laps_ms.push(result.avg_lap_ms);
      trend.total_pit_stops += result.pit_stops;
      trend.races_counted++;
    }
  }

  // Compute summary stats per driver
  const driverSummaries = Object.values(driverTrends).map((d) => {
    const avgPos =
      d.finish_positions.reduce((a, b) => a + b, 0) / d.finish_positions.length;
    const bestPos = Math.min(...d.finish_positions);
    const worstPos = Math.max(...d.finish_positions);
    const posImproving =
      d.finish_positions.length >= 2
        ? d.finish_positions[d.finish_positions.length - 1] <
          d.finish_positions[0]
        : null;
    const avgFastestLap = d.fastest_laps_ms.length
      ? Math.round(
          d.fastest_laps_ms.reduce((a, b) => a + b, 0) /
            d.fastest_laps_ms.length
        )
      : null;

    return {
      full_name: d.full_name,
      abbreviation: d.abbreviation,
      team_name: d.team_name,
      team_colour: d.team_colour,
      avg_finish_position: Math.round(avgPos * 10) / 10,
      best_finish: bestPos,
      worst_finish: worstPos,
      position_trend: posImproving,
      recent_positions: d.finish_positions,
      avg_fastest_lap_ms: avgFastestLap,
      avg_pit_stops: Math.round((d.total_pit_stops / d.races_counted) * 10) / 10,
      races_counted: d.races_counted,
    };
  });

  return {
    next_race: nextSession
      ? {
          name: nextSession.session_name || nextSession.circuit_short_name,
          circuit: nextSession.circuit_short_name,
          country: nextSession.country_name,
          date: nextSession.date_start,
        }
      : null,
    recent_races: recentRaceStats.map((r) => ({
      race_name: r.race_name,
      circuit: r.circuit,
      country: r.country,
      date: r.date,
      podium: r.results.slice(0, 3).map((d) => d.full_name),
    })),
    driver_trends: driverSummaries.sort(
      (a, b) => a.avg_finish_position - b.avg_finish_position
    ),
    data_window: `Last ${recentRaceStats.length} races`,
    generated_at: new Date().toISOString(),
  };
}
