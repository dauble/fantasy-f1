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
- `npm run deploy` - Deploy to Fly.io (requires Fly CLI)

## Documentation

Comprehensive technical documentation is available in the [`documentation/`](documentation/) folder:

- **[Architecture Guide](documentation/ARCHITECTURE.md)** - Complete technical documentation covering:
  - Project structure and core systems
  - API & caching layer implementation
  - Team persistence and pricing systems
  - Data flow and localStorage schema
  - Component architecture and styling
  - Performance optimizations and error handling

- **[Deployment Guide](documentation/DEPLOYMENT.md)** - Step-by-step instructions for deploying to Fly.io:
  - Prerequisites and initial setup
  - Configuration and deployment process
  - Monitoring, scaling, and troubleshooting
  - Custom domain setup

## Deployment

This application is deployed on [Fly.io](https://fly.io) with automatic SSL, CDN, and global distribution.

**Quick Start**:

1. Install Fly CLI: `brew install flyctl`
2. Login: `flyctl auth login`
3. Create app: `flyctl apps create your-app-name`
4. Deploy: `npm run deploy` (or `flyctl deploy`)
5. Open: `flyctl open`

Your app will be live at `https://your-app-name.fly.dev` 🚀

For complete deployment instructions, troubleshooting, and advanced configuration, see the **[Deployment Guide](documentation/DEPLOYMENT.md)**.

## Acknowledgments

- [OpenF1](https://openf1.org/) for providing the F1 data API
- [Formula 1](https://www.formula1.com/) for the official Fantasy F1 game
- [dauble/f1-stats](https://github.com/dauble/f1-stats) for UI inspiration and design patterns

## Disclaimer

This is an unofficial Fantasy F1 tool and is not affiliated with or endorsed by Formula 1, FOM, or any F1 teams.

---

Built with ❤️ for F1 fans by F1 fans
