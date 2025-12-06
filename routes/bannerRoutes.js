const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  cacheMiddleware,
  cacheGlobal,
  invalidateCache,
} = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");
const {
  createBanner,
  getBanners,
  getPublishedBanners,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");

router.get(
  "/published",
  cacheGlobal(cacheService.TTL.LONG),
  getPublishedBanners
);

router.post(
  "/",
  upload.single("file"),
  createBanner,
  invalidateCache(() => "banner:*")
);

router.get(
  "/",
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: () => "banners:all",
  }),
  getBanners
);

router.put(
  "/:id",
  upload.single("file"),
  updateBanner,
  invalidateCache((req) => `banner:${req.params.id}:*`)
);

router.delete(
  "/:id",
  deleteBanner,
  invalidateCache((req) => `banner:${req.params.id}:*`)
);

module.exports = router;
