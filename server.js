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
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));

// ─── Security middleware ───────────────────────────────────────────────────────

// Basic rate limiting — 60 prediction requests per IP per 15 minutes
const requestCounts = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  // Prune stale entries so the requestCounts map does not grow without bound.
  for (const [key, value] of requestCounts) {
    if (now - value.windowStart > RATE_WINDOW_MS) {
      requestCounts.delete(key);
    }
  }
  const entry = requestCounts.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }

  requestCounts.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({
      error: "Too many requests. Please wait a few minutes before trying again.",
    });
  }
  next();
}

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

// ─── Serve Vite build ─────────────────────────────────────────────────────────

const DIST = join(__dirname, "dist");
app.use(express.static(DIST));

// Fallback: send index.html for all non-API routes (React Router)
// Note: Express 5 doesn't support app.get("*") — use middleware instead
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
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
