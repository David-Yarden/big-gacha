/**
 * Zenless Zone Zero Data Seeder
 *
 * Data:   malu-no996/ZenlessData (GitHub, datamined FileCfg tables + TextMap)
 *         EnkaNetwork/API-docs store/zzz (stable ids: agent stats, W-Engine stats, names)
 * Images: enka.network/ui/zzz/ (agents, W-Engines, Drive Disc sets, specialty icons)
 *
 * Run:    npm run seed:zzz        (also used by the sync engine)
 *
 * The datamine's field names are obfuscated and change with every build, but the
 * order of the fields does not (new fields are appended). Rows are read by position
 * and every table is checked against known values before anything is produced, so a
 * layout change makes the sync fail cleanly instead of importing garbage.
 *
 * Imports: Agents (stats, ascension costs, profile), Agent kits (skills with multipliers,
 * Core Skill, Additional Ability, Mindscapes, level-up costs), W-Engines, Drive Discs,
 * Bangboos and the materials used by all of them.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
const { Character, AgentKit, Weapon, Relic, Bangboo, Material, Reference } = require("../models");
const { fetchData } = require("../sync/http");

const GAME = "zzz";
delete require.cache[require.resolve("./zzzVoices")]; // edits apply on the next sync
const { ZZZ_CV } = require("./zzzVoices");
const REPO = "malu-no996/ZenlessData";
const ENKA_STORE = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz";
const ENKA_UI = "https://enka.network/ui/zzz";
// nanoka.cc mirrors the game's UI sprites by file name (agent busts, items, factions, Bangboos)
const NANOKA_UI = "https://static.nanoka.cc/assets/zzz";
let REF = "HEAD";
function setRef(ref) {
  REF = ref || "HEAD";
}

// ── Version map ─────────────────────────────────────────────────────────────
// FROZEN history (agents released before the automatic sync existed), from the banner
// history (gamevika.com, wotpack.ru, game8.co — checked 2026-10). Do not extend it: a new
// agent gets the game version announced by the source the day it first appears.
const ZZZ_VERSION_MAP = {
  // 1.0 (July 4, 2024)
  Anby: "1.0", Billy: "1.0", Nicole: "1.0", Nekomata: "1.0", Corin: "1.0", Anton: "1.0", Ben: "1.0",
  Koleda: "1.0", Grace: "1.0", Lycaon: "1.0", Ellen: "1.0", Rina: "1.0", "Soldier 11": "1.0",
  Soukaku: "1.0", Lucy: "1.0", Piper: "1.0", "Zhu Yuan": "1.0",
  // 1.1 – 1.7
  Qingyi: "1.1", Jane: "1.1", Seth: "1.1",
  Caesar: "1.2", Burnice: "1.2",
  Yanagi: "1.3", Lighter: "1.3",
  Miyabi: "1.4", Harumasa: "1.4",
  "Astra Yao": "1.5", Evelyn: "1.5",
  "Soldier 0 - Anby": "1.6", Trigger: "1.6", Pulchra: "1.6",
  Vivian: "1.7", Hugo: "1.7",
  // 2.x
  Yixuan: "2.0", "Ju Fufu": "2.0", "Pan Yinhu": "2.0",
  Yuzuha: "2.1", Alice: "2.1",
  Seed: "2.2", "Orphie & Magus": "2.2",
  Lucia: "2.3", Yidhari: "2.3", Manato: "2.3",
  Dialyn: "2.4", Banyue: "2.4",
  "Ye Shunguang": "2.5", Zhao: "2.5",
  Sunna: "2.6", Aria: "2.6",
  "Nangong Yu": "2.7", Cissia: "2.7",
  Promeia: "2.8", "Starlight - Billy": "2.8",
  // 3.x
  Velina: "3.0", Norma: "3.0", Pyrois: "3.0",
  Remielle: "3.1", Sigrid: "3.1",
  Claret: "3.2", Roxy: "3.2",
};

// Other release versions (FROZEN, by id): first build of the datamine containing them
// (its history starts at 1.1, which shipped no new set/Bangboo: 1.1 there = 1.0). Unlike
// agents, Drive Discs and Bangboos are not shipped ahead of their release (checked:
// Feathered Fate and Thorned Rose = 3.1). Signature W-Engines use their agent's version.
function versionMap(spec) {
  const out = {};
  for (const part of spec.split("|")) {
    const [v, ids] = part.trim().split(":");
    for (const id of ids.split(",")) out[id.trim()] = v.trim();
  }
  return out;
}
const DISC_VERSIONS = versionMap(
  "1.0:31000,31100,31200,31300,31400,31500,31600,32200,32300,32400,32500,32600 | 1.2:31800,31900 | 1.4:32700,32800 | " +
    "1.6:32900,33000 | 2.0:33100,33200 | 2.2:33300,33400 | 2.5:33500,33600 | 2.7:33700,33800 | 3.0:33900,34000 | 3.1:34100,34200"
);
const BANGBOO_VERSIONS = versionMap(
  "1.0:53001,53002,53003,53004,53005,53006,53007,53008,53009,53010,53011,53012,53013,54001,54002,54003,54004,54005,54006,54008,54009,54013 | " +
    "1.1:54012 | 1.2:54011 | 1.3:53017,54014 | 1.4:53015 | 1.5:54015 | 1.6:54016 | 1.7:53014 | 2.0:54017 | 2.1:54018 | " +
    "2.2:53016,54019 | 2.4:53019,54020 | 2.5:54021 | 2.6:54010 | 2.8:53021 | 3.0:54022 | 3.1:54023"
);
const WEAPON_VERSIONS = versionMap(
  "1.0:12001,12002,12003,12004,12005,12006,12007,12008,12009,12010,12011,12012,12013,12014,13001,13002,13003,13004,13005,13006,13007,13008,13009,13010,13011,13013,13101,13103,13106,13108,13111,13112,13113,13115,13127,13128,14001,14002,14003,14102,14104,14110,14114,14118,14119,14121,14124,14125,14126 | " +
    "1.2:14107,14117 | 1.3:14116,14122 | 1.4:13015,14109,14120 | 1.5:14131,14132 | 1.6:13135,14136,14138 | 1.7:14129,14133 | " +
    "2.0:12015,13012,13014,13016,13142,14137,14139 | 2.1:14140,14141 | 2.2:14130,14146 | 2.3:13144,14105,14145 | 2.4:14147,14148 | " +
    "2.5:13019,14134,14143 | 2.6:14149,14150 | 2.7:13020,14151,14152 | 2.8:14153,14154 | 3.0:13018,14155,14156,14157 | " +
    "3.1:14158,14159 | 3.2:12016,13017,13021,14161,14162"
);

// Kit categories of AvatarSkillDes / AvatarSkillLevel
const SKILL_TYPES = { 0: "basic", 1: "special", 2: "dodge", 3: "chain", 6: "assist" };
const SKILL_NAMES = { basic: "Basic Attack", dodge: "Dodge", assist: "Assist", special: "Special Attack", chain: "Chain Attack" };
const SKILL_MAX_LEVEL = 16; // 12 + 4 from Mindscapes 3 and 5
const CORE_LABELS = ["Base", "A", "B", "C", "D", "E", "F"];
const ATTACK_TYPES = { Cut: "Slash", Punch: "Strike", Pierce: "Pierce" };

// ── Data access ─────────────────────────────────────────────────────────────

const raw = (path) => `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`;

/** A FileCfg table as arrays of values (field order is stable, names are not). */
async function table(name) {
  const json = await fetchData(raw(`FileCfg/${name}TemplateTb.json`), { timeout: 120_000 });
  const rows = Object.values(json)[0];
  if (!Array.isArray(rows) || !rows.length) throw new Error(`${name}: empty or unreadable table`);
  return rows.map((r) => Object.values(r));
}

function check(cond, message) {
  if (!cond) throw new Error(`ZZZ data layout changed — ${message}`);
}

/** [{a, b}] → [[a, b]] (cost and property pairs) */
const pairs = (list) => (Array.isArray(list) ? list.map((o) => Object.values(o)) : []);

const TEXT_FILE = "TextMap/TextMap_ENTemplateTb.json";
// Text keys built from a code instead of read from a table
const TEXT_FAMILIES =
  /^(Avatar_|Partner_|PartnerBg_|Camp|ElementType_|HitType_|Profession|Common_Property|Item_|Weapon_|EquipmentSuit_|Bangboo_|[A-Za-z0-9]+_(Skill|UniqueSkill|Talent|MathSkill|Property|NounPrompts))/;

/**
 * English texts we use, out of the 48 MB TextMap. The filtered result is cached on disk
 * (cache/) per TextMap commit and set of keys, so a sync only downloads it when needed.
 */
async function loadTexts(neededKeys) {
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const { githubLastCommitFor } = require("../sync/upstream");
  const dir = path.join(__dirname, "..", "..", "cache");

  const textSha = await githubLastCommitFor(REPO, TEXT_FILE, REF);
  const keyHash = crypto
    .createHash("sha1")
    .update(TEXT_FAMILIES.source + [...neededKeys].sort().join("\n"))
    .digest("hex")
    .slice(0, 10);
  const cacheFile = textSha ? path.join(dir, `zzz-text-${textSha.slice(0, 12)}-${keyHash}.json`) : null;
  if (cacheFile && fs.existsSync(cacheFile)) {
    try {
      const map = new Map(JSON.parse(fs.readFileSync(cacheFile, "utf8")));
      console.log(`  ✓ Texts from cache (${map.size})`);
      return map;
    } catch {
      /* corrupt cache: download again */
    }
  }
  let all = await fetchData(raw(TEXT_FILE), { timeout: 300_000 });
  if (Object.keys(all).length < 10) all = Object.values(all)[0]; // wrapped in a single key
  const map = new Map();
  for (const [k, v] of Object.entries(all)) if (neededKeys.has(k) || TEXT_FAMILIES.test(k)) map.set(k, v);
  all = null;
  check(map.size > 5000, `only ${map.size} texts found`);
  if (cacheFile) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (const f of fs.readdirSync(dir)) if (f.startsWith("zzz-text-")) fs.unlinkSync(path.join(dir, f));
      fs.writeFileSync(cacheFile, JSON.stringify([...map]));
    } catch (err) {
      console.warn(`  ⚠ Text cache not written: ${err.message}`);
    }
  }
  return map;
}

let TEXT = new Map();
let NOUNS = new Map(); // term id → { name, desc }
let ITEMS = new Map(); // item id → row
let ACCESS = new Map(); // AccessConfig id → row (where to obtain an item)

// Agents the game gives no PartnerConfig profile (Pyrois is the Proxy's Etheric Other):
// the text keys that describe them elsewhere in the game.
const PROFILE_FALLBACK = {
  1551: { description: "Journey_FunctionDec_3010306", gender: "Unspecified" },
};
let USED_ITEMS = new Set();
let ENKA = null;

const t = (key) => (key ? TEXT.get(key) : undefined);

// ── Text formatting ─────────────────────────────────────────────────────────

// In-game button icons ([label, sprite]) used in skill texts
const KEY_ICON = "https://enka.network/ui/zzz/IconRoleSkillKey";
const BUTTONS = {
  Icon_Normal: ["Basic Attack", "Normal"],
  Icon_Special: ["Special Attack", "Special"],
  Icon_SpecialReady: ["EX Special Attack", "SpecialV2"],
  Icon_SpecialReady_Rp: ["EX Special Attack", "SpecialV2"],
  Icon_SpecialReady_Ep: ["EX Special Attack", "SpecialV2"],
  Icon_Evade: ["Dodge", "Evade"],
  Icon_UltimateReady: ["Ultimate", "UltimateV2"],
  Icon_Switch: ["Switch", "Switch"],
  Icon_QTE: ["Chain Attack", "QTE"],
};
const WHITE = /^#?(fff|ffffff)$/i;

/**
 * Game markup → the site's text format:
 *   <color=#FFFFFF>term</color> and numbers → **term** (highlight)
 *   other colours (elements…)             → [[#HEX|text]] (kept as in game)
 *   <IconMap:Icon_Normal>                  → [[key:Basic Attack|<button icon>]]
 *   <Term:ID></Term>                        → **Term name** (hover glossary)
 */
function cleanText(text, terms) {
  if (text == null) return undefined;
  let s = String(text);
  s = s.replace(/<Term:(\d+)>(.*?)<\/Term>/g, (_, id, inner) => {
    const n = NOUNS.get(Number(id));
    if (n && terms) terms.add(Number(id));
    const label = inner || n?.name || "";
    return label ? `**${label}**` : "";
  });
  s = s.replace(/<IconMap:([^>]+)>/g, (_, k) =>
    BUTTONS[k] ? `[[key:${BUTTONS[k][0]}|${KEY_ICON}${BUTTONS[k][1]}.png]]` : ""
  );
  s = s.replace(/<color=(#[0-9A-Fa-f]{3,8})>([\s\S]*?)<\/color>/g, (_, hex, inner) => {
    const txt = inner.replace(/<[^>]+>/g, "");
    if (!txt.trim()) return txt;
    const h = hex.slice(0, 7);
    // Green values and white keywords are the game's highlight: our gold bold
    if (WHITE.test(h) || /^#2BAD00$/i.test(h)) return `**${txt}**`;
    return `[[${h.toUpperCase()}|${txt}]]`;
  });
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, ""); // <i>, <size=…>, leftovers
  s = s.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return s || undefined;
}

// ── Formulas ────────────────────────────────────────────────────────────────

function fmtNumber(n, decimals = 1) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return String(r);
}

/** Safe arithmetic: digits, + - * / ( ) and spaces only. */
function arith(expr) {
  if (!/^[\d.\s+\-*/()]+$/.test(expr)) return NaN;
  try {
    return Function(`"use strict"; return (${expr});`)();
  } catch {
    return NaN;
  }
}

/**
 * "{Skill:1011001, Prop:1001}" (or arithmetic on several of them) at a skill level → "31.2%".
 * Props: 1001 = DMG multiplier, 1002 = Daze multiplier ([base, growth] in 1/100 %).
 */
function skillValue(spec, level, skillRows) {
  let hasRef = false;
  let bad = false;
  const expr = spec.replace(/\{Skill:\s*(\d+),\s*Prop:\s*(\d+)\}/g, (_, sid, prop) => {
    hasRef = true;
    const row = skillRows.get(Number(sid));
    const cols = { 1001: [0, 1], 1002: [2, 3] }[prop];
    if (!row || !cols) {
      bad = true;
      return "0";
    }
    return String((row[cols[0]] + row[cols[1]] * (level - 1)) / 100);
  });
  if (!hasRef || bad) return null;
  const n = arith(expr.replace(/[{}]/g, (c) => (c === "{" ? "(" : ")")));
  return Number.isFinite(n) ? `${fmtNumber(n)}%` : null;
}

/** A fixed text value, with "{CAL:8+AvatarSkillLevel(1)*1,1,2}" formulas evaluated. */
function fixedValue(text, level) {
  if (text == null) return null;
  const s = String(text).replace(/\{CAL:([^,}]+)(?:,[^}]*)?\}/g, (_, f) => {
    const n = arith(f.replace(/AvatarSkillLevel\(\d+\)/g, String(level)));
    return Number.isFinite(n) ? fmtNumber(n, 2) : "?";
  });
  return cleanText(s) ?? null;
}

// ── Costs and materials ─────────────────────────────────────────────────────

function costList(list) {
  return pairs(list)
    .map(([id, count]) => {
      const it = ITEMS.get(id);
      if (count > 0) USED_ITEMS.add(id);
      return {
        id,
        name: (it && t(it[1])) || (id === 10 ? "Dennies" : String(id)),
        count,
        icon: itemIcon(id),
      };
    })
    .filter((x) => x.count > 0);
}

/** "10:7200,101010:2|10:16800,…" (W-Engine ascension) → [[pairs] per phase] */
function costString(s) {
  return String(s || "")
    .split("|")
    .filter(Boolean)
    .map((phase) => phase.split(",").map((p) => p.split(":").map(Number)));
}

// ── Properties (Enka store: stable ids, names and display formats) ─────────

function propName(id) {
  const p = ENKA.property[id];
  const name = (p && ENKA.locs[p.Name]) || String(id);
  return name.replace(/^Percent (.+)$/, "$1%"); // "Percent ATK" → "ATK%" (in-game wording)
}
function isPercentProp(id) {
  return /%/.test(ENKA.property[id]?.Format ?? "");
}
/** Raw property value → displayed string ("5%", "1.2", "94"). */
function propValue(id, value) {
  const fmt = ENKA.property[id]?.Format ?? "";
  if (fmt.includes("%")) return `${fmtNumber(value / 100)}%`;
  if (fmt.includes("0.##")) return fmtNumber(value / 100, 2);
  return fmtNumber(value, 1);
}

/** Game sprite path → nanoka.cc mirror (.webp). */
const nano = (path) => {
  const file = String(path || "").split("/").pop().replace(/\.png$/i, "");
  return file ? `${NANOKA_UI}/${file}.webp` : undefined;
};

/** Item icon: the datamine's sprite, else nanoka's mapping (boss materials). */
function itemIcon(id) {
  const path = ITEMS.get(id)?.[8] || ITEM_ICONS.get(id);
  return path ? nano(path) : undefined;
}

const img = (path) => {
  const file = String(path || "").split("/").pop();
  return file ? `${ENKA_UI}/${file.replace(/\.png$/i, "")}.png` : undefined;
};

// ── Download ────────────────────────────────────────────────────────────────

const TABLES = [
  "AvatarBase", "AvatarUI", "AvatarBattle", "PartnerConfig", "AvatarSkillDes", "AvatarSkill",
  "AvatarSkillLevel", "AvatarPassiveSkill", "AvatarTalent", "AvatarLevelAdvance", "NounPrompts",
  "Weapon", "WeaponLevel", "WeaponStar", "WeaponTalent", "EquipmentSuit", "Item",
  "BuddyBase", "BuddyUI", "BuddySkill", "BuddySkillLevelUp", "PartnerCampConfig",
  "AvatarLevel", "AvatarSkinBase", "EquipmentAuto", "EquipmentRarity", "EquipmentLevel", "RandPropertyLibrary",
  "AccessConfig",
];

/**
 * Sprite names the datamine tables we read do not give (Bangboos: hashed; boss materials:
 * empty). nanoka.cc publishes id → sprite mappings in versioned JSON files. Optional:
 * without them, those images are just missing.
 */
async function nanokaIcons() {
  const { tryFetch } = require("../sync/http");
  const home = await tryFetch("https://zzz.nanoka.cc/", { as: "text", timeout: 30_000 });
  const version = String(home || "").match(/static\.nanoka\.cc\/zzz\/([^/"\\]+)\//)?.[1];
  if (!version) {
    console.warn("  ⚠ nanoka.cc unavailable: no Bangboo portraits or boss material icons");
    return { bangboos: new Map(), items: new Map() };
  }
  const base = `https://static.nanoka.cc/zzz/${encodeURIComponent(version)}`;
  const [bangboos, items] = await Promise.all([
    tryFetch(`${base}/bangboo.json`, { timeout: 30_000 }),
    tryFetch(`${base}/en/item.json`, { timeout: 60_000 }),
  ]);
  const map = (json) => new Map(Object.entries(json || {}).filter(([, x]) => x?.icon).map(([id, x]) => [Number(id), x.icon]));
  return { bangboos: map(bangboos), items: map(items) };
}
let ITEM_ICONS = new Map();

/** Keep only the image URLs that exist (faction emblems missing from the mirror). */
async function existing(urls) {
  const ok = new Set();
  await Promise.all(
    [...new Set(urls)].map(async (u) => {
      try {
        const res = await fetch(u, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        if (res.ok) ok.add(u);
      } catch {
        /* unreachable: treated as missing */
      }
    })
  );
  return ok;
}

async function fetchAll() {
  console.log(`Fetching data from ${REPO}...`);
  const d = {};
  for (let i = 0; i < TABLES.length; i += 6) {
    const chunk = TABLES.slice(i, i + 6);
    const rows = await Promise.all(chunk.map(table));
    chunk.forEach((name, j) => (d[name] = rows[j]));
  }
  const store = await Promise.all(
    ["avatars", "weapons", "property", "locs"].map((f) => fetchData(`${ENKA_STORE}/${f}.json`, { timeout: 60_000 }))
  );
  ENKA = { avatars: store[0], weapons: store[1], property: store[2], locs: store[3].en || {} };

  validate(d);

  // Every text key the tables point to (plus the code-built families)
  const needed = new Set();
  const visit = (v) => {
    if (typeof v === "string") {
      if (v.includes("|")) v.split("|").forEach((p) => needed.add(p));
      else needed.add(v);
    } else if (Array.isArray(v)) v.forEach(visit);
  };
  for (const name of TABLES) if (name !== "Item") for (const row of d[name]) row.forEach(visit);
  // Agents without a PartnerConfig row (Pyrois…): their profile text, if the TextMap has it
  for (const row of d.AvatarBase) needed.add(`Partner_ProfileDesc_${row[0]}`);
  for (const f of Object.values(PROFILE_FALLBACK)) needed.add(f.description);
  for (const row of d.Item) {
    needed.add(row[1]);
    needed.add(row[5]);
    needed.add(row[7]);
  }
  TEXT = await loadTexts(needed);
  ITEMS = new Map(d.Item.map((r) => [r[0], r]));
  ACCESS = new Map(d.AccessConfig.map((r) => [r[0], r]));
  NOUNS = new Map(
    d.NounPrompts.map((r) => [r[0], { name: cleanText(t(r[2]) ?? t(r[9])), desc: cleanText(t(r[3])), key: r[2] }]).filter(
      ([, n]) => n.name && n.desc
    )
  );
  USED_ITEMS = new Set();
  buildLevelExp(d);
  WEAPON_NAMES = new Map(
    Object.entries(ENKA.weapons).map(([wid, w]) => [Number(wid), ENKA.locs[w.ItemName] || t(w.ItemName)]).filter(([, n]) => n)
  );
  const icons = await nanokaIcons();
  BANGBOO_ICONS = icons.bangboos;
  ITEM_ICONS = icons.items;
  const camps = d.PartnerCampConfig.filter((r) => /IconCamp/.test(r[2])).map((r) => [r[0], nano(r[2])]);
  const live = await existing(camps.map(([, u]) => u));
  CAMP_ICONS = new Map(camps.filter(([, u]) => live.has(u)));
  // Same emblems by faction name, for agents whose own config row has no camp
  CAMP_ICONS_BY_NAME = new Map(
    d.PartnerCampConfig.filter((r) => CAMP_ICONS.has(r[0]) && t(r[1])).map((r) => [t(r[1]).trim(), CAMP_ICONS.get(r[0])])
  );
  console.log(`  ✓ All data fetched (${TEXT.size} texts)\n`);
  return d;
}

/** Known values at known positions: the layout we read has not moved. */
function validate(d) {
  const anby = d.AvatarBase.find((r) => r[0] === 1011);
  check(anby && anby[2] === "Avatar_Female_Size02_Anbi" && anby[8] === "Anbi", "AvatarBase");
  const sk = d.AvatarSkill.find((r) => r[0] === 1011001);
  check(sk && [sk[3], sk[4], sk[5], sk[6]].every((x) => typeof x === "number" && x > 0), "AvatarSkill");
  const des = d.AvatarSkillDes.find((r) => r[1] === 1011 && r[2] === 0);
  check(des && /_Skill_.*_Title$/.test(des[4]) && typeof des[3] === "number", "AvatarSkillDes");
  const lvl = d.AvatarSkillLevel.find((r) => r[1] === 1011);
  check(lvl && typeof lvl[3] === "number" && Array.isArray(lvl[5]), "AvatarSkillLevel");
  const ps = d.AvatarPassiveSkill.find((r) => r[1] === 1011);
  check(ps && Array.isArray(ps[6]) && Array.isArray(ps[8]) && /UniqueSkill/.test(ps[8][0]), "AvatarPassiveSkill");
  const tal = d.AvatarTalent.find((r) => r[0] === 1011);
  check(tal && /_Talent_01_Title$/.test(tal[3]) && /_Desc_01$/.test(tal[6]), "AvatarTalent");
  const adv = d.AvatarLevelAdvance.find((r) => r[0] === 1011);
  check(adv && adv[1] === 1 && Array.isArray(adv[10]), "AvatarLevelAdvance");
  const w = d.Weapon[0];
  check(typeof w[2] === "object" && typeof w[3] === "object" && /:/.test(w[11]), "Weapon");
  check(d.WeaponLevel.some((r) => r[1] === 60) && d.WeaponStar.some((r) => r[1] === 5), "WeaponLevel/WeaponStar");
  check(/^Weapon_TalentDes_/.test(d.WeaponTalent[0][3]), "WeaponTalent");
  check(/^EquipmentSuit_\d+_name$/.test(d.EquipmentSuit[0][1]) && /_2_des$/.test(d.EquipmentSuit[0][4]), "EquipmentSuit");
  check(d.Item.some((r) => r[0] === 10 && r[1] === "Item_Gold"), "Item");
  const seal = d.Item.find((r) => r[0] === 100223); // Advanced Anomaly Certification Seal → its obtain sources
  const access = seal && d.AccessConfig.find((r) => r[0] === seal[4]);
  check(access && access.some((v) => typeof v === "string" && v.startsWith("TextMap_Access")), "AccessConfig");
  check(/^Bangboo_Name_/.test(d.BuddyBase[0][5]), "BuddyBase");
  check(d.BuddySkillLevelUp.some((r) => /^Bangboo_/.test(r[6])), "BuddySkillLevelUp");
  check(d.NounPrompts.some((r) => /_NounPrompts_/.test(r[2])), "NounPrompts");
  check(d.AvatarLevel.length >= 59 && typeof d.AvatarLevel[1][1] === "number", "AvatarLevel");
  check(d.EquipmentAuto.some((r) => r[0] === 1011 && typeof r[1] === "number" && Array.isArray(r[8])), "EquipmentAuto");
  check(d.AvatarSkinBase.some((r) => r[2] === 1011 && /^IconRole/.test(r[8])), "AvatarSkinBase");
  check(d.EquipmentRarity.some((r) => r[0] === 4 && r[1] === 4) && d.RandPropertyLibrary.some((r) => r[1] === 4000), "Drive Disc tables");
  check(d.PartnerCampConfig.some((r) => r[0] === 10010 && /IconCamp/.test(r[2])), "PartnerCampConfig");
}

// ── Agents ──────────────────────────────────────────────────────────────────

function phaseOf(level) {
  return level <= 10 ? 0 : Math.min(5, Math.ceil(level / 10) - 1);
}

function agentStats(a) {
  const stats = {};
  for (let lv = 1; lv <= 60; lv++) {
    const p = phaseOf(lv);
    const val = (id) =>
      (a.BaseProps?.[id] ?? 0) + ((a.GrowthProps?.[id] ?? 0) * (lv - 1)) / 10000 + (a.PromotionProps?.[p]?.[id] ?? 0);
    stats[lv] = { hp: Math.floor(val(11101)), atk: Math.floor(val(12101)), def: Math.floor(val(13101)) };
  }
  return stats;
}

const EXTRA_STATS = [12201, 20101, 21101, 31401, 31201, 23101, 30501];
function extraStats(a) {
  return EXTRA_STATS.filter((id) => a.BaseProps?.[id] != null).map((id) => ({
    name: propName(id),
    value: propValue(id, a.BaseProps[id]),
  }));
}

function playableAgents(d) {
  const withKit = new Set(d.AvatarTalent.map((r) => r[0]));
  return d.AvatarBase.filter((r) => withKit.has(r[0]) && ENKA.avatars[r[0]] && t(r[2]));
}

function agentElement(types) {
  const list = (types || []).map((x) => t(`ElementType_${x}`) || x);
  const base = ["Physical", "Fire", "Ice", "Electric", "Ether", "Wind", "Lumiflux"];
  const main = list.find((x) => base.includes(x)) ?? list[0];
  const sub = list.find((x) => x !== main);
  return { element: main, subElement: sub };
}

/**
 * EXP curve and EXP items: { exp: cumulative EXP to reach each level, items: [{ id, name, exp, icon }] }.
 * Items are recognised by their type (12 = agent EXP, 13 = W-Engine EXP) and carry their EXP
 * in a one-number array.
 */
const LEVEL_EXP = { agent: undefined, weapon: {} };
function buildLevelExp(d) {
  const items = (type) =>
    d.Item.filter((r) => r[3] === type && t(r[1]))
      .map((r) => ({ id: r[0], name: t(r[1]).trim(), exp: r.find((v) => Array.isArray(v) && v.length === 1 && v[0] > 0)?.[0], icon: nano(r[8]) }))
      .filter((x) => x.exp > 0 && !/Backup|Plug-In/i.test(x.name));
  const cumulative = (perLevel) => {
    const exp = [0, 0];
    for (let lv = 2; lv <= perLevel.length; lv++) exp[lv] = exp[lv - 1] + (perLevel[lv - 1] ?? 0);
    return exp;
  };
  // AvatarLevel: [level, EXP to the next level]
  const agentPer = [];
  for (const r of d.AvatarLevel) agentPer[r[0]] = r[1];
  LEVEL_EXP.agent = { exp: cumulative(agentPer.slice(0, 61)), items: items(12) };
  // WeaponLevel: [rarity, level, rate, EXP to the next level]
  const wItems = items(13);
  for (const rarity of [2, 3, 4]) {
    const per = [];
    for (const r of d.WeaponLevel.filter((x) => x[0] === rarity && x[1] >= 1)) per[r[1]] = r[3];
    LEVEL_EXP.weapon[rarity] = { exp: cumulative(per.slice(0, 61)), items: wItems };
  }
}

/** Outfits: [{ name, desc, splash, icon, default }] (only when the agent has more than one). */
function agentSkins(d, id) {
  const rows = d.AvatarSkinBase.filter((r) => r[2] === id && r[8]);
  if (rows.length < 2) return undefined;
  return rows.map((r) => ({
    name: cleanText(t(r[3])),
    desc: cleanText(t(r[6])),
    default: (r[4] || []).includes("DefaultSkin") || undefined,
    splash: `${ENKA_UI}/${r[8]}.png`,
    icon: nano(String(r[8]).replace(/IconRole(\d+)/, "IconRoleCrop$1")),
  }));
}

/** The game's own recommended Drive Discs (EquipmentAuto). */
function agentBuild(d, id) {
  const r = d.EquipmentAuto.find((x) => x[0] === id);
  if (!r) return undefined;
  const suit = (sid) => (sid ? cleanText(t(d.EquipmentSuit.find((x) => x[0] === sid)?.[1])) : undefined);
  const props = (list) => (Array.isArray(list) ? list.map(propName) : []);
  const alternatives = [[r[12], r[9]], [r[13], r[10]], [r[14], r[11]]]
    .filter(([sets]) => Array.isArray(sets) && sets.length)
    .map(([sets, subs]) => ({ sets: sets.map(suit).filter(Boolean), substats: props(subs) }));
  return {
    fourPiece: suit(r[1]),
    twoPiece: [suit(r[2]), suit(r[3])].filter(Boolean),
    mainStats: { 4: propName(r[4]), 5: propName(r[5]), 6: propName(r[6]) },
    substats: props(r[8]),
    alternatives: alternatives.length ? alternatives : undefined,
  };
}

let WEAPON_NAMES = new Map();
function weaponName(id) {
  return id ? WEAPON_NAMES.get(id) : undefined;
}

// Emblems the mirrors lack (IconCampE.S.D is not on nanoka; Silver Squad has no camp row):
// ZZZ wiki uploads, served through the local image cache.
const FACTION_ICON_FALLBACK = {
  "Roscaelifer External Strategy Department":
    "https://static.wikia.nocookie.net/zenless-zone-zero/images/8/88/Faction_External_Strategy_Department_Icon.png",
  "Defense Force - Silver Squad":
    "https://static.wikia.nocookie.net/zenless-zone-zero/images/b/b5/Faction_Defense_Force_-_Silver_Squad_Icon.png",
  Phaethon: "https://raw.githubusercontent.com/Gaiiiaaa-GH/ZZZdle-Assets/master/type_icons/factions/phaethon.webp",
};
let CAMP_ICONS = new Map(); // partner camp id → icon
let CAMP_ICONS_BY_NAME = new Map(); // faction name → icon

/** Faction emblem of an agent (PartnerConfig points to its PartnerCampConfig row). */
function factionIcon(partnerRow) {
  const campId = (partnerRow || []).find((v) => typeof v === "number" && CAMP_ICONS.has(v));
  return campId ? CAMP_ICONS.get(campId) : undefined;
}

async function seedCharacters(d) {

  const ui = new Map(d.AvatarUI.map((r) => [r[0], r]));
  const battle = new Map(d.AvatarBattle.map((r) => [r[0], r]));
  const partner = new Map();
  for (const r of d.PartnerConfig) {
    const avatar = r.find((v, i) => i > 0 && typeof v === "number" && ENKA.avatars[v]);
    if (avatar) partner.set(avatar, r);
  }
  // Alternate versions ("Soldier 0 - Anby", "Starlight - Billy") have no PartnerConfig row:
  // the game shows the profile of the original agent.
  const agents = playableAgents(d);
  const idByName = new Map(agents.map((b) => [t(b[2]).trim(), b[0]]));
  let count = 0;
  for (const base of agents) {
    const id = base[0];
    const name = t(base[2]).trim();
    const a = ENKA.avatars[id];
    const { element, subElement } = agentElement(a.ElementTypes);
    const tags = battle.get(id)?.find((v) => Array.isArray(v) && v.some((x) => typeof x === "string" && /^Camp\d+$/.test(x))) || [];
    const attack = tags.map((x) => ATTACK_TYPES[x]).filter(Boolean);
    const p = partner.get(id) || partner.get(idByName.get(name.split(" - ").pop())) || [];
    const pick = (re) => cleanText(t(p.find((v) => typeof v === "string" && re.test(v))));
    const costs = {};
    for (const r of d.AvatarLevelAdvance.filter((x) => x[0] === id)) {
      const list = costList(r[10]);
      if (list.length) costs[`ascend${r[1]}`] = list;
    }
    await upsert(Character, { game: GAME, name }, {
      game: GAME,
      sourceId: id,
      name,
      title: t(base[3]) && t(base[3]) !== name ? t(base[3]).trim() : undefined,
      rarity: a.Rarity === 4 ? 5 : 4, // S → 5★, A → 4★
      element,
      subElement,
      elementType: (a.ElementTypes || []).join("+"),
      specialty: a.ProfessionType,
      attackType: attack.length ? attack.join(" / ") : undefined,
      affiliation: t(ui.get(id)?.[3]) || undefined,
      region: t(ui.get(id)?.[3]) || undefined, // faction filter
      gender: pick(/^Partner_Gender/) ?? PROFILE_FALLBACK[id]?.gender,
      height: pick(/^Partner_Stature/)?.replace(/^(\d+(?:\.\d+)?)/, "$1 cm"), // "170 (Ears Included)" → "170 cm (Ears Included)"
      birthday: pick(/^Partner_Birthday/),
      description:
        pick(/^Partner_ProfileDesc_/) ??
        (cleanText(t(`Partner_ProfileDesc_${id}`)) || undefined) ??
        (cleanText(t(PROFILE_FALLBACK[id]?.description))?.replace(/^• /gm, "") || undefined),
      version: ZZZ_VERSION_MAP[name] ?? null,
      cv: ZZZ_CV[name],
      stats: agentStats(a),
      extraStats: extraStats(a),
      levelExp: LEVEL_EXP.agent,
      skins: agentSkins(d, id),
      build: agentBuild(d, id),
      signatureWeapon: weaponName(a.WeaponId),
      costs: Object.keys(costs).length ? costs : undefined,
      glossary: agentGlossary(d, id, base[8]),
      images: {
        // Bust portrait for lists (the circle icon stays as a fallback)
        icon: nano(String(a.Image).replace(/IconRole(\d+)/, "IconRoleCrop$1")),
        circle: `https://enka.network${a.CircleIcon}`,
        splash: `https://enka.network${a.Image}`,
        faction: (() => {
          const faction = t(ui.get(id)?.[3])?.trim();
          // An alternate version may belong to another faction than its original
          return (partner.has(id) && factionIcon(p)) || CAMP_ICONS_BY_NAME.get(faction) || FACTION_ICON_FALLBACK[faction];
        })(),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} agents`);
}

/** Hover glossary: the nouns the agent's texts point to, plus the agent's own nouns. */
function agentGlossary(d, id, code) {
  const ids = new Set();
  const keys = [];
  for (const r of d.AvatarSkillDes) if (r[1] === id && r[2] === 0) keys.push(r[5]);
  for (const r of d.AvatarTalent) if (r[0] === id) keys.push(r[6]);
  for (const r of d.AvatarPassiveSkill) if (r[1] === id) keys.push(...(r[8] || []));
  keys.push(`${code}_UniqueSkill_01_Desc`, `${code}_MathSkill_Desc`);
  for (const k of keys) for (const m of String(t(k) ?? "").matchAll(/<Term:(\d+)>/g)) ids.add(Number(m[1]));
  for (const [nid, n] of NOUNS) if (String(n.key).startsWith(`${code}_`)) ids.add(nid);
  const out = new Map();
  for (const nid of ids) {
    const n = NOUNS.get(nid);
    if (n && !out.has(n.name.toLowerCase())) out.set(n.name.toLowerCase(), { name: n.name, desc: n.desc });
  }
  return out.size ? [...out.values()] : undefined;
}

// ── Agent kits ──────────────────────────────────────────────────────────────

function kitSkills(d, id, skillRows) {
  const skills = {};
  const rows = d.AvatarSkillDes.filter((r) => r[1] === id).sort((a, b) => a[0] - b[0]);
  for (const [cat, key] of Object.entries(SKILL_TYPES)) {
    const own = rows.filter((r) => r[3] === Number(cat));
    const entries = own
      .filter((r) => r[2] === 0 && t(r[4]))
      .map((r) => ({ name: cleanText(t(r[4])), desc: cleanText(t(r[5])) }))
      .filter((e) => e.name);
    const params = [];
    let group = null;
    for (const r of own.filter((x) => x[2] === 1)) {
      const label = t(r[5]);
      const spec = r[6];
      if (!spec) {
        group = cleanText(label) || group; // a sub-skill title starts a group
        continue;
      }
      const values = [];
      for (let lv = 1; lv <= SKILL_MAX_LEVEL; lv++) {
        values.push(spec.includes("Skill:") ? skillValue(spec, lv, skillRows) : fixedValue(t(spec), lv));
      }
      if (!label || values.every((v) => v == null)) continue;
      params.push({ group: group || undefined, name: cleanText(label), values: values.map((v) => v ?? "—") });
    }
    if (entries.length) skills[key] = { name: SKILL_NAMES[key], entries, params, maxLevel: SKILL_MAX_LEVEL };
  }
  return skills;
}

function kitCore(d, id, code) {
  const passive = d.AvatarPassiveSkill.filter((r) => r[1] === id).sort((a, b) => a[3] - b[3]);
  const levels = [{ level: 0, label: CORE_LABELS[0], desc: cleanText(t(`${code}_UniqueSkill_01_Desc`)) }];
  for (const r of passive) {
    levels.push({
      level: r[3],
      label: CORE_LABELS[r[3]] ?? String(r[3]),
      unlockLevel: r[2] || undefined,
      desc: (r[8] || []).map((k) => cleanText(t(k))).filter(Boolean).join("\n\n") || undefined,
      stats: pairs(r[6])
        .filter(([, v]) => v > 0)
        .map(([pid, v]) => ({ name: propName(pid), value: propValue(pid, v) })),
    });
  }
  const title = (passive[0]?.[7] || []).map((k) => t(k)).find(Boolean) || t(`${code}_UniqueSkill_Title`);
  const math = cleanText(t(`${code}_MathSkill_Desc`));
  return {
    name: cleanText(title) || "Core Passive",
    levels: levels.filter((l) => l.desc || l.stats?.length),
    additional: math ? { name: cleanText(t(`${code}_MathSkill_Title`)) || "Additional Ability", desc: math } : undefined,
  };
}

function kitMindscapes(d, id) {
  return d.AvatarTalent.filter((r) => r[0] === id)
    .sort((a, b) => a[1] - b[1])
    .map((r) => ({
      index: r[1],
      name: cleanText(t(r[3]) || t(r[7])),
      desc: cleanText(t(r[6]) || t(r[4])),
      flavor: cleanText(t(r[5])),
    }))
    .filter((m) => m.name && m.desc);
}

function kitCosts(d, id) {
  const costs = {};
  for (const r of d.AvatarSkillLevel.filter((x) => x[1] === id)) {
    const key = SKILL_TYPES[r[2]];
    if (!key) continue;
    const list = costList(r[5]);
    if (!list.length) continue;
    (costs[key] ??= {})[`lvl${r[3] + 1}`] = list; // row L = cost of L → L+1
  }
  for (const r of d.AvatarPassiveSkill.filter((x) => x[1] === id)) {
    const list = costList(r[9]);
    if (list.length) (costs.core ??= {})[`lvl${r[3] + 1}`] = list; // core level 1 (A) = "lvl2"
  }
  return costs;
}

async function seedKits(d) {
  const skillRows = new Map(d.AvatarSkill.map((r) => [r[0], [r[3], r[4], r[5], r[6]]]));
  let count = 0;
  for (const base of playableAgents(d)) {
    const id = base[0];
    const name = t(base[2]).trim();
    const code = base[8];
    await upsert(AgentKit, { game: GAME, name }, {
      game: GAME,
      name,
      skills: kitSkills(d, id, skillRows),
      core: kitCore(d, id, code),
      mindscapes: kitMindscapes(d, id),
      costs: kitCosts(d, id),
    });
    count++;
  }
  console.log(`  ✓ ${count} agent kits`);
}

// ── W-Engines ───────────────────────────────────────────────────────────────

async function seedWeapons(d) {
  const levelRate = new Map(d.WeaponLevel.map((r) => [`${r[0]}:${r[1]}`, r[2]]));
  const stars = d.WeaponStar;
  const starOf = (rarity, lv) =>
    stars.filter((r) => r[0] === rarity && lv > r[2] && lv <= r[3]).sort((a, b) => a[1] - b[1])[0] ??
    stars.find((r) => r[0] === rarity && r[1] === 0);
  const talents = new Map();
  for (const r of d.WeaponTalent) (talents.get(r[0]) ?? talents.set(r[0], []).get(r[0])).push(r);
  // Signature W-Engines come out with their agent (the datamine ships content early)
  const agentNames = new Map(d.AvatarBase.map((r) => [r[0], t(r[2])?.trim()]));
  const signatureVersion = new Map();
  const signatureAgent = new Map();
  for (const [aid, a] of Object.entries(ENKA.avatars)) {
    const agent = agentNames.get(Number(aid));
    if (a.WeaponId && agent) signatureAgent.set(a.WeaponId, agent);
    const v = ZZZ_VERSION_MAP[agent];
    if (a.WeaponId && v) signatureVersion.set(a.WeaponId, v);
  }
  const seen = new Set();
  let count = 0;
  for (const w of d.Weapon) {
    const id = w[0];
    const e = ENKA.weapons[id];
    const item = ITEMS.get(id);
    const name = (e && (ENKA.locs[e.ItemName] || t(e.ItemName))) || (item && t(item[1]));
    if (!e || !name || seen.has(name)) continue;
    seen.add(name);
    const [mainId, mainBase] = Object.values(w[2]);
    const [subId, subBase] = Object.values(w[3]);
    const rarity = e.Rarity; // 2 = B, 3 = A, 4 = S
    const pct = isPercentProp(subId);
    const stats = {};
    for (let lv = 1; lv <= 60; lv++) {
      const st = starOf(rarity, lv);
      const rate = levelRate.get(`${rarity}:${lv}`);
      if (rate == null || !st) continue;
      const atk = mainBase * (1 + rate / 10000 + st[4] / 10000);
      const sub = subBase * (1 + st[5] / 10000);
      stats[lv] = { atk: Math.floor(atk), specialized: pct ? sub / 10000 : Math.floor(sub) };
    }
    const costs = {};
    costString(w[11]).forEach((phase, i) => {
      const list = costList(phase.map(([a, b]) => ({ a, b })));
      if (list.length) costs[`ascend${i + 1}`] = list;
    });
    const refs = (talents.get(id) || []).sort((a, b) => a[1] - b[1]);
    const desc = w.find((v) => typeof v === "string" && /_Desc$/.test(v) && t(v));
    const comment = w.find((v) => typeof v === "string" && /_Comment$/.test(v) && t(v));
    await upsert(Weapon, { game: GAME, name }, {
      game: GAME,
      sourceId: id,
      name,
      description: cleanText(t(comment) || t(desc) || (item && t(item[7]))),
      weaponType: e.ProfessionType,
      rarity: rarity + 1, // 3★ B, 4★ A, 5★ S (same scale as agents)
      baseAtkValue: mainBase,
      mainStatType: `ZZZ_${subId}${pct ? "" : "_FLAT"}`,
      mainStatText: propName(subId),
      baseStatText: propName(mainId),
      effectName: cleanText(t(refs[0]?.[2])),
      refinements: refs.map((r) => ({ description: cleanText(t(r[3])) })).filter((r) => r.description),
      version: signatureVersion.get(id) ?? WEAPON_VERSIONS[id] ?? null,
      levelExp: LEVEL_EXP.weapon[rarity],
      signatureOf: signatureAgent.get(id),
      stats,
      costs: Object.keys(costs).length ? costs : undefined,
      images: { icon: `https://enka.network${e.ImagePath}` },
    });
    count++;
  }
  console.log(`  ✓ ${count} W-Engines`);
}

// ── Drive Discs ─────────────────────────────────────────────────────────────

/**
 * Drive Disc main stats per slot and substats, at the highest rank and level
 * (EquipmentRarity → property library; main stats grow ×(1 + rate) up to level 15).
 */
function discStatTable(d) {
  const lib = new Map();
  for (const r of d.RandPropertyLibrary) (lib.get(r[1]) ?? lib.set(r[1], []).get(r[1])).push([r[2], r[3]]);
  const maxRate = Math.max(...d.EquipmentLevel.filter((r) => r[0] === 4).map((r) => r[2]));
  const slots = d.EquipmentRarity.filter((r) => r[0] === 4)
    .sort((a, b) => a[1] - b[1])
    .map((r) => ({
      slot: r[1],
      maxLevel: r[4],
      mainStats: (lib.get(r[2]) || []).map(([pid, v]) => ({
        name: propName(pid),
        base: propValue(pid, v),
        max: propValue(pid, v * (1 + maxRate / 10000)),
      })),
    }));
  const subs = (lib.get(4000) || []).map(([pid, v]) => ({ name: propName(pid), value: propValue(pid, v) }));
  return { rank: "S", slots, substats: subs };
}

async function seedDiscs(d) {
  await upsert(Reference, { game: GAME, name: "Drive Disc stats" }, {
    game: GAME,
    name: "Drive Disc stats",
    data: discStatTable(d),
  });
  let count = 0;
  for (const r of d.EquipmentSuit) {
    const name = t(r[1])?.trim();
    const two = cleanText(t(r[4]));
    if (!name || !two) continue;
    await upsert(Relic, { game: GAME, name }, {
      game: GAME,
      sourceId: r[0],
      name,
      type: "disc",
      rarity: [3, 4, 5],
      twoPieceBonus: two,
      fourPieceBonus: cleanText(t(r[7])),
      description: cleanText(t(r[9])),
      version: DISC_VERSIONS[r[0]] ?? null,
      images: { icon: img(r[8]) },
    });
    count++;
  }
  console.log(`  ✓ ${count} Drive Disc sets`);
}

// ── Bangboos ────────────────────────────────────────────────────────────────

const BANGBOO_SKILL_KINDS = { 2: "Active Skill", 3: "Additional Ability", 4: "Bangboo Chain Attack" };

let BANGBOO_ICONS = new Map();

async function seedBangboos(d) {
  const ui = new Map(d.BuddyUI.map((r) => [r[0], r]));
  const skillRows = new Map(d.BuddySkill.map((r) => [r[0], [r[2], r[3], r[4], r[5]]]));
  const seen = new Set();
  let count = 0;
  for (const b of d.BuddyBase) {
    const id = b[0];
    const name = t(b[5])?.trim();
    if (!name || id < 53000 || id >= 55000 || seen.has(name)) continue; // 53xxx A, 54xxx S
    seen.add(name);
    const rows = d.BuddySkillLevelUp.filter((r) => r[1] === id);
    const skills = [];
    for (const kind of [2, 3, 4]) {
      const list = rows.filter((r) => r[3] === kind).sort((a, b) => a[4] - b[4]);
      if (!list.length) continue;
      const first = list[0];
      const specs = String(first[8] || "").split("|");
      const labels = (first[10] || []).map((k) => cleanText(t(k)));
      const params = specs
        .map((spec, i) => {
          const values = list.map((r) => {
            const s = String(r[8] || "").split("|")[i];
            if (!s) return "—";
            return s.includes("Skill:") ? skillValue(s, r[4], skillRows) ?? "—" : fixedValue(t(s), r[4]) ?? "—";
          });
          return { name: labels[i] || "", values };
        })
        .filter((p) => p.name && p.values.some((v) => v !== "—"));
      // The kind ("Active Skill") is shown apart; some texts change with the level
      const descOf = (r) => cleanText(t(r[7]))?.replace(/^\*\*[^*]+\*\*\n/, "");
      const descs = list.map(descOf);
      skills.push({
        kind: BANGBOO_SKILL_KINDS[kind],
        name: cleanText(t(first[6])),
        desc: descs[0],
        descs: new Set(descs).size > 1 ? descs : undefined,
        params,
        maxLevel: list.length,
      });
    }
    await upsert(Bangboo, { game: GAME, name }, {
      game: GAME,
      sourceId: id,
      name,
      rarity: id >= 54000 ? 5 : 4,
      version: BANGBOO_VERSIONS[id] ?? null,
      description: cleanText(t(ui.get(id)?.[2])),
      skills,
      images: BANGBOO_ICONS.has(id) ? { icon: nano(BANGBOO_ICONS.get(id)) } : {},
    });
    count++;
  }
  console.log(`  ✓ ${count} Bangboos`);
}

// ── Materials ───────────────────────────────────────────────────────────────

async function seedMaterials() {
  const seen = new Set();
  let count = 0;
  for (const id of [...USED_ITEMS].sort((a, b) => a - b)) {
    const it = ITEMS.get(id);
    const name = it && t(it[1])?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const desc = cleanText(t(it[5]));
    const lore = cleanText(t(it[7]));
    await upsert(Material, { game: GAME, name }, {
      game: GAME,
      sourceId: id,
      name,
      description: [desc, lore].filter(Boolean).join("\n\n") || undefined,
      category: categoryOf(it),
      rarity: typeof it[2] === "number" ? it[2] + 1 : undefined,
      source: itemSources(it),
      images: { icon: itemIcon(id) },
    });
    count++;
  }
  console.log(`  ✓ ${count} materials`);
}

/** Where the game says an item is obtained (Item → AccessConfig: "[Obtain] Notorious Hunt"…). */
function itemSources(it) {
  const access = ACCESS.get(it[4]);
  if (!access) return undefined;
  const list = access
    .slice(3)
    .filter((v) => typeof v === "string" && v.startsWith("TextMap_Access"))
    .map((k) => cleanText(t(k))?.replace(/^\[Obtain\]\s*/, "").trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : undefined;
}

function categoryOf(it) {
  const tag = it.find((v) => typeof v === "string" && /^(Avatar|Weapon|Buddy)\w*Material$|^Gold$/.test(v));
  return (
    {
      AvatarRankMaterial: "Agent Promotion",
      AvatarSkillMaterial: "Skill Material",
      AvatarTalentMaterial: "Core Skill Material",
      WeaponRankMaterial: "W-Engine Promotion",
    }[tag] || (it[0] === 10 ? "Currency" : undefined)
  );
}

// ── Entry points ────────────────────────────────────────────────────────────

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

/** Run every ZZZ seeder (used by the sync engine in recording mode). */
async function seedAll() {
  const d = await fetchAll();
  await seedCharacters(d);
  await seedKits(d);
  await seedWeapons(d);
  await seedDiscs(d);
  await seedBangboos(d);
  await seedMaterials();
  TEXT = new Map(); // free memory
  NOUNS = new Map();
  ITEMS = new Map();
  USED_ITEMS = new Set();
  ENKA = null;
}

async function main() {
  await connectDB();
  console.log("\nSeeding Zenless Zone Zero data...");
  const start = Date.now();
  await seedAll();
  console.log(`\n✅ ZZZ seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await mongoose.connection.close();
}

module.exports = { seedAll, setRef, GAME, REPO, _test: { cleanText, skillValue, fixedValue } };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
