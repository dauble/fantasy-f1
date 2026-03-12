/**
 * newsService.js (client-side)
 *
 * Fetches F1 news from the server-side /api/news endpoint.
 * Caches results in localStorage to avoid redundant network requests.
 *
 * The server aggregates articles from:
 *   - PlanetF1       (https://www.planetf1.com/feed/)
 *   - Motorsport.com (https://www.motorsport.com/rss/f1/news/)
 *   - Reddit         (https://www.reddit.com/r/formula1/)
 */

const NEWS_CACHE_KEY = "f1_news_data_v1";
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Cache helpers ────────────────────────────────────────────────────────────

function getNewsFromCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > NEWS_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setNewsCache(data) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage errors
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches recent F1 news articles from the server, with localStorage caching.
 *
 * @returns {Promise<{
 *   articles: Array<{
 *     source: string,
 *     title: string,
 *     url: string,
 *     summary: string,
 *     published_at: string|null,
 *     driver_mentions: string[],
 *     team_mentions: string[],
 *   }>,
 *   sources_succeeded: string[],
 *   sources_failed: Array<{name: string, error: string}>,
 *   fetched_at: string,
 * }>}
 */
export async function fetchF1News() {
  const cached = getNewsFromCache();
  if (cached) return cached;

  try {
    const res = await fetch("/api/news");
    if (!res.ok) {
      throw new Error(`News API returned ${res.status}`);
    }
    const data = await res.json();
    if (data.articles && data.articles.length > 0) {
      setNewsCache(data);
    }
    return data;
  } catch (err) {
    console.warn("[newsService] Failed to fetch news:", err.message);
    return {
      articles: [],
      sources_attempted: [],
      sources_succeeded: [],
      sources_failed: [{ name: "all", error: err.message }],
      fetched_at: new Date().toISOString(),
      error: err.message,
    };
  }
}

/**
 * Clears the cached news data from localStorage.
 * Useful when the user wants to force a fresh fetch.
 */
export function clearNewsCache() {
  try {
    localStorage.removeItem(NEWS_CACHE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Builds a compact news context string suitable for inclusion in the
 * Claude AI prediction prompt. Groups articles by driver/team mentions
 * and limits the total size to avoid excessive token usage.
 *
 * @param {Object} newsData — result from fetchF1News()
 * @param {number} maxArticles — maximum number of articles to include (default 15)
 * @returns {string}
 */
export function buildNewsContext(newsData, maxArticles = 15) {
  if (!newsData?.articles?.length) return "";

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days

  const relevant = newsData.articles
    .filter(a => !a.published_at || new Date(a.published_at).getTime() > recentCutoff)
    .slice(0, maxArticles);

  if (!relevant.length) return "";

  const lines = relevant.map(a => {
    const age = a.published_at
      ? `(${getRelativeAge(a.published_at)})`
      : "(date unknown)";
    const entities = [
      ...a.driver_mentions.slice(0, 3),
      ...a.team_mentions.slice(0, 2),
    ].join(", ");
    const entityStr = entities ? ` [${entities}]` : "";
    const summary = a.summary ? ` — ${a.summary.slice(0, 150)}` : "";
    return `  • [${a.source}] ${age} ${a.title}${entityStr}${summary}`;
  });

  const sourceSummary = newsData.sources_succeeded?.length
    ? `Sources: ${newsData.sources_succeeded.join(", ")}`
    : "Limited news data available";

  return `RECENT F1 NEWS & COMMUNITY DISCUSSIONS (${sourceSummary}):\n${lines.join("\n")}`;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getRelativeAge(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "< 1h ago";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
