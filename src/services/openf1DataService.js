/**
 * openf1DataService.js
 * Fetches and aggregates historical race data from OpenF1 API
 * for use in AI-powered Fantasy F1 predictions.
 *
 * Integrated with existing cache system and OpenF1 API structure.
 */

import openF1API from './openF1API';

const BASE_URL = "https://api.openf1.org/v1";

// ─── Cache TTLs ───────────────────────────────────────────────────────────────
// Raw API responses (positions, laps, pit stops, drivers):
//   Historical race data is IMMUTABLE — it will never change for a past event.
const CACHE_TTL_MS          = 24 * 60 * 60 * 1000;   // 24 h  — raw API data
const MAX_CACHE_AGE_MS      =  7 * 24 * 60 * 60 * 1000; // 7 days — stale fallback

// Processed / derived caches:
const SESSION_STATS_TTL_MS  =  7 * 24 * 60 * 60 * 1000; // 7 days — processed session stats (tiny & immutable)
const SESSIONS_LIST_TTL_MS  =  6 * 60 * 60 * 1000;  // 6 h   — list of which sessions to use
const PAYLOAD_TTL_MS        =  4 * 60 * 60 * 1000;  // 4 h   — full prediction payload

// ─── Cache key prefixes ───────────────────────────────────────────────────────
const SESSION_STATS_CACHE_PREFIX  = 'openf1_session_stats_';
const RECENT_SESSIONS_CACHE_KEY   = 'openf1_recent_sessions_v2_';
const PAYLOAD_CACHE_KEY           = 'openf1_prediction_payload_v2_';

// ─── Request pacing ───────────────────────────────────────────────────────────
// Sequential delays prevent bursting the OpenF1 API.
const INTER_CALL_DELAY_MS     = 1500; // Between raw endpoint calls within a session
const INTER_SESSION_DELAY_MS  = 4000; // Between processing different sessions
const INTER_MEETING_DELAY_MS  =  700; // Between getSessions calls during discovery

// ─── Rate limiting helpers ────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Cache helpers (reuses your existing pattern) ───────────────────────────

function getCached(key, ignoreExpiry = false, ttl = CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);

    if (ignoreExpiry) {
      // Accept anything within the absolute max age (stale fallback)
      return (Date.now() - ts < MAX_CACHE_AGE_MS) ? data : null;
    }

    return (Date.now() - ts > ttl) ? null : data;
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

async function fetchWithCache(url, retryCount = 0) {
  const cached = getCached(url);
  if (cached) {
    console.log(`Cache hit: ${url}`);
    return cached;
  }

  try {
    const res = await fetch(url);

    if (res.status === 429) {
      // Prefer expired cache over any retry attempt
      const expiredCache = getCached(url, true);
      if (expiredCache) {
        console.warn(`429 — using stale cache for: ${url}`);
        return expiredCache;
      }

      if (retryCount < 3) {
        // Honour Retry-After if present, otherwise exponential backoff
        const retryAfterHeader = res.headers.get('Retry-After');
        const waitMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : Math.min(2000 * Math.pow(2, retryCount), 30000); // 2s, 4s, 8s, cap 30s
        console.warn(`429 — retrying in ${waitMs}ms (attempt ${retryCount + 1}/3): ${url}`);
        await delay(waitMs);
        return fetchWithCache(url, retryCount + 1);
      }

      console.error(`429 — giving up after 3 retries: ${url}`);
      return [];
    }

    if (!res.ok) {
      const expiredCache = getCached(url, true);
      if (expiredCache) {
        console.warn(`API error ${res.status} — using stale cache for: ${url}`);
        return expiredCache;
      }
      throw new Error(`OpenF1 API error: ${res.status} ${url}`);
    }

    const data = await res.json();
    if (data?.detail === "No results found.") return [];
    setCache(url, data);
    return data;
  } catch (error) {
    const expiredCache = getCached(url, true);
    if (expiredCache) {
      console.warn(`Network error — using stale cache for: ${url}`);
      return expiredCache;
    }
    throw error;
  }
}

// ─── Core fetchers ───────────────────────────────────────────────────────────

/** Get the most recent N completed race sessions from available years */
export async function getRecentRaceSessions(limit = 5) {
  // ── Layer 3 cache: the discovered sessions list ────────────────────────────
  const listCacheKey = `${RECENT_SESSIONS_CACHE_KEY}${limit}`;
  const cachedList = getCached(listCacheKey, false, SESSIONS_LIST_TTL_MS);
  if (cachedList) {
    console.log(`Recent sessions list served from cache (${cachedList.length} sessions)`);
    return cachedList;
  }

  // ── Fresh discovery: only look at recently-completed meetings ──────────────
  try {
    const currentYear = new Date().getFullYear();
    const now = new Date();
    const raceSessions = [];

    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      let meetings;
      try {
        meetings = await openF1API.getMeetings(year);
      } catch (err) {
        console.warn(`Could not fetch meetings for ${year}:`, err);
        continue;
      }
      if (!meetings || meetings.length === 0) continue;

      // Only consider meetings that have already ended; most recent first.
      // Cap at (limit * 2 + 2) to avoid scanning the whole calendar unnecessarily.
      const completedMeetings = meetings
        .filter(m => m.date_end && new Date(m.date_end) < now)
        .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
        .slice(0, limit * 2 + 2);

      for (const meeting of completedMeetings) {
        try {
          const sessions = await openF1API.getSessions(meeting.meeting_key);
          const raceSession = sessions.find(
            s => s.session_name === 'Race' && s.date_end && new Date(s.date_end) < now
          );
          if (raceSession) raceSessions.push(raceSession);
        } catch (err) {
          console.warn(`Could not fetch sessions for meeting ${meeting.meeting_key}:`, err);
        }
        if (raceSessions.length >= limit) break;
        await delay(INTER_MEETING_DELAY_MS);
      }

      if (raceSessions.length >= limit) break;
    }

    const result = raceSessions
      .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
      .slice(0, limit);

    if (result.length > 0) {
      setCache(listCacheKey, result);
    }
    return result;
  } catch (error) {
    // Last resort: accept a stale sessions list rather than returning nothing
    const stale = getCached(listCacheKey, true, SESSIONS_LIST_TTL_MS);
    if (stale) {
      console.warn('Using stale sessions list as fallback:', error.message);
      return stale;
    }
    console.error('Error fetching recent race sessions:', error);
    return [];
  }
}

/** Get the next upcoming race session */
export async function getNextRaceSession() {
  try {
    const currentYear = new Date().getFullYear();
    // Try current year first, then next year (useful near season end / before new season data lands)
    const yearsToTry = [currentYear, currentYear + 1];

    for (const year of yearsToTry) {
      let meetings;
      try {
        meetings = await openF1API.getMeetings(year);
      } catch {
        continue;
      }
      if (!meetings || meetings.length === 0) continue;

      // Find the next upcoming meeting
      const now = new Date();
      const upcomingMeetings = meetings
        .filter(m => m.date_start && new Date(m.date_start) > now)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

      if (upcomingMeetings.length === 0) continue;

      const nextMeeting = upcomingMeetings[0];

      // Try to get the Race session for this meeting
      try {
        const sessions = await openF1API.getSessions(nextMeeting.meeting_key);
        const raceSession = sessions.find(s => s.session_name === 'Race');
        if (raceSession) return raceSession;
      } catch {
        // Session data not available yet — fall through to meeting-level info
      }

      // Return a synthetic object from meeting data so we still have circuit/country/date
      return {
        session_name: nextMeeting.meeting_name || 'Race',
        circuit_short_name: nextMeeting.circuit_short_name || nextMeeting.location || null,
        country_name: nextMeeting.country_name || null,
        date_start: nextMeeting.date_start || null,
        _from_meeting: true,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching next race session:', error);
    return null;
  }
}

/** Get all drivers in a session */
export async function getDriversForSession(sessionKey) {
  try {
    const url = `${BASE_URL}/drivers?session_key=${sessionKey}`;
    return await fetchWithCache(url);
  } catch (error) {
    console.error(`Error fetching drivers for session ${sessionKey}:`, error);
    return [];
  }
}

/** Get race results / positions for a session */
export async function getPositionsForSession(sessionKey) {
  try {
    const url = `${BASE_URL}/position?session_key=${sessionKey}`;
    const positions = await fetchWithCache(url);

    if (!positions || positions.length === 0) return [];

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
  } catch (error) {
    console.error(`Error fetching positions for session ${sessionKey}:`, error);
    return [];
  }
}

/** Get lap time data for a session */
export async function getLapsForSession(sessionKey) {
  try {
    const url = `${BASE_URL}/laps?session_key=${sessionKey}`;
    return await fetchWithCache(url);
  } catch (error) {
    console.error(`Error fetching laps for session ${sessionKey}:`, error);
    return [];
  }
}

/** Get qualifying/sprint positions from a given session key */
export async function getQualifyingPositions(sessionKey) {
  try {
    const url = `${BASE_URL}/position?session_key=${sessionKey}`;
    const positions = await fetchWithCache(url);
    
    if (!positions || positions.length === 0) return [];
    
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
  } catch (error) {
    console.error(`Error fetching qualifying positions for session ${sessionKey}:`, error);
    return [];
  }
}

/** Get pit stop data for a session */
export async function getPitStopsForSession(sessionKey) {
  try {
    const url = `${BASE_URL}/pit?session_key=${sessionKey}`;
    return await fetchWithCache(url);
  } catch (error) {
    console.error(`Error fetching pit stops for session ${sessionKey}:`, error);
    return [];
  }
}

/** Get intervals/gaps between drivers */
export async function getIntervalsForSession(sessionKey) {
  try {
    const url = `${BASE_URL}/intervals?session_key=${sessionKey}&interval<5`;
    return await fetchWithCache(url);
  } catch (error) {
    console.error(`Error fetching intervals for session ${sessionKey}:`, error);
    return [];
  }
}

// ─── localStorage Data Gathering ──────────────────────────────────────────────

/**
 * Gathers all relevant localStorage data (user's team, prices, history).
 * Returns null for each field if not found.
 */
function gatherUserContext() {
  try {
    const currentTeam = localStorage.getItem('fantasy_f1_current_team');
    const customPrices = localStorage.getItem('fantasy_f1_custom_prices');
    const teamHistory = localStorage.getItem('fantasy_f1_teams_history');
    const priceHistory = localStorage.getItem('fantasy_f1_price_history');

    return {
      current_team: currentTeam ? JSON.parse(currentTeam) : null,
      custom_prices: customPrices ? JSON.parse(customPrices) : null,
      team_history: teamHistory ? JSON.parse(teamHistory) : null,
      price_history: priceHistory ? JSON.parse(priceHistory) : null,
    };
  } catch (error) {
    console.error('Error gathering user context from localStorage:', error);
    return {
      current_team: null,
      custom_prices: null,
      team_history: null,
      price_history: null,
    };
  }
}

// ─── Aggregated stats builder ─────────────────────────────────────────────────

/**
 * Builds a rich stats payload for a single race session.
 * Returns per-driver summaries ready to feed to the AI.
 */
export async function buildSessionStats(session) {
  // ── Layer 2 cache: processed session stats (7-day TTL, immutable) ──────────
  const statsCacheKey = `${SESSION_STATS_CACHE_PREFIX}${session.session_key}`;
  const cachedStats = getCached(statsCacheKey, false, SESSION_STATS_TTL_MS);
  if (cachedStats) {
    console.log(`Session stats cache hit: ${session.session_key}`);
    return cachedStats;
  }

  try {
    const drivers   = await getDriversForSession(session.session_key)
                        .then(v => ({ status: 'fulfilled', value: v }))
                        .catch(e => ({ status: 'rejected', reason: e }));
    await delay(INTER_CALL_DELAY_MS);
    const positions = await getPositionsForSession(session.session_key)
                        .then(v => ({ status: 'fulfilled', value: v }))
                        .catch(e => ({ status: 'rejected', reason: e }));
    await delay(INTER_CALL_DELAY_MS);
    const laps      = await getLapsForSession(session.session_key)
                        .then(v => ({ status: 'fulfilled', value: v }))
                        .catch(e => ({ status: 'rejected', reason: e }));
    await delay(INTER_CALL_DELAY_MS);
    const pitStops  = await getPitStopsForSession(session.session_key)
                        .then(v => ({ status: 'fulfilled', value: v }))
                        .catch(e => ({ status: 'rejected', reason: e }));

    // Extract successful results, default to empty array for failures
    const driversData = drivers.status === 'fulfilled' ? drivers.value : [];
    const positionsData = positions.status === 'fulfilled' ? positions.value : [];
    const lapsData = laps.status === 'fulfilled' ? laps.value : [];
    const pitStopsData = pitStops.status === 'fulfilled' ? pitStops.value : [];

    // If no position data, can't build meaningful stats
    if (positionsData.length === 0) {
      console.warn(`No position data for session ${session.session_key}`);
      return null;
    }

    // Index drivers by number
    const driverMap = {};
    for (const d of driversData) driverMap[d.driver_number] = d;

    // Calculate per-driver lap stats
    const lapsByDriver = {};
    for (const lap of lapsData) {
      if (!lapsByDriver[lap.driver_number]) lapsByDriver[lap.driver_number] = [];
      if (lap.lap_duration) lapsByDriver[lap.driver_number].push(lap.lap_duration);
    }

    // Count pit stops per driver
    const pitsByDriver = {};
    for (const pit of pitStopsData) {
      pitsByDriver[pit.driver_number] = (pitsByDriver[pit.driver_number] || 0) + 1;
    }

    // Build driver result objects
    const results = positionsData.map((pos) => {
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

    const result = {
      session_key: session.session_key,
      race_name: session.circuit_short_name || session.country_name || session.session_name,
      circuit: session.circuit_short_name,
      country: session.country_name,
      date: session.date_start,
      results,
    };
    setCache(statsCacheKey, result);
    return result;
  } catch (error) {
    // Before giving up, return whatever stale stats we have — historical data never changes
    const stale = getCached(statsCacheKey, true, SESSION_STATS_TTL_MS);
    if (stale) {
      console.warn(`Using stale session stats for ${session.session_key}:`, error.message);
      return stale;
    }
    console.error(`Error building session stats for ${session.session_key}:`, error);
    return null;
  }
}

/**
 * Master function: builds the full data payload to send to the AI.
 * Fetches recent races + next race info and computes driver trend stats.
 *
 * @param {number}  recentRaceCount    - How many past races to include (default 5)
 * @param {boolean} bypassPayloadCache - Skip the Layer 4 payload cache (force fresh fetch)
 * @returns {Object} Structured payload for AI prediction
 * @throws {Error} If insufficient data is available
 */
export async function buildPredictionPayload(recentRaceCount = 5, bypassPayloadCache = false) {
  const payloadCacheKey = `${PAYLOAD_CACHE_KEY}${recentRaceCount}`;

  // ── Layer 4 cache: full prediction payload (4-hour TTL) ───────────────────
  // Always re-read user_context from localStorage so that price/team changes
  // made since the last fetch are always reflected even when using cached data.
  if (!bypassPayloadCache) {
    const cachedPayload = getCached(payloadCacheKey, false, PAYLOAD_TTL_MS);
    if (cachedPayload) {
      console.log('Prediction payload served from Layer 4 cache — 0 API calls needed');
      return { ...cachedPayload, user_context: gatherUserContext() };
    }
  }

  try {
    const [recentSessions, nextSession] = await Promise.all([
      getRecentRaceSessions(recentRaceCount),
      getNextRaceSession(),
    ]);

    // Check if we have any data
    if (!recentSessions || recentSessions.length === 0) {
      throw new Error(
        'No historical race data available. The OpenF1 API may not have data for recent seasons yet. ' +
        'This feature requires completed race data to generate predictions.'
      );
    }

    // Build stats for each recent race sequentially to avoid rate limiting
    const recentRaceStatsResults = [];
    for (const s of recentSessions) {
      recentRaceStatsResults.push(await buildSessionStats(s));
      if (recentSessions.indexOf(s) < recentSessions.length - 1) await delay(INTER_SESSION_DELAY_MS);
    }
    
    // Filter out null results (failed session stats)
    const recentRaceStats = recentRaceStatsResults.filter(stat => stat !== null);

    if (recentRaceStats.length === 0) {
      throw new Error(
        'Could not build race statistics from available data. ' +
        'The OpenF1 API data may be incomplete for the requested sessions.'
      );
    }

    // Aggregate per-driver trends across recent races
    const driverTrends = {};
    for (const race of recentRaceStats) {
      for (const result of race.results) {
        const key = result.abbreviation || result.driver_number;
        if (!driverTrends[key]) {
          driverTrends[key] = {
            driver_number: result.driver_number,
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
        driver_number: d.driver_number,
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

    // Gather user's localStorage data
    const userContext = gatherUserContext();
    
    // Merge prices into driver summaries
    const customPrices = userContext?.custom_prices;
    if (customPrices?.drivers) {
      for (const driver of driverSummaries) {
        const driverNumber = String(driver.driver_number);
        const rawPrice = customPrices.drivers[driverNumber];
        // Prices are stored as raw dollars (e.g. 28700000); convert to millions for the optimizer
        driver.price = rawPrice !== undefined ? rawPrice / 1_000_000 : 20;
      }
    } else {
      // No custom prices - default all drivers to $20M
      for (const driver of driverSummaries) {
        driver.price = 20;
      }
    }

    const payload = {
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
      user_context: userContext,
      data_window: `Last ${recentRaceStats.length} races`,
      generated_at: new Date().toISOString(),
    };

    // Save the payload so the next call (within 4 hours) costs 0 API requests
    setCache(payloadCacheKey, payload);
    return payload;

  } catch (error) {
    // Before propagating the error, try serving a stale payload.
    // A stale payload is far better than a hard failure — the race data in it
    // is immutable and prices are re-read fresh from localStorage above.
    const stalePayload = getCached(payloadCacheKey, true, PAYLOAD_TTL_MS);
    if (stalePayload) {
      console.warn('Serving stale prediction payload due to API error:', error.message);
      return {
        ...stalePayload,
        user_context: gatherUserContext(),
        _stale: true,
        _stale_reason: error.message,
      };
    }

    if (error.message.includes('OpenF1 API') || error.message.includes('No historical')) {
      throw error;
    }
    throw new Error(`Failed to build prediction payload: ${error.message}`);
  }
}

/**
 * Clears the Layer 3 + 4 prediction-specific caches so the next
 * "Generate" will fetch fresh data from OpenF1.
 * Does NOT clear raw API caches (positions, laps) — those are still valid.
 */
export function clearPredictionCaches(recentRaceCount = 5) {
  try {
    localStorage.removeItem(`${PAYLOAD_CACHE_KEY}${recentRaceCount}`);
    // Clear all session list cache variants
    for (const n of [3, 5, 8]) {
      localStorage.removeItem(`${RECENT_SESSIONS_CACHE_KEY}${n}`);
    }
    console.log('Prediction payload + sessions list caches cleared');
  } catch (e) {
    console.warn('Error clearing prediction caches:', e);
  }
}
