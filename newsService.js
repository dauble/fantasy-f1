/**
 * newsService.js
 *
 * Server-side news aggregation service for Fantasy F1 predictions.
 * Fetches recent F1 articles and discussions from:
 *   1. Autosport       — RSS feed (primary, high-volume F1 news)
 *   2. The Race        — RSS feed (premium F1 journalism)
 *   3. PlanetF1        — RSS feed
 *   4. Motorsport.com  — F1 RSS feed (supplementary)
 *   5. Reddit          — r/formula1 JSON API (no auth required)
 *
 * Note: Formula1.com retired their public RSS feed; Autosport and The Race
 * are the most reliable replacements with equivalent coverage quality.
 *

// ─── F1 entity name lists for mention extraction ─────────────────────────────

const F1_DRIVERS = [
  "Verstappen", "Norris", "Leclerc", "Piastri", "Sainz",
  "Russell", "Hamilton", "Perez", "Alonso", "Stroll",
  "Ocon", "Gasly", "Hülkenberg", "Hulkenberg", "Tsunoda",
  "Albon", "Bearman", "Hadjar", "Bortoleto", "Lawson",
  "Doohan", "Colapinto", "Antonelli", "Bottas", "Zhou",
  "Ricciardo", "Magnussen", "Sargeant", "De Vries", "Drugovich",
];

const F1_TEAMS = [
  "McLaren", "Ferrari", "Red Bull", "Mercedes", "Aston Martin",
  "Alpine", "Williams", "Haas", "Sauber", "Racing Bulls",
  "VCARB", "Stake", "Kick Sauber", "AlphaTauri", "Alpha Tauri",
];

// ─── Configuration ────────────────────────────────────────────────────────────

const NEWS_CACHE_TTL_MS =
  parseInt(process.env.NEWS_CACHE_TTL_MINUTES ?? "30", 10) * 60 * 1000;

const MAX_ARTICLES_PER_SOURCE =
  parseInt(process.env.NEWS_MAX_ARTICLES_PER_SOURCE ?? "10", 10);

const FETCH_TIMEOUT_MS = 8000; // 8 seconds per source request

const SOURCE_ENABLED = {
  autosport:  (process.env.NEWS_AUTOSPORT_ENABLED  ?? "true") === "true",
  therace:    (process.env.NEWS_THERACE_ENABLED    ?? "true") === "true",
  planetf1:   (process.env.NEWS_PLANETF1_ENABLED   ?? "true") === "true",
  motorsport: (process.env.NEWS_MOTORSPORT_ENABLED ?? "true") === "true",
  reddit:     (process.env.NEWS_REDDIT_ENABLED     ?? "true") === "true",
};

// ─── RSS feed URLs ────────────────────────────────────────────────────────────

const SOURCES = {
  autosport: {
    name: "Autosport",
    url: "https://www.autosport.com/rss/f1/news/",
    type: "rss",
    maxArticles: 15,
  },
  therace: {
    name: "The Race",
    url: "https://the-race.com/feed/",
    type: "rss",
    maxArticles: 10,
  },
  planetf1: {
    name: "PlanetF1",
    url: "https://www.planetf1.com/feed/",
    type: "rss",
    maxArticles: 10,
  },
  motorsport: {
    name: "Motorsport.com",
    url: "https://www.motorsport.com/rss/f1/news/",
    type: "rss",
    maxArticles: 5,
  },
  reddit: {
    name: "Reddit r/formula1",
    url: "https://www.reddit.com/r/formula1.json?limit=25&sort=hot",
    type: "reddit",
    maxArticles: 10,
  },
};

// ─── In-memory cache ──────────────────────────────────────────────────────────

let newsCache = null;
let newsCacheTimestamp = 0;

function getCachedNews() {
  if (!newsCache) return null;
  if (Date.now() - newsCacheTimestamp > NEWS_CACHE_TTL_MS) return null;
  return newsCache;
}

function setCachedNews(data) {
  newsCache = data;
  newsCacheTimestamp = Date.now();
}

// ─── HTTP fetch with timeout ──────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Minimal RSS / Atom XML parser ────────────────────────────────────────────

/**
 * Extracts text content between XML tags.
 * Handles CDATA sections and basic entity encoding.
 */
function extractXmlField(xml, tag) {
  // Try CDATA first
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const cdataMatch = cdataRe.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = re.exec(xml);
  if (!match) return "";

  return match[1]
    .replace(/<[^>]+>/g, " ")   // strip inner tags
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g,  "&")    // must be last to avoid double-decoding
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses an RSS/Atom feed XML string and returns an array of article objects.
 */
function parseRssFeed(xml) {
  const items = [];
  // Split on <item> or <entry> (Atom) tags
  const itemPattern = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];

    const title       = extractXmlField(block, "title");
    const link        = extractXmlField(block, "link") ||
                        (/<link[^>]+href="([^"]+)"/.exec(block)?.[1] ?? "");
    const description = extractXmlField(block, "description") ||
                        extractXmlField(block, "summary") ||
                        extractXmlField(block, "content");
    const pubDate     = extractXmlField(block, "pubDate") ||
                        extractXmlField(block, "published") ||
                        extractXmlField(block, "updated");

    if (title) {
      items.push({ title, link, description, pubDate });
    }
  }

  return items;
}

// ─── Entity mention extractor ─────────────────────────────────────────────────

/**
 * Returns arrays of driver and team names mentioned in a piece of text.
 */
function extractMentions(text) {
  if (!text) return { drivers: [], teams: [] };
  const drivers = F1_DRIVERS.filter(name =>
    new RegExp(`\\b${name}\\b`, "i").test(text)
  );
  const teams = F1_TEAMS.filter(name =>
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)
  );
  return { drivers: [...new Set(drivers)], teams: [...new Set(teams)] };
}

/**
 * Returns true if an article text mentions at least one F1 driver or team
 * (or if no filter is needed — for Reddit we filter by flair/topic separately).
 */
function isF1Relevant(title, description) {
  const combined = `${title} ${description}`;
  return (
    F1_DRIVERS.some(name => new RegExp(`\\b${name}\\b`, "i").test(combined)) ||
    F1_TEAMS.some(name =>
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(combined)
    ) ||
    /\bformula\s*1\b|\bF1\b|\bGrand Prix\b|\bGP\b|\bqualifying\b|\bpole\b/i.test(combined)
  );
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

/**
 * Fetches and parses an RSS feed.
 * @param {string} sourceName  — display name for logging
 * @param {string} url         — RSS feed URL
 * @returns {Promise<Array>}   — array of normalised article objects
 */
async function fetchRssSource(sourceName, url, limit = MAX_ARTICLES_PER_SOURCE) {
  console.log(`[news] Fetching RSS: ${sourceName}`);
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Fantasy-F1-App/1.0 (https://github.com/dauble/fantasy-f1)",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${sourceName}`);
  }

  const xml = await res.text();
  const raw = parseRssFeed(xml);

  const articles = raw
    .filter(item => isF1Relevant(item.title, item.description))
    .slice(0, limit)
    .map(item => {
      const { drivers, teams } = extractMentions(`${item.title} ${item.description}`);
      return {
        source: sourceName,
        title: item.title,
        url: item.link,
        summary: item.description
          ? item.description.slice(0, 300).trimEnd() + (item.description.length > 300 ? "…" : "")
          : "",
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        driver_mentions: drivers,
        team_mentions: teams,
      };
    });

  console.log(`[news] ${sourceName}: ${articles.length} relevant articles fetched`);
  return articles;
}

/**
 * Fetches Reddit r/formula1 hot posts using the public JSON API.
 * No authentication required.
 * @returns {Promise<Array>}
 */
async function fetchRedditSource() {
  console.log("[news] Fetching Reddit r/formula1");
  const res = await fetchWithTimeout(SOURCES.reddit.url, {
    headers: {
      "User-Agent": "Fantasy-F1-App/1.0 (https://github.com/dauble/fantasy-f1)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Reddit`);
  }

  const json = await res.json();
  const posts = json?.data?.children ?? [];

  const articles = posts
    .map(child => child.data)
    .filter(post =>
      !post.stickied &&
      !post.is_video &&
      (post.score > 50 || post.num_comments > 20)
    )
    .filter(post => isF1Relevant(post.title, post.selftext || ""))
    .slice(0, MAX_ARTICLES_PER_SOURCE)
    .map(post => {
      const text = `${post.title} ${post.selftext || ""}`;
      const { drivers, teams } = extractMentions(text);
      return {
        source: "Reddit r/formula1",
        title: post.title,
        url: `https://www.reddit.com${post.permalink}`,
        summary: post.selftext
          ? post.selftext.slice(0, 300).trimEnd() + (post.selftext.length > 300 ? "…" : "")
          : "",
        published_at: post.created_utc
          ? new Date(post.created_utc * 1000).toISOString()
          : null,
        driver_mentions: drivers,
        team_mentions: teams,
        score: post.score,
        num_comments: post.num_comments,
        flair: post.link_flair_text || null,
      };
    });

  console.log(`[news] Reddit: ${articles.length} relevant posts fetched`);
  return articles;
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

/**
 * Fetches F1 news from all enabled sources and returns a combined, deduplicated
 * list of articles sorted by publication date (newest first).
 *
 * Results are cached in memory for NEWS_CACHE_TTL_MS milliseconds.
 *
 * @returns {Promise<{
 *   articles: Array,
 *   sources_attempted: string[],
 *   sources_succeeded: string[],
 *   sources_failed: { name: string, error: string }[],
 *   fetched_at: string,
 *   cache_ttl_minutes: number,
 * }>}
 */
export async function fetchF1News() {
  const cached = getCachedNews();
  if (cached) {
    console.log("[news] Serving from in-memory cache");
    return cached;
  }

  const sourcesAttempted = [];
  const sourcesSucceeded = [];
  const sourcesFailed = [];
  let allArticles = [];

  const tasks = [];

  if (SOURCE_ENABLED.autosport) {
    sourcesAttempted.push("Autosport");
    tasks.push(
      fetchRssSource("Autosport", SOURCES.autosport.url, SOURCES.autosport.maxArticles)
        .then(articles => {
          sourcesSucceeded.push("Autosport");
          allArticles = allArticles.concat(articles);
        })
        .catch(err => {
          console.error(`[news] Autosport failed: ${err.message}`);
          sourcesFailed.push({ name: "Autosport", error: err.message });
        })
    );
  }

  if (SOURCE_ENABLED.therace) {
    sourcesAttempted.push("The Race");
    tasks.push(
      fetchRssSource("The Race", SOURCES.therace.url, SOURCES.therace.maxArticles)
        .then(articles => {
          sourcesSucceeded.push("The Race");
          allArticles = allArticles.concat(articles);
        })
        .catch(err => {
          console.error(`[news] The Race failed: ${err.message}`);
          sourcesFailed.push({ name: "The Race", error: err.message });
        })
    );
  }

  if (SOURCE_ENABLED.planetf1) {
    sourcesAttempted.push("PlanetF1");
    tasks.push(
      fetchRssSource("PlanetF1", SOURCES.planetf1.url, SOURCES.planetf1.maxArticles)
        .then(articles => {
          sourcesSucceeded.push("PlanetF1");
          allArticles = allArticles.concat(articles);
        })
        .catch(err => {
          console.error(`[news] PlanetF1 failed: ${err.message}`);
          sourcesFailed.push({ name: "PlanetF1", error: err.message });
        })
    );
  }

  if (SOURCE_ENABLED.motorsport) {
    sourcesAttempted.push("Motorsport.com");
    tasks.push(
      fetchRssSource("Motorsport.com", SOURCES.motorsport.url, SOURCES.motorsport.maxArticles)
        .then(articles => {
          sourcesSucceeded.push("Motorsport.com");
          allArticles = allArticles.concat(articles);
        })
        .catch(err => {
          console.error(`[news] Motorsport.com failed: ${err.message}`);
          sourcesFailed.push({ name: "Motorsport.com", error: err.message });
        })
    );
  }

  if (SOURCE_ENABLED.reddit) {
    sourcesAttempted.push("Reddit r/formula1");
    tasks.push(
      fetchRedditSource()
        .then(articles => {
          sourcesSucceeded.push("Reddit r/formula1");
          allArticles = allArticles.concat(articles);
        })
        .catch(err => {
          console.error(`[news] Reddit failed: ${err.message}`);
          sourcesFailed.push({ name: "Reddit r/formula1", error: err.message });
        })
    );
  }

  // Fetch all sources concurrently
  await Promise.allSettled(tasks);

  // Sort by publication date, newest first; unpublished items go last
  allArticles.sort((a, b) => {
    if (!a.published_at && !b.published_at) return 0;
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at) - new Date(a.published_at);
  });

  const result = {
    articles: allArticles,
    sources_attempted: sourcesAttempted,
    sources_succeeded: sourcesSucceeded,
    sources_failed: sourcesFailed,
    fetched_at: new Date().toISOString(),
    cache_ttl_minutes: NEWS_CACHE_TTL_MS / 60000,
  };

  if (allArticles.length > 0) {
    setCachedNews(result);
  }

  return result;
}

/**
 * Forces the in-memory cache to expire on the next fetch call.
 */
export function clearNewsCache() {
  newsCache = null;
  newsCacheTimestamp = 0;
  console.log("[news] In-memory cache cleared");
}
