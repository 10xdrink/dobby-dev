const express = require("express");
const router = express.Router();
const {
  cacheMiddleware,
  cacheGlobal,
  invalidateCache,
} = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");
const {
  createSlider,
  getAllSliders,
  updateSlider,
  deleteSlider,
  togglePublish,
  getPublishedSliders,
} = require("../controllers/sliderController");
const upload = require("../middleware/upload");

// Admin CRUD
router.post(
  "/",
  upload.single("image"),
  createSlider,
  invalidateCache(() => "slider:*")
);

router.get(
  "/",
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: () => "sliders:all",
  }),
  getAllSliders
);

router.put(
  "/:id",
  upload.single("image"),
  updateSlider,
  invalidateCache((req) => `slider:${req.params.id}:*`)
);

router.delete(
  "/:id",
  deleteSlider,
  invalidateCache((req) => `slider:${req.params.id}:*`)
);

router.patch(
  "/:id/toggle",
  togglePublish,
  invalidateCache((req) => `slider:${req.params.id}:*`)
);

// Public route (homepage)
router.get(
  "/published",
  cacheGlobal(cacheService.TTL.VERY_LONG),
  getPublishedSliders
);

module.exports = router;
