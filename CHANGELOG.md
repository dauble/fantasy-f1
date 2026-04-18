# Changelog

All notable changes to Fantasy F1 are documented here.

---

## Version 0.9.0 - 2026-04-18 - One-Click Team Application & Security Updates

> Commit `fc68cb5` — working branch `feat/create-team`

### UI — One-Click Team Update from Prediction

- New one-click workflow to apply the AI-recommended team directly from the Predictions page
- Automatically backs up the current team to Team History before replacing it with the AI pick
- Confirmation banner replaces the apply button after the team is saved, linking to Team History for easy review or rollback

### Security

- Resolved 7 dependency vulnerabilities (3 moderate, 4 high) via `npm audit fix`:
  - `axios`: NO_PROXY hostname normalisation bypass and cloud metadata exfiltration via header injection
  - `brace-expansion`: zero-step sequence causing process hang and memory exhaustion
  - `flatted`: prototype pollution via `parse()` in Node.js
  - `follow-redirects`: custom authentication headers leaked to cross-domain redirect targets
  - `path-to-regexp`: ReDoS via sequential optional groups and multiple wildcards
  - `picomatch`: method injection in POSIX character classes and ReDoS via extglob quantifiers
  - `vite`: path traversal in optimised deps `.map` handling, `server.fs.deny` bypass, and arbitrary file read via dev server WebSocket

---

## Version 0.8.1 - 2026-04-18 - Hotfix: Env Var & AI Prediction

> Commit `6f36187` — merged from `hotfix/env-var` (PR #9)

### Bug Fixes

- Fixed pull request environment variable misconfiguration causing lookup failures
- Fixed AI prediction service returning incorrect or no results in certain conditions

---

## Version 0.8.0 - 2026-03-15 - Smart Sync, Transfer Penalties, Team Assessment & Documentation Refresh

> Commit `HEAD` — working branch `feat/ai-enhancements`

### AI — Team Assessment & Transfer Advice

- Claude now evaluates **every pick in the user's current team** and produces a per-pick verdict (`keep` / `transfer`) with one-sentence reasoning for each, factoring in circuit fit, recent form, and whether a swap justifies the -30 pt penalty
- New `team_verdict` field (`"keep"` / `"partial"` / `"transfer"`) gives an overall headline recommendation
- New `current_team_assessment` array in the AI response carries `identifier`, `type`, `verdict`, `reason`, and `suggested_alternative` for each current pick
- Both fields forwarded through `parsePredictionJSON` and surfaced in the result object
- Driver names in the current-team prompt note now include abbreviations in parentheses for exact Claude matching

### AI — Practice Session Data Integration

- New `getPracticeDataForUpcomingRace()` in `openf1DataService.js` fetches completed FP1/FP2/FP3 classifications for the active race weekend
- Looks for any meeting within a ±6-day window; 2-hour cache TTL per meeting so each session completion is picked up automatically
- Practice top-10 tables injected into the Claude prompt so circuit-specific pace informs rankings and team assessment
- Loading progress messages: "Found N completed practice sessions — included in analysis" / "No practice data yet this weekend"
- `practice_data` passed alongside the prediction payload; `buildUserMessage` formats it into the driver ranking context

### Transfer Penalty Awareness

- **Transfer penalties now factored into team optimisation** — `computeOptimalTeam` deducts 30 pts per driver or constructor change when a current team is saved; the algorithm only recommends a swap when the expected gain exceeds the cost
- Added local `TRANSFER_PENALTY_PTS = 30` constant in `aiPredictionService.js` to keep optimisation logic self-contained (no import from `src/config/api.js`)
- `parsePredictionJSON` and `buildFallbackResult` both pass `currentTeam` to the optimizer
- Result object now exposes a `transfers` count and `budget_analysis` reports the penalty (e.g. _"— 2 transfers from current team (-60 pts penalty)"_)
- Fixed driver name resolution in `buildUserMessage`: current team is stored as `selectedDrivers` / `selectedConstructors` objects, so the prompt now derives names directly from those objects (rather than assuming driver numbers) to avoid `undefined` entries
- Claude prompt updated: transfer rule included in `SCORING_RULES` and `SYSTEM_PROMPT` so analysis commentary can flag whether keeping current picks is worth it vs. paying the penalty

### UI — Apply & Save Team (`Predictions.jsx`)

- New **Apply & Save Team** button appears at the top of the results view once a prediction completes
- One click: backs up the current team to Team History (GUID key via `crypto.randomUUID()`) then replaces the active team with the AI recommendation
- Backup label includes the race name (e.g. _"Pre-AI snapshot – Australian GP"_) so old lineups are easy to identify in Team History and can be restored at any time
- After applying, the button is replaced with a green confirmation banner linking directly to Team History
- `teamStorage.saveBackupToHistory(label)` helper added to `teamStorage.js` — saves the current team as a history entry with a unique UUID and `source: 'ai_backup'` tag, trimming history to the last 20 entries

### UI — Team Assessment Card (`Predictions.jsx`)

- New `TeamAssessmentCard` component renders below the transfer warning banner when a current team is saved
- Overall verdict banner styled green / amber / red with plain-English description
- Per-pick rows: ✅ Keep or 🔄 with suggested replacement abbreviation/name, plus Claude's reasoning sentence for each

### UI — Transfer Warning Banner (`Predictions.jsx`)

- New `TransferWarning` component renders above the AI Analysis card after predictions load
- Shows an **amber warning** listing each new driver and constructor with the total point penalty when transfers are required
- Shows a **green confirmation** badge when the recommendation matches the current team exactly (no penalty)
- Includes a tip reminding users that picks were already chosen for their net value after penalties, and that the Wildcard chip removes transfer costs

### Rules Page (`Rules.jsx`)

- Added **🔄 Transfers & Penalties** card between "Chips & Power-ups" and "Strategy Tips"
- Lists the -30 pt per change rule, the break-even threshold (new pick must score 30+ more pts), and the Wildcard escape hatch
- Callout box notes that AI predictions already account for transfer costs

### Sync Improvements

- Replaced blind push-every-60s with `smartSync` — fetches the cloud's `updated_at` timestamp before deciding whether to push or pull
- If cloud is newer than local (another device made changes): **pull from cloud**
- If local is current or newer: **push to cloud**
- `pullFromCloud` now also captures the cloud's `updated_at` into `fantasy_f1_sync_meta` so the next cycle has an accurate baseline
- `syncToCloud` records `lastSyncedAt` in `fantasy_f1_sync_meta` after every successful push
- Tab-refocus handler now calls `smartSync` instead of unconditional `pullFromCloud`
- "Sync ⇅" button (`syncBidirectional`) delegates to `smartSync` for the same reason
- Login still performs a full `pullFromCloud` — cloud is always trusted on a fresh session

### Documentation

- Updated all six documentation files to reflect current application state:
  - `README.md`: new tech stack entries, cloud sync section, dark mode section, corrected caching table, updated getting-started steps
  - `documentation/ARCHITECTURE.md`: added project-tree entries for `newsService.js`, `CHANGELOG.md`, `AuthContext.jsx`, `AuthButton.jsx`, `NEWS_INTEGRATION.md`; added Section 5 (Cloud Sync & Auth System); updated AI Predictions section (4-layer cache, news step, current race detection, sync after generation); corrected Layout section (AuthButton, dark mode toggle)
  - `documentation/AI_PREDICTIONS_SETUP.md`: added Supabase env vars, corrected loading time to 15–25s, added news-fetch step to data flow, added cross-device sync callout
  - `documentation/NEWS_INTEGRATION.md`: replaced Motorsport.com source with Autosport + The Race; updated config table and architecture diagram
  - `documentation/PROXY_SETUP.md`: expanded architecture to show all three endpoints (`/api/predict`, `/api/config`, `/api/news`); added Supabase env vars
  - `documentation/README.md`: added `NEWS_INTEGRATION.md` to the index; updated Application Overview and Tech Stack table

---

## Version 0.7.0 - 2026-03-14 - Predictions Polish, Sync & News

> Commit `main` — merged from `feat/updates`

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
