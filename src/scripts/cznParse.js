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
    .replace(/\[([^\]]+)\]/g, "**$1**")
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
      // Some "English" entries are still the Japanese draft: skip them
      const raw = text.descriptions?.[level];
      const desc = raw && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(raw) ? raw : undefined;
      levels.push({ level, cost: cost ? Number(cost[1]) : undefined, type, desc: desc ? unmojibake(desc).trim() : undefined });
    }
    out[id] = { name: text.name, levels };
  }
  return out;
}

module.exports = { wikiFile, pyLiteral, mwJson, wikiText, cardText, infobox, fillPassive, decode, unmojibake, deckBuilderCards };
