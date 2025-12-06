const mongoose = require("mongoose");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

const homepageSliderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    buttonText: { type: String },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

homepageSliderSchema.post("save", async function (doc) {
  try {
    await cacheService.deletePattern("slider:*");
    logger.debug({
      event: "SLIDER_CACHE_INVALIDATED",
      sliderId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "SLIDER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

homepageSliderSchema.post("findOneAndUpdate", async function (doc) {
  try {
    await cacheService.deletePattern("slider:*");
    logger.debug({
      event: "SLIDER_CACHE_INVALIDATED",
      sliderId: doc?._id,
    });
  } catch (err) {
    logger.error({
      event: "SLIDER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

homepageSliderSchema.post("deleteOne", { document: true }, async function (doc) {
  try {
    await cacheService.deletePattern("slider:*");
    logger.debug({
      event: "SLIDER_CACHE_INVALIDATED",
      sliderId: doc._id,
    });
  } catch (err) {
    logger.error({
      event: "SLIDER_CACHE_INVALIDATION_ERROR",
      error: err.message,
    });
  }
});

module.exports = mongoose.model("HomepageSlider", homepageSliderSchema);
