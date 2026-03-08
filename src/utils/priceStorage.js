// Price Storage utility for managing custom driver and constructor prices

const CUSTOM_PRICES_KEY = 'fantasy_f1_custom_prices';
const PRICE_HISTORY_KEY = 'fantasy_f1_price_history';

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
