/**
 * Predictions.jsx
 * AI-powered Fantasy F1 predictions page.
 * Drop-in replacement for your existing src/pages/Predictions.jsx
 *
 * SETUP:
 *  1. Add VITE_ANTHROPIC_API_KEY=sk-ant-... to your .env file
 *  2. Copy openf1DataService.js → src/services/openf1DataService.js
 *  3. Copy aiPredictionService.js → src/services/aiPredictionService.js
 *  4. Replace src/pages/Predictions.jsx with this file
 */

import { useState, useCallback } from "react";
import { buildPredictionPayload } from "../services/openf1DataService";
import { generatePredictions } from "../services/aiPredictionService";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS = {
  high: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-red-400 bg-red-400/10 border-red-400/30",
};

const CONFIDENCE_LABELS = { high: "High", medium: "Medium", low: "Low" };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ confidence }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[confidence] || CONFIDENCE_COLORS.low}`}
    >
      {CONFIDENCE_LABELS[confidence] || confidence} confidence
    </span>
  );
}

function TurboBadge() {
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300">
      ⚡ TURBO
    </span>
  );
}

function DriverCard({ driver }) {
  const teamColor = "#" + (driver.team_colour || "888888").replace("#", "");
  return (
    <div
      className="relative bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2 hover:border-gray-500 transition-colors"
      style={{ borderLeftColor: teamColor, borderLeftWidth: "3px" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white text-sm leading-tight">
            {driver.full_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{driver.team_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {driver.is_turbo_pick && <TurboBadge />}
          <StatusBadge confidence={driver.confidence} />
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-300 mt-1">
        <span>
          🏁 Predicted P{driver.predicted_finish}
        </span>
        <span>
          🔢{" "}
          <span className="text-white font-semibold">
            {driver.predicted_points}
          </span>{" "}
          pts
          {driver.is_turbo_pick && (
            <span className="text-yellow-300 ml-1">
              → {driver.predicted_points * 2} (2×)
            </span>
          )}
        </span>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700/50 pt-2">
        {driver.reasoning}
      </p>
    </div>
  );
}

function ConstructorCard({ constructor: c }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex flex-col gap-2 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white text-sm">{c.team_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">Constructor</p>
        </div>
        <StatusBadge confidence={c.confidence} />
      </div>
      <div className="text-xs text-gray-300">
        🔢{" "}
        <span className="text-white font-semibold">{c.predicted_points}</span>{" "}
        pts predicted
      </div>
      <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700/50 pt-2">
        {c.reasoning}
      </p>
    </div>
  );
}

function RecentRaceRow({ race, index }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-700/40 last:border-0">
      <span className="text-xs text-gray-500 w-4">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{race.race_name}</p>
        <p className="text-xs text-gray-500">{race.country}</p>
      </div>
      <p className="text-xs text-gray-400 truncate max-w-[180px]">
        {race.podium.slice(0, 3).join(" · ")}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">
        Fetching race data &amp; generating predictions…
      </p>
      <p className="text-gray-600 text-xs">This takes 10–20 seconds</p>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="text-red-400 font-semibold">Prediction failed</p>
      <p className="text-gray-400 text-sm max-w-md">{error}</p>
      {error?.includes("API key") && (
        <p className="text-gray-500 text-xs max-w-sm">
          Add <code className="bg-gray-800 px-1 rounded">VITE_ANTHROPIC_API_KEY=sk-ant-...</code>{" "}
          to your <code className="bg-gray-800 px-1 rounded">.env</code> file and restart the dev server.
        </p>
      )}
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onGenerate, loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="text-6xl">🏎️</div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">AI Race Predictions</h2>
        <p className="text-gray-400 text-sm max-w-md">
          Pulls live data from OpenF1, analyses the last 5 races, and uses Claude
          to recommend your best Fantasy F1 team for the upcoming Grand Prix.
        </p>
      </div>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Generating…" : "Generate Predictions"}
      </button>
      {!API_KEY && (
        <p className="text-amber-400 text-xs max-w-xs">
          ⚠️ VITE_ANTHROPIC_API_KEY not set — predictions will fail without it.
        </p>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Predictions() {
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [prediction, setPrediction] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [raceCount, setRaceCount] = useState(5);

  const runPrediction = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const payload = await buildPredictionPayload(raceCount);
      setRawData(payload);
      const result = await generatePredictions(payload, API_KEY);
      if (result.error) throw new Error(result.error_message);
      setPrediction(result);
      setStatus("success");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }, [raceCount]);

  const reset = () => {
    setStatus("idle");
    setPrediction(null);
    setRawData(null);
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700/50 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              🤖 AI Predictions
              <span className="text-xs font-normal text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">
                powered by Claude
              </span>
            </h1>
            {rawData?.next_race && (
              <p className="text-xs text-gray-400 mt-0.5">
                Next: <span className="text-white">{rawData.next_race.name}</span>
                {" · "}
                {rawData.next_race.country}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Race count selector */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Data window:</span>
              <select
                value={raceCount}
                onChange={(e) => setRaceCount(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none"
                disabled={status === "loading"}
              >
                <option value={3}>Last 3 races</option>
                <option value={5}>Last 5 races</option>
                <option value={8}>Last 8 races</option>
              </select>
            </div>

            {status === "success" && (
              <button
                onClick={runPrediction}
                disabled={status === "loading"}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs text-white rounded-lg transition-colors"
              >
                Refresh
              </button>
            )}
            {status === "success" && (
              <button
                onClick={reset}
                className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-xs text-gray-400 rounded-lg transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {status === "idle" && (
          <EmptyState onGenerate={runPrediction} loading={false} />
        )}
        {status === "loading" && <LoadingState />}
        {status === "error" && (
          <ErrorState error={errorMsg} onRetry={runPrediction} />
        )}

        {status === "success" && prediction && (
          <div className="space-y-6">
            {/* Analysis summary */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                AI Analysis
              </h2>
              <p className="text-sm text-gray-200 leading-relaxed">
                {prediction.analysis_summary}
              </p>
              {prediction.next_race_outlook && (
                <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-700/50 pt-2">
                  🏁 {prediction.next_race_outlook}
                </p>
              )}

              {/* Value picks & risks */}
              <div className="flex flex-wrap gap-4 pt-1">
                {prediction.value_picks?.length > 0 && (
                  <div>
                    <p className="text-xs text-emerald-400 font-semibold mb-1">
                      💰 Value picks
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {prediction.value_picks.map((v) => (
                        <span
                          key={v}
                          className="text-xs bg-emerald-900/30 border border-emerald-700/30 text-emerald-300 px-2 py-0.5 rounded-full"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {prediction.risks?.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-semibold mb-1">
                      ⚠️ Risks
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {prediction.risks.map((r) => (
                        <span
                          key={r}
                          className="text-xs bg-red-900/30 border border-red-700/30 text-red-300 px-2 py-0.5 rounded-full"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drivers + Constructors grid */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Drivers */}
              <div className="md:col-span-2 space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Recommended Drivers (5)
                </h2>
                {prediction.recommended_drivers.map((d) => (
                  <DriverCard key={d.abbreviation || d.full_name} driver={d} />
                ))}
              </div>

              {/* Constructors */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Constructors (2)
                </h2>
                {prediction.recommended_constructors.map((c) => (
                  <ConstructorCard key={c.team_name} constructor={c} />
                ))}

                {/* Data source summary */}
                {rawData?.recent_races?.length > 0 && (
                  <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3 mt-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Data used ({rawData.data_window})
                    </h3>
                    {rawData.recent_races.map((race, i) => (
                      <RecentRaceRow key={race.race_name} race={race} index={i} />
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <p className="text-xs text-gray-600 text-center">
                  Generated{" "}
                  {new Date(prediction.generated_at).toLocaleTimeString()}
                  {" · "}
                  <StatusBadge confidence={prediction.data_confidence} />
                </p>
                {prediction.data_note && (
                  <p className="text-xs text-gray-500 text-center italic">
                    {prediction.data_note}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
