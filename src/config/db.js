const mongoose = require("mongoose");

/**
 * Connect to MongoDB.
 *
 * By default a failed connection is fatal: silently falling back to a
 * throw-away in-memory database hides real problems and loses data.
 * Set ALLOW_MEMORY_DB=true in .env to opt in to the in-memory fallback
 * (handy for a quick demo without MongoDB installed).
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/gacha-db";

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    connectDB.mode = "mongodb";
    return;
  } catch (err) {
    if (process.env.ALLOW_MEMORY_DB !== "true") {
      console.error("\n❌ Impossible de se connecter à MongoDB :", err.message);
      console.error(`   URI : ${uri}`);
      console.error("   Vérifie que le service tourne :  Get-Service -Name MongoDB   puis   net start MongoDB");
      console.error("   (ou ALLOW_MEMORY_DB=true dans .env pour une base temporaire en mémoire)\n");
      process.exit(1);
    }
  }

  console.warn("⚠  MongoDB indisponible — base TEMPORAIRE en mémoire (ALLOW_MEMORY_DB=true). Les données seront perdues à l'arrêt.");
  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  const conn = await mongoose.connect(mongod.getUri());
  console.log(`MongoDB in-memory connected: ${conn.connection.host}`);
  connectDB.mode = "memory";
};

connectDB.mode = "disconnected";

module.exports = connectDB;
