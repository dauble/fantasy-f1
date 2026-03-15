# Fantasy F1 Team Builder & Predictor

A modern React application for building and managing your Fantasy Formula 1 team, with AI-powered predictions, cloud sync across devices, and full dark mode.

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

### 🤖 AI-Powered Predictions

- **Claude AI Integration**: Intelligent team recommendations powered by Anthropic's Claude
- **Full Grid Analysis**: Every driver and constructor ranked — not just a shortlist
- **Real-time News Context**: Articles from Autosport, The Race, PlanetF1, and Reddit feed into the AI prompt
- **4-Layer Caching**: Most visits need zero OpenF1 API calls
- **Cross-Device Sync**: Cached predictions sync to your Supabase profile so Device B reuses Device A's result
- **Smart Recommendations**: 5 drivers + 2 constructors optimised for predicted points within $100M
- **Turbo Driver Suggestions**: AI identifies the best turbo pick based on recent form
- **Value Analysis**: Highlights drivers with the best points-per-dollar ratio
- **Confidence Ratings**: Each recommendation includes confidence level (high/medium/low)
- **Current Race Detection**: Automatically detects an ongoing race weekend and shows it in the header
- **Step-by-step Progress**: Real-time loading log shows exactly what the AI is analysing

### 👤 User Accounts & Cloud Sync

- **Email Authentication**: Sign up and log in with email/password via Supabase Auth
- **Cloud Sync**: Team, prices, history, and AI predictions stored in Supabase and synced across devices
- **Bidirectional Sync**: Logging in pulls the latest data from the cloud; changes push automatically every 60 seconds
- **Auto-Pull on Return**: If you've had the tab hidden for 5+ minutes, data is refreshed automatically on refocus
- **Manual Sync**: "Sync ⇅" button for on-demand sync
- **Theme Persistence**: Dark/light mode preference saved to your profile

### 🌙 Dark Mode

- **System-quality dark theme** covering all pages and components
- **Toggle in sidebar** (🌙/☀️) — persisted per-user to Supabase profile
- **WCAG 2.2 AA+** contrast ratios throughout

### 📋 Rules & Scoring

- **Complete Scoring System**: All Fantasy F1 point categories explained
- **Strategy Tips**: Pro tips for building winning teams
- **Chip Strategies**: How to use Turbo Driver and other power-ups
- **Official Links**: Direct access to Fantasy F1 official resources

## Tech Stack

- **React 19** — Modern UI library
- **Vite 7** — Lightning-fast build tool
- **Tailwind CSS 3** — Utility-first styling with `darkMode: 'class'`
- **React Router 7** — Client-side routing
- **Supabase** — Auth, cloud storage, and profile sync
- **Axios** — HTTP client for API requests
- **Heroicons** — SVG icon library
- **Express 5** — API proxy server (AI predictions, news, config)
- **Concurrently** — Runs Vite and Express together during development

## Data Source

This application uses the [OpenF1 API](https://openf1.org/) which provides:

- Real-time and historical F1 data
- Driver information and statistics
- Session data and results
- Official F1 timing data

### API Caching — 4-Layer System

To prevent rate limiting (429 errors) from the OpenF1 API, the app uses a 4-layer cache:

| Layer | What's cached            | TTL      |
| ----- | ------------------------ | -------- |
| 1     | Raw OpenF1 API responses | 24 hours |
| 2     | Per-session driver stats | 7 days   |
| 3     | Inter-meeting delay      | —        |
| 4     | Full prediction payload  | 4 hours  |

Most page loads require **zero** OpenF1 API calls. Use **Refresh Predictions** to bypass all layers and force a fresh fetch.

### Cloud Sync (Supabase)

When logged in, the following data is stored in Supabase and synced across devices:

- Current team selection
- Custom prices
- Team history
- Price history
- AI predictions (avoids redundant Claude API calls on second device)
- Dark/light theme preference (stored in `user_metadata`)

**Sync behaviour**:

- Pulls on login
- Pushes every 60 seconds automatically
- Bidirectional sync on the "Sync ⇅" button
- Auto-pulls when tab returns to focus after 5+ minutes hidden

### Local Storage

All data is also persisted locally so the app works without an account:

| Key                        | Contents                                |
| -------------------------- | --------------------------------------- |
| `fantasy_f1_current_team`  | Active team selections                  |
| `fantasy_f1_teams_history` | Up to 20 saved historical teams         |
| `fantasy_f1_custom_prices` | Current custom price values             |
| `fantasy_f1_price_history` | Historical price snapshots (up to 10)   |
| `fantasy_f1_ai_prediction` | Latest AI prediction + raw data payload |
| `fantasy_f1_theme`         | `'light'` or `'dark'`                   |

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
- A [Supabase](https://supabase.com/) project (free tier is sufficient) — for auth and cloud sync
- An [Anthropic API key](https://console.anthropic.com/) — for AI predictions

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```bash
# Required for AI Predictions
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Required for Auth & Cloud Sync
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

3. Start the development servers:

```bash
npm run dev
```

This starts the Express server (port 3000) and Vite (port 5173) concurrently.

4. Open your browser and navigate to:

```
http://localhost:5173
```

> **Note**: Both servers must be running for login and AI predictions to work. The Vite dev server proxies `/api` requests to Express (configured in `vite.config.js`).

### Running Servers Individually

```bash
# Express API server only (AI predictions, auth config, news)
npm run server

# Vite dev server only (requires Express also running for /api calls)
npm run dev:client
```

See [documentation/AI_PREDICTIONS_SETUP.md](documentation/AI_PREDICTIONS_SETUP.md) for complete setup instructions.

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

- `npm run dev` - Start both Express server (port 3000) and Vite dev server (port 5173) concurrently
- `npm run dev:server` - Start Express proxy server only (port 3000)
- `npm run dev:client` - Start Vite development server only (port 5173)
- `npm run server` - Start Express proxy server for AI predictions (port 3000)
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally
- `npm run deploy` - Deploy to Fly.io (requires setup)
- `npm run lint` - Run ESLint

## Documentation

Comprehensive technical documentation is available in the [`documentation/`](documentation/) folder:

- **[Architecture Guide](documentation/ARCHITECTURE.md)** — Complete technical documentation covering:
  - Project structure and core systems
  - API & caching layer implementation
  - Cloud sync & auth system
  - AI predictions system
  - Data flow and localStorage schema
  - Component architecture and styling

- **[News Integration Guide](documentation/NEWS_INTEGRATION.md)** — Coverage of the server-side news aggregation system (Autosport, The Race, PlanetF1, Reddit)

- **[Deployment Guide](documentation/DEPLOYMENT.md)** — Step-by-step instructions for deploying to Fly.io:
  - Prerequisites and initial setup
  - Configuration and deployment process
  - Monitoring, scaling, and troubleshooting
  - Custom domain setup

## Deployment

This application is deployed on [Fly.io](https://fly.io) with automatic SSL, CDN, and global distribution.

### Manual Deployment

**Quick Start**:

1. Install Fly CLI: `brew install flyctl`
2. Login: `flyctl auth login`
3. Create app: `flyctl apps create your-app-name`
4. Deploy: `npm run deploy` (or `flyctl deploy`)
5. Open: `flyctl open`

### Automated Deployment (CI/CD)

The repository includes **GitHub Actions** for automatic deployments:

- **Trigger**: Push to `main` branch
- **Action**: Automatically deploys to Fly.io
- **Setup**: Add `FLY_API_TOKEN` secret to your GitHub repository settings

Get your token: `flyctl auth token`

Every push to `main` triggers a deployment automatically! ✨

Your app will be live at `https://your-app-name.fly.dev` 🚀

For complete deployment instructions, CI/CD setup, troubleshooting, and advanced configuration, see the **[Deployment Guide](documentation/DEPLOYMENT.md)**.

## Acknowledgments

- [OpenF1](https://openf1.org/) for providing the F1 data API
- [Formula 1](https://www.formula1.com/) for the official Fantasy F1 game
- [dauble/f1-stats](https://github.com/dauble/f1-stats) for UI inspiration and design patterns

## Disclaimer

This is an unofficial Fantasy F1 tool and is not affiliated with or endorsed by Formula 1, FOM, or any F1 teams.

---

Built with ❤️ for F1 fans by F1 fans
