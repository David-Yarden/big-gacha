const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    // Fall back to in-memory MongoDB for development if connection fails
    try {
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.log("External MongoDB unavailable, starting in-memory server...");
    }

    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();

    const conn = await mongoose.connect(uri);
    console.log(`MongoDB in-memory connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
