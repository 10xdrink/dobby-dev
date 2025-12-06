const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload")
const { updateReliability, getAllReliability, getActiveReliability } = require("../controllers/compnayReliabilityController");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

router.put("/", upload.single("icon"), updateReliability, invalidateCache("reliability:*"));

router.get("/", cacheGlobal(cacheService.TTL.LONG), getAllReliability);

router.get("/active", cacheGlobal(cacheService.TTL.LONG), getActiveReliability);

module.exports = router;
