/**
 * Generic query builder middleware.
 * Adds filtering, sorting, pagination, and field selection to any route.
 *
 * Usage in route: router.get("/", queryBuilder(Character), (req, res) => { ... })
 * The result is attached to res.queryResult
 *
 * Query params:
 *   ?game=genshin              — filter by game
 *   ?element=Pyro              — filter by field
 *   ?rarity=5                  — filter by rarity (auto-cast to number)
 *   ?search=hu                 — text search on name (case-insensitive)
 *   ?sort=name,-rarity         — sort fields (prefix - for descending)
 *   ?fields=name,element,rarity — select specific fields
 *   ?page=1&limit=20           — pagination
 */

const NUMERIC_FIELDS = ["rarity", "sourceId", "baseAtkValue"];
const RESERVED_PARAMS = ["sort", "fields", "page", "limit", "search"];

function queryBuilder(Model) {
  return async (req, res, next) => {
    try {
      // --- Build filter ---
      const filter = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (RESERVED_PARAMS.includes(key)) continue;

        if (NUMERIC_FIELDS.includes(key)) {
          filter[key] = Number(value);
        } else {
          filter[key] = value;
        }
      }

      // --- Text search on name ---
      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: "i" };
      }

      let query = Model.find(filter);

      // --- Sort ---
      if (req.query.sort) {
        const sortStr = req.query.sort.split(",").join(" ");
        query = query.sort(sortStr);
      } else {
        query = query.sort("name");
      }

      // --- Field selection ---
      if (req.query.fields) {
        const fieldsStr = req.query.fields.split(",").join(" ");
        query = query.select(fieldsStr);
      }

      // --- Pagination ---
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const skip = (page - 1) * limit;

      const total = await Model.countDocuments(filter);
      query = query.skip(skip).limit(limit);

      const results = await query.lean();

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
