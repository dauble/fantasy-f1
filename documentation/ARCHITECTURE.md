# Architecture & Technical Documentation

Complete technical documentation for the Fantasy F1 application architecture, data flow, and system design.

## Project Structure

```
fantasy-f1/
├── documentation/       # Project documentation
│   ├── ARCHITECTURE.md  # This file
│   └── DEPLOYMENT.md    # Deployment guide
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── team/        # Team-specific components
│   │   │   ├── ConstructorCard.jsx
│   │   │   └── DriverCard.jsx
│   │   └── ui/          # Generic UI components
│   │       ├── Card.jsx
│   │       ├── CacheStatus.jsx
│   │       ├── LoadingSkeleton.jsx
│   │       └── WelcomeModal.jsx
│   ├── layouts/         # Layout wrapper with navigation
│   │   └── Layout.jsx
│   ├── pages/           # Page components
│   │   ├── TeamBuilder.jsx
│   │   ├── Predictions.jsx
│   │   ├── TeamHistory.jsx
│   │   ├── PriceManager.jsx
│   │   ├── LivePricingGuide.jsx
│   │   └── Rules.jsx
│   ├── services/        # API service layer
│   │   └── openF1API.js # OpenF1 API client with caching
│   ├── utils/           # Utility modules
│   │   ├── cache.js           # Cache manager implementation
│   │   ├── pricing.js         # Price data and getters
│   │   ├── priceStorage.js    # Custom price persistence
│   │   ├── priceScraper.js    # Educational scraping documentation
│   │   ├── setupStorage.js    # First-time setup state
│   │   ├── teamColors.js      # F1 team color schemes
│   │   └── teamStorage.js     # Team persistence
│   ├── App.jsx          # Root component with routing
│   ├── App.css          # App-level styles
│   ├── index.css        # Global styles with Tailwind
│   └── main.jsx         # React entry point
├── public/              # Static assets
│   └── vite.svg
├── Dockerfile           # Multi-stage Docker build
├── fly.toml             # Fly.io deployment config
├── nginx.conf           # nginx web server config
├── .dockerignore        # Docker build exclusions
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite build configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
└── eslint.config.js     # ESLint configuration
```

## Core Systems

### 1. API & Caching Layer

**File**: `src/services/openF1API.js`

The OpenF1 API client wraps all API calls with intelligent caching to prevent rate limiting.

```javascript
// All methods use the cached request pattern:
async getDrivers() {
  return this.cachedRequest('/drivers', { session_key: 'latest' });
}

async getMeetings() {
  return this.cachedRequest('/meetings', { year: 2026 });
}
```

**How it works**:

- Each API call checks `cacheManager` first for existing cached data
- If valid cache exists (< 5 min old), returns cached data immediately
- If no cache or expired, makes fresh API request to OpenF1
- Stores response in localStorage with timestamp
- Automatically cleans up old cache entries to manage storage

**Cache Keys Pattern**: `f1_cache_[endpoint]_[hash_of_params]`

**Benefits**:

- Prevents 429 rate limit errors from OpenF1 API
- Significantly improves application performance
- Reduces network bandwidth usage
- Enables offline-first experience for recently viewed data

### 2. Team Persistence System

**Files**:

- `src/utils/teamStorage.js` - Storage operations and API
- `src/pages/TeamBuilder.jsx` - Auto-save implementation
- `src/pages/TeamHistory.jsx` - History management UI

**How it works**:

#### Current Team Storage (`fantasy_f1_current_team`)

The active team is automatically saved on every change:

- Auto-saves when drivers are selected/deselected
- Auto-saves when turbo driver is changed
- Auto-saves when constructors are selected/deselected
- Stored as JSON with: `drivers[]`, `constructors[]`, `turboDriver`, `totalSpent`, `lastUpdated`
- Loaded automatically on app start via `teamStorage.getCurrentTeam()`
- Persists across browser sessions

#### Team History Storage (`fantasy_f1_teams_history`)

Users can explicitly save teams for specific race weeks:

- Save with custom labels (e.g., "Monaco GP", "Race 5", "Silverstone 2026")
- Stores up to 20 historical teams (FIFO - oldest deleted when limit reached)
- Each entry includes full team data + `raceLabel` + `savedAt` timestamp
- History can be viewed, loaded (restore as current), exported, or deleted
- Sorted by save date (newest first)

#### Import/Export Functionality

**Export**:

- `JSON.stringify(teamData)` → downloadable .json file
- Preserves all team data, timestamps, and labels
- Compatible with import from any device/browser

**Import**:

- File upload → `JSON.parse()` → validation → save to storage
- Validates required fields (drivers, constructors, turboDriver)
- Handles legacy/missing fields gracefully

### 3. Custom Pricing System

**Files**:

- `src/utils/pricing.js` - Default prices + getter functions
- `src/utils/priceStorage.js` - Custom price persistence
- `src/pages/PriceManager.jsx` - Price editing interface

**How it works**:

#### Default Prices (Hardcoded Fallback)

Defined in `pricing.js`:

```javascript
export const DRIVER_PRICES = {
  1: 32000000, // Max Verstappen = $32M
  44: 28000000, // Lewis Hamilton = $28M
  // ... etc
};

export const CONSTRUCTOR_PRICES = {
  "Red Bull Racing": 35000000,
  Ferrari: 30000000,
  // ... etc
};
```

#### Custom Prices Storage (`fantasy_f1_custom_prices`)

Users update prices weekly via Price Manager:

- Input prices in millions (e.g., "32.5" for $32.5M)
- Stored separately from defaults: `{ drivers: {1: 32500000}, constructors: {...} }`
- Price getters check custom first, fall back to default if not found:

```javascript
export const getDriverPrice = (driverNumber) => {
  const customPrices = priceStorage.getCustomPrices();
  return (
    customPrices?.drivers?.[driverNumber] ||
    DRIVER_PRICES[driverNumber] ||
    5000000
  );
};

export const getConstructorPrice = (teamName) => {
  const customPrices = priceStorage.getCustomPrices();
  return (
    customPrices?.constructors?.[teamName] ||
    CONSTRUCTOR_PRICES[teamName] ||
    10000000
  );
};
```

#### Price History Storage (`fantasy_f1_price_history`)

Track price changes over time:

- Snapshot saved every time prices are updated
- Stores last 10 snapshots with timestamps
- Calculate price changes: `(current - previous) / previous * 100`
- Display arrows (↑/↓) and percentage changes in UI
- Useful for identifying value picks and price trends

#### Global Price Application

All pages use the getter functions:

- Team Builder: Displays prices, calculates budget
- Predictions: Shows driver values for strategy decisions
- Price Manager: Edit interface with change tracking
- Custom prices automatically override defaults app-wide

### 4. First-Time Setup Flow

**Files**:

- `src/components/ui/WelcomeModal.jsx` - Welcome modal component
- `src/utils/setupStorage.js` - Setup completion tracking
- `src/App.jsx` - Modal trigger logic

**Flow**:

1. **First Visit Detection**:
   - `setupStorage.isSetupComplete()` returns `false`
   - Delayed modal appearance (500ms) for smoother UX

2. **Welcome Modal Display**:
   - Two options presented to user:
     - **"Update Prices Now"**: Redirects to `/prices?setup=true`
     - **"Skip for Now"**: Marks setup complete, closes modal

3. **Setup Completion**:
   - After visiting Price Manager, setup marked complete
   - Modal never shows again (unless localStorage cleared)
   - Flag stored: `fantasy_f1_setup_complete: true`

**Purpose**: Encourages users to update prices on first visit to ensure accurate budget calculations.

### 5. Page-Level Operations

#### Team Builder (`src/pages/TeamBuilder.jsx`)

**Core Functionality**:

- Fetches drivers via `openF1API.getDrivers()` (uses cache)
- Filters duplicates by unique driver number
- Sorts by price DESC (most expensive first)
- Budget constraint validation: `drivers + constructors ≤ $100M`
- Auto-saves to `teamStorage` on every selection change
- Shows "Team Complete!" banner with 5-second auto-dismiss + click-to-close

**Features**:

- 5 driver slots with visual selection state
- 2 constructor slots
- Turbo driver selection (1 driver scores 2x points)
- Real-time budget calculation with remaining funds display
- Visual indicators: selected (green), disabled (over budget)
- Quick actions: Clear Team, Import Team

#### Predictions (`src/pages/Predictions.jsx`)

**Core Functionality**:

- Fetches meetings via `openF1API.getMeetings()` (uses cache)
- Filters to current year (2026) only
- Sorts ASC (earliest race first, next race at top)
- Smart default selection: auto-selects next upcoming race
- Shows all races (no 10-race limit)

**Display**:

- Race name, location, country flag
- Circuit information
- Date range (practice → race)
- Race outcome predictions
- Points calculator for selected drivers

#### Team History (`src/pages/TeamHistory.jsx`)

**Core Functionality**:

- Loads saved teams from `teamStorage.getTeamsHistory()`
- Displays each with `raceLabel`, date, drivers, constructors
- Sorted by `savedAt` timestamp (newest first)

**Actions**:

- **Load**: Restore team as current selection
- **Export**: Download team as JSON file
- **Delete**: Remove from history (with confirmation)

**Empty State**: Helpful message encouraging first team save

#### Price Manager (`src/pages/PriceManager.jsx`)

**Core Functionality**:

- Tabbed interface: Drivers | Constructors
- Shows current price (custom if set, else default)
- Visual indicator: green highlight for custom prices
- Sorted by value (highest price first)

**Features**:

- Input fields to set custom prices (in millions)
- Price change indicators with arrows (↑/↓) and percentages
- Import CSV: parses `driverNumber,price` or `teamName,price` format
- Export CSV: generates downloadable CSV with current prices
- Reset button: clears all custom prices, reverts to defaults
- Save confirmation with visual feedback

**CSV Format**:

```csv
# Drivers
1,32.5
44,28.0

# Constructors
Red Bull Racing,35.0
Ferrari,30.0
```

#### Live Pricing Guide (`src/pages/LivePricingGuide.jsx`)

**Purpose**: Educational page explaining automated pricing challenges

**Content**:

- Why auto-scraping official Fantasy F1 isn't feasible
- Authentication requirements
- CORS and security limitations
- Browser extension alternatives
- Links to official Fantasy F1 site
- Instructions for manual price entry workflow

**Not Implemented**: Actual scraping functionality (reference only)

#### Rules (`src/pages/Rules.jsx`)

**Purpose**: Static reference page for Fantasy F1 rules

**Content**:

- Complete Fantasy F1 scoring system
- Budget and selection requirements
- Points breakdown (race, qualifying, bonus, penalties)
- Strategy tips and best practices
- Chip strategies (Turbo Driver usage)
- Links to official Fantasy F1 resources

### Component Architecture

#### Shared UI Components (`src/components/ui/`)

##### Card.jsx

Reusable card container with variants:

- **default**: White background, standard border
- **danger**: Red border, error states
- **warning**: Yellow border, warnings
- **info**: Blue border, informational

Usage: Wraps content sections throughout the app

##### LoadingSkeleton.jsx

Loading states with shimmer animation:

- **card** variant: Full-width skeleton cards
- **list** variant: Smaller line skeletons
- **count** prop: Number of skeleton items to display

##### CacheStatus.jsx

Bottom-right widget showing cache statistics:

- Displays: cached items count, total cache size
- Clear cache button (forces cache invalidation)
- Click to view cache details
- Useful for debugging and storage management

##### WelcomeModal.jsx

First-time setup modal:

- Full-screen dark overlay
- Two-button choice: Update Prices or Skip
- Setup vs Skip flow branching
- Only shows on first visit (setup incomplete)

#### Team Components (`src/components/team/`)

##### DriverCard.jsx

Individual driver selection card:

- Team color header with gradient
- Driver name, number, team
- Price display
- Selection state visual (border color)
- Click to select/deselect

##### ConstructorCard.jsx

Constructor/team selection card:

- Team name and logo area
- Price display
- Selection state visual
- Click to select/deselect

#### Layout System (`src/layouts/Layout.jsx`)

**Structure**:

- Fixed sidebar navigation (hidden on mobile, visible on desktop)
- Mobile hamburger menu icon
- Active route highlighting (red background)
- CacheStatus widget in bottom-right
- F1 red gradient theme (#E10600 → darker red)

**Navigation Items**:

- 🏎️ Team Builder (/)
- 📊 Predictions (/predictions)
- 📜 Team History (/history)
- 💰 Price Manager (/prices)
- 📋 Rules (/rules)

**Responsive**:

- Mobile: Hamburger menu, overlay sidebar
- Desktop: Fixed sidebar, always visible

## Data Flow

Complete request/response cycle:

```
User Action (e.g., select driver)
    ↓
Page Component (e.g., TeamBuilder.jsx)
    ↓
State Update (React useState)
    ↓
API Service (openF1API.js) - if data needed
    ↓
Cache Manager (cache.js)
    ↓ (cache miss)
localStorage check
    ↓ (not found or expired)
OpenF1 API (https://api.openf1.org/v1)
    ↓
Response received
    ↓
Cache Manager (store with timestamp)
    ↓
Page Component (render data)
    ↓
Storage Utility (e.g., teamStorage.js)
    ↓
localStorage (persist state)
```

**Cache Hit Path** (faster):

```
API Service → Cache Manager → Return cached data → Page Component
```

## localStorage Schema

Complete data structures and storage keys:

### Cache Storage (5-minute TTL)

```javascript
"f1_cache_/drivers_12345abc": {
  data: [
    {
      driver_number: 1,
      full_name: "Max Verstappen",
      team_name: "Red Bull Racing",
      // ... other driver fields
    },
    // ... more drivers
  ],
  timestamp: 1709876543210
}
```

### Current Team Storage

```javascript
"fantasy_f1_current_team": {
  drivers: [1, 44, 16, 4, 14],  // Array of driver numbers
  constructors: ["Red Bull Racing", "Ferrari"],  // Array of team names
  turboDriver: 1,  // Driver number of turbocharged driver
  totalSpent: 98000000,  // Budget spent in dollars
  lastUpdated: "2026-03-08T12:34:56Z"  // ISO timestamp
}
```

### Team History Storage

```javascript
"fantasy_f1_teams_history": [
  {
    raceLabel: "Monaco GP",  // User-provided label
    drivers: [1, 44, 16, 4, 14],
    constructors: ["Red Bull Racing", "Ferrari"],
    turboDriver: 1,
    totalSpent: 98000000,
    savedAt: "2026-05-26T14:30:00Z"  // ISO timestamp
  },
  {
    raceLabel: "Race 5 - Imola",
    drivers: [1, 63, 16, 81, 14],
    constructors: ["Red Bull Racing", "McLaren"],
    turboDriver: 63,
    totalSpent: 97500000,
    savedAt: "2026-05-19T10:15:00Z"
  },
  // ... up to 20 teams (FIFO)
]
```

### Custom Prices Storage

```javascript
"fantasy_f1_custom_prices": {
  drivers: {
    "1": 32500000,    // Max Verstappen custom price
    "44": 28500000,   // Lewis Hamilton custom price
    "16": 26500000,   // Charles Leclerc custom price
    // ... only drivers with custom prices
  },
  constructors: {
    "Red Bull Racing": 35000000,
    "Ferrari": 30000000,
    "Mercedes": 28000000,
    // ... only constructors with custom prices
  },
  lastUpdated: "2026-03-08T10:00:00Z"  // ISO timestamp
}
```

### Price History Storage

```javascript
"fantasy_f1_price_history": [
  {
    drivers: {
      "1": 32500000,
      "44": 28500000,
      // ... all driver prices at this point
    },
    constructors: {
      "Red Bull Racing": 35000000,
      "Ferrari": 30000000,
      // ... all constructor prices at this point
    },
    timestamp: "2026-03-08T10:00:00Z"
  },
  {
    drivers: {
      "1": 32000000,  // Previous week
      "44": 28000000,
      // ...
    },
    constructors: {
      "Red Bull Racing": 34500000,
      "Ferrari": 30000000,
      // ...
    },
    timestamp: "2026-03-01T09:00:00Z"
  },
  // ... up to 10 snapshots (FIFO)
]
```

### Setup State Storage

```javascript
"fantasy_f1_setup_complete": true  // Boolean flag
```

## Styling & Design System

### Tailwind CSS Configuration

**Custom Theme Extensions** (`tailwind.config.js`):

```javascript
theme: {
  extend: {
    colors: {
      'f1-red': '#E10600',
      'f1-red-dark': '#C00000',
    }
  }
}
```

### Color Scheme

- **Primary**: F1 Red (#E10600)
- **Secondary**: Darker F1 Red (#C00000)
- **Accent**: Team-specific colors from `teamColors.js`
- **Background**: Gray-100 (#F3F4F6)
- **Cards**: White with subtle shadow

### Team Colors (`src/utils/teamColors.js`)

Each F1 team has custom gradient for visual identification:

```javascript
export const getDriverColor = (teamName) => {
  const colors = {
    "Red Bull Racing": "from-blue-900 to-blue-700",
    Ferrari: "from-red-600 to-red-800",
    Mercedes: "from-teal-500 to-teal-700",
    McLaren: "from-orange-500 to-orange-700",
    "Aston Martin": "from-green-600 to-green-800",
    // ... etc
  };
  return colors[teamName] || "from-gray-600 to-gray-800";
};
```

### Responsive Design

**Mobile-First Approach**:

- Base styles for mobile (320px+)
- `md:` breakpoint for tablets (768px+)
- `lg:` breakpoint for desktop (1024px+)

**Key Responsive Patterns**:

- Sidebar: Hidden on mobile, fixed on desktop
- Grids: 1 column → 2-3 columns on larger screens
- Font sizes: Scale up on larger screens
- Spacing: Tighter on mobile, more generous on desktop

## Error Handling

### API Error Handling

```javascript
try {
  const data = await openF1API.getDrivers();
  // ... process data
} catch (error) {
  console.error("Error fetching drivers:", error);
  setError("Failed to load drivers. Please try again.");
  setLoading(false);
}
```

**User-Facing Error Messages**:

- Generic: "Failed to load data. Please try again."
- Network: "Connection error. Check your internet connection."
- Cache: Automatically falls back to cached data if available

### 429 Rate Limit Prevention

**Caching System** prevents rate limits:

- 5-minute TTL means max 12 requests/hour per endpoint
- OpenF1 API rate limit: ~60 requests/hour (varies)
- Cache hit ratio typically >90% after initial page load

### Import/Export Validation

**Team Import Validation**:

```javascript
const isValidTeam = (team) => {
  return (
    team &&
    Array.isArray(team.drivers) &&
    team.drivers.length === 5 &&
    Array.isArray(team.constructors) &&
    team.constructors.length === 2 &&
    typeof team.turboDriver === "number"
  );
};
```

**CSV Import Validation**:

- Checks for valid number format
- Validates driver numbers exist
- Validates team names match known constructors
- Skips invalid lines with warning

### Missing Data Fallbacks

**Price Fallbacks**:

- Custom price → Default price → Generic fallback ($5M/$10M)

**Team Data Fallbacks**:

- Missing driver info → Show driver number only
- Missing team colors → Gray gradient

## Performance Optimizations

### 1. Caching Strategy

**5-minute localStorage cache**:

- Prevents redundant API calls
- Significantly reduces load times
- Enables offline-first experience

**Implementation**:

```javascript
const cacheKey = `f1_cache_${endpoint}_${hash(params)}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp < 5 * 60 * 1000) {
    return data; // Cache hit
  }
}
```

### 2. React Router Code Splitting

Vite automatically splits code by route:

- Each page component in separate chunk
- Lazy-loaded on navigation
- Reduces initial bundle size

### 3. Auto-Save Debouncing

Team selections use React's automatic batching:

- Multiple state updates batch into single save
- Reduces localStorage writes
- Improves perceived performance

### 4. Memoized Calculations

Price calculations only recompute when prices change:

- `getDriverPrice()` cached by React
- Budget calculations memoized
- Sorting pre-computed and stored in state

### 5. Efficient Sorting

Sorts performed once, stored in state:

```javascript
const sortedDrivers = useMemo(() => {
  return drivers.sort(
    (a, b) => getDriverPrice(b.driver_number) - getDriverPrice(a.driver_number),
  );
}, [drivers, customPrices]);
```

## Deployment Architecture

### Production Stack

```
[Client Browser]
      ↓ HTTPS
[Fly.io Proxy (SSL, Load Balancing, CDN)]
      ↓ HTTP/8080
[nginx Alpine Container]
      ↓
[React/Vite Static Files in /usr/share/nginx/html]
```

### Docker Multi-Stage Build

**Stage 1 - Builder** (~1GB):

- Node.js 20 Alpine base image
- Install dependencies with `npm ci`
- Build React/Vite app with `npm run build`
- Generate optimized static files in `dist/`
- Tree-shaking, minification, code-splitting

**Stage 2 - Production** (~30MB):

- nginx Alpine base image
- Copy built files from Stage 1 (`dist/` → `/usr/share/nginx/html`)
- Copy nginx configuration
- Expose port 8080
- Start nginx server

**Benefits**:

- Final image size: ~30MB (vs ~1GB+ for Node-based image)
- Faster deployments
- Lower bandwidth costs
- Better security (no build tools in production)

### nginx Configuration

**Key Features**:

- **SPA routing**: `try_files $uri $uri/ /index.html` - all routes serve index.html
- **Gzip compression**: Enabled for text-based assets
- **Static caching**: 1-year cache for immutable assets (JS, CSS, images)
- **Security headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **Health check**: `/health` endpoint for Fly.io monitoring

### Fly.io Configuration

**Auto-Scaling** (`fly.toml`):

```toml
[http_service]
  auto_stop_machines = true    # Stop when no traffic
  auto_start_machines = true   # Start on incoming requests
  min_machines_running = 1
  max_machines_running = 3
```

**Benefits**:

- Cost optimization (only pay for active time)
- Near-instant cold starts (<1s)
- Automatic geographic distribution

**Health Checks**:

- Interval: 30 seconds
- Timeout: 10 seconds
- Auto-restart on failure

## Security Considerations

### HTTPS/SSL

- Fly.io automatically provisions SSL certificates
- `force_https = true` redirects HTTP → HTTPS
- Certificates auto-renew (Let's Encrypt)

### Security Headers (nginx)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

**Protection Against**:

- Clickjacking (X-Frame-Options)
- MIME sniffing (X-Content-Type-Options)
- XSS attacks (X-XSS-Protection)

### Client-Side Storage Only

- All data stored in browser localStorage (client-side)
- No server-side database or storage
- No sensitive data transmitted to server
- No authentication or user accounts
- Privacy-focused: data never leaves user's device

### OpenF1 API

- Public API, no authentication required
- No sensitive data exposed
- Read-only access

## Testing & Development

### Development Server

```bash
npm run dev
```

- Vite dev server with HMR (Hot Module Replacement)
- Fast refresh on file changes
- Port: 3000 (or next available)
- Source maps enabled

### Production Preview

```bash
npm run build
npm run preview
```

- Build optimized production bundle
- Preview locally before deployment
- Same behavior as production

### Linting

```bash
npm run lint
```

- ESLint configuration (React + Hooks plugins)
- Catches common errors and anti-patterns

## External APIs & Data Sources

### OpenF1 API

**Base URL**: `https://api.openf1.org/v1`

**Endpoints Used**:

- `/drivers` - Driver information (name, number, team)
- `/meetings` - Race weekend information (location, dates)

**Rate Limits**:

- Approximately 60 requests/hour (unconfirmed)
- Mitigated by 5-minute caching strategy

**Data Freshness**:

- Drivers: Updated after each race
- Meetings: Updated at season start

## Future Enhancement Opportunities

### Potential Features

1. **Backend Integration**:
   - User accounts and authentication
   - Cloud sync across devices
   - Team sharing and leagues

2. **Live Data**:
   - Real-time race results
   - Live points calculation during races
   - Push notifications for race start

3. **Advanced Analytics**:
   - Historical performance trends
   - Win rate by driver/team
   - Budget efficiency metrics

4. **Social Features**:
   - Team leaderboards
   - Friend comparisons
   - Social sharing

5. **Mobile Apps**:
   - React Native mobile apps
   - Native push notifications
   - Offline-first functionality

### Technical Improvements

1. **Testing**:
   - Unit tests (Jest + React Testing Library)
   - E2E tests (Playwright/Cypress)
   - Visual regression tests

2. **Performance**:
   - Service Worker for offline support
   - IndexedDB for larger storage needs
   - Image optimization and WebP support

3. **Monitoring**:
   - Error tracking (Sentry)
   - Analytics (Plausible/Fathom)
   - Performance monitoring (Web Vitals)

---

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

For general project information, see [README.md](../README.md)
