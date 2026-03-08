// Fantasy F1 pricing for 2024 season (in USD, can be adjusted)
// Prices are based on driver performance, team performance, and market value

import priceStorage from './priceStorage';

export const DRIVER_PRICES = {
  // Red Bull Racing
  1: 32000000,  // Max Verstappen
  11: 18000000, // Sergio Perez
  
  // Mercedes
  44: 28000000, // Lewis Hamilton
  63: 22000000, // George Russell
  
  // Ferrari
  16: 26000000, // Charles Leclerc
  55: 20000000, // Carlos Sainz
  
  // McLaren
  4: 24000000,  // Lando Norris
  81: 16000000, // Oscar Piastri
  
  // Aston Martin
  14: 19000000, // Fernando Alonso
  18: 15000000, // Lance Stroll
  
  // Alpine
  10: 12000000, // Pierre Gasly
  31: 10000000, // Esteban Ocon
  
  // Williams
  23: 11000000, // Alexander Albon
  2: 8000000,   // Logan Sargeant / Franco Colapinto
  
  // RB (AlphaTauri/Racing Bulls)
  3: 10000000,  // Daniel Ricciardo
  22: 9000000,  // Yuki Tsunoda
  
  // Kick Sauber
  77: 9000000,  // Valtteri Bottas
  24: 7000000,  // Zhou Guanyu
  
  // Haas
  20: 8000000,  // Kevin Magnussen
  27: 7500000,  // Nico Hulkenberg
};

export const CONSTRUCTOR_PRICES = {
  'Red Bull Racing': 35000000,
  'Mercedes': 30000000,
  'Ferrari': 32000000,
  'McLaren': 28000000,
  'Aston Martin': 20000000,
  'Alpine': 15000000,
  'Williams': 12000000,
  'RB': 14000000,
  'Kick Sauber': 10000000,
  'Haas F1 Team': 11000000,
  // Aliases
  'Red Bull': 35000000,
  'Aston Martin F1 Team': 20000000,
  'Alpine F1 Team': 15000000,
  'Williams Racing': 12000000,
  'Haas': 11000000,
  'Sauber': 10000000,
  'AlphaTauri': 14000000,
  'Racing Bulls': 14000000,
  'Visa Cash App RB': 14000000,
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
