# Fantasy F1 Team Builder & Predictor

A modern React application for building and managing your Fantasy Formula 1 team, with data-driven predictions and comprehensive statistics.

![Fantasy F1](https://img.shields.io/badge/Fantasy%20F1-E10600?style=flat&logo=f1&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat&logo=react)
![Vite](https://img.shields.io/badge/Vite-7.3.1-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=flat&logo=tailwind-css)

## Features

### 🏎️ Team Builder

- **$100M Budget Management**: Build your team within the official Fantasy F1 budget
- **5 Drivers + 2 Constructors**: Select your optimal lineup
- **Real-time Price Tracking**: Dynamic pricing based on driver values
- **Budget Calculator**: Visual budget tracker with remaining funds
- **Turbo Driver Selection**: Choose your driver to score 2x points
- **Auto-Save**: Your team selections are automatically saved to browser storage
- **Team History**: Save teams for each race week and track your selections over time
- **Import/Export**: Share teams via JSON files or back up your selections
- **Clear Team**: Reset your selections with one click

### 📜 Team History

- **Weekly Team Tracking**: Save your team for each race week with custom labels
- **View Past Teams**: See all your previous team selections
- **Load Historical Teams**: Restore any past team as your current selection
- **Export Teams**: Download any saved team as a JSON file
- **Delete History**: Remove old team entries to keep your history clean

### � Price Manager

- **Manual Price Entry**: Update driver and constructor prices each week to match official Fantasy F1 values
- **Custom Price Tracking**: Set custom prices that override default values across the entire app
- **Price Change Indicators**: See price increases/decreases with up/down arrows and percentage changes
- **Price History**: Track up to 10 historical price snapshots to see trends over time
- **Import/Export CSV**: Share price lists or backup your custom prices via CSV files
- **Reset to Defaults**: Quickly revert to default prices if needed
- **Visual Feedback**: Custom prices are highlighted in green, changes shown in red/green

### �📊 Predictions

- **Race Outcome Predictions**: Data-driven forecasts for upcoming races
- **Points Calculator**: See predicted points for each driver
- **Turbo Multiplier Preview**: Compare standard vs. turbocharged points
- **Historical Analysis**: Predictions based on circuit characteristics

### 📈 Statistics

- **Current Driver Data**: Live data from OpenF1 API
- **Team Breakdowns**: View all teams and their driver lineups
- **Driver Profiles**: Detailed information with team colors
- **Season Overview**: Quick stats on drivers, teams, and countries

### 📋 Rules & Scoring

- **Complete Scoring System**: All Fantasy F1 point categories explained
- **Strategy Tips**: Pro tips for building winning teams
- **Chip Strategies**: How to use Turbo Driver and other power-ups
- **Official Links**: Direct access to Fantasy F1 official resources

## Tech Stack

- **React 19** - Modern UI library
- **Vite 7** - Lightning-fast build tool
- **Tailwind CSS 3** - Utility-first styling
- **React Router** - Client-side routing
- **Axios** - HTTP client for API requests
- **Heroicons** - Beautiful hand-crafted SVG icons
- **Moment.js** - Date/time formatting

## Data Source

This application uses the [OpenF1 API](https://openf1.org/) which provides:

- Real-time and historical F1 data
- Driver information and statistics
- Session data and results
- Official F1 timing data

### API Caching

To prevent rate limiting (429 errors) from the OpenF1 API, this app implements an intelligent caching system:

- **5-minute cache TTL**: API responses are cached in localStorage for 5 minutes
- **Automatic cache management**: Old entries are automatically cleaned up
- **Cache status widget**: View cache statistics and manually clear cache if needed
- **Smart cache keys**: Each API endpoint and parameter combination has a unique cache key

The cache status widget appears in the bottom-right corner of the app, showing the number of cached items and total cache size.

### Team Persistence

Your team selections are automatically saved to browser localStorage:

- **Auto-save**: Your selections are saved automatically as you build your team
- **Current Team**: Your active team is always persisted between sessions
- **Team History**: Save up to 20 historical teams with custom labels (e.g., "Monaco GP", "Race 5")
- **Import/Export**: Share teams via downloadable JSON files
- **Cross-Session**: Your team persists even after closing your browser

**Storage Keys:**

- `fantasy_f1_current_team`: Your active team selections
- `fantasy_f1_teams_history`: Up to 20 saved historical teams

**Team Data Includes:**

- Selected drivers and constructors
- Turbo driver choice
- Total budget spent
- Save timestamps

### Custom Pricing

Update driver and constructor prices weekly to match official Fantasy F1 values:

- **Manual Price Entry**: Input prices in millions (e.g., "32.5" for $32.5M)
- **Automatic Override**: Custom prices automatically override defaults throughout the app
- **Price History**: Tracks last 10 price updates with timestamps
- **Change Tracking**: See price increases/decreases with arrows and percentages
- **CSV Support**: Import/export prices for easy sharing or backup

**Storage Keys:**

- `fantasy_f1_custom_prices`: Current custom price values
- `fantasy_f1_price_history`: Historical price snapshots (up to 10 entries)

**Price Data Includes:**

- Driver prices by driver number
- Constructor prices by team name
- Last updated timestamp
- Price change history

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to:

```
http://localhost:3000
```

## Fantasy F1 Rules

### Budget & Selection

- **Budget**: $100,000,000 (100M)
- **Drivers**: Select 5 drivers
- **Constructors**: Select 2 constructors
- **Turbo Driver**: One driver scores 2x points

### Points System

#### Race Finishing Points

- 1st: 25 pts | 2nd: 18 pts | 3rd: 15 pts
- 4th: 12 pts | 5th: 10 pts | 6th: 8 pts
- 7th: 6 pts | 8th: 4 pts | 9th: 2 pts | 10th: 1 pt

#### Qualifying Points

- P1-P10: 10-1 points respectively

#### Bonus Points

- Fastest Lap: +5 pts
- Position Gained: +2 pts each
- Beat Teammate (Qualifying): +2 pts
- Beat Teammate (Race): +3 pts
- Classified Finish: +1 pt

#### Penalties

- Position Lost: -2 pts each
- Not Classified: -5 pts
- Disqualified: -20 pts

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Architecture & How It Works

### Project Structure

```
fantasy-f1/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── ui/          # Card, Modal, LoadingSkeleton, CacheStatus, etc.
│   ├── layouts/         # Layout wrapper with navigation
│   ├── pages/           # Page components (TeamBuilder, Predictions, etc.)
│   ├── services/        # API service layer
│   │   └── openF1API.js # OpenF1 API client with caching
│   ├── utils/           # Utility modules
│   │   ├── cacheManager.js    # localStorage cache with TTL
│   │   ├── pricing.js         # Price data and getters
│   │   ├── priceStorage.js    # Custom price persistence
│   │   ├── setupStorage.js    # First-time setup state
│   │   ├── teamColors.js      # F1 team color schemes
│   │   └── teamStorage.js     # Team persistence
│   ├── App.jsx          # Root component with routing
│   └── main.jsx         # React entry point
├── public/              # Static assets
└── index.html           # HTML template
```

### Core Systems

#### 1. API & Caching Layer

**File**: `src/services/openF1API.js`

The OpenF1 API client wraps all API calls with intelligent caching:

```javascript
// All methods use the cached request pattern:
async getDrivers() {
  return this.cachedRequest('/drivers', { session_key: 'latest' });
}
```

**How it works**:

- Each API call checks `cacheManager` first
- If valid cache exists (< 5 min old), returns cached data
- If no cache or expired, makes API request
- Stores response in localStorage with timestamp
- Automatically cleans up old cache entries

**Cache Keys**: `f1_cache_[endpoint]_[hash]`

**Benefits**: Prevents 429 rate limit errors, improves performance

#### 2. Team Persistence System

**Files**:

- `src/utils/teamStorage.js` - Storage operations
- `src/pages/TeamBuilder.jsx` - Auto-save implementation
- `src/pages/TeamHistory.jsx` - History management

**How it works**:

1. **Current Team** (`fantasy_f1_current_team`):
   - Auto-saves on every selection change (drivers, turbo, constructors)
   - Stored as JSON with: drivers[], constructors[], turboDriver, totalSpent, lastUpdated
   - Loaded on app start via `teamStorage.getCurrentTeam()`

2. **Team History** (`fantasy_f1_teams_history`):
   - User explicitly saves teams with labels (e.g., "Monaco GP")
   - Stores up to 20 historical teams (oldest deleted when limit reached)
   - Each entry includes full team data + raceLabel + savedAt timestamp
   - Can be loaded back to become current team

3. **Import/Export**:
   - Export: `JSON.stringify(teamData)` → downloadable .json file
   - Import: File upload → `JSON.parse()` → validate → save

#### 3. Custom Pricing System

**Files**:

- `src/utils/pricing.js` - Default prices + getter functions
- `src/utils/priceStorage.js` - Custom price persistence
- `src/pages/PriceManager.jsx` - Price editing interface

**How it works**:

1. **Default Prices**:
   - Hardcoded in `pricing.js` as `DRIVER_PRICES` and `CONSTRUCTOR_PRICES`
   - Example: `1: 32000000` (Verstappen = $32M)

2. **Custom Prices** (`fantasy_f1_custom_prices`):
   - User enters custom prices in Price Manager
   - Stored separately: `{ drivers: {1: 32500000}, constructors: {...} }`
   - `getDriverPrice(driverNumber)` checks custom first, falls back to default
   - `getConstructorPrice(teamName)` does the same for constructors

3. **Price History** (`fantasy_f1_price_history`):
   - Snapshot saved every time prices are updated
   - Stores last 10 snapshots with timestamps
   - Shows price changes with arrows (↑/↓) and percentages

4. **Global Effect**:
   - All pages use `getDriverPrice()` and `getConstructorPrice()` functions
   - Custom prices automatically apply everywhere (Team Builder, Predictions, etc.)
   - Price Manager sorts drivers/constructors by value (highest first)

#### 4. First-Time Setup Flow

**Files**:

- `src/components/ui/WelcomeModal.jsx` - Welcome modal component
- `src/utils/setupStorage.js` - Setup completion tracking
- `src/App.jsx` - Modal trigger logic

**How it works**:

1. On first visit, checks `setupStorage.isSetupComplete()` → false
2. Shows WelcomeModal with options:
   - "Update Prices Now" → redirects to `/prices?setup=true`
   - "Skip for Now" → marks setup complete, closes modal
3. After visiting Price Manager once, setup marked complete
4. Modal never shows again unless localStorage cleared

#### 5. Page-Level Operations

**Team Builder** (`src/pages/TeamBuilder.jsx`):

- Fetches drivers via `openF1API.getDrivers()` (cached)
- Filters by unique driver number + sorts by price (DESC)
- Budget constraint: drivers + constructors ≤ $100M
- Auto-saves to `teamStorage` on every change
- Shows "Team Complete!" banner with 5-second auto-dismiss
- Turbo driver selection (1 driver scores 2x points)

**Predictions** (`src/pages/Predictions.jsx`):

- Fetches meetings via `openF1API.getMeetings()` (cached)
- Filters to current year only
- Sorts ASC (next race first)
- Smart default selection: auto-selects next upcoming race
- Shows all races (no 10-race limit)
- Displays race location, date, and circuit info

**Team History** (`src/pages/TeamHistory.jsx`):

- Loads saved teams from `teamStorage.getTeamsHistory()`
- Displays each with raceLabel, date, drivers, constructors
- Actions: Load (restore as current), Export (download JSON), Delete
- Sorted by savedAt timestamp (newest first)

**Price Manager** (`src/pages/PriceManager.jsx`):

- Tabbed interface: Drivers | Constructors
- Shows current price (custom if set, else default)
- Input fields to set custom prices (in millions)
- Price change indicators with arrows and %
- Import CSV: parses `driverNumber,price` or `teamName,price`
- Export CSV: generates downloadable CSV
- Reset: clears all custom prices, reverts to defaults
- Sorted by value (highest first)

**Live Pricing Guide** (`src/pages/LivePricingGuide.jsx`):

- Educational page explaining why auto-scraping isn't feasible
- Links to official Fantasy F1 site
- Instructions for manual price entry

**Rules** (`src/pages/Rules.jsx`):

- Static content page
- Full Fantasy F1 scoring system
- Strategy tips and best practices
- Links to official resources

### Component Architecture

#### Shared UI Components (`src/components/ui/`)

**Card.jsx**: Reusable card container with variants (default, danger, warning, info)

**LoadingSkeleton.jsx**: Loading states with shimmer animation

- Card variant: Full-width skeleton cards
- List variant: Smaller line skeletons

**CacheStatus.jsx**: Bottom-right widget showing cache stats

- Displays: cached items count, total size
- Clear cache button
- Click to view cache details

**WelcomeModal.jsx**: First-time setup modal

- Full-screen overlay
- Setup vs Skip options
- Only shows on first visit

#### Layout System (`src/layouts/Layout.jsx`)

- Fixed sidebar navigation (responsive: hidden on mobile)
- Mobile hamburger menu
- Active route highlighting
- CacheStatus widget in footer
- F1 red gradient theme (#E10600)

### Data Flow

```
User Action (e.g., select driver)
    ↓
Page Component (e.g., TeamBuilder.jsx)
    ↓
API Service (openF1API.js)
    ↓
Cache Manager (cacheManager.js)
    ↓
localStorage (if cache miss)
    ↓
OpenF1 API (https://api.openf1.org/v1)
    ↓
Cache Manager (store response)
    ↓
Page Component (render data)
    ↓
Storage Utility (e.g., teamStorage.js)
    ↓
localStorage (persist state)
```

### localStorage Schema

**Keys & Data Structures**:

```javascript
// Cache (5-minute TTL)
"f1_cache_/drivers_hash123": {
  data: [...],
  timestamp: 1709876543210
}

// Current Team
"fantasy_f1_current_team": {
  drivers: [1, 44, 16, 4, 14],           // driver numbers
  constructors: ["Red Bull Racing", "Ferrari"],
  turboDriver: 1,
  totalSpent: 98000000,
  lastUpdated: "2026-03-08T12:34:56Z"
}

// Team History
"fantasy_f1_teams_history": [
  {
    raceLabel: "Monaco GP",
    drivers: [...],
    constructors: [...],
    turboDriver: 1,
    totalSpent: 98000000,
    savedAt: "2026-05-26T14:30:00Z"
  },
  // ... up to 20 teams
]

// Custom Prices
"fantasy_f1_custom_prices": {
  drivers: {
    "1": 32500000,    // Verstappen custom price
    "44": 28500000    // Hamilton custom price
  },
  constructors: {
    "Red Bull Racing": 35000000,
    "Ferrari": 30000000
  },
  lastUpdated: "2026-03-08T10:00:00Z"
}

// Price History
"fantasy_f1_price_history": [
  {
    drivers: {...},
    constructors: {...},
    timestamp: "2026-03-08T10:00:00Z"
  },
  // ... up to 10 snapshots
]

// Setup State
"fantasy_f1_setup_complete": true
```

### CSS & Styling

- **Tailwind CSS 3**: Utility-first framework
- **Custom F1 Theme**: Red (#E10600) as primary color
- **Responsive Design**: Mobile-first approach
  - Sidebar: Hidden on mobile, fixed on desktop
  - Grids: 1 column → 2-3 columns on larger screens
- **Team Colors**: Each F1 team has custom gradient (teamColors.js)

### Error Handling

- **API Errors**: Try-catch blocks with user-friendly error messages
- **429 Rate Limits**: Prevented by caching system (5-min TTL)
- **Invalid Data**: Validation on imports (team & price files)
- **Missing Prices**: Falls back to default prices when custom not found

### Performance Optimizations

1. **Caching**: 5-minute localStorage cache prevents redundant API calls
2. **Lazy Loading**: React Router code-splitting (automatic with Vite)
3. **Debouncing**: Auto-save uses React's batched updates
4. **Memoization**: Price calculations only when prices change
5. **Efficient Sorting**: Pre-computed sorts stored in state

## Acknowledgments

- [OpenF1](https://openf1.org/) for providing the F1 data API
- [Formula 1](https://www.formula1.com/) for the official Fantasy F1 game
- [dauble/f1-stats](https://github.com/dauble/f1-stats) for UI inspiration and design patterns

## Disclaimer

This is an unofficial Fantasy F1 tool and is not affiliated with or endorsed by Formula 1, FOM, or any F1 teams.

---

Built with ❤️ for F1 fans by F1 fans
