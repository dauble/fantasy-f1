import { OPENF1_API_BASE } from '../config/api';
import apiCache from '../utils/cache';
import { rateLimitedFetch } from '../utils/openf1RateLimiter';

// Get current season
const CURRENT_YEAR = new Date().getFullYear();

// Helper function to handle API calls with caching and 429 fallback.
// The actual network call goes through rateLimitedFetch so this — and every
// other OpenF1 caller sharing that module-level queue — can never burst
// past OpenF1's free-tier limits, regardless of how many calls fire
// concurrently (e.g. Promise.all in openf1DataService.js).
async function cachedAPICall(endpoint, params, retryCount = 0) {
  // Check cache first
  const cached = apiCache.get(endpoint, params);
  if (cached) return cached;

  const url = `${OPENF1_API_BASE}/${endpoint}?${new URLSearchParams(params).toString()}`;

  try {
    const response = await rateLimitedFetch(url);

    if (response.status === 429) {
      console.warn(`Rate limited by OpenF1 API (429) for ${endpoint}. Checking for expired cache...`);
      const expiredCache = apiCache.get(endpoint, params, true); // Ignore expiry
      if (expiredCache) {
        console.log(`Using expired cache data for ${endpoint} (better than no data)`);
        return expiredCache;
      }

      // If no cache available and we haven't retried too much, wait and retry
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s
        console.log(`No cache available for ${endpoint}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return cachedAPICall(endpoint, params, retryCount + 1);
      }

      // Give up - return empty array or null
      console.error(`Rate limited and no cache available for: ${endpoint}`);
      return [];
    }

    if (!response.ok) {
      throw new Error(`OpenF1 API error: ${response.status}`);
    }

    const data = await response.json();

    // Store in cache
    apiCache.set(endpoint, params, data);

    return data;
  } catch (error) {
    // For other errors, try expired cache
    const expiredCache = apiCache.get(endpoint, params, true);
    if (expiredCache) {
      console.warn(`API error for ${endpoint}, using expired cache`);
      return expiredCache;
    }

    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

export const openF1API = {
  // Get the current driver grid. Served by our own backend (/api/openf1/drivers),
  // which now uses the Fantasy F1 price snapshot as the primary source (so it
  // always reflects the current season's grid) and falls back to the Cloudflare
  // Worker KV cache / OpenF1 directly. Either way, this keeps driver-grid
  // requests to one per backend cache window instead of one per browser.
  async getDrivers() {
    const endpoint = 'local_drivers';
    const params = {};

    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;

    try {
      const response = await fetch('/api/openf1/drivers');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      apiCache.set(endpoint, params, data);
      return data;
    } catch (error) {
      console.error('Error fetching drivers via backend proxy:', error);
      const expiredCache = apiCache.get(endpoint, params, true);
      if (expiredCache) {
        console.log('Using expired cache for drivers (backend proxy unavailable)');
        return expiredCache;
      }
      return [];
    }
  },

  // Get meetings (races) for a specific year
  async getMeetings(year = CURRENT_YEAR) {
    return cachedAPICall('meetings', { year });
  },

  // Get sessions for a specific meeting
  async getSessions(meetingKey) {
    return cachedAPICall('sessions', { meeting_key: meetingKey });
  },

  // Get results for a specific session
  async getSessionResults(sessionKey) {
    return cachedAPICall('position', { session_key: sessionKey });
  },

  // Get lap data for analysis
  async getLaps(sessionKey, driverNumber = null) {
    const params = { session_key: sessionKey };
    if (driverNumber) {
      params.driver_number = driverNumber;
    }
    return cachedAPICall('laps', params);
  },

  // Get stint data (tire strategy)
  async getStints(sessionKey, driverNumber = null) {
    const params = { session_key: sessionKey };
    if (driverNumber) {
      params.driver_number = driverNumber;
    }
    return cachedAPICall('stints', params);
  },

  // Get latest session key
  async getLatestSession() {
    const endpoint = 'latest_session';
    const params = {};
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const meetings = await this.getMeetings();
      if (!meetings || meetings.length === 0) return null;
      
      // Sort by date to get the most recent
      const sortedMeetings = meetings.sort((a, b) => 
        new Date(b.date_start) - new Date(a.date_start)
      );
      
      const latestMeeting = sortedMeetings[0];
      const sessions = await this.getSessions(latestMeeting.meeting_key);
      
      if (!sessions || sessions.length === 0) return null;
      
      // Get the race session if available, otherwise the latest session
      const raceSession = sessions.find(s => s.session_name?.toLowerCase().includes('race'));
      const result = raceSession || sessions[sessions.length - 1];
      
      // Store in cache
      apiCache.set(endpoint, params, result);
      
      return result;
    } catch (error) {
      console.error('Error fetching latest session:', error);
      
      // Try expired cache as fallback
      const expiredCache = apiCache.get(endpoint, params, true);
      if (expiredCache) {
        console.log('Using expired cache for latest session');
        return expiredCache;
      }
      
      return null;
    }
  },
  
  // Clear all cached data
  clearCache() {
    apiCache.clearAll();
  },
  
  // Get cache statistics
  getCacheStats() {
    return apiCache.getStats();
  }
};

export default openF1API;
