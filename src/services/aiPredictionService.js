/**
 * aiPredictionService.js
 *
 * Key design: budget enforcement is done in JavaScript, not by the AI.
 * 1. computeOptimalTeam() brute-forces all valid 5-driver + 2-constructor
 *    combinations and finds the highest-scoring one ≤ $100M.
 * 2. That guaranteed-valid team is sent to the AI as the starting point.
 * 3. The AI's job is to validate/refine it using race context — not arithmetic.
 * 4. parsePredictionJSON() validates the AI's response against the price map;
 *    if the AI still exceeds $100M, the pre-computed team is substituted.
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

You also receive the user's current team selections, custom prices, and team history. Use this to:
1. Understand their budget constraints (custom prices affect the $100M budget)
2. Suggest improvements to their CURRENT team rather than starting from scratch
3. Respect their preferences while optimizing for points
4. Identify value picks based on their custom pricing
5. Note if they should swap drivers or keep their current selections

BUDGET RULE (already enforced before you receive this):
- A pre-computed budget-valid team is provided in each request — its total cost is already verified ≤ $100M
- You may suggest ONE swap from that team only if the replacement improves predicted points AND keeps the total ≤ $100M
- Use ONLY the prices from the PRICE REFERENCE table — do not invent prices
- The total_cost and budget_remaining fields in your JSON MUST be consistent with the PRICE REFERENCE prices

Your analysis must:
1. Weight recent form (last 1-2 races) more heavily than older results
2. Consider track type (street circuit, high-speed, technical) in your picks
3. Favor value picks (good points per dollar) over pure pace
4. Identify the best Turbo Driver (highest predicted points)
5. Recommend 2 constructors whose combined driver performance is strong
6. If the user has a current team, suggest whether to KEEP or SWAP each driver
7. Only suggest a swap from the pre-computed team if you can verify the new total stays ≤ $100M

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
  "total_cost": number,
  "budget_remaining": number,
  "budget_analysis": "string (confirm team is under $100M and note remaining budget)",
  "data_confidence": "high" | "medium" | "low",
  "data_note": "string (note if data was sparse or incomplete)"
}

Always return exactly 5 drivers and 2 constructors.`;

// ─── Budget optimizer ─────────────────────────────────────────────────────────

/**
 * Evaluates all valid combinations of 5 drivers + 2 constructors within $100M
 * and returns the highest-scoring one.
 *
 * Scoring: lower avg finish position = higher score; recent improvement adds
 * a small bonus. Constructor score = average of its drivers' scores.
 *
 * @param {Array} driverTrends - from buildPredictionPayload, each with .price
 * @param {Object} constructorPriceMap - { team_name: price }
 * @returns {{ drivers, constructors, total_cost, budget_remaining } | null}
 */
function computeOptimalTeam(driverTrends, constructorPriceMap) {
  const BUDGET = 100;

  const drivers = driverTrends
    .filter(d => typeof d.price === 'number' && d.price > 0)
    .map(d => ({
      ...d,
      score: (21 - d.avg_finish_position)
           + (d.position_trend === true  ?  2 : 0)
           + (d.position_trend === false ? -1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15); // Top 15 keeps the loop fast (C(15,5) = 3,003)

  const constructors = Object.entries(constructorPriceMap).map(([name, price]) => {
    const teamDrivers = driverTrends.filter(d => d.team_name === name);
    const avgScore = teamDrivers.length
      ? teamDrivers.reduce((s, d) => s + (21 - d.avg_finish_position), 0) / teamDrivers.length
      : 5;
    return { team_name: name, price, score: avgScore };
  });

  if (drivers.length < 5 || constructors.length < 2) return null;

  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < drivers.length - 4; i++)
  for (let j = i + 1; j < drivers.length - 3; j++)
  for (let k = j + 1; k < drivers.length - 2; k++)
  for (let l = k + 1; l < drivers.length - 1; l++)
  for (let m = l + 1; m < drivers.length; m++) {
    const d = [drivers[i], drivers[j], drivers[k], drivers[l], drivers[m]];
    const dCost = d[0].price + d[1].price + d[2].price + d[3].price + d[4].price;
    if (dCost >= BUDGET) continue; // Need at least $1 left for cheapest 2 constructors

    for (let ci = 0; ci < constructors.length - 1; ci++)
    for (let cj = ci + 1; cj < constructors.length; cj++) {
      const c = [constructors[ci], constructors[cj]];
      const total = dCost + c[0].price + c[1].price;
      if (total > BUDGET) continue;

      const score = d.reduce((s, x) => s + x.score, 0)
                  + c.reduce((s, x) => s + x.score, 0);
      if (score > bestScore) {
        bestScore = score;
        best = {
          drivers: d,
          constructors: c,
          total_cost: total,
          budget_remaining: BUDGET - total,
        };
      }
    }
  }

  return best;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePredictions(dataPayload) {
  // Build constructor price map from user's localStorage prices
  const constructorPriceMap = {};
  if (dataPayload.user_context?.custom_prices?.constructors) {
    Object.assign(constructorPriceMap, dataPayload.user_context.custom_prices.constructors);
  }

  // Pre-compute the budget-valid optimal team in JavaScript
  const optimalTeam = computeOptimalTeam(dataPayload.driver_trends, constructorPriceMap);

  const userMessage = buildUserMessage(dataPayload, constructorPriceMap, optimalTeam);

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

      if (response.status === 500 && err.error?.includes("API key")) {
        throw new Error(
          "Server configuration error: ANTHROPIC_API_KEY not set. " +
          "Please add your API key to the .env file or server environment."
        );
      }
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a few minutes before trying again.");
      }
      throw new Error(
        `Prediction error (${response.status}): ${err?.error || err?.details || "Unknown error"}`
      );
    }

    const data = await response.json();
    const rawText = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Build a price lookup for the validator: abbrev → price and team → price
    const driverPriceMap = {};
    dataPayload.driver_trends.forEach(d => { driverPriceMap[d.abbreviation] = d.price ?? 20; });

    return parsePredictionJSON(rawText, dataPayload, driverPriceMap, constructorPriceMap, optimalTeam);
  } catch (error) {
    if (error.message.includes("Failed to fetch")) {
      throw new Error(
        "Network error: Could not connect to the prediction service. " +
        "Make sure the server is running on port 3000."
      );
    }
    throw error;
  }
}

// ─── User message builder ─────────────────────────────────────────────────────

function buildUserMessage(payload, constructorPriceMap, optimalTeam) {
  const { next_race, recent_races, driver_trends, user_context, data_window } = payload;

  const nextRaceStr = next_race
    ? `UPCOMING RACE: ${next_race.name} at ${next_race.circuit}, ${next_race.country} on ${formatDate(next_race.date)}`
    : "UPCOMING RACE: Not yet announced (predict based on current trends)";

  const recentRacesStr = recent_races
    .map((r, i) => `Race ${i + 1}: ${r.race_name} (${r.country}) — Podium: ${r.podium.join(", ")}`)
    .join("\n");

  // Price lookup (already merged into driver_trends by openf1DataService)
  const driverPriceMap = {};
  driver_trends.forEach(d => { driverPriceMap[d.abbreviation] = d.price ?? 20; });

  const driverStats = driver_trends
    .map(d => {
      const trend = d.position_trend === true  ? "↑improving"
                  : d.position_trend === false ? "↓declining"
                  : "→stable";
      return `  ${d.abbreviation.padEnd(4)} | ${d.full_name.padEnd(22)} | ${d.team_name.padEnd(18)} | $${String(driverPriceMap[d.abbreviation]).padEnd(5)}M | Avg Pos: ${String(d.avg_finish_position).padEnd(5)} | Best: ${d.best_finish} | Recent: [${d.recent_positions.join(",")}] | ${trend} | Avg FL: ${d.avg_fastest_lap_ms ? (d.avg_fastest_lap_ms / 1000).toFixed(3) + "s" : "N/A"} | Avg Pits: ${d.avg_pit_stops}`;
    })
    .join("\n");

  // Price reference tables (sorted descending)
  const driverPriceTable = [...driver_trends]
    .sort((a, b) => (b.price ?? 20) - (a.price ?? 20))
    .map(d => `  ${d.abbreviation.padEnd(4)}  ${d.full_name.padEnd(26)} $${driverPriceMap[d.abbreviation]}M`)
    .join("\n");

  const constructorPriceTable = Object.keys(constructorPriceMap).length > 0
    ? Object.entries(constructorPriceMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, price]) => `  ${name.padEnd(30)} $${price}M`)
        .join("\n")
    : "  (No constructor prices set — constructors cannot be reliably priced)";

  // Pre-computed optimal team section
  let optimalTeamSection;
  if (optimalTeam) {
    const driverLines = optimalTeam.drivers
      .map(d => `  ${d.abbreviation.padEnd(4)}  ${d.full_name.padEnd(26)} $${d.price}M`)
      .join("\n");
    const constLines = optimalTeam.constructors
      .map(c => `  ${c.team_name.padEnd(30)} $${c.price}M`)
      .join("\n");
    optimalTeamSection = `Drivers (5):
${driverLines}
Constructors (2):
${constLines}
  ─────────────────────────────────────────────────────
  TOTAL COST:          $${optimalTeam.total_cost}M
  BUDGET REMAINING:    $${optimalTeam.budget_remaining}M`;
  } else {
    optimalTeamSection = `  Could not compute a valid team — prices may be missing or all $20M defaults
  (7 × $20M = $140M, which exceeds budget). Please set custom prices in the app.`;
  }

  // User's current team
  let currentTeamStr = "";
  if (user_context?.current_team) {
    const team = user_context.current_team;
    currentTeamStr = `\nUSER'S CURRENT TEAM (as of ${formatDate(team.lastSaved)}):\n`;
    if (team.drivers?.length > 0)
      currentTeamStr += `  Drivers:      ${team.drivers.map(d => d.full_name || d.name).join(", ")}\n`;
    if (team.constructors?.length > 0)
      currentTeamStr += `  Constructors: ${team.constructors.map(c => c.team_name || c.name).join(", ")}\n`;
    if (team.turboDriver)
      currentTeamStr += `  Turbo Driver: ${team.turboDriver.full_name || team.turboDriver.name}\n`;
    if (team.totalCost !== undefined)
      currentTeamStr += `  Current cost: $${team.totalCost}M / $100M\n`;
  }
  if (user_context?.team_history?.length > 0) {
    currentTeamStr += `  Previous teams saved: ${user_context.team_history.length}\n`;
  }

  return `${nextRaceStr}

DATA WINDOW: ${data_window}

RECENT RACE RESULTS:
${recentRacesStr}

DRIVER PERFORMANCE TRENDS (sorted by avg finish position):
${"─".repeat(140)}
  ABB  | Driver Name           | Team               | Price   | Avg Pos | Best | Recent Positions  | Trend      | Avg FL    | Avg Pits
${"─".repeat(140)}
${driverStats}
${"─".repeat(140)}
${currentTeamStr}
════════════════════════════════════════════════════════
PRICE REFERENCE — USE THESE EXACT PRICES
════════════════════════════════════════════════════════
DRIVER PRICES (descending):
${driverPriceTable}

CONSTRUCTOR PRICES (descending):
${constructorPriceTable}
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
PRE-COMPUTED OPTIMAL TEAM (JavaScript-verified ≤ $100M)
════════════════════════════════════════════════════════
${optimalTeamSection}

This team was selected by evaluating every valid combination of 5 drivers and
2 constructors from the prices above. It is GUARANTEED to be within budget.

YOUR TASK:
1. Use the race data to validate whether this pre-computed team makes sense.
2. You may suggest ONE swap only if:
     a) the replacement improves predicted points based on recent data, AND
     b) you verify the new total using prices from the PRICE REFERENCE table (≤ $100M)
3. If no better validated swap exists, recommend this exact team.
4. Set total_cost and budget_remaining in your JSON using the PRICE REFERENCE prices.
════════════════════════════════════════════════════════

Return only valid JSON.`;
}

// ─── Response parser + budget validator ───────────────────────────────────────

function parsePredictionJSON(rawText, fallbackPayload, driverPriceMap, constructorPriceMap, optimalTeam) {
  const clean = rawText.replace(/```json|```/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
    if (!parsed.recommended_drivers || !parsed.recommended_constructors) {
      throw new Error("Missing required fields in AI response");
    }
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

  // Validate budget using the actual price maps (not the AI's self-reported total)
  const driverCost = parsed.recommended_drivers.reduce((sum, d) => {
    const price = driverPriceMap[d.abbreviation];
    return sum + (typeof price === 'number' ? price : 20);
  }, 0);
  const constructorCost = parsed.recommended_constructors.reduce((sum, c) => {
    const price = constructorPriceMap[c.team_name];
    return sum + (typeof price === 'number' ? price : 20);
  }, 0);
  const verifiedTotal = driverCost + constructorCost;

  if (verifiedTotal > 100 && optimalTeam) {
    // AI exceeded budget — substitute the pre-computed team
    console.warn(`AI recommendation exceeded budget ($${verifiedTotal}M). Substituting pre-computed team ($${optimalTeam.total_cost}M).`);

    parsed.recommended_drivers = optimalTeam.drivers.map(d => ({
      full_name: d.full_name,
      abbreviation: d.abbreviation,
      team_name: d.team_name,
      reasoning: `Selected by budget optimizer (AI pick exceeded $100M). Strong recent form with avg finish P${d.avg_finish_position}.`,
      predicted_finish: Math.round(d.avg_finish_position),
      predicted_points: Math.max(1, 26 - Math.round(d.avg_finish_position)),
      confidence: "medium",
      is_turbo_pick: false,
    }));
    // Mark the best driver as turbo
    parsed.recommended_drivers[0].is_turbo_pick = true;
    parsed.turbo_driver = parsed.recommended_drivers[0].full_name;

    parsed.recommended_constructors = optimalTeam.constructors.map(c => ({
      team_name: c.team_name,
      reasoning: `Selected by budget optimizer (AI pick exceeded $100M).`,
      predicted_points: Math.round(c.score * 3),
      confidence: "medium",
    }));

    parsed.total_cost = optimalTeam.total_cost;
    parsed.budget_remaining = optimalTeam.budget_remaining;
    parsed.budget_analysis = `AI recommendation exceeded $100M ($${verifiedTotal}M). Substituted with pre-computed optimal team at $${optimalTeam.total_cost}M ($${optimalTeam.budget_remaining}M remaining).`;
  } else {
    // AI stayed within budget — correct the total_cost field to reflect verified math
    parsed.total_cost = verifiedTotal;
    parsed.budget_remaining = 100 - verifiedTotal;
  }

  return { ...parsed, raw_data: fallbackPayload, generated_at: new Date().toISOString() };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
