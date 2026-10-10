/**
 * Arknights: Endfield Data Seeder
 *
 * Data:   555me/beyondGameData (GitHub) — the game's tables (tableCfg/*.json) with the
 *         English text already inlined ({ cn, en } objects), so no text map is needed.
 * Images: 555me/EndfieldAssets (GitHub) — UI sprites of the CN Android client
 *         (assets/beyond/dynamicassets/gameplay/ui/sprites/<folder>/<name>.png).
 *
 * Run:    npm run seed:endfield   (also used by the sync engine)
 *
 * Imports: Operators (stats 1–90, promotion costs, EXP curve, profile, voice actors,
 * recommended weapons), operator kits (Basic Attack, Battle Skill, Combo Skill, Ultimate
 * with their 12 levels, talents, attribute nodes, potentials, level-up costs), weapons,
 * gear sets and every material they use.
 *
 * Versions come from the data itself: limited banners are named special_<major>_<minor>_<n>
 * (characters) and weponbox_<major>_<minor>_<n> (weapons); everything else is 1.0.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
const { Character, AgentKit, Weapon, Relic, Material, Reference } = require("../models");
const { fetchData } = require("../sync/http");

const GAME = "endfield";
const REPO = "555me/beyondGameData";
const ASSETS = "https://raw.githubusercontent.com/555me/EndfieldAssets/main/assets/beyond/dynamicassets/gameplay/ui/sprites";
let REF = "main";
function setRef(ref) {
  REF = ref || "main";
}

const TABLES = [
  "CharacterTable", "CharGrowthTable", "CharacterPotentialTable", "PotentialTalentEffectTable", "SkillPatchTable",
  "CharProfessionTable", "CharTypeTable", "CharBattleTagTable", "CharLevelUpTable", "CharWpnRecommendTable",
  "ExpItemDataMap", "AttributeShowConfigTable", "RichTextStyleTable", "HyperlinkTextTable",
  "WeaponBasicTable", "WeaponUpgradeTemplateTable", "WeaponBreakThroughTemplateTable", "WeaponExpItemTable",
  "EquipSuitTable", "EquipTable", "ItemTable", "ItemTypeTable",
  "GachaCharPoolTable", "GachaWeaponPoolTable", "SystemJumpTable",
];

const table = (name) =>
  fetchData(`https://raw.githubusercontent.com/${REPO}/${REF}/tableCfg/${name}.json`, { timeout: 300_000 });

function check(cond, message) {
  if (!cond) throw new Error(`Endfield data layout changed — ${message}`);
}

// The English text of a { cn, en } value
const enText = (o) => (o && typeof o === "object" ? (o.en ?? "").trim() || undefined : undefined);

// Language of the texts: "en" (the documents) or "fr" (official translation, see sync/i18n.js).
// beyondGameData only has Chinese and English: the French texts come from AKEData's copy of
// the game's I18nTextTable (data.akedata.wiki), matched through the English text of the
// same build (English → French dictionary).
let LANG = "en";
let FR = null; // Map English → French
function setLang(lang) {
  LANG = lang === "fr" ? "fr" : "en";
}
/** A plain English string in the selected language (unchanged when there is no translation) */
const tr = (s) => (s && LANG === "fr" && FR ? FR.get(s) ?? s : s);
/** The text of a { cn, en } value in the selected language */
const en = (o) => {
  const s = enText(o);
  if (!s || LANG !== "fr" || !FR) return s;
  return (FR.get(o.en) ?? FR.get(s) ?? s).trim() || undefined;
};

const AKEDATA = "https://data.akedata.wiki";

/** English → French dictionary of the latest build (cached on disk per build). */
async function loadFrench() {
  const fs = require("fs");
  const path = require("path");
  const manifest = await fetchData(`${AKEDATA}/manifest.json`, { timeout: 60_000 });
  const latest = manifest?.versions?.find((v) => v.id === manifest.latest) ?? manifest?.versions?.[0];
  if (!latest?.tableCfgPath) throw new Error("AKEData: no build in manifest.json");
  const dir = path.join(__dirname, "..", "..", "cache");
  const file = path.join(dir, `endfield-fr-${latest.id.replace(/[^\w.-]/g, "_")}.json`);
  if (fs.existsSync(file)) {
    try {
      return new Map(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      /* corrupt cache: download again */
    }
  }
  const base = `${AKEDATA}/${latest.tableCfgPath}`;
  const [enTable, frTable] = await Promise.all([
    fetchData(`${base}/I18nTextTable_EN.json`, { timeout: 300_000 }),
    fetchData(`${base}/I18nTextTable_FR.json`, { timeout: 300_000 }),
  ]);
  const map = new Map();
  for (const [id, text] of Object.entries(enTable || {})) {
    const fr = frTable?.[id];
    if (typeof text === "string" && typeof fr === "string" && fr && !map.has(text)) map.set(text, fr);
  }
  if (map.size < 10_000) throw new Error(`AKEData: only ${map.size} French texts`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (f.startsWith("endfield-fr-")) fs.unlinkSync(path.join(dir, f));
    fs.writeFileSync(file, JSON.stringify([...map]));
  } catch {
    /* the cache is optional */
  }
  return map;
}
const num = (v) => (v == null || v === "" ? undefined : Number(v));
const img = (folder, name) => (name ? `${ASSETS}/${folder}/${name}.png` : undefined);

const WEAPON_TYPES = { sword: "Sword", claym: "Greatsword", lance: "Polearm", pistol: "Handcannon", funnel: "Arts Unit" };
const ELEMENT_NAMES = { Physical: "Physical", Fire: "Heat", Cryst: "Cryo", Pulse: "Electric", Natural: "Nature" };
const SKILL_KEYS = { 0: "basic", 1: "skill", 3: "combo", 2: "ultimate" };
const MAX_LEVEL = 90;

let D = null; // tables of the current run
let STYLE = new Map(); // rich text style id → colour
let TERMS = new Map(); // hyperlink id → { name, desc }
let USED_ITEMS = new Set();

// ── Text ────────────────────────────────────────────────────────────────────

/**
 * Game rich text → our markup: coloured spans → [[#HEX|text]], glossary terms → coloured
 * (or bold), other tags dropped. {key:format} placeholders are filled from `bb`.
 */
function richText(s, bb = {}, terms) {
  if (!s) return undefined;
  let out = fill(String(s), bb);
  out = out.replace(/<([@#])([a-z0-9_.]+)>([\s\S]*?)<\/>/gi, (_, kind, id, inner) => {
    if (kind === "#" && terms && TERMS.has(id)) terms.add(id);
    const colour = STYLE.get(id) ?? (TERMS.get(id) && STYLE.get(TERMS.get(id).style));
    const text = inner.replace(/<[^>]+>/g, "");
    return colour ? `[[${colour}|${text}]]` : `**${text}**`;
  });
  return out.replace(/<[^>]+>/g, "").replace(/\\n/g, "\n").trim() || undefined;
}

/** {atk_scale:0%} → 62%, {count:0} → 3, {ratio:0.0} → 1.2 */
function fill(s, bb) {
  // {key:format}, {-key:format} (negated: "ignores {-ignore_fire_resist:0} Heat RES"),
  // {1-key:format} (complement: "{1-dmg_taken_down:0%} DMG Reduction")
  return s.replace(/\{(-|\d+(?:\.\d+)?-)?([A-Za-z_][A-Za-z0-9_]*)(?::([^}]*))?\}/g, (whole, op, key, fmt) => {
    const v = bb[key] ?? bb[key.toLowerCase()];
    if (v == null || Number.isNaN(Number(v))) return "?";
    const x = !op ? Number(v) : op === "-" ? -Number(v) : Number(op.slice(0, -1)) - Number(v);
    return formatValue(x, fmt);
  });
}

function formatValue(v, fmt = "") {
  const pct = fmt.endsWith("%");
  const decimals = (fmt.split(".")[1] || "").replace("%", "").length;
  const x = pct ? v * 100 : v;
  let s = decimals ? x.toFixed(decimals) : String(Math.round(x * 100) / 100);
  if (LANG === "fr") s = s.replace(".", ","); // French decimal comma, as in game
  return pct ? `${s}%` : s;
}

/** Blackboard [{ key, value }] → { key: value } */
const bbMap = (list) => Object.fromEntries((list || []).map((b) => [b.key, b.valueStr || Number(b.value)]));

function glossaryOf(termIds) {
  const out = [...termIds].map((id) => TERMS.get(id)).filter((x) => x?.name && x.desc);
  return out.length ? out.map(({ name, desc }) => ({ name, desc })) : undefined;
}

// ── Items ───────────────────────────────────────────────────────────────────

function itemName(id) {
  return en(D.ItemTable[id]?.name);
}

function itemIcon(id) {
  const it = D.ItemTable[id];
  return it ? img("itemicon", it.iconId || id) : undefined;
}

/** [{ id, count }] → [{ id, name, count, icon }] (remembers the materials to import) */
function costList(list) {
  return (list || [])
    .map((x) => ({ id: x.id, count: num(x.count) }))
    .filter((x) => x.id && x.count > 0 && itemName(x.id))
    .map((x) => {
      USED_ITEMS.add(x.id);
      return { id: x.id, name: itemName(x.id), count: x.count, icon: itemIcon(x.id) };
    });
}

// ── Versions (from the banner ids) ─────────────────────────────────────────

function bannerVersions() {
  const chars = new Map();
  const weapons = new Map();
  const signature = new Map(); // weapon id → char id (same banner slot)
  const slotChar = new Map();
  const ver = (id, prefix) => {
    const m = id.match(new RegExp(`^${prefix}_(\\d+)_(\\d+)_(\\d+)$`));
    return m ? { v: `${m[1]}.${m[2]}`, slot: `${m[1]}_${m[2]}_${m[3]}` } : null;
  };
  const older = (a, b) => !b || Number(a) < Number(b);
  for (const p of Object.values(D.GachaCharPoolTable)) {
    const v = ver(p.id, "special") || ver(p.id, "joint");
    if (!v) continue;
    for (const c of p.upCharIds || []) if (older(v.v, chars.get(c))) chars.set(c, v.v);
    if (p.id.startsWith("special_") && p.upCharIds?.length === 1) slotChar.set(v.slot, p.upCharIds[0]);
  }
  for (const p of Object.values(D.GachaWeaponPoolTable)) {
    const v = ver(p.id, "weponbox") || ver(p.id, "weaponbox");
    if (!v) continue;
    for (const w of p.upWeaponIds || []) {
      if (older(v.v, weapons.get(w))) weapons.set(w, v.v);
      const c = slotChar.get(v.slot);
      if (c && !signature.has(w)) signature.set(w, c);
    }
  }
  const all = [...chars.values(), ...weapons.values()].sort((a, b) => Number(a) - Number(b));
  return { chars, weapons, signature, latest: all.at(-1) ?? "1.0" };
}

// ── Operators ───────────────────────────────────────────────────────────────

function operatorName(c) {
  return en(c.name) || c.engName;
}

/** Playable operators: one Endministrator (the male/female/base variants share a kit) */
function operators() {
  return Object.values(D.CharacterTable).filter(
    (c) => D.CharGrowthTable[c.charId] && c.charId !== "chr_0003_endminf" && c.charId !== "chr_9000_endmin"
  );
}

function operatorStats(c) {
  const show = D.AttributeShowConfigTable;
  const nameOf = (type) => en(show[type]?.list?.[0]?.name);
  const stats = {};
  for (const a of c.attributes || []) {
    const attrs = Object.fromEntries((a.Attribute?.attrs || []).map((x) => [x.attrType, Number(x.attrValue)]));
    const lv = attrs["0"];
    if (!lv || lv > MAX_LEVEL) continue;
    // Promotion levels appear twice (before / after): keep the promoted values
    stats[lv] = {
      hp: attrs["1"] ?? 0,
      atk: attrs["2"] ?? 0,
      def: attrs["3"] ?? 0,
      extra: Object.fromEntries(["39", "40", "41", "42"].map((k) => [nameOf(k) ?? k, Math.round(attrs[k] ?? 0)])),
    };
  }
  return stats;
}

/** Cumulative EXP per level and the EXP cards (stage 1 up to 60, stage 2 after) */
/** T-Creds: the currency of the level-ups (charged per level, not per EXP item). */
function goldCoin() {
  USED_ITEMS.add("item_gold");
  return { id: "item_gold", name: itemName("item_gold"), icon: itemIcon("item_gold") };
}

function levelExp() {
  const exp = [0, 0];
  // T-Creds to reach each level (CharLevelUpTable[lv].gold = cost of lv → lv + 1)
  const coinByLevel = [0, 0];
  let total = 0;
  let gold = 0;
  for (let lv = 1; lv < MAX_LEVEL; lv++) {
    const need = num(D.CharLevelUpTable[lv]?.exp) ?? 0;
    total += need > 0 ? need : 0;
    gold += Math.max(0, num(D.CharLevelUpTable[lv]?.gold) ?? 0);
    exp[lv + 1] = total;
    coinByLevel[lv + 1] = gold;
  }
  const cards = Object.entries(D.ExpItemDataMap).map(([id, x]) => ({
    id,
    name: itemName(id),
    exp: num(x.expGain),
    stage: x.expType === "2" ? 2 : 1,
    icon: itemIcon(id),
  }));
  for (const c of cards) USED_ITEMS.add(c.id);
  return {
    exp,
    items: cards.filter((c) => c.stage === 1 && c.name),
    items2: cards.filter((c) => c.stage === 2 && c.name),
    split: 60,
    coin: goldCoin(),
    coinByLevel,
  };
}

/**
 * Weapon EXP curve of a level template: EXP and T-Creds per level (WeaponUpgradeTemplateTable,
 * lvUpExp / lvUpGold = cost of weaponLv → weaponLv + 1) and the weapon EXP items
 * (WeaponExpItemTable rows with an item).
 */
function weaponLevelExp(templateId) {
  const list = [...(D.WeaponUpgradeTemplateTable[templateId]?.list || [])].sort((a, b) => num(a.weaponLv) - num(b.weaponLv));
  if (!list.length) return undefined;
  const exp = [0, 0];
  const coinByLevel = [0, 0];
  for (const l of list) {
    const lv = num(l.weaponLv);
    if (lv >= MAX_LEVEL) continue;
    exp[lv + 1] = (exp[lv] ?? 0) + Math.max(0, num(l.lvUpExp) ?? 0);
    coinByLevel[lv + 1] = (coinByLevel[lv] ?? 0) + Math.max(0, num(l.lvUpGold) ?? 0);
  }
  const items = Object.values(D.WeaponExpItemTable || {})
    .filter((x) => x.expItemId && num(x.itemExp) > 0)
    .map((x) => {
      USED_ITEMS.add(x.expItemId);
      return { id: x.expItemId, name: itemName(x.expItemId), exp: num(x.itemExp), icon: itemIcon(x.expItemId) };
    })
    .filter((x) => x.name);
  if (!items.length) return undefined;
  return { exp: Array.from(exp, (v) => v ?? 0), items, coin: goldCoin(), coinByLevel: Array.from(coinByLevel, (v) => v ?? 0) };
}

function profile(c) {
  const records = c.profileRecord || [];
  // The fields are read in the English record (their labels), then translated one by one
  const basic = enText(records.find((r) => r.recordIndex === "1")?.recordDesc);
  const summary = en(records.find((r) => r.recordIndex === "2")?.recordDesc);
  const field = (label) => basic?.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"))?.[1]?.trim().replace(/■+/g, "") || undefined;
  // Real affiliation ("department" is ENDFIELD INDUSTRIES for everyone); the Endministrator has none
  const faction = field("AUTHENTICATION")?.replace(/\s*\(TGCC\)$/, "") || "Endfield Industries";
  return {
    description: summary,
    gender: tr(field("GENDER")),
    birthday: tr(field("DOB")),
    race: tr(field("RACE")),
    faction, // filter key, English
    factionName: tr(faction),
  };
}

async function seedCharacters(versions) {
  const exp = levelExp();
  let count = 0;
  for (const c of operators()) {
    const g = D.CharGrowthTable[c.charId];
    const name = operatorName(c);
    const costs = {};
    ["charBreak20", "charBreak40", "charBreak60", "charBreak70"].forEach((node, i) => {
      const list = costList(g.charBreakCostMap?.[node]?.requiredItem);
      if (list.length) costs[`ascend${i + 1}`] = list;
    });
    const prof = D.CharProfessionTable[c.profession];
    const recommended = D.CharWpnRecommendTable[c.charId];
    const weaponNames = (ids) => (ids || []).map((w) => en(D.WeaponBasicTable[w]?.engName) || itemName(w)).filter(Boolean);
    const cv = c.cvName || {};
    const signature = [...versions.signature].find(([, cid]) => cid === c.charId)?.[0];
    const p = profile(c);
    // The kit is built here too: its texts give the hover glossary of the character
    const terms = new Set();
    KITS.set(name, kitFor(c, terms));
    await upsert(Character, { game: GAME, name }, {
      game: GAME,
      sourceId: Number(c.charId.match(/chr_(\d+)/)?.[1]),
      name,
      rarity: num(c.rarity),
      element: ELEMENT_NAMES[c.charTypeId] ?? c.charTypeId,
      weaponType: WEAPON_TYPES[weaponPrefix(c.weaponType)],
      specialty: en(prof?.name),
      affiliation: p.factionName,
      region: p.faction,
      description: p.description,
      gender: p.gender,
      birthday: p.birthday,
      cv: {
        english: en(cv.EngCVName),
        japanese: en(cv.JapCVName),
        chinese: en(cv.ChiCVName),
        korean: en(cv.KorCVName),
      },
      version: versions.chars.get(c.charId) ?? "1.0",
      stats: operatorStats(c),
      levelExp: exp,
      costs: Object.keys(costs).length ? costs : undefined,
      signatureWeapon: signature ? en(D.WeaponBasicTable[signature]?.engName) || itemName(signature) : undefined,
      glossary: glossaryOf(terms),
      build: recommended
        ? {
            sets: [
              { label: "Recommended weapons", names: weaponNames(recommended.weaponIds1), route: "weapons" },
              { label: "Alternatives", names: weaponNames(recommended.weaponIds2), route: "weapons" },
              { label: "Budget", names: weaponNames(recommended.weaponIds3), route: "weapons" },
            ].filter((s) => s.names.length),
          }
        : undefined,
      images: {
        icon: img("charicon", `icon_${c.charId}`),
        circle: img("charroundicon", `icon_round_${c.charId}`),
        splash: img("characterportrait", c.charId),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} operators`);
}

let WEAPON_PREFIX = new Map(); // weaponType number → id prefix (sword, claym…)
function weaponPrefix(type) {
  return WEAPON_PREFIX.get(String(type));
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

// ── Operator kits ───────────────────────────────────────────────────────────

function skillLevels(skillIds) {
  const bundles = skillIds.map((id) => D.SkillPatchTable[id]?.SkillPatchDataBundle || []).filter((b) => b.length);
  const levels = Math.max(0, ...bundles.map((b) => b.length));
  const out = [];
  for (let i = 0; i < levels; i++) {
    const bb = {};
    for (const b of bundles) Object.assign(bb, { ...bbMap(b[i]?.blackboard), ...bb });
    const params = [];
    const seen = new Set();
    for (const b of bundles) {
      for (const sd of b[i]?.subDescDataList || []) {
        const n = en(sd.name);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        params.push({ name: n, value: sd.desc });
      }
    }
    const first = bundles.map((b) => b[i]).find(Boolean);
    out.push({ bb, params, cost: num(first?.costValue), cooldown: num(first?.coolDown) });
  }
  return out;
}

function kitFor(c, terms) {
  const g = D.CharGrowthTable[c.charId];
  const skills = {};
  const costs = {};
  for (const sg of Object.values(g.skillGroupMap || {})) {
    const key = SKILL_KEYS[sg.skillGroupType];
    if (!key || skills[key]) continue;
    const levels = skillLevels(sg.skillIdList || []);
    // Parameters as rows (one value per level), in the game's order
    const names = [...new Set(levels.flatMap((l) => l.params.map((p) => p.name)))];
    skills[key] = {
      name: en(sg.name),
      icon: img("skillicon", sg.icon) ?? undefined,
      descs: levels.length ? levels.map((l) => richText(en(sg.desc), l.bb, terms)) : [richText(en(sg.desc), {}, terms)],
      params: names.map((n) => ({ name: n, values: levels.map((l) => l.params.find((p) => p.name === n)?.value ?? "") })),
      cost: levels[0]?.cost || undefined,
      cooldown: levels[0]?.cooldown || undefined,
      maxLevel: Math.max(1, levels.length),
    };
    const ups = (g.skillLevelUp || []).filter((u) => u.skillGroupId === sg.skillGroupId);
    const lv = {};
    for (const u of ups) {
      const list = costList([...(u.itemBundle || []), { id: "item_gold", count: u.goldCost }]);
      if (list.length) lv[`lvl${u.level}`] = list;
    }
    if (Object.keys(lv).length) costs[key] = lv;
  }

  // Talents (passive skills, up to 3 ranks each) and attribute nodes
  const nodes = Object.values(g.talentNodeMap || {});
  const talents = new Map();
  for (const n of nodes.filter((x) => x.nodeType === "4")) {
    const info = n.passiveSkillNodeInfo;
    const idx = info.index;
    const eff = D.PotentialTalentEffectTable[info.talentEffectId];
    const t = talents.get(idx) ?? { name: en(info.name), icon: img("skillicon", info.iconId), ranks: [] };
    t.ranks.push({
      rank: num(info.level),
      promotion: num(info.breakStage),
      desc: richText(en(eff?.desc), effectBb(eff), terms),
    });
    talents.set(idx, t);
  }
  const attributes = nodes
    .filter((x) => x.nodeType === "3")
    .map((n) => ({
      name: en(n.attributeNodeInfo?.title),
      desc: richText(en(n.attributeNodeInfo?.desc), {}, terms),
      promotion: num(n.attributeNodeInfo?.breakStage),
      cost: costList(n.requiredItem),
    }))
    .filter((a) => a.name)
    .sort((a, b) => (a.promotion ?? 0) - (b.promotion ?? 0));

  const potentials = (D.CharacterPotentialTable[c.charId]?.potentialUnlockBundle || []).map((p) => {
    const eff = D.PotentialTalentEffectTable[p.potentialEffectId];
    return { index: num(p.level), name: en(p.name), desc: richText(en(eff?.desc), effectBb(eff), terms) };
  });

  return {
    skills,
    talents: [...talents.values()].map((t) => ({ ...t, ranks: t.ranks.sort((a, b) => a.rank - b.rank) })),
    attributes,
    potentials,
    costs,
  };
}

/** Values a talent / potential text refers to: buff blackboards and skill modifiers */
function effectBb(eff) {
  const bb = {};
  for (const d of eff?.dataList || []) {
    Object.assign(bb, bbMap(d.attachBuff?.blackboard), bbMap(d.attachSkill?.blackboard));
    const m = d.skillBbModifier;
    if (m?.bbKey) bb[m.bbKey] = Number(m.floatValue);
    const a = d.attrModifier;
    if (a && a.attrType !== "0") bb.value = Number(a.attrValue);
  }
  return bb;
}

let KITS = new Map(); // operator name → kit (built with the operator, written here)

/**
 * Some skill icons are not in sprites/skillicon but only in a UI prefab folder
 * (Laevatain's battle and combo skills): check each one and use the copy that exists.
 */
async function fixSkillIcons() {
  const icons = [];
  for (const kit of KITS.values()) {
    for (const s of Object.values(kit.skills)) if (s.icon) icons.push(s);
    for (const t of kit.talents) if (t.icon) icons.push(t);
  }
  const cache = new Map();
  const exists = (url) => {
    if (!cache.has(url)) {
      cache.set(
        url,
        fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) })
          .then((r) => r.ok || r.status >= 500)
          .catch(() => true) // unreachable: keep the URL
      );
    }
    return cache.get(url);
  };
  await Promise.all(
    icons.map(async (holder) => {
      if (await exists(holder.icon)) return;
      const alt = holder.icon.replace("/sprites/skillicon/", "/prefabs/settings/");
      holder.icon = (await exists(alt)) ? alt : undefined;
    })
  );
}

async function seedKits() {
  await fixSkillIcons();
  for (const [name, kit] of KITS) await upsert(AgentKit, { game: GAME, name }, { game: GAME, name, ...kit });
  console.log(`  ✓ ${KITS.size} operator kits`);
}

// ── Weapons ─────────────────────────────────────────────────────────────────

async function seedWeapons(versions) {
  let count = 0;
  const seen = new Set();
  for (const w of Object.values(D.WeaponBasicTable)) {
    const name = en(w.engName) || itemName(w.weaponId);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const curve = D.WeaponUpgradeTemplateTable[w.levelTemplateId]?.list || [];
    const stats = {};
    for (const l of curve) stats[num(l.weaponLv)] = { atk: num(l.baseAtk) ?? 0 };
    const costs = {};
    (D.WeaponBreakThroughTemplateTable[w.breakthroughTemplateId]?.list || [])
      .filter((b) => num(b.breakthroughShowLv) > 0)
      .forEach((b) => {
        const list = costList([...(b.breakItemList || []), { id: "item_gold", count: b.breakthroughGold }]);
        if (list.length) costs[`ascend${num(b.breakthroughShowLv)}`] = list;
      });
    // The three weapon skills (two stat boosts and the weapon's own skill), levels 1–9
    const skills = (w.weaponSkillList || []).map((id) => D.SkillPatchTable[id]?.SkillPatchDataBundle || []).filter((b) => b.length);
    const levels = Math.max(0, ...skills.map((b) => b.length));
    const refinements = [];
    for (let i = 0; i < levels; i++) {
      const lines = skills
        .map((b) => b[Math.min(i, b.length - 1)])
        .map((x) => `**${en(x.skillName)}**: ${richText(en(x.description), bbMap(x.blackboard)) ?? ""}`);
      refinements.push({ description: lines.join("\n\n") });
    }
    const own = skills.find((b) => b[0]?.skillId === w.weaponPotentialSkill)?.[0];
    const item = D.ItemTable[w.weaponId];
    const sig = versions.signature.get(w.weaponId);
    await upsert(Weapon, { game: GAME, name }, {
      game: GAME,
      sourceId: Number(w.weaponId.match(/(\d+)$/)?.[1]),
      name,
      description: en(item?.decoDesc) || en(w.weaponDesc),
      weaponType: WEAPON_TYPES[w.weaponId.split("_")[1]],
      rarity: num(w.rarity),
      baseAtkValue: stats[1]?.atk,
      effectName: en(own?.skillName) || "Weapon skills",
      refinements,
      version: versions.weapons.get(w.weaponId) ?? "1.0",
      signatureOf: sig ? operatorName(D.CharacterTable[sig]) : undefined,
      stats,
      costs: Object.keys(costs).length ? costs : undefined,
      levelExp: weaponLevelExp(w.levelTemplateId),
      images: { icon: img("itemiconbig", item?.iconId || w.weaponId), full: img("gachaweapon", w.weaponId) },
    });
    count++;
  }
  console.log(`  ✓ ${count} weapons`);
}

// ── Gear sets ───────────────────────────────────────────────────────────────

const PART_NAMES = { 0: "Armor", 1: "Gloves", 2: "Kit" };

// Version where each set first appeared: from the history of EquipSuitTable in the
// repository (Oct 2026), the game version being the latest limited banner at that commit.
// A set missing here is new: it gets the current version.
const GEAR_VERSIONS = {
  suit_agi01: "1.0", suit_atb01: "1.0", suit_atk01: "1.0", suit_atk02: "1.0", suit_attri01: "1.0",
  suit_burst01: "1.0", suit_criti01: "1.0", suit_fire_natr01: "1.0", suit_heal01: "1.0", suit_phy01: "1.0",
  suit_poise01: "1.0", suit_pulse_cryst01: "1.0", suit_str01: "1.0", suit_stragi01: "1.0", suit_usp01: "1.0",
  suit_usp02: "1.0", suit_will01: "1.0", suit_wisd01: "1.0", suit_wisdwill01: "1.0",
  suit_combo_cd01: "1.2", suit_expend_spell01: "1.2",
  suit_crush_fracture: "1.3",
  suit_generaltype: "1.4",
  suit_spellburst: "1.5",
};
let currentVersion = "1.0";
const suitKey = (s) => Object.keys(D.EquipSuitTable).find((k) => D.EquipSuitTable[k] === s);

async function seedGear() {
  let count = 0;
  for (const s of Object.values(D.EquipSuitTable)) {
    const info = s.list?.[0];
    const name = en(info?.suitName);
    if (!name) continue;
    const skill = D.SkillPatchTable[info.skillID]?.SkillPatchDataBundle?.[Math.max(0, (num(info.skillLv) || 1) - 1)];
    const pieces = (s.equipList || [])
      .map((id) => {
        const e = D.EquipTable[id];
        const it = D.ItemTable[id];
        return it && { name: en(it.name), slot: PART_NAMES[e?.partType] ?? "Gear", rarity: num(it.rarity), icon: img("itemicon", it.iconId || id), level: num(e?.minWearLv) };
      })
      .filter(Boolean);
    const rarities = [...new Set(pieces.map((p) => p.rarity).filter(Boolean))].sort();
    await upsert(Relic, { game: GAME, name }, {
      game: GAME,
      name,
      type: "gear",
      rarity: rarities.length ? rarities : undefined,
      setPieces: num(info.equipCnt) || 3,
      setBonus: richText(en(skill?.description), bbMap(skill?.blackboard)),
      description: en(D.ItemTable[s.equipList?.[0]]?.decoDesc),
      items: pieces,
      version: GEAR_VERSIONS[suitKey(s)] ?? currentVersion,
      images: { icon: img("equipmentlogobig", info.suitLogoName) },
    });
    count++;
  }
  console.log(`  ✓ ${count} gear sets`);
}

// ── Materials ───────────────────────────────────────────────────────────────

async function seedMaterials() {
  let count = 0;
  const seen = new Set();
  for (const id of [...USED_ITEMS].sort()) {
    const it = D.ItemTable[id];
    const name = en(it?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    await upsert(Material, { game: GAME, name }, {
      game: GAME,
      name,
      description: [en(it.desc), en(it.decoDesc)].filter(Boolean).join("\n\n") || undefined,
      category: en(D.ItemTypeTable[it.type]?.name),
      rarity: num(it.rarity),
      // Where to get it ("Protocol Space: Promotions", "Exploring and Gathering"…)
      source: [...new Set((it.obtainWayIds || []).map((w) => en(D.SystemJumpTable[w]?.desc)).filter(Boolean))],
      images: { icon: itemIcon(id) },
    });
    count++;
  }
  console.log(`  ✓ ${count} materials`);
}

// ── Entry points ────────────────────────────────────────────────────────────

async function fetchAll() {
  console.log(`Fetching data from ${REPO}...`);
  FR = LANG === "fr" ? await loadFrench() : null;
  D = {};
  for (let i = 0; i < TABLES.length; i += 6) {
    const chunk = TABLES.slice(i, i + 6);
    const rows = await Promise.all(chunk.map(table));
    chunk.forEach((name, j) => (D[name] = rows[j]));
  }
  validate();
  STYLE = new Map(
    Object.entries(D.RichTextStyleTable)
      .map(([id, s]) => [id, String(s.preDef?.[0] ?? "").match(/#([0-9a-f]{6})/i)?.[0]])
      .filter(([, c]) => c)
  );
  TERMS = new Map(
    Object.entries(D.HyperlinkTextTable).map(([id, h]) => [id, { name: en(h.name), desc: richText(en(h.desc)), style: h.richTextId }])
  );
  WEAPON_PREFIX = new Map(Object.values(D.WeaponBasicTable).map((w) => [String(w.weaponType), w.weaponId.split("_")[1]]));
  USED_ITEMS = new Set();
  KITS = new Map();
  console.log("  ✓ All data fetched\n");
}

/** Known values at known places: the layout we read has not moved. */
function validate() {
  const laevat = D.CharacterTable.chr_0016_laevat;
  check(laevat && en(laevat.name) === "Laevatain" && laevat.charTypeId === "Fire", "CharacterTable");
  const g = D.CharGrowthTable.chr_0016_laevat;
  check(g?.skillGroupMap?.chr_0016_laevat_NormalSkill?.skillIdList?.length, "CharGrowthTable.skillGroupMap");
  check(D.SkillPatchTable.chr_0016_laevat_normal_skill?.SkillPatchDataBundle?.length >= 9, "SkillPatchTable");
  check(D.WeaponBasicTable.wpn_sword_0021?.levelTemplateId, "WeaponBasicTable");
  check(Object.values(D.EquipSuitTable)[0]?.list?.[0]?.suitName, "EquipSuitTable");
  check(D.ItemTable.item_gold?.name?.en, "ItemTable");
  check(Object.values(D.SystemJumpTable).some((j) => j?.desc?.en), "SystemJumpTable");
  check(Object.values(D.GachaCharPoolTable).some((p) => /^special_\d+_\d+_\d+$/.test(p.id)), "GachaCharPoolTable ids");
}

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

/** Run every Endfield seeder (used by the sync engine in recording mode). */
async function seedAll() {
  await fetchAll();
  const versions = bannerVersions();
  currentVersion = versions.latest ?? "1.0";
  await seedCharacters(versions);
  await seedKits();
  await seedWeapons(versions);
  await seedGear();
  await seedMaterials();
  await upsert(Reference, { game: GAME, name: "Game version" }, { game: GAME, name: "Game version", data: { version: versions.latest } });
  D = null;
  USED_ITEMS = new Set();
  KITS = new Map();
}

/** Latest version named by the banner tables (for the sync status) */
async function latestVersion(ref) {
  setRef(ref);
  const [chars, weapons] = await Promise.all([table("GachaCharPoolTable"), table("GachaWeaponPoolTable")]);
  const versions = [...Object.keys(chars), ...Object.keys(weapons)]
    .map((id) => id.match(/_(\d+)_(\d+)_\d+$/))
    .filter(Boolean)
    .map((m) => `${m[1]}.${m[2]}`)
    .sort((a, b) => Number(a) - Number(b));
  return versions.at(-1) ?? null;
}

async function main() {
  await connectDB();
  console.log("\nSeeding Arknights: Endfield data...");
  const start = Date.now();
  await seedAll();
  console.log(`\n✅ Endfield seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await mongoose.connection.close();
}

module.exports = { seedAll, setRef, setLang, latestVersion, GAME, REPO, _test: { richText, fill, formatValue } };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
