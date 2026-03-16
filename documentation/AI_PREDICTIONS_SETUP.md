# AI Predictions Setup Guide

## Overview

The AI Predictions feature uses Claude (Anthropic) to analyze historical F1 race data and generate intelligent team recommendations. It integrates with your existing Fantasy F1 app and requires:

1. **OpenF1 API**: Historical race data (free, no key required)
2. **Anthropic API**: Claude AI for predictions (requires API key)
3. **Express Server**: Proxy server to keep API key secure

## Architecture

```
Frontend (React/Vite)
    ↓
    POST /api/predict
    ↓
Express Proxy Server
    ↓
Anthropic API (Claude)
```

## Setup Instructions

### 1. Get an Anthropic API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com/)
2. Navigate to API Keys section
3. Create a new API key (starts with `sk-ant-`)
4. Copy the key - you'll need it in the next step

### 2. Configure Environment Variables

**For Local Development:**

Create a `.env` file in the project root:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here

# Required for Auth & Cloud Sync
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Important**: Make sure `.env` is in your `.gitignore` to avoid committing secrets!

**For Production (Fly.io):**

Set the secret on Fly.io (API key never goes into source code):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

### 3. Run the Development Environment

The app requires **two processes** running simultaneously:

**Terminal 1 - Start the Express proxy server:**

```bash
npm run server
```

This starts the Express server on port 3000, which:

- Proxies `/api/predict` requests to Anthropic
- Serves the production build (in production mode)
- Handles rate limiting

**Terminal 2 - Start the Vite dev server:**

```bash
npm run dev
```

This starts the Vite dev server on port 5173, which:

- Serves your React app with hot reload
- Proxies `/api` requests to Express (configured in vite.config.js)

**Then open:** http://localhost:5173

### 4. Using the AI Predictions

1. Navigate to the **Predictions** page
2. Select data window (3 or 5 recent races)
3. Click "Generate Predictions"
4. Wait ~15-25 seconds for AI analysis (step-by-step progress is shown)
5. Review recommendations:
   - 5 recommended drivers with reasoning
   - 2 recommended constructors
   - Turbo driver suggestion
   - Value picks and risk assessments
   - Transfer warning banner shows the point penalty if the recommendation differs from your saved team
   - Team Assessment card gives a per-pick verdict (Keep / Transfer) when you have a team saved
6. Optionally click **Apply & Save Team** to replace your active team in one click — your previous team is automatically backed up to Team History with a unique ID so it can be restored at any time

> **Cross-device sync**: When you're logged in, the generated prediction is automatically saved to your Supabase profile. Opening the Predictions page on a second device will load the cached result from the cloud instead of calling Claude again. Applying a recommendation also syncs your updated team and Team History snapshots to the cloud immediately.

## How It Works

### Data Flow

1. **Frontend** (`Predictions.jsx`):
   - User clicks "Generate Predictions"
   - Calls `buildPredictionPayload()` from `openf1DataService.js`

2. **Data Service** (`openf1DataService.js`):
   - Fetches last N races from OpenF1 API (4-layer cache prevents redundant calls)
   - Builds driver statistics (avg position, trends, pace)
   - Also detects whether a race weekend is currently active (`getCurrentRaceSession`)
   - Aggregates data into AI-friendly payload

2.5. **News Fetch** (`aiPredictionService.js` → `/api/news`):

- Fetches recent F1 articles from Autosport, The Race, PlanetF1, and Reddit
- Cached server-side for 30 minutes; cached client-side in localStorage
- Headlines and summaries are appended to the Claude prompt for contextual awareness

3. **AI Service** (`aiPredictionService.js`):
   - Sends payload to `/api/predict` endpoint
   - Includes system prompt with Fantasy F1 scoring rules

4. **Express Proxy** (`server.js`):
   - Receives request at `/api/predict`
   - Forwards to Anthropic API with secure API key
   - Returns Claude's predictions

5. **Frontend Display**:
   - Shows recommended drivers/constructors
   - Highlights turbo pick and value selections
   - Displays reasoning for each pick

### API Costs

**Anthropic Pricing** (as of 2024):

- Claude Sonnet: ~$3 per million input tokens
- Each prediction uses ~5,000-10,000 tokens
- Cost per prediction: ~$0.02-0.05

**Rate Limits:**

- Express server: 60 predictions per IP per 15 minutes
- Anthropic: Depends on your API tier

## Troubleshooting

### "No historical race data available"

**Problem**: OpenF1 API has no completed races for current season

**Solution**:

- The OpenF1 API may not have data for the current F1 season yet
- It typically has data for 2023 and earlier (as of the API's current state)
- The service will automatically search multiple years (current, previous, 2024, 2023)
- If no data is found, you'll see this error message

**Workaround**:

- Wait for the current F1 season to have completed races
- The feature will automatically work once races are completed and data is available

### "Server configuration error: API key not set"

**Problem**: Express server can't find `ANTHROPIC_API_KEY`

**Solution**:

1. Check `.env` file exists in project root
2. Verify the variable name is exactly `ANTHROPIC_API_KEY`
3. Restart the Express server (`Ctrl+C` then `npm run server`)

### "Failed to reach Anthropic API"

**Problem**: Network or API key issue

**Solutions**:

1. Verify your API key is valid at console.anthropic.com
2. Check your internet connection
3. Look at Express server logs for details:
   ```bash
   npm run server
   ```

### Vite can't connect to Express

**Problem**: `/api` requests fail with network errors

**Solutions**:

1. Ensure Express server is running (`npm run server`)
2. Check `vite.config.js` has proxy configuration:
   ```js
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:3000',
         changeOrigin: true,
       },
     },
   }
   ```
3. Express should be on port 3000, Vite on port 5173

### OpenF1 API 404 Errors (Fixed)

**Problem**: Original version used wrong parameter names

**Solution**: ✅ Fixed in updated `openf1DataService.js`

- Now uses correct OpenF1 API structure
- Queries meetings first, then sessions
- Handles "No results found" gracefully
- Falls back across multiple years

## Production Deployment

### Fly.io Setup

1. **Set the API key secret:**

   ```bash
   fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key
   ```

2. **Deploy:**

   ```bash
   npm run deploy
   ```

3. **Monitor logs:**
   ```bash
   fly logs
   ```

The Dockerfile is configured to:

- Build the Vite app in a build stage
- Run the Express server in production
- Express serves both the static build AND the `/api` proxy
- No nginx needed - all handled by Express

### Environment Variables in Production

- `ANTHROPIC_API_KEY`: Set via `fly secrets set` (required)
- `SUPABASE_URL`: Set via `fly secrets set` (required for auth)
- `SUPABASE_ANON_KEY`: Set via `fly secrets set` (required for auth)
- `PORT`: Automatically set by Fly.io (default: 3000)

## Security Notes

### API Key Protection

✅ **DO**:

- Store in `.env` for local development
- Use `fly secrets` for production
- Keep `.env` in `.gitignore`
- Use Express proxy (keeps key server-side)

❌ **DON'T**:

- Commit API keys to git
- Expose key in frontend code
- Share your `.env` file
- Use `VITE_` prefix (makes it public!)

### Rate Limiting

The Express server includes basic rate limiting:

- 60 requests per IP per 15 minutes
- Prevents abuse and controls costs
- Adjust in `server.js` if needed:
  ```js
  const RATE_LIMIT = 60;
  const RATE_WINDOW_MS = 15 * 60 * 1000;
  ```

## File Structure

```
fantasy-f1/
├── server.js                          # Express proxy server
├── vite.config.js                     # Vite with /api proxy config
├── .env                               # Local API key (git-ignored)
├── src/
│   ├── pages/
│   │   └── Predictions.jsx            # AI predictions page
│   └── services/
│       ├── openF1API.js               # Original API service (still used by other pages)
│       ├── openf1DataService.js       # Historical data aggregator (AI predictions)
│       └── aiPredictionService.js     # Anthropic API client
└── documentation/
    └── AI_PREDICTIONS_SETUP.md        # This guide
```

## Testing

1. **Build succeeds:**

   ```bash
   npm run build
   ```

2. **Server starts:**

   ```bash
   npm run server
   # Should see: "Fantasy F1 server running on port 3000"
   ```

3. **Dev mode works:**

   ```bash
   npm run dev
   # Visit http://localhost:5173
   # Navigate to Predictions page
   # Generate predictions
   ```

4. **API responds:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"ok"}
   ```

## Support

If you encounter issues:

1. Check Express server logs for detailed error messages
2. Verify OpenF1 API status at [openf1.org](https://openf1.org)
3. Check Anthropic API status at [status.anthropic.com](https://status.anthropic.com)
4. Review browser console for frontend errors
5. Ensure both servers (Express + Vite) are running in dev mode
