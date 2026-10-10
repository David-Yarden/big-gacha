/**
 * Official translations of the game texts.
 *
 * During a sync the game's seeders run twice: in English (the documents themselves) and
 * in another language (French). Both runs go through the same code, so they produce the
 * same operations in the same order with the same numbers, images and ids — only the
 * texts differ. Each English document gets `i18n.<lang>`: the texts that differ, in the
 * same shape (objects keep only changed keys, arrays of the same length keep their
 * positions with null for "unchanged", other arrays are stored whole; an object whose keys
 * are themselves texts becomes { $replace: translated object }).
 *
 * The client lays `i18n.fr` over the document when French is selected.
 */

// Values used as keys by the site (filters, icons, colours, links between games):
// never translated, whatever the game text says
const KEEP = new Set([
  "_id", "game", "sourceId", "images", "icon", "image", "rarity", "version", "element", "subElement",
  "availableElements", "path", "weaponType", "specialty", "region", "type", "kind", "attackType",
  "category", "i18n", "signatureWeaponId", "stats", "fit",
]);

// Fields holding the name of another document
const NAME_REFS = ["signature", "signatureOf", "signatureWeapon"];

/** Deep text difference of `fr` against `en` (undefined when identical). */
function textDiff(en, fr, top = true) {
  if (typeof fr === "string") return typeof en === "string" && en === fr ? undefined : fr;
  if (fr === null || typeof fr !== "object") return undefined;
  if (Array.isArray(fr)) {
    if (!Array.isArray(en) || en.length !== fr.length) {
      // Different shape: keep the translated array whole if it holds any text
      return hasText(fr) ? fr : undefined;
    }
    const out = fr.map((v, i) => textDiff(en[i], v, false) ?? null);
    return out.some((v) => v !== null) ? out : undefined;
  }
  if (fr instanceof Date) return undefined;
  // Objects keyed by text (e.g. costs per skill name): different keys, replaced whole.
  // Never a whole document, nor an object holding key fields (element, images…)
  if (!top && en && typeof en === "object" && !Array.isArray(en) && !Object.keys(fr).some((k) => KEEP.has(k))) {
    const ek = Object.keys(en).filter((k) => !KEEP.has(k));
    const fk = Object.keys(fr).filter((k) => !KEEP.has(k));
    if (fk.some((k) => !(k in en)) && ek.some((k) => !(k in fr))) return { $replace: fr };
  }
  const out = {};
  for (const [k, v] of Object.entries(fr)) {
    if (KEEP.has(k)) continue;
    const d = textDiff(en?.[k], v, false);
    if (d !== undefined) out[k] = d;
  }
  return Object.keys(out).length ? out : undefined;
}

function hasText(v) {
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.some(hasText);
  if (v && typeof v === "object" && !(v instanceof Date)) return Object.values(v).some(hasText);
  return false;
}

/** Structure, numbers and image URLs of a value, every text blanked: equal across languages. */
function fingerprint(v) {
  return JSON.stringify(v, (k, x) => (typeof x === "string" ? (/^(https?:)?\//.test(x) ? x : "") : x));
}

/**
 * Attach the translated texts of `langOps` to the matching English `ops` (in place).
 * Returns { matched, unmatched } counts per model.
 */
function attachTranslations(ops, langOps, lang) {
  const stats = {};
  const byModel = (list) => {
    const m = new Map();
    for (const op of list) {
      if (op.op !== "upsert" || typeof op.filter?.name !== "string") continue;
      if (!m.has(op.model)) m.set(op.model, []);
      m.get(op.model).push(op);
    }
    return m;
  };
  const en = byModel(ops);
  const tr = byModel(langOps);
  for (const [model, list] of en) {
    const other = tr.get(model) ?? [];
    if (!other.length) continue; // not produced by the translated run (e.g. banners)
    const s = (stats[model] = { matched: 0, unmatched: 0, names: [] });
    // Fallback lookups when positions drift: unique fingerprint, then source id
    const prints = new Map();
    for (const o of other) {
      const f = fingerprint(o.set);
      prints.set(f, prints.has(f) ? null : o);
    }
    const bySource = new Map(other.filter((o) => o.set.sourceId != null).map((o) => [String(o.set.sourceId), o]));
    list.forEach((op, i) => {
      const f = fingerprint(op.set);
      let match = other[i] && fingerprint(other[i].set) === f ? other[i] : null;
      if (!match) match = prints.get(f) ?? null;
      if (!match && op.set.sourceId != null) match = bySource.get(String(op.set.sourceId)) ?? null;
      // Same number of documents in both runs: the position is reliable enough
      if (!match && other.length === list.length) match = other[i];
      if (!match) {
        s.unmatched++;
        if (s.names.length < 5) s.names.push(op.filter.name);
        return;
      }
      s.matched++;
      const diff = textDiff(op.set, { ...match.set, name: match.filter.name });
      op.set.i18n = { ...(op.set.i18n || {}), [lang]: diff ?? {} };
    });
  }
  // Names of other documents written in English by both runs (tables keyed by English
  // name, e.g. signature weapons): translated through the documents' own French names
  const names = new Map();
  for (const op of ops) {
    const tr = op.set?.i18n?.[lang]?.name;
    if (tr && typeof op.filter?.name === "string") names.set(op.filter.name, tr);
  }
  for (const op of ops) {
    const t = op.set?.i18n?.[lang];
    if (!t) continue;
    for (const field of NAME_REFS) {
      const v = op.set[field];
      if (typeof v === "string" && t[field] === undefined && names.has(v)) t[field] = names.get(v);
    }
  }
  return stats;
}

module.exports = { attachTranslations, textDiff, fingerprint, KEEP };
