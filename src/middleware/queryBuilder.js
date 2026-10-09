/**
 * Generic query builder middleware.
 * Adds filtering, sorting, pagination, and field selection to any route.
 *
 * Usage in route: router.get("/", queryBuilder(Character), (req, res) => { ... })
 * The result is attached to res.queryResult
 *
 * Query params:
 *   ?element=Pyro              — filter by any scalar schema field
 *   ?rarity=5                  — numeric fields are cast to numbers
 *   ?region=Others             — characters with no region
 *   ?search=hu                 — case-insensitive, literal search on name
 *   ?sort=name,-rarity         — sort fields (prefix - for descending)
 *   ?fields=name,element       — select specific fields
 *   ?page=1&limit=20           — pagination
 *
 * Only fields that exist on the schema are honoured; anything else
 * (unknown keys, operator objects like ?name[$ne]=x) is ignored.
 */

const {
  escapeRegex,
  filterableFields,
  selectableFields,
  cleanFieldList,
} = require("../utils/query");

const RESERVED_PARAMS = new Set(["sort", "fields", "page", "limit", "search"]);

function buildFilter(Model, query) {
  const allowed = filterableFields(Model);
  const filter = {};

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (!allowed.has(key)) continue;
    if (typeof value !== "string") continue; // rejects ?a[$ne]=x and ?a=1&a=2

    const type = Model.schema.path(key)?.instance;
    if (type === "Number" || (type === "Array" && Model.schema.path(key).caster?.instance === "Number")) {
      const n = Number(value);
      if (Number.isNaN(n)) continue;
      filter[key] = n;
    } else if (type === "Boolean") {
      filter[key] = value === "true";
    } else if (key === "region" && value === "Others") {
      filter.$or = [{ region: null }, { region: "" }, { region: { $exists: false } }];
    } else {
      filter[key] = value;
    }
  }

  if (typeof query.search === "string" && query.search.trim()) {
    filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  }

  return filter;
}

function queryBuilder(Model) {
  return async (req, res, next) => {
    try {
      const filter = buildFilter(Model, req.query);
      let query = Model.find(filter);

      // --- Sort ---
      const sortFields = cleanFieldList(req.query.sort, filterableFields(Model), { allowDesc: true });
      query = query.sort(sortFields.length ? sortFields.join(" ") : "name");
      // Versions are strings: compare digits as numbers so "4.10" comes after "4.6"
      if (sortFields.some((f) => f.replace(/^-/, "") === "version")) {
        query = query.collation({ locale: "en", numericOrdering: true });
      }

      // --- Field selection ---
      const selected = cleanFieldList(req.query.fields, selectableFields(Model));
      if (selected.length) query = query.select(selected.join(" "));

      // --- Pagination ---
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const skip = (page - 1) * limit;

      const [total, results] = await Promise.all([
        Model.countDocuments(filter),
        query.skip(skip).limit(limit).lean(),
      ]);

      res.queryResult = {
        success: true,
        count: results.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: results,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = queryBuilder;
module.exports.buildFilter = buildFilter;
