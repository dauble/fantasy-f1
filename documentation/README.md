# Fantasy F1 Documentation

Complete documentation for the Fantasy F1 Team Builder & Predictor application.

## Documentation Index

### [ARCHITECTURE.md](ARCHITECTURE.md)

**Complete technical documentation** covering the application's architecture, systems, and implementation details:

- Project structure and file organization
- Core systems (API caching, team persistence, pricing, setup flow)
- Page-level operations and component architecture
- Data flow and localStorage schema
- Styling, design system, and responsive patterns
- Error handling and performance optimizations
- AI predictions system (Express proxy, data aggregation)
- Express proxy server architecture
- Production deployment architecture (Docker, Node/Express, Fly.io)
- Security considerations
- Future enhancement opportunities

**Target Audience**: Developers, contributors, and technical stakeholders

### [DEPLOYMENT.md](DEPLOYMENT.md)

**Step-by-step deployment guide** for hosting the application on Fly.io:

- Prerequisites and initial setup
- Fly.io account and CLI installation
- App creation and configuration
- Deployment process and commands
- Continuous deployment with GitHub Actions
- Monitoring, logging, and debugging
- Scaling and resource management
- Custom domain setup
- Troubleshooting common issues
- Complete command reference

**Target Audience**: DevOps engineers, developers deploying the app

### [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md)

**GitHub Actions CI/CD setup guide** for automatic deployments:

- Quick setup steps (5 minutes)
- Getting and configuring Fly.io API token
- Adding secrets to GitHub repository
- How the workflow operates
- Troubleshooting deployment issues
- Optional configurations (branch deployments, PR previews)
- Security best practices

### [NEWS_INTEGRATION.md](NEWS_INTEGRATION.md)

**News aggregation system** feeding real-time F1 articles into the AI predictions engine:

- Supported sources: Autosport, The Race, PlanetF1, Reddit r/formula1
- Server-side and client-side caching (30-minute TTL)
- Configuration via environment variables
- API endpoint reference (`GET /api/news`)
- Driver & team entity detection

**Target Audience**: Developers customising or debugging the news pipeline

### [AI_PREDICTIONS_SETUP.md](AI_PREDICTIONS_SETUP.md)

**AI-powered predictions feature setup** using Claude (Anthropic):

- Overview of AI predictions architecture
- Getting an Anthropic API key
- Environment variable configuration (local & production)
- Running the development environment (Express + Vite)
- How the AI predictions work (data flow)
- API costs and rate limiting
- Troubleshooting common issues (404s, no data, API errors)
- Production deployment with secrets
- Security notes and best practices

### [PROXY_SETUP.md](PROXY_SETUP.md)

**Quick reference guide** for Express proxy server setup:

- Overview of proxy architecture
- File changes and purposes
- Quick start commands
- Environment variable setup
- Deployment notes
- Links to complete AI predictions documentation

**Target Audience**: Developers needing quick proxy setup reference

## Quick Links

- **[Main README](../README.md)** - Project overview, features, and getting started
- **[GitHub Repository](https://github.com/dauble/fantasy-f1)** - Source code
- **[Fly.io Dashboard](https://fly.io/dashboard)** - Deployment management
- **[OpenF1 API Docs](https://openf1.org/)** - Data source documentation

## Application Overview

Fantasy F1 is a modern React/Vite application for building and managing Fantasy Formula 1 teams with:

- **Budget Management**: $100M budget constraint
- **Team Building**: Select 5 drivers + 2 constructors
- **Price Management**: Custom pricing with weekly updates
- **Team History**: Save and restore teams for each race week
- **AI Predictions**: Claude-powered team recommendations with news context and 4-layer caching
- **Cloud Sync**: Supabase auth + bidirectional sync across devices
- **Dark Mode**: System-quality light/dark theme persisted per user
- **Rules Reference**: Complete Fantasy F1 scoring guide

## Tech Stack Summary

| Component          | Technology                         |
| ------------------ | ---------------------------------- |
| Frontend Framework | React 19.2.0                       |
| Build Tool         | Vite 7.3.1                         |
| Styling            | Tailwind CSS 3 (`darkMode: class`) |
| Routing            | React Router DOM 7.13.1            |
| HTTP Client        | Axios 1.13.6                       |
| Icons              | Heroicons 2.2.0                    |
| Auth & Cloud Sync  | Supabase (@supabase/supabase-js 2) |
| Data Source        | OpenF1 API                         |
| AI Service         | Anthropic Claude                   |
| Proxy Server       | Express 5.2.1                      |
| Dev Process Mgmt   | Concurrently                       |
| Deployment         | Fly.io (Docker + Node/Express)     |
| Storage            | localStorage + Supabase            |

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### Production Deployment

```bash
# Build production bundle
npm run build

# Preview locally
npm run preview

# Deploy to Fly.io
npm run deploy
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

## Key Concepts

### Client-Side Storage

All data (teams, prices, cache) stored in browser localStorage. No server-side database. Privacy-focused approach.

### 5-Minute API Caching

Intelligent caching prevents rate limiting from OpenF1 API. Cache hit ratio typically >90% after initial load.

### Auto-Save Teams

Team selections automatically saved as you build. No manual save button required for current team.

### Custom Pricing

Weekly price updates override defaults. Change tracking shows arrows (↑/↓) and percentages.

### First-Time Setup

Welcome modal on first visit encourages price updates. Optional skip, never shown again.

## File Organization

```
documentation/
├── README.md           # This file - documentation index
├── ARCHITECTURE.md     # Technical documentation
├── DEPLOYMENT.md       # Deployment guide
└── GITHUB_ACTIONS.md   # CI/CD setup guide
```

## Contributing

Contributions welcome! When contributing:

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the codebase
2. Follow existing code style and patterns
3. Test locally before committing
4. Update documentation for new features

## Getting Help

- **Issues**: Check existing GitHub issues or create a new one
- **Questions**: Review documentation first, then open a discussion
- **Deployment**: See [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section

---

**Last Updated**: March 8, 2026  
**Version**: 1.0.0
