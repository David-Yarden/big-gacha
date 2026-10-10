/**
 * Local copy of every image the site shows.
 *
 * Walks all documents for image URLs of the known game CDNs and downloads the ones not
 * yet in cache/img/ (the same files /api/img serves). Runs in the background after each
 * sync that changed something and once at start-up; a few downloads at a time, so the
 * CDNs are not hammered. Already-copied images are skipped, so later runs are quick.
 */
const fs = require("fs");
const mongoose = require("mongoose");
const img = require("../routes/img");

const CONCURRENCY = 4;
// An image the CDN answered 404 for is retried only after this long (the source deleted it;
// genshin-db, for one, still lists old HoYoLAB and wiki links the site never shows)
const GONE_RETRY_MS = 7 * 24 * 3600 * 1000;
const goneMarker = (url) => `${img.cacheFile(url)}.404`;
function recentlyGone(url) {
  try {
    return Date.now() - fs.statSync(goneMarker(url)).mtimeMs < GONE_RETRY_MS;
  } catch {
    return false;
  }
}
const IMAGE_RE = /\.(png|webp|jpe?g|gif)(\?|$)|\/revision\/latest|\/images\/thumb\//i;

let state = { running: false, total: 0, cached: 0, done: 0, failed: 0, gone: 0, startedAt: null, finishedAt: null, sizeMB: null, failures: [] };

/** Every image URL found in the documents (deep walk of each document). */
async function collectUrls() {
  const urls = new Set();
  // Genshin documents store image file names (genshin-db "filename_*"), turned into URLs by
  // the client (client/src/lib/images.ts): Enka for everything, gi.yatta.moe for materials
  let genshinCdn = null;
  const walk = (v, key = "") => {
    if (typeof v === "string") {
      if (v.startsWith("https://") && IMAGE_RE.test(v) && img.allowed(v)) urls.add(v);
      else if (genshinCdn && key.startsWith("filename_") && /^UI_[\w-]+$/.test(v)) urls.add(`${genshinCdn}/${v}.png`);
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, key));
    } else if (v && typeof v === "object" && !(v instanceof Date) && v._bsontype !== "ObjectId") {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  for (const name of mongoose.modelNames()) {
    if (["SyncState", "Changelog", "Plan"].includes(name)) continue;
    const docs = await mongoose.model(name).find({}).lean();
    for (const doc of docs) {
      genshinCdn = doc.game === "genshin" ? (name === "Material" ? "https://gi.yatta.moe/assets/UI" : "https://enka.network/ui") : null;
      walk(doc);
    }
  }
  return [...urls];
}

function cacheSizeMB() {
  try {
    let bytes = 0;
    for (const f of fs.readdirSync(img.DIR)) bytes += fs.statSync(`${img.DIR}/${f}`).size;
    return Math.round(bytes / 1024 / 1024);
  } catch {
    return 0;
  }
}

/** Copy the missing images. Returns the final state; a second call while running is ignored. */
async function mirrorImages() {
  if (state.running) return state;
  state = { running: true, total: 0, cached: 0, done: 0, failed: 0, gone: 0, startedAt: new Date(), finishedAt: null, sizeMB: null, failures: [] };
  // Why an image was not copied: { url, status } (HTTP status, 415 = not an image, 302 = too big, or the error)
  const fail = (url, status) => {
    state.failed++;
    if (state.failures.length < 2000) state.failures.push({ url, status });
  };
  try {
    const urls = await collectUrls();
    const notCached = urls.filter((u) => !fs.existsSync(img.cacheFile(u)));
    const missing = notCached.filter((u) => !recentlyGone(u));
    state.total = urls.length;
    state.cached = urls.length - notCached.length;
    state.gone = notCached.length - missing.length; // deleted at the source, skipped for now
    let i = 0;
    const worker = async () => {
      while (i < missing.length) {
        const url = missing[i++];
        try {
          const status = await img.ensureCached(url);
          if (status === 200) state.done++;
          else fail(url, status);
          if (status === 404) fs.writeFileSync(goneMarker(url), "");
        } catch (err) {
          fail(url, err.name === "TimeoutError" ? "timeout" : err.cause?.code || err.message);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`🖼  Images: ${state.cached + state.done}/${state.total} en local (${state.failed} en échec, ${state.gone} supprimées à la source)`);
  } catch (err) {
    console.warn("⚠  Copie des images en échec :", err.message);
  } finally {
    state.running = false;
    state.finishedAt = new Date();
    state.sizeMB = cacheSizeMB();
  }
  // Then re-encode the new big PNGs to lossless WebP (background, needs `sharp`)
  require("./imageCompress").compressCache().catch(() => {});
  return state;
}

/** Progress; the failure list only on request (it can be long) */
const mirrorStatus = (withFailures = false) => (withFailures ? state : { ...state, failures: state.failures.length });

module.exports = { mirrorImages, mirrorStatus, collectUrls };
