/**
 * Lossless re-encoding of the big PNG images of the local image copy (cache/img) to WebP.
 *
 * Lossless WebP keeps every pixel: each converted image is decoded again and compared
 * pixel by pixel with the original PNG (only fully transparent pixels may differ — their
 * hidden colour is never shown); if anything differs, or WebP is not smaller, the PNG is
 * kept. JPEG and WebP files are left alone (re-encoding them losslessly would only grow
 * them). Needs the `sharp` package (npm install); without it nothing happens.
 *
 * Runs after each image copy pass and for each new big PNG; POST /api/admin/images/compress
 * starts it by hand. A file is converted in place (same name, its `.type` becomes
 * image/webp), so /api/img keeps serving it at the same URL.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "cache", "img");
const MIN_BYTES = 100 * 1024; // icons are small already: only the big art is worth it
const HASH_NAME = /^[0-9a-f]{40}$/;

let state = { running: false, candidates: 0, converted: 0, kept: 0, errors: 0, savedMB: 0, startedAt: null, finishedAt: null, error: null };

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

const typeOf = (file) => {
  try {
    return fs.readFileSync(`${file}.type`, "utf8").trim();
  } catch {
    return "";
  }
};

/** RGBA pixels of an image (decoded by sharp). */
async function pixels(sharp, buf) {
  return sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** True when both images show exactly the same pixels (fully transparent ones aside). */
function samePixels(a, b) {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.data.length !== b.data.length) return false;
  const x = a.data;
  const y = b.data;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] !== y[i + 3]) return false;
    if (x[i + 3] === 0) continue; // invisible pixel: its colour does not matter
    if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) return false;
  }
  return true;
}

/**
 * Convert one cached PNG to lossless WebP if it is identical and smaller.
 * Resolves to "converted" | "kept" | "skipped".
 */
async function compressFile(file, sharp = loadSharp()) {
  if (!sharp) return "skipped";
  if (typeOf(file) !== "image/png" || fs.existsSync(`${file}.keep`)) return "skipped";
  const png = fs.readFileSync(file);
  if (png.length < MIN_BYTES) return "skipped";

  let encoder = sharp(png).webp({ lossless: true, effort: 4 });
  if (typeof encoder.keepIccProfile === "function") encoder = encoder.keepIccProfile();
  const webp = await encoder.toBuffer();

  const [before, after] = await Promise.all([pixels(sharp, png), pixels(sharp, webp)]);
  if (webp.length >= png.length || !samePixels(before, after)) {
    fs.writeFileSync(`${file}.keep`, ""); // not worth it (or not identical): never retried
    return "kept";
  }
  fs.writeFileSync(`${file}.tmp`, webp);
  fs.renameSync(`${file}.tmp`, file);
  fs.writeFileSync(`${file}.type`, "image/webp");
  state.savedMB += (png.length - webp.length) / 1024 / 1024;
  return "converted";
}

/** Convert every big cached PNG, one at a time (CPU-heavy). A second call while running is ignored. */
async function compressCache() {
  if (state.running) return state;
  const sharp = loadSharp();
  state = { running: true, candidates: 0, converted: 0, kept: 0, errors: 0, savedMB: 0, startedAt: new Date(), finishedAt: null, error: null };
  if (!sharp) {
    state = { ...state, running: false, finishedAt: new Date(), error: "sharp is not installed: run `npm install` in the project folder" };
    return state;
  }
  try {
    const files = fs
      .readdirSync(DIR)
      .filter((f) => HASH_NAME.test(f))
      .map((f) => path.join(DIR, f))
      .filter((f) => typeOf(f) === "image/png" && !fs.existsSync(`${f}.keep`) && fs.statSync(f).size >= MIN_BYTES);
    state.candidates = files.length;
    for (const file of files) {
      try {
        const r = await compressFile(file, sharp);
        if (r === "converted") state.converted++;
        else if (r === "kept") state.kept++;
      } catch {
        state.errors++; // e.g. file being read at that moment (Windows): retried next time
        fs.rmSync(`${file}.tmp`, { force: true });
      }
    }
    console.log(`🗜  Images : ${state.converted} converties en WebP sans perte, ${Math.round(state.savedMB)} Mo gagnés`);
  } catch (err) {
    state.error = err.message;
  } finally {
    state.running = false;
    state.finishedAt = new Date();
    state.savedMB = Math.round(state.savedMB);
  }
  return state;
}

const compressStatus = () => ({ ...state, savedMB: Math.round(state.savedMB) });

module.exports = { compressCache, compressFile, compressStatus, samePixels };
