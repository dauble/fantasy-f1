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
import { buildPredictionPayload, clearPredictionCaches, getPracticeDataForUpcomingRace } from "../services/openf1DataService";
import { generatePredictions } from "../services/aiPredictionService";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import teamStorage from "../utils/teamStorage";
import { Link } from "react-router-dom";

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

function ApplyRecommendationsCard({ prediction, rawData, onApply, applied }) {
  if (!prediction?.recommended_drivers?.length) return null;

  // Calculate total changes to determine if we should show this card
  const rawCurrentTeam = rawData?.user_context?.current_team;
  if (rawCurrentTeam && !applied) {
    const currentDrivers = rawCurrentTeam.drivers || rawCurrentTeam.selectedDrivers || [];
    const currentConstructors = rawCurrentTeam.constructors || rawCurrentTeam.selectedConstructors || [];

    if (currentDrivers.length && currentConstructors.length) {
      // Build abbreviation → driver_number map from driver_trends
      const abbrevToNum = {};
      for (const d of (rawData.driver_trends || [])) {
        if (d.abbreviation) abbrevToNum[d.abbreviation] = Number(d.driver_number);
      }

      const currentDriverNums = new Set(currentDrivers.map(n => Number(n)));
      const currentConstructorNames = new Set(currentConstructors.map(n => String(n).toLowerCase().trim()));

      let addedDriversCount = 0;
      let addedConstructorsCount = 0;

      for (const d of (prediction.recommended_drivers || [])) {
        const num = abbrevToNum[d.abbreviation];
        if (num == null || !currentDriverNums.has(num)) addedDriversCount++;
      }
      for (const c of (prediction.recommended_constructors || [])) {
        if (!currentConstructorNames.has(String(c.team_name).toLowerCase().trim())) addedConstructorsCount++;
      }

      const totalChanges = addedDriversCount + addedConstructorsCount;

      // If AI recommends keeping exact team (0 changes), don't show this card
      if (totalChanges === 0) return null;
    }
  }

  const turbo = prediction.recommended_drivers.find(d => d.is_turbo_pick);
  const driverList = prediction.recommended_drivers.map(d => d.abbreviation).join(' · ');
  const constructorList = (prediction.recommended_constructors ?? []).map(c => c.team_name).join(' · ');

  if (applied) {
    return (
      <Card className="border-emerald-400 dark:border-emerald-600">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">✅</span>
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Team updated and saved!</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                AI recommendation is now your active team. Your previous team was backed up to{' '}
                <Link to="/history" className="underline font-medium">Team History</Link>{' '}
                and can be restored at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-base">
              Apply AI Recommendation
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Save this team as your current selection. Your existing team will be backed up to Team History.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 truncate">
              {driverList}
              {turbo && <span className="text-yellow-600 dark:text-yellow-400"> · ⚡ {turbo.abbreviation}</span>}
              <span className="mx-1.5 opacity-40">|</span>
              {constructorList}
            </p>
          </div>
          <button
            onClick={onApply}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide rounded-xl text-xs transition-colors shrink-0 shadow-lg shadow-emerald-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Apply &amp; Save Team
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamAssessmentCard({ prediction }) {
  const assessment = prediction?.current_team_assessment;
  const verdict = prediction?.team_verdict;
  if (!assessment?.length || !verdict) return null;

  const verdictConfig = {
    keep:     { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-700/30", text: "text-emerald-800 dark:text-emerald-300", icon: "✅", label: "Keep your team", sub: "Your current picks are solid for this race — no transfers needed." },
    partial:  { bg: "bg-amber-50 dark:bg-amber-900/20",     border: "border-amber-200 dark:border-amber-700/30",     text: "text-amber-800 dark:text-amber-300",   icon: "⚠️", label: "Consider a transfer or two", sub: "One or two swaps could improve your score given current form and practice data." },
    transfer: { bg: "bg-red-50 dark:bg-red-900/20",         border: "border-red-200 dark:border-red-700/30",         text: "text-red-800 dark:text-red-300",       icon: "🔄", label: "Multiple changes recommended", sub: "Several upgrades are available that justify the transfer penalty cost." },
  };
  const cfg = verdictConfig[verdict] || verdictConfig.partial;

  return (
    <Card>
      <CardHeader>
        <CardTitle>🏎️ Your Team Assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border mb-5 ${cfg.bg} ${cfg.border}`}>
          <span className="text-xl shrink-0">{cfg.icon}</span>
          <div>
            <p className={`font-semibold ${cfg.text}`}>{cfg.label}</p>
            <p className={`text-sm mt-0.5 ${cfg.text} opacity-80`}>{cfg.sub}</p>
          </div>
        </div>
        <div className="space-y-3">
          {assessment.map((pick, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
              <span className="text-base mt-0.5 shrink-0">{pick.verdict === 'keep' ? '✅' : '🔄'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{pick.identifier}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{pick.type}</span>
                  {pick.verdict === 'keep' && (
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/40 px-2 py-0.5 rounded-full">
                      Keep
                    </span>
                  )}
                  {pick.verdict === 'transfer' && pick.suggested_alternative && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40 px-2 py-0.5 rounded-full">
                      → {pick.suggested_alternative}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{pick.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TransferWarning({ prediction, rawData }) {
  const rawCurrentTeam = rawData?.user_context?.current_team;
  if (!rawCurrentTeam) return null;

  // Normalize current team shape to always have driver/constructor arrays
  const currentDrivers = rawCurrentTeam.drivers || rawCurrentTeam.selectedDrivers || [];
  const currentConstructors = rawCurrentTeam.constructors || rawCurrentTeam.selectedConstructors || [];

  if (!currentDrivers.length || !currentConstructors.length) return null;

  // Build abbreviation → driver_number map from driver_trends once
  const abbrevToNum = {};
  for (const d of (rawData.driver_trends || [])) {
    if (d.abbreviation) abbrevToNum[d.abbreviation] = Number(d.driver_number);
  }

  const currentDriverNums = new Set(currentDrivers.map(n => Number(n)));
  const currentConstructorNames = new Set(currentConstructors.map(n => String(n).toLowerCase().trim()));

  const addedDrivers = [];
  const addedConstructors = [];

  for (const d of (prediction.recommended_drivers || [])) {
    const num = abbrevToNum[d.abbreviation];
    if (num == null || !currentDriverNums.has(num)) addedDrivers.push(d.full_name || d.abbreviation);
  }
  for (const c of (prediction.recommended_constructors || [])) {
    if (!currentConstructorNames.has(String(c.team_name).toLowerCase().trim())) addedConstructors.push(c.team_name);
  }

  const totalChanges = addedDrivers.length + addedConstructors.length;
  const penalty = totalChanges * 30;

  if (totalChanges === 0) {
    return (
      <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-300">
        <p className="flex items-start gap-2">
          <span>✅</span>
          <span>This recommendation matches your current team — no transfer penalty!</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-4 text-sm">
      <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>Transfer penalty: {totalChanges} change{totalChanges !== 1 ? 's' : ''} = <strong>-{penalty} pts</strong></span>
      </p>
      <p className="text-amber-700 dark:text-amber-400 mb-3">
        Adopting this recommendation requires {totalChanges} transfer{totalChanges !== 1 ? 's' : ''} from your current team.
        Each change costs -30 pts in the official Fantasy F1 game.
      </p>
      {addedDrivers.length > 0 && (
        <div className="mb-1">
          <span className="font-medium text-amber-800 dark:text-amber-300">New drivers in: </span>
          <span className="text-amber-700 dark:text-amber-400">{addedDrivers.join(', ')}</span>
        </div>
      )}
      {addedConstructors.length > 0 && (
        <div>
          <span className="font-medium text-amber-800 dark:text-amber-300">New constructors in: </span>
          <span className="text-amber-700 dark:text-amber-400">{addedConstructors.join(', ')}</span>
        </div>
      )}
      <p className="mt-3 text-xs text-amber-600 dark:text-amber-500">
        💡 This team already accounts for transfer costs — picks were chosen for their net value after penalties.
        Use the <strong>Wildcard</strong> chip to rebuild without penalty.
      </p>
    </div>
  );
}

function APIErrorsSummary({ rawData }) {
  const apiErrors = rawData?.api_errors || [];

  if (!apiErrors || apiErrors.length === 0) return null;

  // Group errors by type and extract useful information
  const errorsByType = {
    rateLimit: [],
    notFound: [],
    serverError: [],
    networkError: [],
    fallback: [],
  };

  const sessionKeyPattern = /session_key=(\d+)/;
  const yearPattern = /year=(\d+)/;

  apiErrors.forEach(error => {
    const { url, statusCode, errorMessage, context } = error;

    // Check if this is a fallback indicator
    if (context?.isFallback) {
      errorsByType.fallback.push({
        source: context.source,
        reason: errorMessage,
      });
      return;
    }

    // Extract session key or year from URL
    const sessionMatch = url.match(sessionKeyPattern);
    const yearMatch = url.match(yearPattern);
    const endpoint = url.split('?')[0].split('/').pop();

    const errorInfo = {
      url,
      statusCode,
      errorMessage,
      endpoint,
      sessionKey: sessionMatch ? sessionMatch[1] : null,
      year: yearMatch ? yearMatch[1] : null,
      hadStaleCache: context?.hadStaleCache || false,
    };

    if (statusCode === 429) {
      errorsByType.rateLimit.push(errorInfo);
    } else if (statusCode === 404) {
      errorsByType.notFound.push(errorInfo);
    } else if (statusCode >= 500) {
      errorsByType.serverError.push(errorInfo);
    } else if (context?.networkError || statusCode === 0) {
      errorsByType.networkError.push(errorInfo);
    } else if (statusCode === 206 || context?.isPartialFailure) {
      // 206 = partial content (e.g. some news sources failed)
      errorsByType.serverError.push(errorInfo);
    }
  });

  // Count how many had stale cache fallback
  const recoveredCount = apiErrors.filter(e => e.context?.hadStaleCache).length;
  const totalErrors = apiErrors.length;

  // Find unique session keys and years that failed
  const failedSessions = new Set();
  const failedYears = new Set();

  [...errorsByType.notFound, ...errorsByType.serverError, ...errorsByType.rateLimit].forEach(err => {
    if (err.sessionKey) failedSessions.add(err.sessionKey);
    if (err.year) failedYears.add(err.year);
  });

  return (
    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4 text-sm">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</span>
        <div className="flex-1">
          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
            Not all data was fetched successfully
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            Predictions may be less accurate. {recoveredCount > 0 && `${recoveredCount} of ${totalErrors} failed requests used cached data as fallback.`}
          </p>
        </div>
      </div>

      {/* Year errors */}
      {failedYears.size > 0 && (
        <div className="mb-2 pl-7">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
            📅 Unavailable year data:
          </p>
          <ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-0.5">
            {Array.from(failedYears).map(year => (
              <li key={year}>
                Year {year} {errorsByType.rateLimit.some(e => e.year === year)
                  ? '(rate limited - too many requests)'
                  : '(data not yet available in OpenF1)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Session errors */}
      {failedSessions.size > 0 && (
        <div className="mb-2 pl-7">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
            🏁 Unavailable session data:
          </p>
          <p className="text-blue-700 dark:text-blue-400 mb-1">
            The following session keys failed to load data (likely race weekends not yet completed):
          </p>
          <ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-0.5">
            {Array.from(failedSessions).slice(0, 5).map(sessionKey => {
              const failedEndpoints = [...errorsByType.notFound, ...errorsByType.serverError]
                .filter(e => e.sessionKey === sessionKey)
                .map(e => e.endpoint);
              return (
                <li key={sessionKey}>
                  Session {sessionKey}: {[...new Set(failedEndpoints)].join(', ')}
                </li>
              );
            })}
            {failedSessions.size > 5 && (
              <li className="text-blue-600 dark:text-blue-500 italic">
                ...and {failedSessions.size - 5} more sessions
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Rate limit info */}
      {errorsByType.rateLimit.length > 0 && (
        <div className="pl-7">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
            ⏱️ Rate limits encountered:
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            {errorsByType.rateLimit.length} request{errorsByType.rateLimit.length !== 1 ? 's' : ''} hit rate limits.
            {errorsByType.rateLimit.some(e => e.hadStaleCache) ? ' Cached data was used where available.' : ' Try again in a few minutes.'}
          </p>
        </div>
      )}

      {/* Server errors */}
      {errorsByType.serverError.length > 0 && (
        <div className="mt-2 pl-7">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
            ⚠️ Server errors:
          </p>
          <p className="text-blue-700 dark:text-blue-400 mb-1">
            {errorsByType.serverError.length} request{errorsByType.serverError.length !== 1 ? 's' : ''} failed due to server issues.
            These may be temporary OpenF1 API problems.
          </p>
          <ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-0.5 mt-2">
            {errorsByType.serverError.slice(0, 5).map((err, i) => (
              <li key={i}>
                {err.endpoint && `${err.endpoint}`}
                {err.sessionKey && ` (session ${err.sessionKey})`}
                {err.year && ` (year ${err.year})`}
                {err.statusCode && ` - HTTP ${err.statusCode}`}
                {err.hadStaleCache && ' ✓ cached data used as fallback'}
              </li>
            ))}
            {errorsByType.serverError.length > 5 && (
              <li className="text-blue-600 dark:text-blue-500 italic">
                ...and {errorsByType.serverError.length - 5} more server errors
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Network / connectivity errors */}
      {errorsByType.networkError.length > 0 && (
        <div className="mt-2 pl-7">
          <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
            🌐 Network errors:
          </p>
          <ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-0.5">
            {errorsByType.networkError.map((err, i) => (
              <li key={i}>
                {err.url}{err.errorMessage ? ` — ${err.errorMessage}` : ''}
                {err.hadStaleCache ? ' (cached data used as fallback)' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fallback API usage */}
      {errorsByType.fallback.length > 0 && (
        <div className="mt-2 pl-7">
          <p className="font-medium text-emerald-800 dark:text-emerald-300 mb-1">
            ✅ Fallback data source used:
          </p>
          <ul className="list-disc list-inside text-emerald-700 dark:text-emerald-400 space-y-0.5">
            {errorsByType.fallback.map((fb, i) => (
              <li key={i}>
                {fb.reason}
              </li>
            ))}
          </ul>
          <p className="text-emerald-600 dark:text-emerald-500 mt-1 text-xs">
            Data was successfully retrieved from {errorsByType.fallback[0]?.source} as a backup source.
          </p>
        </div>
      )}
    </div>
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
  const [applied, setApplied] = useState(false);

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

      onProgress("🔍 Checking for practice session data this weekend…");
      let practiceData = null;
      try {
        practiceData = await getPracticeDataForUpcomingRace();
        if (practiceData?.length) {
          onProgress(`🏁 Found ${practiceData.length} completed practice session${practiceData.length !== 1 ? 's' : ''} — included in analysis`);
        } else {
          onProgress("🏁 No practice data yet this weekend — using race history only");
        }
      } catch (practiceErr) {
        console.warn("[predictions] Practice data unavailable:", practiceErr.message);
        onProgress("🏁 Practice data unavailable — continuing with race history");
      }

      const result = await generatePredictions({ ...payload, practice_data: practiceData }, onProgress);
      if (result.error) throw new Error(result.error_message);
      onProgress("✅ Predictions ready!");
      setPrediction(result);
      setStatus("success");
      setApplied(false);
      
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
    setApplied(false);
    localStorage.removeItem(PREDICTION_CACHE_KEY);
    clearPredictionCaches(raceCount);
    console.log("All prediction caches cleared");
  };

  const applyRecommendations = useCallback(() => {
    try {
      const raceName = rawData?.next_race?.name ?? rawData?.current_race?.name ?? 'upcoming race';

      // 1. Back up the current team before overwriting it
      teamStorage.saveBackupToHistory(`Pre-AI snapshot – ${raceName}`);

      // 2. Map recommended drivers to full objects via driver_trends
      const driverTrends = rawData?.driver_trends ?? [];
      const selectedDrivers = (prediction.recommended_drivers ?? []).map(rec => {
        // Derive driver_number from driver_trends using a stable key (abbreviation)
        const trend =
          driverTrends.find(d => d.abbreviation === rec.abbreviation) ??
          driverTrends.find(d => d.driver_number === rec.driver_number) ??
          {};
        const driver_number = rec.driver_number ?? trend.driver_number ?? null;
        return {
          driver_number,
          full_name: rec.full_name ?? trend.full_name ?? rec.abbreviation,
          abbreviation: rec.abbreviation ?? trend.abbreviation,
          team_name: rec.team_name ?? trend.team_name,
          team_colour: trend.team_colour ?? null,
          price: rec.price ?? trend.price ?? 20,
        };
      });

      const turboRec = prediction.recommended_drivers?.find(d => d.is_turbo_pick);
      const turboDriver = turboRec
        ? (selectedDrivers.find(d => d.abbreviation === turboRec.abbreviation) ?? null)
        : null;

      // 3. Map recommended constructors (price is in $M; multiply for raw storage)
      const selectedConstructors = (prediction.recommended_constructors ?? []).map(rec => ({
        team_name: rec.team_name,
        price: rec.price ?? 20,
      }));

      // 4. Total in raw dollars (prices are $M in the prediction payload)
      const totalSpent = [
        ...selectedDrivers.map(d => (d.price ?? 0) * 1_000_000),
        ...selectedConstructors.map(c => (c.price ?? 0) * 1_000_000),
      ].reduce((a, b) => a + b, 0);

      teamStorage.saveCurrentTeam({ selectedDrivers, selectedConstructors, turboDriver, totalSpent });
      syncToCloud?.();
      setApplied(true);
    } catch (err) {
      console.error('[predictions] Failed to apply recommendations:', err);
    }
  }, [prediction, rawData, syncToCloud]);

  return (
    <div className="px-4 py-5">
      {/* Page header */}
      <div className="mb-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-1 dark:text-white flex items-center gap-3">
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
                  className="px-4 py-2 bg-f1-red hover:bg-f1-red-dark text-xs font-black uppercase tracking-wide text-white rounded-xl transition-colors flex items-center gap-1.5"
                  title="Fetch fresh data from OpenF1 and regenerate predictions"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-xs font-black uppercase tracking-wide text-gray-700 dark:text-white rounded-xl transition-colors"
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
            Race data is cached locally in layers (raw API: 24 h · session stats: 14 days · payload: 4 h).
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
          <ApplyRecommendationsCard prediction={prediction} rawData={rawData} onApply={applyRecommendations} applied={applied} />
          <APIErrorsSummary rawData={rawData} />
          <TransferWarning prediction={prediction} rawData={rawData} />
          <TeamAssessmentCard prediction={prediction} />

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
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-1 h-5 bg-f1-red rounded-full inline-block" />
                Recommended Drivers <span className="text-f1-muted font-bold text-sm">(5)</span>
              </h2>
              {prediction.recommended_drivers.map((d) => (
                <DriverCard key={d.abbreviation || d.full_name} driver={d} />
              ))}
            </div>

            {/* Constructors + sidebar */}
            <div className="space-y-4">
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-1 h-5 bg-f1-red rounded-full inline-block" />
                Constructors <span className="text-f1-muted font-bold text-sm">(2)</span>
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
