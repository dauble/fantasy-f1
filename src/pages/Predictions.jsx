/**
 * Predictions.jsx
 * AI-powered Fantasy F1 predictions page.
 * Drop-in replacement for your existing src/pages/Predictions.jsx
 *
 * SETUP:
 *  1. Add ANTHROPIC_API_KEY=sk-ant-... to your .env file
 *     (this is read only by server.js / the Express proxy and is not exposed
 *      to the client bundle via Vite).
 *  2. Copy openf1DataService.js → src/services/openf1DataService.js
 *  3. Copy aiPredictionService.js → src/services/aiPredictionService.js
 *  4. Replace src/pages/Predictions.jsx with this file
 */

import { useState, useCallback, useEffect } from "react";
import { buildPredictionPayload, clearPredictionCaches } from "../services/openf1DataService";
import { generatePredictions } from "../services/aiPredictionService";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS = {
  high:   "text-emerald-700 dark:text-emerald-300 bg-emerald-50   dark:bg-emerald-400/10 border-emerald-300 dark:border-emerald-400/30",
  medium: "text-amber-700   dark:text-amber-300   bg-amber-50     dark:bg-amber-400/10   border-amber-300   dark:border-amber-400/30",
  low:    "text-red-700     dark:text-red-400     bg-red-50       dark:bg-red-400/10     border-red-300     dark:border-red-400/30",
};

const CONFIDENCE_LABELS = { high: "High", medium: "Medium", low: "Low" };

const PREDICTION_CACHE_KEY = 'fantasy_f1_ai_prediction';

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
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-400/20 border border-yellow-300 dark:border-yellow-400/40 text-yellow-700 dark:text-yellow-300">
      ⚡ TURBO
    </span>
  );
}

function DriverCard({ driver }) {
  const teamColor = "#" + (driver.team_colour || "888888").replace("#", "");
  return (
    <div
      className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
      style={{ borderLeftColor: teamColor, borderLeftWidth: "4px" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-base leading-tight">
            {driver.full_name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{driver.team_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {driver.is_turbo_pick && <TurboBadge />}
          <StatusBadge confidence={driver.confidence} />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300 mt-1">
        <span>🏁 Predicted P{driver.predicted_finish}</span>
        <span>
          🔢 <span className="text-gray-900 dark:text-white font-semibold">{driver.predicted_points}</span> pts
          {driver.is_turbo_pick && (
            <span className="text-yellow-600 dark:text-yellow-300 ml-1">→ {driver.predicted_points * 2} (2×)</span>
          )}
        </span>
        {driver.price !== undefined && (
          <span className="ml-auto text-gray-400 dark:text-gray-500">${driver.price}M</span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700/50 pt-2">
        {driver.reasoning}
      </p>
    </div>
  );
}

function ConstructorCard({ constructor: c }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-base">{c.team_name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Constructor</p>
        </div>
        <StatusBadge confidence={c.confidence} />
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
        <span>
          🔢 <span className="text-gray-900 dark:text-white font-semibold">{c.predicted_points}</span> pts predicted
        </span>
        {c.price !== undefined && (
          <span className="text-gray-400 dark:text-gray-500">${c.price}M</span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700/50 pt-2">
        {c.reasoning}
      </p>
    </div>
  );
}

function RecentRaceRow({ race, index }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700/40 last:border-0">
      <span className="text-sm text-gray-400 dark:text-gray-500 w-5">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{race.race_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">{race.country}</p>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
        {race.podium.slice(0, 3).join(" · ")}
      </p>
    </div>
  );
}

function LoadingState({ step, history }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="w-14 h-14 border-4 border-f1-red/30 border-t-f1-red rounded-full animate-spin" />

      <div className="text-center space-y-1">
        <p className="text-gray-900 dark:text-white text-base font-medium">
          {step || "Starting up…"}
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Analysing the full grid — this takes 15–25 seconds
        </p>
      </div>

      {history.length > 0 && (
        <div className="w-full max-w-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 space-y-2">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-sm transition-opacity ${
                i === history.length - 1
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-400 dark:text-gray-500 opacity-60"
              }`}
            >
              <span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">✓</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">⚠️</div>
          <p className="text-f1-red font-semibold text-lg">Prediction failed</p>
          <p className="text-gray-600 dark:text-gray-300 text-base max-w-md leading-relaxed">{error}</p>
          {error?.includes("API key") && (
            <div className="text-left w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Setup required:</p>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Create a <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> file in the project root</li>
                <li>Add: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code></li>
                <li>Restart the server: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npm run server</code></li>
              </ol>
            </div>
          )}
          {error?.includes("Network error") && (
            <div className="text-left w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-2">Server not running:</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Make sure the Express server is running on port 3000:</p>
              <code className="block bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-2 text-sm">npm run server</code>
            </div>
          )}
          <button
            onClick={onRetry}
            className="mt-2 px-6 py-2.5 bg-f1-red hover:bg-f1-red-dark text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onGenerate, loading }) {
  return (
    <Card className="max-w-xl mx-auto">
      <CardContent className="py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="text-6xl">🏎️</div>
          <div>
            <h2 className="text-2xl font-bold dark:text-white mb-2">AI Race Predictions</h2>
            <p className="text-gray-600 dark:text-gray-300 text-base max-w-md">
              Pulls live data from OpenF1, ranks{" "}
              <span className="font-semibold text-gray-900 dark:text-white">every driver &amp; constructor</span>{" "}
              on the full grid using Claude, then finds the best 5 drivers + 2 constructors within the $100M budget.
            </p>
          </div>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="px-8 py-3 bg-f1-red hover:bg-f1-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base"
          >
            {loading ? "Generating…" : "Generate Predictions"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Predictions() {
  const { syncToCloud } = useAuth();
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [prediction, setPrediction] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [raceCount, setRaceCount] = useState(5);
  const [loadingStep, setLoadingStep] = useState("");
  const [loadingHistory, setLoadingHistory] = useState([]);

  // Load cached prediction on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(PREDICTION_CACHE_KEY);
      if (cached) {
        const { prediction: cachedPrediction, rawData: cachedRawData } = JSON.parse(cached);
        setPrediction(cachedPrediction);
        setRawData(cachedRawData);
        setStatus("success");
        console.log("Loaded cached prediction from", new Date(cachedPrediction.generated_at).toLocaleString());
      }
    } catch (error) {
      console.error("Error loading cached prediction:", error);
      localStorage.removeItem(PREDICTION_CACHE_KEY);
    }
  }, []);

  const runPrediction = useCallback(async (bypassDataCache = false) => {
    setStatus("loading");
    setErrorMsg("");
    setLoadingStep("");
    setLoadingHistory([]);

    const onProgress = (msg) => {
      setLoadingStep(msg);
      setLoadingHistory(prev => [...prev, msg]);
    };

    try {
      onProgress("🏎️ Loading race data from OpenF1…");
      const payload = await buildPredictionPayload(raceCount, bypassDataCache);
      setRawData(payload);
      onProgress(`📊 Loaded ${payload.driver_trends?.length ?? 0} drivers across ${payload.recent_races?.length ?? 0} recent races`);
      const result = await generatePredictions(payload, onProgress);
      if (result.error) throw new Error(result.error_message);
      onProgress("✅ Predictions ready!");
      setPrediction(result);
      setStatus("success");
      
      // Save to localStorage then push to cloud profile
      try {
        localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify({
          prediction: result,
          rawData: payload,
        }));
        console.log("Prediction saved to cache");
        syncToCloud?.();
      } catch (cacheError) {
        console.warn("Failed to cache prediction:", cacheError);
      }
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
    localStorage.removeItem(PREDICTION_CACHE_KEY);
    clearPredictionCaches(raceCount);
    console.log("All prediction caches cleared");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1 dark:text-white flex items-center gap-3">
              AI Predictions
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2.5 py-0.5 rounded-full">
                powered by Claude
              </span>
              {prediction && (() => {
                const age = Date.now() - new Date(prediction.generated_at).getTime();
                const hoursAgo = Math.floor(age / (1000 * 60 * 60));
                if (hoursAgo >= 2) {
                  return (
                    <span className="text-sm font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 px-2.5 py-0.5 rounded-full">
                      cached ({hoursAgo}h old)
                    </span>
                  );
                }
                return null;
              })()}
            </h1>
            <div className="flex flex-col gap-1">
              {rawData?.current_race && (
                <p className="text-gray-600 dark:text-gray-300 text-base">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Current Race:
                  </span>
                  {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{rawData.current_race.name}</span>
                  {" · "}{rawData.current_race.country}
                </p>
              )}
              {rawData?.next_race && (
                <p className="text-gray-600 dark:text-gray-300 text-base">
                  <span className="font-medium">Next race:</span>
                  {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{rawData.next_race.name}</span>
                  {" · "}{rawData.next_race.country}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Race count selector */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Data window:</span>
              <select
                value={raceCount}
                onChange={(e) => setRaceCount(Number(e.target.value))}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-f1-red"
                disabled={status === "loading"}
              >
                <option value={3}>Last 3 races</option>
                <option value={5}>Last 5 races</option>
                <option value={8}>Last 8 races</option>
              </select>
            </div>

            {status === "success" && (
              <>
                <button
                  onClick={() => runPrediction(true)}
                  disabled={status === "loading"}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1.5"
                  title="Fetch fresh data from OpenF1 and regenerate predictions"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Predictions
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  title="Clear predictions and start over"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cache info banner */}
      <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
        <p className="flex items-start gap-2">
          <span className="text-blue-500 shrink-0">ℹ️</span>
          <span>
            Race data is cached locally in layers (raw API: 24 h · session stats: 7 days · payload: 4 h).
            Most visits require <span className="font-semibold">zero API calls</span>.
            Use <span className="font-semibold">Refresh Predictions</span> to force a fresh fetch from OpenF1.
          </span>
        </p>
      </div>

      {/* Stale data warning */}
      {status === "success" && rawData?._stale && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="flex items-start gap-2">
            <span>⚠️</span>
            <span>
              OpenF1 could not be reached ({rawData._stale_reason?.replace(/^Failed.*?:\s*/, '') || 'network error'}).
              Predictions are based on <span className="font-semibold">previously cached race data</span> — results are still valid since historical data never changes.
            </span>
          </p>
        </div>
      )}

      {status === "idle" && (
        <EmptyState onGenerate={runPrediction} loading={false} />
      )}
      {status === "loading" && <LoadingState step={loadingStep} history={loadingHistory} />}
      {status === "error" && (
        <ErrorState error={errorMsg} onRetry={runPrediction} />
      )}

      {status === "success" && prediction && (
        <div className="space-y-6">
          {/* Analysis summary */}
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-gray-700 dark:text-gray-200 leading-relaxed">
                {prediction.analysis_summary}
              </p>
              {prediction.next_race_outlook && (
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700/50 pt-3 mt-3">
                  🏁 {prediction.next_race_outlook}
                </p>
              )}
              {prediction.budget_analysis && (
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed border-t border-gray-100 dark:border-gray-700/50 pt-3 mt-3">
                  💰 {prediction.budget_analysis}
                </p>
              )}

              {/* Value picks & risks */}
              <div className="flex flex-wrap gap-6 pt-3 mt-3 border-t border-gray-100 dark:border-gray-700/50">
                {prediction.value_picks?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                      💰 Value picks
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {prediction.value_picks.map((v) => (
                        <span
                          key={v}
                          className="text-sm bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/30 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {prediction.risks?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                      ⚠️ Risks
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {prediction.risks.map((r) => (
                        <span
                          key={r}
                          className="text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/30 text-red-700 dark:text-red-300 px-3 py-1 rounded-full"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drivers + Constructors grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Drivers */}
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Recommended Drivers <span className="text-gray-500 dark:text-gray-400 font-normal text-base">(5)</span>
              </h2>
              {prediction.recommended_drivers.map((d) => (
                <DriverCard key={d.abbreviation || d.full_name} driver={d} />
              ))}
            </div>

            {/* Constructors + sidebar */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Constructors <span className="text-gray-500 dark:text-gray-400 font-normal text-base">(2)</span>
              </h2>
              {prediction.recommended_constructors.map((c) => (
                <ConstructorCard key={c.team_name} constructor={c} />
              ))}

              {/* Data source summary */}
              {rawData?.recent_races?.length > 0 && (
                <Card>
                  <CardHeader>
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Data used ({rawData.data_window})
                    </h3>
                  </CardHeader>
                  <CardContent>
                    {rawData.recent_races.map((race, i) => (
                      <RecentRaceRow key={race.session_key ?? race.race_name ?? i} race={race} index={i} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              <Card>
                <CardContent>
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Generated {new Date(prediction.generated_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <StatusBadge confidence={prediction.data_confidence} />
                      {(() => {
                        const age = Date.now() - new Date(prediction.generated_at).getTime();
                        const hoursAgo = Math.floor(age / (1000 * 60 * 60));
                        if (hoursAgo > 0) {
                          return (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {hoursAgo}h ago
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {prediction.data_note && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        {prediction.data_note}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
