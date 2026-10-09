require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;
// Personal tool: only this computer can reach the API (set HOST=0.0.0.0 to open it to the LAN)
const HOST = process.env.HOST || "127.0.0.1";

// ─── Middleware ───────────────────────────────────────────
// Personal tool: only the local Vite dev server needs cross-origin access.
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json());

// Actions (POST, PUT, DELETE) must carry the app's header: a web page on another site
// cannot add it without a CORS preflight, which only localhost origins pass.
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.get("x-big-gacha")) return next();
  res.status(403).json({ success: false, error: "Missing X-Big-Gacha header" });
});
if (process.env.NODE_ENV !== "production") {
  // Image cache hits would flood the log
  app.use(morgan("dev", { skip: (req) => req.originalUrl.startsWith("/api/img") }));
}

// ─── Health check ────────────────────────────────────────
const healthHandler = (req, res) => {
  res.json({ status: "ok", db: connectDB.mode, timestamp: new Date().toISOString() });
};
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ─── Routes ──────────────────────────────────────────────
app.use("/api/sync", require("./routes/sync")); // before /api/:game
app.use("/api/enhancements", require("./routes/enhancements"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/search", require("./routes/search"));
app.use("/api/img", require("./routes/img"));
app.use("/api", apiRoutes);

// ─── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found. Visit GET /api for available endpoints.`,
  });
});

// ─── Error handler ───────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────
async function start() {
  await connectDB();

  const { Character } = require("./models");
  if ((await Character.estimatedDocumentCount()) === 0) {
    console.warn("\n⚠  La base est vide. Lance les imports :  npm run seed:genshin  /  npm run seed:hsr  /  npm run seed:wuwa\n");
  }

  await require("./migrations").runMigrations();

  // Kit enhancements (YAML files) → database
  await require("./enhancements/loader").loadEnhancements().catch((err) => console.warn("⚠ ", err.message));

  app.listen(PORT, HOST, () => {
    console.log(`🎮 Big Gacha API running on http://${HOST}:${PORT}`);
    console.log(`📖 API docs at http://${HOST}:${PORT}/api\n`);
    require("./sync/scheduler").start();
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
