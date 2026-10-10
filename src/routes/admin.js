/**
 * /api/admin — maintenance actions for the local tool.
 */
const express = require("express");
const { isRunning } = require("../sync/engine");

const router = express.Router();

// POST /api/admin/restart — reload the API with the latest code (needs `npm run dev`)
router.post("/restart", (req, res) => {
  if (process.env.BIG_GACHA_SUPERVISED !== "1") {
    return res.status(409).json({ success: false, error: "Redémarrage automatique indisponible : lance le serveur avec `npm run dev`." });
  }
  if (isRunning()) {
    return res.status(409).json({ success: false, error: `Une synchro est en cours (${isRunning()}), réessaie après.` });
  }
  res.json({ success: true, data: { restarting: true } });
  setTimeout(() => process.exit(75), 200);
});

// GET /api/admin/images — progress of the local image copy; POST starts it
router.get("/images", (req, res) => {
  // ?failures=1 — also list the images that could not be copied, and why
  res.json({
    success: true,
    data: { ...require("../sync/imageMirror").mirrorStatus(req.query.failures === "1"), compress: require("../sync/imageCompress").compressStatus() },
  });
});
// POST /api/admin/images/compress — re-encode the big cached PNGs to lossless WebP now
router.post("/images/compress", (req, res) => {
  const c = require("../sync/imageCompress");
  if (!c.compressStatus().running) c.compressCache().catch(() => {});
  res.json({ success: true, data: c.compressStatus() });
});
router.post("/images", (req, res) => {
  const mirror = require("../sync/imageMirror");
  if (!mirror.mirrorStatus().running) mirror.mirrorImages().catch(() => {});
  res.json({ success: true, data: mirror.mirrorStatus() });
});

// POST /api/admin/selftest — run the test suite (node --test) and return its summary
router.post("/selftest", (req, res, next) => {
  const { execFile } = require("child_process");
  const path = require("path");
  execFile(
    process.execPath,
    ["--test", "--test-reporter=spec"],
    { cwd: path.join(__dirname, "..", ".."), timeout: 120_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    (err, stdout, stderr) => {
      const out = `${stdout}\n${stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
      res.json({ success: !err, data: { ok: !err, output: out.slice(-12000) } });
    }
  );
});

// POST /api/admin/probe {url} — fetch a game-data URL from the server (integration checks).
// Only known game data hosts; returns status, size and the start of the body.
const PROBE_HOSTS = [
  "hakush.in", "githubusercontent.com", "github.com", "encore.moe", "yatta.moe", "enka.network",
  "hoyolab.com", "hoyoverse.com", "mihoyo.com", "wikia.nocookie.net", "nanoka.cc", "gachabase.net",
];
router.post("/probe", async (req, res) => {
  try {
    const url = new URL(String(req.body?.url || ""));
    if (url.protocol !== "https:" || !PROBE_HOSTS.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) {
      return res.status(400).json({ success: false, error: "Host not allowed" });
    }
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "big-gacha (personal tool)" } });
    const text = await r.text();
    const max = Math.min(200_000, Number(req.body?.max) || 4000);
    res.json({ success: true, data: { status: r.status, type: r.headers.get("content-type"), size: text.length, body: text.slice(0, max) } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
