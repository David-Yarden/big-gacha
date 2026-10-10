/**
 * Current and upcoming in-game events, from the official announcement feeds the game
 * clients read (HoYoverse: Genshin, HSR, ZZZ). Read live (cached 30 minutes), in English
 * or French — the official texts of each language.
 *
 * Returns { source, events: [{ id, title, start, end, image }] } with ISO dates (UTC).
 * Banners (Event Wish / Event Warp / Channels) and patch notes are left out: the Banners
 * page has the banners, the rest is not an event.
 */
const { fetchData } = require("./http");

const FEEDS = {
  genshin: {
    url: (lang) =>
      `https://sg-hk4e-api.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_global&lang=${lang}&bundle_id=hk4e_global&platform=pc&region=os_euro&level=60&uid=100000000`,
    content: null,
  },
  hsr: {
    url: (lang) =>
      `https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnList?game=hkrpg&game_biz=hkrpg_global&lang=${lang}&bundle_id=hkrpg_global&platform=pc&region=prod_official_eur&level=70&uid=100000000&channel_id=1`,
    // HSR's picture announcements (the events) carry their titles in the content feed
    content: (lang) =>
      `https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnContent?game=hkrpg&game_biz=hkrpg_global&lang=${lang}&bundle_id=hkrpg_global&platform=pc&region=prod_official_eur&level=70&uid=100000000&channel_id=1`,
  },
  zzz: {
    url: (lang) =>
      `https://sg-announcement-static.hoyoverse.com/common/nap_global/announcement/api/getAnnList?game=nap&game_biz=nap_global&lang=${lang}&bundle_id=nap_global&platform=pc&region=prod_gf_eu&level=60&uid=1000000000&channel_id=1`,
    content: (lang) =>
      `https://sg-announcement-static.hoyoverse.com/common/nap_global/announcement/api/getAnnContent?game=nap&game_biz=nap_global&lang=${lang}&bundle_id=nap_global&platform=pc&region=prod_gf_eu&level=60&uid=1000000000&channel_id=1`,
  },
};

// Not events: banners, patch notes, maintenance, store and compensation notices
const NOT_EVENT =
  /event wish|wish «|vœux|event warp|collaboration warp|saut|channel|canal|update details|détails de la mise à jour|maintenance|compensation|store update|boutique|known issues|problèmes|new content overview|aperçu du nouveau contenu|version details|notice|avis|optimi[sz]ation|top-up|recharge|survey|questionnaire|enquête|sondage|^version \d|^mise à jour de la version/i;

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map();

const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** "2026-10-10 12:00:00" in the feed's time zone (hours from UTC) → ISO UTC. */
function toUtc(text, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(text || ""));
  if (!m) return undefined;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - (Number(tz) || 0) * 3600 * 1000;
  return new Date(t).toISOString();
}

/** Every announcement of a feed (text and picture lists), with its type label. */
function flatten(data) {
  const out = [];
  for (const group of data?.list || []) {
    for (const a of group.list || []) out.push({ ...a, group: group.type_label, groupId: group.type_id });
  }
  for (const group of data?.pic_list || []) {
    for (const t of group.type_list || []) {
      for (const a of t.list || []) out.push({ ...a, group: t.type_label || group.type_label, pic: true });
    }
  }
  return out;
}

async function load(game, lang) {
  const feed = FEEDS[game];
  const code = lang === "fr" ? "fr" : "en";
  const [list, content] = await Promise.all([
    fetchData(feed.url(code), { timeout: 20_000, retries: 1 }),
    feed.content ? fetchData(feed.content(code), { timeout: 20_000, retries: 1 }).catch(() => null) : null,
  ]);
  if (list?.retcode !== 0) throw new Error(`${game} announcements: ${list?.message || "bad answer"}`);
  const tz = list.data?.timezone ?? 0;
  const titles = new Map();
  for (const a of [...(content?.data?.list || []), ...(content?.data?.pic_list || [])]) {
    if (a.title) titles.set(a.ann_id, stripHtml(a.title));
  }
  const seen = new Set();
  const events = [];
  for (const a of flatten(list.data)) {
    if (seen.has(a.ann_id)) continue;
    seen.add(a.ann_id);
    // Genshin: only the "Event" list (type 1); the others: everything but the notices
    if (game === "genshin" && a.groupId !== 1) continue;
    const title = stripHtml(a.title) || titles.get(a.ann_id) || stripHtml(a.subtitle);
    if (!title || NOT_EVENT.test(title)) continue;
    const start = toUtc(a.start_time, tz);
    const end = toUtc(a.end_time, tz);
    // Permanent modes come back with an end date years away
    if (!start || !end || new Date(end) - new Date(start) > 120 * 24 * 3600 * 1000) continue;
    events.push({ id: a.ann_id, title, start, end, image: a.banner || a.img || undefined });
  }
  events.sort((a, b) => a.end.localeCompare(b.end));
  return { source: "HoYoverse (in-game announcements)", events };
}

/** Events of a game (null when the game has no feed). Serves the last good answer if the feed fails. */
async function gameEvents(game, lang = "en") {
  if (!FEEDS[game]) return null;
  const key = `${game}:${lang}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  try {
    const data = await load(game, lang);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
}

module.exports = { gameEvents, toUtc, NOT_EVENT };
