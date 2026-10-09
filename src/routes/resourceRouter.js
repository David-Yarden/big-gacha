/**
 * Generic route factory — creates standard GET routes for any model.
 * Keeps things DRY: one function generates routes for characters, weapons, etc.
 */

const express = require("express");
const queryBuilder = require("../middleware/queryBuilder");
const { escapeRegex } = require("../utils/query");

function createResourceRouter(Model, resourceName) {
  const router = express.Router();

  // GET /api/:game/characters            — list with filters + pagination
  // GET /api/:game/characters/:name      — single by name (case-insensitive, exact)

  router.get("/", (req, res, next) => {
    // The game always comes from the URL, never from the query string
    if (req.gameParam) req.query.game = req.gameParam;
    next();
  }, queryBuilder(Model), (req, res) => {
    res.json(res.queryResult);
  });

  router.get("/:name", async (req, res, next) => {
    try {
      const filter = {
        name: { $regex: `^${escapeRegex(req.params.name)}$`, $options: "i" },
      };
      if (req.gameParam) filter.game = req.gameParam;

      const doc = await Model.findOne(filter).lean();
      if (!doc) {
        return res.status(404).json({
          success: false,
          error: `${resourceName} "${req.params.name}" not found`,
        });
      }
      res.json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createResourceRouter;
