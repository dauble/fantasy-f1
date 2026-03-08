import axios from 'axios';
import { OPENF1_API_BASE } from '../config/api';
import apiCache from '../utils/cache';

// Get current season
const CURRENT_YEAR = new Date().getFullYear();

export const openF1API = {
  // Get all drivers for a specific session or year
  async getDrivers(year = CURRENT_YEAR) {
    const endpoint = 'drivers';
    const params = { session_key: 'latest' };
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/drivers`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching drivers:', error);
      throw error;
    }
  },

  // Get meetings (races) for a specific year
  async getMeetings(year = CURRENT_YEAR) {
    const endpoint = 'meetings';
    const params = { year };
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/meetings`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching meetings:', error);
      throw error;
    }
  },

  // Get sessions for a specific meeting
  async getSessions(meetingKey) {
    const endpoint = 'sessions';
    const params = { meeting_key: meetingKey };
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/sessions`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  },

  // Get results for a specific session
  async getSessionResults(sessionKey) {
    const endpoint = 'position';
    const params = { session_key: sessionKey };
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/position`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching session results:', error);
      throw error;
    }
  },

  // Get lap data for analysis
  async getLaps(sessionKey, driverNumber = null) {
    const endpoint = 'laps';
    const params = { session_key: sessionKey };
    if (driverNumber) {
      params.driver_number = driverNumber;
    }
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/laps`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching laps:', error);
      throw error;
    }
  },

  // Get stint data (tire strategy)
  async getStints(sessionKey, driverNumber = null) {
    const endpoint = 'stints';
    const params = { session_key: sessionKey };
    if (driverNumber) {
      params.driver_number = driverNumber;
    }
    
    // Check cache first
    const cached = apiCache.get(endpoint, params);
    if (cached) return cached;
    
    try {
      const response = await axios.get(`${OPENF1_API_BASE}/stints`, { params });
      const data = response.data;
      
      // Store in cache
      apiCache.set(endpoint, params, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching stints:', error);
      throw error;
    }
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
      if (meetings.length === 0) return null;
      
      // Sort by date to get the most recent
      const sortedMeetings = meetings.sort((a, b) => 
        new Date(b.date_start) - new Date(a.date_start)
      );
      
      const latestMeeting = sortedMeetings[0];
      const sessions = await this.getSessions(latestMeeting.meeting_key);
      
      if (sessions.length === 0) return null;
      
      // Get the race session if available, otherwise the latest session
      const raceSession = sessions.find(s => s.session_name?.toLowerCase().includes('race'));
      const result = raceSession || sessions[sessions.length - 1];
      
      // Store in cache
      apiCache.set(endpoint, params, result);
      
      return result;
    } catch (error) {
      console.error('Error fetching latest session:', error);
      throw error;
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
