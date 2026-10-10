/**
 * Banner history of every game: limited banners with their dates and featured units.
 *
 * The game data dumps hold no banner dates (they are scheduled by the servers), so the
 * history comes from community sources, credited on the Banners page:
 *   - Genshin  genshin-impact.fandom.com  "Wish/History"               (CC BY-SA)
 *   - HSR      honkai-star-rail.fandom.com "Warp/List", then each warp's {{Warp}} and
 *              {{Warp Pool}} (CC BY-SA; collaboration warps have no announced end)
 *   - ZZZ      zenless-zone-zero.fandom.com "Exclusive Channel/History",
 *              "W-Engine Channel/History", banner art from each page   (CC BY-SA)
 *   - WuWa     wutheringwaves.fandom.com "Featured Resonator/Weapon Convene" lists, then
 *              each banner's {{Convene/Pool}} for its featured units  (CC BY-SA)
 *   - Endfield endfield.wiki.gg "Headhunting/Banners/<year>" pages     (CC BY-SA; the
 *              wiki's robots.txt forbids api.php, so the normal page is read)
 *
 * Fandom's robots.txt allows api.php?action=… Every source is read once per sync.
 * Called by the sync engine after the game's seeders (same recording sink), and by
 * `bannerSignature()` to notice a new banner when the game data itself did not change.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const sink = require("../sync/sink");
const { fetchData } = require("../sync/http");

const SOURCES = {
  genshin: "Genshin Impact Wiki (Fandom, CC BY-SA)",
  hsr: "Honkai: Star Rail Wiki (Fandom, CC BY-SA)",
  zzz: "Zenless Zone Zero Wiki (Fandom, CC BY-SA)",
  wuwa: "Wuthering Waves Wiki (Fandom, CC BY-SA)",
  endfield: "Arknights: Endfield Wiki (wiki.gg, CC BY-SA) + game tables",
};

const FANDOM = {
  genshin: "https://genshin-impact.fandom.com",
  hsr: "https://honkai-star-rail.fandom.com",
  zzz: "https://zenless-zone-zero.fandom.com",
  wuwa: "https://wutheringwaves.fandom.com",
};

// ── Text helpers ─────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—" };

function decode(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/\u00ad/g, "");
}

const stripTags = (s = "") => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** "2026-09-30 11:00(:00)" in server time (UTC+8 unless told otherwise) → Date */
function isoDate(s, offsetHours = 8) {
  const m = s?.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return undefined;
  const [, y, mo, d, h = "0", mi = "0", sec = "0"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - offsetHours, +mi, +sec));
}

/** "Sep 2, 2026, 12:00" / "October 13, 2026" → Date (UTC+8); endOfDay for a bare end date */
function textDate(s, { endOfDay = false, offsetHours = 8 } = {}) {
  const m = s?.match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return undefined;
  let h = m[4] != null ? +m[4] : endOfDay ? 23 : 0;
  let mi = m[5] != null ? +m[5] : endOfDay ? 59 : 0;
  return new Date(Date.UTC(+m[3], month, +m[2], h - offsetHours, mi));
}

const day = (d) => (d ? d.toISOString().slice(0, 10) : "");

/** Every "card" of a Fandom card list: rarity, linked name, short label. */
function cards(html) {
  return html
    .split(/<div class="card-container/)
    .slice(1)
    .map((chunk) => {
      const r = chunk.match(/card-(?:quality|rarity|rank)-(\w+)/)?.[1];
      const rarity = r === "S" ? 5 : r === "A" ? 4 : r === "B" ? 3 : Number(r) || undefined;
      const title = decode(chunk.match(/title="([^"]+)"/)?.[1] ?? "");
      const label = stripTags(chunk.match(/class="card-label">([\s\S]*?)<\/div>/)?.[1] ?? "");
      const isChar = /card-element-|card-icon-attribute|Agent /.test(chunk);
      return title && { title, label, rarity, isChar };
    })
    .filter(Boolean);
}

/** Lazy-loaded wiki image of a row, at a useful width */
function rowImage(html) {
  const src = html.match(/data-src="([^"]+)"/)?.[1] ?? html.match(/<img[^>]+src="(https:[^"]+)"/)?.[1];
  return src ? decode(src).replace(/\/scale-to-width-down\/\d+/, "/scale-to-width-down/480") : undefined;
}

async function fandomHtml(game, page) {
  const url = `${FANDOM[game]}/api.php?action=parse&format=json&formatversion=2&prop=text&page=${encodeURIComponent(page)}`;
  const data = await fetchData(url, { timeout: 120_000 });
  if (!data?.parse?.text) throw new Error(`${page}: empty page`);
  return data.parse.text;
}

const ROMAN = { I: 1, V: 5, X: 10 };
const roman = (r) => [...r].reduce((n, c, i, a) => n + (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? -ROMAN[c] : ROMAN[c]), 0);

/** "Version 5.8" → "5.8"; Genshin's "Version \"Luna III\"" (6.0 to 6.7) → "6.2" */
function headingVersion(text) {
  const num = text.match(/Version (\d+\.\d+)/)?.[1];
  if (num) return num;
  const luna = text.match(/Version\W+Luna ([IVX]+)/)?.[1];
  return luna ? `6.${roman(luna) - 1}` : undefined;
}

/** Table rows (<tr>…</tr>) of an HTML fragment, with the latest "Version X.Y" heading before them */
function rowsWithHeadings(html) {
  const out = [];
  let version;
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] != null) {
      version = headingVersion(stripTags(m[1])) ?? version;
    } else {
      out.push({ html: m[2], version });
    }
  }
  return out;
}

// ── Name resolution against the site's own data ──────────────────────────────

const norm = (s = "") =>
  decode(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

/**
 * Names (and source ids) of the game's characters and weapons, from the database and
 * from what the current sync just recorded (new units are not in the database yet).
 */
async function unitIndex(game) {
  const charModel = mongoose.model("Character");
  const weaponModel = mongoose.model(game === "hsr" ? "LightCone" : "Weapon");
  const index = { character: new Map(), weapon: new Map(), byId: { character: new Map(), weapon: new Map() } };
  index.fr = { character: new Map(), weapon: new Map() };
  const add = (kind, name, rarity, sourceId, frName) => {
    if (!name) return;
    if (frName) index.fr[kind].set(name, frName);
    const entry = { name, rarity };
    index[kind].set(norm(name), entry);
    if (sourceId != null) index.byId[kind].set(String(sourceId), entry);
  };
  for (const d of await charModel.find({ game }, "name rarity sourceId i18n.fr.name").lean()) add("character", d.name, d.rarity, d.sourceId, d.i18n?.fr?.name);
  for (const d of await weaponModel.find({ game }, "name rarity sourceId i18n.fr.name").lean()) add("weapon", d.name, d.rarity, d.sourceId, d.i18n?.fr?.name);
  for (const op of sink.recorded()) {
    if (op.op !== "upsert" || typeof op.filter?.name !== "string") continue;
    if (op.model === "Character") add("character", op.filter.name, op.set.rarity, op.set.sourceId);
    if (op.model === weaponModel.modelName) add("weapon", op.filter.name, op.set.rarity, op.set.sourceId);
  }
  return index;
}

/** A featured unit with the site's name when it is known ("Ellen Joe" → "Ellen") */
function resolve(index, kind, names, rarity, rateUp = true) {
  const list = Array.isArray(names) ? names : [names];
  for (const n of list) {
    const hit = index[kind].get(norm(n));
    if (hit) return { name: hit.name, rarity: rarity ?? hit.rarity, kind, rateUp };
  }
  // Not in the database (yet): keep the source's name
  return { name: decode(list.find(Boolean) ?? ""), rarity, kind, rateUp };
}

// ── Per game ─────────────────────────────────────────────────────────────────

async function genshinBanners(index) {
  const html = await fandomHtml("genshin", "Wish/History");
  const out = [];
  for (const { html: row, version } of rowsWithHeadings(html)) {
    const key = decode(row.match(/<a href="\/wiki\/[^"]+" title="([^"]+\/\d{4}-\d{2}-\d{2})"/)?.[1] ?? "");
    if (!key) continue;
    const [title] = key.split("/");
    const text = stripTags(row);
    const dates = text.match(/([A-Z][a-z]+ \d{1,2}, \d{4})\s*[—–-]\s*([A-Z][a-z]+ \d{1,2}, \d{4})/);
    const start = isoDate(key.slice(-10)) ?? textDate(dates?.[1]);
    const end = dates ? textDate(dates[2], { endOfDay: true }) : undefined;
    const cells = row.split(/<td[^>]*>/).slice(2).join(" ");
    const units = cards(cells);
    if (!units.length) continue;
    const kind = /^Epitome Invocation/.test(title) ? "weapon" : /Chronicled/i.test(title) ? "chronicled" : "character";
    out.push({
      name: key,
      title,
      kind,
      version,
      start,
      end,
      image: rowImage(row),
      featured: units.map((u) => resolve(index, u.isChar ? "character" : "weapon", [u.title, u.label], u.rarity)),
    });
  }
  return out;
}

// HSR wiki "Warp/List" names every event and collaboration warp; each warp page has the
// dates ({{Warp}}) and the featured units ({{Warp Pool}}). Collaboration warps have no end.
const HSR_KINDS = {
  "Character Event": ["character"],
  "Light Cone Event": ["weapon"],
  "Character Collaboration": ["character", true],
  "Light Cone Collaboration": ["weapon", true],
};

async function hsrBanners(index) {
  const list = await fandomHtml("hsr", "Warp/List");
  const titles = [...new Set([...list.matchAll(/title="([^"]+\/\d{4}-\d{2}-\d{2})"/g)].map((m) => decode(m[1])))];
  const pages = await fandomPages("hsr", titles);
  const out = [];
  for (const title of titles) {
    const page = pages.get(title);
    const text = page?.text ?? "";
    const type = text.match(/\|\s*type\s*=\s*([^\n]*)/)?.[1]?.trim();
    const [kind, collab] = HSR_KINDS[type] ?? [];
    if (!kind) continue;
    const field = (name) => text.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n]*)`))?.[1]?.trim();
    const pool = kind === "character" ? "character" : "lightcone";
    const featured = [
      ...poolParam(text, `${pool}_5_F`).map((n) => resolve(index, kind, [n, n.replace(/\s*\(.*\)$/, "")], 5)),
      ...poolParam(text, `${pool}_4_F`).map((n) => resolve(index, kind, [n, n.replace(/\s*\(.*\)$/, "")], 4)),
    ];
    if (!featured.length) continue;
    out.push({
      name: title,
      title: title.split("/")[0],
      kind,
      collab: collab || undefined,
      version: text.match(/in \[\[Version (\d+\.\d+)/)?.[1],
      start: isoDate(field("time_start")) ?? isoDate(title.slice(-10)),
      end: isoDate(field("time_end")),
      image: page.image,
      featured,
    });
  }
  return fillVersions(out);
}

async function zzzBanners(index) {
  const out = [];
  for (const [page, kind] of [["Exclusive Channel/History", "character"], ["W-Engine Channel/History", "weapon"]]) {
    const html = await fandomHtml("zzz", page);
    for (const { html: row } of rowsWithHeadings(html)) {
      const key = decode(row.match(/<a href="\/wiki\/[^"]+" title="([^"]+\/\d{4}-\d{2}-\d{2})"/)?.[1] ?? "");
      if (!key) continue;
      const sort = row.match(/data-sort-value="([^"]+)"/)?.[1] ?? "";
      const times = [...sort.matchAll(/\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{2}:\d{2}/g)].map((m) => isoDate(m[0])).sort((a, b) => a - b);
      const units = cards(row);
      if (!units.length) continue;
      // Usually "end start" (server time); some rows give only one of them. The start is
      // the time on the page's date, the end the latest time well after it.
      const day0 = isoDate(key.slice(-10));
      const start = times.find((t) => Math.abs(t - day0) < 2 * 86_400_000) ?? day0;
      const end = times.filter((t) => t - start > 86_400_000).at(-1);
      out.push({
        name: key,
        title: key.split("/")[0],
        kind,
        version: row.match(/Version\/(\d+\.\d+)/)?.[1],
        start,
        end,
        featured: units.map((u) => resolve(index, kind, [u.label, u.title], u.rarity)),
      });
    }
  }
  // Banner art: the main image of each banner page
  const pages = await fandomPages("zzz", out.map((b) => b.name), { text: false });
  for (const b of out) b.image = pages.get(b.name)?.image;
  return out;
}

/** Fandom pages by title, 50 per request: wikitext and main image (thumbnail) */
async function fandomPages(game, titles, { text = true } = {}) {
  const pages = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const props = text ? "revisions|pageimages" : "pageimages";
    const url =
      `${FANDOM[game]}/api.php?action=query&format=json&formatversion=2&redirects=1&prop=${props}` +
      `&piprop=thumbnail&pithumbsize=640&pilimit=50${text ? "&rvprop=content&rvslots=main" : ""}&titles=` +
      encodeURIComponent(chunk.join("|"));
    const data = await fetchData(url, { timeout: 120_000 });
    const alias = new Map((data?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of data?.query?.pages ?? []) {
      pages.set(alias.get(p.title) ?? p.title, {
        text: p.revisions?.[0]?.slots?.main?.content ?? "",
        image: p.thumbnail?.source,
      });
    }
  }
  return pages;
}

/** "a; b; c" list of a {{Warp Pool}} / {{Convene/Pool}} parameter */
function poolParam(text, name) {
  return (text.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|}]*)`))?.[1] ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Banners without a version take the one of the closest earlier banner */
function fillVersions(banners) {
  const dated = [...banners].sort((a, b) => a.start - b.start);
  let last;
  for (const b of dated) {
    if (b.version) last = b.version;
    else b.version = last;
  }
  return banners;
}

async function wuwaBanners(index) {
  const rows = [];
  for (const [page, kind] of [["Featured Resonator Convene", "character"], ["Featured Weapon Convene", "weapon"]]) {
    const html = await fandomHtml("wuwa", page);
    for (const { html: row } of rowsWithHeadings(html)) {
      const key = decode(row.match(/<a href="\/wiki\/[^"]+" title="([^"]+\/\d{4}-\d{2}-\d{2})"/)?.[1] ?? "");
      if (!key) continue;
      const sorts = [...row.matchAll(/data-sort-value="([^"]+)"/g)].map((m) => m[1]);
      rows.push({
        key,
        kind,
        start: isoDate(sorts[0]) ?? isoDate(key.slice(-10)),
        end: isoDate(sorts[1]),
        version: row.match(/Version\/(\d+\.\d+)/)?.[1],
        image: rowImage(row),
      });
    }
  }
  const pages = await fandomPages("wuwa", rows.map((r) => r.key));
  const param = poolParam;
  return rows.map((r) => {
    const text = pages.get(r.key)?.text ?? "";
    const featured = [
      ...param(text, "resonator_5_F").map((n) => resolve(index, "character", n, 5)),
      ...param(text, "weapon_5_F").map((n) => resolve(index, "weapon", n, 5)),
      ...param(text, "resonator_4_F").map((n) => resolve(index, "character", n, 4)),
      ...param(text, "weapon_4_F").map((n) => resolve(index, "weapon", n, 4)),
    ];
    // Weapon banners are named after their weapon ("Absolute Pulsation: Kumokiri")
    if (!featured.length && r.kind === "weapon") {
      const w = r.key.split("/")[0].split(": ")[1];
      if (w) featured.push(resolve(index, "weapon", w, 5));
    }
    return { name: r.key, title: r.key.split("/")[0], kind: r.kind, version: r.version, start: r.start, end: r.end, image: r.image, featured };
  });
}

async function endfieldBanners(index) {
  // Version of a banner: the game's own pool table names it (special_<major>_<minor>_<n>)
  const pools = await fetchData("https://raw.githubusercontent.com/555me/beyondGameData/main/tableCfg/GachaCharPoolTable.json", {
    timeout: 120_000,
  }).catch(() => ({}));
  const versionOf = new Map();
  for (const p of Object.values(pools || {})) {
    const m = String(p.id).match(/^special_(\d+)_(\d+)_/);
    if (m && p.name?.en) versionOf.set(norm(p.name.en), `${m[1]}.${m[2]}`);
  }
  const out = [];
  for (let year = 2026; year <= new Date().getUTCFullYear() + 1; year++) {
    let html;
    try {
      html = await fetchData(`https://endfield.wiki.gg/wiki/Headhunting/Banners/${year}`, { as: "text", retries: 1 });
    } catch (err) {
      if (err.status === 404 && year > 2026) break;
      throw err;
    }
    for (const { html: row } of rowsWithHeadings(html)) {
      const title = stripTags(row.match(/font-weight:\s*700;?">([\s\S]*?)<\/div>/)?.[1] ?? "");
      const asia = stripTags(row.match(/<b>Asia:<\/b>([\s\S]*?)<\/div>/)?.[1] ?? "");
      const [from, to] = asia.split(/–|&#8211;/);
      const start = textDate(from);
      const end = textDate(to);
      // Permanent banners have no end ("TBA")
      if (!title || !start || !end) continue;
      const limited = row.match(/Limited operators:[\s\S]*?<\/ul>/)?.[0] ?? "";
      const featured = [...limited.matchAll(/<li>([\s\S]*?)<\/li>/g)]
        .map((li) => {
          const name = decode(li[1].match(/title="([^"]+)"/)?.[1] ?? "");
          return name && resolve(index, "character", name, undefined, /Rate-UP/i.test(li[1]));
        })
        .filter(Boolean);
      if (!featured.length) continue;
      // Reruns name no "Drop Rate-UP" unit: every limited operator is the draw
      if (!featured.some((f) => f.rateUp)) featured.forEach((f) => (f.rateUp = true));
      const img = row.match(/<img[^>]+src="(\/images\/[^"]+)"/)?.[1];
      out.push({
        name: `${title}/${day(start)}`,
        title,
        kind: "character",
        version: versionOf.get(norm(title)),
        start,
        end,
        image: img ? `https://endfield.wiki.gg${decode(img)}` : undefined,
        featured,
      });
    }
  }
  out.push(...(await endfieldWeaponBanners(index, pools, out)));
  return out;
}

/**
 * Endfield weapon banners ("Arsenal"), from the game's own tables: each pool names its
 * rate-up weapons and its time range. A pool sharing a character banner's time range
 * (time_special_<v>) takes that banner's dates as the wiki gives them; the others read
 * TimeRangeTable (server time, UTC+8).
 */
async function endfieldWeaponBanners(index, charPools, charBanners) {
  const raw = (t) =>
    fetchData(`https://raw.githubusercontent.com/555me/beyondGameData/main/tableCfg/${t}.json`, { timeout: 120_000 });
  const [pools, times, weapons] = await Promise.all([raw("GachaWeaponPoolTable"), raw("TimeRangeTable"), raw("WeaponBasicTable")]);
  const charPoolName = new Map(Object.values(charPools || {}).map((p) => [String(p.id), p.name?.en]));
  const byTitle = new Map(charBanners.map((b) => [norm(b.title), b]));
  const tableDate = (s) => {
    const m = s?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})/);
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5])) : undefined;
  };
  const out = [];
  for (const p of Object.values(pools || {})) {
    const timeId = p.clientTopTimeId;
    const ids = p.upWeaponIds || [];
    const title = p.name?.en?.trim();
    if (!timeId || !ids.length || !title) continue; // permanent pools
    const sameAs = /^time_special_/.test(timeId) ? byTitle.get(norm(charPoolName.get(timeId.replace(/^time_/, "")) ?? "")) : null;
    const range = times?.[timeId]?.timeRangeList?.[0];
    const start = sameAs?.start ?? tableDate(range?.openTime);
    const end = sameAs?.end ?? tableDate(range?.closeTime);
    if (!start || !end) continue;
    const v = String(p.id).match(/_(\d+)_(\d+)_\d+$/) ?? timeId.match(/_(\d+)_(\d+)_\d+$/);
    out.push({
      name: `${title}/${day(start)}/${ids.join("+")}`,
      title,
      kind: "weapon",
      version: v ? `${v[1]}.${v[2]}` : sameAs?.version,
      start,
      end,
      featured: ids.map((id) => resolve(index, "weapon", weapons?.[id]?.engName?.en ?? id, undefined)),
    });
  }
  return out;
}

const FETCHERS = { genshin: genshinBanners, hsr: hsrBanners, zzz: zzzBanners, wuwa: wuwaBanners, endfield: endfieldBanners };

// ── Entry points ─────────────────────────────────────────────────────────────

/** Fetch, resolve and write (or record) every banner of a game. Returns the count. */
// ── Official French banner names ─────────────────────────────────────────────

/** English → French dictionary of the game texts, restricted to `wanted` strings. */
async function textDictionary(game, wanted) {
  const out = new Map();
  const keep = (en, fr) => {
    if (typeof en === "string" && typeof fr === "string" && fr && wanted.has(en) && !out.has(en)) out.set(en, fr);
  };
  const gh = (repo, file) => fetchData(`https://raw.githubusercontent.com/${repo}/${file}`, { timeout: 300_000 });
  if (game === "zzz") {
    const unwrap = (j) => (Object.keys(j || {}).length < 10 ? Object.values(j)[0] : j) || {};
    const en = unwrap(await gh("malu-no996/ZenlessData", "master/TextMap/TextMap_ENTemplateTb.json"));
    const fr = unwrap(await gh("malu-no996/ZenlessData", "master/TextMap/TextMap_FRTemplateTb.json"));
    for (const [k, v] of Object.entries(en)) keep(v, fr[k]);
  } else if (game === "wuwa") {
    const en = await gh("Arikatsu/WutheringWaves_Data", "master/Textmaps/en/multi_text/MultiText.json");
    const fr = new Map((await gh("Arikatsu/WutheringWaves_Data", "master/Textmaps/fr/multi_text/MultiText.json")).map((x) => [x.Id, x.Content]));
    for (const x of en) keep(x.Content, fr.get(x.Id));
  } else if (game === "hsr") {
    // 64-bit hashes as keys: compared as text, never parsed as numbers
    const en = await fetchData("https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/master/TextMap/TextMapEN.json", { timeout: 300_000, as: "text" });
    const fr = await fetchData("https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/master/TextMap/TextMapFR.json", { timeout: 300_000, as: "text" });
    const unescape = (x) => {
      try {
        return JSON.parse(`"${x}"`);
      } catch {
        return x;
      }
    };
    const pairs = (raw) => new Map([...raw.matchAll(/"(-?\d+)":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], unescape(m[2])]));
    const frMap = pairs(fr);
    for (const [k, v] of pairs(en)) keep(v, frMap.get(k));
  } else if (game === "endfield") {
    const manifest = await fetchData("https://data.akedata.wiki/manifest.json", { timeout: 60_000 });
    const latest = manifest?.versions?.find((v) => v.id === manifest.latest) ?? manifest?.versions?.[0];
    const base = `https://data.akedata.wiki/${latest.tableCfgPath}`;
    const en = await fetchData(`${base}/I18nTextTable_EN.json`, { timeout: 300_000 });
    const fr = await fetchData(`${base}/I18nTextTable_FR.json`, { timeout: 300_000 });
    for (const [k, v] of Object.entries(en || {})) keep(v, fr?.[k]);
  }
  return out;
}

/** French titles of the wiki pages (Genshin: the French wiki's interlanguage links) */
async function fandomFrenchTitles(game, pages) {
  const out = new Map();
  for (let i = 0; i < pages.length; i += 50) {
    const url =
      `${FANDOM[game]}/api.php?action=query&format=json&formatversion=2&prop=langlinks&lllang=fr&lllimit=max&titles=` +
      encodeURIComponent(pages.slice(i, i + 50).join("|"));
    const data = await fetchData(url, { timeout: 60_000 });
    for (const p of data?.query?.pages ?? []) {
      const fr = p.langlinks?.[0]?.title;
      if (fr) out.set(p.title.split("/")[0], fr.split("/")[0]);
    }
  }
  return out;
}

/**
 * French name of each banner title: the game's own text (or the French wiki for Genshin),
 * else built from the featured weapon's French name ("Absolute Pulsation: Kumokiri").
 * Looked-up titles are cached on disk, so the big text files are read only for new ones.
 */
async function frenchTitles(game, banners, index) {
  const fs = require("fs");
  const path = require("path");
  const file = path.join(__dirname, "..", "..", "cache", `banner-titles-fr-${game}.json`);
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    cache = {};
  }
  const titles = [...new Set(banners.map((b) => b.title).filter(Boolean))];
  const parts = new Set(titles.flatMap((t) => [t, ...t.split(": ")]));
  const missing = [...parts].filter((t) => !(t in cache));
  if (missing.length) {
    const found = game === "genshin"
      ? await fandomFrenchTitles(game, banners.filter((b) => missing.includes(b.title)).map((b) => b.name))
      : await textDictionary(game, new Set(missing));
    for (const t of missing) cache[t] = found.get(t) ?? null;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(cache));
    } catch {
      /* the cache is optional */
    }
  }
  const unitFr = (kind, name) => index.fr?.[kind]?.get(name);
  const out = new Map();
  for (const b of banners) {
    if (!b.title || out.has(b.title)) continue;
    let fr = cache[b.title];
    if (!fr) {
      // Named after its weapon / character, possibly with a prefix ("Absolute Pulsation: X")
      const [prefix, rest] = b.title.includes(": ") ? b.title.split(": ") : [null, b.title];
      const unit = b.featured.find((f) => f.name === rest);
      const unitName = unit && unitFr(unit.kind, unit.name);
      if (unitName) fr = prefix ? `${cache[prefix] ?? prefix} : ${unitName}` : unitName;
    }
    if (fr && fr !== b.title) out.set(b.title, fr);
  }
  return out;
}

async function seedBanners(game) {
  const fetcher = FETCHERS[game];
  if (!fetcher) return 0;
  const Banner = require("../models/Banner");
  const index = await unitIndex(game);
  const banners = await fetcher(index);
  // A banner listed twice (e.g. "current" table + history): keep the most complete entry
  const best = new Map();
  for (const b of banners) {
    const prev = best.get(b.name);
    if (!prev || (!prev.end && b.end) || (!prev.image && b.image && !!prev.end === !!b.end)) best.set(b.name, b);
  }
  // Official French names (the sync's French run does not produce banners)
  let titlesFr = new Map();
  try {
    titlesFr = await frenchTitles(game, [...best.values()], index);
  } catch (err) {
    console.warn(`  ⚠ French banner names not updated: ${err.message}`);
  }
  const seen = new Set();
  let count = 0;
  for (const b of best.values()) {
    if (!b.name || seen.has(b.name) || !b.start) continue;
    seen.add(b.name);
    const fr = titlesFr.get(b.title);
    await sink.upsert(Banner, { game, name: b.name }, { game, source: SOURCES[game], ...b, ...(fr ? { i18n: { fr: { title: fr } } } : {}) });
    count++;
  }
  // Banners the source no longer lists (renamed on the wiki, source switched): removed
  if (seen.size >= 10) {
    const stale = (await Banner.find({ game }, "name").lean()).map((d) => d.name).filter((n) => !seen.has(n));
    if (stale.length) await sink.deleteMany(Banner, { game, name: { $in: stale } });
  }
  return count;
}

/**
 * Cheap fingerprint of a game's banner source, so a sync runs when a new banner is
 * announced even if the game data did not change.
 */
async function bannerSignature(game) {
  let raw;
  if (FANDOM[game]) {
    const pages = {
      genshin: ["Wish/History"],
      hsr: ["Warp/List"],
      zzz: ["Exclusive Channel/History", "W-Engine Channel/History"],
      wuwa: ["Featured Resonator Convene", "Featured Weapon Convene"],
    }[game];
    const url = `${FANDOM[game]}/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=ids&titles=${encodeURIComponent(pages.join("|"))}`;
    const data = await fetchData(url);
    raw = (data?.query?.pages ?? []).map((p) => `${p.title}:${p.revisions?.[0]?.revid}`).sort().join(",");
  } else if (game === "endfield") {
    const html = await fetchData(`https://endfield.wiki.gg/wiki/Headhunting/Banners/${new Date().getUTCFullYear()}`, { as: "text" });
    raw = stripTags(html.match(/<table[\s\S]*<\/table>/)?.[0] ?? html);
  }
  return raw ? crypto.createHash("sha1").update(raw).digest("hex").slice(0, 12) : null;
}

module.exports = { seedBanners, bannerSignature, SOURCES, _test: { decode, stripTags, isoDate, textDate, cards, rowsWithHeadings, headingVersion } };
