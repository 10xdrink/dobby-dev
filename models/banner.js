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
      description: "Navigation URL when banner is clicked"
    },
    resourceType: {
      type: String,
      enum: ["Product", "Category", "Shop", "External"],
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
    // Content fields for customization
    title: {
      type: String,
      default: "",
      description: "Main heading displayed on banner"
    },
    subtitle: {
      type: String,
      default: "",
      description: "Secondary text displayed on banner"
    },
    description: {
      type: String,
      default: "",
      description: "Additional description text"
    },
    buttonText: {
      type: String,
      default: "Explore Now",
      description: "Text shown on the CTA button"
    },
    buttonUrl: {
      type: String,
      default: "",
      description: "Override URL for button (if different from bannerUrl)"
    },
    textColor: {
      type: String,
      default: "#FFFFFF",
      description: "Color for text overlay"
    },
    buttonColor: {
      type: String,
      default: "#2563EB",
      description: "Background color for CTA button"
    },
    overlayOpacity: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1,
      description: "Darkness of overlay on banner image"
    },
    displayOrder: {
      type: Number,
      default: 0,
      description: "Order in which banner appears"
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
