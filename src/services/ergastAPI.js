/**
 * ergastAPI.js
 * Fallback data source using the Ergast F1 API (http://ergast.com/mrd/)
 * Used when OpenF1 API is unavailable or returns errors.
 *
 * Note: Ergast provides historical F1 data but with different structure than OpenF1.
 * This service adapts Ergast responses to match OpenF1's data format where possible.
 */

import axios from 'axios';

const ERGAST_BASE_URL = 'https://ergast.com/api/f1';
const SEASON_FETCH_LIMIT = 100;

// Simple cache for Ergast API responses
const ergastCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached data or null if expired/not found
 */
function getCachedData(key) {
  const cached = ergastCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    ergastCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Store data in cache
 */
function setCachedData(key, data) {
  ergastCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Make a request to Ergast API with caching
 */
async function ergastRequest(endpoint, retryCount = 0) {
  const cacheKey = endpoint;
  const cached = getCachedData(cacheKey);
  if (cached) {
    console.log(`[Ergast] Cache hit: ${endpoint}`);
    return cached;
  }

  try {
    const [path, query = ''] = endpoint.split('?');
    const url = `${ERGAST_BASE_URL}/${path}.json${query ? `?${query}` : ''}`;
    console.log(`[Ergast] Fetching: ${url}`);
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    if (error.response?.status === 429 && retryCount < 2) {
      const delay = (retryCount + 1) * 2000;
      console.warn(`[Ergast] Rate limited, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return ergastRequest(endpoint, retryCount + 1);
    }
    console.error(`[Ergast] Error fetching ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Get race results for a specific year
 * Returns an array of races with their results
 */
export async function getSeasonResults(year) {
  try {
    const data = await ergastRequest(`${year}/results?limit=${SEASON_FETCH_LIMIT}`);
    const races = data?.MRData?.RaceTable?.Races || [];
    return races;
  } catch (error) {
    console.error(`[Ergast] Failed to get season results for ${year}:`, error);
    return [];
  }
}

/**
 * Get results for a specific race
 * @param {number} year - The year
 * @param {number} round - The round number (1-based)
 */
export async function getRaceResults(year, round) {
  try {
    const data = await ergastRequest(`${year}/${round}/results`);
    const races = data?.MRData?.RaceTable?.Races || [];
    return races[0] || null;
  } catch (error) {
    console.error(`[Ergast] Failed to get race results for ${year} round ${round}:`, error);
    return null;
  }
}

/**
 * Get qualifying results for a specific race
 */
export async function getQualifyingResults(year, round) {
  try {
    const data = await ergastRequest(`${year}/${round}/qualifying`);
    const races = data?.MRData?.RaceTable?.Races || [];
    return races[0] || null;
  } catch (error) {
    console.error(`[Ergast] Failed to get qualifying results for ${year} round ${round}:`, error);
    return null;
  }
}

/**
 * Get current season year
 */
export async function getCurrentSeason() {
  try {
    const data = await ergastRequest('current');
    const season = data?.MRData?.RaceTable?.season;
    return season ? parseInt(season, 10) : new Date().getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

/**
 * Convert Ergast race result to OpenF1-like format
 * This is a best-effort conversion - not all fields will be available
 */
export function convertErgastToOpenF1Format(ergastRace) {
  if (!ergastRace) return null;

  const results = ergastRace.Results || [];

  // Map Ergast results to a simplified OpenF1-like structure
  const drivers = results.map(result => ({
    driver_number: parseInt(result.number) || 0,
    full_name: `${result.Driver.givenName} ${result.Driver.familyName}`,
    abbreviation: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
    team_name: result.Constructor.name,
    team_colour: null, // Ergast doesn't provide team colors
    finish_position: parseInt(result.position) || 99,
    grid_position: parseInt(result.grid) || 0,
    points: parseFloat(result.points) || 0,
    status: result.status,
    laps_completed: parseInt(result.laps) || 0,
    fastest_lap_rank: result.FastestLap ? parseInt(result.FastestLap.rank) : null,
    fastest_lap_time: result.FastestLap ? result.FastestLap.Time?.time : null,
  }));

  return {
    race_name: ergastRace.raceName,
    circuit: ergastRace.Circuit?.circuitName,
    country: ergastRace.Circuit?.Location?.country,
    date: ergastRace.date,
    round: parseInt(ergastRace.round) || 0,
    season: parseInt(ergastRace.season) || 0,
    results: drivers,
  };
}

/**
 * Get recent completed races using Ergast
 * Returns data in OpenF1-compatible format
 */
export async function getRecentRacesFromErgast(limit = 5) {
  try {
    const currentYear = new Date().getFullYear();
    const allRaces = [];

    // Try current year and previous year
    for (const year of [currentYear, currentYear - 1]) {
      const seasonResults = await getSeasonResults(year);

      // Filter to completed races (those with results)
      const completedRaces = seasonResults.filter(race => {
        const raceDate = new Date(race.date);
        return raceDate < new Date() && race.Results && race.Results.length > 0;
      });

      allRaces.push(...completedRaces);

      if (allRaces.length >= limit) break;
    }

    // Sort by date descending (most recent first)
    allRaces.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Take the requested number and convert to OpenF1 format
    return allRaces.slice(0, limit).map(convertErgastToOpenF1Format).filter(r => r !== null);
  } catch (error) {
    console.error('[Ergast] Failed to get recent races:', error);
    return [];
  }
}

/**
 * Get next race using Ergast
 */
export async function getNextRaceFromErgast() {
  try {
    const currentYear = new Date().getFullYear();

    // Try current year first, then next year
    for (const year of [currentYear, currentYear + 1]) {
      const data = await ergastRequest(`${year}?limit=${SEASON_FETCH_LIMIT}`);
      const races = data?.MRData?.RaceTable?.Races || [];

      const now = new Date();
      const upcomingRaces = races.filter(race => {
        const raceDate = new Date(race.date);
        return raceDate > now;
      }).sort((a, b) => new Date(a.date) - new Date(b.date));

      if (upcomingRaces.length > 0) {
        const nextRace = upcomingRaces[0];
        return {
          session_name: nextRace.raceName,
          circuit_short_name: nextRace.Circuit?.circuitName,
          country_name: nextRace.Circuit?.Location?.country,
          date_start: nextRace.date,
          _from_ergast: true,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Ergast] Failed to get next race:', error);
    return null;
  }
}

/**
 * Find a race result from Ergast by OpenF1 session date.
 * Useful as fallback when OpenF1 session-level stats fail.
 */
export async function getRaceForSessionDate(dateStart, { country, circuit } = {}) {
  if (!dateStart) return null;

  try {
    const targetDate = new Date(dateStart);
    if (Number.isNaN(targetDate.getTime())) return null;

    const year = targetDate.getUTCFullYear();
    const targetDateOnly = targetDate.toISOString().slice(0, 10);
    const races = await getSeasonResults(year);
    if (!races.length) return null;

    const normalizeText = (value) => value
      ?.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedCountry = normalizeText(country);
    const normalizedCircuit = normalizeText(circuit);

    const exactDateMatches = races.filter((race) => race.date === targetDateOnly);
    const candidates = exactDateMatches.length ? exactDateMatches : races;

    const bestMatch = candidates.find((race) => {
      const raceCountry = normalizeText(race.Circuit?.Location?.country);
      const raceCircuit = normalizeText(race.Circuit?.circuitName);

      if (
        normalizedCountry &&
        raceCountry &&
        !raceCountry.includes(normalizedCountry) &&
        !normalizedCountry.includes(raceCountry)
      ) return false;
      if (normalizedCircuit && raceCircuit && !raceCircuit.includes(normalizedCircuit)) return false;
      return race.Results?.length > 0;
    }) || (exactDateMatches.find((race) => race.Results?.length > 0)) || null;

    return bestMatch ? convertErgastToOpenF1Format(bestMatch) : null;
  } catch (error) {
    console.error('[Ergast] Failed to match race by session date:', error);
    return null;
  }
}

/**
 * Clear the Ergast cache
 */
export function clearErgastCache() {
  ergastCache.clear();
  console.log('[Ergast] Cache cleared');
}

export default {
  getSeasonResults,
  getRaceResults,
  getQualifyingResults,
  getCurrentSeason,
  getRecentRacesFromErgast,
  getNextRaceFromErgast,
  getRaceForSessionDate,
  convertErgastToOpenF1Format,
  clearErgastCache,
};
