/**
 * aiPredictionService.js
 *
 * Design: clear separation of concerns.
 *
 *   JavaScript   → picks the optimal 5-driver + 2-constructor team
 *                  by scoring all valid combinations within the $100M budget
 *
 *   Claude AI    → receives that pre-selected team and the race data,
 *                  and provides qualitative analysis ONLY:
 *                  reasoning, predicted points, confidence, turbo pick, risks
 *
 * The AI never needs to do budget arithmetic.
 * The final team is always JavaScript-verified ≤ $100M.
 */

const PROXY_URL = "/api/predict";
const MODEL = "claude-sonnet-4-20250514";

const SCORING_RULES = `
FANTASY F1 SCORING:
Race finishing: 1st=25, 2nd=18, 3rd=15, 4th=12, 5th=10, 6th=8, 7th=6, 8th=4, 9th=2, 10th=1
Qualifying: P1=10, P2=9, P3=8, P4=7, P5=6, P6=5, P7=4, P8=3, P9=2, P10=1
Bonuses: Fastest Lap=+5, Position Gained=+2 each, Beat Teammate (Qual)=+2, Beat Teammate (Race)=+3, Classified Finish=+1
Penalties: Position Lost=-2 each, Not Classified=-5, Disqualified=-20
Turbo Driver: one driver scores 2× points
`.trim();

const SYSTEM_PROMPT = `You are an expert Fantasy F1 analyst. A team of 5 drivers and 2 constructors has already been pre-selected based on recent performance data and budget constraints.

Your sole task is to analyse that pre-selected team using the race data provided, and return:
- Per-driver reasoning based on recent form, track characteristics, and teammate matchup
- Per-constructor reasoning based on how both their drivers have been performing
- Predicted fantasy points for each driver and constructor
- Which driver should be set as Turbo (highest expected haul, doubling their points)
- 2 value picks (best points-per-dollar in the team)
- 2 risks (drivers or constructors most likely to underperform)
- An overall analysis summary and next-race outlook

${SCORING_RULES}

You do NOT select or change the team. Analysis only.

Return ONLY valid JSON with no preamble or markdown fences:
{
  "analysis_summary": "2-3 sentence overview of the team's strengths and key trends",
  "next_race_outlook": "1-2 sentences about the circuit and expected conditions",
  "driver_analyses": [
    {
      "abbreviation": "string (must match exactly what was given)",
      "reasoning": "string — 1-2 sentences covering recent form, circuit fit, and teammate battle",
      "predicted_finish": number,
      "predicted_points": number,
      "confidence": "high" | "medium" | "low",
      "is_turbo_pick": boolean (exactly one driver must be true)
    }
  ],
  "constructor_analyses": [
    {
      "team_name": "string (must match exactly what was given)",
      "reasoning": "string — 1-2 sentences",
      "predicted_points": number,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "turbo_driver_abbreviation": "string",
  "value_picks": ["string", "string"],
  "risks": ["string", "string"],
  "data_confidence": "high" | "medium" | "low",
  "data_note": "string (note if data was sparse or incomplete)"
}`;

// ─── Budget optimizer ─────────────────────────────────────────────────────────

/**
 * Scores a driver for the optimizer.
 * Lower avg_finish_position → better → higher score.
 * Upward trend adds a small bonus.
 */
function driverScore(d) {
  return (21 - d.avg_finish_position)
    + (d.position_trend === true  ?  2 : 0)
    + (d.position_trend === false ? -1 : 0);
}

/**
 * Evaluates every valid combination of 5 drivers + 2 constructors within $100M
 * and returns the highest-scoring one.
 *
 * Runtime: O(C(n,5) × C(m,2)) — with n ≤ 15 this is at most ~135k iterations.
 *
 * @param {Array}  driverTrends       — each entry has .price (number), .abbreviation, etc.
 * @param {Object} constructorPriceMap — { team_name: price }
 * @returns {{ drivers, constructors, total_cost, budget_remaining } | null}
 */
function computeOptimalTeam(driverTrends, constructorPriceMap) {
  const BUDGET = 100;

  const drivers = driverTrends
    .filter(d => typeof d.price === 'number' && d.price > 0)
    .map(d => ({ ...d, _score: driverScore(d) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 15); // C(15,5) = 3,003 — fast enough

  const constructors = Object.entries(constructorPriceMap).map(([name, price]) => {
    const teamDrivers = driverTrends.filter(d => d.team_name === name);
    const avgScore = teamDrivers.length
      ? teamDrivers.reduce((s, d) => s + driverScore(d), 0) / teamDrivers.length
      : 5;
    return { team_name: name, price, _score: avgScore };
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
    if (dCost >= BUDGET) continue;

    for (let ci = 0; ci < constructors.length - 1; ci++)
    for (let cj = ci + 1; cj < constructors.length; cj++) {
      const c = [constructors[ci], constructors[cj]];
      const total = dCost + c[0].price + c[1].price;
      if (total > BUDGET) continue;

      const score = d.reduce((s, x) => s + x._score, 0)
                  + c.reduce((s, x) => s + x._score, 0);
      if (score > bestScore) {
        bestScore = score;
        best = { drivers: d, constructors: c, total_cost: total, budget_remaining: BUDGET - total };
      }
    }
  }

  return best;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePredictions(dataPayload) {
  const constructorPriceMap = {};
  if (dataPayload.user_context?.custom_prices?.constructors) {
    Object.assign(constructorPriceMap, dataPayload.user_context.custom_prices.constructors);
  }

  const optimalTeam = computeOptimalTeam(dataPayload.driver_trends, constructorPriceMap);
  if (!optimalTeam) {
    throw new Error(
      'Could not find a valid team within $100M. ' +
      'Please set custom prices for drivers and constructors in the Price Manager, ' +
      'then try again. (With all prices at the $20M default, 7 picks = $140M which exceeds the budget.)'
    );
  }

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

    return parsePredictionJSON(rawText, dataPayload, optimalTeam);
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
    : "UPCOMING RACE: Not yet announced";

  const recentRacesStr = recent_races
    .map((r, i) => `  Race ${i + 1}: ${r.race_name} (${r.country}) — Podium: ${r.podium.join(", ")}`)
    .join("\n");

  const driverStats = driver_trends
    .map(d => {
      const trend = d.position_trend === true  ? "↑"
                  : d.position_trend === false ? "↓" : "→";
      const price = typeof d.price === 'number' ? `$${d.price}M` : "$?M";
      return `  ${d.abbreviation.padEnd(4)} ${d.full_name.padEnd(24)} ${d.team_name.padEnd(20)} ${price.padEnd(7)} avg P${String(d.avg_finish_position).padEnd(5)} recent [${d.recent_positions.join(",")}] ${trend}`;
    })
    .join("\n");

  // Selected team summary
  const teamDriverLines = optimalTeam.drivers
    .map(d => `  ${d.abbreviation.padEnd(4)} ${d.full_name.padEnd(26)} ${d.team_name.padEnd(20)} $${d.price}M  (performance score: ${d._score?.toFixed(1) ?? 'n/a'})`)
    .join("\n");
  const teamConstructorLines = optimalTeam.constructors
    .map(c => `  ${c.team_name.padEnd(30)} $${c.price}M`)
    .join("\n");

  let currentTeamNote = "";
  if (user_context?.current_team) {
    const t = user_context.current_team;
    const dNames = t.drivers?.map(d => d.full_name || d.name).join(", ") || "none";
    const cNames = t.constructors?.map(c => c.team_name || c.name).join(", ") || "none";
    currentTeamNote = `\nUSER'S CURRENT TEAM: ${dNames} | ${cNames}${t.totalCost !== undefined ? ` ($${t.totalCost}M)` : ""}\n`;
  }

  return `${nextRaceStr}
DATA WINDOW: ${data_window}
${currentTeamNote}
RECENT RACE RESULTS:
${recentRacesStr}

FULL DRIVER PERFORMANCE DATA:
  ABB  Name                     Team                 Price   Avg Pos  Recent positions  Trend
${"─".repeat(100)}
${driverStats}

PRE-SELECTED TEAM (budget-verified, total $${optimalTeam.total_cost}M of $100M):
Drivers:
${teamDriverLines}
Constructors:
${teamConstructorLines}
Budget remaining: $${optimalTeam.budget_remaining}M

Analyse each driver and constructor above using the race data. Return only valid JSON.`;
}

// ─── Response parser + merger ─────────────────────────────────────────────────

function parsePredictionJSON(rawText, fallbackPayload, optimalTeam) {
  const clean = rawText.replace(/```json|```/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
    if (!parsed.driver_analyses || !parsed.constructor_analyses) {
      throw new Error("Missing driver_analyses or constructor_analyses");
    }
  } catch (e) {
    console.error("Failed to parse AI analysis JSON:", e);
    return buildFallbackResult(fallbackPayload, optimalTeam, `AI returned malformed JSON: ${e.message}`);
  }

  // Index AI analyses by their keys
  const byAbbrev = {};
  (parsed.driver_analyses || []).forEach(a => { byAbbrev[a.abbreviation] = a; });
  const byTeam = {};
  (parsed.constructor_analyses || []).forEach(a => { byTeam[a.team_name] = a; });

  // Merge JS team with AI analysis
  const turboAbbrev = parsed.turbo_driver_abbreviation;
  const recommended_drivers = optimalTeam.drivers.map(d => {
    const ai = byAbbrev[d.abbreviation] || {};
    return {
      full_name: d.full_name,
      abbreviation: d.abbreviation,
      team_name: d.team_name,
      team_colour: d.team_colour,
      price: d.price,
      reasoning: ai.reasoning || `Avg finish P${d.avg_finish_position} over recent races.`,
      predicted_finish: ai.predicted_finish ?? Math.round(d.avg_finish_position),
      predicted_points: ai.predicted_points ?? Math.max(1, 26 - Math.round(d.avg_finish_position)),
      confidence: ai.confidence ?? "medium",
      is_turbo_pick: d.abbreviation === turboAbbrev,
    };
  });

  const recommended_constructors = optimalTeam.constructors.map(c => {
    const ai = byTeam[c.team_name] || {};
    return {
      team_name: c.team_name,
      price: c.price,
      reasoning: ai.reasoning || `Selected for overall driver performance.`,
      predicted_points: ai.predicted_points ?? Math.round(c._score * 3),
      confidence: ai.confidence ?? "medium",
    };
  });

  // Ensure exactly one turbo driver
  const turboCount = recommended_drivers.filter(d => d.is_turbo_pick).length;
  if (turboCount === 0) recommended_drivers[0].is_turbo_pick = true;

  return {
    analysis_summary: parsed.analysis_summary || "",
    next_race_outlook: parsed.next_race_outlook || "",
    recommended_drivers,
    recommended_constructors,
    turbo_driver: recommended_drivers.find(d => d.is_turbo_pick)?.full_name ?? "",
    value_picks: parsed.value_picks || [],
    risks: parsed.risks || [],
    total_cost: optimalTeam.total_cost,
    budget_remaining: optimalTeam.budget_remaining,
    budget_analysis: `Team total: $${optimalTeam.total_cost}M / $100M ($${optimalTeam.budget_remaining}M remaining).`,
    data_confidence: parsed.data_confidence || "medium",
    data_note: parsed.data_note || "",
    raw_data: fallbackPayload,
    generated_at: new Date().toISOString(),
  };
}

function buildFallbackResult(fallbackPayload, optimalTeam, errorNote) {
  const recommended_drivers = optimalTeam.drivers.map((d, i) => ({
    full_name: d.full_name,
    abbreviation: d.abbreviation,
    team_name: d.team_name,
    team_colour: d.team_colour,
    price: d.price,
    reasoning: `Avg finish P${d.avg_finish_position} over recent races.`,
    predicted_finish: Math.round(d.avg_finish_position),
    predicted_points: Math.max(1, 26 - Math.round(d.avg_finish_position)),
    confidence: "low",
    is_turbo_pick: i === 0,
  }));
  const recommended_constructors = optimalTeam.constructors.map(c => ({
    team_name: c.team_name,
    price: c.price,
    reasoning: `Selected based on recent driver performance.`,
    predicted_points: Math.round(c._score * 3),
    confidence: "low",
  }));
  return {
    analysis_summary: "AI analysis unavailable — showing team based on recent performance data only.",
    next_race_outlook: "",
    recommended_drivers,
    recommended_constructors,
    turbo_driver: recommended_drivers[0].full_name,
    value_picks: [],
    risks: [],
    total_cost: optimalTeam.total_cost,
    budget_remaining: optimalTeam.budget_remaining,
    budget_analysis: `Team total: $${optimalTeam.total_cost}M / $100M.`,
    data_confidence: "low",
    data_note: errorNote,
    raw_data: fallbackPayload,
    generated_at: new Date().toISOString(),
  };
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
