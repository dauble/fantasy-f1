/**
 * fantasyF1FeedService.js
 *
 * Client-side service for the three Fantasy F1 feed snapshots served by the
 * Express backend:
 *
 *   /api/fantasy/config    — web_config.json (game IDs, active season, etc.)
 *   /api/fantasy/schedule  — raceday_en.json (full race calendar)
 *   /api/fantasy/drivers   — drivers/{gameId}_en.json (full player roster)
 *
 * These snapshots are written daily to data/ by scripts/fetch-fantasy-feeds.mjs
 * and are the authoritative source for the current season's driver grid.
 *
 * Usage:
 *   import fantasyFeedService from '../services/fantasyF1FeedService';
 *   const drivers = await fantasyFeedService.getDriverGrid();
 *   const schedule = await fantasyFeedService.getSchedule();
 */

import apiCache from '../utils/cache';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — feeds update daily

// ─── Low-level fetch helpers ──────────────────────────────────────────────────

async function fetchEndpoint(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fantasy feed ${path} returned HTTP ${res.status}`);
  return res.json();
}

async function cachedFetch(cacheKey, fetchFn) {
  const cached = apiCache.get(cacheKey, {});
  if (cached) return cached;

  const data = await fetchFn();
  apiCache.set(cacheKey, {}, data);
  return data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const fantasyFeedService = {
  /**
   * Returns the Fantasy app configuration (game IDs, active season, etc.).
   * @returns {Promise<object|null>}
   */
  async getConfig() {
    try {
      return await cachedFetch('fantasy_config', () => fetchEndpoint('/api/fantasy/config'));
    } catch (err) {
      console.warn('[fantasyFeedService] getConfig failed:', err.message);
      return null;
    }
  },

  /**
   * Returns the normalised race calendar for the current season.
   * Each race: { round, name, circuit, country, dateStart, dateEnd, isComplete, isActive, gameweek }
   * @returns {Promise<Array>}
   */
  async getSchedule() {
    try {
      const data = await cachedFetch('fantasy_schedule', () => fetchEndpoint('/api/fantasy/schedule'));
      return data?.races ?? [];
    } catch (err) {
      console.warn('[fantasyFeedService] getSchedule failed:', err.message);
      return [];
    }
  },

  /**
   * Returns the full Fantasy F1 driver roster in the OpenF1-compatible shape
   * expected by TeamBuilder/DriverCard/PriceManager.
   *
   * Shape: { driver_number, full_name, name_acronym, team_name, team_colour,
   *          headshot_url, country_code, fantasy_player_id, price_m }
   *
   * Falls back gracefully to an empty array when the snapshot isn't available.
   * @returns {Promise<Array>}
   */
  async getDriverGrid() {
    try {
      const data = await cachedFetch('fantasy_drivers_grid', () => fetchEndpoint('/api/fantasy/drivers'));
      if (!data?.ok || !data.drivers?.length) return [];

      // Convert Fantasy player records to the OpenF1-compatible shape
      const byNumber = new Map();
      for (const d of data.drivers) {
        if (d.isActive === false) continue;
        const num = d.number;
        if (!num) continue;

        const entry = {
          driver_number:     num,
          full_name:         d.name,
          name_acronym:      d.shortName,
          team_name:         d.teamName,
          team_colour:       d.teamColour,
          headshot_url:      d.headshotUrl || null,
          country_code:      null,
          fantasy_player_id: d.playerId,
          price_m:           d.priceM,
        };

        if (!byNumber.has(num)) {
          byNumber.set(num, entry);
        } else {
          // For mid-season replacements with the same number: prefer senior team
          const juniorTeams = ['racing bulls', 'rb', 'alphatauri', 'visa cash app rb'];
          const newTeam = (d.teamName || '').toLowerCase();
          if (!juniorTeams.some(t => newTeam.includes(t))) {
            byNumber.set(num, entry);
          }
        }
      }
      return Array.from(byNumber.values());
    } catch (err) {
      console.warn('[fantasyFeedService] getDriverGrid failed:', err.message);
      return [];
    }
  },

  /**
   * Returns the constructor list derived from the Fantasy driver roster.
   * @returns {Promise<Array<{ team_name: string, team_colour: string }>>}
   */
  async getConstructorGrid() {
    try {
      const data = await cachedFetch('fantasy_drivers_grid', () => fetchEndpoint('/api/fantasy/drivers'));
      if (!data?.ok || !data.constructors?.length) return [];

      return data.constructors
        .filter(c => c.isActive !== false && c.teamName)
        .map(c => ({ team_name: c.teamName, team_colour: c.teamColour }));
    } catch (err) {
      console.warn('[fantasyFeedService] getConstructorGrid failed:', err.message);
      return [];
    }
  },

  /**
   * Returns the upcoming (next) race from the schedule.
   * @returns {Promise<object|null>}
   */
  async getNextRace() {
    const races = await this.getSchedule();
    if (!races.length) return null;
    const upcoming = races
      .filter(r => !r.isComplete && r.dateStart)
      .sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart));
    return upcoming[0] ?? null;
  },

  /** Clear the in-memory / localStorage cache for Fantasy feeds. */
  clearCache() {
    ['fantasy_config', 'fantasy_schedule', 'fantasy_drivers_grid'].forEach(key => {
      apiCache.delete(key, {});
    });
  },
};

export default fantasyFeedService;
