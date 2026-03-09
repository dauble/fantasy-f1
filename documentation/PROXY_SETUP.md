# AI Predictions Proxy — Setup Reference

⚠️ **Note**: This document is a quick reference. For complete setup instructions, see [AI_PREDICTIONS_SETUP.md](AI_PREDICTIONS_SETUP.md).

---

## Overview

The Fantasy F1 app uses an Express proxy server to keep the Anthropic API key secure. The key is never exposed to the client-side code.

## Architecture

```
Client (React/Vite) → POST /api/predict → Express Proxy → Anthropic API
```

## File Changes

| File                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `server.js`                           | Express server: proxies `/api/predict` → Anthropic, serves Vite build |
| `Dockerfile`                          | Updated to use Node/Express instead of nginx                          |
| `vite.config.js`                      | Proxies `/api` to Express during local dev                            |
| `src/services/aiPredictionService.js` | Calls `/api/predict` instead of Anthropic directly                    |
| `src/services/openf1DataService.js`   | Aggregates historical race data for AI                                |
| `src/pages/Predictions.jsx`           | AI-powered predictions UI                                             |

---

## Quick Start (Local Development)

**Terminal 1 — Express proxy server**

```bash
npm run server
```

_Runs on port 3000_

**Terminal 2 — Vite dev server**

```bash
npm run dev
```

_Runs on port 5173, proxies /api to Express_

**Open:** http://localhost:5173

---

## Environment Variables

### Local Development

Create `.env` in project root:

```bash
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

⚠️ Make sure `.env` is in `.gitignore`!

### Production (Fly.io)

Set as a Fly secret (never commit to source):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## Deployment

The Dockerfile:

1. Builds the Vite app (multi-stage build)
2. Copies build to `/dist`
3. Runs Express server with `node server.js`

Express serves:

- Static files from `/dist`
- API proxy at `/api/predict`

**No nginx needed** — Express handles everything!

---

## Package.json Scripts

Required scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "server": "node server.js",
    "build": "vite build",
    "deploy": "flyctl deploy"
  },
  "dependencies": {
    "express": "^5.2.1"
  }
}
```

---

## Complete Documentation

For detailed setup instructions, troubleshooting, and usage guides:

→ **[AI_PREDICTIONS_SETUP.md](AI_PREDICTIONS_SETUP.md)**
