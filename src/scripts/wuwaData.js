/**
 * Wuthering Waves — Data Fetching Utility
 *
 * Data sourced from Dimbreath/WutheringData (GitHub).
 * Field names are internal; names are resolved via TextMap/en/*.json files.
 *
 * Key confirmed mappings (verified against known characters):
 *   ElementId: 1=Glacio, 2=Fusion, 3=Electro, 4=Aero, 5=Spectro, 6=Havoc
 *   WeaponType: 1=Broadblade, 2=Sword, 3=Pistols, 4=Gauntlets, 5=Rectifier
 *
 * Image CDN: TODO (WW-01) — icon filenames are known (T_IconRup_{id}_UI),
 * but the serving CDN URL pattern is not yet confirmed.
 *
 * Requires Node 18+ (native fetch).
 */

// ── CDN / data source ────────────────────────────────────────────────────────

const WUWA_BASE =
  "https://raw.githubusercontent.com/Dimbreath/WutheringData/master";

const CONFIGDB_BASE = `${WUWA_BASE}/ConfigDB`;
const TEXTMAP_BASE  = `${WUWA_BASE}/TextMap/en`;

/**
 * Fetch a JSON file from the WutheringData ConfigDB.
 * @param {string} filename  e.g. "RoleInfo.json"
 * @returns {Promise<Array>}
 */
async function fetchConfigDB(filename) {
  const url = `${CONFIGDB_BASE}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WuWa ConfigDB fetch failed: ${url} (${res.status})`);
  return res.json();
}

/**
 * Fetch a TextMap file for the given type (English).
 * Returns an object keyed by sequential integer strings: { "1": "Yangyang", "2": "...", ... }
 * @param {string} type  e.g. "RoleInfo", "WeaponConf", "ItemInfo"
 * @returns {Promise<Record<string, string>>}
 */
async function fetchTextMap(type) {
  const url = `${TEXTMAP_BASE}/${type}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WuWa TextMap fetch failed: ${url} (${res.status})`);
  return res.json();
}

// ── Element mapping ───────────────────────────────────────────────────────────
// Confirmed from: Yangyang=4=Aero, Sanhua=1=Glacio, Chixia=2=Fusion,
//                 Calcharo=3=Electro, Jinhsi=5=Spectro, Danjin=6=Havoc

const ELEMENT_ID_MAP = {
  1: "Glacio",
  2: "Fusion",
  3: "Electro",
  4: "Aero",
  5: "Spectro",
  6: "Havoc",
};

/**
 * Resolve internal element ID to display name.
 * @param {number} elementId
 * @returns {string}
 */
function resolveElement(elementId) {
  return ELEMENT_ID_MAP[elementId] ?? `Element_${elementId}`;
}

// ── Weapon type mapping ───────────────────────────────────────────────────────
// Confirmed from: Jiyan=1=Broadblade, Yangyang=2=Sword, Chixia=3=Pistols,
//                 Lingyang=4=Gauntlets, Jinhsi=5=Rectifier

const WEAPON_TYPE_ID_MAP = {
  1: "Broadblade",
  2: "Sword",
  3: "Pistols",
  4: "Gauntlets",
  5: "Rectifier",
};

/**
 * Resolve internal weapon type ID to display name.
 * @param {number} weaponTypeId
 * @returns {string}
 */
function resolveWeaponType(weaponTypeId) {
  return WEAPON_TYPE_ID_MAP[weaponTypeId] ?? `WeaponType_${weaponTypeId}`;
}

// ── TextMap resolution ────────────────────────────────────────────────────────

/**
 * Build a text resolver for a given TextMap file.
 * The TextMap is keyed by sequential integers. The ConfigDB references string
 * keys like "RoleInfo_1402_Name". To resolve these, we sort the ConfigDB entries
 * in order and map their name fields to sequential TextMap keys.
 *
 * Usage:
 *   const textMap = await fetchTextMap("RoleInfo");
 *   // textMap["1"] = "Yangyang", textMap["2"] = "Of Wind and Feathers", etc.
 *   // Each character occupies 4 entries: name, title, description, placeholder
 *
 * @param {Record<string, string>} textMap  The loaded TextMap object
 * @param {number} key  Sequential integer key (1-based)
 * @returns {string}
 */
function resolveText(textMap, key) {
  return textMap[String(key)] ?? "";
}

/**
 * For RoleInfo TextMap: each character entry occupies 4 consecutive text keys.
 * Given the 0-based index of a character in the sorted RoleInfo array,
 * returns { name, title, description } by computing the TextMap offsets.
 *
 * @param {Record<string, string>} textMap
 * @param {number} characterIndex  0-based position in the RoleInfo array
 * @returns {{ name: string, title: string, description: string }}
 */
function resolveCharacterText(textMap, characterIndex) {
  const base = characterIndex * 4 + 1; // Each character: 4 entries
  return {
    name:        resolveText(textMap, base),
    title:       resolveText(textMap, base + 1),
    description: resolveText(textMap, base + 2),
  };
}

/**
 * For WeaponConf TextMap: each weapon occupies 2 text entries (name, description).
 * @param {Record<string, string>} textMap
 * @param {number} weaponIndex  0-based position in the WeaponConf array
 * @returns {{ name: string, description: string }}
 */
function resolveWeaponText(textMap, weaponIndex) {
  const base = weaponIndex * 2 + 1;
  return {
    name:        resolveText(textMap, base),
    description: resolveText(textMap, base + 1),
  };
}

// ── Image helpers ─────────────────────────────────────────────────────────────
// CDN: WorkSync/Wuthering-_Icon (GitHub raw, verified working)
// Source: https://github.com/WorkSync/Wuthering-_Icon
//
// Icon paths:
//   Character avatar:  UIResources/Common/Image/IconRup/T_IconRup_{roleId}_UI.png
//   Weapon icon:       UIResources/Common/Image/IconWeapon/T_IconWeapon{weaponId}_UI.png
//   Element icon:      UIResources/Common/Image/IconElement/T_IconElement{slug}2_UI.png
//   Forte skill icon:  UIResources/Common/Image/MstSkill/T_MstSkil_{id}_UI.png

const WUWA_CDN_BASE =
  "https://raw.githubusercontent.com/WorkSync/Wuthering-_Icon/main/UIResources/Common/Image";

/**
 * Build a character icon URL from the role ID.
 * @param {number} roleId  e.g. 1402
 * @returns {string}
 */
function characterIconUrl(roleId) {
  return `${WUWA_CDN_BASE}/IconRup/T_IconRup_${roleId}_UI.png`;
}

/**
 * Build a weapon icon URL from the weapon item ID.
 * @param {number} weaponId  e.g. 21010074
 * @returns {string}
 */
function weaponIconUrl(weaponId) {
  return `${WUWA_CDN_BASE}/IconWeapon/T_IconWeapon${weaponId}_UI.png`;
}

/**
 * Build a forte skill icon URL from an Unreal Engine asset path.
 * PhantomSkill.json BattleViewIcon format:
 *   /Game/Aki/UI/UIResources/Common/Image/MstSkill/T_MstSkil_Z_B4_UI.T_MstSkil_Z_B4_UI
 * @param {string} unrealPath
 * @returns {string|null}
 */
function forteSkillIconUrl(unrealPath) {
  if (!unrealPath) return null;
  const parts = unrealPath.split("/");
  const filename = parts[parts.length - 1].split(".")[0];
  return `${WUWA_CDN_BASE}/MstSkill/${filename}.png`;
}

// ── Stat calculation ──────────────────────────────────────────────────────────

/**
 * WuWa ascension phase breakpoints (same structure as Genshin):
 *   Phase 0: lv 1–20   Phase 1: lv 21–40   Phase 2: lv 41–50
 *   Phase 3: lv 51–60  Phase 4: lv 61–70   Phase 5: lv 71–80
 *   Phase 6: lv 81–90
 *
 * Pre-compute all stats for levels 1–90 using the promotion data.
 * promotions is an array of phase objects, each with stat keys: { base, step }
 *
 * @param {Array}    promotions  Array of 7 phase objects
 * @param {string[]} statKeys   Which stat keys to extract
 * @returns {Record<string, object>}  level string → stat object
 */
function computeStats(promotions, statKeys = ["hp", "atk", "def"]) {
  const PHASE_RANGES = [
    [1, 20], [21, 40], [41, 50], [51, 60], [61, 70], [71, 80], [81, 90],
  ];

  const stats = {};

  for (let phase = 0; phase < PHASE_RANGES.length; phase++) {
    const phaseData = promotions[phase];
    if (!phaseData) continue;

    const [startLv, endLv] = PHASE_RANGES[phase];

    for (let lv = startLv; lv <= endLv; lv++) {
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

/**
 * Build ascension cost objects from raw material arrays.
 * Returns { ascend1: [...], ascend2: [...], ..., ascend6: [...] }
 *
 * @param {Array} ascensionData  Array of 6 phase cost arrays
 * @returns {Record<string, Array>}
 */
function buildAscensionCosts(ascensionData) {
  const costs = {};
  ascensionData.forEach((phaseCosts, i) => {
    costs[`ascend${i + 1}`] = phaseCosts;
  });
  return costs;
}

/**
 * Build forte upgrade cost objects from skill data.
 * Returns { basicAtk: { lvl2: [...], ..., lvl10: [...] }, ... }
 *
 * @param {object} skillCostsRaw  Object keyed by skill type, each value is array of 9 cost arrays
 * @returns {Record<string, Record<string, Array>>}
 */
function buildForteCosts(skillCostsRaw) {
  const costs = {};
  for (const [skillKey, levelCosts] of Object.entries(skillCostsRaw)) {
    costs[skillKey] = {};
    levelCosts.forEach((levelCost, i) => {
      costs[skillKey][`lvl${i + 2}`] = levelCost; // lvl2 through lvl10
    });
  }
  return costs;
}

// ── Rover handling ────────────────────────────────────────────────────────────

// Rover character IDs in RoleInfo.json (male + female variants share data)
// Female Rover: 1605, Male Rover: 1606 (verify during seed)
const ROVER_IDS = new Set([1605, 1606]);

// Known Rover element variants available in current game version
const ROVER_ELEMENTS = ["Spectro", "Havoc"];

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  WUWA_BASE,
  CONFIGDB_BASE,
  TEXTMAP_BASE,
  fetchConfigDB,
  fetchTextMap,
  ELEMENT_ID_MAP,
  resolveElement,
  WEAPON_TYPE_ID_MAP,
  resolveWeaponType,
  resolveText,
  resolveCharacterText,
  resolveWeaponText,
  WUWA_CDN_BASE,
  characterIconUrl,
  weaponIconUrl,
  forteSkillIconUrl,
  computeStats,
  buildAscensionCosts,
  buildForteCosts,
  ROVER_IDS,
  ROVER_ELEMENTS,
};
