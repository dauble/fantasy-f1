# News Integration for AI Predictions

Fantasy F1 integrates real-time F1 news and community discussions into the AI prediction engine, helping Claude make more informed recommendations about driver and team performance.

## Overview

When you generate predictions, the server automatically fetches recent articles from three sources and includes their headlines and summaries in the prompt sent to Claude AI:

| Source | Type | URL |
|---|---|---|
| PlanetF1 | RSS feed | https://www.planetf1.com/feed/ |
| Motorsport.com | RSS feed | https://www.motorsport.com/rss/f1/news/ |
| Reddit r/formula1 | JSON API | https://www.reddit.com/r/formula1/ |

## How News Data Influences Predictions

The news context is appended to the AI prompt alongside the race data from OpenF1. Claude considers:

- **Driver performance mentions** — injury reports, driver confidence, recent form commentary
- **Team technical updates** — car upgrades, setup changes, reliability concerns
- **Race/circuit previews** — expert analysis of which teams/drivers suit the upcoming circuit
- **Community sentiment** — popular discussion topics and sentiment from r/formula1
- **Breaking news** — last-minute changes (driver swaps, car damage from practice, etc.)

News articles are weighted by recency — items from the last 24 hours have the most influence, and only articles from the last 7 days are included.

## Architecture

```
Browser (React)
   └── aiPredictionService.js
         ├── fetchF1News()          ← src/services/newsService.js
         │     └── GET /api/news   ← server.js endpoint
         │           └── newsService.js (server-side)
         │                 ├── PlanetF1 RSS
         │                 ├── Motorsport.com RSS
         │                 └── Reddit JSON API
         └── buildUserMessage()    ← includes news context in Claude prompt
```

### Caching

- **Server-side**: In-memory cache (default: 30 minutes). Shared across all users.
- **Client-side**: `localStorage` cache (30 minutes). Per-browser.

This means news is fetched at most once per 30 minutes per server instance, respecting the rate limits of all sources.

### Error Handling

If any news source is unavailable:
- The server logs the error and continues with the other sources
- If **all** sources fail, predictions still work — news is optional context
- The client also gracefully falls back to predicting without news data

## Configuration

Set these in your `.env` file:

| Variable | Default | Description |
|---|---|---|
| `NEWS_PLANETF1_ENABLED` | `true` | Enable/disable PlanetF1 RSS |
| `NEWS_MOTORSPORT_ENABLED` | `true` | Enable/disable Motorsport.com RSS |
| `NEWS_REDDIT_ENABLED` | `true` | Enable/disable Reddit r/formula1 |
| `NEWS_MAX_ARTICLES_PER_SOURCE` | `10` | Maximum articles fetched per source |
| `NEWS_CACHE_TTL_MINUTES` | `30` | Server-side cache lifetime in minutes |

### Examples

Disable Reddit (e.g., if rate-limited):
```
NEWS_REDDIT_ENABLED=false
```

Fetch more articles per source for richer context:
```
NEWS_MAX_ARTICLES_PER_SOURCE=15
```

Refresh news more frequently (e.g., race weekends):
```
NEWS_CACHE_TTL_MINUTES=10
```

## API Endpoints

### `GET /api/news`

Returns the latest cached news data.

**Response:**
```json
{
  "articles": [
    {
      "source": "PlanetF1",
      "title": "Verstappen leads first practice at Monaco",
      "url": "https://...",
      "summary": "Max Verstappen set the pace in FP1...",
      "published_at": "2025-05-22T10:30:00.000Z",
      "driver_mentions": ["Verstappen", "Leclerc"],
      "team_mentions": ["Red Bull", "Ferrari"]
    }
  ],
  "sources_attempted": ["PlanetF1", "Motorsport.com", "Reddit r/formula1"],
  "sources_succeeded": ["PlanetF1", "Motorsport.com", "Reddit r/formula1"],
  "sources_failed": [],
  "fetched_at": "2025-05-22T11:00:00.000Z",
  "cache_ttl_minutes": 30
}
```

### `DELETE /api/news/cache`

Clears the server-side news cache, forcing a fresh fetch on the next request. Useful for testing or when you want immediate updates during a race weekend.

## Driver & Team Detection

News articles are automatically scanned for mentions of F1 drivers and teams. Detected entities are included in the `driver_mentions` and `team_mentions` fields, making it easy to see which articles are relevant to specific picks.

Detected drivers include all current and recent F1 drivers (Verstappen, Norris, Leclerc, Hamilton, etc.). Detected teams include all current constructors (McLaren, Ferrari, Red Bull, Mercedes, etc.).

## Rate Limiting & Terms of Service

- All requests include a descriptive `User-Agent` header identifying the app
- Requests time out after 8 seconds to avoid blocking the server
- Server-side caching ensures each source is only requested once per cache TTL
- The Reddit public JSON API is used (no authentication required, read-only)
- RSS feeds are publicly available and intended for syndication
