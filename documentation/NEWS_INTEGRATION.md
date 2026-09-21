# News Integration for AI Predictions

Fantasy F1 integrates real-time F1 news and community discussions into the AI prediction engine, helping Claude make more informed recommendations about driver and team performance.

## Overview

When you generate predictions, the server automatically fetches recent articles from the enabled sources below and includes their headlines and summaries in the prompt sent to Claude AI:

| Source            | Type     | URL                                    | Max articles | Enabled by default? |
| ----------------- | -------- | -------------------------------------- | ------------ | -------------------- |
| Autosport         | RSS feed | https://www.autosport.com/rss/f1/news/ | 15           | Yes                   |
| The Race          | RSS feed | https://the-race.com/feed/             | 10           | Yes                   |
| Motorsport.com    | RSS feed | https://www.motorsport.com/rss/f1/news/| 5            | No                    |
| PlanetF1          | RSS feed | https://www.planetf1.com/feed/         | 10           | **No — see below**    |
| Reddit r/formula1 | JSON API | https://www.reddit.com/r/formula1.json | 10           | **No — see below**    |

**PlanetF1 and Reddit are disabled by default** (confirmed 2026-09-21):

- **PlanetF1** discontinued their RSS feed entirely — `planetf1.com/feed` now returns a WordPress `"No feed available"` 404, and there's no RSS autodiscovery link on their homepage to replace it with.
- **Reddit**'s public JSON API returns HTTP 403 for requests from hosting/datacenter IP ranges — confirmed even with a full browser `User-Agent`, so it's IP-based anti-scraping rather than something a header change fixes. It will keep failing from any cloud deployment (Fly.io included) without a registered, authenticated Reddit API app.

Both can be re-enabled (`NEWS_PLANETF1_ENABLED=true` / `NEWS_REDDIT_ENABLED=true`) if a working replacement feed or authenticated Reddit access becomes available.

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
         │                 ├── Autosport RSS
         │                 ├── The Race RSS
         │                 ├── Motorsport.com RSS (disabled by default)
         │                 ├── PlanetF1 RSS (disabled by default - feed discontinued)
         │                 └── Reddit JSON API (disabled by default - blocks datacenter IPs)
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

| Variable                       | Default | Description                                                    |
| ------------------------------ | ------- | ---------------------------------------------------------------|
| `NEWS_AUTOSPORT_ENABLED`       | `true`  | Enable/disable Autosport RSS (primary source)                  |
| `NEWS_THERACE_ENABLED`         | `true`  | Enable/disable The Race RSS                                    |
| `NEWS_PLANETF1_ENABLED`        | `false` | Enable/disable PlanetF1 RSS — off by default, feed discontinued|
| `NEWS_MOTORSPORT_ENABLED`      | `true`  | Enable/disable Motorsport.com RSS                               |
| `NEWS_REDDIT_ENABLED`          | `false` | Enable/disable Reddit r/formula1 — off by default, blocks datacenter IPs |
| `NEWS_MAX_ARTICLES_PER_SOURCE` | `10`    | Default max articles per source (Autosport uses 15)            |
| `NEWS_CACHE_TTL_MINUTES`       | `30`    | Server-side cache lifetime in minutes                           |

### Examples

Re-enable Reddit (disabled by default — only do this if you've set up authenticated Reddit API access, since the public JSON API blocks datacenter IPs):

```
NEWS_REDDIT_ENABLED=true
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
      "source": "Autosport",
      "title": "Verstappen leads first practice at Monaco",
      "url": "https://...",
      "summary": "Max Verstappen set the pace in FP1...",
      "published_at": "2025-05-22T10:30:00.000Z",
      "driver_mentions": ["Verstappen", "Leclerc"],
      "team_mentions": ["Red Bull", "Ferrari"]
    }
  ],
  "sources_attempted": [
    "Autosport",
    "The Race"
  ],
  "sources_succeeded": [
    "Autosport",
    "The Race"
  ],
  "sources_failed": [],
  "fetched_at": "2025-05-22T11:00:00.000Z",
  "cache_ttl_minutes": 30
}
```

(`sources_attempted` only lists the currently enabled sources — PlanetF1 and Reddit are omitted since they default to disabled; see [Configuration](#configuration).)

### `DELETE /api/news/cache`

Clears the server-side news cache, forcing a fresh fetch on the next request. Useful for testing or when you want immediate updates during a race weekend.

## Driver & Team Detection

News articles are automatically scanned for mentions of F1 drivers and teams. Detected entities are included in the `driver_mentions` and `team_mentions` fields, making it easy to see which articles are relevant to specific picks.

Detected drivers include all current and recent F1 drivers (Verstappen, Norris, Leclerc, Hamilton, etc.). Detected teams include all current constructors (McLaren, Ferrari, Red Bull, Mercedes, etc.).

## Rate Limiting & Terms of Service

- All requests include a descriptive `User-Agent` header identifying the app
- Requests time out after 8 seconds to avoid blocking the server
- Server-side caching ensures each source is only requested once per cache TTL
- The Reddit public JSON API requires no authentication, but is disabled by default here since it blocks requests from hosting/datacenter IPs regardless of headers
- RSS feeds are publicly available and intended for syndication
