// API Cache utility to prevent rate limiting (429 errors)

const CACHE_PREFIX = 'f1_cache_';
const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour for historical data
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours for fallback

class APICache {
  constructor(ttl = DEFAULT_TTL) {
    this.ttl = ttl;
  }

  // Generate cache key from URL and params
  generateKey(endpoint, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${CACHE_PREFIX}${endpoint}_${paramString}`;
  }

  // Get cached data if it exists and hasn't expired
  get(endpoint, params = {}, ignoreExpiry = false) {
    try {
      const key = this.generateKey(endpoint, params);
      const cached = localStorage.getItem(key);
      
      if (!cached) {
        return null;
      }

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // If ignoring expiry (for 429 fallback), accept cache within max age
      if (ignoreExpiry) {
        if (now - timestamp < MAX_CACHE_AGE) {
          console.log(`Cache HIT (expired but usable): ${endpoint}`, params);
          return data;
        }
        return null;
      }

      // Check if cache has expired
      if (now - timestamp > this.ttl) {
        // Don't delete - keep for fallback
        return null;
      }

      console.log(`Cache HIT: ${endpoint}`, params);
      return data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Store data in cache with timestamp
  set(endpoint, params = {}, data) {
    try {
      const key = this.generateKey(endpoint, params);
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(cacheEntry));
      console.log(`Cache SET: ${endpoint}`, params);
    } catch (error) {
      console.error('Cache set error:', error);
      // If localStorage is full, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.clearOldEntries();
        try {
          const key = this.generateKey(endpoint, params);
          localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (retryError) {
          console.error('Cache set retry failed:', retryError);
        }
      }
    }
  }

  // Delete specific cache entry
  delete(endpoint, params = {}) {
    try {
      const key = this.generateKey(endpoint, params);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Clear all cache entries
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('Cache cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Clear entries older than TTL
  clearOldEntries() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const { timestamp } = JSON.parse(cached);
              if (now - timestamp > this.ttl) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // If parsing fails, remove the corrupted entry
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Get cache size in KB
  getCacheSize() {
    try {
      const keys = Object.keys(localStorage);
      let size = 0;
      
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            size += item.length;
          }
        }
      });
      
      return (size / 1024).toFixed(2); // Convert to KB
    } catch (error) {
      console.error('Cache size calculation error:', error);
      return 0;
    }
  }

  // Get cache statistics
  getStats() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const now = Date.now();
      
      let validEntries = 0;
      let expiredEntries = 0;
      
      cacheKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            if (now - timestamp > this.ttl) {
              expiredEntries++;
            } else {
              validEntries++;
            }
          }
        } catch (error) {
          expiredEntries++;
        }
      });
      
      return {
        total: cacheKeys.length,
        valid: validEntries,
        expired: expiredEntries,
        sizeKB: this.getCacheSize()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { total: 0, valid: 0, expired: 0, sizeKB: 0 };
    }
  }
}

// Create singleton instance with 1 hour TTL
const apiCache = new APICache(60 * 60 * 1000);

export default apiCache;
