/**
 * Hover glossaries for kit texts: the terms the games underline in skill descriptions
 * (Genshin "LINK" terms, HSR extra effects). WuWa's come from its own data (seedWuwa.js).
 *
 * Every function returns [{ name, desc }] or undefined, and never throws: when a source
 * is down the character keeps the glossary it already has (undefined = no change).
 */

const GENSHIN_API = "https://gi.yatta.moe/api/v2/en/avatar";
const HSR_API = "https://sr.yatta.moe/api/v2/en/avatar";

const { tryFetch } = require("./http");

/** null when the source is unreachable: the caller keeps the existing glossary. */
async function getJson(url) {
  return tryFetch(url, { timeout: 30_000 });
}

/** Game markup → our text: coloured terms → **bold**, links/params/other tags removed. */
function cleanGameText(s) {
  if (!s) return "";
  return String(s)
    .replace(/<color=[^>]*>([\s\S]*?)<\/color>/g, "**$1**")
    .replace(/\{LINK#[^}]*\}|\{\/LINK\}/g, "")
    .replace(/<\/?unbreak>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\*\*\*\*/g, "")
    .trim();
}

function dedupe(list) {
  const seen = new Map();
  for (const t of list) {
    const name = t.name.replace(/\*\*/g, "").trim();
    if (name && t.desc && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), { name, desc: t.desc });
  }
  return seen.size ? [...seen.values()] : undefined;
}

/** Run `fn` over items with a small concurrency limit. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Genshin: avatar ids (Travelers: also "<id>-<element>" routes). */
async function genshinGlossary(ids) {
  const all = [];
  for (const id of ids) {
    const j = await getJson(`${GENSHIN_API}/${id}`);
    const info = j?.data?.dictionary?.effectsInfo;
    if (!info) continue;
    for (const e of Object.values(info)) {
      if (e?.name && e?.description) all.push({ name: cleanGameText(e.name), desc: cleanGameText(e.description) });
    }
  }
  return dedupe(all);
}

// One request per avatar and per sync (entries expire after 15 min)
const HSR_CACHE = new Map();
async function hsrAvatar(id) {
  const hit = HSR_CACHE.get(id);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;
  const data = getJson(`${HSR_API}/${id}`);
  HSR_CACHE.set(id, { at: Date.now(), data });
  return data;
}

/**
 * HSR profile (faction, story description, voice actors) — the game shows no birthday.
 * undefined when the source is down: the character keeps what it has.
 */
async function hsrProfile(id) {
  const f = (await hsrAvatar(id))?.data?.fetter;
  if (!f) return undefined;
  const cv = f.cv
    ? { english: f.cv.CV_EN || undefined, chinese: f.cv.CV_CN || undefined, japanese: f.cv.CV_JP || undefined, korean: f.cv.CV_KR || undefined }
    : undefined;
  return {
    affiliation: f.faction ? cleanGameText(f.faction) : undefined,
    description: f.description ? cleanGameText(f.description) : undefined,
    cv: cv && Object.values(cv).some(Boolean) ? cv : undefined,
  };
}

/** HSR: every extraEffects entry of the avatar (skills, traces, eidolons). */
async function hsrGlossary(ids) {
  const all = [];
  for (const id of ids) {
    const j = await hsrAvatar(id);
    if (!j?.data) continue;
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        if (k === "extraEffects" && Array.isArray(v)) {
          for (const e of v) {
            if (e?.name && e?.description) all.push({ name: cleanGameText(e.name), desc: cleanGameText(e.description) });
          }
        } else walk(v);
      }
    })(j.data);
  }
  return dedupe(all);
}

module.exports = { genshinGlossary, hsrGlossary, hsrProfile, mapLimit, cleanGameText };
