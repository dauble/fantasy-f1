// Price Storage utility for managing custom driver and constructor prices

const CUSTOM_PRICES_KEY = 'fantasy_f1_custom_prices';
const PRICE_HISTORY_KEY = 'fantasy_f1_price_history';

// Normalizes a name for matching: lowercase, strip accents/diacritics, drop
// anything that isn't a letter/space, collapse whitespace.
function normalizeName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastToken(normalized) {
  const parts = normalized.split(' ').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * Matches an F1 Fantasy feed driver name (e.g. "Lando Norris") against the
 * OpenF1 driver grid (e.g. full_name "Lando NORRIS") to resolve driver_number.
 * The two sources use different casing/formatting, so match is done on a
 * normalized full-name comparison, falling back to last-name-only.
 * Returns the matching OpenF1 driver object, or null if no confident match.
 */
export function matchDriverByName(fantasyName, openF1Drivers) {
  const target = normalizeName(fantasyName);
  if (!target || !openF1Drivers?.length) return null;

  const exact = openF1Drivers.find((d) => normalizeName(d.full_name) === target);
  if (exact) return exact;

  const targetLastName = lastToken(target);
  const lastNameMatches = openF1Drivers.filter(
    (d) => lastToken(normalizeName(d.full_name)) === targetLastName
  );
  // Only trust a last-name-only match when it's unambiguous
  return lastNameMatches.length === 1 ? lastNameMatches[0] : null;
}

/**
 * Builds a customPrices object (in the app's raw-dollar storage convention)
 * from an /api/fantasy-prices snapshot, resolving driver names to driver_number
 * via the OpenF1 driver grid. Constructors match directly on team name.
 * Returns { customPrices, unmatched } so callers can surface any gaps.
 */
export function buildCustomPricesFromFeed(snapshot, openF1Drivers) {
  const customPrices = { drivers: {}, constructors: {} };
  const unmatched = [];

  // A driver can appear more than once in the feed after a mid-season team
  // swap (the old team's record lingers alongside the new one under the same
  // name) — group by resolved driver_number and, when there's more than one
  // candidate, prefer whichever record's team matches the driver's current
  // OpenF1 team_name rather than just taking whichever came last.
  const candidatesByDriverNumber = new Map();
  for (const driver of snapshot?.drivers || []) {
    const match = matchDriverByName(driver.name, openF1Drivers);
    if (!match) {
      unmatched.push({ type: 'driver', name: driver.name });
      continue;
    }
    const list = candidatesByDriverNumber.get(match.driver_number) || [];
    list.push({ driver, match });
    candidatesByDriverNumber.set(match.driver_number, list);
  }

  for (const [driverNumber, candidates] of candidatesByDriverNumber) {
    const best =
      candidates.find(
        (c) => normalizeName(c.driver.team) === normalizeName(c.match.team_name)
      ) || candidates[candidates.length - 1];
    customPrices.drivers[driverNumber] = Math.round(best.driver.priceM * 1_000_000);
  }

  for (const constructor of snapshot?.constructors || []) {
    if (!constructor.team) {
      unmatched.push({ type: 'constructor', name: constructor.team || '(unknown)' });
      continue;
    }
    customPrices.constructors[constructor.team] = Math.round(constructor.priceM * 1_000_000);
  }

  return { customPrices, unmatched };
}

export const priceStorage = {
  // Get custom prices
  getCustomPrices() {
    try {
      const saved = localStorage.getItem(CUSTOM_PRICES_KEY);
      if (!saved) return null;
      
      return JSON.parse(saved);
    } catch (error) {
      console.error('Error loading custom prices:', error);
      return null;
    }
  },

  // Save custom prices
  saveCustomPrices(prices) {
    try {
      const priceData = {
        ...prices,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(CUSTOM_PRICES_KEY, JSON.stringify(priceData));
      
      // Save to history
      this.addToHistory(priceData);
      
      console.log('Custom prices saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving custom prices:', error);
      return false;
    }
  },

  // Update a single driver price
  updateDriverPrice(driverNumber, price) {
    const customPrices = this.getCustomPrices() || { drivers: {}, constructors: {} };
    
    if (!customPrices.drivers) {
      customPrices.drivers = {};
    }
    
    customPrices.drivers[driverNumber] = price;
    
    return this.saveCustomPrices(customPrices);
  },

  // Update a single constructor price
  updateConstructorPrice(teamName, price) {
    const customPrices = this.getCustomPrices() || { drivers: {}, constructors: {} };
    
    if (!customPrices.constructors) {
      customPrices.constructors = {};
    }
    
    customPrices.constructors[teamName] = price;
    
    return this.saveCustomPrices(customPrices);
  },

  // Clear custom prices (revert to defaults)
  clearCustomPrices() {
    try {
      localStorage.removeItem(CUSTOM_PRICES_KEY);
      console.log('Custom prices cleared');
      return true;
    } catch (error) {
      console.error('Error clearing custom prices:', error);
      return false;
    }
  },

  // Get price history
  getPriceHistory() {
    try {
      const saved = localStorage.getItem(PRICE_HISTORY_KEY);
      if (!saved) return [];
      
      return JSON.parse(saved);
    } catch (error) {
      console.error('Error loading price history:', error);
      return [];
    }
  },

  // Add current prices to history
  addToHistory(priceData) {
    try {
      const history = this.getPriceHistory();
      
      const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        prices: priceData
      };
      
      history.unshift(entry);
      
      // Keep only last 10 entries
      const trimmedHistory = history.slice(0, 10);
      
      localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(trimmedHistory));
      
      return true;
    } catch (error) {
      console.error('Error saving to price history:', error);
      return false;
    }
  },

  // Get price changes for a specific driver
  getDriverPriceChange(driverNumber) {
    const history = this.getPriceHistory();
    if (history.length < 2) return null;
    
    const current = history[0]?.prices?.drivers?.[driverNumber];
    const previous = history[1]?.prices?.drivers?.[driverNumber];
    
    if (!current || !previous) return null;
    
    const change = current - previous;
    const percentChange = ((change / previous) * 100).toFixed(1);
    
    return {
      change,
      percentChange,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
    };
  },

  // Get price changes for a specific constructor
  getConstructorPriceChange(teamName) {
    const history = this.getPriceHistory();
    if (history.length < 2) return null;
    
    const current = history[0]?.prices?.constructors?.[teamName];
    const previous = history[1]?.prices?.constructors?.[teamName];
    
    if (!current || !previous) return null;
    
    const change = current - previous;
    const percentChange = ((change / previous) * 100).toFixed(1);
    
    return {
      change,
      percentChange,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
    };
  },

  // Export prices as CSV
  exportPricesCSV(prices) {
    try {
      // Create CSV content
      let csv = 'Type,Number/Name,Price\n';
      
      // Add drivers
      if (prices.drivers) {
        Object.entries(prices.drivers).forEach(([number, price]) => {
          csv += `Driver,${number},${price}\n`;
        });
      }
      
      // Add constructors
      if (prices.constructors) {
        Object.entries(prices.constructors).forEach(([name, price]) => {
          csv += `Constructor,${name},${price}\n`;
        });
      }
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fantasy-f1-prices-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error exporting prices:', error);
      return false;
    }
  },

  // Import prices from CSV
  async importPricesCSV(file) {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(1); // Skip header
      
      const prices = { drivers: {}, constructors: {} };
      
      lines.forEach(line => {
        const [type, identifier, price] = line.split(',');
        if (!type || !identifier || !price) return;
        
        const priceValue = parseFloat(price);
        if (isNaN(priceValue)) return;
        
        if (type.trim() === 'Driver') {
          prices.drivers[identifier.trim()] = priceValue;
        } else if (type.trim() === 'Constructor') {
          prices.constructors[identifier.trim()] = priceValue;
        }
      });
      
      return prices;
    } catch (error) {
      console.error('Error importing prices:', error);
      throw error;
    }
  }
};

export default priceStorage;
