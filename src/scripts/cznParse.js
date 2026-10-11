/**
 * Chaos Zero Nightmare: parsing helpers of the seeder (no dependency, unit-tested).
 */
const crypto = require("crypto");

// The wiki's text colours (czn-color-*) → our coloured spans
const WIKI_COLOURS = { orange: "#f5a142", blue: "#5fb7ff", red: "#ff6b6b", green: "#6fd08c", purple: "#b58cff", yellow: "#f4d35e", darkgray: "#9aa0a6" };

/** Image of the wiki by its file name (MediaWiki hashed path on the wiki's CDN). */
function wikiFile(name) {
  const file = name.replace(/ /g, "_");
  const h = crypto.createHash("md5").update(file).digest("hex");
  return `https://static.wikitide.net/cznwiki/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(file)}`;
}

// ── Python literals (the repository keeps some tables as Python dicts) ───────

/**
 * The value of `NAME = {...}` in a Python file, as JSON: comments dropped, tuples become
 * arrays, None / True / False mapped, int keys quoted, trailing commas removed. Values
 * that are not literals (function calls such as _ICON.format(6)) become null.
 */
function pyLiteral(src, name) {
  const start = src.search(new RegExp(`^${name}\\s*=\\s*\\{`, "m"));
  if (start < 0) throw new Error(`${name} not found`);
  let i = src.indexOf("{", start);
  const out = [];
  let depth = 0;
  const skipString = (k) => {
    const q = src[k];
    for (k++; k < src.length; k++) {
      if (src[k] === "\\") k++;
      else if (src[k] === q) return k;
    }
    return k;
  };
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const end = skipString(i);
      const body = src.slice(i + 1, end);
      // Python escapes are JSON-compatible for what these files use (\n, \", \\); quote the other quote
      out.push(JSON.stringify(body.replace(/\\(['"])/g, "$1").replace(/\\n/g, "\n").replace(/\\t/g, "\t")));
      i = end;
      continue;
    }
    if (ch === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const id = src.slice(i).match(/^[A-Za-z_][\w.]*/)[0];
      let k = i + id.length;
      while (src[k] === " ") k++;
      if (src[k] === "(") {
        // A call: skip it whole
        let d = 0;
        for (; k < src.length; k++) {
          if (src[k] === '"' || src[k] === "'") k = skipString(k);
          else if (src[k] === "(") d++;
          else if (src[k] === ")" && --d === 0) break;
        }
        out.push("null");
        i = k;
      } else {
        out.push({ None: "null", True: "true", False: "false" }[id] ?? "null");
        i += id.length - 1;
      }
      continue;
    }
    if (/[-\d]/.test(ch)) {
      const n = src.slice(i).match(/^-?\d+(\.\d+)?/)[0];
      let k = i + n.length;
      while (src[k] === " ") k++;
      out.push(src[k] === ":" ? `"${n}"` : n);
      i += n.length - 1;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    if (ch === "}" || ch === ")" || ch === "]") depth--;
    out.push(ch === "(" ? "[" : ch === ")" ? "]" : ch);
    if (depth === 0) break;
  }
  return JSON.parse(out.join("").replace(/,(\s*[}\]])/g, "$1"));
}

// ── Wiki JSON modules, rendered as HTML tables (class "mw-json") ─────────────

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** The JSON value shown by a /wiki/Module:…/data.json page. */
function mwJson(html) {
  const tags = [...html.matchAll(/<(\/?)(table|tr|th|td)\b([^>]*)>/g)];
  let k = tags.findIndex((t) => !t[1] && t[2] === "table" && /mw-json/.test(t[3]));
  if (k < 0) {
    // Large modules are shown as plain source (<pre>) instead of a table
    const pre = html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/);
    if (pre && /^\s*[[{]/.test(decode(pre[1]))) return JSON.parse(decode(pre[1].replace(/<[^>]+>/g, "")));
    throw new Error("no JSON table on the page");
  }

  // Parses the table opening at tags[k]; returns [value, index after its </table>]
  const table = (k) => {
    const rows = [];
    let j = k + 1;
    while (j < tags.length && !(tags[j][1] && tags[j][2] === "table")) {
      if (!tags[j][1] && tags[j][2] === "tr") {
        let key = null;
        let value;
        j++;
        while (!(tags[j][1] && tags[j][2] === "tr")) {
          const t = tags[j];
          if (!t[1] && t[2] === "th") {
            key = decode(html.slice(t.index + t[0].length, tags[j + 1].index).replace(/<[^>]+>/g, "")).trim();
            j++;
          } else if (!t[1] && t[2] === "td") {
            const next = tags[j + 1];
            if (!next[1] && next[2] === "table") {
              [value, j] = table(j + 1);
            } else {
              value = literal(html.slice(t.index + t[0].length, next.index), t[3]);
              j++;
            }
          } else j++;
        }
        rows.push([key, value]);
      }
      j++;
    }
    const isArray = rows.length > 0 && rows.every(([key]) => key === null);
    const value = isArray ? rows.map(([, v]) => v) : Object.fromEntries(rows.filter(([key]) => key !== null));
    return [value, j + 1];
  };
  return table(k)[0];
}

function literal(text, attrs) {
  const t = decode(text).trim();
  if (/mw-json-empty/.test(attrs)) return /\[\]/.test(t) ? [] : {};
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  if (t === "null") return null;
  if (t === "true" || t === "false") return t === "true";
  const n = Number(t);
  return Number.isNaN(n) ? t : n;
}

/** Wiki rich text → our markup: coloured spans, line breaks, other tags dropped. */
/** UTF-8 text that was once read as Latin-1 ("cardâ\u0080\u0099s" → "card’s"), as in a few repository files. */
function unmojibake(s) {
  return String(s).replace(/[\u00c2-\u00f4][\u0080-\u00bf]{1,3}/g, (m) => {
    const fixed = Buffer.from(m, "latin1").toString("utf8");
    return fixed.includes("\ufffd") ? m : fixed;
  });
}

function wikiText(s) {
  if (!s) return undefined;
  let out = unmojibake(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<span class="czn-color-([a-z]+)">([\s\S]*?)<\/span>/gi, (_, c, inner) => {
      const text = inner.replace(/<[^>]+>/g, "");
      return WIKI_COLOURS[c] && c !== "darkgray" ? `[[${WIKI_COLOURS[c]}|${text}]]` : text;
    })
    .replace(/<color_[a-z]+>([\s\S]*?)<\/>/gi, "**$1**")
    .replace(/<[^>]+>/g, "");
  return out.replace(/[ \t]+\n/g, "\n").trim() || undefined;
}

/** Card texts of the repository: "[Exhaust 2] …" keywords in bold, broken lines joined. */
function cardText(s) {
  if (!s) return undefined;
  return unmojibake(s)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,%])/g, "$1")
    // Keywords ("[Lead]", also "[ Lead ]" in some game texts)
    .replace(/\[\s*([^\]]+?)\s*\]/g, "**$1**")
    .trim();
}

/** Infobox rows of a wiki article: { Rarity: "SSR", Affiliation: "…" }. */
function infobox(html) {
  const box = html.match(/<table class="infobox"[\s\S]*?<\/table>/)?.[0];
  if (!box) return {};
  const out = {};
  for (const m of box.matchAll(/<th scope="row">([\s\S]*?)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    const v = decode(m[2].replace(/<[^>]+>/g, "")).trim();
    if (v) out[decode(m[1].replace(/<[^>]+>/g, "")).trim()] = v;
  }
  return out;
}

/** "{ATK%}%" placeholders of a partner passive filled for one level (0–4). */
function fillPassive(desc, values, level) {
  return String(desc || "").replace(/\{([^}]+)\}/g, (_, key) => {
    const v = values?.[key];
    return Array.isArray(v) ? String(v[Math.min(level, v.length - 1)]) : `{${key}}`;
  });
}


/**
 * Card list of drakontia/ChaosZeroNightmareDeckBuilder (GPL-3.0, community transcription):
 * the TypeScript card table (category, cost per epiphany level) and the English texts.
 * → { [cardId]: { name, levels: [{ level, cost, type, desc }] } }
 */
const DB_CATEGORY = { ATTACK: "Attack", SKILL: "Skill", UPGRADE: "Upgrade" };
function deckBuilderCards(ts, messages) {
  const texts = messages?.cards || {};
  const out = {};
  for (const block of String(ts).split(/\n\s*\{\s*\n\s*id: "/).slice(1)) {
    const id = block.slice(0, block.indexOf('"'));
    const text = texts[id];
    if (!text) continue;
    const head = block.split("hiramekiVariations")[0];
    const baseType = DB_CATEGORY[(head.match(/category: CardCategory\.(\w+)/) || [])[1]];
    const levels = [];
    const vars = block.split("hiramekiVariations")[1] || "";
    for (const part of vars.split(/(?=\blevel: \d+)/).slice(1)) {
      const level = Number(part.match(/^level: (\d+)/)[1]);
      const cost = part.match(/\bcost: (\d+)/);
      const type = DB_CATEGORY[(part.match(/category: CardCategory\.(\w+)/) || [])[1]] || baseType;
      const desc = text.descriptions?.[level];
      levels.push({ level, cost: cost ? Number(cost[1]) : undefined, type, desc: desc ? unmojibake(desc).trim() : undefined });
    }
    out[id] = { name: text.name, levels };
  }
  return out;
}

/**
 * The text of a divine / common epiphany from the list's raw text: every effect line (some
 * effects take two: "Increase Heal Amount by 100%" + "Apply Finale to this card"), without the
 * god, rarity and card type lines the list was read with, nor its cost brackets ("1", "4+").
 * A bracket right after "… to" / "… by" is the effect's own number ("change Cost to 0").
 */
// Labels of the screenshots (god, rarity, card type, classes — the classes are in `classes`)
const EPIPHANY_LABEL = /^(UNIQUE|RARE|LEGENDARY|COMMON|MYTHIC|Attack|Skill|Upgrade|Striker|Vanguard|Ranger|Hunter|Psionic|Controller|@\?#\$|[A-Z]{3,})$/;
function epiphanyText(raw, description) {
  if (!raw) return String(description || "").trim();
  const out = [];
  for (const line of String(raw).split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (EPIPHANY_LABEL.test(line)) continue;
    if (/^\d\+?$/.test(line)) {
      if (out.length && /\b(to|by)$/.test(out[out.length - 1])) out[out.length - 1] += ` ${line}`;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * What a card needs to be offered an epiphany, as in the game files (datamine of the game's
 * divine epiphany table: target type, cost range, and a tag the card's effects must have):
 * cure (it heals), shield (it gives a shield), draw (it draws), targetable (it hits one chosen
 * enemy). "Gain 1 AP" is offered on 0-cost cards only, "Reduce Cost" on 1-cost or more.
 */
function epiphanyRules(text, costs) {
  const t = String(text);
  const requires = [];
  if (/Heal Amount/i.test(t)) requires.push("cure");
  if (/Shield/i.test(t) && /this card/i.test(t)) requires.push("shield");
  if (/^Draw 1$/i.test(t.trim())) requires.push("draw");
  if (/Coordinated Attack to the target/i.test(t)) requires.push("targetable");
  let c = costs || [];
  if (/^Gain 1 AP$/i.test(t.trim())) c = ["0"];
  return { requires: requires.length ? requires : undefined, costs: c };
}

/**
 * The divine epiphanies a card can get, from the table of cznDivine.json (same rules as the
 * deck builder, client/src/components/czn/CardCustomizer.tsx): one entry per god and effect.
 * card: { name, type, cost, tags: Set of cure / shield / draw / targetable, keywords: Set }
 */
function divinePool(table, card) {
  // An X-cost card counts as 0 (Soulfire Dance IV: "Gain 1 AP", no "Reduce Cost")
  const cost = card.cost < 0 ? 0 : card.cost;
  return table.effects.flatMap((e) => {
    const ok =
      (!e.types?.length || e.types.includes(card.type)) &&
      (e.minCost == null || cost >= e.minCost) &&
      (e.maxCost == null || cost <= e.maxCost) &&
      (e.requires || []).every((r) => card.tags.has(r)) &&
      !(e.forbids || []).some((r) => card.tags.has(r)) &&
      !(e.excludes || []).some((k) => card.keywords?.has(k)) &&
      !(e.excludeCards || []).includes(card.name);
    return ok ? (e.gods === "all" ? table.gods : e.gods).map((god) => ({ god, text: e.text })) : [];
  });
}

// ── Official names and terms ─────────────────────────────────────────────────

const plain = (s) => String(s || "").replace(/\u200b/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (s) =>
  String(s || "")
    .replace(/\u200b/g, "")
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["of", "the", "a", "an", "and"].includes(w));

/** Edit distance (Levenshtein). */
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * The game's spelling of a card name of a community list (typos, old names): the same name; else
 * the only game name at most 2 letters away ("Counterattack Preperation"; 1 for a name of 6 to 9
 * letters, none under 6); else the only game name
 * sharing all words but the last, at least 3 ("Forbidden: Guidance of Falling" → "… of Futility").
 * names: the game's card names. Returns the name unchanged when nothing fits.
 */
function officialName(name, names) {
  const clean = names.map((n) => String(n).replace(/\u200b/g, ""));
  const p = plain(name);
  const same = clean.find((n) => plain(n) === p);
  if (same) return same;
  // Short names allow fewer differences ("Rake" is not "Make")
  const allowed = p.length >= 10 ? 2 : p.length >= 6 ? 1 : 0;
  const near = allowed ? [...new Set(clean.filter((n) => Math.abs(plain(n).length - p.length) <= allowed && editDistance(plain(n), p) <= allowed))] : [];
  if (near.length === 1) return near[0];
  const w = String(name).toLowerCase().split(/\s+/);
  if (w.length >= 4) {
    const head = w.slice(0, -1).join(" ") + " ";
    const alike = [...new Set(clean.filter((n) => n.toLowerCase().startsWith(head) && n.split(/\s+/).length === w.length))];
    if (alike.length === 1) return alike[0];
  }
  return name;
}

/**
 * Two spellings of one equipment name: the same words, a word may be shortened ("Great" /
 * "Greater", "Bomb" / "Bomber") or one letter off ("Vladeus" / "Viadeus").
 */
function sameEquipmentName(a, b) {
  const A = words(a);
  const B = words(b);
  const like = (x, y) => x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))) || (x.length >= 5 && y.length >= 5 && editDistance(x, y) <= 1);
  return A.length > 0 && A.length === B.length && A.every((x) => B.some((y) => like(x, y)));
}

/**
 * The game's text of a piece of equipment with its values: the game's lists give "X" for each value
 * ("On Ravage, X% Fixed Shield"), the community list gives the numbers ("Fixed shield 60% when
 * wrecked"). The numbers of the community text, less those the game's text already has, fill the X
 * in order (an "X%" only with a percentage); else, when the X are all "X%", the percentages alone.
 * Returns null when they do not fit (another count, another kind).
 */
function fillValues(official, community) {
  const text = String(official || "").replace(/\$?Recover(?:Xrev_\d+_\d+)#%/g, "Recover X%");
  if (/Xrev|\$/.test(text)) return null;
  if (!/\bX\b/.test(text)) return text;
  const nums = (s) => [...String(s).matchAll(/(\d+(?:\.\d+)?)(\s*%)?/g)].map((m) => ({ v: m[1], pct: !!m[2] }));
  const slots = [...text.matchAll(/\bX\b(%)?/g)].map((m) => !!m[1]);
  const pool = nums(community);
  for (const { v } of nums(text.replace(/\bX\b/g, ""))) {
    const i = pool.findIndex((p) => p.v === v);
    if (i >= 0) pool.splice(i, 1);
  }
  const fill = (values) => {
    let i = 0;
    return text.replace(/\bX\b/g, () => values[i++].v);
  };
  if (pool.length === slots.length && slots.every((pct, i) => !pct || pool[i].pct)) return fill(pool);
  const pcts = pool.filter((p) => p.pct);
  if (slots.every(Boolean) && pcts.length === slots.length) return fill(pcts);
  return null;
}

/**
 * The game's terms in a community text translated by machine (CZN Deck Builder equipment and
 * refinements). Each pair was checked on the pieces that have both texts (the game's and the
 * community's): "Pain … to the target" = "Agony", "Signal" = "Mark", "heart rate" = "Critical
 * Chance", "Reinforcement Card" = "Upgrade Card", "Impair" = "Weaken", "Wounded" = "Impair"…;
 * Rift / Pain / Burn = Fracture / Agony / Scorched (the user, from the game).
 */
const TERMS = [
  [/\bPain\b/gi, "Agony"],
  [/\bBurn\b/gi, "Scorched"],
  [/\bRift\b/g, "Fracture"],
  [/\bImpair\b/g, "Weaken"],
  [/\bWounded\b/g, "Impair"],
  [/\bVulnerability\b/gi, "Vulnerable"],
  [/\bSignal\b/g, "Mark"],
  [/\b(?:heart rate|critical rate|crit rate)\b/gi, "Critical Chance"],
  [/\bLucky Hit\b/gi, "Critical Hit"],
  [/\b(?:strength|strong) damage\b/gi, "Tenacity Damage"],
  [/\bShield (?:Acquisition|Capture)\b/gi, "Shield Gain"],
  [/\bReinforcement Card(s?)\b/gi, "Upgrade Card$1"],
  [/\b(?:Abnormal Conditions?|status abnormality)\b/gi, "Status Ailment"],
  [/\b(?:flat|fixed) damage\b/gi, "Fixed Damage"],
  [/\b(?:flat|fixed) shield\b/gi, "Fixed Shield"],
  [/\bextinguished\b/gi, "Exhausted"],
  [/\bextinguishing\b/gi, "Exhausting"],
  [/\bextinguish\b/gi, "Exhaust"],
  [/\bBattered\b/g, "Ravaged"],
  [/\bwreck(?:ed)?\b/gi, "Ravaged"],
  [/\bwhen wrecking\b/gi, "on Ravage"],
  [/\bSave (\d+)\b(?!%)/g, "Stockpile $1"],
  [/\bCounter\b(?! Surge)(?!attack)/g, "Counterattack"],
  [/\bImmune\b/g, "Immunity"],
  [/\baction points?\b/gi, "AP"],
  [/\bAtk\b/gi, "Attack"],
  [/\bDef\b/gi, "Defense"],
  [/\bMax Health\b/gi, "Max HP"],
];
const officialTerms = (text) => TERMS.reduce((t, [re, to]) => t.replace(re, to), String(text || ""));

module.exports = { divinePool, epiphanyText, epiphanyRules, officialName, sameEquipmentName, fillValues, officialTerms, wikiFile, pyLiteral, mwJson, wikiText, cardText, infobox, fillPassive, decode, unmojibake, deckBuilderCards };
