/**
 * GET /api/img?u=<image URL> — local image cache for icons.
 *
 * The first request downloads the image from its CDN and keeps it in cache/img/;
 * later requests (and the browser, for 30 days) never hit the CDN again, so icons
 * stay fast and keep working if a CDN is slow or down. Only known game CDNs are
 * proxied, and big files (splash art) are not cached: the browser is redirected.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();
const DIR = path.join(__dirname, "..", "..", "cache", "img");
const MAX_CACHED = 1.5 * 1024 * 1024; // icons are well under this; splash art is not
const ALLOWED = [
  "githubusercontent.com", "encore.moe", "yatta.moe", "enka.network", "jmp.blue",
  "hoyolab.com", "mihoyo.com", "hoyoverse.com", "wikia.nocookie.net", "nanoka.cc", "gachabase.net",
];
const TYPES = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml" };
const inflight = new Map();

function allowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "big-gacha (personal tool)" } });
  if (!res.ok) return { status: res.status };
  const type = (res.headers.get("content-type") || "").split(";")[0];
  if (!type.startsWith("image/")) return { status: 415 };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(DIR, { recursive: true });
  if (buf.length > MAX_CACHED) {
    fs.writeFileSync(`${file}.big`, ""); // remembered: redirect straight away next time
    return { status: 302 };
  }
  fs.writeFileSync(file, buf);
  fs.writeFileSync(`${file}.type`, type);
  return { status: 200 };
}

router.get("/", async (req, res) => {
  const url = String(req.query.u || "");
  if (!allowed(url)) return res.status(400).json({ success: false, error: "Image host not allowed" });

  const file = path.join(DIR, crypto.createHash("sha1").update(url).digest("hex"));
  const send = () => {
    let type = "application/octet-stream";
    try {
      type = fs.readFileSync(`${file}.type`, "utf8");
    } catch {
      type = TYPES[path.extname(new URL(url).pathname).toLowerCase()] || type;
    }
    res.set({ "Content-Type": type, "Cache-Control": "public, max-age=2592000, immutable" });
    fs.createReadStream(file).pipe(res);
  };

  if (fs.existsSync(file)) return send();
  if (fs.existsSync(`${file}.big`)) return res.redirect(302, url);

  try {
    if (!inflight.has(file)) inflight.set(file, download(url, file).finally(() => inflight.delete(file)));
    const { status } = await inflight.get(file);
    if (status === 200) return send();
    if (status === 302) return res.redirect(302, url); // big image: straight from its CDN
    res.status(status === 404 ? 404 : 502).end();
  } catch {
    res.redirect(302, url); // CDN slow/unreachable from the server: let the browser try
  }
});

module.exports = router;
