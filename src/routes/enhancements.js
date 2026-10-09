/**
 * /api/enhancements — loader status and manual reload of the YAML files.
 */
const express = require("express");
const { loadEnhancements, loadStatus } = require("../enhancements/loader");

const router = express.Router();

router.get("/status", (req, res) => res.json({ success: true, data: loadStatus() }));

router.post("/reload", async (req, res, next) => {
  try {
    res.json({ success: true, data: await loadEnhancements() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
