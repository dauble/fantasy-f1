# Changelog

All notable changes to Fantasy F1 are documented here.

---

## Version 0.7- 2026-03-14 - Predictions Polish, Sync & News

> Unreleased — working branch `feat/updates`

### Predictions Page

- Redesigned Predictions page to match application style (container layout, standard page header, Card components)
- Upgraded all font sizes from `text-xs` to readable `text-sm`/`text-base` throughout
- Added full light/dark mode support to every element on the page (was hardcoded dark-only)
- DriverCard and ConstructorCard now use `bg-white dark:bg-gray-800` with proper contrast
- Status badges (High/Medium/Low confidence) now render correctly in both light and dark mode
- Loading, Error, and Empty states redesigned using Card components with proper contrast
- Analysis summary, value picks, and risks now displayed in a Card with larger readable text
- Section headings upgraded from `text-xs uppercase` to `text-lg font-bold`
- Added current race weekend detection — shows a pulsing green "Current Race" indicator when a race is live
- Added next race display below current race in the page header
- AI Predictions are now synced to user profile via Supabase (`ai_prediction` column) — no redundant Claude API calls across devices

### Authentication & Sync

- Fixed login not appearing on local development — `SUPABASE_ANON_KEY` env var name was mismatched
- Added `SUPABASE_ANON_KEY` alias to `.env` to match what `server.js` reads

### News Sources

- Replaced Formula1.com RSS (retired/404) with Autosport (15 articles, primary source)
- Added The Race as a second primary news source (10 articles)
- `.env` updated with `NEWS_AUTOSPORT_ENABLED` and `NEWS_THERACE_ENABLED` flags

### Dark Mode — WCAG AAA Fixes (PriceManager & Rules)

- All `text-gray-400/500/600` on dark backgrounds upgraded to `text-gray-200/300` (7:1+ contrast ratio)
- Coloured info panels (yellow, green, red, blue, purple) now have `dark:bg-{color}-900/30` equivalents
- All coloured text labels upgraded to high-contrast dark variants (`-300`/`-100` series)

---

## Version 0.6 - 2026-03-12 - Dark Mode & Cross-Device Sync

> Commit `36717fc` — Add step-by-step progress messages to prediction loading state

- Added step-by-step progress log during AI prediction generation (real-time feedback during 15–25s Claude call)
- Dark mode toggle added to sidebar footer (🌙/☀️), persisted to Supabase `user_metadata` per profile
- `tailwind.config.js` updated to `darkMode: 'class'`
- `Card.jsx` updated with `dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100` variants
- `Layout.jsx` updated with dark backgrounds (`dark:bg-gray-950` root, `dark:bg-gray-900` main)
- `AuthContext.jsx` extended with `theme`/`setTheme`, bidirectional sync (`syncBidirectional`), `pullNow` helper, and visibility-change auto-pull after 5+ minutes hidden
- `AuthButton.jsx` updated — sync button now labelled "Sync ⇅"
- Fixed cross-device sync not loading saved data — sync was push-only; now bidirectional on login and tab refocus

---

## Version 0.5 - 2026-03-11 - News Integration & AI Improvements

> Commits `8ea5962`, `c2c2ac6` (PR #3) — Real-time F1 news integration

- Added real-time F1 news aggregation from PlanetF1, Motorsport.com, and Reddit r/formula1 into the AI prediction context
- `newsService.js` introduced server-side with in-memory cache (configurable TTL), graceful per-source degradation, and F1 entity mention extraction
- Formula1.com RSS added as primary news source (15 articles); Motorsport.com reduced to supplementary (5 articles)
- Per-source `maxArticles` limit added to `SOURCES` config
- Price display rounding fixed — `.toFixed(2)` applied to `total_cost` and `budget_remaining` in `aiPredictionService.js` (was showing e.g. `$97.39999999999999M`)
- Duplicate React key warning fixed — `race_name` now uses `circuit_short_name || country_name || session_name` instead of always `"Race"`
- `Predictions.jsx` key updated to `race.session_key ?? race.race_name ?? i`

---

## Version 0.4 - 2026-03-10 - Rate Limiting & Caching Overhaul

> Commit `4a04ee5` — Fix AI prediction service, caching and rate limiting

- 4-layer caching system introduced in `openf1DataService.js`:
  - Layer 1: Raw API responses (24h TTL)
  - Layer 2: Per-session stats (7 days TTL)
  - Layer 3: Inter-meeting delay to avoid OpenF1 rate limits
  - Layer 4: Full prediction payload (4h TTL)
- Price unit mismatch fixed — prices stored as raw dollars (e.g. `28700000`) were being compared against `BUDGET=100` (millions); fixed by dividing by `1_000_000` at read in `openf1DataService.js` and `aiPredictionService.js`
- Dynamic next-race detection introduced — replaced hardcoded Chinese GP fallback with live OpenF1 meeting/session lookup

---

## Version 0.3 - 2026-03-09 - AI Predictions v2 & Auth

> Commits `d133f1c`, `f2ae220`, `7d1c83b`, `13ff24a`, `61bb1cf`, `13b6945`, merges from PR #2

- Predictions reworked to feed AI the full driver and constructor grid (not just top picks)
- Model prompt tightened for more consistent JSON output
- Google OAuth removed; email/password auth added via Supabase
- OAuth provider login installed to enable cloud data persistence across devices
- Inter-meeting delay introduced to OpenF1 caching to reduce 429 rate limit errors
- `openf1DataService.js`, `server.js`, `Dockerfile`, `Predictions.jsx` updated across multiple commits in PR #2

---

## Version 0.2 - 2026-03-08 - AI Predictions & Deployment

> Commits `0b6166d`, `b44787a`, `ef5a2eb`, `590d814`, `f8d9979`, `68e7711` (PR #1), `8af1d8d`, `9f445e0`, `da93c28`

- Initial AI-powered predictions feature via Claude + OpenF1 API
- `aiPredictionService.js` introduced — calls Claude via Express proxy with race data payload
- `openf1DataService.js` introduced — fetches recent race sessions, driver stats, and next race from OpenF1
- `strategyAnalyzer.js` added for basic team strategy analysis
- Express server (`server.js`) set up as API proxy (Anthropic, OpenF1, config endpoint)
- Fly.io deployment files added (`fly.toml`, `Dockerfile`, `nginx.conf`)
- GitHub Actions deployment workflow added
- `README.md` updated

---

## Version 0.1 - 2026-03-08 - Initial Commit

> Commit `06079be`

- Initial project scaffold — React 18 + Vite + Tailwind CSS
- Core pages: TeamBuilder, TeamHistory, PriceManager, Rules, LivePricingGuide
- Components: DriverCard, ConstructorCard, Card, LoadingSkeleton, WelcomeModal
- `openF1API.js` service layer
- `cache.js`, `pricing.js`, `priceStorage.js`, `teamStorage.js` utilities
