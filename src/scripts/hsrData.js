/**
 * Honkai: Star Rail — Data Fetching Utility
 *
 * All game data is sourced from Mar-7th/StarRailRes (GitHub).
 * All image CDN URLs are constructed from the same base.
 *
 * Requires Node 18+ (native fetch). Project runs on Node 22 — no extra packages needed.
 */

// ── CDN / data source ────────────────────────────────────────────────────────

const STARRAILRES_BASE =
  "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master";

const DATA_BASE = `${STARRAILRES_BASE}/index_new/en`;

/**
 * Fetch a JSON file from Mar-7th/StarRailRes.
 * @param {string} filename  e.g. "characters.json"
 * @returns {Promise<object>}
 */
async function fetchHsr(filename) {
  const url = `${DATA_BASE}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HSR data fetch failed: ${url} (${res.status})`);
  return res.json();
}

/**
 * Resolve a relative icon path from the data to a full CDN URL.
 * e.g. "icon/character/1001.png" → full URL
 * @param {string|null|undefined} relativePath
 * @returns {string|null}
 */
function cdnUrl(relativePath) {
  if (!relativePath) return null;
  return `${STARRAILRES_BASE}/${relativePath}`;
}

// ── Path (class) mapping ──────────────────────────────────────────────────────
// Internal key (used in data files) → display name shown in-game.

const PATH_MAP = {
  Warrior:  "Destruction",
  Rogue:    "The Hunt",
  Mage:     "Erudition",
  Shaman:   "Harmony",
  Warlock:  "Nihility",
  Knight:   "Preservation",
  Priest:   "Abundance",
  Memory:   "Remembrance",
};

/**
 * Resolve an internal path key to its display name.
 * Falls back to the key itself if unknown.
 * @param {string} internalKey  e.g. "Warrior"
 * @returns {string}            e.g. "Destruction"
 */
function resolvePath(internalKey) {
  return PATH_MAP[internalKey] ?? internalKey;
}

// ── Element mapping ───────────────────────────────────────────────────────────
// Internal key → display name. Most are identical except Thunder → Lightning.

const ELEMENT_MAP = {
  Physical:  "Physical",
  Fire:      "Fire",
  Ice:       "Ice",
  Thunder:   "Lightning",   // internal key differs from display name
  Wind:      "Wind",
  Quantum:   "Quantum",
  Imaginary: "Imaginary",
};

/**
 * Resolve an internal element key to its display name.
 * @param {string} internalKey  e.g. "Thunder"
 * @returns {string}            e.g. "Lightning"
 */
function resolveElement(internalKey) {
  return ELEMENT_MAP[internalKey] ?? internalKey;
}

// ── Stat calculation ──────────────────────────────────────────────────────────

/**
 * Pre-compute all stats for levels 1–maxLevel using the promotions data.
 *
 * The promotions.values array has one entry per ascension phase (0–6).
 * Within a phase, each stat = base + step * (levelInPhase - 1).
 *
 * Ascension breakpoints for both characters and light cones:
 *   Phase 0: lv 1–20   Phase 1: lv 21–30   Phase 2: lv 31–40
 *   Phase 3: lv 41–50  Phase 4: lv 51–60   Phase 5: lv 61–70
 *   Phase 6: lv 71–80
 *
 * @param {Array}  values    promotions.values array from the JSON
 * @param {number} maxLevel  80 for both characters and light cones
 * @param {string[]} statKeys  which stat keys to extract (default: hp/atk/def/spd)
 * @returns {Record<string, object>}  level string → stat object
 */
function computeStats(values, maxLevel = 80, statKeys = ["hp", "atk", "def", "spd"]) {
  // Phase → [startLevel, endLevel] (inclusive)
  const PHASE_RANGES = [
    [1, 20], [21, 30], [31, 40], [41, 50], [51, 60], [61, 70], [71, 80],
  ];

  const stats = {};

  for (let phase = 0; phase < PHASE_RANGES.length; phase++) {
    const phaseData = values[phase];
    if (!phaseData) continue;

    const [startLv, endLv] = PHASE_RANGES[phase];

    for (let lv = startLv; lv <= Math.min(endLv, maxLevel); lv++) {
      const levelInPhase = lv - startLv; // 0-indexed within this phase
      const statObj = {};

      for (const key of statKeys) {
        const entry = phaseData[key];
        if (!entry) continue;
        statObj[key] = entry.base + entry.step * levelInPhase;
      }

      stats[String(lv)] = statObj;
    }
  }

  return stats;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  STARRAILRES_BASE,
  fetchHsr,
  cdnUrl,
  PATH_MAP,
  resolvePath,
  ELEMENT_MAP,
  resolveElement,
  computeStats,
};
