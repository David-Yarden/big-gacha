/**
 * Wuthering Waves Data Seeder
 *
 * Data:   Arikatsu/WutheringWaves_Data (GitHub, datamined BinData + Textmaps)
 * Images: api.encore.moe resource CDN (same Unreal asset paths, served as .webp)
 *
 * Run:       npm run seed:wuwa        (also used by the sync engine)
 *
 * Imports:
 *   Characters (Rover merged into one document with element variants)
 *   Weapons (passive with R1–R5 values)
 *   Resonance Chains (S1–S6)
 *   Sonata Effects (echo sets, 2/3/5-piece bonuses)
 *   Echoes (cost, sonata sets, echo skill)
 *   Fortes (skills with per-level values, inherent skills, stat nodes, level-up costs)
 * Not yet: stats per level, ascension costs, materials pages.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
delete require.cache[require.resolve("./signatures")]; // edits to the table apply on the next sync
const { signatureOf, signatureWeapon } = require("./signatures");
const { Character, Weapon, ResonanceChain, Echo, EchoSet, Forte, Material, Reference } = require("../models");

const GAME = "wuwa";
const REPO = "Arikatsu/WutheringWaves_Data";
// Data is read at the exact commit the sync checked (HEAD when run by hand)
let REF = "HEAD";
function setRef(ref) {
  REF = ref || "HEAD";
}
const { fetchData, tryFetch } = require("../sync/http");
const ENCORE = "https://api.encore.moe";

// ── Version map ─────────────────────────────────────────────────────────────
// FROZEN history (characters released before the automatic sync existed).
// Do not extend it: a new character automatically gets the game version announced by
// the source the day it first appears (sync engine), and known versions are never erased.
const WUWA_VERSION_MAP = {
  // 1.0 (May 22, 2024)
  Yangyang: "1.0", Chixia: "1.0", Baizhi: "1.0", Lingyang: "1.0", Rover: "1.0", Verina: "1.0",
  Aalto: "1.0", Taoqi: "1.0", Jianxin: "1.0", Calcharo: "1.0", Encore: "1.0", Jiyan: "1.0",
  Mortefi: "1.0", Danjin: "1.0", Sanhua: "1.0", Yuanwu: "1.0", Yinlin: "1.0",
  // 1.1 – 1.4
  Jinhsi: "1.1", Changli: "1.1",
  Zhezhi: "1.2", "Xiangli Yao": "1.2",
  Shorekeeper: "1.3", Youhu: "1.3",
  Camellya: "1.4", Lumi: "1.4",
  // 2.x
  Carlotta: "2.0", Roccia: "2.0",
  Phoebe: "2.1", Brant: "2.1",
  Cantarella: "2.2",
  Zani: "2.3", Ciaccona: "2.3",
  Cartethyia: "2.4", Lupa: "2.4",
  Phrolova: "2.5",
  Augusta: "2.6", Iuno: "2.6",
  Galbrena: "2.7", Qiuyuan: "2.7",
  Chisa: "2.8", Buling: "2.8",
  // 3.x (sources: topuplive banner history, theclick.gg — checked 2026-10)
  Lynae: "3.0", Mornye: "3.0",
  Aemeath: "3.1", "Luuk Herssen": "3.1",
  Sigrika: "3.2",
  Hiyuki: "3.3", Denia: "3.3",
  Lucy: "3.4", Rebecca: "3.4", Lucilla: "3.4",
  Xuanling: "3.5", XuanLing: "3.5", "Yangyang: Xuanling": "3.5", Suisui: "3.5",
  Qingxiao: "3.6", Jingran: "3.6",
  Hsin: "3.7", Suoming: "3.7", "Suo Ming": "3.7",
};

// ── Mappings ─────────────────────────────────────────────────────────────────

const ELEMENTS = { 1: "Glacio", 2: "Fusion", 3: "Electro", 4: "Aero", 5: "Spectro", 6: "Havoc" };
const WEAPON_TYPES = { 1: "Broadblade", 2: "Sword", 3: "Pistols", 4: "Gauntlets", 5: "Rectifier" };
// Sonata icon file names → element
const FETTER_ELEMENTS = { Ice: "Glacio", Fire: "Fusion", Thunder: "Electro", Wind: "Aero", Light: "Spectro", Dark: "Havoc" };
// phantomrarity.json: Rare → cost (0→1, 1→3, 2→4, 3→4)
const ECHO_CLASS = { 0: "Common", 1: "Elite", 2: "Overlord", 3: "Calamity" };
const ECHO_COST = { 0: 1, 1: 3, 2: 4, 3: 4 };

// Nations as the game's own Resonator profile names them (FavorRoleInfo "Country").
// Cities/areas map to their nation; anything else (Unknown, redacted) → no region.
const NATIONS = ["Huanglong", "New Federation", "Rinascita", "Lahai-Roi", "Ashinohara", "The Black Shores"];
const PLACE_TO_NATION = [
  [/jinzhou|mengzhou|chongzhou|mingting|ministry of war|zhaoming/i, "Huanglong"],
  [/ragunna|septimont|montelli|fisalia|troupe of fools|order of the deep/i, "Rinascita"],
  [/lahai-roi|roya tribe/i, "Lahai-Roi"],
  [/black shores/i, "The Black Shores"],
];

/** Region from the profile: country first, then a place named in the affiliation. */
function wuwaRegion(country, influence) {
  const c = String(country ?? "").trim();
  const exact = NATIONS.find((n) => n.toLowerCase() === c.toLowerCase().replace(/^black shores$/, "the black shores"));
  if (exact) return exact;
  for (const text of [c, influence]) {
    for (const [re, nation] of PLACE_TO_NATION) if (re.test(String(text ?? ""))) return nation;
  }
  return null;
}

/** Profile text cleaned: strike-through and placeholder glyphs removed. */
function profileText(key) {
  const v = cleanText(t(key))?.replace(/<\/?s>/g, "");
  if (!v || /^unknown$/i.test(v) || /[█▉]/.test(v)) return undefined;
  return v;
}

const TEXT_PREFIXES = /^(RoleInfo_|FavorRoleInfo_|WeaponConf_|WeaponReson_|ResonantChain_|PhantomFetter_|PhantomSkill_|MonsterInfo_|Skill_|SkillTree_|SkillDescription_|PropertyIndex_|ItemInfo_\d+_(?:Name|AttributesDescription|BgDescription)$|AccessPath_|ItemShowType_|Term\d+_(?:Title|Desc)$|RoleSkin_\d+_(?:TitleName|BgDescription)$)/;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

async function getJson(path) {
  // MultiText is ~50 MB: give big files time
  return fetchData(`https://raw.githubusercontent.com/${REPO}/${REF}/${path}`, { timeout: 300_000 });
}

/** Unreal asset path → encore.moe webp URL. */
function img(assetPath) {
  if (!assetPath) return undefined;
  const clean = assetPath.split(".")[0];
  return `${ENCORE}/resource/Data${clean}.webp`;
}

/**
 * Game text → readable text: <color=…>X</color> → **X**, other tags removed,
 * {0} {1} … replaced by params when given.
 */
function cleanText(text, params) {
  if (!text) return undefined;
  let s = String(text)
    // Platform-dependent verbs: {Cus:Ipt,Touch=tap PC=press Gamepad=press} → "press" (PC wording)
    .replace(/\{Cus:Ipt,[^}]*?PC=([^\s}]+)[^}]*\}/g, "$1")
    .replace(/<color=[^>]*>([\s\S]*?)<\/color>/g, "**$1**")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n");
  if (params) s = s.replace(/\{(\d+)\}/g, (m, i) => (params[Number(i)] ?? m));
  return s.trim();
}

let TEXT = new Map();
let LEVELING = null;
let ITEMS = new Map();
let ACCESS = new Map();
let SHOW_TYPES = new Map();
let USED_ITEMS = new Set(); // every item a cost list referenced → Materials page

/** Item list from the game's { Key: itemId, Value: count } format. */
function consumeList(list) {
  return (list ?? [])
    .map(({ Key, Value }) => {
      const it = ITEMS.get(Key);
      if (Value > 0) USED_ITEMS.add(Key);
      return {
        id: Key,
        name: (it && t(it.Name)) || (Key === 2 ? "Shell Credit" : String(Key)),
        count: Value,
        icon: it ? img(it.IconMiddle || it.Icon) : undefined,
      };
    })
    .filter((x) => x.count > 0);
}

/** Ascension phase for a level (level 20 is still phase 0 until you ascend). */
function phaseOf(level) {
  if (level <= 20) return 0;
  if (level <= 40) return 1;
  return Math.min(6, Math.ceil((level - 40) / 10) + 1);
}

/** Base stats per level, ascension costs and EXP curve for a resonator. */
function leveling(role) {
  if (!LEVELING) return {};
  const base = LEVELING.baseProps.get(role.PropertyId);
  const stats = {};
  if (base) {
    for (let lvl = 1; lvl <= 90; lvl++) {
      const g = LEVELING.growthIdx.get(`${lvl}:${phaseOf(lvl)}`);
      if (!g) continue;
      stats[lvl] = {
        hp: (base.LifeMax * g.LifeMaxRatio) / 10000,
        atk: (base.Atk * g.AtkRatio) / 10000,
        def: (base.Def * g.DefRatio) / 10000,
      };
    }
  }
  const costs = {};
  for (const b of LEVELING.breaches.filter((x) => x.BreachGroupId === role.BreachId)) {
    if (b.BreachLevel >= 1) costs[`ascend${b.BreachLevel}`] = consumeList(b.BreachConsume);
  }
  // Cumulative EXP to reach each level + the EXP potions
  const steps = LEVELING.levelConsume
    .filter((x) => x.ConsumeGroupId === role.LevelConsumeId)
    .sort((a, b) => a.Level - b.Level);
  const exp = [];
  let total = 0;
  for (const st of steps) { total += st.ExpCount; exp[st.Level] = total; }
  const potions = LEVELING.expItems
    .map((x) => {
      const it = ITEMS.get(x.Id);
      USED_ITEMS.add(x.Id);
      return { id: x.Id, name: (it && t(it.Name)) || String(x.Id), exp: x.BasicExp, icon: it ? img(it.IconMiddle || it.Icon) : undefined };
    })
    .sort((a, b) => b.exp - a.exp);
  return {
    stats: Object.keys(stats).length ? stats : undefined,
    costs: Object.keys(costs).length ? costs : undefined,
    levelExp: exp.length ? { exp: Array.from(exp, (v) => v ?? 0), items: potions } : undefined,
  };
}
let FAVOR = new Map();

/** Profile fields (nation, affiliation, birthday, gender, voice actors). */
function profile(roleId) {
  const f = FAVOR.get(roleId);
  if (!f) return {};
  const affiliation = profileText(f.Influence);
  const cv = {
    english: profileText(f.CVNameEn),
    chinese: profileText(f.CVNameCn),
    japanese: profileText(f.CVNameJp),
    korean: profileText(f.CVNameKo),
  };
  return {
    region: wuwaRegion(profileText(f.Country), affiliation),
    affiliation,
    birthday: profileText(f.Birthday),
    gender: profileText(f.Sex),
    cv: Object.values(cv).some(Boolean) ? cv : undefined,
  };
}
const t = (key) => (key ? TEXT.get(key) : undefined);

/**
 * The texts we use, out of MultiText.json (~50 MB). The filtered result is cached on disk
 * (cache/) per version of that file, so a sync only downloads it when it really changed.
 */
async function loadTexts() {
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const { githubLastCommitFor } = require("../sync/upstream");
  const FILE = "Textmaps/en/multi_text/MultiText.json";
  const dir = path.join(__dirname, "..", "..", "cache");

  const textSha = await githubLastCommitFor(REPO, FILE, REF);
  const filterKey = crypto.createHash("sha1").update(TEXT_PREFIXES.source).digest("hex").slice(0, 8);
  const cacheFile = textSha ? path.join(dir, `wuwa-text-${textSha.slice(0, 12)}-${filterKey}.json`) : null;

  if (cacheFile && fs.existsSync(cacheFile)) {
    try {
      const map = new Map(JSON.parse(fs.readFileSync(cacheFile, "utf8")));
      console.log(`  ✓ Texts from cache (${map.size})`);
      return map;
    } catch {
      /* corrupt cache: download again */
    }
  }

  const multiText = await getJson(FILE);
  const map = new Map(multiText.filter((x) => TEXT_PREFIXES.test(x.Id)).map((x) => [x.Id, x.Content]));
  if (cacheFile) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (const f of fs.readdirSync(dir)) if (f.startsWith("wuwa-text-")) fs.unlinkSync(path.join(dir, f));
      fs.writeFileSync(cacheFile, JSON.stringify([...map]));
    } catch (err) {
      console.warn(`  ⚠ Text cache not written: ${err.message}`);
    }
  }
  return map;
}

/** Download every file the seeders need. */
async function fetchAll() {
  console.log(`Fetching data from ${REPO}...`);
  const [roles, weapons, weaponReson, chains, fetterGroups, fetters, phantoms, phantomSkills, multiText] = await Promise.all([
    getJson("BinData/role/roleinfo.json"),
    getJson("BinData/weapon/weaponconf.json"),
    getJson("BinData/weapon/weaponreson.json"),
    getJson("BinData/resonate_chain/resonantchain.json"),
    getJson("BinData/phantom/phantomfettergroup.json"),
    getJson("BinData/phantom/phantomfetter.json"),
    getJson("BinData/phantom/phantomitem.json"),
    getJson("BinData/phantom/phantomskill.json"),
    loadTexts(),
  ]);
  const [skills, skillDescs, skillLevels, skillTree, items] = await Promise.all([
    getJson("BinData/skill/skill.json"),
    getJson("BinData/skill/skilldescription.json"),
    getJson("BinData/skill/skilllevel.json"),
    getJson("BinData/skillTree/skilltree.json"),
    getJson("BinData/item/iteminfo.json"),
  ]);
  const [baseProps, growth, breaches, levelConsume, expItems, weaponGrowth, weaponBreaches, propIndex] = await Promise.all([
    getJson("BinData/property/baseproperty.json"),
    getJson("BinData/property/rolepropertygrowth.json"),
    getJson("BinData/role_level/rolebreach.json"),
    getJson("BinData/role_level/rolelevelconsume.json"),
    getJson("BinData/role/roleexpitem.json"),
    getJson("BinData/property/weaponpropertygrowth.json"),
    getJson("BinData/weapon/weaponbreach.json"),
    getJson("BinData/property/propertyindex.json"),
  ]);
  const [accessPaths, showTypes, echoRecommend, echoMainRecommend] = await Promise.all([
    getJson("BinData/accesspath/accesspath.json"),
    getJson("BinData/item/itemshowtype.json"),
    // The game's recommended echoes: Sonata sets per Resonator, main stats per set and cost
    getJson("BinData/VisionRecommend/phantomrecommend.json").catch(() => []),
    getJson("BinData/VisionRecommend/refinerecommend.json").catch(() => []),
  ]);
  ECHO_RECOMMEND = { roles: new Map(echoRecommend.map((x) => [x.RoleId, x])), mains: echoMainRecommend, sets: fetterGroups };
  ACCESS = new Map(accessPaths.map((a) => [a.Id, a]));
  SHOW_TYPES = new Map(showTypes.map((x) => [x.Id, x]));
  USED_ITEMS = new Set();
  LEVELING = {
    baseProps: new Map(baseProps.map((b) => [b.Id, b])), growth, breaches, levelConsume, expItems,
    weaponGrowth, weaponBreaches, props: new Map(propIndex.map((p) => [p.Id, p])),
    // Lookup tables (instead of scanning the arrays for every level of every item)
    growthIdx: new Map(growth.map((g) => [`${g.Level}:${g.BreachLevel}`, g])),
    weaponGrowthIdx: new Map(weaponGrowth.map((g) => [`${g.CurveId}:${g.Level}:${g.BreachLevel}`, g.CurveValue])),
  };
  ITEMS = new Map(items.map((x) => [x.Id, x]));
  const favor = await getJson("BinData/favor/favorroleinfo.json").catch(() => []);
  const skins = await getJson("BinData/role/roleskin.json").catch(() => []);
  SKINS = new Map();
  for (const sk of skins) (SKINS.get(sk.RoleId) ?? SKINS.set(sk.RoleId, []).get(sk.RoleId)).push(sk);
  FAVOR = new Map(favor.map((f) => [f.RoleId, f]));
  TEXT = multiText;
  console.log(`  ✓ All data fetched (${TEXT.size} texts)\n`);
  return {
    roles, weapons, weaponReson, chains, fetterGroups, fetters, phantoms, phantomSkills,
    skills, skillDescs, skillLevels, skillTree, items,
  };
}

/** Exact splash art path from encore.moe (asset file names are case-sensitive). */
const ENCORE_CACHE = new Map();

/** encore.moe's character page data (splash path, Skill Input guide). Cached per run. */
async function encoreCharacter(roleId) {
  if (ENCORE_CACHE.has(roleId)) return ENCORE_CACHE.get(roleId);
  const j = await tryFetch(`${ENCORE}/en/character/${roleId}`, { timeout: 30_000 });
  ENCORE_CACHE.set(roleId, j);
  return j;
}

async function encoreSplash(roleId) {
  return (await encoreCharacter(roleId))?.FormationRoleCard || undefined;
}

/** Rover's splash per element, with the same "keep what we have if encore.moe is down" rule. */
async function roverSplash(roleId, element, icon) {
  const fresh = await encoreSplash(roleId);
  if (fresh) return fresh;
  const prev = await Character.findOne({ game: GAME, name: "Rover" }, { elementVariants: 1 }).lean().catch(() => null);
  return prev?.elementVariants?.[element]?.images?.splash ?? icon;
}

/**
 * Splash art for a character: encore.moe's exact path; if encore.moe is down, keep the
 * splash already in the database rather than replacing it with the small icon.
 */
async function splashFor(roleId, name, icon) {
  const fresh = await encoreSplash(roleId);
  if (fresh) return fresh;
  const prev = await Character.findOne({ game: GAME, name }, { images: 1 }).lean().catch(() => null);
  return prev?.images?.splash ?? icon;
}

/** encore's HTML text → our text: highlighted spans → **bold**, key images → [[key:Name|iconUrl]]. */
function encoreText(html) {
  if (!html) return undefined;
  return String(html)
    .replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/g, (_, src, alt) => `[[key:${alt}|${src}]]`)
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/g, "**$1**")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * The in-game "Skill Input" guide: features, Forte Gauge rules, how to trigger the
 * key moves, and the resonance modes when the character has several.
 */
async function skillGuide(roleId) {
  const j = await encoreCharacter(roleId);
  const input = Array.isArray(j?.SkillInputs) ? j.SkillInputs[0] : null;
  if (!input) return undefined;
  const guide = {
    features: (input.SkillDescList ?? []).map(encoreText).filter(Boolean),
    forteGauge: (input.DescList ?? []).map(encoreText).filter(Boolean),
    instructions: (input.InputDetails ?? []).map((x) => encoreText(x.description)).filter(Boolean),
    modes: (Array.isArray(j.SkillBranches) ? j.SkillBranches : [])
      .map((b) => ({ name: b.Name, desc: encoreText(b.Desc), icon: b.Icon }))
      .filter((b) => b.name),
  };
  const empty = !guide.features.length && !guide.forteGauge.length && !guide.instructions.length;
  return empty ? undefined : guide;
}

// ── Characters ───────────────────────────────────────────────────────────────

/**
 * Hover glossary: the game marks terms as <te href=ID>Label</te> in skill and chain
 * texts; Term<ID>_Title / Term<ID>_Desc hold their explanation.
 */
function wuwaGlossary(roleList, d) {
  const texts = [];
  for (const role of roleList) {
    for (const sk of d.skills.filter((x) => x.SkillGroupId === role.SkillId)) {
      texts.push(t(sk.SkillDescribe), t(sk.SkillResume));
    }
    for (const c of d.chains.filter((x) => x.GroupId === role.ResonantChainGroupId)) {
      texts.push(t(c.AttributesDescription));
    }
  }
  const ids = new Set();
  for (const tx of texts) for (const m of String(tx ?? "").matchAll(/<te href=(\d+)>/g)) ids.add(m[1]);
  const out = new Map();
  for (const id of ids) {
    const name = cleanText(t(`Term${id}_Title`));
    const desc = cleanText(t(`Term${id}_Desc`));
    if (name && desc && !out.has(name.toLowerCase())) out.set(name.toLowerCase(), { name, desc });
  }
  return out.size ? [...out.values()] : undefined;
}

function playableRoles(roles) {
  return roles.filter((r) => r.RoleType === 1 && !r.IsTrial && t(r.Name));
}

let SKINS = new Map(); // role id → roleskin rows
let ECHO_RECOMMEND = { roles: new Map(), mains: [], sets: [] };

/**
 * The game's recommended echoes for a Resonator: its Sonata sets (best first) and, for the
 * first one, the main stats the game suggests per echo cost.
 */
function roleBuild(roleId) {
  const rec = ECHO_RECOMMEND.roles.get(roleId);
  if (!rec) return undefined;
  const setName = new Map(ECHO_RECOMMEND.sets.map((g) => [g.Id, t(g.FetterGroupName)?.trim()]));
  const ids = (rec.RecommendFetterGroups || []).filter((id) => setName.get(id));
  if (!ids.length) return undefined;
  const prop = (id) => {
    const p = LEVELING.props.get(id);
    const name = p && cleanText(t(p.Name));
    // Ids 10000+ are the percentage versions of HP / ATK / DEF (10002 = HP%, 10007 = ATK%, 10010 = DEF%)
    return name ? (id >= 10000 && !name.includes("%") ? `${name}%` : name) : undefined;
  };
  const slots = [4, 3, 1]
    .map((cost) => {
      const row = ECHO_RECOMMEND.mains.find((x) => x.Cost === cost && (x.FetterArray || []).includes(ids[0]));
      const stats = (row?.PropertyArray || []).map(prop).filter(Boolean);
      return stats.length ? { slot: `${cost}-Cost`, stats } : null;
    })
    .filter(Boolean);
  return {
    sets: [{ label: "Sonata Effect (5-Piece)", names: ids.map((id) => setName.get(id)) }],
    slots: slots.length ? slots : undefined,
  };
}

/**
 * Outfits of a resonator (only when it has more than its default one). Default skins have
 * ids 8100xxxx and keep the character's own splash; the others use their formation art.
 */
async function roleSkins(roleId, defaultSplash) {
  const rows = (SKINS.get(roleId) || []).filter((sk) => t(sk.TitleName));
  if (rows.length < 2) return undefined;
  return Promise.all(
    rows
      .sort((a, b) => a.Id - b.Id)
      .map(async (sk) => {
        const isDefault = sk.Id < 81010000;
        const name = cleanText(t(sk.TitleName));
        return {
          name,
          desc: cleanText(t(sk.BgDescription)),
          default: isDefault || undefined,
          splash: isDefault ? defaultSplash : await outfitSplash(img(sk.FormationRoleCard), name),
          icon: img(sk.RoleHeadIconLarge),
        };
      })
  );
}

/** true when the URL answers (HEAD); unreachable counts as present, so a down CDN changes nothing. */
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return res.ok || res.status >= 500;
  } catch {
    return true;
  }
}

/** Wiki file URL (fandom stores "A b.png" at /images/<md5[0]>/<md5[0..1]>/A_b.png). */
function wikiFile(fileName) {
  const file = fileName.replace(/ /g, "_");
  const h = require("crypto").createHash("md5").update(file).digest("hex");
  return `https://static.wikia.nocookie.net/wutheringwaves/images/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(file)}`;
}

/**
 * Outfit art: the game's formation card from encore.moe; some are missing there
 * (Zani's "Downtown Repose"), then the wiki's splash art of the outfit.
 */
async function outfitSplash(card, name) {
  if (card && (await urlExists(card))) return card;
  if (name) {
    const wiki = wikiFile(`${name} Splash Art.png`);
    const res = await fetch(wiki, { method: "HEAD", signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (res?.ok) return wiki;
  }
  return card;
}

async function seedCharacters(roles, d) {
  const playable = playableRoles(roles);
  const rovers = playable.filter((r) => /^Rover/.test(t(r.Name)));
  const others = playable.filter((r) => !/^Rover/.test(t(r.Name)));

  // encore.moe pages fetched in parallel up front (splash + Skill Input guide)
  const { mapLimit } = require("../sync/glossary");
  await mapLimit(playable, 6, (r) => encoreCharacter(r.Id));

  const seen = new Set();
  let count = 0;
  for (const r of others) {
    const name = t(r.Name).trim();
    if (seen.has(name)) continue;
    seen.add(name);
    const splash = await splashFor(r.Id, name, img(r.RoleHeadIconLarge));
    await upsert(Character, { game: GAME, name }, {
      game: GAME,
      sourceId: r.Id,
      name,
      description: cleanText(t(r.Introduction)),
      rarity: r.QualityId,
      element: ELEMENTS[r.ElementId],
      weaponType: WEAPON_TYPES[r.WeaponType],
      version: WUWA_VERSION_MAP[name] ?? null,
      signatureWeapon: signatureWeapon(GAME, name),
      build: roleBuild(r.Id),
      ...profile(r.Id),
      ...leveling(r),
      glossary: wuwaGlossary([r], d),
      skins: await roleSkins(r.Id, splash),
      images: {
        icon: img(r.RoleHeadIconLarge),
        sideIcon: img(r.RoleHeadIcon),
        splash,
      },
    });
    count++;
  }

  // Rover: one document, one variant per element (male/female share the kit)
  if (rovers.length) {
    const variants = {};
    for (const r of rovers) {
      const el = ELEMENTS[r.ElementId];
      if (variants[el]) continue;
      variants[el] = {
        sourceId: r.Id,
        images: { icon: img(r.RoleHeadIconLarge), splash: await roverSplash(r.Id, el, img(r.RoleHeadIconLarge)) },
      };
    }
    const base = rovers[0];
    await upsert(Character, { game: GAME, name: "Rover" }, {
      game: GAME,
      sourceId: base.Id,
      name: "Rover",
      description: cleanText(t(base.Introduction)),
      rarity: base.QualityId,
      element: ELEMENTS[base.ElementId],
      weaponType: WEAPON_TYPES[base.WeaponType],
      version: "1.0",
      signatureWeapon: signatureWeapon(GAME, "Rover"),
      build: roleBuild(base.Id),
      ...leveling(base),
      glossary: wuwaGlossary(rovers, d),
      // Outfits are shared by every element (the default one follows the selected element)
      skins: await roleSkins(base.Id, variants[ELEMENTS[base.ElementId]].images.splash),
      images: variants[ELEMENTS[base.ElementId]].images,
      isTraveler: true,
      availableElements: Object.keys(variants),
      elementVariants: variants,
    });
    count++;
  }
  console.log(`  ✓ ${count} resonators (incl. Rover with ${rovers.length} variants)`);
}

// ── Resonance Chains ─────────────────────────────────────────────────────────

function chainDoc(nodes) {
  const doc = { images: {} };
  for (const n of nodes.sort((a, b) => a.GroupIndex - b.GroupIndex).slice(0, 6)) {
    const key = `s${n.GroupIndex}`;
    doc[key] = {
      name: cleanText(t(n.NodeName))?.replace(/\s*\n\s*/g, " "),
      description: cleanText(t(n.AttributesDescription), n.AttributesDescriptionParams),
    };
    doc.images[key] = img(n.NodeIcon);
  }
  return doc;
}

async function seedResonanceChains(roles, chains) {
  const byGroup = new Map();
  for (const c of chains) byGroup.set(c.GroupId, [...(byGroup.get(c.GroupId) ?? []), c]);

  const playable = playableRoles(roles);
  const seen = new Set();
  let count = 0;
  const roverVariants = {};
  for (const r of playable) {
    const name = t(r.Name).trim();
    const nodes = byGroup.get(r.ResonantChainGroupId);
    if (!nodes) continue;
    if (/^Rover/.test(name)) {
      const el = ELEMENTS[r.ElementId];
      if (!roverVariants[el]) roverVariants[el] = chainDoc(nodes);
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    await upsert(ResonanceChain, { game: GAME, name }, { game: GAME, name, ...chainDoc(nodes) });
    count++;
  }
  if (Object.keys(roverVariants).length) {
    const first = Object.values(roverVariants)[0];
    await upsert(ResonanceChain, { game: GAME, name: "Rover" }, {
      game: GAME, name: "Rover", ...first, isTraveler: true, elementVariants: roverVariants,
    });
    count++;
  }
  console.log(`  ✓ ${count} resonance chains`);
}

// ── Fortes (skills) ──────────────────────────────────────────────────────────

// skill.json SkillType → Forte field
const SKILL_FIELDS = {
  1: "basicAtk",
  2: "resonanceSkill",
  3: "resonanceLiberation",
  5: "introSkill",
  6: "forteCircuit",
  11: "outroSkill",
};
const INHERENT_TYPE = 4;
const STAT_NAMES = { "Crit. Rate": "CritRate", "Crit. DMG": "CritDMG", "Healing Bonus": "HealingBonus" };

function forteDoc(role, d) {
  const skills = d.skills.filter((x) => x.SkillGroupId === role.SkillId);
  const nodes = d.skillTree.filter((n) => n.NodeGroup === role.SkillTreeGroupId);
  const consume = consumeList;

  const doc = { costs: {}, images: {} };
  for (const sk of skills) {
    const field = SKILL_FIELDS[sk.SkillType];
    if (!field || doc[field]) continue;
    const max = sk.MaxSkillLevel || 1;
    const attributes = d.skillDescs
      .filter((x) => x.SkillLevelGroupId === sk.SkillLevelGroupId && t(x.AttributeName))
      .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
      .map((x) => ({
        name: t(x.AttributeName),
        // one value per level; several numbers for the same attribute are joined
        values: Array.from({ length: max }, (_, i) =>
          (x.SkillDetailNum ?? []).map((n) => n.ArrayString?.[i] ?? n.ArrayString?.[0]).filter(Boolean).join(" + ")
        ),
      }));
    doc[field] = {
      name: t(sk.SkillName),
      maxLevel: max,
      desc: cleanText(t(sk.SkillDescribe), sk.SkillDetailNum),
      // Short in-game summary ("simple" view)
      resume: cleanText(t(sk.SkillResume), sk.SkillResumeNum),
      icon: img(sk.Icon),
      attributes: attributes.length ? attributes : undefined,
    };
    doc.images[field] = img(sk.Icon);
    if (max > 1) {
      const levels = d.skillLevels.filter((l) => l.SkillLevelGroupId === sk.SkillLevelGroupId);
      const perLevel = {};
      for (const l of levels) if (l.SkillId >= 2) perLevel[`lvl${l.SkillId}`] = consume(l.Consume);
      if (Object.keys(perLevel).length) doc.costs[field] = perLevel;
    }
  }

  // Inherent skills, in tree order (unlocked at Rank 2 and Rank 4)
  const skillById = new Map(skills.map((x) => [x.Id, x]));
  const inherent = nodes
    .filter((n) => skillById.get(n.SkillId)?.SkillType === INHERENT_TYPE)
    .sort((a, b) => a.NodeIndex - b.NodeIndex)
    .map((n) => skillById.get(n.SkillId));
  inherent.slice(0, 2).forEach((sk, i) => {
    doc[`inherentSkill${i + 1}`] = {
      name: t(sk.SkillName),
      desc: cleanText(t(sk.SkillDescribe), sk.SkillDetailNum),
      icon: img(sk.Icon),
      unlockPhase: i === 0 ? 2 : 4,
    };
  });

  // Stat nodes of the tree
  doc.statBonuses = nodes
    .filter((n) => n.NodeType === 4 && n.Property?.length)
    .flatMap((n) =>
      n.Property.map((p) => {
        const title = (t(n.PropertyNodeTitle) || "").replace(/\+$/, "").trim();
        return {
          stat: STAT_NAMES[title] ?? (title || String(p.Id)),
          value: p.IsRatio ? p.Value : p.Value / 10000,
        };
      })
    );
  return doc;
}

async function seedFortes(roles, d) {
  const playable = playableRoles(roles);
  const seen = new Set();
  let count = 0;
  const rovers = [];
  for (const r of playable) {
    const name = t(r.Name).trim();
    if (/^Rover/.test(name)) { rovers.push(r); continue; }
    if (seen.has(name)) continue;
    seen.add(name);
    await upsert(Forte, { game: GAME, name }, { game: GAME, name, ...forteDoc(r, d), guide: await skillGuide(r.Id) });
    count++;
  }
  if (rovers.length) {
    const variants = {};
    for (const r of rovers) {
      const el = ELEMENTS[r.ElementId];
      if (!variants[el]) variants[el] = { ...forteDoc(r, d), guide: await skillGuide(r.Id) };
    }
    const first = variants[ELEMENTS[rovers[0].ElementId]];
    await upsert(Forte, { game: GAME, name: "Rover" }, {
      game: GAME, name: "Rover", ...first, isTraveler: true, elementVariants: variants,
    });
    count++;
  }
  console.log(`  ✓ ${count} fortes`);
}

// ── Weapons ──────────────────────────────────────────────────────────────────

async function seedWeapons(weapons, weaponReson) {
  const resonName = new Map();
  for (const r of weaponReson) if (r.Level === 1 && !resonName.has(r.ResonId)) resonName.set(r.ResonId, t(r.Name));

  const seen = new Set();
  let count = 0;
  for (const w of weapons) {
    if (!w.IsShow || w.QualityId < 3) continue;
    const name = t(w.WeaponName)?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const params = w.DescParams ?? [];
    const ranks = Math.max(0, ...params.map((p) => p.ArrayString?.length ?? 0));
    const refinements = Array.from({ length: ranks }, (_, i) => ({
      values: params.map((p) => p.ArrayString?.[i] ?? p.ArrayString?.[0] ?? ""),
    }));

    await upsert(Weapon, { game: GAME, name }, {
      game: GAME,
      sourceId: w.ItemId,
      name,
      description: cleanText(t(w.AttributesDescription) ?? t(w.TypeDescription)),
      weaponType: WEAPON_TYPES[w.WeaponType],
      rarity: w.QualityId,
      signatureOf: signatureOf(GAME, name),
      baseAtkValue: w.FirstPropId?.Value,
      effectName: resonName.get(w.ResonId) || "Passive",
      effectTemplateRaw: t(w.Desc),
      refinements,
      ...weaponLeveling(w),
      images: { icon: img(w.IconMiddle ?? w.Icon) },
    });
    count++;
  }
  console.log(`  ✓ ${count} weapons`);
}

/**
 * Weapon ATK / secondary stat per level and ascension costs.
 * Flat props are stored ×10000 by the game (540 = 5.4 %); "ratio" props are already fractions.
 */
function weaponLeveling(w) {
  if (!LEVELING) return {};
  const curve = (id, lvl) => LEVELING.weaponGrowthIdx.get(`${id}:${lvl}:${phaseOf(lvl)}`);
  const first = w.FirstPropId;
  const second = w.SecondPropId;
  const secondProp = second ? LEVELING.props.get(second.Id) : null;
  const secondName = secondProp ? t(secondProp.Name) : undefined;
  const stats = {};
  for (let lvl = 1; lvl <= 90; lvl++) {
    const c1 = curve(w.FirstCurve, lvl);
    const c2 = curve(w.SecondCurve, lvl);
    if (c1 == null) continue;
    stats[lvl] = { atk: (first.Value * c1) / 10000 };
    if (second && c2 != null) {
      const v = (second.Value * c2) / 10000;
      stats[lvl].specialized = second.IsRatio ? v : v / 10000;
    }
  }
  const costs = {};
  for (const b of LEVELING.weaponBreaches.filter((x) => x.BreachId === w.BreachId)) {
    const list = consumeList([...(b.Consume ?? []), ...(b.GoldConsume ? [{ Key: 2, Value: b.GoldConsume }] : [])]);
    if (list.length) costs[`ascend${b.Level + 1}`] = list;
  }
  return {
    stats: Object.keys(stats).length ? stats : undefined,
    mainStatType: secondProp ? `WUWA_${secondProp.Key}${second.IsRatio ? "_PCT" : ""}` : undefined,
    mainStatText: secondName,
    costs: Object.keys(costs).length ? costs : undefined,
  };
}

// ── Materials ────────────────────────────────────────────────────────────────

/** Every item used by a cost (ascension, forte, weapons, EXP potions). Run last. */
async function seedMaterials() {
  const seen = new Set();
  let count = 0;
  for (const id of [...USED_ITEMS].sort((a, b) => a - b)) {
    const it = ITEMS.get(id);
    const name = it && t(it.Name)?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const showType = SHOW_TYPES.get(it.ShowTypes?.[0]);
    const source = [
      ...new Set(
        (it.ItemAccess ?? [])
          .map((a) => cleanText(t(ACCESS.get(a)?.Description)))
          .filter((x) => x && !/^AccessPath_/.test(x))
      ),
    ];
    const desc = cleanText(t(it.AttributesDescription));
    const lore = cleanText(t(it.BgDescription));
    await upsert(Material, { game: GAME, name }, {
      game: GAME,
      sourceId: id,
      name,
      description: [desc, lore].filter(Boolean).join("\n\n") || undefined,
      category: (showType && cleanText(t(showType.Name))) || undefined,
      rarity: it.QualityId,
      source: source.length ? source : undefined,
      images: { icon: img(it.IconMiddle || it.Icon) },
    });
    count++;
  }
  console.log(`  ✓ ${count} materials`);
}

// ── Sonata Effects (echo sets) ───────────────────────────────────────────────

function fetterElement(path) {
  // e.g. T_IconElementAttriIce, T_IconElementAttriIceUltimateSkill, T_IconElementAttriFireA1
  const m = String(path ?? "").match(/T_IconElementAttri(?:128_)?(Ice|Fire|Thunder|Wind|Light|Dark)/);
  return m ? FETTER_ELEMENTS[m[1]] ?? null : null;
}

/**
 * Reference table for the Echo pages: 5★ main stats per echo cost (+0 → +25), with the
 * secondary stat each cost always carries, and the substats an echo can roll.
 * Data: phantommainproperty (cost groups 501/502/503 = 4/3/1-cost), phantommainpropitem
 * (AddType 2 = percentage), phantomgrowth (curve 1: ×5 at +25), phantomsubproperty.
 */
async function seedEchoStats() {
  const [mains, items, growth, subs] = await Promise.all([
    getJson("BinData/phantom/phantommainproperty.json"),
    getJson("BinData/phantom/phantommainpropitem.json"),
    getJson("BinData/phantom/phantomgrowth.json"),
    getJson("BinData/phantom/phantomsubproperty.json"),
  ]);
  const itemById = new Map(items.map((x) => [x.Id, x]));
  const curve = (gid, level) => (growth.find((g) => g.GrowthId === gid && g.Level === level)?.Value ?? 10000) / 10000;
  const name = (propId, addType) => {
    const p = LEVELING.props.get(propId);
    const n = p && cleanText(t(p.Name));
    if (!n) return undefined;
    return addType === 2 && !n.includes("%") ? `${n}%` : n;
  };
  const percent = (propId, addType) => addType === 2 || LEVELING.props.get(propId)?.IsPercent;
  const fmt = (it, mult) => {
    const v = it.StandardProperty * mult;
    return percent(it.PropId, it.AddType) ? `${(v / 100).toFixed(1)}%` : String(Math.round(v));
  };
  const COSTS = [[501, "4-Cost"], [502, "3-Cost"], [503, "1-Cost"]];
  const slots = COSTS.map(([group, slot]) => {
    const rows = mains.filter((m) => m.RandGroupId === group);
    const seen = new Set();
    const mainStats = [];
    let fixed;
    for (const r of rows) {
      const [main, second] = (r.PropGroup || []).map((id) => itemById.get(id));
      if (second && !fixed) fixed = `${name(second.PropId, second.AddType)} ${fmt(second, curve(second.GrowthId, 25))}`;
      const n = main && name(main.PropId, main.AddType);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      mainStats.push({ name: n, base: fmt(main, curve(main.GrowthId, 0)), max: fmt(main, curve(main.GrowthId, 25)) });
    }
    return { slot, maxLevel: 25, mainStats, note: fixed ? `Always + ${fixed}` : undefined };
  }).filter((s) => s.mainStats.length);
  const subNames = [...new Set(subs.map((s) => name(s.PropId, s.AddType)).filter(Boolean))];
  if (!slots.length) return;
  await upsert(Reference, { game: GAME, name: "Echo stats" }, {
    game: GAME,
    name: "Echo stats",
    data: {
      rank: "5★",
      slots,
      substats: subNames.map((n) => ({ name: n })),
      substatNote: "Possible substats (roll values are not in the game data)",
    },
  });
}

async function seedEchoSets(fetterGroups, fetters) {
  await seedEchoStats().catch((e) => console.warn(`  ⚠ Echo stats: ${e.message}`));
  const fetterById = new Map(fetters.map((f) => [f.Id, f]));
  let count = 0;
  for (const g of fetterGroups) {
    const name = t(g.FetterGroupName)?.trim();
    if (!name) continue;
    const bonus = {};
    // The set's own glyph (FetterIcon is the same placeholder for every set)
    const icon = img(g.FetterElementPath);
    for (const { Key: pieces, Value: fetterId } of g.FetterMap ?? []) {
      const f = fetterById.get(fetterId);
      if (!f) continue;
      bonus[pieces] = cleanText(t(f.EffectDescription), f.EffectDescriptionParam);
    }
    await upsert(EchoSet, { game: GAME, name }, {
      game: GAME,
      sourceId: String(g.Id),
      name,
      onePieceBonus: bonus[1],
      twoPieceBonus: bonus[2],
      threePieceBonus: bonus[3],
      fivePieceBonus: bonus[5],
      element: fetterElement(g.FetterElementPath),
      images: { icon },
    });
    count++;
  }
  console.log(`  ✓ ${count} sonata effects`);
}

// ── Echoes ───────────────────────────────────────────────────────────────────

async function seedEchoes(phantoms, phantomSkills, fetterGroups) {
  const skillById = new Map(phantomSkills.map((s) => [s.PhantomSkillId, s]));
  const setName = new Map(fetterGroups.map((g) => [g.Id, t(g.FetterGroupName)?.trim()]));

  // One document per echo: keep the highest quality variant
  const best = new Map();
  for (const p of phantoms) {
    const name = t(p.MonsterName)?.trim();
    if (!name) continue;
    const prev = best.get(name);
    if (!prev || p.QualityId > prev.QualityId) best.set(name, p);
  }

  let count = 0;
  for (const [name, p] of best) {
    const skill = skillById.get(p.SkillId);
    const levels = skill?.LevelDescStrArray ?? [];
    const sets = (p.FetterGroup ?? []).map((id) => setName.get(id)).filter(Boolean);
    await upsert(Echo, { game: GAME, name }, {
      game: GAME,
      sourceId: String(p.MonsterId),
      name,
      echoClass: ECHO_CLASS[p.Rarity],
      cost: ECHO_COST[p.Rarity],
      sonataSet: sets[0],
      sonataSets: sets,
      skill: skill
        ? {
            desc: cleanText(t(skill.DescriptionEx), levels[levels.length - 1]?.ArrayString),
            cooldown: skill.SkillCD,
            levels: levels.map((l) => l.ArrayString),
          }
        : undefined,
      images: { icon: img(p.IconMiddle ?? p.Icon) },
    });
    count++;
  }
  console.log(`  ✓ ${count} echoes`);
}

// ── Entry points ─────────────────────────────────────────────────────────────

/** Run every WuWa seeder (used by the sync engine in recording mode). */
async function seedAll() {
  const d = await fetchAll();
  await seedCharacters(d.roles, d);
  await seedResonanceChains(d.roles, d.chains);
  await seedFortes(d.roles, d);
  await seedWeapons(d.weapons, d.weaponReson);
  await seedEchoSets(d.fetterGroups, d.fetters);
  await seedEchoes(d.phantoms, d.phantomSkills, d.fetterGroups);
  await seedMaterials();
  TEXT = new Map(); // free memory
  FAVOR = new Map();
  LEVELING = null;
  ITEMS = new Map();
  ACCESS = new Map();
  SHOW_TYPES = new Map();
  USED_ITEMS = new Set();
}

async function main() {
  await connectDB();
  console.log("\nSeeding Wuthering Waves data...");
  const start = Date.now();
  await seedAll();
  console.log(`\n✅ WuWa seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await mongoose.connection.close();
}

module.exports = { seedAll, setRef, GAME, REPO };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
