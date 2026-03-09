/**
 * aiPredictionService.js
 * Sends aggregated OpenF1 data to Claude and returns structured Fantasy F1 picks.
 *
 * Drop this into: src/services/aiPredictionService.js
 *
 * SETUP: Add your Anthropic API key to your .env file:
 *   VITE_ANTHROPIC_API_KEY=your_key_here
 *
 * IMPORTANT: For production, proxy this through your own backend to
 * keep your API key secret. Never expose API keys in client-side code.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// ─── Fantasy F1 scoring rules (matches your app's rules) ─────────────────────

const SCORING_RULES = `
FANTASY F1 SCORING:
Race finishing: 1st=25, 2nd=18, 3rd=15, 4th=12, 5th=10, 6th=8, 7th=6, 8th=4, 9th=2, 10th=1
Qualifying: P1=10, P2=9, P3=8, P4=7, P5=6, P6=5, P7=4, P8=3, P9=2, P10=1
Bonuses: Fastest Lap=+5, Position Gained=+2 each, Beat Teammate (Qual)=+2, Beat Teammate (Race)=+3, Classified Finish=+1
Penalties: Position Lost=-2 each, Not Classified=-5, Disqualified=-20
Budget: $100M total — 5 drivers + 2 constructors
Turbo Driver: one driver scores 2x points
`.trim();

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Fantasy F1 analyst. You receive real historical race data from the OpenF1 API and produce data-driven team picks for the upcoming race.

${SCORING_RULES}

Your analysis must:
1. Weight recent form (last 1-2 races) more heavily than older results
2. Consider track type (street circuit, high-speed, technical) in your picks
3. Favor value picks (good points per dollar) over pure pace
4. Identify the best Turbo Driver (highest predicted points)
5. Recommend 2 constructors whose combined driver performance is strong

Return your response ONLY as valid JSON matching this exact schema — no preamble, no markdown fences:
{
  "analysis_summary": "2-3 sentence overview of key trends",
  "next_race_outlook": "1-2 sentences about the upcoming circuit characteristics",
  "recommended_drivers": [
    {
      "full_name": "string",
      "abbreviation": "string",
      "team_name": "string",
      "reasoning": "string (1-2 sentences)",
      "predicted_finish": number,
      "predicted_points": number,
      "confidence": "high" | "medium" | "low",
      "is_turbo_pick": boolean
    }
  ],
  "recommended_constructors": [
    {
      "team_name": "string",
      "reasoning": "string",
      "predicted_points": number,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "turbo_driver": "string (full_name of turbo pick)",
  "value_picks": ["string", "string"],
  "risks": ["string", "string"],
  "data_confidence": "high" | "medium" | "low",
  "data_note": "string (note if data was sparse or incomplete)"
}

Always return exactly 5 drivers and 2 constructors.`;

// ─── Main prediction function ─────────────────────────────────────────────────

/**
 * Calls Claude with the aggregated OpenF1 data payload and returns parsed picks.
 *
 * @param {Object} dataPayload - Output from buildPredictionPayload()
 * @param {string} apiKey - Anthropic API key (from env)
 * @returns {Object} Parsed prediction result
 */
export async function generatePredictions(dataPayload, apiKey) {
  if (!apiKey) {
    throw new Error(
      "Anthropic API key is missing. Set VITE_ANTHROPIC_API_KEY in your .env file."
    );
  }

  const userMessage = buildUserMessage(dataPayload);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API error: ${response.status} — ${err?.error?.message || "Unknown error"}`
    );
  }

  const data = await response.json();
  const rawText = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parsePredictionJSON(rawText, dataPayload);
}

// ─── Message builder ──────────────────────────────────────────────────────────

function buildUserMessage(payload) {
  const { next_race, recent_races, driver_trends, data_window } = payload;

  const nextRaceStr = next_race
    ? `UPCOMING RACE: ${next_race.name} at ${next_race.circuit}, ${next_race.country} on ${formatDate(next_race.date)}`
    : "UPCOMING RACE: Not yet announced (predict based on current trends)";

  const recentRacesStr = recent_races
    .map(
      (r, i) =>
        `Race ${i + 1}: ${r.race_name} (${r.country}) — Podium: ${r.podium.join(", ")}`
    )
    .join("\n");

  const driverStats = driver_trends
    .map((d) => {
      const trend = d.position_trend === true ? "↑improving" : d.position_trend === false ? "↓declining" : "→stable";
      return `  ${d.abbreviation.padEnd(4)} | ${d.full_name.padEnd(22)} | ${d.team_name.padEnd(18)} | Avg Pos: ${String(d.avg_finish_position).padEnd(5)} | Best: ${d.best_finish} | Recent: [${d.recent_positions.join(",")}] | ${trend} | Avg FL: ${d.avg_fastest_lap_ms ? (d.avg_fastest_lap_ms / 1000).toFixed(3) + "s" : "N/A"} | Avg Pits: ${d.avg_pit_stops}`;
    })
    .join("\n");

  return `${nextRaceStr}

DATA WINDOW: ${data_window}

RECENT RACE RESULTS:
${recentRacesStr}

DRIVER PERFORMANCE TRENDS (sorted by avg finish position):
${"─".repeat(110)}
  ABB  | Driver Name           | Team               | Avg Pos | Best | Recent Positions  | Trend      | Avg FL    | Avg Pits
${"─".repeat(110)}
${driverStats}
${"─".repeat(110)}

Based on this data, provide your Fantasy F1 team recommendation for the upcoming race. Return only valid JSON.`;
}

// ─── JSON parser with fallback ────────────────────────────────────────────────

function parsePredictionJSON(rawText, fallbackPayload) {
  // Strip any accidental markdown fences
  const clean = rawText.replace(/```json|```/gi, "").trim();

  try {
    const parsed = JSON.parse(clean);
    // Validate required fields
    if (!parsed.recommended_drivers || !parsed.recommended_constructors) {
      throw new Error("Missing required fields in AI response");
    }
    return { ...parsed, raw_data: fallbackPayload, generated_at: new Date().toISOString() };
  } catch (e) {
    console.error("Failed to parse AI prediction JSON:", e);
    // Return a structured error object so the UI can handle it gracefully
    return {
      error: true,
      error_message: `AI returned malformed JSON: ${e.message}`,
      raw_response: rawText,
      raw_data: fallbackPayload,
      recommended_drivers: [],
      recommended_constructors: [],
      analysis_summary: "Prediction failed — see error details.",
      generated_at: new Date().toISOString(),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Estimate total team cost based on driver trends.
 * Uses avg_finish_position as a rough proxy for price tier.
 * Replace with real price data from your PriceManager.
 */
export function estimateTeamCost(drivers, constructors, customPrices = {}) {
  // If you have customPrices from your PriceManager, use those
  // Otherwise this is a placeholder
  const driverCosts = drivers.reduce((sum, d) => {
    const price = customPrices[d.abbreviation] || 20;
    return sum + price;
  }, 0);
  const constructorCosts = constructors.reduce((sum, c) => {
    const price = customPrices[c.team_name] || 20;
    return sum + price;
  }, 0);
  return driverCosts + constructorCosts;
}
