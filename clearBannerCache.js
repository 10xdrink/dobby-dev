const mongoose = require("mongoose");
const cacheService = require("./services/cacheService");
const logger = require("./config/logger");
require("dotenv").config();

async function clearBannerCache() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    
    if (!mongoUri) {
      console.error("❌ Error: MONGO_URI or MONGO_URL not found in environment variables");
      process.exit(1);
    }
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    logger.info("✅ Connected to MongoDB");

    // Clear banner cache
    console.log("🗑️  Clearing banner cache...");
    const deletedCount = await cacheService.deletePattern("banner:*");
    logger.info(`✅ Cleared ${deletedCount} banner cache keys`);
    
    // Also clear global cache that might contain banner data
    const globalCount = await cacheService.deletePattern("global:*banner*");
    logger.info(`✅ Cleared ${globalCount} global banner cache keys`);

    console.log("\n✅ Banner cache cleared successfully!\n");

    // Close connection
    await mongoose.connection.close();
    logger.info("🔌 MongoDB connection closed");
    
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error clearing banner cache:", error);
    console.error(error);
    process.exit(1);
  }
}

// Run cache clearer
clearBannerCache();
