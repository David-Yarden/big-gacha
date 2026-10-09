require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────
// Personal tool: only the local Vite dev server needs cross-origin access.
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ─── Health check ────────────────────────────────────────
const healthHandler = (req, res) => {
  res.json({ status: "ok", db: connectDB.mode, timestamp: new Date().toISOString() });
};
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ─── Routes ──────────────────────────────────────────────
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

  app.listen(PORT, () => {
    console.log(`🎮 Big Gacha API running on http://localhost:${PORT}`);
    console.log(`📖 API docs at http://localhost:${PORT}/api\n`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
