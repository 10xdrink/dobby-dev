const mongoose = require("mongoose");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

const bannerSchema = new mongoose.Schema(
  {
    bannerType: {
      type: String,
      enum: ["mainSectionBanner", "footerBanner", "Slider"],
      required: true,
    },
    bannerUrl: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["Product", "Category", "Shop"],
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

bannerSchema.post("save", async function (doc) {
  try {
    await cacheService.deletePattern("banner:*");
    logger.debug({
      event: "BANNER_CACHE_INVALIDATED",
      bannerId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "BANNER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

bannerSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await cacheService.deletePattern("banner:*");
    logger.debug({
      event: "BANNER_CACHE_INVALIDATED",
      bannerId: doc?._id,
    });
  } catch (err) {
    logger.error({
      event: "BANNER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

bannerSchema.post("deleteOne", { document: true }, async function (doc) {
  try {
    await cacheService.deletePattern("banner:*");
    logger.debug({
      event: "BANNER_CACHE_INVALIDATED",
      bannerId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "BANNER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

module.exports = mongoose.model("Banner", bannerSchema);
