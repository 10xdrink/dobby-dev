const mongoose = require("mongoose");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

const TopbarSchema = new mongoose.Schema(
  {
    bgColor: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    textColor: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

TopbarSchema.post("save", async function (doc) {
  try {
    await cacheService.deletePattern("topbar:*");
    logger.debug({
      event: "TOPBAR_CACHE_INVALIDATED",
      topbarId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "TOPBAR_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

TopbarSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await cacheService.deletePattern("topbar:*");
    logger.debug({
      event: "TOPBAR_CACHE_INVALIDATED",
      topbarId: doc?._id,
    });
  } catch (err) {
    logger.error({
      event: "TOPBAR_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

module.exports = mongoose.model("Topbar", TopbarSchema);