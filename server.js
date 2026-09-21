/**
 * server.js
 * Express server that:
 *  1. Proxies /api/predict → Anthropic API (keeps API key server-side)
 *  2. Serves the Vite production build as static files
 *  3. Falls back to index.html for client-side routing (React Router)
 *
 * Place in the project root alongside package.json.
 */

import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fetchF1News, clearNewsCache } from "./newsService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));

// ─── Security middleware ───────────────────────────────────────────────────────

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes before trying again." },
});

// ─── Anthropic proxy endpoint ─────────────────────────────────────────────────

app.post("/api/predict", rateLimiter, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Set it in your .env file or as an environment variable.");
    return res.status(500).json({
      error: "Server configuration error: API key not set. Please configure ANTHROPIC_API_KEY in your environment.",
    });
  }

  // Validate request body
  if (!req.body || !req.body.messages) {
    console.error("Invalid request body - missing messages array");
    return res.status(400).json({
      error: "Invalid request: missing messages array",
    });
  }

  // Log payload size for debugging (don't log sensitive content)
  const payloadSize = JSON.stringify(req.body).length;
  console.log(`[/api/predict] Request size: ${(payloadSize / 1024).toFixed(2)} KB`);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, JSON.stringify(data, null, 2));
      return res.status(anthropicRes.status).json({
        error: data?.error?.message || "Anthropic API error",
        details: data?.error?.type || "unknown",
      });
    }

    return res.json(data);
  } catch (err) {
    console.error("Proxy fetch error:", err.message);
    console.error("Stack:", err.stack);
    return res.status(502).json({ 
      error: "Failed to reach Anthropic API.",
      details: err.message 
    });
  }
});

// ─── Health check (used by Fly.io) ───────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Public runtime config (safe to expose — anon key is not a secret) ───────

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
});

// ─── Official F1 Fantasy price snapshots ─────────────────────────────────────
//
// data/price_snapshots.json is committed to the repo by the scheduled
// .github/workflows/refresh-fantasy-prices.yml workflow (fetches the public
// F1 Fantasy statistics feed daily). Ships with the deployed image, so it's
// available even though Fly's container disk isn't persistent. Returns an
// empty history gracefully if the file doesn't exist yet (e.g. before the
// workflow has ever run).

const PRICE_SNAPSHOTS_PATH = join(__dirname, "data", "price_snapshots.json");
const PRICE_HISTORY_LIMIT = 14;

app.get("/api/fantasy-prices", rateLimiter, async (_req, res) => {
  try {
    const raw = await readFile(PRICE_SNAPSHOTS_PATH, "utf-8");
    const snapshots = JSON.parse(raw);
    const history = snapshots.slice(-PRICE_HISTORY_LIMIT);
    const latest = history[history.length - 1] || null;
    return res.json({ latest, history });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ latest: null, history: [] });
    }
    console.error("[/api/fantasy-prices] Error reading price snapshots:", err.message);
    return res.status(500).json({ error: "Failed to read price snapshots", details: err.message });
  }
});

// ─── OpenF1 driver data (via Cloudflare Worker KV cache, with direct fallback) ─
//
// Rather than have every browser call OpenF1 directly for the current driver
// grid, the server pulls it once from here and serves all clients from a
// short in-memory cache. When CLOUDFLARE_WORKER_URL is set, that's the
// countdown-to-f1 project's Cloudflare Worker (documentation/CLOUDFLARE_WORKER.md
// there), which refreshes the same data daily into KV and already respects
// OpenF1's rate limits. Falls back to calling OpenF1 directly (still just one
// server-side call, not one per browser) if the Worker is unset or unreachable.

const DRIVERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let driversCache = { data: null, fetchedAt: 0 };

async function fetchDriversFromWorker() {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  if (!workerUrl) return null;

  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/drivers`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Worker /drivers returned ${res.status}`);
  const body = await res.json();
  if (!body.drivers) return null;

  // The Worker returns camelCase fields; normalize back to OpenF1's native
  // snake_case shape so callers don't care which path served the data.
  return body.drivers.map((d) => ({
    driver_number: d.driverNumber,
    full_name: d.fullName,
    name_acronym: d.abbreviation,
    team_name: d.teamName,
    team_colour: d.teamColour,
    headshot_url: d.headshotUrl,
    country_code: d.countryCode,
  }));
}

async function fetchDriversFromOpenF1() {
  const res = await fetch("https://api.openf1.org/v1/drivers?session_key=latest", {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`OpenF1 /drivers returned ${res.status}`);
  return res.json();
}

app.get("/api/openf1/drivers", rateLimiter, async (_req, res) => {
  if (driversCache.data && Date.now() - driversCache.fetchedAt < DRIVERS_CACHE_TTL_MS) {
    return res.json(driversCache.data);
  }

  try {
    const drivers = await fetchDriversFromWorker();
    if (drivers) {
      driversCache = { data: drivers, fetchedAt: Date.now() };
      return res.json(drivers);
    }
    throw new Error("Cloudflare Worker not configured");
  } catch (workerErr) {
    console.warn(`[/api/openf1/drivers] Worker unavailable (${workerErr.message}), falling back to OpenF1 directly`);
    try {
      const drivers = await fetchDriversFromOpenF1();
      driversCache = { data: drivers, fetchedAt: Date.now() };
      return res.json(drivers);
    } catch (openf1Err) {
      console.error(`[/api/openf1/drivers] OpenF1 fallback failed: ${openf1Err.message}`);
      if (driversCache.data) {
        return res.json(driversCache.data); // serve stale rather than nothing
      }
      return res.status(502).json({ error: "Failed to fetch driver data", details: openf1Err.message });
    }
  }
});

// ─── F1 News aggregation endpoint ────────────────────────────────────────────

app.get("/api/news", rateLimiter, async (_req, res) => {
  try {
    const newsData = await fetchF1News();
    return res.json(newsData);
  } catch (err) {
    console.error("News fetch error:", err.message);
    return res.status(502).json({
      error: "Failed to fetch F1 news.",
      details: err.message,
      articles: [],
      sources_attempted: [],
      sources_succeeded: [],
      sources_failed: [{ name: "all", error: err.message }],
      fetched_at: new Date().toISOString(),
    });
  }
});

app.delete("/api/news/cache", (_req, res) => {
  clearNewsCache();
  res.json({ ok: true, message: "News cache cleared" });
});

// ─── Serve Vite build ─────────────────────────────────────────────────────────

const DIST = join(__dirname, "dist");

app.use(rateLimiter, express.static(DIST));

// Fallback: send index.html for all non-API routes (React Router)
// Note: Express 5 doesn't support app.get("*") — use middleware instead
app.use(rateLimiter, (req, res) => {
  res.sendFile(join(DIST, "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const apiKey = process.env.ANTHROPIC_API_KEY;

createServer(app).listen(PORT, () => {
  console.log(`Fantasy F1 server running on port ${PORT}`);
  
  if (apiKey) {
    console.log(`✓ ANTHROPIC_API_KEY loaded (value present in environment)`);
  } else {
    console.warn(`⚠️  ANTHROPIC_API_KEY not found - AI predictions will not work`);
    console.warn(`   Add ANTHROPIC_API_KEY to your .env file`);
  }
});
