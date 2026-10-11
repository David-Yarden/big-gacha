/**
 * Chaos Zero Nightmare Data Seeder
 *
 * Data:
 *   - steve1316/hub-czn-updated (GitHub, MIT): the data a CZN gear optimizer reads from
 *     the game's own files — combatants (class, attribute, rarity, base stats and level
 *     curves), every card name / cost, the starting, unique and Ego cards of each
 *     combatant with their texts, the epiphany variants of the unique cards, partners
 *     (passive with its 5 levels, Ego skill) and Memory Fragment sets. Portraits, card
 *     icons and attribute icons come from the same repository.
 *   - Chaos Zero Nightmare Wiki (czn.miraheze.org, CC BY-SA 4.0): profiles, Ego
 *     Manifestations, official partner texts, combatant affiliation, illustrations. Its
 *     robots.txt forbids the API (/w/): the normal /wiki/ pages are read, the wiki's JSON
 *     data modules (Module:…/data.json) being rendered there as tables.
 *
 * Run:    npm run seed:czn   (also used by the sync engine)
 *
 * The game has no French version: texts are in English in both languages of the site.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
const { Character, AgentKit, Weapon, Relic, Reference } = require("../models");
const { fetchData } = require("../sync/http");
const { wikiFile, pyLiteral, mwJson, wikiText, cardText, infobox, fillPassive, deckBuilderCards } = require("./cznParse");

const GAME = "czn";
const REPO = "steve1316/hub-czn-updated";
const WIKI = "https://czn.miraheze.org/wiki/";
// Community deck builder (GPL-3.0): card texts typed from the game for the newest combatants,
// used only for cards the game files and the wiki do not cover yet
// CZN Animation Viewer (fan-made, non-commercial reference library): animated portraits and cut-ins
const ANIMATION_VIEWER = "https://bennosleep.github.io/czn-animation-viewer/";
const DECK_BUILDER = "https://raw.githubusercontent.com/drakontia/ChaosZeroNightmareDeckBuilder/main/";
let REF = "master";
function setRef(ref) {
  REF = ref || "master";
}

const raw = (path) => `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`;
// Images: the branch, not the commit (stable URLs for the local image copy)
// The site's API folder has the newest combatants' faces and Ego icons too
const GAME_ASSETS = (path) => `https://raw.githubusercontent.com/${REPO}/master/api/assets/game/${path}`;
const ASSETS = (path) => `https://raw.githubusercontent.com/${REPO}/master/android-app/app/src/main/assets/${path}`;

const ATTRIBUTES = ["Passion", "Order", "Justice", "Void", "Instinct"];
const MAX_LEVEL = 60;

let D = null;

async function wikiPage(title) {
  return fetchData(WIKI + encodeURI(title.replace(/ /g, "_")), { as: "text", timeout: 60_000 });
}

/** The first of these image URLs that exists (HEAD request, remembered for the run). */
const seen = new Map();
async function exists(url) {
  return (await firstImage(url)) === url;
}

/** A wiki file, following the wiki's file redirects (e.g. "Profile Nine" → "Profile Calm Warrior"). */
async function wikiImage(title) {
  const direct = wikiFile(title);
  if (await exists(direct)) return direct;
  try {
    const html = await wikiPage(`File:${title}`);
    // The link may be protocol-relative ("//static.wikitide.net/…")
    const m = html.match(/class="fullMedia"[\s\S]*?href="(?:https:)?(\/\/static\.wikitide\.net\/cznwiki\/[^"]+)"/);
    return m ? `https:${m[1]}` : undefined;
  } catch {
    return undefined;
  }
}

async function firstImage(...candidates) {
  for (const url of (await Promise.all(candidates)).filter(Boolean)) {
    if (!seen.has(url)) {
      let ok = false;
      try {
        const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": "big-gacha-sync (personal tool)" }, signal: AbortSignal.timeout(20_000) });
        // Only a real "not found" rules a file out (the CDN may rate-limit bursts of requests)
        ok = res.ok || (res.status !== 404 && res.status !== 410);
      } catch {
        ok = true; // network hiccup: keep the usual URL, the image cache retries later
      }
      seen.set(url, ok);
    }
    if (seen.get(url)) return url;
  }
  return undefined;
}

async function wikiModule(name) {
  return mwJson(await wikiPage(`Module:${name}/data.json`));
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchAll() {
  const json = (p) => fetchData(raw(p), { timeout: 120_000 });
  const text = (p) => fetchData(raw(p), { timeout: 60_000, as: "text" });
  const [index, base, levels, ascend, db, deck, epiphanies, charsPy, partnersPy, setsPy] = await Promise.all([
    json("android-app/app/src/main/assets/characters.json"),
    json("api/data/char_base_l1.json"),
    json("api/data/level_scaling.json"),
    json("api/data/ascend_scaling.json"),
    json("api/data/game_db.json"),
    json("api/data/deck_builder_cards.json"),
    json("api/data/deck_builder_epiphany_variants.json"),
    text("api/game_data/characters.py"),
    text("api/game_data/partners.py"),
    text("api/game_data/sets.py"),
  ]);
  const characters = pyLiteral(charsPy, "CHARACTERS");
  const partners = pyLiteral(partnersPy, "PARTNERS");
  const sets = pyLiteral(setsPy, "SETS");
  check(characters["1003"]?.name === "Nia" && characters["1003"].class, "characters.py");
  check(db.cards && db.names?.["card@name@c_1003_srt1"], "game_db.json");
  check(Object.keys(deck).length >= 20, "deck_builder_cards.json");

  // Wiki (optional: the site keeps working without it)
  const wiki = {};
  for (const [key, mod] of [["info", "CharacterInfo"], ["ego", "EgoManifestation"], ["partners", "PartnerInfo"], ["cards", "Cards"]]) {
    try {
      wiki[key] = await wikiModule(mod);
    } catch (err) {
      console.warn(`  ⚠ Wiki ${mod}: ${err.message}`);
      wiki[key] = {};
    }
  }
  // Community card list (optional)
  let community = {};
  try {
    const [ts, messages] = await Promise.all([
      fetchData(DECK_BUILDER + "lib/character-cards.ts", { as: "text", timeout: 60_000 }),
      fetchData(DECK_BUILDER + "messages/en/cards.json", { timeout: 60_000 }),
    ]);
    community = deckBuilderCards(ts, messages);
  } catch (err) {
    console.warn(`  ⚠ Deck builder cards: ${err.message}`);
  }
  // File lists of both repositories (one API call each): which card illustrations exist
  const tree = async (repo, branch) => {
    try {
      const t = await fetchData(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, { timeout: 60_000 });
      return new Set((t.tree || []).map((f) => f.path));
    } catch (err) {
      console.warn(`  ⚠ File list of ${repo}: ${err.message}`);
      return null;
    }
  };
  const [hubFiles, builderFiles] = await Promise.all([tree(REPO, "master"), tree("drakontia/ChaosZeroNightmareDeckBuilder", "main")]);
  // Neutral, season, forbidden and monster cards (the hub's deck builder list) and the deck
  // builder's monster card grades (optional)
  let neutral = [];
  let monsterGrades = {};
  try {
    neutral = await fetchData(raw("src/pages/deck-builder/data/deck-builder-neutral-cards.json"), { timeout: 60_000 });
    const [monsterTs, messages] = await Promise.all([
      fetchData(DECK_BUILDER + "lib/cards/monster-cards.ts", { as: "text", timeout: 60_000 }),
      fetchData(DECK_BUILDER + "messages/en/cards.json", { timeout: 60_000 }),
    ]);
    monsterGrades = monsterGradesByName(monsterTs, messages);
  } catch (err) {
    console.warn(`  ⚠ Neutral cards: ${err.message}`);
  }
  // Divine and common epiphanies (the hub's deck builder lists, optional)
  let divine = [];
  let commonEpiphanies = [];
  try {
    [divine, commonEpiphanies] = await Promise.all([
      fetchData(raw("src/pages/deck-builder/data/deck-builder-divine-epiphanies.json"), { timeout: 60_000 }),
      fetchData(raw("src/pages/deck-builder/data/deck-builder-common-epiphanies.json"), { timeout: 60_000 }),
    ]);
  } catch (err) {
    console.warn(`  ⚠ Epiphanies: ${err.message}`);
  }
  // Persona engravings (season 3, optional)
  let persona = null;
  try {
    persona = (await fetchData(raw("src/pages/deck-builder/data/deck-builder-persona-engravings.json"), { timeout: 60_000 }))[0] || null;
  } catch (err) {
    console.warn(`  ⚠ Persona engravings: ${err.message}`);
  }
  // The animation viewer's catalogue (optional)
  let viewer = { rigs: [], cutins: [] };
  try {
    viewer = await fetchData("https://raw.githubusercontent.com/BenNoSleep/czn-animation-viewer/main/index.json", { timeout: 60_000 });
  } catch (err) {
    console.warn(`  ⚠ Animation viewer: ${err.message}`);
  }
  const bigCards = new Map();
  for (const path of hubFiles || []) {
    const m = path.match(/^src\/pages\/deck-builder\/data\/combatants\/[^/]+\/(c_[^/]+)\.webp$/);
    if (m) bigCards.set(m[1], path);
  }
  D = { index, base, levels, ascend, db, deck, epiphanies, characters, partners, sets, wiki, community, hubFiles, builderFiles, bigCards, viewer, neutral, monsterGrades, divine, commonEpiphanies, persona };
}

function check(cond, message) {
  if (!cond) throw new Error(`CZN data layout changed — ${message}`);
}

const cardName = (id) => D.db.names[`card@name@${id}`];

// ── Combatants ───────────────────────────────────────────────────────────────

/** HP / ATK / DEF at each level (base + level curve + promotion bonus every 10 levels). */
function statsOf(id) {
  const b = D.base[id];
  const curve = b && D.levels[b.level_group];
  if (!curve) return undefined;
  const ascend = D.ascend[b.ascend_group] || [];
  const stats = {};
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    const c = curve[lv] || curve[String(lv)];
    if (!c) continue;
    const a = ascend[Math.min(ascend.length - 1, Math.floor((lv - 1) / 10))] || { ATK: 0, DEF: 0, HP: 0 };
    stats[lv] = { hp: b.hp + c.HP + a.HP, atk: b.atk + c.ATK + a.ATK, def: b.def + c.DEF + a.DEF };
  }
  return stats;
}

async function seedCharacters() {
  const combatants = Object.entries(D.characters).filter(([, c]) => c && c.name);
  let count = 0;
  for (const [id, c] of combatants) {
    const info = D.wiki.info[c.name] || {};
    // The article's infobox: affiliation, gender, faction (polite: one page at a time)
    let box = {};
    try {
      box = infobox(await wikiPage(c.name));
    } catch {
      /* new combatant without an article yet */
    }
    const rarity = D.index[c.name]?.rarity ?? (c.grade >= 5 ? 5 : 4);
    const birthday = info.birth_month && info.birth_day ? `${info.birth_month} ${String(info.birth_day).replace(/\D/g, "")}` : box.Birthday;
    await upsert(Character, { game: GAME, name: c.name }, {
      game: GAME,
      sourceId: Number(id),
      name: c.name,
      rarity,
      version: await releaseOf(c.name), // a date (YYYY-MM-DD): sorts like the other games' versions
      element: ATTRIBUTES.includes(c.attribute) ? c.attribute : undefined,
      specialty: c.class,
      description: wikiText(info.background_text),
      gender: box.Gender,
      affiliation: box.Affiliation,
      region: box.Affiliation,
      birthday,
      cv: { japanese: info.cv_ja || box.Japanese, korean: info.cv_ko || box.Korean, chinese: cleanCv(info.cv_zhs || box.Chinese), english: info.cv_en && info.cv_en !== "Not included" ? info.cv_en : undefined },
      extraStats: [
        { name: "Crit Rate", value: `${D.base[id]?.cri ?? c.base_crit_rate ?? 3}%` },
        { name: "Crit DMG", value: `${D.base[id]?.cri_dmg ?? c.base_crit_dmg ?? 125}%` },
      ],
      profile: [
        ["Species", info.race_type],
        ["Talent", info.specialty],
        ["Reason for hospitalization", info.hospitalization_reason],
      ]
        .filter(([, value]) => value)
        .map(([name, value]) => ({ name, value: wikiText(value) })),
      stats: statsOf(id),
      gallery: await galleryOf(c.name, id),
      animated: animatedOf(id),
      // Some files are missing on either side (newest combatants): next best picture, else none
      images: {
        // The in-game profile picture (the repository's faces are chibi), else the chibi face
        icon: await firstImage(wikiImage(`Profile ${c.name}.png`), GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), wikiFile(`${c.name} Portrait.png`)),
        // In-game chibi face (bookmark), shown on the combatant's page
        chibi: await firstImage(GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), ASSETS(`faces/bookmark_face_character_map_${id}.png`)),
        splash: await firstImage(
          wikiFile(`Combatant ${c.name} Splash Art.png`),
          wikiFile(`${c.name} Portrait.png`),
          // Last resort: the community deck builder's artwork of the combatant
          `${DECK_BUILDER}public/images/characters/character_${COMMUNITY_SLUG[slugOf(c.name)] || slugOf(c.name)}.png`,
        ),
        portrait: await firstImage(wikiFile(`${c.name} Portrait.png`), wikiFile(`Profile ${c.name}.png`)),
        ego: await firstImage(GAME_ASSETS(`tp_skill/battle_icon_tp_skill_${id}.png`), ASSETS(`tp_skill/battle_icon_tp_skill_${id}.png`)),
        faction: box.Affiliation ? await firstImage(wikiFile(`${box.Affiliation} faction icon.png`)) : undefined,
      },
    });
    count++;
    await sleep(300);
  }
  console.log(`  ✓ ${count} combatants`);
}

/** Full-size artwork of a combatant (the wiki's originals). */
// The largest file of each picture: the wiki's originals (splash 1584×724, portraits 804×924,
// partner illustrations 420×632); the chibi exists only as the game's 72 px bookmark face
async function galleryOf(name, id) {
  return pickExisting([
    ["Splash art", wikiFile(`Combatant ${name} Splash Art.png`)],
    ["Portrait", wikiFile(`${name} Portrait.png`)],
    ["Mental breakdown 1", wikiFile(`${name} Collapse 1.png`)],
    ["Mental breakdown 2", wikiFile(`${name} Collapse 2.png`)],
    ["Chibi", await firstImage(GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), ASSETS(`faces/bookmark_face_character_map_${id}.png`))],
  ]);
}

async function partnerGalleryOf(name, id) {
  return pickExisting([
    ["Illustration", wikiFile(`${name} Partner Card Illustration.png`)],
    ["Portrait", wikiFile(`${name} Portrait.png`)],
    ["Chibi", await firstImage(GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), ASSETS(`faces/bookmark_face_character_map_${id}.png`))],
  ]);
}

async function pickExisting(items) {
  const out = [];
  for (const [label, src] of items) if (src && (await exists(src))) out.push({ label, src });
  return out;
}

/** Animated portrait and cut-ins of a combatant on the CZN Animation Viewer. */
function animatedOf(id) {
  const rigs = new Set((D.viewer.rigs || []).map((r) => r.slug));
  const cuts = new Set((D.viewer.cutins || []).map((c) => c.slug));
  return [
    rigs.has(`portrait_${id}`) && { label: "Animated portrait", url: `${ANIMATION_VIEWER}?m=rigs/portrait_${id}` },
    rigs.has(`portrait_${id}_01`) && { label: "Alternate portrait", url: `${ANIMATION_VIEWER}?m=rigs/portrait_${id}_01` },
    cuts.has(`collapse_${id}`) && { label: "Mental breakdown (animated)", url: `${ANIMATION_VIEWER}?c=collapse_${id}` },
    cuts.has(`${id}_fhd`) && { label: "Ego skill cut-in", url: `${ANIMATION_VIEWER}?c=${id}_fhd` },
  ].filter(Boolean);
}

const cleanCv = (s) => (s && !/^CV_/.test(s) ? s : undefined);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Kits: cards and Ego Manifestations ──────────────────────────────────────

/** A combatant missing from the deck file: its cards from the card table (names, no text). */
function deckFromIds(id) {
  const ids = Object.keys(D.db.cards).filter((k) => k.startsWith(`c_${id}_`) && !/_pot$|_rsp\d|_epiphany/.test(k));
  const pick = (re) => ids.filter((k) => re.test(k)).sort().map((card_id) => ({ card_id }));
  const ego = ids.find((k) => /_eps$/.test(k));
  return { starting_cards: pick(/_srt\d+$/), epiphany_cards: pick(/_uni\d+$/), ego_skill: ego ? { card_id: ego } : undefined };
}

// Global release dates (no data file has them). Launch roster: tier lists of 2025-10-21;
// later combatants: Smilegate newsroom / press releases (Inven Global, GameDeveloper, ANN) and GameWith.
// A combatant missing here gets the date the sync first saw it.
const LAUNCH = "2025-10-22";
const RELEASES = {
  Yuki: "2025-11-12", Chizuru: "2025-12-03", Sereniel: "2025-12-24", Narja: "2026-01-14", Nine: "2026-02-04",
  Tiphera: "2026-02-25", Rita: "2026-03-18", Diana: "2026-04-08", Heidemarie: "2026-04-29", Adelheid: "2026-05-27",
  Tenebria: "2026-06-17", Fei: "2026-07-10", Hilde: "2026-07-30", Arabella: "2026-08-19", Olga: "2026-09-09",
  Anika: "2026-09-30",
};
const LAUNCH_ROSTER = new Set(["Amir", "Beryl", "Cassius", "Haru", "Hugo", "Kayron", "Khalipe", "Lucas", "Luke", "Magna", "Maribell", "Mei Lin", "Mika", "Nia", "Orlea", "Owen", "Rei", "Renoa", "Rin", "Selena", "Tressa", "Veronica"]);
async function releaseOf(name) {
  if (RELEASES[name]) return RELEASES[name];
  if (LAUNCH_ROSTER.has(name)) return LAUNCH;
  const known = await Character.findOne({ game: GAME, name }).select("version").lean();
  return known?.version || new Date().toISOString().slice(0, 10);
}

const CATEGORY = { Attack: "Attack", Skill: "Skill", Upgrade: "Upgrade" };
const ROMAN = ["", "I", "II", "III", "IV", "V"];
// Deck builder ids that differ from the combatant's name
const COMMUNITY_SLUG = { veronica: "velonica" };
const slugOf = (name) => name.toLowerCase().replace(/[^a-z]/g, "");

async function seedKits() {
  let count = 0;
  for (const [id, c] of Object.entries(D.characters)) {
    if (!c?.name) continue;
    const deck = D.deck[id] || deckFromIds(id);
    // The wiki's card list (May 2026): type of every card, text when the repository has none
    const wikiCards = new Map();
    for (const list of Object.values(D.wiki.cards || {})) {
      for (const w of Array.isArray(list) ? list : []) if (w?.id) wikiCards.set(w.id, w);
    }
    // Community texts for this combatant's cards, matched by position (and name when both are known)
    const slug = slugOf(c.name);
    const prefixOf = (kind) => `${COMMUNITY_SLUG[slug] || slug}_${kind === "start" ? "starting" : "hirameki"}_`;
    const communityOf = (kind, i, name) => {
      const prefix = prefixOf(kind);
      const own = Object.entries(D.community).filter(([k]) => k.startsWith(prefix));
      return (own.find(([, v]) => name && v.name === name) || own.find(([k]) => k === `${prefix}${i + 1}`) || [])[1];
    };
    // Card illustration: the game's card art (hub, by the card's sct_name), else the deck builder's
    const imageOf = (cardId, kind, i) => {
      // Sharpest first: the hub's deck builder pictures (200×300), named after the card id
      const big = D.bigCards?.get(cardId);
      if (big) return `https://raw.githubusercontent.com/${REPO}/master/${big}`;
      const sct = D.db.cards[cardId]?.sct_name;
      const hubPath = sct && `api/assets/cards/${sct}.webp`;
      if (hubPath && (!D.hubFiles || D.hubFiles.has(hubPath))) return `https://raw.githubusercontent.com/${REPO}/master/${hubPath}`;
      if (kind === "ego" || !D.builderFiles) return undefined;
      // The deck builder draws one picture per distinct card (starting_2 = starting_1)
      for (const n of [i + 1, i]) {
        const path = `public/images/cards/character/${prefixOf(kind)}${n}.png`;
        if (n > 0 && D.builderFiles.has(path)) return DECK_BUILDER + path;
      }
      return undefined;
    };
    // Card rarity (frame colour): the wiki's, else the usual pattern of a deck
    const rarityOf = (w, kind, i) => w?.rarity || (kind === "start" ? (i < 3 ? "Normal" : "Rare") : kind === "ego" ? "Mythic" : ["Rare", "Rare", "Legendary", "Mythic"][i] || "Rare");
    const card = (x, kind, i) => {
      const meta = D.db.cards[x.card_id] || {};
      const w = wikiCards.get(x.card_id);
      const variants = D.epiphanies[x.card_id]?.variants?.map((v) => ({
        level: v.level,
        name: v.name,
        cost: v.cost,
        type: CATEGORY[v.card_type] ?? v.card_type,
        desc: cardText(v.description),
      }));
      const desc = cardText(x.description) || wikiText(w?.desc?.replace(/\$([^$]+)\$/g, "$1"));
      const name = cardName(x.card_id) || x.card_id;
      // Not in the game files nor on the wiki yet: the deck builder's transcription
      const cb = !desc && !variants?.length && kind !== "ego" ? communityOf(kind, i, name) : undefined;
      if (cb) {
        const base = cb.levels.find((l) => l.level === 0) || {};
        const extra = cb.levels.filter((l) => l.level > 0).map((l) => ({ level: l.level, name: `${name} ${ROMAN[l.level]}`, cost: l.cost, type: l.type, desc: l.desc }));
        return {
          id: x.card_id,
          kind,
          name,
          cost: meta.cost ?? base.cost ?? w?.cost,
          desc: base.desc,
          type: CATEGORY[w?.category] ?? base.type,
          rarity: rarityOf(w, kind, i),
          image: imageOf(x.card_id, kind, i),
          epiphanies: extra.length ? extra : undefined,
          community: true,
        };
      }
      return {
        id: x.card_id,
        kind,
        name,
        cost: meta.cost ?? w?.cost,
        desc,
        type: CATEGORY[w?.category] ?? variants?.[0]?.type,
        rarity: rarityOf(w, kind, i),
        image: imageOf(x.card_id, kind, i),
        epiphanies: variants?.length ? variants : undefined,
      };
    };
    const cards = deck
      ? [
          ...(deck.starting_cards || []).map((x, i) => card(x, "start", i)),
          ...(deck.epiphany_cards || []).map((x, i) => card(x, "unique", i)),
          ...(deck.ego_skill ? [card(deck.ego_skill, "ego", 0)] : []),
        ]
      : [];
    const manifestations = (D.wiki.ego[c.name] || []).map((m) => ({
      level: m.level,
      name: m.title,
      kind: m.sub_title,
      desc: wikiText(m.desc),
    }));
    if (!cards.length && !manifestations.length) continue;
    await upsert(AgentKit, { game: GAME, name: c.name }, { game: GAME, name: c.name, cards, manifestations });
    count++;
  }
  console.log(`  ✓ ${count} combatant kits`);
}

// ── Partners ─────────────────────────────────────────────────────────────────

async function seedPartners() {
  let count = 0;
  for (const [id, p] of Object.entries(D.partners)) {
    if (!p?.name) continue;
    const w = D.wiki.partners[p.name] || {};
    // The wiki has the game's own text of each level; the repository a template + values
    // passive_skills: one entry per part (class 1, 2…) and level 1–5: parts joined per level
    const byLevel = new Map();
    for (const sk of (w.passive_skills || []).filter((x) => x.desc).sort((a, b) => a.class - b.class)) {
      byLevel.set(sk.level, [...(byLevel.get(sk.level) || []), wikiText(sk.desc)]);
    }
    const wikiLevels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, parts]) => parts.join("\n"));
    const refinements = wikiLevels.length
      ? wikiLevels.map((description) => ({ description }))
      : [0, 1, 2, 3, 4].map((lv) => ({ description: fillPassive(p.passive_desc, p.values, lv) }));
    const ego = w.ego_skill?.name
      ? { name: w.ego_skill.name, cost: w.ego_skill.cost, desc: wikiText(w.ego_skill.desc) }
      : p.ego_name
        ? { name: p.ego_name, cost: p.ego_cost, desc: p.ego_desc && p.ego_desc !== "TBD" ? cardText(p.ego_desc) : undefined }
        : undefined;
    const rarity = w.rarity === "SSR" ? 5 : w.rarity === "SR" ? 4 : w.rarity === "R" ? 3 : p.grade;
    await upsert(Weapon, { game: GAME, name: p.name }, {
      game: GAME,
      sourceId: Number(id),
      name: p.name,
      description: wikiText(w.background_text),
      weaponType: w.class || p.class,
      rarity,
      effectName: w.passive_skills?.[0]?.name || p.passive_name,
      refinements,
      egoSkill: ego,
      affiliation: w.affiliation || w.faction,
      gallery: await partnerGalleryOf(p.name, id),
      animated: animatedOf(id),
      images: {
        icon: await firstImage(wikiImage(`Profile ${p.name}.png`), GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), wikiFile(`${p.name} Portrait.png`)),
        chibi: await firstImage(GAME_ASSETS(`faces/bookmark_face_character_map_${id}.png`), ASSETS(`faces/bookmark_face_character_map_${id}.png`)),
        art: await firstImage(wikiFile(`${p.name} Partner Card Illustration.png`), wikiFile(`${p.name} Portrait.png`)),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} partners`);
}

// ── Memory Fragment sets ────────────────────────────────────────────────────

async function seedFragments() {
  let count = 0;
  for (const [id, s] of Object.entries(D.sets)) {
    if (!s?.name) continue;
    const [two, four] = String(s.bonus || "").split(/\s*\|\s*4pc:\s*/);
    await upsert(Relic, { game: GAME, name: s.name }, {
      game: GAME,
      sourceId: Number(id),
      name: s.name,
      setPieces: s.pieces,
      // "2pc: … | 4pc: …" (one bonus at each step) or a single bonus for its piece count
      twoPieceBonus: four ? two.replace(/^2pc:\s*/, "") : s.pieces === 2 ? s.bonus : undefined,
      fourPieceBonus: four || (s.pieces === 4 ? s.bonus : undefined),
      images: { icon: ASSETS(`pieces/item_piece_set_${String(id).padStart(3, "0")}_1.png`) },
    });
    count++;
  }
  console.log(`  ✓ ${count} Memory Fragment sets`);
}

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

// ── Neutral cards ────────────────────────────────────────────────────────────

// Groups, from the game's own card ids (the prefix tells the season or the kind of card)
const CARD_GROUPS = [
  [/^card_ds01_/, "Season 1"],
  [/^card_ds02_/, "Season 2"],
  [/^card_ds03_/, "Season 3"],
  [/^card_ds04_/, "Season 4"],
  [/^card_ds05_/, "Season 5"],
  [/^eidolon_card/, "Persona"],
  [/^card_ta_/, "Forbidden"],
  [/^card_mon_/, "Monster"],
  [/^card_enc_/, "Event"],
  [/^card_arena_/, "Arena"],
  [/^card_ab_/, "Curse"],
  [/^card_ne_/, "Neutral"],
];
const GRADE_RARITY = { COMMON: "Common", RARE: "Rare", LEGEND: "Legendary" };
const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Monster card grade by (normalised) English name, from the deck builder's table. */
function monsterGradesByName(ts, messages) {
  const out = {};
  for (const block of String(ts).split(/\n\s*\{\s*\n\s*id: "/).slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const grade = (block.match(/grade: CardGrade\.(\w+)/) || [])[1];
    const name = messages?.cards?.[id]?.name;
    if (grade && typeof name === "string") out[normName(name)] = GRADE_RARITY[grade];
  }
  return out;
}

async function seedCards() {
  if (!D.neutral?.length) return;
  // Official names of every card id, to find each card's game id (and so its group)
  const idsByName = new Map();
  for (const [key, name] of Object.entries(D.db.names)) {
    if (!key.startsWith("card@name@")) continue;
    const n = normName(name);
    if (!idsByName.has(n)) idsByName.set(n, []);
    idsByName.get(n).push(key.slice(10));
  }
  const groupOf = (c) => {
    const ids = idsByName.get(normName(c.name)) || [];
    for (const [re, group] of CARD_GROUPS) if (ids.some((id) => re.test(id))) return group;
    if (c.tags?.includes("monster")) return "Monster";
    if (c.tags?.includes("forbidden")) return "Forbidden";
    if (/^Persona$/.test(c.name)) return "Persona";
    if (c.tags?.includes("season")) return "Season";
    return "Neutral";
  };
  const cards = D.neutral.map((c) => ({
    id: c.id,
    name: c.name,
    cost: c.cost,
    type: c.card_type === "Curse" ? undefined : c.card_type,
    kind: c.card_type === "Curse" ? "Curse" : undefined,
    desc: cardText(c.description?.replace(/\u200b/g, "")),
    group: groupOf(c),
    classes: c.allowed_classes?.length ? c.allowed_classes : undefined,
    rarity: c.category === "monster" ? D.monsterGrades[normName(c.name)] : undefined,
    image: c.image_path ? `https://raw.githubusercontent.com/${REPO}/master/src/pages/deck-builder/data/${c.image_path}` : undefined,
  }));
  await upsert(Reference, { game: GAME, name: "Cards" }, { game: GAME, name: "Cards", data: { cards } });
  console.log(`  ✓ ${cards.length} neutral / monster cards`);
}

// ── Divine and common epiphanies ─────────────────────────────────────────────

/**
 * The extra effects an epiphany can add to a card. Which ones a card can get depends on the
 * card's type (Attack / Skill / Upgrade) and cost — so on the epiphany chosen for it.
 * types: [] = any type; costs: [] = any cost, else "1", "2", "3", "4+".
 */
async function seedEpiphanies() {
  if (!D.divine?.length) return;
  // The first line of the game text (some effects end with a keyword kept apart in "tags")
  const textOf = (e) => (e.raw_text ? e.raw_text.split("\n")[0] : e.description).trim();
  // The game's English names of the gods (the list spells some of them differently)
  const GOD_NAMES = { Circen: "Kyrken", Secred: "Sekred", Vitor: "Vytor" };
  const divine = D.divine.map((e) => ({
    id: e.id,
    god: GOD_NAMES[e.god] || e.god,
    text: cardText(textOf(e)),
    types: e.card_types || [],
    costs: e.levels || [],
  }));
  const common = (D.commonEpiphanies || []).map((e) => ({
    id: e.id,
    text: cardText(textOf(e)),
    types: e.card_types || [],
    costs: e.levels || [],
    classes: e.allowed_classes?.length ? e.allowed_classes : undefined,
  }));
  const gods = [...new Set(divine.map((e) => e.god))];
  await upsert(Reference, { game: GAME, name: "Epiphanies" }, { game: GAME, name: "Epiphanies", data: { gods, divine, common } });
  console.log(`  ✓ ${divine.length} divine and ${common.length} common epiphanies`);
}

/**
 * Persona cards (season 3): a Persona gets up to two engravings, Lux or Umbra. Engravings
 * depend on the card's type and the combatant's class; the picture follows the Lux / Umbra mix.
 */
async function seedPersona() {
  const p = D.persona;
  if (!p?.engravings?.length) return;
  const base = `https://raw.githubusercontent.com/${REPO}/master/src/pages/deck-builder/data/`;
  const images = Object.fromEntries(Object.entries(p.persona_image_paths || {}).map(([k, v]) => [k, base + v]));
  const engravings = p.engravings.map((e) => ({
    id: e.engraving_id,
    eidolon: e.eidolon,
    type: e.card_type,
    modifiers: e.modifiers || [],
    classes: e.allowed_classes?.length ? e.allowed_classes : undefined,
    text: cardText(e.description),
  }));
  await upsert(Reference, { game: GAME, name: "Persona" }, { game: GAME, name: "Persona", data: { images, engravings } });
  console.log(`  ✓ ${engravings.length} Persona engravings`);
}

async function seedAll() {
  await fetchAll();
  await seedCharacters();
  await seedKits();
  await seedPartners();
  await seedFragments();
  await seedCards();
  await seedEpiphanies();
  await seedPersona();
  D = null;
}

async function main() {
  await connectDB();
  console.log("\nSeeding Chaos Zero Nightmare data...");
  const start = Date.now();
  await seedAll();
  console.log(`\n✅ CZN seed complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await mongoose.connection.close();
}

module.exports = { seedAll, setRef, GAME, REPO };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
