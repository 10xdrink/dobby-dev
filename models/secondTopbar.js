const mongoose = require("mongoose");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

const secondTopbarSchema = new mongoose.Schema(
  {
    bgColor: { type: String, required: true },
    text1: { type: String },
    text2: { type: String },
    text3: { type: String },
    disText1: {
      type: String,
    },
    disText2: {
      type: String,
    },
    textColor: { type: String, required: true },
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

secondTopbarSchema.post("save", async function (doc) {
  try {
    await cacheService.deletePattern("topbar:*");
    logger.debug({
      event: "SECOND_TOPBAR_CACHE_INVALIDATED",
      topbarId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "SECOND_TOPBAR_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

secondTopbarSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await cacheService.deletePattern("topbar:*");
    logger.debug({
      event: "SECOND_TOPBAR_CACHE_INVALIDATED",
      topbarId: doc?._id,
    });
  } catch (err) {
    logger.error({
      event: "SECOND_TOPBAR_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

const SecondTopbar = mongoose.model("SecondTopbar", secondTopbarSchema);

module.exports = SecondTopbar;