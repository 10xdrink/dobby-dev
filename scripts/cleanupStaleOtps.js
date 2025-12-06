require("dotenv").config();
const mongoose = require("mongoose");
const OTP = require("../models/OTPModel");
const logger = require("../config/logger");

async function cleanupStaleOtps() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Connected to MongoDB for OTP cleanup");

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await OTP.deleteMany({
      $or: [
        { createdAt: { $lt: oneDayAgo } },
        { otpExpiry: { $lt: new Date() } },
      ],
    });

    logger.info(`Cleanup completed: ${result.deletedCount} stale OTP records removed`);
    console.log(` Cleaned up ${result.deletedCount} stale OTP records`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    logger.error("OTP cleanup failed:", err);
    console.error("✗ Cleanup failed:", err.message);
    process.exit(1);
  }
}

cleanupStaleOtps();
