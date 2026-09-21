/**
 * openf1RateLimiter.js
 *
 * Shared request queue that every OpenF1-bound fetch (from openF1API.js and
 * openf1DataService.js) must go through, so the app can never burst past
 * OpenF1's Community (free) tier limits — confirmed at openf1.org as
 * 3 requests/second and 30 requests/minute — no matter which page,
 * component, or Promise.all branch happens to trigger the call.
 *
 * Same algorithm as the rate limiter in the countdown-to-f1 project's
 * Cloudflare Worker (cloudflare-worker/worker.js): a shared promise-chain
 * queue plus a rolling timestamp window, staying comfortably under the
 * documented ceiling rather than skating right at it, with one retry on
 * HTTP 429 honoring Retry-After.
 */

const MIN_INTERVAL_MS = 400; // 2.5 req/s ceiling
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 28; // per-minute ceiling, under the documented 30/min

let queueTail = Promise.resolve();
const requestTimestamps = [];

function pruneWindow(now) {
  while (requestTimestamps.length && now - requestTimestamps[0] >= WINDOW_MS) {
    requestTimestamps.shift();
  }
}

async function waitForSlot() {
  const now = Date.now();
  pruneWindow(now);

  let waitMs = 0;
  const lastRequestAt = requestTimestamps[requestTimestamps.length - 1];
  if (lastRequestAt !== undefined) {
    const sinceLast = now - lastRequestAt;
    if (sinceLast < MIN_INTERVAL_MS) {
      waitMs = MIN_INTERVAL_MS - sinceLast;
    }
  }

  if (requestTimestamps.length >= WINDOW_LIMIT) {
    const windowWait = WINDOW_MS - (now - requestTimestamps[0]) + 10;
    waitMs = Math.max(waitMs, windowWait);
  }

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  requestTimestamps.push(Date.now());
}

/**
 * Fetch a URL through the shared OpenF1 rate limiter. Drop-in replacement
 * for `fetch()` — returns a standard Response, retrying once on HTTP 429
 * using the Retry-After header.
 */
export function rateLimitedFetch(url, options = {}) {
  const task = queueTail.then(async () => {
    await waitForSlot();

    const { signal: callerSignal, ...restOptions } = options;
    const doFetch = () =>
      fetch(url, { ...restOptions, signal: callerSignal ?? AbortSignal.timeout(10000) });

    let response = await doFetch();

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      let retryAfterMs = 2000;
      if (retryAfterHeader) {
        const seconds = parseFloat(retryAfterHeader);
        if (!isNaN(seconds)) {
          retryAfterMs = seconds * 1000;
        } else {
          const date = new Date(retryAfterHeader);
          if (!isNaN(date.getTime())) {
            retryAfterMs = Math.max(date.getTime() - Date.now(), 0);
          }
        }
      }
      console.warn(`OpenF1 rate limit hit for ${url}, retrying after ${retryAfterMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfterMs, 1000)));
      await waitForSlot();
      response = await doFetch();
    }

    return response;
  });

  // Keep the queue alive even if this task's caller doesn't handle rejection.
  queueTail = task.catch(() => {});
  return task;
}

export default rateLimitedFetch;
