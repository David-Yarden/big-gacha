/**
 * HSR Character Bio Enrichment
 *
 * Fetches character biographical data (title, birthday, affiliation, voice actors)
 * from the Honkai: Star Rail Fandom wiki and updates MongoDB.
 *
 * Run AFTER seeding: npm run enrich:hsr
 * Force re-fetch:    npm run enrich:hsr -- --force
 *
 * Rate limited to ~2 requests/second to be polite to the wiki API.
 * Skips characters that already have bio data unless --force is passed.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { Character } = require("../models");

const GAME = "hsr";
const FANDOM_API = "https://honkai-star-rail.fandom.com/api.php";
const DELAY_MS = 600;
const forceRefetch = process.argv.includes("--force");

// Override map for characters whose DB name doesn't match the wiki page title
const WIKI_NAME_OVERRIDES = {
  "Dan Heng \u2022 Imbibitor Lunae": "Dan_Heng_\u2022_Imbibitor_Lunae",
  "March 7th":                       "March_7th",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Wiki markup stripper ──────────────────────────────────────────────────────

function stripWikiMarkup(text) {
  if (!text) return "";
  let s = text;

  // Remove <ref>...</ref> and self-closing <ref />
  s = s.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g, "");
  s = s.replace(/<ref\b[^/]*\/>/g, "");

  // Expand language templates: {{zh|text}} → text
  s = s.replace(/\{\{(?:zh|ja|ko|en)\|([^}]+)\}\}/g, "$1");

  // Expand {{w|Link|Display}} → Display, {{w|Link}} → Link
  s = s.replace(/\{\{w\|[^|{}]+\|([^|{}]+)\}\}/g, "$1");
  s = s.replace(/\{\{w\|([^|{}]+)\}\}/g, "$1");

  // Expand [[Link|Display]] → Display, [[Link]] → Link
  s = s.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  s = s.replace(/\[\[([^\]|]+)\]\]/g, "$1");

  // Expand [URL Display] → Display
  s = s.replace(/\[[^\]\s]+\s+([^\]]+)\]/g, "$1");

  // Remove any remaining templates
  s = s.replace(/\{\{[^{}]*\}\}/g, "");

  return s.replace(/\s+/g, " ").trim();
}

// ── Infobox extractor ─────────────────────────────────────────────────────────

function extractInfobox(wikitext) {
  const marker = "{{Character Infobox";
  const start = wikitext.indexOf(marker);
  if (start === -1) return null;

  let depth = 0;
  let i = start;
  while (i < wikitext.length - 1) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i += 2;
      if (depth === 0) return wikitext.slice(start, i);
    } else {
      i++;
    }
  }
  return null;
}

// ── Infobox parser ────────────────────────────────────────────────────────────

function parseInfobox(wikitext) {
  const infobox = extractInfobox(wikitext);
  if (!infobox) return null;

  // Parse | key = value lines (single-line values only — sufficient for our fields)
  const fields = {};
  for (const line of infobox.split("\n")) {
    const m = line.match(/^\s*\|\s*(\w+)\s*=\s*(.*)/);
    if (m) fields[m[1]] = m[2].trim();
  }

  const result = {};

  // Title: first non-empty of title, title2, title3
  const title = ["title", "title2", "title3"]
    .map((k) => stripWikiMarkup(fields[k] ?? ""))
    .find(Boolean);
  if (title) result.title = title;

  // Birthday
  const birthday = stripWikiMarkup(fields.birthday ?? "");
  if (birthday) result.birthday = birthday;

  // Primary affiliation
  const faction = stripWikiMarkup(fields.faction ?? "");
  if (faction) result.affiliation = faction;

  // Voice actors
  const cv = {};
  const vaEN = stripWikiMarkup(fields.vaEN ?? "");
  const vaCN = stripWikiMarkup(fields.vaCN ?? "");
  const vaJP = stripWikiMarkup(fields.vaJP ?? "");
  const vaKR = stripWikiMarkup(fields.vaKR ?? "");
  if (vaEN) cv.english = vaEN;
  if (vaCN) cv.chinese = vaCN;
  if (vaJP) cv.japanese = vaJP;
  if (vaKR) cv.korean = vaKR;
  if (Object.keys(cv).length > 0) result.cv = cv;

  return Object.keys(result).length > 0 ? result : null;
}

// ── Wiki fetch ────────────────────────────────────────────────────────────────

async function fetchWikiBio(characterName) {
  const pageTitle =
    WIKI_NAME_OVERRIDES[characterName] ??
    characterName.replace(/ /g, "_");

  const params = new URLSearchParams({
    action:  "query",
    prop:    "revisions",
    titles:  pageTitle,
    rvprop:  "content",
    rvslots: "main",
    redirects: "1",
    format:  "json",
  });

  let res;
  try {
    res = await fetch(`${FANDOM_API}?${params}`);
  } catch (err) {
    console.warn(`    Network error for "${characterName}": ${err.message}`);
    return null;
  }

  if (!res.ok) {
    console.warn(`    HTTP ${res.status} for "${characterName}"`);
    return null;
  }

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  if (!page || "missing" in page) {
    console.warn(`    Wiki page not found: "${characterName}" (tried "${pageTitle}")`);
    return null;
  }

  const wikitext = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
  return parseInfobox(wikitext);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();

  const characters = await Character.find({ game: GAME }).lean();
  console.log(`\nEnriching ${characters.length} HSR characters from wiki...`);
  if (forceRefetch) console.log("(--force: re-fetching all)\n");
  else console.log("(skipping characters with existing bio data; use --force to re-fetch all)\n");

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const char of characters) {
    // Skip if already has bio data and not force mode
    if (!forceRefetch && (char.cv || char.birthday || char.title)) {
      process.stdout.write(`  ${char.name} — skipped (already enriched)\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${char.name}...`);
    await sleep(DELAY_MS);

    const bio = await fetchWikiBio(char.name);
    if (!bio) {
      process.stdout.write(" ✗\n");
      failed++;
      continue;
    }

    await Character.updateOne({ game: GAME, name: char.name }, { $set: bio });
    process.stdout.write(` ✓  [${Object.keys(bio).join(", ")}]\n`);
    enriched++;
  }

  console.log(`\nDone. enriched=${enriched}  skipped=${skipped}  failed=${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
