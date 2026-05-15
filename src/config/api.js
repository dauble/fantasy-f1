// OpenF1 API Configuration
export const OPENF1_API_BASE = 'https://api.openf1.org/v1';

// Cache Configuration
// Note: OpenF1 API has rate limits. Caching helps prevent 429 errors.
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
export const CACHE_ENABLED = true;

// Fantasy F1 Constants
export const FANTASY_BUDGET = 100000000; // $100M
export const MAX_DRIVERS = 5;
export const MAX_CONSTRUCTORS = 2;

// Points system based on Fantasy F1 rules
export const POINTS = {
  // Race finishing positions
  position: {
    1: 25,
    2: 18,
    3: 15,
    4: 12,
    5: 10,
    6: 8,
    7: 6,
    8: 4,
    9: 2,
    10: 1
  },
  // Qualifying positions
  qualifying: {
    1: 10,
    2: 9,
    3: 8,
    4: 7,
    5: 6,
    6: 5,
    7: 4,
    8: 3,
    9: 2,
    10: 1
  },
  // Sprint race finishing positions (top 8 score)
  sprint: {
    1: 8,
    2: 7,
    3: 6,
    4: 5,
    5: 4,
    6: 3,
    7: 2,
    8: 1
  },
  sprintFastestLap: 5,
  sprintDNF: -10,
  // Additional points
  fastestLap: 10,
  driverOfTheDay: 10,
  positionGained: 2,
  positionLost: -2,
  classified: 1,
  notClassified: -20,
  disqualified: -20,
  beaten_teammate_qualifying: 2,
  beaten_teammate_race: 3
};

// Turbo Driver multiplier (weekly selection, not a chip)
export const TURBO_MULTIPLIER = 2;

// Transfers: 2 free per race weekend. Each additional swap costs this many points.
export const FREE_TRANSFERS = 2;
export const TRANSFER_PENALTY = 10;
