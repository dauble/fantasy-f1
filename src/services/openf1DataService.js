/**
 * openf1DataService.js
 * Fetches and aggregates historical race data from OpenF1 API
 * for use in AI-powered Fantasy F1 predictions.
 *
 * Integrated with existing cache system and OpenF1 API structure.
 */

import openF1API from './openF1API';
import apiCache from '../utils/cache';

const BASE_URL = "https://api.openf1.org/v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (historical data doesn't change)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours (for fallback on rate limit)

// ─── Cache helpers (reuses your existing pattern) ───────────────────────────

function getCached(key, ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    
    // If ignoring expiry (e.g., for 429 fallback), accept any cache within max age
    if (ignoreExpiry) {
      if (Date.now() - ts < MAX_CACHE_AGE_MS) {
        return data;
      }
      return null;
    }
    
    // Normal cache check
    if (Date.now() - ts > CACHE_TTL_MS) {
      // Don't remove - keep for fallback on rate limits
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

async function fetchWithCache(url, retryCount = 0) {
  const cached = getCached(url);
  if (cached) {
    console.log(`Using cached data for: ${url}`);
    return cached;
  }

  try {
    const res = await fetch(url);
    
    // Handle rate limiting (429) - use expired cache if available
    if (res.status === 429) {
      console.warn(`Rate limited by OpenF1 API (429). Checking for expired cache...`);
      const expiredCache = getCached(url, true); // Ignore expiry
      if (expiredCache) {
        console.log(`Using expired cache data (better than no data)`);
        return expiredCache;
      }
      
      // If no cache available and we haven't retried too much, wait and retry
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s
        console.log(`No cache available. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithCache(url, retryCount + 1);
      }
      
      // Give up and return empty
      console.error(`Rate limited and no cache available for: ${url}`);
      return [];
    }
    
    if (!res.ok) {
      // Return empty array instead of throwing for "No results found"
      if (res.status === 200) {
        const data = await res.json();
        if (data?.detail === "No results found.") {
          return [];
        }
        setCache(url, data);
        return data;
      }
      
      // For other errors, try expired cache
      const expiredCache = getCached(url, true);
      if (expiredCache) {
        console.warn(`API error ${res.status}, using expired cache for: ${url}`);
        return expiredCache;
      }
      
      throw new Error(`OpenF1 API error: ${res.status} ${url}`);
    }
    
    const data = await res.json();
    // Handle "No results found" response
    if (data?.detail === "No results found.") {
      return [];
    }
    setCache(url, data);
    return data;
  } catch (error) {
    // On network error, try expired cache
    const expiredCache = getCached(url, true);
    if (expiredCache) {
      console.warn(`Network error, using expired cache for: ${url}`);
      return expiredCache;
    }
    throw error;
  }
}

// ─── Core fetchers ───────────────────────────────────────────────────────────

/** Get the most recent N completed race sessions from available years */
export async function getRecentRaceSessions(limit = 5) {
  try {
    // Try multiple years to find data
    const currentYear = new Date().getFullYear();
    const yearsToTry = [currentYear, currentYear - 1, currentYear - 2, 2024, 2023];
    
    let allSessions = [];
    for (const year of yearsToTry) {
      try {
        const meetings = await openF1API.getMeetings(year);
        if (!meetings || meetings.length === 0) continue;
        
        // Get sessions for each meeting
        for (const meeting of meetings) {
          try {
            const sessions = await openF1API.getSessions(meeting.meeting_key);
            const raceSessions = sessions.filter(s => 
              s.session_name === 'Race' && 
              s.date_end && 
              new Date(s.date_end) < new Date()
            );
            allSessions.push(...raceSessions);
          } catch (err) {
            console.warn(`Could not fetch sessions for meeting ${meeting.meeting_key}:`, err);
          }
        }
        
        if (allSessions.length >= limit) break;
      } catch (err) {
        console.warn(`No data for year ${year}:`, err);
      }
    }
    
    // Sort by date and return most recent
    return allSessions
      .sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching recent race sessions:', error);
    return [];
  }
}

/** Get the next upcoming race session */
export async function getNextRaceSession() {
  try {
    const currentYear = new Date().getFullYear();
    const meetings = await openF1API.getMeetings(currentYear);
    
    if (!meetings || meetings.length === 0) {
      return null;
    }
    
    // Find upcoming meetings
    const now = new Date();
    const upcomingMeetings = meetings
      .filter(m => new Date(m.date_start) > now)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    
    if (upcomingMeetings.length === 0) {
      return null;
    }
    
    // Get race session for the next meeting
    const nextMeeting = upcomingMeetings[0];
    const sessions = await openF1API.getSessions(nextMeeting.meeting_key);
    const raceSession = sessions.find(s => s.session_name === 'Race');
    
    return raceSession || null;
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
  try {
    const [drivers, positions, laps, pitStops] = await Promise.allSettled([
      getDriversForSession(session.session_key),
      getPositionsForSession(session.session_key),
      getLapsForSession(session.session_key),
      getPitStopsForSession(session.session_key),
    ]);

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

    return {
      session_key: session.session_key,
      race_name: session.session_name || session.circuit_short_name,
      circuit: session.circuit_short_name,
      country: session.country_name,
      date: session.date_start,
      results,
    };
  } catch (error) {
    console.error(`Error building session stats for ${session.session_key}:`, error);
    return null;
  }
}

/**
 * Master function: builds the full data payload to send to the AI.
 * Fetches recent races + next race info and computes driver trend stats.
 *
 * @param {number} recentRaceCount - How many past races to include (default 5)
 * @returns {Object} Structured payload for AI prediction
 * @throws {Error} If insufficient data is available
 */
export async function buildPredictionPayload(recentRaceCount = 5) {
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

    // Build stats for each recent race in parallel
    const recentRaceStatsPromises = recentSessions.map((s) => buildSessionStats(s));
    const recentRaceStatsResults = await Promise.all(recentRaceStatsPromises);
    
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
        const price = customPrices.drivers[driverNumber];
        driver.price = price !== undefined ? price : 20; // Default to $20M if no custom price
      }
    } else {
      // No custom prices - default all drivers to $20M
      for (const driver of driverSummaries) {
        driver.price = 20;
      }
    }

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
      user_context: userContext,
      data_window: `Last ${recentRaceStats.length} races`,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    // Re-throw with more context if it's not already our custom error
    if (error.message.includes('OpenF1 API') || error.message.includes('No historical')) {
      throw error;
    }
    throw new Error(`Failed to build prediction payload: ${error.message}`);
  }
}
