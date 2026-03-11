/**
 * aiPredictionService.js
 *
 * Design:
 *
 *   Claude AI    → receives the FULL grid of ALL drivers and ALL constructors
 *                  with recent performance data, fantasy prices, AND real-time
 *                  news articles from PlanetF1, Motorsport.com, and Reddit.
 *                  It ranks every driver and constructor for the next Grand Prix.
 *
 *   JavaScript   → takes the AI's full rankings and finds the best possible
 *                  5 drivers + 2 constructors within the $100M budget cap,
 *                  maximising total AI-predicted fantasy points.
 *
 * The AI drives the prediction. JS enforces the budget.
 * The final team is always JavaScript-verified ≤ $100M.
 */

import { fetchF1News, buildNewsContext } from "./newsService.js";

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

const SYSTEM_PROMPT = `You are an expert Fantasy F1 analyst. You will receive the COMPLETE grid — every active driver and every constructor — along with recent race performance data, fantasy prices, and real-time news articles from PlanetF1, Motorsport.com, and Reddit.

Your task is to predict the race outcome for EVERY driver and EVERY constructor in the list for the upcoming Grand Prix. Do NOT pre-select a team; rank the entire field.

${SCORING_RULES}

REQUIREMENTS:
- Assign a unique predicted_finish (1 through N, no ties) to EVERY driver in "driver_predictions"
- Calculate predicted_points for each driver using the Fantasy F1 scoring rules above (account for qualifying, race finish, bonuses)
- Provide predicted_points for each constructor (combined fantasy points from both their drivers: race finish + qualifying + bonuses for each)
- Provide clear reasoning for each driver and constructor based on recent form, circuit characteristics, teammate battles, and likely qualifying pace
- Mark exactly one driver as is_turbo_candidate (the single driver expected to score the most fantasy points — the best turbo pick regardless of price)

Return ONLY valid JSON with no preamble or markdown fences:
{
  "analysis_summary": "2-3 sentence overview of the key storylines and power order going into this race",
  "next_race_outlook": "1-2 sentences about the circuit characteristics and what to expect",
  "driver_predictions": [
    {
      "abbreviation": "string (must match exactly what was given)",
      "predicted_finish": number (unique integer 1 through N, lower is better),
      "predicted_points": number (total fantasy points from race + qualifying + bonuses),
      "confidence": "high" | "medium" | "low",
      "reasoning": "1-2 sentences on recent form, circuit fit, qualifying pace, and key factors",
      "is_turbo_candidate": boolean (true for exactly ONE driver — the best turbo pick)
    }
  ],
  "constructor_predictions": [
    {
      "team_name": "string (must match exactly what was given)",
      "predicted_points": number (combined fantasy points from both drivers),
      "confidence": "high" | "medium" | "low",
      "reasoning": "1-2 sentences on team performance and both drivers' expected output"
    }
  ],
  "data_confidence": "high" | "medium" | "low",
  "data_note": "string (brief note on data quality or any important caveats)"
}`;

// ─── Constructor list builder ─────────────────────────────────────────────────

/**
 * Derives all unique constructors from driver trends and merges in prices.
 * Also includes any constructor that has a custom price but no driver data.
 */
function buildConstructorList(driverTrends, constructorPriceMap) {
  const teams = {};

  for (const d of driverTrends) {
    if (!teams[d.team_name]) {
      const rawCPrice = constructorPriceMap[d.team_name];
      teams[d.team_name] = {
        team_name: d.team_name,
        // Prices stored as raw dollars; convert to millions
        price: rawCPrice != null ? rawCPrice / 1_000_000 : 20,
        drivers: [],
      };
    }
    teams[d.team_name].drivers.push(d.abbreviation);
  }

  // Also include any constructor that has a price set but no driver data
  for (const [teamName, rawPrice] of Object.entries(constructorPriceMap)) {
    if (!teams[teamName]) {
      teams[teamName] = { team_name: teamName, price: rawPrice / 1_000_000, drivers: [] };
    }
  }

  return Object.values(teams).sort((a, b) => a.team_name.localeCompare(b.team_name));
}

// ─── Heuristic fallback scorer ────────────────────────────────────────────────

/**
 * Fallback score when no AI data is available.
 * Lower avg_finish_position → better → higher score.
 */
function driverScore(d) {
  return (21 - d.avg_finish_position)
    + (d.position_trend === true  ?  2 : 0)
    + (d.position_trend === false ? -1 : 0);
}

// ─── Budget optimizer ─────────────────────────────────────────────────────────

/**
 * Evaluates every valid combination of 5 drivers + 2 constructors within $100M
 * and returns the highest-scoring one.
 *
 * When AI prediction maps are supplied, uses AI-predicted fantasy points as scores.
 * Falls back to the heuristic driverScore() if no AI data is available.
 *
 * Runtime: O(C(n,5) × C(m,2)) — with 20 drivers this is ~697k iterations (< 10ms).
 *
 * @param {Array}  driverTrends       — each entry has .price, .abbreviation, etc.
 * @param {Array}  allConstructors    — [{team_name, price, drivers}]
 * @param {Object} aiDriverMap        — { abbreviation: { predicted_points, predicted_finish, … } }
 * @param {Object} aiConstructorMap   — { team_name: { predicted_points, … } }
 * @returns {{ drivers, constructors, total_cost, budget_remaining } | null}
 */
function computeOptimalTeam(driverTrends, allConstructors, aiDriverMap = {}, aiConstructorMap = {}) {
  const BUDGET = 100;

  const drivers = driverTrends
    .filter(d => typeof d.price === 'number' && d.price > 0)
    .map(d => {
      const ai = aiDriverMap[d.abbreviation];
      // Use AI predicted_points as the primary score; fallback to heuristic
      const score = ai != null
        ? (ai.predicted_points ?? (21 - (ai.predicted_finish ?? 21)))
        : driverScore(d);
      return { ...d, _score: score };
    });

  const constructors = allConstructors
    .filter(c => c.price > 0)
    .map(c => {
      const ai = aiConstructorMap[c.team_name];
      // Use AI predicted_points as score; fallback to average of driver scores
      const score = ai != null
        ? (ai.predicted_points ?? 0)
        : (() => {
            const teamDrivers = driverTrends.filter(d => d.team_name === c.team_name);
            return teamDrivers.length
              ? teamDrivers.reduce((s, d) => s + driverScore(d), 0) / teamDrivers.length
              : 5;
          })();
      return { ...c, _score: score };
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

  // Build the full constructor list (from driver data + any extra priced constructors)
  const allConstructors = buildConstructorList(dataPayload.driver_trends, constructorPriceMap);

  // Pre-validate: confirm that at least one valid 5+2 combination can fit within $100M
  const BUDGET = 100;
  const sortedDriverPrices = dataPayload.driver_trends
    .filter(d => typeof d.price === 'number' && d.price > 0)
    .map(d => d.price)
    .sort((a, b) => a - b);
  const sortedConsPrices = allConstructors.filter(c => c.price > 0).map(c => c.price).sort((a, b) => a - b);

  if (sortedDriverPrices.length < 5 || sortedConsPrices.length < 2) {
    throw new Error(
      'Not enough priced drivers or constructors to build a team. ' +
      'Please set custom prices for all drivers and constructors in the Price Manager.'
    );
  }

  const minPossibleCost =
    sortedDriverPrices.slice(0, 5).reduce((a, b) => a + b, 0) +
    sortedConsPrices.slice(0, 2).reduce((a, b) => a + b, 0);

  if (minPossibleCost > BUDGET) {
    throw new Error(
      `The cheapest possible 5+2 team costs $${minPossibleCost}M which exceeds the $100M budget. ` +
      'Please lower at least some prices in the Price Manager.'
    );
  }

  // Fetch real-time news context (non-blocking — a failure won't abort predictions)
  let newsContext = "";
  try {
    const newsData = await fetchF1News();
    newsContext = buildNewsContext(newsData);
    if (newsContext) {
      console.log(`[predictions] News context included: ${newsData.articles?.length ?? 0} articles`);
    }
  } catch (newsErr) {
    console.warn("[predictions] News fetch failed (continuing without):", newsErr.message);
  }

  const userMessage = buildUserMessage(dataPayload, constructorPriceMap, allConstructors, newsContext);

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
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

    return parsePredictionJSON(rawText, dataPayload, allConstructors);
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

function buildUserMessage(payload, constructorPriceMap, allConstructors, newsContext = "") {
  const { next_race, recent_races, driver_trends, user_context, data_window } = payload;

  // Build the upcoming race string from whatever data we have
  let nextRaceStr;
  if (next_race && (next_race.name || next_race.circuit || next_race.country)) {
    const parts = [next_race.name || next_race.circuit].filter(Boolean);
    if (next_race.circuit && next_race.name && next_race.circuit !== next_race.name)
      parts.push(`(${next_race.circuit})`);
    if (next_race.country) parts.push(next_race.country);
    if (next_race.date) parts.push(`on ${formatDate(next_race.date)}`);
    nextRaceStr = `UPCOMING RACE: ${parts.join(' — ')}`;
  } else {
    // Derive context from the most recent known race so the AI can reason about
    // the next round in sequence rather than guessing at a specific venue
    const lastRace = recent_races && recent_races.length > 0 ? recent_races[0] : null;
    const season = new Date().getFullYear();
    const lastRaceNote = lastRace
      ? ` (most recent race on record: ${lastRace.race_name}, ${lastRace.country})`
      : '';
    nextRaceStr = `UPCOMING RACE: Next Grand Prix in the ${season} season — exact circuit not yet published in OpenF1 data${lastRaceNote}. Analyse on recent form; do not assume a specific venue.`;
  }

  const recentRacesStr = recent_races
    .map((r, i) => `  Race ${i + 1}: ${r.race_name} (${r.country}) — Podium: ${r.podium.join(", ")}`)
    .join("\n");

  const driverStats = driver_trends
    .map(d => {
      const trend = d.position_trend === true  ? "↑"
                  : d.position_trend === false ? "↓" : "→";
      const price = typeof d.price === 'number' ? `$${d.price}M` : "$?M";
      return `  ${d.abbreviation.padEnd(4)} ${d.full_name.padEnd(26)} ${d.team_name.padEnd(22)} ${price.padEnd(7)} avg P${String(d.avg_finish_position).padEnd(5)} recent [${d.recent_positions.join(",")}] ${trend}`;
    })
    .join("\n");

  const constructorStats = allConstructors
    .map(c => {
      const drivers = c.drivers.length ? c.drivers.join(", ") : "no driver data";
      return `  ${c.team_name.padEnd(28)} $${c.price}M   drivers: ${drivers}`;
    })
    .join("\n");

  let currentTeamNote = "";
  if (user_context?.current_team) {
    const t = user_context.current_team;
    const dNames = t.drivers?.map(d => d.full_name || d.name).join(", ") || "none";
    const cNames = t.constructors?.map(c => c.team_name || c.name).join(", ") || "none";
    currentTeamNote = `\nUSER'S CURRENT FANTASY TEAM: ${dNames} | ${cNames}${t.totalCost !== undefined ? ` ($${t.totalCost}M)` : ""}\n`;
  }

  return `${nextRaceStr}
DATA WINDOW: ${data_window}
${currentTeamNote}
RECENT RACE RESULTS:
${recentRacesStr}

ALL DRIVERS — full grid (rank EVERY driver, 1 through ${driver_trends.length}):
  ABB  Name                       Team                    Price    Avg Pos  Recent positions  Trend
${"─".repeat(108)}
${driverStats}

ALL CONSTRUCTORS — predict combined fantasy points for each:
  Team                          Price   Drivers
${"─".repeat(72)}
${constructorStats}
${newsContext ? `\n${newsContext}\n` : ""}
TASK: Rank ALL ${driver_trends.length} drivers and ALL ${allConstructors.length} constructors for the upcoming race.
- Every driver must have a unique predicted_finish from 1 to ${driver_trends.length}
- Use Fantasy F1 scoring rules to estimate predicted_points for each driver and constructor
- The budget for a fantasy team is $100M for 5 drivers + 2 constructors
- Your rankings will be used to find the best possible team within that budget
- Mark exactly one driver as is_turbo_candidate (best single-driver turbo pick regardless of price)
${newsContext ? "- Factor in the recent news and community discussions above when assessing driver and team form\n" : ""}Return only valid JSON.`;
}

// ─── Response parser + budget optimizer integration ───────────────────────────

function parsePredictionJSON(rawText, fallbackPayload, allConstructors) {
  const clean = rawText.replace(/```json|```/gi, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
    if (!parsed.driver_predictions || !parsed.constructor_predictions) {
      throw new Error("Missing driver_predictions or constructor_predictions");
    }
  } catch (e) {
    console.error("Failed to parse AI prediction JSON:", e);
    return buildFallbackResult(fallbackPayload, allConstructors, `AI returned malformed JSON: ${e.message}`);
  }

  // Index AI predictions by their keys
  const aiDriverMap = {};
  (parsed.driver_predictions || []).forEach(p => { aiDriverMap[p.abbreviation] = p; });
  const aiConstructorMap = {};
  (parsed.constructor_predictions || []).forEach(p => { aiConstructorMap[p.team_name] = p; });

  // Run the budget optimizer using AI-predicted fantasy points as scores
  const optimalTeam = computeOptimalTeam(
    fallbackPayload.driver_trends,
    allConstructors,
    aiDriverMap,
    aiConstructorMap
  );

  if (!optimalTeam) {
    return buildFallbackResult(
      fallbackPayload,
      allConstructors,
      'No valid 5+2 team found within $100M. Please lower prices in the Price Manager.'
    );
  }

  // Determine turbo pick: prefer the AI's turbo candidate if they're in the selected team,
  // otherwise pick the selected driver with highest predicted_points
  const aiTurboAbbrev = (parsed.driver_predictions || []).find(p => p.is_turbo_candidate)?.abbreviation;
  const turboInTeam = optimalTeam.drivers.some(d => d.abbreviation === aiTurboAbbrev);
  const finalTurboAbbrev = turboInTeam
    ? aiTurboAbbrev
    : optimalTeam.drivers.reduce((best, d) => {
        const pts = aiDriverMap[d.abbreviation]?.predicted_points ?? 0;
        const bestPts = aiDriverMap[best.abbreviation]?.predicted_points ?? 0;
        return pts > bestPts ? d : best;
      }, optimalTeam.drivers[0]).abbreviation;

  // Merge JS-selected team with AI analysis
  const recommended_drivers = optimalTeam.drivers.map(d => {
    const ai = aiDriverMap[d.abbreviation] || {};
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
      is_turbo_pick: d.abbreviation === finalTurboAbbrev,
    };
  });

  // Ensure exactly one turbo driver (guard against edge cases)
  const turboCount = recommended_drivers.filter(d => d.is_turbo_pick).length;
  if (turboCount === 0) {
    recommended_drivers.reduce((a, b) =>
      a.predicted_points >= b.predicted_points ? a : b
    ).is_turbo_pick = true;
  } else if (turboCount > 1) {
    let kept = false;
    for (const d of recommended_drivers) {
      if (d.is_turbo_pick) { if (kept) d.is_turbo_pick = false; else kept = true; }
    }
  }

  const recommended_constructors = optimalTeam.constructors.map(c => {
    const ai = aiConstructorMap[c.team_name] || {};
    return {
      team_name: c.team_name,
      price: c.price,
      reasoning: ai.reasoning || `Selected based on combined driver performance predictions.`,
      predicted_points: ai.predicted_points ?? Math.round(c._score),
      confidence: ai.confidence ?? "medium",
    };
  });

  // Compute value picks: best predicted_points-per-dollar in the selected team
  const allPicks = [
    ...recommended_drivers.map(d => ({ label: d.abbreviation, ppd: d.predicted_points / (d.price || 1) })),
    ...recommended_constructors.map(c => ({ label: c.team_name, ppd: c.predicted_points / (c.price || 1) })),
  ].sort((a, b) => b.ppd - a.ppd);
  const value_picks = allPicks.slice(0, 2).map(p => p.label);

  // Compute risks: lowest confidence picks in the selected team
  const confOrder = { low: 0, medium: 1, high: 2 };
  const risks = [
    ...recommended_drivers.map(d => ({ label: d.abbreviation, conf: d.confidence })),
    ...recommended_constructors.map(c => ({ label: c.team_name, conf: c.confidence })),
  ]
    .sort((a, b) => confOrder[a.conf] - confOrder[b.conf])
    .slice(0, 2)
    .map(p => p.label);

  const totalDrivers = fallbackPayload.driver_trends.length;
  const totalConstructors = allConstructors.length;

  return {
    analysis_summary: parsed.analysis_summary || "",
    next_race_outlook: parsed.next_race_outlook || "",
    recommended_drivers,
    recommended_constructors,
    turbo_driver: recommended_drivers.find(d => d.is_turbo_pick)?.full_name ?? "",
    value_picks,
    risks,
    total_cost: optimalTeam.total_cost,
    budget_remaining: optimalTeam.budget_remaining,
    budget_analysis: `Optimal team: $${optimalTeam.total_cost.toFixed(2)}M / $100M ($${optimalTeam.budget_remaining.toFixed(2)}M remaining) — selected from ${totalDrivers} drivers & ${totalConstructors} constructors.`,
    data_confidence: parsed.data_confidence || "medium",
    data_note: parsed.data_note || "",
    raw_data: fallbackPayload,
    generated_at: new Date().toISOString(),
  };
}

function buildFallbackResult(fallbackPayload, allConstructors, errorNote) {
  // Run the optimizer with only heuristic scores (no AI data)
  const optimalTeam = computeOptimalTeam(
    fallbackPayload.driver_trends,
    allConstructors,
    {},  // no AI driver map
    {}   // no AI constructor map
  );

  if (!optimalTeam) {
    return {
      error: true,
      error_message: errorNote || 'Could not find a valid team within $100M.',
      recommended_drivers: [],
      recommended_constructors: [],
      turbo_driver: "",
      value_picks: [],
      risks: [],
      total_cost: 0,
      budget_remaining: 100,
      budget_analysis: "No valid team found.",
      data_confidence: "low",
      data_note: errorNote,
      raw_data: fallbackPayload,
      generated_at: new Date().toISOString(),
    };
  }

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
    predicted_points: Math.round(c._score),
    confidence: "low",
  }));

  return {
    analysis_summary: "AI analysis unavailable — team selected from recent performance data only.",
    next_race_outlook: "",
    recommended_drivers,
    recommended_constructors,
    turbo_driver: recommended_drivers[0]?.full_name ?? "",
    value_picks: [],
    risks: [],
    total_cost: optimalTeam.total_cost,
    budget_remaining: optimalTeam.budget_remaining,
    budget_analysis: `Team total: $${optimalTeam.total_cost}M / $100M ($${optimalTeam.budget_remaining}M remaining).`,
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
