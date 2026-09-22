// Fantasy F1 fallback pricing for 2026 season
// These are used only when the live Fantasy F1 feed (price_snapshots.json) has
// not yet been synced or a driver cannot be matched. The authoritative prices
// come from the scheduled feed sync via /api/fantasy-prices.

import priceStorage from './priceStorage';

export const DRIVER_PRICES = {
  // Red Bull Racing
  1: 32000000,   // Max Verstappen
  6: 10000000,   // Isack Hadjar

  // Mercedes
  63: 22000000,  // George Russell
  12: 18000000,  // Kimi Antonelli

  // Ferrari
  44: 28000000,  // Lewis Hamilton
  16: 26000000,  // Charles Leclerc

  // McLaren
  4: 30000000,   // Lando Norris
  81: 22000000,  // Oscar Piastri

  // Aston Martin
  14: 12000000,  // Fernando Alonso
  18: 9000000,   // Lance Stroll

  // Alpine
  10: 18000000,  // Pierre Gasly
  43: 10000000,  // Franco Colapinto

  // Williams
  55: 14000000,  // Carlos Sainz
  23: 9000000,   // Alexander Albon

  // Racing Bulls
  22: 12000000,  // Yuki Tsunoda
  30: 14000000,  // Liam Lawson

  // Audi (formerly Kick Sauber)
  27: 12000000,  // Nico Hulkenberg
  5: 10000000,   // Gabriel Bortoleto

  // Cadillac (formerly Andretti)
  77: 5000000,   // Valtteri Bottas
  11: 8000000,   // Sergio Perez

  // Haas
  31: 12000000,  // Esteban Ocon
  87: 10000000,  // Oliver Bearman
};

export const CONSTRUCTOR_PRICES = {
  'Red Bull Racing': 30000000,
  'Mercedes': 24000000,
  'Ferrari': 30000000,
  'McLaren': 34000000,
  'Aston Martin': 14000000,
  'Alpine': 20000000,
  'Williams': 14000000,
  'Racing Bulls': 16000000,
  'Audi': 14000000,
  'Cadillac': 8000000,
  'Haas F1 Team': 14000000,
  // Aliases
  'Red Bull': 30000000,
  'Aston Martin F1 Team': 14000000,
  'Alpine F1 Team': 20000000,
  'Williams Racing': 14000000,
  'Haas': 14000000,
  'Kick Sauber': 14000000,
  'Sauber': 14000000,
  'RB': 16000000,
  'AlphaTauri': 16000000,
  'Visa Cash App RB': 16000000,
};

export const getDriverPrice = (driverNumber) => {
  // Check for custom prices first
  const customPrices = priceStorage.getCustomPrices();
  if (customPrices?.drivers?.[driverNumber]) {
    return customPrices.drivers[driverNumber];
  }
  
  // Fall back to default prices
  return DRIVER_PRICES[driverNumber] || 8000000; // Default price
};

export const getConstructorPrice = (teamName) => {
  if (!teamName) return 10000000;
  
  // Check for custom prices first
  const customPrices = priceStorage.getCustomPrices();
  if (customPrices?.constructors?.[teamName]) {
    return customPrices.constructors[teamName];
  }
  
  // Try exact match in defaults
  if (CONSTRUCTOR_PRICES[teamName]) {
    return CONSTRUCTOR_PRICES[teamName];
  }
  
  // Try partial match in defaults
  const normalizedName = teamName.toLowerCase();
  for (const [team, price] of Object.entries(CONSTRUCTOR_PRICES)) {
    if (normalizedName.includes(team.toLowerCase()) || team.toLowerCase().includes(normalizedName)) {
      return price;
    }
  }
  
  return 10000000; // Default price
};

export const calculateTotalPrice = (drivers, constructors) => {
  let total = 0;
  
  // Add driver prices
  drivers.forEach(driver => {
    total += getDriverPrice(driver.driver_number);
  });
  
  // Add constructor prices
  constructors.forEach(constructor => {
    total += getConstructorPrice(constructor.team_name);
  });
  
  return total;
};

export const formatPrice = (price) => {
  return `$${(price / 1000000).toFixed(1)}M`;
};
