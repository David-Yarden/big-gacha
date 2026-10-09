/**
 * Network helper for every data source: timeout, retries with backoff, User-Agent.
 * A slow or flaky source makes a sync fail cleanly instead of hanging for minutes.
 */
const UA = "big-gacha-sync (personal tool)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {{ timeout?: number, retries?: number, headers?: object, as?: "json"|"text" }} [opts]
 *   timeout — per attempt, ms (default 60 s; use more for big files)
 *   retries — extra attempts on network errors, 5xx and 429 (default 2)
 */
async function fetchData(url, { timeout = 60_000, retries = 2, headers = {}, as = "json" } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(timeout) });
      if (res.ok) return as === "text" ? await res.text() : await res.json();
      const err = new Error(`${url}: HTTP ${res.status}`);
      err.status = res.status;
      // 4xx (except 429) will not get better by retrying
      if (res.status < 500 && res.status !== 429) throw Object.assign(err, { fatal: true });
      lastErr = err;
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err.name === "TimeoutError" ? new Error(`${url}: no answer after ${timeout / 1000}s`) : err;
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw lastErr;
}

/** Like fetchData but returns null instead of throwing (optional, secondary sources). */
async function tryFetch(url, opts) {
  try {
    return await fetchData(url, { retries: 1, ...opts });
  } catch {
    return null;
  }
}

module.exports = { fetchData, tryFetch };
