/**
 * aiPredictionService.js  (updated for proxy)
 * Sends aggregated OpenF1 data to the local /api/predict proxy endpoint,
 * which forwards to Anthropic server-side — keeping the API key secret.
 *
 * src/services/aiPredictionService.js
 *
 * Dev setup: add this to vite.config.js so /api proxies to the Express server:
 *   server: { proxy: { '/api': 'http://localhost:3000' } }
 *
 * Production: Express serves both the React app and /api/predict on the same origin.
 * Set the secret with: fly secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

const PROXY_URL = "/api/predict";
const MODEL = "claude-sonnet-4-20250514";

const SCORING_RULES = `
FANTASY F1 SCORING:
Race finishing: 1st=25, 2nd=18, 3rd=15, 4th=12, 5th=10, 6th=8, 7th=6, 8th=4, 9th=2, 10th=1
Qualifying: P1=10, P2=9, P3=8, P4=7, P5=6, P6=5, P7=4, P8=3, P9=2, P10=1
Bonuses: Fastest Lap=+5, Position Gained=+2 each, Beat Teammate (Qual)=+2, Beat Teammate (Race)=+3, Classified Finish=+1
Penalties: Position Lost=-2 each, Not Classified=-5, Disqualified=-20
Budget: $100M total — 5 drivers + 2 constructors
Turbo Driver: one driver scores 2x points
`.trim();

const SYSTEM_PROMPT = `You are an expert Fantasy F1 analyst. You receive real historical race data from the OpenF1 API and produce data-driven team picks for the upcoming race.

${SCORING_RULES}

You also receive the user's current team selections, custom prices, and team history from their localStorage. Use this to:
1. Understand their budget constraints (custom prices affect the $100M budget)
2. Suggest improvements to their CURRENT team rather than starting from scratch
3. Respect their preferences while optimizing for points
4. Identify value picks based on their custom pricing
5. Note if they should swap drivers or keep their current selections

CRITICAL BUDGET RULE:
- The total cost of your recommended team (5 drivers + 2 constructors) MUST be ≤ $100M
- Each driver and constructor has a price shown in the data
- You MUST calculate the total cost and ensure it stays under budget
- If no custom prices exist, assume $20M per driver/constructor (7 × $20M = $140M would exceed budget)
- Prioritize value picks to maximize points within the budget constraint

Your analysis must:
1. Weight recent form (last 1-2 races) more heavily than older results
2. Consider track type (street circuit, high-speed, technical) in your picks
3. Favor value picks (good points per dollar) over pure pace
4. Identify the best Turbo Driver (highest predicted points)
5. Recommend 2 constructors whose combined driver performance is strong  
6. If the user has a current team, suggest whether to KEEP or SWAP each driver
7. **VERIFY the total cost is ≤ $100M before returning your recommendation**

Return your response ONLY as valid JSON matching this exact schema — no preamble, no markdown fences:
{
  "analysis_summary": "2-3 sentence overview of key trends and user's current team status",
  "next_race_outlook": "1-2 sentences about the upcoming circuit characteristics",
  "recommended_drivers": [
    {
      "full_name": "string",
      "abbreviation": "string",
      "team_name": "string",
      "reasoning": "string (1-2 sentences, mention if this is a KEEP or SWAP from current team)",
      "predicted_finish": number,
      "predicted_points": number,
      "confidence": "high" | "medium" | "low",
      "is_turbo_pick": boolean
    }
  ],
  "recommended_constructors": [
    {
      "team_name": "string",
      "reasoning": "string (mention if this is from current team or a swap)",
      "predicted_points": number,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "turbo_driver": "string (full_name of turbo pick)",
  "value_picks": ["string", "string"],
  "risks": ["string", "string"],
  "total_cost": number (sum of all 5 drivers + 2 constructors in millions),
  "budget_remaining": number (100 minus total_cost),
  "budget_analysis": "string (confirm team is under $100M and note remaining budget)",
  "data_confidence": "high" | "medium" | "low",
  "data_note": "string (note if data was sparse or incomplete)"
}

Always return exactly 5 drivers and 2 constructors. The total_cost MUST be ≤ 100.`;

/**
 * Calls /api/predict (Express proxy) with the aggregated OpenF1 data payload.
 * No API key needed in the client — it lives server-side in an env variable.
 *
 * @param {Object} dataPayload - Output from buildPredictionPayload()
 * @returns {Object} Parsed prediction result
 */
export async function generatePredictions(dataPayload) {
  const userMessage = buildUserMessage(dataPayload);

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      
      // Better error messages based on status code
      if (response.status === 500 && err.error?.includes("API key")) {
        throw new Error(
          "Server configuration error: ANTHROPIC_API_KEY not set. " +
          "Please add your API key to the .env file or server environment."
        );
      }
      
      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please wait a few minutes before trying again."
        );
      }
      
      throw new Error(
        `Prediction error (${response.status}): ${err?.error || err?.details || "Unknown error"}`
      );
    }

    const data = await response.json();
    const rawText = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return parsePredictionJSON(rawText, dataPayload);
  } catch (error) {
    // Re-throw with context if it's a network error
    if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Network error: Could not connect to the prediction service. " +
        "Make sure the server is running on port 3000."
      );
    }
    throw error;
  }
}

function buildUserMessage(payload) {
  const { next_race, recent_races, driver_trends, user_context, data_window } = payload;

  const nextRaceStr = next_race
    ? `UPCOMING RACE: ${next_race.name} at ${next_race.circuit}, ${next_race.country} on ${formatDate(next_race.date)}`
    : "UPCOMING RACE: Not yet announced (predict based on current trends)";

  const recentRacesStr = recent_races
    .map((r, i) => `Race ${i + 1}: ${r.race_name} (${r.country}) — Podium: ${r.podium.join(", ")}`)
    .join("\n");

  const driverStats = driver_trends
    .map((d) => {
      const trend =
        d.position_trend === true ? "↑improving"
        : d.position_trend === false ? "↓declining"
        : "→stable";
      const price = d.price ? `$${d.price}M` : "$20M";
      return `  ${d.abbreviation.padEnd(4)} | ${d.full_name.padEnd(22)} | ${d.team_name.padEnd(18)} | Price: ${price.padEnd(6)} | Avg Pos: ${String(d.avg_finish_position).padEnd(5)} | Best: ${d.best_finish} | Recent: [${d.recent_positions.join(",")}] | ${trend} | Avg FL: ${d.avg_fastest_lap_ms ? (d.avg_fastest_lap_ms / 1000).toFixed(3) + "s" : "N/A"} | Avg Pits: ${d.avg_pit_stops}`;
    })
    .join("\n");

  // Build user context section
  let userContextStr = "\n\nUSER'S CURRENT CONTEXT:\n";
  
  if (user_context?.current_team) {
    const team = user_context.current_team;
    userContextStr += `\nCurrent Team (as of ${formatDate(team.lastSaved)}):\n`;
    if (team.drivers && team.drivers.length > 0) {
      userContextStr += `  Drivers: ${team.drivers.map(d => d.full_name || d.name).join(", ")}\n`;
    }
    if (team.constructors && team.constructors.length > 0) {
      userContextStr += `  Constructors: ${team.constructors.map(c => c.team_name || c.name).join(", ")}\n`;
    }
    if (team.turboDriver) {
      userContextStr += `  Turbo Driver: ${team.turboDriver.full_name || team.turboDriver.name}\n`;
    }
    if (team.totalCost !== undefined) {
      userContextStr += `  Total Cost: $${team.totalCost}M / $100M\n`;
    }
  } else {
    userContextStr += "  No current team saved (new user or fresh start)\n";
  }

  if (user_context?.custom_prices) {
    const prices = user_context.custom_prices;
    userContextStr += `\nCustom Prices (last updated ${formatDate(prices.lastUpdated)}):\n`;
    userContextStr += "  Note: Prices are shown in the driver table above.\n";
    
    // Show constructor prices explicitly since they're not in driver trends
    if (prices.constructors && Object.keys(prices.constructors).length > 0) {
      userContextStr += `\nCONSTRUCTOR PRICES:\n`;
      Object.entries(prices.constructors)
        .sort((a, b) => a[1] - b[1]) // Sort by price
        .forEach(([name, price]) => {
          userContextStr += `  ${name.padEnd(25)} = $${price}M\n`;
        });
    }
  } else {
    userContextStr += "  Using default prices ($20M per driver/constructor)\n";
    userContextStr += "  WARNING: With default pricing, you cannot afford all top drivers!\n";
  }

  if (user_context?.team_history && user_context.team_history.length > 0) {
    userContextStr += `\nTeam History:\n`;
    userContextStr += `  User has saved ${user_context.team_history.length} previous teams\n`;
    userContextStr += `  Most recent: ${user_context.team_history[0].week || 'Week unknown'}\n`;
  }

  return `${nextRaceStr}

DATA WINDOW: ${data_window}

RECENT RACE RESULTS:
${recentRacesStr}

DRIVER PERFORMANCE TRENDS (sorted by avg finish position):
${"─".repeat(130)}
  ABB  | Driver Name           | Team               | Price  | Avg Pos | Best | Recent Positions  | Trend      | Avg FL    | Avg Pits
${"─".repeat(130)}
${driverStats}
${"─".repeat(130)}
${userContextStr}

REMINDER: Your recommended team (5 drivers + 2 constructors) MUST cost ≤ $100M total.
Calculate the sum carefully and include total_cost and budget_remaining in your response.

Based on this data AND the user's current team/budget, provide your Fantasy F1 team recommendation for the upcoming race. Return only valid JSON.`;
}

function parsePredictionJSON(rawText, fallbackPayload) {
  const clean = rawText.replace(/```json|```/gi, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (!parsed.recommended_drivers || !parsed.recommended_constructors) {
      throw new Error("Missing required fields in AI response");
    }
    return { ...parsed, raw_data: fallbackPayload, generated_at: new Date().toISOString() };
  } catch (e) {
    console.error("Failed to parse AI prediction JSON:", e);
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

function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function estimateTeamCost(drivers, constructors, customPrices = {}) {
  const driverCosts = drivers.reduce((sum, d) => sum + (customPrices[d.abbreviation] || 20), 0);
  const constructorCosts = constructors.reduce((sum, c) => sum + (customPrices[c.team_name] || 20), 0);
  return driverCosts + constructorCosts;
}
